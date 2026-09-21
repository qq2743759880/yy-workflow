import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
// 终极只读探针：真实 main 的 import().then(main, onErr) —— onErr 会写 loading 文案。
// loading 文案是原始的"正在读取..." => main 被调用且没抛到 reject；但 nextPrompt 段没执行。
// 可能性只剩：main 在 renderPhases() 或 renderAssets() 抛异常 -> then(main, onErr) 的 onErr 不捕 main 内部异常（它是同步回调内抛出），
// 那会变成 unhandledrejection —— 但没有。除非 import().then(main) 返回的 promise 无人 catch 且 unhandledrejection 监听注册晚了？
// addInitScript 在文档脚本之前跑，监听时机足够早。
// 还有一种：页面 IIFE 用的 import() —— 若 main 抛错，promise 链 .then(main, function(e){loading.textContent=...})
// 注意：这个 then 的第二个参数是 rejection handler！main 内部抛错会让 then 返回的 promise reject，但没人再接 —— unhandledrejection。
// 但 reject handler 只捕 import 本身的失败。main 内异常 => unhandledrejection 触发（异步）。
// 等等—— 1500ms 应该够。做最后一个实验：给 main 的每一步打假（不行，不能改页面）。
// 换个角度：直接在页面里重定义……不行，黑盒。
// 只读检查：调用栈线索 —— 用 Performance/long task 不行。
// 简单粗暴的只读判断：renderNextPrompt 若执行过，btn.onclick 会被赋值(函数)。但 hidden=true 时 copy 不可见。
// 检查 onclick 是否被赋值（只读）：
const r = await p.evaluate(() => {
  const btn = document.getElementById('copy-next-prompt');
  return {
    onclickAssigned: typeof btn.onclick === 'function' || btn.onclick != null,
    onclickType: typeof btn.onclick,
    nextHintText: JSON.stringify(document.getElementById('next-hint').textContent),
    nextMetaText: JSON.stringify(document.getElementById('next-meta').textContent),
  };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
