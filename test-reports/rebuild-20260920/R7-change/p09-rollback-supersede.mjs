/**
 * p09 — rollback-supersede：回滚链纪律（清单 R7-07c/d；§6.3 supersede-not-delete；OQ-R4-6=A）。
 * 可机验行为：(1) 回滚 = 新增回滚 change record（supersedes 指针，审计链不断）+ 原记录 status→
 * superseded + supersededBy 指针回填；(2) 旧记录/旧证据永不删除（本体文件仍在、字节证据保留）；
 * (3) READY 重算恢复（不被其他 active 记录覆盖时）；(4) 同键回滚重放幂等（不重复创建）；
 * (5) rollback 台账登记 ⇒ rollback 前签发的 approval 对 rollback 后的变更一律失效（OQ-R4-6=A）；
 * (6) 回滚不把真实执行改写为成功（原记录保留 superseded 状态进入审计链）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeT, finish, mkWorkspace, buildReceipt, EDGES, GOLDEN_BASE_PLAN, GOLDEN_BASE_VERSION, GOLDEN_REASON } from './_helper.mjs';

export async function run({ sandbox }) {
  const t = makeT();
  const m = await import(new URL('../../../scripts/lib/change.mjs', import.meta.url).href);
  const ws = mkWorkspace(path.join(sandbox, 'ws'));
  let receiptSeq = 0;
  const mkReceipt = (approvedAt, freshId = false) => buildReceipt({
    instrFile: ws.instrFile, instrSha: ws.instrSha,
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    impactClass: 'CONTRACT', approvedAt,
    ...(freshId ? { overrides: { approvalId: `apr-20260917T0352${String(10 + receiptSeq).padStart(2, '0')}Z-aaaa${String(receiptSeq++).padStart(4, '0')}` } } : {}),
  });
  const mkInput = (reason, approvedAt, freshId = false) => ({
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    reason, impactClass: 'CONTRACT', owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + ws.instrSha],
    ownerApprovalReceipt: mkReceipt(approvedAt, freshId),
  });
  const mkOpts = (now, rand) => ({
    workspace: ws.workspace, recordedBy: 'probe', dependencies: EDGES,
    readyBefore: ['R5b'], primaryNodes: ['R5b'], now, rand,
  });

  // 建立生效变更 CR1
  const cr1 = await m.recordChange(mkInput(GOLDEN_REASON, '2026-09-17T03:52:11.000Z'), mkOpts('2026-09-17T03:52:12.000Z', '000000cc'));
  t.ok(cr1.ok === true, 'CR1 创建成功');
  const cr1File = path.join(ws.workspace, 'contracts', 'discrepancies', cr1.data.changeRecordId + '.json');
  const cr1BytesBefore = fs.readFileSync(cr1File, 'utf8');

  // (1)(2) 回滚：新回滚记录 + 指针回填 + 旧证据保留
  const rb = await m.supersedeChangeRecord({
    targetChangeRecordId: cr1.data.changeRecordId,
    reason: 'Owner 回滚指示：桥接方案裁决撤回，恢复前一计划版本',
    owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + ws.instrSha],
    restoreVersionRef: GOLDEN_BASE_PLAN + '@' + GOLDEN_BASE_VERSION,
  }, { workspace: ws.workspace, recordedBy: 'probe', readyBefore: ['R5b'], dependencies: EDGES, now: '2026-09-17T06:00:00.000Z', rand: '000000cd' });
  t.ok(rb.ok === true, '回滚 ok:true（§6.3）');
  const rbId = rb.data.rollbackRecord.changeRecordId;
  t.ok(m.CHANGE_ID_RE.test(rbId), '回滚记录也是合法 change record（cr- 形）');
  t.eq(rb.data.rollbackRecord.supersedes, cr1.data.changeRecordId, '回滚记录携带 supersedes 指针（审计链不断）');
  t.eq(rb.data.target.status, 'superseded', '原记录 status → superseded（supersede-not-delete）');
  t.eq(rb.data.target.supersededBy, rbId, 'supersededBy 指针回填指向回滚记录（§6.3 步骤 1）');
  t.ok(fs.existsSync(cr1File), '旧记录本体文件永不删除（清单 R7-07c defect 面）');
  const cr1After = JSON.parse(fs.readFileSync(cr1File, 'utf8'));
  t.eq(cr1After.reason, cr1.data.reason, '旧记录证据字段未被改写（只回填指针三字段）');
  t.eq(cr1After.invalidatedNodes, ['R5b', 'R9', 'R6'], '旧记录失效清单保留（审计链不断）');
  t.ok(fs.existsSync(path.join(ws.workspace, 'plans', 'active', 'changes', 'rollbacks.json')), 'rollback 台账登记（OQ-R4-6=A 失效条款判定输入）');

  // (3) READY 恢复：CR1 已 superseded，R5b 不再被 active 记录覆盖 ⇒ 恢复
  t.eq(rb.evidence.readyRecomputed.after, ['R5b'], 'READY 重算恢复 R5b（§6.3 步骤 4：重跑受影响节点）');

  // (4) 同键回滚重放 ⇒ 幂等
  const rbFilesBefore = fs.readdirSync(path.join(ws.workspace, 'contracts', 'discrepancies')).length;
  const rb2 = await m.supersedeChangeRecord({
    targetChangeRecordId: cr1.data.changeRecordId,
    reason: 'Owner 回滚指示：桥接方案裁决撤回，恢复前一计划版本',
    owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + ws.instrSha],
  }, { workspace: ws.workspace, recordedBy: 'probe', readyBefore: ['R5b'], dependencies: EDGES, now: '2026-09-17T07:00:00.000Z', rand: '000000ce' });
  t.ok(rb2.ok === true && rb2.data.duplicate === true, '同键回滚重放 ok:true + duplicate（幂等）');
  t.eq(rb2.data.rollbackRecord.changeRecordId, rbId, '幂等返回既有回滚记录 id');
  t.eq(fs.readdirSync(path.join(ws.workspace, 'contracts', 'discrepancies')).length, rbFilesBefore, '重放不创建新记录');

  // (5) rollback 失效条款：rollback 前签发的 approval 对 rollback 后的变更一律失效
  //（fresh receipt：排除 .approvals-registry 二次消费判定的干扰，单独锁定 rollback 条款）
  const postRb = await m.recordChange(
    mkInput('CR1 之后的新变更（复用 rollback 前签发的 receipt）', '2026-09-17T03:52:11.000Z', true),
    mkOpts('2026-09-17T08:00:00.000Z', '000000cf'),
  );
  t.ok(postRb.ok === false && postRb.code === 'CHANGE_OWNER_REQUIRED', 'rollback 前签发的 approval 对 rollback 后变更 ⇒ CHANGE_OWNER_REQUIRED（OQ-R4-6=A；清单 R7-06d）');
  t.ok(String(postRb.data.reason).includes('rollback'), '诊断指明 rollback 失效条款');

  // (6) 有效的"rollback 后新签发"receipt ⇒ 新变更可创建（回滚不锁死后续流程）
  const postOk = await m.recordChange(
    mkInput('rollback 之后重新签发批准的新变更', '2026-09-17T08:59:00.000Z', true),
    mkOpts('2026-09-17T09:00:00.000Z', '000000d0'),
  );
  t.ok(postOk.ok === true, 'rollback 后重新签发的 receipt 放行（须重新签发，非永久锁死）');
  t.eq(JSON.parse(fs.readFileSync(cr1File, 'utf8')).status, 'superseded', '回滚不把真实历史改写为成功（CR1 保持 superseded 入审计链）');
  t.ok(!cr1BytesBefore.includes('"superseded"') && cr1BytesBefore.includes('"status": "active"'), '回滚前 CR1 原文为 active（指针回填前字节留证于本断言语义）');
  return finish(t, 'p09 rollback-supersede 回滚链与失效条款');
}
