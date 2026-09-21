import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);
// The 404 console error — find which request. Use performance entries (read-only).
const entries = await p.evaluate(() => performance.getEntriesByType('resource').map(e => e.name));
console.log('resources:', entries.join('\n'));
console.log('console errors:', errs);
await b.close();
