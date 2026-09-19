/**
 * run-probes.mjs — R4 phase.mjs 重建自验运行器（file-based 外置探针，无 node -e 内联）。
 *
 * 重建口径（recovery-20260920）：原始 phase.mjs 与其 GWT 探针本体未恢复；本运行器按
 * contracts/C-R4-control.md（FROZEN）+ contracts/C-R4-review-checklist.md R4-01…08 期望列
 * + test-reports/R4-acceptance-20260915/REPORT.md independentReruns 复跑清单（10 项）
 * 行为级重建 12 个探针（验收 10 项 + fail-closed 默认细项 + §4.2 前置映射细项）。
 * 通过标准：`[PASS] ×12`、`TOTAL: 12/12 PASS`、`EXIT=0`。
 *
 * 沙箱：所有 state/journey/receipt/override 写入限制在本目录 .sandbox/<pNN>/ 下
 * （不创建仓库根 .tt-state/，不触碰 vendor/）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sandboxBase = path.join(here, '.sandbox');

const PROBES = [
  'p01-gwt-r4-01-no-unauthorized-skip.mjs',
  'p02-gwt-r4-02-owner-confirmation-gate.mjs',
  'p03-gwt-r4-03-session-isolation.mjs',
  'p04-gwt-r4-04-lock-failure.mjs',
  'p05-gwt-r4-05-ci-truthfulness.mjs',
  'p06-state-version.mjs',
  'p07-override-receipt-valid.mjs',
  'p08-override-receipt-invalid.mjs',
  'p09-session-modes-flags.mjs',
  'p10-lock-takeover-semantics.mjs',
  'p11-fail-closed-defaults.mjs',
  'p12-prereq-mapping.mjs',
];

const results = [];
for (const file of PROBES) {
  const probeName = file.replace(/\.mjs$/, '');
  const sandbox = path.join(sandboxBase, probeName.slice(0, 3));
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.mkdirSync(sandbox, { recursive: true });
  const mod = await import('./' + file);
  let entry;
  try {
    entry = await mod.run({ sandbox });
  } catch (e) {
    entry = { ok: false, summary: 'threw: ' + e.message };
  }
  results.push({ probe: probeName, exitCode: entry.ok ? 0 : 1, ok: entry.ok, summary: entry.summary });
  console.log(`[${entry.ok ? 'PASS' : 'FAIL'}] ${probeName} | ${entry.summary}`);
}

const passCount = results.filter((r) => r.ok).length;
const total = results.length;
const allPass = passCount === total;
console.log(`TOTAL: ${passCount}/${total} PASS`);
console.log(`EXIT=${allPass ? 0 : 1}`);

fs.writeFileSync(path.join(here, 'out-probe-results.json'), JSON.stringify({
  pass: results.filter((r) => r.ok).map((r) => r.probe),
  fail: results.filter((r) => !r.ok).map((r) => r.probe),
  results,
  total,
}, null, 2) + '\n');

process.exit(allPass ? 0 : 1);
