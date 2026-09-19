/**
 * p07 — 清单 R3-12 / 契约 §3.4/§7.2/§7.6 / GWT-R3-02：receipt 存储（per-artifact 布局 +
 * 状态可重放 + 终态跃迁 T1→T6 + vendor 零写入 + 不混旧 plan 字段）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { copyAsset, prepare, runForwardChain, genuineArtifact, append, makeEvent, createChecks, finish, dirFingerprint, sha256Text } from './_helper.mjs';
import { receiptAppend, replayEvents, canonicalReceiptHash } from '../../../../scripts/lib/receipt.mjs';

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = path.join(sandbox, 'vendor');
  copyAsset(vendorDir, 'colorize');
  const fpBefore = dirFingerprint(vendorDir);

  const p = await prepare({ asset: 'colorize', activationLevel: 'body', subtask: { id: 'r3-12-st' }, opts: { vendorDir } });
  const pkg = p.data.activationPackage;
  const artifact = genuineArtifact(pkg, 'r3-12-st');
  const { responses } = runForwardChain(sandbox, vendorDir, pkg, 'r3-12-st', artifact);

  checks.check('T1-T5 全部 ok:true 且无错误码', responses.length === 5 && responses.every((r) => r.ok === true && r.code === null),
    responses.map((r) => r.code).join(','));
  checks.check('T1-T5 receiptRef.eventSeq 连续 1..5（§7.6）',
    responses.every((r, i) => r.data?.receiptRef?.eventSeq === i + 1));

  // T6：行为验证内嵌于 receipt.append（OQ-R3-9=A）
  const t6 = append(makeEvent(pkg, 'r3-12-st', 'behavior_verified', {
    behaviorCheck: { result: 'VERIFIED', evidenceRefs: [1, 2, 3, 4, 5].map((n) => ({ eventSeq: n })) },
    evidenceRefs: [1, 2, 3, 4, 5].map((n) => ({ eventSeq: n })),
  }, 'r3-12-st-t6'), { workspace: sandbox, vendorDir });
  checks.check('T6 ok:true 且 state=behavior_verified（唯一正终态，§7.1）',
    t6.ok === true && t6.data?.state === 'behavior_verified', JSON.stringify(t6.code));
  checks.check('T6 result=VERIFIED（§3.3 枚举）', t6.data?.result?.result === 'VERIFIED');
  checks.check('receiptRef 形状 = {subtaskId, assetId, receiptPath, eventSeq, sourceHash}（§2.2）',
    ['subtaskId', 'assetId', 'receiptPath', 'eventSeq', 'sourceHash'].every((k) => k in (t6.data?.receiptRef ?? {})));

  // per-artifact 布局与 schema
  const receiptFile = path.join(sandbox, 'artifacts', 'r3-12-st', 'receipt.json');
  checks.check('存储位置 = artifacts/<subtaskId>/receipt.json（OQ-R3-8=A）', fs.existsSync(receiptFile));
  const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  checks.check('schema 顶层 = {subtaskId, events[], result}（§3.4）+ canonicalHash(additive)',
    receipt.subtaskId === 'r3-12-st' && Array.isArray(receipt.events) && receipt.events.length === 6);
  checks.check('事件字段齐备：eventSeq/transition/assetId/assetType/sourceHash/sourceHashEcho/session/idempotencyKey/evidence/recordedAt（§3.4）',
    receipt.events.every((e) => ['eventSeq', 'transition', 'assetId', 'assetType', 'sourceHash', 'sourceHashEcho', 'session', 'idempotencyKey', 'evidence', 'recordedAt'].every((k) => k in e)));
  checks.check('assetType ∈ skill|agent', receipt.events.every((e) => ['skill', 'agent'].includes(e.assetType)));
  checks.check('T6 behaviorCheck 进 result 缓存且 checkId=<subtaskId>#<assetId>（§3.3）',
    receipt.result?.result === 'VERIFIED' && receipt.result?.checkId === 'r3-12-st#colorize');

  // 重放推导 == 缓存（§3.4：重放不一致 ⇒ RECEIPT_INVALID）
  const replayed = replayEvents(receipt.events);
  checks.check('事件重放 state/result == 缓存（状态是派生视图，§7.1）',
    replayed.state === 'behavior_verified' && JSON.stringify(replayed.result) === JSON.stringify(receipt.result));
  checks.check('canonicalHash 可复验（重算一致）', canonicalReceiptHash(receipt) === receipt.canonicalHash);

  // vendor 零写入 + 不混旧 plan 字段
  checks.check('vendor/ 零写入（前后指纹一致）', dirFingerprint(vendorDir) === fpBefore);
  checks.check('不写 .tt-state/state.json（不混旧 plan 字段，PRD0 §7 Receipt Store 行）',
    !fs.existsSync(path.join(sandbox, '.tt-state', 'state.json')));

  // 终态后禁止追加
  const after = receiptAppend({ event: makeEvent(pkg, 'r3-12-st', 'eligible', { phaseEligibility: { eligible: true, reason: 'x', phase: 0 } }, 'post-t'), opts: { workspace: sandbox, vendorDir } });
  checks.check('终态后追加 ⇒ RECEIPT_INVALID（新链须新 sourceHash 新 activation，§7.2）',
    after.ok === false && after.code === 'RECEIPT_INVALID');

  return finish(checks, 'p07 全链 T1→T6：per-artifact 布局 + 重放=缓存 + canonicalHash 可复验 + vendor 零写入');
}
