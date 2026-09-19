/**
 * p03 — PARTIAL 判据（R5A-02(a) / OQ-R5-2=A / §3.1）。
 * 可机验行为：任一绑定源缺失 ⇒ 可见 PARTIAL + 缺项说明（reason 具名缺失源），绝不静默
 * AUTHORIZED/SUCCESS。仅 state 在场、receipts/logs 缺失场景。
 */
export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  const r = m.journey.project({
    workspace: sandbox,
    state: { id: 'p1', status: 'executing', subtasks: [] },
  });
  const j = r.data.projection;
  const okTrue = r.ok === true; // 正常决策结果进 data 通道，不进 error（§5）
  const partial = j.displayStatus === 'PARTIAL';
  const reasonNames = (j.displayReason || '').includes('receipts') && (j.displayReason || '').includes('logs');
  const warnNames = r.warnings.some((w) => w.includes('receipts')) && r.warnings.some((w) => w.includes('logs'));
  const notAuthorized = j.displayStatus !== 'AUTHORIZED' && j.displayStatus !== 'OBSERVED';
  const phaseAuth = j.phaseAuthoritative === true; // state 维仍如实投影（缺项说明不抹掉已有部分）
  // 逐个补源：补齐后仍缺另一源 → 仍 PARTIAL；四源齐 → 离开 PARTIAL
  const r2 = m.journey.project({
    workspace: sandbox,
    state: { id: 'p1', status: 'executing', subtasks: [] },
    receipts: [],
    logs: [{ planId: 'p1', status: 'executing', source: 'summary' }],
  });
  const stillPartial = r2.data.projection.displayStatus === 'PARTIAL'
    && (r2.data.projection.displayReason || '').includes('receipts');
  const r3 = m.journey.project({
    workspace: sandbox,
    state: { id: 'p1', status: 'executing', subtasks: [] },
    receipts: [{ subtaskId: 'x', events: [], result: null }],
    logs: [{ planId: 'p1', status: 'executing', source: 'summary' }],
  });
  const healthyWhenFull = r3.data.projection.displayStatus === 'AUTHORIZED' || r3.data.projection.displayStatus === 'OBSERVED';

  const ok = okTrue && partial && reasonNames && warnNames && notAuthorized && phaseAuth && stillPartial && healthyWhenFull;
  return { ok, summary: `PARTIAL: display=${j.displayStatus} reason具名=${reasonNames} warn具名=${warnNames} 渐进补源仍PARTIAL=${stillPartial} 四源齐→${r3.data.projection.displayStatus}` };
}
