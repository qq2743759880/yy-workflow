import { evolutionPropose } from '../../../scripts/lib/evolution.mjs';
import { NOW, validCandidate, validBaseline } from './_helpers.mjs';

export async function run({ sandbox }) {
  const base = {
    assetId: 'frontend-design',
    sourceVersion: 'v9',
    proposedBy: 'sess_producer',
    candidate: validCandidate(),
    baseline: validBaseline(),
    opts: { now: NOW, evidenceRoot: sandbox },
  };
  const first = evolutionPropose({ ...base, opts: { ...base.opts, rand: 'f05a0001' } }); // 开放候选落盘
  const second = evolutionPropose({
    ...base,
    idempotencyKey: 'k-f05', // 不同幂等键，排除 DUPLICATE_REPLAY 路径
    candidate: validCandidate({ rationale: 'second propose, same sourceVersion' }),
    opts: { ...base.opts, rand: 'f05b0002' },
  });
  const ok = first.ok === true && second.ok === false && second.code === 'ASSET_VERSION_CONFLICT';
  return { ok, summary: `propose expected VERSION_CONFLICT got ok=${second.ok} code=${second.code}` };
}
