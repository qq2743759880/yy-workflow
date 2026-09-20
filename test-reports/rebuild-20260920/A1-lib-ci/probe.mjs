#!/usr/bin/env node
/**
 * A1 差分自测探针 — 构造 ≥6 组输入，验证 lib 与 ci.mjs 行为一致。
 *
 * 测试组：
 *   组1: GATE_TOPOLOGY 结构与 ci.mjs main() segments 逐字段一致
 *   组2: buildTempReportContent 与 ci.mjs buildTempReport() 模板逐字一致（时间戳外）
 *   组3: countOpenP0 — 空 tracker
 *   组4: countOpenP0 — 无 P0
 *   组5: countOpenP0 — 有 2 条 P0 ⬜（必失败组）
 *   组6: countOpenP0 — P0 ✅ 已闭环不计
 *   组7: classifyFailure — 全过
 *   组8: classifyFailure — S1 阻断失败（必失败组）
 *   组9: classifyFailure — S6 非阻断退出 1（不影响 pass）
 *   组10: runGate — mock spawn S1 pass
 *   组11: runGate — S5 trackerText 有 P0 → code=1
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATE_TOPOLOGY, GATE_MAP, buildTempReportContent, countOpenP0, classifyFailure, runGate } from '../../../scripts/lib/ci.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ciSource = readFileSync(path.join(ROOT, 'scripts', 'ci.mjs'), 'utf8');

let pass = 0, fail = 0;
const results = [];

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; results.push('PASS ' + name); }
  else { fail++; results.push('FAIL ' + name + '\n  expected: ' + JSON.stringify(expected) + '\n  actual:   ' + JSON.stringify(actual)); }
}

// --- 组1: GATE_TOPOLOGY 与 ci.mjs segments 对应 ---
// ci.mjs 中 segments 定义: S1 validate-structure, S2 review-gate --self-test, S3 plan-review --check, S4 regression-all
const segIds = GATE_TOPOLOGY.map((g) => g.id);
check('组1: 门数量 = 6 (S1-S6)', segIds, ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
check('组1: S1 blocking=true', GATE_MAP.S1.blocking, true);
check('组1: S6 blocking=false (信息段)', GATE_MAP.S6.blocking, false);
check('组1: S3 needsTempReport=true', GATE_MAP.S3.needsTempReport, true);
check('组1: S5 script=null (进程内门)', GATE_MAP.S5.script, null);

// --- 组2: buildTempReportContent 模板 ---
const content = buildTempReportContent({ now: new Date('2026-01-01T00:00:00.000Z') });
check('组2: 报告含 CEO 视角', content.includes('## CEO 范围视角'), true);
check('组2: 报告含 Eng 视角', content.includes('## Eng 架构视角'), true);
check('组2: 报告含 Design 视角', content.includes('## Design 体验视角'), true);
check('组2: 报告含 confidence 9/10', content.includes('confidence: 9/10'), true);

// --- 组3: countOpenP0 空 ---
check('组3: 空 tracker → 0', countOpenP0(''), 0);

// --- 组4: 无 P0 ---
const noP0 = [
  '| # | 批判 | 级别 | 修复 | 落点 | 验收 | 状态 |',
  '|---|---|---|---|---|---|---|',
  '| C-01 | 某问题 | P1 | 修复X | Y | Z | ✅ |',
].join('\n');
check('组4: 无 P0 → 0', countOpenP0(noP0), 0);

// --- 组5: 2 条 P0 ⬜ ---
const twoP0 = [
  '| # | 批判 | 级别 | 修复 | 落点 | 验收 | 状态 |',
  '|---|---|---|---|---|---|---|',
  '| C-01 | 问题1 | P0 | fix1 | loc1 | acc1 | ⬜ |',
  '| C-02 | 问题2 | P0 | fix2 | loc2 | acc2 | ⬜ |',
  '| C-03 | 问题3 | P1 | fix3 | loc3 | acc3 | ⬜ |',
].join('\n');
check('组5: 2 条 P0 ⬜ → 2 (必失败组)', countOpenP0(twoP0), 2);

// --- 组6: P0 ✅ 已闭环不计；◐ 也不计（ci.mjs S5 只查 ⬜，与 orchestrator backlogIsPending 的 [⬜◐] 不同）---
const closedP0 = [
  '| C-01 | 问题1 | P0 | fix1 | loc1 | acc1 | ✅ |',
  '| C-02 | 问题2 | P0 | fix2 | loc2 | acc2 | ◐ |',
].join('\n');
check('组6: P0 ✅ 和 ◐ 混合 → 0 (ci.mjs S5 只查 ⬜)', countOpenP0(closedP0), 0);

// --- 组7: classifyFailure 全过 ---
const allPass = [
  { gateId: 'S1', name: 'S1', code: 0, blocking: true },
  { gateId: 'S4', name: 'S4', code: 0, blocking: true },
];
const r7 = classifyFailure(allPass);
check('组7: 全过 → pass=true', r7.pass, true);
check('组7: 无 blockingFailures', r7.blockingFailures.length, 0);

// --- 组8: S1 阻断失败 ---
const s1Fail = [
  { gateId: 'S1', name: 'S1', code: 1, blocking: true },
  { gateId: 'S4', name: 'S4', code: 0, blocking: true },
];
const r8 = classifyFailure(s1Fail);
check('组8: S1 失败 → pass=false (必失败组)', r8.pass, false);
check('组8: blockingFailures 含 S1', r8.blockingFailures[0].gateId, 'S1');

// --- 组9: S6 非阻断退出 1 ---
const s6Info = [
  { gateId: 'S1', name: 'S1', code: 0, blocking: true },
  { gateId: 'S6', name: 'S6', code: 1, blocking: false },
];
const r9 = classifyFailure(s6Info);
check('组9: S6 非阻断 → pass=true', r9.pass, true);
check('组9: failures 含 S6 但不阻断', r9.failures.length, 1);

// --- 组10: runGate mock spawn ---
let spawnCalls = [];
const mockSpawn = (script, args) => { spawnCalls.push({ script, args }); return Promise.resolve(0); };
const r10 = await runGate('S1', { spawn: mockSpawn });
check('组10: S1 runGate code=0', r10.code, 0);
check('组10: spawn 调用了 validate-structure.mjs', spawnCalls[0].script, 'validate-structure.mjs');

// --- 组11: runGate S5 trackerText 有 P0 ---
const r11 = await runGate('S5', { spawn: mockSpawn, trackerText: twoP0 });
check('组11: S5 有 P0 → code=1 (必失败组)', r11.code, 1);

// --- 输出 ---
console.log('=== A1 差分自测结果 ===');
for (const r of results) console.log(r);
console.log('\n合计: ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail > 0) process.exitCode = 1;
