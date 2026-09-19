import { evolutionPropose, evolutionAccept, summarizeAssetStates } from '../../../scripts/lib/evolution.mjs';
import { NOW, validCandidate, validBaseline } from './_helpers.mjs';

export async function run({ sandbox }) {
  // 预置：1 个 PROMOTED（review）+ 1 个 REJECTED（colorize），其余 14 资产 UNCHANGED
  const promoted = evolutionPropose({
    assetId: 'review', sourceVersion: 'v4', proposedBy: 'sess_producer',
    candidate: validCandidate({ assetScope: 'review', proposerLimitations: ['同会话执行，平台降级'] }),
    baseline: validBaseline(),
    opts: { now: NOW, rand: 'f12a0001', evidenceRoot: sandbox },
  });
  evolutionAccept({
    candidateId: promoted.data.candidateId,
    isolatedVerdict: { sessionId: 'v', agentIdentity: 'verifier-f12', contextSeed: 'seed', limitations: [], provisionalStatus: 'PROVISIONAL', exitCode: 0 },
    promotionDecision: { tokenResult: { ok: true }, behaviorResult: { ok: true }, compatibilityResult: { ok: true } },
    rollbackRehearsalPassed: true,
    opts: { now: NOW, evidenceRoot: sandbox },
  });
  const rejected = evolutionPropose({
    assetId: 'colorize', sourceVersion: 'v3', proposedBy: 'sess_producer',
    candidate: validCandidate({ assetScope: 'colorize' }),
    baseline: validBaseline(),
    opts: { now: NOW, rand: 'f12b0002', evidenceRoot: sandbox },
  });
  evolutionAccept({
    candidateId: rejected.data.candidateId,
    isolatedVerdict: { sessionId: 'v', agentIdentity: 'verifier-f12b', contextSeed: 'seed', limitations: [], provisionalStatus: 'CANDIDATE', exitCode: 0 },
    promotionDecision: { tokenResult: { ok: true }, behaviorResult: { ok: true }, compatibilityResult: { ok: false } },
    rollbackRehearsalPassed: true,
    opts: { now: NOW, evidenceRoot: sandbox },
  });

  const resp = summarizeAssetStates({ evidenceRoot: sandbox });
  const aggJson = JSON.stringify(resp.data.aggregate);
  const ok = resp.ok === true && resp.data.rows === 16
    && aggJson === '{"UNCHANGED":14,"REJECTED":1,"PROMOTED":1}'
    && resp.data.hasGap === false;
  return { ok, summary: `rows=${resp.data.rows} aggregate=${aggJson}` };
}
