import { createLogger } from 'file:///D:/.ai-hub/skills/yy/scripts/lib/logger.mjs';
import * as gate from 'file:///D:/.ai-hub/skills/yy/scripts/lib/gate.mjs';
import { ContractViolationError } from 'file:///D:/.ai-hub/skills/yy/scripts/lib/gate.mjs';
import { resolveAdapter, PROMPT_ADAPTER } from 'file:///D:/.ai-hub/skills/yy/scripts/lib/adapters/index.mjs';
import { withRetry, retryAcrossHosts, resolveHosts } from 'file:///D:/.ai-hub/skills/yy/scripts/lib/resilience.mjs';
import { RetryableError, TimeoutError } from 'file:///D:/.ai-hub/skills/yy/scripts/lib/errors.mjs';
// GW-1 治理接线（接线点 B）：失败路径 GOVERNANCE 指路行单点（systematic-debugging）。
// 只指路不注入正文（防 prompt 爆炸——GW-1 派单裁定）；governance-skills 缺失时
// governancePointerLine → null，静默跳过（向后兼容）。单点实现见 scripts/lib/governance.mjs。
// F-030：失败码 → failure_recovery 组冻结事件映射（CAPABILITY_MISSING/INELIGIBLE_* 等 → gate_failed）
// 单点在 governanceEventForFailureCode（governance.mjs，映射表对应关系见其文件头注释）。
import { governancePointerLine, governanceEventForFailureCode } from 'file:///D:/.ai-hub/skills/yy/scripts/lib/governance.mjs';

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// B5（T6 接线）：adapter resolver 依赖注入（A0 修正案）+ activation.prepare 三级激活路由
// ---------------------------------------------------------------------------
// DI：默认指向静态 import 的 resolveAdapter；可由 setAdapterResolver(fn) 注入测试替身，
// 或被单次 opts.resolveAdapter 覆盖——不改 adapters/index.mjs（接线序解耦）。
const DEFAULT_VENDOR_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'vendor');
let _adapterResolver = resolveAdapter;
/** 注入/还原 adapter resolver；返回旧 resolver（便于测试还原）。 */
export function setAdapterResolver(fn) {
  const prev = _adapterResolver;
  _adapterResolver = (typeof fn === 'function') ? fn : resolveAdapter;
  return prev;
}
function resolveAdapterDI(asset, backend, opts) {
  if (opts && typeof opts.resolveAdapter === 'function') return opts.resolveAdapter(asset, backend);
  return _adapterResolver(asset, backend);
}

// ---------------------------------------------------------------------------
// CD-1（批 2）：capability dispatch 完整形态 —— runtime 失败记忆（F-030 同一失败族的面级记录）
// ---------------------------------------------------------------------------
// GV-2 debugging 摘要消费链的记录侧：失败码（含 INELIGIBLE_* 具名族）写入 workspace 记忆文件。
// GV-2 派单把 debugging 注入从"指路行"升级为"下一次同类失败任务的 brief 注入 debugging 摘要
// （≤2KB，运行时记忆式消费）"——本文件只做面级记录单点（运行时已具名失败码 + 事件时间戳 ISO，
// 时间戳仅进记忆文件不进 brief——brief 组合零时间戳纪律不受影响）；摘要生成/注入单点在
// governance.mjs（recordFailureMemory / debuggingMemorySection）。记录失败不阻断执行（best-effort）。
const FAILURE_MEMORY_RELPATH = path.join('.tt-state', 'debugging-memory.json');
async function recordFailureMemory(workspace, entry) {
  try {
    const file = path.join(workspace || '.', FAILURE_MEMORY_RELPATH);
    let memo = { failures: [] };
    try { memo = JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { /* 无记忆文件 → 初始化 */ }
    if (!memo || typeof memo !== 'object' || !Array.isArray(memo.failures)) memo = { failures: [] };
    memo.failures.push({ code: String(entry.code || ''), event: String(entry.event || 'gate_failed'), at: new Date().toISOString() });
    memo.failures = memo.failures.slice(-20); // 防膨胀：只保留最近 20 条（摘要单点 governance.mjs 只消费最近 3 条）
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(memo, null, 2));
  } catch (e) { /* 记忆写失败不阻断执行（best-effort） */ }
}

// YY_ACTIVATION=lib|legacy（默认 legacy，不改变旧行为）。与 activation.mjs 的 YY_RECEIPT_MODE 是两个变量。
function resolveActivationMode(env = process.env) {
  const v = String((env && env.YY_ACTIVATION) || '').trim().toLowerCase();
  if (v === 'lib') return { mode: 'lib' };
  if (v === 'legacy' || v === '') return { mode: 'legacy' };
  return { mode: 'legacy', warning: 'YY_ACTIVATION=' + v + ' 非法，降级 legacy（不阻断）' };
}
// AV-3（v3.5）：Gate-2 manifest hash 绑定 + 资格门的默认 manifest 读面（与 activation.mjs ASSET_MANIFEST_V2_PATH 同一路径；
// 本地复算常量以避免 eager import activation.mjs 改变模块加载图——resolver 仍走 dispatch 内动态 import，与 activationPrepare 接线同法）。
const DEFAULT_MANIFEST_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'contracts', 'asset-manifest-v2.json');
/** 资格门失败码派生：resolver reason[] 内的 fail-closed 令牌 → INELIGIBLE_* 具名码（对齐 EX-1 CAPABILITY_MISSING 诚实降级）。 */
function eligibilityCode(reasons) {
  const text = (reasons || []).join(' | ');
  if (text.includes('INELIGIBLE_CAPABILITY_UNKNOWN')) return 'INELIGIBLE_CAPABILITY_UNKNOWN';
  if (text.includes('CANDIDATE_INVALID')) return 'INELIGIBLE_CANDIDATE_INVALID';
  if (text.includes('ASSET_NOT_FOUND')) return 'INELIGIBLE_ASSET_NOT_FOUND';
  if (text.includes('INELIGIBLE_DROP_PENDING')) return 'INELIGIBLE_DROP_PENDING';
  if (text.includes('INELIGIBLE_WHEN_NOT_TO_USE')) return 'INELIGIBLE_WHEN_NOT_TO_USE';
  return 'INELIGIBLE';
}
// GW-1 治理接线：失败码触发面（gate/adapter 失败族）——F-030 后指路判定不再由本文件正则承担，
// 单点 = governance.mjs governanceEventForFailureCode 的映射表 + Owner 冻结集两键匹配（其文件头
// 注释显式声明映射关系：CAPABILITY_MISSING / INELIGIBLE_* / RESOLVER_INTERNAL_ERROR /
// *_NOT_AVAILABLE / *_OUTPUT_INVALID → gate_failed；regression_failed/migration_failed 直通）。
// 原 GOV_FAILURE_CODE_RE 正则随 F-030 废除删除；触发面语义不变，仅判定单点收敛到 governance.mjs。
export function createContextBus() {
  const values = new Map();
  return { set(key, value) { JSON.stringify(value); values.set(key, value); }, get(key) { return values.get(key); }, has(key) { return values.has(key); }, dump() { return Object.fromEntries(values); } };
}
/** M2-1 状态事件钩子：opts.onStatus(subtask, phaseInfo) 在子任务状态变化（running/done/skipped/failed）时调用。
 *  - dry-run 不上报（无真实状态变化）；回调异常一律吞掉，保证「TUI 失败不改变执行语义」（回归面为零）。
 *  - phaseInfo 含 status/mode/degraded/attempts/elapsedMs，供 TUI 渲染；state.json 全量写语义不变。 */
function emitStatus(plan, subtask, status, opts, extra) {
  if (!opts || opts.dryRun || typeof opts.onStatus !== 'function') return;
  const elapsedMs = (extra && extra.elapsedMs) || 0;
  try {
    opts.onStatus(subtask, {
      planId: (plan && plan.id) || subtask.planId || null,
      subtaskId: subtask.id,
      status,
      phase: subtask.phase,
      mode: subtask.mode || null,
      degraded: subtask.mode === 'planned-only' || (subtask.mode === 'prompt' && subtask.assetConsumed !== true),
      attempts: subtask.attempts,
      elapsedMs,
    });
  } catch (error) { /* 事件回调异常不得改变执行语义 */ }
}
// EX-1 能力门控：子任务资产 → 所需能力（能力名固定枚举：write_files/run_cmd/network/spawn_subagent/mcp_client）。
// 映射原则：专用 CLI adapter 资产（真跑外部命令）需要 run_cmd；prompt 兜底资产仅需 write_files（指令包落盘）。
// 映射是静态保守声明——探测失败/缺能力 → dispatch 内诚实降级，不静默改用弱能力。
export function getRequiredCapabilities(asset) {
  switch (asset) {
    case 'implementation':
    case 'dev-backend':
    case 'be-implementer':
    case 'sdlc':
    case 'be-validator':
    case 'portman':
    case 'security':
    case 'skill-sentinel':
      return ['write_files', 'run_cmd'];
    default:
      return ['write_files'];
  }
}

export async function dispatch(subtask, ctx, opts = {}) {
  let logger = opts.logger;
  if (!logger) logger = createLogger(opts.verbose);
  if (opts.dryRun) { console.log('[dry-run] 将执行 ' + subtask.asset); return { ok: true, dryRun: true, artifactPath: null, error: null }; }
  // CD-1（批 2，v3.2 capability dispatch 完整形态）：subtask.capability 在场 = capability 输入模式——
  // asset name 降为内部解析产物：capability → resolver（CAPABILITY_MAP 受控映射，activation.mjs 头
  // 注释声明；禁模糊语义匹配——v3.4 裁定）→ manifest id → 资格判定 → subtask.asset 内部绑定 → adapter。
  //   - capability 解析/资格失败 → INELIGIBLE_* 具名（fail-closed 不猜；INELIGIBLE_CAPABILITY_UNKNOWN
  //     = 无映射或映射产物无 manifest 行），不派单（对齐 AV-3 诚实降级）；
  //   - 选择过程留痕：{capability, selected_asset, eligible, reason[]} 进 subtask.eligibility（审计面）；
  //   - 向后兼容：无 capability 字段 → 走下方既有 name-based 全链（零改动）；同 subtask 同时带
  //     asset + capability 时以 capability 为准（asset 视为过期缓存提示）。
  //   - EX-1 能力门控（getRequiredCapabilities）：capability 模式下在 asset 绑定后按绑定资产名照常
  //     生效（映射产物 id ⊆ manifest 9 资产 ⊆ getRequiredCapabilities 枚举面）。
  let capabilityEligibility = null; // capability 模式解析产物（供下方 AV-3 资格门复用，避免重解析覆写审计链）
  if (subtask.capability !== undefined && subtask.capability !== null && String(subtask.capability).trim()) {
    const capReq = String(subtask.capability).trim();
    try {
      const { resolveAssetEligibility } = await import('file:///D:/.ai-hub/skills/yy/scripts/lib/activation.mjs');
      const eligibility = await resolveAssetEligibility(
        { capability: capReq, requirements: opts.eligibilityRequirements, constraints: opts.eligibilityConstraints },
        { manifestPath: opts.manifestPath || DEFAULT_MANIFEST_PATH }
      );
      subtask.eligibility = { capability: capReq, selected_asset: eligibility.selected_asset, eligible: eligibility.eligible, reason: eligibility.reason };
      if (!eligibility.eligible || !eligibility.selected_asset) {
        const code = eligibilityCode(eligibility.reason);
        subtask.status = 'skipped'; subtask.mode = 'skipped'; subtask.adapter = 'none'; subtask.error = code;
        logger.warn('subtask skipped: ' + code + ' (capability=' + capReq + ') —— capability dispatch fail-closed（CD-1：受控映射无命中/资格失败不派单，不猜）: ' + eligibility.reason.join(' | '));
        if (opts.workspace) await recordFailureMemory(opts.workspace, { code, event: governanceEventForFailureCode(code) || 'gate_failed' });
        emitStatus(null, subtask, 'skipped', opts, { elapsedMs: 0 });
        return { ok: true, skipped: true, artifactPath: null, error: code };
      }
      const previousAsset = subtask.asset;
      subtask.asset = eligibility.selected_asset; // asset name 降为内部解析产物（capability 模式）
      capabilityEligibility = eligibility;        // 解析链留痕供 AV-3 资格门复用
      if (previousAsset && previousAsset !== subtask.asset) {
        logger.info('capability dispatch: ' + capReq + ' → asset=' + subtask.asset + '（原 asset 提示 ' + previousAsset + ' 被 capability 解析覆盖）');
      }
    } catch (e) {
      // fail-closed（与 name-based 资格门同口径）：capability 解析异常 = 资格无法建立，不得静默回退
      const code = 'RESOLVER_INTERNAL_ERROR';
      subtask.status = 'skipped'; subtask.mode = 'skipped'; subtask.adapter = 'none'; subtask.error = code;
      logger.warn('subtask skipped: ' + code + ' (capability=' + capReq + ') —— capability dispatch 异常 fail-closed（不静默放行）: ' + e.message);
      if (opts.workspace) await recordFailureMemory(opts.workspace, { code, event: governanceEventForFailureCode(code) || 'gate_failed' });
      emitStatus(null, subtask, 'skipped', opts, { elapsedMs: 0 });
      return { ok: true, skipped: true, artifactPath: null, error: code };
    }
  }
  // AV-3（v3.5）：Gate-2 manifest hash 绑定 + 资格门——runtime 不得直接拿 asset，必须过 resolver→approved asset
  // （修复 F-007）。manifest 不在场 → 维持旧行为（向后兼容，与 preflight P6 同口径）；
  // 批 1 hash 不一致仅记账 warning 不阻断（AS-2 晋升时升级硬门）；resolver fail-closed（eligible=false）→
  // mode=skipped + error=INELIGIBLE_*（对齐 EX-1 CAPABILITY_MISSING 诚实降级模式，不静默派单）。
  // EX-1 能力门控段（下方）零改动；本门在其之前（dispatch 前过 resolver）。测试可 opts.skipEligibilityGate 跳过。
  const manifestPath = opts.manifestPath || DEFAULT_MANIFEST_PATH;
  let manifestPresent = true;
  try { await fs.access(manifestPath); } catch (e) { manifestPresent = false; }
  if (manifestPresent && !opts.skipEligibilityGate) {
    try {
      const raw = await fs.readFile(manifestPath);
      const manifestSha256 = crypto.createHash('sha256').update(raw).digest('hex');
      if (ctx && typeof ctx.set === 'function') ctx.set('manifest_sha256', manifestSha256);
      logger.info('Gate-2 manifest_sha256=' + manifestSha256 + ' (' + manifestPath + ')');
      const expectedSha = opts.manifestExpectedSha256 || process.env.YY_MANIFEST_EXPECTED_SHA256 || null;
      if (expectedSha && expectedSha !== manifestSha256) {
        logger.warn('MANIFEST_SHA256_MISMATCH: manifest_sha256=' + manifestSha256 + ' != 期望 ' + expectedSha
          + '（Gate-2 批 1 记账不阻断；AS-2 晋升时升级硬门）');
      }
      const { resolveAssetEligibility } = await import('file:///D:/.ai-hub/skills/yy/scripts/lib/activation.mjs');
      const eligibility = capabilityEligibility || await resolveAssetEligibility(
        { asset: subtask.asset, requirements: opts.eligibilityRequirements, constraints: opts.eligibilityConstraints },
        { manifestPath }
      );
      subtask.eligibility = capabilityEligibility
        ? { capability: String(subtask.capability).trim(), selected_asset: capabilityEligibility.selected_asset, eligible: eligibility.eligible, reason: eligibility.reason }
        : { eligible: eligibility.eligible, reason: eligibility.reason };
      if (!eligibility.eligible) {
        const code = eligibilityCode(eligibility.reason);
        subtask.status = 'skipped'; subtask.mode = 'skipped'; subtask.adapter = 'none'; subtask.error = code;
        logger.warn('subtask skipped: ' + code + ' (asset=' + subtask.asset + ') —— 资格门 fail-closed（AV-3，不过 resolver 不派单）: ' + eligibility.reason.join(' | '));
        if (opts.workspace) await recordFailureMemory(opts.workspace, { code, event: governanceEventForFailureCode(code) || 'gate_failed' });
        emitStatus(null, subtask, 'skipped', opts, { elapsedMs: 0 });
        return { ok: true, skipped: true, artifactPath: null, error: code };
      }
    } catch (e) {
      // fail-closed（第八审计 F-004 采纳，2026-09-24）：manifest 在场但判定失败（坏 JSON/CANDIDATE_INVALID/
      // resolver 崩溃）= 资格无法建立 = 不得静默按旧行为派单（否则 resolver bug = 绕过资格门）。
      // 向后兼容仅限 manifest 缺失（上方 manifestPresent 分支）。
      const code = 'RESOLVER_INTERNAL_ERROR';
      subtask.status = 'skipped'; subtask.mode = 'skipped'; subtask.adapter = 'none'; subtask.error = code;
      logger.warn('subtask skipped: ' + code + ' (asset=' + subtask.asset + ') —— 资格门异常 fail-closed（manifest 在场但判定失败，不静默放行）: ' + e.message);
      if (opts.workspace) await recordFailureMemory(opts.workspace, { code, event: governanceEventForFailureCode(code) || 'gate_failed' });
      emitStatus(null, subtask, 'skipped', opts, { elapsedMs: 0 });
      return { ok: true, skipped: true, artifactPath: null, error: code };
    }
  }
  const adapter = resolveAdapterDI(subtask.asset, opts.backend, opts);
  if (!adapter) { subtask.status = 'skipped'; subtask.mode = 'skipped'; subtask.adapter = 'none'; logger.warn('asset adapter unavailable: ' + subtask.asset); return { ok: true, skipped: true, artifactPath: null, error: 'ADAPTER_NOT_AVAILABLE' }; }
  // B5: activation.prepare 三级激活（仅 YY_ACTIVATION=lib 且 prompt 后端时）；
  // 任何失败/无 budget 字段均降级 legacy + warning，绝不 BLOCK 旧流程。
  if (adapter === PROMPT_ADAPTER) {
    const act = resolveActivationMode();
    if (act.warning) logger.warn(act.warning);
    if (act.mode === 'lib' && !opts.activationPackage) {
      try {
        const { activationPrepare } = await import('file:///D:/.ai-hub/skills/yy/scripts/lib/activation.mjs');
        const prep = await activationPrepare({
          asset: subtask.asset,
          subtask: { id: subtask.id, task: subtask.task, contract: subtask.contract, preconditions: subtask.preconditions || [] },
          activationLevel: opts.activationLevel || 'body',
          opts: { vendorDir: opts.vendorDir || DEFAULT_VENDOR_DIR, workspace: opts.workspace, useCache: false },
        });
        if (prep.ok) opts.activationPackage = prep.data.activationPackage;
        else logger.warn('[YY_ACTIVATION=lib] activation.prepare 未通过(' + prep.code + ')，降级 legacy prompt 路径（不阻断）');
      } catch (e) {
        logger.warn('[YY_ACTIVATION=lib] activation.prepare 异常，降级 legacy（不阻断）: ' + e.message);
      }
    }
  }
  try { await gate.before(subtask, opts); } catch (error) { logger.warn('gate.before skipped: ' + error.message); }
  // 能力门控（EX-1）：检查子任务所需能力 vs 执行器实际能力，缺能力 → 诚实降级（不静默用弱能力）。
  // 门控在 gate.before 之后、真实执行之前——dry-run/skipped 短路已在前，无副作用。
  const requiredCaps = getRequiredCapabilities(subtask.asset);
  const actualCaps = (opts.executorDefaults && opts.executorDefaults.capabilities) || null;
  if (actualCaps) {
    const missingCaps = requiredCaps.filter(function(cap) { return !actualCaps[cap]; });
    if (missingCaps.length > 0) {
      subtask.missingCaps = missingCaps;
      logger.warn('subtask ' + subtask.id + ' (' + subtask.asset + ') 执行器能力缺失: ' + missingCaps.join(', ')
        + ' → 诚实降级（' + (actualCaps.write_files ? 'mode=prompt brief-only 兜底' : 'mode=skipped') + '），不静默用弱能力');
      if (actualCaps.write_files) {
        subtask.status = 'skipped'; subtask.mode = 'prompt'; subtask.adapter = 'none'; subtask.error = 'CAPABILITY_MISSING';
      } else {
        subtask.status = 'skipped'; subtask.mode = 'skipped'; subtask.adapter = 'none'; subtask.error = 'CAPABILITY_MISSING';
      }
      emitStatus(null, subtask, 'skipped', opts, { elapsedMs: 0 });
      try { await gate.after(subtask, opts); } catch (error) { logger.warn('gate.after skipped: ' + error.message); }
      return { ok: true, skipped: true, artifactPath: null, error: 'CAPABILITY_MISSING' };
    }
  }
  let result;
  try {
    // P1 失败自动恢复：prompt 后端 + 存在宿主（--exec 主宿主或 --hosts 备选宿主）→ 跨宿主/跨视角重试链。
    // 主宿主(--exec)失败（诚实降级 brief-only executor）→ 自动按序尝试备选宿主；全失败 → 保持诚实降级语义。
    // 无 --hosts 时 chain 仅含主宿主，行为与 2.5.0 完全一致（宿主失败 → brief-only 降级）。
    const hosts = resolveHosts(opts);
    const hasExecHost = Array.isArray(opts.exec) && opts.exec.length > 0;
    if (adapter === PROMPT_ADAPTER && (hasExecHost || hosts.length > 0)) {
      const outcome = await retryAcrossHosts(
        function(entry) {
          const hostOpts = entry ? Object.assign({}, opts, { exec: entry.command, execModel: entry.model || null }) : opts;
          return adapter.run(subtask, ctx, hostOpts);
        },
        { hosts: hosts, primary: hasExecHost ? opts.exec : null, maxRetries: opts.maxRetries }
      );
      result = outcome.result;
      // 恢复尝试计入 attempts（runGroup 已 +1 首次派单）；recovery 链记录换宿主/换视角明细
      if (Array.isArray(outcome.recovery) && outcome.recovery.length) {
        subtask.recovery = outcome.recovery;
        subtask.attempts += outcome.recovery.length;
      }
    } else {
      result = await withRetry(function() { return adapter.run(subtask, ctx, opts); }, { maxRetries: opts.maxRetries });
    }
  } catch (error) {
    result = { ok: false, error: error.message, artifactPath: null };
  }
  if (result.ok && result.artifactPath) { ctx.set('artifact:' + subtask.id, result.artifactPath); subtask.artifactPath = result.artifactPath; }
  // 先置状态再跑 gate：只有成功且非 dry-run/skipped 才算真实 done（杜绝假成功）
  if (result.ok && !result.dryRun && !result.skipped) subtask.status = 'done';
  // 执行模式标注（诚实性核心）：任何真实执行（prompt 宿主 or 专用 CLI）统一归 exec 桶；
  // prompt 无宿主/exec 失败 → prompt（brief-only 指令包）；专用 CLI 降级 → planned-only；
  // adapter 名保留在 subtask.adapter 供报告明细。
  if (result.skipped || result.error === 'ADAPTER_NOT_AVAILABLE' || result.error === 'OPENCODE_NOT_AVAILABLE' || result.error === 'CONTRACT_TOOL_NOT_AVAILABLE') subtask.mode = 'skipped';
  else if (subtask.status === 'done') subtask.mode = (adapter === PROMPT_ADAPTER) ? (result.executed ? 'exec' : 'prompt') : (result.degraded ? 'planned-only' : 'exec');
  subtask.adapter = adapter.name;
  if (typeof result.assetConsumed === 'boolean') subtask.assetConsumed = result.assetConsumed;
  // M2-1 状态事件：dispatch 内已定型的 done/skipped 变化即时上报（running/failed 由 runGroup 上报，防误导性双写）
  if (subtask.status !== 'running' && subtask.status !== 'idle') emitStatus(null, subtask, subtask.status, opts);
  try { await gate.after(subtask, opts); } catch (error) {
    if (error instanceof ContractViolationError && process.env.TT_GATE_MODE !== 'warn') throw error;
    logger.warn('gate.after skipped: ' + error.message);
  }
  return result;
}
export async function executePlan(plan, opts = {}) {
  let logger = opts.logger;
  if (!logger) logger = createLogger(opts.verbose);
  let ctx = opts.context;
  if (!ctx) ctx = createContextBus();
  // DAG 归一化：旧 state（resume）可能无 phase 字段 → 每 subtask 独立 phase 强制串行（与线性链现状一致）
  const subtasks = plan.subtasks;
  if (!subtasks.some(function(s) { return Number.isInteger(s.phase); })) {
    for (let i = 0; i < subtasks.length; i += 1) { subtasks[i].phase = i; subtasks[i].dependsOn = i === 0 ? [] : [subtasks[i - 1].id]; }
  }
  // 并发上限：--parallel N；不传 = 1（串行，向后兼容）；--parallel 缺省 = Infinity（phase 内全部并行）
  const parallel = opts.parallel === undefined ? 1 : opts.parallel;
  const maxPhase = subtasks.reduce(function(m, s) { return Math.max(m, s.phase); }, 0);
  for (let p = 0; p <= maxPhase; p += 1) {
    const group = subtasks.filter(function(s) { return s.phase === p; });
    await runGroup(group, plan, ctx, opts, logger, parallel);
    if (plan.status === 'failed') break;
  }
  if (plan.status !== 'failed' && !opts.dryRun) {
    if (plan._contractMissing) {
      // 契约缺失导致子任务被跳过：计划不得伪装成功（诚实性，独立验收 P1）
      plan.status = 'failed';
      plan.degraded = true;
      plan.warnings = ['契约未冻结（CONTRACT_NOT_FROZEN）：存在子任务因契约缺失被跳过，任务未完整执行——先重冻结再 --resume'];
      return { plan, context: ctx.dump() };
    }
    plan.status = 'done';
    const skipped = plan.subtasks.filter(function(s) { return s.status === 'skipped'; }).length;
    plan.degraded = plan.subtasks.length > 0 && skipped === plan.subtasks.length;
    plan.modes = {};
    for (const s of plan.subtasks) { if (s.mode) plan.modes[s.mode] = (plan.modes[s.mode] || 0) + 1; }
    // 机器可读警告：prompt/planned-only 兜底未真实执行
    plan.warnings = [];
    const depPrecondition = plan._depPrecondition || 0;
    if (depPrecondition) {
      plan.warnings.push(depPrecondition + ' 个子任务因上游未满足资产消费前置被跳过（DEP_PRECONDITION）——上游须真实执行并产出资产消费证据后再 --resume 续跑下游');
    }
    if (plan.modes.prompt) plan.warnings.push(plan.modes.prompt + ' 个子任务为 prompt 兜底（仅指令包，需宿主消费）');
    if (plan.modes['planned-only']) plan.warnings.push(plan.modes['planned-only'] + ' 个子任务为 planned-only 降级（外部 CLI 缺失）');
    const notConsumed = plan.subtasks.filter(function(s) { return s.assetConsumed === false; }).length;
    if (notConsumed) plan.warnings.push(notConsumed + ' 个子任务产物未含资产消费标记（资产标题锚点，宿主自声明、可伪造，仅作弱证据——不代表资产方法论被真实采用）');
    // F2 7 资产强制机制（requireExec）：T2 不可纯 prompt 兜底，brief-only 须标记 degraded
    if (plan.requireExec) {
      const briefOnly = plan.subtasks.filter(function(s) { return s.mode === 'prompt' && s.assetConsumed !== true; });
      if (briefOnly.length) {
        plan.degraded = true;
        plan.warnings.push('⚠ requireExec 强制：' + briefOnly.length + ' 个子任务 brief-only 兜底（' + briefOnly.map(function(s) { return s.asset; }).join(', ') + '）——T2 资产需 --exec 宿主真实执行，不可纯 prompt 兜底');
      }
    }
    // 能力门控汇总警告：CAPABILITY_MISSING 降级留痕（诚实性——缺能力不假报执行）
    const capMissing = plan.subtasks.filter(function(s) { return s.error === 'CAPABILITY_MISSING'; });
    if (capMissing.length) {
      plan.degraded = true;
      plan.warnings.push('能力门控：' + capMissing.length + ' 个子任务因执行器能力缺失降级（' + capMissing.map(function(s) { return s.asset + (s.missingCaps ? ':缺' + s.missingCaps.join('/') : '') ; }).join(', ') + '）——mode=prompt/skipped 诚实降级，不静默用弱能力');
    }
    // AV-3 资格门汇总警告：INELIGIBLE_* 诚实降级留痕（v3.5——runtime 必须过 resolver，fail-closed 不派单）
    const ineligible = plan.subtasks.filter(function(s) { return typeof s.error === 'string' && s.error.indexOf('INELIGIBLE_') === 0; });
    if (ineligible.length) {
      plan.degraded = true;
      plan.warnings.push('资格门：' + ineligible.length + ' 个子任务未通过 asset eligibility resolver（' + ineligible.map(function(s) { return s.asset + ':' + s.error; }).join(', ') + '）——mode=skipped 诚实降级，不过 resolver 不派单（AV-3 v3.5）');
    }
    // P1 失败自动恢复诚实标注：换宿主/换视角重试后仍失败 → 明确 degraded + warning（recovery 链已记录，不假报成功）
    const hostRecovered = plan.subtasks.filter(function(s) { return Array.isArray(s.recovery) && s.recovery.length > 0; });
    if (hostRecovered.length) {
      const stillDegraded = hostRecovered.filter(function(s) { return s.mode === 'prompt' || s.mode === 'planned-only' || s.mode === 'skipped'; });
      if (stillDegraded.length) {
        plan.degraded = true;
        plan.warnings.push('⚠ 失败自动恢复：' + stillDegraded.length + ' 个子任务换宿主/换视角重试后仍失败（host-switch/model-switch 明细见 subtask.recovery），最终诚实降级（mode=' + stillDegraded[0].mode + '）——需人工介入或更换宿主');
      }
    }
  }
  return { plan, context: ctx.dump() };
}
// 单 phase 执行：受并发上限约束并行 dispatch（limit<=1 时与旧串行行为一致）
async function runGroup(group, plan, ctx, opts, logger, limit) {
  const runOne = async function(subtask) {
    const started = Date.now();
    logger.info('start subtask ' + subtask.id + ' [' + subtask.asset + ']');
    // resume 语义：已完成的子任务直接跳过（attempts 不累加）
    if (!opts.dryRun && subtask.status === 'done') { logger.info('skip subtask ' + subtask.id + ' (already done)'); emitStatus(plan, subtask, 'done', opts, { elapsedMs: 0 }); return; }
    // 契约级 cascade skip（task C-1）：plan 为共享契约（contracts/<planId>.json），任一子任务因契约缺失
    // CONTRACT_NOT_FROZEN skip（plan._contractMissing 已置）→ 全部剩余未 done 子任务直接跳过不派单，
    // 避免在未验收契约上继续执行；若未来引入 per-subtask 契约，应按 dependsOn 真下游过滤。
    if (!opts.dryRun && plan._contractMissing) {
      subtask.status = 'skipped'; subtask.mode = 'skipped'; subtask.error = 'DEP_CONTRACT_NOT_FROZEN';
      logger.warn('subtask skipped: DEP_CONTRACT_NOT_FROZEN（依赖契约未验收，下游不派单: ' + subtask.id + '）');
      emitStatus(plan, subtask, 'skipped', opts, { elapsedMs: Date.now() - started });
      logger.info('finish subtask ' + subtask.id + ' (' + (Date.now() - started) + 'ms)');
      return;
    }
    // 前置条件 gate（T2 硬约束）：requireExec 计划带 plan.preconditions 时，子任务开工前校验
    // 上游依赖子任务是否「done 且 assetConsumed=true」。不满足 → skipped DEP_PRECONDITION（诚实降级，
    // 不静默开工），计划记 warning；旧 state/无 preconditions 的计划行为不变（向后兼容）。
    if (!opts.dryRun && plan.requireExec && Array.isArray(plan.preconditions) && plan.preconditions.length) {
      const upstream = Array.isArray(subtask.dependsOn) ? subtask.dependsOn : [];
      const unsatisfied = [];
      for (const depId of upstream) {
        const dep = plan.subtasks.find(function(s) { return s.id === depId; });
        if (!dep || dep.status !== 'done' || dep.assetConsumed !== true) unsatisfied.push(dep ? dep.asset + '(' + dep.status + '/' + dep.assetConsumed + ')' : depId);
      }
      if (unsatisfied.length) {
        subtask.status = 'skipped'; subtask.mode = 'skipped'; subtask.error = 'DEP_PRECONDITION';
        plan._depPrecondition = (plan._depPrecondition || 0) + 1;
        logger.warn('subtask skipped: DEP_PRECONDITION（上游依赖未满足资产消费前置: ' + unsatisfied.join(', ') + ' — 上游须真实执行并产出资产消费证据后下游才开工）');
        emitStatus(plan, subtask, 'skipped', opts, { elapsedMs: Date.now() - started });
        logger.info('finish subtask ' + subtask.id + ' (' + (Date.now() - started) + 'ms)');
        return;
      }
    }
    // 契约先行硬校验（task01）：冻结契约（contractMode:'frozen'）必须文件存在才执行；缺失 → skipped 且计划失败（防跳过契约/静默降级）
    if (!opts.dryRun && subtask.contractMode === 'frozen') {
      const contractFile = path.isAbsolute(subtask.contract) ? subtask.contract : path.join(opts.workspace || '.', subtask.contract);
      try { await fs.access(contractFile); } catch (e) {
        subtask.status = 'skipped'; subtask.mode = 'skipped'; plan._contractMissing = true;
        logger.warn('subtask skipped: CONTRACT_NOT_FROZEN（契约未冻结: ' + subtask.contract + ' — 先跑 node scripts/orchestrator.mjs --task ... 重冻结）');
        emitStatus(plan, subtask, 'skipped', opts, { elapsedMs: Date.now() - started });
        logger.info('finish subtask ' + subtask.id + ' (' + (Date.now() - started) + 'ms)');
        return;
      }
    }
    if (!opts.dryRun) subtask.attempts += 1;
    // M2-1 执行中瞬时态（仅 TUI 消费；state.json 收尾全量写不受影响）
    if (!opts.dryRun) subtask.status = 'running';
    emitStatus(plan, subtask, 'running', opts, { elapsedMs: 0 });
    let result;
    try { result = await dispatch(subtask, ctx, opts); } catch (error) {
      if (error instanceof ContractViolationError) throw error;
      result = { ok: false, error: error.message, artifactPath: null };
    }
    const unavailable = ['OPENCODE_NOT_AVAILABLE', 'SDLC_NOT_AVAILABLE', 'CONTRACT_TOOL_NOT_AVAILABLE', 'ADAPTER_NOT_AVAILABLE'].includes(result.error);
    if (unavailable) { subtask.status = 'skipped'; subtask.mode = 'skipped'; logger.warn('subtask skipped: ' + result.error); }
    else if (!result.ok) { subtask.status = 'failed'; plan.status = 'failed'; logger.error('subtask failed ' + subtask.id + ': ' + result.error); }
    else if (!opts.dryRun) subtask.status = 'done';
    // GW-1 治理接线（接线点 B）：gate/adapter 失败路径 GOVERNANCE 指路行（systematic-debugging）。
    // EX-1 能力门控段 / AV-3 资格门段零改动——全部失败码统一在 dispatch 返回后的本观察点消费。
    // F-030 真实传参：具名失败码经 governance.mjs 头注释声明的映射表（GOV_FAILURE_EVENT_MAP 语义）
    // 映射到 failure_recovery 组冻结事件（CAPABILITY_MISSING/INELIGIBLE_*/RESOLVER_INTERNAL_ERROR/
    // *_NOT_AVAILABLE/*_OUTPUT_INVALID → gate_failed；regression_failed/migration_failed 显式直通）；
    // 未映射码 → null（不指路）。真实执行失败（result.ok===false 无具名码）按映射表头声明的
    // "门/执行面失败兜底"显式传 gate_failed。
    const govFailCode = String((result && result.error) || subtask.error || '');
    const govEvent = (result && result.ok === false && !govFailCode) ? 'gate_failed' : governanceEventForFailureCode(govFailCode);
    if (govEvent) {
      const govLine = governancePointerLine('failure_recovery', govEvent);
      if (govLine) logger.warn('subtask ' + subtask.id + ' [' + subtask.asset + '] failure=' + (govFailCode || '(no code)') + ' gov_event=' + govEvent + ' | ' + govLine);
    }
    // GV-2 debugging 摘要消费链（记录侧）：真实执行失败（result.ok===false，含具名码/宿主输出串/
    // 无码三形态）与 unavailable skip（*_NOT_AVAILABLE 外部工具缺失——同类重派最常见的失败形态）
    // → workspace 记忆（.tt-state/debugging-memory.json），下一次同类失败任务的 brief 注入摘要用。
    // 记忆记录面比指路行宽（指路行维持 F-030 映射表 fail-closed 不语义扩张）：宿主输出串等
    // 未映射失败形态也是"门/执行面失败"（F-030 兜底语义），event 一律归 gate_failed。
    // 记录 best-effort 不阻断；DEP_PRECONDITION/CONTRACT_NOT_FROZEN 等 dispatch 前短路不落本观察点。
    const isUnavailableSkip = ['OPENCODE_NOT_AVAILABLE', 'SDLC_NOT_AVAILABLE', 'CONTRACT_TOOL_NOT_AVAILABLE', 'ADAPTER_NOT_AVAILABLE'].includes(result.error);
    if (!opts.dryRun && opts.workspace && result && (result.ok === false || isUnavailableSkip)) {
      await recordFailureMemory(opts.workspace, { code: govFailCode.slice(0, 120) || 'EXECUTION_FAILED', event: govEvent || 'gate_failed' });
    }
    emitStatus(plan, subtask, subtask.status, opts, { elapsedMs: Date.now() - started });
    logger.info('finish subtask ' + subtask.id + ' (' + (Date.now() - started) + 'ms)');
  };
  if (limit <= 1) { for (const s of group) await runOne(s); return; }
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, group.length) }, async function() {
    while (idx < group.length) { const i = idx; idx += 1; await runOne(group[i]); }
  });
  await Promise.all(workers);
}
