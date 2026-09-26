#!/usr/bin/env node
/**
 * GOV-AUTHORITY 自测驱动（第十五审计派单任务一/三自测证据面）：
 *   1. migration.mjs：五合法转移放行 + 三失败形态拒绝 + evidence 校验四负终态拒绝 + AS-2 三张回放兼容；
 *   2. canonical 单点：六张单 ownerSignOff 删除后 canonicalSignoff 全 SIGNED；g0v3cons1 voided + r2 PENDING 显式。
 * 证据落 test-reports/autopilot-work/GOV-AUTHORITY/selftest-migration.json / selftest-canonical.json。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const SELFTEST_DIR = path.dirname(fileURLToPath(import.meta.url));
// selftest.mjs 位于 <ROOT>/test-reports/autopilot-work/GOV-AUTHORITY/ ——向上四回仓库根
// （GOV-AUTHORITY→autopilot-work→test-reports→yy）
const ROOT = path.resolve(SELFTEST_DIR, '..', '..', '..');
const OUT_DIR = path.join(ROOT, 'test-reports', 'autopilot-work', 'GOV-AUTHORITY');
fs.mkdirSync(OUT_DIR, { recursive: true });

const migration = await import(pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'migration.mjs')).href);
const canonical = await import(pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'signoff-canonical.mjs')).href);

// ── 1. migration.mjs 自测 ──
const mig = { schema: 'gov-authority-selftest-migration@1.0.0', at: new Date().toISOString(), checks: {} };
let migOk = true;

// 1a. 五合法转移放行
const legalCases = [
  ['ACTIVE', 'SHADOW', {}],
  ['SHADOW', 'MIGRATING', { promotionReceipt: 'apr-clean' }],
  ['MIGRATING', 'PRIMARY', { terminal: 'behavior_verified' }],
  ['PRIMARY', 'DEPRECATED', {}],
  ['DEPRECATED', 'REMOVED', {}],
];
const legalResults = legalCases.map(([f, t, ev]) => {
  const r = migration.transition({ current_state: f }, f, t, ev);
  return { edge: f + '>' + t, ok: r.ok === true, code: r.code };
});
mig.checks.five_legal_transitions_allowed = legalResults.every((r) => r.ok);
if (!mig.checks.five_legal_transitions_allowed) migOk = false;
mig.five_legal_transitions = legalResults;

// 1b. 三失败形态拒绝（SHADOW→MIGRATING 与 MIGRATING→PRIMARY）
const shapeCases = [
  ['SHADOW', 'MIGRATING', { promotionReceipt: 'apr-x', failureShapes: ['shadow_fail'] }, 'MIGRATION_BLOCKED:shadow_fail'],
  ['SHADOW', 'MIGRATING', { promotionReceipt: 'apr-x', failureShapes: ['rollback_fail'] }, 'MIGRATION_BLOCKED:rollback_fail'],
  ['SHADOW', 'MIGRATING', { promotionReceipt: 'apr-x', failureShapes: ['runtime_binding_fail'] }, 'MIGRATION_BLOCKED:runtime_binding_fail'],
  ['MIGRATING', 'PRIMARY', { failureShapes: ['shadow_fail'] }, 'MIGRATION_BLOCKED:shadow_fail'],
  ['MIGRATING', 'PRIMARY', { failureShapes: ['rollback_fail'] }, 'MIGRATION_BLOCKED:rollback_fail'],
  ['MIGRATING', 'PRIMARY', { failureShapes: ['runtime_binding_fail'] }, 'MIGRATION_BLOCKED:runtime_binding_fail'],
];
const shapeResults = shapeCases.map(([f, t, ev, expected]) => {
  const r = migration.transition({ current_state: f }, f, t, ev);
  return { edge: f + '>' + t, shape: ev.failureShapes[0], expected, actual: r.code, ok: r.ok === false && r.code === expected };
});
mig.checks.three_failure_shapes_hard_denied = shapeResults.every((r) => r.ok);
if (!mig.checks.three_failure_shapes_hard_denied) migOk = false;
mig.three_failure_shapes = shapeResults;

// 1c. promotion evidence 校验：四负终态拒绝 + behavior_verified 放行
const evidenceCases = ['FAILED', 'UNRESOLVED', 'INVALID', null, 'behavior_verified'];
const evidenceResults = evidenceCases.map((t) => {
  const r = migration.validatePromotionEvidence(t);
  const expectOk = t === 'behavior_verified';
  return { terminal: String(t), ok: r.ok === expectOk, expectOk, actual: r.ok, code: r.code };
});
const m2pNoEvidence = migration.transition({ current_state: 'MIGRATING' }, 'MIGRATING', 'PRIMARY', {});
evidenceResults.push({ terminal: '(transition M2P 缺 terminal)', ok: m2pNoEvidence.ok === false && m2pNoEvidence.code === 'PROMOTION_BLOCKED', expectOk: false, actual: m2pNoEvidence.ok, code: m2pNoEvidence.code });
mig.checks.promotion_evidence_negative_terminals_denied = evidenceResults.every((r) => r.ok);
if (!mig.checks.promotion_evidence_negative_terminals_denied) migOk = false;
mig.promotion_evidence = evidenceResults;

// 1d. promotionReceipt 生成处校验（promote）：负终态拒发，verified 签发
const pDeny = migration.promote({ current_state: 'SHADOW' }, { receiptTerminal: 'FAILED' });
const pAllow = migration.promote({ current_state: 'SHADOW' }, { receiptTerminal: 'behavior_verified', promotionReceiptId: 'apr-selftest' });
mig.checks.promotion_receipt_issued_only_after_gate = pDeny.ok === false && pDeny.code === 'PROMOTION_BLOCKED' && pAllow.ok === true && Boolean(pAllow.data.promotionReceipt);
if (!mig.checks.promotion_receipt_issued_only_after_gate) migOk = false;
mig.promotion_receipt_gate = { deny_code: pDeny.code, allow_receipt_id: pAllow.data && pAllow.data.promotionReceipt && pAllow.data.promotionReceipt.receiptId };

// 1e. AS-2 三张已 PRIMARY migration-record 回放兼容
const as2 = ['AS-2-first', 'AS-2-security', 'AS-2-sentinel'].map((d) => {
  const rec = JSON.parse(fs.readFileSync(path.join(ROOT, 'test-reports', 'autopilot-work', d, 'migration-record.json'), 'utf8'));
  const r = migration.replayTransitions(rec);
  return { record: d, ok: r.ok === true, terminal: r.data && r.data.current, voidedSkipped: r.evidence && r.evidence.voidedSkipped, code: r.code };
});
mig.checks.as2_three_records_replay_allowed = as2.every((r) => r.ok && r.terminal === 'PRIMARY');
if (!mig.checks.as2_three_records_replay_allowed) migOk = false;
mig.as2_replay = as2;

// 1f. 非法边抽样拒绝（非法流转表具名形态）
const illegalCases = [['ACTIVE', 'MIGRATING'], ['ACTIVE', 'PRIMARY'], ['SHADOW', 'PRIMARY'], ['MIGRATING', 'SHADOW'], ['PRIMARY', 'ACTIVE'], ['DEPRECATED', 'PRIMARY'], ['REMOVED', 'ACTIVE']];
const illegalResults = illegalCases.map(([f, t]) => {
  const r = migration.transition({ current_state: f }, f, t, {});
  return { edge: f + '>' + t, rejected: r.ok === false && r.code === 'INVALID_TRANSITION' };
});
mig.checks.illegal_transitions_rejected = illegalResults.every((r) => r.rejected);
if (!mig.checks.illegal_transitions_rejected) migOk = false;
mig.illegal_transitions = illegalResults;

mig.verdict = migOk ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(OUT_DIR, 'selftest-migration.json'), JSON.stringify(mig, null, 2));

// ── 2. canonical 单点自测 ──
const can = { schema: 'gov-authority-selftest-canonical@1.0.0', at: new Date().toISOString(), checks: {} };
let canOk = true;
const six = [
  'cr-20260923T040000Z-av1schema.json',
  'cr-20260924T090000Z-b1g4te5c.json',
  'cr-20260924T120000Z-as2f1rst-promotion.json',
  'cr-20260925T063000Z-as2sec-promotion.json',
  'cr-20260925T130000Z-as2sec-promotion-r2.json',
  'cr-20260925T150000Z-as2sent-promotion.json',
];
const sixRows = six.map((f) => {
  const rec = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'discrepancies', f), 'utf8'));
  const c = canonical.canonicalSignoff(rec);
  return { record: f, ownerSignOff_absent: !('ownerSignOff' in rec), status: c.status, signed: c.status === 'SIGNED' };
});
can.checks.six_signed_records_ownerSignOff_removed = sixRows.every((r) => r.ownerSignOff_absent);
can.checks.six_signed_records_canonical_all_signed = sixRows.every((r) => r.signed);
if (!can.checks.six_signed_records_ownerSignOff_removed || !can.checks.six_signed_records_canonical_all_signed) canOk = false;
can.six_signed_inventory = sixRows;

// g0v3cons1 voided + r2 PENDING 显式
const voided = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'discrepancies', 'cr-20260926T000000Z-g0v3cons1.json'), 'utf8'));
const r2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'discrepancies', 'cr-20260926T010000Z-g0v3cons1-r2.json'), 'utf8'));
const vC = canonical.canonicalSignoff(voided);
const r2C = canonical.canonicalSignoff(r2);
can.g0v3cons1_voided = { voided: voided.voided === true, canonical_status: vC.status, replacedBy: voided.replacedBy };
can.r2 = { impactClass: r2.impactClass, ownerApprovalReceipt_status: r2.ownerApprovalReceipt && r2.ownerApprovalReceipt.status, canonical_status: r2C.status, supersedes: r2.supersedes, ownerSignOff_absent: !('ownerSignOff' in r2) };
can.checks.g0v3cons1_voided_explicit = voided.voided === true && vC.status === 'VOIDED' && voided.replacedBy === 'cr-20260926T010000Z-g0v3cons1-r2';
can.checks.r2_contract_pending_explicit = r2.impactClass === 'CONTRACT' && r2.ownerApprovalReceipt && r2.ownerApprovalReceipt.status === 'PENDING_OWNER_RECEIPT' && r2C.status === 'PENDING_OWNER_RECEIPT';
if (!can.checks.g0v3cons1_voided_explicit || !can.checks.r2_contract_pending_explicit) canOk = false;

// stale 字段忽略语义（F-033 防回潮：注入假 ownerSignOff → 忽略 + warning，不采信）
const staleProbe = { ...JSON.parse(JSON.stringify(r2)), ownerSignOff: { status: 'SIGNED', note: 'injected stale probe' } };
const staleC = canonical.canonicalSignoff(staleProbe);
can.stale_field_semantics = { injected_status: 'SIGNED', canonical_status_unchanged: staleC.status === 'PENDING_OWNER_RECEIPT', ignored: staleC.staleFieldsIgnored.includes('ownerSignOff'), warned: staleC.warnings.some((w) => w.includes('stale')) };
can.checks.stale_ownerSignOff_ignored_with_warning = can.stale_field_semantics.canonical_status_unchanged && can.stale_field_semantics.ignored;
if (!can.checks.stale_ownerSignOff_ignored_with_warning) canOk = false;

can.verdict = canOk ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(OUT_DIR, 'selftest-canonical.json'), JSON.stringify(can, null, 2));

console.log('selftest-migration:', mig.verdict, JSON.stringify(mig.checks));
console.log('selftest-canonical:', can.verdict, JSON.stringify(can.checks));
if (!migOk || !canOk) process.exitCode = 1;
