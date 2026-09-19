/**
 * p11 — inferred-only 标注（R5A-05 / dev-plan R5a GWT2 / OQ-R5-3=A / §4.3）。
 * 可机验行为：只有 state-summary/log、无权威 journey/state ⇒ 显示 INFERRED + source；
 * 不写 Journey（不落盘）、不授权派单；旁证全 done 时 step7 仅以 INFERRED 标注 done
 * （修复现状 tt-journey GWT4 行为的诚实版）；旁证 failed 时组级不显示完成。
 */
import fs from 'node:fs';
import path from 'node:path';

export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  const art = path.join(sandbox, 'artifacts', 'p1');
  fs.mkdirSync(art, { recursive: true });
  fs.writeFileSync(path.join(art, 'state-summary.json'), JSON.stringify({ schema: 'tt/state-summary@1', planId: 'p1', cluster: 'T4_FRONTEND', status: 'done' }));

  const r = m.journey.read({ workspace: sandbox, mode: 'full' });
  const j = r.data.journey;
  const inferred = r.ok === true && j.displayStatus === 'INFERRED';
  const sourceLabeled = (j.displayReason || '').includes('state-summary') && (j.displayReason || '').includes('INFERRED');
  const step7InferredDone = j.steps[7].status === 'done' && j.steps[7].displayStatus === 'INFERRED'; // 旁证推导，非授权
  const plansMarked = j.plans.some((p) => p.planId === 'p1' && p.inferred === true && p.summaryPath.includes('state-summary'));
  const notAuthorized = j.steps[7].displayStatus !== 'AUTHORIZED'; // inferred 永不授权
  const notPersisted = !fs.existsSync(path.join(sandbox, '.tt-state', 'journey.json')); // 不写 Journey
  const warnNote = r.warnings.some((w) => w.includes('INFERRED') && w.includes('不落盘'));
  const logEvidenceMarked = j.evidence.filter((e) => e.sourceKind === 'logs').every((e) => e.inferred === true);

  // 旁证 failed → 组级不得显示完成
  const art2 = path.join(sandbox, 'ws2', 'artifacts', 'p2');
  fs.mkdirSync(art2, { recursive: true });
  fs.writeFileSync(path.join(art2, 'state-summary.json'), JSON.stringify({ schema: 'tt/state-summary@1', planId: 'p2', cluster: 'T1', status: 'failed' }));
  const r2 = m.journey.read({ workspace: path.join(sandbox, 'ws2'), mode: 'full' });
  const negativeHonest = r2.data.journey.steps[7].status !== 'done'
    && r2.data.journey.steps[7].displayStatus === 'FAILED'
    && r2.data.journey.plans.some((p) => p.planId === 'p2' && p.displayStatus === 'FAILED');

  // project 同场景也不落盘（INFERRED 永不落盘，§4.3）
  const p2 = m.journey.project({ workspace: path.join(sandbox, 'ws2') });
  const projectNotPersisted = !fs.existsSync(path.join(sandbox, 'ws2', '.tt-state', 'journey.json'));

  const ok = inferred && sourceLabeled && step7InferredDone && plansMarked && notAuthorized && notPersisted && warnNote && logEvidenceMarked && negativeHonest && projectNotPersisted;
  return { ok, summary: `INFERRED: display=${j.displayStatus} step7=${j.steps[7].status}/${j.steps[7].displayStatus} source标注=${sourceLabeled} 未落盘=${notPersisted}/${projectNotPersisted} failed→不显示完成=${negativeHonest}` };
}
