#!/usr/bin/env node
/**
 * B1 自测：state.mjs 命名空间读写层。
 *  - 四命名空间（receipt/finding/change/journey）读写 roundtrip
 *  - ns 白名单外 fail-closed（抛错）
 *  - 老 state 文件（无新段）兼容读取 → 空数组，不报错
 *  - stateVersion 缺失 = legacy 合法；存在但不认识 = fail-closed（STATE_VERSION_UNSUPPORTED）
 *  - 既有导出（STATE/canTransition 等）零变化
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert';
import {
  STATE, TRANSITIONS, canTransition, assertTransition,
  readNamespace, appendNamespace, NAMESPACES, STATE_VERSION, StateVersionError,
} from '../../../scripts/lib/state.mjs';

const results = [];
function check(name, ok, detail = '') {
  results.push([name, ok, detail]);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : ''));
}

const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-t4-b1-'));
try {
  // 1) 四命名空间 roundtrip
  for (const ns of NAMESPACES) {
    await appendNamespace(ns, { id: ns + '-1', ts: 1 }, { workspace: ws });
    await appendNamespace(ns, { id: ns + '-2', ts: 2 }, { workspace: ws });
  }
  let rtOk = true, rtDetail = [];
  for (const ns of NAMESPACES) {
    const arr = await readNamespace(ns, { workspace: ws });
    if (!(arr.length === 2 && arr[0].id === ns + '-1' && arr[1].id === ns + '-2')) { rtOk = false; rtDetail.push(ns + '=' + JSON.stringify(arr)); }
  }
  check('B1-1 四命名空间读写 roundtrip', rtOk, rtDetail.join('; '));

  // 2) ns 白名单外 fail-closed
  let badThrew = false, badMsg = '';
  try { await readNamespace('bogus', { workspace: ws }); } catch (e) { badThrew = true; badMsg = e.message; }
  check('B1-2 白名单外 ns fail-closed（抛错）', badThrew && /未知命名空间/.test(badMsg), badMsg.slice(0, 50));

  let badAppendThrew = false;
  try { await appendNamespace('receipts', {}, { workspace: ws }); } catch (e) { badAppendThrew = true; }
  check('B1-2b append 白名单外 fail-closed', badAppendThrew);

  // 3) 老 state 文件（plan 对象，无新段）兼容读取 → 空数组
  fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
  fs.writeFileSync(path.join(ws, '.tt-state', 'state.json'), JSON.stringify({ id: 'plan-x', status: 'idle' }), 'utf8');
  let oldOk = true;
  for (const ns of NAMESPACES) {
    const arr = await readNamespace(ns, { workspace: ws });
    if (!(Array.isArray(arr) && arr.length === 0)) { oldOk = false; }
  }
  check('B1-3 老 state 文件缺新段 → 空默认不报错', oldOk);

  // 3b) 在老文件上 append → 保留既有 plan 字段 + 补齐四段
  await appendNamespace('finding', { id: 'f-1' }, { workspace: ws });
  const merged = JSON.parse(fs.readFileSync(path.join(ws, '.tt-state', 'state.json'), 'utf8'));
  check('B1-3b append 保留既有 plan 字段', merged.id === 'plan-x' && merged.status === 'idle', 'id=' + merged.id);
  check('B1-3c append 补齐四段数组', Array.isArray(merged.receipt) && Array.isArray(merged.change) && Array.isArray(merged.journey) && merged.finding.length === 1);
  check('B1-3d append 写入 stateVersion', merged.stateVersion === STATE_VERSION, String(merged.stateVersion));

  // 4) stateVersion 闸
  fs.writeFileSync(path.join(ws, '.tt-state', 'state.json'), JSON.stringify({ stateVersion: 'future/99', receipt: [] }), 'utf8');
  let verThrew = false, verCode = '';
  try { await readNamespace('receipt', { workspace: ws }); } catch (e) { verThrew = true; verCode = e.code; }
  check('B1-4 未知 stateVersion fail-closed(STATE_VERSION_UNSUPPORTED)', verThrew && verCode === 'STATE_VERSION_UNSUPPORTED', verCode);

  // 5) 既有导出零变化
  check('B1-5 既有 STATE/canTransition 未动', STATE.IDLE === 'idle' && canTransition('idle', 'planning') === true && canTransition('idle', 'done') === false && typeof TRANSITIONS.idle === 'object');
} finally {
  fs.rmSync(ws, { recursive: true, force: true });
}

const failed = results.filter(([, ok]) => !ok);
console.log('\nB1 self-test: ' + (results.length - failed.length) + '/' + results.length + ' passed');
process.exitCode = failed.length ? 1 : 0;
