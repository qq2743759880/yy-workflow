/**
 * p08 — 清单 R3-11 / 契约 §7.6：receipt 幂等。
 * 同键 + 字节等价事件 ⇒ 返回既有 receiptRef、文件不变（不产生重复事件）；
 * 同键 + 不同 payload ⇒ RECEIPT_INVALID；重试（真实新执行）= 新键、正常追加。
 */
import fs from 'node:fs';
import path from 'node:path';
import { copyAsset, prepare, deliverBrief, makeEvent, append, createChecks, finish, sha256Text } from './_helper.mjs';

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = path.join(sandbox, 'vendor');
  copyAsset(vendorDir, 'colorize');

  const p = await prepare({ asset: 'colorize', activationLevel: 'body', subtask: { id: 'r3-11-st' }, opts: { vendorDir } });
  const pkg = p.data.activationPackage;
  deliverBrief(sandbox, 'r3-11-st', pkg);
  const H = pkg.record.sourceHash;
  const ev = (evidence, key) => makeEvent(pkg, 'r3-11-st', 'discovered', evidence, key);

  // 首次追加
  const r1 = append(ev({ catalogCacheIdentity: 'cid', sourceHash: H }, 'idem-1'), { workspace: sandbox, vendorDir });
  checks.check('首次追加 ok', r1.ok === true && r1.data?.receiptRef?.eventSeq === 1, r1.code ?? '');
  const file = path.join(sandbox, 'artifacts', 'r3-11-st', 'receipt.json');
  const before = fs.readFileSync(file, 'utf8');

  // 同键 + 字节等价（recordedAt 豁免）⇒ 幂等返回既有 receiptRef，文件不变
  const r2 = append(ev({ catalogCacheIdentity: 'cid', sourceHash: H }, 'idem-1'), { workspace: sandbox, vendorDir });
  checks.check('同键同 payload ⇒ ok:true 且 duplicate=true', r2.ok === true && r2.data?.duplicate === true);
  checks.check('幂等返回值与首次一致（receiptRef 相同）',
    JSON.stringify(r2.data?.receiptRef) === JSON.stringify(r1.data?.receiptRef));
  checks.check('receipt.json 事件数组不变（无重复事件落盘）', fs.readFileSync(file, 'utf8') === before);
  checks.check('幂等重放带 DUPLICATE_REPLAY warnings 说明（§7.6）', r2.warnings.some((w) => w.includes('DUPLICATE_REPLAY')));

  // 同键 + 不同 payload ⇒ RECEIPT_INVALID
  const r3 = append(ev({ catalogCacheIdentity: 'DIFFERENT-IDENTITY', sourceHash: H }, 'idem-1'), { workspace: sandbox, vendorDir });
  checks.check('同键不同 payload ⇒ RECEIPT_INVALID', r3.ok === false && r3.code === 'RECEIPT_INVALID');
  checks.check('冲突时文件不变（拒绝追加）', fs.readFileSync(file, 'utf8') === before);

  // 重试（真实新执行观察）= 新键 ⇒ 禁止复用失败尝试的键（§2.2）
  // 场景：T5 首次尝试因证据无效失败（无 execution_observed 事件落盘）→ 修正后以新键重试成功
  const { runForwardChain } = await import('./_helper.mjs');
  fs.writeFileSync(path.join(sandbox, 'artifacts', 'r3-11-st', 'retry.md'), 'attempt content v2');
  const pkgT5 = pkg;
  const ev5 = (artifactSha256, key) => makeEvent(pkgT5, 'r3-11-st', 'execution_observed', { artifactPath: 'retry.md', artifactSha256, executed: true }, key);
  // 先推进 T2/T3/T4 到 instructions_delivered
  append(makeEvent(pkg, 'r3-11-st', 'eligible', { phaseEligibility: { eligible: true, reason: 'x', phase: 0 } }, 'idem-t2'), { workspace: sandbox, vendorDir });
  append(makeEvent(pkg, 'r3-11-st', 'selected', { planId: 'pl', subtaskId: 'r3-11-st', sourceHash: H }, 'idem-t3'), { workspace: sandbox, vendorDir });
  deliverBrief(sandbox, 'r3-11-st', pkg);
  append(makeEvent(pkg, 'r3-11-st', 'instructions_delivered', {
    activationLevel: 'body', payloadSha256: pkg.payload.payloadSha256, briefPath: 'brief.md',
    sourceHashEcho: H, budgetResult: { action: 'block' },
  }, 'idem-t4'), { workspace: sandbox, vendorDir });
  const rFail = append(ev5(sha256Text('stale-hash'), 'retry-attempt-1'), { workspace: sandbox, vendorDir });
  checks.check('失败尝试不落盘（无 execution_observed 事件，§2.2 宿主失败行）', rFail.ok === false && rFail.code === 'RECEIPT_INCOMPLETE');
  const rRetry = append(ev5(sha256Text('attempt content v2'), 'retry-attempt-2'), { workspace: sandbox, vendorDir });
  checks.check('重试 = 新 idempotencyKey ⇒ 正常追加（禁止复用失败尝试的键）',
    rRetry.ok === true && rRetry.data?.receiptRef?.eventSeq === 5, rRetry.code ?? '');
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  checks.check('事件数组 = T1..T4 + 重试 T5（失败尝试零事件、无重复）', after.events.length === 5
    && after.events[4].transition === 'execution_observed' && after.events[4].idempotencyKey === 'retry-attempt-2');

  return finish(checks, 'p08 幂等：同键等价幂等返回 + 同键异 payload INVALID + 重试新键正常追加');
}
