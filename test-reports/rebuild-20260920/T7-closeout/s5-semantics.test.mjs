#!/usr/bin/env node
/**
 * s5-semantics.test.mjs — T7 收尾批① 自测：S5 严格口径（⬜◐ 皆未清零）+ ◐ 证据卫生规则。
 *
 * 断言组（与派单总门口径一一对应）：
 *   A ⬜ 行 → FAIL（gate code 1）
 *   B ◐ 行**无**落点/收据引用 → FAIL，且 warnings 含"卫生分类"（归类无证据 ⬜）
 *   C ◐ 行**有**证据引用 → FAIL，且分类为 in-progress
 *   D ✅ 行 → PASS（gate code 0）
 *   E 单点定义：ci.mjs / orchestrator.mjs 均引用 OPEN_P0_PATTERN 系（无双口径字面量残留）
 *   F 实测：真实 tracker 计数（新口径）与 de-noised 一致性
 *   G 行为零变化回归：lib/ci.mjs classifyOpenP0 与旧 ⬜-only 口径在"仅 ⬜"输入上计数相同
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OPEN_P0_PATTERN, OPEN_P0_MARKERS, OPEN_P0_MARKER_RE, EVIDENCE_REF_PATTERN,
  hasEvidenceRef, classifyOpenP0, countOpenP0, runGate,
} from '../../../scripts/lib/ci.mjs';
import { backlogIsPending, parseBacklogRows } from '../../../scripts/lib/orchestrator.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const results = [];
function check(name, ok, detail = '') {
  results.push([name, ok, detail]);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : ''));
}

const row = (serial, level, fix, status) => `| ${serial} | 某批判 | ${level} | ${fix} | 落点X | 验收Y | ${status} |`;
const mockSpawn = () => Promise.resolve(0);
const gate = (text) => runGate('S5', { spawn: mockSpawn, trackerText: text });

// A ⬜ → FAIL
const a = await gate(row('C-01', 'P0', 'fix1', '⬜'));
check('A ⬜ 行 → FAIL(code=1)', a.code === 1, 'code=' + a.code + ' detail=' + a.detail);

// B ◐ 无证据引用 → FAIL + 卫生分类（无证据 ⬜）
const b = await gate(row('C-02', 'P0', '修复方案写在某处', '◐'));
const bHasHygiene = b.warnings.some((w) => w.includes('无证据') && w.includes('⬜'));
check('B ◐ 无引用 → FAIL(code=1)', b.code === 1, 'code=' + b.code);
check('B ◐ 无引用 → warnings 含卫生分类（归类「无证据 ⬜」）', bHasHygiene, JSON.stringify(b.warnings));
check('B ◐ 无引用 → classification.unbacked 具名', JSON.stringify(b.classification.unbacked) === JSON.stringify(['C-02']),
  JSON.stringify(b.classification));

// C ◐ 有证据引用 → FAIL 且分类 in-progress
const c = await gate('| C-31 | 批判 | P0 | 修复: 落点 T7-closeout | test-reports/rebuild-20260920/T7-closeout/RESULTS.md | ◐ |');
const cHasInProgress = c.warnings.some((w) => w.includes('in-progress'));
check('C ◐ 带证据引用 → FAIL(code=1)', c.code === 1, 'code=' + c.code);
check('C ◐ 带证据引用 → warnings 含 in-progress 分类', cHasInProgress, JSON.stringify(c.warnings));
check('C ◐ 带证据引用 → classification.inProgress 具名', JSON.stringify(c.classification.inProgress) === JSON.stringify(['C-31']),
  JSON.stringify(c.classification));
check('C 计数与卫生分类解耦（仍计未清零）', countOpenP0('| C-31 | x | P0 | fix: T7 | acc | ◐ |') === 1);

// D ✅ → PASS
const d = await gate(row('C-03', 'P0', 'fix3', '✅'));
check('D ✅ 行 → PASS(code=0)', d.code === 0, 'code=' + d.code + ' detail=' + d.detail);

// E 单点定义（无双口径字面量残留）
const ciSrc = fs.readFileSync(path.join(REPO, 'scripts', 'ci.mjs'), 'utf8');
const orchSrc = fs.readFileSync(path.join(REPO, 'scripts', 'lib', 'orchestrator.mjs'), 'utf8');
check('E lib/ci.mjs 定义 OPEN_P0_PATTERN', /export const OPEN_P0_PATTERN/.test(
  fs.readFileSync(path.join(REPO, 'scripts', 'lib', 'ci.mjs'), 'utf8')));
check('E lib/orchestrator.mjs 引用 OPEN_P0_MARKER_RE（不自持 [⬜◐] 字面量）',
  orchSrc.includes('OPEN_P0_MARKER_RE') && !orchSrc.includes('[⬜◐]'));
check('E ci.mjs 走 lib（无 legacy 内联计数）', ciSrc.includes("from './lib/ci.mjs'") && !ciSrc.includes("l.includes('| P0 |')"));
check('E OPEN_P0_MARKERS = [⬜, ◐]（单点字符集）', JSON.stringify([...OPEN_P0_MARKERS]) === JSON.stringify(['⬜', '◐']));
check('E OPEN_P0_MARKER_RE 由标记集派生', OPEN_P0_MARKER_RE.test('◐') && OPEN_P0_MARKER_RE.test('⬜') && !OPEN_P0_MARKER_RE.test('✅'));

// F 真实 tracker 新旧口径对照（如实输出；无 ◐ 行时两者相等）
const trackerText = fs.readFileSync(path.join(REPO, 'plans', 'critique-backlog-tracker.md'), 'utf8');
const cls = classifyOpenP0(trackerText);
const legacyOnly = trackerText.split('\n').map((l) => l.trim())
  .filter((l) => /^\| C-/.test(l)).filter((l) => l.includes('| P0 |') && l.includes('⬜')).length;
check('F 真实 tracker：严格口径计数 ≥ 旧 ⬜-only 计数', cls.openP0 >= legacyOnly,
  'strict=' + cls.openP0 + ' legacy_only=' + legacyOnly + ' pending=' + JSON.stringify(cls.pending)
  + ' inProgress=' + JSON.stringify(cls.inProgress) + ' unbacked=' + JSON.stringify(cls.unbacked));

// G 行为零变化：仅 ⬜ 输入下新旧口径逐例一致 + orchestrator 判定不变
const cases = [
  '', 'no rows', row('C-01', 'P0', 'f', '⬜'), row('C-02', 'P1', 'f', '⬜'), row('C-03', 'P0', 'f', '✅'),
];
let sameAll = true;
for (const t of cases) {
  const oldCount = t.split('\n').map((l) => l.trim()).filter((l) => /^\| C-/.test(l))
    .filter((l) => l.includes('| P0 |') && l.includes('⬜')).length;
  if (countOpenP0(t) !== oldCount) sameAll = false;
}
check('G 仅 ⬜ 输入下计数与旧口径逐例一致（行为零变化面）', sameAll);
check('G backlogIsPending：✅/❌ 非 pending，⬜/◐ pending',
  backlogIsPending({ status: '✅', raw: 'x' }) === false
  && backlogIsPending({ status: '◐', raw: 'x' }) === true
  && backlogIsPending({ status: '⬜', raw: 'x' }) === true);
check('G hasEvidenceRef：路径/任务 id/receipt id 命中，纯中文描述不命中',
  hasEvidenceRef('see test-reports/rebuild-20260920/T7-closeout/RESULTS.md')
  && hasEvidenceRef('落点: T7')
  && hasEvidenceRef('cr-20260920T112945Z-a6244b0c')
  && !hasEvidenceRef('| C-02 | 某批判 | P0 | 修复方案写在某处 | 验收Y | ◐ |'));

// H 行为零变化：backlogIsPending 改写前后逐例等价（旧实现字面复制于本测试内，仅用于对照）
const OLD_BL_RE = /^[⬜◐]|(?:待落地|待复验|待[\u4e00-\u9fa5]*)/;
function oldBacklogIsPending(r) {
  if (!r.status) return OLD_BL_RE.test(r.raw);
  if (/^✅/.test(r.status) || /^❌/.test(r.status)) return false;
  if (/^[⬜◐]/.test(r.status)) return true;
  return OLD_BL_RE.test(r.status);
}
const rows = [
  { status: '✅', raw: 'x' }, { status: '❌', raw: 'x' }, { status: '⬜', raw: 'x' }, { status: '◐', raw: 'x' },
  { status: '待落地', raw: 'x' }, { status: '待复验', raw: 'x' }, { status: '待办', raw: 'x' }, { status: 'done', raw: 'x' },
  { status: '', raw: '| C-1 | a | P1 | f | ⬜ |' }, { status: '', raw: '| C-2 | a | P1 | f | ✅ |' },
];
const trackerRows = parseBacklogRows(trackerText);
const allRows = [...rows, ...trackerRows];
const mismatches = allRows.filter((r) => backlogIsPending(r) !== oldBacklogIsPending(r));
check('H backlogIsPending 改写前后逐例等价（' + allRows.length + ' 例，含真实 tracker ' + trackerRows.length + ' 行）',
  mismatches.length === 0, JSON.stringify(mismatches.slice(0, 3)));

const failed = results.filter(([, ok]) => !ok);console.log('\nS5 semantics: ' + (results.length - failed.length) + '/' + results.length + ' passed');
console.log('TOTAL: ' + (results.length - failed.length) + '/' + results.length + ' PASS');
console.log('EXIT=' + (failed.length ? 1 : 0));
process.exitCode = failed.length ? 1 : 0;
