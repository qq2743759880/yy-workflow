/**
 * run-probes.mjs — R8 remediation.mjs 重建自验运行器（file-based 外置探针，无 node -e 内联）。
 *
 * 重建口径（rebuild-20260920）：原始 remediation.mjs 与其探针本体未恢复；本运行器按
 * contracts/C-R8-remediation.md（FROZEN，OQ-R8-1…7=A）+ contracts/C-R8-review-checklist.md
 * R8-01/02/03/04/05/L1 期望列 + test-reports/impl-acceptance-20260915/REPORT.md R8 节
 * independent reruns 清单（GWT-R8-01…05, L1 C1–C7, missing element, duplicate/idempotent,
 * map exact/ambiguous, create-draft PENDING, owner-only NO_ACTION, self-approve blocked）
 * 行为级重建 12 个探针。通过标准：`[PASS] ×12`、`TOTAL: 12/12 PASS`、`EXIT=0`。
 *
 * 沙箱：所有 findings.jsonl/drafts/evidence/tracker 写入限制在本目录 .sandbox/<pNN>/ 下
 * （不写真实 plans/critique-backlog-tracker.md，不触碰 vendor/、contracts/、scripts/）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sandboxBase = path.join(here, '.sandbox');

const PROBES = [
  'p01-gwt-r8-01-evidence-qualified-finding.mjs',
  'p02-gwt-r8-02-map-to-existing.mjs',
  'p03-gwt-r8-03-create-draft.mjs',
  'p04-gwt-r8-04-idempotency.mjs',
  'p05-gwt-r8-05-evidence-gate.mjs',
  'p06-gwt-r8-l1-g21-c1-c7.mjs',
  'p07-draft-missing-element-fail-closed.mjs',
  'p08-map-ambiguous.mjs',
  'p09-duplicate-conflict.mjs',
  'p10-no-action-owner-only.mjs',
  'p11-self-approve-blocked.mjs',
  'p12-shell-error-codes-rollback.mjs',
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

// 沙箱清理：保留 .sandbox 目录骨架（探针可复跑），清理探针工作区（含 p01 的 -replay 残留）
fs.rmSync(sandboxBase, { recursive: true, force: true });

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
