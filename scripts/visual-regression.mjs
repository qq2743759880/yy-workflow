#!/usr/bin/env node
/**
 * visual-regression — 前端视觉回归（FR-6）：L0 像素 diff + L1 VLM 语义抽样。
 * 前端任务完成、进入 Gate B 前必跑。零依赖内核（Playwright 走执行层探测）。
 *
 * L0 像素 diff：探测 Playwright（npx playwright / require）；可用 → 对每个页面 × 视口集合
 *   用 Playwright 截图做像素基线比对（基线存 <out>/.tt-visual/，首次记录为基线，后续比对；
 *   仅 --update-baseline 时更新基线，禁止为通过盲目覆盖）。不可用 → L0_NOT_AVAILABLE。
 * L1 VLM 语义抽样：跑 visual-diff-pages.mjs 拿 git diff 影响页 + 关键页 → 输出抽样页清单
 *   （含截图路径），供外部 VLM/Read 读图做语义审查（token 受控，只审 diff 页 + 关键页）。
 *
 * 用法：
 *   node scripts/visual-regression.mjs   --pages-dir <dir> [--base HEAD] [--out <dir>]
 *     [--viewports 375,768,1024,1280,1440] [--screenshot-dir <dir>] [--update-baseline] [--chrome <exe>]
 * 退出码：0 = L0 通过 或 L0_NOT_AVAILABLE；1 = L0 有像素回归违背；2 = 严重错误。
 * Chrome 定位优先级：--chrome > env TT_VISUAL_CHROME > 自动探测（playwright 自带浏览器或本机 chrome）。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT_RE = /\.(tsx|jsx|vue|html)$/i;
const DEFAULT_VIEWPORTS = [375, 768, 1024, 1280, 1440];

function parseArgs(args) {
  const out = { pagesDir: null, base: 'HEAD', out: path.join(ROOT, 'test-reports'), viewports: DEFAULT_VIEWPORTS, screenshotDir: null, updateBaseline: false, chrome: process.env.TT_VISUAL_CHROME || null, help: false, argError: null };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--pages-dir') { out.pagesDir = args[i + 1]; i += 1; }
    else if (a === '--base') { out.base = args[i + 1]; i += 1; }
    else if (a === '--out') { out.out = args[i + 1]; i += 1; }
    else if (a === '--viewports') { out.viewports = String(args[i + 1]).split(',').map(Number).filter(Boolean); i += 1; }
    else if (a === '--screenshot-dir') { out.screenshotDir = args[i + 1]; i += 1; }
    else if (a === '--chrome') { out.chrome = args[i + 1]; i += 1; }
    else if (a === '--update-baseline') out.updateBaseline = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  if (!out.pagesDir) out.argError = '--pages-dir 必填（前端页面目录或含页面 URL 清单的 .txt）';
  return out;
}

function collectPages(dir) {
  if (!fs.existsSync(dir)) return [];
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    // .txt 每行一个 URL 或路径
    const text = fs.readFileSync(dir, 'utf8');
    return text.split('\n').map((l) => l.trim()).filter(Boolean);
  }
  const walk = (d) => {
    const out = [];
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) out.push(...walk(full));
      else if (EXT_RE.test(e.name)) out.push(full);
    }
    return out;
  };
  return walk(dir);
}

function collectDiffPages(base, cwd) {
  try {
    const gitDir = cwd;
    let diff = [];
    try {
      diff = execFileSync('git', ['diff', '--name-only', base, '--', '*.html', '*.jsx', '*.tsx', '*.vue'], { cwd: gitDir, encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] }).split('\n').filter(Boolean);
    } catch (e) { /* 非 git 或 diff 失败，忽略 */ }
    let untracked = [];
    try { untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: gitDir, encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] }).split('\n').filter(Boolean); } catch (e) { /* 忽略 */ }
    const files = diff.concat(untracked);
    return files.filter((f) => EXT_RE.test(f));
  } catch (e) {
    return [];
  }
}

/** 定位 playwright 包目录（执行层）：npx 缓存 / 本目录 node_modules / 全局。 */
function resolvePlaywrightDir() {
  const candidates = [];
  try {
    const npxCache = path.join(os.homedir(), 'AppData', 'Local', 'npm-cache', '_npx');
    if (fs.existsSync(npxCache)) {
      for (const sub of fs.readdirSync(npxCache)) {
        const p = path.join(npxCache, sub, 'node_modules', 'playwright');
        if (fs.existsSync(p)) candidates.push(p);
      }
    }
  } catch (e) { /* 忽略 */ }
  try {
    const local = path.join(ROOT, 'node_modules', 'playwright');
    if (fs.existsSync(local)) candidates.push(local);
  } catch (e) { /* 忽略 */ }
  return candidates[0] || null;
}

/** 探测 Chrome 可执行：--chrome / env TT_VISUAL_CHROME > playwright 自带浏览器 > 常见本机路径。 */
function resolveChrome(custom) {
  const guesses = [
    custom,
    path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright', 'chromium-1234', 'chrome-win', 'chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'D:/tool/chrom/Application/chrome.exe',
  ].filter(Boolean);
  for (const g of guesses) { try { if (fs.existsSync(g)) return g; } catch (e) { /* 忽略 */ } }
  return null;
}

/** 探测 L0 是否可行：playwright 包 + chrome 都可用。 */
function probeL0(chrome, pwDir) {
  return Boolean(pwDir) && Boolean(chrome);
}

function sha256(s) {
  const { createHash } = require('node:crypto');
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

async function runPlaywrightScreenshot(url, viewport, shotPath, pwDir, chromeExe) {
  // 用 playwright 截图本地文件页：从 npx 缓存加载包 + 指定 chrome executablePath
  return new Promise((resolve) => {
    const code = `
      const { chromium } = require(process.argv[1]);
      (async () => {
        const b = await chromium.launch({ executablePath: process.argv[2] });
        const p = await b.newPage({ viewport: { width: ${viewport}, height: 800 } });
        await p.goto(process.argv[3], { waitUntil: 'load' }).catch(() => {});
        await p.waitForTimeout(400);
        await p.screenshot({ path: process.argv[4] });
        await b.close();
        console.log('OK');
      })().catch(e => { console.error('ERR ' + e.message); process.exit(1); });
    `;
    const { spawn } = require('node:child_process');
    const child = spawn(process.execPath, ['-e', code, pwDir, chromeExe, url, shotPath], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let out = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { out += c; });
    child.on('close', (code) => resolve(code === 0 && out.includes('OK')));
    child.on('error', () => resolve(false));
  });
}

function pixelCompare(a, b) {
  // 简易像素差异：读 PNG 原始字节做粗略比较（有差异即不同）。
  // Playwright toHaveScreenshot 完整实现需要测试框架；此处给退出码语义 + 报告标注。
  try {
    const ba = fs.readFileSync(a);
    const bb = fs.readFileSync(b);
    if (ba.length === bb.length && ba.equals(bb)) return { pass: true, diffRatio: 0 };
    return { pass: false, diffRatio: 1 };
  } catch (e) {
    return { pass: false, diffRatio: 1 };
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log('usage: node scripts/visual-regression.mjs --pages-dir <dir> [--base HEAD] [--out dir] [--viewports 375,768,...] [--screenshot-dir dir] [--update-baseline] [--chrome <exe>]'); return 0; }
  if (opts.argError) { console.error(opts.argError); return 2; }
  const pagesDir = path.resolve(opts.pagesDir);
  const pages = collectPages(pagesDir);
  if (!pages.length) { console.error('visual-regression: 页面目录无 HTML/JSX/Vue 文件或为空'); return 2; }
  const reportDir = path.resolve(opts.out);
  fs.mkdirSync(reportDir, { recursive: true });

  const report = { generatedAt: new Date().toISOString(), pagesDir, base: opts.base, totalPages: pages.length, l0: { status: 'pending', covered: 0, failures: [] }, l1: { diffPages: [], sampled: [] } };

  // L1 语义抽样：git diff 影响页 + 关键页（页面清单全部做候选，只抽 diff 页 + 前 2 关键页，token 受控）
  const diffPages = collectDiffPages(opts.base, pagesDir);
  report.l1.diffPages = diffPages;
  const keyPages = pages.slice(0, 2).map((p) => path.relative(pagesDir, p).replace(/\\/g, '/'));
  const sampled = [...new Set([...diffPages.map((p) => path.basename(p)), ...keyPages])].slice(0, 8);
  report.l1.sampled = sampled;

  // L0 像素 diff：probe playwright 包 + chrome 可执行
  const pwDir = resolvePlaywrightDir();
  const chromeExe = resolveChrome(opts.chrome);
  const l0ok = probeL0(chromeExe, pwDir);
  if (!l0ok) {
    const why = !pwDir ? 'Playwright 包不可用' : '未找到 Chrome 可执行（可用 --chrome <exe> 或 env TT_VISUAL_CHROME 指定）';
    report.l0.status = 'L0_NOT_AVAILABLE';
    report.l0.note = why;
    console.log('# visual-regression report');
    console.log('- L0: L0_NOT_AVAILABLE（' + why + '，仅 L1 语义抽样）');
    console.log('- L1 抽样页: ' + (sampled.length ? sampled.join(', ') : '(无 diff 页，可全量像素回归兜底)'));
    writeReport(report, reportDir);
    console.log('report: ' + path.join(reportDir, 'visual-regression.md'));
    return 0;
  }
  // L0 可行：对每页（本地文件）截图 + 基线比对
  const shotDir = path.resolve(opts.screenshotDir || path.join(reportDir, '.tt-visual'));
  fs.mkdirSync(shotDir, { recursive: true });
  for (const page of pages) {
    const rel = path.relative(pagesDir, page).replace(/\\/g, '/').replace(EXT_RE, '');
    for (const vp of opts.viewports) {
      const url = 'file://' + page.replace(/\\/g, '/');
      const shotPath = path.join(shotDir, rel + '_' + vp + '.png');
      const ok = await runPlaywrightScreenshot(url, vp, shotPath, pwDir, chromeExe);
      if (!ok) { report.l0.failures.push({ page: rel, viewport: vp, error: 'screenshot failed' }); continue; }
      const baseline = shotPath + '.baseline.png';
      if (opts.updateBaseline || !fs.existsSync(baseline)) {
        fs.copyFileSync(shotPath, baseline);
        report.l0.covered += 1;
      } else {
        const cmp = pixelCompare(shotPath, baseline);
        if (cmp.pass) report.l0.covered += 1;
        else report.l0.failures.push({ page: rel, viewport: vp, diffRatio: cmp.diffRatio });
      }
    }
  }
  report.l0.status = report.l0.failures.length ? 'FAIL' : 'PASS';
  console.log('# visual-regression report');
  console.log('- L0: ' + report.l0.status + ' 覆盖 ' + report.l0.covered + ' 页×视口' + (report.l0.failures.length ? ' 失败 ' + report.l0.failures.length + ' 处' : ''));
  console.log('- L1 抽样页: ' + (sampled.length ? sampled.join(', ') : '(无 diff 页)'));
  if (report.l0.failures.length) {
    for (const f of report.l0.failures) console.log('  [L0-FAIL] ' + f.page + ' @' + f.viewport + (f.error ? ' (' + f.error + ')' : ' 像素差异'));
  }
  writeReport(report, reportDir);
  console.log('report: ' + path.join(reportDir, 'visual-regression.md'));
  return report.l0.status === 'FAIL' ? 1 : 0;
}

function writeReport(report, reportDir) {
  const md = [
    '# 视觉回归报告（FR-6）', '',
    '- 生成: ' + report.generatedAt,
    '- 页面目录: ' + report.pagesDir + ' · base: ' + report.base + ' · 页面数: ' + report.totalPages, '',
    '## L0 像素 diff',
    '- status: ' + report.l0.status + ' · 覆盖: ' + report.l0.covered + ' 页×视口',
    report.l0.failures.length ? '- 失败: ' + report.l0.failures.length + ' 处' + report.l0.failures.map((f) => '\n  - ' + f.page + ' @' + f.viewport + (f.error ? ' (' + f.error + ')' : ' 像素差异')).join('') : '- 无失败', '',
    '## L1 VLM 语义抽样',
    '- diff 页: ' + (report.l1.diffPages.length ? report.l1.diffPages.join(', ') : '无（可全量像素回归兜底）'),
    '- 抽样页（token 受控，供 VLM/Read 读图审查）: ' + (report.l1.sampled.length ? report.l1.sampled.join(', ') : '无'), '',
  ].join('\n');
  fs.writeFileSync(path.join(reportDir, 'visual-regression.md'), md);
  fs.writeFileSync(path.join(reportDir, 'visual-regression.json'), JSON.stringify(report, null, 2));
}

main().then((code) => { process.exitCode = code; }).catch((e) => { console.error('visual-regression: ' + e.message); process.exitCode = 2; });
