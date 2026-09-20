/**
 * p16 — session namespace 全程一致（dev-plan R5a GWT3 / 清单 R5A-06 / D-1 修复 / OQ-R5-9=A）。
 * 可机验行为：namespaced 模式下投影读源必须随 session 命名空间（state/receipts/logs/journey
 * 同 namespace，不读根——修现状 inferSources 读根的 D-1）；journey.json 落点同 namespace；
 * legacy 无 session 保持现状根（state/journey 在 .tt-state/ 根、artifacts 在 workspace 根）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeJsonFixed } from './_helper.mjs';

export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  // 根（legacy）数据 + session A 数据并存
  // T8 加固①：所有夹具写入统一走 writeJsonFixed（mtime 固定），杜绝紧邻写跨刻度
  // ⇒ computeStale（OQ-R5-2=A 相对判据）不会因夹具时序误判 STALE（T7 D-4 / P2-3）。
  const rootArt = path.join(sandbox, 'artifacts', 'rootP');
  fs.mkdirSync(rootArt, { recursive: true });
  writeJsonFixed(path.join(rootArt, 'state-summary.json'), { schema: 'tt/state-summary@1', planId: 'rootP', status: 'done' });
  fs.mkdirSync(path.join(sandbox, '.tt-state'), { recursive: true });
  writeJsonFixed(path.join(sandbox, '.tt-state', 'state.json'), { schema: 'aa-plan/v1', id: 'root-plan', status: 'done', subtasks: [] });

  const aDir = path.join(sandbox, '.tt-state', 'alpha');
  const aArt = path.join(aDir, 'artifacts');
  fs.mkdirSync(path.join(aArt, 'as1'), { recursive: true });
  fs.mkdirSync(path.join(aArt, 'ap1'), { recursive: true });
  writeJsonFixed(path.join(aDir, 'state.json'), { schema: 'aa-plan/v1', id: 'ns-A-plan', status: 'done', subtasks: [{ id: 'as1', asset: 'sdlc', status: 'done' }] });
  writeJsonFixed(path.join(aArt, 'as1', 'receipt.json'), { subtaskId: 'as1', assetId: 'sdlc', events: [{ transition: 'behavior_verified' }], result: 'VERIFIED' });
  writeJsonFixed(path.join(aArt, 'ap1', 'state-summary.json'), { schema: 'tt/state-summary@1', planId: 'ap1', status: 'done' });

  // namespaced read：读源随 session（不串根）
  const ra = m.journey.read({ workspace: sandbox, session: 'alpha', mode: 'full' });
  const ja = ra.data.journey;
  const readsSessionOnly = ja.plans.some((p) => p.planId === 'ns-A-plan')
    && !ja.plans.some((p) => p.planId === 'rootP' || p.planId === 'root-plan');
  const evidenceNs = ja.evidence.every((e) => e.path.startsWith('.tt-state/alpha/'));
  const healthy = ja.displayStatus === 'AUTHORIZED' || ja.displayStatus === 'OBSERVED';

  // namespaced project：落点同 namespace（.tt-state/alpha/journey.json），根 journey 不被写
  const pa = m.journey.project({ workspace: sandbox, session: 'alpha' });
  const landedNs = pa.data.persistedTo === '.tt-state/alpha/journey.json'
    && fs.existsSync(path.join(aDir, 'journey.json'))
    && !fs.existsSync(path.join(sandbox, '.tt-state', 'journey.json'));

  // legacy read：现状根仍可读（state 根 + workspace 根 artifacts）
  const rl = m.journey.read({ workspace: sandbox, mode: 'full' });
  const legacyRootReadable = rl.ok === true
    && rl.data.journey.plans.some((p) => p.planId === 'root-plan')
    && rl.data.journey.plans.some((p) => p.planId === 'rootP')
    && !rl.data.journey.plans.some((p) => p.planId === 'ns-A-plan');

  const ok = readsSessionOnly && evidenceNs && healthy && landedNs && legacyRootReadable;
  return { ok, summary: `namespace一致: session只读session=${readsSessionOnly} evidence全在ns=${evidenceNs} 健康=${ja.displayStatus} 落点同ns=${landedNs} legacy根可读=${legacyRootReadable}` };
}
