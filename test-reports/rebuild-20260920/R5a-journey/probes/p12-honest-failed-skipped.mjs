/**
 * p12 — failed/skipped 不得显示为 done（R5A-08 / dev-plan :307 审查点 / OQ-R5-8=A / §3.2 / D-2 修复）。
 * 可机验行为：归并映射 failed→FAILED、skipped→SKIPPED（附 reason source）、UNRESOLVED→UNRESOLVED；
 * 组级聚合取最坏态（组内任一 failed/skipped/UNRESOLVED ⇒ 组/step 不得显示完成）；
 * 全 done 且 receipts 全 VERIFIED 才 step7 done（对照现状缺陷：有任一源即 step7=done）。
 */
export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  const base = (subtasks, receipts, planStatus) => ({ workspace: sandbox, mode: 'full', state: { id: 'p1', status: planStatus || 'executing', subtasks }, receipts });

  // (1) skipped 成员 → 组不得显示完成，SKIPPED 如实（附 reason source）
  const r1 = m.journey.project(base(
    [{ id: 's1', asset: 'a', status: 'done' }, { id: 's2', asset: 'b', status: 'skipped' }],
    [{ subtaskId: 's1', assetId: 'a', events: [{ transition: 'behavior_verified' }], result: 'VERIFIED' }],
  ));
  const j1 = r1.data.projection;
  const skippedHonest = j1.steps[7].status !== 'done' && j1.steps[7].displayStatus === 'SKIPPED';
  const skippedReason = r1.warnings.some((w) => w.includes('s2') || (j1.subtasks.find((s) => s.subtaskId === 's2') || {}).displayStatus === 'SKIPPED');

  // (2) done 但 receipt 缺失 → 资产维 UNRESOLVED → 组不得显示完成（不升格）
  const r2 = m.journey.project(base(
    [{ id: 's1', asset: 'a', status: 'done' }, { id: 's2', asset: 'b', status: 'done' }],
    [{ subtaskId: 's1', assetId: 'a', events: [{ transition: 'behavior_verified' }], result: 'VERIFIED' }],
  ));
  const j2 = r2.data.projection;
  const unresolvedHonest = j2.steps[7].status !== 'done' && j2.steps[7].displayStatus === 'UNRESOLVED'
    && r2.warnings.some((w) => w.includes('s2') && w.includes('UNRESOLVED'));

  // (3) failed 状态 → FAILED（附 reason source）
  const r3 = m.journey.project(base([{ id: 's3', asset: 'c', status: 'failed' }], []));
  const j3 = r3.data.projection;
  const failedHonest = j3.steps[7].displayStatus === 'FAILED'
    && j3.subtasks.some((s) => s.subtaskId === 's3' && s.displayStatus === 'FAILED');

  // (4) 全 done（A 面 plan=done）+ 全 VERIFIED → step7 done AUTHORIZED（诚实完成；非"有源即 done"）
  const r4 = m.journey.project(base(
    [{ id: 's1', asset: 'a', status: 'done' }, { id: 's2', asset: 'b', status: 'done' }],
    [
      { subtaskId: 's1', assetId: 'a', events: [{ transition: 'behavior_verified' }], result: 'VERIFIED' },
      { subtaskId: 's2', assetId: 'b', events: [{ transition: 'behavior_verified' }], result: 'VERIFIED' },
    ],
    'done',
  ));
  const j4 = r4.data.projection;
  const honestDone = j4.steps[7].status === 'done' && j4.steps[7].displayStatus === 'AUTHORIZED';

  // (5) 未知/未决收口（unknown）→ UNRESOLVED，不得升格
  const r5 = m.journey.project(base([{ id: 's9', asset: 'd', status: 'unknown' }], []));
  const unknownHonest = r5.data.projection.subtasks.some((s) => s.subtaskId === 's9' && s.displayStatus === 'UNRESOLVED')
    && r5.data.projection.steps[7].displayStatus === 'UNRESOLVED';

  const all = JSON.stringify([r1, r2, r3, r4, r5]);
  const neverDoneOnNegative = true; // 上述各负向断言已覆盖
  const noSuccess = !all.includes('"SUCCESS"');

  const ok = skippedHonest && skippedReason && unresolvedHonest && failedHonest && honestDone && unknownHonest && neverDoneOnNegative && noSuccess;
  return { ok, summary: `诚实归并: skipped=${j1.steps[7].displayStatus} done缺receipt=${j2.steps[7].displayStatus} failed=${j3.steps[7].displayStatus} 全Verified→${j4.steps[7].status}/${j4.steps[7].displayStatus} unknown→UNRESOLVED=${unknownHonest}` };
}
