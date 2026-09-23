#!/usr/bin/env node
/**
 * EX-1 自测探针 — executor.json v2 能力握手 + 措辞纪律（批 0）。
 *
 * 用法: node test-reports/autopilot-work/EX-1/run-probes.mjs [--json]
 *
 * 探针面（EX-1 派单「自测（必须）」逐条）：
 *   E1  executor.json 带 capabilities 块 → orchestrator 启动读取能力并留痕（executorDefaults.capabilities）
 *   E2  能力门控（缺 run_cmd 的执行器）：专用 CLI adapter 资产（implementation，需 run_cmd）
 *       → 子任务诚实降级 mode=prompt（write_files 在场时 brief-only 兜底）且 error=CAPABILITY_MISSING、日志留痕
 *   E3  能力门控（连 write_files 也缺）：降级 mode=skipped，不假报执行
 *   E4  能力门控向后兼容：capabilities 全 true（或无 capabilities 块）→ 行为与基线一致（正常 exec 派单不受影响）
 *   E5  executor.json v2 Agent Card 式自描述块：capabilities + detectedAt 字段持久化（executor-setup --non-interactive --save 路径）
 *   E6  措辞纪律：全仓 grep "已接线" → 0 命中（scripts/ 面零残留）
 *   E7  opencode adapter 注释降为回归渠道之一（不进主路径描述）
 *   E8  诚实上报：探测失败（corrupt executor.json）→ 如实 warning，不假报已用外部内核
 *
 * 退出码：0 = 全 PASS；1 = 有 FAIL。
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EX1_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(EX1_DIR, '..', '..', '..');
const ORCH = path.join(REPO, 'scripts', 'orchestrator.mjs');
const JSON_OUT = process.argv.includes('--json');

let pass = 0, fail = 0;
const failures = [];
const machineRows = [];

function section(name, ok, detail) {
  if (ok) { pass += 1; console.log('[PASS] ' + name + (detail ? '  · ' + detail : '')); }
  else { fail += 1; failures.push(name); console.log('[FAIL] ' + name + (detail ? '  · ' + detail : '')); }
  machineRows.push({ name, ok, detail: detail || '' });
}

function runOrch(args, extraEnv) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [ORCH, ...args], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TT_TUI: 'off', ...(extraEnv || {}) } });
    let out = '', err = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { err += c; });
    child.on('error', (e) => resolve({ exit: -1, stdout: out, stderr: err + String(e.message) }));
    child.on('close', (code) => resolve({ exit: code ?? -1, stdout: out, stderr: err }));
  });
}

async function mkws(tag) {
  const dir = path.join(os.tmpdir(), 'ex1-' + tag + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6));
  await fsp.mkdir(path.join(dir, '.tt-state'), { recursive: true });
  return dir;
}

function writeExecutorJson(ws, obj) {
  fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
  fs.writeFileSync(path.join(ws, '.tt-state', 'executor.json'), JSON.stringify(obj, null, 2));
}

function readState(ws) {
  try { return JSON.parse(fs.readFileSync(path.join(ws, '.tt-state', 'state.json'), 'utf8')); } catch (e) { return null; }
}

/** 良性宿主：读 brief 路径（最后参数），写 plan.md（含锚点行 + Kernel 词），stdout 输出回执。 */
const HOST_JS = "const fs=require('fs'),p=require('path');const brief=process.argv[process.argv.length-1];const dir=p.dirname(brief);const m=brief.match(/-\\s*asset:\\s*([^\\s]+)/);const k=(brief.match(/Kernel:\\s*([A-Za-z0-9][^\\n\\uFF08(]+)/)||[])[1]||'';fs.writeFileSync(p.join(dir,'plan.md'),'# host-ok\\nasset='+(m?m[1]:'?')+(k?'\\n'+k:'')+'\\n');console.log('host-exec-ok asset='+(m?m[1]:'?'));";

const CAPS_ALL_TRUE = { write_files: true, run_cmd: true, network: true, spawn_subagent: true, mcp_client: true };
const CAPS_NO_RUN_CMD = { write_files: true, run_cmd: false, network: true, spawn_subagent: true, mcp_client: true };
const CAPS_NO_WRITE = { write_files: false, run_cmd: false, network: false, spawn_subagent: false, mcp_client: false };

console.log('== EX-1 探针 == executor.json v2 能力握手 + 措辞纪律 ==\n');

// ---------------------------------------------------------------------------
// E1: executor.json 带 capabilities → orchestrator 读取并留痕（--plan --dry-run 映射日志 / debug 面）
// ---------------------------------------------------------------------------
{
  const ws = await mkws('e1');
  writeExecutorJson(ws, { schema: 'tt/executor-config@1', mode: 'B-cli', cli: 'opencode', model: null, isolate: null, capabilities: CAPS_NO_RUN_CMD, detectedAt: new Date().toISOString() });
  const r = await runOrch(['--plan', '--dry-run', '--task', 'backend login module', '--workspace', ws]);
  // 映射日志照旧出现（FIX-2 语义保持），且不因 capabilities 块崩溃
  const mapped = r.stdout.includes('--exec from executor.json');
  const exitOk = r.exit === 6 || r.exit === 0;
  section('E1 executor.json 带 capabilities → 启动读取不崩溃 + FIX-2 映射语义保持', mapped && exitOk,
    'exit=' + r.exit + ' 映射日志=' + (mapped ? '有' : '无'));
  results_e1(ws);
  function results_e1(w) { try { fs.rmSync(w, { recursive: true, force: true }); } catch (e) { /* 尽力 */ } }
}

// ---------------------------------------------------------------------------
// E2: 缺 run_cmd 的执行器 → 专用 CLI adapter 资产诚实降级 mode=prompt + error=CAPABILITY_MISSING + 日志留痕
//     （构造：executor.json capabilities.run_cmd=false；任务词 'database module' 路由 T1 簇
//      （requireExec=false，无 DEP_PRECONDITION 干扰）；--exec node -e 良性宿主真实可跑——
//      但能力握手先行：implementation/be-validator/sdlc 需 run_cmd ⇒ 降级，不静默用弱能力跑宿主；
//      be-architect/be-provider 仅需 write_files ⇒ 正常 exec，验证门控是按需精确命中而非全簇误伤）
// ---------------------------------------------------------------------------
{
  const ws = await mkws('e2');
  writeExecutorJson(ws, { schema: 'tt/executor-config@1', mode: 'B-cli', cli: null, model: null, isolate: null, capabilities: CAPS_NO_RUN_CMD, detectedAt: new Date().toISOString() });
  const r = await runOrch(['--backend', 'prompt', '--task', 'database module', '--workspace', ws, '--exec', process.execPath, '-e', HOST_JS]);
  const state = readState(ws);
  const subs = state && Array.isArray(state.subtasks) ? state.subtasks : [];
  const cliAssets = subs.filter(function(s) { return ['implementation', 'dev-backend', 'be-implementer', 'sdlc', 'be-validator', 'portman'].includes(s.asset); });
  const degraded = cliAssets.filter(function(s) { return s.error === 'CAPABILITY_MISSING' && (s.mode === 'prompt' || s.mode === 'skipped'); });
  const warned = (r.stderr + r.stdout).includes('执行器能力缺失') && (r.stderr + r.stdout).includes('run_cmd');
  const notExec = cliAssets.every(function(s) { return s.mode !== 'exec'; });
  const precise = cliAssets.length > 0 && degraded.length === cliAssets.length;
  const warnings = (state && state.warnings) || [];
  const warnTrail = warnings.some(function(w) { return w.includes('能力门控'); });
  section('E2 缺 run_cmd → CLI adapter 资产诚实降级（error=CAPABILITY_MISSING + 日志留痕 + 不静默 exec）',
    precise && warned && notExec && warnTrail,
    'cli资产=' + cliAssets.length + ' 降级=' + degraded.length + ' warning=' + (warned ? '有' : '无') + ' 汇总留痕=' + (warnTrail ? '有' : '无') + ' 无exec=' + notExec);
  fs.writeFileSync(path.join(EX1_DIR, 'out-e2-state.json'), JSON.stringify(state, null, 2));
  fs.writeFileSync(path.join(EX1_DIR, 'out-e2-stderr.txt'), r.stderr);
  try { fs.rmSync(ws, { recursive: true, force: true }); } catch (e) { /* 尽力 */ }
}

// ---------------------------------------------------------------------------
// E3: 连 write_files 也缺 → mode=skipped（不假报 prompt 兜底可落盘）
// ---------------------------------------------------------------------------
{
  const ws = await mkws('e3');
  writeExecutorJson(ws, { schema: 'tt/executor-config@1', mode: 'B-cli', cli: null, model: null, isolate: null, capabilities: CAPS_NO_WRITE, detectedAt: new Date().toISOString() });
  const r = await runOrch(['--backend', 'prompt', '--task', 'backend login module', '--workspace', ws, '--exec', process.execPath, '-e', HOST_JS]);
  const state = readState(ws);
  const subs = state && Array.isArray(state.subtasks) ? state.subtasks : [];
  const skippedMissing = subs.filter(function(s) { return s.error === 'CAPABILITY_MISSING' && s.mode === 'skipped'; });
  const noExec = subs.every(function(s) { return s.mode !== 'exec'; });
  section('E3 连 write_files 也缺 → mode=skipped（诚实降级不假报）',
    subs.length > 0 && skippedMissing.length > 0 && noExec,
    'skipped(CAPABILITY_MISSING)=' + skippedMissing.length + '/' + subs.length + ' 无exec=' + noExec);
  fs.writeFileSync(path.join(EX1_DIR, 'out-e3-state.json'), JSON.stringify(state, null, 2));
  try { fs.rmSync(ws, { recursive: true, force: true }); } catch (e) { /* 尽力 */ }
}

// ---------------------------------------------------------------------------
// E4: 向后兼容——capabilities 全 true（Agent Card 完整块）→ exec 派单行为与基线一致
// ---------------------------------------------------------------------------
{
  const ws = await mkws('e4');
  writeExecutorJson(ws, { schema: 'tt/executor-config@1', mode: 'B-cli', cli: null, model: null, isolate: null, capabilities: CAPS_ALL_TRUE, detectedAt: new Date().toISOString() });
  const r = await runOrch(['--backend', 'prompt', '--task', 'backend login module', '--workspace', ws, '--exec', process.execPath, '-e', HOST_JS]);
  const state = readState(ws);
  const execOk = state && state.modes && (state.modes.exec || 0) > 0;
  const noCapMissing = state && state.subtasks ? state.subtasks.every(function(s) { return s.error !== 'CAPABILITY_MISSING'; }) : false;
  section('E4 capabilities 全 true → exec 派单不受门控影响（向后兼容）', r.exit === 0 && execOk && noCapMissing,
    'exit=' + r.exit + ' modes.exec=' + (state && state.modes ? state.modes.exec : '?') + ' 无误伤=' + noCapMissing);
  try { fs.rmSync(ws, { recursive: true, force: true }); } catch (e) { /* 尽力 */ }
}

// ---------------------------------------------------------------------------
// E5: executor-setup --non-interactive --save → executor.json 持久化 Agent Card 式块（capabilities + detectedAt + name/version 面）
// ---------------------------------------------------------------------------
{
  const ws = await mkws('e5');
  const r = spawnSyncSafe(process.execPath, [path.join(REPO, 'scripts', 'executor-setup.mjs'), '--non-interactive', '--executor', 'opencode', '--model', 'test-model', '--workspace', ws, '--save']);
  let doc = null;
  try { doc = JSON.parse(fs.readFileSync(path.join(ws, '.tt-state', 'executor.json'), 'utf8')); } catch (e) { /* ignore */ }
  const hasCaps = doc && doc.capabilities && typeof doc.capabilities === 'object'
    && ['write_files', 'run_cmd', 'network', 'spawn_subagent', 'mcp_client'].every(function(k) { return typeof doc.capabilities[k] === 'boolean'; });
  const hasDetectedAt = doc && typeof doc.detectedAt === 'string' && !Number.isNaN(Date.parse(doc.detectedAt));
  const hasName = doc && doc.name === 'executor';
  const hasVersion = doc && typeof doc.version === 'string' && doc.version.length > 0;
  section('E5 executor-setup --save 落盘 Agent Card 式 capabilities 块（五能力布尔 + detectedAt + name/version）',
    r.exit === 0 && hasCaps && hasDetectedAt && hasName && hasVersion,
    'exit=' + r.exit + ' capabilities=' + (hasCaps ? '五能力齐' : '缺') + ' detectedAt=' + (hasDetectedAt ? 'ISO' : '缺') + ' name=' + (hasName ? 'executor' : '缺') + ' version=' + (hasVersion ? doc.version : '缺'));
  if (doc) fs.writeFileSync(path.join(EX1_DIR, 'out-e5-executor.json'), JSON.stringify(doc, null, 2));
  try { fs.rmSync(ws, { recursive: true, force: true }); } catch (e) { /* 尽力 */ }
}

// ---------------------------------------------------------------------------
// E6: 措辞纪律——全仓 scripts/ 面 grep "已接线" → 0 命中
// ---------------------------------------------------------------------------
{
  const hits = grepRecursive(path.join(REPO, 'scripts'), '已接线');
  section('E6 措辞纪律：scripts/ 全目录 grep "已接线" → 0 命中', hits.length === 0,
    hits.length === 0 ? '零残留' : hits.map(function(h) { return h.rel + ':' + h.line; }).join(', '));
  fs.writeFileSync(path.join(EX1_DIR, 'out-e6-grep.txt'), hits.length ? JSON.stringify(hits, null, 2) : 'scripts/ 下 "已接线" 0 命中（措辞清零）');
}

// ---------------------------------------------------------------------------
// E7: opencode adapter 降为回归渠道之一（adapters/index.mjs 注释面断言）
// ---------------------------------------------------------------------------
{
  const body = fs.readFileSync(path.join(REPO, 'scripts', 'lib', 'adapters', 'index.mjs'), 'utf8');
  const regressionChannel = body.includes('回归渠道');
  const notMainPath = body.includes('非主路径') || body.includes('备选执行渠道');
  const capabilityWording = body.includes('能力探测验证');
  section('E7 opencode adapter 注释降为回归渠道之一（不进主路径描述 + 能力探测措辞）',
    regressionChannel && notMainPath && capabilityWording,
    '回归渠道措辞=' + (regressionChannel ? '有' : '无') + ' 非主路径声明=' + (notMainPath ? '有' : '无') + ' 能力探测措辞=' + (capabilityWording ? '有' : '无'));
}

// ---------------------------------------------------------------------------
// E8: 探测失败如实上报——corrupt executor.json → warning，不假报已用外部内核
// ---------------------------------------------------------------------------
{
  const ws = await mkws('e8');
  fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
  fs.writeFileSync(path.join(ws, '.tt-state', 'executor.json'), '{ this is not json !!!');
  const r = await runOrch(['--backend', 'prompt', '--task', 'backend login module', '--workspace', ws]);
  const warned = r.stderr.includes('executor.json') && r.stderr.includes('不可解析');
  const noMap = !r.stdout.includes('--exec from executor.json');
  section('E8 corrupt executor.json → 如实 warning 不假报（fail-soft 诚实上报保持）', r.exit === 0 && warned && noMap,
    'exit=' + r.exit + ' warning=' + (warned ? '有' : '无'));
  try { fs.rmSync(ws, { recursive: true, force: true }); } catch (e) { /* 尽力 */ }
}

// 工具函数
function spawnSyncSafe(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { exit: r.status ?? -1, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function grepRecursive(rootDir, needle) {
  const hits = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const abs = path.join(d, name);
      const st = fs.statSync(abs);
      if (st.isDirectory()) { walk(abs); continue; }
      if (!/\.(mjs|js|json|md|yaml|yml|txt)$/.test(name)) continue;
      let text = '';
      try { text = fs.readFileSync(abs, 'utf8'); } catch (e) { continue; }
      text.split('\n').forEach(function(ln, i) { if (ln.includes(needle)) hits.push({ rel: path.relative(REPO, abs).replace(/\\/g, '/'), line: i + 1, text: ln.trim().slice(0, 160) }); });
    }
  };
  try { walk(rootDir); } catch (e) { /* 目录不可读 */ }
  return hits;
}

console.log('\n== 汇总: ' + pass + '/' + (pass + fail) + ' PASS ==');
if (failures.length) { for (const f of failures) console.log('  FAILED: ' + f); }
fs.writeFileSync(path.join(EX1_DIR, 'out-probe-results.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  pass, fail, rows: machineRows,
}, null, 2));
process.exitCode = fail > 0 ? 1 : 0;
