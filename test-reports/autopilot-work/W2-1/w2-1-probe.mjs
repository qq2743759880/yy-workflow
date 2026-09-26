/**
 * W2-1 自测探针（自测 1/2/4/5 + 3 的 parseArgs/validateOpts 纯函数部分）。
 * 零凭据、零 SQL、零网络；只读仓库文件 + 内存断言。输出：w2-1-probe.log / probe-results.json。
 * Mimosa 约束：本文件不含凭据字面量、不含 SQL 拼接、不发起网络请求。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = 'file:///D:/.ai-hub/skills/yy';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const { buildPlan } = await import(ROOT + '/scripts/lib/planner.mjs');
const baseline = await import('file:///D:/.ai-hub/skills/yy/test-reports/autopilot-work/W2-1/baseline-planner.snapshot.mjs');
const { deriveCapability, DERIVATION_RULES, resolveCapabilityAsset, CapabilityIngressError } = await import(ROOT + '/scripts/lib/capability-derivation.mjs');
const { parseArgs, validateOpts, applyCapabilityToPlan } = await import(ROOT + '/scripts/lib/orchestrator.mjs');
const { CAPABILITY_MAP, CATALOG_IDS, derivationRulesConsistent } = await import(ROOT + '/scripts/lib/activation.mjs');
const { CLUSTERS } = await import(ROOT + '/scripts/lib/matrix.mjs');

// manifest：优先真实 loadManifest（只读），失败回落 CATALOG_IDS 合成（planner 只读 entries[].name）
let manifest = null;
let manifestSource = 'synthetic:CATALOG_IDS';
try {
  const { loadManifest } = await import(ROOT + '/scripts/lib/manifest.mjs');
  const loaded = await loadManifest();
  if (loaded && Array.isArray(loaded.entries) && loaded.entries.length) { manifest = loaded; manifestSource = 'loadManifest()'; }
} catch (e) { /* fall through */ }
if (!manifest) manifest = { entries: CATALOG_IDS.map((name) => ({ name })) };

const results = [];
function check(id, name, pass, detail) {
  results.push({ id, name, pass: pass === true, detail });
  console.log((pass === true ? 'PASS' : 'FAIL') + ' | ' + id + ' | ' + name + ' | ' + detail);
}

// ---------- 自测 1：派生探针（确定性 + 三例） ----------
const tSec = '对登录接口做安全审计';
const tApi = '对登录接口做 OpenAPI 校验';
const tNone = '写一份项目周报';

const dSec = deriveCapability(tSec);
const dApi = deriveCapability(tApi);
const dNone = deriveCapability(tNone);
check('T1a', '含「安全审计」→ security-audit', dSec && dSec.key === 'security-audit', JSON.stringify(dSec));
check('T1b', '含「OpenAPI 校验」→ openapi-validation', dApi && dApi.key === 'openapi-validation', JSON.stringify(dApi));
check('T1c', '无命中 → null', dNone === null, JSON.stringify(dNone));

const detRuns = new Set();
for (let i = 0; i < 5; i += 1) detRuns.add(JSON.stringify([deriveCapability(tSec), deriveCapability(tApi), deriveCapability('前端设计评审')]));
check('T1d', '确定性：同输入同 key（5 轮）', detRuns.size === 1, 'distinctOutputs=' + detRuns.size);

const planSec = buildPlan(tSec, manifest);
const planApi = buildPlan(tApi, manifest);
check('T1e', 'plan subtask 附加 capability/capabilitySource=derived', planSec.cluster === 'T2_BACKEND' && planSec.subtasks.length > 0 && planSec.subtasks[0].asset === 'implementation' && planSec.subtasks.every((s) => s.capability === 'security-audit' && s.capabilitySource === 'derived'),
  'cluster=' + planSec.cluster + ' subtasks=' + planSec.subtasks.map((s) => s.asset + ':' + s.capability + ':' + s.capabilitySource).join(','));
check('T1f', 'openapi-validation plan：be-validator 子任务带 derived 字段', planApi.subtasks.some((s) => s.asset === 'be-validator' && s.capability === 'openapi-validation' && s.capabilitySource === 'derived'),
  planApi.subtasks.map((s) => s.asset + ':' + (s.capability || '-')).join(','));

// ---------- 自测 2：cluster 交叉校验（CAPABILITY_CLUSTER_MISMATCH，fail-closed） ----------
let mismatchCode = null;
try { buildPlan('前端页面功能拆解', manifest); } catch (e) { mismatchCode = e instanceof CapabilityIngressError ? e.code : 'WRONG_ERROR:' + e.name; }
check('T2a', '派生 asset 不在同簇 → CAPABILITY_CLUSTER_MISMATCH（派生轴）', mismatchCode === 'CAPABILITY_CLUSTER_MISMATCH', 'route=T4_FRONTEND, derived=feature-breakdown→dev-planner∉T4, got=' + mismatchCode);

const planT1 = buildPlan('数据库 schema 迁移', manifest);
let explicitMismatch = null;
try { applyCapabilityToPlan(planT1, { capability: 'frontend-design' }); } catch (e) { explicitMismatch = e instanceof CapabilityIngressError ? e.code : 'WRONG_ERROR:' + e.name; }
check('T2b', '显式 capability 不在同簇 → CAPABILITY_CLUSTER_MISMATCH（显式/后处理轴）', explicitMismatch === 'CAPABILITY_CLUSTER_MISMATCH', 'route=T1_DATABASE, explicit=frontend-design→frontend-design∉T1, got=' + explicitMismatch);

let unknownCode = null;
try { buildPlan('对登录接口做安全审计', manifest, { capability: 'no-such-key' }); } catch (e) { unknownCode = e instanceof CapabilityIngressError ? e.code : 'WRONG_ERROR:' + e.name; }
check('T2c', 'buildPlan 显式未知键 → CAPABILITY_UNKNOWN（值域守卫 fail-closed）', unknownCode === 'CAPABILITY_UNKNOWN', 'got=' + unknownCode);

const planExplicit = buildPlan(tSec, manifest, { capability: 'security-audit' });
check('T2d', '显式命中同簇 → explicit 覆盖（precedence 1>2，不派生）', planExplicit.subtasks.every((s) => s.capability === 'security-audit' && s.capabilitySource === 'explicit'),
  planExplicit.subtasks.map((s) => s.asset + ':' + s.capabilitySource).join(','));
const planOvr = applyCapabilityToPlan(buildPlan(tSec, manifest), { capability: 'SECURITY-AUDIT' });
check('T2e', 'applyCapabilityToPlan：显式 override 派生（大小写不敏感）', planOvr.subtasks.every((s) => s.capability === 'security-audit' && s.capabilitySource === 'explicit'),
  planOvr.subtasks.map((s) => s.capabilitySource).join(','));
check('T2f', 'applyCapabilityToPlan：无显式 → plan 原样（派生字段保留）', applyCapabilityToPlan(buildPlan(tSec, manifest), {}).subtasks[0].capabilitySource === 'derived', 'legacy/derived untouched');

// ---------- 自测 3（纯函数部分）：CLI parseArgs + KNOWN + validateOpts ----------
const p1 = parseArgs(['--task', 'x', '--capability', 'security-audit']);
check('T3a', 'parseArgs 解析 --capability', p1.capability === 'security-audit' && p1.argError === null, 'capability=' + p1.capability);
const p2 = parseArgs(['--task', 'x', '--capability']);
check('T3b', '--capability 缺值 → argError', p2.argError !== null, p2.argError || '-');
const vBad = validateOpts(parseArgs(['--task', 'x', '--capability', 'unknown-key']));
check('T3c', '未知键 → CAPABILITY_UNKNOWN argError（exit 2）', vBad.ok === false && vBad.error.includes('CAPABILITY_UNKNOWN') && vBad.exitCode === 2, 'exitCode=' + vBad.exitCode);
const vOk = validateOpts(parseArgs(['--task', 'x', '--capability', 'security-audit']));
check('T3d', '合法键 → validateOpts ok', vOk.ok === true, '-');
const p3 = parseArgs(['--exec', 'node', 'host.mjs', '--capability', 'security-audit', '--task', 't']);
check('T3e', '--exec KNOWN 集合同步：--capability 不被吞入宿主命令', JSON.stringify(p3.exec) === JSON.stringify(['node', 'host.mjs']) && p3.capability === 'security-audit', 'exec=' + JSON.stringify(p3.exec) + ' capability=' + p3.capability);
const p4 = parseArgs(['--exec', 'node', 'host.mjs', '--port', '3000']);
check('T3f', '未知旗标仍收集进 exec（既有 --exec 行为零改动）', JSON.stringify(p4.exec) === JSON.stringify(['node', 'host.mjs', '--port', '3000']), 'exec=' + JSON.stringify(p4.exec));

// ---------- 自测 4：向后兼容（字节级 plan JSON 比对，无 capability 任务零字段） ----------
const compatTasks = ['数据库 schema 迁移', '登录接口开发', '前端页面重构', '运维部署监控', '知识库模型接入'];
function canonical(plan) {
  return JSON.stringify(plan, (key, value) => (key === 'createdAt' ? '<CREATED>' : value))
    .replace(/plan-[a-z0-9]+/g, 'plan-<ID>');
}
let compatOk = true; const compatDetail = [];
for (const task of compatTasks) {
  const a = canonical(baseline.buildPlan(task, manifest));
  const b = canonical(buildPlan(task, manifest));
  const noField = !b.includes('capability');
  if (a !== b || !noField) { compatOk = false; compatDetail.push(task + '(equal=' + (a === b) + ',capabilityAbsent=' + noField + ')'); }
}
check('T4a', '无 capability 任务：新旧 plan JSON 字节级一致且零 capability 字段（' + compatTasks.length + ' 例）', compatOk, compatDetail.join('; ') || 'all identical, no capability key anywhere');

// ---------- 自测 5：同源校验（DERIVATION_RULES 键 ⊆ CAPABILITY_MAP keys + asset ∈ 簇） ----------
const consistency = await derivationRulesConsistent();
check('T5a', 'derivationRulesConsistent()（activation 导出，探针实测）', consistency.consistent === true && consistency.violations.length === 0 && consistency.rulesCount === 10 && consistency.capabilityMapKeys === 10, JSON.stringify(consistency));
const ruleKeys = DERIVATION_RULES.map((r) => r.key);
const mapKeys = Object.keys(CAPABILITY_MAP);
const subsetOk = ruleKeys.every((k) => mapKeys.includes(k));
const assetInCluster = ruleKeys.every((k) => CLUSTERS.some((c) => c.candidates.includes(CAPABILITY_MAP[k])));
check('T5b', '规则键 ⊆ CAPABILITY_MAP keys（10/10，无第二 taxonomy）', subsetOk, 'ruleKeys=' + ruleKeys.length + ' mapKeys=' + mapKeys.length);
check('T5c', '每键映射 asset ∈ ∪CLUSTERS[].candidates（簇系统内，交叉校验静态前提）', assetInCluster, ruleKeys.map((k) => k + '→' + CAPABILITY_MAP[k]).join(','));
const valuesInCatalog = Object.values(CAPABILITY_MAP).every((v) => CATALOG_IDS.includes(v));
check('T5d', '既有探针保持：CAPABILITY_MAP values ⊆ CATALOG_IDS（9 资产）', valuesInCatalog, 'values=' + Object.values(CAPABILITY_MAP).join(','));
check('T5e', 'resolveCapabilityAsset 未知键 → null（D.2 单点 fail-closed）', resolveCapabilityAsset('nope') === null && resolveCapabilityAsset('security-audit') === 'security', '-');

// ---------- 汇总 ----------
const summary = { total: results.length, passed: results.filter((r) => r.pass).length, failed: results.filter((r) => !r.pass).length };
console.log('SUMMARY: ' + JSON.stringify(summary) + ' manifest=' + manifestSource);
fs.writeFileSync(path.join(HERE, 'probe-results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), manifestSource, summary, results }, null, 2) + '\n');
if (summary.failed > 0) process.exitCode = 1;
