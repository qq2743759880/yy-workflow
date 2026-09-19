/**
 * p04 — STALE 相对判据（R5A-02(b) / OQ-R5-2=A / §5.1 JOURNEY_STALE）。
 * 可机验行为：journey 记录时点落后于其他权威源最新时点 ⇒ journey.read 返回
 * ok=false + code=JOURNEY_STALE + reason/source（data 仍携带 journey 投影体 + data.stale，
 * 幸存 render-core 消费口径）；时点对齐后不 STALE。相对判据，无墙钟数值（用文件 mtime 操控）。
 */
import fs from 'node:fs';
import path from 'node:path';

export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  const tt = path.join(sandbox, '.tt-state');
  const art = path.join(sandbox, 'artifacts');
  fs.mkdirSync(path.join(tt), { recursive: true });
  fs.mkdirSync(path.join(art, 'p1'), { recursive: true });
  fs.mkdirSync(path.join(art, 's1'), { recursive: true });

  const steps = Array.from({ length: 9 }, (_, i) => ({ step: i, name: 'n' + i, status: i <= 3 ? 'done' : 'pending', gates_passed: [], artifacts: [], updated_at: '2020-01-01T00:00:00.000Z' }));
  const journeyFile = path.join(tt, 'journey.json');
  fs.writeFileSync(journeyFile, JSON.stringify({ schema: 'yy/journey@1', steps, plans: [], updated_at: '2020-01-01T00:00:00.000Z' }));
  const stateFile = path.join(tt, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ schema: 'aa-plan/v1', id: 'p1', status: 'done', subtasks: [{ id: 's1', asset: 'sdlc', status: 'done' }] }));
  fs.writeFileSync(path.join(art, 's1', 'receipt.json'), JSON.stringify({ subtaskId: 's1', assetId: 'sdlc', events: [{ transition: 'behavior_verified' }], result: 'VERIFIED' }));
  fs.writeFileSync(path.join(art, 'p1', 'state-summary.json'), JSON.stringify({ schema: 'tt/state-summary@1', planId: 'p1', cluster: 'T1', status: 'done' }));

  const OLD = new Date('2020-01-01T00:00:00.000Z').getTime();
  const NEW = new Date('2026-01-01T00:00:00.000Z').getTime();
  fs.utimesSync(journeyFile, new Date(OLD), new Date(OLD));
  for (const f of [stateFile, path.join(art, 's1', 'receipt.json'), path.join(art, 'p1', 'state-summary.json')]) {
    fs.utimesSync(f, new Date(NEW), new Date(NEW));
  }

  const stale = m.journey.read({ workspace: sandbox });
  const staleOk = stale.ok === false && stale.code === 'JOURNEY_STALE';
  const hasBody = stale.data.journey && stale.data.journey.displayStatus === 'STALE';
  const staleInfo = stale.data.stale && typeof stale.data.stale.reason === 'string'
    && stale.data.stale.reason.includes('落后') && stale.data.stale.lagging && stale.data.stale.latest;
  const warnOrReason = (stale.data.journey.displayReason || '').includes('落后') || stale.warnings.length > 0;

  // 阶段 2：记录推进到权威源之后（等价真实 --update 后形态；记录内部 updated_at 是比 mtime
  // 更精确的时点回声，gather 优先取它）。此时 journey 非落后方 ⇒ 不占用 JOURNEY_STALE 码，
  // 上游源落后仅以可见 STALE 展示态呈现（ok=true，data 通道）。
  const ALIGNED = '2026-01-01T00:01:00.000Z';
  const alignedSteps = steps.map((s) => ({ ...s, updated_at: ALIGNED }));
  fs.writeFileSync(journeyFile, JSON.stringify({ schema: 'yy/journey@1', steps: alignedSteps, plans: [], updated_at: ALIGNED }));
  fs.utimesSync(journeyFile, new Date(NEW + 60000), new Date(NEW + 60000));
  const ahead = m.journey.read({ workspace: sandbox });
  const aheadOk = ahead.ok === true && ahead.code === null;

  // 阶段 3：全部时点对齐 → 无任何落后 ⇒ 无 STALE，健康展示
  for (const f of [stateFile, path.join(art, 's1', 'receipt.json'), path.join(art, 'p1', 'state-summary.json')]) {
    fs.utimesSync(f, new Date(NEW + 60000), new Date(NEW + 60000));
  }
  const fresh = m.journey.read({ workspace: sandbox });
  const freshOk = fresh.ok === true && fresh.code === null && fresh.data.journey.displayStatus !== 'STALE';

  const ok = staleOk && hasBody && staleInfo && warnOrReason && aheadOk && freshOk;
  return { ok, summary: `STALE: journey落后→code=${stale.code} body保留=${!!hasBody} reason/源=${!!staleInfo}; journey领先→不占码 ok=${ahead.ok}/code=${ahead.code}; 全对齐→${fresh.data.journey.displayStatus}` };
}
