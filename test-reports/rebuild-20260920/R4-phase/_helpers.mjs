/**
 * _helpers.mjs — R4 phase.mjs 重建探针共享工厂（确定性时钟/合法 state/合法 R3 receipt/合法 owner approval/响应壳断言）。
 * 沙箱纪律：所有写入限制在 run-probes.mjs 分派的 .sandbox/<pNN>/ 下，不触碰仓库根 .tt-state/。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import phase from '../../../scripts/lib/phase.mjs';

/** 确定性时钟（探针复现用；执行时点 = NOW，批准时点须早于它） */
export const NOW = new Date('2026-09-20T02:00:00.000Z');
export const NOW_ISO = NOW.toISOString();
const APPROVED_AT = '2026-09-20T01:59:00.000Z';

export function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
  return file;
}

export function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** 响应壳断言（契约 §6：{ok, code, data, evidence, warnings}；evidence 为对象非数组） */
export function shellOk(resp) {
  if (!resp || typeof resp !== 'object') return false;
  const keys = Object.keys(resp).sort();
  const expected = ['code', 'data', 'evidence', 'ok', 'warnings'];
  if (keys.join(',') !== expected.join(',')) return false;
  if (typeof resp.ok !== 'boolean') return false;
  if (!(resp.code === null || typeof resp.code === 'string')) return false;
  if (!resp.data || typeof resp.data !== 'object' || Array.isArray(resp.data)) return false;
  if (!resp.evidence || typeof resp.evidence !== 'object' || Array.isArray(resp.evidence)) return false;
  if (!Array.isArray(resp.warnings) || resp.warnings.some((w) => typeof w !== 'string')) return false;
  return true;
}

/** A 面 state 夹具（plan 本体即 state.json；无 stateVersion = legacy v0 形） */
export function stateFixture(over = {}) {
  return {
    id: 'p1',
    status: 'reviewing',
    cluster: 'T2_BACKEND',
    requireExec: true,
    preconditions: ['be-architect 接口/错误契约产物须先冻结'],
    subtasks: [
      { id: 's1', asset: 'implementation', status: 'done', mode: 'exec', adapter: 'prompt', attempts: 1, assetConsumed: true, phase: 0, dependsOn: [] },
    ],
    ...over,
  };
}

export function stateFileOf(sandbox, { session = null, namespaced = false } = {}) {
  const base = namespaced && session ? path.join(sandbox, '.tt-state', session) : path.join(sandbox, '.tt-state');
  return path.join(base, 'state.json');
}

export function seedState(sandbox, state = stateFixture(), opts = {}) {
  return writeJson(stateFileOf(sandbox, opts), state);
}

/** 合法 R3 receipt 夹具（[R3冻结] §3.4 事件数组 + result 缓存；链内 sourceHashEcho 一致） */
const MANIFEST_HASH = crypto.createHash('sha256').update('vendor/<asset>/manifest (probe fixture bytes)').digest('hex');

export function receiptFixture({ subtaskId = 's1', assetId = 'implementation', terminal = 'verified' } = {}) {
  const H = MANIFEST_HASH;
  const base = (i, transition, evidence) => ({
    eventSeq: i,
    transition,
    assetId,
    assetType: 'skill',
    sourceHash: H,
    sourceHashEcho: H,
    session: 'legacy',
    idempotencyKey: `${subtaskId}-${transition}`,
    evidence,
    recordedAt: APPROVED_AT,
  });
  const events = [
    base(1, 'discovered', { catalogCacheIdentity: 'cat-probe', sourceHash: H }),
    base(2, 'eligible', { phaseEligibility: { eligible: true, reason: 'ok', phase: 0 } }),
    base(3, 'selected', { planId: 'p1', subtaskId, sourceHash: H }),
    base(4, 'instructions_delivered', { activationLevel: 'body', payloadSha256: H, briefPath: `artifacts/${subtaskId}/brief.md`, sourceHashEcho: H, budgetResult: { limit: null, action: 'block' } }),
    base(5, 'execution_observed', { artifactPath: `artifacts/${subtaskId}/plan.md`, artifactSha256: H, executed: true }),
  ];
  let result = null;
  if (terminal === 'verified') {
    events.push(base(6, 'behavior_verified', {
      behaviorCheck: { checkId: `${subtaskId}#${assetId}`, assetId, subtaskId, result: 'VERIFIED', reason: null, evidenceRefs: [], checkedAt: APPROVED_AT },
      evidenceRefs: ['1', '2', '3', '4', '5'],
    }));
    result = { checkId: `${subtaskId}#${assetId}`, assetId, subtaskId, result: 'VERIFIED', reason: null, evidenceRefs: [], checkedAt: APPROVED_AT };
  } else if (terminal === 'failed') {
    events.push({ ...base(6, 'verification_failed', { behaviorCheck: { checkId: `${subtaskId}#${assetId}`, assetId, subtaskId, result: 'FAILED', reason: 'EVIDENCE_ECHO_ONLY', evidenceRefs: [], checkedAt: APPROVED_AT }, reason: 'EVIDENCE_ECHO_ONLY' }) });
    result = { checkId: `${subtaskId}#${assetId}`, assetId, subtaskId, result: 'FAILED', reason: 'EVIDENCE_ECHO_ONLY', evidenceRefs: [], checkedAt: APPROVED_AT };
  } else if (terminal === 'unresolved') {
    events.splice(3); // 止于 selected ⇒ N1 not_consumed
    events.push(base(4, 'not_consumed', { subtaskId, closeReason: 'SELECTED_NOT_CONSUMED' }));
    result = { checkId: `${subtaskId}#${assetId}`, assetId, subtaskId, result: 'UNRESOLVED', reason: 'SELECTED_NOT_CONSUMED', evidenceRefs: [], checkedAt: APPROVED_AT };
  } else if (terminal === 'mismatch') {
    events.push(base(6, 'behavior_verified', { behaviorCheck: { result: 'VERIFIED' }, evidenceRefs: [] }));
    result = { checkId: `${subtaskId}#${assetId}`, assetId, subtaskId, result: 'UNRESOLVED', reason: '手改缓存', evidenceRefs: [], checkedAt: APPROVED_AT };
  }
  return { subtaskId, events, result };
}

export function writeReceipt(sandbox, { subtaskId = 's1', assetId, terminal, session = null, namespaced = false } = {}) {
  const baseDir = namespaced && session ? path.join(sandbox, 'artifacts', session) : path.join(sandbox, 'artifacts');
  const file = path.join(baseDir, subtaskId, 'receipt.json');
  return writeJson(file, receiptFixture({ subtaskId, assetId, terminal }));
}

/** 合法 ownerApprovalReceipt 夹具（§5.2 schema + OQ-R4-6=A 形态；指令文件真实落盘并算 SHA256） */
export function makeApproval(sandbox, {
  from = 'reviewing', to = 'done', scopeId = 'p1', approvedBy = 'owner',
  approvedAt = APPROVED_AT, approvalId = 'apr-20260920T015900Z-deadbeef',
  reason = 'Owner 指令：验收窗口内放行 reviewing→done（重建探针）', expiresAt = null,
  directiveBody = 'Owner directive: approve reviewing->done for p1 (R4 rebuild probe)',
  evidenceFile = 'owner-directives/apr-20260920T015900Z.md', omit = [], patch = {},
} = {}) {
  const abs = path.join(sandbox, evidenceFile);
  fs.mkdirSync(sandbox, { recursive: true });
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, directiveBody);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
  const receipt = {
    approvalId,
    targetType: 'phase_transition',
    target: { from, to, scope: 'plan', scopeId },
    reason,
    approvedBy,
    approvedAt,
    approvalEvidence: phase.formatApprovalEvidence(evidenceFile, sha),
    expiresAt,
    relatedReceipts: [],
  };
  for (const k of omit) delete receipt[k];
  return { ...receipt, ...patch };
}

/** 探针结果合成：全断言通过才 PASS */
export function verdict(checks, label) {
  const failed = checks.filter((c) => !c.pass);
  const summary = `${label}: ${checks.length - failed.length}/${checks.length} ` + failed.map((c) => 'FAIL@' + c.name).join(',');
  return { ok: failed.length === 0, summary };
}
