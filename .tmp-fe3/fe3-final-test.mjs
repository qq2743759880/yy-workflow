// FE-3 正式 GUI 黑盒测试驱动（playwright-core + 系统 Chrome headless）
// 方法论：真实 GUI 动作（导航/点击）+ 只读 DOM 交叉验证 + 截图视觉验证。无任何页面状态注入。
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const SHOT = 'D:/.ai-hub/skills/yy/test-reports/autopilot-work/FE-3/screenshots';
const BASE = 'http://127.0.0.1:8102';
const results = [];
let shots = [];
const consoleErrors = [];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

function rec(id, name, status, note) {
  results.push({ id, name, status, note });
  console.log(`[${status}] ${id} ${name} :: ${note}`);
}
async function shot(name) {
  const p = `${SHOT}/${name}.png`;
  await page.screenshot({ path: p });
  shots.push(p);
  return p;
}

// ============ T1 P0: 健康投影主流程（mock payload 页面副本） ============
await page.goto(`${BASE}/index-mock.html`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#journey-grid .journey-node', { timeout: 5000 });
await page.waitForTimeout(300);
await shot('t1_overview_top');
const nodeCount = await page.locator('#journey-grid .journey-node').count();
const nodeNames = await page.locator('#journey-grid .node-name').allTextContents();
const badges = await page.locator('#journey-grid .badge').allTextContents();
const gateCards = await page.locator('#journey-grid .gate-card').count();
const gateLines = await page.locator('#journey-grid .gate-line').allTextContents();
const loadingHidden = await page.locator('#loading').isHidden();
const meta = await page.locator('#page-meta').textContent();
rec('T1.1', '页面加载+截图总览(健康投影)', nodeCount === 9 && loadingHidden ? 'PASS' : 'FAIL',
  `nodes=${nodeCount}, loadingHidden=${loadingHidden}, meta="${meta}"`);
rec('T1.2', '九节点渲染(节点名+状态徽章+gate卡)', (nodeCount === 9 && badges.length === 9 && gateCards === 9) ? 'PASS' : 'FAIL',
  `names=${nodeNames.join('/')}; badges[0]=${badges[0]}, badges[6]=${badges[6]}, badges[8]=${badges[8]}; gateLine[1]=${gateLines[1]}, gateLine[0]=${gateLines[0]}`);

// B/C 手册
const phaseItems = await page.locator('#phases-list .phase-item').count();
const assetCards = await page.locator('#asset-grid .asset-card').count();
const guideUndef = await page.evaluate(() => typeof GUIDE_CONTENT);
await shot('t1_phases_assets_area');
rec('T1.3', 'B 阶段手册 6 段全渲染', phaseItems === 6 ? 'PASS' : 'FAIL',
  `phaseItems=${phaseItems} (期望 6); GUIDE_CONTENT typeof=${guideUndef} -> content.js 未被页面加载 (DEFECT-2)`);
rec('T1.4', 'C 资产手册 16 卡全渲染', assetCards === 16 ? 'PASS' : 'FAIL',
  `assetCards=${assetCards} (期望 16); 同因 DEFECT-2`);

// ============ T2 P0: 复制按钮点击 -> 剪贴板反馈态 ============
const cp = page.locator('#copy-next-prompt');
const cpVisible = await cp.isVisible();
const cpInDom = await page.evaluate(() => !!document.getElementById('copy-next-prompt'));
const nextHidden = await page.evaluate(() => document.getElementById('next-section').hidden);
await shot('t2_next_section_hidden');
rec('T2.1', '下一步提示区+复制按钮可见', cpVisible ? 'PASS' : 'FAIL',
  `button in DOM=${cpInDom} but visible=${cpVisible}, next-section hidden=${nextHidden} -> renderNextPrompt 参数语义不匹配 (DEFECT-1), 按钮永不可见`);

// GUI 忠实行为尝试：对不可见元素的真实点击（用户视角 = 无可点击目标）
let clickOutcome = 'not attempted';
if (cpInDom && !cpVisible) {
  try {
    await cp.click({ timeout: 2000 });
    clickOutcome = 'clicked(!)';
  } catch (e) {
    clickOutcome = 'click failed: element not visible (用户无法点击) — ' + e.message.split('\n')[0];
  }
}
const feedbackAfter = await page.evaluate(() => document.getElementById('copy-feedback').textContent);
rec('T2.2', '复制按钮点击 -> 剪贴板反馈态', cpVisible ? 'BLOCKED' : 'BLOCKED',
  `GUI 点击不可达: ${clickOutcome}; feedback="${feedbackAfter}" — 被 DEFECT-1 阻断, 无法验证剪贴板链路`);

// ============ T3 P1: 告警条健康时隐藏 ============
const bannerHiddenHealthy = await page.locator('#alert-banner').isHidden();
await shot('t3_banner_hidden_healthy');
rec('T3.1', '告警条健康时隐藏', bannerHiddenHealthy ? 'PASS' : 'FAIL', `alert-banner hidden=${bannerHiddenHealthy} (role=alert)`);

// ============ T4 P1: notFound 通道 ============
await page.goto(`${BASE}/index-notfound.html`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
const nfCard = await page.locator('#journey-grid .journey-node .node-name').allTextContents();
const nfBanner = await page.locator('#alert-banner').isVisible();
await shot('t4_notfound');
rec('T4.1', 'JOURNEY_NOT_FOUND 数据通道渲染诊断卡', nfCard.includes('未找到 journey') && !nfBanner ? 'PASS' : 'FAIL',
  `grid cards=${JSON.stringify(nfCard)}, bannerVisible=${nfBanner} (契约: 数据通道而非告警条)`);

// ============ T5 P1: conflict 通道 ============
await page.goto(`${BASE}/index-conflict.html`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
const cfTitle = await page.locator('#alert-title').textContent();
const cfReason = await page.locator('#alert-reason').textContent();
const cfItems = await page.locator('#alert-conflicts .alert-conflict-item').allTextContents();
await shot('t5_conflict_banner');
rec('T5.1', 'PROJECTION_CONFLICT 双侧证据告警条', (cfTitle || '').includes('冲突') && cfItems.length === 2 ? 'PASS' : 'FAIL',
  `title="${cfTitle}", reason="${cfReason}", conflicts=${JSON.stringify(cfItems)}`);

// ============ T6 P2: degraded 通道（无注入数据，真实静态骨架页） ============
// 注：8102 只服务临时目录；index.html 骨架在 8101（webview/journey 原目录服务器）
await page.goto(`http://127.0.0.1:8101/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
const dBannerVisible = await page.locator('#alert-banner').isVisible();
const dTitle = await page.evaluate(() => (document.getElementById('alert-title') || {}).textContent || '');
const dReason = await page.evaluate(() => (document.getElementById('alert-reason') || {}).textContent || '');
const dBodyLen = (await page.locator('body').innerText()).trim().length;
const dGridEmpty = await page.evaluate(() => document.getElementById('journey-grid').children.length);
await shot('t6_degraded');
rec('T6.1', '无注入数据不白屏(degraded 通道)', dBannerVisible && dBodyLen > 50 && dGridEmpty === 0 ? 'PASS' : 'FAIL',
  `bannerVisible=${dBannerVisible}, title="${dTitle}", reason="${dReason}", bodyLen=${dBodyLen}, gridChildren=${dGridEmpty} (不伪造数据)`);

// ============ T7 P1: 双主题（prefers-color-scheme 模拟） ============
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
const pd = await ctx2.newPage();
await pd.goto(`${BASE}/index-mock.html`, { waitUntil: 'domcontentloaded' });
await pd.waitForSelector('#journey-grid .journey-node', { timeout: 5000 });
await pd.screenshot({ path: `${SHOT}/t7_dark_theme.png` }); shots.push(`${SHOT}/t7_dark_theme.png`);
const dStyles = await pd.evaluate(() => ({
  bg: getComputedStyle(document.body).backgroundColor,
  fg: getComputedStyle(document.body).color,
  badgeBg: getComputedStyle(document.querySelector('.badge')).backgroundColor,
}));
await ctx2.close();
const dBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
rec('T7.1', '双主题切换(dark 模拟 vs light)', (dStyles.bg !== dBg) ? 'PASS' : 'FAIL',
  `light bg=${dBg}, dark bg=${dStyles.bg}, dark badge bg=${dStyles.badgeBg}`);

// ============ T8 P2: 超长资产 description 溢出 — 被 DEFECT-2 阻断 ============
rec('T8.1', '超长资产 description 不溢出', 'BLOCKED',
  '资产卡 0 张(DEFECT-2), 无渲染目标可测; 代码级交叉验证: styles.css .asset-desc/.asset-name/.cluster-badge 均含 overflow-wrap:anywhere (仅静态核对, GUI 未验证)');

// ============ T9 P2: 连点复制按钮不崩 — 被 DEFECT-1/2 阻断 ============
rec('T9.1', '连点复制按钮不崩', 'BLOCKED', '全部复制按钮不可见/不存在(DEFECT-1+DEFECT-2), 无可点击目标');

// ============ T10 P3: 触控区 44px (DOM 量测) ============
const cpBox = await page.evaluate(() => {
  const b = document.getElementById('copy-next-prompt');
  const cs = getComputedStyle(b);
  return { minH: cs.minHeight, minW: cs.minWidth, h: cs.height };
});
rec('T10.1', '触控区 >=44px (DOM 量测)', cpBox.minH === '44px' && cpBox.minW === '44px' ? 'PASS' : 'FAIL',
  `copy-button computed min-height=${cpBox.minH}, min-width=${cpBox.minW}; 注意按钮不可见(DEFECT-1), 视觉级无法确认`);

// ============ T11 P3: 对比度 DOM 交叉验证 + WCAG 计算 ============
await page.goto(`${BASE}/index-mock.html`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#journey-grid .journey-node', { timeout: 5000 });
const colors = await page.evaluate(() => {
  const pick = (el, prop) => getComputedStyle(el)[prop];
  const badge = document.querySelector('.badge');
  const gateLine = document.querySelector('.gate-line');
  const nodeStep = document.querySelector('.node-step');
  return {
    bodyFg: pick(document.body, 'color'), bodyBg: pick(document.body, 'backgroundColor'),
    badgeFg: pick(badge, 'color'), badgeBg: pick(badge, 'backgroundColor'),
    gateFg: pick(gateLine, 'color'), nodeStepFg: pick(nodeStep, 'color'),
  };
});
function parse(c) { const m = c.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2]]; }
function lum([r, g, b]) { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function ratio(a, b) { const l1 = lum(parse(a)), l2 = lum(parse(b)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
const crBody = ratio(colors.bodyFg, colors.bodyBg);
const crBadge = ratio(colors.badgeFg, colors.badgeBg);
rec('T11.1', '正文对比度 >=4.5:1 (DOM+WCAG)', crBody >= 4.5 ? 'PASS' : 'FAIL', `fg=${colors.bodyFg} bg=${colors.bodyBg} ratio=${crBody.toFixed(2)}`);
rec('T11.2', '状态徽章对比度 (DOM+WCAG)', crBadge >= 4.5 ? 'PASS' : 'FAIL', `badge fg=${colors.badgeFg} bg=${colors.badgeBg} ratio=${crBadge.toFixed(2)}`);
await shot('t11_contrast_area');

// ============ T12 P3: 瑞士风格目测（网格/留白/扁平色/零装饰） ============
await shot('t12_swiss_top');
await page.locator('#journey-heading').scrollIntoViewIfNeeded();
await shot('t12_swiss_grid');
const gridCols = await page.evaluate(() => getComputedStyle(document.querySelector('.journey-grid')).gridTemplateColumns.split(' ').length);
const shadows = await page.evaluate(() => {
  let n = 0;
  document.querySelectorAll('*').forEach(el => { const s = getComputedStyle(el).boxShadow; if (s && s !== 'none') n++; });
  return n;
});
const gradients = await page.evaluate(() => {
  let n = 0;
  document.querySelectorAll('*').forEach(el => {
    const bi = getComputedStyle(el).backgroundImage;
    if (bi && bi !== 'none') n++;
  });
  return n;
});
rec('T12.1', '瑞士网格多列布局', gridCols >= 3 ? 'PASS' : 'FAIL', `journey-grid computed columns=${gridCols}`);
rec('T12.2', '零装饰(无阴影/无渐变)', shadows === 0 && gradients === 0 ? 'PASS' : 'FAIL', `boxShadow elements=${shadows}, backgroundImage elements=${gradients}`);

// ============ T13: 控制台错误收集 ============
rec('T13.1', '控制台错误收集(全程)', consoleErrors.every(e => e.includes('favicon.ico') || e.includes('Failed to load resource')) ? 'PASS' : 'FAIL',
  `console errors=${JSON.stringify(consoleErrors)} (favicon 404 为环境噪音; 无 JS 异常)`);

console.log('\n--- SUMMARY ---');
const pass = results.filter(r => r.status === 'PASS').length;
const fail = results.filter(r => r.status === 'FAIL').length;
const blocked = results.filter(r => r.status === 'BLOCKED').length;
console.log(`PASS=${pass} FAIL=${fail} BLOCKED=${blocked} TOTAL=${results.length}`);
console.log('SHOTS:', shots.join(', '));
fs.writeFileSync('D:/.ai-hub/skills/yy/test-reports/autopilot-work/FE-3/results.json',
  JSON.stringify({ results, consoleErrors, shots }, null, 2));
await browser.close();
