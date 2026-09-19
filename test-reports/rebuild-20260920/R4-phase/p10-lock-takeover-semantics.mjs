/** p10 — lock takeover 语义（§2.3，OQ-R4-3=A，验收公式 takeover = dead || (stale && !pidAlive)）：持有者死亡即接管；持有者存活即使过期也不接管；legacy 无持有者锁过期自愈、未过期显式失败。 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import phase from '../../../scripts/lib/phase.mjs';
import { NOW, stateFixture, seedState, stateFileOf, writeReceipt, writeJson, verdict } from './_helpers.mjs';

function writeLock(ws, content, { staleMs = 0 } = {}) {
  const lockFile = path.join(ws, '.tt-state', 'state.lock');
  if (content === null) { fs.mkdirSync(path.dirname(lockFile), { recursive: true }); fs.writeFileSync(lockFile, ''); }
  else writeJson(lockFile, content);
  if (staleMs > 0) { const t = new Date(Date.now() - staleMs); fs.utimesSync(lockFile, t, t); }
  return lockFile;
}

async function deadPid() {
  const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
  await new Promise((r) => child.on('close', r));
  return child.pid;
}

/** 独立 ws 夹具：reviewing + 有效 receipt（失败面收敛到锁单变量） */
function freshWs(sandbox, name) {
  const ws = path.join(sandbox, name);
  seedState(ws, stateFixture());
  writeReceipt(ws, { subtaskId: 's1', assetId: 'implementation', terminal: 'verified' });
  return ws;
}

export async function run({ sandbox }) {
  const checks = [];
  const c = (name, pass) => checks.push({ name, pass });
  const pid = await deadPid();

  // (1) 持有者 pid 确认死亡 ⇒ 接管（即使锁未过期）：takeover = dead || …
  const ws1 = freshWs(sandbox, 'ws-dead');
  writeLock(ws1, { holder: 'dead-sess', pid, acquiredAt: new Date().toISOString(), purpose: 'phase.transition' });
  const t1 = Date.now();
  const tr1 = await phase.transitionPhase({ workspace: ws1, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('dead.takeover', tr1.ok === true && tr1.data.override === null, `code=${tr1.code} reason=${tr1.data?.reason ?? ''}`);
  c('dead.fast', Date.now() - t1 < 1500); // 首轮即接管，不耗尽 5×400ms

  // (2) 持有者存活 + 锁过期 ⇒ 不接管（活进程长任务不被误接管，清单 R4-04 defect 面）⇒ LOCK_ACQUIRE_FAILED
  const ws2 = freshWs(sandbox, 'ws-alive-stale');
  writeLock(ws2, { holder: 'busy-sess', pid: process.pid, acquiredAt: new Date(Date.now() - 40000).toISOString(), purpose: 'phase.transition' }, { staleMs: 40000 });
  const tr2 = await phase.transitionPhase({ workspace: ws2, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('aliveStale.noTakeover', tr2.ok === false && tr2.code === 'LOCK_ACQUIRE_FAILED', `code=${tr2.code}`);
  c('aliveStale.holderEcho', tr2.data.holder?.holder === 'busy-sess');
  c('aliveStale.stateUnchanged', JSON.parse(fs.readFileSync(stateFileOf(ws2), 'utf8')).status === 'reviewing');

  // (3) 持有者存活 + 锁未过期 ⇒ 同上（基线形态，与 p04 互补）
  const ws3 = freshWs(sandbox, 'ws-alive-fresh');
  writeLock(ws3, { holder: 'fresh-sess', pid: process.pid, acquiredAt: new Date().toISOString(), purpose: 'phase.transition' });
  const tr3 = await phase.transitionPhase({ workspace: ws3, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('aliveFresh.explicitFail', tr3.ok === false && tr3.code === 'LOCK_ACQUIRE_FAILED');

  // (4) legacy 空锁占位（无持有者，tt-journey.mjs:184-189 现状形）：过期自愈接管；未过期显式失败
  const ws4 = freshWs(sandbox, 'ws-legacy-stale');
  writeLock(ws4, null, { staleMs: 40000 });
  const tr4 = await phase.transitionPhase({ workspace: ws4, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('legacyStale.takeover', tr4.ok === true, `code=${tr4.code}`);
  const ws5 = freshWs(sandbox, 'ws-legacy-fresh');
  writeLock(ws5, null);
  const tr5 = await phase.transitionPhase({ workspace: ws5, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('legacyFresh.explicitFail', tr5.ok === false && tr5.code === 'LOCK_ACQUIRE_FAILED');

  return verdict(checks, 'lock-takeover');
}
