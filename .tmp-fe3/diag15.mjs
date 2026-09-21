import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
// 全异常捕获（含 main 内同步抛出导致的 then 链 reject——用 both rejection & error 事件）
await p.addInitScript(() => {
  window.__ev = [];
  window.addEventListener('unhandledrejection', e => window.__ev.push('REJ: ' + (e.reason && (e.reason.stack || e.reason.message || e.reason))));
  window.addEventListener('error', e => window.__ev.push('ERR: ' + e.message + ' @' + e.filename + ':' + e.lineno));
});
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2000);
const ev = await p.evaluate(() => window.__ev);
console.log('events:', JSON.stringify(ev, null, 2));
// loading 文案状态：main 未被调用 vs 被调用
console.log('loading:', await p.evaluate(() => document.getElementById('loading').textContent));
await b.close();
