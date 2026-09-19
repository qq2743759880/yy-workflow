// R6 GWT-R6-02 rollback rehearsal: backup -> inject fault -> restore -> hash-identical verify.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const ws = await fs.mkdtemp(os.tmpdir() + '/r6-rollback-');
const stateDir = path.join(ws, '.tt-state');
await fs.mkdir(stateDir, { recursive: true });
const goodState = { schema: 'aa-plan/v0', id: 'p1', status: 'executing', subtasks: [{ id: 's1', status: 'done' }] };
const stateFile = path.join(stateDir, 'state.json');
await fs.writeFile(stateFile, JSON.stringify(goodState, null, 2));

// Phase A: backup (.tt-state snapshot + hash manifest)
const backupDir = path.resolve('test-reports/R6-migration-20260917/backup/ws-snapshot');
await fs.mkdir(backupDir, { recursive: true });
const manifest = [];
async function snapshotTree(src, rel) {
  for (const de of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, de.name); const r = path.join(rel, de.name);
    if (de.isDirectory()) { await fs.mkdir(path.join(backupDir, r), { recursive: true }); await snapshotTree(s, r); }
    else { const buf = await fs.readFile(s); const target = path.join(backupDir, r); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, buf); manifest.push({ file: r.split(path.sep).join('/'), sha256: sha(buf) }); }
  }
}
await snapshotTree(stateDir, '.tt-state');
const manifestFile = path.join(backupDir, 'backup-manifest.json');
await fs.writeFile(manifestFile, JSON.stringify({ generatedAt: new Date().toISOString(), files: manifest }, null, 2));
console.log('backup: ' + manifest.length + ' files hashed');

// Phase B: fault injection (migration failure simulation — state corrupted)
await fs.writeFile(stateFile, '{corrupted!!not-json');

// Phase C: rollback-restore from backup (frozen procedure)
const manifest2 = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
const restored = [];
for (const f of manifest2.files) {
  const target = path.join(ws, f.file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const buf = await fs.readFile(path.join(backupDir, f.file));
  await fs.writeFile(target, buf);
  restored.push({ file: f.file, hashMatch: sha(await fs.readFile(target)) === f.sha256 });
}
const rollbackReceipt = { schema: 'yy/r6-rollback-receipt@1', reverted: restored, trigger: 'migration failure simulation (corrupted state.json)', restoredAt: new Date().toISOString() };

// Phase D: verify
const finalState = JSON.parse(await fs.readFile(stateFile, 'utf8'));
const ok = finalState.id === 'p1' && restored.every((r) => r.hashMatch) && !JSON.stringify(finalState).includes('corrupted');
rollbackReceipt.verified = ok;
await fs.writeFile('test-reports/R6-migration-20260917/rollback-rehearsal.json', JSON.stringify({ schema: 'yy/r6-rollback-rehearsal@1', generatedAt: new Date().toISOString(), ok, receipt: rollbackReceipt }, null, 2));
console.log('rollback rehearsal: verified=' + ok + ' restored=' + restored.length + ' files');
process.exitCode = ok ? 0 : 1;