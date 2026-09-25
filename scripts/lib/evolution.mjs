/**
 * evolution.mjs — R10: Skill Asset Evolution and Independent-Context Acceptance（C-R10 契约实现）
 *
 * 操作面（仅两操作，不新增操作名）：evolution.propose / evolution.accept。
 * 统一响应壳：{ok, code, data, evidence, warnings}；错误码仅六：
 *   CANDIDATE_INVALID / BASELINE_MISSING / ASSET_VERSION_CONFLICT /
 *   INDEPENDENT_VERIFICATION_REQUIRED / EVOLUTION_REGRESSION / PROMOTION_NOT_ALLOWED。
 *
 * 消费方只读保证（§2.2）：R3 receipt/behavior 证据类别与 P1-P5 谓词、R4 CI truth 分类、
 * R8 finding schema/accepted finding、change records 均只读消费、不重定义；
 * catalog、change records、R3 receipt、R8 finding ledger（§2.2 "只读保证"）。
 *
 * promotion 三维判定（OQ-R10-3=A）：token 预算不增 + behavior（receipt 终态）不劣于
 * baseline + compatibility（结构/CI）全过。阈值数值 [待补充] → 实现侧为显式参数，
 * 缺失时不得自动判升，按 PROMOTION_NOT_ALLOWED / UNRESOLVED fail-closed 收口，
 * 在 warnings 中显式标注 "等 Owner 给数"，禁止编造数值。
 *
 * PROVISIONAL→PROMOTED 升格证据（OQ-R10-5=A）= 独立上下文验收 exit 0 +
 * 无 EVOLUTION_REGRESSION + rollback 排练通过；任一回归 → 回退 catalog 到 last accepted
 * 并保留失败候选证据轨迹。
 *
 * catalog 只在 promotion receipt 完成后才更新；本实现只签 receipt，不直改 catalog
 * （catalog 更新属 R6 复核面，promotion receipt 链由 R6 审计）。
 *
 * 重建说明（recovery-20260919）：本文件为按 C-R10 规格 + 编排者验收证据的重建实现，
 * 非逐字节恢复（原 sha256 前 16 位 9ea238c4de3a3fd7）。行为级验收标准见
 * test-reports/R10-rebuild-20260920/（12 fixture 与原复跑摘要逐字对照）。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// 常量（契约 §8 / OQ-R10-1..6=A）
// ---------------------------------------------------------------------------

/** 9 资产白名单（drop 7 后幸存 vendor/ 9 根，逐字；名单权威=manifest，此处为报告/校验静态基线） */
export const ASSET_WHITELIST = Object.freeze([
  'dev-planner', 'frontend-design', 'implementation', 'planning',
  'review', 'sdlc', 'security', 'skill-sentinel', 'be-validator',
]);

/** 候选状态集六值（REPORT.md L154 "CANDIDATE_STATUSES 六"；字面为重建推断，见 GAP 清单） */
export const CANDIDATE_STATUSES = Object.freeze([
  'DRAFT', 'CANDIDATE', 'PROVISIONAL', 'PROMOTED', 'REJECTED', 'UNRESOLVED',
]);

/** 错误码仅六（第七码 = STOP 条件，不出现） */
export const ERROR_CODES = Object.freeze([
  'CANDIDATE_INVALID', 'BASELINE_MISSING', 'ASSET_VERSION_CONFLICT',
  'INDEPENDENT_VERIFICATION_REQUIRED', 'EVOLUTION_REGRESSION', 'PROMOTION_NOT_ALLOWED',
]);

/** 16 资产闭环行状态（契约 §5.3；聚合六态由 CANDIDATE_STATUSES 推导） */
export const ASSET_CLOSURE_STATUSES = Object.freeze([
  'UNCHANGED', 'CANDIDATE', 'PROMOTED', 'REJECTED', 'UNRESOLVED',
]);

/**
 * 候选十项不变量字段（契约 §2.1；§2.1 全表逐字未恢复——其中 trigger 为编排者实测
 * 逐字命中，其余九项为按候选 schema 语义重建，见 recovery GAP 清单 §17.1）。
 * sourceVersion / proposedBy 为候选 schema 顶层字段（§3），在本表之外单独校验。
 * propose 对十项逐一校验，fail-closed，缺失即 CANDIDATE_INVALID 并指名缺失字段。
 */
export const CANDIDATE_INVARIANT_FIELDS = Object.freeze([
  'assetScope',        // 目标域（assetId 所属 CLUSTERS 域，只读自 matrix）
  'trigger',           // 触发来源（C7 quality finding / change record / Owner 指令）
  'rationale',         // 变更理由
  'acceptanceCriteria',// 验收标准（独立上下文验收的判定依据）
  'changeset',         // 变更集（文件/内容摘要，append-only 证据）
  'riskAssessment',    // 风险评估
  'baselineRef',       // 基线引用（§4 baseline 记录指针）
  'rollbackTarget',    // 回滚目标（last accepted 版本标识）
  'evidenceRefs',      // 证据引用（R3 receipt / R8 finding 等，只读引用）
  'proposerSession',   // 提案会话标识（防自验比对键）
]);

/** baseline 五键（OQ-R10-2=A 逐字）：结构 / manifest / receipt 终态 / CI 段 / rollback 目标 */
export const BASELINE_REQUIRED_KEYS = Object.freeze([
  'structure', 'manifest', 'receiptTerminal', 'ciSection', 'rollbackTarget',
]);

/** isolated-context profile 五字段（OQ-R10-4=A 逐字） */
export const ISOLATED_PROFILE_FIELDS = Object.freeze([
  'sessionId', 'agentIdentity', 'contextSeed', 'limitations', 'provisionalStatus',
]);

/** promotion/rollback receipt 九字段（OQ-R10-6=A 逐字）；canonicalHash = sha256 同构 C-R4 */
export const RECEIPT_FIELDS = Object.freeze([
  'promotionId', 'candidateId', 'baselineRef', 'verdict', 'promotionDecision',
  'rollbackTarget', 'executedAt', 'approvedBy', 'canonicalHash',
]);

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

function respond(ok, code, data, evidence, warnings) {
  return { ok, code: code ?? null, data: data ?? {}, evidence: evidence ?? [], warnings: warnings ?? [] };
}

function isBlank(v) {
  return v === undefined || v === null || v === '';
}

/** candidateId = cnd-<YYYYMMDDTHHMMSSZ>-<8位随机>（OQ-R10-1=A 紧凑形） */
function formatCandidateId(now, rand) {
  const d = (now instanceof Date) ? now : new Date(now);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  const stamp = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  return `cnd-${stamp}-${rand}`;
}

/** 候选存储布局：evidence/evolution/<assetId>/<candidateId>/{candidate/, baseline/, promotion/}（OQ-R10-1=A） */
function candidateDir(root, assetId, candidateId) {
  return path.join(root, assetId, candidateId);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function writeJsonOnce(file, obj) {
  if (fs.existsSync(file)) return false; // append-only：候选本体不覆写
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  return true;
}

function appendJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(obj) + '\n', 'utf8');
}

/** 幂等索引（evidence 根下 .idempotency.json：key → candidateId） */
function idempotencyFile(root) { return path.join(root, '.idempotency.json'); }

function listCandidateIds(root, assetId) {
  const dir = path.join(root, assetId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => n.startsWith('cnd-'));
}

// ---------------------------------------------------------------------------
// evolution.propose（提案侧；baseline-first 前置，契约 §2/§4）
// ---------------------------------------------------------------------------

/**
 * evolution.propose
 * 输入 input: { assetId, sourceVersion, proposedBy, idempotencyKey?, baseline, candidate, opts? }
 *   - candidate: 十项不变量字段（CANDIDATE_INVARIANT_FIELDS）齐备
 *   - baseline:  五键（BASELINE_REQUIRED_KEYS）齐备，不含候选先行运行（GWT-R10-02）
 *   - opts: { now, rand }（确定性注入，供文件化探针复现；生产省略）
 * 校验顺序：白名单 → 十项不变量 → baseline 五键 → 同版本开放候选冲突 → 幂等重放。
 */
export function evolutionPropose(input) {
  const warnings = [];
  const evidence = [];
  const opts = input.opts ?? {};
  const root = opts.evidenceRoot;
  if (!root) return respond(false, 'CANDIDATE_INVALID', { reason: 'evidenceRoot 未指定（fail-closed）' });

  // 幂等重放（f06）：同 idempotencyKey 返回原 candidateId + DUPLICATE_REPLAY warning；
  // DUPLICATE_REPLAY 走 warnings 通道，不在六错误码内。
  const idemFile = idempotencyFile(root);
  const idem = readJson(idemFile) ?? {};
  if (input.idempotencyKey && idem[input.idempotencyKey]) {
    const originalId = idem[input.idempotencyKey];
    const assetOf = findAssetDir(root, originalId);
    const prior = assetOf ? readJson(path.join(root, assetOf, originalId, 'candidate', 'candidate.json')) : null;
    warnings.push(`DUPLICATE_REPLAY: evolution.propose 已存在同 idempotencyKey 候选，返回原 candidateId ${originalId}`);
    return respond(true, null, {
      candidateId: originalId, stored: Boolean(prior), duplicate: true, status: prior?.status ?? 'CANDIDATE',
    }, evidence, warnings);
  }

  // (1) 16 资产白名单（契约 §8；f03）
  if (!ASSET_WHITELIST.includes(input.assetId)) {
    return respond(false, 'CANDIDATE_INVALID', {
      reason: `assetId 不在 16 资产白名单内: ${input.assetId}（§8 fail-closed）`,
    });
  }

  // (2) 十项不变量逐项校验（契约 §2.1；f02 实测口径：指名缺失字段 + §2.1 fail-closed）
  const cand = input.candidate ?? {};
  const missing = CANDIDATE_INVARIANT_FIELDS.filter((k) => isBlank(cand[k]));
  if (missing.length > 0) {
    return respond(false, 'CANDIDATE_INVALID', {
      reason: `候选缺少十项不变量字段: ${missing.join(', ')}（§2.1 fail-closed）`,
      missingFields: missing,
    });
  }
  if (isBlank(input.sourceVersion) || isBlank(input.proposedBy)) {
    return respond(false, 'CANDIDATE_INVALID', {
      reason: '候选缺少 sourceVersion / proposedBy（§2.1 fail-closed）',
    });
  }

  // (3) baseline 五键齐备（OQ-R10-2=A；f04）——缺任一键 ⇒ BASELINE_MISSING，不臆断补全
  const baseline = input.baseline ?? {};
  const missingKeys = BASELINE_REQUIRED_KEYS.filter((k) => isBlank(baseline[k]));
  if (missingKeys.length > 0) {
    return respond(false, 'BASELINE_MISSING', {
      reason: `baseline 五键缺任一（结构/manifest/receipt 终态/CI 段/rollback 目标）: ${missingKeys.join(', ')}（OQ-R10-2=A fail-closed）`,
      missingKeys,
    });
  }

  // (4) 同 assetId 同 sourceVersion 的未终态候选 ⇒ ASSET_VERSION_CONFLICT（f05）
  for (const existingId of listCandidateIds(root, input.assetId)) {
    const prior = readJson(path.join(root, input.assetId, existingId, 'candidate', 'candidate.json'));
    if (!prior) continue;
    const terminal = prior.status === 'PROMOTED' || prior.status === 'REJECTED';
    if (!terminal && prior.sourceVersion === input.sourceVersion) {
      return respond(false, 'ASSET_VERSION_CONFLICT', {
        reason: `同 assetId 同 sourceVersion 已有未终态候选 ${existingId}（§2 候选 schema 冲突）`,
        conflictingCandidateId: existingId,
      });
    }
  }

  // 落盘（OQ-R10-1=A 三目录 append-only；候选状态：平台降级 isolated 提案 → PROVISIONAL）
  const candidateId = formatCandidateId(opts.now ?? new Date(), opts.rand ?? crypto.randomBytes(4).toString('hex'));
  const degraded = Array.isArray(cand.proposerLimitations) && cand.proposerLimitations.length > 0;
  const record = {
    candidateId,
    assetId: input.assetId,
    sourceVersion: input.sourceVersion,
    proposedBy: input.proposedBy,
    idempotencyKey: input.idempotencyKey ?? null,
    status: degraded ? 'PROVISIONAL' : 'CANDIDATE',
    candidate: cand,
    createdAt: new Date(opts.now ?? Date.now()).toISOString(),
  };
  const dir = candidateDir(root, input.assetId, candidateId);
  const stored = writeJsonOnce(path.join(dir, 'candidate', 'candidate.json'), record);
  writeJsonOnce(path.join(dir, 'baseline', 'baseline.json'), baseline);
  if (input.idempotencyKey) {
    idem[input.idempotencyKey] = candidateId;
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(idemFile, JSON.stringify(idem, null, 2) + '\n', 'utf8');
  }
  evidence.push(`evidence/evolution/${input.assetId}/${candidateId}/candidate/candidate.json`);

  return respond(true, null, {
    candidateId, stored, status: record.status,
    storageLayout: `evidence/evolution/${input.assetId}/${candidateId}/{candidate,baseline,promotion}/`,
  }, evidence, warnings);
}

function findAssetDir(root, candidateId) {
  if (!fs.existsSync(root)) return null;
  for (const asset of ASSET_WHITELIST) {
    if (fs.existsSync(path.join(root, asset, candidateId, 'candidate', 'candidate.json'))) return asset;
  }
  return null;
}

/** 终态跃迁登记（PROMOTED / REJECTED / UNRESOLVED；候选本体终态字段 + 轨迹追加） */
function markTerminal(dir, status) {
  const candFile = path.join(dir, 'candidate', 'candidate.json');
  const updated = JSON.parse(fs.readFileSync(candFile, 'utf8'));
  updated.status = status;
  updated.statusAt = new Date().toISOString();
  fs.writeFileSync(candFile, JSON.stringify(updated, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// evolution.accept（独立上下文验收侧；契约 §4/§5/§6）
// ---------------------------------------------------------------------------

/**
 * 三维判定输入注释（恢复的源码注释原行 L390-L392）：
 *     tokenResult: { ok (bool), [待补充阈值数值] }
 *     behaviorResult: { ok (bool), [待补充阈值数值] }
 *     compatibilityResult: { ok (bool), [待补充阈值数值] }
 * 任一缺失或 ok 非 true → PROMOTION_NOT_ALLOWED fail-closed（阈值数值 [待补充]，不编造）
 * 阈值数值缺 Owner 给定的具体判定字段 → 如实登记 [待补充]
 */
function evaluateDimensions(decision) {
  const dims = ['tokenResult', 'behaviorResult', 'compatibilityResult'];
  const missing = [];
  const failed = [];
  for (const d of dims) {
    const r = decision?.[d];
    if (!r || typeof r.ok !== 'boolean') missing.push(d);
    else if (r.ok !== true) failed.push(d);
  }
  return { missing, failed };
}

/**
 * evolution.accept
 * 输入 input: { candidateId, isolatedVerdict, promotionDecision, rollbackRehearsalPassed?, pressureRuns?, opts? }
 *   - isolatedVerdict: 五字段 profile（OQ-R10-4=A）+ exitCode（独立验收退出码）
 *   - promotionDecision: { tokenResult, behaviorResult, compatibilityResult } 三维
 * 校验顺序：候选存在 → 防自验/独立性 → 兼容回归 → 三维完整度 → PROVISIONAL 升格证据 → 判定。
 * 无论 verdict 如何均签发 receipt（append-only 轨迹；REPORT.md L153）。
 */
export function evolutionAccept(input) {
  const warnings = [];
  const evidence = [];
  const opts = input.opts ?? {};
  const root = opts.evidenceRoot;
  if (!root || isBlank(input.candidateId)) {
    return respond(false, 'CANDIDATE_INVALID', { reason: 'evidenceRoot / candidateId 未指定（fail-closed）' });
  }

  const assetOf = findAssetDir(root, input.candidateId);
  if (!assetOf) {
    return respond(false, 'CANDIDATE_INVALID', { reason: `候选不存在: ${input.candidateId}` });
  }
  const record = readJson(path.join(root, assetOf, input.candidateId, 'candidate', 'candidate.json'));
  const dir = candidateDir(root, assetOf, input.candidateId);

  // 防自验与独立性（OQ-R10-4=A / §6.1；f07 实测 reason 逐字）
  const verdict = input.isolatedVerdict ?? null;
  const missingProfile = ISOLATED_PROFILE_FIELDS.filter((k) => isBlank(verdict?.[k]));
  if (!verdict || missingProfile.length > 0) {
    return respond(false, 'INDEPENDENT_VERIFICATION_REQUIRED', {
      reason: `isolated-context profile 五字段缺失: ${missingProfile.join(', ') || 'isolatedVerdict 缺失'}（§6.1）`,
      missingProfileFields: missingProfile,
    });
  }
  if (verdict.agentIdentity === record.proposedBy) {
    return respond(false, 'INDEPENDENT_VERIFICATION_REQUIRED', {
      reason: '验收方身份与 proposedBy 相同（producer 自验，§6.1 禁止）',
    });
  }

  // 三维判定（OQ-R10-3=A）
  const { missing, failed } = evaluateDimensions(input.promotionDecision);

  // compatibility 回归（结构/CI）⇒ EVOLUTION_REGRESSION，verdict=REJECTED（§6.2；f09）
  if (failed.includes('compatibilityResult')) {
    const receipt = signReceipt(root, dir, input, record, 'REJECTED', 'EVOLUTION_REGRESSION', opts);
    markTerminal(dir, 'REJECTED');
    // 回退 catalog 到 last accepted + 失败候选证据轨迹保留（OQ-R10-5=A 降级路径）：
    // catalog 属 R6 面，本实现不直改（§2.2），登记回退意图与证据轨迹。
    appendJson(path.join(dir, 'promotion', 'regression.log'), {
      at: new Date().toISOString(), code: 'EVOLUTION_REGRESSION',
      catalogAction: 'rollback-to-last-accepted (R6 复核执行；本实现只登记)',
      evidenceRetained: true,
    });
    return respond(false, 'EVOLUTION_REGRESSION', {
      verdict: 'REJECTED', receipt: true, promotionId: receipt.promotionId,
      catalogStaysLastAccepted: true, evidenceRetained: true,
    }, evidence, warnings);
  }

  // 三维缺失 ⇒ PROMOTION_NOT_ALLOWED / UNRESOLVED（fail-closed；f08）
  // 三维任一缺失 → PROMOTION_NOT_ALLOWED（fail-closed，阈值数值 [待补充]）
  if (missing.length > 0 || failed.length > 0) {
    const dims = [...missing, ...failed];
    // 阈值数值缺 Owner 给定的具体判定字段 → 如实登记 [待补充]
    warnings.push(`等 Owner 给数: promotion 三维判定缺 ${dims.join(', ')}（OQ-R10-3=A 阈值数值 [待补充]）`);
    const receipt = signReceipt(root, dir, input, record, 'UNRESOLVED', 'PROMOTION_NOT_ALLOWED', opts);
    markTerminal(dir, 'UNRESOLVED');
    return respond(false, 'PROMOTION_NOT_ALLOWED', {
      verdict: 'UNRESOLVED', receipt: true, promotionId: receipt.promotionId,
      unresolved: [],            // 维度缺失走 warnings 通道；unresolvedThresholds 留空（实测口径）
      unresolvedThresholds: [],  // 阈值数值仍 [待补充]（Owner 未给数，不编造）
      missingDimensions: dims,
    }, evidence, warnings);
  }

  // PROVISIONAL 升格证据（OQ-R10-5=A；f11）：独立验收 exit 0 + 无回归 + rollback 排练通过
  const independentExitOk = verdict.exitCode === 0;
  const rollbackRehearsed = input.rollbackRehearsalPassed === true;
  const unmet = [];
  if (!independentExitOk) unmet.push('independentExitCode=0');
  if (!rollbackRehearsed) unmet.push('rollbackRehearsalPassed');
  if (record.status === 'PROVISIONAL' && unmet.length > 0) {
    warnings.push(`等 Owner 给数: PROVISIONAL 升格证据未齐 ${unmet.join(', ')}（OQ-R10-5=A）`);
    const receipt = signReceipt(root, dir, input, record, 'UNRESOLVED', 'PROMOTION_NOT_ALLOWED', opts);
    markTerminal(dir, 'UNRESOLVED');
    return respond(false, 'PROMOTION_NOT_ALLOWED', {
      verdict: 'UNRESOLVED', receipt: true, promotionId: receipt.promotionId,
      unresolved: unmet, provisionalUpgradeBlocked: true,
    }, evidence, warnings);
  }

  // 重复压测稳定性（§5.2；两次判定不一致 ⇒ UNRESOLVED，不得以一次通过晋升）
  if (Array.isArray(input.pressureRuns) && input.pressureRuns.length >= 2) {
    const fingerprints = input.pressureRuns.map((r) => JSON.stringify(r.result ?? r));
    const stable = fingerprints.every((f) => f === fingerprints[0]);
    if (!stable) {
      const receipt = signReceipt(root, dir, input, record, 'UNRESOLVED', 'PROMOTION_NOT_ALLOWED', opts);
    markTerminal(dir, 'UNRESOLVED');
      return respond(false, 'PROMOTION_NOT_ALLOWED', {
        verdict: 'UNRESOLVED', receipt: true, promotionId: receipt.promotionId,
        unresolved: ['pressureRuns 不一致（§5.2 重复压测两次不一致，不得以一次通过晋升）'],
      }, evidence, warnings);
    }
  }

  // PROMOTED（f10）：签发 promotion receipt（九字段 + canonicalHash 同构 C-R4）
  const receipt = signReceipt(root, dir, input, record, 'PROMOTED', null, opts);
  markTerminal(dir, 'PROMOTED');
  evidence.push(`evidence/evolution/${assetOf}/${input.candidateId}/promotion/receipt.json`);

  return respond(true, null, {
    verdict: 'PROMOTED', receipt: true, promotionId: receipt.promotionId,
    rollback: { rehearsed: rollbackRehearsed, target: record.candidate.rollbackTarget ?? null },
    catalogAction: 'promotion receipt 已签发；catalog 更新由 receipt 完成后路径执行（本实现不直改）',
  }, evidence, warnings);
}

/**
 * receipt 签发（OQ-R10-6=A 九字段；canonicalHash = sha256 同构 C-R4）。
 * EVOLUTION_REGRESSION / PROMOTION_NOT_ALLOWED 时仍签发（append-only 轨迹）。
 */
function signReceipt(root, dir, input, record, verdict, code, opts) {
  const now = opts.now ?? new Date();
  const promotionId = `prm-${formatCandidateId(now, crypto.randomBytes(4).toString('hex')).slice(4)}`;
  const decision = input.promotionDecision ?? {};
  const canonical = JSON.stringify({
    candidateId: input.candidateId,
    verdict,
    promotionDecision: { tokenResult: decision.tokenResult ?? null, behaviorResult: decision.behaviorResult ?? null, compatibilityResult: decision.compatibilityResult ?? null },
    rollbackTarget: record?.candidate?.rollbackTarget ?? null,
  });
  const receipt = {
    promotionId,
    candidateId: input.candidateId,
    baselineRef: record?.candidate?.baselineRef ?? null,
    verdict,
    promotionDecision: decision,
    rollbackTarget: record?.candidate?.rollbackTarget ?? null,
    executedAt: (now instanceof Date ? now : new Date(now)).toISOString(),
    approvedBy: input.isolatedVerdict?.agentIdentity ?? null,
    canonicalHash: crypto.createHash('sha256').update(canonical).digest('hex'),
  };
  if (code) receipt.code = code;
  writeJsonOnce(path.join(dir, 'promotion', 'receipt.json'), receipt);
  return receipt;
}

// ---------------------------------------------------------------------------
// 16 资产闭环（契约 §5.3；GWT-R10-06）
// ---------------------------------------------------------------------------

/**
 * summarizeAssetStates：遍历 16 白名单资产，每行显式状态 ∈ UNCHANGED|CANDIDATE|PROMOTED|REJECTED|UNRESOLVED；
 * 聚合百分比不得掩盖缺失行——hasGap/missingRows 如实输出（f12）。
 */
export function summarizeAssetStates(opts = {}) {
  const root = opts.evidenceRoot;
  if (!root) return respond(false, 'CANDIDATE_INVALID', { reason: 'evidenceRoot 未指定（fail-closed）' });
  const states = {};
  const missingRows = [];
  const rank = { PROMOTED: 4, REJECTED: 3, UNRESOLVED: 2, CANDIDATE: 1, PROVISIONAL: 1, DRAFT: 1, UNCHANGED: 0 };
  for (const asset of ASSET_WHITELIST) {
    const ids = listCandidateIds(root, asset);
    let status = 'UNCHANGED';
    for (const id of ids) {
      const rec = readJson(path.join(root, asset, id, 'candidate', 'candidate.json'));
      if (!rec) { missingRows.push(`${asset}/${id}`); continue; }
      const s = rec.status === 'PROVISIONAL' ? 'CANDIDATE' : rec.status;
      if ((rank[s] ?? 0) > (rank[status] ?? 0)) status = s;
    }
    states[asset] = status;
  }
  const aggregate = {};
  for (const asset of ASSET_WHITELIST) aggregate[states[asset]] = (aggregate[states[asset]] ?? 0) + 1;
  const hasGap = missingRows.length > 0 || Object.keys(aggregate).some((k) => k === 'undefined');
  return respond(true, null, {
    rows: ASSET_WHITELIST.length,
    states,
    aggregate,
    hasGap,
    missingRows,
    note: '任一 16 资产缺显式状态 ⇒ R6 复核/发布阻塞（§5.3）；本汇总如实输出，不宣告 R6 状态',
  });
}

// ---------------------------------------------------------------------------
// run() 分发入口
// ---------------------------------------------------------------------------

/** run('evolution.propose'|'evolution.accept', input) → 统一响应壳 */
export function run(op, input) {
  if (op === 'evolution.propose') return evolutionPropose(input);
  if (op === 'evolution.accept') return evolutionAccept(input);
  return respond(false, 'CANDIDATE_INVALID', { reason: `未知操作: ${op}（仅 evolution.propose / evolution.accept 两操作）` });
}

export default { run, evolutionPropose, evolutionAccept, summarizeAssetStates, ASSET_WHITELIST, CANDIDATE_STATUSES, ERROR_CODES, BASELINE_REQUIRED_KEYS, ISOLATED_PROFILE_FIELDS, RECEIPT_FIELDS, CANDIDATE_INVARIANT_FIELDS };
