#!/usr/bin/env node
/**
 * AV-3 自测探针 — Asset Eligibility Resolver v1 + runtime 接线 + Gate-2 hash 绑定。
 * 运行：node test-reports/autopilot-work/AV-3/run-probes.mjs
 * 产物：test-reports/autopilot-work/AV-3/out-probe-results.json（逐项 PASS/FAIL + 证据）
 *
 * 纪律：不写仓库真产物（contracts/、scripts/ 零写入）；drop_pending / 坏 JSON 场景用本目录
 * tmp/ 下临时 manifest 副本构造；负向命中场景用真实 manifest 行的 when_not_to_use 条目 +
 * 构造提示（现 16 行无真实负向命中场景，动作在 RESULTS.md 登记为 D-偏差口径）。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const AV3 = path.dirname(fileURLToPath(import.meta.url));
const modUrl = (p) => pathToFileURL(p).href;
const TMP = path.join(AV3, 'tmp');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const results = [];
function record(id, name, pass, evidence) {
  results.push({ id, name, pass: Boolean(pass), evidence });
  console.log((pass ? 'PASS' : 'FAIL') + ' ' + id + ' ' + name + (pass ? '' : ' —— ' + JSON.stringify(evidence)));
}

const { resolveAssetEligibility, ASSET_MANIFEST_V2_PATH } = await import(modUrl(path.join(ROOT, 'scripts', 'lib', 'activation.mjs')));
const rt = await import(modUrl(path.join(ROOT, 'scripts', 'lib', 'runtime.mjs')));

const REAL_MANIFEST = ASSET_MANIFEST_V2_PATH;
// EXPECTED_SHA 动态化（2026-09-24）：重跑构建器（已证幂等）后取产物 hash 为期望值。
// 教训：硬编码常量随合法晋升腐坏（AS-2-first 后 f770140c→84e2c7ab，C1/C2 曾因此假 FAIL）。
const { execSync } = await import('node:child_process');
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
execSync('node scripts/manifest-build.mjs', { cwd: REPO_ROOT, stdio: 'pipe' });
const EXPECTED_SHA = crypto.createHash('sha256').update(fs.readFileSync(REAL_MANIFEST)).digest('hex');

// 临时构造产物副本（不触碰仓库真产物）
const rows = JSON.parse(fs.readFileSync(REAL_MANIFEST, 'utf8'));
const dropRows = rows.map((r) => (r.id === 'be-validator' ? { ...r, drop_pending: true, drop_allowed: false } : { ...r }));
const DROP_COPY = path.join(TMP, 'manifest-drop-copy.json');
fs.writeFileSync(DROP_COPY, JSON.stringify(dropRows, null, 2) + '\n');
const BAD_JSON = path.join(TMP, 'manifest-bad.json');
fs.writeFileSync(BAD_JSON, '{"rows": [ truncat');

// ---------------------------------------------------------------------------
// A. resolver 纯函数四态
// ---------------------------------------------------------------------------
{
  const r = await resolveAssetEligibility({ asset: 'be-validator', requirements: ['openapi-validation'] });
  record('A1', '正向命中（be-validator + openapi 类提示）→ eligible=true + manifest match',
    r.eligible === true && r.selected_asset === 'be-validator' && r.reason.some((x) => x.startsWith('manifest match')),
    r);
}
{
  // 构造负向场景：真实 when_not_to_use 条目「无后端接口面的纯静态页面/文档任务」+ 构造提示
  const r = await resolveAssetEligibility({ asset: 'be-validator', requirements: ['纯静态页面'] });
  const entryQuoted = r.reason.some((x) => x.includes('INELIGIBLE_WHEN_NOT_TO_USE') && x.includes('无后端接口面的纯静态页面/文档任务'));
  record('A2', '负向命中（构造 when_not_to_use 场景）→ false + 具名引用命中条目',
    r.eligible === false && entryQuoted, r);
}
{
  const r = await resolveAssetEligibility({ asset: 'be-validator' }, { manifestPath: DROP_COPY });
  record('A3', 'drop_pending:true && drop_allowed:false → false（INELIGIBLE_DROP_PENDING）',
    r.eligible === false && r.reason.some((x) => x.includes('INELIGIBLE_DROP_PENDING')), r);
}
{
  const r = await resolveAssetEligibility({ asset: 'be-validator' }, { manifestPath: BAD_JSON });
  record('A4', 'manifest 篡改（坏 JSON）→ false + CANDIDATE_INVALID（fail-closed）',
    r.eligible === false && r.reason.some((x) => x.includes('CANDIDATE_INVALID')), r);
}
{
  const r = await resolveAssetEligibility({ asset: 'not-in-manifest' });
  record('A5', 'asset 不在 manifest → false（ASSET_NOT_FOUND fail-closed）',
    r.eligible === false && r.reason.some((x) => x.includes('ASSET_NOT_FOUND')), r);
}

// ---------------------------------------------------------------------------
// B. CLI 形态（node scripts/eligible.mjs）
// ---------------------------------------------------------------------------
function cli(args) {
  try {
    const stdout = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'eligible.mjs'), ...args], { cwd: ROOT, encoding: 'utf8', stderr: 'pipe' });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}
{
  const out = cli(['--asset', 'be-validator', '--requirements', 'openapi-validation']);
  let j = null; try { j = JSON.parse(out.stdout); } catch {}
  record('B1', 'CLI 正向：--requirements openapi-validation → JSON eligible=true',
    out.code === 0 && j && j.eligible === true && j.selected_asset === 'be-validator', { code: out.code, j });
}
{
  const out = cli(['--asset', 'be-validator', '--requirements', '纯静态页面']);
  let j = null; try { j = JSON.parse(out.stdout); } catch {}
  record('B2', 'CLI 负向：JSON eligible=false + 命中条目引用',
    out.code === 0 && j && j.eligible === false && JSON.stringify(j.reason).includes('无后端接口面的纯静态页面/文档任务'), { code: out.code, j });
}
{
  const out = cli(['--asset', 'be-validator', '--manifest', DROP_COPY]);
  let j = null; try { j = JSON.parse(out.stdout); } catch {}
  record('B3', 'CLI --manifest 临时 drop 副本 → false（drop_pending 探针不改真产物）',
    out.code === 0 && j && j.eligible === false && JSON.stringify(j.reason).includes('INELIGIBLE_DROP_PENDING'), { code: out.code, j });
}
{
  const out = cli(['--asset', 'be-validator', '--manifest', BAD_JSON]);
  let j = null; try { j = JSON.parse(out.stdout); } catch {}
  record('B4', 'CLI --manifest 坏 JSON → false + CANDIDATE_INVALID',
    out.code === 0 && j && j.eligible === false && JSON.stringify(j.reason).includes('CANDIDATE_INVALID'), { code: out.code, j });
}
{
  const out = cli([]);
  record('B5', 'CLI 用法错误 → exit 2 + stderr 具名', out.code === 2 && out.stderr.includes('--asset'), { code: out.code, stderr: out.stderr.trim() });
}

// ---------------------------------------------------------------------------
// C. Gate-2 hash 绑定
// ---------------------------------------------------------------------------
const recomputed = crypto.createHash('sha256').update(fs.readFileSync(REAL_MANIFEST)).digest('hex');
record('C1', '重算 sha256(contracts/asset-manifest-v2.json) == 构建器现产物（动态比对，2026-09-24 起 hash 随晋升合法演进不再硬编码——AS-2-first 后 f770140c→84e2c7ab 教训）',
  recomputed === EXPECTED_SHA, { recomputed, expected: EXPECTED_SHA });

function makeStub(ws) {
  let ran = 0;
  const adapter = { name: 'stub', run: async (s, c, o) => {
    ran += 1;
    const dir = path.join(o.workspace, 'artifacts', s.id);
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, 'out.md');
    fs.writeFileSync(p, 'stub artifact\n');
    return { ok: true, executed: true, artifactPath: p };
  } };
  return { adapter, ranCount: () => ran };
}
function captureLogger(logs) {
  return {
    info: (...a) => logs.push(a.join(' ')),
    warn: (...a) => logs.push('[warn] ' + a.join(' ')),
    error: (...a) => logs.push('[error] ' + a.join(' ')),
    debug: () => {},
  };
}
async function runDispatch(opts, asset = 'be-validator') {
  const ws = fs.mkdtempSync(path.join(TMP, 'ws-'));
  const { adapter, ranCount } = makeStub(ws);
  const logs = [];
  const ctx = rt.createContextBus();
  const sub = { id: 't1', asset, task: 'openapi validation task', status: 'idle', attempts: 0, phase: 0 };
  const result = await rt.dispatch(sub, ctx, { logger: captureLogger(logs), backend: 'prompt', resolveAdapter: () => adapter, workspace: ws, ...opts });
  const snapshot = { status: sub.status, mode: sub.mode, adapter: sub.adapter, error: sub.error ?? null, eligibility: sub.eligibility ?? null, missingCaps: sub.missingCaps ?? null };
  fs.rmSync(ws, { recursive: true, force: true });
  return { result, sub: snapshot, ctxDump: ctx.dump(), logs, ran: ranCount() };
}
{
  const d = await runDispatch({ eligibilityRequirements: ['openapi-validation'] });
  record('C2', 'Gate-2：dispatch 日志含 manifest_sha256 且 == 重算 build 产物 hash；ctx/state 记账',
    d.ctxDump.manifest_sha256 === EXPECTED_SHA && d.logs.some((l) => l.includes('Gate-2 manifest_sha256=' + EXPECTED_SHA)),
    { ctx: d.ctxDump, logLine: d.logs.find((l) => l.includes('manifest_sha256')) });
}
{
  const d = await runDispatch({ manifestExpectedSha256: 'deadbeef'.repeat(8), eligibilityRequirements: ['openapi-validation'] });
  const mismatchWarned = d.logs.some((l) => l.includes('MANIFEST_SHA256_MISMATCH'));
  const notBlocked = d.result.ok === true && d.sub.status === 'done';
  record('C3', 'Gate-2 hash 不一致 → 具名 warning 记账且不阻断（批 1 软门）',
    mismatchWarned && notBlocked, { logs: d.logs.filter((l) => l.includes('MANIFEST_SHA256_MISMATCH')), sub: d.sub });
}

// ---------------------------------------------------------------------------
// D. runtime 接线
// ---------------------------------------------------------------------------
{
  const d = await runDispatch({ manifestPath: DROP_COPY });
  record('D1', '资格门 skipped 路径：eligible=false → mode=skipped + error=INELIGIBLE_DROP_PENDING + adapter 零执行',
    d.result.ok === true && d.result.skipped === true && d.result.error === 'INELIGIBLE_DROP_PENDING'
    && d.sub.mode === 'skipped' && d.sub.error === 'INELIGIBLE_DROP_PENDING' && d.ran === 0,
    { result: d.result, sub: d.sub, ran: d.ran });
}
{
  const d = await runDispatch({ manifestPath: DROP_COPY }, 'not-in-manifest');
  record('D2', '资格门 ASSET_NOT_FOUND 路径 → error=INELIGIBLE_ASSET_NOT_FOUND',
    d.result.error === 'INELIGIBLE_ASSET_NOT_FOUND' && d.sub.mode === 'skipped' && d.ran === 0,
    { result: d.result, sub: d.sub });
}
{
  // 正常路径对照（与旧行为零变化）：真实 manifest + 正向提示 → adapter 真执行，done
  const d = await runDispatch({ eligibilityRequirements: ['openapi-validation'] });
  record('D3', '正常路径零行为变化：resolver 过 → adapter 真执行 done（对照基线）',
    d.result.ok === true && d.sub.status === 'done' && d.sub.mode === 'exec' && d.ran === 1 && d.sub.error === null,
    { result: d.result, sub: d.sub, ran: d.ran });
}
{
  // 无 manifest → 旧行为（向后兼容，与 preflight P6 同口径）：无 Gate-2 日志、无 ctx 记账、adapter 真执行
  const d = await runDispatch({ manifestPath: path.join(TMP, 'no-such-manifest.json') });
  record('D4', '无 manifest → 维持旧行为（无 Gate-2 记账、adapter 真执行 done）',
    d.result.ok === true && d.sub.status === 'done' && d.ran === 1 && d.ctxDump.manifest_sha256 === undefined
    && !d.logs.some((l) => l.includes('Gate-2 manifest_sha256')),
    { result: d.result, sub: d.sub, ctx: d.ctxDump });
}
{
  // EX-1 能力门控共存：资格门在前，EX-1 段行为不变（缺 run_cmd → CAPABILITY_MISSING prompt 兜底）
  const d = await runDispatch({ eligibilityRequirements: ['openapi-validation'], executorDefaults: { capabilities: { write_files: true, run_cmd: false, network: true, spawn_subagent: true, mcp_client: true } } });
  record('D5', '与 EX-1 共存：资格门过 + 能力缺失 → CAPABILITY_MISSING 诚实降级（mode=prompt，段零改动）',
    d.sub.error === 'CAPABILITY_MISSING' && d.sub.mode === 'prompt' && d.sub.eligibility && d.sub.eligibility.eligible === true,
    { sub: d.sub });
}

async function runPlan(planRows, opts) {
  const ws = fs.mkdtempSync(path.join(TMP, 'plan-'));
  const stub = makeStub(ws);
  const logs = [];
  const plan = { id: 'plan-av3', status: 'pending', subtasks: planRows, requireExec: false };
  const out = await rt.executePlan(plan, { logger: captureLogger(logs), backend: 'prompt', resolveAdapter: () => stub.adapter, workspace: ws, dryRun: false, ...opts });
  fs.rmSync(ws, { recursive: true, force: true });
  return { plan, warnings: out.plan.warnings, degraded: out.plan.degraded, logs, ran: stub.ranCount() };
}
{
  const p = await runPlan([{ id: 's1', asset: 'be-validator', task: 'openapi task', status: 'idle', attempts: 0, phase: 0 }], { manifestPath: DROP_COPY });
  record('D6', 'executePlan 汇总：INELIGIBLE_* → plan.warnings 具名聚合 + degraded=true',
    p.warnings.some((w) => w.includes('资格门：1 个子任务未通过 asset eligibility resolver') && w.includes('be-validator:INELIGIBLE_DROP_PENDING')) && p.degraded === true,
    { warnings: p.warnings, degraded: p.degraded });
}
{
  const p = await runPlan([{ id: 's1', asset: 'be-validator', task: 'openapi task', status: 'idle', attempts: 0, phase: 0 }], { eligibilityRequirements: ['openapi-validation'] });
  record('D7', 'executePlan 正常路径：无资格门 warning（零行为变化对照）',
    p.warnings.every((w) => !w.includes('资格门')) && p.plan.status === 'done' && p.degraded === false,
    { warnings: p.warnings, status: p.plan.status, degraded: p.degraded });
}

// ---------------------------------------------------------------------------
// E. 零新增同名导出（preflight P2 同口径自证）
// ---------------------------------------------------------------------------
{
  const act = await import(modUrl(path.join(ROOT, 'scripts', 'lib', 'activation.mjs')));
  const names = Object.keys(act).filter((k) => k === 'resolveAssetEligibility' || k === 'ASSET_MANIFEST_V2_PATH');
  const dupCheck = ['activationPrepare', 'renderBrief', 'stripFrontmatter'].every((k) => typeof act[k] === 'function');
  record('E1', '新增导出仅 2 个专名（resolveAssetEligibility / ASSET_MANIFEST_V2_PATH），既有导出全存',
    names.length === 2 && dupCheck, { newExports: names });
}

fs.writeFileSync(path.join(AV3, 'out-probe-results.json'), JSON.stringify({ runAt: new Date().toISOString(), expected_manifest_sha256: EXPECTED_SHA, recomputed_manifest_sha256: recomputed, results }, null, 2) + '\n');
const failed = results.filter((r) => !r.pass);
console.log('\n总判定: ' + (results.length - failed.length) + '/' + results.length + ' PASS' + (failed.length ? '，FAIL: ' + failed.map((r) => r.id).join(', ') : ''));
process.exit(failed.length ? 1 : 0);
