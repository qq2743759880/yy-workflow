import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
// 捕获 main() promise rejection：unhandledrejection 只读监听
await p.addInitScript(() => {
  window.__rejections = [];
  window.addEventListener('unhandledrejection', e => window.__rejections.push(String(e.reason && e.reason.stack || e.reason)));
});
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
console.log('rejections:', JSON.stringify(await p.evaluate(() => window.__rejections), null, 2));
console.log('nextHidden:', await p.evaluate(() => document.getElementById('next-section').hidden));
console.log('phases:', await p.evaluate(() => document.querySelectorAll('.phase-item').length));
await b.close();
