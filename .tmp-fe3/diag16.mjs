import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
// 假设收窄：main 内部在 renderPhases() 抛 ReferenceError: GUIDE_CONTENT is not defined
// （renderPhases 内 guard 用 typeof GUIDE_CONTENT —— strict 下 typeof 不抛；
//  但注意页面脚本顶部是 'use strict' IIFE —— typeof 对未声明变量安全）
// 但是！还有一个裸 GUIDE_CONTENT 引用可能在别处……搜页面 script 内所有 GUIDE_CONTENT 出现点
const srcScan = await p.evaluate(() => {
  const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('\n');
  const lines = scripts.split('\n');
  const hits = [];
  lines.forEach((l, i) => { if (l.includes('GUIDE_CONTENT')) hits.push((i+1) + ': ' + l.trim().slice(0, 100)); });
  return hits;
});
console.log(srcScan.join('\n'));
// 只读验证：在页面 strict 上下文里 typeof GUIDE_CONTENT —— 若页面 IIFE 是 strict，evaluate 是非 strict。
// 关键区分：模块作用域 vs 全局。renderPhases 定义在 IIFE 内部，引用 GUIDE_CONTENT 自由变量。
// 在 IIFE strict 模式下，typeof GUIDE_CONTENT 不抛。所以 guard 生效，renderPhases 正常 return。
// 那 main 应该继续。除非…… renderAssets 里某处直接引用 GUIDE_CONTENT.assets 无 guard？
console.log('---');
const scan2 = await p.evaluate(() => {
  const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('\n');
  const m = scripts.match(/function renderAssets[\s\S]{0,200}/);
  return m ? m[0].replace(/\n/g, ' | ').slice(0, 250) : 'not found';
});
console.log(scan2);
await b.close();
