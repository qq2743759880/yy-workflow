/**
 * p03 — GWT-R7-03 implementation-impacting change（清单 R7-03/R7-07）。
 * 可机验行为：IMPLEMENTATION 类——newVersionRef 必需且 = 新文件路径#sha256；版本号顺序整数
 * v2,v3,…（OQ-R7-7=A；v1/semver/冲突拒绝）；无备份不迁移（§8.2，snapshotRef 缺失拒绝）；
 * 版本链 changeRecordId→baseVersion→newVersionRef 落入记录；终态节点不原地改写（warning 提示新链）；
 * 旧报告只读（变更不写旧版本文件）。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { makeT, finish, mkWorkspace } from './_helper.mjs';

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export async function run({ sandbox }) {
  const t = makeT();
  const m = await import(new URL('../../../scripts/lib/change.mjs', import.meta.url).href);
  const edges = [{ from: 'T1', to: 'T2' }];
  const base = (over = {}) => ({
    basePlan: 'plans/PRD0.md', baseVersion: 'b'.repeat(64),
    reason: '运行时行为变更：数据通道降级策略调整（GWT-R7-03）',
    impactClass: 'IMPLEMENTATION', owner: 'Owner',
    sourceEvidence: ['owner-instruction.md#' + 'c'.repeat(64)],
    ...over,
  });
  const opts = (ws, over = {}) => ({
    workspace: ws.workspace, recordedBy: 'probe', dependencies: edges,
    readyBefore: ['T1', 'T2'], primaryNodes: ['T1'],
    now: '2026-09-20T02:00:00.000Z', rand: '000000c3', ...over,
  });

  // 正向：合法 IMPLEMENTATION（v2 + 快照在案）
  const ws1 = mkWorkspace(path.join(sandbox, 'ws-ok'));
  const newFileRel = 'plans/PRD0-v2.md';
  const newFileBody = '# PRD0 v2（引用 v1/' + 'b'.repeat(64) + '、reason、sourceEvidence、受影响任务 T1）';
  fs.mkdirSync(path.dirname(path.join(ws1.workspace, newFileRel)), { recursive: true });
  fs.writeFileSync(path.join(ws1.workspace, newFileRel), newFileBody, 'utf8');
  const oldReportRel = 'test-reports/old-acceptance-REPORT.md';
  fs.mkdirSync(path.dirname(path.join(ws1.workspace, oldReportRel)), { recursive: true });
  const oldReportBody = '# old acceptance report（只读证据）';
  fs.writeFileSync(path.join(ws1.workspace, oldReportRel), oldReportBody, 'utf8');
  const res = await m.recordChange(base({
    newVersionRef: newFileRel + '#' + sha(Buffer.from(newFileBody)),
    newVersion: 'v2',
    snapshotRef: 'backup/ws-snapshot-20260920/',
  }), opts(ws1, { terminalNodes: [] }));
  t.ok(res.ok === true, '合法 IMPLEMENTATION（newVersionRef+sha256+顺序整数 v2+快照）⇒ ok:true');
  t.ok(res.data.newVersionRef === newFileRel + '#' + sha(Buffer.from(newFileBody)), 'newVersionRef = 新文件路径#sha256（§4.2.5）');
  t.eq(res.data.newVersion, 'v2', '新版本号 = 顺序整数 v2（OQ-R7-7=A）');
  t.ok(res.data.changeRecordId && res.data.baseVersion && res.data.newVersionRef, '版本链 changeRecordId → baseVersion → newVersionRef 三环齐备（§4.2.4，清单 R7-03）');
  t.eq(res.data.invalidatedNodes, ['T1', 'T2'], '失效面 = primary + 传递下游（§3.2.2）');
  t.eq(sha(fs.readFileSync(path.join(ws1.workspace, oldReportRel))), sha(Buffer.from(oldReportBody)), '旧报告字节不变（GWT-R7-03 old reports remain read-only）');

  // 终态节点保护：primary 命中终态节点 ⇒ warning + 不原地改写（§4.2.1）
  const ws1b = mkWorkspace(path.join(sandbox, 'ws-ok-terminal'));
  fs.mkdirSync(path.dirname(path.join(ws1b.workspace, newFileRel)), { recursive: true });
  fs.writeFileSync(path.join(ws1b.workspace, newFileRel), newFileBody, 'utf8');
  const resT = await m.recordChange(base({
    newVersionRef: newFileRel + '#' + sha(Buffer.from(newFileBody)),
    newVersion: 'v2', snapshotRef: 'backup/ws-snapshot/',
  }), opts(ws1b, { primaryNodes: ['T1', 'T9'], terminalNodes: ['T9'] }));
  t.ok(resT.ok === true, '含终态节点的 IMPLEMENTATION 仍创建记录（终态不被原地改写而非拒绝，§4.2.1）');
  t.ok(resT.warnings.some((w) => w.includes('终态节点不原地改写') && w.includes('T9')), '终态节点 T9 触发新链 warning（§4.2.1/[R4冻结] §3.2）');

  // 负向：newVersionRef 缺失 / 缺 sha256 / v1 / semver / 版本冲突 / 无快照
  const cases = [
    ['missing newVersionRef', base({ newVersionRef: undefined }), 'newVersionRef'],
    ['newVersionRef 缺 sha256', base({ newVersionRef: newFileRel }), 'sha256'],
    ['版本号 v1（非 bump）', base({ newVersionRef: newFileRel + '#' + sha(Buffer.from(newFileBody)), newVersion: 'v1' }), '顺序整数'],
    ['semver 禁用', base({ newVersionRef: newFileRel + '#' + sha(Buffer.from(newFileBody)), newVersion: 'v2.1.0' }), 'semver'],
    ['无备份不迁移', base({ newVersionRef: newFileRel + '#' + sha(Buffer.from(newFileBody)), newVersion: 'v2', snapshotRef: undefined }), '无备份不迁移'],
  ];
  for (const [name, input, expectReason] of cases) {
    const wsN = mkWorkspace(path.join(sandbox, 'ws-neg-' + name.replace(/[^a-z0-9]+/gi, '-')));
    fs.mkdirSync(path.dirname(path.join(wsN.workspace, newFileRel)), { recursive: true });
    fs.writeFileSync(path.join(wsN.workspace, newFileRel), newFileBody, 'utf8');
    const r = await m.recordChange(input, opts(wsN));
    t.ok(r.ok === false && r.code === 'CHANGE_RECORD_INVALID', `${name} ⇒ CHANGE_RECORD_INVALID（fail-closed）`);
    t.ok(String(r.data.reason).includes(expectReason), `${name} 诊断含「${expectReason}」`);
    t.ok(!fs.existsSync(path.join(wsN.workspace, 'contracts', 'discrepancies')), `${name} 不落盘（stateUnchanged）`);
  }
  // 版本冲突：同 basePlan 同 newVersion 的第二条 IMPLEMENTATION（不同 reason ⇒ 不同幂等键）
  const wsC = mkWorkspace(path.join(sandbox, 'ws-conflict'));
  fs.mkdirSync(path.dirname(path.join(wsC.workspace, newFileRel)), { recursive: true });
  fs.writeFileSync(path.join(wsC.workspace, newFileRel), newFileBody, 'utf8');
  await m.recordChange(base({ newVersionRef: newFileRel + '#' + sha(Buffer.from(newFileBody)), newVersion: 'v2', snapshotRef: 'backup/1/' }), opts(wsC, { rand: '00000001' }));
  const rC = await m.recordChange(base({ reason: '另一条不同 reason 的 IMPLEMENTATION 变更', newVersionRef: newFileRel + '#' + sha(Buffer.from(newFileBody)), newVersion: 'v2', snapshotRef: 'backup/2/' }), opts(wsC, { rand: '00000002' }));
  t.ok(rC.ok === false && rC.code === 'CHANGE_RECORD_INVALID' && String(rC.data.reason).includes('冲突'), '新版本号与已有版本冲突 ⇒ CHANGE_RECORD_INVALID（清单 R7-03 defect 面）');
  return finish(t, 'p03 GWT-R7-03 IMPLEMENTATION 新版本链纪律');
}
