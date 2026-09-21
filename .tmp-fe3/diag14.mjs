import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
// onclick 只读检查（上次 evaluate 写法问题——btn 为 null 是因为 strict 下 getElementById 不可能 null……重试，检查 onclick 属性）
const r = await p.evaluate(() => {
  const btn = document.getElementById('copy-next-prompt');
  // onclick 在 HTMLAttribute 未设置时返回 null；JS 赋值后是 function
  return {
    onclickIsNull: btn.onclick === null,
    onclickIsFunction: typeof btn.onclick,
    // 侧证：renderNextPrompt 还会写 next-hint 文本。next-hint 为空 => renderNextPrompt 未执行
    hint: JSON.stringify(document.getElementById('next-hint').textContent),
    meta: JSON.stringify(document.getElementById('next-meta').textContent),
  };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
