/**
 * p07 — receipt 逐项校验（清单 R7-06；消费 [R4冻结] §5.2 schema，不重定义、不放宽）。
 * 可机验行为：缺 receipt / 缺 schema 字段（含幸存实物首次运行失败的缺 reason 形态）/
 * approvedBy 非 owner / 审批时点倒挂（approvedAt 晚于记录时点）/ expiresAt 非 null /
 * scopeId 绑定不符（跨 plan/跨类）/ approvalEvidence 哈希与文件字节不一致 /
 * 同 receipt 二次消费（跨变更复用）——全部 ⇒ CHANGE_OWNER_REQUIRED + 零落盘。
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeT, finish, mkWorkspace, buildReceipt, EDGES, GOLDEN_BASE_PLAN, GOLDEN_BASE_VERSION, GOLDEN_REASON } from './_helper.mjs';

export async function run({ sandbox }) {
  const t = makeT();
  const m = await import(new URL('../../../scripts/lib/change.mjs', import.meta.url).href);
  const ws = mkWorkspace(path.join(sandbox, 'ws'));
  const discrepanciesCount = () => fs.existsSync(path.join(ws.workspace, 'contracts', 'discrepancies'))
    ? fs.readdirSync(path.join(ws.workspace, 'contracts', 'discrepancies')).length : 0;
  const input = {
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    reason: GOLDEN_REASON, impactClass: 'CONTRACT', owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + ws.instrSha],
  };
  const opts = {
    workspace: ws.workspace, recordedBy: 'probe', dependencies: EDGES,
    readyBefore: ['R5b'], primaryNodes: ['R5b'],
    now: '2026-09-17T03:52:12.000Z', rand: '000000c8',
  };
  const receipt = (overrides = {}) => buildReceipt({
    instrFile: ws.instrFile, instrSha: ws.instrSha,
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    impactClass: 'CONTRACT', approvedAt: '2026-09-17T03:52:11.000Z', overrides,
  });

  // 无效形态逐项（全部 ok:false + CHANGE_OWNER_REQUIRED + 零副作用）
  const cases = [
    ['缺 receipt（undefined）', input, null],
    ['receipt 缺 reason 字段（实物首次运行失败形态）', input, receipt({ reason: undefined })],
    ['receipt 缺 approvalEvidence', input, receipt({ approvalEvidence: undefined })],
    ['approvedBy 非 owner', input, receipt({ approvedBy: 'agent-x' })],
    ['审批时点倒挂（approvedAt 晚于记录时点）', input, receipt({ approvedAt: '2026-09-17T03:52:13.000Z' })],
    ['expiresAt 非 null（绑定语义破坏）', input, receipt({ expiresAt: '2026-12-31T00:00:00.000Z' })],
    ['scopeId 绑定不符（跨 plan）', input, receipt({ target: { scope: 'change', scopeId: 'contracts/other.md@' + GOLDEN_BASE_VERSION + ':CONTRACT' } })],
    ['scopeId 绑定不符（跨类 :TASK_GRAPH）', input, receipt({ target: { scope: 'change', scopeId: GOLDEN_BASE_PLAN + '@' + GOLDEN_BASE_VERSION + ':TASK_GRAPH' } })],
    ['approvalEvidence 哈希与文件字节不一致', input, receipt({ approvalEvidence: ws.instrFile + '#' + 'e'.repeat(64) })],
    ['approvalEvidence 缺 SHA256', input, receipt({ approvalEvidence: ws.instrFile })],
    ['relatedReceipts 非数组', input, receipt({ relatedReceipts: 'n/a' })],
  ];
  for (const [name, inp, rcpt] of cases) {
    const r = await m.recordChange({ ...inp, ownerApprovalReceipt: rcpt }, opts);
    t.ok(r.ok === false && r.code === 'CHANGE_OWNER_REQUIRED', `${name} ⇒ CHANGE_OWNER_REQUIRED（fail-closed）`);
    t.ok(String(r.data.reason).length > 0, `${name} 输出缺失批准的诊断（§5.1）`);
    t.eq(r.data.stateUnchanged, true, `${name} 不解锁任何节点`);
  }
  t.eq(discrepanciesCount(), 0, '全部无效 receipt 用例零落盘（无 receipt 静默推进即 defect）');

  // 有效 receipt ⇒ 成功；同 receipt 用于另一条不同变更（不同 reason ⇒ 不同幂等键）⇒ 二次消费拒绝
  const first = await m.recordChange({ ...input, ownerApprovalReceipt: receipt() }, opts);
  t.ok(first.ok === true, '有效 receipt ⇒ 创建成功（对照组）');
  const countAfterFirst = discrepanciesCount();
  t.eq(countAfterFirst, 1, '成功创建恰好 1 条记录');
  const second = await m.recordChange({
    ...input, reason: GOLDEN_REASON + '（v2 另一条不同变更）',
    ownerApprovalReceipt: receipt(),
  }, opts);
  t.ok(second.ok === false && second.code === 'CHANGE_OWNER_REQUIRED', '同 receipt 跨变更二次消费 ⇒ CHANGE_OWNER_REQUIRED（[R4冻结] §5.2 绑定语义；登记 .approvals-registry.json）');
  t.ok(String(second.data.reason).includes('已被'), '诊断指明 receipt 已被消费');
  t.eq(discrepanciesCount(), countAfterFirst, '拒绝后无新增记录');
  return finish(t, 'p07 receipt 逐项校验与二次消费拒绝');
}
