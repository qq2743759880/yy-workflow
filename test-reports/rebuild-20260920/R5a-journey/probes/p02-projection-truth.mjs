/**
 * p02 — projection truth（R5A-01 / GWT-R5A-01 / OQ-R5-1 / OQ-R5-3）。
 * 可机验行为：给定权威 state + receipts + logs，投影报告权威 phase/progress + 各源 source
 * evidence；仅凭日志标签不能制造/否决完成态（分维归并：phase/progress 以 state 为权威、
 * 资产维以 receipts 为权威，矛盾 → discrepancy warning 双列，互不覆盖）。
 */
export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  // 权威：state done + receipt VERIFIED；旁证：log 标签谎称 failed
  const r = m.journey.project({
    workspace: sandbox,
    state: { id: 'p1', cluster: 'T1', status: 'done', subtasks: [{ id: 's1', asset: 'sdlc', status: 'done' }] },
    receipts: [{ subtaskId: 's1', assetId: 'sdlc', events: [{ transition: 'behavior_verified' }], result: 'VERIFIED' }],
    logs: [{ planId: 'p1', status: 'failed', source: 'log-label-only' }],
    mode: 'full',
  });
  const j = r.data.projection;
  const okTrue = r.ok === true && r.code === null;
  const authorized = j.displayStatus === 'AUTHORIZED';                     // 权威源支撑，不被 log 否决成负向
  const phaseAuth = j.phaseAuthoritative === true;                          // phase/progress 以 state 为权威
  const step7Done = j.steps[7].status === 'done' && j.steps[7].displayStatus === 'AUTHORIZED';
  const plansRaw = j.plans.some((p) => p.planId === 'p1' && p.status === 'done' && p.inferred === false); // state 维如实
  const logRowInferred = j.plans.some((p) => p.planId === 'p1' && p.inferred === true && p.displayStatus === 'FAILED'); // log 旁证只双列为 INFERRED/负向观察
  const discrepancy = r.warnings.some((w) => w.includes('DISCREPANCY') && w.includes('OQ-R5-1'));
  const evidenceKinds = new Set(r.evidence.sources.map((e) => e.sourceKind));
  const evidenceOk = evidenceKinds.has('state') && evidenceKinds.has('receipts') && evidenceKinds.has('logs');
  const logEvidenceMarked = r.evidence.sources.filter((e) => e.sourceKind === 'logs').every((e) => e.inferred === true);
  const assetVerified = j.assets.some((a) => a.subtaskId === 's1' && a.result === 'VERIFIED'); // 资产维以 receipts 为权威

  const ok = okTrue && authorized && phaseAuth && step7Done && plansRaw && logRowInferred && discrepancy && evidenceOk && logEvidenceMarked && assetVerified;
  return { ok, summary: `projection truth: ok=${okTrue} display=${j.displayStatus} phaseAuth=${phaseAuth} step7=${j.steps[7].status}/${j.steps[7].displayStatus} log旁证仅双列=${logRowInferred} discWarn=${discrepancy} evidence=[${[...evidenceKinds].join(',')}] logMarkedInferred=${logEvidenceMarked}` };
}
