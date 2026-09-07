#!/usr/bin/env node
/**
 * frontend-quality-gate — 前端质量门机验脚本（FR-1 / M1 里程碑）。
 * 自动执行 taste-skill §14 FINAL PRE-FLIGHT CHECK 中可机验项 + AI Slop 红线（SKILL.md §6.3）。
 * 不可机验项（三层卡片布局 / 设计感等主观项）如实标注 N/A，不伪造 PASS。
 *
 * 机验项：
 *   1. hardcoded-hex    硬编码 hex 颜色（非 CSS 变量 / 语义色 → 警告）
 *   2. generic-fonts    通用字体（Inter/Roboto/Arial → 警告，允许显式例外标记）
 *   3. pure-black-white 纯黑/纯白背景（#000000/#ffffff → 警告）
 *   4. elastic-easing   弹性/弹跳缓动（cubic-bezier 过冲曲线 / bounce → 警告）
 *   5. layout-animation 动画 layout 属性（top/left/width/height → 警告，应只动 transform/opacity）
 *   6. em-dash          短破折号/破折号字符（— – → 警告）
 *   7. cta-wrap         CTA 文案换行风险（启发式，未识别 CTA 元素时标 N/A）
 *   8. asset-consumption 资产消费证据（frontend-design 锚点 + 内核词 shadcn/bolt.new/Pre-Flight）
 *   N/A（主观，跳过）：三层卡片布局、zigzag cap、logo wall 语义、渐变文字等 → 人工 review/VLM 兜底
 *
 * 用法：
 *   node scripts/frontend-quality-gate.mjs <target> [--out <report.json>] [--json] [--allow <check[,check]>]
 *   <target> = HTML/CSS/JSX/TSX/Vue/Svelte 文件 或 页面目录（递归扫描支持扩展名，跳过 node_modules/dist/build/.git）
 *
 * 退出码：0 全部通过或 N/A / 1 有警告（信息性，不阻断 CI）/ 2 严重错误（目标不存在/不可读）
 */
import fs from 'node:fs';
import path from 'node:path';

const SCAN_EXT = new Set(['.html', '.htm', '.css', '.jsx', '.tsx', '.vue', '.svelte', '.js', '.ts']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git']);
const GENERIC_FONTS = /\b(Inter|Roboto|Arial)\b/i;
const PURE_BW = /(?:#[0]{3}\b|#[0]{6}\b|#[fF]{3}\b|#[fF]{6}\b)/;
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const EM_DASH_RE = /[—–]/g;
const LAYOUT_PROPS = /(^|[\s;{(])?(top|left|width|height)\s*:/g;
const ALLOW_OVERRIDE_RE = /(?:allow-generic-font|allow-black-white|allow-hardcoded-hex|allow-em-dash|allow-easing|allow-layout-anim)/i;
const KERNEL_WORDS = /\b(shadcn|bolt\.new|Pre-Flight)\b/i;

function collectFiles(target) {
  const stat = fs.statSync(target);
  const files = [];
  const push = (p) => {
    const rel = path.relative(process.cwd(), p).split(path.sep).join('/');
    files.push({ path: p, rel, text: fs.readFileSync(p, 'utf8') });
  };
  if (stat.isFile()) { push(target); return files; }
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); }
      else if (SCAN_EXT.has(path.extname(e.name).toLowerCase())) push(path.join(dir, e.name));
    }
  };
  walk(target);
  return files;
}

function collectStyles(files) {
  const css = files.filter((f) => f.path.endsWith('.css')).map((f) => f.text).join('\n');
  const htmlCss = files
    .filter((f) => /\.html?$/.test(f.path))
    .map((f) => [...f.text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n'))
    .join('\n');
  const jsxCss = files
    .filter((f) => /\.(jsx|tsx|vue|svelte)$/.test(f.path))
    .map((f) => [...f.text.matchAll(/(?:css`|styled(?:\.\w+)?`|className="[^"]*")/g)].map((m) => m[0]).join('\n'))
    .join('\n');
  return css + '\n' + htmlCss + '\n' + jsxCss;
}

function checkHardcodedHex(files) {
  const hits = [];
  for (const f of files) {
    f.text.split('\n').forEach((ln, i) => {
      if (ALLOW_OVERRIDE_RE.test(ln) || /var\(--/.test(ln)) return;
      const isVarDef = /--[\w-]+\s*:\s*[^;]*#[0-9a-fA-F]/.test(ln) && !/style=/.test(ln);
      if (isVarDef) return;
      const m = ln.match(HEX_RE);
      if (m && !/^\s*\/\//.test(ln)) hits.push(f.rel + ':' + (i + 1) + ' ' + m.join(','));
    });
  }
  return hits;
}

function checkGenericFonts(files) {
  const hits = [];
  for (const f of files) {
    f.text.split('\n').forEach((ln, i) => {
      if (!/font-family/i.test(ln) || !GENERIC_FONTS.test(ln)) return;
      if (ALLOW_OVERRIDE_RE.test(ln) || /var\(--/.test(ln)) return;
      hits.push(f.rel + ':' + (i + 1));
    });
  }
  return hits;
}

function checkPureBlackWhite(files) {
  const hits = [];
  for (const f of files) {
    f.text.split('\n').forEach((ln, i) => {
      if (ALLOW_OVERRIDE_RE.test(ln) || /var\(--/.test(ln)) return;
      if (!PURE_BW.test(ln)) return;
      const m = ln.match(PURE_BW);
      if (!m) return;
      const val = m[0].toLowerCase();
      if (!/background|color|fill|stroke|border/i.test(ln)) return;
      const isVarDef = /--[\w-]+\s*:\s*[^;]*#/.test(ln) && !/style=/.test(ln);
      if (isVarDef) return;
      hits.push(f.rel + ':' + (i + 1) + ' ' + val);
    });
  }
  return hits;
}

function checkElasticEasing(styles) {
  const hits = [];
  for (const m of styles.matchAll(/cubic-bezier\(\s*([^)]*)\)/gi)) {
    const nums = m[1].split(',').map((s) => parseFloat(s.trim()));
    if (nums.length === 4 && (nums[1] > 1 || nums[3] > 1)) hits.push('cubic-bezier(' + m[1].trim() + ')');
  }
  for (const m of styles.matchAll(/animation[^;{}]*:(?:[^;{}]*\b(bounce|elastic|spring)\b)/gi)) {
    hits.push(m[0].slice(0, 60));
  }
  for (const m of styles.matchAll(/transition-timing-function\s*:\s*([^;{}]+)/gi)) {
    if (/\b(bounce|elastic|spring)\b/i.test(m[1])) hits.push(m[1].trim());
  }
  return hits;
}

function checkLayoutAnimation(styles) {
  const hits = [];
  for (const m of styles.matchAll(/@keyframes\s+([\w-]+)\s*\{([^}]*)\}/gi)) {
    const body = m[2];
    if (LAYOUT_PROPS.test(body)) hits.push('@keyframes ' + m[1] + ' 动画 layout 属性');
  }
  for (const m of styles.matchAll(/transition\s*:\s*([^;{}]+)/gi)) {
    if (/(^|[\s,])(top|left|width|height)([\s,;]|$)/i.test(m[1]) && !/transform|opacity/i.test(m[1])) hits.push('transition ' + m[1].trim().slice(0, 60));
  }
  return hits;
}

function checkEmDash(files) {
  let count = 0;
  for (const f of files) count += (f.text.match(EM_DASH_RE) || []).length;
  return count;
}

function checkCtaWrap(files) {
  const hits = [];
  for (const f of files) {
    if (!/\.html?$/.test(f.path)) continue;
    const m = f.text.match(/<(?:a|button)[^>]*class="([^"]*(?:cta|btn|button)[^"]*)"[^>]*>([\s\S]*?)<\/(?:a|button)>/gi);
    if (!m) continue;
    for (const el of m) {
      if (/\b(?:whitespace-nowrap|whitespace:nowrap|nowrap)\b/i.test(el)) continue;
      const label = el.replace(/<[^>]+>/g, '').trim();
      if (label && /\s{2,}/.test(label)) hits.push(label.slice(0, 40));
    }
  }
  return hits;
}

function checkAssetConsumption(files) {
  const all = files.map((f) => f.text).join('\n');
  const anchor = /frontend-design/i.test(all);
  const kernel = KERNEL_WORDS.test(all);
  return { anchor, kernel };
}

function main() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  const outI = args.indexOf('--out'); const outFile = outI !== -1 && args[outI + 1] ? args[outI + 1] : null;
  const jsonOnly = args.includes('--json');
  const allowI = args.indexOf('--allow'); const allow = allowI !== -1 && args[allowI + 1] ? args[allowI + 1].split(',').filter(Boolean) : [];

  if (!target) {
    console.error('用法: node scripts/frontend-quality-gate.mjs <target> [--out report.json] [--json] [--allow check1,check2]');
    process.exit(2);
  }
  let files;
  try { files = collectFiles(target); }
  catch (e) { console.error('严重错误: 无法读取目标 ' + target + ' (' + e.message + ')'); process.exit(2); }
  if (!files.length) { console.error('严重错误: 目标内未找到可机验文件（html/css/jsx/tsx/vue/svelte）'); process.exit(2); }

  const styles = collectStyles(files);
  const checks = [];
  const add = (name, pass, detail) => checks.push({ name, pass, detail });

  if (!allow.includes('hardcoded-hex')) {
    const h = checkHardcodedHex(files);
    add('hardcoded-hex', h.length === 0, h.length ? h.slice(0, 10).join(' | ') : '硬编码 hex 颜色 = 0');
  } else add('hardcoded-hex', true, 'SKIP(--allow)');

  if (!allow.includes('generic-fonts')) {
    const h = checkGenericFonts(files);
    add('generic-fonts', h.length === 0, h.length ? '通用字体(Inter/Roboto/Arial): ' + h.slice(0, 10).join(' | ') : '通用字体 = 0');
  } else add('generic-fonts', true, 'SKIP(--allow)');

  if (!allow.includes('pure-black-white')) {
    const h = checkPureBlackWhite(files);
    add('pure-black-white', h.length === 0, h.length ? '纯黑/纯白: ' + h.slice(0, 10).join(' | ') : '纯黑/纯白 = 0');
  } else add('pure-black-white', true, 'SKIP(--allow)');

  if (!allow.includes('elastic-easing')) {
    const h = checkElasticEasing(styles);
    add('elastic-easing', h.length === 0, h.length ? '弹性/弹跳缓动: ' + h.slice(0, 10).join(' | ') : '弹性缓动 = 0');
  } else add('elastic-easing', true, 'SKIP(--allow)');

  if (!allow.includes('layout-animation')) {
    const h = checkLayoutAnimation(styles);
    add('layout-animation', h.length === 0, h.length ? 'layout 动画: ' + h.slice(0, 10).join(' | ') : 'layout 动画 = 0（只动 transform/opacity）');
  } else add('layout-animation', true, 'SKIP(--allow)');

  if (!allow.includes('em-dash')) {
    const c = checkEmDash(files);
    add('em-dash', c === 0, c ? 'em-dash/– 字符出现 ' + c + ' 次' : 'em-dash = 0');
  } else add('em-dash', true, 'SKIP(--allow)');

  if (!allow.includes('cta-wrap')) {
    const h = checkCtaWrap(files);
    add('cta-wrap', h.length === 0, h.length ? 'CTA 文案换行风险: ' + h.slice(0, 5).join(' | ') : '未发现 CTA 换行风险（启发式）');
  } else add('cta-wrap', true, 'SKIP(--allow)');

  if (!allow.includes('asset-consumption')) {
    const a = checkAssetConsumption(files);
    add('asset-consumption', a.anchor && a.kernel,
      a.anchor && a.kernel ? '含 frontend-design 锚点 + 内核词(shadcn/bolt.new/Pre-Flight)' :
      a.anchor ? '加载了资产但未消费（缺内核词 shadcn/bolt.new/Pre-Flight）→ assetConsumed=false' :
      '未发现资产消费证据（缺 frontend-design 锚点 + 内核词）');
  } else add('asset-consumption', true, 'SKIP(--allow)');

  add('three-layer-card-layout', null, 'N/A 主观项（三层卡片布局/zigzag cap/logo wall 语义）→ 人工 review/VLM 兜底，不伪造 PASS');
  add('visual-aesthetic', null, 'N/A 主观项（设计感/配色/排版品味）→ 人工 review/VLM 兜底，不伪造 PASS');

  const warnings = checks.filter((c) => c.pass === false);
  const passed = warnings.length === 0;
  const report = {
    passed,
    target,
    scannedFiles: files.length,
    warnings: warnings.length,
    checks,
    at: new Date().toISOString(),
  };

  if (jsonOnly || outFile) {
    const json = JSON.stringify(report, null, 2);
    if (outFile) fs.writeFileSync(outFile, json, 'utf8');
    if (jsonOnly) console.log(json);
  } else {
    console.log('# frontend-quality-gate: ' + target);
    console.log('扫描文件: ' + files.length + ' · 警告: ' + warnings.length + ' · ' + (passed ? 'PASS' : 'FAIL(warnings)'));
    for (const c of checks) console.log('  [' + (c.pass === true ? 'PASS' : c.pass === false ? 'WARN' : 'N/A ') + '] ' + c.name + ' — ' + c.detail);
    if (warnings.length) {
      console.log('提示: 机验警告为信息性（不阻断 CI）。FR-1 要求任一机验项不过 → 返工，不得进入 Gate B。');
    }
  }

  process.exitCode = passed ? 0 : 1;
}

main();
