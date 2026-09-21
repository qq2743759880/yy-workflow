import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
// 决定性判据：main() 第一步 document.getElementById('loading').hidden = true。
// loading 的 hidden property 现在是？若 false => main 根本没执行！grid 9 节点另有来源？？不可能……
// 等等 —— diag6 里我打过 "loading hidden: true"。OK main 执行过。
// 那 main 执行过、renderStepNodes 执行过、nextPrompt 段没执行。中间只有 renderPhases/renderAssets。
// 它们 guard 后 return。除非【main 中 renderPhases() 调用点本身抛 ReferenceError】——
// renderPhases 是 IIFE 内函数声明，不会。
// 【顿悟候选】IIFE 是 'use strict'。strict 模式下给只读属性赋值抛 TypeError —— 
// renderNextPrompt 里 btn.onclick = function... 没问题。
// 【再读源码】main 里 nextPrompt 段之前还有一行注释说 conflictView —— 无。
// 【真·盲点】renderNextPrompt(view) 的参数在 main 里是 npNormalized —— 有 actionHint。
// 哦！！！等一下。renderNextPrompt 的定义（line 171-187）：
//   function renderNextPrompt(view) {
//     var section = document.getElementById('next-section');
//     var np = view.nextPrompt;    <<<<<<< 这里！！参数名叫 view，内部取 view.nextPrompt！
//     if (!np) { section.hidden = true; return; }
// main 传入的实参是 npNormalized（= nextPrompt 对象），但函数内部取 view.nextPrompt ——
// 即 npNormalized.nextPrompt —— undefined！=> section.hidden = true; return!
// 这就是 BUG：双重归一化 + 参数语义不匹配 => next 区永远隐藏、复制按钮永远不可点。
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
// 只读验证该假说：renderNextPrompt 内部行为 => next-hint 永远空、next-meta 永远空、hidden 恒 true
const r = await p.evaluate(() => ({
  hidden: document.getElementById('next-section').hidden,
  hint: document.getElementById('next-hint').textContent,
  meta: document.getElementById('next-meta').textContent,
}));
console.log('验证 renderNextPrompt 提前 return 假说:', JSON.stringify(r));
await b.close();
