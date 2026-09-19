/**
 * p14 — GWT-R3-03 / 契约 §7.2 N1 / §7.5：selected-but-not-consumed。
 * 路由选中资产但 subtask 关闭时无 T4 事件 ⇒ not_consumed 收口，结果 = UNRESOLVED
 * （reason SELECTED_NOT_CONSUMED），不得是 consumed/PASS；决策结果进 data 不进 error（§7.5）。
 */
import { copyAsset, prepare, deliverBrief, makeEvent, append, createChecks, finish } from './_helper.mjs';

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = sandbox + '/vendor';
  copyAsset(vendorDir, 'colorize');

  const p = await prepare({ asset: 'colorize', activationLevel: 'body', subtask: { id: 'r3-03-st' }, opts: { vendorDir } });
  const pkg = p.data.activationPackage;
  const H = pkg.record.sourceHash;
  const ev = (transition, evidence, key) => makeEvent(pkg, 'r3-03-st', transition, evidence, key);

  append(ev('discovered', { catalogCacheIdentity: 'cid', sourceHash: H }, 'n1'), { workspace: sandbox, vendorDir });
  append(ev('eligible', { phaseEligibility: { eligible: true, reason: 'x', phase: 0 } }, 'n2'), { workspace: sandbox, vendorDir });
  append(ev('selected', { planId: 'pl', subtaskId: 'r3-03-st', sourceHash: H }, 'n3'), { workspace: sandbox, vendorDir });

  // subtask 关闭（无 T4）⇒ N1 not_consumed
  const r = append(ev('not_consumed', { subtaskId: 'r3-03-st', closeReason: 'subtask closed without delivery' }, 'n4'), { workspace: sandbox, vendorDir });
  checks.check('not_consumed ok:true（决策结果非错误，进 data 不进 error——§7.5）', r.ok === true, JSON.stringify(r.code));
  checks.check('result = UNRESOLVED / SELECTED_NOT_CONSUMED（GWT-R3-03）',
    r.data?.result?.result === 'UNRESOLVED' && r.data?.result?.reason === 'SELECTED_NOT_CONSUMED',
    JSON.stringify(r.data?.result));
  checks.check('结果不得是 consumed/PASS', !['consumed', 'PASS', 'VERIFIED'].includes(r.data?.result?.result));
  checks.check('收口 transition = not_consumed（终态，负）', r.data?.state === 'not_consumed' && r.data?.transition === 'not_consumed');

  // 终态后不得再投递/验证（负终态 → 正终态禁止，§7.2）
  const r2 = append(ev('instructions_delivered', {
    activationLevel: 'body', payloadSha256: pkg.payload.payloadSha256, briefPath: 'brief.md',
    sourceHashEcho: H, budgetResult: { action: 'block' },
  }, 'n5'), { workspace: sandbox, vendorDir });
  checks.check('负终态后追加 T4 ⇒ RECEIPT_INVALID（不得负终态 → 正终态）', r2.ok === false && r2.code === 'RECEIPT_INVALID');

  // not_consumed 前置谓词：已有 T4 事件的链不得 N1（§7.3：subtask 关闭时该 (subtaskId, assetId) 无 T4 事件）
  const p2 = await prepare({ asset: 'colorize', activationLevel: 'body', subtask: { id: 'r3-03-st2' }, opts: { vendorDir } });
  const pkg2 = p2.data.activationPackage;
  const H2 = pkg2.record.sourceHash;
  const ev2 = (transition, evidence, key) => makeEvent(pkg2, 'r3-03-st2', transition, evidence, key);
  append(ev2('discovered', { catalogCacheIdentity: 'cid', sourceHash: H2 }, 'm1'), { workspace: sandbox, vendorDir });
  append(ev2('eligible', { phaseEligibility: { eligible: true, reason: 'x', phase: 0 } }, 'm2'), { workspace: sandbox, vendorDir });
  append(ev2('selected', { planId: 'pl', subtaskId: 'r3-03-st2', sourceHash: H2 }, 'm3'), { workspace: sandbox, vendorDir });
  deliverBrief(sandbox, 'r3-03-st2', pkg2);
  append(ev2('instructions_delivered', {
    activationLevel: 'body', payloadSha256: pkg2.payload.payloadSha256, briefPath: 'brief.md',
    sourceHashEcho: H2, budgetResult: { action: 'block' },
  }, 'm4'), { workspace: sandbox, vendorDir });
  const r3 = append(ev2('not_consumed', { subtaskId: 'r3-03-st2', closeReason: 'late close' }, 'm5'), { workspace: sandbox, vendorDir });
  checks.check('有 T4 的链 not_consumed ⇒ RECEIPT_INVALID（§7.3 N1 谓词）', r3.ok === false && r3.code === 'RECEIPT_INVALID');

  return finish(checks, 'p14 选中未消费：N1 not_consumed → UNRESOLVED/SELECTED_NOT_CONSUMED，非 consumed/PASS');
}
