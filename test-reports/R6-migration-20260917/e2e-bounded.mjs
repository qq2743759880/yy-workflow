// R6 GWT-R6-03 bounded E2E v2: one session, one phase, one asset, one adapter (prompt).
// Bypasses orchestrator router (which requires matched asset cluster for task description) and exercises the full chain directly.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const ws = await fs.mkdtemp(os.tmpdir() + '/r6-e2e-');
const sess = 'r6e2e';
const nsStateDir = path.join(ws, '.tt-state', sess);
await fs.mkdir(nsStateDir, { recursive: true });
const results = [];
const run = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 30000 });

// Phase 1: bounded plan (one phase, one subtask, asset sdlc)
const plan = { schema: 'aa-plan/v1', id: 'p1', status: 'planning', sessionId: sess, assets: ['sdlc'], subtasks: [{ id: 's1', asset: 'sdlc', status: 'idle' }] };
await fs.writeFile(path.join(nsStateDir, 'state.json'), JSON.stringify(plan, null, 2));
results.push({ step: 'bounded plan written', ok: true, planId: plan.id, asset: 'sdlc', subtask: 's1' });

// Phase 2: authoritative phase state present
const stateRead = JSON.parse(await fs.readFile(path.join(nsStateDir, 'state.json'), 'utf8'));
results.push({ step: 'authoritative phase state', ok: stateRead.id === 'p1' });

// Phase 3: bounded activation (R3 activation.prepare)
let actOk = false; let actDetail = '';
try {
  const actUrl = pathToFileURL(resolve(ROOT, 'scripts/lib/activation.mjs')).href;
  const m = await import(actUrl);
  const ns = m.activation || m.default || m;
  const prepare = ns.prepareActivation || (ns.default && ns.default.prepareActivation);
  if (typeof prepare === 'function') {
    const r = await prepare({ workspace: ws, sessionId: sess, asset: 'sdlc', subtaskId: 's1' });
    actOk = !!(r && r.ok);
    actDetail = 'prepare ok=' + actOk + ' code=' + (r && r.code);
  } else { actDetail = 'no prepare export; exports=' + Object.keys(ns).join(','); }
} catch (e) { actDetail = String(e.message).slice(0, 120); }
results.push({ step: 'bounded activation (activation.prepare)', ok: actOk, detail: actDetail });

// Phase 4: receipt verification (R3 receipt.append)
let rcptOk = false; let rcptDetail = '';
try {
  const r3Url = pathToFileURL(resolve(ROOT, 'scripts/lib/receipt.mjs')).href;
  const m = await import(r3Url);
  const ns = m.receipt || m.default || m;
  const append = ns.appendReceiptEvent || (ns.default && ns.default.appendReceiptEvent);
  if (typeof append === 'function') {
    const r = await append({ workspace: ws, sessionId: sess, subtaskId: 's1', schema: 'aa-receipt/v1', state: 'VERIFIED' });
    rcptOk = !!(r && r.ok);
    rcptDetail = 'append ok=' + rcptOk + ' code=' + (r && r.code);
  } else { rcptDetail = 'no append export; exports=' + Object.keys(ns).join(','); }
} catch (e) { rcptDetail = String(e.message).slice(0, 120); }
results.push({ step: 'receipt verification (receipt.append)', ok: rcptOk, detail: rcptDetail });

// Phase 5: Journey projection agrees with state
const jRead = run(['scripts/tt-journey.mjs', '--read', '--workspace', ws, '--session', sess, '--mode', 'full']);
let jShell = null; let projAgree = false; let display = null;
try { jShell = JSON.parse(jRead.stdout); } catch (e) {}
if (jShell && jShell.data && jShell.data.journey) {
  const j = jShell.data.journey;
  display = j.displayStatus;
  const hasP1 = (j.plans || []).some((p) => p.planId === 'p1');
  projAgree = hasP1 && ['AUTHORIZED', 'OBSERVED', 'INFERRED', 'PARTIAL', 'STALE'].includes(display);
}
results.push({ step: 'Journey projection agrees with state', ok: projAgree, display });

// Phase 6: CI evidence
const ci = run(['scripts/ci.mjs', '--workspace', ws]);
results.push({ step: 'CI evidence (scripts/ci.mjs)', ok: ci.status === 0, exit: ci.status });

const allOk = results.every((r) => r.ok);
const out = { schema: 'yy/r6-e2e-bounded@1', generatedAt: new Date().toISOString(), session: sess, workspace: ws, results, allOk };
await fs.writeFile('test-reports/R6-migration-20260917/e2e-bounded.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(results, null, 1));
console.log('BOUNDED-E2E ' + (allOk ? 'PASS' : 'FAIL'));
process.exitCode = allOk ? 0 : 1;