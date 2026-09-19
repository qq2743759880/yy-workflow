/**
 * p06 — approval-sec：SECURITY 类失效规则与审批（清单 R7-06e；OQ-R7-5=A）。
 * 可机验行为：SECURITY 无 receipt ⇒ CHANGE_OWNER_REQUIRED（不静默推进）；有效 receipt ⇒
 * 创建成功且失效集 = CONTRACT 级联全部规则 ∪ 全部安全相关 gate（securityNodes 扩展）；
 * SECURITY 触发"安全相关验收强制重跑"显式 warning；CONTRACT receipt 跨类复用于 SECURITY ⇒ 拒绝
 * （scopeId 绑定 :impactClass，验收报告 "scopeId carries :impactClass, cross-class reuse rejected"）；
 * TASK_GRAPH 不强制 receipt（过度要求即 defect，OQ-R7-2=A）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeT, finish, mkWorkspace, buildReceipt, EDGES, GOLDEN_BASE_PLAN, GOLDEN_BASE_VERSION } from './_helper.mjs';

export async function run({ sandbox }) {
  const t = makeT();
  const m = await import(new URL('../../../scripts/lib/change.mjs', import.meta.url).href);
  const discrepanciesExists = (wsRoot) => fs.existsSync(path.join(wsRoot, 'contracts', 'discrepancies'));
  const ws = mkWorkspace(path.join(sandbox, 'ws'));
  const input = {
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    reason: '安全相关行为变更：桥接数据注入通道改为校验签名（OQ-R7-5=A）',
    impactClass: 'SECURITY', owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + ws.instrSha],
  };
  const opts = {
    workspace: ws.workspace, recordedBy: 'probe', dependencies: EDGES,
    readyBefore: ['R5b'], primaryNodes: ['R5b'],
    securityNodes: ['SEC-GATE-A', 'SEC-GATE-B'],
    now: '2026-09-20T05:00:00.000Z', rand: '000000c6',
  };

  // (a) 无 receipt ⇒ CHANGE_OWNER_REQUIRED（fail-closed，不静默推进）
  const noReceipt = await m.recordChange(input, opts);
  t.ok(noReceipt.ok === false && noReceipt.code === 'CHANGE_OWNER_REQUIRED', 'SECURITY 无 receipt ⇒ CHANGE_OWNER_REQUIRED（清单 R7-06e defect 面）');
  t.ok(!discrepanciesExists(ws.workspace), '无 receipt 零落盘（fail-closed）');

  // (b) 有效 :SECURITY receipt ⇒ 成功；失效集 = CONTRACT 级联 ∪ securityNodes
  const receiptSec = buildReceipt({
    instrFile: ws.instrFile, instrSha: ws.instrSha,
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    impactClass: 'SECURITY', approvedAt: '2026-09-20T04:59:00.000Z',
  });
  const ok = await m.recordChange({ ...input, ownerApprovalReceipt: receiptSec }, opts);
  t.ok(ok.ok === true, 'SECURITY + 有效 receipt ⇒ ok:true（OQ-R7-5=A）');
  t.eq(ok.data.invalidatedNodes, ['R5b', 'R9', 'R6', 'SEC-GATE-A', 'SEC-GATE-B'], '失效集 = CONTRACT 级联(R5b/R9/R6) ∪ 全部安全相关 gate（OQ-R7-5=A 扩展）');
  t.ok(ok.warnings.some((w) => w.includes('SECURITY') && w.includes('强制重跑')), '安全相关验收强制重跑 warning 显式（清单 R7-06e：漏强制重跑即 defect）');
  t.eq(m.REWIND_TARGETS.SECURITY, 'security-gate+contract-reverse', 'SECURITY 回退目标 = 安全 gate + contract-reverse（§4.1）');

  // (c) 跨类复用：CONTRACT receipt（scopeId 绑 :CONTRACT）用于 SECURITY 变更 ⇒ 拒绝
  const receiptContract = buildReceipt({
    instrFile: ws.instrFile, instrSha: ws.instrSha,
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    impactClass: 'CONTRACT', approvedAt: '2026-09-20T04:59:00.000Z',
    overrides: { approvalId: 'apr-20260920T045900Z-aaaa0001' },
  });
  const ws2 = mkWorkspace(path.join(sandbox, 'ws-cross'));
  const cross = await m.recordChange({ ...input, ownerApprovalReceipt: receiptContract }, { ...opts, workspace: ws2.workspace });
  t.ok(cross.ok === false && cross.code === 'CHANGE_OWNER_REQUIRED', 'CONTRACT receipt 跨类复用于 SECURITY ⇒ CHANGE_OWNER_REQUIRED（scopeId carries :impactClass；清单 R7-06b）');
  t.ok(String(cross.data.reason).includes('scopeId'), '诊断指明 scopeId 绑定不符');
  t.ok(!discrepanciesExists(ws2.workspace), '跨类复用零落盘');

  // (d) TASK_GRAPH 不强制 receipt（过度要求 receipt 即 defect，清单 R7-06e；OQ-R7-2=A）
  const ws3 = mkWorkspace(path.join(sandbox, 'ws-tg'));
  const tg = await m.recordChange({
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    reason: '任务图结构调整：R9 前置条件收窄（OQ-R7-4=A 仅图面）',
    impactClass: 'TASK_GRAPH', owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + ws.instrSha],
  }, { ...opts, workspace: ws3.workspace, primaryNodes: ['R9'], securityNodes: [], rand: '000000c7' });
  t.ok(tg.ok === true && tg.data.impactClass === 'TASK_GRAPH', 'TASK_GRAPH 仅 owner 字段命名、不需 receipt（OQ-R7-2=A）');
  t.eq(tg.data.approvalId, null, '无 receipt ⇒ approvalId=null');
  return finish(t, 'p06 approval-sec SECURITY 失效扩展与 receipt 消费');
}
