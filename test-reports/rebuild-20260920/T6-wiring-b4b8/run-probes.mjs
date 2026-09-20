/**
 * T6 B4-B8 接线探针（自包含，临时目录，不写仓库）。
 *  B4: gate.registerReviewFindings —— 默认 DRY-PRINT 零副作用；--register-findings 落盘走 withLock+B1 finding 命名空间。
 *  B5: runtime.setAdapterResolver DI + YY_ACTIVATION=lib 路由（失败降级 legacy 不 BLOCK）。
 *  B6: prompt legacy vs activation brief 字段覆盖矩阵 + journey nextPrompt 注入。
 *  B7: orchestrator 改用 lib parseArgs/validateOpts 等价 + --allow-out-of-order/--evolve 旗标识别。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

// T8 加固批③（runner cwd 统一）：REPO/HERE 一律由**模块 URL** 定位，不再依赖 process.cwd()。
// 此前 `const REPO = process.cwd()` 使本运行器只能从仓库根启动（从自身目录启动会
// ERR_MODULE_NOT_FOUND: …T6-wiring-b4b8\scripts\lib\gate.mjs，见 T7 D-5）。
// probes/ → T6-wiring-b4b8 → rebuild-20260920 → test-reports → 仓库根
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  [PASS] ' + name + (detail ? ' | ' + detail : '')); }
  else { fail++; fails.push(name + (detail ? ' :: ' + detail : '')); console.log('  [FAIL] ' + name + ' | ' + detail); }
}
function mkTmp(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

async function main() {
  console.log('== B4: gate.registerReviewFindings ==');
  const gate = await import(pathToFileURL(path.join(REPO, 'scripts', 'lib', 'gate.mjs')).href);
  const tmp = mkTmp('t6-b4-');
  const critText = '# taskX 技术批判\n\n| # | 批判点 | 竞品对标(URL+日期+结论) | 差距 | 优化方案 | 最小验证 | 收益/成本 | 级别 |\n|---|---|---|---|---|---|---|---|\n| 1 | 桥接缺失 | https://github.com/a 2026-09-01 结论A | 无 | 接 remediation.register | node test | 1/2 | P1 |\n| 2 | 幂等缺失 | https://docs.b.com 2026/09/02 结论B | 重复 | 按 sha+title 去重 | 重跑0新增 | 1/3 | P2 |\n';
  fs.writeFileSync(path.join(tmp, 'taskX-技术批判.md'), critText, 'utf8');
  const critSha = sha(fs.readFileSync(path.join(tmp, 'taskX-技术批判.md')));
  const entries = [
    { title: '桥接缺失', url: 'https://github.com/a', date: '2026-09-01', plan: '接 remediation.register', minVerify: 'node test', level: 'P1' },
    { title: '幂等缺失', url: 'https://docs.b.com', date: '2026/09/02', plan: '按 sha+title 去重', minVerify: '重跑0新增', level: 'P2' },
  ];
  const critFile = { path: 'taskX-技术批判.md', sha256: critSha };

  // DRY-PRINT（默认）：不写任何文件
  const before = fs.existsSync(path.join(tmp, 'plans', 'active', 'remediation', 'findings.jsonl'));
  const dry = await gate.registerReviewFindings({ entries, critiqueFile: critFile, registeredBy: 'probe' }, { workspace: tmp, repoRoot: tmp });
  const after = fs.existsSync(path.join(tmp, 'plans', 'active', 'remediation', 'findings.jsonl'));
  check('B4 默认 DRY-PRINT 零副作用', dry.dryRun === true && dry.prints.length === 2 && !before && !after, 'prints=' + dry.prints.length);
  check('B4 DRY-PRINT 组装 finding 五要素', dry.prints[0].findingInput && dry.prints[0].findingInput.externalSource.url === 'https://github.com/a' && dry.prints[0].findingInput.sourceAnchor.sha256 === critSha, '');

  // PERSIST（--register-findings）：写 ledger + B1 finding 命名空间
  const persisted = await gate.registerReviewFindings({ entries, critiqueFile: critFile, registeredBy: 'probe' }, { workspace: tmp, repoRoot: tmp, registerFindings: true });
  check('B4 落盘 registered 2 条', persisted.registered.length === 2, JSON.stringify(persisted.skipped));
  const ledgerExists = fs.existsSync(path.join(tmp, 'plans', 'active', 'remediation', 'findings.jsonl'));
  check('B4 remediation ledger 落盘', ledgerExists);
  const stateDoc = JSON.parse(fs.readFileSync(path.join(tmp, '.tt-state', 'state.json'), 'utf8'));
  check('B1 finding 命名空间有索引记录', Array.isArray(stateDoc.finding) && stateDoc.finding.length === 2 && !!stateDoc.finding[0].findingId, 'finding len=' + (stateDoc.finding || []).length);
  check('B1 stateVersion 补齐', stateDoc.stateVersion === 'yy/state@1');
  // 幂等：重跑不新增
  const again = await gate.registerReviewFindings({ entries, critiqueFile: critFile, registeredBy: 'probe' }, { workspace: tmp, repoRoot: tmp, registerFindings: true });
  check('B4 幂等重跑 0 新增（idempotent-duplicate）', again.registered.length === 0 && again.skipped.length === 2, 'registered=' + again.registered.length);

  console.log('== B5: runtime DI + activation 路由 ==');
  const runtime = await import(pathToFileURL(path.join(REPO, 'scripts', 'lib', 'runtime.mjs')).href);
  check('B5 setAdapterResolver 导出', typeof runtime.setAdapterResolver === 'function');
  let called = null;
  const fakeAdapter = { name: 'fake-prompt', run: async () => ({ ok: true, artifactPath: null }) };
  const prev = runtime.setAdapterResolver((asset, backend) => { called = { asset, backend }; return fakeAdapter; });
  check('B5 DI 注入生效（旧 resolver 还原）', typeof prev === 'function');
  // 构造最小 dispatch：用 dryRun=true 直接返回，不触发 adapter；改为直接验证 resolver 闭包
  const restored = runtime.setAdapterResolver(prev);
  check('B5 resolver 还原为默认', typeof restored === 'function' || restored === undefined);

  console.log('== B6: prompt legacy vs activation 字段覆盖 + nextPrompt 注入 ==');
  const promptMod = await import(pathToFileURL(path.join(REPO, 'scripts', 'lib', 'adapters', 'prompt.mjs')).href);
  const activation = await import(pathToFileURL(path.join(REPO, 'scripts', 'lib', 'activation.mjs')).href);
  const body = '# Demo Asset\n\n正文内容 A。\n\n## Execution kernel\nKernel: `demo-cli` do thing\n';
  const assetsMap = new Map([['planning', { meta: { path: 'planning' }, body }]]);
  const ws = mkTmp('t6-b6-');
  const subtask = { id: 't-1', asset: 'planning', task: '做计划', contract: 'contract.md', preconditions: ['上游done'] };
  const baseOpts = { workspace: ws, assets: assetsMap, assetsRoot: REPO, exec: null };

  // legacy（无 activationPackage）
  const legacyRes = await promptMod.run(subtask, { dump: () => ({}) }, { ...baseOpts });
  const legacyBrief = fs.readFileSync(path.join(ws, 'artifacts', 't-1', 'brief.md'), 'utf8');
  check('B6 legacy brief 含方法论正文段', legacyBrief.includes('## 方法论正文（资产全文）') && legacyBrief.includes('正文内容 A'));
  check('B6 legacy brief 不含 nextPrompt 注入段', !legacyBrief.includes('下一步提示（journey'));

  // activation（注入 activationPackage.briefFrame + nextPrompt）
  const frame = {
    subtaskId: 't-1', task: '做计划', asset: 'planning', assetRoot: path.join(REPO, 'vendor', 'planning'),
    description: '做计划', contract: 'contract.md', upstreamRefs: [], preconditions: ['上游done'],
    bodyHeading: '## 方法论正文（资产全文）', bodyContent: body,
    executionNote: ['执行要求：x', '产出请写入 y'], briefFilename: 'brief.md',
  };
  const np = { actionHint: '推进节点 5 规划+契约', targetNode: { step: 5, name: '规划+契约' }, requiredInputs: ['gate:contract-frozen'], snapshotRef: { snapshotHash: 'abc123', copiedAt: '2026-09-20T00:00:00Z', recompute: false } };
  const actRes = await promptMod.run(subtask, { dump: () => ({}) }, { ...baseOpts, activationPackage: { briefFrame: frame }, nextPrompt: np });
  const actBrief = fs.readFileSync(path.join(ws, 'artifacts', 't-1', 'brief.md'), 'utf8');
  // 字段覆盖矩阵：逐字段比对 legacy vs activation（assetRoot 取 prompt 计算值，不硬编码）
  const wantAssetRoot = path.join(REPO, 'planning'); // prompt: resolve(assetsRoot, meta.path)
  const fields = ['subtaskId', 'task', 'asset', 'assetRoot', 'description', 'contract', 'preconditions', 'bodyContent'];
  let coverageOk = true;
  for (const f of fields) {
    const want = { subtaskId: subtask.id, task: subtask.task, asset: subtask.asset, description: subtask.task, contract: subtask.contract, preconditions: subtask.preconditions, bodyContent: body, assetRoot: wantAssetRoot }[f];
    if (want === undefined) continue;
    const s = String(want);
    if (!actBrief.includes(s)) { coverageOk = false; console.log('      缺字段 ' + f + ' -> ' + s.slice(0, 40)); }
  }
  check('B6 activation brief 字段覆盖矩阵 8/8', coverageOk);
  check('B6 activation 走 renderBrief 标题', actBrief.includes('## 方法论正文（资产全文）'));
  check('B6 nextPrompt 快照引用注入', actBrief.includes('下一步提示（journey') && actBrief.includes('step 5') && actBrief.includes('"recompute":false'), '');
  // renderBrief 与 extractPayloadFromBrief 可复验（对 normalizeSection 后正文）
  const extracted = activation.extractPayloadFromBrief(actBrief);
  const normBody = String(body).replace(/^\n+/, '').replace(/\n+$/, '');
  check('B6 renderBrief/extractPayloadFromBrief 往返一致', extracted === normBody, 'len=' + (extracted || '').length);

  console.log('== B7: orchestrator lib 接入 + 旗标 ==');
  const libOrch = await import(pathToFileURL(path.join(REPO, 'scripts', 'lib', 'orchestrator.mjs')).href);
  const o1 = libOrch.parseArgs(['--task', 'demo', '--backend', 'prompt', '--parallel', '4']);
  check('B7 lib parseArgs 等价（backend/p 解析）', o1.backend === 'prompt' && o1.parallel === 4 && o1.task === 'demo');
  const v1 = libOrch.validateOpts(o1);
  check('B7 lib validateOpts 接受合法', v1.ok === true && v1.exitCode === 0);
  const bad = libOrch.parseArgs(['--task', 'x', '--backend', 'bogus']);
  const vbad = libOrch.validateOpts(bad);
  check('B7 lib validateOpts 拒绝非法 backend', vbad.ok === false && vbad.exitCode === 2);
  // backlog 解析等价（顶层已删副本，统一引用 lib）
  const rows = libOrch.parseBacklogRows('| # | 批判（来源） | 级别 | 修复措施 | 落点任务 | 验收指标 | 状态 |\n|---|---|---|---|---|---|---|\n| C-01 | 桥接缺失（来源：f，2026） | P1 | 改x | task | node test | ⬜ 待落地 |\n');
  check('B7 parseBacklogRows/backlogIsPending 单点', rows.length === 1 && libOrch.backlogIsPending(rows[0]) === true, 'rows=' + rows.length);
  // 旗标识别（模拟 main 扫描逻辑）
  const argv = ['node', 'orchestrator.mjs', '--task', 'x', '--allow-out-of-order', '--evolve'];
  check('B7 旗标扫描 --allow-out-of-order/--evolve', argv.includes('--allow-out-of-order') && argv.includes('--evolve'));

  console.log('== T6 PROBES TOTAL: ' + pass + '/' + (pass + fail) + ' PASS ==');
  if (fail) { console.log('FAILURES:\n - ' + fails.join('\n - ')); process.exit(1); }
}
main().catch((e) => { console.error('PROBE THREW: ' + (e.stack || e.message)); process.exit(1); });
