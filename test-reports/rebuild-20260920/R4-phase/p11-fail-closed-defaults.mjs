/** p11 — fail-closed 默认（清单 R4-08 + §4.2/§4.3）：证据缺失=不通过（缺失与不满足同归 PHASE_PREREQ_UNMET）；裸布尔 telemetry 盲视；receipt 重放不一致 ⇒ RECEIPT_INVALID；非法输入形状绝不 allowed=true；[待补充] 判定值显式透传不编造。 */
import fs from 'node:fs';
import path from 'node:path';
import phase from '../../../scripts/lib/phase.mjs';
import { NOW, stateFixture, seedState, stateFileOf, writeReceipt, shellOk, verdict } from './_helpers.mjs';

function wsOf(sandbox, name, subtaskOver = {}, receiptTerminal = null) {
  const ws = path.join(sandbox, name);
  seedState(ws, stateFixture({ subtasks: [Object.assign({ id: 's1', asset: 'implementation', status: 'done', mode: 'exec', attempts: 1, phase: 0, dependsOn: [] }, subtaskOver)] }));
  if (receiptTerminal) writeReceipt(ws, { subtaskId: 's1', assetId: 'implementation', terminal: receiptTerminal });
  return ws;
}

export async function run({ sandbox }) {
  const checks = [];
  const c = (name, pass) => checks.push({ name, pass });

  // (a) 证据「缺失」与「不满足/未收口」同归 PHASE_PREREQ_UNMET，禁止默认放行（§4.2 fail-closed）
  const wsMissing = wsOf(sandbox, 'ws-missing', { assetConsumed: true }); // 裸布尔在场 = telemetry 陷阱
  const chkMissing = await phase.checkPhase({ workspace: wsMissing, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('missing.dataChannel', chkMissing.ok === true && chkMissing.code === 'PHASE_PREREQ_UNMET' && chkMissing.data.allowed === false);
  c('missing.telemetryBlind', JSON.stringify(chkMissing.data.missing).includes('telemetry-only'));
  const wsUnresolved = wsOf(sandbox, 'ws-unresolved', {}, 'unresolved');
  const chkUnresolved = await phase.checkPhase({ workspace: wsUnresolved, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('unresolved.sameCode', chkUnresolved.ok === true && chkUnresolved.code === 'PHASE_PREREQ_UNMET' && chkUnresolved.data.allowed === false); // UNRESOLVED 不得静默计为通过
  c('unresolved.shell', shellOk(chkUnresolved));

  // (b) 裸布尔 assetConsumed:true 作为唯一证据参与 gate ⇒ 不满足任何前置（[R3冻结] §7.8/OQ-R3-7，R4 不弱化）
  const trBare = await phase.transitionPhase({ workspace: wsMissing, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('bareBoolean.rejected', trBare.ok === false && trBare.code === 'PHASE_PREREQ_UNMET');
  c('bareBoolean.stateUnchanged', JSON.parse(fs.readFileSync(stateFileOf(wsMissing), 'utf8')).status === 'reviewing');

  // (c) receipt result 缓存与事件重放不一致 ⇒ RECEIPT_INVALID（R4 gate 消费 R3 同一校验，§4.3.1）
  const wsMismatch = wsOf(sandbox, 'ws-mismatch', {}, 'mismatch');
  const chkMismatch = await phase.checkPhase({ workspace: wsMismatch, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('mismatch.check', chkMismatch.ok === false && chkMismatch.code === 'RECEIPT_INVALID');
  const trMismatch = await phase.transitionPhase({ workspace: wsMismatch, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('mismatch.transition', trMismatch.ok === false && trMismatch.code === 'RECEIPT_INVALID');
  c('mismatch.stateUnchanged', JSON.parse(fs.readFileSync(stateFileOf(wsMismatch), 'utf8')).status === 'reviewing');

  // (d) 非法输入形状 ⇒ fail-closed，绝不 allowed=true（§6.1 fail-closed 行）
  const bad1 = await phase.checkPhase({ workspace: sandbox, opts: { now: NOW } }); // 无 target 也无 from/to
  c('shape.noTarget', bad1.ok === false && bad1.code === 'INVALID_TRANSITION');
  const bad2 = await phase.checkPhase({ workspace: sandbox, from: 'bogus', to: 'done', opts: { now: NOW } }); // 矩阵外
  c('shape.matrixIllegal', bad2.ok === false && bad2.code === 'INVALID_TRANSITION');
  const bad3 = await phase.transitionPhase({ workspace: sandbox, from: '', to: 'done', opts: { now: NOW } });
  c('shape.emptyFrom', bad3.ok === false && bad3.code === 'INVALID_TRANSITION');
  const bad4 = await phase.run('phase.knock', {}); // 未知操作（仅两操作，契约头）
  c('shape.unknownOp', bad4.ok === false && bad4.code === 'INVALID_TRANSITION' && shellOk(bad4));

  // (e) 终态不可追加（§3.2）+ 矩阵先于 override 判定（§6.2 顺序）：--force 也无法对终态追加（§5.3 行 5）
  const wsDone = wsOf(sandbox, 'ws-done', {}, 'verified');
  const trOk = await phase.transitionPhase({ workspace: wsDone, from: 'reviewing', to: 'done', opts: { now: NOW, rand: 'aaa00001' } });
  c('terminal.setupDone', trOk.ok === true);
  const stDoneBefore = fs.readFileSync(stateFileOf(wsDone), 'utf8');
  const trTerminal = await phase.transitionPhase({ workspace: wsDone, from: 'done', to: 'planning', force: true, ownerReceipt: { approvalId: 'x' }, opts: { now: NOW } });
  c('terminal.illegalEvenWithForce', trTerminal.ok === false && trTerminal.code === 'INVALID_TRANSITION' && trTerminal.data.reason.includes('终态不可追加'));
  c('terminal.stateUnchanged', fs.readFileSync(stateFileOf(wsDone), 'utf8') === stDoneBefore);

  // (f) [待补充] 判定值显式透传（更强行为验证标准，OQ-R4-5 残余）——fail-closed 保持待补充，禁止编造
  const chkPending = await phase.checkPhase({ workspace: wsMissing, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('pending.disclosed', String(chkPending.evidence.strongerBehaviorVerification).includes('[待补充]'));
  c('pending.exportConst', phase.STRONGER_VERIFICATION_STATUS.includes('[待补充]'));

  // (g) 幂等（§6.2）：同 from/to + 已在 to 态 ⇒ no-op 返回既有终态
  const idem = await phase.transitionPhase({ workspace: wsDone, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('idempotent.noop', idem.ok === true && idem.data.idempotent === true);
  const fromMismatch = await phase.transitionPhase({ workspace: wsDone, from: 'executing', to: 'done', opts: { now: NOW } });
  c('idempotent.fromMismatch', fromMismatch.ok === false && fromMismatch.code === 'INVALID_TRANSITION');

  return verdict(checks, 'fail-closed-defaults');
}
