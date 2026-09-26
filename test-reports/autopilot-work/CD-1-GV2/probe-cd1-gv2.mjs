#!/usr/bin/env node
/**
 * CD-1+GV-2 自测探针（一次性夹具，不入库 scripts/；证据落 test-reports/autopilot-work/CD-1-GV2/）。
 * F-036 纪律：判定一律调生产函数（activation.resolveAssetEligibility / runtime.dispatch /
 * adapters/index.resolveAdapter / governance.* / prompt-composer.*）——无自造 oracle；
 * 唯一例外 T5b 字节级基线 = composeBrief 手工重放（kill-switch 比对定义本身如此，重放输入
 * 与生产接线同源：governPlanAssets ×2 → composeBrief 六段）。
 * 运行：node test-reports/autopilot-work/CD-1-GV2/probe-cd1-gv2.mjs（自相对定位，零 cwd 依赖）。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const OUT = HERE;
const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: ok === true, detail });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + id + ' ' + name + (detail ? ' — ' + detail : ''));
}
function bytes(p) { return fs.readFileSync(p); }
function imp(rel) { return import('file:///' + path.join(ROOT, rel).replace(/\\/g, '/')); }

const manifestRows = JSON.parse(bytes(path.join(ROOT, 'contracts', 'asset-manifest-v2.json')).toString('utf8'));
const manifestSha = crypto.createHash('sha256').update(bytes(path.join(ROOT, 'contracts', 'asset-manifest-v2.json'))).digest('hex');
const activation = await imp('scripts/lib/activation.mjs');
const runtime = await imp('scripts/lib/runtime.mjs');
const adapters = await imp('scripts/lib/adapters/index.mjs');
const governance = await imp('scripts/lib/governance.mjs');
const composer = await imp('scripts/lib/prompt-composer.mjs');

// ---------------------------------------------------------------------------
// CD-1 探针 1：capability 命中（{capability:'openapi-validation'} → be-validator，adapter 可达）
// （subtask.eligibility 为 dispatch 的审计载体——dispatch 返回值不含 subtask 对象，读 sub 本体）
// ---------------------------------------------------------------------------
const cd1p1 = { id: 'cd1-p1', asset: 'legacy-hint', capability: 'openapi-validation', attempts: 0 };
const r1 = await runtime.dispatch(cd1p1, runtime.createContextBus(), { backend: 'auto' });
const r1e = cd1p1.eligibility || {};
check('CD1-1a', 'capability 命中：selected_asset=be-validator', r1.skipped !== true && r1.error === null && r1e.selected_asset === 'be-validator',
  'eligibility=' + JSON.stringify({ capability: r1e.capability, selected_asset: r1e.selected_asset }));
check('CD1-1b', '选择过程留痕（capability/selected_asset/eligible/reason[] 进 subtask.eligibility）',
  r1e.capability === 'openapi-validation' && r1e.eligible === true
  && Array.isArray(r1e.reason) && r1e.reason[0].includes('capability match'),
  'reason[0]=' + (r1e.reason[0] || '').slice(0, 60) + '…');
const ad1 = adapters.resolveAdapter('be-validator', 'auto');
check('CD1-1c', 'be-validator adapter 可达（portman/Spectral 执行内核注册表在册）', Boolean(ad1) && ad1.name === 'be-validator', 'adapter.name=' + (ad1 && ad1.name));
const ad2 = adapters.resolveAdapter('security', 'auto');
check('CD1-1d', 'security adapter 可达（semgrep 执行内核注册表在册）', Boolean(ad2) && ad2.name === 'security', 'adapter.name=' + (ad2 && ad2.name));

// ---------------------------------------------------------------------------
// CD-1 探针 2：多候选决策留痕（同一 manifest capability 文本的两资产 + 同 id 多映射场景）
// ---------------------------------------------------------------------------
// 场景 A：同 when_to_use 文本两行（构造夹具 manifest）——capability 模式逐行判定全量留痕
const dupRows = JSON.parse(JSON.stringify(manifestRows));
dupRows.push(Object.assign({}, dupRows.find((r) => r.id === 'be-validator'), { id: 'be-validator-mirror', name: 'be-validator-mirror' }));
const multi = await activation.resolveAssetEligibility({ capability: 'openapi-validation', requirements: ['openapi'] }, { manifestRows: dupRows });
check('CD1-2a', '多候选夹具：capability→id 受控映射决策可审计', multi.selected_asset === 'be-validator' && multi.eligible === true && multi.reason.some((x) => x.includes('capability match')),
  'selected=' + multi.selected_asset + ' reason[]=' + multi.reason.length + ' 条（capability match + 资格判定链）');
// 场景 B：运行时 dispatch 全链多候选留痕（资格门复用审计链不重解析）
const wsMulti = fs.mkdtempSync(path.join(os.tmpdir(), 'cd1-multi-'));
const cd1p2 = { id: 'cd1-p2', capability: 'openapi-validation', attempts: 0 };
await runtime.dispatch(cd1p2, runtime.createContextBus(), { backend: 'prompt', workspace: wsMulti });
const multiE2e = cd1p2.eligibility || {};
check('CD1-2b', '运行时多候选：dispatch 全链 reason 链留痕（≥2 条：capability match + 资格判定）',
  Array.isArray(multiE2e.reason) && multiE2e.reason.length >= 2 && multiE2e.reason[0].includes('capability match'),
  'reason 条数=' + multiE2e.reason.length);
// 场景 C：CAPABILITY_MAP 值 ⊆ manifest id（映射完备性——探针断言，resolver 自身不猜）
const capMap = activation.CAPABILITY_MAP;
const mappedIds = [...new Set(Object.values(capMap))];
const unknownIds = mappedIds.filter((id) => !manifestRows.some((r) => r.id === id));
check('CD1-2c', 'CAPABILITY_MAP 值全部 ∈ manifest id（受控映射完备性）', unknownIds.length === 0,
  'map 键数=' + Object.keys(capMap).length + ' 值=' + mappedIds.join(',') + (unknownIds.length ? ' 越界=' + unknownIds.join(',') : ''));

// ---------------------------------------------------------------------------
// CD-1 探针 3：未知 capability 拒绝（INELIGIBLE_CAPABILITY_UNKNOWN 具名 fail-closed）
// ---------------------------------------------------------------------------
const wsUnk = fs.mkdtempSync(path.join(os.tmpdir(), 'cd1-unk-'));
const cd1p3 = { id: 'cd1-p3', asset: 'whatever', capability: 'no-such-capability', attempts: 0 };
const r3 = await runtime.dispatch(cd1p3, runtime.createContextBus(), { backend: 'prompt', workspace: wsUnk });
const r3e = cd1p3.eligibility || {};
check('CD1-3a', '未知 capability → INELIGIBLE_CAPABILITY_UNKNOWN 具名', r3.skipped === true && r3.error === 'INELIGIBLE_CAPABILITY_UNKNOWN',
  'error=' + r3.error + ' eligibility.selected_asset=' + r3e.selected_asset);
check('CD1-3b', 'fail-closed 不猜（selected_asset=null + reason 具名 + adapter 未触达）',
  r3e.selected_asset === null && Array.isArray(r3e.reason) && r3e.reason[0].includes('INELIGIBLE_CAPABILITY_UNKNOWN') && r3e.reason[0].includes('不猜'),
  'reason[0]=' + (r3e.reason[0] || '').slice(0, 70) + '…');
// 大小写归一命中（受控映射键匹配不区分大小写——映射请求词表的唯一宽容度）
const r3b = await activation.resolveAssetEligibility({ capability: 'OpenAPI-Validation' }, { manifestRows });
check('CD1-3c', '映射键大小写不敏感（OpenAPI-Validation → be-validator）', r3b.selected_asset === 'be-validator' && r3b.eligible === true, 'selected=' + r3b.selected_asset);

// ---------------------------------------------------------------------------
// CD-1 探针 4：asset name 向后兼容（name-based 主键零改动）
// ---------------------------------------------------------------------------
const cd1p4 = { id: 'cd1-p4', asset: 'be-validator', attempts: 0 };
const r4 = await runtime.dispatch(cd1p4, runtime.createContextBus(), { backend: 'prompt' });
const r4e = cd1p4.eligibility || {};
check('CD1-4a', 'name-based 派单零改动（be-validator 资格门通过 + prompt adapter 真实产出 brief）',
  r4.ok === true && r4.skipped !== true && r4.error == null && String(r4.artifactPath).endsWith('cd1-p4' + path.sep + 'brief.md') && r4e.eligible === true && !('capability' in r4e) && cd1p4.status === 'done',
  'status=' + cd1p4.status + ' artifact=' + r4.artifactPath + ' error=' + JSON.stringify(r4.error) + ' eligibility.capability 字段缺席=' + !('capability' in r4e));
const r4b = await activation.resolveAssetEligibility({ asset: 'be-validator' }, { manifestRows });
check('CD1-4b', 'resolver name-based 输出形态不变（无 capability 模式 reason 注水）', r4b.selected_asset === 'be-validator' && r4b.eligible === true && !r4b.reason.some((x) => x.includes('capability match')),
  'reason=' + JSON.stringify(r4b.reason));
const r4c = await runtime.dispatch({ id: 'cd1-p4c', asset: 'nonexistent-asset-xyz', attempts: 0 }, runtime.createContextBus(), { backend: 'prompt' });
check('CD1-4c', 'name-based 未知资产照旧 fail-closed（INELIGIBLE_ASSET_NOT_FOUND）', r4c.skipped === true && r4c.error === 'INELIGIBLE_ASSET_NOT_FOUND', 'error=' + r4c.error);

// ---------------------------------------------------------------------------
// GV-2 探针 5：composer 管道治理节在场（六段 + governance 插槽）+ debugging 摘要注入
// ---------------------------------------------------------------------------
const rows = composer.loadCapabilityRows();
const implBody = bytes(path.join(ROOT, 'vendor', 'implementation', 'implementation.md')).toString('utf8');
const mapImpl = new Map([['implementation', { name: 'implementation', type: 'agent', meta: { path: 'vendor/implementation' }, body: implBody }]]);
// 5a. 失败记忆构造（运行时记录侧真实路径）→ 管道单点插槽注入摘要
const wsMemo = fs.mkdtempSync(path.join(os.tmpdir(), 'gv2-memo-'));
fs.mkdirSync(path.join(wsMemo, '.tt-state'), { recursive: true });
fs.writeFileSync(path.join(wsMemo, '.tt-state', 'debugging-memory.json'), JSON.stringify({ failures: [
  { code: 'INELIGIBLE_CAPABILITY_UNKNOWN', event: 'gate_failed', at: '2026-09-26T10:05:00Z' },
  { code: 'INELIGIBLE_CAPABILITY_UNKNOWN', event: 'gate_failed', at: '2026-09-26T10:06:00Z' },
] }, null, 2));
const outMemo = composer.composeGovernedPlanAssets(mapImpl, [{ asset: 'implementation', id: 'gv2-1', task: '修复资格门失败' }], { capabilityRows: rows.rows, plan: {}, workspace: wsMemo, briefEvent: 'none-such-event' });
const memoBody = outMemo.get('implementation').body;
const slotIdx = memoBody.lastIndexOf('--- governance: systematic-debugging（failure memory） ---');
check('GV2-5a', 'debugging 摘要经插槽注入（失败记忆命中 → brief 治理节）', slotIdx > 0 && memoBody.includes('INELIGIBLE_CAPABILITY_UNKNOWN ×2') && memoBody.includes('governance-skills/systematic-debugging/SKILL.md'),
  'slot 位置（lastIndex）=' + slotIdx + '；摘要含失败码计数 + 指路行');
check('GV2-5b', '摘要节位于六段之后（插槽=六段尾部，非正文尾巴拼接）', slotIdx > memoBody.indexOf('# Verification'),
  'slotIdx=' + slotIdx + ' > #Verification idx=' + memoBody.indexOf('# Verification'));
check('GV2-5c', '摘要 ≤2KB（GV-2 上限）', slotIdx > 0 && Buffer.byteLength(memoBody.slice(slotIdx), 'utf8') <= governance.MAX_DEBUGGING_MEMORY_BYTES,
  '摘要节字节数=' + Buffer.byteLength(memoBody.slice(slotIdx), 'utf8') + ' ≤ ' + governance.MAX_DEBUGGING_MEMORY_BYTES);
// 5b. 无记忆 → brief 事件治理节兜底（stage_7 命中 implementation→TDD）
const outTdd = composer.composeGovernedPlanAssets(mapImpl, [{ asset: 'implementation', id: 'gv2-2', task: 't' }], { capabilityRows: rows.rows, plan: {}, workspace: path.join(os.tmpdir(), 'gv2-empty-' + Date.now()) });
const tddBody = outTdd.get('implementation').body;
const tddIdx = tddBody.indexOf('--- governance: test-driven-development ---');
check('GV2-5d', '无记忆 → brief 事件治理节兜底（stage_7 → TDD，六段+治理共存）', tddIdx > tddBody.indexOf('# Verification'), '插槽治理节 idx=' + tddIdx + ' > #Verification idx=' + tddBody.indexOf('# Verification'));
// 5c. E2E：构造失败后重派场景（记录侧=生产 dispatch 调用；消费侧=真实 orchestrator 全链）
function runOrch(args, env) {
  return spawnSync(process.execPath, ['scripts/orchestrator.mjs'].concat(args), { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, env || {}) });
}
const wsE2E = fs.mkdtempSync(path.join(os.tmpdir(), 'gv2-e2e-'));
// 第一次：未知 capability 派单失败（生产 dispatch → 记录侧写记忆；INELIGIBLE_CAPABILITY_UNKNOWN
// 映射 gate_failed，GV-2 摘要消费的失败族）。orchestrator 生产链尚无 capability 字段入口（planner
// 边界外），记录侧按 CD-1 dispatch 生产函数调用——非自造 oracle（F-036：判定调生产函数）。
await runtime.dispatch({ id: 'gv2-e2e-fail-1', asset: 'legacy-hint', capability: 'no-such-capability', attempts: 0 }, runtime.createContextBus(), { backend: 'prompt', workspace: wsE2E });
const memAfterRun1 = JSON.parse(bytes(path.join(wsE2E, '.tt-state', 'debugging-memory.json')).toString('utf8'));
check('GV2-5e', 'E2E 记录侧：生产 dispatch 失败写记忆（.tt-state/debugging-memory.json）', memAfterRun1.failures.length > 0 && memAfterRun1.failures[0].code === 'INELIGIBLE_CAPABILITY_UNKNOWN' && memAfterRun1.failures[0].event === 'gate_failed',
  '记忆条数=' + memAfterRun1.failures.length + ' 首条=' + JSON.stringify(memAfterRun1.failures[0]));
// 第二次：同 workspace 真实 orchestrator 重派（失败记忆在场 → 新 brief 注入 debugging 摘要）
const e2 = runOrch(['--backend', 'prompt', '--task', 'backend login module retry', '--workspace', wsE2E]);
const state2 = e2.status === 0 ? JSON.parse(bytes(path.join(wsE2E, '.tt-state', 'state.json')).toString('utf8')) : { subtasks: [] };
let memoInBrief = false, memoBriefAsset = null, slotAfterVerify = false;
for (const s of state2.subtasks) {
  const briefFile = path.join(wsE2E, 'artifacts', s.id, 'brief.md');
  if (!fs.existsSync(briefFile)) continue;
  const briefText = bytes(briefFile).toString('utf8');
  if (briefText.includes('--- governance: systematic-debugging（failure memory） ---')) {
    memoInBrief = true; memoBriefAsset = s.asset;
    slotAfterVerify = briefText.lastIndexOf('--- governance: systematic-debugging（failure memory） ---') > briefText.indexOf('# Verification');
    break;
  }
}
check('GV2-5f', 'E2E 消费侧：重派 brief 注入 debugging 摘要（运行时记忆式消费）', memoInBrief && slotAfterVerify,
  '命中资产=' + memoBriefAsset + '（E2E 两轮：run1 失败写记忆 → run2 重派 brief 带摘要节）');

// ---------------------------------------------------------------------------
// GV-2 探针 6：截断策略（总长超限 → 治理节优先保完整、正文段截断、策略登记）
// ---------------------------------------------------------------------------
const tinyBody = 'x'.repeat(120);
const bigPayload = 'p'.repeat(5 * 1024);
const sec = composer.composeBrief({
  body: tinyBody,
  task: bigPayload,
  capability: { role: 'r', capability: 'c', when_to_use: ['w'.repeat(3000)], verification: 'v' },
  project_context: ['c'.repeat(3500)],
  constraints: { lines: ['o'.repeat(3500)] },
  governanceSection: 'G'.repeat(6 * 1024), // 6KB 治理节（保完整承诺）
});
const secGovIdx = sec.body.indexOf('G'.repeat(6 * 1024));
check('GV2-6a', '截断策略登记（truncateStrategy=governance-first-truncated-sections）', sec.truncateStrategy === composer.GOVERNANCE_FIRST_STRATEGY,
  'strategy=' + sec.truncateStrategy + ' truncated=[' + sec.truncated.join(',') + ']');
check('GV2-6b', '治理节字节级完整（超限时优先保完整，零截断）', secGovIdx >= 0, '6KB 治理节在产物中完整在场');
const totalCompiled = sec.body.slice(tinyBody.trimEnd().length + 2);
check('GV2-6c', '合成总长回落预算（六段+治理 ≤ 12KB + 标注容差）', Buffer.byteLength(totalCompiled, 'utf8') <= composer.MAX_COMPOSED_TOTAL_BYTES + 2048,
  'compiled=' + Buffer.byteLength(totalCompiled, 'utf8') + 'B ≤ ' + (composer.MAX_COMPOSED_TOTAL_BYTES + 2048) + 'B（标注计入容差）');
check('GV2-6d', '被压正文段具名 [truncated]（可审计）', sec.truncated.length > 0 && /\[truncated\] 本段（.+）超 1024B/.test(sec.body), 'truncated=[' + sec.truncated.join(',') + ']');
// 无治理节 → 零行为（PC-1 形态不变）
const noGov = composer.composeBrief({ body: tinyBody, task: bigPayload, capability: { role: 'r', capability: 'c', when_to_use: ['w'], verification: 'v' }, project_context: [], constraints: {} });
check('GV2-6e', '无治理节 → 无策略登记（PC-1 逐段 4KB 护栏不变）', noGov.truncateStrategy === undefined, 'strategy 字段缺席');

// ---------------------------------------------------------------------------
// GV-2 探针 7：kill-switch YY_PROMPT_COMPOSER=off 字节级回落旧拼接
// ---------------------------------------------------------------------------
// 生产链两轮同 workspace：composer on（新形态）vs off（旧形态）——brief 字节级比对。
// 同一确定性夹具：同 task 两次运行，plan id/时间戳随机 → 只比对资产正文段（方法论正文头到
// 帧尾 '---\n执行要求' 之间），该段由 assets body 决定（确定性，零时间戳）。
function extractBodySection(briefText) {
  const h = briefText.indexOf('## 方法论正文（资产全文）');
  const lineEnd = briefText.indexOf('\n', h);
  const tail = briefText.slice(lineEnd + 1);
  const sepIdx = tail.indexOf('\n---\n执行要求：');
  return (sepIdx >= 0 ? tail.slice(0, sepIdx) : tail).replace(/^\n+/, '').replace(/\n+$/, '');
}
const wsOn = fs.mkdtempSync(path.join(os.tmpdir(), 'gv2-ks-on-'));
const runOn = runOrch(['--backend', 'prompt', '--task', 'backend login module', '--workspace', wsOn]);
const wsOff = fs.mkdtempSync(path.join(os.tmpdir(), 'gv2-ks-off-'));
const runOff = runOrch(['--backend', 'prompt', '--task', 'backend login module', '--workspace', wsOff], { YY_PROMPT_COMPOSER: 'off' });
const stateOn = runOn.status === 0 ? JSON.parse(bytes(path.join(wsOn, '.tt-state', 'state.json')).toString('utf8')) : { subtasks: [] };
const stateOff = runOff.status === 0 ? JSON.parse(bytes(path.join(wsOff, '.tt-state', 'state.json')).toString('utf8')) : { subtasks: [] };
let byteCompare = null;
for (const sOn of stateOn.subtasks) {
  const sOff = stateOff.subtasks.find((s) => s.asset === sOn.asset && s.status !== 'skipped');
  const fOn = path.join(wsOn, 'artifacts', sOn.id, 'brief.md');
  const fOff = sOff ? path.join(wsOff, 'artifacts', sOff.id, 'brief.md') : null;
  if (!fs.existsSync(fOn) || !fOff || !fs.existsSync(fOff)) continue;
  const bodyOn = extractBodySection(bytes(fOn).toString('utf8'));
  const bodyOff = extractBodySection(bytes(fOff).toString('utf8'));
  byteCompare = { asset: sOn.asset, onBytes: Buffer.byteLength(bodyOn), offBytes: Buffer.byteLength(bodyOff), equal: bodyOn === bodyOff };
  break;
}
check('GV2-7a', 'kill-switch 两轮生产运行均成功且产物可比（比对前置条件）', runOn.status === 0 && runOff.status === 0 && Boolean(byteCompare) && byteCompare.onBytes > byteCompare.offBytes,
  'runOn.exit=' + runOn.status + ' runOff.exit=' + runOff.status + ' onBytes=' + (byteCompare && byteCompare.onBytes) + ' offBytes=' + (byteCompare && byteCompare.offBytes) + '（on=off+六段 → on>off）');
// 7b 核心断言：off 形态正文段 == vendor 正文 + 治理尾节（旧拼接）；on 形态 == 同前缀 + 六段 + 插槽节
// → off 段必须是 on 段的前缀（on = off + 六段+插槽），且 off 含旧拼接治理节。
const sOn2 = stateOn.subtasks.find((s) => s.asset === 'implementation' && s.status !== 'skipped');
const sOff2 = stateOff.subtasks.find((s) => s.asset === 'implementation' && s.status !== 'skipped');
if (sOn2 && sOff2) {
  const bodyOn = extractBodySection(bytes(path.join(wsOn, 'artifacts', sOn2.id, 'brief.md')).toString('utf8'));
  const bodyOff = extractBodySection(bytes(path.join(wsOff, 'artifacts', sOff2.id, 'brief.md')).toString('utf8'));
  const offIsPrefix = bodyOn.startsWith(bodyOff);
  const offHasLegacyGov = bodyOff.includes('--- governance: test-driven-development ---') && !bodyOff.includes('# Role');
  const onHasComposed = bodyOn.includes('# Role') && bodyOn.includes('# Verification') && bodyOn.includes('--- governance: test-driven-development ---');
  check('GV2-7b', 'on/off 字节级：on 正文段 = off 旧拼接段 + 六段（off 是 on 的前缀）', offIsPrefix,
    'off=' + Buffer.byteLength(bodyOff) + 'B on=' + Buffer.byteLength(bodyOn) + 'B 前缀成立=' + offIsPrefix);
  check('GV2-7c', 'off=旧拼接形态（治理尾节在正文内、无六段）；on=composer 形态（六段+插槽治理）',
    offHasLegacyGov && onHasComposed, 'off 六段缺席=' + !bodyOff.includes('# Role') + ' on 六段在场=' + onHasComposed);
  fs.writeFileSync(path.join(OUT, 'kill-switch-bytes.txt'),
    'asset=' + sOn2.asset + '\noff.bytes=' + Buffer.byteLength(bodyOff) + '\non.bytes=' + Buffer.byteLength(bodyOn) + '\noffIsPrefixOfOn=' + offIsPrefix + '\nsha256(off)=' + crypto.createHash('sha256').update(bodyOff).digest('hex') + '\nsha256(on)=' + crypto.createHash('sha256').update(bodyOn).digest('hex') + '\n');
} else {
  check('GV2-7b', 'kill-switch 字节级比对（implementation 子任务）', false, '未找到 implementation 非 skip 子任务');
}
// 7d：纯函数级基线比对——composeBrief 输出 = 手工重放（vendor 正文 + '\n\n' + 六段+治理节编译块）
const beBody = bytes(path.join(ROOT, 'vendor', 'be-validator', 'be-validator.md')).toString('utf8');
const beComposed = composer.composeBrief({ body: beBody, task: 't', capability: rows.rows.get('be-validator'), project_context: ['cluster: T2_BACKEND'], constraints: { lines: ['artifact-dir: artifacts/x/'] }, governanceSection: '--- governance: X ---\n\nbody' });
const manual = beBody.trimEnd() + '\n\n' + ['# Role', '# Mission', '# Context', '# Output Contract', '# Constraints', '# Verification'].map((h) => beComposed.sections[h.replace('# ', '')]).join('\n\n') + '\n\n' + '--- governance: X ---\n\nbody';
check('GV2-7d', '纯函数基线：composeBrief 产物 = vendor 前缀 + 六段 + 治理节（字节级）', beComposed.body === manual,
  '字节级相等=' + (beComposed.body === manual) + '（比对文件 kill-switch-bytes.txt）');

// ---------------------------------------------------------------------------
// 探针 8：回归护栏（EX-1/AV-3/S16 共存 + governance-skills 缺失静默跳过）
// ---------------------------------------------------------------------------
const r8 = await runtime.dispatch({ id: 'cd1-r1', asset: 'be-validator', attempts: 0 }, runtime.createContextBus(), { backend: 'auto', executorDefaults: { capabilities: { write_files: false, run_cmd: false } } });
check('G-8a', 'EX-1 能力门控共存：缺能力照旧 CAPABILITY_MISSING（capability 输入升级未触碰门序）',
  r8.skipped === true && r8.error === 'CAPABILITY_MISSING', 'error=' + r8.error);
const noGovDir = governance.debuggingMemorySection('gate_failed', { memory: [{ code: 'X', event: 'gate_failed', at: 't' }], governanceDir: path.join(os.tmpdir(), 'gv2-no-govdir-' + Date.now()) });
check('G-8b', 'governance-skills 缺失 → 摘要节静默跳过（null，零崩溃）', noGovDir === null, '返回=' + noGovDir);
const s16 = spawnSync(process.execPath, ['-e', "import('file:///' + process.argv[1].replace(/\\\\/g,'/')).then(m=>{try{m.transitionPhase({status:'failed'},'done');console.log('REJECTED=0')}catch(e){console.log('REJECTED=1')}})"].concat([path.join(ROOT, 'scripts', 'lib', 'runtime.mjs')]), { encoding: 'utf8' });
check('G-8c', 'S16 transitionPhase 探针仍真实拒绝 failed→done（迁移门共存）', /REJECTED=1/.test(s16.stdout), 'stdout=' + s16.stdout.trim().slice(0, 40));

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------
const fails = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, 'probe-results.txt'), results.map((r) => (r.ok ? 'PASS' : 'FAIL') + ' ' + r.id + ' ' + r.name + (r.detail ? ' — ' + r.detail : '')).join('\n') + '\n\nTOTAL=' + results.length + ' PASS=' + (results.length - fails.length) + ' FAIL=' + fails.length + '\nmanifest_sha256=' + manifestSha + '\n');
console.log('\nTOTAL=' + results.length + ' PASS=' + (results.length - fails.length) + ' FAIL=' + fails.length);
process.exitCode = fails.length ? 1 : 0;
