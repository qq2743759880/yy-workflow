/** p01 — GWT-R4-01 no unauthorized skip（清单 R4-01a）：前置未满足的正常转换被拒 PHASE_PREREQ_UNMET，canonical state 不变；check 走 data 通道（OQ-R4-7=A）。 */
import fs from 'node:fs';
import path from 'node:path';
import phase from '../../../scripts/lib/phase.mjs';
import { NOW, stateFixture, seedState, stateFileOf, shellOk, verdict } from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const c = (name, pass) => checks.push({ name, pass });
  seedState(sandbox, stateFixture()); // reviewing + s1 done + assetConsumed:true 裸布尔（telemetry 陷阱）+ 无 receipt
  const ws = sandbox;

  // (a1) phase.check：查询语义——ok:true + code='PHASE_PREREQ_UNMET' + data.allowed=false（data 通道，OQ-R4-7=A）
  const chk = await phase.checkPhase({ workspace: ws, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('check.shell', shellOk(chk));
  c('check.dataChannel', chk.ok === true && chk.code === 'PHASE_PREREQ_UNMET');
  c('check.allowedFalse', chk.data.allowed === false && Array.isArray(chk.data.missing) && chk.data.missing.length > 0);
  c('check.receiptCategory', JSON.stringify(chk.data.missing).includes('receipt_evidence'));
  c('check.evidenceKeys', ['snapshot', 'stateVersionEcho', 'sessionEcho', 'checkedAt'].every((k) => k in chk.evidence));

  // (a2) phase.transition（无 force）：error 通道拒绝，canonical state 字节不变（GWT-R4-01）
  const before = fs.readFileSync(stateFileOf(sandbox), 'utf8');
  const tr = await phase.transitionPhase({ workspace: ws, from: 'reviewing', to: 'done', opts: { now: NOW } });
  c('tr.shell', shellOk(tr));
  c('tr.rejected', tr.ok === false && tr.code === 'PHASE_PREREQ_UNMET');
  const after = fs.readFileSync(stateFileOf(sandbox), 'utf8');
  c('tr.canonicalUnchanged', before === after);
  c('tr.stateUnchangedFlag', tr.data.stateUnchanged === true);

  // 单一入口纪律：被拒转换不产生 transition 审计留痕（无静默 skip）
  c('tr.noAuditOnReject', !fs.existsSync(path.join(sandbox, '.tt-state', 'transitions.jsonl')));

  return verdict(checks, 'gwt-r4-01');
}
