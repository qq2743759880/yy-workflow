import { CLUSTERS } from './matrix.mjs'; 
export class NoMatchError extends Error { constructor(message = 'no matching asset') { super(message); this.name = 'NoMatchError'; } } 
/** FR-3 前端「调用后端接口的实现」类资产：开工前必须有冻结契约（contractMode:'frozen' + 真实契约文件），缺契约不派。 */
export const FRONTEND_IMPL_ASSETS = ['implementation']; 
function isFrontendTask(text) { return /frontend|page|web|responsive|component|landing|ui|ux|\u524d\u7aef|\u9875\u9762/i.test(String(text || '')); } 
/** 判定子任务是否为需要契约硬前置的「前端实现」子任务（T4_FRONTEND 簇，且资产为调用后端的实现类）。 */
export function isFrontendImplementation(subtask, plan) { 
  const cluster = plan && plan.cluster; 
  const feCluster = cluster === 'T4_FRONTEND'; 
  const feTask = isFrontendTask(plan && plan.task); 
  return (feCluster || feTask) && FRONTEND_IMPL_ASSETS.includes(subtask.asset); 
} 
function normalize(text) { 
  if (text === undefined) text = ''; 
  if (text === null) text = ''; 
  return String(text).toLowerCase(); 
} 
export function route(taskText, manifest) { 
  const text = normalize(taskText); 
  if (!text.trim()) throw new NoMatchError(); 
  let best = null; 
  let bestScore = 0; 
  for (const cluster of CLUSTERS) { 
    let score = 0; 
    for (const keyword of cluster.keywords) if (text.includes(normalize(keyword))) score += 1; 
    if (score > bestScore) { best = cluster; bestScore = score; } 
  } 
  if (!best) throw new NoMatchError(); 
  return best; 
} 
export function buildPlan(taskText, manifest) { 
  const cluster = route(taskText, manifest); 
  let entries = []; 
  if (manifest && manifest.entries) entries = manifest.entries; 
  const available = new Set(entries.map(function(entry) { return entry.name; })); 
  const candidates = cluster.candidates.filter(function(name) { return available.has(name); }); 
  if (!candidates.length) throw new NoMatchError('no matching asset for ' + cluster.id); 
  const planId = 'plan-' + Date.now().toString(36);
  // DAG：phases 二维分组（同一 phase 内可并行，跨 phase 串行）。未定义 phases → 每候选独立 phase（完全串行，向后兼容）。
  const phases = Array.isArray(cluster.phases) ? cluster.phases : cluster.candidates.map(function(name) { return [name]; }); 
  const phaseOf = new Map(); 
  phases.forEach(function(group, p) { group.forEach(function(asset) { phaseOf.set(asset, p); }); }); 
  // 保持 subtasks 数组顺序 = candidates 原序（G1 向后兼容）；phase/dependsOn 作为附加字段。
  const preconditions = Array.isArray(cluster.preconditions) ? cluster.preconditions.slice() : [];
  const subtasks = candidates.map(function(asset, index) { 
    return { id: planId + '-' + index, planId, asset, contract: cluster.contract, status: 'idle', artifactPath: null, attempts: 0, phase: phaseOf.get(asset) === undefined ? index : phaseOf.get(asset), dependsOn: [], desc: undefined, estimate: undefined, lane: undefined, approved: undefined, preconditions: preconditions.length ? preconditions.slice() : undefined }; 
  }); 
  // dependsOn = 前一个 phase 的所有 subtask.id（第一 phase 空数组）；逐 phase 填充保证引用已存在 id。
  const byPhase = new Map(); 
  for (const s of subtasks) { if (!byPhase.has(s.phase)) byPhase.set(s.phase, []); byPhase.get(s.phase).push(s.id); } 
  for (const s of subtasks) { if (s.phase > 0) s.dependsOn = byPhase.get(s.phase - 1) || []; } 
  // FR-3：前端「调用后端接口的实现」子任务契约硬前置标记（contractRequired=true）。仅标记，
  // 具体契约赋值/缺契约 skip 由 orchestrator 在 freezeContract 后按真实契约裁决（见 applyFrontendContractGate）。
  for (const s of subtasks) if (isFrontendImplementation(s, { cluster: cluster.id, task: taskText })) s.contractRequired = true; 
  return { id: planId, task: taskText, cluster: cluster.id, contract: cluster.contract, requireExec: cluster.requireExec === true, preconditions, phases: phases.length, subtasks, status: 'planning', createdAt: new Date().toISOString() };
}
