/**
 * run-probes.mjs — R5a journey.mjs 重建自验运行器（file-based 行为探针，无 node -e 内联）。
 *
 * 重建口径（recovery-20260919）：scripts/lib/journey.mjs 原文件丢失（原 sha256 前 16 位
 * fe9bb851f8a36359），按冻结契约 contracts/C-R5-journey.md（FROZEN 2026-09-15）+
 * contracts/C-R5-journey-review-checklist.md 的 R5A-01…R5A-10 场景 + dev-plan R5a GWT 1-4
 * 做行为级重建。每个探针 = 契约一条可机验行为。
 *
 * 通过标准：全部 [PASS]、TOTAL: 16/16 PASS、EXIT=0。
 * 沙箱：所有探针写入限制在本目录 .sandbox/ 下（.gitignore 已按 test-reports 下 .sandbox 通配忽略），
 * 不触碰仓库根 .tt-state/ 与任何既有文件。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sandboxBase = path.join(here, '.sandbox');

const PROBES = [
  'p01-shell-uniformity.mjs',
  'p02-projection-truth.mjs',
  'p03-partial-missing-source.mjs',
  'p04-stale-relative.mjs',
  'p05-source-invalid.mjs',
  'p06-conflict-node-level.mjs',
  'p07-invalid-input-failclosed.mjs',
  'p08-not-found-data-channel.mjs',
  'p09-session-isolation.mjs',
  'p10-nine-node-display.mjs',
  'p11-inferred-only.mjs',
  'p12-honest-failed-skipped.mjs',
  'p13-nextprompt-derived.mjs',
  'p14-readonly-writer-modes.mjs',
  'p15-evidence-links-shape.mjs',
  'p16-namespace-consistency.mjs',
];

const results = [];
for (const file of PROBES) {
  const probeName = file.slice(0, 3); // pNN
  const sandbox = path.join(sandboxBase, probeName);
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.mkdirSync(sandbox, { recursive: true });
  const mod = await import('./probes/' + file);
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
