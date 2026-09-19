/** p09 — §2.2 冲突分支 / 清单 R8-04(d)：同键异内容 ⇒ 不判 duplicate、不走 DUPLICATE 码，
 * 重新过闸后注册新 finding + duplicateOf + REMEDIATION_REVIEW_REQUIRED（五要素门收口）。 */
import {
  remediation, verdict, c, opts, critiqueFixture,
  validFinding, seedAnchorFile, draftComplete, seedTracker,
  ledgerLines, draftFiles,
} from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const add = (name, pass) => checks.push(c(name, pass));
  seedAnchorFile(sandbox);
  seedTracker(sandbox);

  const input = (over = {}, randKey = 91) => ({
    finding: validFinding(sandbox, over),
    mapMode: 'create-draft',
    draft: over.draft ?? draftComplete(),
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, randKey),
  });

  // 原始 finding（同 critique 文件 + title）
  const r1 = remediation.remediationRegister(input());
  add('orig.registered', r1.ok === true && r1.data.status === 'DRAFT_PROPOSED');

  // 冲突：同幂等键，impact 字节不等（同题不同证据）
  const r2 = remediation.remediationRegister(input({
    impact: 'errors are silently swallowed AND a retry loop hides the failure from the operator',
  }, 92));
  add('conflict.notDuplicate', r2.code !== 'REMEDIATION_DUPLICATE');
  add('conflict.newFindingId', r2.data.findingId !== r1.data.findingId);
  add('conflict.reviewCode', r2.ok === true && r2.code === 'REMEDIATION_REVIEW_REQUIRED');
  add('conflict.statusDraftProposed', r2.data.status === 'DRAFT_PROPOSED'); // 五要素齐 ⇒ DRAFT_PROPOSED（§6.2 冲突行）
  const ledger2 = ledgerLines(sandbox);
  add('conflict.ledgerTwoLines', ledger2.length === 2);
  add('conflict.duplicateOfLink', ledger2[1]?.duplicateOf === r1.data.findingId);
  add('conflict.newDraftWritten', draftFiles(sandbox).length === 2);
  add('conflict.noAutoMerge', ledger2[0]?.impact !== ledger2[1]?.impact); // 不自动合并证据（人工合并线索）

  // 冲突 + draft 五要素不齐 ⇒ fail-closed 停在 REGISTERED，code null + warnings 缺失项（不走 DUPLICATE 码）
  const { contractImpact: _omit, ...dIncomplete } = draftComplete();
  const r3 = remediation.remediationRegister(input({
    impact: 'third variant of the same-title critique with different evidence again',
    draft: dIncomplete,
  }, 93));
  add('conflict.incompleteRegistered', r3.ok === true && r3.code === null && r3.data.status === 'REGISTERED');
  add('conflict.incompleteWarning', r3.warnings.some((w) => w.includes('contractImpact')));
  add('conflict.noDraftAdded', draftFiles(sandbox).length === 2);
  add('conflict.ledgerThree', ledgerLines(sandbox).length === 3);
  add('conflict.linkThird', ledgerLines(sandbox)[2]?.duplicateOf === r1.data.findingId);

  // 全流程无 REMEDIATION_DUPLICATE（冲突分支不走 DUPLICATE 码，OQ-R8-2=A）
  add('conflict.neverDuplicateCode', [r1, r2, r3].every((r) => r.code !== 'REMEDIATION_DUPLICATE'));

  return verdict(checks, 'r8-04d-conflict');
}
