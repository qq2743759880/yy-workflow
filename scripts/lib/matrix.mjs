// AS-1 drop 7（handoffs/v3/AS-1-dispatch.md，2026-09-25）：candidates 删 drop 7 清单资产
//（逐资产清单 = contracts/discrepancies/ 的 AS-1 drop change.record；vendor 与 sidecar 同批删除，
// phases/preconditions 同步收缩——禁止留空引用）；keywords 保留（路由词汇无害）。
// 收缩后 9 资产：implementation/be-validator/sdlc/security/review/dev-planner/frontend-design/planning/skill-sentinel。
export const CLUSTERS = [
  { id: 'T1_DATABASE', label: 'database', keywords: ['database', 'sql', 'schema', 'migration', 'data', '\u6570\u636e\u5e93'], candidates: ['implementation', 'be-validator', 'sdlc'], phases: [['implementation'], ['be-validator', 'sdlc']], contract: 'database contract', preconditions: ['数据库 schema/数据契约产物须先冻结（contracts/<planId>.json 或 --contract），下游 be-validator/sdlc 才开工', '每子任务产物须含资产消费锚点 + ≥1 内核词（D-1 机验，缺则 assetConsumed=false）'] },
  { id: 'T2_BACKEND', label: 'backend', keywords: ['backend', 'api', 'login', 'server', '\u540e\u7aef', '\u767b\u5f55', '\u63a5\u53e3'], candidates: ['implementation', 'sdlc', 'security', 'review', 'be-validator'], phases: [['implementation', 'security'], ['sdlc', 'review'], ['be-validator']], contract: 'backend interface and error contract', requireExec: true, preconditions: ['接口/错误契约产物须先冻结（contracts/<planId>.json 或 --contract OpenAPI），下游才放行', '实现类子任务须经 --exec 宿主真实执行，禁纯 prompt 兜底（requireExec）', '每子任务产物须含资产消费锚点 + ≥1 内核词（D-1）；上游 done 且 assetConsumed=true 后下游才派单'] },
  { id: 'T3_AI_RAG_MCP', label: 'ai-rag-mcp', keywords: ['ai', 'rag', 'mcp', 'agent', 'model', '\u6a21\u578b', '\u77e5\u8bc6\u5e93'], candidates: ['implementation', 'be-validator', 'dev-planner'], phases: [['implementation'], ['be-validator', 'dev-planner']], contract: 'model and tool contract', preconditions: ['模型/工具选型契约须先产出冻结，implementation 后行', '每子任务产物须含资产消费锚点 + ≥1 内核词（D-1 机验）'] },
  { id: 'T4_FRONTEND', label: 'frontend', keywords: ['frontend', 'page', 'web', 'responsive', 'component', 'landing', 'ui', 'ux', '\u524d\u7aef', '\u9875\u9762'], candidates: ['frontend-design', 'planning', 'review', 'security'], phases: [['frontend-design'], ['planning'], ['review', 'security']], contract: 'frontend interaction contract', preconditions: ['后端接口契约先冻结（FR-3：contractMode:\'frozen\'，缺契约 CONTRACT_NOT_FROZEN skip）', 'Gate A 用户 APPROVED + PARITY_CHECK 冻结 token 先于组件实现', '每子任务产物须含资产消费锚点 + ≥1 内核词（D-1 机验）'] },
  { id: 'T5_OPS', label: 'ops', keywords: ['ops', 'deploy', 'monitor', 'log', 'ci', 'docker', '\u8fd0\u7ef4'], candidates: ['security', 'skill-sentinel', 'be-validator', 'review'], phases: [['security', 'skill-sentinel'], ['be-validator', 'review']], contract: 'operations contract', preconditions: ['加固/扫描产物（security/skill-sentinel）须先于验收子任务（be-validator/review）', '每子任务产物须含资产消费锚点 + ≥1 内核词（D-1 机验）'] },
]; 
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRIORITY = ['T2_BACKEND', 'T4_FRONTEND', 'T1_DATABASE', 'T3_AI_RAG_MCP', 'T5_OPS'];
export function getCluster(id) { return CLUSTERS.find(function(cluster) { return cluster.id === id; }); }

// C-26：kickoff 五簇清单的唯一事实源就是 CLUSTERS，下面 renderKickoffClusters() 从数据生成，
// 消灭 templates/kickoff-prompt.md 的手抄第二事实源（漂移由 scripts/kickoff-drift-check.mjs 机验）。
const VENDOR_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'vendor');
/** 簇 id → kickoff 段展示名（仅展示用，资产数据仍取自 CLUSTERS）。 */
const CLUSTER_DISPLAY = { T1_DATABASE: '数据库', T2_BACKEND: '后端', T3_AI_RAG_MCP: 'AI-RAG-MCP', T4_FRONTEND: '前端', T5_OPS: '运维' };
/** 资产文件名按 vendor 实际布局探测（<name>/<name>.md 优先，退 <name>/SKILL.md），不做手抄映射。 */
function assetRef(name) {
  for (const file of [name + '.md', 'SKILL.md']) {
    if (fs.existsSync(path.join(VENDOR_DIR, name, file))) return '$SKILL_DIR/vendor/' + name + '/' + file;
  }
  return '$SKILL_DIR/vendor/' + name + '/SKILL.md';
}
/** 生成与 templates/kickoff-prompt.md「## 各簇 candidates + preconditions」段同构的清单（纯数据驱动）。 */
export function renderKickoffClusters() {
  return CLUSTERS.map(function (cluster) {
    const title = '### ' + cluster.id.split('_')[0] + ' ' + (CLUSTER_DISPLAY[cluster.id] || cluster.label);
    const candidates = 'candidates：' + cluster.candidates.map(assetRef).join('、');
    const preconditions = 'preconditions：\n' + cluster.preconditions.map(function (p, i) { return (i + 1) + '. ' + p; }).join('\n');
    return title + '\n' + candidates + '\n' + preconditions;
  }).join('\n\n');
}
