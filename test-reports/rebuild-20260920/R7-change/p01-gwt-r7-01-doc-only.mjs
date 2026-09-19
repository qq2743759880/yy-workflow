/**
 * p01 — GWT-R7-01 document-only change（清单 R7-01）。
 * 可机验行为：DOC_ONLY 只失效受影响的 PRD/设计/任务草案本体（invalidatedNodes 仅文档层节点，
 * 不含下游代码/契约节点）；已完成代码与冻结契约保持有效（下游任务/无关节点 READY 不变）；
 * 不发生全量回退；记录落盘布局正确（OQ-R7-1=A）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeT, finish, mkWorkspace } from './_helper.mjs';

export async function run({ sandbox }) {
  const t = makeT();
  const m = await import(new URL('../../../scripts/lib/change.mjs', import.meta.url).href);
  const ws0 = mkWorkspace(path.join(sandbox, 'ws'));
  // 依赖图：D（文档草案）→ T（代码任务）→ T2；X 为无关分支
  const edges = [
    { from: 'D', to: 'T' }, { from: 'T', to: 'T2' }, { from: 'U', to: 'X' },
  ];
  const res = await m.recordChange({
    basePlan: 'plans/prd-doc.md', baseVersion: 'a'.repeat(64),
    reason: '仅修订 PRD 验收细节措辞（GWT-R7-01）',
    impactClass: 'DOC_ONLY', owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + ws0.instrSha],
  }, {
    workspace: ws0.workspace, recordedBy: 'probe', dependencies: edges,
    readyBefore: ['D', 'T', 'T2', 'X'], primaryNodes: ['D'],
    now: '2026-09-20T01:00:00.000Z', rand: '000000d1',
  });
  t.ok(res.ok === true, 'DOC_ONLY 合法提交 ok:true');
  t.eq(res.data.invalidatedNodes, ['D'], 'invalidatedNodes 仅含文档层节点 D（下游 T/T2 不级联——GWT-R7-01 已完成代码保持有效）');
  t.eq(res.evidence.readyRecomputed.after, ['T', 'T2', 'X'], '下游与无关节点 READY 不变（非全量回退）');
  t.eq(res.evidence.readyRecomputed.exited, ['D'], 'exited 仅 D');
  t.ok(res.evidence.invalidatedNodes.length > 0, 'invalidatedNodes 非空（无静默失效）');
  t.ok(fs.existsSync(path.join(ws0.workspace, 'contracts', 'discrepancies', res.data.changeRecordId + '.json')), '记录本体落 contracts/discrepancies/<id>.json（OQ-R7-1=A）');
  t.ok(fs.existsSync(path.join(ws0.workspace, 'plans', 'active', 'changes', 'index.jsonl')), '索引落 plans/active/changes/index.jsonl（OQ-R7-1=A）');
  t.eq(res.data.status, 'active', 'status=active');
  t.eq(res.data.newVersionRef, null, 'DOC_ONLY newVersionRef=null（仅 IMPLEMENTATION 必需）');
  t.eq(res.data.supersededBy, null, 'supersededBy 初始 null');
  // 冻结契约面无写入：contracts/ 下仅有 discrepancies/（证据层），无契约文件被创建/改动
  const contractsDir = path.join(ws0.workspace, 'contracts');
  const contractsEntries = fs.readdirSync(contractsDir);
  t.eq(contractsEntries, ['discrepancies'], 'contracts/ 下仅新增 discrepancies/ 证据层（冻结契约面零触碰）');
  return finish(t, 'p01 GWT-R7-01 DOC_ONLY 精确失效');
}
