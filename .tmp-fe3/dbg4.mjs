import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
const failed = []; p.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
console.log('failed reqs:', failed);
console.log('import result check — loading text:', await p.evaluate(() => document.getElementById('loading').textContent));
// check via DOM: does journey-grid render? (render-core.mjs loaded?)
console.log('grid children:', await p.evaluate(() => document.getElementById('journey-grid').children.length));
console.log('favicon 404 is expected noise; look for render-core 404 above');
await b.close();
