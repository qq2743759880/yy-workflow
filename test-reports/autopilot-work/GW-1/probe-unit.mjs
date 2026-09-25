/**
 * GW-1 探针（单元面）：governance.mjs 绑定/截断护栏/向后兼容 + runtime.mjs 失败路径 GOVERNANCE 指路行。
 * 运行：node test-reports/autopilot-work/GW-1/probe-unit.mjs（工作区 = 仓库根）。
 * 只读仓库资产；沙箱文件全部落在 test-reports/autopilot-work/GW-1/ 内（governance-skills/ 本体零接触）。
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { governanceFor, governancePointerLine, governanceBriefSection, governPlanAssets, stageForAsset, DEFAULT_GOVERNANCE_DIR, MAX_GOVERNANCE_BODY_BYTES } from '../../../scripts/lib/governance.mjs';
import { executePlan, createContextBus } from '../../../scripts/lib/runtime.mjs';

const ROOT = process.cwd();
const GW = path.join(ROOT, 'test-reports', 'autopilot-work', 'GW-1');
const MISSING_DIR = path.join(GW, '.no-such-governance-skills__probe__');
const SANDBOX = path.join(GW, '.sandbox-gov');
const results = [];
function record(name, ok, detail) { results.push({ name, ok, detail }); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : '')); }

// ---------- 1. 绑定映射（Owner 圈选：3 技能/绑定阶段/激活时机） ----------
{
  const impl = governanceFor('implementation');
  const ver = governanceFor('verification');
  const fail = governanceFor('failure_recovery', 'gate_failed');
  record('binding: implementation → test-driven-development', impl && impl.skill === 'test-driven-development' && impl.binding.stage === 'implementation');
  record('binding: verification → verification-before-completion', ver && ver.skill === 'verification-before-completion' && ver.binding.activation === 'before_final_receipt（agent 宣称完成之前）');
  record('binding: failure_recovery+gate_failed → systematic-debugging', fail && fail.skill === 'systematic-debugging');
  record('binding: failure_recovery+regression_failed → non-null', Boolean(governanceFor('failure_recovery', 'regression_failed')));
  record('binding: failure_recovery+migration_failed → non-null', Boolean(governanceFor('failure_recovery', 'migration_failed')));
  record('fail-closed: failure_recovery+未知事件 → null', governanceFor('failure_recovery', 'bogus_event') === null);
  record('fail-closed: 未知 stage → null', governanceFor('no_such_stage') === null);
  record('stageForAsset 分类: implementation→impl/be-validator→verify/planning→null',
    stageForAsset('implementation') === 'implementation' && stageForAsset('be-validator') === 'verification' && stageForAsset('sdlc') === 'verification' && stageForAsset('planning') === null);
}

// ---------- 2. 真实正文注入 + 生产截断（TDD 9578B 恒截断；verification 3646B 全文） ----------
{
  const impl = governanceFor('implementation');
  const ver = governanceFor('verification');
  const rawTdd = fs.readFileSync(path.join(DEFAULT_GOVERNANCE_DIR, 'test-driven-development', 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
  const rawVer = fs.readFileSync(path.join(DEFAULT_GOVERNANCE_DIR, 'verification-before-completion', 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n?/, '');
  record('真实注入: TDD 正文含 TDD 标题（frontmatter 已剥离）', impl && impl.body.includes('# Test-Driven Development (TDD)') && !impl.body.startsWith('---'));
  record('真实注入: TDD 9578B > 5KB → truncated=true 且含 [truncated]', impl && impl.truncated === true && impl.body.includes('[truncated]'));
  record('真实注入: TDD 截断体 = 原文前 5120 字节（UTF-8 安全）', impl && Buffer.byteLength(impl.body.split('\n\n[truncated]')[0], 'utf8') === MAX_GOVERNANCE_BODY_BYTES);
  record('真实注入: verification 3646B ≤ 5KB → 全文注入零截断', ver && ver.truncated === false && ver.body === rawVer);
  record('真实注入: systematic-debugging 指路行前缀逐字（GW-1 指定格式）',
    (governancePointerLine('failure_recovery', 'gate_failed') || '').startsWith('GOVERNANCE: systematic-debugging 正文见 governance-skills/systematic-debugging/SKILL.md'));
  record('brief 节: 首行标注 --- governance: <skill> ---',
    (governanceBriefSection('verification') || '').startsWith('--- governance: verification-before-completion ---'));
}

// ---------- 3. 截断护栏边界（沙箱副本：5120/5121/6KB——governance-skills 本体禁改） ----------
{
  fs.rmSync(SANDBOX, { recursive: true, force: true });
  const skillDir = path.join(SANDBOX, 'test-driven-development');
  fs.mkdirSync(skillDir, { recursive: true });
  const write = (n) => fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# T\n' + 'x'.repeat(n));
  write(MAX_GOVERNANCE_BODY_BYTES - 4); // 正文 5121B（'# T\n' 4B + 5120B）→ 恰好不截断
  const atLimit = governanceFor('implementation', undefined, { governanceDir: SANDBOX });
  record('边界: 正文恰 ≤ 5KB → 不截断（truncated=false）', atLimit && atLimit.truncated === false);
  write(MAX_GOVERNANCE_BODY_BYTES - 3); // 5122B → 截断
  const overLimit = governanceFor('implementation', undefined, { governanceDir: SANDBOX });
  record('边界: 正文 5122B > 5KB → truncated=true + [truncated] 标注', overLimit && overLimit.truncated === true && overLimit.body.includes('[truncated]'));
  write(6 * 1024); // 6KB 文件（派单指定实测）
  const sixK = governanceFor('implementation', undefined, { governanceDir: SANDBOX });
  const sliced = sixK.body.split('\n\n[truncated]')[0];
  record('边界: 6KB 文件 → 截断体恰 5120B + 标注', sixK && sixK.truncated === true && Buffer.byteLength(sliced, 'utf8') === MAX_GOVERNANCE_BODY_BYTES);
}

// ---------- 4. 向后兼容：governance-skills 缺失 → 全部接线点静默跳过 ----------
{
  const a = new Map([['implementation', { name: 'implementation', body: 'BODY', meta: { path: 'vendor/implementation' } }]]);
  const missing = { governanceDir: MISSING_DIR };
  record('缺失: governanceFor 三阶段全 null',
    governanceFor('implementation', undefined, missing) === null && governanceFor('verification', undefined, missing) === null && governanceFor('failure_recovery', 'gate_failed', missing) === null);
  record('缺失: governancePointerLine → null（runtime 指路行静默跳过）', governancePointerLine('failure_recovery', 'gate_failed', missing) === null);
  const out = governPlanAssets(a, [{ asset: 'implementation' }], missing);
  record('缺失: governPlanAssets → 原样返回同一 Map（零行为面）', out === a && a.get('implementation').body === 'BODY');
  const bogus = governPlanAssets('not-a-map', [{ asset: 'implementation' }]);
  record('缺失: 非 Map 容器形态 → 原样返回（不猜形态）', bogus === 'not-a-map');
}

// ---------- 5. governPlanAssets 注入语义：尾部追加/原对象零改写/去重/未列资产/lib 门 ----------
{
  const impl = { name: 'implementation', body: 'IMPL_BODY', meta: {} };
  const ver = { name: 'be-validator', body: 'VER_BODY', meta: {} };
  const plan = { name: 'planning', body: 'PLAN_BODY', meta: {} };
  const assets = new Map([['implementation', impl], ['be-validator', ver], ['planning', plan]]);
  const subs = [{ asset: 'implementation' }, { asset: 'implementation' }, { asset: 'be-validator' }, { asset: 'planning' }, { asset: 'unknown-x' }];
  const out = governPlanAssets(assets, subs);
  record('注入: implementation 资产体尾追加 TDD 节', out.get('implementation') !== impl && out.get('implementation').body.startsWith('IMPL_BODY\n\n--- governance: test-driven-development ---'));
  record('注入: be-validator 资产体尾追加 verification 节', out.get('be-validator').body.startsWith('VER_BODY\n\n--- governance: verification-before-completion ---'));
  record('注入: 原资产对象零改写（vendor/缓存零污染）', impl.body === 'IMPL_BODY' && ver.body === 'VER_BODY');
  record('注入: 未列资产（planning）保持原引用零注入', out.get('planning') === plan);
  record('注入: 同资产多子任务去重（单节）', (out.get('implementation').body.match(/--- governance: test-driven-development ---/g) || []).length === 1);
  const libOut = governPlanAssets(assets, subs, { env: { YY_ACTIVATION: 'lib' } });
  record('注入: YY_ACTIVATION=lib 帧路径跳过注入（T4 payload 同源耦合护栏）', libOut === assets);
  record('注入: 空子任务表 → 原样返回', governPlanAssets(assets, []) === assets);
}

// ---------- 6. runtime 失败路径（接线点 B）：GOVERNANCE 指路行触发面 ----------
function makeLogger() {
  const lines = [];
  return { lines, info: (...a) => lines.push(['info', a.join(' ')]), warn: (...a) => lines.push(['warn', a.join(' ')]), error: (...a) => lines.push(['error', a.join(' ')]) };
}
async function runOne(subtask, opts) {
  const logger = makeLogger();
  const plan = { id: 'probe-plan', task: 'probe', cluster: 'T2_BACKEND', subtasks: [subtask], status: 'executing' };
  const result = await executePlan(plan, Object.assign({ logger, manifestPath: path.join(ROOT, 'contracts', 'asset-manifest-v2.json'), maxRetries: 0 }, opts));
  const govLines = logger.lines.filter((l) => l[1].includes('GOVERNANCE: systematic-debugging'));
  return { result, govLines, logger };
}
{
  // (a) AV-3 资格门 fail-closed：INELIGIBLE_ASSET_NOT_FOUND
  const st = { id: 's-inel', asset: 'no-such-asset-probe', status: 'idle', attempts: 0, phase: 0, dependsOn: [] };
  const r = await runOne(st, {});
  record('失败路径: INELIGIBLE_ASSET_NOT_FOUND → GOVERNANCE 指路行', r.govLines.length === 1 && st.error === 'INELIGIBLE_ASSET_NOT_FOUND', r.govLines[0] && r.govLines[0][1].slice(0, 120));
  // (b) EX-1 能力门控：CAPABILITY_MISSING（run_cmd 缺失 → prompt 兜底降级）
  const st2 = { id: 's-cap', asset: 'implementation', status: 'idle', attempts: 0, phase: 0, dependsOn: [] };
  const r2 = await runOne(st2, { executorDefaults: { capabilities: { write_files: true, run_cmd: false } }, resolveAdapter: () => ({ name: 'fake', run: async () => ({ ok: true }) }) });
  record('失败路径: CAPABILITY_MISSING → GOVERNANCE 指路行', r2.govLines.length === 1 && st2.error === 'CAPABILITY_MISSING', r2.govLines[0] && r2.govLines[0][1].slice(0, 120));
  // (c) adapter 硬失败（!result.ok）
  const st3 = { id: 's-fail', asset: 'implementation', status: 'idle', attempts: 0, phase: 0, dependsOn: [] };
  const r3 = await runOne(st3, { executorDefaults: { capabilities: { write_files: true, run_cmd: true } }, resolveAdapter: () => ({ name: 'fake', run: async () => { throw new Error('boom-probe'); } }) });
  record('失败路径: adapter 硬失败(!result.ok) → GOVERNANCE 指路行', r3.govLines.length === 1 && st3.status === 'failed', r3.govLines[0] && r3.govLines[0][1].slice(0, 120));
  // (d) adapter 诚实失败码 *_OUTPUT_INVALID（ok:false）
  const st4 = { id: 's-oinv', asset: 'implementation', status: 'idle', attempts: 0, phase: 0, dependsOn: [] };
  const r4 = await runOne(st4, { executorDefaults: { capabilities: { write_files: true, run_cmd: true } }, resolveAdapter: () => ({ name: 'fake', run: async () => ({ ok: false, artifactPath: null, error: 'SEMGREP_OUTPUT_INVALID' }) }) });
  record('失败路径: *_OUTPUT_INVALID(ok:false) → GOVERNANCE 指路行', r4.govLines.length === 1 && st4.status === 'failed');
  // (e) adapter/宿主不可用（runCommand 真实形态 ok:false+具名码）→ adapter 失败族触发指路行
  const st5 = { id: 's-env', asset: 'implementation', status: 'idle', attempts: 0, phase: 0, dependsOn: [] };
  const r5 = await runOne(st5, { executorDefaults: { capabilities: { write_files: true, run_cmd: true } }, resolveAdapter: () => ({ name: 'fake', run: async () => ({ ok: false, artifactPath: null, error: 'OPENCODE_NOT_AVAILABLE' }) }) });
  record('失败路径: OPENCODE_NOT_AVAILABLE(ok:false，adapter 失败族) → GOVERNANCE 指路行', r5.govLines.length === 1 && st5.status === 'skipped');
  // (f) 负例：成功子任务无指路行（artifact 须真实存在——gate.after 严校验，落沙箱 workspace）
  const wsBox = path.join(GW, '.ws-sandbox');
  fs.rmSync(wsBox, { recursive: true, force: true });
  fs.mkdirSync(path.join(wsBox, 'artifacts', 's-ok'), { recursive: true });
  fs.writeFileSync(path.join(wsBox, 'artifacts', 's-ok', 'plan.md'), '# probe artifact\n');
  const st6 = { id: 's-ok', asset: 'implementation', status: 'idle', attempts: 0, phase: 0, dependsOn: [] };
  const r6 = await runOne(st6, { workspace: wsBox, executorDefaults: { capabilities: { write_files: true, run_cmd: true } }, resolveAdapter: () => ({ name: 'fake', run: async () => ({ ok: true, artifactPath: 'artifacts/s-ok/plan.md', executed: true }) }) });
  record('负例: 成功子任务 → 无 GOVERNANCE 指路行', r6.govLines.length === 0 && st6.status === 'done');
  // (g) 负例：契约缺失 skip（CONTRACT_NOT_FROZEN）不在触发面
  const st7 = { id: 's-ct', asset: 'implementation', status: 'idle', attempts: 0, phase: 0, dependsOn: [], contractMode: 'frozen', contract: 'contracts/no-such__probe__.json' };
  const r7 = await runOne(st7, { workspace: ROOT });
  record('负例: CONTRACT_NOT_FROZEN 依赖 skip → 无 GOVERNANCE 指路行', r7.govLines.length === 0 && st7.status === 'skipped');
}

// ---------- 7. 沙箱清理 ----------
fs.rmSync(SANDBOX, { recursive: true, force: true });
fs.rmSync(path.join(GW, '.ws-sandbox'), { recursive: true, force: true });
const failed = results.filter((r) => !r.ok);
console.log('\n结果: ' + (results.length - failed.length) + ' PASS / ' + failed.length + ' FAIL');
process.exit(failed.length ? 1 : 0);
