/**
 * p16 — 契约 §7.4 P5（证据类别合法性）：evidenceRefs 所指事件携带 legacy assetConsumed 布尔或
 * marker-presence 验证依据 ⇒ 不得 VERIFIED（N2 FAILED / EVIDENCE_ECHO_ONLY）。
 * weak telemetry 可与 receipt 事件并存（§7.8），但对验证判定视而不见。
 */
import { copyAsset, prepare, runForwardChain, genuineArtifact, append, makeEvent, createChecks, finish } from './_helper.mjs';

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = sandbox + '/vendor';
  copyAsset(vendorDir, 'colorize');

  // (a) T4 evidence 违规携带 legacy assetConsumed 布尔（weak telemetry 混入验证证据）
  {
    const p = await prepare({ asset: 'colorize', activationLevel: 'body', subtask: { id: 'p16-a' }, opts: { vendorDir } });
    const pkg = p.data.activationPackage;
    const { responses } = runForwardChain(sandbox, vendorDir, pkg, 'p16-a', genuineArtifact(pkg, 'p16-a'), {
      extraT4: { assetConsumed: true, verificationBasis: 'legacy-boolean' }, // 回显型布尔混入链上事件
    });
    checks.check('(a) T1-T5 预备通过（weak telemetry 并存不阻断记录）', responses.every((r) => r.ok === true));
    const r = append(makeEvent(pkg, 'p16-a', 'behavior_verified', {
      behaviorCheck: { result: 'VERIFIED' },
      evidenceRefs: [1, 2, 3, 4, 5].map((n) => ({ eventSeq: n })),
    }, 'p16-a-t6'), { workspace: sandbox, vendorDir });
    checks.check('(a) P5 拒绝 ⇒ result=FAILED / EVIDENCE_ECHO_ONLY（不得 VERIFIED）',
      r.data?.result?.result === 'FAILED' && r.data?.result?.reason === 'EVIDENCE_ECHO_ONLY',
      JSON.stringify({ result: r.data?.result?.result, reason: r.data?.result?.reason }));
    checks.check('(a) 收口 = N2 verification_failed（决策结果进 data）', r.data?.transition === 'verification_failed');
  }

  // (b) marker-presence 依据（锚点/内核词字符串包含）同样非法
  {
    const p = await prepare({ asset: 'colorize', activationLevel: 'body', subtask: { id: 'p16-b' }, opts: { vendorDir } });
    const pkg = p.data.activationPackage;
    const { responses } = runForwardChain(sandbox, vendorDir, pkg, 'p16-b', genuineArtifact(pkg, 'p16-b'), {
      extraT4: { verificationBasis: 'marker-presence' },
    });
    const r = append(makeEvent(pkg, 'p16-b', 'behavior_verified', {
      behaviorCheck: { result: 'VERIFIED' },
      evidenceRefs: [1, 2, 3, 4, 5].map((n) => ({ eventSeq: n })),
    }, 'p16-b-t6'), { workspace: sandbox, vendorDir });
    checks.check('(b) marker-presence 依据 ⇒ FAILED / EVIDENCE_ECHO_ONLY',
      r.data?.result?.result === 'FAILED' && r.data?.result?.reason === 'EVIDENCE_ECHO_ONLY');
  }

  // (c) evidenceRefs 指向不存在的事件 ⇒ 不得 VERIFIED
  {
    const p = await prepare({ asset: 'colorize', activationLevel: 'body', subtask: { id: 'p16-c' }, opts: { vendorDir } });
    const pkg = p.data.activationPackage;
    runForwardChain(sandbox, vendorDir, pkg, 'p16-c', genuineArtifact(pkg, 'p16-c'));
    const r = append(makeEvent(pkg, 'p16-c', 'behavior_verified', {
      behaviorCheck: { result: 'VERIFIED' },
      evidenceRefs: [{ eventSeq: 99 }],
    }, 'p16-c-t6'), { workspace: sandbox, vendorDir });
    checks.check('(c) evidenceRefs 悬空 ⇒ 不得 VERIFIED（FAILED 或 UNRESOLVED 收口）',
      r.data?.result?.result === 'FAILED' || r.data?.result?.result === 'UNRESOLVED',
      JSON.stringify({ result: r.data?.result?.result }));
  }

  // (d) 干净链 + 干净 evidenceRefs（对照）⇒ VERIFIED 不受 P5 误伤
  {
    const p = await prepare({ asset: 'colorize', activationLevel: 'body', subtask: { id: 'p16-d' }, opts: { vendorDir } });
    const pkg = p.data.activationPackage;
    runForwardChain(sandbox, vendorDir, pkg, 'p16-d', genuineArtifact(pkg, 'p16-d'));
    const r = append(makeEvent(pkg, 'p16-d', 'behavior_verified', {
      behaviorCheck: { result: 'VERIFIED' },
      evidenceRefs: [1, 2, 3, 4, 5].map((n) => ({ eventSeq: n })),
    }, 'p16-d-t6'), { workspace: sandbox, vendorDir });
    checks.check('(d) 干净链对照 ⇒ VERIFIED（P5 不误伤合法证据）', r.ok === true && r.data?.result?.result === 'VERIFIED',
      JSON.stringify({ code: r.code, result: r.data?.result?.result }));
  }

  return finish(checks, 'p16 P5 证据类别：legacy 布尔/marker-presence 依据拒绝 + 悬空 refs + 干净链对照');
}
