/** p04 — GWT-R8-04 / 清单 R8-04：幂等——同 (critiqueFile.sha256, normalizedTitle) 二次注册
 * ⇒ 零写、原 ID 原样回显、ok:true + REMEDIATION_DUPLICATE（data 通道，OQ-R8-2=A）。 */
import {
  remediation, verdict, c, opts, critiqueFixture,
  validFinding, seedAnchorFile, draftComplete, seedTracker,
  ledgerLines, ledgerText, draftFiles, trackerBytes,
} from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const add = (name, pass) => checks.push(c(name, pass));
  seedAnchorFile(sandbox);
  seedTracker(sandbox);

  const input = (over = {}) => ({
    finding: validFinding(sandbox, over),
    mapMode: 'create-draft',
    draft: draftComplete(),
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 31, over.opts ?? {}),
  });

  const r1 = remediation.remediationRegister(input());
  add('first.registered', r1.ok === true && r1.data.status === 'DRAFT_PROPOSED');
  const lines1 = ledgerLines(sandbox).length;
  const drafts1 = draftFiles(sandbox).length;
  const tracker1 = trackerBytes(sandbox);
  const ledger1 = ledgerText(sandbox);

  // (a)(b)(c) 第二次注册：tracker 不新增、draft 计数不变、返回原 ID + 原 taskRef + 原 status
  const r2 = remediation.remediationRegister(input());
  add('dup.okTrue', r2.ok === true);
  add('dup.codeDuplicate', r2.code === 'REMEDIATION_DUPLICATE');
  add('dup.originalId', r2.data.findingId === r1.data.findingId);
  add('dup.originalTaskRef', r2.data.taskRef === r1.data.taskRef);
  add('dup.originalStatus', r2.data.status === 'DRAFT_PROPOSED');
  add('dup.zeroLedgerWrite', ledgerLines(sandbox).length === lines1 && ledgerText(sandbox) === ledger1);
  add('dup.zeroDraftGrowth', draftFiles(sandbox).length === drafts1);
  add('dup.trackerUnchanged', trackerBytes(sandbox) === tracker1);
  add('dup.registeredAtEchoOriginal', r2.evidence.registeredAt === r1.evidence.registeredAt); // registeredAt 豁免进 evidence 对账
  add('dup.warningZeroWrite', r2.warnings.some((w) => w.includes('零写入')));
  add('dup.newIdNotIssued', r2.data.findingId === r1.data.findingId); // 清单 defect (a)：产生新 findingId 即违约

  // normalizedTitle 归一：同键大小写/空白变体仍命中幂等（§2.2 最小归一）
  const r3 = remediation.remediationRegister(input({
    title: `  ${validFinding(sandbox).title.toUpperCase()}  `.replace(/\s+/g, ' '),
  }));
  add('dup.normalizedTitleHit', r3.code === 'REMEDIATION_DUPLICATE' && r3.data.findingId === r1.data.findingId);
  add('dup.stillNoGrowth', ledgerLines(sandbox).length === lines1);

  // 幂等对 REGISTERED 记录同样成立（先注册 REGISTERED，再重放）
  const r4 = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'registered-state idempotency', critiqueFile: critiqueFixture(sandbox, 'critique-g.md', 'G') }),
    mapMode: 'map-to-existing',
    candidates: [],
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 32),
  });
  const linesBefore = ledgerLines(sandbox).length;
  const r5 = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'registered-state idempotency', critiqueFile: critiqueFixture(sandbox, 'critique-g.md', 'G') }),
    mapMode: 'map-to-existing',
    candidates: [],
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 33),
  });
  add('dup.registeredStateHit', r4.data.status === 'REGISTERED' && r5.code === 'REMEDIATION_DUPLICATE' && r5.data.findingId === r4.data.findingId);
  add('dup.registeredStateNoWrite', ledgerLines(sandbox).length === linesBefore);
  add('dup.registeredStatusEcho', r5.data.status === 'REGISTERED');

  return verdict(checks, 'gwt-r8-04');
}
