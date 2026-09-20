/**
 * repro.mjs — R5a p16「STALE 间歇失败」根因复现器（T7 收尾批诊断物，只读产品代码）。
 *
 * 现象（T7 收尾批复跑 R5a 六模块门时发现）：
 *   `[FAIL] p16 | namespace一致: ... 健康=STALE 落点同ns=false ...`
 *   ——失败运行里 `.tt-state/alpha/journey.json` 根本不落盘；同一 cwd 连跑会看到失败/成功交替。
 *
 * 因果链（本脚本逐段机验）：
 *   1. p16 夹具先写 `.tt-state/alpha/state.json`，紧接着写 `artifacts/as1/receipt.json`
 *      —— 两个"权威源"落在相邻的两次 writeFileSync；
 *   2. `journey.mjs` 的 `computeStale()`（OQ-R5-2=A 相对判据）取 {journey, state, receipts}
 *      中的最新时点与最老时点比较，**最老者落后于最新者 ⇒ STALE**；
 *   3. 于是当两次写的文件 mtime 落在不同时钟刻度上（receipt 更新），投影即 STALE；
 *      mtime 相同（同一刻度）则无 STALE ⇒ 探针通过 —— 失败率取决于写间隔与系统时钟粒度之比；
 *   4. `journey.mjs:44` 规定「仅当展示态 ∈ {AUTHORIZED, OBSERVED} 才落盘 journey.json」，
 *      故 STALE 运行必然 `landedNs=false` —— 一个根因，两处断言同时失败。
 *
 * 结论：这是 **探针夹具的时钟/时间戳脆弱性**（与 T7 批⑤ 为 R3 做的"去时钟依赖"同源问题），
 * 不是 journey.mjs 实现缺陷。修复需改 R5a 探针夹具（该目录不在 T7 批白名单），故仅取证申报。
 *
 * 运行：node test-reports/rebuild-20260920/T7-closeout/evidence/r5a-p16-flake/repro.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const JOURNEY = new URL('../../../../../scripts/lib/journey.mjs', import.meta.url).href;
const { journey } = await import(JOURNEY);

const N = Number(process.argv[2] ?? 20);

/** 完全复刻 p16 的夹具写序（state 先、receipt 后，中间无 sleep）。 */
function makeFixture(sandbox) {
  const rootArt = path.join(sandbox, 'artifacts', 'rootP');
  fs.mkdirSync(rootArt, { recursive: true });
  fs.writeFileSync(path.join(rootArt, 'state-summary.json'), JSON.stringify({ schema: 'tt/state-summary@1', planId: 'rootP', status: 'done' }));
  fs.mkdirSync(path.join(sandbox, '.tt-state'), { recursive: true });
  fs.writeFileSync(path.join(sandbox, '.tt-state', 'state.json'), JSON.stringify({ schema: 'aa-plan/v1', id: 'root-plan', status: 'done', subtasks: [] }));

  const aDir = path.join(sandbox, '.tt-state', 'alpha');
  const aArt = path.join(aDir, 'artifacts');
  fs.mkdirSync(path.join(aArt, 'as1'), { recursive: true });
  fs.mkdirSync(path.join(aArt, 'ap1'), { recursive: true });
  // ↓↓ 关键：这两次写入相邻，构成 mtime 竞争的双方 ↓↓
  fs.writeFileSync(path.join(aDir, 'state.json'), JSON.stringify({ schema: 'aa-plan/v1', id: 'ns-A-plan', status: 'done', subtasks: [{ id: 'as1', asset: 'sdlc', status: 'done' }] }));
  fs.writeFileSync(path.join(aArt, 'as1', 'receipt.json'), JSON.stringify({ subtaskId: 'as1', assetId: 'sdlc', events: [{ transition: 'behavior_verified' }], result: 'VERIFIED' }));
  fs.writeFileSync(path.join(aArt, 'ap1', 'state-summary.json'), JSON.stringify({ schema: 'tt/state-summary@1', planId: 'ap1', status: 'done' }));
  return { aDir };
}

const rows = [];
let sameMs = 0;
let staleRuns = 0;
for (let i = 0; i < N; i += 1) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-p16-stale-'));
  try {
    const { aDir } = makeFixture(sandbox);
    const ms = fs.statSync(path.join(aDir, 'state.json')).mtimeMs;
    const mr = fs.statSync(path.join(aDir, 'artifacts', 'as1', 'receipt.json')).mtimeMs;
    const ra = journey.read({ workspace: sandbox, session: 'alpha', mode: 'full' });
    const ds = ra.data?.journey?.displayStatus;
    const pa = journey.project({ workspace: sandbox, session: 'alpha' });
    const landed = pa.data?.persistedTo;
    const freshExists = fs.existsSync(path.join(aDir, 'journey.json'));
    const same = ms === mr;
    if (same) sameMs += 1;
    if (ds === 'STALE') staleRuns += 1;
    rows.push(
      (same ? 'mtime同' : 'mtime差 ' + (mr - ms).toFixed(1) + 'ms')
      + ' | displayStatus=' + ds
      + ' | persistedTo=' + (landed === undefined ? '(未落盘)' : landed)
      + ' | journey.json存在=' + freshExists,
    );
  } finally {
    try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch { /* 忽略 */ }
  }
}

console.log('每次运行（p16 夹具写序 + journey.read/project）：');
rows.forEach((r, i) => console.log('  #' + String(i + 1).padStart(2) + ' ' + r));
console.log('');
const notPersisted = rows.filter((r) => r.includes('persistedTo=null')).length;
console.log('样本 ' + N + ' 次：mtime 相同 ' + sameMs + ' 次 / mtime 不同 ' + (N - sameMs) + ' 次；displayStatus=STALE '
  + staleRuns + ' 次；persistedTo=null（未落盘）' + notPersisted + ' 次');
const chain = rows.every((r) => {
  const same = r.startsWith('mtime同');
  const stale = r.includes('displayStatus=STALE');
  const persisted = r.includes('persistedTo=null');
  return (same && !stale && !persisted) || (!same && stale && persisted);
});
console.log('判定：mtime 相同 ⟺ 无 STALE ⟺ 落盘；mtime 不同 ⟺ STALE ⟺ 不落盘 ⟹ '
  + (chain ? '因果链成立（p16 夹具时间戳脆弱性，非 journey.mjs 实现缺陷）' : '因果链待复核'));
console.log('失败率 ≈ ' + (100 * (N - sameMs) / N).toFixed(0) + '%（= 两次相邻写入跨越文件时间戳刻度的比例）');
