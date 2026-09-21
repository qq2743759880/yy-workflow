import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);
// Pure read-only replication of main()'s logic path using the page's own imported render-core module.
// Dynamic import of the SAME module URL from page context (read-only, no state change).
const r = await p.evaluate(async () => {
  const core = await import('./render-core.mjs');
  const view = core.deriveJourneyView(window.__YY_JOURNEY__);
  const npNorm = core.nextPromptView(view.nextPrompt);
  return {
    viewNextPrompt: view.nextPrompt,
    npNormalized: npNorm,
    npNormTruthy: !!npNorm,
  };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
