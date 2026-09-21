#!/usr/bin/env node
/**
 * FIX-4 自测探针 — --validate-handoff 冒号列表加固（写面区 C）。
 * 派单：handoffs/fix/FIX-4-dispatch.md。零 npm 依赖；node >= 18。
 *
 * 探针（P1–P8）：
 *   P1 正向：正文含「说明: xxx」冒号列表的合法报告 → PASS(0)，三字段值不被污染
 *   P2 负向：正文含 `foo: bar` 但缺三必填 → FAIL(1)，列出 taskId/taskVerdict/evidencePaths
 *   P3 负向：三必填字段误拼（taskid 小写）→ FAIL(1)，列缺 taskId（不猜不纠正）
 *   P4 回归：完整 executor-setup 骨架同构报告（含中文节名/占位） → PASS(0)
 *   P5 回归：目录缺失 / REPORT.md 缺失 → FAIL(1) 不猜
 *   P6 回归：evidencePaths 空值 + "- 列表" 多行收集在加固后仍工作 → PASS(0)，列表项并入值
 *   P7 回归：--help(0) / 空 workspace 列表(0) / --latest 空(1) 行为不变
 *   P8 回归：字段齐但 evidencePaths 值为空（无列表续） → FAIL(1)「字段存在但值为空」
 *
 * 沙箱：<本目录>/.sandbox/run-<stamp>-<pid>/，跑完保留（结果原样留证）。
 * 夹具 REPORT.md 由本探针生成于沙箱内；不触碰仓库任何既有 artifacts/。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..'); // FIX-4 → autopilot-work → test-reports → yy（3 级）
const SUMMARY = path.join(REPO, 'scripts', 'summary-read.mjs');
const STAMP = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14) + '-' + process.pid;
const SANDBOX = path.join(HERE, '.sandbox', 'run-' + STAMP);
fs.mkdirSync(SANDBOX, { recursive: true });

const results = [];

function runNode(args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, Object.assign({ stdio: ['ignore', 'pipe', 'pipe'], env: process.env, cwd: REPO }, opts));
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.on('error', (e) => resolve({ code: -1, stdout, stderr: String(e.message || e) }));
  });
}

function check(id, desc, cond, detail = '') {
  const pass = cond === true;
  results.push({ id, desc, pass, detail: String(detail) });
  console.log('[' + (pass ? 'PASS' : 'FAIL') + '] ' + id + ' ' + desc + (detail ? '  · ' + detail : ''));
}

function writeReport(relDir, content) {
  const dir = path.join(SANDBOX, relDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'REPORT.md'), content, 'utf8');
  return dir;
}

// --- P1 正向：冒号列表正文 + 三必填（列表前） → PASS ---
{
  const dir = writeReport('p01-good', [
    '# 回填报告 — T-01', '',
    '## 本子任务', '',
    '- 说明: 执行 FIX-4 加固并自测',   // 冒号列表项（正文，白名单外键样行）
    '- 落点: scripts/summary-read.mjs', // 另一个冒号列表项
    '', '## 交付证据', '',
    'taskId: T-01',
    'taskVerdict: PASS',
    'evidencePaths:',
    '- test-reports/autopilot-work/FIX-4/RESULTS.md',
    '- scripts/summary-read.mjs',
  ].join('\n'));
  const r = await runNode([SUMMARY, '--validate-handoff', dir]);
  check('P1', '正向：正文含「说明:/落点:」冒号列表 → PASS(0) 且三字段值不被污染',
    r.code === 0 && /PASS/.test(r.stdout) && /"taskId": "T-01"/.test(r.stdout) && /"taskVerdict": "PASS"/.test(r.stdout)
      && /"evidencePaths": ".*RESULTS\.md,.*summary-read\.mjs"/.test(r.stdout) && !/说明/.test(r.stdout) && !/落点/.test(r.stdout),
    'exit=' + r.code);
}

// --- P2 负向：正文含 foo: bar 但缺三必填 → FAIL(1) ---
{
  const dir = writeReport('p02-missing', [
    '# 回填报告', '', '正文写了些说明:', '', 'foo: bar', 'another: value', '',
  ].join('\n'));
  const r = await runNode([SUMMARY, '--validate-handoff', dir]);
  check('P2', '负向：正文含 foo: bar 但缺三必填 → FAIL(1) 且三条缺字段全列',
    r.code === 1 && /缺字段: taskId/.test(r.stderr) && /缺字段: taskVerdict/.test(r.stderr) && /缺字段: evidencePaths/.test(r.stderr) && /FAIL/.test(r.stderr),
    'exit=' + r.code);
}

// --- P3 负向：taskid 小写误拼 → FAIL(1)（区分大小写，不猜） ---
{
  const dir = writeReport('p03-wrongcase', [
    '# 回填报告', '', 'taskid: T-01', 'taskVerdict: PASS', 'evidencePaths: a.log', '',
  ].join('\n'));
  const r = await runNode([SUMMARY, '--validate-handoff', dir]);
  check('P3', '负向：taskid 小写误拼 → FAIL(1) 缺 taskId（不猜不纠正）',
    r.code === 1 && /缺字段: taskId/.test(r.stderr) && !/缺字段: taskVerdict/.test(r.stderr) && !/缺字段: evidencePaths/.test(r.stderr),
    'exit=' + r.code);
}

// --- P4 回归：executor-setup 骨架同构完整报告 → PASS ---
{
  const dir = writeReport('p04-skeleton', [
    '# 交接 brief — T-02（plan demo）', '',
    '> 由 `scripts/executor-setup.mjs` 交接模式生成（schema tt/handoff-brief@1）。',
    '> 回填报告约定路径：`artifacts/demo/reports/T-02/REPORT.md`。', '',
    '## 回填报告必填字段（机器校验）', '',
    '缺任一字段校验 FAIL（缺字段不猜，不推断不补全）：', '',
    '- taskId: T-02',
    '- taskVerdict: PASS',
    '- evidencePaths: test-reports/autopilot-work/FIX-4/RESULTS.md', '',
    '## 本子任务', '',
    '- 说明: <占位：任务说明，派单时补齐>', '',
    '## 必读', '',
    '- <占位：必读材料清单，派单时补齐>', '',
    '## 交付物', '',
    '- <占位：交付物清单，派单时补齐>', '',
    '## 允许写入（白名单）', '',
    '- <占位：写入白名单；白名单外一律禁止>', '',
    '## 禁止施工', '',
    '- 白名单外一律禁止；状态: 未开始',  // 冒号列表项 + 冒号内嵌
  ].join('\n'));
  const r = await runNode([SUMMARY, '--validate-handoff', dir]);
  check('P4', '回归：executor-setup 骨架同构（占位冒号列表密集）→ PASS(0) 值不污染',
    r.code === 0 && /"taskId": "T-02"/.test(r.stdout) && /"taskVerdict": "PASS"/.test(r.stdout)
      && /"evidencePaths": "test-reports\/autopilot-work\/FIX-4\/RESULTS\.md"/.test(r.stdout) && !/占位/.test(r.stdout) && !/未开始/.test(r.stdout),
    'exit=' + r.code);
}

// --- P5 回归：目录缺失 / REPORT.md 缺失 → FAIL(1) ---
{
  const missingDir = path.join(SANDBOX, 'p05-no-such-dir');
  const rMissing = await runNode([SUMMARY, '--validate-handoff', missingDir]);
  const emptyDir = path.join(SANDBOX, 'p05-empty-dir');
  fs.mkdirSync(emptyDir, { recursive: true });
  const rNoReport = await runNode([SUMMARY, '--validate-handoff', emptyDir]);
  check('P5', '回归：目录缺失 / REPORT.md 缺失 → FAIL(1) 不猜',
    rMissing.code === 1 && /REPORT\.md 不可读/.test(rMissing.stderr) && rNoReport.code === 1 && /REPORT\.md 不可读/.test(rNoReport.stderr),
    'missing-dir=' + rMissing.code + ' no-report=' + rNoReport.code);
}

// --- P6 回归：evidencePaths 空值 + "- 列表" 多行收集（加固后仍工作） ---
{
  const dir = writeReport('p06-evidence-list', [
    'taskId: T-03', 'taskVerdict: PARTIAL', 'evidencePaths:', '- e1.log', '- e2.log', '',
    '备注: 正文冒号行在列表之后', '',
  ].join('\n'));
  const r = await runNode([SUMMARY, '--validate-handoff', dir]);
  check('P6', '回归：evidencePaths 空值 + "- 列表" 收集 → PASS(0) 列表项并入值、后续冒号行不入',
    r.code === 0 && /"evidencePaths": "e1\.log,e2\.log"/.test(r.stdout) && !/备注/.test(r.stdout),
    'exit=' + r.code);
}

// --- P7 回归：--help / 空 workspace 列表 / --latest 空 ---
{
  const rHelp = await runNode([SUMMARY, '--help']);
  const emptyWs = path.join(SANDBOX, 'p07-empty-ws');
  fs.mkdirSync(emptyWs, { recursive: true });
  const rList = await runNode([SUMMARY, '--workspace', emptyWs]);
  const rLatest = await runNode([SUMMARY, '--workspace', emptyWs, '--latest']);
  check('P7', '回归：--help(0) / 空 workspace 列表(0) / --latest 空(1) 行为不变',
    rHelp.code === 0 && /--validate-handoff/.test(rHelp.stdout)
      && rList.code === 0 && /无 state-summary\.json/.test(rList.stdout)
      && rLatest.code === 1 && /无 state-summary\.json/.test(rLatest.stderr),
    'help=' + rHelp.code + ' list=' + rList.code + ' latest=' + rLatest.code);
}

// --- P8 负向：字段齐但 evidencePaths 值为空（无列表续） → FAIL(1) ---
{
  const dir = writeReport('p08-empty-evidence', [
    'taskId: T-04', 'taskVerdict: PASS', 'evidencePaths:', '', '说明: 证据忘了填', '',
  ].join('\n'));
  const r = await runNode([SUMMARY, '--validate-handoff', dir]);
  check('P8', '负向：evidencePaths 存在但值为空 → FAIL(1)「字段存在但值为空」',
    r.code === 1 && /字段存在但值为空: evidencePaths/.test(r.stderr),
    'exit=' + r.code);
}

// --- P9 加固核心：ASCII 说明冒号行插在 evidencePaths 与其列表之间 → 不再劫持收集 ---
{
  const dir = writeReport('p09-note-between', [
    'taskId: T-05', 'taskVerdict: PASS', 'evidencePaths:',
    'note: 证据清单如下',   // ASCII 键样行（基线把它当 key 抢走收集 → evidencePaths 空 → 误 FAIL）
    '- a.log', '- b.log', '',
  ].join('\n'));
  const r = await runNode([SUMMARY, '--validate-handoff', dir]);
  check('P9', '加固核心：ASCII 冒号行插在 evidencePaths 与列表之间 → PASS(0) 列表完整收集',
    r.code === 0 && /"evidencePaths": "a\.log,b\.log"/.test(r.stdout) && !/note:/.test(r.stdout) && !/"note"/.test(r.stdout),
    'exit=' + r.code);
}

fs.writeFileSync(path.join(HERE, 'out-probe-results.json'), JSON.stringify({
  probe: 'FIX-4 validate-handoff colon-list hardening',
  generatedAt: new Date().toISOString(),
  summary: results.length + '/' + results.length + ' PASS',
  sandbox: SANDBOX,
  results,
}, null, 2) + '\n', 'utf8');

const failed = results.filter((r) => !r.pass);
console.log('');
console.log('== 汇总: ' + (results.length - failed.length) + '/' + results.length + ' PASS ==');
process.exitCode = failed.length ? 1 : 0;
