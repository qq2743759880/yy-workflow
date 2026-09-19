import { evolutionPropose } from '../../../scripts/lib/evolution.mjs';
import { NOW, validCandidate, validBaseline } from './_helpers.mjs';

export async function run({ sandbox }) {
  const resp = evolutionPropose({
    assetId: 'not-an-asset', // 不在 16 资产白名单（§8）
    sourceVersion: 'v9',
    proposedBy: 'sess_producer',
    candidate: validCandidate(),
    baseline: validBaseline(),
    opts: { now: NOW, rand: 'f03a0001', evidenceRoot: sandbox },
  });
  const ok = resp.ok === false && resp.code === 'CANDIDATE_INVALID';
  return { ok, summary: `propose expected INVALID(whitelist) got ok=${resp.ok} code=${resp.code}` };
}
