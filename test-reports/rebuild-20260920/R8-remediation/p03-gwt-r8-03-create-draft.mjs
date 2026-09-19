/** p03 — GWT-R8-03 / 清单 R8-03：未命中 → remediation-draft（五要素齐备、ownerReviewState=PENDING、
 * REVIEW_REQUIRED、非 implementation READY、不进 R4 state/不派单/不解锁）。 */
import fs from 'node:fs';
import path from 'node:path';
import {
  remediation, verdict, c, opts, critiqueFixture,
  validFinding, seedAnchorFile, draftComplete, seedTracker,
  draftFiles, ledgerLines,
} from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const add = (name, pass) => checks.push(c(name, pass));
  seedAnchorFile(sandbox);
  seedTracker(sandbox);
  const trackerBefore = fs.readFileSync(path.join(sandbox, 'plans', 'critique-backlog-tracker.md'), 'utf8');

  // (a)(b)(c) create-draft：五要素齐备 → draft 落盘 + PENDING + REVIEW_REQUIRED + DRAFT_PROPOSED
  const r1 = remediation.remediationRegister({
    finding: validFinding(sandbox),
    mapMode: 'create-draft',
    draft: draftComplete(),
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 21),
  });
  add('draft.reviewCode', r1.ok === true && r1.code === 'REMEDIATION_REVIEW_REQUIRED');
  add('draft.status', r1.data.status === 'DRAFT_PROPOSED');
  add('draft.idFormat', /^rem-20260920-[0-9a-f]{6}$/.test(r1.data.taskRef));
  add('draft.idMatchesFindingDate', r1.data.taskRef.slice(4, 12) === r1.data.findingId.slice(4, 12)); // rem-<同日期>（OQ-R8-6=A）

  // draft 载体：一 finding 一文件，文件名 = findingId；五要素 + ownerReviewState=PENDING + createdBy
  const draftFile = path.join(sandbox, 'plans', 'active', 'remediation', 'drafts', `${r1.data.findingId}.md`);
  add('draft.fileNamedByFindingId', fs.existsSync(draftFile));
  const md = fs.existsSync(draftFile) ? fs.readFileSync(draftFile, 'utf8') : '';
  const json = md ? JSON.parse(/```json\n([\s\S]*?)\n```/.exec(md)[1]) : {};
  add('draft.fiveElements', ['scope', 'nonGoals', 'dependencies', 'gwts', 'contractImpact']
    .every((k) => Array.isArray(json[k]) ? json[k].length > 0 : Boolean(json[k])));
  add('draft.ownerReviewPending', json.ownerReviewState === 'PENDING');
  add('draft.createdBy', json.createdBy === 'agent-builder-01' && json.draftId === r1.data.taskRef && json.findingId === r1.data.findingId);
  add('draft.reviewStateVocab', ['PENDING', 'APPROVED', 'REJECTED'].includes(json.ownerReviewState));

  // (d) 非 implementation READY：不进 R4 task state、不被派单、不解锁下游（无 .tt-state / state.json）
  add('draft.notReady.noTtState', !fs.existsSync(path.join(sandbox, '.tt-state')));
  add('draft.notReady.noStateJson', !fs.existsSync(path.join(sandbox, 'state.json')));
  add('draft.notReady.trackerUntouched', fs.readFileSync(path.join(sandbox, 'plans', 'critique-backlog-tracker.md'), 'utf8') === trackerBefore);

  // ledger 一行，taskRef = draftId（§1.3 映射结果）
  const lines = ledgerLines(sandbox);
  add('draft.ledgerTaskRef', lines.length === 1 && lines[0].taskRef === r1.data.taskRef && lines[0].status === 'DRAFT_PROPOSED');
  add('draft.filesCount', draftFiles(sandbox).length === 1);

  // 自动两阶段（mapMode 缺省）：先 map（未命中）再 create-draft——review 门同样触发（§3.1 不因"自动"跳过）
  const r2 = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'auto two-phase variant', critiqueFile: critiqueFixture(sandbox, 'critique-f.md', 'F') }),
    draft: draftComplete(),
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 22),
  });
  add('auto.phase2Draft', r2.data.status === 'DRAFT_PROPOSED' && r2.code === 'REMEDIATION_REVIEW_REQUIRED');
  add('auto.reviewWarning', r2.warnings.some((w) => w.includes('REMEDIATION_REVIEW_REQUIRED')));

  return verdict(checks, 'gwt-r8-03');
}
