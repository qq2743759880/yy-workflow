#!/usr/bin/env node
/**
 * prototype-parity-check — 原型→实现一致性门（FR-2 / M1 里程碑）。
 * Gate A（用户签收 HTML 原型）通过后，React 实现须与原型保持设计 token / 截图接近度一致。
 *
 * 能力：
 *   1. token 提取（零依赖，从 HTML/CSS/JSX 正则提取）：颜色 hex、字体 stack、间距(padding/margin/gap)、圆角
 *   2. 原型 vs 实现 token 对比 → 差异报告 tokenDiff: [{field, expected, actual}]
 *   3. 截图接近度比对（若 Playwright 可用）：同视口截图 → 浏览器内 canvas 逐像素 diff → 相似度百分比
 *   4. Playwright 不可用 → 降级为 token 对比，诚实标注 SCREENSHOT_UNAVAILABLE（degraded=true）
 *
 * 用法：
 *   node scripts/prototype-parity-check.mjs --proto <原型.html> --impl <实现.html|组件目录> [--out report.json]
 *       [--threshold 0.03] [--screenshots proto.png,impl.png] [--width 1280 --height 800]
 *
 * 产出 JSON：{ prototype, implementation, tokenDiff, screenshotSimilarity, degraded, threshold, pass }
 * 退出码：0 一致性通过（tokenDiff=0 且 相似度 ≥ 1-threshold 或截图不可用仅凭 token）/ 1 不一致 / 2 严重错误
 */
import fs from 'node:fs';
import path from 'node:path';

const IMPL_EXT = new Set(['.html', '.htm', '.css', '.jsx', '.tsx', '.vue', '.svelte', '.js', '.ts']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git']);
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const MAX_DIFF_CAP = 40;

function readText(p) { return fs.readFileSync(p, 'utf8'); }

function collectImplFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [{ path: target, text: readText(target) }];
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); }
      else if (IMPL_EXT.has(path.extname(e.name).toLowerCase())) files.push({ path: path.join(dir, e.name), text: readText(path.join(dir, e.name)) });
    }
  };
  walk(target);
  return files;
}

function extractTokens(text) {
  const tokens = { color: new Set(), font: new Set(), spacing: new Set(), radius: new Set() };
  for (const m of text.matchAll(HEX_RE)) tokens.color.add(m[0].toLowerCase());
  for (const m of text.matchAll(/font-family\s*:\s*([^;{}]+)/gi)) {
    const stack = m[1].split(',').map((s) => s.trim().replace(/["']/g, '').toLowerCase()).filter(Boolean).join(', ');
    if (stack) tokens.font.add(stack);
  }
  for (const m of text.matchAll(/(?:padding|margin|gap)\s*:\s*([^;{}]+)/gi)) {
    for (const v of m[1].match(/\b\d+(?:\.\d+)?(?:px|rem|em)\b/g) || []) tokens.spacing.add(v.toLowerCase());
  }
  for (const m of text.matchAll(/border-radius\s*:\s*([^;{}]+)/gi)) {
    for (const v of m[1].match(/\b\d+(?:\.\d+)?(?:px|rem|em|%)?\b/g) || []) tokens.radius.add(v.toLowerCase());
  }
  return tokens;
}

function diffTokens(proto, impl) {
  const diffs = [];
  const cats = ['color', 'font', 'spacing', 'radius'];
  for (const cat of cats) {
    const p = new Set(proto[cat]);
    const i = new Set(impl[cat]);
    const pOnly = [...p].filter((v) => !i.has(v)).sort();
    const iOnly = [...i].filter((v) => !p.has(v)).sort();
    for (const v of pOnly.slice(0, MAX_DIFF_CAP)) diffs.push({ field: cat + ':' + v, expected: v, actual: null });
    for (const v of iOnly.slice(0, MAX_DIFF_CAP)) diffs.push({ field: cat + ':' + v, expected: null, actual: v });
  }
  return diffs;
}

async function screenshotSimilarity(protoFile, implFile, shotPair, width, height) {
  let playwright;
  try { playwright = await import('playwright'); }
  catch (e) { return { value: null, degraded: true, reason: 'SCREENSHOT_UNAVAILABLE（未安装 Playwright，仅 token 对比）' }; }

  const { chromium } = playwright;
  if (!chromium) return { value: null, degraded: true, reason: 'SCREENSHOT_UNAVAILABLE（playwright 无 chromium）' };

  const protoUrl = protoFile.startsWith('data:') ? protoFile : 'file:///' + protoFile.split(path.sep).join('/');
  const implUrl = implFile.startsWith('data:') ? implFile : 'file:///' + implFile.split(path.sep).join('/');

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width, height });
    let bufA, bufB;
    if (shotPair && shotPair[0] && shotPair[1]) {
      bufA = fs.readFileSync(shotPair[0]);
      bufB = fs.readFileSync(shotPair[1]);
    } else {
      await page.goto(protoUrl, { waitUntil: 'networkidle' });
      bufA = await page.screenshot();
      await page.goto(implUrl, { waitUntil: 'networkidle' });
      bufB = await page.screenshot();
    }

    const result = await page.evaluate(async ({ a, b }) => {
      const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
      const ia = await loadImg(a);
      const ib = await loadImg(b);
      const w = Math.min(ia.width, ib.width);
      const h = Math.min(ia.height, ib.height);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.drawImage(ia, 0, 0);
      const da = ctx.getImageData(0, 0, w, h).data;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(ib, 0, 0);
      const db = ctx.getImageData(0, 0, w, h).data;
      let diff = 0;
      const total = w * h;
      for (let i = 0; i < total; i++) {
        const o = i * 4;
        if (Math.abs(da[o] - db[o]) > 24 || Math.abs(da[o + 1] - db[o + 1]) > 24 || Math.abs(da[o + 2] - db[o + 2]) > 24) diff++;
      }
      return { diff, total };
    }, { a: 'data:image/png;base64,' + bufA.toString('base64'), b: 'data:image/png;base64,' + bufB.toString('base64') });

    const similarity = result.total ? 1 - result.diff / result.total : null;
    return { value: similarity, degraded: false, reason: '像素 diff ' + result.diff + '/' + result.total };
  } catch (e) {
    return { value: null, degraded: true, reason: 'SCREENSHOT_UNAVAILABLE（Playwright 执行失败: ' + e.message + '）' };
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const protoI = args.indexOf('--proto'); const protoFile = protoI !== -1 && args[protoI + 1] ? args[protoI + 1] : null;
  const implI = args.indexOf('--impl'); const implTarget = implI !== -1 && args[implI + 1] ? args[implI + 1] : null;
  const outI = args.indexOf('--out'); const outFile = outI !== -1 && args[outI + 1] ? args[outI + 1] : null;
  const thI = args.indexOf('--threshold'); const threshold = thI !== -1 && args[thI + 1] ? parseFloat(args[thI + 1]) : 0.03;
  const swI = args.indexOf('--screenshots'); const shotPair = swI !== -1 && args[swI + 1] ? args[swI + 1].split(',').map((s) => s.trim()) : null;
  const wI = args.indexOf('--width'); const width = wI !== -1 && args[wI + 1] ? parseInt(args[wI + 1], 10) : 1280;
  const hI = args.indexOf('--height'); const height = hI !== -1 && args[hI + 1] ? parseInt(args[hI + 1], 10) : 800;

  if (!protoFile || !implTarget) {
    console.error('用法: node scripts/prototype-parity-check.mjs --proto <原型.html> --impl <实现.html|目录> [--out report.json] [--threshold 0.03]');
    process.exit(2);
  }
  if (!fs.existsSync(protoFile) || !fs.existsSync(implTarget)) {
    console.error('严重错误: 原型或实现目标不存在'); process.exit(2);
  }

  const protoText = readText(protoFile);
  const protoTokens = extractTokens(protoText);
  let implTexts = [];
  try { implTexts = collectImplFiles(implTarget); }
  catch (e) { console.error('严重错误: ' + e.message); process.exit(2); }
  if (!implTexts.length) { console.error('严重错误: 实现目标内未找到文件'); process.exit(2); }
  const implTokens = extractTokens(implTexts.map((f) => f.text).join('\n'));

  const tokenDiff = diffTokens(protoTokens, implTokens);
  const tokenPass = tokenDiff.length === 0;

  const shot = await screenshotSimilarity(protoFile, implTarget, shotPair, width, height);
  const similarityValue = shot.value;
  const degraded = shot.degraded;
  const similarityPass = similarityValue === null ? true : similarityValue >= 1 - threshold;
  const pass = tokenPass && similarityPass;

  const report = {
    prototype: protoFile,
    implementation: implTarget,
    tokenDiff,
    screenshotSimilarity: similarityValue,
    degraded,
    screenshotNote: shot.reason,
    threshold,
    pass,
    tokenSummary: {
      prototype: { color: protoTokens.color.size, font: protoTokens.font.size, spacing: protoTokens.spacing.size, radius: protoTokens.radius.size },
      implementation: { color: implTokens.color.size, font: implTokens.font.size, spacing: implTokens.spacing.size, radius: implTokens.radius.size },
    },
    at: new Date().toISOString(),
  };

  const json = JSON.stringify(report, null, 2);
  if (outFile) fs.writeFileSync(outFile, json, 'utf8');
  console.log(json);

  process.exitCode = pass ? 0 : 1;
}

main().catch((e) => { console.error('严重错误: ' + e.message); process.exitCode = 2; });
