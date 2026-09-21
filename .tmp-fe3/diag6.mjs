import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
p.on('pageerror', e => console.log('PAGEERROR:', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text()); });
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);
// read-only introspection of render pipeline state
const out = await p.evaluate(() => {
  const payload = window.__YY_JOURNEY__;
  return {
    hasPayload: !!payload,
    readOk: payload && payload.read && payload.read.ok,
    hasJourney: !!(payload && payload.read && payload.read.data && payload.read.data.journey),
    nextPromptRaw: payload && payload.read.data.journey.nextPrompt,
    evidenceVisible: !document.getElementById('evidence-section').hidden,
    evidenceItems: document.querySelectorAll('#evidence-list li').length,
    nextHidden: document.getElementById('next-section').hidden,
    nextHint: document.getElementById('next-hint').textContent,
    pageMeta: document.getElementById('page-meta').textContent,
  };
});
console.log(JSON.stringify(out, null, 2));
await b.close();
