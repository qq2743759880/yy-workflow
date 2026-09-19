import { evolutionPropose, evolutionAccept } from '../../../scripts/lib/evolution.mjs';
import { NOW, validCandidate, validBaseline } from './_helpers.mjs';

export async function run({ sandbox }) {
  const seed = evolutionPropose({
    assetId: 'planning', sourceVersion: 'v2', proposedBy: 'sess_producer',
    candidate: validCandidate({
      assetScope: 'planning',
      proposerLimitations: ['同会话执行，平台降级'], // PROVISIONAL
    }),
    baseline: validBaseline(),
    opts: { now: NOW, rand: 'f11a0001', evidenceRoot: sandbox },
  });
  const resp = evolutionAccept({
    candidateId: seed.data.candidateId,
    isolatedVerdict: {
      sessionId: 'sess_v5', agentIdentity: 'verifier-3', contextSeed: 'seed',
      limitations: ['同会话执行，平台降级'], provisionalStatus: 'PROVISIONAL', exitCode: 0,
    },
    promotionDecision: { tokenResult: { ok: true }, behaviorResult: { ok: true }, compatibilityResult: { ok: true } },
    // rollbackRehearsalPassed 缺失 → PROVISIONAL 不得越过排练直达 PROMOTED（OQ-R10-5=A）
    opts: { now: NOW, evidenceRoot: sandbox },
  });
  const ok = resp.ok === false && resp.code === 'PROMOTION_NOT_ALLOWED' && resp.data.verdict === 'UNRESOLVED';
  return { ok, summary: `accept expected PROVISIONAL→UNRESOLVED got ok=${resp.ok} code=${resp.code} verdict=${resp.data.verdict}` };
}
