/**
 * r5a-p16-before-after.mjs — T8 加固①「R5a p16 去时间戳」前后对照复现器。
 *
 * 目的：用**同一台机器、同一 Node 构建、同一产品代码**给出可复现的前后对比：
 *   - BEFORE 臂：完全复刻加固前 p16 夹具写序（紧邻 writeFileSync，无 mtime 固定）；
 *   - AFTER  臂：改用 probes/_helper.mjs 的 writeJsonFixed（写后 utimes 固定为 FIXED_NOW_MS）。
 * 两臂都跑 journey.read（full）+ journey.project，记录 displayStatus / persistedTo /
 * journey.json 是否落盘 / state 与 receipt 的 mtime 是否同刻。
 *
 * 判据（OQ-R5-2=A 相对判据）：state 与 receipts 两个权威源 mtime 不同刻 ⇒ computeStale 判 STALE
 * ⇒ §4.3「仅 AUTHORIZED/OBSERVED 落盘」⇒ persistedTo=null ⇒ p16 两处断言同时失败。
 *
 * 运行：node test-reports/rebuild-20260920/T8-hardening/r5a-p16-before-after.mjs [N]
 * 写入：仅 os.tmpdir() 下的临时沙箱（仓库零写入）。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const JOURNEY = new URL('../../../scripts/lib/journey.mjs', import.meta.url).href;
const HELPER = new URL('../R5a-journey/probes/_helper.mjs', import.meta.url).href;
const { journey } = await import(JOURNEY);
const { writeJsonFixed, FIXED_NOW_MS } = await import(HELPER);

const N = Number(process.argv[2] ?? 20);

/** BEFORE 臂夹具：加固前写序（紧邻 writeFileSync，无 mtime 固定）。 */
function fixtureBefore(sandbox) {
  const rootArt = path.join(sandbox, 'artifacts', 'rootP');
  fs.mkdirSync(rootArt, { recursive: true });
  fs.writeFileSync(path.join(rootArt, 'state-summary.json'), JSON.stringify({ schema: 'tt/state-summary@1', planId: 'rootP', status: 'done' }));
  fs.mkdirSync(path.join(sandbox, '.tt-state'), { recursive: true });
  fs.writeFileSync(path.join(sandbox, '.tt-state', 'state.json'), JSON.stringify({ schema: 'aa-plan/v1', id: 'root-plan', status: 'done', subtasks: [] }));
  const aDir = path.join(sandbox, '.tt-state', 'alpha');
  const aArt = path.join(aDir, 'artifacts');
  fs.mkdirSync(path.join(aArt, 'as1'), { recursive: true });
  fs.mkdirSync(path.join(aArt, 'ap1'), { recursive: true });
  // 关键：这两次写入相邻，构成 mtime 竞争的双方
  fs.writeFileSync(path.join(aDir, 'state.json'), JSON.stringify({ schema: 'aa-plan/v1', id: 'ns-A-plan', status: 'done', subtasks: [{ id: 'as1', asset: 'sdlc', status: 'done' }] }));
  fs.writeFileSync(path.join(aArt, 'as1', 'receipt.json'), JSON.stringify({ subtaskId: 'as1', assetId: 'sdlc', events: [{ transition: 'behavior_verified' }], result: 'VERIFIED' }));
  fs.writeFileSync(path.join(aArt, 'ap1', 'state-summary.json'), JSON.stringify({ schema: 'tt/state-summary@1', planId: 'ap1', status: 'done' }));
  return aDir;
}

/** AFTER 臂夹具：加固后写序（writeJsonFixed → mtime 固定）。 */
function fixtureAfter(sandbox) {
  const rootArt = path.join(sandbox, 'artifacts', 'rootP');
  fs.mkdirSync(rootArt, { recursive: true });
  writeJsonFixed(path.join(rootArt, 'state-summary.json'), { schema: 'tt/state-summary@1', planId: 'rootP', status: 'done' });
  fs.mkdirSync(path.join(sandbox, '.tt-state'), { recursive: true });
  writeJsonFixed(path.join(sandbox, '.tt-state', 'state.json'), { schema: 'aa-plan/v1', id: 'root-plan', status: 'done', subtasks: [] });
  const aDir = path.join(sandbox, '.tt-state', 'alpha');
  const aArt = path.join(aDir, 'artifacts');
  fs.mkdirSync(path.join(aArt, 'as1'), { recursive: true });
  fs.mkdirSync(path.join(aArt, 'ap1'), { recursive: true });
  writeJsonFixed(path.join(aDir, 'state.json'), { schema: 'aa-plan/v1', id: 'ns-A-plan', status: 'done', subtasks: [{ id: 'as1', asset: 'sdlc', status: 'done' }] });
  writeJsonFixed(path.join(aArt, 'as1', 'receipt.json'), { subtaskId: 'as1', assetId: 'sdlc', events: [{ transition: 'behavior_verified' }], result: 'VERIFIED' });
  writeJsonFixed(path.join(aArt, 'ap1', 'state-summary.json'), { schema: 'tt/state-summary@1', planId: 'ap1', status: 'done' });
  return aDir;
}

function runArm(label, fixture, n) {
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-t8-p16-' + label.toLowerCase() + '-'));
    try {
      const aDir = fixture(sandbox);
      const stateFile = path.join(aDir, 'state.json');
      const receiptFile = path.join(aDir, 'artifacts', 'as1', 'receipt.json');
      const ms = fs.statSync(stateFile).mtimeMs;
      const mr = fs.statSync(receiptFile).mtimeMs;
      const ra = journey.read({ workspace: sandbox, session: 'alpha', mode: 'full' });
      const ja = ra.data.journey;
      const pa = journey.project({ workspace: sandbox, session: 'alpha' });
      const landed = pa.data.persistedTo === '.tt-state/alpha/journey.json' && fs.existsSync(path.join(aDir, 'journey.json'));
      rows.push({
        i: i + 1,
        mtimeDiffMs: Number((mr - ms).toFixed(3)),
        sameTick: ms === mr,
        displayStatus: ja.displayStatus,
        persistedTo: pa.data.persistedTo,
        landed,
      });
    } finally {
      try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch { /* 临时目录，尽力 */ }
    }
  }
  const sameTick = rows.filter((r) => r.sameTick).length;
  const stale = rows.filter((r) => r.displayStatus === 'STALE').length;
  const landed = rows.filter((r) => r.landed).length;
  const pass = rows.filter((r) => r.landed && (r.displayStatus === 'AUTHORIZED' || r.displayStatus === 'OBSERVED')).length;
  console.log(`\n=== ${label}（N=${n}）===`);
  for (const r of rows) {
    console.log(`  #${String(r.i).padStart(2)} mtimeDiff=${String(r.mtimeDiffMs).padStart(8)}ms sameTick=${r.sameTick ? 'Y' : 'N'} displayStatus=${r.displayStatus} persistedTo=${r.persistedTo} landed=${r.landed}`);
  }
  console.log(`  小结：mtime 同刻 ${sameTick}/${n}｜STALE ${stale}/${n}｜journey.json 落盘 ${landed}/${n}｜p16 判据通过 ${pass}/${n}（失败率 ${(((n - pass) / n) * 100).toFixed(0)}%）`);
  return { label, n, sameTick, stale, landed, pass, failRate: (n - pass) / n };
}

console.log('T8 加固① — R5a p16 去时间戳前后对照（同一机器 / 同一 Node ' + process.version + ' / 同一 products 代码）');
console.log('固定 mtime = ' + new Date(FIXED_NOW_MS).toISOString());
const before = runArm('BEFORE', fixtureBefore, N);
const after = runArm('AFTER', fixtureAfter, N);
console.log('\n对照：');
console.log('  BEFORE 失败率 ' + (before.failRate * 100).toFixed(0) + '%（' + (before.n - before.pass) + '/' + before.n + '）');
console.log('  AFTER  失败率 ' + (after.failRate * 100).toFixed(0) + '%（' + (after.n - after.pass) + '/' + after.n + '）');
const ok = after.pass === after.n;
console.log('\nRESULT: AFTER ' + after.pass + '/' + after.n + ' 通过 ⇒ ' + (ok ? 'OK' : 'NOT-OK'));
process.exit(ok ? 0 : 1);
