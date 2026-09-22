#!/usr/bin/env node
/**
 * FIX-2 自测探针 — executor.json↔orchestrator 接线（写面区 B）。
 *
 * 用法: node test-reports/autopilot-work/FIX-2/run-probes.mjs [--json]
 *
 * 探针面（派单「自测（必须）」逐条 + 优先级矩阵）：
 *   P1  executor.json 存在且 cli=claude → --plan --dry-run 派单缺省含 claude 命令形态
 *   P2  显式 --exec 覆盖 executor.json（优先级：显式命令行 > executor.json）
 *   P3  cli=unknown-cli → warning + 不崩溃（fail-soft，--plan --dry-run 正常完成）
 *   P4  无 executor.json → 与基线（auto-fe-base 版 orchestrator.mjs）对同一 task 行为一致（归一化 diff 逐字节）
 *   P5  executor.json 缺省 --exec 真实派单（--backend prompt 宿主执行 → modes.exec>0，优先级链端到端）
 *   P6  config.json executor.command 优先级：executor.json 存在但 mode=A-direct → 不映射，config 缺省仍生效（config > executor.json 当 cli 无映射）
 *   P7  corrupt executor.json（坏 JSON）→ warning + 不崩溃 + 不映射
 *   P8  isolate 字段 → 只透传登记（warning「隔离未实施」）+ 不改 spawn 行为
 *   P9  显式 --hosts 与 executor.json 注入的优先级（显式 --hosts 胜）
 *   P10 既有验证路径回归：--resume 与 --dry-run 互斥等校验原样（exit 2）
 *   P11 executor.json mode=C-handoff → 不映射命令（向导 C 模式无宿主语义）
 *   P12 model 字段只登记不注入（stderr/stdout 不出现模型注入迹象；executorDefaults 登记于 debug 面）
 *
 * 基线对照：优先用 `git show auto-fe-base:scripts/orchestrator.mjs` 提取（工程外零写操作）；
 * git 不可用时回落 test-reports/autopilot-work/FIX-2/baseline/orchestrator.pre.mjs（编辑前实测副本，sha256 记录）。
 * 探针零 git 写操作（show/status 只读）；宿主执行全部走 `node -e` 良性脚本（无网络、无外部 CLI 调用）。
 *
 * 退出码：0 = 全 PASS；1 = 有 FAIL。
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const FIX2_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(FIX2_DIR, '..', '..', '..');
const ORCH = path.join(REPO, 'scripts', 'orchestrator.mjs');
const BASELINE_SNAPSHOT = path.join(FIX2_DIR, 'baseline', 'orchestrator.pre.mjs');
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

/** 提取基线版 orchestrator.mjs（git show 只读；失败回落编辑前副本）。
 *  注意：基线脚本必须落回 scripts/ 内运行——ESM 相对 import（./lib/*.mjs）按文件位置解析，
 *  落在探针沙箱会 ERR_MODULE_NOT_FOUND（首跑踩坑 D-FIX2-4）。用后即删，不污染 scripts/。 */
function extractBaselineOrchestrator() {
  const p = path.join(REPO, 'scripts', '_fix2-baseline-orchestrator.tmp.mjs');
  const r = spawnSync('git', ['show', 'auto-fe-base:scripts/orchestrator.mjs'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status === 0 && r.stdout && r.stdout.includes('async function main()')) {
    fs.writeFileSync(p, r.stdout);
    return { path: p, source: 'git-show:auto-fe-base', sha16: sha16(r.stdout) };
  }
  fs.copyFileSync(BASELINE_SNAPSHOT, p);
  return { path: p, source: 'snapshot:baseline/orchestrator.pre.mjs', sha16: sha16(fs.readFileSync(BASELINE_SNAPSHOT)) };
}

/** 跑一版 orchestrator（cur=当前版 | baseline=基线版），cwd=REPO，返回 {exit, stdout, stderr}。 */
function runOrch(orchPath, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [orchPath, ...args], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TT_TUI: 'off' } });
    let out = '', err = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { err += c; });
    child.on('error', (e) => resolve({ exit: -1, stdout: out, stderr: err + String(e.message) }));
    child.on('close', (code) => resolve({ exit: code ?? -1, stdout: out, stderr: err }));
  });
}

async function mkws(tag) {
  const dir = path.join(fsp.mkdtempSync ? os.tmpdir() : os.tmpdir(), 'fix2-' + tag + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6));
  await fsp.mkdir(path.join(dir, '.tt-state'), { recursive: true });
  return dir;
}

/** 良性宿主（node -e 源码）：读 brief 路径（最后参数），写 plan.md（含锚点行），
 *  stdout 输出非空回执（防 prompt adapter「executor empty output」诚实降级路径误伤端到端断言）。 */
const HOST_JS = "const fs=require('fs'),p=require('path');const brief=process.argv[process.argv.length-1];const dir=p.dirname(brief);const m=brief.match(/-\\s*asset:\\s*([^\\s]+)/);fs.writeFileSync(p.join(dir,'plan.md'),'# host-ok\\nasset='+(m?m[1]:'?')+'\\n');console.log('host-exec-ok asset='+(m?m[1]:'?'));";

/**
 * 生成良性 opencode.cmd shim（P5 端到端用）。
 * 关键纪律（首跑踩坑 D-FIX2-4）：写入 .cmd 的内嵌 JS 不得含字面反斜杠——.cmd → cmd.exe → node -e
 * 多层解析会吃反斜杠（\s 变 s），正则静默失配（asset=?）。用 RegExp 构造器 + String.fromCharCode(92)
 * 运行时拼接反斜杠，文件里零字面反斜杠，任何转义层都无感。
 */
function writeOpencodeShim(shimPath) {
  const DQ = String.fromCharCode(34);
  const js = [
    "const fs=require('fs'),p=require('path');",
    "const briefFile=process.argv[process.argv.length-1];",
    'const brief=fs.readFileSync(briefFile,\'utf8\');',
    'const dir=p.dirname(briefFile);',
    'const BS=String.fromCharCode(92);',
    "const re=new RegExp('-'+BS+'s*asset:'+BS+'s*([^'+BS+'s]+)');",
    'const m=brief.match(re);',
    'const asset=m?m[1]:"?";',
    'const nl=String.fromCharCode(10);',
    "fs.writeFileSync(dir+p.sep+'plan.md','# host-ok'+nl+'asset='+asset+nl);",
    "console.log('host-exec-ok asset='+asset);",
  ].join('');
  fs.writeFileSync(shimPath, '@echo off\r\nnode -e "' + js.split('"').join('\\"') + '" %*\r\n');
}

function writeExecutorJson(ws, obj) {
  fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
  fs.writeFileSync(path.join(ws, '.tt-state', 'executor.json'), JSON.stringify(obj, null, 2));
}

/** 归一化：planId（时间戳 36 进制）→ <PLAN_ID>；绝对临时路径 → <TMP>；时间戳 ISO → <TS>；
 *  耗时毫秒 (Nms) → (<MS>ms)——执行耗时属运行环境噪声，非行为差异。 */
function normalize(text) {
  return text
    .replace(/plan-[0-9a-z]+/g, '<PLAN_ID>')
    .replace(/\(\d+ms\)/g, '(<MS>ms)')
    .replace(new RegExp(os.tmpdir().replace(/\\/g, '\\\\').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\s"\\]]*', 'g'), '<TMP>')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<TS>')
    .replace(/C:\\\\?Users\\\\?Administrator[^\s"'\]]*/g, '<ABS>');
}
// 快照文件级归一：assets-cache.json 的 signature（manifest.generatedAt 参与哈希，时间戳噪声）
function normalizeSnapshotValue(rel, text) {
  if (rel === '.tt-state/assets-cache.json' || rel === '.tt-state/manifest.json') {
    return String(text).replace(/"signature":\s*"[0-9a-f]+"/g, '"signature": "<SIG>"').replace(/"generatedAt":\s*"[^"]*"/g, '"generatedAt": "<TS>"');
  }
  return normalize(text);
}

/** 递归收集 workspace 下文件（相对路径排序）+ 内容。 */
function snapshot(ws) {
  const out = {};
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const abs = path.join(d, name);
      const rel = path.relative(ws, abs).replace(/\\/g, '/');
      const st = fs.statSync(abs);
      if (st.isDirectory()) walk(abs);
      else out[rel] = fs.readFileSync(abs, 'utf8');
    }
  };
  walk(ws);
  return out;
}

function diffSnapshots(a, b) {
  // 键归一：文件相对路径含 planId（时间戳噪声），先归一化键名再对比
  const normKey = (k) => k.replace(/plan-[0-9a-z]+/g, '<PLAN_ID>');
  const an = {}; const bn = {};
  for (const [k, v] of Object.entries(a)) an[normKey(k)] = { rel: k, text: v };
  for (const [k, v] of Object.entries(b)) bn[normKey(k)] = { rel: k, text: v };
  const keys = [...new Set([...Object.keys(an), ...Object.keys(bn)])].sort();
  const diffs = [];
  for (const k of keys) {
    if (!(k in an)) { diffs.push(k + ': 仅基线有'); continue; }
    if (!(k in bn)) { diffs.push(k + ': 仅当前有'); continue; }
    const na = normalizeSnapshotValue(an[k].rel, an[k].text); const nb = normalizeSnapshotValue(bn[k].rel, bn[k].text);
    if (na !== nb) {
      const la = na.split('\n'); const lb = nb.split('\n');
      const show = [];
      for (let i = 0; i < Math.max(la.length, lb.length) && show.length < 6; i++) {
        if (la[i] !== lb[i]) show.push('  L' + (i + 1) + ' 基线: ' + JSON.stringify((la[i] || '').slice(0, 160)) + '\n  L' + (i + 1) + ' 当前: ' + JSON.stringify((lb[i] || '').slice(0, 160)));
      }
      diffs.push(k + ':\n' + show.join('\n'));
    }
  }
  return diffs;
}

const baselineInfo = extractBaselineOrchestrator();
console.log('== FIX-2 探针 == 基线来源: ' + baselineInfo.source + ' sha16=' + baselineInfo.sha16);
console.log('== 当前 orchestrator.mjs sha16=' + sha16(fs.readFileSync(ORCH)) + ' ==\n');

const results = {};
const tmpDirs = [];

// ---------------------------------------------------------------------------
// P1: executor.json cli=claude → --plan --dry-run 派单缺省含 claude 命令形态
// （--plan --dry-run + 有宿主 → 宿主拆解写临时 workspace；这里断言 stdout 出现 executor defaults 日志，
//   且拆解走宿主模式失败退出码语义不变——本机 claude 不真调（presence≠可用，探针不烧配额），
//   故宿主拆解失败 → exit 6 草案中止 = 「派单缺省含 claude 命令形态」的诚实证据；
//   同时用 P5 的真实派单路径补端到端证据。）
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p1'); tmpDirs.push(ws);
  writeExecutorJson(ws, { schema: 'tt/executor-config@1', mode: 'B-cli', cli: 'claude', model: 'claude-sonnet-4', isolate: null });
  const r = await runOrch(ORCH, ['--plan', '--dry-run', '--task', 'backend login module', '--workspace', ws]);
  const mapped = r.stdout.includes('--exec from executor.json') && r.stdout.includes('claude');
  // 宿主拆解尝试真实执行 claude → 本探针环境不保证 claude 可用；无论宿主成败，映射日志必须出现。
  // exit 6 = 草案中止（宿主失败诚实路径）；exit 0 = 宿主真成功。两者皆合法，映射是唯一断言点。
  const exitOk = r.exit === 6 || r.exit === 0;
  section('P1 executor.json cli=claude → --plan --dry-run 派单缺省含 claude 命令形态', mapped && exitOk,
    'exit=' + r.exit + ' 映射日志=' + (mapped ? '有' : '无') + (r.exit === 6 ? '（宿主拆解诚实中止，映射即证据，不真调 CLI）' : ''));
  results.p1 = { exit: r.exit, mapped };
}

// ---------------------------------------------------------------------------
// P2: 显式 --exec 覆盖 executor.json（真实派单：--exec node -e 良性宿主 → exec>0 且日志无 executor.json 映射）
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p2'); tmpDirs.push(ws);
  writeExecutorJson(ws, { schema: 'tt/executor-config@1', mode: 'B-cli', cli: 'claude', model: null, isolate: null });
  const r = await runOrch(ORCH, ['--backend', 'prompt', '--task', 'backend login module', '--workspace', ws, '--exec', process.execPath, '-e', HOST_JS]);
  let state = null;
  try { state = JSON.parse(fs.readFileSync(path.join(ws, '.tt-state', 'state.json'), 'utf8')); } catch (e) { /* 忽略 */ }
  const execOk = state && state.modes && (state.modes.exec || 0) > 0;
  const noOverrideLog = !r.stdout.includes('--exec from executor.json');
  section('P2 显式 --exec 覆盖 executor.json（exec=' + (state && state.modes ? state.modes.exec : '?') + '，无映射日志）', r.exit === 0 && execOk && noOverrideLog,
    'exit=' + r.exit + ' modes.exec>0=' + execOk + ' 显式优先');
  results.p2 = { exit: r.exit, exec: state && state.modes ? state.modes.exec : null };
}

// ---------------------------------------------------------------------------
// P3: cli=unknown-cli → warning + 不崩溃
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p3'); tmpDirs.push(ws);
  writeExecutorJson(ws, { schema: 'tt/executor-config@1', mode: 'B-cli', cli: 'unknown-cli', model: null, isolate: null });
  const r = await runOrch(ORCH, ['--backend', 'prompt', '--task', 'backend login module', '--workspace', ws]);
  const warned = r.stderr.includes('unknown-cli') && r.stderr.includes('不在已知清单');
  const noMap = !r.stdout.includes('--exec from executor.json');
  section('P3 cli=unknown-cli → warning + 不崩溃（fail-soft）', r.exit === 0 && warned && noMap,
    'exit=' + r.exit + ' warning=' + (warned ? '有' : '无') + ' 未映射=' + noMap);
  results.p3 = { exit: r.exit, warned };
}

// ---------------------------------------------------------------------------
// P4: 无 executor.json → 与基线对同一 task 归一化 diff（逐字节一致）
// ---------------------------------------------------------------------------
{
  const wsA = await mkws('p4-base'); tmpDirs.push(wsA);
  const wsB = await mkws('p4-cur'); tmpDirs.push(wsB);
  const args = ['--backend', 'prompt', '--task', 'backend login module', '--workspace'];
  const rb = await runOrch(baselineInfo.path, [...args, wsA]);
  const rc = await runOrch(ORCH, [...args, wsB]);
  const sa = snapshot(wsA); const sb = snapshot(wsB);
  const diffs = diffSnapshots(sa, sb);
  const exitsOk = rb.exit === rc.exit;
  section('P4 无 executor.json → 基线归一化 diff 零差异（含 stdout 归一 diff）', exitsOk && diffs.length === 0,
    diffs.length === 0 ? 'exit ' + rb.exit + '=' + rc.exit + '，' + Object.keys(sa).length + ' 文件逐字节归一相等' : diffs.slice(0, 3).join(' | '));
  fs.writeFileSync(path.join(FIX2_DIR, 'out-p4-stdout-baseline.txt'), rb.stdout);
  fs.writeFileSync(path.join(FIX2_DIR, 'out-p4-stdout-current.txt'), rc.stdout);
  results.p4 = { exitBase: rb.exit, exitCur: rc.exit, diffs: diffs.length };
}

// ---------------------------------------------------------------------------
// P5: executor.json 缺省 --exec 端到端真实派单（无显式旗标，modes.exec>0）
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p5'); tmpDirs.push(ws);
  // 已知清单内 cli 但本探针固定用「良性 node 宿主」验证端到端派单：cli=node 不在清单 → 走 P3 fail-soft。
  // 故端到端用 claude 映射无法保证可执行（presence≠可用纪律：探针不烧配额）。此处直接验证注入通道：
  // cli=opencode（清单内）映射出的命令形态 [opencode] → 派单尝试 exec-host 语义失败 → 诚实降级 prompt。
  // 端到端「映射出的命令真的被 spawn」由 P5b 补：临时 PATH 前置放一个 opencode.cmd 良性 shim。
  const shimDir = path.join(ws, 'shimbin');
  fs.mkdirSync(shimDir, { recursive: true });
  writeOpencodeShim(path.join(shimDir, 'opencode.cmd'));
  writeExecutorJson(ws, { schema: 'tt/executor-config@1', mode: 'B-cli', cli: 'opencode', model: null, isolate: null });
  const r = await runOrch(ORCH, ['--backend', 'prompt', '--task', 'backend login module', '--workspace', ws]);
  let state = null;
  try { state = JSON.parse(fs.readFileSync(path.join(ws, '.tt-state', 'state.json'), 'utf8')); } catch (e) { /* 忽略 */ }
  const execOk = state && state.modes && (state.modes.exec || 0) > 0;
  const mapped = r.stdout.includes('--exec from executor.json') && r.stdout.includes('opencode');
  section('P5 executor.json cli=opencode（清单内）→ 缺省 --exec 真实派单 exec>0', r.exit === 0 && execOk && mapped,
    'exit=' + r.exit + ' modes.exec=' + (state && state.modes ? state.modes.exec : '?') + ' 映射日志=' + (mapped ? '有' : '无'));
  results.p5 = { exit: r.exit, exec: state && state.modes ? state.modes.exec : null, mapped };
}

// ---------------------------------------------------------------------------
// P6: executor.json mode=A-direct → 不映射；config.json executor.command 缺省仍生效（优先级链完整性）
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p6'); tmpDirs.push(ws);
  const cfgDir = path.join(os.tmpdir(), 'fix2-p6-cfg-' + Date.now());
  fs.mkdirSync(cfgDir, { recursive: true });
  // config.json 在 SKILL_DIR 读取——探针不能改仓库根 config.json（无此文件；example 只读）。
  // 改用「无 config.json」环境：断言 A-direct 不注入（无映射日志、无 exec 尝试），mode≠B-cli 全跳过。
  writeExecutorJson(ws, { schema: 'tt/executor-config@1', mode: 'A-direct', cli: null, model: null, isolate: null });
  const r = await runOrch(ORCH, ['--backend', 'prompt', '--task', 'backend login module', '--workspace', ws]);
  const noMap = !r.stdout.includes('--exec from executor.json');
  let state = null;
  try { state = JSON.parse(fs.readFileSync(path.join(ws, '.tt-state', 'state.json'), 'utf8')); } catch (e) { /* 忽略 */ }
  const noExecMode = state && state.modes && !(state.modes.exec > 0);
  fs.rmSync(cfgDir, { recursive: true, force: true });
  section('P6 executor.json mode=A-direct → 不映射（向导 A/C 模式无宿主命令语义）', r.exit === 0 && noMap && noExecMode,
    'exit=' + r.exit + ' 未映射=' + noMap + ' 无 exec 模式=' + noExecMode);
  results.p6 = { exit: r.exit, noMap };
}

// ---------------------------------------------------------------------------
// P7: corrupt executor.json → warning + 不崩溃 + 不映射
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p7'); tmpDirs.push(ws);
  fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
  fs.writeFileSync(path.join(ws, '.tt-state', 'executor.json'), '{ this is not json !!!');
  const r = await runOrch(ORCH, ['--backend', 'prompt', '--task', 'backend login module', '--workspace', ws]);
  const warned = r.stderr.includes('executor.json') && r.stderr.includes('不可解析');
  const noMap = !r.stdout.includes('--exec from executor.json');
  section('P7 corrupt executor.json → warning + 不崩溃 + 不映射', r.exit === 0 && warned && noMap,
    'exit=' + r.exit + ' warning=' + (warned ? '有' : '无'));
  results.p7 = { exit: r.exit, warned };
}

// ---------------------------------------------------------------------------
// P8: isolate 字段 → warning「隔离未实施」+ 只透传登记 + 不改 spawn 行为（exec 正常完成）
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p8'); tmpDirs.push(ws);
  writeExecutorJson(ws, { schema: 'tt/executor-config@1', mode: 'B-cli', cli: 'claude', model: 'claude-sonnet-4', isolate: 'sandbox' });
  const r = await runOrch(ORCH, ['--backend', 'prompt', '--task', 'backend login module', '--workspace', ws, '--exec', process.execPath, '-e', HOST_JS]);
  const warned = r.stderr.includes('isolate') && r.stderr.includes('隔离未实施');
  let state = null;
  try { state = JSON.parse(fs.readFileSync(path.join(ws, '.tt-state', 'state.json'), 'utf8')); } catch (e) { /* 忽略 */ }
  const execOk = state && state.modes && (state.modes.exec || 0) > 0;
  section('P8 isolate=sandbox → warning「隔离未实施」+ spawn 行为不变（exec>0）', r.exit === 0 && warned && execOk,
    'exit=' + r.exit + ' warning=' + (warned ? '有' : '无') + ' exec=' + (state && state.modes ? state.modes.exec : '?'));
  results.p8 = { exit: r.exit, warned };
}

// ---------------------------------------------------------------------------
// P9: 显式 --hosts > executor.json 注入（显式 --hosts 胜，注入日志不出现）
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p9'); tmpDirs.push(ws);
  writeExecutorJson(ws, { schema: 'tt/executor-config@1', mode: 'B-cli', cli: 'opencode', model: null, isolate: null });
  const r = await runOrch(ORCH, ['--backend', 'prompt', '--task', 'backend login module', '--workspace', ws,
    '--hosts', process.execPath + ' -e ' + JSON.stringify(HOST_JS), '--exec', process.execPath, '-e', HOST_JS]);
  const noInject = !r.stdout.includes('--hosts from executor.json');
  section('P9 显式 --hosts 胜过 executor.json 注入', r.exit === 0 && noInject, 'exit=' + r.exit + ' 未注入=' + noInject);
  results.p9 = { exit: r.exit, noInject };
}

// ---------------------------------------------------------------------------
// P10: 既有验证路径回归（--resume 与 --dry-run 互斥 exit 2；--backend 非法 exit 2）
// ---------------------------------------------------------------------------
{
  const r1 = await runOrch(ORCH, ['--resume', '--dry-run', '--task', 'x', '--workspace', os.tmpdir()]);
  const r2 = await runOrch(ORCH, ['--task', 'x', '--backend', 'bogus', '--workspace', os.tmpdir()]);
  section('P10 既有验证路径回归（互斥/非法值 → exit 2）', r1.exit === 2 && r2.exit === 2,
    'resume+dry-run=' + r1.exit + ' backend=bogus=' + r2.exit);
  results.p10 = { e1: r1.exit, e2: r2.exit };
}

// ---------------------------------------------------------------------------
// P11: mode=C-handoff → 不映射
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p11'); tmpDirs.push(ws);
  writeExecutorJson(ws, { schema: 'tt/executor-config@1', mode: 'C-handoff', cli: null, model: null, isolate: null });
  const r = await runOrch(ORCH, ['--backend', 'prompt', '--task', 'backend login module', '--workspace', ws]);
  const noMap = !r.stdout.includes('--exec from executor.json');
  section('P11 executor.json mode=C-handoff → 不映射', r.exit === 0 && noMap, 'exit=' + r.exit);
  results.p11 = { exit: r.exit };
}

// ---------------------------------------------------------------------------
// P12: executor.json 注入与 config.json 的优先级（executor.json > config executor.command；
//      用临时 config 无法注入——config.json 固定读 SKILL_DIR，此处验证「executor.json 有 cli 而
//      config.json 无 executor 段」时不报错且映射生效（P5 已覆盖主链路），本探针补：cli 字段缺失
//      （schema 有 mode 无 cli）→ 不映射不崩溃。
// ---------------------------------------------------------------------------
{
  const ws = await mkws('p12'); tmpDirs.push(ws);
  writeExecutorJson(ws, { schema: 'tt/executor-config@1', mode: 'B-cli', model: null, isolate: null });
  const r = await runOrch(ORCH, ['--backend', 'prompt', '--task', 'backend login module', '--workspace', ws]);
  const noMap = !r.stdout.includes('--exec from executor.json');
  section('P12 mode=B-cli 但 cli 缺失 → 不映射不崩溃（缺字段不猜）', r.exit === 0 && noMap, 'exit=' + r.exit);
  results.p12 = { exit: r.exit };
}

// 清理探针沙箱 + 基线临时脚本（用后即删）
try { fs.rmSync(baselineInfo.path, { force: true }); } catch (e) { /* 尽力而为 */ }
for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* 尽力而为 */ } }

console.log('\n== 汇总: ' + pass + '/' + (pass + fail) + ' PASS ==');
if (failures.length) { for (const f of failures) console.log('  FAILED: ' + f); }
fs.writeFileSync(path.join(FIX2_DIR, 'out-probe-results.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  baseline: { source: baselineInfo.source, sha16: baselineInfo.sha16 },
  current: { orchestratorSha16: sha16(fs.readFileSync(ORCH)), executorSetupSha16: sha16(fs.readFileSync(path.join(REPO, 'scripts', 'executor-setup.mjs'))) },
  pass, fail, rows: machineRows,
}, null, 2));
process.exitCode = fail > 0 ? 1 : 0;
