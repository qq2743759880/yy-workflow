import { evolutionPropose } from '../../../scripts/lib/evolution.mjs';
import { NOW, validCandidate, validBaseline } from './_helpers.mjs';

export async function run({ sandbox }) {
  const cand = validCandidate();
  delete cand.trigger; // 十项不变量缺 trigger（§2.1 fail-closed）
  const resp = evolutionPropose({
    assetId: 'frontend-design',
    sourceVersion: 'v9',
    proposedBy: 'sess_producer',
    candidate: cand,
    baseline: validBaseline(),
    opts: { now: NOW, rand: 'f02a0001', evidenceRoot: sandbox },
  });
  const expected = '候选缺少十项不变量字段: trigger（§2.1 fail-closed）';
  const ok = resp.ok === false && resp.code === 'CANDIDATE_INVALID' && resp.data.reason === expected;
  return { ok, summary: `propose expected INVALID got ok=${resp.ok} code=${resp.code} reason=${resp.data.reason}` };
}
