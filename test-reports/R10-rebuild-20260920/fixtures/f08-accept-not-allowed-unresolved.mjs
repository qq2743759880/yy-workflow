import { evolutionPropose, evolutionAccept } from '../../../scripts/lib/evolution.mjs';
import { NOW, validCandidate, validBaseline } from './_helpers.mjs';

export async function run({ sandbox }) {
  const seed = evolutionPropose({
    assetId: 'frontend-design', sourceVersion: 'v9', proposedBy: 'sess_producer',
    candidate: validCandidate(), baseline: validBaseline(),
    opts: { now: NOW, rand: 'f08a0001', evidenceRoot: sandbox },
  });
  const resp = evolutionAccept({
    candidateId: seed.data.candidateId,
    isolatedVerdict: {
      sessionId: 'sess_v2', agentIdentity: 'verifier-1', contextSeed: 'seed',
      limitations: [], provisionalStatus: 'CANDIDATE', exitCode: 0,
    },
    promotionDecision: {
      // tokenResult 整体缺失 → 三维不完整（OQ-R10-3=A 阈值数值 [待补充]，fail-closed 不编造）
      behaviorResult: { ok: true }, compatibilityResult: { ok: true },
    },
    rollbackRehearsalPassed: true,
    opts: { now: NOW, evidenceRoot: sandbox },
  });
  const unresolvedText = (resp.data.unresolved ?? []).join(',');
  const ok = resp.ok === false && resp.code === 'PROMOTION_NOT_ALLOWED'
    && resp.data.verdict === 'UNRESOLVED'
    && String(resp.warnings[0] ?? '').includes('等 Owner 给数: promotion 三维判定缺 tokenResult');
  return { ok, summary: `accept expected NOT_ALLOWED got ok=${resp.ok} code=${resp.code} verdict=${resp.data.verdict} unresolved=${unresolvedText}` };
}
