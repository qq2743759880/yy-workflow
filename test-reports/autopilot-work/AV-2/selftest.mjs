#!/usr/bin/env node
/**
 * AV-2 自测（读 scripts/manifest-build.mjs 产物 + AV-1 接口实读验证 + fail-closed 探针）。
 * 证据：本脚本 console 输出 + selftest.json（同目录）。
 * 只读产物与 vendor；fail-closed 探针在临时目录做（不触碰 contracts/manifest-sources/ 正式 sidecar）。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readManifest, readManifestEntries, CANDIDATE_INVALID } from '../../../scripts/lib/asset.mjs';
import { main as buildMain } from '../../../scripts/manifest-build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
const PRODUCT = path.join(ROOT, 'contracts', 'asset-manifest-v2.json');
const TMP = path.join(HERE, 'tmp-probes');

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}
async function runBuild(sourcesDir, outFile) {
  const argv = ['--sources', sourcesDir, '--out', outFile];
  const logs = [];
  const origLog = console.log, origErr = console.error;
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));
  let code;
  try { code = await buildMain(argv); } finally { console.log = origLog; console.error = origErr; }
  return { code, output: logs.join('\n') };
}

// ── 1) 正式构建产物存在且 16 行 ──
const productText = await fs.readFile(PRODUCT, 'utf8');
const rows = JSON.parse(productText);
record('T1 构建产物 16/16 行', Array.isArray(rows) && rows.length === 16, `rows=${rows.length}`);
record('T2 逐行 drop 旗标显式布尔 false 起步', rows.every((r) => r.drop_pending === false && r.drop_allowed === false), 'drop_pending=false, drop_allowed=false ×16（字段名与 B1-GATE 派单一致）');
record('T3 schema 必填字段齐全（asset-manifest-v2@1.0.0 九字段）', rows.every((r) => ['id', 'name', 'role', 'capability', 'cluster', 'when_to_use', 'when_not_to_use', 'verification', 'source'].every((k) => r[k] !== undefined && r[k] !== null && r[k] !== '' && !(Array.isArray(r[k]) && r[k].length === 0))), 'ids=' + rows.map((r) => r.id).join(','));

// ── 2) AV-1 接口实读：readManifest（文件 → 数组口径）──
try {
  const viaFile = await readManifest(PRODUCT);
  record('T4 asset.mjs readManifest() 读产物全字段通过', viaFile.length === 16, `CANDIDATE_INVALID 校验通过 ${viaFile.length} 行`);
} catch (error) {
  record('T4 asset.mjs readManifest() 读产物全字段通过', false, `${error.code ?? ''} ${error.message}`);
}
// ── 3) AV-1 接口实读：readManifestEntries（{entries} 对象口径）──
try {
  const viaEntries = readManifestEntries({ entries: rows });
  record('T5 asset.mjs readManifestEntries() 读 {entries} 口径通过', viaEntries.length === 16, `${viaEntries.length} 行`);
} catch (error) {
  record('T5 asset.mjs readManifestEntries() 读 {entries} 口径通过', false, `${error.code ?? ''} ${error.message}`);
}

// ── 4) 单源确定性：连跑两次构建字节一致 ──
await fs.mkdir(TMP, { recursive: true });
const rebuildOut = path.join(TMP, 'rebuild.json');
const realSources = path.join(ROOT, 'contracts', 'manifest-sources');
const rb = await runBuild(realSources, rebuildOut);
const rebuilt = await fs.readFile(rebuildOut, 'utf8');
const h1 = crypto.createHash('sha256').update(productText, 'utf8').digest('hex');
const h2 = crypto.createHash('sha256').update(rebuilt, 'utf8').digest('hex');
record('T6 单源确定性（同输入重跑字节一致）', rb.code === 0 && h1 === h2, `sha256=${h1}`);

// ── 5) fail-closed 探针 ×4 ──
async function probe(name, mutate, expectFragment) {
  const dir = path.join(TMP, name);
  await fs.mkdir(dir, { recursive: true });
  for (const f of await fs.readdir(realSources)) await fs.copyFile(path.join(realSources, f), path.join(dir, f));
  await mutate(dir);
  const out = path.join(TMP, name + '.json');
  const r = await runBuild(dir, out);
  const named = r.code === 1 && r.output.includes('CANDIDATE_INVALID') && r.output.includes(expectFragment) && !(await fs.stat(out).then(() => true).catch(() => false));
  record(`T-${name} fail-closed`, named, r.code === 1 ? r.output.split('\n').find((l) => l.includes(expectFragment))?.trim().slice(0, 160) ?? r.output.slice(0, 160) : `exit=${r.code}`);
}
await probe('P1-缺字段', async (dir) => {
  const f = path.join(dir, 'security.yaml');
  const t = (await fs.readFile(f, 'utf8')).split('\n').filter((l) => !l.startsWith('verification:')).join('\n');
  await fs.writeFile(f, t);
}, 'security');
await probe('P2-source路径不存在', async (dir) => {
  const f = path.join(dir, 'review.yaml');
  await fs.writeFile(f, (await fs.readFile(f, 'utf8')).replace('source: vendor/review/SKILL.md#L1-L5', 'source: vendor/review/NOT-EXIST.md#L1-L5'));
}, 'NOT-EXIST');
await probe('P3-drop非显式布尔', async (dir) => {
  const f = path.join(dir, 'planning.yaml');
  await fs.writeFile(f, (await fs.readFile(f, 'utf8')).replace('drop_allowed: false', 'drop_allowed: no'));
}, '显式布尔');
await probe('P4-缺整个sidecar', async (dir) => {
  await fs.unlink(path.join(dir, 'sdlc.yaml'));
}, '缺 sidecar');

// ── 6) 汇总 + hash 落盘 ──
const pass = results.filter((r) => r.ok).length;
const summary = {
  date: new Date().toISOString(),
  product: 'contracts/asset-manifest-v2.json',
  rows: rows.length,
  sha256: h1,
  results,
  verdict: pass === results.length ? 'ALL PASS' : 'FAIL',
};
await fs.writeFile(path.join(HERE, 'selftest.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(`\nsha256(contracts/asset-manifest-v2.json) = ${h1}  （Gate-2 runtime hash 绑定用）`);
console.log(`selftest: ${pass}/${results.length} PASS → selftest.json`);
await fs.rm(TMP, { recursive: true, force: true });
process.exit(pass === results.length ? 0 : 1);
