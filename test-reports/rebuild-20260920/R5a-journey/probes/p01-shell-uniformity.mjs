/**
 * p01 — 响应壳一致性（R5A-10 / C-R5 §5 / dev-plan :306-307 / :314）。
 * 可机验行为：统一壳 {ok, code, data, evidence, warnings} 键集在成功与失败间完全一致；
 * 成功时 code=null；错误码集合严格 = 五码，不出现发明的新码；未知操作不发明新码。
 */
import fs from 'node:fs';
import path from 'node:path';

export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  const SHELL_KEYS = ['ok', 'code', 'data', 'evidence', 'warnings'];
  const probes = [
    m.journey.read({ workspace: sandbox }),                                     // 失败壳（NOT_FOUND）
    m.journey.project({ workspace: sandbox }),                                  // 成功壳（PARTIAL）
    m.journey.read({ workspace: sandbox, session: '../evil' }),                 // 失败壳（INVALID）
    m.journey.project({ workspace: sandbox, mode: 'bogus' }),                   // 失败壳（INVALID）
    m.run('journey.unknown', { workspace: sandbox }),                           // 未知操作
    m.journey.read({ workspace: sandbox, mode: 'full' }),                       // 失败壳（NOT_FOUND, full）
  ];
  const keyOk = probes.every((r) => {
    const ks = Object.keys(r).sort().join(',');
    return ks === SHELL_KEYS.slice().sort().join(',');
  });
  const success = probes.find((r) => r.ok === true);
  const successCodeNull = !success || success.code === null;
  const fiveCodes = JSON.stringify(m.ERROR_CODES.slice().sort()) === JSON.stringify(
    ['JOURNEY_INVALID', 'JOURNEY_NOT_FOUND', 'JOURNEY_STALE', 'PROJECTION_CONFLICT', 'PROJECTION_SOURCE_INVALID'].sort());
  const unknownOpCode = probes[4].code === 'JOURNEY_INVALID';
  const warningsAreArrays = probes.every((r) => Array.isArray(r.warnings));
  const evidencePresent = probes.every((r) => r.evidence != null);
  const noInventedCode = probes.every((r) => r.code === null || m.ERROR_CODES.includes(r.code));
  const allJson = JSON.stringify(probes);
  const noSuccessLiteral = !allJson.includes('"SUCCESS"') && !allJson.includes('SUCCESS"');

  const ok = keyOk && successCodeNull && fiveCodes && unknownOpCode && warningsAreArrays && evidencePresent && noInventedCode && noSuccessLiteral;
  const detail = `keys=${keyOk} successCodeNull=${successCodeNull} fiveCodes=${fiveCodes} unknownOp=${unknownOpCode} warningsArr=${warningsAreArrays} evidence=${evidencePresent} noInvent=${noInventedCode} noSuccessLiteral=${noSuccessLiteral}`;
  return { ok, summary: 'shell 统一（键集成败一致）: ' + detail };
}
