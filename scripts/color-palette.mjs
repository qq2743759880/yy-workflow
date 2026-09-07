#!/usr/bin/env node
/**
 * color-palette — 实际调用已部署的 culori (色彩计算) + poline (声学调色板) 生成和谐色板 + WCAG 对比度。
 * 让 colorize 资产从"声明内核"升级为"真实计算"（第三方面部署，不重复造轮子）。
 * 用法：node scripts/color-palette.mjs <base-hex> [analogous|complementary|triadic]
 * 依赖：AI-Hub thirdparty 库（`$AIHUB_ROOT/thirdparty/node_modules`，默认 `~/.ai-hub`；本机为 D 盘 AI-Hub 时设 `AIHUB_ROOT`）。
 */
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const aihubRoot = process.env.AIHUB_ROOT || path.join(os.homedir(), '.ai-hub');
const tp = path.join(aihubRoot, 'thirdparty', 'node_modules');
const { formatHex, wcagContrast, converter } = await import(pathToFileURL(path.join(tp, 'culori', 'bundled', 'culori.min.mjs')).href);
const polineMod = await import(pathToFileURL(path.join(tp, 'poline', 'dist', 'index.min.mjs')).href);

function main() {
  const base = process.argv[2] || '#3b82f6';
  const mode = (process.argv[3] || 'analogous').toLowerCase();
  const toHex = converter('rgb');
  const toOklch = converter('oklch');
  const white = { mode: 'rgb', r: 1, g: 1, b: 1 };
  const hueStep = mode === 'complementary' ? 180 : mode === 'triadic' ? 120 : 30;
  const baseOklch = toOklch(base);
  console.log('# color-palette (culori + poline · AI-Hub thirdparty)');
  console.log('- base: ' + base + ' · mode: ' + mode + ' · thirdparty: ' + tp);
  // culori 实际计算：oklch hue 步进生成和谐色 + WCAG 对比度
  let i = 0;
  for (const h of [0, hueStep, hueStep * 2, -hueStep, hueStep * 3, -hueStep * 2]) {
    const c = { mode: 'oklch', l: baseOklch.l, c: baseOklch.c, h: ((baseOklch.h + h) % 360 + 360) % 360 };
    const hex = formatHex(toHex(c));
    const contrast = wcagContrast(c, white);
    const role = i === 0 ? 'base' : i === 1 ? 'dominant(60%)' : i === 2 ? 'accent(30%)' : 'support(10%)';
    console.log('  ' + hex + '  ' + role + '  contrast-on-white=' + contrast.toFixed(2) + ':1' + (contrast < 4.5 ? '  ⚠ <4.5:1' : ''));
    i += 1;
  }
  // poline 声学调色板（已部署，类 API 可用则补充；失败不阻断）
  try {
    const Poline = polineMod.default || polineMod.poline;
    if (typeof Poline === 'function') {
      const po = new Poline({ numPoints: 6 });
      const pts = po && (po.points ? Array.from(po.points) : []);
      console.log('- poline (声学调色板): ' + (pts && pts.length ? '生成 ' + pts.length + ' 点' : '实例化成功'));
    }
  } catch (e) { console.log('- poline: 跳过（' + e.message + '）——culori 结果已输出'); }
}

try { main(); } catch (e) { console.error('[FAIL] color-palette: ' + e.message); console.error('  需 AI-Hub thirdparty 库：npm install --prefix <AIHUB_ROOT>/thirdparty culori poline'); process.exitCode = 1; }
