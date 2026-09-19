/**
 * p10 — 清单 R3-6 / 契约 §7.4 P2 / §7.5 / GWT-R3-04：source hash 失效（blocked）。
 * (a) 链中途篡改 manifest 后正向追加 ⇒ RECEIPT_HASH_MISMATCH（文件不变，fail-closed）；
 * (b) T1-T5 齐备后篡改再走校验通道 ⇒ P2 失败 → N2 verification_failed，旧事件保留为历史证据不被改写，
 *     资产行为不得被标记 verified。
 */
import fs from 'node:fs';
import path from 'node:path';
import { copyAsset, prepare, runForwardChain, genuineArtifact, append, makeEvent, createChecks, finish } from './_helper.mjs';

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = path.join(sandbox, 'vendor');

  // ---------- (a) 正向追加遇篡改 ----------
  copyAsset(vendorDir, 'colorize');
  const p1 = await prepare({ asset: 'colorize', activationLevel: 'body', subtask: { id: 'r3-6-a' }, opts: { vendorDir } });
  const pkg1 = p1.data.activationPackage;
  const ev = (transition, evidence, key) => makeEvent(pkg1, 'r3-6-a', transition, evidence, key);
  append(ev('discovered', { catalogCacheIdentity: 'cid', sourceHash: pkg1.record.sourceHash }, 'a1'), { workspace: sandbox, vendorDir });
  const before = fs.readFileSync(path.join(sandbox, 'artifacts', 'r3-6-a', 'receipt.json'), 'utf8');

  const manifestFile = path.join(vendorDir, 'colorize', 'SKILL.md');
  fs.appendFileSync(manifestFile, '\n<!-- tampered after prepare -->\n'); // 投递/校验前修改资产 manifest 字节

  const rBlock = append(ev('eligible', { phaseEligibility: { eligible: true, reason: 'x', phase: 0 } }, 'a2'), { workspace: sandbox, vendorDir });
  checks.check('(a) 篡改后追加 ⇒ ok:false + RECEIPT_HASH_MISMATCH（dev-plan:303 原码）',
    rBlock.ok === false && rBlock.code === 'RECEIPT_HASH_MISMATCH', JSON.stringify(rBlock.code));
  checks.check('(a) 旧事件保留为历史证据，未被覆盖/删除（PRD0 §9.3.6）',
    fs.readFileSync(path.join(sandbox, 'artifacts', 'r3-6-a', 'receipt.json'), 'utf8') === before);

  // ---------- (b) 校验通道遇篡改（T1-T5 齐备 → P2 失败 → N2） ----------
  fs.rmSync(path.join(vendorDir, 'colorize'), { recursive: true, force: true });
  copyAsset(vendorDir, 'colorize');
  const p2 = await prepare({ asset: 'colorize', activationLevel: 'body', subtask: { id: 'r3-6-b' }, opts: { vendorDir } });
  const pkg2 = p2.data.activationPackage;
  const artifact = genuineArtifact(pkg2, 'r3-6-b');
  const { responses } = runForwardChain(sandbox, vendorDir, pkg2, 'r3-6-b', artifact);
  checks.check('(b) T1-T5 预备全通过', responses.every((r) => r.ok === true), responses.map((r) => r.code).join(','));

  const file = path.join(sandbox, 'artifacts', 'r3-6-b', 'receipt.json');
  const chainBefore = fs.readFileSync(file, 'utf8');
  fs.appendFileSync(path.join(vendorDir, 'colorize', 'SKILL.md'), '\n<!-- tampered before verification -->\n');

  const rVerify = append(makeEvent(pkg2, 'r3-6-b', 'behavior_verified', {
    behaviorCheck: { result: 'VERIFIED' },
    evidenceRefs: [1, 2, 3, 4, 5].map((n) => ({ eventSeq: n })),
  }, 'r3-6-b-t6'), { workspace: sandbox, vendorDir });

  checks.check('(b) 校验通道 ⇒ ok:false + RECEIPT_HASH_MISMATCH（GWT-R3-04 稳定错误码）',
    rVerify.ok === false && rVerify.code === 'RECEIPT_HASH_MISMATCH', JSON.stringify(rVerify.code));
  checks.check('(b) receipt 侧收口 = N2 verification_failed（§7.5）', rVerify.data?.transition === 'verification_failed');
  checks.check('(b) behaviorCheck result=FAILED，资产行为不得被标记 verified',
    rVerify.data?.result?.result === 'FAILED' && rVerify.data?.state !== 'behavior_verified');
  // append-only：T1-T5 旧事件逐字节保留（解析比对，非文件前缀——序列化尾部括号随数组增长位移）
  const afterChain = JSON.parse(fs.readFileSync(file, 'utf8'));
  const beforeChain = JSON.parse(chainBefore);
  checks.check('(b) T1-T5 旧事件逐字保留（append-only，不改写历史——PRD0 §9.3.6）',
    JSON.stringify(afterChain.events.slice(0, 5)) === JSON.stringify(beforeChain.events)
    && afterChain.events.length === 6
    && afterChain.events[5].transition === 'verification_failed');

  return finish(checks, 'p10 hash 失效：追加/校验双通道 RECEIPT_HASH_MISMATCH + N2 FAILED + 历史不改写');
}
