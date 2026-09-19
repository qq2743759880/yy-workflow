/**
 * p05 — GWT-R7-05 idempotent replay（清单 R7-05）。
 * 可机验行为：同幂等键（canonical sha256({basePlan,baseVersion,reason,impactClass,owner})，
 * 键序固定 OQ-R7-6=A）重复提交 ⇒ ok:true 返回既有 changeRecordId + DUPLICATE_REPLAY warning
 * （不新增错误码）、不写新记录、不产生额外失效事件、READY 重算结果一致；
 * 同键不同 sourceEvidence ⇒ CHANGE_SCOPE_UNCLEAR（不放行也不重放，§2.3）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeT, finish, mkWorkspace, EDGES, canonicalKeyOf } from './_helper.mjs';

export async function run({ sandbox }) {
  const t = makeT();
  const m = await import(new URL('../../../scripts/lib/change.mjs', import.meta.url).href);
  const ws = mkWorkspace(path.join(sandbox, 'ws'));
  const input = {
    basePlan: 'plans/prd.md', baseVersion: 'a'.repeat(64),
    reason: '幂等重放探针 reason', impactClass: 'TASK_GRAPH', owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + ws.instrSha, 'ambient note'],
  };
  const opts = (over = {}) => ({
    workspace: ws.workspace, recordedBy: 'probe', dependencies: EDGES,
    readyBefore: ['R5b', 'R9'], primaryNodes: ['R5b'],
    ...over,
  });

  // 幂等键 canonical 口径直接断言（键序固定 = 契约书写字面序）
  t.eq(m.canonicalIdempotencyKey(input), canonicalKeyOf(input.basePlan, input.baseVersion, input.reason, input.impactClass, input.owner), 'canonicalIdempotencyKey = sha256(固定键序 JSON)（OQ-R7-6=A）');

  const first = await m.recordChange(input, opts({ now: '2026-09-20T04:00:00.000Z', rand: '000000c5' }));
  t.ok(first.ok === true && first.data.duplicate === undefined, '首次提交正常创建');
  const filesBefore = fs.readdirSync(path.join(ws.workspace, 'contracts', 'discrepancies'));
  const indexBefore = fs.readFileSync(path.join(ws.workspace, 'plans', 'active', 'changes', 'index.jsonl'), 'utf8').trim().split('\n');

  // 重放（时间/随机数都不同 ⇒ 若非幂等将产生新记录）
  const second = await m.recordChange(input, opts({ now: '2026-09-20T05:00:00.000Z', rand: 'ffffffff' }));
  t.ok(second.ok === true, '重复提交 ok:true（幂等，GWT-R7-05；不报错）');
  t.eq(second.data.changeRecordId, first.data.changeRecordId, '返回既有 changeRecordId（§6.2）');
  t.eq(second.data.duplicate, true, 'data.duplicate 机器可查');
  t.ok(second.warnings.some((w) => w.includes('DUPLICATE_REPLAY')), 'warnings 记 DUPLICATE_REPLAY（不新增错误码）');
  t.ok(second.warnings.every((w) => !m.ERROR_CODES.includes(w)), 'DUPLICATE_REPLAY 走 warnings 通道而非错误码面');
  t.eq(second.data.invalidatedNodes, first.data.invalidatedNodes, '无额外失效事件（invalidatedNodes 一致）');
  t.eq(JSON.stringify(second.evidence.readyRecomputed), JSON.stringify(first.evidence.readyRecomputed), 'READY 重算结果一致（清单 R7-05）');
  const filesAfter = fs.readdirSync(path.join(ws.workspace, 'contracts', 'discrepancies'));
  const indexAfter = fs.readFileSync(path.join(ws.workspace, 'plans', 'active', 'changes', 'index.jsonl'), 'utf8').trim().split('\n');
  t.eq(filesAfter.length, filesBefore.length, '不创建重复记录文件（GWT-R7-05：no duplicate record）');
  t.eq(indexAfter.length, indexBefore.length, '不追加索引行（无重复失效事件入账）');

  // 证据顺序不同 = 同一证据集 ⇒ 仍幂等（集合等价）
  const third = await m.recordChange({ ...input, sourceEvidence: ['ambient note', 'owner-instruction.md#' + ws.instrSha] }, opts({ now: '2026-09-20T06:00:00.000Z', rand: 'fffffffe' }));
  t.ok(third.ok === true && third.data.duplicate === true, '同键同证据集（顺序不同）⇒ 仍幂等重放');

  // 同键不同 sourceEvidence ⇒ CHANGE_SCOPE_UNCLEAR（不放行也不重放）
  const fourth = await m.recordChange({ ...input, sourceEvidence: ['different-evidence.md#' + 'd'.repeat(64)] }, opts({ now: '2026-09-20T07:00:00.000Z', rand: 'fffffffd' }));
  t.ok(fourth.ok === false && fourth.code === 'CHANGE_SCOPE_UNCLEAR', '同键不同 sourceEvidence ⇒ CHANGE_SCOPE_UNCLEAR（§2.3/OQ-R7-6=A）');
  t.ok(String(fourth.data.reason).includes('sourceEvidence'), '诊断指明证据不一致');
  const filesFinal = fs.readdirSync(path.join(ws.workspace, 'contracts', 'discrepancies'));
  t.eq(filesFinal.length, filesBefore.length, 'SCOPE_UNCLEAR 不创建记录（不放行也不重放）');
  return finish(t, 'p05 GWT-R7-05 幂等重放与 SCOPE_UNCLEAR 分界');
}
