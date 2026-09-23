import { createLogger } from './logger.mjs';
import * as gate from './gate.mjs';
import { ContractViolationError } from './gate.mjs';
import { resolveAdapter, PROMPT_ADAPTER } from './adapters/index.mjs';
import { withRetry, retryAcrossHosts, resolveHosts } from './resilience.mjs';
import { RetryableError, TimeoutError } from './errors.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
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

// YY_ACTIVATION=lib|legacy（默认 legacy，不改变旧行为）。与 activation.mjs 的 YY_RECEIPT_MODE 是两个变量。
function resolveActivationMode(env = process.env) {
  const v = String((env && env.YY_ACTIVATION) || '').trim().toLowerCase();
  if (v === 'lib') return { mode: 'lib' };
  if (v === 'legacy' || v === '') return { mode: 'legacy' };
  return { mode: 'legacy', warning: 'YY_ACTIVATION=' + v + ' 非法，降级 legacy（不阻断）' };
}
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
      return ['write_files', 'run_cmd'];
    default:
      return ['write_files'];
  }
}

export async function dispatch(subtask, ctx, opts = {}) {
  let logger = opts.logger;
  if (!logger) logger = createLogger(opts.verbose);
  if (opts.dryRun) { console.log('[dry-run] 将执行 ' + subtask.asset); return { ok: true, dryRun: true, artifactPath: null, error: null }; }
  const adapter = resolveAdapterDI(subtask.asset, opts.backend, opts);
  if (!adapter) { subtask.status = 'skipped'; subtask.mode = 'skipped'; subtask.adapter = 'none'; logger.warn('asset adapter unavailable: ' + subtask.asset); return { ok: true, skipped: true, artifactPath: null, error: 'ADAPTER_NOT_AVAILABLE' }; }
  // B5: activation.prepare 三级激活（仅 YY_ACTIVATION=lib 且 prompt 后端时）；
  // 任何失败/无 budget 字段均降级 legacy + warning，绝不 BLOCK 旧流程。
  if (adapter === PROMPT_ADAPTER) {
    const act = resolveActivationMode();
    if (act.warning) logger.warn(act.warning);
    if (act.mode === 'lib' && !opts.activationPackage) {
      try {
        const { activationPrepare } = await import('./activation.mjs');
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
