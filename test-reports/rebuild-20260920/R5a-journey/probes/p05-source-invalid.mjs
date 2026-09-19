/**
 * p05 — 源畸形/违约 → PROJECTION_SOURCE_INVALID（R5A-02(d) / §5.3 / §5.2）。
 * 可机验行为：journey.project 遇 state/receipts 源不可解析或 schema 违约 ⇒ ok=false +
 * PROJECTION_SOURCE_INVALID + reason（fail-closed，不渲染成功、不崩溃）；
 * journey.read 无 PROJECTION_* 码（§1.2 不新增码）⇒ 同场景以可见 PARTIAL 展示态 + 具名 reason 落地。
 */
import fs from 'node:fs';
import path from 'node:path';

export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  const tt = path.join(sandbox, '.tt-state');
  fs.mkdirSync(tt, { recursive: true });
  fs.writeFileSync(path.join(tt, 'state.json'), 'not-json{{{');

  // project：state.json 不可解析 → PROJECTION_SOURCE_INVALID
  const p1 = m.journey.project({ workspace: sandbox });
  const projInvalid = p1.ok === false && p1.code === 'PROJECTION_SOURCE_INVALID'
    && (p1.data.reason || '').includes('state') && (p1.data.reason || '').includes('不可解析');

  // project：inline receipts 形状违约（events 非数组）→ PROJECTION_SOURCE_INVALID
  const p2 = m.journey.project({
    workspace: sandbox,
    state: { id: 'p1', status: 'done', subtasks: [] },
    receipts: [{ subtaskId: 's1', events: 'not-an-array' }],
  });
  const receiptInvalid = p2.ok === false && p2.code === 'PROJECTION_SOURCE_INVALID'
    && (p2.data.reason || '').includes('events');

  // project：inline state schema 违约（缺 id）→ PROJECTION_SOURCE_INVALID
  const p3 = m.journey.project({ workspace: sandbox, state: { status: 'done' } });
  const stateShape = p3.ok === false && p3.code === 'PROJECTION_SOURCE_INVALID';

  // read：同场景不崩溃、不误报成功；journey 本体不畸形 → 不用 JOURNEY_INVALID，
  // 以可见 PARTIAL（含不可读/不可解析判据，OQ-R5-2=A）+ 具名 reason 落地
  const r1 = m.journey.read({ workspace: sandbox });
  const readPartial = r1.data.journey && r1.data.projection === undefined
    && r1.data.journey.displayStatus === 'PARTIAL'
    && (r1.data.journey.displayReason || '').includes('state');
  const readNotSuccess = !(r1.data.journey && (r1.data.journey.displayStatus === 'AUTHORIZED' || r1.data.journey.displayStatus === 'OBSERVED'));

  const ok = projInvalid && receiptInvalid && stateShape && readPartial && readNotSuccess;
  return { ok, summary: `SOURCE_INVALID: project磁盘=${p1.code} inline=${p2.code} schema=${p3.code}; read→PARTIAL具名=${readPartial} 不渲染成功=${readNotSuccess}` };
}
