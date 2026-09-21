import { chromium } from 'playwright-core';
const exe = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: exe, headless: true });
const p = await (await b.newContext()).newPage();
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type().toUpperCase() + ':', m.text()); });
p.on('pageerror', e => console.log('PAGEERROR:', e.message, '\n', (e.stack||'').split('\n').slice(0,4).join('\n')));
await p.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
// 关键假设验证：main() 在 renderPhases 处抛 ReferenceError？strict mode 下裸 GUIDE_CONTENT
// 在 typeof 里不抛，但 main 走到 nextPrompt 段之前还有 renderPhases()/renderAssets() —— 它们内部 guard 用 typeof，不抛。
// 另一个可能：main 抛在 core.nextPromptView —— 不，前面验证过。
// 最终怀疑：main() 里 renderNextPrompt(npNormalized) 调用后，renderNextPrompt 里 btn.onclick 赋值正常，
// section.hidden=false 应生效。而实测 hidden 属性为 null(getAttribute 返回 null 说明 hidden 已被 JS 设为 false!)
// getAttribute('hidden')=null 表示属性已被移除！但 isHidden/hidden property 返回 true —— CSS？
const r = await p.evaluate(() => {
  const s = document.getElementById('next-section');
  const cs = getComputedStyle(s);
  return {
    hiddenProp: s.hidden,
    hiddenAttr: s.getAttribute('hidden'),
    display: cs.display,
    visibility: cs.visibility,
    rect: JSON.stringify(s.getBoundingClientRect()),
    html: s.outerHTML.slice(0, 300),
  };
});
console.log(JSON.stringify(r, null, 2));
console.log('isVisible:', await p.locator('#next-section').isVisible());
await b.close();
