/**
 * w2-2-probe.mjs — W2-2 状态/证据传播探针（零凭据/零网络；只写本目录 tmp/ 与结果文件）
 *
 * 契约依据：plans/W2-0-ground-truth-ingress-contract-20260927.md §D.3/D.4/D.7
 * 派单：handoffs/v3/W2-2-dispatch.md（自测 1-4）
 * 基线：baseline-runtime.snapshot.mjs = 改造前 runtime.mjs 逐字快照（唯一差异=import 行改绝对 file:// URL）
 *
 * P0 前置：真实 manifest 资格预检（capability 解析链可用性）
 * P1 自测1：capability 子任务 state.json 三字段在场（capability/capabilitySource/selectedAsset）+ eligibility 留痕
 * P2 自测2：resume 老 state（无字段）不崩溃；新旧 runtime resume 输出字节级全等
 * P4 自测4：无 capability 任务 state 零字段变化（新旧 runtime 字节级比对 + 全文 0 处 capability 字样）
 * P3 自测3：journey 投影三字段在场（capability 行 + legacy 行，null 也显式写）
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

// 探针环境声明：fake adapter 零产物落盘 → contract gate（gate.after）按官方 warn 档运行（不阻断）。
// 仅影响产物存在性校验的阻断行为；被测面（capability 透传/provenance 投影/字节级兼容）不受影响。
process.env.TT_GATE_MODE = 'warn';

const REPO = 'file:///D:/.ai-hub/skills/yy';
const DIR = 'D:/.ai-hub/skills/yy/test-reports/autopilot-work/W2-2';
const TMP = path.join(DIR, 'tmp');
const MANIFEST = 'D:/.ai-hub/skills/yy/contracts/asset-manifest-v2.json';

const { buildPlan } = await import(REPO + '/scripts/lib/planner.mjs');
const { CATALOG_IDS, resolveAssetEligibility } = await import(REPO + '/scripts/lib/activation.mjs');
const { deriveCapability } = await import(REPO + '/scripts/lib/capability-derivation.mjs');
const liveRuntime = await import(REPO + '/scripts/lib/runtime.mjs');
const baseRuntime = await import('file:///D:/.ai-hub/skills/yy/test-reports/autopilot-work/W2-2/baseline-runtime.snapshot.mjs');
const { journeyRead } = await import(REPO + '/scripts/lib/journey.mjs');
const { default: createStore } = await import(REPO + '/scripts/lib/store.mjs');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const synthManifest = () => ({ manifestSource: 'synthetic:CATALOG_IDS', entries: CATALOG_IDS.map((name) => ({ name })) });
const fakeAdapter = () => ({ name: 'fake-probe', run: async () => ({ ok: true, executed: true, artifactPath: null, assetConsumed: true }) });
const dispatchOpts = () => ({
  manifestPath: MANIFEST,
  resolveAdapter: () => fakeAdapter(), // B5 DI：不碰真实 vendor adapter，执行语义由替身固定
  maxRetries: 1,
  verbose: false,
});
const results = [];
function check(id, desc, pass, detail) {
  results.push({ id, desc, pass: pass === true, detail: detail ?? null });
  console.log((pass === true ? 'PASS' : 'FAIL') + ' ' + id + ': ' + desc + (detail ? ' | ' + JSON.stringify(detail) : ''));
  return pass === true;
}
const clone = (o) => structuredClone(o);
async function saveState(ws, plan) { const store = createStore(ws); await store.save(plan); return path.join(ws, '.tt-state', 'state.json'); }

// ── P0 前置：真实 manifest 上 capability 资格预检 ──
console.log('== P0 capability eligibility pre-check against real manifest ==');
const pre = await resolveAssetEligibility({ capability: 'security-audit' }, { manifestPath: MANIFEST });
check('P0', 'security-audit → resolver eligible（真实 manifest）', pre.eligible === true && pre.selected_asset === 'security', { selected_asset: pre.selected_asset, eligible: pre.eligible, reasonN: (pre.reason || []).length });

// ── P1 自测1：capability 子任务 state.json 三字段在场 ──
console.log('== P1 capability subtask state provenance ==');
const capTask = '对登录接口做安全审计';
const derived = deriveCapability(capTask);
check('P1a', '派生命中 security-audit（W2-1 生产者）', !!derived && derived.key === 'security-audit', derived);
const capPlan = buildPlan(capTask, synthManifest());
check('P1b', 'plan 期 subtask 仅两字段（capability/capabilitySource），无 selectedAsset（selectedAsset 由 W2-2 runtime 落）',
  capPlan.subtasks.every((s) => s.capability === 'security-audit' && s.capabilitySource === 'derived' && !('selectedAsset' in s)),
  { subtaskN: capPlan.subtasks.length });
const wsCap = path.join(TMP, 'ws-cap');
await fs.rm(wsCap, { recursive: true, force: true });
const capResult = await liveRuntime.executePlan(capPlan, dispatchOpts());
await saveState(wsCap, capResult.plan);
const capStateText = await fs.readFile(path.join(wsCap, '.tt-state', 'state.json'), 'utf8');
const capState = JSON.parse(capStateText);
const capSubs = capState.subtasks || [];
check('P1c', 'state.json capability 子任务三字段在场且 selectedAsset===asset（D.3 双写一致性）',
  capSubs.length > 0 && capSubs.every((s) =>
    s.capability === 'security-audit' && s.capabilitySource === 'derived'
    && typeof s.selectedAsset === 'string' && s.selectedAsset === s.asset),
  { subtaskN: capSubs.length, sample: capSubs[0] && { id: capSubs[0].id, asset: capSubs[0].asset, capability: capSubs[0].capability, capabilitySource: capSubs[0].capabilitySource, selectedAsset: capSubs[0].selectedAsset } });
check('P1d', 'state.json eligibility 留痕（D.4 eligibilityReason 面：capability/selected_asset/eligible/reason[]）',
  capSubs.length > 0 && capSubs.every((s) => s.eligibility && s.eligibility.eligible === true && Array.isArray(s.eligibility.reason) && s.eligibility.reason.length > 0),
  { first: capSubs[0] && capSubs[0].eligibility && { capability: capSubs[0].eligibility.capability, selected_asset: capSubs[0].eligibility.selected_asset, eligible: capSubs[0].eligibility.eligible, reasonN: capSubs[0].eligibility.reason.length } });
check('P1e', 'CD-1 透传确认：planner 产 capability/capabilitySource 全链原样保留（对象引用透传零丢失）',
  capSubs.every((s) => s.capability === 'security-audit' && s.capabilitySource === 'derived'));

// ── P2 自测2：resume 老 state（无字段）不崩溃 + 新旧 runtime resume 字节级全等 ──
console.log('== P2 resume old state (no capability fields) ==');
const oldPlan0 = buildPlan('数据库 schema 迁移', synthManifest()); // route T1 + 派生 null（legacy 输入，W2-1 T4a 同款任务集）
check('P2a', '老 plan 构造：零 capability 字段', !(oldPlan0.subtasks[0] || {}).capability && !JSON.stringify(oldPlan0).includes('capability'), null);
const aged = clone(oldPlan0);
aged.subtasks[0].status = 'done'; // 模拟历史进度：resume 时 done 保留、其余重跑
const wsOldBase = path.join(TMP, 'ws-old-base');
const wsOldLive = path.join(TMP, 'ws-old-live');
await fs.rm(wsOldBase, { recursive: true, force: true });
await fs.rm(wsOldLive, { recursive: true, force: true });
await saveState(wsOldBase, clone(aged));
await saveState(wsOldLive, clone(aged));
// resume 链（复刻 orchestrator.resumePlan 最小面：store.load → 未 done 重跑；load 即 JSON 全量反序列化=缺字段容忍）
const prevBase = await createStore(wsOldBase).load();
const prevLive = await createStore(wsOldLive).load();
let crashBase = null; let crashLive = null; let resumedBase = null; let resumedLive = null;
try { prevBase.status = 'executing'; resumedBase = await baseRuntime.executePlan(prevBase, dispatchOpts()); } catch (e) { crashBase = e.message; }
try { prevLive.status = 'executing'; resumedLive = await liveRuntime.executePlan(prevLive, dispatchOpts()); } catch (e) { crashLive = e.message; }
check('P2b', 'resume 老 state 新旧 runtime 均不崩溃', crashBase === null && crashLive === null, { crashBase, crashLive });
check('P2c', 'resume 不补字段/不重派生（D.5 行8：老 state 走 legacy，capability/selectedAsset 不凭空出现）',
  !!resumedLive && !JSON.stringify(resumedLive.plan).includes('capability') && !JSON.stringify(resumedLive.plan).includes('selectedAsset'), null);
await saveState(wsOldBase, resumedBase.plan);
await saveState(wsOldLive, resumedLive.plan);
const oldBytesA = await fs.readFile(path.join(wsOldBase, '.tt-state', 'state.json'));
const oldBytesB = await fs.readFile(path.join(wsOldLive, '.tt-state', 'state.json'));
check('P2d', 'resume 输出 state.json 新旧 runtime 字节级全等', oldBytesA.equals(oldBytesB), { sha256_base: sha256(oldBytesA), sha256_live: sha256(oldBytesB), bytes: oldBytesB.length });

// ── P4 自测4：无 capability 任务 state 零字段变化（新旧 runtime 字节级）──
console.log('== P4 legacy task byte-level compat ==');
const LEGACY_TASKS = ['数据库 schema 迁移', '登录接口开发', '前端页面重构', '运维部署监控', '知识库模型接入']; // W2-1 T4a 同款 5 路由任务（route 全簇覆盖 × 派生全 null）
let p4AllEq = true; const p4Detail = [];
for (const task of LEGACY_TASKS) {
  const lp = buildPlan(task, synthManifest());
  if (JSON.stringify(lp).includes('capability')) { p4AllEq = false; p4Detail.push({ task, problem: 'plan 含 capability 字样' }); continue; }
  const wb = path.join(TMP, 'ws-legacy-base-' + lp.cluster);
  const wl = path.join(TMP, 'ws-legacy-live-' + lp.cluster);
  await fs.rm(wb, { recursive: true, force: true });
  await fs.rm(wl, { recursive: true, force: true });
  const rBase = await baseRuntime.executePlan(clone(lp), dispatchOpts());
  const rLive = await liveRuntime.executePlan(clone(lp), dispatchOpts());
  await saveState(wb, rBase.plan);
  await saveState(wl, rLive.plan);
  const bytesA = await fs.readFile(path.join(wb, '.tt-state', 'state.json'));
  const bytesB = await fs.readFile(path.join(wl, '.tt-state', 'state.json'));
  const eq = bytesA.equals(bytesB) && !bytesB.toString('utf8').includes('capability') && !bytesB.toString('utf8').includes('selectedAsset');
  if (!eq) p4AllEq = false;
  p4Detail.push({ task, cluster: lp.cluster, bytes: bytesB.length, sha256_live: sha256(bytesB), byteEqual: bytesA.equals(bytesB) });
}
check('P4a', '5 个无 capability 路由任务（T1-T5 全簇）state.json 新旧 runtime 字节级全等（向后兼容）', p4AllEq, p4Detail);
check('P4b', 'legacy state 全文 0 处 capability/selectedAsset 字样（零字段变化）', p4Detail.length === LEGACY_TASKS.length && p4AllEq, null);
const legacyStateText = await fs.readFile(path.join(TMP, 'ws-legacy-live-T1_DATABASE', '.tt-state', 'state.json'), 'utf8');

// ── P3 自测3：journey 投影三字段在场（capability 行 + legacy 行，null 也显式写）──
console.log('== P3 journey projection three fields ==');
const legacyState = JSON.parse(legacyStateText);
const jr = journeyRead({ workspace: TMP, state: [capState, legacyState], mode: 'full' });
check('P3a', 'journeyRead 投影成功（双 state 行内联，无 ERROR 冲突）', jr.ok === true, { code: jr.code, displayStatus: jr.data && jr.data.journey && jr.data.journey.displayStatus });
const jrows = (jr.data && jr.data.journey && jr.data.journey.subtasks) || [];
const capRows = jrows.filter((r) => capSubs.some((s) => s.id === r.subtaskId));
const legRows = jrows.filter((r) => (legacyState.subtasks || []).some((s) => s.id === r.subtaskId));
check('P3b', 'journey capability 行三字段在场（值与 state 一致）',
  capRows.length === capSubs.length && capRows.every((r) => r.capability === 'security-audit' && r.capabilitySource === 'derived' && r.selectedAsset === r.asset),
  { capRowN: capRows.length, sample: capRows[0] && { subtaskId: capRows[0].subtaskId, capability: capRows[0].capability, capabilitySource: capRows[0].capabilitySource, selectedAsset: capRows[0].selectedAsset } });
check('P3c', 'journey legacy 行三字段显式在场（capability=null, capabilitySource=null, selectedAsset 回落=asset；D.7 null 也写）',
  legRows.length === (legacyState.subtasks || []).length && legRows.every((r) => r.capability === null && r.capabilitySource === null && r.selectedAsset === r.asset),
  { legRowN: legRows.length, sample: legRows[0] && { subtaskId: legRows[0].subtaskId, capability: legRows[0].capability, capabilitySource: legRows[0].capabilitySource, selectedAsset: legRows[0].selectedAsset, asset: legRows[0].asset } });

// ── 汇总 ──
const failed = results.filter((r) => !r.pass);
console.log('== SUMMARY: ' + (results.length - failed.length) + ' PASS / ' + failed.length + ' FAIL ==');
await fs.writeFile(path.join(DIR, 'probe-results.json'), JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
if (failed.length) process.exit(1);
