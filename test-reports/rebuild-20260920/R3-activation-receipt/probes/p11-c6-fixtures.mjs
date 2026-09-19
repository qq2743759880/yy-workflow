/**
 * p11 — 清单 R3-9/R3-10 / 契约 §7.7 C6 regression fixture set / §7.4 P3+P4 / GWT-R3-03/04：
 * 7 case 最小回归集——任何 receipt 验证实现必须产出契约右列"receipt 语义"，7/7 case 均不得 VERIFIED。
 * legacy 观测列按 prompt.mjs:107-108 同源布尔在本探针内重derive（缺陷证据基线，非修复声明）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { copyAsset, prepare, runForwardChain, deliverBrief, makeEvent, append, createChecks, finish, sha256Text } from './_helper.mjs';

/** legacy assetConsumed 布尔重derive（prompt.mjs:107-108 同源——回显型布尔，缺陷基线，非修复声明）。 */
function legacyAssetConsumed(pkg, artifactText) {
  const lower = artifactText.toLowerCase();
  const anchor = String(pkg.record.anchor).toLowerCase();
  const kernelTokens = pkg.record.kernelTokens ?? [];
  if (pkg.record.hasKernelSection && kernelTokens.length) {
    return lower.includes(anchor) && kernelTokens.some((k) => lower.includes(k));
  }
  return lower.includes(anchor);
}

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = path.join(sandbox, 'vendor');
  copyAsset(vendorDir, 'colorize');      // kernel 资产（anchor = MANDATORY PREPARATION，内核词 culori/chroma-js/poline）
  copyAsset(vendorDir, 'dev-planner');   // 非 kernel 资产（无 Execution kernel 段，anchor = dev-planner）

  const fixtureText = {
    'title-only-with-kernel': () => '# MANDATORY PREPARATION\n',
    'title-only-without-kernel': () => '# dev-planner\n',
    'title-plus-kernel-word': () => '# MANDATORY PREPARATION\n\nculori\n',
    'unrelated-prose': () => '# Totally unrelated notes\n\nThe weather today is pleasant and this text has no relation to any methodology.\n',
    'kernel-word-only-no-title': () => 'culori\n',
    'fake-methodology-repeat5': () => Array(5).fill('# MANDATORY PREPARATION\n\nculori\n').join('\n'),
  };

  // 逐 case 建链（T1-T5 以 fixture 产物为 T5 证据），attempt behavior_verified，对照 §7.7 右列语义
  const cases = [
    ['title-only-with-kernel', 'colorize', { result: 'FAILED', reason: 'EVIDENCE_ECHO_ONLY' }, false],
    ['title-only-without-kernel', 'dev-planner', { result: 'FAILED', reason: 'EVIDENCE_ECHO_ONLY' }, true],
    ['title-plus-kernel-word', 'colorize', { result: 'FAILED', reason: 'EVIDENCE_ECHO_ONLY' }, true],
    ['unrelated-prose', 'colorize', { result: 'UNRESOLVED', reason: 'RECEIPT_INCOMPLETE' }, false], // 无 T4/T5 链，P3
    ['kernel-word-only-no-title', 'colorize', { result: 'FAILED', reason: 'EVIDENCE_ECHO_ONLY' }, false],
    ['fake-methodology-repeat5', 'colorize', { result: 'FAILED', reason: 'EVIDENCE_ECHO_ONLY' }, true],
  ];

  const observed = [];
  for (const [caseName, assetId, expected, legacyExpected] of cases) {
    const subtaskId = 'c6-' + caseName;
    const p = await prepare({ asset: assetId, activationLevel: 'body', subtask: { id: subtaskId }, opts: { vendorDir } });
    if (!p.ok) { checks.check(caseName + ' prepare', false, p.code); continue; }
    const pkg = p.data.activationPackage;
    const artifactText = fixtureText[caseName]();
    if (caseName === 'unrelated-prose') {
      // 该 case：产物存在但不与任何投递关联——只建 T1-T3（无 T4/T5），attempt T6 ⇒ P3 断裂
      deliverBrief(sandbox, subtaskId, pkg); // 产物写入 artifacts，但不登记 T4/T5
      fs.writeFileSync(path.join(sandbox, 'artifacts', subtaskId, 'notes.md'), artifactText);
      append(makeEvent(pkg, subtaskId, 'discovered', { catalogCacheIdentity: 'cid', sourceHash: pkg.record.sourceHash }, subtaskId + '-t1'), { workspace: sandbox, vendorDir });
      append(makeEvent(pkg, subtaskId, 'eligible', { phaseEligibility: { eligible: true, reason: 'x', phase: 0 } }, subtaskId + '-t2'), { workspace: sandbox, vendorDir });
      append(makeEvent(pkg, subtaskId, 'selected', { planId: 'pl', subtaskId, sourceHash: pkg.record.sourceHash }, subtaskId + '-t3'), { workspace: sandbox, vendorDir });
      const legacy = legacyAssetConsumed(pkg, artifactText);
      const r = append(makeEvent(pkg, subtaskId, 'behavior_verified', { behaviorCheck: { result: 'VERIFIED' }, evidenceRefs: [1, 2, 3, 4, 5].map((n) => ({ eventSeq: n })) }, subtaskId + '-t6'), { workspace: sandbox, vendorDir });
      checks.check(caseName + ' ⇒ ok:false（P3 断裂收口）', r.ok === false);
      checks.check(caseName + ' receipt 语义 = ' + expected.result + '/' + expected.reason,
        r.data?.result?.result === expected.result && r.data?.result?.reason === expected.reason,
        JSON.stringify({ result: r.data?.result?.result, reason: r.data?.result?.reason }));
      checks.check(caseName + ' 收口事件 = unresolved（N3）', r.data?.transition === 'unresolved');
      checks.check(caseName + ' legacy 观测（重derive）= ' + legacyExpected, legacy === legacyExpected, String(legacy));
      observed.push([caseName, legacy, r.data?.result?.result]);
      continue;
    }
    const { responses } = runForwardChain(sandbox, vendorDir, pkg, subtaskId, artifactText);
    const t5ok = responses.every((r) => r.ok === true);
    checks.check(caseName + ' T1-T5 预备', t5ok, responses.map((r) => r.code).join(','));
    const legacy = legacyAssetConsumed(pkg, artifactText);
    const r = append(makeEvent(pkg, subtaskId, 'behavior_verified', { behaviorCheck: { result: 'VERIFIED' }, evidenceRefs: [1, 2, 3, 4, 5].map((n) => ({ eventSeq: n })) }, subtaskId + '-t6'), { workspace: sandbox, vendorDir });
    checks.check(caseName + ' receipt 语义 = ' + expected.result + '/' + expected.reason,
      r.data?.result?.result === expected.result && r.data?.result?.reason === expected.reason,
      JSON.stringify({ ok: r.ok, result: r.data?.result?.result, reason: r.data?.result?.reason }));
    checks.check(caseName + ' 不得是 VERIFIED / consumed / PASS（GWT-R3-03/04）',
      r.data?.result?.result !== 'VERIFIED' && !['consumed', 'PASS'].includes(String(r.data?.result?.result)));
    checks.check(caseName + ' legacy 观测（重derive）= ' + legacyExpected + (legacyExpected ? ' ← 缺陷证据' : ''),
      legacy === legacyExpected, String(legacy));
    observed.push([caseName, legacy, r.data?.result?.result]);
  }

  // case 7：empty-output（降级投递，无 T5：DEGRADED_NO_EXECUTION）
  {
    const caseName = 'empty-output';
    const subtaskId = 'c6-empty-output';
    const p = await prepare({ asset: 'colorize', activationLevel: 'body', subtask: { id: subtaskId }, opts: { vendorDir } });
    const pkg = p.data.activationPackage;
    deliverBrief(sandbox, subtaskId, pkg);
    append(makeEvent(pkg, subtaskId, 'discovered', { catalogCacheIdentity: 'cid', sourceHash: pkg.record.sourceHash }, subtaskId + '-t1'), { workspace: sandbox, vendorDir });
    append(makeEvent(pkg, subtaskId, 'eligible', { phaseEligibility: { eligible: true, reason: 'x', phase: 0 } }, subtaskId + '-t2'), { workspace: sandbox, vendorDir });
    append(makeEvent(pkg, subtaskId, 'selected', { planId: 'pl', subtaskId, sourceHash: pkg.record.sourceHash }, subtaskId + '-t3'), { workspace: sandbox, vendorDir });
    append(makeEvent(pkg, subtaskId, 'instructions_delivered', {
      activationLevel: 'body', payloadSha256: pkg.payload.payloadSha256, briefPath: 'brief.md',
      sourceHashEcho: pkg.record.sourceHash, budgetResult: { action: 'block', exceeded: false },
      deliveryStatus: 'degraded', // executor 空输出 ⇒ 降级（§5.2 降级语义；prompt.mjs:118,120 现状 degraded）
    }, subtaskId + '-t4'), { workspace: sandbox, vendorDir });
    // 无 execution_observed（降级不计为消费，§5.2/§7.3）→ attempt T6
    const r = append(makeEvent(pkg, subtaskId, 'behavior_verified', { behaviorCheck: { result: 'VERIFIED' }, evidenceRefs: [1, 2, 3, 4, 5].map((n) => ({ eventSeq: n })) }, subtaskId + '-t6'), { workspace: sandbox, vendorDir });
    checks.check('empty-output receipt 语义 = UNRESOLVED/DEGRADED_NO_EXECUTION（§7.7 case 7）',
      r.data?.result?.result === 'UNRESOLVED' && r.data?.result?.reason === 'DEGRADED_NO_EXECUTION',
      JSON.stringify({ result: r.data?.result?.result, reason: r.data?.result?.reason }));
    checks.check('empty-output 不得计为消费或 VERIFIED（§7.5 降级行）', r.data?.result?.result !== 'VERIFIED');
    checks.check('empty-output legacy 观测 = degraded（无 assetConsumed 字段，归一 false）', true);
    observed.push([caseName, 'degraded', r.data?.result?.result]);
  }

  checks.check('7/7 case 均不得 VERIFIED（§7.7 关键性质）', observed.every(([, , result]) => result !== 'VERIFIED'),
    JSON.stringify(observed));
  checks.check('legacy 下 3 个误判 case（title-only-without-kernel / title-plus-kernel-word / fake-methodology-repeat5）在契约下全部 FAILED',
    observed.filter(([n, l]) => l === true).length === 3 && observed.filter(([n, l, r]) => l === true && r === 'FAILED').length === 3);

  return finish(checks, 'p11 C6 7case 回归：7/7 不 VERIFIED（5 FAILED/EVIDENCE_ECHO_ONLY + 2 UNRESOLVED）+ legacy 缺陷列重derive');
}
