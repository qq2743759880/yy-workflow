/** p02 — GWT-R4-02 owner confirmation gate（清单 R4-02）：无批准不推进 + 显式缺失批准诊断；--force 不改变该结果；前置自然满足时 --force 无效果（无 bypass 记录，§5.3 行 1）。 */
import fs from 'node:fs';
import path from 'node:path';
import phase from '../../../scripts/lib/phase.mjs';
import { NOW, stateFixture, seedState, stateFileOf, writeReceipt, shellOk, verdict } from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const c = (name, pass) => checks.push({ name, pass });
  const ws = sandbox;

  // (1) 前置未满足 + --force + 无任何 approval receipt ⇒ OWNER_APPROVAL_REQUIRED（缺失批准的显式诊断，非静默推进）
  seedState(sandbox, stateFixture());
  const before = fs.readFileSync(stateFileOf(sandbox), 'utf8');
  const tr1 = await phase.transitionPhase({ workspace: ws, from: 'reviewing', to: 'done', force: true, opts: { now: NOW } });
  c('forceNoApproval.code', tr1.ok === false && tr1.code === 'OWNER_APPROVAL_REQUIRED');
  c('forceNoApproval.shell', shellOk(tr1));
  c('forceNoApproval.diagnosis', tr1.data.missingApproval === true && typeof tr1.data.reason === 'string' && tr1.data.reason.length > 0);
  c('forceNoApproval.prereqListed', Array.isArray(tr1.data.prereqUnmet) && tr1.data.prereqUnmet.length > 0);
  c('forceNoApproval.stateUnchanged', fs.readFileSync(stateFileOf(sandbox), 'utf8') === before);

  // (2) 前置自然满足 + --force ⇒ force 无效果：正常执行转换，override=null（不产生任何 bypass 记录，§5.3 行 1）
  writeReceipt(sandbox, { subtaskId: 's1', assetId: 'implementation', terminal: 'verified' });
  const tr2 = await phase.transitionPhase({ workspace: ws, from: 'reviewing', to: 'done', force: true, opts: { now: NOW } });
  c('forceNoop.ok', tr2.ok === true && tr2.code === null);
  c('forceNoop.overrideNull', tr2.data.override === null);
  const state2 = JSON.parse(fs.readFileSync(stateFileOf(sandbox), 'utf8'));
  c('forceNoop.stateDone', state2.status === 'done');
  c('forceNoop.lastTransitionOverrideNull', state2.lastTransition?.override === null);
  const log = fs.readFileSync(path.join(sandbox, '.tt-state', 'transitions.jsonl'), 'utf8');
  c('forceNoop.noBypassRecord', !log.includes('"override":"exc-') && !fs.existsSync(path.join(sandbox, '.tt-state', 'overrides')));

  return verdict(checks, 'gwt-r4-02');
}
