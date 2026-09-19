/**
 * run-probes.mjs — R7 change.mjs 重建自验运行器（file-based 行为探针，无 node -e 内联）。
 *
 * 重建口径（rebuild-20260920）：scripts/lib/change.mjs 原文件丢失（原 sha256 前 16 位
 * 3f37d9b5dedf7ce8，见 test-reports/impl-acceptance-20260915/REPORT.md），按冻结契约
 * contracts/C-R7-change-loop.md（FROZEN 2026-09-15）+ contracts/C-R7-change-loop-review-checklist.md
 * （R7-01…R7-08 期望列）+ 幸存实物 test-reports/change-record-r5ui-host-plugin-20260917/
 * （record-change.mjs 驱动 + REPORT.md 运行结果 cr-20260917T035212Z-c2026fdf）+ R7 验收报告
 * 9 fixture 清单（gwt-r7-01…05, approval-sec, audit-precise, rollback-supersede, taskgraph-boundary）
 * 行为级重建 12 个探针。每个探针 = 契约一条可机验行为。
 *
 * 通过标准：全部 [PASS]、TOTAL: 12/12 PASS、EXIT=0。
 * 沙箱：所有探针写入限制在本目录 .sandbox/<pNN>/ 下，不触碰真实 contracts/discrepancies/
 * 与 plans/active/changes/（沙箱内同名相对布局除外）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sandboxBase = path.join(here, '.sandbox');

const PROBES = [
  'p01-gwt-r7-01-doc-only.mjs',
  'p02-gwt-r7-02-contract-cascade.mjs',
  'p03-gwt-r7-03-implementation-newversion.mjs',
  'p04-gwt-r7-04-fail-closed.mjs',
  'p05-gwt-r7-05-idempotent-replay.mjs',
  'p06-approval-sec.mjs',
  'p07-receipt-validation.mjs',
  'p08-audit-precise.mjs',
  'p09-rollback-supersede.mjs',
  'p10-taskgraph-boundary.mjs',
  'p11-shell-codes.mjs',
  'p12-storage-append-only-golden.mjs',
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
    entry = { ok: false, summary: 'threw: ' + (e.stack ?? e.message) };
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
