import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
// 决定性实验（纯只读）：在页面里重新执行与 main 相同序列但 try/catch 每步，找出哪一步抛。
// 注意：不能调页面闭包内的 renderPhases —— 但可以重新走 DOM 副作用等价检查。
// 真正决定性的问题：renderNextPrompt 没执行（hint 空、onclick null）。main 的执行顺序：
//   renderMeta(OK) -> renderStepNodes(OK) -> renderEvidence(OK) -> renderPhases -> renderAssets -> nextPrompt段
// 所以异常必然在 renderPhases 或 renderAssets。它们 guard 后 return —— 除非抛在 guard 之前？
// grid = document.getElementById('asset-grid') —— 存在。
// 还有个盲点：异常在 renderEvidence 之后的 renderPhases 里的 el() 调用前？不，guard 先 return。
// 再想想…… main 是 .then(main, onErr) 的 onErr —— 它只在 import 失败时写 loading 文案"render-core 加载失败"。
// loading 文案未变 => main 未 reject？不对！.then(main, onErr) 中 onErr 只捕 import 的 reject，
// main 内部抛错会传到 then 返回的新 promise —— 无人处理 => unhandledrejection。但 __ev 空。
// 唯一没排除的：main 根本没被调用！grid 9 个节点是谁渲染的？？——验证：清空静态 HTML 是否有预置节点？
const r = await p.evaluate(() => {
  const grid = document.getElementById('journey-grid');
  return {
    gridChildCount: grid.children.length,
    firstChildTag: grid.children[0] ? grid.children[0].tagName : null,
    // 关键：这些节点是 main 渲染的吗？main 渲染会写 node-step/badge/gate-card。
    firstChildHasBadge: grid.children[0] ? !!grid.children[0].querySelector('.badge') : null,
  };
});
console.log(JSON.stringify(r));
// 结论检查：document.readyState 时序。页面 IIFE 在 DOMContentLoaded 前执行(readyState=loading)，
// 注册 DOMContentLoaded -> import() -> main。若 readyState 已 interactive（脚本同步在 body 底部执行完时
// DOM 已就绪），走 else 分支直接 import()。两条路都应到 main。
// 但 404 console error 是 favicon —— import 成功（render-core.mjs 200）。
// 最终排查：main 被 then 调用时是否因为 view.degraded 分支提前 return？
// deriveJourneyView(window.__YY_JOURNEY__) —— payload 存在。但 main 里的 payload 是 window.__YY_JOURNEY__。
// mock script 注入位置在 IIFE 之前 —— 验证顺序：mock script 在 <script>// 页面入口 之前 => OK。
// 逐行只读重放 main —— 但 main 内部函数在闭包里，无法直接调。
// 决定性判据：若 main 执行了且走 degraded 分支，journey-grid 会被清空(textContent='')！grid 有 9 节点 => 走过了 renderStepNodes。
// 若 main 执行到 renderStepNodes，那 renderMeta 也执行了（顺序在前）。
// renderEvidence 在 renderStepNodes 后 —— evidence-section 可见=true => 执行了。
// renderPhases/renderAssets 都有 guard。然后 nextPrompt 段 —— 没执行。
// 那 renderPhases 或 renderAssets 内部抛了异常！guard 过了之后…… phases guard: GUIDE_CONTENT undefined -> return。
// 没有其他代码。除非 …… el() 抛错？不可能。
// 【最后一个盲点】main 的参数：.then(main) —— main(core) 接收模块命名空间对象。renderStepNodes(view, core) 用 core.mapStep。
// 都正常。那……直接看 evidence-section 可见性是真的吗？
console.log('evidenceVisible:', await p.evaluate(() => !document.getElementById('evidence-section').hidden));
console.log('meta:', await p.evaluate(() => document.getElementById('page-meta').textContent.slice(0, 40)));
// 也许根本不是同一个 main 在跑 —— 检查是否有缓存/旧 HTML：对比服务端 HTML 和 DOM 里的 script。
const domScriptCount = await p.evaluate(() => document.querySelectorAll('script').length);
console.log('domScriptCount:', domScriptCount);
await b.close();
