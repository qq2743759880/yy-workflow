/** p04 — GWT-R4-04 lock failure（清单 R4-04）：持锁会话存活时写操作耗尽重试 ⇒ LOCK_ACQUIRE_FAILED 显式失败，不锁外继续，输出携带锁持有者信息（现状 fail-open 为 defect 形态，不复刻）。 */
import fs from 'node:fs';
import path from 'node:path';
import phase from '../../../scripts/lib/phase.mjs';
import { NOW, stateFixture, seedState, stateFileOf, writeReceipt, writeJson, shellOk, verdict } from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const c = (name, pass) => checks.push({ name, pass });
  const ws = sandbox;
  // 前置全满足（有效 receipt），失败面收敛到锁竞争单变量
  seedState(sandbox, stateFixture());
  writeReceipt(sandbox, { subtaskId: 's1', assetId: 'implementation', terminal: 'verified' });

  const lockFile = path.join(sandbox, '.tt-state', 'state.lock');
  writeJson(lockFile, { holder: 'sess-1', pid: process.pid, acquiredAt: new Date().toISOString(), purpose: 'phase.transition' });

  const t0 = Date.now();
  const tr = await phase.transitionPhase({ workspace: ws, from: 'reviewing', to: 'done', opts: { now: NOW } });
  const elapsed = Date.now() - t0;

  c('lockBusy.code', tr.ok === false && tr.code === 'LOCK_ACQUIRE_FAILED');
  c('lockBusy.shell', shellOk(tr));
  c('lockBusy.retried', elapsed >= 1800, `elapsed=${elapsed}ms（须 ≥5×400ms 重试）`); // attempt 0 + 5 次 delayMs=400
  c('lockBusy.holderEcho', tr.data.holder?.holder === 'sess-1' && tr.data.lockFile === lockFile);
  c('lockBusy.stateUnchanged', JSON.parse(fs.readFileSync(stateFileOf(sandbox), 'utf8')).status === 'reviewing');
  c('lockBusy.lockIntact', JSON.parse(fs.readFileSync(lockFile, 'utf8')).holder === 'sess-1');
  c('lockBusy.noAuditOutsideLock', !fs.existsSync(path.join(sandbox, '.tt-state', 'transitions.jsonl')));

  // 释放锁后同一转换成功（锁是唯一阻塞变量）
  fs.unlinkSync(lockFile);
  const tr2 = await phase.transitionPhase({ workspace: ws, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('afterRelease.ok', tr2.ok === true && tr2.data.override === null);
  c('afterRelease.stateDone', JSON.parse(fs.readFileSync(stateFileOf(sandbox), 'utf8')).status === 'done');

  return verdict(checks, 'gwt-r4-04');
}
