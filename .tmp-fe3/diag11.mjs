import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
await p.addInitScript(() => {
  window.__rejections = [];
  window.addEventListener('unhandledrejection', e => window.__rejections.push(String(e.reason && e.reason.stack || e.reason)));
});
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
// 只读重跑 main 的整段逻辑（复用真实 DOM 但只验证控制流），确定在哪一步停：
const r = await p.evaluate(async () => {
  const steps = [];
  const core = await import('./render-core.mjs');
  var view = core.deriveJourneyView(window.__YY_JOURNEY__);
  steps.push('degraded=' + view.degraded + ' notFound=' + view.notFound);
  if (view.degraded) { steps.push('STOP:degraded'); return steps; }
  if (view.notFound) { steps.push('STOP:notFound'); return steps; }
  steps.push('renderMeta: meta=' + document.getElementById('page-meta').textContent.length);
  steps.push('grid children=' + document.getElementById('journey-grid').children.length);
  steps.push('evidence hidden=' + document.getElementById('evidence-section').hidden);
  // GUIDE_CONTENT 检查（严格复制 renderPhases guard 上下文——页面 script 是 strict 的 IIFE 内部；
  // 这里在 evaluate 的非严格上下文，typeof 语义一致）
  steps.push('GUIDE_CONTENT=' + (typeof GUIDE_CONTENT));
  // 到 nextPrompt 段的判断：
  var npN = core.nextPromptView(view.nextPrompt);
  steps.push('branch=' + (npN ? 'renderNextPrompt(npN)' : (view.nextPrompt ? 'renderNextPrompt(view.nextPrompt)' : 'HIDE')));
  steps.push('actual-hidden=' + document.getElementById('next-section').hidden);
  steps.push('rejections-now=' + window.__rejections.length);
  return steps;
});
console.log(r.join('\n'));
await b.close();
