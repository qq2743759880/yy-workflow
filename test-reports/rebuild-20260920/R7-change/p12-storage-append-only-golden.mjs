/**
 * p12 — 幸存实物全量复现 + 存储纪律（OQ-R7-1=A append-only；OQ-R7-3=A id 形；OQ-R7-6=A 幂等键）。
 * 可机验行为：以幸存实物 test-reports/change-record-r5ui-host-plugin-20260917/record-change.mjs 的
 * 逐字输入（21 条 G2.2 §2 规范 edge、逐字 reason/receipt 骨架、Owner 指令文件逐字节物化）驱动
 * change.record ⇒ 幂等键逐字节等于实物 REPORT.md 记载值 3b244b29…；固定 now/rand 下
 * changeRecordId = cr-20260917T035212Z-c2026fdf（实物 id）；invalidatedNodes/READY 与实物 REPORT §1
 * 逐字一致；指令文件哈希复现 b70bcd4c…；重放零写入（append-only）；namespaced index 与非法 session
 * fail-closed；cr- id 形校验。
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeT, finish, mkWorkspace, buildReceipt, EDGES, GOLDEN_BASE_PLAN, GOLDEN_BASE_VERSION, GOLDEN_REASON, GOLDEN_IDEMPOTENCY_KEY, GOLDEN_INSTRUCTION_SHA } from './_helper.mjs';

export async function run({ sandbox }) {
  const t = makeT();
  const m = await import(new URL('../../../scripts/lib/change.mjs', import.meta.url).href);
  // Owner 指令文件逐字节物化（哈希必须复现实物 b70bcd4c…）
  const ws = mkWorkspace(path.join(sandbox, 'ws'));
  t.eq(ws.instrSha, GOLDEN_INSTRUCTION_SHA, 'Owner 指令文件逐字节复现实物哈希 b70bcd4c…（REPORT.md §2）');

  const receipt = buildReceipt({
    instrFile: ws.instrFile, instrSha: ws.instrSha,
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    impactClass: 'CONTRACT', approvedAt: '2026-09-17T03:52:12.000Z',
    overrides: { approvalId: 'apr-20260917T035212Z-5ecf4e46' },
  });
  const input = {
    basePlan: GOLDEN_BASE_PLAN, baseVersion: GOLDEN_BASE_VERSION,
    reason: GOLDEN_REASON, impactClass: 'CONTRACT', owner: 'Owner',
    sourceEvidence: [
      'test-reports/change-record-r5ui-host-plugin-20260917/owner-instruction.md#' + GOLDEN_INSTRUCTION_SHA,
      GOLDEN_BASE_PLAN + '#' + GOLDEN_BASE_VERSION,
      'plans/tasks/G2.2-task-graph-20260911.md#91b5d72939bcb5c64d377282c04cf16b15c47ca3631df2eaac0938d71ad4ca21 (R5b node non-goals: no React/new Bridge pre-gate)',
      'ambient observation 2026-09-17 (non-authoritative): in-app browser crashed loading docs/preview/journey-control-room-preview-20260917.html',
    ],
    ownerApprovalReceipt: receipt,
  };
  const opts = {
    workspace: ws.workspace, sessionId: null, recordedBy: 'orchestrator',
    dependencies: EDGES, readyBefore: ['R5b'], primaryNodes: ['R5b'],
    now: '2026-09-17T03:52:12.000Z', rand: 'c2026fdf',
  };

  const res = await m.recordChange(input, opts);
  // 幂等键 golden：canonical sha256（OQ-R7-6=A 口径与实物逐字节一致）
  t.eq(res.data.idempotencyKey, GOLDEN_IDEMPOTENCY_KEY, '幂等键 = 3b244b29…（实物 REPORT.md §1 逐字节复现；canonical 口径 golden 验证）');
  // id 形与实物 id（固定 now/rand 下）
  t.ok(m.CHANGE_ID_RE.test(res.data.changeRecordId), 'changeRecordId 形 = cr-<YYYYMMDDTHHMMSSZ>-<8hex>（OQ-R7-3=A）');
  t.eq(res.data.changeRecordId, 'cr-20260917T035212Z-c2026fdf', '固定 now/rand 下 id = 实物 cr-20260917T035212Z-c2026fdf');
  // 失效面与 READY：与实物 REPORT.md §1 逐字一致
  t.eq(res.data.invalidatedNodes, ['R5b', 'R9', 'R6'], 'invalidatedNodes=[R5b,R9,R6]（实物 REPORT.md §1：R5b direct; R9/R6 transitive）');
  t.eq(res.evidence.readyRecomputed.exited, ['R5b'], 'exited=[R5b]（实物 REPORT.md §1）');
  t.eq(res.evidence.readyRecomputed.after, [], 'readyAfter=[]（READY = {R5b} → {}，实物 REPORT.md §1）');
  t.ok(res.ok === true, '实物驱动复现 ok:true（实物 exit 0）');

  // append-only：重放零写入（本体字节不变、目录不增、索引不增）
  const recFile = path.join(ws.workspace, 'contracts', 'discrepancies', res.data.changeRecordId + '.json');
  const bytesBefore = fs.readFileSync(recFile, 'utf8');
  const dirBefore = fs.readdirSync(path.join(ws.workspace, 'contracts', 'discrepancies')).length;
  const idxBefore = fs.readFileSync(path.join(ws.workspace, 'plans', 'active', 'changes', 'index.jsonl'), 'utf8');
  const replay = await m.recordChange(input, { ...opts, now: '2026-09-17T09:00:00.000Z', rand: 'ffffffff' });
  t.ok(replay.ok === true && replay.data.duplicate === true, '重放幂等 ok:true + duplicate');
  t.eq(fs.readFileSync(recFile, 'utf8'), bytesBefore, '重放后记录本体字节不变（append-only，§5.2）');
  t.eq(fs.readdirSync(path.join(ws.workspace, 'contracts', 'discrepancies')).length, dirBefore, '重放不新增记录文件');
  t.eq(fs.readFileSync(path.join(ws.workspace, 'plans', 'active', 'changes', 'index.jsonl'), 'utf8'), idxBefore, '重放不追加索引行');

  // namespaced index（§5.2 "namespaced 下随 session"）与非法 session fail-closed
  const ws2 = mkWorkspace(path.join(sandbox, 'ws-session'));
  const ns = await m.recordChange({ ...input, reason: GOLDEN_REASON + '（namespaced index 探针）' }, {
    ...opts, workspace: ws2.workspace, sessionId: 'sess-alpha', rand: '000000d7',
  });
  t.ok(ns.ok === true, 'namespaced 提交成功');
  t.ok(fs.existsSync(path.join(ws2.workspace, 'plans', 'active', 'changes', 'sess-alpha', 'index.jsonl')), 'sessionId 非空 ⇒ plans/active/changes/<sessionId>/index.jsonl（additive namespaced）');
  t.ok(!fs.existsSync(path.join(ws2.workspace, 'plans', 'active', 'changes', 'index.jsonl')), '根 index 未被误写');
  const evil = await m.recordChange(input, { ...opts, workspace: ws2.workspace, sessionId: '../evil', rand: '000000d8' });
  t.ok(evil.ok === false && evil.code === 'CHANGE_RECORD_INVALID', '非法 sessionId（路径穿越）⇒ fail-closed');

  // 存储布局断言（OQ-R7-1=A 逐字）
  t.ok(recFile.replace(/\\/g, '/').endsWith('contracts/discrepancies/cr-20260917T035212Z-c2026fdf.json'), '记录本体路径 = contracts/discrepancies/<changeRecordId>.json（OQ-R7-1=A）');
  t.ok(fs.existsSync(path.join(ws.workspace, 'plans', 'active', 'changes', 'index.jsonl')), '索引路径 = plans/active/changes/index.jsonl（OQ-R7-1=A）');
  return finish(t, 'p12 幸存实物全量复现 + append-only 存储纪律');
}
