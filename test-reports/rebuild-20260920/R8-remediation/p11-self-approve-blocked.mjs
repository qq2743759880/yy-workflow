/** p11 — §5.1/§3.2 / OQ-R8-3=A：自批禁止——draft 恒 PENDING；creator/非 owner/证据缺失 ⇒
 * 批准记录无效零写入；Owner 通道合法批准 → APPROVED（append-only 批准记录，draft md 不改写）。 */
import fs from 'node:fs';
import path from 'node:path';
import {
  remediation, verdict, c, opts, sha256, writeFile,
  validFinding, seedAnchorFile, draftComplete, seedTracker,
  draftFiles, OWNER_CHANNEL_CODE,
} from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const add = (name, pass) => checks.push(c(name, pass));
  seedAnchorFile(sandbox);
  seedTracker(sandbox);

  // 场景 A：creator（createdBy='owner'）通道自批 ⇒ defect 拒绝
  const rSelf = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'creator self-approve attempt' }),
    mapMode: 'create-draft',
    draft: draftComplete(),
    registeredBy: 'owner', // creator 冒用 Owner 身份
    opts: opts(sandbox, 111),
  });
  const selfDraftFile = path.join(sandbox, 'plans', 'active', 'remediation', 'drafts', `${rSelf.data.findingId}.md`);
  const selfDraftBefore = fs.existsSync(selfDraftFile) ? fs.readFileSync(selfDraftFile, 'utf8') : '';
  writeFile(sandbox, 'owner/directive-self.md', 'owner directive (self-approve probe)\n');
  const evSelf = `owner/directive-self.md#${sha256(fs.readFileSync(path.join(sandbox, 'owner/directive-self.md')))}`;
  const aSelf = remediation.applyOwnerReview({
    findingId: rSelf.data.findingId,
    approval: { targetType: 'remediation_draft', reason: 'self approval attempt', approvedBy: 'owner', approvalEvidence: evSelf, expiresAt: null, relatedReceipts: [] },
    opts: opts(sandbox, 112),
  });
  add('selfApprove.rejected', aSelf.ok === false && aSelf.code === OWNER_CHANNEL_CODE);
  add('selfApprove.stillPending', aSelf.data.status === 'PENDING');
  add('selfApprove.noApprovalFile', !fs.existsSync(path.join(sandbox, 'plans', 'active', 'remediation', 'drafts', `${rSelf.data.findingId}.approval.json`)));
  add('selfApprove.isolationWarning', aSelf.warnings.some((w) => w.includes('createdBy')));

  // 场景 B：合法 Owner 批准（approvedBy='owner' 字面 + 指令文件路径#SHA256 必填 + creator 可区分）
  const rOk = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'legitimate owner approval flow' }),
    mapMode: 'create-draft',
    draft: draftComplete(),
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 113),
  });
  add('approve.initialPending', (JSON.parse(/```json\n([\s\S]*?)\n```/.exec(fs.readFileSync(path.join(sandbox, 'plans', 'active', 'remediation', 'drafts', `${rOk.data.findingId}.md`), 'utf8'))[1]).ownerReviewState) === 'PENDING');
  const draftMdBefore = fs.readFileSync(path.join(sandbox, 'plans', 'active', 'remediation', 'drafts', `${rOk.data.findingId}.md`), 'utf8');
  writeFile(sandbox, 'owner/directive-ok.md', 'Owner directive: approve remediation draft (probe fixture)\n');
  const evOk = `owner/directive-ok.md#${sha256(fs.readFileSync(path.join(sandbox, 'owner/directive-ok.md')))}`;
  const aOk = remediation.applyOwnerReview({
    findingId: rOk.data.findingId,
    approval: { targetType: 'remediation_draft', reason: 'verified against upstream acceptance evidence', approvedBy: 'owner', approvalEvidence: evOk, expiresAt: null, relatedReceipts: [] },
    opts: opts(sandbox, 114),
  });
  add('approve.ownerOk', aOk.ok === true && aOk.data.status === 'APPROVED' && aOk.data.taskRef === rOk.data.taskRef);
  const approvalFile = path.join(sandbox, 'plans', 'active', 'remediation', 'drafts', `${rOk.data.findingId}.approval.json`);
  add('approve.recordWritten', fs.existsSync(approvalFile));
  const rec = fs.existsSync(approvalFile) ? JSON.parse(fs.readFileSync(approvalFile, 'utf8')) : {};
  add('approve.fieldsAligned', rec.approvalId?.startsWith('apr-20260920T012345Z-') && rec.approvalId?.length === 4 + 16 + 1 + 8
    && rec.targetType === 'remediation_draft'
    && rec.target?.draftId === rOk.data.taskRef && rec.target?.findingId === rOk.data.findingId
    && rec.approvedBy === 'owner' && rec.expiresAt === null
    && rec.reason?.length > 0 && rec.approvalEvidence === evOk);
  add('approve.draftMdImmutable', fs.readFileSync(path.join(sandbox, 'plans', 'active', 'remediation', 'drafts', `${rOk.data.findingId}.md`), 'utf8') === draftMdBefore);
  add('approve.hashReconciliationPending', rec && remediation.HASH_RECONCILIATION_STATUS.includes('[待补充]'));

  // 幂等：二次批准 write-once 不覆写
  const aOk2 = remediation.applyOwnerReview({
    findingId: rOk.data.findingId,
    approval: { targetType: 'remediation_draft', reason: 'second call', approvedBy: 'owner', approvalEvidence: evOk, expiresAt: null, relatedReceipts: [] },
    opts: opts(sandbox, 115),
  });
  add('approve.writeOnceIdempotent', aOk2.ok === true && aOk2.data.status === 'APPROVED'
    && JSON.parse(fs.readFileSync(approvalFile, 'utf8')).reason === 'verified against upstream acceptance evidence');

  // 场景 C：approvedBy 非 'owner' ⇒ 无效（校验 (a)）
  const rC = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'non-owner approvedBy variant' }),
    mapMode: 'create-draft',
    draft: draftComplete(),
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 116),
  });
  writeFile(sandbox, 'owner/directive-c.md', 'directive c\n');
  const evC = `owner/directive-c.md#${sha256(fs.readFileSync(path.join(sandbox, 'owner/directive-c.md')))}`;
  const aC = remediation.applyOwnerReview({
    findingId: rC.data.findingId,
    approval: { targetType: 'remediation_draft', reason: 'agent-approved', approvedBy: 'agent-builder-02', approvalEvidence: evC, expiresAt: null, relatedReceipts: [] },
    opts: opts(sandbox, 117),
  });
  add('approve.nonOwnerRejected', aC.ok === false && aC.code === OWNER_CHANNEL_CODE
    && aC.warnings.some((w) => w.includes("approvedBy 非 'owner'")));
  add('approve.nonOwnerNoFile', !fs.existsSync(path.join(sandbox, 'plans', 'active', 'remediation', 'drafts', `${rC.data.findingId}.approval.json`)));

  // 场景 D：approvalEvidence 缺失 / 指令文件哈希不符 ⇒ 无效（校验 (b) 不可抵赖）
  const aD1 = remediation.applyOwnerReview({
    findingId: rC.data.findingId,
    approval: { targetType: 'remediation_draft', reason: 'no evidence', approvedBy: 'owner', approvalEvidence: '', expiresAt: null, relatedReceipts: [] },
    opts: opts(sandbox, 118),
  });
  add('approve.evidenceMissingRejected', aD1.ok === false && aD1.warnings.some((w) => w.includes('approvalEvidence')));
  const aD2 = remediation.applyOwnerReview({
    findingId: rC.data.findingId,
    approval: { targetType: 'remediation_draft', reason: 'sha mismatch', approvedBy: 'owner', approvalEvidence: `owner/directive-c.md#${'0'.repeat(64)}`, expiresAt: null, relatedReceipts: [] },
    opts: opts(sandbox, 119),
  });
  add('approve.evidenceShaMismatchRejected', aD2.ok === false && aD2.warnings.some((w) => w.includes('哈希不符')));

  // 场景 E：targetType 非 remediation_draft ⇒ 无效（R8 域内唯一合法值，不扩展 C-R4 枚举）
  const aE = remediation.applyOwnerReview({
    findingId: rC.data.findingId,
    approval: { targetType: 'phase_transition', reason: 'wrong type', approvedBy: 'owner', approvalEvidence: evC, expiresAt: null, relatedReceipts: [] },
    opts: opts(sandbox, 120),
  });
  add('approve.targetTypeRejected', aE.ok === false && aE.warnings.some((w) => w.includes('remediation_draft')));

  // 场景 F：批准先于执行（校验 (c)）：approvedAt 晚于升格/派单时点 ⇒ 无效
  const rF = remediation.remediationRegister({
    finding: validFinding(sandbox, { title: 'approval-before-execution variant' }),
    mapMode: 'create-draft',
    draft: draftComplete(),
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 121),
  });
  writeFile(sandbox, 'owner/directive-f.md', 'directive f\n');
  const evF = `owner/directive-f.md#${sha256(fs.readFileSync(path.join(sandbox, 'owner/directive-f.md')))}`;
  const later = new Date('2026-09-20T05:00:00Z');
  const aF1 = remediation.applyOwnerReview({
    findingId: rF.data.findingId,
    approval: { targetType: 'remediation_draft', reason: 'approve before execution', approvedBy: 'owner', approvalEvidence: evF, expiresAt: null, relatedReceipts: [] },
    executionAt: new Date('2026-09-20T09:00:00Z').toISOString(), // 执行在批准之后 ⇒ 合法
    opts: { repoRoot: sandbox, now: later, rand: 'cafefe1' },
  });
  add('approve.beforeExecutionValid', aF1.ok === true && aF1.data.status === 'APPROVED');

  return verdict(checks, 'r8-self-approve-blocked');
}
