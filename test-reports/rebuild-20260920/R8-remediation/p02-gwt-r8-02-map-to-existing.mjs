/** p02 — GWT-R8-02 / 清单 R8-02：精确命中 map-to-existing——taskRef、承接项追加（additive 不改既有行）、
 * 不创建重复任务；语义不命中；契约冻结面触发 review 门（§5.2 触发条件 2）。 */
import fs from 'node:fs';
import path from 'node:path';
import {
  remediation, verdict, c, opts, sha256, writeFile,
  validFinding, seedAnchorFile, critiqueFixture, seedTracker, trackerBytes, draftFiles, ledgerLines,
} from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const add = (name, pass) => checks.push(c(name, pass));
  seedAnchorFile(sandbox);
  const trackerBefore = seedTracker(sandbox);

  // (a)(b)(c)(d) 精确命中：anchor 行范围落在候选 R-task 验收文件范围内
  const r1 = remediation.remediationRegister({
    finding: validFinding(sandbox),
    mapMode: 'map-to-existing',
    candidates: [
      { taskId: 'R2-catalog-acceptance', acceptanceFiles: [{ path: 'docs/sample-module.md', lineStart: 1, lineEnd: 11 }] },
    ],
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 11),
  });
  add('map.okCodeNull', r1.ok === true && r1.code === null);
  add('map.taskRefHit', r1.data.taskRef === 'R2-catalog-acceptance');
  add('map.statusMapped', r1.data.status === 'MAPPED_EXISTING');
  add('map.matchedTaskEcho', r1.evidence.matchedTaskEcho === 'R2-catalog-acceptance');

  // 承接项追加：tracker 既有字节原样保留（前缀不变，只追加） + findingId/GWT/evidence requirement 在场
  const trackerAfter = trackerBytes(sandbox);
  add('tracker.appendOnlyPrefix', trackerAfter.startsWith(trackerBefore) && trackerAfter.length > trackerBefore.length);
  add('tracker.entryFindingId', trackerAfter.includes(r1.data.findingId));
  add('tracker.entryGwt', trackerAfter.includes('修复完成后可观察结果') && trackerAfter.includes('exits non-zero with named error'));
  add('tracker.entryEvidenceReq', trackerAfter.includes('类别 A 可复现锚点更新') && trackerAfter.includes('类别 B 外部来源对照'));
  add('tracker.taskNamed', trackerAfter.includes('R2-catalog-acceptance'));

  // 不创建重复任务：无 draft 文件、无新任务记录面（R4 state 零触碰）
  add('noDuplicate.noDrafts', draftFiles(sandbox).length === 0);
  add('noDuplicate.noTtState', !fs.existsSync(path.join(sandbox, '.tt-state')));

  // 语义不命中：title/impact 语义与候选任务名重叠，但 anchor 不在验收行范围 ⇒ 不映射（OQ-R8-4=A 不做语义匹配）
  const r2 = remediation.remediationRegister({
    finding: validFinding(sandbox, {
      title: 'R2-catalog-acceptance 语义相近但锚点越界的批判',
      impact: 'mentions R2-catalog-acceptance semantically but anchor is out of range',
      sourceAnchor: {
        kind: 'file:line', path: 'docs/sample-module.md', line: 3,
        sha256: sha256(fs.readFileSync(path.join(sandbox, 'docs/sample-module.md'))),
      },
      critiqueFile: critiqueFixture(sandbox, 'critique-c.md', 'C'),
    }),
    mapMode: 'map-to-existing',
    candidates: [{ taskId: 'R2-catalog-acceptance', acceptanceFiles: [{ path: 'docs/sample-module.md', lineStart: 50, lineEnd: 60 }] }],
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 12),
  });
  add('semantic.noMatch', r2.ok === true && r2.data.status === 'REGISTERED' && r2.data.taskRef === null);
  add('semantic.noDraftStill', draftFiles(sandbox).length === 0);

  // §5.2 触发条件 2：锚点在 contracts/** ⇒ 映射仍发生，但 review 门打开（code=REVIEW_REQUIRED，status 仍 MAPPED_EXISTING）
  writeFile(sandbox, 'contracts/sample-contract.md', 'sample frozen contract line 1\nsample frozen contract line 2\n');
  const r3 = remediation.remediationRegister({
    finding: validFinding(sandbox, {
      title: 'critique anchored inside frozen contract surface',
      sourceAnchor: {
        kind: 'file:line', path: 'contracts/sample-contract.md', line: 2,
        sha256: sha256(fs.readFileSync(path.join(sandbox, 'contracts', 'sample-contract.md'))),
      },
      critiqueFile: critiqueFixture(sandbox, 'critique-d.md', 'D'),
    }),
    mapMode: 'map-to-existing',
    candidates: [{ taskId: 'R6-closure-check', acceptanceFiles: [{ path: 'contracts/sample-contract.md', lineStart: 1, lineEnd: 5 }] }],
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 13),
  });
  add('frozenSurface.mappedStill', r3.data.status === 'MAPPED_EXISTING' && r3.data.taskRef === 'R6-closure-check');
  add('frozenSurface.reviewCode', r3.ok === true && r3.code === 'REMEDIATION_REVIEW_REQUIRED');
  add('frozenSurface.warning', r3.warnings.some((w) => w.includes('冻结契约面')));

  // 显式申报变体：contractSurfaceTouched=true 同样触发 review 门
  const r4 = remediation.remediationRegister({
    finding: validFinding(sandbox, {
      title: 'explicit contract surface declaration variant',
      critiqueFile: critiqueFixture(sandbox, 'critique-e.md', 'E'),
    }),
    mapMode: 'map-to-existing',
    candidates: [{ taskId: 'R2-routing-admission', acceptanceFiles: [{ path: 'docs/sample-module.md', lineStart: 1, lineEnd: 11 }] }],
    contractSurfaceTouched: true,
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 14),
  });
  add('frozenSurface.declaredVariant', r4.code === 'REMEDIATION_REVIEW_REQUIRED' && r4.data.status === 'MAPPED_EXISTING');

  // ledger 共 4 条（每次注册一行，幂等面由 p04 覆盖）
  add('ledger.fourLines', ledgerLines(sandbox).length === 4);

  return verdict(checks, 'gwt-r8-02');
}
