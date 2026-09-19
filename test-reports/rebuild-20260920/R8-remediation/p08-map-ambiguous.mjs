/** p08 — 清单 R8-02(d) / OQ-R8-4=A：映射歧义（多候选精确命中）⇒ 待 Owner 指定，
 * 不自动映射、不自动落 create-draft；finding 保持 REGISTERED + warnings 列候选。 */
import fs from 'node:fs';
import path from 'node:path';
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

  // 两个候选 R-task 的验收文件范围都覆盖 anchor 行 ⇒ 歧义
  const r = remediation.remediationRegister({
    finding: validFinding(sandbox),
    mapMode: 'map-to-existing',
    candidates: [
      { taskId: 'R2-catalog-acceptance', acceptanceFiles: [{ path: 'docs/sample-module.md', lineStart: 1, lineEnd: 11 }] },
      { taskId: 'R4-phase-acceptance', acceptanceFiles: [{ path: 'docs/sample-module.md', lineStart: 2, lineEnd: 5 }] },
    ],
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 81),
  });
  add('ambig.registered', r.ok === true && r.data.status === 'REGISTERED');
  add('ambig.noTaskRef', r.data.taskRef === null);
  add('ambig.noDraft', draftFiles(sandbox).length === 0);
  add('ambig.codeNull', r.code === null); // 歧义不在 §5.2 review 触发面内；注册成功 + Owner 指定待办走 warnings
  add('ambig.bothCandidatesNamed', r.warnings.some((w) => w.includes('R2-catalog-acceptance') && w.includes('R4-phase-acceptance')));
  add('ambig.ownerDesignation', r.warnings.some((w) => w.includes('Owner 指定')));

  // 自动两阶段（mapMode 缺省）遇歧义同样不得自动落 draft（OQ-R8-4=A "不自动落 create-draft"）
  const r2 = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'auto-mode ambiguous variant', critiqueFile: critiqueFixture(sandbox, 'critique-m.md', 'M') }),
    draft: draftComplete(), // 即使五要素齐备也不得自动落 draft
    candidates: [
      { taskId: 'R2-catalog-acceptance', acceptanceFiles: [{ path: 'docs/sample-module.md', lineStart: 1, lineEnd: 11 }] },
      { taskId: 'R4-phase-acceptance', acceptanceFiles: [{ path: 'docs/sample-module.md', lineStart: 2, lineEnd: 5 }] },
    ],
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 82),
  });
  add('ambig.autoNoDraftFallback', r2.data.status === 'REGISTERED' && r2.data.taskRef === null);
  add('ambig.autoNoDraftFile', draftFiles(sandbox).length === 0);

  // ledger 2 行（两次注册各一行），均 REGISTERED
  const ledger = ledgerLines(sandbox);
  add('ambig.ledgerTwo', ledger.length === 2 && ledger.every((x) => x.status === 'REGISTERED'));
  add('ambig.noTrackerRow', !fs.readFileSync(path.join(sandbox, 'plans', 'critique-backlog-tracker.md'), 'utf8').includes('fnd-20260920'));

  return verdict(checks, 'r8-02d-ambiguous');
}
