import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
// 【关键疑点】页面 IIFE 'use strict' 中 renderPhases 引用自由变量 GUIDE_CONTENT。
// strict 模式下 typeof GUIDE_CONTENT 不抛错——对【未声明】变量。
// 但 evaluate 重放时 GUIDE_CONTENT 也是 undefined 且没抛 —— 等价。
// 【换个决定性视角】main 在 .then(main, onErr) —— 若 main 是 async 语义无；同步函数。
// main 同步执行到底需要无异常。我们的重放显示各段无异常。那 main 一定执行到了 nextPrompt 段！
// 而 nextPrompt 段执行 => section.hidden=false + onclick 赋值。实测均未发生。
// 矛盾！除非 main 的 view 和我重放的 view 不同 —— main 用的 core 是 import('./render-core.mjs')
// 相对【index-mock.html 的 URL】解析 => /render-core.mjs 同一模块。同一实例。
// 【啊，等一下】——看 index.html 源码 line 332: main 开头 document.getElementById('loading').hidden = true
// 然后 renderAlert(view, core)。若 view.degraded —— grid 清空 return。grid 有 9 节点 => 非 degraded。
// 那 renderNextPrompt 一定执行……除非 js 引擎在 renderPhases 的 GUIDE_CONTENT 引用上抛了
// ReferenceError —— 注意！renderPhases 的 guard 是 typeof GUIDE_CONTENT —— 但 main 里调用顺序：
// renderPhases() 先执行。我在 evaluate 重放时上下文是页面主世界，typeof 检测的是全局。
// 但 IIFE 内的 GUIDE_CONTENT 自由变量解析：IIFE 是普通 script（非 module），strict mode。
// 自由变量 GUIDE_CONTENT 沿作用域链到全局 —— undefined => typeof 'undefined' => return。
// 与重放一致。没毛病。
// 【最后一个可能】行号 168 的 guard 里 `!Array.isArray(GUIDE_CONTENT.phases)` —— typeof 检查短路，
// 不会二次求值。
// 【终极手段】只读对照：把同一页面在【无 404 favicon】下重跑，排除时序。另外直接读 main 是否
// 走了 notFound 分支：notFound 时 renderNotFound 会清空 grid 并放 1 张卡。grid=9 => 非 notFound。
// 那 main 必然执行到倒数第二段。除非 —— renderNextPrompt 内部抛错！
// renderNextPrompt(npNormalized) 内部: section.hidden=false; getElementById('next-hint').textContent = ...
// btn.onclick = ... copyText(np.actionHint...) —— 都不抛。
// 【慢着】—— main 里： var npNormalized = core.nextPromptView(view.nextPrompt);
// 若 view.nextPrompt 为 null => nextPromptView(null) => null => npNormalized=null =>
// else if (view.nextPrompt) —— 也是 null => else: next-section.hidden = true。
// 而我重放时 view.nextPrompt 是对象！为什么真实 main 的 view.nextPrompt 会是 null？
// 差异：重放的 deriveJourneyView 参数是 window.__YY_JOURNEY__ —— 同一。
// 【真正区别】真实 main 执行时刻 vs mock script 设置时刻。检查执行顺序：mock script 在 IIFE 前 —— 但
// IIFE 只注册 DOMContentLoaded，import 异步 => main 运行时 payload 早已就位。
// 结论实验：直接检查 404 favicon 干扰论 + 换 query 破缓存重跑：
await p.goto('http://127.0.0.1:8102/index-mock.html?nocache=' + Date.now(), { waitUntil: 'load' });
await p.waitForTimeout(2000);
console.log('hint:', await p.evaluate(() => JSON.stringify(document.getElementById('next-hint').textContent)));
console.log('hidden:', await p.evaluate(() => document.getElementById('next-section').hidden));
console.log('loading:', await p.evaluate(() => document.getElementById('loading').textContent));
console.log('grid:', await p.evaluate(() => document.getElementById('journey-grid').children.length));
await b.close();
