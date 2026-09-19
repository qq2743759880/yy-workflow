import { evolutionPropose, evolutionAccept } from '../../../scripts/lib/evolution.mjs';
import { NOW, validCandidate, validBaseline } from './_helpers.mjs';

export async function run({ sandbox }) {
  const seed = evolutionPropose({
    assetId: 'colorize', sourceVersion: 'v3', proposedBy: 'sess_producer',
    candidate: validCandidate({ assetScope: 'colorize' }), baseline: validBaseline(),
    opts: { now: NOW, rand: 'f09a0001', evidenceRoot: sandbox },
  });
  const resp = evolutionAccept({
    candidateId: seed.data.candidateId,
    isolatedVerdict: {
      sessionId: 'sess_v3', agentIdentity: 'verifier-2', contextSeed: 'seed',
      limitations: [], provisionalStatus: 'CANDIDATE', exitCode: 0,
    },
    promotionDecision: {
      tokenResult: { ok: true }, behaviorResult: { ok: true },
      compatibilityResult: { ok: false }, // 结构/CI 回归（§6.2）
    },
    rollbackRehearsalPassed: true,
    opts: { now: NOW, evidenceRoot: sandbox },
  });
  const ok = resp.ok === false && resp.code === 'EVOLUTION_REGRESSION' && resp.data.verdict === 'REJECTED';
  return { ok, summary: `accept expected REGRESSION got ok=${resp.ok} code=${resp.code} verdict=${resp.data.verdict}` };
}
