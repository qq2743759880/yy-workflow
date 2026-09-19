/** p08 — override-receipt 无效路径（清单 R4-07b/c + §5.3 行 4-5）：非 owner / 字段缺失 / approvedAt 倒挂 / expiresAt 非 null / approvalEvidence 缺 SHA256 或哈希不符 / 跨 target / 跨 scopeId / 同 receipt 二次引用 / rollback 失效条款 ⇒ OVERRIDE_NOT_ALLOWED（无批准 ⇒ OWNER_APPROVAL_REQUIRED），全部 fail-closed 状态不变。 */
import fs from 'node:fs';
import path from 'node:path';
import phase from '../../../scripts/lib/phase.mjs';
import { NOW, stateFixture, seedState, stateFileOf, makeApproval, writeReceipt, shellOk, verdict } from './_helpers.mjs';

const BAD_SHA = '0'.repeat(64);

export async function run({ sandbox }) {
  const checks = [];
  const c = (name, pass) => checks.push({ name, pass });

  /** 单变体：独立 ws 内 seed reviewing 态，force+receipt 执行，断言拒绝与状态不变 */
  async function expectReject(name, makeReceipt, expectCode = 'OVERRIDE_NOT_ALLOWED', req = { from: 'reviewing', to: 'done' }) {
    const ws = path.join(sandbox, 'v-' + name);
    seedState(ws, stateFixture({ status: req.from }));
    if (req.needsUnmet !== false) { /* 默认无 receipt = 前置未满足 */ }
    const receipt = makeReceipt(ws);
    const tr = await phase.transitionPhase({
      workspace: ws, from: req.from, to: req.to, force: true, ownerReceipt: receipt,
      opts: { now: NOW, rand: 'bad0' + name.slice(0, 4) },
    });
    c(name + '.code', tr.ok === false && tr.code === expectCode, `got ${tr.ok}/${tr.code}`);
    c(name + '.shell', shellOk(tr));
    const st = JSON.parse(fs.readFileSync(stateFileOf(ws), 'utf8'));
    c(name + '.stateUnchanged', st.status === req.from);
    return tr;
  }

  await expectReject('nonOwner', (ws) => makeApproval(ws, { approvedBy: 'admin' }));
  await expectReject('missingReason', (ws) => makeApproval(ws, { omit: ['reason'] }));
  await expectReject('missingExpiresAt', (ws) => makeApproval(ws, { omit: ['expiresAt'] }));
  await expectReject('badApprovalId', (ws) => makeApproval(ws, { approvalId: 'apr-bad' }));
  await expectReject('approvedAtInverted', (ws) => makeApproval(ws, { approvedAt: '2026-09-20T02:01:00.000Z' })); // 晚于执行时点 NOW
  await expectReject('expiresAtNonNull', (ws) => makeApproval(ws, { expiresAt: '2027-01-01T00:00:00.000Z' }));
  await expectReject('evidenceNoSha', (ws) => {
    const a = makeApproval(ws);
    return { ...a, approvalEvidence: 'owner-directives/apr-20260920T015900Z.md' }; // 有路径无 SHA256
  });
  await expectReject('evidenceHashMismatch', (ws) => {
    const a = makeApproval(ws);
    return { ...a, approvalEvidence: phase.formatApprovalEvidence('owner-directives/apr-20260920T015900Z.md', BAD_SHA) };
  });
  await expectReject('crossTarget', (ws) => makeApproval(ws, { from: 'executing', to: 'reviewing' })); // 跨转换复用
  await expectReject('crossScopeId', (ws) => makeApproval(ws, { scopeId: 'other-plan' })); // 跨作用域复用
  await expectReject('badRelatedReceipts', (ws) => makeApproval(ws, { patch: { relatedReceipts: 'not-an-array' } }));

  // 无任何 approval receipt（force）⇒ OWNER_APPROVAL_REQUIRED（区别于 receipt 无效）
  await expectReject('noReceiptAtAll', () => undefined, 'OWNER_APPROVAL_REQUIRED');

  // (b) 同 receipt 二次引用：首次成功后同请求重放 ⇒ 幂等 no-op（§6.2 幂等规则，R4-07b 幂等支路）
  const wsR = path.join(sandbox, 'v-replay');
  seedState(wsR, stateFixture());
  const approval = makeApproval(wsR, { approvalId: 'apr-20260920T015900Z-re01used' });
  const first = await phase.transitionPhase({ workspace: wsR, from: 'reviewing', to: 'done', force: true, ownerReceipt: approval, opts: { now: NOW, rand: 'abc10001' } });
  c('replay.firstOk', first.ok === true && first.data.override === 'exc-20260920T020000Z-abc10001');
  const second = await phase.transitionPhase({ workspace: wsR, from: 'reviewing', to: 'done', force: true, ownerReceipt: approval, opts: { now: NOW, rand: 'abc10002' } });
  c('replay.secondIdempotent', second.ok === true && second.data.idempotent === true && second.data.override === first.data.override);
  const logLines = fs.readFileSync(path.join(wsR, '.tt-state', 'transitions.jsonl'), 'utf8').trim().split('\n');
  c('replay.noDuplicateRecord', logLines.length === 1); // 幂等不写重复记录

  // (c) 跨转换复用：同 approvalId 二次引用——状态经带外快照恢复（§8.4）回 reviewing 后再引用 ⇒ OVERRIDE_NOT_ALLOWED
  //（幂等支路只在"已在 to 态"时生效；恢复后的未决转换属新的待决请求，登记在案的 approval 不得复用）
  const wsR2 = path.join(sandbox, 'v-reuse');
  seedState(wsR2, stateFixture());
  const reused = makeApproval(wsR2, { approvalId: 'apr-20260920T015900Z-re01used' });
  const firstUse = await phase.transitionPhase({ workspace: wsR2, from: 'reviewing', to: 'done', force: true, ownerReceipt: reused, opts: { now: NOW, rand: 'abc20001' } });
  c('reuse.firstOk', firstUse.ok === true && firstUse.data.override !== null, `first=${firstUse.ok}/${firstUse.code ?? ''}`);
  seedState(wsR2, stateFixture()); // 模拟 §8.4 快照恢复（带外，仅恢复 state 本体；overrides/ 审计登记不动）
  const trReuse = await phase.transitionPhase({ workspace: wsR2, from: 'reviewing', to: 'done', force: true, ownerReceipt: reused, opts: { now: NOW, rand: 'abc20002' } });
  c('reuse.rejected', trReuse.ok === false && trReuse.code === 'OVERRIDE_NOT_ALLOWED' && trReuse.data.reason.includes('已被引用'), `got ${trReuse.code}:${trReuse.data.reason ?? ''}`);

  // (d) rollback 失效条款（OQ-R4-6=A）：rollback 前签发的 approval 对 rollback 后 transition 一律失效
  const wsRb = path.join(sandbox, 'v-rollback');
  seedState(wsRb, stateFixture());
  phase.recordRollback({ workspace: wsRb, at: '2026-09-20T01:59:30.000Z', reason: 'probe rollback' });
  const stale = makeApproval(wsRb, { approvedAt: '2026-09-20T01:59:00.000Z' }); // 签发于 rollback(01:59:30) 之前
  const trStale = await phase.transitionPhase({ workspace: wsRb, from: 'reviewing', to: 'done', force: true, ownerReceipt: stale, opts: { now: NOW, rand: 'abc30001' } });
  c('rollback.staleRejected', trStale.ok === false && trStale.code === 'OVERRIDE_NOT_ALLOWED' && trStale.data.reason.includes('rollback'));
  // 正对照：rollback 后重新签发（approvedAt 晚于 rollback）⇒ 放行
  const fresh = makeApproval(wsRb, { approvedAt: '2026-09-20T01:59:45.000Z', approvalId: 'apr-20260920T015945Z-fresh001' });
  const trFresh = await phase.transitionPhase({ workspace: wsRb, from: 'reviewing', to: 'done', force: true, ownerReceipt: fresh, opts: { now: NOW, rand: 'abc30002' } });
  c('rollback.freshAccepted', trFresh.ok === true && trFresh.data.override !== null);

  // (e) 前置自然满足时 override 通道根本不进入：带有效 receipt 的正常转换不需 receipt（§5.3 行 1 对照）
  const wsOk = path.join(sandbox, 'v-natural');
  seedState(wsOk, stateFixture());
  writeReceipt(wsOk, { subtaskId: 's1', assetId: 'implementation', terminal: 'verified' });
  const trOk = await phase.transitionPhase({ workspace: wsOk, from: 'reviewing', to: 'done', opts: { now: NOW, rand: 'abc40001' } });
  c('natural.noReceiptNeeded', trOk.ok === true && trOk.data.override === null);

  return verdict(checks, 'override-receipt-invalid');
}
