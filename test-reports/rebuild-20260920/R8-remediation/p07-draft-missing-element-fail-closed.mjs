/** p07 — 清单 R8-03(a) / OQ-R8-5=A：draft 五要素不齐 ⇒ fail-closed 不写 draft、无 draftId、
 * finding 保持 REGISTERED + warnings 列缺失项；禁止"先落盘后补齐"。 */
import fs from 'node:fs';
import path from 'node:path';
import {
  remediation, verdict, c, opts,
  validFinding, seedAnchorFile, draftComplete, seedTracker, critiqueFixture,
  ledgerLines, draftFiles,
} from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const add = (name, pass) => checks.push(c(name, pass));
  seedAnchorFile(sandbox);
  seedTracker(sandbox);

  // 缺 contractImpact ⇒ fail-closed 不写 draft
  const { contractImpact: _omit1, ...d1 } = draftComplete();
  const r1 = remediation.remediationRegister({
    finding: validFinding(sandbox),
    mapMode: 'create-draft',
    draft: d1,
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 71),
  });
  add('missing.okTrueCodeNull', r1.ok === true && r1.code === null);
  add('missing.statusRegistered', r1.data.status === 'REGISTERED' && r1.data.taskRef === null);
  add('missing.noDraftFile', draftFiles(sandbox).length === 0);
  add('missing.noDraftIdInRef', !/^rem-/.test(String(r1.data.taskRef)));
  add('missing.warningNamesElement', r1.warnings.some((w) => w.includes('contractImpact') && w.includes('fail-closed')));
  add('missing.ledgerOneRegistered', ledgerLines(sandbox).length === 1 && ledgerLines(sandbox)[0].status === 'REGISTERED');

  // 缺 gwts / nonGoals 空数组 / dependencies 空数组 变体
  const { gwts: _omit2, ...d2 } = draftComplete();
  const r2 = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'missing gwts variant', critiqueFile: critiqueFixture(sandbox, 'critique-i.md', 'I') }),
    mapMode: 'create-draft',
    draft: d2,
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 72),
  });
  add('missing.gwtsRejected', r2.data.status === 'REGISTERED' && r2.warnings.some((w) => w.includes('gwts')));

  const r3 = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'empty nonGoals variant', critiqueFile: critiqueFixture(sandbox, 'critique-j.md', 'J') }),
    mapMode: 'create-draft',
    draft: draftComplete({ nonGoals: [] }),
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 73),
  });
  add('missing.emptyNonGoalsRejected', r3.data.status === 'REGISTERED' && draftFiles(sandbox).length === 0);

  const r4 = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'blank scope variant', critiqueFile: critiqueFixture(sandbox, 'critique-k.md', 'K') }),
    mapMode: 'create-draft',
    draft: draftComplete({ scope: '  ' }),
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 74),
  });
  add('missing.blankScopeRejected', r4.data.status === 'REGISTERED' && r4.warnings.some((w) => w.includes('scope')));

  // draft 缺失整体（create-draft 模式但未传 draft）⇒ 同一 fail-closed 面
  const r5 = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'no draft object variant', critiqueFile: critiqueFixture(sandbox, 'critique-l.md', 'L') }),
    mapMode: 'create-draft',
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 75),
  });
  add('missing.noDraftObjectRejected', r5.data.status === 'REGISTERED' && draftFiles(sandbox).length === 0);

  // 全程零 draft 落盘 + tracker 零写（REGISTERED 不触发承接项）
  add('missing.noDraftsEver', draftFiles(sandbox).length === 0);
  add('missing.ledgerFive', ledgerLines(sandbox).length === 5);
  add('missing.trackerNoAppend', !fs.readFileSync(path.join(sandbox, 'plans', 'critique-backlog-tracker.md'), 'utf8').includes('fnd-20260920'));

  return verdict(checks, 'r8-03a-missing-element');
}
