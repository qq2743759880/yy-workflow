/**
 * run-probes.mjs — R3 activation.mjs / receipt.mjs 重建自验运行器（file-based 外置探针，无 node -e 内联）。
 *
 * 重建口径（rebuild-20260920）：原 R3 两模块已丢失，本运行器按冻结契约 contracts/C-R3-activation.md
 * 的行为条款（GWT-R3-01…05、清单 R3-1…R3-12、§7.7 C6 7case、§7.4 P1-P5）逐条机验重建实现。
 * 通过标准：`[PASS] ×16`、`TOTAL: 16/16 PASS`、`EXIT=0`。
 *
 * 沙箱：全部写入限制在本目录 .sandbox/<pNN>/ 下（.sandbox/ 已被 .gitignore 忽略）；
 * 仓库真实 vendor/ 仅只读引用，探针内断言 vendor 零写入。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sandboxBase = path.join(here, '.sandbox');

const PROBES = [
  'p01-metadata-level.mjs',
  'p02-body-level.mjs',
  'p03-resource-level.mjs',
  'p04-budget.mjs',
  'p05-body-missing.mjs',
  'p06-mode.mjs',
  'p07-chain-terminal.mjs',
  'p08-idempotency.mjs',
  'p09-invalid-events.mjs',
  'p10-hash-chain.mjs',
  'p11-c6-fixtures.mjs',
  'p12-legacy-compat.mjs',
  'p13-positive-matrix.mjs',
  'p14-selected-not-consumed.mjs',
  'p15-prepare-idempotency.mjs',
  'p16-p5-predicate.mjs',
];

const results = [];
for (const file of PROBES) {
  const probeName = file.replace(/\.mjs$/, '');
  const sandbox = path.join(sandboxBase, probeName);
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.mkdirSync(sandbox, { recursive: true });
  const mod = await import('./probes/' + file);
  let entry;
  try {
    entry = await mod.run({ sandbox });
  } catch (e) {
    entry = { ok: false, summary: 'threw: ' + (e && e.message || e) };
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
