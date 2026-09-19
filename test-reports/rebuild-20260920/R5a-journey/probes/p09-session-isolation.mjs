/**
 * p09 — session selection 隔离（R5A-03 / GWT-R5A-03 / OQ-R5-9=A）。
 * 可机验行为：session A/B 各自 state 齐备时，read 只读所选 session 的源（禁跨 session
 * 串读）；无 session 保留 legacy 缺省根路径（.tt-state/ 根 + workspace 根 artifacts）；
 * namespaced 布局 = .tt-state/<sessionId>/{state.json, journey.json, artifacts/…}。
 */
import fs from 'node:fs';
import path from 'node:path';

export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  const tt = path.join(sandbox, '.tt-state');
  for (const sess of ['session-a', 'session-b']) {
    const dir = path.join(tt, sess);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ schema: 'aa-plan/v1', id: 'plan-' + sess, status: 'executing', subtasks: [] }));
  }
  fs.mkdirSync(tt, { recursive: true });
  fs.writeFileSync(path.join(tt, 'state.json'), JSON.stringify({ schema: 'aa-plan/v1', id: 'legacy-root-plan', status: 'planning', subtasks: [] }));

  const ra = m.journey.read({ workspace: sandbox, session: 'session-a', mode: 'full' });
  const rb = m.journey.read({ workspace: sandbox, session: 'session-b', mode: 'full' });
  const rl = m.journey.read({ workspace: sandbox, mode: 'full' }); // 无 session → legacy 根

  const aOnly = ra.ok === true && ra.data.journey.plans.some((p) => p.planId === 'plan-session-a')
    && !ra.data.journey.plans.some((p) => p.planId === 'plan-session-b' || p.planId === 'legacy-root-plan');
  const bOnly = rb.ok === true && rb.data.journey.plans.some((p) => p.planId === 'plan-session-b')
    && !rb.data.journey.plans.some((p) => p.planId === 'plan-session-a' || p.planId === 'legacy-root-plan');
  const legacyRoot = rl.ok === true && rl.data.journey.plans.some((p) => p.planId === 'legacy-root-plan')
    && !rl.data.journey.plans.some((p) => p.planId === 'plan-session-a' || p.planId === 'plan-session-b');
  const sessionEcho = ra.data.session === 'session-a' && ra.evidence.session === 'session-a' && rl.evidence.session === null;
  const evidenceScope = ra.evidence.sources.every((e) => e.sessionId === 'session-a');

  const ok = aOnly && bOnly && legacyRoot && sessionEcho && evidenceScope;
  return { ok, summary: `session隔离: A只读A=${aOnly} B只读B=${bOnly} legacy根=${legacyRoot} session回声=${sessionEcho} evidence随session=${evidenceScope}` };
}
