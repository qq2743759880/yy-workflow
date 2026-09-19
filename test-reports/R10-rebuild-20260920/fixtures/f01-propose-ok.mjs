import { evolutionPropose } from '../../../scripts/lib/evolution.mjs';
import { NOW, validCandidate, validBaseline } from './_helpers.mjs';

export async function run({ sandbox }) {
  const resp = evolutionPropose({
    assetId: 'frontend-design',
    sourceVersion: 'v9',
    proposedBy: 'sess_producer',
    candidate: validCandidate(),
    baseline: validBaseline(),
    opts: { now: NOW, rand: 'e0755918', evidenceRoot: sandbox },
  });
  const ok = resp.ok === true && resp.code === null
    && resp.data.candidateId === 'cnd-20260917T025555Z-e0755918'
    && resp.data.stored === true;
  return { ok, summary: `propose ok=${resp.ok} code=${resp.code} candidateId=${resp.data.candidateId} stored=${resp.data.stored}` };
}
