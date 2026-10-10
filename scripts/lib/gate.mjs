import fs from 'node:fs/promises'; 
import path from 'node:path'; 
import crypto from 'node:crypto'; 
const snapshots = new Map(); 
export class ContractMissingError extends Error {} 
export class ContractViolationError extends Error { constructor(subtaskId, diff) { super('contract violation: ' + subtaskId + ' ' + diff); this.name = 'ContractViolationError'; this.diff = diff; } } 
function stable(value) { 
  if (Array.isArray(value)) return value.map(stable); 
  if (value && typeof value === 'object') { const out = {}; for (const key of Object.keys(value).sort()) if (value[key] !== null && value[key] !== '') out[key] = stable(value[key]); return out; } 
  return value; 
} 
/** 解析契约：相对路径按 workspace 解析（消除 cwd 依赖——workspace≠cwd 时不得静默降级 describe）。 */
function resolveContractPath(contract, workspace) {
  if (path.isAbsolute(contract)) return contract;
  return path.join(workspace || '.', contract);
}
export async function parseContract(subtask, workspace) { 
  // Legacy tasks may omit a contract; frozen callers are rejected by before().
  if (subtask.contract == null) return { mode: 'describe', value: '' };
  try { 
    const text = await fs.readFile(resolveContractPath(subtask.contract, workspace), 'utf8'); 
    return { mode: 'json', value: JSON.parse(text) }; 
  } catch (error) { 
    if (error.code === 'ENOENT') return { mode: 'describe', value: subtask.contract }; 
    throw error; 
  } 
} 
export async function snapshot(subtask, workspace) { 
  const parsed = await parseContract(subtask, workspace); 
  const normalized = stable(parsed.value); 
  const hash = crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex'); 
  return { hash, normalized, mode: parsed.mode }; 
} 
export function diffContracts(a, b) { 
  if (JSON.stringify(a.normalized) === JSON.stringify(b.normalized)) return []; 
  return ['contract snapshot changed']; 
} 
export function formatDiff(diff) { return Array.isArray(diff) ? diff.join('; ') : String(diff); } 
function gateMode() { return process.env.TT_GATE_MODE === 'warn' ? 'warn' : 'block'; } 
/** 检查子任务产物目录是否存在非空产物（describe 模式的契约 gate）。 */ 
export async function collectArtifacts(subtask, workspace) { 
  const dir = path.join(workspace || '.', 'artifacts', subtask.id); 
  try { return await fs.readdir(dir); } catch (error) { if (error.code === 'ENOENT') return []; throw error; } 
} 
export async function before(subtask, opts = {}) { 
  // A failed new attempt must not reuse an earlier attempt's contract snapshot.
  snapshots.delete(subtask.id);
  let current;
  try {
    current = await snapshot(subtask, opts.workspace);
  } catch (error) {
    const violation = new ContractViolationError(subtask.id, 'contract unreadable before execution: ' + error.message);
    violation.cause = error;
    throw violation;
  }
  if (subtask.contractMode === 'frozen' && current.mode !== 'json') {
    throw new ContractViolationError(subtask.id, 'frozen contract missing before execution: ' + subtask.contract);
  }
  snapshots.set(subtask.id, current); 
  return { subtaskId: subtask.id, pass: true, diff: null, checkedAt: new Date().toISOString() }; 
} 
export async function after(subtask, opts = {}) {
  const previous = snapshots.get(subtask.id);
  // 契约文件模式：前后内容 hash 比对（防执行过程篡改契约）
  if (previous && previous.mode === 'json') {
    let current;
    try {
      current = await snapshot(subtask, opts.workspace);
    } catch (error) {
      // 执行期间契约文件被删除/改成非法内容 → 视为篡改违约，不得吞掉
      const result = { subtaskId: subtask.id, pass: false, diff: 'contract file changed or unparseable during execution: ' + error.message, checkedAt: new Date().toISOString() };
      if (gateMode() === 'warn') { console.warn('[tt] gate warn', result.diff); return result; }
      throw new ContractViolationError(subtask.id, result.diff);
    }
    const diff = previous ? diffContracts(previous, current) : [];
    if (diff.length) {
      const result = { subtaskId: subtask.id, pass: false, diff: formatDiff(diff), checkedAt: new Date().toISOString() };
      if (gateMode() === 'warn') { console.warn('[tt] gate warn', result.diff); return result; }
      throw new ContractViolationError(subtask.id, result.diff);
    }
  }
  // describe 模式（contract 为描述字符串）：产物存在性 gate——声称成功的子任务必须真实产出产物
  if (!previous || previous.mode === 'describe') { 
    if (subtask.status === 'done' && !opts.dryRun) { 
      const files = await collectArtifacts(subtask, opts.workspace); 
      if (!files.length) { 
        const result = { subtaskId: subtask.id, pass: false, diff: 'no artifacts produced for ' + subtask.id + ' although subtask claimed done', checkedAt: new Date().toISOString() }; 
        if (gateMode() === 'warn') { console.warn('[tt] gate warn', result.diff); return result; } 
        throw new ContractViolationError(subtask.id, result.diff); 
      } 
    } 
  } 
  return { subtaskId: subtask.id, pass: true, diff: null, checkedAt: new Date().toISOString() }; 
}

// ============================================================================
// B4（T6 接线）：review-gate 批判输出段 → remediation.register 桥接
// ----------------------------------------------------------------------------
// 设计纪律：
//  - 只做「结构化批判条目 → remediation finding」的组装与路由；不自行解析批判 markdown
//    （解析仍在 scripts/review-gate.mjs——该脚本顶层 `process.exitCode=1`，被 import 即污染
//    退出码，故本桥接受已解析条目；调用方经 review-gate CLI/parseCritiqueEntries 产出）。
//  - 污染防护：opts.registerFindings !== true 走 DRY-PRINT（仅构造并返回 findingInput，
//    不调用 remediationRegister、不写 B1 命名空间、不加锁）——默认零副作用。
//  - 落盘路径（--register-findings 显式开启）：
//      withLock(<workspace>/.tt-state/state.json) 包裹（B2 fail-closed）
//      → remediationRegister 写自带 append-only ledger（幂等键 critiqueFile.sha256+normalizeTitle）
//      → appendNamespace('finding', ...) 在 B1 命名空间登记一份索引记录（B1）。
//  - 不改任何既有 before/after 行为；本函数为纯 additive 导出。
// ============================================================================

/**
 * 把 review-gate 批判条目登记为 remediation finding。
 * @param {object} input
 * @param {Array<{title:string,url?:string,date?:string,plan?:string,minVerify?:string,level?:string}>} input.entries
 *        有效批判条目（调用方应已按 review-gate 的 valid=url&&date 过滤）。
 * @param {{path:string,sha256:string}} input.critiqueFile  批判文件（仓库相对 posix 路径 + sha256）。
 * @param {string} [input.registeredBy]
 * @param {object} opts
 * @param {string} [opts.workspace]
 * @param {boolean} [opts.registerFindings=false]  显式 true 才落盘；缺省 DRY-PRINT。
 * @param {string} [opts.repoRoot]  remediation ledger 根（缺省 = workspace）。
 * @param {string} [opts.now]
 * @param {Function} [opts.rand]
 * @returns {Promise<{dryRun:boolean, registered:Array, skipped:Array, prints:Array}>}
 */
export async function registerReviewFindings(input, opts = {}) {
  const entries = Array.isArray(input && input.entries) ? input.entries : [];
  const critiqueFile = input && input.critiqueFile;
  if (!critiqueFile || !critiqueFile.path || !critiqueFile.sha256) {
    throw new Error('registerReviewFindings: input.critiqueFile{path,sha256} 必填');
  }
  const registeredBy = (input && input.registeredBy) || 'review-gate-bridge';
  const workspace = (opts && opts.workspace) || '.';
  const repoRoot = (opts && opts.repoRoot) || workspace;
  const doPersist = Boolean(opts && opts.registerFindings === true);

  // 懒加载：仅落盘路径拉取 remediation/state/store；DRY-PRINT 不触碰（隔离 S7 既有回归面）。
  const { remediationRegister, normalizeTitle } = await import('./remediation.mjs');
  let stateMod = null;
  let storeMod = null;
  if (doPersist) {
    stateMod = await import('./state.mjs');
    storeMod = await import('./store.mjs');
  }

  const prints = [];
  const registered = [];
  const skipped = [];

  for (const entry of entries) {
    if (!entry || !entry.title) { skipped.push({ reason: 'empty-title', entry: entry || null }); continue; }
    const title = normalizeTitle(String(entry.title));
    // review-gate DATE_RE 同时接受 2026-09-01 与 2026/09/02；remediation externalSource.date 要求 ISO → 归一斜杠日期。
    const normDate = String(entry.date || '').replace(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
      (m, y, mo, d) => y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'));
    // 组装 finding 必填五要素（+ sourceAnchor/critiqueFile）；sourceAnchor 用 kind='probe'
    // 指向批判文件本身（evidence gate 要求 path 存在且 sha256 一致——批判文件即锚）。
    const finding = {
      title,
      sourceAnchor: { kind: 'probe', path: critiqueFile.path, sha256: critiqueFile.sha256 },
      reproCommand: entry.minVerify || entry.plan || 'review-gate: see critiqueFile',
      externalSource: {
        kind: 'competitor',
        url: entry.url || '',
        date: normDate || '1970-01-01',
        citedAs: String(entry.title),
      },
      impact: entry.level ? 'level=' + entry.level : 'unspecified',
      proposedVerification: entry.minVerify || entry.plan || 'see reproCommand',
      critiqueFile: { path: critiqueFile.path, sha256: critiqueFile.sha256 },
    };

    if (!doPersist) {
      prints.push({ title, idempotency: { sha: critiqueFile.sha256, title }, findingInput: finding, action: 'DRY_PRINT' });
      continue;
    }

    // 落盘：整段在 withLock(state.json) 内执行（B2 fail-closed）；remediationRegister 自带 ledger 写。
    const lockTarget = path.join(workspace, '.tt-state', 'state.json');
    try {
      const result = await storeMod.withLock(lockTarget, async () => {
        const reg = remediationRegister({
          finding,
          registeredBy,
          opts: { repoRoot, now: opts.now, rand: opts.rand },
        });
        if (reg && reg.ok && reg.code !== 'REMEDIATION_DUPLICATE' && reg.data) {
          await stateMod.appendNamespace('finding', {
            findingId: reg.data.findingId,
            taskRef: reg.data.taskRef,
            status: reg.data.status,
            title,
            critiqueFile: finding.critiqueFile,
            registeredAt: reg.evidence && reg.evidence.registeredAt,
          }, { workspace });
        }
        return reg;
      });
      if (result && result.code === 'REMEDIATION_DUPLICATE') {
        skipped.push({ title, reason: 'idempotent-duplicate', echo: result.data && result.data.findingId });
      } else if (result && result.ok) {
        registered.push({ title, findingId: result.data && result.data.findingId, code: result.code });
      } else {
        skipped.push({ title, reason: 'register-not-ok', code: result && result.code, detail: result && result.error });
      }
    } catch (e) {
      skipped.push({ title, reason: 'lock-or-register-failed', error: e && e.message });
    }
  }

  return { dryRun: !doPersist, registered, skipped, prints };
}
