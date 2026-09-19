/**
 * p04 — GWT-R7-04 invalid record fails closed（清单 R7-04）。
 * 可机验行为：缺 impact / owner / reason / source / basePlan / baseVersion 任一项 ⇒
 * CHANGE_RECORD_INVALID + 不解锁任何节点 + canonical state 不变（零落盘）；owner 缺失按类
 * 差异化收码（§2.1：CONTRACT/SECURITY ⇒ CHANGE_OWNER_REQUIRED，其余 ⇒ CHANGE_RECORD_INVALID）；
 * 枚举外 impactClass ⇒ CHANGE_RECORD_INVALID；未知操作不发明新码。
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeT, finish, mkWorkspace, EDGES } from './_helper.mjs';

export async function run({ sandbox }) {
  const t = makeT();
  const m = await import(new URL('../../../scripts/lib/change.mjs', import.meta.url).href);
  const ws = mkWorkspace(path.join(sandbox, 'ws'));
  const okInput = {
    basePlan: 'plans/prd.md', baseVersion: 'a'.repeat(64),
    reason: '合法变更 reason', impactClass: 'DOC_ONLY', owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + ws.instrSha],
  };
  const okOpts = {
    workspace: ws.workspace, recordedBy: 'probe', dependencies: EDGES,
    readyBefore: ['R5b'], primaryNodes: ['R5b'],
    now: '2026-09-20T03:00:00.000Z', rand: '000000c4',
  };

  // 基准：合法输入成功（对照组）
  const okRes = await m.recordChange(okInput, okOpts);
  t.ok(okRes.ok === true, '对照组：字段齐全 ⇒ ok:true');

  const snapshotBefore = fs.readdirSync(path.join(ws.workspace, 'contracts', 'discrepancies')).length;

  // 逐项缺失（GWT-R7-04 四要素 + 基线两列）
  const cases = [
    ['缺 basePlan', { ...okInput, basePlan: undefined }],
    ['缺 baseVersion', { ...okInput, baseVersion: undefined }],
    ['缺 reason', { ...okInput, reason: '' }],
    ['缺 impactClass', { ...okInput, impactClass: undefined }],
    ['缺 sourceEvidence（GWT-R7-04 source 不得缺失）', { ...okInput, sourceEvidence: [] }],
    ['sourceEvidence 非数组', { ...okInput, sourceEvidence: 'single-string' }],
    ['impactClass 枚举外', { ...okInput, impactClass: 'AUTO' }],
    ['缺 owner（DOC_ONLY 不需额外审批）', { ...okInput, owner: undefined, impactClass: 'DOC_ONLY' }],
  ];
  for (const [name, input] of cases) {
    const r = await m.recordChange(input, okOpts);
    t.ok(r.ok === false, `${name} ⇒ ok:false（fail-closed，禁止对非法输入 ok:true）`);
    t.eq(r.code, 'CHANGE_RECORD_INVALID', `${name} ⇒ CHANGE_RECORD_INVALID（GWT-R7-04）`);
    t.ok(r.data.stateUnchanged === true, `${name} 不解锁任何节点（stateUnchanged）`);
  }
  // owner 缺失的类差异化收码（§2.1 原文）
  const rOwnerContract = await m.recordChange({ ...okInput, owner: undefined, impactClass: 'CONTRACT' }, okOpts);
  t.eq(rOwnerContract.code, 'CHANGE_OWNER_REQUIRED', '缺 owner + CONTRACT 类 ⇒ CHANGE_OWNER_REQUIRED（§2.1 类差异化）');
  const rOwnerSecurity = await m.recordChange({ ...okInput, owner: undefined, impactClass: 'SECURITY' }, okOpts);
  t.eq(rOwnerSecurity.code, 'CHANGE_OWNER_REQUIRED', '缺 owner + SECURITY 类 ⇒ CHANGE_OWNER_REQUIRED（§2.1）');
  // 缺 receipt 的 CONTRACT（字段齐全但无批准）⇒ CHANGE_OWNER_REQUIRED + 诊断（清单 R7-02）
  const rNoReceipt = await m.recordChange({ ...okInput, impactClass: 'CONTRACT' }, okOpts);
  t.eq(rNoReceipt.code, 'CHANGE_OWNER_REQUIRED', 'CONTRACT 无 receipt ⇒ CHANGE_OWNER_REQUIRED（§5.1）');
  t.ok(String(rNoReceipt.data.reason).includes('approval receipt'), '诊断输出缺失批准原因（§5.1：返回缺失批准的诊断）');
  t.ok(rNoReceipt.data.missingApproval === true, 'data.missingApproval 机器可查');
  // 未知操作不发明新码（三码面）
  const rUnknown = m.run('change.rollback', okInput);
  t.eq(rUnknown.code, 'CHANGE_RECORD_INVALID', '未知操作收口于既有码面（R7 仅 change.record 一个操作名）');
  // 载体 fail-closed：无 workspace / 无 recordedBy / 非法 sessionId
  t.eq((await m.recordChange(okInput, { ...okOpts, workspace: undefined })).code, 'CHANGE_RECORD_INVALID', '无 workspace ⇒ fail-closed');
  t.eq((await m.recordChange(okInput, { ...okOpts, recordedBy: undefined })).code, 'CHANGE_RECORD_INVALID', '无 recordedBy ⇒ fail-closed（§2.2 审计字段）');
  t.eq((await m.recordChange(okInput, { ...okOpts, sessionId: '../evil' })).code, 'CHANGE_RECORD_INVALID', '非法 sessionId（路径穿越）⇒ fail-closed');

  // canonical state 不变：全程未新增记录文件
  const snapshotAfter = fs.readdirSync(path.join(ws.workspace, 'contracts', 'discrepancies')).length;
  t.eq(snapshotAfter, snapshotBefore, '全部 fail-closed 用例零落盘（GWT-R7-04：不解锁任何节点、canonical state 不变）');
  return finish(t, 'p04 GWT-R7-04 fail-closed 与类差异化收码');
}
