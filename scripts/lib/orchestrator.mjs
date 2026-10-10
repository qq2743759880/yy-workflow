/**
 * lib/orchestrator.mjs — A2 纯逻辑抽取（从 scripts/orchestrator.mjs）
 *
 * 抽取范围：
 *   - parseArgs(args)：CLI 参数解析（纯函数，逐字复制）
 *   - validateOpts(opts)：参数校验（互斥/范围/必填），返回 {ok, error, exitCode}
 *   - isOpenApiSpec(doc)：判定 JSON 是否为可消费 OpenAPI 规范
 *   - parseBacklogRows(text)：critique-backlog-tracker.md 表格行解析
 *   - backlogIsPending(r)：行是否待落地
 *   - classifyExitError(error)：错误类型 → 退出码映射
 *   - planDryRun(args, ctx)：--plan --dry-run 路径纯逻辑，返回 {stdout, exitCode}
 *
 * 纪律：
 *   - lib 内禁止 process.exit / process.exitCode / 未捕获 rejection / 直接 console.log。
 *   - 所有 IO（文件读、spawn、manifest 构建）通过 ctx 注入。
 *   - 行为等价优先：逐字节匹配 orchestrator.mjs --plan --dry-run 输出。
 *
 * 未抽取（留在 lib 外）：
 *   - main() 中的 executePlan / writeReport / store.save / TUI 等执行循环
 *   - syncJourney / writeStateSummary 的文件写入（含 withJourneyLock）
 *   - resumePlan 的 store.load
 *   - freezeContract / applyFrontendContractGate 的文件写入
 *   这些含大量 IO 与全局态，B7 阶段再接线。
 */

import path from 'node:path';
// S5 口径单点（消双口径，T7 收尾批①）：⬜◐ 标记集与"未清零"判定统一由 lib/ci.mjs 提供，
// 本文件不再自持该字符类字面量（第三次分叉的入口）。见 plans/decision-s5-p0-semantics-20260920.md。
import { OPEN_P0_MARKERS, OPEN_P0_MARKER_RE } from './ci.mjs';
// W2-1 capability ingress（Ingress Mini-Contract D.1 rule 1 / D.2）：显式 CLI 输入解析 + 受控词表校验。
import { CAPABILITY_MAP } from './activation.mjs';
import { getCluster } from './matrix.mjs';
import { CapabilityIngressError } from './capability-derivation.mjs';

// ---------------------------------------------------------------------------
// parseArgs — 逐字复制自 orchestrator.mjs（纯函数）
// ---------------------------------------------------------------------------

/**
 * @param {string[]} args - process.argv.slice(2)
 * @returns {object} 解析后的选项对象
 */
export function parseArgs(args) {
  const out = { task: '', workspace: '.', dryRun: false, verbose: false, help: false, resume: false, validate: false, plan: false, draft: null, backend: 'auto', maxRetries: undefined, exec: null, execTimeoutMs: undefined, parallel: undefined, contract: null, contractDraft: null, tui: false, noTui: false, hosts: null, configHosts: null, argError: null, session: undefined, capability: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--provider' || arg === '--execution-mode') { const value=args[++i];if(!value||value.startsWith('--'))out.argError=arg+' requires a value';else out[arg==='--provider'?'provider':'executionMode']=value;continue; }
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--verbose') out.verbose = true;
    else if (arg === '--resume') out.resume = true;
    else if (arg === '--validate') out.validate = true;
    else if (arg === '--plan') out.plan = true;
    else if (arg === '--tui') out.tui = true;
    else if (arg === '--no-tui') out.noTui = true;
    else if (arg === '--draft') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.argError = '--draft 需要一个值 (拆解草案 JSON 文件路径)'; else { out.draft = v; i += 1; } }
    else if (arg === '--backend') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.argError = '--backend 需要一个值 (auto|prompt|cli)'; else { out.backend = v; i += 1; } }
    else if (arg === '--max-retries') { out.maxRetries = Number(args[i + 1]); i += 1; }
    else if (arg === '--exec-timeout') { out.execTimeoutMs = Number(args[i + 1]); i += 1; }
    else if (arg === '--parallel') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.parallel = Infinity; else { out.parallel = Number(v); i += 1; } }
    else if (arg === '--hosts') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.argError = '--hosts 需要一个值 (逗号分隔的备选宿主命令，如 "node host1.mjs,node host2.mjs --model gpt-5.6-luna")'; else { out.hosts = v; i += 1; } }
    else if (arg === '--contract') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.argError = '--contract 需要一个值 (OpenAPI JSON 文件路径)'; else { out.contract = v; i += 1; } }
    else if (arg === '--contract-draft') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.argError = '--contract-draft 需要一个值 (棕地契约草案 JSON 路径)'; else { out.contractDraft = v; i += 1; } }
    else if (arg === '--exec') { const collected = []; const KNOWN = new Set(['--task', '--workspace', '--backend', '--max-retries', '--exec-timeout', '--parallel', '--contract', '--contract-draft', '--hosts', '--dry-run', '--verbose', '--resume', '--validate', '--plan', '--draft', '--tui', '--no-tui', '--help', '-h', '--capability','--provider','--execution-mode']); while (i + 1 < args.length && !KNOWN.has(args[i + 1])) { collected.push(args[i + 1]); i += 1; } out.exec = collected.length ? collected : null; }
    // W2-1：--capability 显式输入（D.1 rule 1，最高优先级，override 派生）；值合法性由 validateOpts 按 CAPABILITY_MAP 校验。
    else if (arg === '--capability') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.argError = '--capability 需要一个值 (CAPABILITY_MAP 受控键，如 security-audit)'; else { out.capability = v; i += 1; } }
    else if (arg === '--task') { out.task = args[i + 1]; if (out.task === undefined) out.task = ''; i += 1; }
    else if (arg === '--workspace') { out.workspace = args[i + 1]; if (out.workspace === undefined) out.workspace = '.'; i += 1; }
    else if (arg === '--session') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.argError = '--session 需要一个值 (命名空间 id，仅 [A-Za-z0-9_-]+)'; else if (!/^[A-Za-z0-9_-]+$/.test(v)) out.argError = '--session 非法：仅允许 [A-Za-z0-9_-]+（防路径穿越）'; else { out.session = v; i += 1; } }
  }
  return out;
}

// ---------------------------------------------------------------------------
// validateOpts — 参数校验（纯函数，逐字复制自 main() 中的校验段）
// ---------------------------------------------------------------------------

const EXIT = { OK: 0, ARGS: 2, NOT_IMPL: 3, CONTRACT: 4, FAILED: 5 };
const EXIT_APPROVAL_ABORTED = 6;

/**
 * 校验解析后的选项。
 * @param {object} opts - parseArgs 输出
 * @returns {{ok: boolean, error: string|null, exitCode: number}}
 */
export function validateOpts(opts) {
  if (opts.help) return { ok: true, help: true, error: null, exitCode: EXIT.OK };
  if (opts.argError) return { ok: false, error: opts.argError, exitCode: EXIT.ARGS };
  if (opts.executionMode&&!['HOST_NATIVE','EXTERNAL_PROVIDER','BRIEF_ONLY'].includes(opts.executionMode)) return {ok:false,error:'Unknown execution mode',exitCode:EXIT.ARGS};
  if (opts.provider&&!/^[a-z0-9][a-z0-9_.-]*$/i.test(opts.provider)) return {ok:false,error:'Invalid provider id',exitCode:EXIT.ARGS};
  if (opts.resume && opts.dryRun) return { ok: false, error: '--resume 不能与 --dry-run 同时使用', exitCode: EXIT.ARGS };
  if (opts.plan && opts.resume) return { ok: false, error: '--plan 不能与 --resume 同时使用', exitCode: EXIT.ARGS };
  if (!['auto', 'prompt', 'cli'].includes(opts.backend)) return { ok: false, error: '--backend 仅支持 auto|prompt|cli', exitCode: EXIT.ARGS };
  // W2-1（D.1 rule 1 / D.2）：显式 --capability 必须逐字命中 CAPABILITY_MAP 受控键（大小写不敏感精确匹配），
  // 未知键 → CAPABILITY_UNKNOWN argError fail-closed（不猜、不做语义匹配）。
  if (opts.capability !== null && opts.capability !== undefined && String(opts.capability).trim()) {
    const capKey = String(opts.capability).trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(CAPABILITY_MAP, capKey)) {
      return { ok: false, error: 'CAPABILITY_UNKNOWN: --capability 「' + opts.capability + '」不在 CAPABILITY_MAP 受控映射（fail-closed 不猜；键集事实源=scripts/lib/activation.mjs CAPABILITY_MAP）', exitCode: EXIT.ARGS };
    }
  }
  if (opts.maxRetries !== undefined && (!Number.isInteger(opts.maxRetries) || opts.maxRetries < 0)) return { ok: false, error: '--max-retries 必须是非负整数', exitCode: EXIT.ARGS };
  if (opts.execTimeoutMs !== undefined && (!Number.isInteger(opts.execTimeoutMs) || opts.execTimeoutMs < 1)) return { ok: false, error: '--exec-timeout 必须是正整数（毫秒）', exitCode: EXIT.ARGS };
  if (opts.parallel !== undefined && opts.parallel !== Infinity && (!Number.isInteger(opts.parallel) || opts.parallel < 1)) return { ok: false, error: '--parallel 必须是正整数（缺省 = 全部并行）', exitCode: EXIT.ARGS };
  if (!opts.task.trim() && !opts.resume) return { ok: false, error: '任务不能为空（使用 --resume 恢复上次计划）', exitCode: EXIT.ARGS };
  return { ok: true, error: null, exitCode: EXIT.OK };
}

// ---------------------------------------------------------------------------
// isOpenApiSpec — 逐字复制
// ---------------------------------------------------------------------------

/**
 * 判定已解析 JSON 是否为可消费 OpenAPI 规范（v3 openapi / v2 swagger）。
 * @param {any} doc
 * @returns {boolean}
 */
export function isOpenApiSpec(doc) {
  return Boolean(doc) && typeof doc === 'object' && !Array.isArray(doc)
    && (typeof doc.openapi === 'string' || typeof doc.swagger === 'string');
}

// ---------------------------------------------------------------------------
// parseBacklogRows / backlogIsPending — 逐字复制自 orchestrator.mjs
// ---------------------------------------------------------------------------

const BL_COLS = { '#': 'serial', '批判': 'title', '级别': 'level', '修复': 'fix', '落点': 'ctx', '验收': 'accept', '状态': 'status' };
// 待落地判定：⬜◐ 标记集自 lib/ci.mjs 单点派生（OPEN_P0_MARKERS），"待…" 措辞为本文件特有。
// 行为与抽取前逐字等价（原字面量即本标记集，字符集相同）。
const BL_PENDING_RE = new RegExp('^(?:' + OPEN_P0_MARKERS.join('|') + ')|(?:待落地|待复验|待[\\u4e00-\\u9fa5]*)');

/**
 * 解析 critique-backlog-tracker.md 表格行。
 * @param {string} text
 * @returns {Array<{serial: string, title: string, fix: string, status: string, raw: string}>}
 */
export function parseBacklogRows(text) {
  const blocks = [];
  let block = null;
  const flush = function() { if (block) { blocks.push(block); block = null; } };
  for (const raw of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const t = raw.trim();
    if (/^\|\s*#/.test(t) && (t.includes('批判') || t.includes('落点'))) {
      flush();
      const cells = t.split('|').map(function(c) { return c.trim(); });
      const col = {};
      for (let i = 0; i < cells.length; i += 1) {
        for (const [name, key] of Object.entries(BL_COLS)) {
          if (cells[i] === name || (name !== '#' && name !== '状态' && cells[i].includes(name))) { if (!(key in col)) col[key] = i; }
          else if (cells[i].includes('状态')) col.status = i;
        }
      }
      block = { col, rows: [] };
      continue;
    }
    if (block && /^\|/.test(t) && !/^\|[\s:-]+\|$/.test(t)) {
      const cells = t.split('|').map(function(c) { return c.trim(); });
      const get = function(k) { return cells[block.col[k]]; };
      const serialRaw = get('serial') ?? cells[0];
      const m = String(serialRaw || '').match(/C-(\d+)/);
      if (m) block.rows.push({
        serial: 'C-' + String(parseInt(m[1], 10)).padStart(2, '0'),
        title: (get('title') ?? '').replace(/（来源：.+?）/, '').trim(),
        fix: (get('fix') ?? '').trim(),
        status: (get('status') ?? '').trim(),
        raw: t,
      });
      continue;
    }
    if (/^#/.test(t) && !/^\|/.test(t)) flush();
  }
  flush();
  const out = [];
  for (const b of blocks) out.push(...b.rows);
  return out;
}

/**
 * 行是否待落地。
 * S5 严格口径单点（T7 收尾批①）：状态以 ⬜/◐ 开头即 pending —— OPEN_P0_MARKER_RE 由
 * lib/ci.mjs 的 OPEN_P0_MARKERS 派生，与 S5 P0 硬闸门同一事实源（行为零变化，原本就含此二标记）。
 * @param {{status: string, raw: string}} r
 * @returns {boolean}
 */
export function backlogIsPending(r) {
  if (!r.status) return BL_PENDING_RE.test(r.raw);
  if (/^✅/.test(r.status) || /^❌/.test(r.status)) return false;
  if (OPEN_P0_MARKER_RE.test(r.status)) return true;
  return BL_PENDING_RE.test(r.status);
}

// ---------------------------------------------------------------------------
// classifyExitError — 错误类型 → 退出码
// ---------------------------------------------------------------------------

/**
 * 将 main() catch 中的错误映射为退出码（逐字复制自 orchestrator.mjs 底部 catch）。
 * @param {Error} error
 * @param {object} errorTypes - { NoMatchError, ContractViolationError }
 * @returns {number} 退出码
 */
export function classifyExitError(error, errorTypes = {}) {
  if (errorTypes.NoMatchError && error instanceof errorTypes.NoMatchError) return EXIT.FAILED;
  if (errorTypes.ContractViolationError && error instanceof errorTypes.ContractViolationError) return EXIT.CONTRACT;
  if (String(error?.message || '').includes('NOT_IMPLEMENTED')) return EXIT.NOT_IMPL;
  return EXIT.FAILED;
}

// ---------------------------------------------------------------------------
// planDryRun — --plan --dry-run 路径纯逻辑
// ---------------------------------------------------------------------------

/**
 * 执行 --plan --dry-run 的完整逻辑，返回 stdout 文本与退出码。
 * 不调用 console.log / process.exit，而是返回结果。
 *
 * @param {string[]} argv - CLI 参数（不含 node 与脚本路径）
 * @param {object} ctx - 注入依赖
 * @param {function} ctx.readFile - (path) => Promise<string>
 * @param {function} ctx.buildManifest - () => Promise<manifest>
 * @param {string} ctx.workspace - 解析后的 workspace 绝对路径
 * @param {object|null} ctx.config - config.json 内容（或 null）
 * @param {object} ctx.errorTypes - 错误类 { NoMatchError, ContractViolationError }
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export async function planDryRun(argv, ctx) {
  const { readFile, buildManifest, workspace, config, errorTypes } = ctx;
  const stdoutLines = [];
  const stderrLines = [];

  const opts = parseArgs(argv);

  // 模拟 logger.info（dry-run 下 verbose=false，但 info 始终输出）
  const info = (...args) => stdoutLines.push('[tt] ' + args.join(' '));

  if (opts.help) {
    return { stdout: '', stderr: '', exitCode: EXIT.OK }; // usage 由外层 CLI 壳处理
  }
  const v = validateOpts(opts);
  if (!v.ok) {
    stderrLines.push(v.error);
    return { stdout: stdoutLines.join('\n'), stderr: stderrLines.join('\n'), exitCode: v.exitCode };
  }

  // workspace 落产物/状态（dry-run --draft 模式不写盘，但 workspace 仍需解析）
  info('state: idle');

  // 加载 manifest（dry-run 走 buildManifest）
  let manifest;
  try {
    manifest = await buildManifest();
  } catch (error) {
    stderrLines.push('[tt] ' + error.message);
    return { stdout: stdoutLines.join('\n'), stderr: stderrLines.join('\n'), exitCode: EXIT.FAILED };
  }

  info('state: planning');

  // --plan 路径
  if (opts.plan) {
    // 动态导入 deconstruct + approve（避免 lib 顶层副作用）
    const { runDeconstructFlow, formatErrors } = await import('./deconstruct.mjs');
    const { printApprovalSummary, printDraft } = await import('./approve.mjs');

    const planWs = workspace;
    let draftFlow;
    try {
      draftFlow = await runDeconstructFlow({
        task: opts.task,
        manifest,
        exec: opts.exec,
        execTimeoutMs: opts.execTimeoutMs,
        workspace: planWs,
        draftFile: opts.draft,
      });
    } catch (error) {
      stderrLines.push('[tt] ' + error.message);
      return { stdout: stdoutLines.join('\n'), stderr: stderrLines.join('\n'), exitCode: EXIT.FAILED };
    }

    if (!draftFlow.ok) {
      stderrLines.push('[tt] ' + draftFlow.error);
      return { stdout: stdoutLines.join('\n'), stderr: stderrLines.join('\n'), exitCode: EXIT_APPROVAL_ABORTED };
    }

    if (opts.dryRun) {
      stdoutLines.push(printApprovalSummary(draftFlow.draft));
      stdoutLines.push('--- 拆解草案（--plan --dry-run 不写任何文件，仅打印草案与审批摘要） ---');
      stdoutLines.push(printDraft(draftFlow.draft));
      info('state: done');
      return { stdout: stdoutLines.join('\n'), stderr: '', exitCode: EXIT.OK };
    }
  }

  // 非 --plan 或非 dry-run 的 planDryRun 不应到达此处（由外层 main 处理）
  stderrLines.push('[tt] planDryRun: 非 --plan --dry-run 路径未抽取');
  return { stdout: stdoutLines.join('\n'), stderr: stderrLines.join('\n'), exitCode: EXIT.FAILED };
}

// ---------------------------------------------------------------------------
// applyCapabilityToPlan — W2-1 plan 后处理（D.1 rule 1 显式输入 → plan；纯函数零 IO）
// ---------------------------------------------------------------------------

/**
 * 将显式 CLI --capability 应用到已选资产的 plan（D.1 precedence：显式 1 > 派生 2）。
 * - 无显式输入 → plan 原样返回（派生字段已由 buildPlan 附加）。
 * - 有显式输入 → 仅同资产 primary owner 的 capability/capabilitySource:'explicit'（override 派生）；
 *   解析 asset（CAPABILITY_MAP 单点）不在 plan.cluster 的 candidates → CAPABILITY_CLUSTER_MISMATCH
 *   fail-closed 抛错（不静默取一，与 buildPlan 同款守卫）。exact deconstructed 以既有已选资产为边界，
 *   仍要求非 support owner；legacy owner 缺 role 时登记 primary，不新建或重绑定子任务。
 * 纯函数：原地覆盖 subtask 加法字段并返回同一 plan 引用；不触碰 asset 或既有角色。
 * @param {object} plan - buildPlan 或 normalizeDraft 产物
 * @param {object} opts - parseArgs 输出（读 opts.capability）
 * @returns {object} 同一 plan 引用
 */
export function applyCapabilityToPlan(plan, opts) {
  if (!plan || !Array.isArray(plan.subtasks)) return plan;
  const explicit = opts && typeof opts.capability === 'string' && opts.capability.trim()
    ? opts.capability.trim().toLowerCase() : null;
  if (!explicit) return plan;
  const mapped = Object.prototype.hasOwnProperty.call(CAPABILITY_MAP, explicit) ? CAPABILITY_MAP[explicit] : null;
  if (!mapped) throw new CapabilityIngressError('CAPABILITY_UNKNOWN', 'CAPABILITY_UNKNOWN: capability「' + explicit + '」不在 CAPABILITY_MAP 受控映射（fail-closed 不猜）');
  const cluster = getCluster(plan.cluster);
  const deconstructed = plan.cluster === 'deconstructed';
  const candidates = deconstructed ? plan.subtasks.map(subtask => subtask.asset) : cluster ? cluster.candidates : [];
  if (!candidates.includes(mapped)) {
    throw new CapabilityIngressError('CAPABILITY_CLUSTER_MISMATCH', 'CAPABILITY_CLUSTER_MISMATCH: capability「' + explicit + '」解析 asset「' + mapped + '」不在 plan 簇 ' + plan.cluster + ' candidates ' + JSON.stringify(candidates) + '（fail-closed，不静默取一）');
  }
  const owners = plan.subtasks.filter(subtask => subtask.asset === mapped && subtask.role !== 'support');
  if (!owners.length) throw new CapabilityIngressError('CAPABILITY_CLUSTER_MISMATCH', 'CAPABILITY_CLUSTER_MISMATCH: capability owner「' + mapped + '」不在本计划 primary 子任务中（保留 support 角色，不静默重绑定）');
  for (const subtask of plan.subtasks) {
    if (owners.includes(subtask)) {
      if (deconstructed && !subtask.role) subtask.role = 'primary';
      subtask.capability = explicit;
      subtask.capabilitySource = 'explicit';
    } else if (subtask.capability && Object.prototype.hasOwnProperty.call(CAPABILITY_MAP, subtask.capability)
      && CAPABILITY_MAP[subtask.capability] !== subtask.asset) {
      // Repair an old broadcast only; each support asset keeps its own valid capability.
      delete subtask.capability;
      delete subtask.capabilitySource;
    }
  }
  return plan;
}

// ---------------------------------------------------------------------------
// 导出
// ---------------------------------------------------------------------------

export { EXIT, EXIT_APPROVAL_ABORTED };

export default {
  parseArgs,
  validateOpts,
  isOpenApiSpec,
  parseBacklogRows,
  backlogIsPending,
  classifyExitError,
  planDryRun,
  applyCapabilityToPlan,
  EXIT,
  EXIT_APPROVAL_ABORTED,
};
