import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
p.on('pageerror', e => console.log('PAGEERROR:', e.message, '|', (e.stack||'').split('\n')[1]));
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const btn = document.getElementById('copy-next-prompt');
  return {
    btnExists: !!btn,
    btnInDom: btn ? btn.isConnected : false,
    btnParent: btn ? btn.parentElement.className : null,
    nextSectionChildren: document.getElementById('next-section') ? document.getElementById('next-section').children.length : -1,
    nextSectionOuterHead: document.getElementById('next-section').outerHTML.slice(0, 200),
  };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
