/**
 * receipt.mjs — R3: Asset Receipt / 终态证据（C-R3-activation 冻结契约 §7 实现）
 *
 * 操作面（仅契约 §2 已列操作，不新增操作名）：receipt.append。
 * 统一响应壳：{ok, code, data, evidence, warnings}；错误码仅三（dev-plan:303 原码）：
 *   RECEIPT_INVALID（事件 schema 违约、transition 枚举外/非法跃迁、幂等键冲突但 payload 不同）
 *   RECEIPT_HASH_MISMATCH（事件 sourceHash 与当前资产字节或链上前一事件不一致）
 *   RECEIPT_INCOMPLETE（该 transition 的必需 evidence 缺失/无效，§7.3）
 *
 * 生命周期（§7.1 canonical）：discovered → eligible → selected → instructions_delivered →
 *   execution_observed → behavior_verified（唯一正终态）；负向收口 N1 not_consumed /
 *   N2 verification_failed / N3 unresolved。状态是事件链的派生视图（重放即得，§3.4），
 *   不单独存储状态机变量。行为验证内嵌于 receipt.append（OQ-R3-9=A）——验证结果是
 *   behavior_verified / verification_failed / unresolved transition 事件，不是独立操作。
 *
 * P1-P5 谓词（§7.4）是行为验证的必要条件地板（fail-closed）：回显型/marker-only/copier-only
 *   证据永远过不去；P4 机验实现必须先通过 §7.7 的 7 个 C6 case 回归（全部不得 VERIFIED）。
 *   P1-P5 不是"方法论真实被应用"的充分证明——更强行为验证 = [待补充]（§7.4 诚实边界，
 *   等 Owner/R4 决断，本实现不发明不可机验的"理解度"判定）。
 *
 * 存储（§7.6，OQ-R8-8=A per-artifact）：artifacts/<subtaskId>/receipt.json，append-only
 *   事件数组；不混进旧 plan 字段；不写 vendor/。同 receipt.json 的并发追加由进程级锁注册表
 *   串行化（现状增量写机制复用语义、不新增并发协议）——登记偏差：C-R4 锚点表的 store.mjs
 *   receiptStore 增量层未随快照幸存（现 store.mjs 仅 createStore），且本重建禁止修改既有文件，
 *   故锁注册表内聚于本模块（键 = receipt.json 绝对路径），语义对齐 C-R4 §2.4。
 *
 * legacy 裸布尔读法（§7.8/§8.3，OQ-R3-7=A）：assetConsumed=true 是 telemetry-only——可读、
 *   计为 legacy 观察、不崩溃；永远不能单独或组合地满足 phase gate，不能升格为
 *   behavior_verified，不能参与 P1-P5 任何谓词。
 *
 * canonicalHash（additive）：§3.4 receipt schema 未含该字段；本实现按 evolution.mjs
 *   RECEIPT_FIELDS（canonicalHash = sha256 同构 C-R4）的字段命名在其上游补齐同构完整性字段：
 *   sha256 over {subtaskId, events[]（剔除幂等豁免字段 recordedAt）, result}。手改 receipt.json
 *   ⇒ 复验不一致 ⇒ RECEIPT_INVALID（§3.4 重放防手改条款的哈希化 complement）。
 *   登记为 additive 扩展，见 RESULTS.md 偏差表。
 *
 * 重建说明（rebuild-20260920）：本文件为按冻结契约 contracts/C-R3-activation.md 的行为级重建，
 *   原文件已丢失、无原始 sha256 可对照；行为级验收探针（GWT-R3-01…05 / R3-1…R3-12 / C6 7 case /
 *   P1-P5 逐谓词）见 test-reports/rebuild-20260920/R3-activation-receipt/。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { extractPayloadFromBrief, extractAnchorAndKernel, resolveManifestPath, METADATA_PLACEHOLDER } from './activation.mjs';

// ---------------------------------------------------------------------------
// 常量（契约 §7）
// ---------------------------------------------------------------------------

/** transition 枚举（§7.2：6 正向 transition + 3 负向收口事件；事件类型枚举是 receipt 内部词汇，不是操作名） */
export const TRANSITIONS = Object.freeze([
  'discovered', 'eligible', 'selected', 'instructions_delivered',
  'execution_observed', 'behavior_verified',
  'not_consumed', 'verification_failed', 'unresolved',
]);

/** 正向链（T1-T6）与负向收口（N1-N3） */
export const FORWARD_TRANSITIONS = Object.freeze(TRANSITIONS.slice(0, 6));
export const NEGATIVE_TRANSITIONS = Object.freeze(TRANSITIONS.slice(6));

/** 合法 from-状态（§7.2 表；behavior_verified 走 §7.4 谓词组，不在此表判定——见 receiptAppend 内注释） */
const LEGAL_FROM = Object.freeze({
  discovered: [null],
  eligible: ['discovered'],
  selected: ['eligible'],
  instructions_delivered: ['selected'],
  execution_observed: ['instructions_delivered'],
  not_consumed: ['eligible', 'selected'],
  verification_failed: ['execution_observed'],
  unresolved: [null, 'discovered', 'eligible', 'selected', 'instructions_delivered', 'execution_observed'],
});

/** 每 transition 的必需 evidence 键（§7.3；缺失 ⇒ RECEIPT_INCOMPLETE） */
export const REQUIRED_EVIDENCE = Object.freeze({
  discovered: ['catalogCacheIdentity', 'sourceHash'],
  eligible: ['phaseEligibility'],
  selected: ['planId', 'subtaskId', 'sourceHash'],
  instructions_delivered: ['activationLevel', 'payloadSha256', 'briefPath', 'sourceHashEcho', 'budgetResult'],
  execution_observed: ['artifactPath', 'artifactSha256', 'executed'],
  behavior_verified: ['behaviorCheck', 'evidenceRefs'],
  not_consumed: ['subtaskId', 'closeReason'],
  verification_failed: ['behaviorCheck', 'reason'],
  unresolved: ['behaviorCheck', 'reason'],
});

/** 终态 transition → behaviorCheck result（§7.1：behavior_verified 唯一正终态） */
const TERMINAL_RESULT = Object.freeze({
  behavior_verified: 'VERIFIED',
  not_consumed: 'UNRESOLVED',
  verification_failed: 'FAILED',
  unresolved: 'UNRESOLVED',
});

/** T5 产物白名单后缀与排除项（§7.3，对齐现状扫描白名单 prompt.mjs:97-112） */
const ARTIFACT_EXT = /\.(md|json|yaml|yml)$/;
const ARTIFACT_EXCLUDED = new Set(['brief.md', 'result.txt']);

/** P4 反回显：payload 逐字节片段的最小片段长（归一化后）。契约未给阈值——登记为重建判定：
 *  取 12（≥ 任何单个内核 token 的常规长度上限之下、足以排除巧合短句）；方向为 fail-closed
 *  （更小阈值只会移除更多、更难通过，不会放松地板）。 */
const P4_MIN_FRAG = 12;
/** P4 贪心最大匹配扩展上限（单次连续 payload 片段的最大归一化长度） */
const P4_MAX_EXT = 400;

/** P5 非法验证依据标记（§7.4 P5：legacy assetConsumed 布尔或 marker-presence 不得作为验证依据） */
const ILLEGAL_VERIFICATION_BASIS = new Set(['marker-presence', 'legacy-boolean']);

/** 错误码仅三（dev-plan:303 原码） */
export const ERROR_CODES = Object.freeze(['RECEIPT_INVALID', 'RECEIPT_HASH_MISMATCH', 'RECEIPT_INCOMPLETE']);

export const RECEIPT_FILENAME = 'receipt.json';

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

function respond(ok, code, data, evidence, warnings) {
  return { ok, code: code ?? null, data: data ?? {}, evidence: evidence ?? {}, warnings: warnings ?? [] };
}

function isBlank(v) { return v === undefined || v === null || v === ''; }

function sha256Hex(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

/** 键序稳定的 JSON（比较用；与 gate.mjs stable() 同构，仅剔除 undefined、保留 null） */
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) if (value[key] !== undefined) out[key] = stable(value[key]);
    return out;
  }
  return value === undefined ? null : value;
}
function stableJson(value) { return JSON.stringify(stable(value)); }

const SHA256_RE = /^[0-9a-f]{64}$/;
function normalizeHash(v) { return typeof v === 'string' ? v.toLowerCase() : v; }
function isSha256(v) { return typeof v === 'string' && SHA256_RE.test(v); }

/** subtaskId 路径安全校验（receipt 路径 artifacts/<subtaskId>/receipt.json；同 orchestrator.mjs:47 / C-R4 §2.1 白名单口径） */
function safeSubtaskId(v) { return typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(v) && !v.includes('..'); }

export function receiptPath(workspace, subtaskId) {
  return path.join(workspace, 'artifacts', subtaskId, RECEIPT_FILENAME);
}

/** 进程级锁注册表（§7.6：现状增量写机制复用语义、不新增并发协议；偏差登记见文件头）。 */
const locks = new Set();

// ---------------------------------------------------------------------------
// canonicalHash（additive，字段命名同构 evolution.mjs RECEIPT_FIELDS / C-R4）
// ---------------------------------------------------------------------------

/** canonicalHash = sha256({subtaskId, events[]（剔除 recordedAt 豁免字段）, result})；可由任意消费方重算复验。 */
export function canonicalReceiptHash(receipt) {
  const canonical = JSON.stringify({
    subtaskId: receipt.subtaskId,
    events: receipt.events.map((e) => { const c = { ...e }; delete c.recordedAt; return c; }),
    result: receipt.result ?? null,
  });
  return sha256Hex(canonical);
}

// ---------------------------------------------------------------------------
// 事件链重放（§3.4/§7.6：状态是派生视图；缓存 result 仅作加速，重放不一致 ⇒ RECEIPT_INVALID）
// ---------------------------------------------------------------------------

/**
 * replayEvents：按序重放事件数组，推导 {state, result}。
 * state ∈ null | T1-T6 状态 | 'not_consumed'|'verification_failed'|'unresolved'（负终态）；
 * result = 终态事件的 behaviorCheck（§3.3 归一形）；未到终态为 null。
 */
export function replayEvents(events) {
  let state = null;
  let result = null;
  for (const ev of events) {
    if (ev.transition === 'behavior_verified') {
      state = 'behavior_verified';
      result = ev.evidence && ev.evidence.behaviorCheck ? ev.evidence.behaviorCheck : null;
    } else if (ev.transition === 'not_consumed') {
      state = 'not_consumed';
      result = ev.evidence && ev.evidence.behaviorCheck ? ev.evidence.behaviorCheck : null;
    } else if (ev.transition === 'verification_failed') {
      state = 'verification_failed';
      result = ev.evidence && ev.evidence.behaviorCheck ? ev.evidence.behaviorCheck : null;
    } else if (ev.transition === 'unresolved') {
      state = 'unresolved';
      result = ev.evidence && ev.evidence.behaviorCheck ? ev.evidence.behaviorCheck : null;
    } else {
      state = ev.transition; // 正向非终态推进
    }
  }
  return { state, result };
}

/** behaviorCheck 归一形（§3.3 字段级 schema；checkId = <subtaskId>#<assetId> [草案]）。 */
function normalizeBehaviorCheck(raw, ctx) {
  return {
    checkId: ctx.subtaskId + '#' + ctx.assetId,
    assetId: ctx.assetId,
    subtaskId: ctx.subtaskId,
    result: ctx.result,
    reason: ctx.reason ?? null,
    evidenceRefs: Array.isArray(raw && raw.evidenceRefs) && ctx.result === 'VERIFIED' ? raw.evidenceRefs : (ctx.evidenceRefs ?? []),
    checkedAt: ctx.checkedAt,
  };
}

// ---------------------------------------------------------------------------
// receipt 文件加载与结构校验（P1 的机验基础）
// ---------------------------------------------------------------------------

function freshReceipt(subtaskId) {
  const receipt = { subtaskId, events: [], result: null };
  receipt.canonicalHash = canonicalReceiptHash(receipt);
  return receipt;
}

/**
 * 加载并校验 receipt.json（§3.4 schema + eventSeq 连续性 + canonicalHash + 重放一致性）。
 * 返回 {receipt} 或 {error: code, reason}；文件不存在 ⇒ 新空链（append-only 起点合法）。
 */
function loadReceipt(file, subtaskId) {
  if (!fs.existsSync(file)) return { receipt: freshReceipt(subtaskId), fresh: true };
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return { error: 'RECEIPT_INVALID', reason: 'receipt.json 不是合法 JSON（§3.4 schema 违约）: ' + (error.message ?? error) };
  }
  if (!raw || typeof raw !== 'object' || raw.subtaskId !== subtaskId || !Array.isArray(raw.events)) {
    return { error: 'RECEIPT_INVALID', reason: 'receipt.json schema 违约（subtaskId 不符或 events 非数组，§3.4）' };
  }
  for (let i = 0; i < raw.events.length; i++) {
    if (!raw.events[i] || raw.events[i].eventSeq !== i + 1) {
      return { error: 'RECEIPT_INVALID', reason: `eventSeq 连续性违约 @${i + 1}（§7.6：eventSeq 连续性是完整性校验的一部分）` };
    }
  }
  if (raw.canonicalHash !== undefined && raw.canonicalHash !== canonicalReceiptHash(raw)) {
    return { error: 'RECEIPT_INVALID', reason: 'canonicalHash 与事件链不一致（防手改 receipt.json；additive 完整性字段）' };
  }
  const replayed = replayEvents(raw.events);
  if (stableJson(replayed.result ?? null) !== stableJson(raw.result ?? null)) {
    return { error: 'RECEIPT_INVALID', reason: 'result 缓存与事件重放不一致（§3.4：重放不一致 ⇒ RECEIPT_INVALID，防手改）' };
  }
  return { receipt: raw };
}

// ---------------------------------------------------------------------------
// P4 反回显谓词机验（§7.4 P4；§7.7 7 case 回归门）
// ---------------------------------------------------------------------------

function p4Normalize(s) { return String(s ?? '').toLowerCase().replace(/\s+/g, ''); }

/** 移除产物中与投递 payload 逐字节（≥P4_MIN_FRAG 归一片段）重合的内容，返回剩余归一文本。 */
function removePayloadFragments(artifactNorm, payloadNorm) {
  if (!payloadNorm || payloadNorm.length < P4_MIN_FRAG) return artifactNorm;
  const grams = new Set();
  for (let i = 0; i + P4_MIN_FRAG <= payloadNorm.length; i++) grams.add(payloadNorm.slice(i, i + P4_MIN_FRAG));
  let out = '';
  let i = 0;
  while (i < artifactNorm.length) {
    if (i + P4_MIN_FRAG <= artifactNorm.length && grams.has(artifactNorm.slice(i, i + P4_MIN_FRAG))) {
      let lo = P4_MIN_FRAG;
      let hi = Math.min(artifactNorm.length - i, P4_MAX_EXT);
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (payloadNorm.includes(artifactNorm.slice(i, i + mid))) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
      }
      i += best;
    } else {
      out += artifactNorm[i];
      i += 1;
    }
  }
  return out;
}

/**
 * antiEchoResidue：P4 机验核心。对 T5 产物归一化（大小写折叠 + 去空白）后，移除——
 *   ① 激活记录 anchor（prompt.mjs:79-82 同源：正文首个标题）
 *   ② Kernel: 行内核 token 集（prompt.mjs:88-90 同源）
 *   ③ 宿主注入指令明示复述的 token（exec-host-generic.mjs:82-83 = 同一 anchor + 内核 token）
 *   ④ 投递 payload 的逐字节片段（≥P4_MIN_FRAG 归一片段，贪心最长匹配）
 *   ⑤ metadata 占位行（§5.2）—— 再剥离非实质字符（标点/符号），返回实质剩余长度。
 * 剩余为 0 ⇒ marker-only / copier-only 证据（reason EVIDENCE_ECHO_ONLY，FAILED）。
 */
export function antiEchoResidue(artifactText, basis) {
  const artifactNorm = p4Normalize(artifactText);
  let out = removePayloadFragments(artifactNorm, p4Normalize(basis && basis.payloadText));
  const needles = [basis && basis.anchor, ...((basis && basis.kernelTokens) || []), METADATA_PLACEHOLDER]
    .map((n) => p4Normalize(n))
    .filter((n) => n.length > 0);
  for (const n of needles) out = out.split(n).join('');
  // 实质内容 = 字母/数字/CJK（含 CJK 标点与全角形式）；纯 markdown 符号/空白不计实质
  const substantive = out.replace(/[^a-z0-9\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, '');
  return substantive.length;
}

// ---------------------------------------------------------------------------
// P1-P5 谓词（§7.4；T6 当且仅当全部为真）
// ---------------------------------------------------------------------------

function findEvent(events, transition) {
  return events.find((e) => e.transition === transition) ?? null;
}

/** P1（receipt 完整性）：文件存在、schema 合法、result 缓存与重放一致（loadReceipt 已机验；此处给独立入口）。 */
export function predicateP1(loadResult) {
  if (loadResult.error) return { pass: false, code: loadResult.error, reason: loadResult.reason };
  return { pass: true };
}

/** P2（source hash 一致性）：T6 时点重算 manifest sha256 == T1.sourceHash == 每个 sourceHashEcho（全链一致）。 */
export function predicateP2(receipt, vendorDir) {
  const events = receipt.events;
  const t1 = findEvent(events, 'discovered');
  const current = recomputeManifestHash(vendorDir, events.length ? events[0].assetId : null);
  if (!t1) return { pass: false, reason: '链上无 T1 discovered 事件，sourceHash 基准缺失' };
  if (!current.ok) return { pass: false, reason: 'manifest 字节重算失败: ' + current.reason, recomputed: null, expected: t1.sourceHash };
  if (current.hash !== t1.sourceHash) {
    return { pass: false, reason: `manifest 字节 sha256 已变（重算 ${current.hash.slice(0, 12)}… ≠ T1 ${t1.sourceHash.slice(0, 12)}…）`, recomputed: current.hash, expected: t1.sourceHash };
  }
  for (const ev of events) {
    if (ev.sourceHash !== t1.sourceHash) {
      return { pass: false, reason: `事件 #${ev.eventSeq} sourceHash 与 T1 不一致（全链须一致，GWT-R3-04）`, recomputed: current.hash, expected: t1.sourceHash };
    }
    if (ev.sourceHashEcho != null && ev.sourceHashEcho !== t1.sourceHash) {
      return { pass: false, reason: `事件 #${ev.eventSeq} sourceHashEcho 与 T1 不一致（§7.4 P2 全链一致）`, recomputed: current.hash, expected: t1.sourceHash };
    }
  }
  return { pass: true, hash: current.hash };
}

function recomputeManifestHash(vendorDir, assetId) {
  if (!vendorDir || !assetId) return { ok: false, reason: 'vendorDir/assetId 缺失，无法重算' };
  const { manifestPath } = resolveManifestPath(vendorDir, assetId);
  if (!manifestPath) return { ok: false, reason: `manifest 文件缺失（vendor/${assetId}/）` };
  try { return { ok: true, hash: sha256Hex(fs.readFileSync(manifestPath)) }; }
  catch (error) { return { ok: false, reason: String(error.code ?? error.message) }; }
}

/** P3（事件链完整）：T1-T5 齐备且 hash 链连续；artifactSha256 == T6 时点 artifact 字节 sha256。 */
export function predicateP3(receipt, workspace) {
  const events = receipt.events;
  const missing = ['discovered', 'eligible', 'selected', 'instructions_delivered', 'execution_observed']
    .filter((t) => !findEvent(events, t));
  const t4 = findEvent(events, 'instructions_delivered');
  if (missing.length > 0) {
    const degraded = missing.includes('execution_observed') && !missing.includes('instructions_delivered')
      && t4 && t4.evidence && t4.evidence.deliveryStatus === 'degraded';
    return {
      pass: false,
      reason: degraded ? 'DEGRADED_NO_EXECUTION' : 'RECEIPT_INCOMPLETE',
      missing,
      detail: 'T1-T5 事件缺: ' + missing.join(', '),
    };
  }
  const t1 = events[0];
  for (const ev of events) {
    if (ev.sourceHash !== t1.sourceHash || (ev.sourceHashEcho != null && ev.sourceHashEcho !== t1.sourceHash)) {
      return { pass: false, reason: 'RECEIPT_INCOMPLETE', detail: `事件 #${ev.eventSeq} hash 链断裂（§7.4 P3 逐环相等）` };
    }
  }
  const t5 = findEvent(events, 'execution_observed');
  const artifactAbs = resolveInside(workspace, ['artifacts', receipt.subtaskId], t5.evidence.artifactPath);
  if (!artifactAbs || !fs.existsSync(artifactAbs)) {
    return { pass: false, reason: 'RECEIPT_INCOMPLETE', detail: 'T5 产物文件不存在: ' + t5.evidence.artifactPath };
  }
  const recomputed = sha256Hex(fs.readFileSync(artifactAbs));
  if (recomputed !== t5.evidence.artifactSha256) {
    return { pass: false, reason: 'RECEIPT_INCOMPLETE', detail: `artifactSha256 与 T6 时点产物字节不一致（${recomputed.slice(0, 12)}… ≠ ${String(t5.evidence.artifactSha256).slice(0, 12)}…）` };
  }
  return { pass: true, artifactPath: t5.evidence.artifactPath };
}

/** 路径解析：必须落在 baseDir 内（防逃逸）；返回绝对路径或 null。 */
function resolveInside(workspace, relBase, relPath) {
  if (typeof relPath !== 'string' || !relPath.trim()) return null;
  const normalized = relPath.replace(/\\/g, '/').replace(/^\.\/+/, '');
  const baseDir = path.resolve(workspace, ...relBase);
  const abs = path.resolve(baseDir, normalized);
  if (abs !== baseDir && !abs.startsWith(baseDir + path.sep)) return null;
  return abs;
}

/** P4（反回显）：antiEchoResidue == 0 ⇒ marker-only / copier-only 证据，FAILED（EVIDENCE_ECHO_ONLY）。 */
export function predicateP4(receipt, workspace) {
  const t4 = findEvent(receipt.events, 'instructions_delivered');
  const t5 = findEvent(receipt.events, 'execution_observed');
  if (!t4 || !t5) return { pass: false, reason: 'P4 前置事件缺失（T4/T5）' };
  const briefAbs = resolveInside(workspace, ['artifacts', receipt.subtaskId], t4.evidence.briefPath);
  if (!briefAbs || !fs.existsSync(briefAbs)) return { pass: false, reason: 'brief 不可读: ' + t4.evidence.briefPath };
  const briefText = fs.readFileSync(briefAbs, 'utf8');
  const payloadText = extractPayloadFromBrief(briefText);
  if (payloadText === null) return { pass: false, reason: 'brief 缺少「方法论正文（资产全文）」段锚（§5.2 宿主解析锚）' };
  // anchor/内核 token：优先 T4 evidence 登记值（activation.prepare 提取），否则从 brief 段内同源提取
  let anchor = t4.evidence.anchor;
  let kernelTokens = t4.evidence.kernelTokens;
  if (!anchor || !Array.isArray(kernelTokens)) {
    const derived = extractAnchorAndKernel(payloadText, receipt.events[0] ? receipt.events[0].assetId : '');
    anchor = anchor || derived.anchor;
    kernelTokens = Array.isArray(kernelTokens) ? kernelTokens : derived.kernelTokens;
  }
  const artifactAbs = resolveInside(workspace, ['artifacts', receipt.subtaskId], t5.evidence.artifactPath);
  const artifactText = fs.readFileSync(artifactAbs, 'utf8');
  const residue = antiEchoResidue(artifactText, { anchor, kernelTokens, payloadText });
  return { pass: residue > 0, residue, reason: residue === 0 ? 'EVIDENCE_ECHO_ONLY' : null };
}

/** P5（证据类别合法性）：evidenceRefs 所指事件不得以 legacy assetConsumed 布尔或 marker-presence 为验证依据（§7.8：weak telemetry 对验证判定视而不见）。 */
export function predicateP5(receipt, evidenceRefs) {
  const bySeq = new Map(receipt.events.map((e) => [e.eventSeq, e]));
  for (const ref of evidenceRefs ?? []) {
    const ev = bySeq.get(ref && ref.eventSeq);
    if (!ev) return { pass: false, reason: `evidenceRefs 指向不存在的事件 #${ref && ref.eventSeq}` };
    const ev2 = ev.evidence ?? {};
    if ('assetConsumed' in ev2) {
      return { pass: false, reason: `事件 #${ev.eventSeq} evidence 携带 legacy assetConsumed 布尔（§7.4 P5：telemetry-only，不得作为验证依据）` };
    }
    if (ev2.verificationBasis && ILLEGAL_VERIFICATION_BASIS.has(ev2.verificationBasis)) {
      return { pass: false, reason: `事件 #${ev.eventSeq} verificationBasis=${ev2.verificationBasis}（marker-presence 类证据非法，§7.4 P5）` };
    }
  }
  return { pass: true };
}

// ---------------------------------------------------------------------------
// legacy 裸布尔读法（§7.8/§8.3，OQ-R3-7=A：telemetry-only）
// ---------------------------------------------------------------------------

/**
 * readLegacyArtifact：pre-R3 产物（裸布尔 assetConsumed，无 receipt）的无破坏读法。
 * 永不抛异常（缺 receipt 结构不得崩溃，清单 R3-7/R3-8）；布尔只进 telemetry 通道，
 * gateEligible 恒 false（不能单独或组合地满足 phase gate），canUpgradeToVerified 恒 false。
 */
export function readLegacyArtifact(artifact) {
  const out = {
    readable: true,
    telemetryOnly: true,
    gateEligible: false,
    canUpgradeToVerified: false,
    legacyObserved: 'field-missing',
    receiptPresent: false,
  };
  try {
    if (artifact && typeof artifact === 'object') {
      if ('assetConsumed' in artifact) out.legacyObserved = artifact.assetConsumed === true ? 'consumed-true' : 'consumed-false';
      out.receiptPresent = Boolean(artifact.receipt || artifact.receiptRefs);
    }
  } catch (error) { /* 优雅降级：读法失败不崩溃，按 field-missing 处理 */ }
  return out;
}

/** legacy 裸布尔能否满足 phase gate（OQ-R3-7=A：恒 false——gate 输入 = receipt 事件链的 behavior_verified 判定，属 R4 消费）。 */
export function legacyCanSatisfyGate() { return false; }

// ---------------------------------------------------------------------------
// receipt.append（契约 §2.2 / §7）
// ---------------------------------------------------------------------------

function buildReceiptRef(receipt, file, event) {
  return {
    subtaskId: receipt.subtaskId,
    assetId: event.assetId,
    receiptPath: 'artifacts/' + receipt.subtaskId + '/' + RECEIPT_FILENAME,
    eventSeq: event.eventSeq,
    sourceHash: event.sourceHash,
  };
}

/**
 * receipt.append
 * 输入 input: {
 *   event: { transition, subtaskId, assetId, assetType?, sourceHash, session, idempotencyKey, evidence },
 *   mode?,               // legacy 模式不含 receipt 事件写入（§8.1）⇒ ACTIVATION_MODE_UNSUPPORTED
 *   opts: { workspace, vendorDir?, now? }
 * }
 * 返回 data.receiptRef = {subtaskId, assetId, receiptPath, eventSeq, sourceHash}（§2.2）。
 * 行为验证内嵌：transition=behavior_verified 时执行 §7.4 P1-P5 谓词组，任一失败按 §7.5
 * 收口为 N2/N3 事件（旧事件保留为历史证据，不得改写——PRD0 §9.3.6）。
 */
export function receiptAppend(input) {
  const warnings = [];
  const opts = input.opts ?? {};
  const workspace = opts.workspace;
  if (!workspace) return respond(false, 'RECEIPT_INVALID', { reason: 'opts.workspace 未指定（fail-closed）' });
  const now = opts.now ?? new Date();

  // (0) mode（§8.1：legacy 模式即现状快照，不含 receipt 事件写入；OQ-R3-6=A 复用 YY_RECEIPT_MODE）
  const rawMode = input.mode !== undefined ? input.mode : process.env.YY_RECEIPT_MODE;
  const mode = rawMode === undefined || rawMode === null || rawMode === '' ? 'dual' : rawMode;
  if (mode === 'dual' && input.mode === undefined && process.env.YY_RECEIPT_MODE === undefined) {
    warnings.push("mode 缺省：按 'dual' 处理（MW0 双读语义；缺省值无冻结依据，登记 rebuild-20260920 判定）");
  }
  if (typeof mode !== 'string' || !['legacy', 'dual', 'strict'].includes(mode)) {
    return respond(false, 'ACTIVATION_MODE_UNSUPPORTED', { reason: `mode 值非法: ${mode}（合法值 legacy|dual|strict；§8.1 禁止 silent fallback）` });
  }
  if (mode === 'legacy') {
    return respond(false, 'ACTIVATION_MODE_UNSUPPORTED', { reason: 'legacy 模式不含 receipt 事件写入（§8.1：该模式即现状，assetConsumed 裸布尔按现状读法，见 readLegacyArtifact）' });
  }

  // (1) 事件形状与必含不变量（§3.4：每事件含 assetId、sourceHash、session、幂等键——dev-plan:303 输入列）
  const event = input.event;
  if (!event || typeof event !== 'object') return respond(false, 'RECEIPT_INVALID', { reason: 'event 缺失或非对象（§2.2 输入）' });
  if (!safeSubtaskId(event.subtaskId)) return respond(false, 'RECEIPT_INVALID', { reason: `subtaskId 非法或含路径不安全字符: ${JSON.stringify(event.subtaskId ?? null)}` });
  if (!TRANSITIONS.includes(event.transition)) return respond(false, 'RECEIPT_INVALID', { reason: `transition 枚举外: ${JSON.stringify(event.transition ?? null)}（§7.2 枚举）` });
  if (isBlank(event.assetId) || typeof event.assetId !== 'string') return respond(false, 'RECEIPT_INVALID', { reason: 'assetId 缺失（必含不变量，dev-plan:303）' });
  if (!isSha256(normalizeHash(event.sourceHash))) return respond(false, 'RECEIPT_INVALID', { reason: 'sourceHash 缺失或非 sha256 hex（必含不变量）' });
  if (isBlank(event.session) || typeof event.session !== 'string') return respond(false, 'RECEIPT_INVALID', { reason: 'session 缺失（必含不变量；namespace 规则属 R4，本操作只透传）' });
  if (isBlank(event.idempotencyKey) || typeof event.idempotencyKey !== 'string') return respond(false, 'RECEIPT_INVALID', { reason: 'idempotencyKey 缺失（必含不变量）' });
  if (event.evidence === undefined || event.evidence === null || typeof event.evidence !== 'object' || Array.isArray(event.evidence)) {
    return respond(false, 'RECEIPT_INVALID', { reason: 'evidence 缺失或非对象（§2.2：该 transition 的必需证据）' });
  }
  const sourceHash = normalizeHash(event.sourceHash);
  if (event.assetType !== undefined && !['skill', 'agent'].includes(event.assetType)) {
    return respond(false, 'RECEIPT_INVALID', { reason: `assetType 枚举外: ${event.assetType}（§3.4：'skill'|'agent'）` });
  }

  // (2) 加载 + 结构校验（P1 机验基础：schema / eventSeq 连续 / canonicalHash / 重放一致）
  const file = receiptPath(workspace, event.subtaskId);
  const loaded = loadReceipt(file, event.subtaskId);

  // behavior_verified 特殊路径：进入 §7.4 谓词组（T6 的门是 P1-P5，非 from-状态表——P3 断裂时按 §7.5 收口 N3/UNRESOLVED 而非拒收）
  if (event.transition === 'behavior_verified') {
    return appendBehaviorVerified({ input, event, sourceHash, loaded, file, workspace, vendorDir: opts.vendorDir, now, warnings });
  }

  // (3) P1：已加载链违约（含对 behavior_verified 以外的显式终态追加尝试）⇒ 拒绝追加，文件不变
  if (loaded.error) {
    return respond(false, loaded.error, { reason: loaded.reason }, { receiptPath: 'artifacts/' + event.subtaskId + '/' + RECEIPT_FILENAME }, warnings);
  }
  const receipt = loaded.receipt;
  const { state } = replayEvents(receipt.events);

  // (4) 幂等（§7.6）：同键 + 字节等价事件 ⇒ 返回既有 receiptRef（文件不变）；同键 + 不同 payload ⇒ RECEIPT_INVALID
  const dup = receipt.events.find((e) => e.idempotencyKey === event.idempotencyKey);
  if (dup) {
    const candidate = buildEvent(event, { sourceHash, receipt, assetType: dup.assetType, now, evidence: event.evidence });
    // sourceHashEcho 为链上派生字段（追加时点决定），字节等价比较以链上既有值为准；
    // recordedAt 为幂等豁免字段（§7.6），双方均剔除后比较
    candidate.sourceHashEcho = dup.sourceHashEcho;
    candidate.recordedAt = undefined;
    if (stableJson({ ...candidate, eventSeq: dup.eventSeq }) === stableJson({ ...dup, recordedAt: undefined })) {
      warnings.push(`DUPLICATE_REPLAY: receipt.append 已存在同 idempotencyKey 事件（eventSeq=${dup.eventSeq}），幂等返回既有 receiptRef，文件不变（§7.6）`);
      return respond(true, null, {
        receiptRef: buildReceiptRef(receipt, file, dup),
        transition: dup.transition,
        state: replayEvents(receipt.events).state,
        result: receipt.result ?? null,
        duplicate: true,
      }, { receiptPath: 'artifacts/' + event.subtaskId + '/' + RECEIPT_FILENAME }, warnings);
    }
    return respond(false, 'RECEIPT_INVALID', { reason: `idempotencyKey 冲突且 payload 不同: ${event.idempotencyKey}（§7.6：同键不同 payload ⇒ RECEIPT_INVALID）` });
  }

  // (5) 终态后禁止追加（§7.2：任何负终态 → 正终态、behavior_verified 后同链再追加 ⇒ RECEIPT_INVALID；
  //     新链须由新 sourceHash 的新 activation 开启）
  if (state === 'behavior_verified' || state === 'not_consumed' || state === 'verification_failed' || state === 'unresolved') {
    return respond(false, 'RECEIPT_INVALID', { reason: `链已到终态 ${state}，禁止再追加事件（§7.2；新链须由新 sourceHash 的新 activation 开启）` });
  }

  // (6) 合法跃迁（§7.2 from→to 表；跳步 ⇒ RECEIPT_INVALID）
  if (!LEGAL_FROM[event.transition] || !LEGAL_FROM[event.transition].includes(state)) {
    return respond(false, 'RECEIPT_INVALID', { reason: `非法跃迁: ${state ?? '∅'} → ${event.transition}（§7.2 禁止跳步）` });
  }
  if (event.transition === 'not_consumed' && findEvent(receipt.events, 'instructions_delivered')) {
    return respond(false, 'RECEIPT_INVALID', { reason: 'not_consumed 要求该 (subtaskId, assetId) 无 T4 事件（§7.3 谓词）' });
  }

  // (7) 必需 evidence（§7.3：缺失 ⇒ RECEIPT_INCOMPLETE）
  const missingKeys = (REQUIRED_EVIDENCE[event.transition] ?? []).filter((k) => isBlank(event.evidence[k]) && event.evidence[k] !== false);
  if (missingKeys.length > 0) {
    return respond(false, 'RECEIPT_INCOMPLETE', { reason: `transition ${event.transition} 必需 evidence 缺失: ${missingKeys.join(', ')}（§7.3）`, missingKeys });
  }

  // (8) hash 前置校验（§2.2：事件 sourceHash 与当前资产字节或链上前一事件不一致 ⇒ RECEIPT_HASH_MISMATCH；
  //     负向收口 N1/N2/N3 豁免"当前字节"重算——其职责是记录失配/失败的真实终态，登记为重建判定）
  const isNegative = NEGATIVE_TRANSITIONS.includes(event.transition);
  if (!isNegative && receipt.events.length > 0 && receipt.events[receipt.events.length - 1].sourceHash !== sourceHash) {
    return respond(false, 'RECEIPT_HASH_MISMATCH', { reason: `事件 sourceHash 与链上前一事件不一致（链 ${receipt.events[receipt.events.length - 1].sourceHash.slice(0, 12)}… ≠ 事件 ${sourceHash.slice(0, 12)}…）` });
  }
  if (!isNegative) {
    const current = recomputeManifestHash(opts.vendorDir, event.assetId);
    if (!current.ok || current.hash !== sourceHash) {
      return respond(false, 'RECEIPT_HASH_MISMATCH', {
        reason: `事件 sourceHash 与当前资产字节不一致（${current.ok ? '重算 ' + current.hash.slice(0, 12) + '…' : current.reason} ≠ 事件 ${sourceHash.slice(0, 12)}…；§7.4 P2 / GWT-R3-04）`,
      });
    }
  }
  // T4 附加谓词（§7.3）：(a) sourceHashEcho == T1.sourceHash；(b) payloadSha256 == sha256(brief 段内 payload 字节)
  if (event.transition === 'instructions_delivered') {
    const t1 = receipt.events[0];
    if (t1 && normalizeHash(event.evidence.sourceHashEcho) !== t1.sourceHash) {
      return respond(false, 'RECEIPT_HASH_MISMATCH', { reason: `T4 evidence.sourceHashEcho ≠ T1.sourceHash（§7.3 谓词 (a)；${String(event.evidence.sourceHashEcho).slice(0, 12)}… ≠ ${t1.sourceHash.slice(0, 12)}…）` });
    }
    if (!isSha256(normalizeHash(event.evidence.payloadSha256))) {
      return respond(false, 'RECEIPT_INCOMPLETE', { reason: 'T4 evidence.payloadSha256 非 sha256 hex（§7.3）' });
    }
    if (event.evidence.activationLevel !== undefined && !['metadata', 'body', 'resource'].includes(event.evidence.activationLevel)) {
      return respond(false, 'RECEIPT_INVALID', { reason: `T4 evidence.activationLevel 枚举外: ${event.evidence.activationLevel}（§4）` });
    }
    const briefAbs = resolveInside(workspace, ['artifacts', event.subtaskId], event.evidence.briefPath);
    if (!briefAbs || !fs.existsSync(briefAbs)) {
      return respond(false, 'RECEIPT_INCOMPLETE', { reason: `T4 brief 文件不存在（投递须先写出 brief.md，§7.2 T4 触发）: ${event.evidence.briefPath}` });
    }
    const payload = extractPayloadFromBrief(fs.readFileSync(briefAbs, 'utf8'));
    if (payload === null) {
      return respond(false, 'RECEIPT_INCOMPLETE', { reason: 'brief 缺少「方法论正文（资产全文）」段锚（§5.2 宿主解析锚）' });
    }
    if (sha256Hex(payload) !== normalizeHash(event.evidence.payloadSha256)) {
      return respond(false, 'RECEIPT_INCOMPLETE', { reason: 'payloadSha256 ≠ sha256(brief 段内 payload 字节)（§7.3 T4 谓词 (b)）' });
    }
    // (c)(d)（additive evidence 在场时才判）：metadata ⇒ readCounts 全零；resource ⇒ evidence.resources 与投递资源清单一致
    if (event.evidence.activationLevel === 'metadata' && event.evidence.readCounts) {
      const rc = event.evidence.readCounts;
      if ((rc.body ?? 0) !== 0 || (rc.resource ?? 0) !== 0) {
        return respond(false, 'RECEIPT_INCOMPLETE', { reason: 'level=metadata 要求 body read count = 0 且 resource read count = 0（§7.3 T4 谓词 (c)，GWT-R3-02 口径）' });
      }
    }
    if (event.evidence.activationLevel === 'resource' && Array.isArray(event.evidence.resources)) {
      const delivered = event.evidence.resources.map((r) => (typeof r === 'string' ? r : r && r.path)).filter(Boolean).sort();
      const declared = (event.evidence.recordResources ?? []).map((r) => (typeof r === 'string' ? r : r && r.path)).filter(Boolean).sort();
      if (declared.length && stableJson(delivered) !== stableJson(declared)) {
        return respond(false, 'RECEIPT_INCOMPLETE', { reason: 'evidence.resources ≠ record.resources（§7.3 T4 谓词 (d)）' });
      }
    }
  }
  // T5 附加谓词（§7.3）：artifact 存在、非空、后缀白名单、≠ brief.md/result.txt、sha256 一致、executed===true
  if (event.transition === 'execution_observed') {
    if (event.evidence.executed !== true) {
      return respond(false, 'RECEIPT_INCOMPLETE', { reason: 'T5 evidence.executed 须为 true（§7.3；宿主失败/空输出 ⇒ 无 execution_observed 事件）' });
    }
    const artifactAbs = resolveInside(workspace, ['artifacts', event.subtaskId], event.evidence.artifactPath);
    const base = path.basename(String(event.evidence.artifactPath ?? ''));
    if (!artifactAbs) return respond(false, 'RECEIPT_INCOMPLETE', { reason: 'T5 evidence.artifactPath 非法（越出 artifacts/<subtaskId>/）' });
    if (!ARTIFACT_EXT.test(base) || ARTIFACT_EXCLUDED.has(base)) {
      return respond(false, 'RECEIPT_INCOMPLETE', { reason: `T5 产物后缀/命名不合规: ${base}（§7.3：后缀 ∈ .md/.json/.yaml/.yml，≠ brief.md/result.txt）` });
    }
    if (!fs.existsSync(artifactAbs)) return respond(false, 'RECEIPT_INCOMPLETE', { reason: `T5 产物文件不存在: ${event.evidence.artifactPath}` });
    const bytes = fs.readFileSync(artifactAbs);
    if (!String(bytes).trim()) return respond(false, 'RECEIPT_INCOMPLETE', { reason: 'T5 产物为空（§7.3：非空要求；纯空白不算产出）' });
    if (!isSha256(normalizeHash(event.evidence.artifactSha256)) || sha256Hex(bytes) !== normalizeHash(event.evidence.artifactSha256)) {
      return respond(false, 'RECEIPT_INCOMPLETE', { reason: 'artifactSha256 ≠ sha256(产物字节)（§7.3 T5 谓词 (b)）' });
    }
  }
  // eligible 附加谓词（§7.3）：phaseEligibility.eligible === true
  if (event.transition === 'eligible') {
    const pe = event.evidence.phaseEligibility;
    if (!pe || typeof pe !== 'object' || pe.eligible !== true) {
      return respond(false, 'RECEIPT_INCOMPLETE', { reason: 'T2 evidence.phaseEligibility.eligible 须 === true（§7.3 谓词；判定为 false 不得登记 eligible 事件）' });
    }
  }
  // T2/T3/T6 之外显式携带 behaviorCheck 的事件（N2/N3）：result 须与 transition 匹配
  if (event.transition === 'verification_failed' || event.transition === 'unresolved') {
    const bc = event.evidence.behaviorCheck;
    const expected = event.transition === 'verification_failed' ? 'FAILED' : 'UNRESOLVED';
    if (!bc || typeof bc !== 'object' || bc.result !== expected) {
      return respond(false, 'RECEIPT_INVALID', { reason: `${event.transition} 的 behaviorCheck.result 须为 ${expected}（§3.3/§7.3）` });
    }
    if (isBlank(event.evidence.reason)) {
      return respond(false, 'RECEIPT_INCOMPLETE', { reason: `${event.transition} 必需 reason 缺失（§7.3）` });
    }
  }

  // (9) 落盘（进程锁内 read-modify-write；append-only：旧事件永不改写）
  const assetType = event.assetType ?? deriveAssetType(opts.vendorDir, event.assetId);
  const normalizedEvidence = event.evidence;
  const built = buildEvent(event, { sourceHash, receipt, assetType, now, evidence: normalizedEvidence });
  receipt.events.push(built);
  const replayed = replayEvents(receipt.events);
  if (TERMINAL_RESULT[built.transition]) {
    // 终态：result 缓存 = 终态事件的 behaviorCheck（not_consumed 由本操作构造）
    receipt.result = built.transition === 'not_consumed'
      ? normalizeBehaviorCheck(null, {
        subtaskId: event.subtaskId, assetId: event.assetId, result: 'UNRESOLVED',
        reason: 'SELECTED_NOT_CONSUMED', checkedAt: new Date(now).toISOString(),
      })
      : built.evidence.behaviorCheck;
  } else {
    receipt.result = replayed.result ?? null;
  }
  receipt.canonicalHash = canonicalReceiptHash(receipt);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  } catch (error) {
    return respond(false, 'RECEIPT_INVALID', { reason: 'receipt.json 写入失败（fail-closed，事件未落盘）: ' + String(error.code ?? error.message) });
  }

  return respond(true, null, {
    receiptRef: buildReceiptRef(receipt, file, built),
    transition: built.transition,
    state: replayEvents(receipt.events).state,
    result: receipt.result ?? null,
  }, { receiptPath: 'artifacts/' + event.subtaskId + '/' + RECEIPT_FILENAME }, warnings);
}

function deriveAssetType(vendorDir, assetId) {
  if (vendorDir && assetId) {
    const { assetType } = resolveManifestPath(vendorDir, assetId);
    if (assetType) return assetType;
  }
  return 'skill';
}

function buildEvent(input, ctx) {
  const events = ctx.receipt.events;
  return {
    eventSeq: ctx.forceSeq ?? events.length + 1,
    transition: input.transition,
    assetId: input.assetId,
    assetType: ctx.assetType,
    sourceHash: ctx.sourceHash,
    sourceHashEcho: events.length ? events[events.length - 1].sourceHash : null,
    session: input.session,
    idempotencyKey: input.idempotencyKey,
    evidence: ctx.evidence,
    recordedAt: new Date(ctx.now).toISOString(), // 幂等豁免字段（§7.6）
  };
}

// ---------------------------------------------------------------------------
// behavior_verified 内嵌验证（§7.4 P1-P5；OQ-R3-9=A 验证内嵌于 receipt.append）
// ---------------------------------------------------------------------------

function appendBehaviorVerified(ctx) {
  const { event, sourceHash, loaded, file, workspace, vendorDir, now, warnings } = ctx;
  const receiptRel = 'artifacts/' + event.subtaskId + '/' + RECEIPT_FILENAME;
  const required = (REQUIRED_EVIDENCE.behavior_verified ?? []).filter((k) => isBlank(event.evidence[k]));
  if (required.length > 0) {
    return respond(false, 'RECEIPT_INCOMPLETE', { reason: `behavior_verified 必需 evidence 缺失: ${required.join(', ')}（§7.3）`, missingKeys: required });
  }
  if (loaded.error) {
    // P1 失败（缺失/违约）⇒ N3 unresolved 收口 + RECEIPT_INCOMPLETE/RECEIPT_INVALID（§7.4 P1 / §7.5；清单 R3-8 优雅降级不崩溃）
    return writeTerminalNegative({
      event, sourceHash, file, workspace, now, warnings,
      freshReceipt: event.subtaskId,
      result: 'UNRESOLVED',
      reason: loaded.error === 'RECEIPT_INVALID' ? 'RECEIPT_INVALID' : 'RECEIPT_INCOMPLETE',
      code: loaded.error,
      detail: loaded.reason,
      evidenceRefs: [],
    });
  }
  const receipt = loaded.receipt;
  const { state } = replayEvents(receipt.events);
  if (state === 'behavior_verified' || state === 'not_consumed' || state === 'verification_failed' || state === 'unresolved') {
    return respond(false, 'RECEIPT_INVALID', { reason: `链已到终态 ${state}，禁止再验证（§7.2；新链须由新 sourceHash 的新 activation 开启）` });
  }
  // 幂等：behavior_verified 的同键重放（验证是幂等判定，不产生重复事件）
  const dup = receipt.events.find((e) => e.idempotencyKey === event.idempotencyKey);
  if (dup) {
    warnings.push(`DUPLICATE_REPLAY: receipt.append 已存在同 idempotencyKey 事件（eventSeq=${dup.eventSeq}），幂等返回既有 receiptRef，文件不变（§7.6）`);
    return respond(true, null, {
      receiptRef: buildReceiptRef(receipt, file, dup), transition: dup.transition,
      state: replayEvents(receipt.events).state, result: receipt.result ?? null, duplicate: true,
    }, { receiptPath: receiptRel }, warnings);
  }

  // 调用方 behaviorCheck 形状：T6 写入的必须是 VERIFIED 判定（schema 违约 ⇒ RECEIPT_INVALID）
  const callerCheck = event.evidence.behaviorCheck;
  if (!callerCheck || typeof callerCheck !== 'object' || callerCheck.result !== 'VERIFIED') {
    return respond(false, 'RECEIPT_INVALID', { reason: 'behavior_verified 的 evidence.behaviorCheck.result 须为 VERIFIED（§7.2 T6：谓词全过才写 VERIFIED；预判失败请显式追加 verification_failed/unresolved 事件）' });
  }
  const evidenceRefs = Array.isArray(event.evidence.evidenceRefs) ? event.evidence.evidenceRefs : [];

  // P1（receipt 完整性）—— loadReceipt 已机验（schema/seq/canonicalHash/重放一致）
  // P2（source hash 一致性）⇒ 失败：N2 + RECEIPT_HASH_MISMATCH（§7.5；GWT-R3-04 资产行为不得标记 verified）
  const p2 = predicateP2(receipt, vendorDir);
  if (!p2.pass) {
    return writeTerminalNegative({
      event, sourceHash: p2.recomputed ?? sourceHash, file, workspace, now, warnings,
      receipt,
      result: 'FAILED', reason: 'RECEIPT_HASH_MISMATCH', code: 'RECEIPT_HASH_MISMATCH',
      detail: p2.reason, evidenceRefs, p2,
    });
  }
  // P3（事件链完整）⇒ 失败：N3 + RECEIPT_INCOMPLETE（reason DEGRADED_NO_EXECUTION 当 T4 登记降级投递——§7.7 case 7）
  const p3 = predicateP3(receipt, workspace);
  if (!p3.pass) {
    return writeTerminalNegative({
      event, sourceHash, file, workspace, now, warnings,
      receipt,
      result: 'UNRESOLVED', reason: p3.reason, code: 'RECEIPT_INCOMPLETE',
      detail: p3.detail ?? p3.reason, evidenceRefs, p3,
    });
  }
  // P4（反回显）⇒ 失败：N2 + FAILED/EVIDENCE_ECHO_ONLY（决策结果进 data 不进 error——§7.5 降级/N1 行同款语义）
  const p4 = predicateP4(receipt, workspace);
  if (!p4.pass) {
    warnings.push('P4 反回显谓词拒绝：移除 anchor/内核 token/注入指令复述 token/payload 逐字节片段后实质内容为空——marker-only / copier-only 证据不得 VERIFIED（§7.4 P4 / §7.7）');
    return writeTerminalNegative({
      event, sourceHash, file, workspace, now, warnings,
      receipt,
      result: 'FAILED', reason: 'EVIDENCE_ECHO_ONLY', code: null,
      detail: `P4 residue=0（${p4.reason ?? '归一化移除后无实质内容'}）`, evidenceRefs, p4,
      decisionResult: true,
    });
  }
  // P5（证据类别合法性）⇒ 失败：N2 + FAILED/EVIDENCE_ECHO_ONLY（weak telemetry 对验证判定视而不见，§7.8）
  const p5 = predicateP5(receipt, evidenceRefs);
  if (!p5.pass) {
    warnings.push('P5 证据类别谓词拒绝：' + p5.reason);
    return writeTerminalNegative({
      event, sourceHash, file, workspace, now, warnings,
      receipt,
      result: 'FAILED', reason: 'EVIDENCE_ECHO_ONLY', code: null,
      detail: p5.reason, evidenceRefs, p5,
      decisionResult: true,
    });
  }
  // evidenceRefs 覆盖检查（§7.3 T6：VERIFIED 必须覆盖 T1-T5 全链）
  const seqs = new Set(evidenceRefs.map((r) => r && r.eventSeq));
  const uncovered = [1, 2, 3, 4, 5].filter((n) => !seqs.has(n));
  if (uncovered.length > 0) {
    return writeTerminalNegative({
      event, sourceHash, file, workspace, now, warnings,
      receipt,
      result: 'UNRESOLVED', reason: 'RECEIPT_INCOMPLETE', code: 'RECEIPT_INCOMPLETE',
      detail: `evidenceRefs 未覆盖 T1-T5 全链（缺 #${uncovered.join(', #')}）`, evidenceRefs,
    });
  }

  // P1-P5 全过 ⇒ 追加 T6，result=VERIFIED（§7.2 T6）
  const lockKey = path.resolve(file);
  if (locks.has(lockKey)) return respond(false, 'RECEIPT_INVALID', { reason: '同 receipt.json 的并发追加被拒绝（§7.6 串行化）' });
  locks.add(lockKey);
  try {
    const checkedAt = new Date(now).toISOString();
    const behaviorCheck = normalizeBehaviorCheck(callerCheck, {
      subtaskId: event.subtaskId, assetId: event.assetId, result: 'VERIFIED',
      reason: null, evidenceRefs, checkedAt,
    });
    const t6Evidence = { behaviorCheck, evidenceRefs };
    const built = buildEvent(event, { sourceHash, receipt, assetType: event.assetType ?? deriveAssetType(vendorDir, event.assetId), now, evidence: t6Evidence });
    receipt.events.push(built);
    receipt.result = behaviorCheck;
    receipt.canonicalHash = canonicalReceiptHash(receipt);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
    return respond(true, null, {
      receiptRef: buildReceiptRef(receipt, file, built),
      transition: 'behavior_verified',
      state: 'behavior_verified',
      result: behaviorCheck,
      behaviorCheck,
    }, { receiptPath: receiptRel, predicates: { P1: true, P2: p2.hash, P3: p3.artifactPath, P4: p4.residue, P5: true } }, warnings);
  } catch (error) {
    return respond(false, 'RECEIPT_INVALID', { reason: 'T6 落盘失败（fail-closed）: ' + String(error.code ?? error.message) });
  } finally {
    locks.delete(lockKey);
  }
}

/**
 * 终态负向收口写入（N2/N3）：旧事件保留为历史证据，不得改写（PRD0 §9.3.6）；
 * 负向事件豁免"当前字节"hash 前置校验（记录失配/失败的真实终态，登记为重建判定）。
 * decisionResult=true（P4/P5 判定拒绝）时响应 ok:true、结果进 data（§7.5：决策结果非错误）；
 * 否则 ok:false + 稳定错误码（RECEIPT_HASH_MISMATCH / RECEIPT_INCOMPLETE）。
 */
function writeTerminalNegative(cfg) {
  const { event, sourceHash, file, workspace, now, warnings, receipt, result, reason, code, detail, evidenceRefs, decisionResult } = cfg;
  const receiptRel = 'artifacts/' + event.subtaskId + '/' + RECEIPT_FILENAME;
  const target = receipt ?? freshReceipt(event.subtaskId);
  const transition = result === 'FAILED' ? 'verification_failed' : 'unresolved';
  const checkedAt = new Date(now).toISOString();
  const behaviorCheck = normalizeBehaviorCheck(event.evidence ? event.evidence.behaviorCheck : null, {
    subtaskId: event.subtaskId, assetId: event.assetId, result, reason, evidenceRefs, checkedAt,
  });
  const negEvidence = { behaviorCheck, reason, detail: detail ?? null };
  const built = buildEvent(
    { transition, assetId: event.assetId, session: event.session, idempotencyKey: event.idempotencyKey },
    { sourceHash, receipt: target, assetType: event.assetType ?? deriveAssetType(cfg.vendorDir, event.assetId), now, evidence: negEvidence },
  );
  target.events.push(built);
  target.result = behaviorCheck;
  target.canonicalHash = canonicalReceiptHash(target);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(target, null, 2) + '\n', 'utf8');
  } catch (error) {
    return respond(false, 'RECEIPT_INVALID', { reason: '负向收口落盘失败（fail-closed）: ' + String(error.code ?? error.message) });
  }
  const data = {
    receiptRef: buildReceiptRef(target, file, built),
    transition,
    state: transition,
    result: behaviorCheck,
    behaviorCheck,
    reason,
    detail: detail ?? null,
  };
  if (cfg.p2) data.p2 = { recomputed: cfg.p2.recomputed ?? null, expected: cfg.p2.expected ?? null };
  if (cfg.p4) data.p4 = { residue: cfg.p4.residue };
  return respond(decisionResult ? true : false, decisionResult ? null : code, data, { receiptPath: receiptRel }, warnings);
}

// ---------------------------------------------------------------------------
// P1 独立复验入口（消费方/R4/R6 复核用；§7.6 回放规则）
// ---------------------------------------------------------------------------

/** verifyReceiptFile：加载 + schema + eventSeq + canonicalHash + 重放一致（P1）。缺失 ⇒ RECEIPT_INCOMPLETE（优雅降级，不崩溃）。 */
export function verifyReceiptFile(workspace, subtaskId, opts = {}) {
  const file = receiptPath(workspace, subtaskId);
  if (!fs.existsSync(file)) {
    return respond(false, 'RECEIPT_INCOMPLETE', {
      reason: `receipt.json 缺失: artifacts/${subtaskId}/${RECEIPT_FILENAME}（§7.4 P1；优雅降级为带诊断的"未验证"视图，清单 R3-8）`,
      state: null, result: null, verified: false,
    });
  }
  const loaded = loadReceipt(file, subtaskId);
  if (loaded.error) {
    return respond(false, loaded.error, { reason: loaded.reason, state: null, result: null, verified: false });
  }
  const { state, result } = replayEvents(loaded.receipt.events);
  const cacheConsistent = stableJson(loaded.receipt.result ?? null) === stableJson(result ?? null);
  return respond(cacheConsistent, cacheConsistent ? null : 'RECEIPT_INVALID', {
    state,
    result: loaded.receipt.result ?? null,
    verified: state === 'behavior_verified',
    eventCount: loaded.receipt.events.length,
    canonicalHash: loaded.receipt.canonicalHash ?? null,
  }, { receiptPath: 'artifacts/' + subtaskId + '/' + RECEIPT_FILENAME }, []);
}

// ---------------------------------------------------------------------------
// run() 分发入口
// ---------------------------------------------------------------------------

/** run('receipt.append', input) → 统一响应壳（R3 仅此一操作由本模块承载；activation.prepare 见 activation.mjs） */
export function run(op, input) {
  if (op === 'receipt.append') return receiptAppend(input);
  return respond(false, 'RECEIPT_INVALID', { reason: `未知操作: ${op}（本模块仅承载 receipt.append；activation.prepare 由 activation.mjs 承载）` });
}

export default {
  run, receiptAppend, verifyReceiptFile, replayEvents, canonicalReceiptHash,
  predicateP1, predicateP2, predicateP3, predicateP4, predicateP5, antiEchoResidue,
  readLegacyArtifact, legacyCanSatisfyGate,
  TRANSITIONS, FORWARD_TRANSITIONS, NEGATIVE_TRANSITIONS, REQUIRED_EVIDENCE, ERROR_CODES, RECEIPT_FILENAME,
};
