/**
 * p10 — taskgraph-boundary：TASK_GRAPH vs CONTRACT 边界机检（OQ-R7-4=A；清单 R7-02 defect 面）。
 * 可机验行为：仅触及 G2.2 图/PRD0/任务文档 ⇒ TASK_GRAPH 维持（不需 receipt）；
 * 触及冻结契约规范性内容而声明 TASK_GRAPH ⇒ 从严升级 CONTRACT（最严类规则；此时无 receipt ⇒
 * CHANGE_OWNER_REQUIRED，有 :CONTRACT receipt ⇒ 通过且记录类为 CONTRACT）；
 * 同时触及契约+图文档 ⇒ 从严归 CONTRACT；低类（DOC_ONLY）触及冻结契约同样升级（fail-closed 方向）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeT, finish, mkWorkspace, buildReceipt, EDGES, GOLDEN_BASE_PLAN, GOLDEN_BASE_VERSION } from './_helper.mjs';

export async function run({ sandbox }) {
  const t = makeT();
  const m = await import(new URL('../../../scripts/lib/change.mjs', import.meta.url).href);
  const mk = (name) => mkWorkspace(path.join(sandbox, name));
  const baseInput = (reason, touchedFiles) => ({
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    reason, impactClass: 'TASK_GRAPH', owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + 'f'.repeat(64)],
    touchedFiles,
  });
  const opts = (ws, rand) => ({
    workspace: ws.workspace, recordedBy: 'probe', dependencies: EDGES,
    readyBefore: ['R5b'], primaryNodes: ['R5b'], rand,
    now: '2026-09-17T07:00:00.000Z',
  });
  const G22 = 'plans/tasks/G2.2-task-graph-20260911.md';
  const contract = 'contracts/C-R5-ui.md';

  // (a) 仅图/文档面 ⇒ TASK_GRAPH 维持，不需 receipt
  const wsA = mk('ws-graph-only');
  const a = await m.recordChange(baseInput('仅调整 G2.2 任务图 R9 前置（无契约面触碰）', [G22, 'docs/tasks/yy-skill-loading-v3/R9-tasks.md']), opts(wsA, '000000d1'));
  t.ok(a.ok === true && a.data.impactClass === 'TASK_GRAPH', '仅 G2.2/任务文档 ⇒ TASK_GRAPH 维持（OQ-R7-4=A）');
  t.ok(!a.warnings.some((w) => w.includes('最严类规则')), '无升级 warning');
  t.eq(a.data.approvalId, null, 'TASK_GRAPH 不需 receipt（OQ-R7-2=A）');

  // (b) 声明 TASK_GRAPH 但触及冻结契约 ⇒ 升级 CONTRACT；无 receipt ⇒ CHANGE_OWNER_REQUIRED
  const wsB = mk('ws-escalate-no-receipt');
  const b = await m.recordChange(baseInput('触及 C-R5-ui 规范内容但误声明 TASK_GRAPH', [contract, G22]), opts(wsB, '000000d2'));
  t.ok(b.ok === false && b.code === 'CHANGE_OWNER_REQUIRED', '误声明 TASK_GRAPH + 触及冻结契约 ⇒ 升级 CONTRACT 后无 receipt ⇒ CHANGE_OWNER_REQUIRED（清单 R7-02 defect 面：不得放行误归类）');
  t.ok(!fs.existsSync(path.join(wsB.workspace, 'contracts', 'discrepancies')), '升级拦截零落盘');

  // (c) 同场景 + 有效 :CONTRACT receipt ⇒ 通过且记录 impactClass = CONTRACT（从严）
  const wsC = mk('ws-escalate-with-receipt');
  const c = await m.recordChange({
    ...baseInput('同时触及契约与图文档：从严归 CONTRACT（OQ-R7-4=A）', [contract, G22]),
    ownerApprovalReceipt: buildReceipt({
      instrFile: wsC.instrFile, instrSha: wsC.instrSha,
      basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
      impactClass: 'CONTRACT', approvedAt: '2026-09-17T06:59:00.000Z',
    }),
  }, opts(wsC, '000000d3'));
  t.ok(c.ok === true, '升级后 + 有效 :CONTRACT receipt ⇒ ok:true');
  t.eq(c.data.impactClass, 'CONTRACT', '记录 impactClass = CONTRACT（同时触及 ⇒ 从严归 CONTRACT）');
  t.ok(c.warnings.some((w) => w.includes('OQ-R7-4=A') && w.includes('CONTRACT')), '升级 warning 显式登记（非静默改判）');

  // (d) 低类 DOC_ONLY 触及冻结契约 ⇒ 同样从严升级（fail-closed 方向，登记重建判定）
  const wsD = mk('ws-doconly-escalate');
  const d = await m.recordChange({
    ...baseInput('声明 DOC_ONLY 但触及契约错误码表', [contract]),
    impactClass: 'DOC_ONLY',
  }, opts(wsD, '000000d4'));
  t.ok(d.ok === false && d.code === 'CHANGE_OWNER_REQUIRED', 'DOC_ONLY 触及冻结契约 ⇒ 升级 CONTRACT ⇒ 无 receipt 拒绝（低类不得借道绕过 receipt gate）');

  // (e) drafts/ 与 discrepancies/ 不算冻结契约面（drafts 永不解锁任务；change records 是证据层）
  const wsE = mk('ws-drafts-exempt');
  const e = await m.recordChange(baseInput('仅修订契约草案与变更记录', ['contracts/drafts/C-R5-ui.draft.md', 'contracts/discrepancies/cr-20260917T035212Z-c2026fdf.json']), opts(wsE, '000000d5'));
  t.ok(e.ok === true && e.data.impactClass === 'TASK_GRAPH', 'drafts/ 与 discrepancies/ 不计冻结契约面（不触发升级）');
  return finish(t, 'p10 taskgraph-boundary 最严类机检');
}
