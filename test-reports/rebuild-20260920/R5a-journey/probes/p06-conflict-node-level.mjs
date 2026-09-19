/**
 * p06 — PROJECTION_CONFLICT 节点级判定（R5A-02(c) / OQ-R5-7=A / §5.2）。
 * 可机验行为：同一 subtaskId 的两份权威 receipt 终态矛盾且不可归并 ⇒ ok=false +
 * PROJECTION_CONFLICT，data.conflicts 列节点级冲突双方 evidence（谁与谁冲突、各自
 * path/sha/时点/value）；展示态词汇差异（INFERRED vs AUTHORIZED）与跨维矛盾
 * （state vs receipts，OQ-R5-1 分维归并）不算冲突、不触发该码。
 */
export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  // 同维节点级冲突：s1 两份 receipt 终态矛盾（各自 result 缓存与事件重放一致，均为合法记录）
  const c = m.journey.project({
    workspace: sandbox,
    state: { id: 'p1', status: 'executing', subtasks: [{ id: 's1', asset: 'sdlc', status: 'done' }] },
    receipts: [
      { subtaskId: 's1', assetId: 'sdlc', events: [{ transition: 'behavior_verified' }], result: 'VERIFIED' },
      { subtaskId: 's1', assetId: 'sdlc', events: [{ transition: 'verification_failed' }], result: 'FAILED' },
    ],
  });
  const conflictCode = c.ok === false && c.code === 'PROJECTION_CONFLICT';
  const nodeLevel = Array.isArray(c.data.conflicts) && c.data.conflicts.length > 0
    && c.data.conflicts[0].node === 'assets.s1'
    && c.data.conflicts[0].sides.length === 2
    && c.data.conflicts[0].sides.every((s) => s.sourceKind === 'receipts' && (s.value === 'VERIFIED' || s.value === 'FAILED') && s.path);
  const notSilent = c.data.projection && c.data.projection.displayStatus === 'ERROR'
    && (c.data.projection.displayReason || '').includes('冲突'); // 不静默选一边渲染成成功

  // 负例 1：展示态词汇差异（log 旁证 INFERRED vs state 权威 AUTHORIZED）不算冲突
  const v = m.journey.project({
    workspace: sandbox,
    state: { id: 'p1', status: 'done', subtasks: [] },
    logs: [{ planId: 'p1', status: 'failed', source: 'log' }],
  });
  const vocabNotConflict = !(v.ok === false && v.code === 'PROJECTION_CONFLICT');

  // 负例 2：跨维矛盾（state=done vs receipt=FAILED）→ 分维归并 + discrepancy warning，不触发 CONFLICT
  const x = m.journey.project({
    workspace: sandbox,
    state: { id: 'p2', status: 'done', subtasks: [{ id: 's2', asset: 'planning', status: 'done' }] },
    receipts: [{ subtaskId: 's2', assetId: 'planning', events: [{ transition: 'verification_failed' }], result: 'FAILED' }],
  });
  const crossDimNotConflict = !(x.ok === false && x.code === 'PROJECTION_CONFLICT');
  const crossDimWarned = x.warnings.some((w) => w.includes('DISCREPANCY') && w.includes('s2'));
  const crossDimHonest = x.data.projection.steps[7].displayStatus === 'FAILED'; // 组级取最坏，不显示完成

  const ok = conflictCode && nodeLevel && notSilent && vocabNotConflict && crossDimNotConflict && crossDimWarned && crossDimHonest;
  return { ok, summary: `CONFLICT: code=${c.code} node=${nodeLevel} 不静默=${notSilent}; 词汇差异不算冲突=${vocabNotConflict}; 跨维分归并warn=${crossDimWarned} 最坏态=${x.data.projection.steps[7].displayStatus}` };
}
