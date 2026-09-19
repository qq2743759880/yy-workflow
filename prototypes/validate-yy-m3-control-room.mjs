import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/prototypes/yy-m3-control-room.html';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];

for (const viewport of [{ width: 1440, height: 960 }, { width: 375, height: 812 }]) {
  const page = await browser.newPage({ viewportSize: viewport });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  for (let variant = 1; variant <= 3; variant += 1) {
    await page.goto(`${baseUrl}?v=${variant}`, { waitUntil: 'networkidle' });
    const state = await page.evaluate(() => ({
      title: document.title,
      activeVariant: new URLSearchParams(location.search).get('v'),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      heading: document.querySelector('h1')?.textContent?.trim(),
      fontFamily: getComputedStyle(document.body).fontFamily,
      interactiveCount: document.querySelectorAll('button').length,
    }));

    const action = page.locator('#stage [data-toast]').first();
    await action.click();
    const toastVisible = await page.locator('#toast').evaluate((node) => node.classList.contains('show'));
    results.push({ viewport: `${viewport.width}x${viewport.height}`, variant, ...state, toastVisible, errors: [...errors] });
  }

  await page.close();
}

await browser.close();

const failures = results.filter((result) =>
  result.horizontalOverflow || !result.heading || !result.toastVisible || result.errors.length > 0
);

console.log(JSON.stringify({ pass: failures.length === 0, results, failures }, null, 2));
process.exitCode = failures.length === 0 ? 0 : 1;
