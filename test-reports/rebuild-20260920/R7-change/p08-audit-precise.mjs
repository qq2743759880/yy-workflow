/**
 * p08 — audit-precise：审计面与精确失效（清单 R7-08）。
 * 可机验行为：(a) 记录生效后 invalidatedNodes 清单可查（本体 + 索引 + listChangeRecords 读侧），
 * 且与依赖图闭包一致（仅受影响节点 + 传递下游）；未受影响节点 READY 不变（§6.1）；
 * evidence 恒含四键 {invalidatedNodes, readyRecomputed, snapshotEcho, recordedAt}（§7.1）；
 * (b) 受影响节点清单为空 ⇒ 拒绝（§5.3 原子性：记录与节点清单必须同时写入）；
 * (c) 变更影响某节点的上游依赖 ⇒ 下游节点同步退出 READY（§3.2 级联规则）。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { makeT, finish, mkWorkspace, buildReceipt, EDGES, GOLDEN_BASE_PLAN, GOLDEN_BASE_VERSION, GOLDEN_REASON } from './_helper.mjs';

export async function run({ sandbox }) {
  const t = makeT();
  const m = await import(new URL('../../../scripts/lib/change.mjs', import.meta.url).href);
  const ws = mkWorkspace(path.join(sandbox, 'ws'));

  // (a) 审计面：记录与清单可查、闭包一致、未受影响 READY 不变
  const res = await m.recordChange({
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    reason: GOLDEN_REASON, impactClass: 'CONTRACT', owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + ws.instrSha],
    ownerApprovalReceipt: buildReceipt({
      instrFile: ws.instrFile, instrSha: ws.instrSha,
      basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
      impactClass: 'CONTRACT', approvedAt: '2026-09-17T03:52:11.000Z',
    }),
  }, {
    workspace: ws.workspace, recordedBy: 'probe', dependencies: EDGES,
    readyBefore: ['R5b', 'R8'], primaryNodes: ['R5b'],
    now: '2026-09-17T03:52:12.000Z', rand: '000000c9',
  });
  t.ok(res.ok === true, 'CONTRACT + receipt 创建成功');
  const evKeys = Object.keys(res.evidence).sort().join(',');
  t.eq(evKeys, 'invalidatedNodes,readyRecomputed,recordedAt,snapshotEcho', 'evidence 恒含四键（§7.1 [草案]：invalidatedNodes/readyRecomputed/snapshotEcho/recordedAt）');
  const bodyFile = path.join(ws.workspace, 'contracts', 'discrepancies', res.data.changeRecordId + '.json');
  const body = JSON.parse(fs.readFileSync(bodyFile, 'utf8'));
  t.eq(body.invalidatedNodes, ['R5b', 'R9', 'R6'], '记录本体 invalidatedNodes 与依赖图闭包一致（R7-08a：仅受影响节点 + 传递下游）');
  t.eq(res.evidence.snapshotEcho.length, 64, 'snapshotEcho = 记录本体字节 sha256（64hex，可复验）');
  t.eq(res.evidence.snapshotEcho, crypto.createHash('sha256').update(fs.readFileSync(bodyFile)).digest('hex'), 'snapshotEcho = 记录本体字节 sha256（可复验）');
  const indexLines = fs.readFileSync(path.join(ws.workspace, 'plans', 'active', 'changes', 'index.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  t.eq(indexLines.length, 1, '索引一行（追加式）');
  t.eq(indexLines[0].invalidatedNodes, ['R5b', 'R9', 'R6'], '索引行含失效清单（清单可查）');
  const listed = m.listChangeRecords(ws.workspace);
  t.ok(listed.ok === true && listed.data.count === 1, 'listChangeRecords 读侧可查（R8/R9/R10 消费面）');
  t.eq(listed.data.records[0].invalidatedNodes, ['R5b', 'R9', 'R6'], '读侧记录失效清单一致');
  t.eq(res.evidence.readyRecomputed.after, ['R8'], '未受影响节点（R8）READY 不变（§6.1，非全量回退）');

  // (b) 失效清单为空 ⇒ 拒绝（§5.3 原子性）
  const ws2 = mkWorkspace(path.join(sandbox, 'ws-empty'));
  const empty = await m.recordChange({
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    reason: '无 primary 的变更（清单无法唯一计算）', impactClass: 'CONTRACT', owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + ws2.instrSha],
  }, {
    workspace: ws2.workspace, recordedBy: 'probe', dependencies: EDGES,
    readyBefore: ['R5b'], primaryNodes: [],
    now: '2026-09-17T04:00:00.000Z', rand: '000000ca',
  });
  t.ok(empty.ok === false && empty.code === 'CHANGE_SCOPE_UNCLEAR', 'invalidatedNodes 为空 ⇒ CHANGE_SCOPE_UNCLEAR（§2.3/清单 R7-08b 拒绝）');
  t.ok(!fs.existsSync(path.join(ws2.workspace, 'contracts', 'discrepancies')), '拒绝 ⇒ 无"记录已写但节点清单缺失"中间态（§5.3）');

  // (c) 上游变更 ⇒ 下游级联退出 READY（§3.2.2）
  const ws3 = mkWorkspace(path.join(sandbox, 'ws-upstream'));
  const upstream = await m.recordChange({
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    reason: '上游 R4 产物口径变更，级联下游（§3.2.2）', impactClass: 'TASK_GRAPH', owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + ws3.instrSha],
  }, {
    workspace: ws3.workspace, recordedBy: 'probe', dependencies: EDGES,
    readyBefore: ['R4', 'R5a', 'R5b', 'R8'], primaryNodes: ['R4'],
    now: '2026-09-17T05:00:00.000Z', rand: '000000cb',
  });
  t.ok(upstream.ok === true, '上游变更创建成功');
  for (const downstreamNode of ['R5a', 'R5b', 'R7', 'R8', 'R9', 'R6', 'R10']) {
    t.ok(upstream.data.invalidatedNodes.includes(downstreamNode), `下游 ${downstreamNode} 同步退出 READY（§3.2.2 级联）`);
  }
  t.ok(!upstream.data.invalidatedNodes.includes('G2.2') && !upstream.data.invalidatedNodes.includes('R1'), '上游（G2.2/R1）不被反向失效（失效只向下游传播）');
  return finish(t, 'p08 audit-precise 审计面与精确级联');
}
