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
  const current = await snapshot(subtask, opts.workspace); 
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
