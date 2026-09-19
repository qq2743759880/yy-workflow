/** p10 — §5.3 / dev-plan:244 / OQ-R8-5=A：NO_ACTION 只能由 Owner 显式写入、内联 ledger 四字段、
 * 终态记录不可删除；非 Owner/空 reason/自身份 ⇒ fail-closed 零写入；register 永不自动产生 NO_ACTION。 */
import fs from 'node:fs';
import path from 'node:path';
import {
  remediation, verdict, c, opts, critiqueFixture,
  validFinding, seedAnchorFile, seedTracker, draftFiles,
  ledgerLines, trackerBytes, OWNER_CHANNEL_CODE,
} from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const add = (name, pass) => checks.push(c(name, pass));
  seedAnchorFile(sandbox);
  seedTracker(sandbox);

  // Owner 显式 NO_ACTION：mapMode='NO_ACTION' + ownerDecision（approvedBy='owner' + reason 必填）
  const r1 = remediation.remediationRegister({
    finding: validFinding(sandbox),
    mapMode: 'NO_ACTION',
    ownerDecision: { reason: 'upstream R-task already covers this failure mode; no separate remediation needed', approvedBy: 'owner' },
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 101),
  });
  add('noaction.ownerOk', r1.ok === true && r1.code === null);
  add('noaction.status', r1.data.status === 'NO_ACTION' && r1.data.taskRef === null);
  const rec = ledgerLines(sandbox)[0] ?? {};
  add('noaction.inlineFourFields', rec.status === 'NO_ACTION' && rec.noAction?.reason?.length > 0
    && rec.noAction?.owner === 'owner' && rec.noAction?.date === '2026-09-20'); // status+reason+owner+date 同条记录
  add('noaction.noSeparateFile', draftFiles(sandbox).length === 0
    && !fs.existsSync(path.join(sandbox, 'plans', 'active', 'remediation', 'no-action')));
  add('noaction.noTrackerRow', !trackerBytes(sandbox).includes('fnd-20260920'));

  // 终态记录不可删除：ledger 原行保留（无改写/无删除 API 面）
  const ledgerAfter = fs.readFileSync(path.join(sandbox, 'plans', 'active', 'remediation', 'findings.jsonl'), 'utf8');
  add('noaction.recordImmutable', ledgerAfter.includes('"status":"NO_ACTION"') && ledgerAfter.includes('upstream R-task already covers'));

  // 非 Owner ⇒ 拒绝（fail-closed 零写入）
  const linesBefore = ledgerLines(sandbox).length;
  const r2 = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'non-owner no-action attempt', critiqueFile: critiqueFixture(sandbox, 'critique-n.md', 'N') }),
    mapMode: 'NO_ACTION',
    ownerDecision: { reason: 'agent deciding on its own', approvedBy: 'agent-builder-02' },
    registeredBy: 'agent-builder-02',
    opts: opts(sandbox, 102),
  });
  add('noaction.nonOwnerRejected', r2.ok === false && r2.code === OWNER_CHANNEL_CODE);
  add('noaction.nonOwnerZeroWrite', ledgerLines(sandbox).length === linesBefore);

  // 空 reason ⇒ 拒绝（reason 必填非空）
  const r3 = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'empty reason attempt', critiqueFile: critiqueFixture(sandbox, 'critique-o.md', 'O') }),
    mapMode: 'NO_ACTION',
    ownerDecision: { reason: '', approvedBy: 'owner' },
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 103),
  });
  add('noaction.emptyReasonRejected', r3.ok === false && r3.code === OWNER_CHANNEL_CODE);
  add('noaction.emptyReasonZeroWrite', ledgerLines(sandbox).length === linesBefore);

  // registeredBy='owner'（注册方与 Owner 同身份）⇒ 隔离判定拒绝（§5.1 三身份可区分）
  const r4 = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'self-identity attempt', critiqueFile: critiqueFixture(sandbox, 'critique-p.md', 'P') }),
    mapMode: 'NO_ACTION',
    ownerDecision: { reason: 'self marked', approvedBy: 'owner' },
    registeredBy: 'owner',
    opts: opts(sandbox, 104),
  });
  add('noaction.isolationRejected', r4.ok === false && r4.code === OWNER_CHANNEL_CODE
    && r4.warnings.some((w) => w.includes('隔离判定')));
  add('noaction.isolationZeroWrite', ledgerLines(sandbox).length === linesBefore);

  // register 自动两阶段/map 永不自动产生 NO_ACTION
  const r5 = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'auto never no-action', critiqueFile: critiqueFixture(sandbox, 'critique-q.md', 'Q') }),
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 105),
  });
  add('noaction.neverAuto', r5.ok === true && r5.data.status !== 'NO_ACTION' && r5.warnings.every((w) => !w.includes('NO_ACTION')));

  return verdict(checks, 'r8-owner-only-no-action');
}
