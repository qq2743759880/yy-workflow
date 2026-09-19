/**
 * remediation.mjs — R8: Critique-to-Remediation Orchestration（C-R8-remediation 契约实现）
 *
 * 操作面（仅一操作，不新增操作名 [计划输入 dev-plan:309 原码]）：remediation.register。
 * 统一响应壳（契约 §6，dev-plan 全表统一壳）：{ok, code, data, evidence, warnings}；
 *   data 恒三键 {findingId, taskRef, status}（dev-plan:309 原文壳形，不增删键，清单 R8-01c）；
 *   evidence 恒五键 {snapshot, findingHashEcho, critiqueFileEcho, matchedTaskEcho, registeredAt}（§6.1）。
 *
 * 错误码仅三（[计划输入 dev-plan:309] 原码，不新增）：
 *   INVALID_EVIDENCE           —— 证据门未过（类别 A 锚点/哈希、类别 B 外部来源、五要素、批判文件身份），fail-closed 零写入
 *   REMEDIATION_DUPLICATE      —— 幂等命中标记（§2.2 + OQ-R8-2=A：ok:true 进 data 通道返回原 ID，非失败）
 *   REMEDIATION_REVIEW_REQUIRED—— review 门标注（§5.2 三触发：create-draft 生成 / 映射触及冻结契约面 / duplicate 冲突分支；
 *                                  注册已成功，review 是状态标注不是失败——ok:true 进 data 通道）
 *
 * 分支矩阵（§6.2）：证据门不通过 ⇒ 零写入 fail-closed；幂等命中 ⇒ 零写返回原 ID；
 *   map-to-existing 精确命中 ⇒ MAPPED_EXISTING + tracker 追加承接项；未命中 ⇒ create-draft
 *   （五要素齐备才落盘，ownerReviewState 恒 PENDING + REVIEW_REQUIRED）；同键异内容 ⇒ 新 finding
 *   附 duplicateOf + REVIEW 码（不走 DUPLICATE 码，OQ-R8-2=A）。
 *
 * 证据三分类（§1.4，消费不重定义）：A 可复现锚点（file:line/probe + 字节 sha256，缺失/不符 ⇒ INVALID_EVIDENCE）；
 *   B 竞品/权威来源（三分类枚举任取一 + url + ISO date + citedAs，GWT-R8-05）；
 *   C R3 receipt 终态引用（可选，receiptRef 只读投影——R8 不重放、不改判、不重定义 P1-P5/weak telemetry，
 *     引用终态 FAILED/UNRESOLVED 时 finding 不得据此进入 remediation READY，[R3冻结] §7.4/§7.8）。
 *
 * map-to-existing 匹配谓词（OQ-R8-4=A）：仅精确命中——sourceAnchor file:line 的 path:line 落在
 *   候选 R-task 验收文件行范围内（路径相等 + 行号落在行范围）；不做语义匹配；歧义（多候选）
 *   一律 Owner 指定，不自动落 create-draft。候选集 = R4 canonical task state 的活跃 R-task
 *   只读投影（由调用方传入 candidates——R8 不读不写 R4 state.json，任务状态机词汇属 C-R4）。
 *
 * draft 五要素门（§3.2 + OQ-R8-5=A）：scope/nonGoals/dependencies/gwts/contractImpact 不齐 ⇒
 *   fail-closed 不写 draft（不产生 draftId、不落盘残缺 draft），finding 保持 REGISTERED + warnings
 *   列缺失项；禁止"先落盘后补齐"。
 *
 * 自批禁止（§5.1，OQ-R8-3=A）：draft 的 ownerReviewState 初始恒 PENDING；APPROVED 只能由 Owner
 *   通道写入；批准记录字段形状与校验逐字对齐 [R4冻结] §5.2 ownerApprovalReceipt
 *   （approvedBy='owner' 字面、approvalEvidence=指令文件路径+SHA256 必填、批准先于执行、
 *   approvedBy≠createdBy/registeredBy/批判作者隔离），targetType 记 'remediation_draft'
 *   （R8 与 C-R4 的唯一差异点，不扩展 C-R4 冻结枚举）。creator 通道写 APPROVED 即 defect。
 *
 * NO_ACTION（§5.3 + OQ-R8-5=A）：只能由 Owner 显式触发（mapMode='NO_ACTION' + ownerDecision），
 *   不由 register 自动产生；内联写 findings ledger（status+reason+owner+date 四字段同条记录），
 *   不另建文件；终态，不进 R6 closure 待办集，记录不可删除。
 *
 * 幂等（§2.2 + OQ-R8-2=A）：幂等键 = (critiqueFile.sha256, normalizedTitle)（最小归一：大小写折叠
 *   + 去首尾空白 + 连续空白归一，不做语义相似度）；命中 ⇒ 零写返回原 findingId/taskRef/status；
 *   registeredAt 显式豁免进 evidence 对账（回显原值）；同键异内容（sourceAnchor/externalSource/impact
 *   字节不等）⇒ 不判 duplicate，重新过闸后注册新 finding + duplicateOf。
 *
 * rollback/supersede（§5.4）：只追加式 supersede 新产生的 mapping/draft 记录（supersedeBy/supersededAt/
 *   reason），不删原始批判证据、不改写 G2.1 verdict、不改写 finding 本体证据四字段；ledger 追加行
 *   禁改写——finding 生效状态由 supersede 记录派生（effectiveStatus）。
 *
 * GWT-R8-L1 投影（§4.2 + OQ-R8-7=A）：G2.1 ledger C1-C7 逐条注册面——C1/C3/C6/C7（REPRODUCED）
 *   按 Owner 裁决表映射到 R2/R3/R4 验收条目；C2/C5 注册为 UNRESOLVED 形态 finding（不 create-draft、
 *   不映射到可解锁任务、不得解锁其依赖）；全部一经注册永不删除；C5 如实标注"原始探针回归
 *   [待确认/未执行]，不得写成已闭环"。
 *
 * 只读保证（§6.1）：不修改 vendor/**、scripts/**、contracts/**（冻结契约）、plans/tasks/**（冻结计划）、
 *   G2.1 ledger；只在 §6.3 布局定义的 plans/active/remediation/（findings.jsonl append-only + drafts/）、
 *   evidence/critique/<critiqueFile.sha256>/（原件不可变）与 plans/critique-backlog-tracker.md
 *   （只追加不迁移）上做追加式写。不自动编辑源文件（Boundary non-goal）。
 *
 * [待补充] 登记（fail-closed 保持待补充，禁止编造）：
 *   - 批准↔执行哈希对账方案（§5.1 校验 (d) 残余，契约原文 [待补充]，归属 R8 实现阶段，与 C-R4 残余同形态）
 *     → 常量 HASH_RECONCILIATION_STATUS 显式透传，本重建不宣称已解决（impl-acceptance-20260915 非阻塞注记同口径）。
 *
 * 重建说明（rebuild-20260920）：本文件为按 C-R8-remediation（FROZEN 2026-09-15，OQ-R8-1…7=A）+
 * C-R8-review-checklist 期望列 + R8 验收证据（test-reports/impl-acceptance-20260915/REPORT.md R8 节，
 * 原 sha256 前 16 位 b65381d4f0eb2059）的行为级重建，非逐字节恢复。行为面机验见
 * test-reports/rebuild-20260920/R8-remediation/。evolution.mjs（R10）只读消费本模块的
 * finding schema/accepted finding（字段命名 findingId/status/taskRef 与契约 §1.3 逐字一致），反向无依赖。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// 常量（契约 §0/§1/§2/§3/§4/§5；冻结快照 240f3fbdb4ee757dffc4d5ab80407d1b2c84863c）
// ---------------------------------------------------------------------------

/** 契约冻结快照（§0 头部；evidence.snapshot 回显缺省值） */
export const SNAPSHOT = '240f3fbdb4ee757dffc4d5ab80407d1b2c84863c';

/** 错误码仅三（dev-plan:309 原码；不新增） */
export const ERROR_CODES = Object.freeze([
  'INVALID_EVIDENCE', 'REMEDIATION_DUPLICATE', 'REMEDIATION_REVIEW_REQUIRED',
]);

/** finding status 枚举六值（§1.5；INVALID_EVIDENCE/NO_ACTION 终态；SUPERSEDED 只作用于 mapping/draft 记录） */
export const FINDING_STATUSES = Object.freeze([
  'REGISTERED', 'MAPPED_EXISTING', 'DRAFT_PROPOSED', 'INVALID_EVIDENCE', 'NO_ACTION', 'SUPERSEDED',
]);

/** 证据门类别 B 三分类枚举（§1.4；三类枚举内任取一即满足类别 B） */
export const EXTERNAL_SOURCE_KINDS = Object.freeze(['competitor', 'authoritative', 'official_project']);

/** sourceAnchor 类别 A 两形态（§1.3/§1.4） */
export const ANCHOR_KINDS = Object.freeze(['file:line', 'probe']);

/** G2.1 verdict 投影枚举（§1.3；非 G2.1 来源可为 null，但 null 不得解锁其依赖） */
export const G21_VERDICTS = Object.freeze([null, 'REPRODUCED', 'COUNTEREVIDENCE_CONFIRMED', 'UNRESOLVED']);

/** draft 五要素（§3.2，GWT-R8-03 原文逐项；OQ-R8-5=A 不齐 ⇒ fail-closed 不写 draft） */
export const DRAFT_REQUIRED_ELEMENTS = Object.freeze(['scope', 'nonGoals', 'dependencies', 'gwts', 'contractImpact']);

/** ownerReviewState 三值（§3.2；初始恒 PENDING） */
export const OWNER_REVIEW_STATES = Object.freeze(['PENDING', 'APPROVED', 'REJECTED']);

/** map mode 两值（§3.1；缺省 = 自动两阶段；NO_ACTION 为 §5.3 Owner 显式出口，非自动产生） */
export const MAP_MODES = Object.freeze(['map-to-existing', 'create-draft']);

/** 批准记录 targetType（§5.1，OQ-R8-3=A：R8 域内唯一合法值；对应 [R4冻结] §5.2 'phase_transition' 位置） */
export const APPROVAL_TARGET_TYPE = 'remediation_draft';

/**
 * 批准↔执行哈希对账方案（§5.1 校验 (d) 残余）：契约原文 [待补充]，归属 R8 实现阶段/Owner，
 * 与 C-R4 残余项同形态（impl-acceptance-20260915 非阻塞注记："consistent with frozen contract,
 * not a defect"）。本重建不定义、不编造方案，只显式透传状态。
 */
export const HASH_RECONCILIATION_STATUS = '[待补充]（批准-执行哈希对账方案，OQ-R8-3=A 校验(d) 残余项；归属 R8 实现阶段/Owner，本重建不定义，批准记录先 append-only 落账）';

/**
 * Owner 通道违规码（重建推断，非契约三码面——对齐 R4 重建 FLAG_UNSUPPORTED_CODE 先例）：
 * 仅用于"非 Owner 试图 NO_ACTION / creator 自批 APPROVED / 批准记录校验失败"这类
 * Owner 专属通道被越权触发时的 fail-closed 显式拒绝；remediation.register 主面的
 * 证据/幂等/review 三分支仍严格使用契约三码，ERROR_CODES 面不变。
 */
export const OWNER_CHANNEL_CODE = 'REMEDIATION_OWNER_REQUIRED';

/**
 * GWT-R8-L1 C1–C7 逐条映射表（§4.2 正式表，OQ-R8-7=A 逐字吸收；承接去向 = 契约表"承接去向"列）。
 * taskRefs 为契约表措辞的验收条目标识（快照内无幸存的 canonical 条目 ID，见 RESULTS.md 偏差表）；
 * registerG21L1 可用 input.acceptanceEntryMap 覆盖为权威 ID。
 * closureClaimed：C1/C3/C7=已闭环（true）；C6=已承接但底层行为缺陷不宣称已修（false，C-R3 §0.1 前提 1）；
 * C5/C2=false（C5 原始探针回归 [待确认/未执行]；C2 保持 UNRESOLVED 阻断 R9/R6 前置链）。
 */
export const G21_L1_MAP = Object.freeze({
  C1: {
    verdict: 'REPRODUCED',
    target: 'R1 基线 + R2 catalog 实现验收',
    taskRefs: ['R1-baseline-16-asset', 'R2-catalog-implementation-acceptance'],
    closureClaimed: true,
    note: '已承接（R1/R2 验收链）：R1 16-asset 证据基线（nestedSkillCount=46 / manifestEntries=16）+ R2 catalog 实现验收继续维持该不变量',
  },
  C3: {
    verdict: 'REPRODUCED',
    target: 'R2 路由准入实现 + 41 样本机制',
    taskRefs: ['R2-routing-admission', 'R2-route41-real-query-replay'],
    closureClaimed: true,
    note: '已闭环（R2 验收链）：R2 路由准入实现 + R2.5/R2.6 41 样本 real-query replay 机制（同一 41 inputs 口径）',
  },
  C6: {
    verdict: 'REPRODUCED',
    target: 'C-R3 §7 receipt 契约 + R3 remediation F-1/F-2/F-3',
    taskRefs: ['C-R3-receipt-contract', 'R3-remediation-F-1-F-2-F-3'],
    closureClaimed: false,
    note: '已承接（契约层 + F-1/F-2/F-3）：C-R3 §7 receipt 契约层回应 + R3 remediation F-1/F-2/F-3；底层 assetConsumed 行为缺陷按 C-R3 §0.1 前提 1 不宣称已修',
  },
  C7: {
    verdict: 'REPRODUCED',
    target: 'R4 ci.mjs 分类矩阵 + exit 传播',
    taskRefs: ['R4-ci-classification-matrix-exit-propagation'],
    closureClaimed: true,
    note: '已闭环（R4 实现验收链）：R4 ci.mjs 分类矩阵（BLOCKING_FAIL/QUALITY_WARN/QUALITY_FAIL）+ exit 传播（GWT-R4-L1）',
  },
  C5: {
    verdict: 'UNRESOLVED',
    target: 'R4 phase.mjs 单一入口 + GWT-R4-01 fixture（标注性承接，不映射到可解锁任务）',
    taskRefs: [],
    closureClaimed: false,
    note: '已承接（修复主体 R4）：R4 scripts/lib/phase.mjs 单一入口 + fixtures/gwt-r4-01.mjs；修复后 C5 原始探针回归 [待确认/未执行]，本表不宣称 gate-skip 行为缺陷已闭环',
    probeRegression: '[待确认/未执行]',
  },
  C2: {
    verdict: 'UNRESOLVED',
    target: '保持 UNRESOLVED 注册形态（不映射、不解锁、永不删除）',
    taskRefs: [],
    closureClaimed: false,
    note: 'UNRESOLVED 注册：阻断 R9/R6 前置链（G2.2 §4/§5）；承接要求 = 同快照（240f3fbd）第三方复现，或 Owner 重发布冻结项后第三方复现；诊断变体不可替代冻结命令',
  },
  /**
   * C4：OQ-R8-7=A 正式表未含 C4 逐条行（G2.2 R8 行原文亦只点名 C1/C3/C6/C7 与 C2/C5），
   * 但 GWT-R8-L1"全部 C1-C7 一经注册即永不删除"要求其不可被 drop——按注册面收口：
   * status=REGISTERED、不映射、不落 draft、g21Verdict 按 ledger 原样投影、cannotUnlock 随投影判定。
   * 映射/policy 的 Owner 逐条裁决缺位本身如实登记（见 RESULTS.md [待补充] 清单）。
   */
  C4: {
    verdict: null,
    target: '正式表未含 C4 逐条行（注册面收口：不映射、不落 draft、永不删除）',
    taskRefs: [],
    closureClaimed: false,
    note: 'OQ-R8-7=A 正式表未含 C4：按注册面收口，g21Verdict 按 G2.1 ledger 原样投影；映射去向待 Owner 逐条裁决',
  },
});

/** L1 全量 serial 面（GWT-R8-L1：全部 C1-C7 一经注册永不删除；批量须恰为七条） */
export const G21_L1_SERIALS = Object.freeze(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']);

// ---------------------------------------------------------------------------
// 内部工具（风格对齐 evolution.mjs）
// ---------------------------------------------------------------------------

function repoRoot(opts) {
  const root = opts?.repoRoot;
  return root ? path.resolve(root) : DEFAULT_ROOT;
}

/** 仓库根缺省 = 模块位置上两级（scripts/lib → 仓库根） */
const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 统一响应壳：data 恒三键、evidence 恒五键（键集在成功/失败间完全一致，清单 R8-01c / §6.1） */
function shell(ok, code, data, evidence, warnings) {
  return {
    ok,
    code: code ?? null,
    data: {
      findingId: data?.findingId ?? null,
      taskRef: data?.taskRef ?? null,
      status: data?.status ?? null,
    },
    evidence: {
      snapshot: evidence?.snapshot ?? null,
      findingHashEcho: evidence?.findingHashEcho ?? null,
      critiqueFileEcho: evidence?.critiqueFileEcho ?? null,
      matchedTaskEcho: evidence?.matchedTaskEcho ?? null,
      registeredAt: evidence?.registeredAt ?? null,
    },
    warnings: warnings ?? [],
  };
}

/**
 * 辅助面富 data 壳（registerG21L1 批量投影专用）：顶五键与 evidence 五键不变，
 * data 在恒三键之外附加批量结果键（registered/counts）——remediation.register 主操作
 * 仍严格恒三键（dev-plan:309 壳形不增删键），见 RESULTS.md 偏差表。
 */
function shellRich(ok, code, data, evidence, warnings) {
  const base = shell(ok, code, data, evidence, warnings);
  return { ...base, data: { ...data, ...base.data } };
}

function isBlank(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sha256File(abs) {
  return sha256Hex(fs.readFileSync(abs));
}

/** 仓库相对路径安全解析（禁绝对路径与 .. 穿越；返回绝对路径或 null） */
function resolveInRoot(root, rel) {
  if (typeof rel !== 'string' || rel.trim() === '') return null;
  const norm = rel.replace(/\\/g, '/');
  if (path.isAbsolute(rel) || norm.split('/').includes('..')) return null;
  const abs = path.resolve(root, rel);
  const rootAbs = path.resolve(root);
  return abs === rootAbs || abs.startsWith(rootAbs + path.sep) ? abs : null;
}

/** normalizedTitle（§2.2 幂等键分量：大小写折叠 + 去首尾空白 + 连续空白归一；最小归一，不做语义相似度） */
export function normalizeTitle(title) {
  return String(title ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** canonical JSON（键序归一，用于幂等内容字节比较与 findingHashEcho 复算） */
function canonicalJson(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  const keys = Object.keys(v).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(v[k])).join(',') + '}';
}

/** ISO 8601 日期校验（YYYY-MM-DD 或带时间全形；日历真实性 round-trip 校验） */
function isValidIsoDate(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(t);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function fileLineCount(abs) {
  const text = fs.readFileSync(abs, 'utf8');
  const parts = text.split('\n');
  if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
  return parts.length;
}

/** fnd-<YYYYMMDD>-<6位随机>（§1.3，OQ-R8-6=A）；opts.rand 注入供确定性探针复现 */
function formatFindingId(now, rand) {
  const d = (now instanceof Date) ? now : new Date(now);
  const p = (n) => String(n).padStart(2, '0');
  const ymd = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
  return `fnd-${ymd}-${rand}`;
}

/** rem-<同日期>-<6位随机>（§3.2，OQ-R8-6=A：与 findingId 同日期、可互查） */
function formatDraftId(now, rand) {
  return formatFindingId(now, rand).replace(/^fnd-/, 'rem-');
}

/** apr-<YYYYMMDDTHHMMSSZ>-<8位随机>（§5.1 逐字对齐 [R4冻结] §5.2：时间戳紧凑形去冒号） */
function formatApprovalId(now, rand) {
  const d = (now instanceof Date) ? now : new Date(now);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  const stamp = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  return `apr-${stamp}-${rand}`;
}

function hexRand(opts, bytes, expectLen) {
  const provided = typeof opts?.rand === 'string' ? opts.rand.toLowerCase().replace(/[^0-9a-f]/g, '') : '';
  if (provided.length >= expectLen) return provided.slice(0, expectLen);
  return crypto.randomBytes(bytes).toString('hex');
}

// ---------------------------------------------------------------------------
// 存储布局（§6.3，OQ-R8-1=A）
// ---------------------------------------------------------------------------

export function findingsLedgerPath(root) {
  return path.join(root, 'plans', 'active', 'remediation', 'findings.jsonl');
}
export function draftsDir(root) {
  return path.join(root, 'plans', 'active', 'remediation', 'drafts');
}
export function draftPath(root, findingId) {
  return path.join(draftsDir(root), `${findingId}.md`);
}
export function approvalPath(root, findingId) {
  return path.join(draftsDir(root), `${findingId}.approval.json`);
}
export function evidenceCritiqueDir(root, critiqueSha) {
  return path.join(root, 'evidence', 'critique', critiqueSha);
}
export function trackerPath(root) {
  return path.join(root, 'plans', 'critique-backlog-tracker.md');
}
export function supersedeLogPath(root) {
  return path.join(root, 'plans', 'active', 'remediation', 'superseded.jsonl');
}

const TRACKER_SECTION_MARKER = '## R8 批判承接项（remediation.register append-only 追加；不改写上方既有行）';

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** findings ledger 读取（逐行 JSON.parse；损坏行如实警告，不静默丢弃计数） */
function readLedger(root, warnings) {
  const file = findingsLedgerPath(root);
  if (!fs.existsSync(file)) return [];
  const out = [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch {
      warnings.push(`findings.jsonl 第 ${i + 1} 行损坏不可解析（append-only 禁改写，原样保留计数）`);
    }
  }
  return out;
}

function appendLedger(root, record) {
  const file = findingsLedgerPath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(record) + '\n', 'utf8');
}

/** 原始批判证据原件归档（evidence/critique/<sha>/，§6.3：原件不可变 write-once + append-only 登记行） */
function archiveCritiqueOriginal(root, finding, warnings) {
  const abs = resolveInRoot(root, finding.critiqueFile.path);
  if (!abs || !fs.existsSync(abs)) {
    warnings.push(`原始批判证据文件不可读: ${finding.critiqueFile.path}（原件索引仅登记 sha 目录，不编造内容）`);
    return;
  }
  const dir = evidenceCritiqueDir(root, finding.critiqueFile.sha256);
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(abs) || '.md';
  const dest = path.join(dir, `original${ext}`);
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(abs, dest); // write-once：原件不可变（前提 5），已存在不覆写
  }
  fs.appendFileSync(path.join(dir, 'registrations.jsonl'),
    JSON.stringify({ findingId: finding.findingId, registeredAt: finding.registeredAt }) + '\n', 'utf8');
}

/**
 * tracker 承接项追加（§6.3 tracker 行 + §4.1/GWT-R8-02 承接语义）：只追加、不迁移、不改写既有行；
 * 追加项带 findingId 前缀可辨识、可独立回滚。
 */
function appendTrackerEntry(root, { findingId, taskId, title, gwtText, evidenceText, dateText }) {
  const file = trackerPath(root);
  const esc = (s) => String(s ?? '').replace(/\|/g, '／').replace(/\r?\n/g, ' ');
  const row = `| ${findingId} | ${esc(taskId)} | ${esc(title)} | ${esc(gwtText)} | ${esc(evidenceText)} | ${dateText} |\n`;
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${TRACKER_SECTION_MARKER}\n\n| findingId | 承接 R-task | 批判标题 | 追加 GWT 要求 | 追加 evidence requirement | 日期 |\n|---|---|---|---|---|---|\n${row}`, 'utf8');
    return;
  }
  const before = fs.readFileSync(file, 'utf8');
  const needsHeader = !before.includes(TRACKER_SECTION_MARKER);
  let addition = (needsHeader
    ? `\n${TRACKER_SECTION_MARKER}\n\n| findingId | 承接 R-task | 批判标题 | 追加 GWT 要求 | 追加 evidence requirement | 日期 |\n|---|---|---|---|---|---|\n`
    : '') + row;
  if (!before.endsWith('\n')) addition = '\n' + addition;
  fs.appendFileSync(file, addition, 'utf8'); // 追加式：既有字节原样保留
}

/** §4.1 注入文本（承接项三要素；追加是 additive，不改既有 R-task 已冻结 GWT 文本） */
function injectionTexts(finding) {
  const gwtText = `[${finding.findingId}] 修复完成后可观察结果：${finding.proposedVerification}（影响：${finding.impact}）`;
  const receiptNote = Array.isArray(finding.r3ReceiptRefs) && finding.r3ReceiptRefs.length > 0
    ? '；finding 引用了 R3 receipt ⇒ 对应类别 C 的终态迁移证据'
    : '';
  const evidenceText = `[${finding.findingId}] 类别 A 可复现锚点更新（${finding.sourceAnchor.path}`
    + (finding.sourceAnchor.kind === 'file:line' ? `:${finding.sourceAnchor.line}` : '')
    + ` 新字节 sha256）+ 类别 B 外部来源对照（${finding.externalSource.url}）${receiptNote}`;
  return { gwtText, evidenceText };
}

// ---------------------------------------------------------------------------
// 证据门（§1.3 必含不变量 + §1.4 类别 A/B 机验；C 类别可选只读投影）
// ---------------------------------------------------------------------------

/**
 * checkEvidenceGate：fail-closed 判定（§1.4 表 + GWT-R8-05）。任一类别 A/B 不通过 ⇒ INVALID_EVIDENCE，
 * 不降级为"待补证据"后放行（前提 1）。返回 {ok, reasons[]}；类别 C 只做形状警告，不参与门。
 */
function checkEvidenceGate(input, root) {
  const reasons = [];
  const f = input?.finding;
  if (!f || typeof f !== 'object') return { ok: false, reasons: ['finding 输入缺失（§1.3）'] };

  // §1.3 必含不变量五要素 + 登记必需身份字段（fail-closed）
  if (!f.sourceAnchor || typeof f.sourceAnchor !== 'object') reasons.push('五要素缺 sourceAnchor（§1.3 fail-closed）');
  if (isBlank(f.reproCommand)) reasons.push('五要素缺 reproCommand（GWT-R8-01 可复现命令/观察）');
  if (!f.externalSource || typeof f.externalSource !== 'object') reasons.push('五要素缺 externalSource（GWT-R8-05 缺竞品/权威来源）');
  if (isBlank(f.impact)) reasons.push('五要素缺 impact（影响陈述）');
  if (isBlank(f.proposedVerification)) reasons.push('五要素缺 proposedVerification（提议的验证方式）');
  if (isBlank(f.title)) reasons.push('title 缺失（幂等键分量，§2.2）');
  if (isBlank(input.registeredBy)) reasons.push('registeredBy 缺失（注册方身份，§5.1 自批禁止联动）');
  if (!f.critiqueFile || typeof f.critiqueFile !== 'object' || isBlank(f.critiqueFile.path) || isBlank(f.critiqueFile.sha256)) {
    reasons.push('critiqueFile 身份缺失（path+sha256，幂等键分量 §2.2）');
  }
  if (reasons.length > 0) return { ok: false, reasons };

  // 类别 A：可复现锚点（路径存在 + 字节 sha256 一致 + file:line 行号落在文件行范围内）
  const anchor = f.sourceAnchor;
  if (!ANCHOR_KINDS.includes(anchor.kind)) reasons.push(`类别 A：sourceAnchor.kind 不在 ${ANCHOR_KINDS.join('|')}（§1.4）`);
  const anchorAbs = resolveInRoot(root, anchor.path);
  if (!anchorAbs || !fs.existsSync(anchorAbs) || !fs.statSync(anchorAbs).isFile()) {
    reasons.push(`类别 A：锚点路径不存在或越出仓库根: ${anchor.path}`);
  } else {
    const actual = sha256File(anchorAbs);
    if (String(anchor.sha256).toLowerCase() !== actual) {
      reasons.push(`类别 A：锚点 sha256 不符（申报 ${String(anchor.sha256).slice(0, 12)}… 实测 ${actual.slice(0, 12)}…）`);
    }
    if (anchor.kind === 'file:line') {
      if (!Number.isInteger(anchor.line) || anchor.line < 1) {
        reasons.push('类别 A：file:line 缺合法行号（line 必填正整数，§1.3）');
      } else {
        const lines = fileLineCount(anchorAbs);
        if (anchor.line > lines) reasons.push(`类别 A：行号越界（line=${anchor.line} > 文件行数 ${lines}）`);
      }
    }
    // probe 形态：探针脚本字节哈希已按上方同一规则机验；reproCommand 非空已由五要素门覆盖
  }

  // 类别 B：竞品/权威外部来源（三分类枚举任取一 + url 非空 + date 合法 ISO + citedAs 非空）
  const ext = f.externalSource;
  if (!EXTERNAL_SOURCE_KINDS.includes(ext.kind)) {
    reasons.push(`类别 B：externalSource.kind 不在 ${EXTERNAL_SOURCE_KINDS.join('|')} 三分类（GWT-R8-05）`);
  }
  if (isBlank(ext.url)) reasons.push('类别 B：externalSource.url 为空（GWT-R8-05）');
  if (!isValidIsoDate(ext.date)) reasons.push(`类别 B：externalSource.date 非法 ISO 日期: ${ext.date}`);
  if (isBlank(ext.citedAs)) reasons.push('类别 B：externalSource.citedAs 为空');

  // 来源批判文件身份机验（幂等键可信度地板；字节哈希必须与申报一致）
  const critiqueAbs = resolveInRoot(root, f.critiqueFile.path);
  if (!critiqueAbs || !fs.existsSync(critiqueAbs) || !fs.statSync(critiqueAbs).isFile()) {
    reasons.push(`来源批判文件不存在: ${f.critiqueFile.path}`);
  } else {
    const actual = sha256File(critiqueAbs);
    if (String(f.critiqueFile.sha256).toLowerCase() !== actual) {
      reasons.push(`来源批判文件 sha256 不符（申报 ${String(f.critiqueFile.sha256).slice(0, 12)}… 实测 ${actual.slice(0, 12)}…）`);
    }
  }

  // g21Verdict 投影枚举（§1.3；null 合法但不得解锁依赖——见 cannotUnlock）
  if (!G21_VERDICTS.includes(f.g21Verdict ?? null)) {
    reasons.push(`g21Verdict 不在投影枚举（null|REPRODUCED|COUNTEREVIDENCE_CONFIRMED|UNRESOLVED）: ${f.g21Verdict}`);
  }

  return { ok: reasons.length === 0, reasons };
}

/** 类别 C 形状检查（可选类别；不触发 INVALID_EVIDENCE，R8 不重放 receipt、不重判终态） */
function receiptRefWarnings(f, warnings) {
  const refs = f.r3ReceiptRefs ?? [];
  if (!Array.isArray(refs)) {
    warnings.push('r3ReceiptRefs 非数组（类别 C 可选字段按原样登记为 []）');
    return [];
  }
  for (const r of refs) {
    if (!r || typeof r !== 'object' || isBlank(r.subtaskId) || !Number.isInteger(r.eventSeq)) {
      warnings.push('r3ReceiptRefs 含不可解析引用（缺 subtaskId/eventSeq；类别 C 为 [R3冻结] §7.3 只读投影，R8 不重判、按原样登记）');
    }
  }
  return refs;
}

// ---------------------------------------------------------------------------
// duplicate 判定（§2.2，GWT-R8-04 + OQ-R8-2=A）
// ---------------------------------------------------------------------------

/** 幂等键 = (critiqueFile.sha256, normalizedTitle)；内容比较字段 = sourceAnchor/externalSource/impact（§2.2） */
function findDuplicate(ledger, finding) {
  const key = normalizeTitle(finding.title);
  const critSha = String(finding.critiqueFile.sha256).toLowerCase();
  for (const rec of ledger) {
    if (!rec || String(rec.critiqueFile?.sha256 ?? '').toLowerCase() !== critSha) continue;
    if (normalizeTitle(rec.title) !== key) continue;
    const sameContent = canonicalJson(rec.sourceAnchor) === canonicalJson(finding.sourceAnchor)
      && canonicalJson(rec.externalSource) === canonicalJson(finding.externalSource)
      && canonicalJson(rec.impact) === canonicalJson(finding.impact);
    return { record: rec, sameContent };
  }
  return null;
}

// ---------------------------------------------------------------------------
// map-to-existing 匹配（§2.1，OQ-R8-4=A：仅精确命中，不做语义匹配）
// ---------------------------------------------------------------------------

/**
 * 候选集 = R4 canonical task state 活跃 R-task 的只读投影（调用方传入，R8 不读 R4 state.json）。
 * candidates: [{ taskId, acceptanceFiles: [{ path, lineStart, lineEnd }] }]
 * 命中 = sourceAnchor.kind='file:line' 且候选验收文件路径相等且行号落在 [lineStart, lineEnd]。
 */
function matchCandidates(candidates, anchor) {
  if (!Array.isArray(candidates)) return [];
  const hits = [];
  if (anchor.kind !== 'file:line' || !Number.isInteger(anchor.line)) return hits;
  for (const c of candidates) {
    if (!c || isBlank(c.taskId) || !Array.isArray(c.acceptanceFiles)) continue;
    for (const af of c.acceptanceFiles) {
      if (!af || isBlank(af.path)) continue;
      const samePath = String(af.path).replace(/\\/g, '/') === String(anchor.path).replace(/\\/g, '/');
      const inRange = Number.isInteger(af.lineStart) && Number.isInteger(af.lineEnd)
        && anchor.line >= af.lineStart && anchor.line <= af.lineEnd;
      if (samePath && inRange) { hits.push(c.taskId); break; }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// draft 五要素门与落盘（§3.2，OQ-R8-5=A fail-closed）
// ---------------------------------------------------------------------------

/** 五要素缺失项列表（OQ-R8-5=A：不齐 ⇒ fail-closed 不写 draft，warnings 列缺失项） */
function missingDraftElements(draft) {
  const d = draft ?? {};
  const missing = [];
  for (const key of DRAFT_REQUIRED_ELEMENTS) {
    const v = d[key];
    if (key === 'scope') {
      if (isBlank(v)) missing.push(key);
    } else if (!Array.isArray(v) || v.length === 0 || v.some((x) => isBlank(x))) {
      missing.push(key);
    }
  }
  return missing;
}

function writeDraftMarkdown(root, draftRecord) {
  const file = draftPath(root, draftRecord.findingId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = [
    `# remediation-draft ${draftRecord.draftId}`,
    '',
    `- findingId: ${draftRecord.findingId}`,
    `- ownerReviewState: ${draftRecord.ownerReviewState}`,
    `- createdAt: ${draftRecord.createdAt}`,
    `- createdBy: ${draftRecord.createdBy}`,
    '',
    '> remediation.register 生成（GWT-R8-03 五要素承载）。非 implementation READY：不进入 R4 task state、',
    '> 不被派单、不解锁下游（§3.1）。ownerReviewState 初始恒 PENDING；APPROVED 只能由 Owner 通道写入',
    '> （§5.1/§3.2 自批禁止），批准记录追加于 ' + draftRecord.findingId + '.approval.json（append-only，本文件生成后不改写）。',
    '',
    '```json',
    JSON.stringify(draftRecord, null, 2),
    '```',
    '',
  ].join('\n');
  fs.writeFileSync(file, body, 'utf8'); // 一 finding 一文件，文件名 = 其 findingId（§6.3）
  return file;
}

function readDraftRecord(root, findingId) {
  const file = draftPath(root, findingId);
  if (!fs.existsSync(file)) return null;
  const m = /```json\n([\s\S]*?)\n```/.exec(fs.readFileSync(file, 'utf8'));
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

// ---------------------------------------------------------------------------
// remediation.register（契约 §6 唯一操作）
// ---------------------------------------------------------------------------

/**
 * remediation.register
 * 输入 input: {
 *   finding: { title, sourceAnchor{kind,path,line?,sha256}, reproCommand,
 *              externalSource{kind,url,date,citedAs}, impact, proposedVerification,
 *              critiqueFile{path,sha256}, g21Verdict?, r3ReceiptRefs? },   // §1.3 字段集
 *   mapMode?: 'map-to-existing' | 'create-draft' | 'NO_ACTION',           // 缺省 = 自动两阶段（§3.1）
 *   draft?: { scope, nonGoals[], dependencies[], gwts[], contractImpact[] }, // create-draft 五要素（§3.2）
 *   candidates?: [{ taskId, acceptanceFiles:[{path,lineStart,lineEnd}] }],  // R4 活跃 R-task 只读投影（§2.1）
 *   ownerDecision?: { reason, approvedBy:'owner', date? },                  // mapMode=NO_ACTION 必填（§5.3）
 *   contractSurfaceTouched?: boolean,                                       // §5.2 触发条件 2 显式申报
 *   registeredBy: string,                                                   // 注册方身份（自批禁止联动）
 *   opts?: { repoRoot, now, rand, snapshot }                                // 确定性注入，供探针复现
 * }
 * 流水（§6.1 语义）：证据门 → duplicate 检查 → map 或 create-draft/NO_ACTION → 注入 → 返回稳定 ID。
 */
export function remediationRegister(input) {
  const warnings = [];
  const opts = input?.opts ?? {};
  const root = repoRoot(opts);
  const now = opts.now ?? new Date();
  const nowIso = (now instanceof Date ? now : new Date(now)).toISOString();
  const dateText = nowIso.slice(0, 10);
  const evidenceBase = { snapshot: opts.snapshot ?? SNAPSHOT };

  // (0) 输入形状兜底（fail-closed，不静默降级）
  if (!input || typeof input !== 'object' || !input.finding) {
    return shell(false, 'INVALID_EVIDENCE', { status: 'INVALID_EVIDENCE' },
      evidenceBase, ['register 输入缺失 finding（§6.1 fail-closed，零写入）']);
  }
  if (input.mapMode !== undefined && input.mapMode !== null
    && !MAP_MODES.includes(input.mapMode) && input.mapMode !== 'NO_ACTION') {
    return shell(false, 'INVALID_EVIDENCE', { status: 'INVALID_EVIDENCE' },
      evidenceBase, [`mapMode 非法: ${input.mapMode}（合法 ${[...MAP_MODES, 'NO_ACTION'].join('|')}；fail-closed 零写入，禁 silent fallback）`]);
  }

  // (1) 证据门（§1.4）：任一类别 A/B 不通过 ⇒ 零写入 fail-closed（GWT-R8-05）
  const gate = checkEvidenceGate(input, root);
  if (!gate.ok) {
    for (const r of gate.reasons) warnings.push(`INVALID_EVIDENCE: ${r}`);
    warnings.push('fail-closed：finding/tracker/draft 零写入，不降级为"待补证据"后放行（§1.4/§6.2）');
    return shell(false, 'INVALID_EVIDENCE', { status: 'INVALID_EVIDENCE' }, evidenceBase, warnings);
  }

  const f = input.finding;
  const ledger = readLedger(root, warnings);

  // (2) duplicate 检查（§2.2）：幂等命中 ⇒ 零写返回原 ID；同键异内容 ⇒ 冲突分支
  const dup = findDuplicate(ledger, f);
  if (dup && dup.sameContent) {
    // 幂等命中 = 正常决策进 data 通道（OQ-R8-2=A）：ok:true + REMEDIATION_DUPLICATE + 原 ID/原 taskRef/原 status
    const eff = effectiveStatus(root, dup.record, warnings);
    warnings.push(`REMEDIATION_DUPLICATE 幂等命中：零写入（tracker/draft 计数不变，GWT-R8-04）；registeredAt 豁免对账回显原值 ${dup.record.registeredAt}`);
    return shell(true, 'REMEDIATION_DUPLICATE',
      { findingId: dup.record.findingId, taskRef: dup.record.taskRef ?? null, status: eff },
      { ...evidenceBase,
        findingHashEcho: sha256Hex(canonicalJson(dup.record)),
        critiqueFileEcho: { path: dup.record.critiqueFile.path, sha256: dup.record.critiqueFile.sha256 },
        matchedTaskEcho: dup.record.taskRef ?? null,
        registeredAt: dup.record.registeredAt },
      warnings);
  }
  const conflictOf = dup && !dup.sameContent ? dup.record.findingId : null;
  if (conflictOf) {
    warnings.push(`同幂等键异内容（§2.2 冲突分支）：不判 duplicate、不产生 REMEDIATION_DUPLICATE，作为新 finding 注册并附 duplicateOf=${conflictOf}`);
  }

  // (3) NO_ACTION 出口（§5.3 + OQ-R8-5=A）：Owner 显式触发，不由 register 自动产生
  if (input.mapMode === 'NO_ACTION') {
    const dec = input.ownerDecision;
    const ownerFail = [];
    if (!dec || typeof dec !== 'object') ownerFail.push('ownerDecision 缺失');
    else {
      if (isBlank(dec.reason)) ownerFail.push('NO_ACTION reason 必填非空（dev-plan:244 Owner 说明原因）');
      if (dec.approvedBy !== 'owner') ownerFail.push(`approvedBy 必须为字面 'owner'（Owner 显式动作）: ${dec.approvedBy}`);
    }
    if (input.registeredBy === 'owner') ownerFail.push('隔离判定失败：registeredBy 与 Owner 身份相同（批判作者/注册 agent 与 Owner 必须可区分，§5.1）');
    if (ownerFail.length > 0) {
      for (const r of ownerFail) warnings.push(`NO_ACTION 拒绝: ${r}`);
      warnings.push('fail-closed：零写入（NO_ACTION 只能由 Owner 显式写入，不由 register 自动产生）');
      return shell(false, OWNER_CHANNEL_CODE, { status: null }, evidenceBase, warnings);
    }
    const findingId = formatFindingId(now, hexRand(opts, 3, 6));
    const record = buildFindingRecord(input, findingId, {
      status: 'NO_ACTION',
      taskRef: null,
      nowIso,
      noAction: { reason: dec.reason, owner: 'owner', date: isValidIsoDate(dec.date) ? dec.date : dateText },
      mapMode: 'NO_ACTION',
      warnings,
    });
    appendLedger(root, record);
    archiveCritiqueOriginal(root, record, warnings);
    warnings.push('NO_ACTION 终态：不进 R6 closure check 待办集；记录内联本 ledger 条目（status+reason+owner+date），不可删除（§5.3）');
    return shell(true, null,
      { findingId, taskRef: null, status: 'NO_ACTION' },
      { ...evidenceBase,
        findingHashEcho: sha256Hex(canonicalJson(record)),
        critiqueFileEcho: { path: record.critiqueFile.path, sha256: record.critiqueFile.sha256 },
        matchedTaskEcho: null,
        registeredAt: record.registeredAt },
      warnings);
  }

  // (4) map 决策（§2.1 / §3.1）
  const hits = matchCandidates(input.candidates, f.sourceAnchor);
  const mode = input.mapMode ?? null; // null = 自动两阶段
  let mapDecision; // {kind:'mapped'|'ambiguous'|'unmatched-explicit'|'draft'|'conflict-register'}
  let taskId = null;
  if (conflictOf) {
    mapDecision = 'conflict-register'; // §6.2 冲突行：不映射，按五要素门注册新 finding
  } else if (hits.length > 1) {
    mapDecision = 'ambiguous'; // 歧义一律 Owner 指定，不自动落 create-draft（OQ-R8-4=A）
    warnings.push(`映射歧义：多候选精确命中 ${hits.join(', ')}；OQ-R8-4=A 一律 Owner 指定，不自动映射、不自动落 draft`);
  } else if (hits.length === 1) {
    mapDecision = 'mapped';
    taskId = hits[0];
  } else if (mode === 'map-to-existing') {
    mapDecision = 'unmatched-explicit'; // 显式 map-to-existing 未命中：不自动改道 create-draft
    warnings.push('显式 map-to-existing 未命中任何活跃 R-task：finding 保持 REGISTERED（不自动落 draft；Owner 可改判 create-draft 或 NO_ACTION）');
  } else {
    mapDecision = 'draft';
  }

  // (5) draft 五要素门（§3.2 + OQ-R8-5=A）——只有 draft/conflict-register 分支需要
  const needDraft = mapDecision === 'draft' || mapDecision === 'conflict-register';
  let draftMissing = [];
  if (needDraft) {
    draftMissing = missingDraftElements(input.draft);
    if (draftMissing.length > 0 && mapDecision === 'conflict-register') {
      // §6.2 冲突行：draft 五要素不齐 ⇒ fail-closed 停在 REGISTERED，code null + warnings 缺失项
      warnings.push(`draft 五要素不齐（${draftMissing.join(', ')}）⇒ fail-closed 不写 draft，finding 保持 REGISTERED + warnings 列缺失项（§3.2/OQ-R8-5=A）`);
    } else if (draftMissing.length > 0) {
      for (const k of draftMissing) warnings.push(`draft 五要素缺 ${k} ⇒ fail-closed 不写 draft（GWT-R8-03/OQ-R8-5=A），finding 保持 REGISTERED`);
    }
  }

  // (6) 决策收口：status/code（§6.2 分支矩阵）+ draftId（先于落账确定，保证 ledger 行 taskRef 完整）
  const findingId = formatFindingId(now, hexRand(opts, 3, 6));
  let status;
  let taskRef = null;
  let code = null;
  let draftId = null;
  if (mapDecision === 'mapped') {
    status = 'MAPPED_EXISTING';
    taskRef = taskId;
  } else if (mapDecision === 'ambiguous' || mapDecision === 'unmatched-explicit' || (needDraft && draftMissing.length > 0)) {
    status = 'REGISTERED';
  } else {
    status = 'DRAFT_PROPOSED';
    code = 'REMEDIATION_REVIEW_REQUIRED';
    draftId = formatDraftId(now, hexRand(opts, 3, 6));
    taskRef = draftId;
  }

  // (7) 落账与写动作（到此分支才允许任何写入；append-only 禁改写已追加行）
  const record = buildFindingRecord(input, findingId, {
    status,
    taskRef,
    nowIso,
    duplicateOf: conflictOf ?? undefined,
    mapMode: mapDecision === 'conflict-register' ? 'conflict-register' : (mode ?? 'auto'),
    warnings,
  });
  appendLedger(root, record);
  archiveCritiqueOriginal(root, record, warnings);

  if (status === 'MAPPED_EXISTING') {
    // GWT-R8-02：被命中 R-task 追加一条批判承接项（additive，不创建重复任务）
    const { gwtText, evidenceText } = injectionTexts(record);
    appendTrackerEntry(root, { findingId, taskId, title: record.title, gwtText, evidenceText, dateText });
    warnings.push(`已向 R-task ${taskId} 追加 critique-consumption 承接项（additive，不改既有 GWT 文本；不创建重复任务）`);
    // §5.2 触发条件 2：承接项触及冻结契约面 ⇒ 映射仍发生，但 review 门打开
    const touchesFrozen = input.contractSurfaceTouched === true
      || String(f.sourceAnchor.path).replace(/\\/g, '/').startsWith('contracts/');
    if (touchesFrozen) {
      code = 'REMEDIATION_REVIEW_REQUIRED';
      warnings.push('承接项触及冻结契约面（contracts/** 锚点或显式申报）⇒ review 门打开，要求 Owner 确认承接项不弱化冻结契约（§5.2 触发条件 2）');
    }
  }
  if (status === 'DRAFT_PROPOSED') {
    const draftRecord = {
      draftId,
      findingId,
      scope: input.draft.scope,
      nonGoals: [...input.draft.nonGoals],
      dependencies: [...input.draft.dependencies],
      gwts: [...input.draft.gwts],
      contractImpact: [...input.draft.contractImpact],
      ownerReviewState: 'PENDING',
      createdAt: nowIso,
      createdBy: input.registeredBy,
    };
    writeDraftMarkdown(root, draftRecord);
    warnings.push(`remediation-draft 已生成: ${draftId}（ownerReviewState=PENDING；非 implementation READY，不进 R4 task state/不派单/不解锁下游，GWT-R8-03）`);
    warnings.push('REMEDIATION_REVIEW_REQUIRED：注册已成功，review 是状态标注不是失败（§5.2 通道语义：正常决策进 data 通道）');
  }

  return shell(true, code,
    { findingId, taskRef: record.taskRef ?? null, status },
    { ...evidenceBase,
      findingHashEcho: sha256Hex(canonicalJson(record)),
      critiqueFileEcho: { path: record.critiqueFile.path, sha256: record.critiqueFile.sha256 },
      matchedTaskEcho: mapDecision === 'mapped' ? taskId : null,
      registeredAt: record.registeredAt },
    warnings);
}

/** finding 记录构造（§1.3 字段序逐字；条件扩展字段置后） */
function buildFindingRecord(input, findingId, over) {
  const f = input.finding;
  const anchor = { kind: f.sourceAnchor.kind, path: f.sourceAnchor.path, sha256: String(f.sourceAnchor.sha256).toLowerCase() };
  if (f.sourceAnchor.kind === 'file:line') anchor.line = f.sourceAnchor.line;
  const record = {
    findingId,
    title: f.title,
    sourceAnchor: anchor,
    reproCommand: f.reproCommand,
    externalSource: {
      kind: f.externalSource.kind,
      url: f.externalSource.url,
      date: f.externalSource.date,
      citedAs: f.externalSource.citedAs,
    },
    impact: f.impact,
    proposedVerification: f.proposedVerification,
    critiqueFile: { path: f.critiqueFile.path, sha256: String(f.critiqueFile.sha256).toLowerCase() },
    g21Verdict: f.g21Verdict ?? null,
    r3ReceiptRefs: receiptRefWarnings(f, over.warnings ?? []),
    status: over.status,
    taskRef: over.taskRef ?? null,
    registeredAt: over.nowIso,
    registeredBy: input.registeredBy,
  };
  if (over.duplicateOf) record.duplicateOf = over.duplicateOf;
  if (over.noAction) record.noAction = over.noAction;
  if (over.l1) record.l1 = over.l1;
  record.mapMode = over.mapMode ?? null;
  return record;
}

// ---------------------------------------------------------------------------
// GWT-R8-L1 批量投影（§4.2，OQ-R8-7=A）：G2.1 ledger C1-C7 逐条注册面
// ---------------------------------------------------------------------------

/**
 * registerG21L1
 * 输入 input: {
 *   entries: [{ serial: 'C1'…'C7', finding: {…§1.3 字段集} }] ×7（全部 C1-C7，"are never dropped"——
 *             任一条证据门不过 ⇒ 整批 fail-closed 零写入，禁止部分注册造成 drop）,
 *   acceptanceEntryMap?: { C1: string[], … },   // 覆盖 G21_L1_MAP 的验收条目 ID（canonical ID 权威面）
 *   registeredBy, opts?
 * }
 * 判定（checklist R8-L1）：C1/C3/C6/C7 ⇒ map-to-existing 到 R2/R3/R4 验收条目；
 * C2/C5 ⇒ UNRESOLVED 注册形态（status=REGISTERED，不 create-draft、不映射到可解锁任务、不得解锁其依赖）；
 * C5 如实标注原始探针回归 [待确认/未执行]，不得写成已闭环；全部注册永不删除。
 * C4：OQ-R8-7=A 正式表未含其逐条行 ⇒ 注册面收口（REGISTERED，不映射不落 draft，投影原样保留）。
 */
export function registerG21L1(input) {
  const warnings = [];
  const opts = input?.opts ?? {};
  const root = repoRoot(opts);
  const now = opts.now ?? new Date();
  const nowIso = (now instanceof Date ? now : new Date(now)).toISOString();
  const evidenceBase = { snapshot: opts.snapshot ?? SNAPSHOT };
  const fail = (reasons) => {
    for (const r of reasons) warnings.push(`INVALID_EVIDENCE: ${r}`);
    warnings.push('GWT-R8-L1 整批 fail-closed 零写入（全部 C1-C7 一经注册永不删除，禁止部分注册造成 drop）');
    return shell(false, 'INVALID_EVIDENCE', { status: 'INVALID_EVIDENCE' }, evidenceBase, warnings);
  };

  const entries = Array.isArray(input?.entries) ? input.entries : [];
  const serials = entries.map((e) => e?.serial);
  const expected = [...G21_L1_SERIALS];
  const missingSerial = expected.filter((s) => !serials.includes(s));
  const unknownSerial = serials.filter((s) => !expected.includes(s));
  const dupSerial = serials.filter((s, i) => serials.indexOf(s) !== i);
  if (entries.length !== 7 || missingSerial.length || unknownSerial.length || dupSerial.length) {
    return fail([`L1 批量必须恰为 C1-C7 七条（缺 ${missingSerial.join(',') || '无'} / 多 ${unknownSerial.join(',') || '无'} / 重 ${dupSerial.join(',') || '无'}）`]);
  }

  // 全量证据门预检：任一不过 ⇒ 整批零写入
  const gateReasons = [];
  for (const e of entries) {
    const g = checkEvidenceGate({ finding: e.finding, registeredBy: input.registeredBy }, root);
    if (!g.ok) gateReasons.push(`${e.serial}: ${g.reasons.join('; ')}`);
  }
  if (gateReasons.length > 0) return fail(gateReasons);

  const overrideMap = input.acceptanceEntryMap ?? {};
  const registered = [];
  const ledger = readLedger(root, warnings);
  const consumedTrackerRows = [];

  // g21Verdict 投影真实性（G2.1 ledger 原文保留，非 G2.1 记录不可改写）：REPRODUCED 组与
  // UNRESOLVED 组的投影必须与 ledger 一致，投影失真 ⇒ 整批 fail-closed。
  const expect = { C1: 'REPRODUCED', C3: 'REPRODUCED', C6: 'REPRODUCED', C7: 'REPRODUCED', C2: 'UNRESOLVED', C5: 'UNRESOLVED' };
  const verdictReasons = [];
  for (const e of entries) {
    const want = expect[e.serial];
    if (want && (e.finding?.g21Verdict ?? null) !== want) {
      verdictReasons.push(`${e.serial}: g21Verdict 投影须为 ${want}（G2.1 §1 verdict 原文保留），实际 ${e.finding?.g21Verdict ?? null}`);
    }
  }
  if (verdictReasons.length > 0) return fail(verdictReasons);

  for (const e of entries) {
    const policy = G21_L1_MAP[e.serial];
    const entryMap = overrideMap[e.serial];
    // 同批次确定性 rand：对 opts.rand + serial 做种子哈希，逐条不碰撞（探针可复现）
    const seeded = opts.rand
      ? crypto.createHash('sha256').update(`${opts.rand}#${e.serial}`).digest('hex').slice(0, 6)
      : hexRand(opts, 3, 6);
    const findingId = formatFindingId(now, seeded);
    let status;
    let taskRef = null;
    let l1;
    if (policy.taskRefs.length > 0) {
      status = 'MAPPED_EXISTING';
      const targets = (Array.isArray(entryMap) && entryMap.length > 0) ? entryMap : policy.taskRefs;
      // §1.3 taskRef: null|string——多验收条目去向时 taskRef 取首条（主承接面），完整去向表记 l1.taskRefs，
      // 消费承接项仍逐条追加（GWT-R8-02）
      taskRef = targets[0];
      l1 = { serial: e.serial, target: policy.target, taskRefs: [...targets], closureClaimed: policy.closureClaimed, note: policy.note };
    } else {
      status = 'REGISTERED'; // C2/C5/C4：注册形态收口，不映射、不解锁、永不删除
      l1 = { serial: e.serial, target: policy.target, taskRefs: [], closureClaimed: policy.closureClaimed, note: policy.note };
      if (policy.probeRegression) l1.probeRegression = policy.probeRegression;
    }
    const record = buildFindingRecord(
      { finding: e.finding, registeredBy: input.registeredBy },
      findingId,
      { status, taskRef, nowIso, l1, mapMode: policy.taskRefs.length > 0 ? 'map-to-existing' : 'register-only', warnings },
    );
    appendLedger(root, record);
    archiveCritiqueOriginal(root, record, warnings);
    ledger.push(record);
    registered.push({ serial: e.serial, findingId, status, taskRef });
    if (Array.isArray(l1.taskRefs)) {
      for (const tr of l1.taskRefs) consumedTrackerRows.push({ findingId, taskId: tr, title: record.title, record });
    }
  }

  // 承接项追加（GWT-R8-02 语义；additive tracker 追加）
  const dateText = nowIso.slice(0, 10);
  for (const row of consumedTrackerRows) {
    const { gwtText, evidenceText } = injectionTexts(row.record);
    appendTrackerEntry(root, { findingId: row.findingId, taskId: row.taskId, title: row.title, gwtText, evidenceText, dateText });
  }
  if (consumedTrackerRows.length > 0) {
    warnings.push(`已追加 critique-consumption 承接项 ×${consumedTrackerRows.length}（C1/C3/C6/C7 → R2/R3/R4 验收条目；additive 不改既有 GWT 文本）`);
  }
  warnings.push('C2/C5 注册为 UNRESOLVED 形态：cannotUnlock=true，不得解锁其依赖；全部 C1-C7 永不删除（GWT-R8-L1）');
  if (G21_L1_MAP.C5.closureClaimed === false) {
    warnings.push('C5 如实标注：修复后原始探针回归 [待确认/未执行]，不得写成已闭环（OQ-R8-7=A）');
  }

  // 辅助面富 data 壳（非 register 冻结壳；register 恒三键的约束不适用于批量投影助手，见 RESULTS.md）
  return shellRich(true, null,
    { registered, counts: { total: registered.length, mapped: registered.filter((r) => r.status === 'MAPPED_EXISTING').length, unresolvedRegistered: registered.filter((r) => r.status === 'REGISTERED').length } },
    { ...evidenceBase, registeredAt: nowIso },
    warnings);
}

// ---------------------------------------------------------------------------
// Owner 通道：批准记录校验（§5.1 逐字对齐 [R4冻结] §5.2）与 draft review 状态写入
// ---------------------------------------------------------------------------

/** approvalEvidence 形 = <Owner 指令文件路径>#<该文件 SHA256>（必填；对话记录引用为辅 dialogueRef） */
export function formatApprovalEvidence(instructionFilePath, sha256) {
  return `${instructionFilePath}#${sha256}`;
}

function parseApprovalEvidence(ev) {
  const m = /^(.+)#([0-9a-f]{64})$/.exec(String(ev ?? '').trim());
  if (!m) return null;
  return { path: m[1], sha256: m[2] };
}

/**
 * 批准记录校验（§5.1 四条，与 [R4冻结] §5.2 同构）：
 * (a) approvedBy 非 'owner' ⇒ 无效；(b) approvalEvidence 必填且指令文件字节哈希对账一致；
 * (c) 批准先于执行（approvedAt 晚于引用它的升格/派单时点 ⇒ 无效）；(d) 哈希对账 [待补充]（不宣称已解决）。
 * 隔离判定：approvedBy='owner' 且 ≠ createdBy/registeredBy/批判作者身份。
 * 返回 {valid, reasons, record}；record 为补全 approvalId/approvedAt 后的完整记录。
 */
export function validateApprovalRecord(input, root) {
  const reasons = [];
  const a = input?.approval ?? {};
  const draft = input?.draft ?? null;
  const finding = input?.finding ?? null;

  // (a) approvedBy 固定字面
  if (a.approvedBy !== 'owner') reasons.push(`(a) approvedBy 非 'owner' ⇒ 批准记录无效: ${a.approvedBy}`);

  // targetType 域内唯一合法值（R8 与 C-R4 唯一差异点，不扩展 C-R4 冻结枚举）
  if (a.targetType !== APPROVAL_TARGET_TYPE) {
    reasons.push(`targetType 必须为 '${APPROVAL_TARGET_TYPE}'（R8 域内唯一合法值；不扩展 C-R4 冻结枚举）: ${a.targetType}`);
  }

  // reason 必填非空（[R4冻结] §5.2 同构）
  if (isBlank(a.reason)) reasons.push('reason 必填非空（Owner 给出的理由）');

  // expiresAt = null（批准绑定特定 draft/finding，不跨作用域复用）
  if (a.expiresAt !== null && a.expiresAt !== undefined) {
    reasons.push('expiresAt 必须为 null（批准绑定特定 draft/finding，不跨作用域复用，[R4冻结] §5.2 同构）');
  }

  // (b) approvalEvidence 必填 + 指令文件真实可读 + 字节哈希一致（不可抵赖 fail-closed）
  const ev = parseApprovalEvidence(a.approvalEvidence);
  if (!ev) {
    reasons.push('(b) approvalEvidence 缺失或非 <指令文件路径>#<SHA256> 形（必填）');
  } else {
    const abs = resolveInRoot(root, ev.path);
    if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      reasons.push(`(b) approvalEvidence 指令文件不存在: ${ev.path}`);
    } else if (sha256File(abs) !== ev.sha256) {
      reasons.push(`(b) approvalEvidence 指令文件哈希不符: ${ev.path}`);
    }
  }

  // (c) 批准先于执行：approvedAt 合法 ISO 8601 且 ≤ 引用它的升格/派单时点
  if (!isValidIsoDate(a.approvedAt)) {
    reasons.push(`(c) approvedAt 非法 ISO 8601: ${a.approvedAt}`);
  } else if (input.executionAt) {
    const ap = Date.parse(a.approvedAt);
    const ex = Date.parse(input.executionAt);
    if (Number.isNaN(ap) || Number.isNaN(ex) || ap > ex) {
      reasons.push('(c) 批准先于执行违约：approvedAt 晚于引用它的升格/派单时点 ⇒ 批准记录无效');
    }
  }

  // 隔离判定（§5.1）：creator 通道写 APPROVED 即 defect
  if (draft && draft.createdBy === 'owner') reasons.push('隔离判定失败：draft.createdBy 与 Owner 身份相同（approvedBy≠createdBy）');
  if (finding && finding.registeredBy === 'owner') reasons.push('隔离判定失败：finding.registeredBy 与 Owner 身份相同（approvedBy≠registeredBy）');
  if (input.critiqueAuthor === 'owner') reasons.push('隔离判定失败：批判作者身份与 Owner 相同');

  // (d) 哈希对账 [待补充]：显式透传，不编造方案
  const record = {
    approvalId: a.approvalId ?? null,
    targetType: a.targetType ?? APPROVAL_TARGET_TYPE,
    target: a.target ?? { draftId: input?.draftId ?? null, findingId: input?.findingId ?? null },
    reason: a.reason ?? '',
    approvedBy: a.approvedBy ?? null,
    approvedAt: a.approvedAt ?? null,
    approvalEvidence: a.approvalEvidence ?? '',
    expiresAt: null,
    relatedReceipts: Array.isArray(a.relatedReceipts) ? a.relatedReceipts : [],
  };
  return { valid: reasons.length === 0, reasons, record };
}

/**
 * applyOwnerReview：Owner 通道将 draft 的 ownerReviewState 置 APPROVED（PENDING→APPROVED 唯一合法路径）。
 * 落盘 = 追加式批准记录 <findingId>.approval.json（write-once）；draft md 本体生成后不改写
 * （PENDING 快照不可变，批准以独立 append-only 记录承载）。creator/非 owner 通道 ⇒ fail-closed 零写入。
 */
export function applyOwnerReview(input) {
  const warnings = [];
  const opts = input?.opts ?? {};
  const root = repoRoot(opts);
  const now = opts.now ?? new Date();
  const evidenceBase = { snapshot: opts.snapshot ?? SNAPSHOT };

  const finding = (input.findingId ? readLedger(root, warnings).find((r) => r?.findingId === input.findingId) : null) ?? input.finding ?? null;
  const draft = input.draft ?? (input.findingId ? readDraftRecord(root, input.findingId) : null);
  if (!finding && !input.finding) {
    return shell(false, OWNER_CHANNEL_CODE, { status: 'PENDING' }, evidenceBase,
      [...warnings, `finding 不存在: ${input?.findingId}（Owner 通道 fail-closed 零写入）`]);
  }
  if (!draft) {
    return shell(false, OWNER_CHANNEL_CODE, { status: 'PENDING' }, evidenceBase,
      [...warnings, `draft 不存在或五要素门未通过（无 draft 载体）: ${input?.findingId}`]);
  }
  if (draft.ownerReviewState === 'APPROVED') {
    return shell(true, null, { findingId: draft.findingId, taskRef: draft.draftId, status: 'APPROVED' },
      { ...evidenceBase, registeredAt: draft.createdAt },
      [...warnings, 'draft 已 APPROVED（幂等返回，不重复签发批准记录）']);
  }

  const approvedAt = (now instanceof Date ? now : new Date(now)).toISOString();
  const approvalId = formatApprovalId(now, hexRand(opts, 4, 8));
  const check = validateApprovalRecord({
    approval: { ...(input.approval ?? {}), approvalId, approvedAt },
    draftId: draft.draftId,
    findingId: draft.findingId,
    draft,
    finding,
    critiqueAuthor: input.critiqueAuthor,
    executionAt: input.executionAt,
  }, root);
  if (!check.valid) {
    for (const r of check.reasons) warnings.push(`批准记录无效: ${r}`);
    warnings.push('fail-closed：ownerReviewState 保持 PENDING，零写入（creator 通道写 APPROVED 即 defect，§3.2/§5.1）');
    return shell(false, OWNER_CHANNEL_CODE, { findingId: draft.findingId, taskRef: draft.draftId, status: 'PENDING' }, evidenceBase, warnings);
  }

  warnings.push(HASH_RECONCILIATION_STATUS);

  const file = approvalPath(root, draft.findingId);
  if (fs.existsSync(file)) {
    return shell(true, null, { findingId: draft.findingId, taskRef: draft.draftId, status: 'APPROVED' },
      { ...evidenceBase, registeredAt: approvedAt }, [...warnings, '批准记录已存在（write-once 幂等，不覆写）']);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...check.record, draftReviewStateAfter: 'APPROVED' }, null, 2) + '\n', 'utf8');

  return shell(true, null, { findingId: draft.findingId, taskRef: draft.draftId, status: 'APPROVED' },
    { ...evidenceBase, findingHashEcho: sha256Hex(canonicalJson(check.record)), matchedTaskEcho: draft.draftId, registeredAt: approvedAt },
    warnings);
}

// ---------------------------------------------------------------------------
// rollback / supersede（§5.4）与 ledger 读取面（R10 evolution 只读消费）
// ---------------------------------------------------------------------------

/**
 * supersede：追加式回滚记录（supersedeBy/supersededAt/reason），只作用于本次新产生的 mapping/draft；
 * 不删原始批判证据、不改写 G2.1 verdict、不改写 finding 本体证据字段（前提 5）。
 * 追加位置 = plans/active/remediation/superseded.jsonl（§6.3 布局内的 append-only 记录面）。
 */
export function supersede(input) {
  const warnings = [];
  const opts = input?.opts ?? {};
  const root = repoRoot(opts);
  const now = opts.now ?? new Date();
  const supersededAt = (now instanceof Date ? now : new Date(now)).toISOString();
  const evidenceBase = { snapshot: opts.snapshot ?? SNAPSHOT };

  const record = readLedger(root, warnings).find((r) => r?.findingId === input?.findingId);
  if (!record) {
    return shell(false, 'INVALID_EVIDENCE', { status: null }, evidenceBase,
      [...warnings, `finding 不存在: ${input?.findingId}（rollback fail-closed 零写入）`]);
  }
  if (!record.taskRef) {
    return shell(false, 'INVALID_EVIDENCE', { findingId: record.findingId, status: record.status }, evidenceBase,
      [...warnings, '该 finding 无 mapping/draft 记录可 supersede（§5.4 rollback 只作用于 mapping/draft）']);
  }
  if (isBlank(input.reason) || isBlank(input.supersedeBy)) {
    return shell(false, 'INVALID_EVIDENCE', { findingId: record.findingId, taskRef: record.taskRef, status: effectiveStatus(root, record, warnings) }, evidenceBase,
      [...warnings, 'supersede 需 reason（必填）与 supersedeBy（追加式记录五要素，§5.4）']);
  }

  const entry = {
    supersedeId: `sup-${formatApprovalId(now, hexRand(opts, 3, 6)).slice(4)}`,
    findingId: record.findingId,
    taskRef: record.taskRef,
    kind: String(record.taskRef).startsWith('rem-') ? 'draft' : 'mapping',
    reason: input.reason,
    supersedeBy: input.supersedeBy,
    supersededAt,
  };
  const file = supersedeLogPath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8');
  warnings.push('rollback 只 supersede 本次新产生的 mapping/draft 记录；原始批判证据/G2.1 verdict/finding 本体证据不可变（前提 5）');
  warnings.push('承接项回退须走该 R-task 自己的变更控制（C-R4/PRD0 §9.3），R8 rollback 不改写 tracker 既有行');

  return shell(true, null,
    { findingId: record.findingId, taskRef: record.taskRef, status: 'SUPERSEDED' },
    { ...evidenceBase, findingHashEcho: sha256Hex(canonicalJson(record)), matchedTaskEcho: record.taskRef, registeredAt: supersededAt },
    warnings);
}

/** finding 生效状态：ledger 追加行禁改写 ⇒ SUPERSEDED 由 supersede 记录派生（§1.5/§5.4） */
export function effectiveStatus(rootOrRecord, maybeRecord, warnings) {
  const root = typeof rootOrRecord === 'string' ? rootOrRecord : null;
  const record = root ? maybeRecord : rootOrRecord;
  if (!record) return null;
  const file = supersedeLogPath(root);
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        if (JSON.parse(line).findingId === record.findingId) return 'SUPERSEDED';
      } catch { warnings?.push('superseded.jsonl 存在损坏行（append-only 原样保留）'); }
    }
  }
  return record.status;
}

/** UNRESOLVED/null/COUNTEREVIDENCE_CONFIRMED 投影的 finding 不得解锁其依赖（GWT-R8-L1/§1.3） */
export function cannotUnlock(record) {
  return record?.g21Verdict === null
    || record?.g21Verdict === 'UNRESOLVED'
    || record?.g21Verdict === 'COUNTEREVIDENCE_CONFIRMED';
}

/** accepted finding 判定（R10 evolution 只读消费面）：证据门通过、非终态 NO_ACTION、未被 supersede。
 *  注意：accepted ≠ remediation READY——READY 还需 R6 closure check 与 C-R4 phase gate（本契约不替代）。 */
export function isAccepted(record, effStatus) {
  if (!record) return false;
  const s = effStatus ?? record.status;
  return ['REGISTERED', 'MAPPED_EXISTING', 'DRAFT_PROPOSED'].includes(s);
}

/** findings ledger 读取（append-only 原样投影；损坏行警告不静默） */
export function listFindings(rootOrOpts, opts = {}) {
  const root = typeof rootOrOpts === 'string' ? rootOrOpts : repoRoot(rootOrOpts);
  const o = typeof rootOrOpts === 'string' ? opts : rootOrOpts;
  const warnings = [];
  const rows = readLedger(root, warnings).map((r) => {
    const eff = effectiveStatus(root, r, warnings);
    return { ...r, effectiveStatus: eff, accepted: isAccepted(r, eff), cannotUnlock: cannotUnlock(r) };
  });
  return o.acceptedOnly ? rows.filter((r) => r.accepted) : rows;
}

// ---------------------------------------------------------------------------
// run() 分发入口（操作面仅 remediation.register 一个，不新增操作名）
// ---------------------------------------------------------------------------

/** run('remediation.register', input) → 统一响应壳；其余操作名 fail-closed 拒绝 */
export function run(op, input) {
  if (op === 'remediation.register') return remediationRegister(input);
  return shell(false, 'INVALID_EVIDENCE', { status: null },
    { snapshot: SNAPSHOT },
    [`未知操作: ${op}（操作面仅 remediation.register 一个，dev-plan:309 原码，不新增操作名）`]);
}

export default {
  run, remediationRegister, registerG21L1, applyOwnerReview, validateApprovalRecord,
  formatApprovalEvidence, supersede, effectiveStatus, cannotUnlock, isAccepted, listFindings,
  normalizeTitle,
  SNAPSHOT, ERROR_CODES, FINDING_STATUSES, EXTERNAL_SOURCE_KINDS, ANCHOR_KINDS, G21_VERDICTS,
  DRAFT_REQUIRED_ELEMENTS, OWNER_REVIEW_STATES, MAP_MODES, APPROVAL_TARGET_TYPE,
  HASH_RECONCILIATION_STATUS, OWNER_CHANNEL_CODE, G21_L1_MAP, G21_L1_SERIALS,
};
