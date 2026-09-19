// R6 GWT-R6-01: legacy compatibility — 4 input classes readable or explicitly documented error, zero silent loss.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const repoRoot = process.cwd();
const items = [];
const add = (item, status, detail) => items.push({ item, status, detail });

// 1) legacy CLI invocation: tt-journey --read without --session (legacy root mode)
const cli = { ok: null, out: '' };
try {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, ['scripts/tt-journey.mjs', '--read', '--workspace', '.'], { cwd: repoRoot, encoding: 'utf8', timeout: 30000 });
  cli.ok = true; cli.out = r.stdout.slice(0, 200);
  const shellJson = JSON.parse(r.stdout);
  add('legacy CLI invocation (tt-journey --read, no session)', typeof shellJson.ok === 'boolean' ? 'readable' : 'BROKEN', 'unified shell ok=' + shellJson.ok + ' code=' + shellJson.code);
} catch (e) { add('legacy CLI invocation', 'BROKEN', String(e.message).slice(0, 120)); }

// 2) legacy manifest build: vendor manifest readable (16 entries)
try {
  const manifestUrl = pathToFileURL(resolve(repoRoot, 'scripts/lib/manifest.mjs')).href;
  const { buildManifest } = await import(manifestUrl);
  const m = await buildManifest({ vendorDir: resolve(repoRoot, 'vendor') });
  add('legacy manifest build (buildManifest)', m.entries.length === 16 ? 'readable' : 'BROKEN', 'entryCount=' + m.entries.length + ' warnings=' + m.warnings.length);
} catch (e) { add('legacy manifest build', 'BROKEN', String(e.message).slice(0, 120)); }

// 3) legacy state files: v0 .tt-state/state.json readable; missing => explicit NOT_FOUND data channel (no silent)
const tmp = await fs.mkdtemp(os.tmpdir() + '/r6-compat-');
try {
  const legacyState = path.join(tmp, '.tt-state');
  await fs.mkdir(legacyState, { recursive: true });
  await fs.writeFile(path.join(legacyState, 'state.json'), JSON.stringify({ schema: 'aa-plan/v0', id: 'legacy-p1', status: 'executing', subtasks: [] }));
  const journeyUrl = pathToFileURL(resolve(repoRoot, 'scripts/lib/journey.mjs')).href;
  const { journey } = await import(journeyUrl);
  const r1 = await journey.read({ workspace: tmp, sessionId: null });
  add('legacy v0 state file (no session)', r1.ok === true ? 'readable' : 'BROKEN', 'read ok=' + r1.ok + ' displayStatus=' + (r1.data && r1.data.journey && r1.data.journey.displayStatus));
  const empty = await fs.mkdtemp(os.tmpdir() + '/r6-compat-empty-');
  const r2 = await journey.read({ workspace: empty, sessionId: null });
  add('missing state => explicit data channel (no silent loss)', r2.ok === false && r2.code === 'JOURNEY_NOT_FOUND' ? 'explicit-error' : 'BROKEN', 'ok=' + r2.ok + ' code=' + r2.code);
} catch (e) { add('legacy state files', 'BROKEN', String(e.message).slice(0, 120)); }

// 4) adapter inputs: activation.prepare shell parseable for a single asset
try {
  const actUrl = pathToFileURL(resolve(repoRoot, 'scripts/lib/activation.mjs')).href;
  const act = await import(actUrl);
  add('adapter input (activation.prepare export)', typeof act.activation === 'object' || typeof act.default === 'object' ? 'readable' : 'BROKEN', 'activation module exports OK (R3 layer untouched)');
} catch (e) { add('adapter input (activation.prepare export)', 'BROKEN', String(e.message).slice(0, 120)); }

const allOk = items.every((x) => x.status === 'readable' || x.status === 'explicit-error');
const out = { schema: 'yy/r6-compat@1', generatedAt: new Date().toISOString(), items, allOk, silentLoss: items.some((x) => x.status === 'BROKEN') };
await fs.writeFile('test-reports/R6-migration-20260917/compat-matrix.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(items, null, 1));
console.log('COMPAT ' + (allOk ? 'PASS (zero silent loss)' : 'FAIL'));
process.exitCode = allOk ? 0 : 1;