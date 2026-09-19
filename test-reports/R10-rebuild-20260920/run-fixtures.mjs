/**
 * run-fixtures.mjs — R10 evolution.mjs 重建自验运行器（file-based 外置探针，无 node -e 内联）。
 *
 * 重建口径（recovery-20260919）：原始 run-fixtures.mjs 与 12 个 fixture 文件本体未恢复；
 * 本运行器按 test-reports/R10-implementation-20260917/fixtures/README-recovered-semantics.md
 * 的 12 用例语义 + fixture-results.json 幸存副本的逐字摘要行重建。
 * 通过标准：`[PASS] ×12`、`TOTAL: 12/12 PASS`、`EXIT=0`，且 12 行摘要与幸存实测逐字一致。
 *
 * 沙箱：所有候选/证据写入限制在本目录 fixtures/.sandbox/ 下（不创建仓库根 evidence/evolution/）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sandboxBase = path.join(here, 'fixtures', '.sandbox');

const FIXTURES = [
  'f01-propose-ok.mjs',
  'f02-propose-invalid-invariants.mjs',
  'f03-propose-invalid-whitelist.mjs',
  'f04-propose-baseline-missing.mjs',
  'f05-propose-version-conflict.mjs',
  'f06-propose-duplicate-replay.mjs',
  'f07-accept-self-verify.mjs',
  'f08-accept-not-allowed-unresolved.mjs',
  'f09-accept-regression.mjs',
  'f10-accept-promoted-happy-path.mjs',
  'f11-accept-provisional-no-rollback.mjs',
  'f12-summarize-16-closure.mjs',
];

const results = [];
for (const file of FIXTURES) {
  const fixtureName = file.slice(0, 3); // fNN
  const sandbox = path.join(sandboxBase, fixtureName);
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.mkdirSync(sandbox, { recursive: true });
  const mod = await import('./fixtures/' + file);
  let entry;
  try {
    entry = await mod.run({ sandbox });
  } catch (e) {
    entry = { ok: false, summary: 'threw: ' + e.message };
  }
  results.push({ fixture: fixtureName, exitCode: entry.ok ? 0 : 1, ok: entry.ok, summary: entry.summary });
  console.log(`[${entry.ok ? 'PASS' : 'FAIL'}] ${fixtureName} | ${entry.summary}`);
}

const passCount = results.filter((r) => r.ok).length;
const total = results.length;
const allPass = passCount === total;
console.log(`TOTAL: ${passCount}/${total} PASS`);
console.log(`EXIT=${allPass ? 0 : 1}`);

fs.writeFileSync(path.join(here, 'out-fixture-results.json'), JSON.stringify({
  pass: results.filter((r) => r.ok).map((r) => r.fixture),
  fail: results.filter((r) => !r.ok).map((r) => r.fixture),
  results,
  total,
}, null, 2) + '\n');

fs.writeFileSync(path.join(here, 'RESULTS.md'), [
  '# R10 rebuild fixture results — ' + new Date().toISOString(),
  '',
  '对照标准：`../R10-implementation-20260917/fixtures/README-recovered-semantics.md` + 幸存 `fixture-results.json` 摘要列。',
  '',
  '| fixture | exit | ok | summary |',
  '|---|---|---|---|',
  ...results.map((r) => `| ${r.fixture} | ${r.exitCode} | ${r.ok} | ${r.summary.replaceAll('|', '\\|')} |`),
  '',
  `TOTAL: ${passCount}/${total} PASS; EXIT=${allPass ? 0 : 1}`,
  '',
] .join('\n'));

process.exit(allPass ? 0 : 1);
