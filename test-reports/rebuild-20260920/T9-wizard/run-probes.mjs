#!/usr/bin/env node
/**
 * T9-wizard 自测探针 runner（test-reports/rebuild-20260920/T9-wizard/）。
 *
 * 覆盖派单验收面七项：
 *   p01 presence 分档（结构 + YES/NO 两档 + 非交互形态登记）
 *   p02 presence 诚实性（不存在 CLI = PRESENCE_NO，绝不给出可用性结论）
 *   p03 roundtrip 成功路径（mock CLI 真 stdin 往返 → ROUNDTRIP_OK）
 *   p04 roundtrip 超时路径（mock CLI 挂起 → ROUNDTRIP_TIMEOUT）
 *   p05 non-interactive 缺信息 fail-closed（exit 2 + 指引，不猜）
 *   p06 non-interactive flags 读取 + --save withLock 落盘 + 读取顺序（显式 > executor.json）
 *   p07 executor.json withLock 并发写（双进程并发 save，文件不互踩不损坏）
 *   p08 交接 schema：brief 骨架生成 + 拒绝覆盖（--force 才可重建）
 *   p09 交接 schema 校验：--validate-handoff 缺字段 FAIL / 齐字段 PASS
 *   p10 中文/空格路径全流程（workspace 含中文+空格）
 *   p11 配置指引文档版本字段存在性（三份 docs/executor-setup/*.md）
 *   p12 summary-read 既有模式回归（--help / 空 workspace 列表 exit 0，仅追加未破坏既有功能）
 *
 * 沙箱：<本目录>/.sandbox/run-<stamp>-<pid>/，跑完不清理本轮（结果原样留证），
 * 仅在收尾修剪历史 run-*：只保留最近 RETAIN_RUNS 个（防爆盘）。
 * mock CLI：mock-cli-ok.mjs（回 OK）/ mock-cli-hang.mjs（挂起）——经 TT_EXECSETUP_<NAME>
 * 环境变量注入，不经 PATH，不碰真实 CLI、不消耗真实 API 配额、不执行任何仓库业务代码。
 *
 * 零 npm；ESM；node >= 18。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 沙箱修剪保留数：跑完不清理本轮（结果原样留证），仅修剪历史 run-* 目录、
// 只保留最近 RETAIN_RUNS 个，防止 .sandbox 无限膨胀爆盘。
const RETAIN_RUNS = 5;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..'); // T9-wizard → rebuild-20260920 → test-reports → yy
const WIZARD = path.join(REPO, 'scripts', 'executor-setup.mjs');
const SUMMARY = path.join(REPO, 'scripts', 'summary-read.mjs');
const STAMP = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14) + '-' + process.pid;
const SANDBOX = path.join(HERE, '.sandbox', 'run-' + STAMP);

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

function check(id, desc, cond, detail) {
  results.push({ id, desc, pass: Boolean(cond), detail: detail || '' });
  const tag = cond ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${id} ${desc}${detail ? '  · ' + detail : ''}`);
}

/** 松散 JSON 提取：人读表头后可能跟 JSON 块，取首个 '{' 或 '[' 起解析（输出不纯 JSON 时兜底）。 */
function parseJsonLoose(text) {
  const s = String(text || '');
  const iObj = s.indexOf('{');
  const iArr = s.indexOf('[');
  let i;
  if (iObj < 0 && iArr < 0) return null;
  if (iObj < 0) i = iArr;
  else if (iArr < 0) i = iObj;
  else i = Math.min(iObj, iArr);
  try { return JSON.parse(s.slice(i)); } catch (e) { return null; }
}

function setupMockScripts() {
  const mockOk = path.join(SANDBOX, 'mocks', 'mock-cli-ok.mjs');
  const mockHang = path.join(SANDBOX, 'mocks', 'mock-cli-hang.mjs');
  fs.mkdirSync(path.dirname(mockOk), { recursive: true });
  // 成功 mock：读 stdin 全部内容后输出 OK（验证宿主确实经 stdin 喂了 brief）
  fs.writeFileSync(mockOk, [
    '#!/usr/bin/env node',
    '// T9-wizard mock CLI（成功路径）：吞掉 stdin，输出 OK。不读文件、不写文件、不发网络。',
    "let input = '';",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data', (c) => { input += c; });",
    "process.stdin.on('end', () => { process.stdout.write('MOCK echo(' + input.length + '): OK\\n'); });",
  ].join('\n'), 'utf8');
  // 挂起 mock：不 end、不输出，等被超时 kill
  fs.writeFileSync(mockHang, [
    '#!/usr/bin/env node',
    '// T9-wizard mock CLI（超时路径）：静默挂起直到被 kill。不读文件、不写文件、不发网络。',
    "process.stdin.resume();",
    "setInterval(() => {}, 1000);",
  ].join('\n'), 'utf8');
  return { mockOk, mockHang };
}

async function main() {
  fs.mkdirSync(SANDBOX, { recursive: true });
  const { mockOk, mockHang } = setupMockScripts();
  console.log('== T9-wizard 自测 == repo=' + REPO);
  console.log('sandbox=' + SANDBOX + '\n');

  // --- p01/p02: presence 分档 + 诚实性 ---
  {
    const r = await runNode([WIZARD, '--probe', 'presence', '--only', 'claude,codex', '--json']);
    let rows = null;
    rows = parseJsonLoose(r.stdout);
    check('p01', 'presence 分档输出结构与两档标注', r.code === 0 && Array.isArray(rows) && rows.length === 2
      && rows.every((x) => ['PRESENCE_YES', 'PRESENCE_NO'].includes(x.presenceTier))
      && rows.every((x) => x.nonInteractive && typeof x.nonInteractive.kind === 'string' && x.nonInteractive.source),
      'claude=' + (rows && rows[0] ? rows[0].presenceTier : '?') + ' codex=' + (rows && rows[1] ? rows[1].presenceTier : '?'));
  }
  {
    const env = Object.assign({}, process.env, { TT_EXECSETUP_TRAE: 'definitely-not-a-real-cli-xyz' });
    const r = await runNode([WIZARD, '--probe', 'presence', '--only', 'trae', '--json'], { env });
    let rows = null;
    rows = parseJsonLoose(r.stdout);
    const row = rows && rows[0];
    check('p02', 'presence 诚实性：不存在的 CLI 只给 PRESENCE_NO，不涉可用性档', r.code === 0 && row && row.presenceTier === 'PRESENCE_NO' && !row.roundtripTier,
      JSON.stringify(row && { tier: row.presenceTier, located: row.located }));
  }

  // --- p03: roundtrip 成功路径（mock，无真实配额） ---
  {
    const env = Object.assign({}, process.env, { TT_EXECSETUP_CLAUDE: process.execPath + ' ' + mockOk });
    const r = await runNode([WIZARD, '--probe', 'roundtrip', '--cli', 'claude', '--json'], { env });
    let rows = null;
    rows = parseJsonLoose(r.stdout);
    const row = rows && rows[0];
    check('p03', 'roundtrip 成功路径：mock CLI stdin 往返 → ROUNDTRIP_OK，两档分开标注',
      r.code === 0 && row && row.roundtripTier === 'ROUNDTRIP_OK' && row.presenceTier === 'PRESENCE_YES' && row.ok === true,
      JSON.stringify(row && { presence: row.presenceTier, roundtrip: row.roundtripTier, ms: row.durationMs }));
  }
  // --- p04: roundtrip 超时路径 ---
  {
    const env = Object.assign({}, process.env, { TT_EXECSETUP_CODEX: process.execPath + ' ' + mockHang });
    const r = await runNode([WIZARD, '--probe', 'roundtrip', '--cli', 'codex', '--timeout', '1500', '--json'], { env });
    let rows = null;
    rows = parseJsonLoose(r.stdout);
    const row = rows && rows[0];
    check('p04', 'roundtrip 超时路径：挂起 mock → ROUNDTRIP_TIMEOUT（1.5s 超时诚实报，exit 1）',
      r.code === 1 && row && row.roundtripTier === 'ROUNDTRIP_TIMEOUT' && row.presenceTier === 'PRESENCE_YES',
      JSON.stringify(row && { presence: row.presenceTier, roundtrip: row.roundtripTier, ms: row.durationMs }));
  }
  // --- p04b: 非交互形态缺失/未编码 → SKIP 不编造 ---
  {
    const r = await runNode([WIZARD, '--probe', 'roundtrip', '--cli', 'cursor', '--json']);
    let rows = null;
    rows = parseJsonLoose(r.stdout);
    const row = rows && rows[0];
    check('p04b', 'roundtrip 对无干净非交互形态的 CLI 诚实 SKIP（cursor no-noninteractive-cli）',
      r.code === 1 && row && row.roundtripTier === 'SKIP' && /no-noninteractive-cli/.test(row.skipReason || ''),
      JSON.stringify(row && row.skipReason));
  }

  // --- p05: non-interactive 缺信息 fail-closed ---
  {
    const ws = path.join(SANDBOX, 'p05-ws');
    fs.mkdirSync(ws, { recursive: true });
    const r = await runNode([WIZARD, '--non-interactive', '--workspace', ws]);
    check('p05', 'non-interactive 缺信息 fail-closed：exit 2 + 指引不猜',
      r.code === 2 && /fail-closed/.test(r.stderr) && /--executor/.test(r.stderr) && /executor\.json/.test(r.stderr),
      'exit=' + r.code + ' stderr 头=' + r.stderr.trim().split('\n')[0].slice(0, 60));
  }

  // --- p06: flags 读取 + --save 落盘 + 读取顺序 ---
  {
    const ws = path.join(SANDBOX, 'p06-ws');
    fs.mkdirSync(ws, { recursive: true });
    const r1 = await runNode([WIZARD, '--non-interactive', '--executor', 'codex', '--model', 'test-model', '--workspace', ws, '--save']);
    const cfgFile = path.join(ws, '.tt-state', 'executor.json');
    let cfg = null;
    try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) { cfg = null; }
    const okSave = r1.code === 0 && cfg && cfg.cli === 'codex' && cfg.mode === 'B-cli' && cfg.model === 'test-model' && 'isolate' in cfg && cfg.schema === 'tt/executor-config@1';
    // 读取顺序：显式 --executor 覆盖 executor.json
    const r2 = await runNode([WIZARD, '--non-interactive', '--executor', 'claude', '--workspace', ws]);
    let explicit = null;
    try { explicit = parseJsonLoose(r2.stdout); } catch (e) { explicit = null; }
    const r3 = await runNode([WIZARD, '--non-interactive', '--workspace', ws]);
    let stored = null;
    try { stored = parseJsonLoose(r3.stdout); } catch (e) { stored = null; }
    check('p06', '--executor 显式 > executor.json 读取顺序 + --save withLock 落盘（含 isolate 预留字段）',
      okSave && r2.code === 0 && explicit && explicit.cli === 'claude' && explicit.source === 'flag-explicit'
      && r3.code === 0 && stored && stored.cli === 'codex' && stored.source === 'executor.json',
      'save=' + (cfg ? cfg.cli : 'unreadable') + ' explicit=' + (explicit && explicit.cli) + ' stored=' + (stored && stored.cli));
  }

  // --- p07: withLock 并发写 ---
  {
    const ws = path.join(SANDBOX, 'p07-ws');
    fs.mkdirSync(ws, { recursive: true });
    const procs = ['claude', 'codex', 'openclaw'].map((cli) =>
      runNode([WIZARD, '--non-interactive', '--executor', cli, '--workspace', ws, '--save']));
    const done = await Promise.all(procs);
    let cfg = null;
    try { cfg = JSON.parse(fs.readFileSync(path.join(ws, '.tt-state', 'executor.json'), 'utf8')); } catch (e) { /* 断言失败 */ }
    const allOk = done.every((r) => r.code === 0);
    check('p07', 'executor.json withLock 并发写：3 进程并发 save 全成功且文件完好（不互踩不损坏）',
      allOk && cfg && ['claude', 'codex', 'openclaw'].includes(cfg.cli) && cfg.schema === 'tt/executor-config@1',
      'exit codes=[' + done.map((r) => r.code).join(',') + '] final cli=' + (cfg ? cfg.cli : 'unreadable'));
  }

  // --- p08: 交接 brief 骨架 + 拒绝覆盖 ---
  {
    const ws = path.join(SANDBOX, 'p08-ws');
    fs.mkdirSync(ws, { recursive: true });
    const r1 = await runNode([WIZARD, '--handoff', '--plan-id', 'plan-demo', '--task-id', 'T-01', '--task-desc', '示例任务', '--workspace', ws]);
    const brief = path.join(ws, 'artifacts', 'plan-demo', 'briefs', 'T-01.md');
    const briefText = fs.existsSync(brief) ? fs.readFileSync(brief, 'utf8') : '';
    const r2 = await runNode([WIZARD, '--handoff', '--plan-id', 'plan-demo', '--task-id', 'T-01', '--workspace', ws]);
    const schemaOk = /tt\/handoff-brief@1/.test(briefText) && /taskId:\s*T-01/.test(briefText)
      && /taskVerdict/.test(briefText) && /evidencePaths/.test(briefText) && /reports\/plan-demo\/reports|reports\/T-01/.test(briefText);
    check('p08', '交接 schema：brief 骨架生成（含回填字段约定）+ 重复生成拒绝覆盖（exit 2）',
      r1.code === 0 && schemaOk && r2.code === 2 && /--force/.test(r2.stderr),
      'brief=' + briefText.length + 'B regen exit=' + r2.code);
  }

  // --- p09: validate-handoff 缺字段 FAIL / 齐字段 PASS ---
  {
    const repDir = path.join(SANDBOX, 'p09-reports', 'reports', 'plan-demo', 'reports-T-01');
    fs.mkdirSync(repDir, { recursive: true });
    const bad = path.join(repDir, 'REPORT.md');
    fs.writeFileSync(bad, '# 回填报告\n\n缺字段版。\n\ntaskId: T-01\n', 'utf8');
    const rBad = await runNode([SUMMARY, '--validate-handoff', repDir]);
    const goodDir = path.join(SANDBOX, 'p09-reports-good', 'reports', 'plan-demo', 'T-01');
    fs.mkdirSync(goodDir, { recursive: true });
    fs.writeFileSync(path.join(goodDir, 'REPORT.md'), [
      '# 回填报告 — T-01', '',
      'taskId: T-01',
      'taskVerdict: PASS',
      'evidencePaths:',
      '- test-reports/rebuild-20260920/T9-wizard/.sandbox/p09/evidence-a.log',
      '- test-reports/rebuild-20260920/T9-wizard/.sandbox/p09/evidence-b.log', '',
    ].join('\n'), 'utf8');
    const rGood = await runNode([SUMMARY, '--validate-handoff', goodDir]);
    const missingDir = path.join(SANDBOX, 'p09-reports-missing');
    fs.mkdirSync(missingDir, { recursive: true });
    const rMissing = await runNode([SUMMARY, '--validate-handoff', missingDir]);
    check('p09', 'validate-handoff：缺字段 FAIL(1) / 齐字段 PASS(0) / 目录缺失 FAIL(1) 不猜',
      rBad.code === 1 && /taskVerdict/.test(rBad.stderr) && /evidencePaths/.test(rBad.stderr)
      && rGood.code === 0 && /PASS/.test(rGood.stdout) && /evidence-a\.log/.test(rGood.stdout)
      && rMissing.code === 1,
      'bad=' + rBad.code + ' good=' + rGood.code + ' missing-dir=' + rMissing.code);
  }

  // --- p10: 中文/空格路径 ---
  {
    const ws = path.join(SANDBOX, '中文 空格 workspace');
    fs.mkdirSync(ws, { recursive: true });
    const r1 = await runNode([WIZARD, '--non-interactive', '--executor', 'codex', '--workspace', ws, '--save']);
    const r2 = await runNode([WIZARD, '--handoff', '--plan-id', '计划甲', '--task-id', '任务 1', '--workspace', ws]);
    const cfgOk = fs.existsSync(path.join(ws, '.tt-state', 'executor.json'));
    const briefOk = fs.existsSync(path.join(ws, 'artifacts', '计划甲', 'briefs', '任务 1.md'));
    check('p10', '中文/空格路径：workspace/planId/taskId 含中文空格全流程成功',
      r1.code === 0 && r2.code === 0 && cfgOk && briefOk,
      'save exit=' + r1.code + ' handoff exit=' + r2.code);
  }

  // --- p11: 文档版本字段存在性 ---
  {
    const docs = ['claude.md', 'codex.md', '通用.md'].map((n) => path.join(REPO, 'docs', 'executor-setup', n));
    const heads = docs.map((f) => ({ f: path.basename(f), text: fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '' }));
    const okDocs = heads.every((h) => /生成日期[:：]/.test(h.text) && /针对 CLI 版本|针对目标/.test(h.text) && /绝不读取\/写入任何凭据文件|绝不读取\/写入.*凭据/.test(h.text));
    check('p11', '配置指引文档头部字段（生成日期 + 针对 CLI 版本）+ 凭据红线声明', okDocs,
      heads.map((h) => h.f + '(' + h.text.length + 'B)').join(' '));
  }

  // --- p12: summary-read 既有功能回归（仅追加不破坏） ---
  {
    const rHelp = await runNode([SUMMARY, '--help']);
    const rEmpty = await runNode([SUMMARY, '--workspace', SANDBOX]);
    const rList = await runNode([SUMMARY, '--workspace', path.join(REPO, 'test-reports')]);
    check('p12', 'summary-read 既有模式回归：--help/空 workspace/列表行为不变',
      rHelp.code === 0 && /用法/.test(rHelp.stdout) && rEmpty.code === 0 && /无 state-summary|state-summary 清单/.test(rEmpty.stdout + rEmpty.stderr)
      && (rList.code === 0 || rList.code === 1),
      'help=' + rHelp.code + ' empty=' + rEmpty.code + ' list=' + rList.code);
  }

  // --- 汇总 ---
  const pass = results.filter((r) => r.pass).length;
  console.log('\n== 汇总: ' + pass + '/' + results.length + ' PASS ==');
  const out = { stamp: STAMP, sandbox: SANDBOX, total: results.length, pass, results };
  fs.writeFileSync(path.join(HERE, 'out-probe-results.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
  await pruneSandboxes();
  return pass === results.length ? 0 : 1;
}

/**
 * 沙箱修剪：只匹配 run-<stamp>-<pid> 形态的【目录】（run- 前缀 + 中段戳 + 末段数字），
 * 按 mtime（兜底名字）排序，淘汰最旧的、只保留最近 RETAIN_RUNS 个。
 * 非 run-* 前缀的目录/文件（留证物）一律不动；run- 前缀的普通文件也不动（只修剪目录）；
 * 修剪任一步失败均静默降级（不影响探针结果与退出码）。
 */
async function pruneSandboxes() {
  const root = path.join(HERE, '.sandbox');
  try {
    const entries = await fsp.readdir(root, { withFileTypes: true });
    const runDirs = entries.filter((e) => e.isDirectory() && /^run-.+-\d+$/.test(e.name));
    const dated = await Promise.all(runDirs.map((e) =>
      fsp.stat(path.join(root, e.name))
        .then((s) => ({ name: e.name, mtime: s.mtimeMs }))
        .catch(() => ({ name: e.name, mtime: 0 })) // stat 失败按最旧处理，靠名字兜底
    ));
    dated.sort((a, b) => b.mtime - a.mtime || (a.name < b.name ? -1 : 1));
    for (const old of dated.slice(RETAIN_RUNS)) {
      await fsp.rm(path.join(root, old.name), { recursive: true, force: true }).catch(() => {});
    }
  } catch (e) { /* 静默降级：修剪失败不阻塞主流程 */ }
}

process.exitCode = await main();
