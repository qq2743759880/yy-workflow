#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createLogger } from './lib/logger.mjs';
import { buildManifest, loadManifest } from './lib/manifest.mjs';
import { loadAssets } from './lib/asset.mjs';
import { buildPlan, NoMatchError, isFrontendImplementation } from './lib/planner.mjs';
import { executePlan } from './lib/runtime.mjs';
import { createStore } from './lib/store.mjs';
import { writeReport } from './lib/report.mjs';
import { runValidate } from './lib/regression.mjs';
import { ContractViolationError } from './lib/gate.mjs';
import { EXIT } from './lib/errors.mjs';
import { runDeconstructFlow, normalizeDraft, validateDraft, formatErrors } from './lib/deconstruct.mjs';
import { approveDraft, printApprovalSummary, printDraft } from './lib/approve.mjs';
import { createTui } from './lib/tui.mjs';
import { readJourney, newJourney, ensureSteps, journeyPath, updateJourney, prereqCheck, withJourneyLock } from './tt-journey.mjs';
// FIX-2：Windows shim 解析单点复用（cli 命令名 → 可 spawn 形态），与 exec-host/adapter 同一实现
import { resolveCommandShim } from './lib/adapters/util.mjs';
// B7（T6 接线）：核心循环改用 lib/orchestrator.mjs 的 A2 纯逻辑（parseArgs/validateOpts/
// isOpenApiSpec/parseBacklogRows/backlogIsPending 逐字等价，planDryRun 已差分验证）；
// 删除顶层内联副本，单点维护。新路径（phase 门/change.record/--evolve）全部旗标制，默认 no-op。
import { parseArgs as libParseArgs, validateOpts as libValidateOpts, isOpenApiSpec as libIsOpenApiSpec, parseBacklogRows as libParseBacklogRows, backlogIsPending as libBacklogIsPending } from './lib/orchestrator.mjs';
const parseArgs = libParseArgs;
const isOpenApiSpec = libIsOpenApiSpec;
const parseBacklogRows = libParseBacklogRows;
const backlogIsPending = libBacklogIsPending;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');
const VENDOR_DIR = path.join(SKILL_DIR, 'vendor');
const EXIT_APPROVAL_ABORTED = 6;
function usage() { console.log('Usage: node scripts/orchestrator.mjs --task TASK [--workspace PATH] [--backend auto|prompt|cli] [--exec PROG [ARGS...]] [--exec-timeout N] [--max-retries N] [--hosts "HOST1,HOST2..."] [--parallel [N]] [--contract OPENAPI.json] [--plan] [--draft DRAFT.json] [--tui] [--no-tui] [--dry-run] [--verbose] [--resume] [--validate]'); console.log('--plan: 自动拆解 + 逐 task 审批后冻结进编排（与 --resume 互斥；可组合 --exec 宿主拆解或 --draft 草案文件/手动粘贴）。--plan --dry-run 只打印草案与审批摘要，不写任何文件。'); console.log('--tui: 执行时叠加实时 DAG 视图（纯 ANSI 自绘，状态色 + 瓶颈反色；仅叠加渲染，不改变执行语义）。非 TTY 自动降级为一次性静态文本；TT_TUI=off 或 --no-tui 完全不渲染。独立复盘用 node scripts/tt-tui.mjs [--workspace PATH]。'); console.log('--exec 后的未知 --flag/值会原样透传给宿主（如 --model gpt-5.6-luna，供 exec-host-a6api.mjs 跨模型批判）；已知编排器参数（--task/--workspace 等）会结束透传段。'); console.log('--hosts: 逗号分隔的备选宿主命令（如 "node exec-host-openclaw.mjs,node exec-host-a6api.mjs --model gpt-5.6-luna"）；主宿主(--exec/config executor.command)失败时自动按序换宿主/换模型重试（失败自动恢复），全失败 → 诚实降级 degraded + warning。也可在 config.json 的 executor.hosts（数组，每项 command 数组）固化。'); }
async function readConfig() {
  try { return JSON.parse(await fs.readFile(path.join(SKILL_DIR, 'config.json'), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// ---------------------------------------------------------------------------
// FIX-2（executor.json↔orchestrator 接线）：读 <workspace>/.tt-state/executor.json，
// 把向导输出（schema tt/executor-config@1，scripts/executor-setup.mjs 写入）的 cli/model
// 映射为 --exec / --hosts 缺省。此前 orchestrator 只读 config.json 的 executor.command/hosts，
// 向导输出从未被消费（编排者过度推论闭环）。
//   优先级：显式命令行 > executor.json > config.json > 无（runtime.resolveHosts 同构）。
//   纪律（派单约束 1-3）：
//   1. presence≠可用：cli 只映射命令名（经 resolveCommandShim 解析 Windows shim），
//      不做可用性推断、不自动跑 roundtrip；
//   2. cli 不在已知清单 → warning + 跳过（fail-soft，不阻断）；
//   3. isolate 字段只透传登记（warning 提示「隔离未实施」），不改变 spawn 行为。
// ---------------------------------------------------------------------------

/** executor.json 已知 CLI 清单单点引用（executor-setup.mjs 导出；清单/schema 漂移只有一处维护点）。 */
const EXECUTOR_KNOWN_CLIS = await import('./executor-setup.mjs').then(function(m) { return m.KNOWN_CLIS; }).catch(function() { return ['claude', 'codex', 'openclaw', 'cursor', 'trae', 'opencode']; });
/** EX-1 能力握手：默认能力集单点引用（executor-setup.mjs 导出；能力名固定枚举不随平台命名）。 */
const EXECUTOR_DEFAULT_CAPABILITIES = await import('./executor-setup.mjs').then(function(m) { return m.DEFAULT_CAPABILITIES; }).catch(function() { return { write_files: true, run_cmd: true, network: true, spawn_subagent: true, mcp_client: false }; });

/**
 * 读 executor.json 并映射缺省。返回 {exists, corrupt, cli, model, isolate, mode, exec, source}。
 * - 文件缺失 → { exists:false }（调用方跳过，行为与现状一致）；
 * - JSON 损坏 → { corrupt:true }（warning 不猜内容，不阻断）；
 * - exec = cli 映射出的命令数组（未知 cli / mode 非 B-cli / cli 缺失 → null）。
 */
async function readExecutorDefaults(workspace) {
  const file = path.join(workspace, '.tt-state', 'executor.json');
  let doc = null;
  try { doc = JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return { exists: false, corrupt: false, exec: null };
    return { exists: true, corrupt: true, exec: null };
  }
  const out = { exists: true, corrupt: false, exec: null };
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) { out.corrupt = true; return out; }
  out.cli = typeof doc.cli === 'string' ? doc.cli : null;
  out.model = typeof doc.model === 'string' ? doc.model : null;
  out.isolate = doc.isolate === undefined ? null : doc.isolate;
  out.mode = typeof doc.mode === 'string' ? doc.mode : null;
  // 只有 B-cli 模式（本机 CLI 子代理）才有命令形态可映射；A-direct（编排者直执行）/C-handoff（手动交接）
  // 不派宿主命令——映射了反而改变行为（向导选 A/C 的用户没有宿主可派）。
  if (out.mode && out.mode !== 'B-cli') return out;
  if (!out.cli || !out.cli.trim()) return out;
  out.cli = out.cli.trim();
  // fail-soft：cli 不在已知清单 → warning + 跳过（不推断、不猜测命令形态）
  if (!EXECUTOR_KNOWN_CLIS.includes(out.cli)) { out.unknownCli = true; return out; }
  // 只映射命令名（presence≠可用：不做可用性推断，不跑 roundtrip）；resolveCommandShim 解析
  // Windows .cmd shim（与 exec-host-generic/adapter 同一入口），非 win32 或未定位 → 裸名。
  // resolveCommandShim 语义是 spawn(shim.command, shim.prefix.concat(argv))——程序名在前、
  // shim 前缀随后；编排器 --exec 契约是「exec[0] 为程序名、其余为固定前缀参数」（brief 追加在末尾），
  // 故规范化为 [command, ...prefix]（与 exec-host-generic 的 entry 用法同构，不能倒置为 [prefix..., command]）。
  const shim = resolveCommandShim(out.cli);
  out.exec = [shim.command].concat(shim.prefix);
  return out;
}
/**
 * FR-3 前端按契约实现（契约硬前置）：对「调用后端接口的前端实现」子任务，
 * 开工前必须有真实冻结契约（--contract OpenAPI 或 contracts/<planId>.json 为 OpenAPI）。
 *  - 有真实契约 → 指向它（contractMode:'frozen'，文件存在 → runtime 正常派单）。
 *  - 无真实契约 → 指向不存在路径（contractMode:'frozen' → runtime CONTRACT_NOT_FROZEN skip + 计划 failed exit 5，
 *    提示先冻结契约/提供 --contract，不派前端实现）。
 * 返回受影响的子任务数。
 */
async function applyFrontendContractGate(plan, workspace, contractSource) {
  const candidates = plan.subtasks.filter(function(s) { return isFrontendImplementation(s, plan); });
  if (!candidates.length) return 0;
  let realContract = null;
  if (contractSource) {
    const abs = path.isAbsolute(contractSource) ? contractSource : path.join(workspace, contractSource);
    try { const doc = JSON.parse(await fs.readFile(abs, 'utf8')); if (isOpenApiSpec(doc)) realContract = contractSource; } catch (error) { /* 非可读 OpenAPI */ }
  }
  if (!realContract) {
    const frozenPath = path.join('contracts', plan.id + '.json');
    try { const doc = JSON.parse(await fs.readFile(path.join(workspace, frozenPath), 'utf8')); if (isOpenApiSpec(doc)) realContract = frozenPath; } catch (error) { /* 非可读 OpenAPI */ }
  }
  for (const s of candidates) {
    s.contractMode = 'frozen';
    s.contract = realContract || path.join('contracts', plan.id + '.frontend-missing.json');
  }
  return candidates.length;
}
/** 从上次 state.json 恢复 plan；done 保留、skipped/failed 重试。 */
async function resumePlan(store, logger) {
  const previous = await store.load();
  if (!previous) { logger.warn('no saved state to resume (run once without --resume first)'); return null; }
  if (!Array.isArray(previous.subtasks)) { logger.warn('saved state has no subtasks, cannot resume'); return null; }
  const remaining = previous.subtasks.filter(function(subtask) { return subtask.status !== 'done'; });
  if (!remaining.length) { logger.info('plan ' + previous.id + ' already complete: ' + previous.status + ' (no subtask to resume)'); return previous; }
  logger.info('resume plan ' + previous.id + ' status=' + previous.status + ' remaining=' + remaining.length + ' (skipped/failed retried, done skipped)');
  previous.status = 'executing';
  return previous;
}
/** 契约冻结：把 plan 的 contract 落为 contracts/<planId>.json，供 gate json 模式做真实 hash 比对。 */
async function freezeContract(plan, workspace, contractSource) {
  const dir = path.join(workspace, 'contracts');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, plan.id + '.json');
  const payload = { planId: plan.id, cluster: plan.cluster, contract: plan.contract, task: plan.task, frozenAt: new Date().toISOString() };
  if (contractSource) payload.contractSource = contractSource;
  await fs.writeFile(file, JSON.stringify(payload, null, 2));
  return path.join('contracts', plan.id + '.json');
}
// IMP-1 批判 backlog tracker 解析：parseBacklogRows/backlogIsPending 现由 lib/orchestrator.mjs 单点提供（B7），
// 读不到 tracker 一律返回 null（不阻断）。P2-4：BL_PENDING_RE 在 lib/ 与顶层曾各一份，B7 后顶层副本删除统一引用 lib。
async function readCritiqueBacklog() {
  try {
    const text = await fs.readFile(path.join(SKILL_DIR, 'plans', 'critique-backlog-tracker.md'), 'utf8');
    const rows = parseBacklogRows(text);
    const pending = rows.filter(backlogIsPending);
    return { open: pending.length, nextItems: pending.map(function(r) { return r.serial + ' ' + String(r.fix || r.title || '').replace(/\s+/g, ' ').trim(); }) };
  } catch (error) { return null; }
}
/**
 * F1 journey 派生（task02）：与 state-summary 同源、单点写。成功/失败/resume 均经 writeStateSummary
 * 或 resume 短路分支调用；dry-run 不写盘。历史 gates/artifacts 只增不改。
 * 派生写入点唯一：本函数 + --update 手动标记（gate 级只增，两口径可交叉核对）。
 * sessionId 供 task12 --session 命名空间复用（缺省行为不变）。
 * C1（M1 批判）：写前跑 prereqCheck，失败仅 warning 不阻断——派生是事实记录非状态推进，
 * 失败路径派生若被误拦截会丢失败记录。step8 无 PREREQ_MAP 依赖（inProgressOk 已在 map），
 * 派生只动 plans[]/step7（map 无 7 项），warning 路径仅覆盖未来 map 扩展或极端脏数据。
 * C2：读-改-写整体经 withJourneyLock 包裹（与 --update 同一把锁）。
 */
async function syncJourney(workspace, result, sessionId) {
  const plan = result && result.plan;
  if (!plan) return;
  return withJourneyLock(workspace, sessionId, async function() {
    let journey = await readJourney(workspace, sessionId);
    if (!journey) journey = newJourney();
    journey.schema = 'yy/journey@1';
    journey.steps = ensureSteps(journey);
    const chk = prereqCheck(journey, 8);
    if (!chk.ok) console.error('WARN: journey 派生 prereq 校验未过（' + chk.reason + '）——事实记录不阻断，继续写入');
    const now = new Date().toISOString();
    journey.updated_at = now;
    const summaryPath = 'artifacts/' + plan.id + '/state-summary.json';
    const entry = {
      planId: plan.id,
      cluster: plan.cluster || null,
      status: plan.status || 'unknown',
      summaryPath,
      updatedAt: now,
    };
    const existing = journey.plans.findIndex(function(p) { return p.planId === plan.id && (p.summaryPath || '') === summaryPath; });
    if (existing >= 0) journey.plans[existing] = entry;
    else journey.plans.push(entry);
    const file = path.join(workspace, '.tt-state', sessionId ? sessionId : '', 'journey.json').replace(/\\/g, '/');
    await fs.mkdir(path.dirname(file), { recursive: true });
    // H7 修复：orchestrator 自动机验记录写入产物（非 agent 自填，不可伪造）
    const prereqResult = prereqCheck(journey, 8);
    const stageVerification = {
      verified: prereqResult.ok,
      reason: prereqResult.reason || 'prereq OK',
      timestamp: now,
      tool: 'tt-journey.mjs --prereq-check --step 8 (auto by orchestrator)',
    };
    const summaryFile = path.join(workspace, summaryPath.replace(/\//g, path.sep));
    try {
      await fs.mkdir(path.dirname(summaryFile), { recursive: true });
      const summaryJson = JSON.parse(await fs.readFile(summaryFile, 'utf8'));
      summaryJson.stageVerification = stageVerification;
      await fs.writeFile(summaryFile, JSON.stringify(summaryJson, null, 2));
    } catch (error) { /* state-summary 可能尚未写 */ }
    await fs.writeFile(file, JSON.stringify(journey, null, 2));
    return journey;
  });
}

/** IMP-1 机器可读 state 摘要：新会话程序化恢复断点用（不替代 memory-snapshot.md / execution-feedback.md）。
 * 所有文件字段为 workspace 相对路径（正斜杠），portable；失败路径也写（schema status='failed'）。 */async function writeStateSummary(result, workspace) {
  const plan = result.plan;
  const planId = plan.id;
  const subs = Array.isArray(plan.subtasks) ? plan.subtasks : [];
  const modes = plan.modes || {};
  const doneN = subs.filter(function(s) { return s.status === 'done'; }).length;
  const failedN = subs.filter(function(s) { return s.status === 'failed'; }).length;
  const skippedN = subs.filter(function(s) { return s.status === 'skipped'; }).length;
  const consumedN = subs.filter(function(s) { return s.assetConsumed === true; }).length;
  const callRate = subs.length > 0 ? (consumedN / subs.length * 100).toFixed(1) : '0.0';
  const briefOnlyN = subs.filter(function(s) { return s.mode === 'prompt' && s.assetConsumed !== true; }).length;
  const depPreconditionN = subs.filter(function(s) { return s.error === 'DEP_PRECONDITION'; }).length;
  // C-27 域声明机验（FR-5 GWT）：subtask 条目 domainDeclared===false 计为缺失；字段不存在（旧数据）不算缺失（N/A 不误伤）；true 正常。
  // 仅聚合落字段，不改退出行为（summary.total>0 且缺失>0 时同样只落字段）。
  const domainDeclaredMissingN = subs.filter(function(s) { return s.domainDeclared === false; }).length;
  const blocked = [];
  for (const s of subs) if (s.status === 'skipped' || s.status === 'failed') { if (!blocked.includes(s.asset)) blocked.push(s.asset); }
  const seen = new Set();
  const recovery = [];
  for (const s of subs) {
    const list = Array.isArray(s.recovery) ? s.recovery : [];
    for (const r of list) {
      const label = r.stage + ' ' + r.from + '→' + r.to;
      if (!seen.has(label)) { seen.add(label); recovery.push(label); }
    }
  }
  let contractFrozen = null;
  try { await fs.access(path.join(workspace, 'contracts', planId + '.json')); contractFrozen = 'contracts/' + planId + '.json'; } catch (error) { /* 未冻结 */ }
  const hasFile = async function(abs) { try { await fs.access(abs); return true; } catch (error) { return false; } };
  const artifactDir = path.join(workspace, 'artifacts', planId);
  const backlog = await readCritiqueBacklog();
  const summary = {
    schema: 'tt/state-summary@1',
    planId: plan.id,
    task: plan.task,
    cluster: plan.cluster,
    status: plan.status,
    degraded: plan.degraded === true,
    generatedAt: new Date().toISOString(),
    modes,
    summary: {
      total: subs.length,
      done: doneN,
      failed: failedN,
      skipped: skippedN,
      assetConsumed: consumedN,
      assetCallRate: callRate + '%',
      requireExecViolation: plan.requireExec === true ? briefOnlyN : 0,
      depPrecondition: depPreconditionN,
      domainDeclaredMissing: domainDeclaredMissingN,
      blockedSubtasks: blocked,
      contractFrozen,
      recovery,
    },
    critiqueBacklog: backlog,
    files: {
      state: '.tt-state/state.json',
      memorySnapshot: (await hasFile(path.join(artifactDir, 'memory-snapshot.md'))) ? 'artifacts/' + planId + '/memory-snapshot.md' : null,
      executionFeedback: (await hasFile(path.join(artifactDir, 'execution-feedback.md'))) ? 'artifacts/' + planId + '/execution-feedback.md' : null,
      report: (await hasFile(path.join(workspace, 'artifacts', 'report-' + planId + '.md'))) ? 'artifacts/report-' + planId + '.md' : null,
    },
  };
  if (backlog === null) summary.critiqueBacklogNote = 'critique backlog tracker 不可读（plans/critique-backlog-tracker.md 缺失），open/nextItems 置 null——不阻断后续动作';
  const dir = path.join(workspace, 'artifacts', planId);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, 'state-summary.json');
  await fs.writeFile(file, JSON.stringify(summary, null, 2));
  // F1 同源派生 journey（task02）：writeStateSummary 是唯一派生写入点（成功/失败路径共用）
  await syncJourney(workspace, result);
  return path.join('artifacts', planId, 'state-summary.json');
}

/**
 * B7（T6 接线）旗标门钩子：phase.transition 权限门 / 契约改动走 change.record / --evolve。
 * 全部旗标制——未传 --allow-out-of-order 且未传 --evolve 时为 no-op，不翻任何默认行为。
 * 所有子调用 best-effort（try/catch），任何失败只 warn 不阻断主流程。
 *
 * --evolve（T7 收尾批③，P1-1 修复）：候选从**编排运行的实际产物**构造——
 * 十项不变量（CANDIDATE_INVARIANT_FIELDS）逐项赋真实值，baseline 五键（BASELINE_REQUIRED_KEYS）
 * 取运行实测（validate-structure 实跑 / buildManifest 摘要 / receipt 链终态 / CI 段结果 /
 * 仓库 HEAD）。任一键无实测值 ⇒ 该候选**如实 ok:false + reason 指名缺什么**（fail-closed，不编造）；
 * 候选/基线落 workspace 沙箱 `.tt-state/evolution/`，不污染仓库根 evidence/。
 */
function sha256FileOrNull(file) {
  try { return crypto.createHash('sha256').update(fss.readFileSync(file)).digest('hex'); } catch { return null; }
}

/** 记录一次脚本实跑（退出码 + 输出尾部），供 baseline 的 structure / ciSection 键取实测值。 */
function spawnScriptCapture(script, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(SKILL_DIR, 'scripts', script), ...args], {
      cwd: SKILL_DIR, stdio: ['ignore', 'pipe', 'pipe'], shell: false,
    });
    let out = '';
    child.stdout.on('data', (c) => { out += c.toString(); });
    child.stderr.on('data', (c) => { out += c.toString(); });
    child.on('error', (err) => resolve({ code: 1, out: 'spawn error: ' + err.message }));
    child.on('exit', (code) => resolve({ code: code ?? 1, out }));
  });
}

/** 只读解析 <root>/.git/HEAD（不执行任何 git 命令），返回 {ref, sha, measuredFrom} 或 null。 */
function resolveGitHead(root) {
  try {
    const gitDir = path.join(root, '.git');
    const headFile = path.join(gitDir, 'HEAD');
    if (!fss.existsSync(headFile)) return null;
    const head = fss.readFileSync(headFile, 'utf8').trim();
    const m = head.match(/^ref:\s*(.+)$/);
    if (!m) return { ref: null, sha: head, measuredFrom: headFile }; // detached HEAD
    const ref = m[1].trim();
    const refFile = path.join(gitDir, ref.replace(/\//g, path.sep));
    if (fss.existsSync(refFile)) {
      return { ref, sha: fss.readFileSync(refFile, 'utf8').trim(), measuredFrom: refFile };
    }
    // packed-refs 回落（依然纯文本只读）
    const packed = path.join(gitDir, 'packed-refs');
    if (fss.existsSync(packed)) {
      const line = fss.readFileSync(packed, 'utf8').split('\n').find((l) => l.endsWith(' ' + ref));
      if (line) return { ref, sha: line.split(' ')[0].trim(), measuredFrom: packed };
    }
    return null;
  } catch { return null; }
}

/** 子任务产物目录下的真实产物文件（排除 brief.md / result.txt），返回 [{rel, sha256}]。 */
function collectSubtaskArtifacts(workspace, subtaskId) {
  const dir = path.join(workspace, 'artifacts', subtaskId);
  const out = [];
  try {
    for (const name of fss.readdirSync(dir)) {
      if (name === 'brief.md' || name === 'result.txt') continue;
      const abs = path.join(dir, name);
      let st;
      try { st = fss.statSync(abs); } catch { continue; }
      if (!st.isFile()) continue;
      out.push({ rel: 'artifacts/' + subtaskId + '/' + name, sha256: sha256FileOrNull(abs) });
    }
  } catch { /* 目录不存在 = 无产物 */ }
  return out;
}

/**
 * --evolve baseline 五键实测（OQ-R10-2=A：结构 / manifest / receipt 终态 / CI 段 / rollback 目标）。
 * @returns {Promise<{baseline: object, missing: string[]}>} missing 非空 ⇒ 调用方按 fail-closed 收口。
 */
async function measureEvolveBaseline(plan, opts, logger) {
  const workspace = path.resolve(opts.workspace || '.');
  const missing = [];
  const at = new Date().toISOString();

  // (1) structure：validate-structure.mjs 实跑（S1 同源脚本，只读校验）
  const vs = await spawnScriptCapture('validate-structure.mjs', []);
  const structure = { validator: 'validate-structure.mjs', exitCode: vs.code, ok: vs.code === 0, at };
  if (vs.code !== 0) missing.push(`structure（validate-structure.mjs 退出码 ${vs.code}：结构基线不成立）`);

  // (2) manifest：buildManifest 摘要（真实构建，不落盘）
  let manifest = null;
  try {
    const m = await buildManifest({ vendorDir: VENDOR_DIR });
    manifest = {
      entries: Array.isArray(m.entries) ? m.entries.length : null,
      sha256: crypto.createHash('sha256').update(JSON.stringify(m)).digest('hex'),
      at,
    };
    if (!manifest.entries) missing.push('manifest（buildManifest 未返回 entries）');
  } catch (e) {
    missing.push(`manifest（buildManifest 异常：${e.message}）`);
  }

  // (3) CI 段结果：S1/S2 实跑 + S5 进程内（严格口径）；S4 regression-all 属重型段，如实标注未跑
  const rg = await spawnScriptCapture('review-gate.mjs', ['--self-test']);
  const { classifyOpenP0 } = await import('./lib/ci.mjs');
  let s5 = null;
  try {
    const trackerText = await fs.readFile(path.join(SKILL_DIR, 'plans', 'critique-backlog-tracker.md'), 'utf8');
    const cls = classifyOpenP0(trackerText);
    s5 = { openP0: cls.openP0, unbacked: cls.unbacked.length, inProgress: cls.inProgress.length };
    if (cls.openP0 > 0) missing.push(`ciSection（S5 P0 未清零 ${cls.openP0} 条 ⬜/◐：CI 基线不成立）`);
  } catch (e) {
    missing.push(`ciSection（S5 tracker 不可读：${e.message}）`);
  }
  if (vs.code !== 0) missing.push('ciSection（S1 validate-structure 未过）');
  if (rg.code !== 0) missing.push(`ciSection（S2 review-gate --self-test 退出码 ${rg.code}）`);
  const ciSection = {
    sections: [
      { id: 'S1', script: 'validate-structure.mjs', exitCode: vs.code },
      { id: 'S2', script: 'review-gate.mjs --self-test', exitCode: rg.code },
      { id: 'S5', kind: 'in-process', openP0: s5 ? s5.openP0 : null },
    ],
    s4: '未跑（regression-all 属重型段；CI 段结果如实标注不完整面）',
    at,
  };

  // (4) rollbackTarget：只读解析 .git/HEAD（workspace 优先，回落代码仓根）
  let head = resolveGitHead(workspace);
  if (!head || !head.sha) head = resolveGitHead(SKILL_DIR);
  const rollbackTarget = (head && head.sha)
    ? { ref: head.ref, sha: head.sha, measuredFrom: head.measuredFrom, at }
    : null;
  if (!rollbackTarget) missing.push('rollbackTarget（workspace 与代码仓根均无可用 .git/HEAD）');

  // (5) receiptTerminal：workspace 内 per-artifact receipt 链（R3 §7.6 artifacts/<subtaskId>/receipt.json）终态
  const receiptMap = {};
  let receiptFound = 0;
  for (const s of (plan.subtasks || [])) {
    const file = path.join(workspace, 'artifacts', s.id, 'receipt.json');
    try {
      const doc = JSON.parse(await fs.readFile(file, 'utf8'));
      const events = Array.isArray(doc.events) ? doc.events : (Array.isArray(doc) ? doc : []);
      const last = events.length ? events[events.length - 1] : null;
      receiptMap[s.id] = { events: events.length, terminal: last ? last.transition : null };
      receiptFound += 1;
    } catch { /* 该子任务无 receipt 链 */ }
  }
  const receiptTerminal = receiptFound > 0
    ? { chains: receiptFound, terminals: receiptMap, at }
    : '[待补充]';
  if (receiptFound === 0) missing.push('receiptTerminal（workspace 内未找到 artifacts/<subtaskId>/receipt.json 链：如实登记 [待补充]，不编造终态）');

  return {
    baseline: { structure, manifest, receiptTerminal, ciSection, rollbackTarget },
    missing,
  };
}

/** 候选十项不变量（CANDIDATE_INVARIANT_FIELDS）逐项赋运行实测真实值。 */
async function buildEvolveCandidate(subtask, plan, opts, baseline, measured) {
  const workspace = path.resolve(opts.workspace || '.');
  let assetScope = plan.cluster || null;
  try {
    const { CLUSTERS } = await import('./lib/matrix.mjs');
    const hit = CLUSTERS.find((c) => (c.candidates || []).includes(subtask.asset));
    if (hit) assetScope = hit.id;              // 只读自 matrix CLUSTERS（唯一事实源）
  } catch { /* 回落 plan.cluster */ }
  const artifacts = collectSubtaskArtifacts(workspace, subtask.id);
  const stateRel = '.tt-state/state.json';
  const changeset = [stateRel, ...artifacts.map((a) => a.rel)];
  const contractRel = 'contracts/' + plan.id + '.json';
  const contractSha = sha256FileOrNull(path.join(workspace, contractRel));
  const shaRefs = [
    ...artifacts.filter((a) => a.sha256).map((a) => a.rel + '#' + a.sha256),
    ...(contractSha ? [contractRel + '#' + contractSha] : []),
  ];
  const ci = baseline.ciSection;
  return {
    assetScope,
    trigger: 'flag:--evolve',
    rationale: subtask.desc || subtask.task || plan.task || ('evolve candidate for ' + subtask.asset),
    acceptanceCriteria: [
      'S1 validate-structure exit 0（实测 ' + ci.sections[0].exitCode + '）',
      'S2 review-gate --self-test exit 0（实测 ' + ci.sections[1].exitCode + '）',
      'S5 P0 未清零 = 0（实测 ' + (ci.sections[2].openP0 === null ? 'n/a' : ci.sections[2].openP0) + '）',
      'S4 regression-all 12/12（基线未跑，升格前须补）',
      '独立上下文验收 evolution.accept exit 0（producer 不得自验）',
    ].join('；'),
    changeset,
    riskAssessment: {
      level: 'low',
      reasons: [
        '本候选仅登记（evolution.propose），不直改 catalog（catalog 属 R6 复核面）',
        'promotion 需独立上下文验收 + rollback 排练，未升格前无运行时影响',
      ],
    },
    baselineRef: plan.id,
    rollbackTarget: baseline.rollbackTarget ? baseline.rollbackTarget.sha : null,
    evidenceRefs: [stateRel, ...shaRefs, 'measured@' + measured.baseline.structure.at],
    proposerSession: opts.session || 'orchestrator--evolve',
  };
}

async function maybeRunB7Hooks(result, opts, logger) {
  if (!opts.allowOutOfOrder && !opts.evolve) return;
  const plan = result && result.plan;
  if (!plan) return;
  // (a) phase.transition 权限门：owner override 仅 --allow-out-of-order 显式旗标。
  //     此处以只读 checkPhase 观察并记录（不读 state 不写 transition），真正的 force+ownerReceipt
  //     由 phase.mjs transitionPhase 承载——本编排器默认不推进 phase（保持旧行为）。
  if (opts.allowOutOfOrder) {
    try {
      const { checkPhase } = await import('./lib/phase.mjs');
      const chk = await checkPhase({ workspace: opts.workspace, session: opts.session });
      logger.warn('[B7] phase gate (--allow-out-of-order owner override): ok=' + chk.ok + ' code=' + (chk.code || 'n/a'));
    } catch (e) { logger.warn('[B7] phase gate 跳过（不阻断）: ' + e.message); }
  }
  // (b) 契约改动强制走 change.record：棕地草案/契约覆盖路径记录一条变更（best-effort）。
  if (opts.contract || opts.contractDraft || opts.evolve) {
    try {
      const { recordChange } = await import('./lib/change.mjs');
      const cr = await recordChange({
        basePlan: plan.id,
        reason: (opts.contractDraft ? 'brownfield contract draft override' : 'contract/evolve hook'),
        impactClass: opts.contractDraft ? 'CONTRACT' : 'DOC_ONLY',
        owner: 'orchestrator--evolve',
        sourceEvidence: [opts.contract || opts.contractDraft || 'flag:--evolve'],
      }, { workspace: opts.workspace, recordedBy: 'orchestrator-B7' });
      logger.warn('[B7] change.record: ' + (cr && cr.ok ? 'OK ' + (cr.data && cr.data.changeId || '') : 'SKIPPED(' + (cr && cr.code) + ')'));
    } catch (e) { logger.warn('[B7] change.record 跳过（不阻断）: ' + e.message); }
  }
  // (c) --evolve：对完成子任务生成 evolution.propose 候选（十项不变量齐备 + baseline 五键实测）。
  //     P1-1 修复：候选从实际产物构造；任一 baseline 键无实测值 ⇒ 该候选如实 ok:false + reason 指名缺失。
  if (opts.evolve) {
    try {
      const { evolutionPropose, CANDIDATE_INVARIANT_FIELDS, BASELINE_REQUIRED_KEYS } = await import('./lib/evolution.mjs');
      const doneSubs = (plan.subtasks || []).filter(function(s) { return s.status === 'done' && s.asset; });
      const measured = await measureEvolveBaseline(plan, opts, logger);
      for (const k of BASELINE_REQUIRED_KEYS) {
        if (measured.baseline[k] === undefined) measured.missing.push(k + '（键未构造）');
      }
      const evidenceRoot = path.join(opts.workspace || '.', '.tt-state', 'evolution');
      let proposed = 0;
      const details = [];
      for (const s of doneSubs) {
        if (measured.missing.length > 0) {
          // fail-closed，不编造：baseline 不完整 ⇒ 不落候选，如实登记缺什么
          details.push(`${s.asset}: ok:false BASELINE_MISSING 缺 ${measured.missing.join(' / ')}`);
          continue;
        }
        const candidate = await buildEvolveCandidate(s, plan, opts, measured.baseline, measured);
        const missingInv = CANDIDATE_INVARIANT_FIELDS.filter((k) => candidate[k] === undefined || candidate[k] === null || candidate[k] === '');
        if (missingInv.length > 0) {
          details.push(`${s.asset}: ok:false CANDIDATE_INVALID 缺 ${missingInv.join(', ')}`);
          continue;
        }
        const ev = evolutionPropose({
          assetId: s.asset,
          sourceVersion: plan.id,
          proposedBy: 'orchestrator--evolve',
          idempotencyKey: 'evolve:' + plan.id + ':' + s.id + ':' + plan.id,
          baseline: measured.baseline,
          candidate,
          opts: { evidenceRoot, now: new Date() },
        });
        if (ev && ev.ok) {
          proposed += 1;
          details.push(`${s.asset}: ok:true ${ev.data && ev.data.candidateId || ''}${ev.data && ev.data.duplicate ? '(replay)' : ''}`);
        } else {
          details.push(`${s.asset}: ok:false ${ev && ev.code} ${(ev && ev.data && ev.data.reason) || ''}`);
        }
      }
      logger.warn('[B7] --evolve: proposed ' + proposed + '/' + doneSubs.length
        + ' candidates（evidenceRoot=' + path.relative(process.cwd(), evidenceRoot).replace(/\\/g, '/') + '）'
        + (details.length ? ' | ' + details.join(' | ') : ''));
    } catch (e) { logger.warn('[B7] --evolve 跳过（不阻断）: ' + e.message); }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  // B7：纯旗标（无值），单点扫描；不进 lib parseArgs（不改 adapters/lib）。
  opts.allowOutOfOrder = process.argv.includes('--allow-out-of-order');
  opts.evolve = process.argv.includes('--evolve');
  if (opts.help) { usage(); return EXIT.OK; }
  // B7：校验统一走 lib/orchestrator.mjs validateOpts（与原内联 if 链逐字等价）
  const v = libValidateOpts(opts);
  if (!v.ok) { console.error(v.error); return v.exitCode; }
  const logger = createLogger(opts.verbose);
  // workspace 落产物/状态；默认取 config.json 的 projectRoot，未配置则当前目录。vendor 资产始终用随包副本。
  const cfg = await readConfig();
  let workspaceArg = opts.workspace;
  if (workspaceArg === '.' && cfg && cfg.projectRoot && !String(cfg.projectRoot).includes('<')) workspaceArg = cfg.projectRoot;
  const workspace = path.resolve(workspaceArg);
  const store = createStore(workspace);
  // FIX-2：executor.json 接线。优先级（两个缺省槽各自成立）：显式命令行 > executor.json > config.json > 无。
  // executor.json 是「workspace 级」配置，按最终 workspace 读取；向导输出是新近用户意图，优先于 config 旧缺省。
  const ex = await readExecutorDefaults(workspace);
  // 能力接线（EX-1）：读取 executor.json 的 capabilities 块（Agent Card 式自描述）。
  // 文件缺失/损坏 → null（dispatch 无门控信息时按旧行为执行，不臆造能力）；JSON 可读但无 capabilities
  // 键 → 回落 DEFAULT_CAPABILITIES（executor-setup 单点导出；MCP 未探测 → false，不假报）。
  // 注意：顶层 fs 是 node:fs/promises（无 readFileSync），同步读用 fss（node:fs）。
  const exCaps = ex.corrupt || !ex.exists ? null : (function() {
    try {
      const raw = fss.readFileSync(path.join(workspace, '.tt-state', 'executor.json'), 'utf8');
      const parsed = JSON.parse(raw);
      return parsed.capabilities || EXECUTOR_DEFAULT_CAPABILITIES;
    } catch (e) {
      return EXECUTOR_DEFAULT_CAPABILITIES;
    }
  })();
  opts.executorDefaults = { 
    cli: ex.cli || null, 
    model: ex.model || null, 
    isolate: ex.isolate === undefined ? null : ex.isolate, 
    mode: ex.mode || null, 
    corrupt: ex.corrupt === true, 
    source: ex.exists ? path.join('.tt-state', 'executor.json').replace(/\\/g, '/') : null,
    capabilities: exCaps
  };
  if (ex.corrupt) logger.warn('executor.json 存在但不可解析（损坏）——忽略，不猜内容（fail-soft）：' + path.join(workspace, '.tt-state', 'executor.json'));
  if (ex.unknownCli) logger.warn('executor.json 的 cli=' + ex.cli + ' 不在已知清单（' + EXECUTOR_KNOWN_CLIS.join('/') + '）——跳过映射，不推断命令形态（presence≠可用）；如需宿主请显式 --exec');
  // 约束 3：isolate 只透传登记，不改 spawn 行为
  if (ex.isolate !== undefined && ex.isolate !== null) logger.warn('executor.json 的 isolate=' + JSON.stringify(ex.isolate) + ' 仅登记（executorDefaults.isolate）——隔离未实施，spawn 行为不变');
  // --exec 缺省槽：executor.json > config.json（显式 --exec 时不映射）
  if (!opts.exec && ex.exec) {
    opts.exec = ex.exec;
    logger.info('executor defaults (--exec from executor.json): ' + ex.exec.join(' ') + (ex.model ? '（model=' + ex.model + '，仅登记不注入——模型偏好属宿主自身配置）' : ''));
  }
  if (!opts.exec && cfg && Array.isArray(cfg.executor && cfg.executor.command) && cfg.executor.command.length) opts.exec = cfg.executor.command;
  if (opts.execTimeoutMs === undefined && cfg && cfg.executor && Number.isInteger(cfg.executor.timeoutMs) && cfg.executor.timeoutMs > 0) opts.execTimeoutMs = cfg.executor.timeoutMs;
  // P1 失败自动恢复：config.json executor.hosts 为备选宿主来源（优先级低于命令行 --hosts，dispatch 内 resolveHosts 裁决）
  if (cfg && Array.isArray(cfg.executor && cfg.executor.hosts) && cfg.executor.hosts.length) opts.configHosts = cfg.executor.hosts;
  // --hosts 缺省槽：executor.json > config.json（显式 --hosts 时不注入；同一命令与主宿主在
  // resolveHosts/retryAcrossHosts 按 commandKey 去重，主宿主成功时备选链零额外行为）。
  // 注意 opts.hosts 是「逗号分隔字符串」形态（命令行语义）；executor.json 注入走 opts.configHosts 数组形态。
  if (ex.exec && (!opts.hosts || !String(opts.hosts).trim())) {
    opts.configHosts = [ex.exec.slice()];
    logger.info('executor defaults (--hosts from executor.json): ' + ex.exec.join(' ') + (exCaps ? ' capabilities=' + JSON.stringify(exCaps) : ''));
  }
  logger.info('state: idle');
  // --contract（绿地 OpenAPI）与 --contract-draft（棕地草案）互斥
  if (opts.contract && opts.contractDraft) { console.error('--contract 与 --contract-draft 互斥：真 OpenAPI 走真校验，棕地草案走降级确认'); return EXIT.ARGS; }
  // --contract 用户提供的 OpenAPI 契约：文件必须存在（契约本体以该文件为准），缺失明确报错不静默降级
  if (opts.contract) {
    const contractAbs = path.isAbsolute(opts.contract) ? opts.contract : path.join(workspace, opts.contract);
    try { await fs.access(contractAbs); } catch (error) { console.error('--contract 文件不存在: ' + opts.contract + '（已解析为 ' + contractAbs + '）'); return EXIT.ARGS; }
  }
  // --contract-draft 棕地契约草案：文件必须存在；内容须为 draft JSON（含 draft:true 或非 OpenAPI）——存在即可读（缺失/坏 JSON 报错）
  if (opts.contractDraft) {
    const draftAbs = path.isAbsolute(opts.contractDraft) ? opts.contractDraft : path.join(workspace, opts.contractDraft);
    try {
      const doc = JSON.parse(await fs.readFile(draftAbs, 'utf8'));
      const isOpenApi = Boolean(doc && (typeof doc.openapi === 'string' || typeof doc.swagger === 'string'));
      const isDraft = Boolean(doc && doc.draft === true);
      if (isOpenApi && !isDraft) logger.warn('--contract-draft 指向的是已确认 OpenAPI（无 draft:true，应改用 --contract 走真校验）；仍按草案处理');
    } catch (error) { console.error('--contract-draft 文件不存在或非 JSON: ' + opts.contractDraft + '（' + error.message + '）'); return EXIT.ARGS; }
  }
  let plan = null;
  let manifest = null;
  if (opts.resume) {
    plan = await resumePlan(store, logger);
    // resume 复用旧契约：文件缺失会令 json gate 静默降级 describe，必须显式告警
    if (plan && plan.subtasks.length) {
      const c = plan.subtasks[0].contract;
      if (c && !path.isAbsolute(c)) {
        try { await fs.access(path.join(workspace, c)); } catch (error) { logger.warn('contract file missing: ' + c + ' — 冻结契约缺失，resume 时子任务将 CONTRACT_NOT_FROZEN skip，建议重新 --task 运行以重冻结'); }
      }
    }
    // 全部子任务已完成：不重跑，直接出报告退出
    if (plan && plan.subtasks.every(function(subtask) { return subtask.status === 'done'; })) {
      logger.info('state: done');
      const report = await writeReport({ plan, context: {} }, workspace);
      logger.info('report: ' + report.markdown);
      // F1 resume 全部完成短路分支也补一次 journey 同步（task02：不滞留旧位置）
      await syncJourney(workspace, { plan }, opts.session);
      return EXIT.OK;
    }
  }
  if (!plan) {
    if (opts.dryRun) manifest = await buildManifest({ vendorDir: VENDOR_DIR });
    else manifest = await loadManifest({ vendorDir: VENDOR_DIR, stateDir: path.join(workspace, '.tt-state'), refresh: false });
    logger.info('state: planning');
    if (opts.plan) {
      // M1 --plan 流程：拆解草案（宿主或手动）→ 逐 task 审批 → 归一化 plan → 冻结 → 既有执行路径。
      // dry-run + 宿主拆解写到临时 workspace，不污染真实 workspace（FR-3 GWT3：不写 state/contracts/产物）。
      let planWs = workspace;
      if (opts.dryRun && Array.isArray(opts.exec) && opts.exec.length) planWs = await fs.mkdtemp(path.join(os.tmpdir(), 'tt-plan-dry-'));
      const draftFlow = await runDeconstructFlow({ task: opts.task, manifest, exec: opts.exec, execTimeoutMs: opts.execTimeoutMs, workspace: planWs, draftFile: opts.draft });
      if (planWs !== workspace) { try { await fs.rm(planWs, { recursive: true, force: true }); } catch (error) { /* 临时目录清理失败不阻断 */ } }
      if (!draftFlow.ok) {
        console.error('[tt] ' + draftFlow.error);
        return EXIT_APPROVAL_ABORTED;
      }
      if (opts.dryRun) {
        console.log(printApprovalSummary(draftFlow.draft));
        console.log('--- 拆解草案（--plan --dry-run 不写任何文件，仅打印草案与审批摘要） ---');
        console.log(printDraft(draftFlow.draft));
        logger.info('state: done');
        return EXIT.OK;
      }
      const assetNames = (manifest.entries || []).map(function(e) { return e.name; });
      const approval = await approveDraft(draftFlow.draft, { logger, forceNonInteractive: draftFlow.fromStdin === true, assetNames });
      if (!approval.approved) {
        const why = approval.reason === 're-decompose' ? '已选择回拆解' : approval.reason === 'non-interactive' ? '非交互环境未执行逐 task 审批' : approval.reason === 'abort' ? '审批中断' : approval.reason === 'invalid' ? '审批后校验失败' : approval.reason;
        console.error('[tt] 审批中止（' + why + '）——未产生正式 plan、未写 contracts、未污染状态文件');
        return EXIT_APPROVAL_ABORTED;
      }
      const postV = validateDraft(approval.draft, manifest);
      if (!postV.ok) { console.error('[tt] ' + formatErrors(postV.errors)); return EXIT_APPROVAL_ABORTED; }
      plan = normalizeDraft(approval.draft, manifest);
      if (approval.draft.approvedAt) plan.approvedAt = approval.draft.approvedAt;
    } else {
      plan = buildPlan(opts.task, manifest);
    }
    for (const subtask of plan.subtasks) subtask.task = plan.task;
    // --contract 提供 OpenAPI 契约：be-validator 子任务契约指向该文件（portman 真校验路径），其他子任务保持 cluster 描述不变
    if (opts.contract) {
      const applied = [];
      for (const subtask of plan.subtasks) if (subtask.asset === 'be-validator') { subtask.contract = opts.contract; applied.push(subtask.id + ' -> ' + opts.contract); }
      if (applied.length) logger.info('contract override (--contract): ' + applied.join(' | '));
    }
    // --contract-draft 棕地草案：be-validator 契约指向草案但标记 brownfield（不跑真校验，待 --contract 升级）；前端子任务可凭草案开工
    if (opts.contractDraft) {
      plan.brownfield = true;
      plan.contractMode = 'brownfield-draft';
      plan.contractSource = opts.contractDraft;
      for (const subtask of plan.subtasks) {
        if (subtask.asset === 'be-validator') { subtask.contract = opts.contractDraft; subtask.brownfieldDraft = true; }
        else if (isFrontendImplementation(subtask, plan)) { subtask.contractMode = 'frozen'; subtask.contract = opts.contractDraft; subtask.brownfieldDraft = true; }
      }
      logger.info('contract brownfield (--contract-draft): ' + opts.contractDraft + ' — be-validator 不跑真校验，前端可凭草案开工（待后端确认后 --contract 升级）');
    }
    logger.info('plan ' + plan.id + ' cluster=' + plan.cluster + ' subtasks=' + plan.subtasks.length);
    // 契约冻结（BE-13）：落 contracts/<planId>.json，subtask.contract 指向文件，gate json 模式做真实比对
    if (!opts.dryRun) {
      const contractSource = opts.contract || opts.contractDraft || null;
      const contractPath = await freezeContract(plan, workspace, contractSource);
      for (const subtask of plan.subtasks) { subtask.contract = contractPath; subtask.contractMode = 'frozen'; }
      // 冻结后重写 be-validator 契约：契约本体以用户 OpenAPI 文件为准（冻结文件仍写入，含 contractSource 记录；gate hash 比对该 OpenAPI 本体，防执行期篡改）
      if (opts.contract) for (const subtask of plan.subtasks) if (subtask.asset === 'be-validator') subtask.contract = opts.contract;
      // 棕地草案：be-validator 与前端子任务契约指向草案文件（非真 OpenAPI，be-validator 将诚实降级不跑真校验；前端可凭草案开工）
      if (opts.contractDraft) for (const subtask of plan.subtasks) if (subtask.brownfieldDraft) subtask.contract = opts.contractDraft;
      // FR-3 前端按契约实现（契约硬前置）：绿地需真实冻结契约；棕地草案放行（brownfieldDraft 标记），缺失真实契约且非棕地 → CONTRACT_NOT_FROZEN skip。
      const feGated = await applyFrontendContractGate(plan, workspace, opts.contract || (opts.contractDraft ? opts.contractDraft : null));
      if (feGated) logger.info('FR-3 contract gate applied: ' + feGated + ' 个前端实现子任务按契约前置（' + (opts.contract ? '契约=' + opts.contract : opts.contractDraft ? '棕地草案=' + opts.contractDraft + '（可开工，待确认后升级）' : '无真实契约，缺契约将 CONTRACT_NOT_FROZEN skip，请提供 --contract') + '）');
    }
  } else {
    for (const subtask of plan.subtasks) if (!subtask.task) subtask.task = plan.task;
    if (!manifest) manifest = await loadManifest({ vendorDir: VENDOR_DIR, stateDir: path.join(workspace, '.tt-state'), refresh: false });
  }
  // 只加载本计划路由到的资产（懒加载），正文缓存仅在非 dry-run 下启用（BE-15）
  const assets = await loadAssets({ vendorDir: VENDOR_DIR, assetsRoot: SKILL_DIR, workspace, manifest, only: plan.subtasks.map(function(s) { return s.asset; }), useCache: !opts.dryRun });
  // M2-3 --tui：执行时叠加实时 DAG 渲染（不改变执行语义，只挂 onStatus 钩子）。逃生舱：TT_TUI=off 或 --no-tui 完全不渲染。
  const execOpts = { ...opts, workspace, logger, assets, assetsRoot: SKILL_DIR };
  let tui = null;
  if (opts.tui && !opts.noTui && process.env.TT_TUI !== 'off') {
    tui = createTui(plan, { stream: process.stdout });
    if (tui.live) execOpts.onStatus = function(subtask, info) { tui.update(subtask, info); };
    tui.start();
  }
  if (opts.dryRun) {
    let dryResult;
    try { dryResult = await executePlan(plan, execOpts); } catch (error) { if (tui) tui.reset(); throw error; }
    if (tui) tui.finish({ status: dryResult.plan.status || 'done' });
    logger.info('dry-run complete'); return EXIT.OK;
  }
  logger.info('state: executing');
  let result;
  try { result = await executePlan(plan, execOpts); } catch (error) { if (tui) tui.reset(); throw error; }
  await store.save(result.plan);
  // B7 旗标门钩子（phase 门/change.record/--evolve）：默认 no-op，best-effort 不阻断
  await maybeRunB7Hooks(result, opts, logger);
  logger.info('state: reviewing');
  const report = await writeReport(result, workspace);
  if (tui) tui.finish({ status: result.plan.status, reportPath: report.markdown });
  logger.info('report: ' + report.markdown);
  if (result.plan.degraded) {
    const allSkip = result.plan.subtasks.every(function(s) { return s.status === 'skipped'; });
    logger.warn('plan degraded: ' + (allSkip ? 'all subtasks skipped (external execution tools unavailable); only routing/state recorded' : 'requireExec 资产 brief-only 兜底或部分降级——需 --exec 宿主或装 CLI 工具'));
  }
  if (opts.validate) { const regression = await runValidate({ cwd: SKILL_DIR }); console.log(regression.raw.trim()); if (!regression.ok) { console.error('[tt] regression failed'); return EXIT.FAILED; } }
  if (result.plan.status === 'failed') {
    // IMP-1 失败也留机器可读断点（schema status='failed'），新会话可程序化核对卡点（md 摘要不生成时 files 标 null）
    logger.info('state-summary: ' + await writeStateSummary(result, workspace));
    return EXIT.FAILED;
  }
  // F3 自动经验摘要（MUSE MemoryManager 模式融合）：执行后自动写 memory-snapshot.md，提示编排者 memory_write
  // F2 执行反馈（MUSE SkillRefiner 模式）：写 execution-feedback.md（每子任务结果 + 改进建议）
  if (!opts.dryRun) {
    const modes = result.plan.modes || {};
    const warnings = result.plan.warnings || [];
    const subs = result.plan.subtasks || [];
    const consumed = subs.filter(function(s) { return s.assetConsumed === true; }).length;
    const callRate = subs.length > 0 ? (consumed / subs.length * 100).toFixed(1) : '0';
    const snapshotPath = path.join(workspace, 'artifacts', result.plan.id, 'memory-snapshot.md');
    const snapshot = [
      '# memory-snapshot ' + result.plan.id, '',
      '- task: ' + result.plan.task,
      '- cluster: ' + result.plan.cluster,
      '- status: ' + result.plan.status + ' degraded: ' + result.plan.degraded,
      '- modes: ' + JSON.stringify(modes),
      '- 资产消费率: ' + callRate + '% (' + consumed + '/' + subs.length + ')',
      '- warnings: ' + (warnings.length ? warnings.join(' | ') : '无'), '',
      '## 经验摘要（可 memory_write）',
      '- 调用率: ' + callRate + '%',
      '- 改进点: ' + (warnings.length ? warnings[0] : '无'),
      '- memory_write 提示: memory_write(project="tgent", content=<本摘要>, mode="append")',
    ].join('\n');
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.writeFile(snapshotPath, snapshot);
    // F2 执行反馈：每子任务结果 + 改进建议（SkillRefiner 模式）
    const fbPath = path.join(workspace, 'artifacts', result.plan.id, 'execution-feedback.md');
    const fbLines = ['# execution-feedback ' + result.plan.id, '', '## 逐子任务执行结果'];
    for (const s of subs) {
      const suggest = s.mode === 'prompt' ? '需 --exec 宿主真实执行（当前 brief-only 兜底）' : s.mode === 'planned-only' ? '需装 CLI 工具（当前 planned-only 降级）' : s.mode === 'skipped' ? '需装执行工具（当前 skipped）' : (s.assetConsumed === true ? '已真实执行' : '');
      const recoveryNote = Array.isArray(s.recovery) && s.recovery.length ? ' | recovery: ' + s.recovery.map(function(r) { return r.stage + ' ' + r.from + '→' + r.to + '(attempt ' + r.attempt + ')'; }).join('; ') : '';
      fbLines.push('### ' + s.asset, '- mode: ' + s.mode + ' | consumed: ' + (s.assetConsumed === true) + ' | adapter: ' + (s.adapter || '?') + (suggest ? ' | 建议: ' + suggest : '') + recoveryNote);
    }
    if (result.plan.requireExec) {
      const briefOnly = subs.filter(function(s) { return s.mode === 'prompt' && s.assetConsumed !== true; });
      if (briefOnly.length) { fbLines.push('', '## requireExec 违规', briefOnly.length + ' 个资产 brief-only 兜底（' + briefOnly.map(function(s) { return s.asset; }).join(', ') + '）——需 --exec 宿主或装 CLI'); }
    }
    fbLines.push('', '## 汇总', '- 真实执行: ' + consumed + '/' + subs.length + ' (' + callRate + '%)', '- 改进方向: ' + (warnings.length ? warnings.join('; ') : '无'));
    await fs.writeFile(fbPath, fbLines.join('\n'));
    // IMP-1 机器可读 state 摘要：与人类可读 md 并存，不互相替代
    const summaryRel = await writeStateSummary(result, workspace);
    logger.info('memory-snapshot: ' + snapshotPath + ' | execution-feedback: ' + fbPath + ' | state-summary: ' + summaryRel);  }
  logger.info('state: done');
  return EXIT.OK;
}
main().then(function(code) { process.exitCode = code; }).catch(function(error) {
  if (error instanceof NoMatchError) { console.error('[tt] no match: ' + error.message); process.exitCode = EXIT.FAILED; return; }
  if (error instanceof ContractViolationError) { console.error('[tt] contract violation: ' + error.diff); process.exitCode = EXIT.CONTRACT; return; }
  if (String(error.message).includes('NOT_IMPLEMENTED')) { console.error('[tt] module not implemented: ' + error.message); process.exitCode = EXIT.NOT_IMPL; return; }
  console.error('[tt] execution failed: ' + error.message);
  process.exitCode = EXIT.FAILED;
});
