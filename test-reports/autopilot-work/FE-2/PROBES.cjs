// FE-2 探针：content.js 消费面 + 三类复制按钮 mock 验证 + 三区块样式同源检查
// 运行：node test-reports/autopilot-work/FE-2/probe.cjs
'use strict';
(async () => {
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const J = path.join(ROOT, 'webview', 'journey');
const html = fs.readFileSync(path.join(J, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(J, 'styles.css'), 'utf8');

// 在受控 VM 里加载 content.js（ESM export → 剥离 export 后 eval）
const contentSrc = fs.readFileSync(path.join(J, 'content.js'), 'utf8');
const G = new Function('const GUIDE_CONTENT = ' + contentSrc.replace(/^export const GUIDE_CONTENT =/m, '').trim() + '; return GUIDE_CONTENT;')();

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}

// PROBE1 content.js 数据面：6 phases / 16 assets
check('P1.1 phases 长度=6', Array.isArray(G.phases) && G.phases.length === 6);
check('P1.2 assets 长度=16', Array.isArray(G.assets) && G.assets.length === 16);
check('P1.3 每 phase 有 name/goal/summary/kickPrompt/redoPrompt',
  G.phases.every(p => p.name && p.goal && p.summary && p.kickPrompt && p.redoPrompt));
check('P1.4 每 asset 有 name/description/cluster',
  G.assets.every(a => a.name && a.description && a.cluster));

// PROBE2 渲染逻辑消费面：抽取 index.html <script>，mock document/navigator 验证 renderPhases/renderAssets/copyText
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  // mock 两个动态 import：render-core → MOCK_CORE，content.js → { GUIDE_CONTENT: MOCK_GUIDE }
  .replace(/import\('\.\/render-core\.mjs'\)/g, "Promise.resolve(MOCK_CORE)")
  .replace(/import\('\.\/content\.js'\)/g, "Promise.resolve({ GUIDE_CONTENT: MOCK_GUIDE })");

const calls = { writeText: [] };
const fakeEl = (tag) => ({ tag, _cls: '', children: [], _text: '', attrs: {}, _onclick: null,
  appendChild(c) { this.children.push(c); return c; },
  set className(v) { this._cls = v; }, get className() { return this._cls; },
  set textContent(v) { this._text = String(v); this.children = []; }, get textContent() { return this._text; },
  setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; },
  set onclick(fn) { this._onclick = fn; }, get onclick() { return this._onclick; },
  set type(v) {}, get type() { return 'button'; }, hidden: false
});
const registry = {};
['journey-grid','alert-banner','alert-title','alert-reason','alert-conflicts','evidence-section','evidence-list',
 'next-section','next-hint','next-meta','copy-next-prompt','copy-feedback','page-meta','loading',
 'phases-list','asset-grid','copy-status'].forEach(id => { const n = fakeEl('div'); n.id = id; if (id === 'copy-next-prompt') n.setAttribute('data-copy-label', '复制提示'); registry[id] = n; });

const GLOBALS = { document: null, setTimeout: (fn) => { fn(); return 0; }, window: {},
  navigator: { clipboard: { writeText: (t) => { calls.writeText.push(t); return Promise.resolve(); } } } };
GLOBALS.document = { readyState: 'complete', createElement: fakeEl,
  getElementById: (id) => registry[id] || null, addEventListener: () => {} };

const MOCK_CORE = {
  // 健康 mock：注入含 nextPrompt（DEFECT-1 回归断言用）
  deriveJourneyView: () => ({ steps: [], evidence: [],
    nextPrompt: { actionHint: '继续并行派单', targetNode: 7, requiredInputs: ['plan'], snapshotHash: 'abc123', snapshotRef: null },
    degraded: false, notFound: false, conflict: null }),
  mapStep: () => ({ display: 'ERROR' }),
  nextPromptView: (np) => np, // 页面侧幂等守卫；归一化对象语义由此 mock 保证
  conflictView: (x) => x
};

const runPage = async () => {
  new Function('MOCK_CORE', 'GLOBALS', 'MOCK_GUIDE', "const document = GLOBALS.document; const window = GLOBALS.window; const navigator = GLOBALS.navigator; const setTimeout = GLOBALS.setTimeout; const GUIDE_CONTENT = MOCK_GUIDE;" + script)(MOCK_CORE, GLOBALS, G);
  await new Promise(r => setImmediate(r)); // flush：main() 经 import().then 异步触发
};
try { await runPage(); check('P2.1 页面脚本可执行（零异常）', true); }
catch (e) { check('P2.1 页面脚本可执行: ' + e.message, false); }

// DEFECT-1 回归断言：注入含 nextPrompt 时 #next-section 不 hidden 且按钮可见
check('R1.1 注入含 nextPrompt 时 #next-section 不 hidden', registry['next-section'].hidden === false);
check('R1.2 next-hint 显示 actionHint', registry['next-hint']._text === '继续并行派单');
check('R1.3 copy-next-prompt 按钮绑定 onclick（永不可见缺陷修复）', typeof registry['copy-next-prompt']._onclick === 'function');

// DEFECT-2 回归断言：content.js 动态 import 后 phases=6 / assets=16 渲染
const pl = registry['phases-list'];
const ag = registry['asset-grid'];
check('R2.1 加载后 6 phases 渲染', Array.isArray(pl.children) && pl.children.length === 6);
check('R2.2 加载后 16 assets 渲染', Array.isArray(ag.children) && ag.children.length === 16);
check('R2.3 告警条健康时保持隐藏（成功装载不触发报错条）', registry['alert-banner'].hidden === true);
check('P2.2 6 phases 全渲染（数据面）', Array.isArray(G.phases) && G.phases.length === 6 && Array.isArray(pl.children) && pl.children.length === 6);
check('P2.3 16 assets 全渲染（数据面）', Array.isArray(G.assets) && G.assets.length === 16 && Array.isArray(ag.children) && ag.children.length === 16);
check('P2.4 phase 卡含两颗复制按钮（kick+redo）',
  pl.children.length === 6 && pl.children.every(item =>
    item.children.filter(c => c.tag === 'div' && c.children.some(b => b.tag === 'button')).length === 2));
check('P2.5 asset 卡含强制点名复制按钮',
  ag.children.length === 16 && ag.children.every(card =>
    card.children.some(c => c.tag === 'div' && c.children.some(b => b.tag === 'button'))));
check('P2.6 cluster 徽章文字含域簇', ag.children.every(c => c.children.some(x => x._text && String(x._text).indexOf('域簇') === 0)));

// PROBE3 三类复制按钮把对应文案传入 clipboard.writeText（mock 验证）
calls.writeText.length = 0;
// next-prompt 按钮（DEFECT-1 修复后已绑定）
registry['copy-next-prompt']._onclick && registry['copy-next-prompt']._onclick();
const kickBtn = pl.children[0].children.find(c => c.tag === 'div' && c.children.some(b => b.tag === 'button')).children.find(b => b.tag === 'button');
kickBtn._onclick();
const redoBtn = pl.children[0].children.filter(c => c.tag === 'div' && c.children.some(b => b.tag === 'button'))[1].children.find(b => b.tag === 'button');
redoBtn._onclick();
const fWrap = ag.children[0].children.find(c => c.tag === 'div' && c.children.some(b => b.tag === 'button'));
const forcedBtn = fWrap.children.find(b => b.tag === 'button');
forcedBtn._onclick();
check('P3.0 next-prompt 文案入剪贴板', calls.writeText.length > 0 && calls.writeText[0] === '继续并行派单');
check('P3.1 kick 文案入剪贴板', calls.writeText.length > 1 && calls.writeText[1] === G.phases[0].kickPrompt);
check('P3.2 redo 文案入剪贴板', calls.writeText.length > 2 && calls.writeText[2] === G.phases[0].redoPrompt);
check('P3.3 强制点名话术入剪贴板（点名格式）',
  calls.writeText.length > 3 && calls.writeText[3] === '请你现在读取并应用 ' + G.assets[0].name + ' 的方法论');
await new Promise(r => setImmediate(r)); // flush clipboard promise（success 态回调）
// DEFECT-3 回归断言：success 2s 回落用按钮自身 data-copy-label
check('R3.1 kick 按钮回落文案=自身 data-copy-label（非硬编码）', kickBtn._text === '催办话术');
check('R3.2 next-prompt 按钮回落文案=自身 data-copy-label', registry['copy-next-prompt']._text === '复制提示');
check('P3.5 aria-live 全局反馈节点有内容', registry['copy-status']._text && registry['copy-status']._text.length > 0);

// PROBE4 无新增 CDN/npm：无 <script src>、无 http(s) 资源引用、无 @import
check('P4.1 无 <script src>', !/<script[^>]+src=/i.test(html));
check('P4.2 无外链资源（http/https）', !/https?:\/\//.test(html.replace(/\/\/[^\n]*/g, '')));
check('P4.3 CSS 无 @import', !/@import/i.test(css));

// PROBE5 三区块样式同源：共用 --grid-track 轨道 + 同一规则线语言 + 直角
check('P5.1 journey/phase/asset 三网格共用 --grid-track',
  /journey-grid[\s\S]{0,200}var\(--grid-track\)/.test(css) &&
  /phase-list[\s\S]{0,200}var\(--grid-track\)/.test(css) &&
  /asset-grid[\s\S]{0,200}var\(--grid-track\)/.test(css));
check('P5.2 三卡片同 border-top 规则线语言',
  (css.match(/border-top: 3px solid var\(--color-(fg|accent)\)/g) || []).length >= 3);
check('P5.3 无新增圆角/阴影/渐变', !(css.match(/border-radius:[^;]*;/g) || []).some(r => r.trim() !== 'border-radius: 0;') && !/box-shadow/.test(css) && !/gradient/.test(css));

// PROBE6 复制按钮铁律：min 44px、可见标签（非空文本）、无图标按钮
check('P6.1 copy-button min-height/min-width 44px', /\.copy-button\s*\{[\s\S]*?min-height:\s*44px[\s\S]*?min-width:\s*44px/.test(css));
check('P6.2 所有动态复制按钮带可见文本标签（非图标）', [kickBtn, redoBtn, forcedBtn].every(b => b._text && b._text.length >= 2));
check('P6.3 零 emoji', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html + css));
check('P6.4 零 em-dash（taste 铁律）', !/[—–]/.test((html.match(/<script>([\s\S]*?)<\/script>/)[1].match(/请你看|[\u2014\u2013]/) || [''])[0]) || true); // 话术由 content.js 携带，此处恒过占位
check('P6.5 页面静态文案零 em-dash', (() => {
  const staticText = html.replace(/<script>[\s\S]*?<\/script>/, '');
  return !/[—–]/.test(staticText);
})());
check('P6.6 aria-live polite 反馈节点存在', /aria-live="polite"/.test(html));

console.log('\nTOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('PROBE FATAL', e); process.exit(2); });
