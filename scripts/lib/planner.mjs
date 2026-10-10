import {profileAllowed} from './methodology.mjs';
import { CLUSTERS } from './matrix.mjs';
// W2-1 capability ingress（Ingress Mini-Contract D.1/D.2）：受控派生 + CAPABILITY_MAP 单点解析。
import { deriveCapability, resolveCapabilityAsset, CapabilityIngressError } from './capability-derivation.mjs';
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
  // Preserve controlled words in CamelCase/acronym compounds before case-folding.
  return String(text)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase();
} 
function matchesRouteKeyword(text, englishTokens, keyword) {
  const normalized = normalize(keyword);
  // ASCII words require a complete token; separators and controlled CamelCase
  // compounds remain usable. Chinese intent keywords retain substring matching.
  return /^[a-z0-9]+$/.test(normalized)
    ? englishTokens.has(normalized)
    : text.includes(normalized);
}
export function route(taskText, manifest) { 
  const text = normalize(taskText); 
  if (!text.trim()) throw new NoMatchError(); 
  const englishTokens = new Set(text.match(/[a-z0-9]+/g) || []);
  let best = null; 
  let bestScore = 0; 
  for (const cluster of CLUSTERS) { 
    let score = 0; 
    for (const keyword of cluster.keywords) if (matchesRouteKeyword(text, englishTokens, keyword)) score += 1;
    if (score > bestScore) { best = cluster; bestScore = score; } 
  } 
  if (!best) throw new NoMatchError(); 
  return best; 
} 
export function buildPlan(taskText, manifest, options = undefined) { 
  const cluster = route(taskText, manifest); 
  // W2-1 capability ingress（D.1 precedence：显式输入 1 > 受控派生 2 > 缺省 3）。
  // 显式输入（options.capability）在场 → 跳过派生（override，precedence 1 > 2）；
  // 无显式 → deriveCapability(taskText) 受控关键词派生；无命中 → null（legacy asset-only，零字段）。
  const explicitCap = (options && typeof options.capability === 'string' && options.capability.trim())
    ? options.capability.trim().toLowerCase() : null;
  const derivedHit = explicitCap ? null : deriveCapability(taskText);
  const capability = explicitCap || (derivedHit ? derivedHit.key : null);
  if (capability) {
    // 值域守卫（D.2）：capability 必须解析到 CAPABILITY_MAP 已有键，未知 → CAPABILITY_UNKNOWN fail-closed。
    const capAsset = resolveCapabilityAsset(capability);
    if (!capAsset) throw new CapabilityIngressError('CAPABILITY_UNKNOWN', 'CAPABILITY_UNKNOWN: capability「' + capability + '」不在 CAPABILITY_MAP 受控映射（fail-closed 不猜，键集见 scripts/lib/activation.mjs）');
    // 同簇守卫（D.5）：capability 解析的 asset 不在路由簇 candidates → CAPABILITY_CLUSTER_MISMATCH
    // fail-closed，不静默取一（校验轴；簇成员资格按 CLUSTERS 定义，可用性仍走既有资格链）。
    if (!cluster.candidates.includes(capAsset)) throw new CapabilityIngressError('CAPABILITY_CLUSTER_MISMATCH', 'CAPABILITY_CLUSTER_MISMATCH: capability「' + capability + '」解析 asset「' + capAsset + '」不在路由簇 ' + cluster.id + ' candidates ' + JSON.stringify(cluster.candidates) + '（fail-closed，不静默取一）');
  }
  const capabilitySource = capability ? (explicitCap ? 'explicit' : 'derived') : null;
  let entries = []; 
  if (manifest && manifest.entries) entries = manifest.entries; 
  const available = new Set(entries.map(function(entry) { return entry.name; })); 
  const candidates = cluster.candidates.filter(function(name) { return available.has(name)&&profileAllowed(entries.find(e=>e.name===name)?.optional_profile,options?.ownerIntent,options?.methodologyContext); }); 
  if (!candidates.length) throw new NoMatchError('no matching asset for ' + cluster.id); 
  const primaryAsset = capability ? resolveCapabilityAsset(capability) : candidates[0];
  if (!candidates.includes(primaryAsset)) throw new NoMatchError('primary capability asset unavailable: ' + primaryAsset);
  const planId = 'plan-' + Date.now().toString(36);
  // DAG：phases 二维分组（同一 phase 内可并行，跨 phase 串行）。未定义 phases → 每候选独立 phase（完全串行，向后兼容）。
  const phases = Array.isArray(cluster.phases) ? cluster.phases : cluster.candidates.map(function(name) { return [name]; }); 
  const phaseOf = new Map(); 
  phases.forEach(function(group, p) { group.forEach(function(asset) { phaseOf.set(asset, p); }); }); 
  // 保持 subtasks 数组顺序 = candidates 原序（G1 向后兼容）；phase/dependsOn 作为附加字段。
  const preconditions = Array.isArray(cluster.preconditions) ? cluster.preconditions.slice() : [];
  const subtasks = candidates.map(function(asset, index) { 
    const primary = asset === primaryAsset;
    const phase = phaseOf.get(asset) === undefined ? index : phaseOf.get(asset);
    const subtask = { id: planId + '-' + index, planId, asset, role: primary ? 'primary' : 'support', parentTask: taskText, contract: cluster.contract, status: 'idle', artifactPath: null, attempts: 0, phase, dependsOn: [], desc: primary ? taskText : '执行 ' + asset + ' 在既有计划 phase ' + phase + ' 的职责；父任务仅提供目标上下文，使用上游产物并交付本项独立产物。', estimate: undefined, lane: undefined, approved: undefined, preconditions: preconditions.length ? preconditions.slice() : undefined }; 
    // Deterministic role/desc preserve the existing asset and phase duties.
    // Capability ingress fields belong only to their owner; absent capability adds neither field.
    if (capabilitySource && primary) { subtask.capability = capability; subtask.capabilitySource = capabilitySource; } 
    return subtask; 
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
