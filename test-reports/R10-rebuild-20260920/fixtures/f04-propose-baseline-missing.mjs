import { evolutionPropose } from '../../../scripts/lib/evolution.mjs';
import { NOW, validCandidate, validBaseline } from './_helpers.mjs';

export async function run({ sandbox }) {
  const baseline = validBaseline();
  delete baseline.ciSection; // 五键缺 CI 段（OQ-R10-2=A fail-closed，不臆断补全）
  const resp = evolutionPropose({
    assetId: 'frontend-design',
    sourceVersion: 'v9',
    proposedBy: 'sess_producer',
    candidate: validCandidate(),
    baseline,
    opts: { now: NOW, rand: 'f04a0001', evidenceRoot: sandbox },
  });
  const ok = resp.ok === false && resp.code === 'BASELINE_MISSING';
  return { ok, summary: `propose expected BASELINE_MISSING got ok=${resp.ok} code=${resp.code}` };
}
