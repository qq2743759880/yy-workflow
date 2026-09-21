import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
p.on('pageerror', e => console.log('PAGEERROR:', e.message));
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);
// 关键复现：main() 是 async import 的 then 回调。检查 main 是否在 renderPhases 之前就抛了异常。
// 顺序：renderMeta -> renderStepNodes -> renderEvidence -> renderPhases -> renderAssets -> nextPrompt 段
// 证据：pageMeta 有值(renderMeta OK)、grid 9(renderStepNodes OK)、evidence 2(renderEvidence OK)
// nextHidden=true 说明没走到最后的 nextPrompt 段。中间是 renderPhases/renderAssets —— GUIDE_CONTENT undefined 时
// 这两个函数有 guard 直接 return，不抛。那 main 应该继续走到 nextPrompt 段……除非 renderPhases/renderAssets 抛了。
// renderPhases 的 guard: typeof GUIDE_CONTENT === 'undefined' —— 注意 GUIDE_CONTENT 是裸标识符，在 strict mode
// 下 typeof 未声明变量不抛。但 renderPhases 内 guard 正常。
// 等等——还有 core.nextPromptView(view.nextPrompt) 在 main 里。若 core 参数未传？main(core) 由 import().then(main) 调用，
// render-core.mjs 模块对象作为 core —— OK。
// 直接在页面里只读复现整条 main 链，看哪一步断了：
const r = await p.evaluate(async () => {
  const steps = [];
  try {
    const core = await import('./render-core.mjs');
    steps.push('import ok');
    var view = core.deriveJourneyView(window.__YY_JOURNEY__);
    steps.push('derive ok, degraded=' + view.degraded);
    // renderMeta 已验证。手动执行 nextPrompt 段逻辑（不写 DOM——只判断分支）：
    var npN = core.nextPromptView(view.nextPrompt);
    steps.push('npN=' + (npN ? 'obj' : 'null'));
    steps.push('view.nextPrompt=' + (view.nextPrompt ? 'obj' : 'null'));
    // 复现 renderPhases 的 guard 逻辑
    steps.push('GUIDE_CONTENT typeof=' + (typeof GUIDE_CONTENT));
    // 复现真实 main 中的调用——但只读检查函数是否存在于页面闭包外不可行；改为检查 next-section 是否真被设置过
    steps.push('next-hidden-attr=' + document.getElementById('next-section').getAttribute('hidden'));
  } catch (e) { steps.push('ERR: ' + e.message); }
  return steps;
});
console.log(r.join('\n'));
await b.close();
