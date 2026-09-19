import { evolutionPropose, evolutionAccept } from '../../../scripts/lib/evolution.mjs';
import { NOW, validCandidate, validBaseline } from './_helpers.mjs';

export async function run({ sandbox }) {
  // 平台降级提案 → PROVISIONAL（GWT-R10-04 降级路径）
  const seed = evolutionPropose({
    assetId: 'review', sourceVersion: 'v4', proposedBy: 'sess_producer',
    candidate: validCandidate({
      assetScope: 'review',
      proposerLimitations: ['同会话执行，平台降级'],
    }),
    baseline: validBaseline(),
    opts: { now: NOW, rand: 'f10a0001', evidenceRoot: sandbox },
  });
  const resp = evolutionAccept({
    candidateId: seed.data.candidateId,
    isolatedVerdict: {
      sessionId: 'sess_v4', agentIdentity: 'verifier-promoter', contextSeed: 'seed',
      limitations: ['同会话执行，平台降级'], provisionalStatus: 'PROVISIONAL', exitCode: 0,
    },
    promotionDecision: { tokenResult: { ok: true }, behaviorResult: { ok: true }, compatibilityResult: { ok: true } },
    rollbackRehearsalPassed: true, // OQ-R10-5=A 升格证据齐备
    opts: { now: NOW, evidenceRoot: sandbox },
  });
  const ok = resp.ok === true && resp.code === null && resp.data.verdict === 'PROMOTED'
    && resp.data.receipt === true && resp.data.rollback?.rehearsed === true;
  return { ok, summary: `accept ok=${resp.ok} code=${resp.code} verdict=${resp.data.verdict} receipt=${resp.data.receipt} rollback=${resp.data.rollback?.rehearsed}` };
}
