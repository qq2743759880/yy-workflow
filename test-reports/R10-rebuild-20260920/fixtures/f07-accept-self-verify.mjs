import { evolutionPropose, evolutionAccept } from '../../../scripts/lib/evolution.mjs';
import { NOW, validCandidate, validBaseline } from './_helpers.mjs';

export async function run({ sandbox }) {
  const seed = evolutionPropose({
    assetId: 'frontend-design', sourceVersion: 'v9', proposedBy: 'sess_producer',
    candidate: validCandidate(), baseline: validBaseline(),
    opts: { now: NOW, rand: 'f07a0001', evidenceRoot: sandbox },
  });
  const resp = evolutionAccept({
    candidateId: seed.data.candidateId,
    isolatedVerdict: {
      sessionId: 'sess_v1', agentIdentity: 'sess_producer', // 与 proposedBy 相同 = producer 自验
      contextSeed: 'seed', limitations: [], provisionalStatus: 'CANDIDATE', exitCode: 0,
    },
    promotionDecision: { tokenResult: { ok: true }, behaviorResult: { ok: true }, compatibilityResult: { ok: true } },
    rollbackRehearsalPassed: true,
    opts: { now: NOW, evidenceRoot: sandbox },
  });
  const expected = '验收方身份与 proposedBy 相同（producer 自验，§6.1 禁止）';
  const ok = resp.ok === false && resp.code === 'INDEPENDENT_VERIFICATION_REQUIRED' && resp.data.reason === expected;
  return { ok, summary: `accept expected self-verify fail got ok=${resp.ok} code=${resp.code} reason=${resp.data.reason}` };
}
