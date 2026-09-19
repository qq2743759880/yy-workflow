/**
 * p11 — 响应壳与错误码面一致性（契约 §7/§7.1/§7.2；dev-plan:308 输出壳原形）。
 * 可机验行为：统一壳 {ok, code, data, evidence, warnings} 五键在成功/失败间完全一致；
 * 成功 code=null；错误码集合严格 = 三码（dev-plan:308 原码），不出现发明的新码；
 * data: changeRecord（dev-plan:308 输出列 data:changeRecord 原形）；ok:false ⇒ 调用方 exit non-zero
 * 语义（ok 通道即 CI 收口，§7.2）；操作面仅 change.record。
 */
import path from 'node:path';
import { makeT, finish, mkWorkspace, buildReceipt, EDGES, GOLDEN_BASE_PLAN, GOLDEN_BASE_VERSION, GOLDEN_REASON } from './_helper.mjs';

export async function run({ sandbox }) {
  const t = makeT();
  const m = await import(new URL('../../../scripts/lib/change.mjs', import.meta.url).href);
  const SHELL_KEYS = ['ok', 'code', 'data', 'evidence', 'warnings'].sort().join(',');
  const ws = mkWorkspace(path.join(sandbox, 'ws'));
  const input = {
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    reason: GOLDEN_REASON, impactClass: 'CONTRACT', owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + ws.instrSha],
  };
  const opts = {
    workspace: ws.workspace, recordedBy: 'probe', dependencies: EDGES,
    readyBefore: ['R5b'], primaryNodes: ['R5b'],
    now: '2026-09-17T03:52:12.000Z', rand: '000000d6',
  };

  const probes = [
    m.recordChange({ ...input, ownerApprovalReceipt: buildReceipt({
      instrFile: ws.instrFile, instrSha: ws.instrSha,
      basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
      impactClass: 'CONTRACT', approvedAt: '2026-09-17T03:52:11.000Z',
    }) }, opts),                                                     // 成功壳
    m.recordChange({ ...input, reason: undefined }, opts),           // CHANGE_RECORD_INVALID
    m.recordChange({ ...input, sourceEvidence: ['x#other'] }, opts), // CHANGE_SCOPE_UNCLEAR（同键不同证据）
    m.recordChange({ ...input, owner: undefined }, opts),            // CHANGE_OWNER_REQUIRED
    m.recordChange(input, { ...opts, workspace: undefined }),        // 载体缺失
    m.run('change.rewind', input),                                   // 未知操作
    m.run('change.record', { ...input, opts }),                      // run() 分发成功壳
  ];
  const settled = [];
  for (const p of probes) {
    try { settled.push(await p); } catch (e) { settled.push({ ok: false, code: 'THREW:' + e.message, data: {}, evidence: {}, warnings: [] }); }
  }
  // (1) 五键壳一致
  t.ok(settled.every((r) => Object.keys(r).sort().join(',') === SHELL_KEYS), '五键 {ok,code,data,evidence,warnings} 在成功/失败间完全一致（§7）');
  // (2) 成功 code=null、ok:true
  for (const idx of [0, 6]) {
    t.ok(settled[idx].ok === true && settled[idx].code === null, `成功壳[${idx}] ok:true + code:null`);
  }
  // (3) 错误码面严格 = 三码，无发明码
  t.eq(JSON.stringify(m.ERROR_CODES.slice().sort()), JSON.stringify(['CHANGE_OWNER_REQUIRED', 'CHANGE_RECORD_INVALID', 'CHANGE_SCOPE_UNCLEAR'].sort()), 'ERROR_CODES 严格 = dev-plan:308 三原码');
  t.ok(settled.every((r) => r.code === null || m.ERROR_CODES.includes(r.code)), '每格响应 code ∈ 三码 ∪ {null}（不新增错误码）');
  // (4) data: changeRecord 原形（成功 data 含 changeRecordId 且 schema 字段齐备）
  const rec = settled[0].data;
  for (const k of ['changeRecordId', 'basePlan', 'baseVersion', 'reason', 'impactClass', 'owner', 'sourceEvidence', 'invalidatedNodes', 'newVersionRef', 'supersededBy', 'status', 'recordedAt', 'recordedBy']) {
    t.ok(k in rec, `changeRecord.${k} 在场（§2.2 schema）`);
  }
  t.eq(rec.impactClass, 'CONTRACT', 'data 即 changeRecord 本体（dev-plan:308 data:changeRecord 原形）');
  // (5) 失败 ok:false ⇒ CI exit non-zero 语义（§7.2：调用方以 ok 通道收口，不得打印成功字面）
  for (const idx of [1, 2, 3, 4, 5]) {
    t.ok(settled[idx].ok === false, `失败壳[${idx}] ok:false（CI exit non-zero，§7.2）`);
  }
  const allJson = JSON.stringify(settled);
  t.ok(!allJson.includes('SUCCESS'), '无成功字面混入失败响应（§7.2 不得打印成功字面）');
  // (6) 操作面唯一：run 分发只认 change.record
  t.eq(settled[5].code, 'CHANGE_RECORD_INVALID', '未知操作收口于既有码（R7 操作面仅 change.record）');
  // (7) 常量导出面（五类/回退目标/状态集/receipt 八字段）
  t.eq(m.IMPACT_CLASSES.slice().join('|'), 'DOC_ONLY|TASK_GRAPH|CONTRACT|IMPLEMENTATION|SECURITY', '五类 impact class（R7 doc Freeze order 原文）');
  t.eq(Object.keys(m.REWIND_TARGETS).length, 5, '五类回退目标表（§4.1）');
  t.eq(m.STATUS_VALUES.join('|'), 'active|superseded', 'status 枚举（§2.2）');
  t.eq(m.OWNER_RECEIPT_FIELDS.length, 8, 'C-R4 §5.2 receipt 八字段消费面');
  return finish(t, 'p11 响应壳/错误码面/schema 形一致性');
}
