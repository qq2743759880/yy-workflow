#!/usr/bin/env node
/**
 * BFX-A 自测探针 — scripts/tt-journey.mjs（BFX-2 会话隔离 + BFX-4 首跑自动初始化）。
 *
 * 用法: node test-reports/autopilot-work/BFX-A/run-probes.mjs
 *
 * 探针面（派单「自测（必须）」逐条）：
 *   P1  会话隔离：--session a / --session b 各自 --update --step 0 → .tt-state/a/journey.json 与
 *       .tt-state/b/journey.json 各自独立（step0 done），共享 .tt-state/journey.json 不被创建
 *   P2  向后兼容：不带 --session 的 --update 仍写共享 .tt-state/journey.json（显式 --update 行为零变化）
 *   P3  首跑：空工作区 --prereq-check --step 0 → AUTO-INIT（stdout）+ 自动建基线（等价 --update --step 0）
 *       + exit 0（不再死锁 exit 1）
 *   P4  幂等：第二次 --prereq-check --step 0 → 无重复 AUTO-INIT，journey.json 字节不变
 *   P5  会话首跑：空工作区 --session s1 --prereq-check --step 0 → 基线落在 .tt-state/s1/，共享文件不建
 *   P6  会话读面一致：--session b --prereq-check --step 1 读 .tt-state/b/journey.json（step0 done）→ OK；
 *       全程共享 .tt-state/journey.json 仍不存在（互不串写）
 *   P7  exit 语义保留：空工作区 --prereq-check --step 3 → 先 AUTO-INIT 再照常检查（step1 未 done）→ exit 1
 *   P8  会话更新前置链：--session b --update --step 1 --gate concept-signed → 写 .tt-state/b/（依赖 step0 done），
 *       .tt-state/a/journey.json 字节不变（b 的更新不串写到 a）
 *
 * 退出码：0 = 全 PASS；1 = 有 FAIL。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const BFXA_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(BFXA_DIR, '..', '..', '..');
const TT = path.join(REPO, 'scripts', 'tt-journey.mjs');
const JSON_OUT = process.argv.includes('--json');

let pass = 0, fail = 0;
const failures = [];
const machineRows = [];

function section(name, ok, detail) {
  if (ok) { pass += 1; console.log('[PASS] ' + name + (detail ? '  · ' + detail : '')); }
  else { fail += 1; failures.push(name); console.log('[FAIL] ' + name + (detail ? '  · ' + detail : '')); }
  machineRows.push({ name, ok, detail: detail || '' });
}

function sha16(buf) { return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16); }

/** 跑一版 tt-journey CLI，返回 {exit, stdout, stderr}。 */
function runTT(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [TT, ...args], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { err += c; });
    child.on('error', (e) => resolve({ exit: -1, stdout: out, stderr: err + String(e.message) }));
    child.on('close', (code) => resolve({ exit: code ?? -1, stdout: out, stderr: err }));
  });
}

async function mkws(tag) {
  const dir = path.join(os.tmpdir(), 'bfxa-' + tag + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6));
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }

const tmpDirs = [];
const results = {};

// ---------------------------------------------------------------------------
// P1: 会话隔离（BFX-2 主断言）
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p1'); tmpDirs.push(ws);
  const ra = await runTT(['--workspace', ws, '--session', 'a', '--update', '--step', '0']);
  const rb = await runTT(['--workspace', ws, '--session', 'b', '--update', '--step', '0']);
  const ja = readJson(path.join(ws, '.tt-state', 'a', 'journey.json'));
  const jb = readJson(path.join(ws, '.tt-state', 'b', 'journey.json'));
  const sharedExists = fs.existsSync(path.join(ws, '.tt-state', 'journey.json'));
  const aOk = ja && ja.steps && ja.steps[0].status === 'done';
  const bOk = jb && jb.steps && jb.steps[0].status === 'done';
  section('P1 会话隔离：--session a/b 各自 --update --step 0 落各自文件，共享 journey.json 不建',
    ra.exit === 0 && rb.exit === 0 && aOk && bOk && !sharedExists,
    'exitA=' + ra.exit + ' exitB=' + rb.exit + ' a.step0=' + (ja ? ja.steps[0].status : '无文件') +
    ' b.step0=' + (jb ? jb.steps[0].status : '无文件') + ' 共享文件存在=' + sharedExists);
  results.p1 = { exitA: ra.exit, exitB: rb.exit, aOk, bOk, sharedExists };
}

// ---------------------------------------------------------------------------
// P2: 向后兼容：不带 --session 的 --update 仍写共享 journey.json
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p2'); tmpDirs.push(ws);
  const r = await runTT(['--workspace', ws, '--update', '--step', '0']);
  const js = readJson(path.join(ws, '.tt-state', 'journey.json'));
  const ok = js && js.steps && js.steps[0].status === 'done';
  section('P2 不带 --session 的 --update 仍写共享 .tt-state/journey.json（零变化）',
    r.exit === 0 && ok && r.stdout.includes('journey 已更新：' + path.join(ws, '.tt-state', 'journey.json')),
    'exit=' + r.exit + ' 共享 step0=' + (js ? js.steps[0].status : '无文件'));
  results.p2 = { exit: r.exit, ok };
}

// ---------------------------------------------------------------------------
// P3: 首跑自动初始化（BFX-4 主断言）
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p3'); tmpDirs.push(ws);
  const r = await runTT(['--workspace', ws, '--prereq-check', '--step', '0']);
  const js = readJson(path.join(ws, '.tt-state', 'journey.json'));
  const auto = r.stdout.includes('AUTO-INIT');
  const baseline = js && js.steps && js.steps[0].status === 'done' && js.steps.slice(1).every((s) => s.status === 'pending') && Array.isArray(js.plans) && js.plans.length === 0;
  section('P3 空工作区首跑 --prereq-check --step 0 → AUTO-INIT + 基线（等价 --update --step 0）+ exit 0 不死锁',
    r.exit === 0 && auto && baseline && r.stdout.includes('prereq OK: step 0'),
    'exit=' + r.exit + ' AUTO-INIT=' + auto + ' 基线step0done=' + baseline);
  results.p3 = { exit: r.exit, auto, baseline };

  // P4: 幂等：第二次跑无重复初始化，文件字节不变
  const before = fs.readFileSync(path.join(ws, '.tt-state', 'journey.json'));
  const r2 = await runTT(['--workspace', ws, '--prereq-check', '--step', '0']);
  const after = fs.readFileSync(path.join(ws, '.tt-state', 'journey.json'));
  const autoCount = r2.stdout.split('\n').filter((l) => l.includes('AUTO-INIT')).length;
  section('P4 第二次 --prereq-check --step 0 幂等（无重复 AUTO-INIT，文件字节不变）',
    r2.exit === 0 && autoCount === 0 && before.equals(after),
    'exit=' + r2.exit + ' AUTO-INIT次数=' + autoCount + ' 字节不变=' + before.equals(after));
  results.p4 = { exit: r2.exit, autoCount, byteEqual: before.equals(after) };
}

// ---------------------------------------------------------------------------
// P5: 会话首跑：--session s1 --prereq-check --step 0 → 基线落 .tt-state/s1/
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p5'); tmpDirs.push(ws);
  const r = await runTT(['--workspace', ws, '--session', 's1', '--prereq-check', '--step', '0']);
  const js = readJson(path.join(ws, '.tt-state', 's1', 'journey.json'));
  const sharedExists = fs.existsSync(path.join(ws, '.tt-state', 'journey.json'));
  const ok = js && js.steps && js.steps[0].status === 'done';
  section('P5 会话首跑：--session s1 --prereq-check --step 0 → 基线落 .tt-state/s1/journey.json，共享不建',
    r.exit === 0 && r.stdout.includes('AUTO-INIT') && ok && !sharedExists,
    'exit=' + r.exit + ' AUTO-INIT=' + r.stdout.includes('AUTO-INIT') + ' s1.step0=' + (js ? js.steps[0].status : '无文件') + ' 共享存在=' + sharedExists);
  results.p5 = { exit: r.exit, ok, sharedExists };
}

// ---------------------------------------------------------------------------
// P6: 会话读面一致 + 互不串写（P1 的 ws 复用语义独立副本）
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p6'); tmpDirs.push(ws);
  await runTT(['--workspace', ws, '--session', 'a', '--update', '--step', '0']);
  await runTT(['--workspace', ws, '--session', 'b', '--update', '--step', '0']);
  const aBefore = fs.readFileSync(path.join(ws, '.tt-state', 'a', 'journey.json'));
  const r = await runTT(['--workspace', ws, '--session', 'b', '--prereq-check', '--step', '1']);
  const aAfter = fs.readFileSync(path.join(ws, '.tt-state', 'a', 'journey.json'));
  const sharedExists = fs.existsSync(path.join(ws, '.tt-state', 'journey.json'));
  // step1 依赖 step0 done（无 gate）→ b 的 step0 done → OK
  section('P6 --session b --prereq-check --step 1 读 b 的 journey（step0 done → OK），a 文件不串写，共享不建',
    r.exit === 0 && r.stdout.includes('prereq OK: step 1') && !r.stdout.includes('AUTO-INIT') && aBefore.equals(aAfter) && !sharedExists,
    'exit=' + r.exit + ' 无AUTO-INIT=' + !r.stdout.includes('AUTO-INIT') + ' a字节不变=' + aBefore.equals(aAfter) + ' 共享存在=' + sharedExists);
  results.p6 = { exit: r.exit, byteEqualA: aBefore.equals(aAfter), sharedExists };
}

// ---------------------------------------------------------------------------
// P7: exit 语义保留：AUTO-INIT 后续检查照常进行（step3 依赖 step1 → exit 1）
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p7'); tmpDirs.push(ws);
  const r = await runTT(['--workspace', ws, '--prereq-check', '--step', '3']);
  const js = readJson(path.join(ws, '.tt-state', 'journey.json'));
  const ok = r.exit === 1 && r.stdout.includes('AUTO-INIT') && r.stderr.includes('不得开工') && js && js.steps[0].status === 'done';
  section('P7 空工作区 --prereq-check --step 3 → AUTO-INIT 建基线后照常拦截（exit 1）',
    ok, 'exit=' + r.exit + ' AUTO-INIT=' + r.stdout.includes('AUTO-INIT') + ' stderr拦截=' + r.stderr.includes('不得开工'));
  results.p7 = { exit: r.exit, ok };
}

// ---------------------------------------------------------------------------
// P8: 会话更新前置链 + 跨会话不串写
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p8'); tmpDirs.push(ws);
  await runTT(['--workspace', ws, '--session', 'a', '--update', '--step', '0']);
  await runTT(['--workspace', ws, '--session', 'b', '--update', '--step', '0']);
  const aBefore = fs.readFileSync(path.join(ws, '.tt-state', 'a', 'journey.json'));
  const r = await runTT(['--workspace', ws, '--session', 'b', '--update', '--step', '1', '--gate', 'concept-signed']);
  const jb = readJson(path.join(ws, '.tt-state', 'b', 'journey.json'));
  const ja = readJson(path.join(ws, '.tt-state', 'a', 'journey.json'));
  const sharedExists = fs.existsSync(path.join(ws, '.tt-state', 'journey.json'));
  const bOk = jb && jb.steps[1].status === 'done' && jb.steps[1].gates_passed.includes('concept-signed') && jb.steps[0].status === 'done';
  const aOk = ja && ja.steps[1].status === 'pending';
  section('P8 --session b --update --step 1 --gate concept-signed → 写 b（前置链成立），a step1 仍 pending，共享不建',
    r.exit === 0 && bOk && aOk && !sharedExists,
    'exit=' + r.exit + ' b.step1=' + (jb ? jb.steps[1].status + '/' + jb.steps[1].gates_passed.join(',') : '无文件') +
    ' a.step1=' + (ja ? ja.steps[1].status : '无文件') + ' 共享存在=' + sharedExists);
  results.p8 = { exit: r.exit, bOk, aOk, sharedExists };
}

// 清理探针沙箱
for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* 尽力而为 */ } }

console.log('\n== 汇总: ' + pass + '/' + (pass + fail) + ' PASS ==');
if (failures.length) { for (const f of failures) console.log('  FAILED: ' + f); }
fs.writeFileSync(path.join(BFXA_DIR, 'out-probe-results.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  current: { ttJourneySha16: sha16(fs.readFileSync(TT)) },
  pass, fail, rows: machineRows,
}, null, 2));
process.exitCode = fail > 0 ? 1 : 0;
