#!/usr/bin/env node
/**
 * color-mix — 实际调用已部署的 chroma-js 做色彩操作：调暗/调亮/色相偏移/混色/WCAG 对比度/色板生成，
 * 补齐 colorize 资产的 chroma-js 内核（culori + poline 已由 color-palette.mjs 真调，本次补上缺的 chroma-js）。
 * 用法：node scripts/color-mix.mjs <base-hex>   （默认 #3b82f6）
 * 依赖：AI-Hub thirdparty 库（`$AIHUB_ROOT/thirdparty/node_modules`，默认 `~/.ai-hub`）。
 */
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const aihubRoot = process.env.AIHUB_ROOT || path.join(os.homedir(), '.ai-hub');
const tp = path.join(aihubRoot, 'thirdparty', 'node_modules');
// chroma-js 为 CJS，经 createRequire 直接加载其 dist CJS 打包（package.json exports 的 require 入口即 dist/chroma.cjs）
const req = createRequire(path.join(tp, 'color-mix.js'));
const chroma = req(path.join(tp, 'chroma-js', 'dist', 'chroma.cjs'));

function fmt(v) { return Array.isArray(v) ? v.map((x) => (typeof x === 'number' ? x.toFixed(2) : x)).join(' ') : String(v); }

function main() {
  const base = (process.argv[2] || '#3b82f6').toLowerCase();
  if (!chroma.valid(base)) throw new Error('非法颜色: ' + base);
  const c = chroma(base);
  const white = '#ffffff';
  const contrast = chroma.contrast(base, white);
  console.log('# color-mix (chroma-js · AI-Hub thirdparty)');
  console.log('- base: ' + base + ' · thirdparty: ' + tp);
  console.log('- 归一化: ' + c.hex() + ' · rgb=(' + c.rgb().join(',') + ') · hsl=(' + c.hsl().map((x) => x.toFixed(2)).join(',') + ')');
  console.log('- 调暗 darken(0.5): ' + c.darken(0.5).hex() + '  调亮 brighten(0.5): ' + c.brighten(0.5).hex());
  console.log('- 色相偏移 +40°(hsl.h): ' + c.set('hsl.h', ((c.get('hsl.h') + 40) % 360 + 360) % 360).hex());
  console.log('- 混色 mix(50% red): ' + chroma.mix(base, '#ef4444', 0.5).hex());
  console.log('- 对比度 on-white: ' + contrast.toFixed(2) + ':1' + (contrast < 4.5 ? '  ⚠ <4.5:1（WCAG AA 文本需 ≥4.5）' : ''));
  console.log('- 色板 scale(blue→red 5 档): ' + chroma.scale([base, '#ef4444']).colors(5).join(' '));
  console.log('- 亮度 luminance: ' + c.luminance().toFixed(3));
}

try { main(); }
catch (e) {
  console.error('[FAIL] color-mix: ' + e.message);
  console.error('  需 AI-Hub thirdparty 库：npm install --prefix <AIHUB_ROOT>/thirdparty chroma-js');
  process.exitCode = 1;
}
