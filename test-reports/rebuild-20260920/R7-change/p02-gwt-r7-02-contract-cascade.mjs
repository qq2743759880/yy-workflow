/**
 * p02 — GWT-R7-02 contract-impacting change（清单 R7-02；复现幸存实物 cr-20260917T035212Z-c2026fdf 的失效面）。
 * 可机验行为：CONTRACT 类变更 + 有效 ownerApprovalReceipt ⇒ 受影响契约 + 全部依赖任务退出 READY
 * （G2.2 edge 表传递闭包，精确、无过度失效）；不直接依赖该契约的分支保持 READY；
 * 回退目标 = contract-reverse/Owner review。
 */
import path from 'node:path';
import { makeT, finish, mkWorkspace, buildReceipt, EDGES, GOLDEN_BASE_PLAN, GOLDEN_BASE_VERSION, GOLDEN_REASON } from './_helper.mjs';

export async function run({ sandbox }) {
  const t = makeT();
  const m = await import(new URL('../../../scripts/lib/change.mjs', import.meta.url).href);
  const ws = mkWorkspace(path.join(sandbox, 'ws'));
  const res = await m.recordChange({
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    reason: GOLDEN_REASON, impactClass: 'CONTRACT', owner: 'Owner',
    sourceEvidence: [
      'owner-instruction.md#' + ws.instrSha,
      GOLDEN_BASE_PLAN + '#' + GOLDEN_BASE_VERSION,
    ],
    ownerApprovalReceipt: buildReceipt({
      instrFile: ws.instrFile, instrSha: ws.instrSha,
      basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
      impactClass: 'CONTRACT', approvedAt: '2026-09-17T03:52:11.000Z',
    }),
  }, {
    workspace: ws.workspace, recordedBy: 'probe', dependencies: EDGES,
    readyBefore: ['R5b', 'R8'], primaryNodes: ['R5b'],
    now: '2026-09-17T03:52:12.000Z', rand: '000000c2',
  });
  t.ok(res.ok === true, 'CONTRACT + 有效 receipt ⇒ ok:true（清单 R7-02）');
  t.eq(res.data.invalidatedNodes, ['R5b', 'R9', 'R6'], '失效面 = R5b + 传递下游 R9/R6（G2.2 edge 表 rows 13/17/20；与实物 REPORT.md §1 逐字一致）');
  t.ok(!res.data.invalidatedNodes.includes('R8'), '无过度失效：不直接依赖该契约的 R8 分支未被失效（清单 R7-02 defect 面）');
  t.eq(res.evidence.readyRecomputed.exited, ['R5b'], 'READY exited = [R5b]（实物 REPORT.md §1 一致）');
  t.eq(res.evidence.readyRecomputed.after, ['R8'], 'READY after = [R8]（不相关分支保持 READY；非全量回退）');
  t.eq(res.data.approvalId, 'apr-20260917T035212Z-5ecf4e46', 'approvalId 记入审计（§5.2：receipt 引用字段）');
  t.eq(m.REWIND_TARGETS.CONTRACT, 'contract-reverse/owner-review', 'CONTRACT 回退目标 = contract-reverse/Owner review（§4.1）');
  t.ok(res.warnings.every((w) => !w.includes('最严类规则')), '声明类与判据一致时无升级 warning');
  return finish(t, 'p02 GWT-R7-02 CONTRACT 级联精确失效');
}
