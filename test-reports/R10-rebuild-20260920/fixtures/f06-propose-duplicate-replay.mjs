import { evolutionPropose } from '../../../scripts/lib/evolution.mjs';
import { NOW, validCandidate, validBaseline } from './_helpers.mjs';

export async function run({ sandbox }) {
  const base = {
    assetId: 'frontend-design',
    sourceVersion: 'v9',
    proposedBy: 'sess_producer',
    idempotencyKey: 'k-f06',
    candidate: validCandidate(),
    baseline: validBaseline(),
    opts: { now: NOW, evidenceRoot: sandbox },
  };
  const r1 = evolutionPropose({ ...base, opts: { ...base.opts, rand: 'd5b2d6cf' } });
  const r2 = evolutionPropose({ ...base, opts: { ...base.opts, rand: 'f06b0002' } }); // 同幂等键重放
  const expectedId = 'cnd-20260917T025555Z-d5b2d6cf';
  const expectedWarn = `DUPLICATE_REPLAY: evolution.propose 已存在同 idempotencyKey 候选，返回原 candidateId ${expectedId}`;
  const ok = r1.data.candidateId === expectedId && r2.data.candidateId === expectedId
    && r2.data.duplicate === true && r2.warnings[0] === expectedWarn;
  return { ok, summary: `idem r1=${r1.data.candidateId} r2=${r2.data.candidateId} warnings=${r2.warnings[0] ?? ''}` };
}
