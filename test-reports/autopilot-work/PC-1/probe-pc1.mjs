#!/usr/bin/env node
/**
 * PC-1 自测探针（一次性夹具，不入库 scripts/；证据落 test-reports/autopilot-work/PC-1/）。
 * 覆盖派单 6 项：六段结构 / 降级兼容（字节级）/ 确定性 hash / S8 兼容（锚点+内核词同款提取
 * 逻辑实测命中）/ 截断护栏（4KB+[truncated]）/ governanceSection 插槽共存（GV-2 兼容位）。
 * 运行：node test-reports/autopilot-work/PC-1/probe-pc1.mjs（本文件自相对定位，零 cwd 依赖）。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const OUT = HERE;
const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok, detail });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + id + ' ' + name + (detail ? ' — ' + detail : ''));
}
function sha256(text) { return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex'); }
/** S8/prompt.mjs 同款提取逻辑（逐字同构，唯一事实源 scripts/lib/adapters/prompt.mjs:110-122 + lib/activation.mjs extractAnchorAndKernel）。 */
function extractAnchorAndKernel(body) {
  const anchor = (body.match(/^#{1,6}\s+(.+)$/m) || [])[1]
    ? body.match(/^#{1,6}\s+(.+)$/m)[1].trim()
    : '(none)';
  const hasKernelSection = Boolean(body && /^#{1,6}\s+Execution kernel/im.test(body));
  const VIRTUAL = /^(via|the|and|for|of|to|in|is|or|not|with|as|at|by|hub|uses|layer)$/i;
  const kernelLine = ((body.match(/## Execution kernel[\s\S]*?Kernel:\s*([^\n]+)/) || [])[1] || '');
  const kernelTokens = [...new Set((kernelLine.match(/`([A-Za-z][A-Za-z0-9._/-]{2,})`|([A-Za-z][A-Za-z0-9._/-]{2,})/g) || [])
    .map((t) => t.replace(/`/g, '').toLowerCase())
    .filter((t) => t.length >= 3 && !VIRTUAL.test(t)))];
  return { anchor, hasKernelSection, kernelTokens };
}

const { composeBrief, loadCapabilityRows, composePlanAssets, truncateSection, MAX_SECTION_BYTES, DEFAULT_MANIFEST_V2_PATH } = await import('file:///' + path.join(ROOT, 'scripts', 'lib', 'prompt-composer.mjs').replace(/\\/g, '/'));
const { loadAssets } = await import('file:///' + path.join(ROOT, 'scripts', 'lib', 'asset.mjs').replace(/\\/g, '/'));

// ---------------------------------------------------------------------------
// 1. 六段结构探针（be-validator capability 样例）
// ---------------------------------------------------------------------------
const rows = loadCapabilityRows();
check('T1-pre', 'manifest 行加载', rows.ok && rows.rows.size === 9, 'rows=' + (rows.rows ? rows.rows.size : 0) + ' source=' + path.relative(ROOT, rows.source).replace(/\\/g, '/'));
const beRow = rows.rows.get('be-validator');
check('T1-pre2', 'be-validator 行三字段齐', Boolean(beRow && beRow.role && beRow.capability && Array.isArray(beRow.when_to_use) && Array.isArray(beRow.when_not_to_use) && beRow.verification), 'role=' + beRow.role.slice(0, 40) + '…');

const sample = loadCapabilityRows();
const beBody = fs.readFileSync(path.join(ROOT, 'vendor', 'be-validator', 'be-validator.md'), 'utf8').replace(/^---\n[\s\S]*?\n---\n?/, '');
const composed = composeBrief({
  body: beBody,
  task: '为登录接口做后端契约验收（Zod schema + OpenAPI + RFC 9457）',
  capability: sample.rows.get('be-validator'),
  project_context: ['workspace: D:/demo（示例）', 'upstream: artifacts/plan-x-0/result.txt'],
  constraints: { lines: ['artifact-dir: artifacts/plan-x-2/'], verifyCommand: 'spectral lint contracts/demo.json --ruleset vendor/be-validator/rulesets/spectral-oas.yaml --format json', expectedExit: 0, ac: 'spectral lint 无 error 级违规' },
});
const sectionsPresent = ['Role', 'Mission', 'Context', 'Output Contract', 'Constraints', 'Verification'].filter((s) => composed.sections && composed.sections[s]);
check('T1a', '六段齐', composed.mode === 'composer' && sectionsPresent.length === 6, 'mode=' + composed.mode + ' sections=' + sectionsPresent.join(','));

const c = composed.sections.Constraints, v = composed.sections.Verification;
const wntuHit = sample.rows.get('be-validator').when_not_to_use.every((w) => c.includes(w));
check('T1b', 'when_not_to_use 进 Constraints', wntuHit, 'when_not_to_use 全文逐字进 Constraints 段=' + wntuHit);
check('T1c', 'verification 进 Verification 段', v.includes(sample.rows.get('be-validator').verification.slice(0, 60)), 'manifest.verification 前缀命中 Verification 段');
check('T1d', 'verify_command（TK-1 executor_acceptance 口径）进 Verification 段', v.includes('"verify_command":"spectral lint') && v.includes('"expected_exit":0') && v.includes('"ac":"spectral lint 无 error 级违规"'), 'JSON 形态 {"ac","verify_command","expected_exit"} 逐字命中');
check('T1e', '全局红线三项进 Constraints', c.includes('禁造接口') && c.includes('路径可移植') && c.includes('诚实降级'), '派单三项逐字口径');
check('T1f', 'Role 段含 manifest role/name/capability', composed.sections.Role.includes('- role: You design and implement Zod schemas') && composed.sections.Role.includes('- asset: be-validator'), 'capability 命名');

fs.writeFileSync(path.join(OUT, 'probe-structure-sample.md'),
  '---\n# PC-1 六段结构样例（composer 模式，be-validator）\n---\n\n' + composed.body + '\n');

// ---------------------------------------------------------------------------
// 2. 降级探针（无 manifest 行 → legacy，字节级兼容）
// ---------------------------------------------------------------------------
const legacy = composeBrief({ body: beBody, task: 'x', capability: null, project_context: ['a'], constraints: {} });
check('T2a', '无 manifest 行 → legacy 原样', legacy.mode === 'legacy' && legacy.body === beBody, 'mode=' + legacy.mode + ' 字节级相等=' + (legacy.body === beBody) + ' sections=' + (legacy.sections === null));
const legacyNoInput = composeBrief({ body: beBody });
check('T2b', '空输入（无 capability/task/…）不崩溃 → legacy', legacyNoInput.mode === 'legacy' && legacyNoInput.body === beBody, '零崩溃');
const broken = loadCapabilityRows({ manifestPath: path.join(os.tmpdir(), 'pc1-nonexistent-manifest.json') });
check('T2c', 'manifest 产物不可读 → fail-soft 报告', broken.ok === false && broken.rows === null && /不可读/.test(broken.error), 'error=' + broken.error.slice(0, 60) + '…');
// 字节级比对：legacy mode 与「直接透传」产物一致
const legacyBytes = Buffer.from(legacy.body, 'utf8');
const legacyByteEqual = legacyBytes.equals(Buffer.from(beBody, 'utf8'));
fs.writeFileSync(path.join(OUT, 'probe-legacy-bytes.txt'), 'legacy.bytes=' + legacyBytes.length + '\nvendorBody.bytes=' + Buffer.from(beBody, 'utf8').length + '\nbyteEqual=' + legacyByteEqual + '\n');
check('T2d', 'legacy 字节级兼容比对', legacyByteEqual, '见 probe-legacy-bytes.txt');

// ---------------------------------------------------------------------------
// 3. 确定性：同输入两次构建 hash 一致（并含时间戳/无序输入无关性）
// ---------------------------------------------------------------------------
const again = composeBrief({ body: beBody, task: '为登录接口做后端契约验收（Zod schema + OpenAPI + RFC 9457）', capability: sample.rows.get('be-validator'), project_context: ['workspace: D:/demo（示例）', 'upstream: artifacts/plan-x-0/result.txt'], constraints: { lines: ['artifact-dir: artifacts/plan-x-2/'], verifyCommand: 'spectral lint contracts/demo.json --ruleset vendor/be-validator/rulesets/spectral-oas.yaml --format json', expectedExit: 0, ac: 'spectral lint 无 error 级违规' } });
check('T3a', '同输入两次构建 hash 一致', composed.sha256 === again.sha256, 'sha256=' + composed.sha256.slice(0, 16) + '…');
const permuted = composeBrief({ capability: sample.rows.get('be-validator'), constraints: { lines: ['artifact-dir: artifacts/plan-x-2/'], verifyCommand: 'spectral lint contracts/demo.json --ruleset vendor/be-validator/rulesets/spectral-oas.yaml --format json', expectedExit: 0, ac: 'spectral lint 无 error 级违规' }, project_context: ['workspace: D:/demo（示例）', 'upstream: artifacts/plan-x-0/result.txt'], task: '为登录接口做后端契约验收（Zod schema + OpenAPI + RFC 9457）', body: beBody });
check('T3b', '输入键序无关性（同语义同 hash）', permuted.sha256 === composed.sha256, '键序重排 hash 不变');
fs.writeFileSync(path.join(OUT, 'probe-determinism.txt'), 'composer.sha256=' + composed.sha256 + '\nagain.sha256=' + again.sha256 + '\npermuted.sha256=' + permuted.sha256 + '\nlegacy.sha256=' + legacy.sha256 + '\n（legacy sha256 = 纯正文 hash，作降级基线）\n');

// ---------------------------------------------------------------------------
// 4. S8 兼容：composer 产物过锚点 + 内核词机验（S8 同款提取逻辑实测命中）
// ---------------------------------------------------------------------------
const ext = extractAnchorAndKernel(composed.body);
const vendorExt = extractAnchorAndKernel(beBody);
const anchorPreserved = ext.anchor === vendorExt.anchor;
const kernelPreserved = ext.hasKernelSection === vendorExt.hasKernelSection && JSON.stringify(ext.kernelTokens) === JSON.stringify(vendorExt.kernelTokens);
// S8 正向：宿主回写 锚点+内核词 → consumed 判定与 vendor 一致
const posProduct = '# ' + ext.anchor + '\n\n' + ext.kernelTokens.join(' ');
const posConsumed = ext.kernelTokens.length ? (posProduct.toLowerCase().includes(ext.anchor.toLowerCase()) && ext.kernelTokens.some((k) => posProduct.toLowerCase().includes(k))) : posProduct.toLowerCase().includes(ext.anchor.toLowerCase());
// S8 负向：仅回写锚点（无内核词）→ kernel 资产须 consumed=false
const negProduct = '# ' + ext.anchor;
const negConsumed = ext.kernelTokens.length ? (negProduct.toLowerCase().includes(ext.anchor.toLowerCase()) && ext.kernelTokens.some((k) => negProduct.toLowerCase().includes(k))) : negProduct.toLowerCase().includes(ext.anchor.toLowerCase());
check('T4a', '锚点保持（composer 产物首标题 = vendor 正文首标题）', anchorPreserved, 'composer 锚点="' + ext.anchor + '" vendor 锚点="' + vendorExt.anchor + '"');
check('T4b', '内核词保持（hasKernelSection + tokens 逐项一致）', kernelPreserved, 'hasKernelSection=' + ext.hasKernelSection + ' tokens=[' + ext.kernelTokens.join(',') + ']');
check('T4c', 'S8 正向判定（锚点 AND 内核词 → consumed）', posConsumed === true, '产物首两行="# ' + ext.anchor + '\\n' + ext.kernelTokens.join(' ') + '"');
check('T4d', 'S8 负向判定（仅锚点 → 不 consumed）', negConsumed === false, 'kernel 资产仅锚点 → assetConsumed=false（防门禁退化，D-1）');
// S8 E2E：真实 orchestrator --backend prompt 链（含 composer 接线）下宿主同款提取回写 → exec 全 true / false(正)=0
const s8ws = fs.mkdtempSync(path.join(os.tmpdir(), 'pc1-s8-'));
const { spawnSync } = await import('node:child_process');
function runNode(args, env) {
  return spawnSync(process.execPath, ['scripts/orchestrator.mjs'].concat(args), { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, env || {}) });
}
const s8extract = "const fs=require('fs'),p=require('path');const b=fs.readFileSync(process.argv[1],'utf8');const a=(b.match(/## \\u65b9\\u6cd5\\u8bba\\u6b63\\u6587[\\s\\S]*?\\n(#+\\s+[^\\n]+)/)||[])[1]||'x';const k=(b.match(/Kernel:\\s*([A-Za-z0-9][^\\n\\uFF08(]+)/)||[])[1]||'';fs.writeFileSync(p.join(p.dirname(process.argv[1]),'plan.md'),'# '+a+(k?'\\n\\n'+k:''))";
const s8r = runNode(['--backend', 'prompt', '--task', 'backend login module', '--workspace', s8ws, '--exec', process.execPath, '-e', s8extract]);
const s8state = s8r.status === 0 ? JSON.parse(fs.readFileSync(path.join(s8ws, '.tt-state', 'state.json'), 'utf8')) : null;
const s8subs = s8state ? s8state.subtasks : [];
const s8execCount = s8state && s8state.modes ? (s8state.modes.exec || 0) : 0;
const s8notConsumed = s8subs.filter((s) => s.assetConsumed === false && s.adapter === 'prompt').length;
const s8promptN = s8subs.filter((s) => s.adapter === 'prompt').length;
// composer 产物确实进入 brief（抽 be-validator 的 brief 含 '# Role' 段）
let s8briefComposed = false;
try {
  const bv = s8subs.find((s) => s.asset === 'be-validator');
  const briefText = fs.readFileSync(path.join(s8ws, 'artifacts', bv.id, 'brief.md'), 'utf8');
  s8briefComposed = briefText.includes('# Role') && briefText.includes('# Verification') && briefText.includes('be-validator');
  fs.writeFileSync(path.join(OUT, 'probe-s8-e2e-brief-excerpt.md'), briefText.slice(0, 4000));
} catch (e) { /* 无 be-validator 子任务 */ }
check('T4e', 'S8 E2E 正向：composer 接线后 exec>0 且 false(正)=0', s8r.status === 0 && s8execCount > 0 && s8notConsumed === 0, 'exec=' + s8execCount + ' prompt 子任务=' + s8promptN + ' false(正)=' + s8notConsumed);
check('T4f', 'S8 E2E：brief.md 确为 composer 六段产物', s8briefComposed, 'be-validator brief 含 # Role/# Verification 段');
// S8 E2E 负向：仅回写锚点 → 全部 kernel 资产 consumed=false（负探针在 composer 产物上仍生效）
const s8nextract = "const fs=require('fs'),p=require('path');const b=fs.readFileSync(process.argv[1],'utf8');const a=(b.match(/## \\u65b9\\u6cd5\\u8bba\\u6b63\\u6587[\\s\\S]*?\\n(#+\\s+[^\\n]+)/)||[])[1]||'x';fs.writeFileSync(p.join(p.dirname(process.argv[1]),'plan.md'),'# '+a)";
const s8n = runNode(['--backend', 'prompt', '--task', 'backend login module', '--workspace', s8ws, '--exec', process.execPath, '-e', s8nextract]);
const s8nState = s8n.status === 0 ? JSON.parse(fs.readFileSync(path.join(s8ws, '.tt-state', 'state.json'), 'utf8')) : null;
const s8nFalse = s8nState ? s8nState.subtasks.filter((s) => s.assetConsumed === false).length : -1;
check('T4g', 'S8 E2E 负向：composer 产物仅锚点 → false>0（门禁未退化）', s8n.status === 0 && s8nFalse > 0, 'false(负)=' + s8nFalse);
fs.rmSync(s8ws, { recursive: true, force: true });

// ---------------------------------------------------------------------------
// 5. 截断护栏：6KB 段 → 4096B+[truncated]
// ---------------------------------------------------------------------------
const big = 'x'.repeat(6 * 1024);
const bigPrefix = '# Verification\n- payload: ';
const bigSec = truncateSection(bigPrefix + big, 'Verification');
const bigBytes = Buffer.byteLength(bigSec.text.split('\n\n[truncated]')[0], 'utf8');
const bigOriginal = Buffer.byteLength(bigPrefix + big, 'utf8');
check('T5a', '6KB 段截断为 4096B 前缀', bigBytes === MAX_SECTION_BYTES && bigSec.truncated === true && bigSec.originalBytes === bigOriginal, 'prefixBytes=' + bigBytes + ' (期望 4096) originalBytes=' + bigSec.originalBytes + '（期望 ' + bigOriginal + '）');
check('T5b', '截断标注 [truncated] 具名', bigSec.text.includes('[truncated] 本段（Verification）超 4KB 注入上限') && bigSec.text.includes('contracts/asset-manifest-v2.json'), '标注含段名与全文指引');
check('T5c', 'UTF-8 安全（无残字符 \uFFFD）', !bigSec.text.includes('\uFFFD'), 'CJK 边界字符清除');
// CJK 边界：4096 落点多字节字符中间
const cjkText = '界'.repeat(2500); // 7500B
const cjkSec = truncateSection(cjkText, 'Context');
const cjkClean = !cjkSec.text.includes('\uFFFD') && Buffer.from(cjkSec.text.split('\n\n[truncated]')[0], 'utf8').length <= MAX_SECTION_BYTES;
check('T5d', 'CJK 多字节边界截断安全', cjkSec.truncated === true && cjkClean, '7500B CJK → ≤4096B 且无残字符');
// 小段不截断
const small = truncateSection('# Role\n- asset: x', 'Role');
check('T5e', '段内 ≤4KB 不截断', small.truncated === false && small.text === '# Role\n- asset: x', '原样返回');
// GW-1 语义对齐：治理正文截断上限仍 5KB（不混用）
const gov = await import('file:///' + path.join(ROOT, 'scripts', 'lib', 'governance.mjs').replace(/\\/g, '/'));
check('T5f', 'GW-1 截断语义不受影响（治理仍 5KB）', gov.MAX_GOVERNANCE_BODY_BYTES === 5 * 1024 && MAX_SECTION_BYTES === 4 * 1024, 'composer 段 4KB / 治理正文 5KB 独立护栏');

// ---------------------------------------------------------------------------
// 6. governanceSection 插槽（GV-2 兼容位）+ 治理共存
// ---------------------------------------------------------------------------
const govSection = [
  '--- governance: test-driven-development ---',
  '',
  '（治理正文占位——插槽语义：预渲染节原样嵌入六段之后）',
].join('\n');
const withGov = composeBrief({ body: beBody, task: 't', capability: sample.rows.get('be-validator'), project_context: [], constraints: {}, governanceSection: govSection });
check('T6a', 'governanceSection 插槽嵌入（六段之后）', withGov.mode === 'composer' && withGov.body.indexOf('--- governance: test-driven-development ---') > withGov.body.indexOf('# Verification'), '治理节位于 Verification 段之后');
check('T6b', '无 governanceSection → 不渲染该节', composed.body.includes('--- governance:') === false, '插槽缺省零行为');
// composePlanAssets：治理包装后（governPlanAssets 产物 Map）再组合 → 两节共存。
// 用 implementation 资产（implementation 绑定 stage_7，冻结集内两键命中 → 注入 TDD）；
// be-validator 绑定 verification（stage_7 下两键不命中零注入——F-030 冻结绑定语义）。
const implRow = sample.rows.get('implementation');
const implBody = fs.readFileSync(path.join(ROOT, 'vendor', 'implementation', 'implementation.md'), 'utf8').replace(/^---\n[\s\S]*?\n---\n?/, '');
const govPlan = await import('file:///' + path.join(ROOT, 'scripts', 'lib', 'governance.mjs').replace(/\\/g, '/'));
const assetsMap = new Map([['be-validator', { name: 'be-validator', type: 'agent', meta: { path: 'vendor/be-validator' }, body: beBody }], ['implementation', { name: 'implementation', type: 'agent', meta: { path: 'vendor/implementation' }, body: implBody }]]);
const governed = govPlan.governPlanAssets(assetsMap, [{ asset: 'implementation' }], { event: 'stage_7' });
const governedHasGov = governed.get('implementation').body.includes('--- governance:');
const planComposed = composePlanAssets(governed, [{ asset: 'implementation', id: 'p-1', task: 't' }, { asset: 'be-validator', id: 'p-2', task: 't' }], { capabilityRows: sample.rows, plan: { cluster: 'T2_BACKEND' } });
const composedBody = planComposed.get('implementation').body;
const idxVendorTail = composedBody.indexOf('--- governance:'); // 治理节（正文尾部追加）
const idxRole = composedBody.indexOf('# Role');
const beComposedToo = planComposed.get('be-validator').body.includes('# Verification');
check('T6c', '治理节与六段共存（governPlanAssets 后接 composer）', governedHasGov && idxVendorTail > 0 && idxRole > idxVendorTail && beComposedToo, 'implementation: 正文+TDD 治理节（前缀）→ # Role…六段（后缀）共存；be-validator 六段独立');
// composePlanAssets 零行为面：行缺失资产原样
const planUnk = composePlanAssets(assetsMap, [{ asset: 'no-such-asset', id: 'p-2', task: 't' }], { capabilityRows: sample.rows, plan: {} });
check('T6d', '行缺失资产原样返回（Map 同一实例）', planUnk === assetsMap, '零组合 → 原样返回');
const planKill = composePlanAssets(assetsMap, [{ asset: 'be-validator', id: 'p-3', task: 't' }], { capabilityRows: sample.rows, plan: {}, env: { YY_PROMPT_COMPOSER: 'off' } });
check('T6e', 'kill-switch YY_PROMPT_COMPOSER=off → 原样', planKill === assetsMap, '逃生舱零行为面');
const planLib = composePlanAssets(assetsMap, [{ asset: 'be-validator', id: 'p-4', task: 't' }], { capabilityRows: sample.rows, plan: {}, env: { YY_ACTIVATION: 'lib' } });
check('T6f', 'YY_ACTIVATION=lib 帧路径跳过（T4 谓词 (b) 护栏）', planLib === assetsMap, '与 governPlanAssets 同护栏');

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------
const fails = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, 'probe-results.txt'), results.map((r) => (r.ok ? 'PASS' : 'FAIL') + ' ' + r.id + ' ' + r.name + (r.detail ? ' — ' + r.detail : '')).join('\n') + '\n\nTOTAL=' + results.length + ' PASS=' + (results.length - fails.length) + ' FAIL=' + fails.length + '\n');
console.log('\nTOTAL=' + results.length + ' PASS=' + (results.length - fails.length) + ' FAIL=' + fails.length);
process.exitCode = fails.length ? 1 : 0;
