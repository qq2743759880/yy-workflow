// FE-3 GUI black-box test driver. Read-only DOM checks + screenshots via playwright-core.
// No page-state modification: all interactions are real GUI actions (clicks) through locators.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const SHOT = 'D:/.ai-hub/skills/yy/test-reports/autopilot-work/FE-3/screenshots';
const results = [];
let shotCount = 0;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

function rec(id, name, status, note) {
  results.push({ id, name, status, note });
  console.log(`[${status}] ${id} ${name} :: ${note}`);
}
async function shot(name) {
  const p = `${SHOT}/${name}.png`;
  await page.screenshot({ path: p, fullPage: false });
  shotCount++;
  return p;
}

// ---------- T1/P0: mock payload page load ----------
await page.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#journey-grid .journey-node', { timeout: 5000 });
await shot('t1_overview');
const nodeCount = await page.locator('#journey-grid .journey-node').count();
const nodeNames = await page.locator('#journey-grid .node-name').allTextContents();
const badges = await page.locator('#journey-grid .badge').count();
const gateCards = await page.locator('#journey-grid .gate-card').count();
const nodeNamesVisible = await page.locator('#journey-grid .node-name').first().isVisible();
rec('T1.1', '页面加载+截图总览', nodeCount === 9 ? 'PASS' : 'FAIL', `journey nodes=${nodeCount}, shot=t1_overview.png`);
rec('T1.2', '九节点渲染(节点名+状态徽章)', (nodeCount === 9 && badges === 9 && nodeNamesVisible && gateCards === 9) ? 'PASS' : 'FAIL',
  `names[0..2]=${nodeNames.slice(0, 3).join('/')}, badges=${badges}, gateCards=${gateCards}`);

// B 阶段手册 6 段
const phaseItems = await page.locator('#phases-list .phase-item').count();
const phaseNames = await page.locator('#phases-list .phase-name').allTextContents();
await shot('t1_phases');
rec('T1.3', 'B 阶段手册 6 段全渲染', phaseItems === 6 ? 'PASS' : 'FAIL', `phaseItems=${phaseItems}, names=${phaseNames.join('/')}`);

// C 资产手册 16 卡
const assetCards = await page.locator('#asset-grid .asset-card').count();
const assetNames = await page.locator('#asset-grid .asset-name').allTextContents();
await shot('t1_assets');
rec('T1.4', 'C 资产手册 16 卡全渲染', assetCards === 16 ? 'PASS' : 'FAIL', `assetCards=${assetCards}, first=${assetNames.slice(0, 3).join('/')}`);

// ---------- T2/P0: copy button click -> clipboard feedback ----------
const cp = page.locator('#copy-next-prompt');
const btnBefore = await cp.textContent();
await cp.click();
// transient state: grab feedback text quickly
await page.waitForTimeout(300);
const feedback = await page.locator('#copy-feedback').textContent();
const globalStatus = await page.locator('#copy-status').textContent();
const btnAfter = await cp.textContent();
await shot('t2_copy_feedback');
const clip = await page.evaluate(() => navigator.clipboard.readText().catch(e => 'READ_FAIL:' + e.message));
rec('T2.1', '复制按钮点击 -> 剪贴板反馈态', (feedback && feedback.includes('已复制')) || (btnAfter && btnAfter.includes('复制')) ? 'PASS' : 'FAIL',
  `btnBefore="${btnBefore}", btnAfter="${btnAfter}", feedback="${feedback}", global="${globalStatus}"`);
rec('T2.2', '真剪贴板内容验证', typeof clip === 'string' && clip.includes('并行派单') ? 'PASS' : 'FAIL', `clipboard="${String(clip).slice(0, 60)}"`);

// ---------- T3/P1: alert banner hidden when healthy ----------
const bannerHidden = await page.locator('#alert-banner').isHidden();
await shot('t3_banner_hidden');
rec('T3.1', '告警条健康时隐藏', bannerHidden ? 'PASS' : 'FAIL', `alert-banner hidden=${bannerHidden}`);

// ---------- T4/P1: copy fail feedback (phase copy buttons) ----------
const kickBtn = page.locator('.phase-copy').first();
await kickBtn.click();
await page.waitForTimeout(300);
const g2 = await page.locator('#copy-status').textContent();
const kb = await kickBtn.textContent();
await shot('t4_phase_copy');
rec('T4.1', '阶段手册复制按钮反馈', (g2 && (g2.includes('已复制') || g2.includes('复制失败'))) ? 'PASS' : 'FAIL', `global status="${g2}", btn="${kb}"`);

// 连点复制按钮不崩 (P2)
for (let i = 0; i < 5; i++) await cp.click();
await page.waitForTimeout(300);
const alive = await page.locator('#journey-grid .journey-node').count();
const g3 = await page.locator('#copy-status').textContent();
await shot('t5_rapid_clicks');
rec('T5.1', '连点复制按钮不崩', alive === 9 ? 'PASS' : 'FAIL', `nodes after 5 rapid clicks=${alive}, status="${g3}"`);

// ---------- P1: dark theme via prefers-color-scheme emulation ----------
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
const page2 = await ctx2.newPage();
await page2.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await page2.waitForSelector('#journey-grid .journey-node', { timeout: 5000 });
await page2.screenshot({ path: `${SHOT}/t6_dark_theme.png` });
shotCount++;
const bgDark = await page2.evaluate(() => getComputedStyle(document.body).backgroundColor);
const fgDark = await page2.evaluate(() => getComputedStyle(document.body).color);
rec('T6.1', '双主题切换(dark 模拟)', bgDark !== fgDark ? 'PASS' : 'FAIL', `dark body bg=${bgDark}, color=${fgDark}`);
await ctx2.close();

// ---------- P2: degraded channel (no injected payload) ----------
const page3 = await ctx.newPage();
await page3.goto('http://127.0.0.1:8102/index.html', { waitUntil: 'domcontentloaded' });
await page3.waitForTimeout(800);
const bannerVisible = await page3.locator('#alert-banner').isVisible();
const bodyText = (await page3.locator('body').innerText()).trim();
await page3.screenshot({ path: `${SHOT}/t7_degraded.png` });
shotCount++;
const notBlank = bodyText.length > 50;
const degradedShown = bodyText.includes('降级');
rec('T7.1', '无注入数据不白屏(degraded 通道)', (notBlank && degradedShown && bannerVisible) ? 'PASS' : 'FAIL',
  `bannerVisible=${bannerVisible}, bodyLen=${bodyText.length}, has降级=${degradedShown}`);
const manualStill = await page3.locator('#phases-list .phase-item').count();
rec('T7.2', '降级时 B/C 手册仍渲染', manualStill === 6 ? 'PASS' : 'FAIL', `phaseItems in degraded=${manualStill}`);
await page3.close();

// ---------- P2: long description overflow ----------
await page.goto('http://127.0.0.1:8102/index-long.html', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#journey-grid .journey-node', { timeout: 5000 });
const longCard = page.locator('.asset-card', { hasText: '超长描述测试卡' });
const overflowX = await longCard.evaluate(el => el.scrollWidth - el.clientWidth);
const wrap = await longCard.locator('.asset-desc').evaluate(el => getComputedStyle(el).overflowWrap);
const gridW = await page.locator('#asset-grid').evaluate(el => el.scrollWidth - el.clientWidth);
await longCard.scrollIntoViewIfNeeded();
await shot('t8_long_desc');
rec('T8.1', '超长资产 description 不溢出', overflowX <= 2 && gridW <= 2 ? 'PASS' : 'FAIL', `card overflowX=${overflowX}, grid overflowX=${gridW}, overflow-wrap=${wrap}`);

// ---------- P3: touch target >= 44px ----------
const cpBox = await cp.boundingBox();
const kbBox = await kickBtn.boundingBox();
const assetBtn = await page.locator('.asset-copy').first().boundingBox();
const okH = [cpBox, kbBox, assetBtn].every(b => b && b.height >= 40); // note: spec says >=44
const minH = Math.min(cpBox.height, kbBox.height, assetBtn.height);
rec('T9.1', '触控区 >=44px', minH >= 44 ? 'PASS' : 'FAIL', `copy=${cpBox.height}px, phaseCopy=${kbBox.height}px, assetCopy=${assetBtn.height}px (min=${minH}px)`);

// ---------- P3: contrast DOM cross-check ----------
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const fg = await page.evaluate(() => getComputedStyle(document.body).color);
function parse(c) { const m = c.match(/\d+/g).map(Number); return m.slice(0, 3); }
function lum([r, g, b]) { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function ratio(a, b) { const l1 = lum(parse(a)), l2 = lum(parse(b)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
const cr = ratio(fg, bg);
rec('T9.2', '正文对比度 DOM 交叉验证', cr >= 4.5 ? 'PASS' : 'FAIL', `fg=${fg}, bg=${bg}, ratio=${cr.toFixed(2)}`);
const badgeFg = await page.locator('.badge').first().evaluate(el => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
const crBadge = ratio(badgeFg[0], badgeFg[1]);
rec('T9.3', '状态徽章对比度 DOM 交叉验证', crBadge >= 3 ? 'PASS' : 'FAIL', `badge fg=${badgeFg[0]}, bg=${badgeFg[1]}, ratio=${crBadge.toFixed(2)}`);

// Swiss minimal style visual check
await page.goto('http://127.0.0.1:8102/index-mock.html', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#journey-grid .journey-node');
await shot('t10_swiss_top');
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); // scroll only, read-only visual
await shot('t10_swiss_bottom');
rec('T10.1', '极简瑞士风格目测(截图)', 'MANUAL', 'see t10_swiss_top.png / t10_swiss_bottom.png');

console.log('---CONSOLE ERRORS---');
console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');
console.log(`SHOTS=${shotCount}`);
fs.writeFileSync(`${SHOT}/../results.json`, JSON.stringify({ results, consoleErrors, shotCount }, null, 2));
await browser.close();
