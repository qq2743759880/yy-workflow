import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
// 决定性：hook Function.prototype 不可行（会注入）。改用纯只读+对照实验：
// 用页面自身环境重放完整 main 逻辑（等价重实现，只读 DOM 已有状态做对照）。
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
const replay = await p.evaluate(async () => {
  const core = await import('./render-core.mjs');
  const view = core.deriveJourneyView(window.__YY_JOURNEY__);
  const log = [];
  // 等价 renderNextPrompt（只读判断，不写 DOM）
  try {
    var npN = core.nextPromptView(view.nextPrompt);
    if (npN) {
      log.push('would: section.hidden=false');
      log.push('would: hint=' + JSON.stringify(npN.actionHint || '（无 actionHint）'));
    } else { log.push('npN falsy -> else branch'); }
  } catch (e) { log.push('ERR at nextPrompt segment: ' + e.message); }
  // 等价 renderPhases
  try {
    var list = document.getElementById('phases-list');
    if (!list || typeof GUIDE_CONTENT === 'undefined' || !Array.isArray(GUIDE_CONTENT.phases)) {
      log.push('renderPhases: guard-return (no crash)');
    }
  } catch (e) { log.push('ERR at renderPhases: ' + e.message); }
  // 等价 renderAssets
  try {
    var grid = document.getElementById('asset-grid');
    if (!grid || typeof GUIDE_CONTENT === 'undefined' || !Array.isArray(GUIDE_CONTENT.assets)) {
      log.push('renderAssets: guard-return (no crash)');
    }
  } catch (e) { log.push('ERR at renderAssets: ' + e.message); }
  return log;
});
console.log(replay.join('\n'));
console.log('=> 结论候选：真实 main 的异常点必须在 renderPhases/renderAssets 内 —— 但重放显示 guard 不抛。');
console.log('=> 另一解释：真实 main 执行在 mock script 注入之前的 __YY_JOURNEY__ —— 不可能，注入在前。');
await b.close();
