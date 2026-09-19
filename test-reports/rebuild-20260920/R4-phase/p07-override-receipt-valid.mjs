/** p07 — override-receipt 合法路径（清单 R4-07a + §5.3 行 3/§5.4，OQ-R4-6/9=A）：批准先于执行、执行记录落 .tt-state/overrides/、executionId↔approvalId 双向引用、目标状态带 override 标注非静默。 */
import fs from 'node:fs';
import path from 'node:path';
import phase from '../../../scripts/lib/phase.mjs';
import { NOW, stateFixture, seedState, stateFileOf, makeApproval, shellOk, verdict } from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const c = (name, pass) => checks.push({ name, pass });
  const ws = path.join(sandbox, 'ws');
  seedState(ws, stateFixture()); // reviewing + 前置未满足（s1 无 receipt）

  const approval = makeApproval(ws); // approvalEvidence = 指令文件(真实落盘)路径 + SHA256；approvedAt 先于 NOW
  const tr = await phase.transitionPhase({
    workspace: ws, from: 'reviewing', to: 'done', force: true, ownerReceipt: approval,
    opts: { now: NOW, rand: 'cafef00d', toolTrace: 'probe p07' },
  });
  c('exec.ok', tr.ok === true && tr.code === null && shellOk(tr));
  c('exec.executionId', tr.data.override === 'exc-20260920T020000Z-cafef00d');
  c('exec.stateVersion', tr.data.stateVersionWritten === 1);
  c('exec.overrideWarning', tr.warnings.some((w) => w.includes('OVERRIDE_APPLIED')));

  // 执行记录（追加式、非 journey 投影、禁 vendor/，OQ-R4-9=A）
  const recFile = path.join(ws, '.tt-state', 'overrides', 'exc-20260920T020000Z-cafef00d.json');
  const rec = JSON.parse(fs.readFileSync(recFile, 'utf8'));
  c('audit.recordExists', fs.existsSync(recFile) && recFile.includes('.tt-state') && !recFile.includes('vendor'));
  c('audit.approvalRef', rec.approvalId === approval.approvalId);
  c('audit.prereqUnmet', Array.isArray(rec.prereqUnmet) && rec.prereqUnmet.length > 0 && rec.prereqUnmet[0].category === 'receipt_evidence');
  c('audit.toolTrace', rec.toolTrace === 'probe p07');
  c('audit.approvalHash', typeof rec.approvalHash === 'string' && /^[0-9a-f]{64}$/.test(rec.approvalHash));
  c('audit.fromTo', rec.fromState === 'reviewing' && rec.toState === 'done' && rec.sessionId === null);

  // 双向引用登记：approvalId ↔ executionId（§5.4(a)）
  const registry = JSON.parse(fs.readFileSync(path.join(ws, '.tt-state', 'overrides', '.approvals-registry.json'), 'utf8'));
  c('audit.bidirectional', Array.isArray(registry[approval.approvalId]) && registry[approval.approvalId][0].executionId === tr.data.override);

  // 目标状态带 override 标注，下游可辨识（非"前置自然满足"，GWT-R4-01）
  const state = JSON.parse(fs.readFileSync(stateFileOf(ws), 'utf8'));
  c('state.done', state.status === 'done' && state.stateVersion === 1);
  c('state.overrideMarked', state.lastTransition?.override === tr.data.override);

  // transition 审计流可见（非静默推进）
  const log = fs.readFileSync(path.join(ws, '.tt-state', 'transitions.jsonl'), 'utf8');
  c('state.auditVisible', log.includes('"override":"exc-20260920T020000Z-cafef00d"'));

  return verdict(checks, 'override-receipt-valid');
}
