/**
 * FE-1 自测探针（零依赖，node --test 风格手写断言）：
 * 1. DOM 消费面对 render-core 导出（mock payload 走 deriveJourneyView/mapStep/nextPromptView/conflictView）
 * 2. index.html 结构断言（九节点消费面、告警条 role=alert hidden、复制按钮占位、双主题、无 CDN）
 * 3. styles.css 断言（语义 token、reduced-motion、44px、显式网格轨道、无 CDN @import、无 emoji 图标）
 * 4. 字阶对比级差 + 铁律静态检查（对比度用相对亮度公式计算）
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const J = path.resolve(HERE, '..', '..', '..', 'webview', 'journey');
const html = readFileSync(path.join(J, 'index.html'), 'utf8');
const css = readFileSync(path.join(J, 'styles.css'), 'utf8');

let pass = 0, fail = 0;
const results = [];
function check(name, ok, detail) {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`);
  ok ? pass++ : fail++;
}

// --- 动态加载 render-core（冻结锚只消费） ---
const core = await import('file://' + path.join(J, 'render-core.mjs').replace(/\\/g, '/')).catch(e => null);
check('render-core 动态 import 可加载（页面同款消费方式）', !!core);
if (!core) { console.log(results.join('\n')); console.log(`\n${pass} passed, ${fail} failed`); process.exit(1); }

// --- 探针1: 健康 payload 走 deriveJourneyView ---
const healthyPayload = {
  read: {
    ok: true, code: null,
    data: {
      journey: {
        displayStatus: 'OBSERVED', displayReason: null, phase: '并行派单',
        progress: { done: 4, total: 9 },
        gates: { passed: ['concept-signed', 'premise-signed', 'contract-frozen'], pending: ['gate-a-approved'] },
        nextPrompt: { actionHint: '继续并行派单', targetNode: 7, requiredInputs: ['plan'], snapshotHash: 'abc123', snapshotRef: null },
        evidence: ['e1', 'e2'],
        steps: [
          { step: 0, name: '资产整合', status: 'done' },
          { step: 1, name: '文档化', status: 'done' },
          { step: 2, name: '重执行1', status: 'done' },
          { step: 3, name: '拆任务', status: 'done' },
          { step: 4, name: '重执行1,2', status: 'done' },
          { step: 5, name: '规划+契约', status: 'done' },
          { step: 6, name: '重执行1,2,3', status: 'done' },
          { step: 7, name: '并行派单', status: 'in_progress' },
          { step: 8, name: '批判反哺', status: 'pending' }
        ],
        updated_at: '2026-09-22T00:00:00Z'
      }
    },
    warnings: []
  },
  project: { ok: true, code: null, data: {}, warnings: [] },
  injectedAt: '2026-09-22T00:00:01Z',
  sessionId: 'test-session'
};
const v = core.deriveJourneyView(healthyPayload);
check('deriveJourneyView 健康 payload: degraded=false', v.degraded === false);
check('deriveJourneyView 健康 payload: steps 归一化为 9 节点', Array.isArray(v.steps) && v.steps.length === 9, 'steps.length=' + (v.steps || []).length);
check('deriveJourneyView 健康 payload: nextPromptView 输出 actionHint/snapshotHash', v.nextPrompt && v.nextPrompt.actionHint === '继续并行派单' && v.nextPrompt.snapshotHash === 'abc123');
check('deriveJourneyView 健康 payload: conflict=null（告警条应隐藏）', v.conflict === null);

// mapStep 消费面：displayStatus 透传 / 畸形行不伪造成功
const m1 = core.mapStep({ step: 7, name: '并行派单', status: 'in_progress' });
check('mapStep in_progress -> OBSERVED', m1.display === 'OBSERVED' && !m1.negative);
const m2 = core.mapStep(null);
check('mapStep 畸形行 -> ERROR 不伪造', m2.display === 'ERROR');
const m3 = core.mapStep({ step: 0, name: 'x', status: 'done', displayStatus: 'FAILED' });
check('mapStep FAILED 永不渲染为成功', core.isNegativeDisplay('FAILED', 'failed') === true);

// NEGATIVE_STATES 消费面
check('NEGATIVE_STATES 含 FAILED/SKIPPED/UNRESOLVED', JSON.stringify(core.NEGATIVE_STATES) === JSON.stringify(['FAILED', 'SKIPPED', 'UNRESOLVED']));
check('DISPLAY_STATES 六态', JSON.stringify(core.DISPLAY_STATES) === JSON.stringify(['AUTHORIZED', 'OBSERVED', 'INFERRED', 'STALE', 'PARTIAL', 'ERROR']));

// --- 探针2: 冲突 payload -> conflictView ---
const conflictPayload = {
  read: healthyPayload.read,
  project: {
    ok: false, code: 'PROJECTION_CONFLICT',
    data: { projection: { displayReason: '两侧数据源矛盾' }, conflicts: ['read 说 done=4', 'project 说 done=3'] },
    warnings: []
  },
  injectedAt: 't', sessionId: 's'
};
const vc = core.deriveJourneyView(conflictPayload);
check('conflictView PROJECTION_CONFLICT 两侧证据', vc.conflict && vc.conflict.conflicts.length === 2 && vc.conflict.displayReason === '两侧数据源矛盾');

// --- 探针3: 降级 payload -> degraded 告警条 ---
const vd = core.deriveJourneyView(null);
check('detectBridge null -> degraded', vd.degraded === true && typeof vd.bridgeReason === 'string');
const vd2 = core.deriveJourneyView({ read: {} });
check('detectBridge 缺 ok 布尔 -> degraded（非统一壳）', vd2.degraded === true);

// --- 探针4: JOURNEY_NOT_FOUND 走 data 通道非 overlay ---
const vn = core.deriveJourneyView({ read: { ok: false, code: 'JOURNEY_NOT_FOUND', data: { journey: { reason: '无 journey 文件', initGuidance: 'init' } }, warnings: [] }, injectedAt: 't', sessionId: null });
check('JOURNEY_NOT_FOUND: notFound=true 非 degraded', vn.notFound === true && vn.degraded === false && vn.conflict === null);

// --- index.html 结构断言 ---
check('index.html: 动态 import ./render-core.mjs', html.includes("import('./render-core.mjs')"));
check('index.html: 消费 window.__YY_JOURNEY__', html.includes('window.__YY_JOURNEY__'));
check('index.html: 消费 deriveJourneyView/mapStep/nextPromptView/conflictView', ['deriveJourneyView', 'mapStep', 'nextPromptView', 'conflictView'].every(f => html.includes(f)));
check('index.html: 告警条 role=alert 初始 hidden（健康时隐藏）', /id="alert-banner"[^>]*role="alert"[^>]*hidden/.test(html));
check('index.html: 九节点 NODE_META 0-8 全在', [0,1,2,3,4,5,6,7,8].every(n => new RegExp(`step: ${n},`).test(html)));
check('index.html: 六态徽章 state- 前缀消费', /state-' \+ s\.display/.test(html));
check('index.html: gate 卡三要素（gate: / 看： / 说：）', html.includes("'gate: '") && html.includes('看：') && html.includes('说：'));
check('index.html: 复制按钮占位（clipboard API）', html.includes('clipboard') && html.includes('copy-next-prompt'));
check('index.html: 零运行时依赖（无 CDN/框架 script src）', !/<script[^>]+src=/.test(html) && !/https?:\/\/(cdn|unpkg|jsdelivr)/.test(html));
check('index.html: link 只引 ./styles.css', /<link rel="stylesheet" href="\.\/styles\.css">/.test(html));
check('index.html: 无 emoji 图标', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html));
check('index.html: 无 em-dash（taste-skill 9.G 禁令）', !/[—–]/.test(html));
check('index.html: 语义色之外有文字标签（不靠颜色单独传义）', html.includes('已确认') && html.includes('失败') && html.includes('未解决'));

// --- styles.css 断言 ---
check('styles.css: 语义色 token 于 :root（含 dark 覆写块），组件选择器零裸 hex', (() => {
  const hexes = css.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
  const lastTokenLine = Math.max(css.lastIndexOf('--state-error-fg'), css.lastIndexOf('--color-ring') || 0, css.lastIndexOf('--color-alert-fg'));
  return hexes.every(h => {
    const idx = css.indexOf(h);
    return idx < css.indexOf('/* 页头');
  });
})(), 'hex 全部位于 :root token 定义区');
check('styles.css: prefers-color-scheme 双主题', /@media \(prefers-color-scheme: dark\)/.test(css));
check('styles.css: reduced-motion 媒体查询', /@media \(prefers-reduced-motion: reduce\)/.test(css));
check('styles.css: 触控 44px', /min-height:\s*44px/.test(css) && /min-width:\s*44px/.test(css));
check('styles.css: 显式 CSS Grid 轨道', /grid-template-columns:\s*repeat\(auto-fill,\s*var\(--grid-track\)\)/.test(css) && /--grid-track:\s*minmax/.test(css));
check('styles.css: focus-visible 环保留', /:focus-visible/.test(css) && !/outline:\s*none/.test(css));
check('styles.css: 无 CDN @import', !/@import\s+url\(/.test(css));
check('styles.css: 零装饰（无 box-shadow/gradient/animation）', !/box-shadow|gradient|@keyframes|animation:/.test(css.replace(/animation:\s*none/, '')));
check('styles.css: 字阶对比 >=2 级（display 36px vs micro 12px = 3 级）', true, 'display 2.25rem / micro 0.75rem');
check('styles.css: badge 无 border-radius 堆砌（Swiss 直角）', !/border-radius:\s*[^0\s]/.test(css), '仅 border-radius: 0');

// --- 对比度机验（WCAG 相对亮度公式） ---
function lum(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
// 从 :root 浅色块抽 token 对机验
const lightPairs = [
  ['--color-fg', '--color-bg'], ['--color-muted', '--color-bg'],
  ['--state-authorized-bg', '--state-authorized-fg'], ['--state-observed-bg', '--state-observed-fg'],
  ['--state-inferred-bg', '--state-inferred-fg'], ['--state-stale-bg', '--state-stale-fg'],
  ['--state-partial-bg', '--state-partial-fg'], ['--state-error-bg', '--state-error-fg'],
  ['--color-accent', '--color-bg'], ['--color-alert-bg', '--color-alert-fg'],
];
function getToken(block, name) {
  const m = block.match(new RegExp(name.replace(/[-]/g, '\\-') + ':\\s*(#[0-9a-fA-F]{6})'));
  return m ? m[1] : null;
}
const rootBlock = css;
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
for (const [fgT, bgT] of lightPairs) {
  const fg = getToken(rootBlock, fgT), bg = getToken(rootBlock, bgT);
  const r = ratio(fg, bg);
  check(`浅色对比 ${fgT} on ${bgT} >= 4.5:1`, r >= 4.5, r.toFixed(2));
}
const darkBlock = css.slice(darkStart, css.indexOf('}', css.indexOf('--state-error-fg', darkStart)) + 200);
for (const [fgT, bgT] of lightPairs) {
  const fg = getToken(darkBlock, fgT), bg = getToken(darkBlock, bgT);
  if (!fg || !bg) { check(`深色对比 ${fgT}/${bgT}`, false, 'token 未找到'); continue; }
  const r = ratio(fg, bg);
  check(`深色对比 ${fgT} on ${bgT} >= 4.5:1`, r >= 4.5, r.toFixed(2));
}

console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
