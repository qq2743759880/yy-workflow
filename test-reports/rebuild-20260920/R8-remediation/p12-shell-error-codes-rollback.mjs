/** p12 — §6/§6.2/§5.4：响应壳恒键（data 三键/evidence 五键跨分支一致）、错误码面恒三、
 * 未知操作/mapMode fail-closed、supersede 追加式回滚（finding 本体证据不可变）。 */
import fs from 'node:fs';
import path from 'node:path';
import {
  remediation, verdict, c, opts, critiqueFixture,
  validFinding, seedAnchorFile, draftComplete, seedTracker,
  ledgerLines, ledgerText, draftFiles, evidenceKeys, dataKeys,
  EXPECT_DATA_KEYS, EXPECT_EVIDENCE_KEYS,
} from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const add = (name, pass) => checks.push(c(name, pass));
  seedAnchorFile(sandbox);
  seedTracker(sandbox);

  // 错误码面恒三（契约 §0 头部：不新增错误码）
  add('codes.exactlyThree', JSON.stringify(remediation.ERROR_CODES) === JSON.stringify(['INVALID_EVIDENCE', 'REMEDIATION_DUPLICATE', 'REMEDIATION_REVIEW_REQUIRED']));
  add('statuses.exactlySix', remediation.FINDING_STATUSES.length === 6);

  // run() 分发：唯一操作名 remediation.register；未知操作 fail-closed
  const rUnknown = remediation.run('remediation.approve', {});
  add('run.unknownOpRejected', rUnknown.ok === false && rUnknown.code === 'INVALID_EVIDENCE'
    && rUnknown.warnings.some((w) => w.includes('不新增操作名')));
  add('run.registerWorks', remediation.run('remediation.register', {
    finding: validFinding(sandbox),
    mapMode: 'map-to-existing',
    candidates: [],
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 131),
  }).ok === true);

  // 未知 mapMode fail-closed 零写入
  const before = ledgerText(sandbox);
  const rBadMode = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'bad mapMode variant', critiqueFile: critiqueFixture(sandbox, 'critique-r.md', 'R') }),
    mapMode: 'auto-approve-everything',
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 132),
  });
  add('mode.unknownRejected', rBadMode.ok === false && rBadMode.code === 'INVALID_EVIDENCE');
  add('mode.zeroWrite', ledgerText(sandbox) === before);

  // 显式 map-to-existing 未命中 ⇒ REGISTERED（不自动改道 create-draft，设计偏差登记 RESULTS.md）
  const rMiss = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'explicit map miss variant', critiqueFile: critiqueFixture(sandbox, 'critique-s.md', 'S') }),
    mapMode: 'map-to-existing',
    candidates: [],
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 133),
  });
  add('mode.explicitMissRegistered', rMiss.ok === true && rMiss.code === null && rMiss.data.status === 'REGISTERED');

  // 响应壳恒键：跨分支（成功映射/幂等/草稿/证据门）逐响应断言
  const rMap = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'shell mapped variant', critiqueFile: critiqueFixture(sandbox, 'critique-t.md', 'T') }),
    mapMode: 'map-to-existing',
    candidates: [{ taskId: 'R2-catalog-acceptance', acceptanceFiles: [{ path: 'docs/sample-module.md', lineStart: 1, lineEnd: 11 }] }],
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 134),
  });
  const rDup = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'shell mapped variant', critiqueFile: critiqueFixture(sandbox, 'critique-t.md', 'T') }),
    mapMode: 'map-to-existing',
    candidates: [{ taskId: 'R2-catalog-acceptance', acceptanceFiles: [{ path: 'docs/sample-module.md', lineStart: 1, lineEnd: 11 }] }],
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 135),
  });
  const rDraft = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'shell draft variant', critiqueFile: critiqueFixture(sandbox, 'critique-u.md', 'U') }),
    mapMode: 'create-draft',
    draft: draftComplete(),
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 136),
  });
  const rInvalid = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'shell invalid variant', omit: ['externalSource'], critiqueFile: critiqueFixture(sandbox, 'critique-v.md', 'V') }),
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 137),
  });
  const shells = [['mapped', rMap], ['duplicate', rDup], ['draft', rDraft], ['invalid', rInvalid]];
  for (const [name, sh] of shells) {
    add(`shell.${name}.dataKeys`, dataKeys(sh).join(',') === EXPECT_DATA_KEYS.join(','));
    add(`shell.${name}.evidenceKeys`, evidenceKeys(sh).join(',') === EXPECT_EVIDENCE_KEYS.join(','));
    add(`shell.${name}.types`, typeof sh.ok === 'boolean' && Array.isArray(sh.warnings)
      && (sh.code === null || remediation.ERROR_CODES.includes(sh.code)));
  }
  add('shell.dupChannel', rDup.ok === true && rDup.code === 'REMEDIATION_DUPLICATE'); // 幂等命中进 data 通道
  add('shell.draftChannel', rDraft.ok === true && rDraft.code === 'REMEDIATION_REVIEW_REQUIRED');
  add('shell.invalidChannel', rInvalid.ok === false && rInvalid.code === 'INVALID_EVIDENCE');
  add('shell.mappedCodeNull', rMap.ok === true && rMap.code === null && rMap.data.status === 'MAPPED_EXISTING');

  // §5.4 supersede：追加式记录；finding 本体证据/原始批判证据/G2.1 verdict 不可变
  const ledgerBefore = ledgerText(sandbox);
  const evidenceDirBefore = snapshotTree(sandbox, path.join(sandbox, 'evidence', 'critique'));
  const rSup = remediation.supersede({
    findingId: rDraft.data.findingId,
    reason: 'rollback: draft duplicated by manually filed task',
    supersedeBy: 'owner',
    opts: opts(sandbox, 138),
  });
  add('supersede.ok', rSup.ok === true && rSup.code === null && rSup.data.status === 'SUPERSEDED');
  add('supersede.taskRefKept', rSup.data.taskRef === rDraft.data.taskRef);
  const supFile = path.join(sandbox, 'plans', 'active', 'remediation', 'superseded.jsonl');
  add('supersede.appendOnlyLog', fs.existsSync(supFile));
  const entry = fs.existsSync(supFile) ? JSON.parse(fs.readFileSync(supFile, 'utf8').split('\n')[0]) : {};
  add('supersede.entryFields', entry.findingId === rDraft.data.findingId && entry.reason?.length > 0
    && entry.supersedeBy === 'owner' && /^[0-9T:Z.-]+$/.test(entry.supersededAt ?? '') && entry.kind === 'draft');
  add('supersede.ledgerUntouched', ledgerText(sandbox) === ledgerBefore);
  add('supersede.evidenceUntouched', snapshotTree(sandbox, path.join(sandbox, 'evidence', 'critique')) === evidenceDirBefore);
  add('supersede.draftStillExists', draftFiles(sandbox).includes(`${rDraft.data.findingId}.md`)); // 不删除，仅派生 SUPERSEDED
  add('supersede.effectiveStatus', remediation.effectiveStatus(sandbox, ledgerLines(sandbox).find((x) => x.findingId === rDraft.data.findingId)) === 'SUPERSEDED');
  const listed = remediation.listFindings(sandbox).find((x) => x.findingId === rDraft.data.findingId);
  add('supersede.notAccepted', listed && listed.accepted === false && listed.effectiveStatus === 'SUPERSEDED');

  // supersede 无 mapping/draft ⇒ fail-closed；缺 reason ⇒ fail-closed
  const rSup2 = remediation.supersede({ findingId: rInvalid.data.findingId ?? 'fnd-20260920-000000', reason: 'x', supersedeBy: 'owner', opts: opts(sandbox, 139) });
  add('supersede.noTaskRefRejected', rSup2.ok === false && rSup2.code === 'INVALID_EVIDENCE');
  const rSup3 = remediation.supersede({ findingId: rMap.data.findingId, reason: '', supersedeBy: 'owner', opts: opts(sandbox, 140) });
  add('supersede.reasonRequired', rSup3.ok === false && rSup3.code === 'INVALID_EVIDENCE');

  // 辅助面只读消费（R10 evolution 消费形态）：listFindings/cannotUnlock/isAccepted
  const all = remediation.listFindings(sandbox);
  add('readFacade.counts', all.length === ledgerLines(sandbox).length);
  add('readFacade.acceptedProjection', all.every((x) => x.accepted === remediation.isAccepted(x, x.effectiveStatus)));
  add('readFacade.normalizeTitle', remediation.normalizeTitle('  A   B '.toLowerCase()) === 'a b');

  return verdict(checks, 'r8-shell-and-rollback');
}

function snapshotTree(base, dir) {
  if (!fs.existsSync(dir)) return '';
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(snapshotTree(base, full));
    else out.push(`${path.relative(base, full)}:${fs.readFileSync(full).length}`);
  }
  return out.sort().join('|');
}
