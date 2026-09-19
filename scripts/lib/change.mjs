/**
 * change.mjs — R7: Requirements Change Loop / 需求变更闭环（C-R7-change-loop 冻结契约实现）
 *
 * 操作面（仅一操作，不新增操作名，[计划输入 dev-plan:308]）：change.record。
 * 统一响应壳（契约 §7，dev-plan 全表统一壳）：{ok, code, data, evidence, warnings}，
 *   evidence 为对象（契约 §7 示形 "evidence": { }）；成功 evidence 恒含四键
 *   {invalidatedNodes, readyRecomputed, snapshotEcho, recordedAt}（契约 §7.1 [草案]）。
 *
 * 错误码仅三（dev-plan:308 原码，契约 §7.1）：
 *   CHANGE_RECORD_INVALID   —— 必填字段缺失/形状非法（GWT-R7-04 fail-closed）
 *   CHANGE_SCOPE_UNCLEAR    —— 字段齐全但 impact class/节点范围无法唯一判定（§2.3）
 *   CHANGE_OWNER_REQUIRED   —— 需 owner 审批而未提供有效 approval receipt（§5.1）
 *
 * 核心判定（§0.1 前提 1）：change.record 是"失效传播"机制，不是全量回退——
 *   invalidatedNodes 由 impact class + 依赖图（G2.2 §2 edge table）精确计算，
 *   仅使受影响节点及其传递下游退出 READY；禁止清空全部 READY 节点。
 *
 * impact class 五类（§3.1）与 OQ-R7 裁决吸收：
 *   DOC_ONLY        仅失效受影响的 PRD/设计/任务草案（GWT-R7-01 原文：下游代码/冻结契约保持有效——
 *                   [计划输入] 优先于 [草案] §3.2.2 级联规则，本类不向下游级联，登记重建判定）
 *   TASK_GRAPH      任务结构/依赖变更（OQ-R7-4=A）：primary + 传递下游，回到 planning 层
 *   CONTRACT        契约 + 全部依赖任务退出 READY（GWT-R7-02 原文），回到 contract-reverse/Owner
 *                   review；需 owner approval receipt（消费 [R4冻结] §5.2 schema，不另立）
 *   IMPLEMENTATION  改运行时行为（GWT-R7-03 原文）：新 PRD/plan 版本引用旧版本链；版本号顺序整数
 *                   v2,v3,…（OQ-R7-7=A，禁 semver）；newVersionRef = 路径#sha256；无备份不迁移（§8.2）
 *   SECURITY        级联 CONTRACT 全部失效规则 + 失效集扩展至全部安全相关 gate（OQ-R7-5=A）；
 *                   需 owner approval receipt；安全相关验收强制重跑（warnings 显式登记）
 *
 * TASK_GRAPH vs CONTRACT 边界机器判据（OQ-R7-4=A）：触及任何冻结契约规范性内容 ⇒ CONTRACT；
 *   仅触及 G2.2 图/PRD0/任务文档 ⇒ TASK_GRAPH；同时触及 ⇒ 从严归 CONTRACT。本实现按
 *   input.touchedFiles 机检：contracts/（除 drafts/、discrepancies/）= 冻结契约面；
 *   plans/、docs/tasks/ = 图/文档面；低类声明触及冻结契约 ⇒ 从严升级 CONTRACT（fail-closed 方向）。
 *
 * 幂等（§2.2/§6.2，OQ-R7-6=A）：幂等键 = canonical sha256({basePlan, baseVersion, reason,
 *   impactClass, owner})，键序固定为该字面序（已用幸存实物 cr-20260917T035212Z-c2026fdf 的
 *   idempotencyKey 3b244b29528d18641e8e20b50e750b0fcc1520c4d8599e102f0c9e081afd2292 逐字节复现验证）。
 *   重复提交 ok:true 返回原 changeRecordId + warnings 记 DUPLICATE_REPLAY（不新增错误码）；
 *   同键不同 sourceEvidence ⇒ CHANGE_SCOPE_UNCLEAR（不放行也不重放）。
 *
 * 存储（§5.2，OQ-R7-1=A，append-only）：
 *   记录本体 = contracts/discrepancies/<changeRecordId>.json（每记录一文件，永不覆写/删除）；
 *   索引     = plans/active/changes/index.jsonl（additive；namespaced 下随 session：
 *              sessionId 非空 ⇒ plans/active/changes/<sessionId>/index.jsonl）。
 *   changeRecordId 格式 cr-<YYYYMMDDTHHMMSSZ>-<8位随机>（OQ-R7-3=A，对齐 C-R4 approvalId 紧凑形）。
 *
 * 回滚（§6.3，supersede-not-delete）：rollback = 新增回滚 change record（supersedes 指针 +
 *   审计链不断）+ 原 record 的 supersededBy 指针回填（R6 迁移报告记载的实物回填形态）+
 *   rollbacks 台账登记（此后 rollback 前签发的 approval 对 rollback 后变更一律失效，OQ-R4-6=A）；
 *   永不删除旧证据、不把已发生的真实执行改写为成功（PRD0 §9.3.6）。
 *
 * 与 R4 的关系（§0.1 前提 2/3、§3.3）：只读消费 R4 canonical state authority 与 §5.2
 *   ownerApprovalReceipt schema；不重定义状态机/transition/gate 谓词，不另立 receipt schema；
 *   CHANGE_OWNER_REQUIRED 语义对应 [R4冻结] §5.3"需批准而无批准"，码名沿用 dev-plan 原文。
 *   本模块不 import evolution.mjs（R10 只读消费 change records，反向无依赖）。
 *
 * 重建说明（rebuild-20260920）：本文件为按冻结契约 contracts/C-R7-change-loop.md + 配套清单
 *   C-R7-change-loop-review-checklist.md + 幸存实物 test-reports/change-record-r5ui-host-plugin-20260917/
 *   （record-change.mjs 驱动 + REPORT.md 运行结果）+ R7 验收报告 test-reports/impl-acceptance-20260915/
 *   REPORT.md（原 sha256 前 16 位 3f37d9b5dedf7ce8）的行为级重建，非逐字节恢复。行为面机验见
 *   test-reports/rebuild-20260920/R7-change/。重建判定与偏差逐项登记于该目录 RESULTS.md。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// 常量（契约 §2/§3/§4/§5/§7；OQ-R7-1..7=A）
// ---------------------------------------------------------------------------

/** 错误码仅三（dev-plan:308 原码；DUPLICATE_REPLAY 走 warnings 通道，不是错误码） */
export const ERROR_CODES = Object.freeze([
  'CHANGE_RECORD_INVALID', 'CHANGE_SCOPE_UNCLEAR', 'CHANGE_OWNER_REQUIRED',
]);

/** 五类 impact class（R7 doc Freeze order 原文；§3.1） */
export const IMPACT_CLASSES = Object.freeze([
  'DOC_ONLY', 'TASK_GRAPH', 'CONTRACT', 'IMPLEMENTATION', 'SECURITY',
]);

/** 需 owner approval receipt 的类（§5.1：CONTRACT/SECURITY；TASK_GRAPH/DOC_ONLY/IMPLEMENTATION 仅字段命名） */
export const OWNER_APPROVAL_REQUIRED_CLASSES = Object.freeze(['CONTRACT', 'SECURITY']);

/** 回退目标层级（§4.1 rewind targets；值面为机器可查标签） */
export const REWIND_TARGETS = Object.freeze({
  DOC_ONLY: 'prd-design-task-draft',
  TASK_GRAPH: 'planning',
  CONTRACT: 'contract-reverse/owner-review',
  IMPLEMENTATION: 'prd-gate-new-version',
  SECURITY: 'security-gate+contract-reverse',
});

/** record status 枚举（§2.2：active = 当前生效；superseded = 被后续变更取代） */
export const STATUS_VALUES = Object.freeze(['active', 'superseded']);

/** changeRecordId 格式（OQ-R7-3=A）：cr-<YYYYMMDDTHHMMSSZ>-<8位随机> */
export const CHANGE_ID_RE = /^cr-\d{8}T\d{6}Z-[0-9a-f]{8}$/;

/** C-R4 §5.2 ownerApprovalReceipt schema 八字段（§0.1 前提 3：消费不重定义、不另立） */
export const OWNER_RECEIPT_FIELDS = Object.freeze([
  'approvalId', 'target', 'reason', 'approvedBy', 'approvedAt', 'approvalEvidence', 'expiresAt', 'relatedReceipts',
]);

/** approvalId 格式（对齐 [R4冻结] §5.2 / phase.mjs 同一紧凑形） */
const APPROVAL_ID_RE = /^apr-\d{8}T\d{6}Z-[0-9a-zA-Z]{8}$/;

/** session 白名单（对齐 phase.mjs §2.1 同一规则，防路径穿越；namespaced index 落点用） */
const SESSION_RE = /^[A-Za-z0-9_-]+$/;

/** sha256 hex */
const SHA256_RE = /^[0-9a-fA-F]{64}$/;

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

/** 统一响应壳（契约 §7；evidence 为对象，成功恒含四键） */
function respond(ok, code, data, evidence, warnings) {
  return { ok, code: code ?? null, data: data ?? {}, evidence: evidence ?? {}, warnings: warnings ?? [] };
}

function isBlank(v) { return v === undefined || v === null || (typeof v === 'string' && v.trim() === ''); }

function sha256Hex(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** 紧凑时间戳 YYYYMMDDTHHMMSSZ（OQ-R7-3=A，去冒号紧凑形；与 phase.mjs formatStamp 同构） */
function formatStamp(now) {
  const d = (now instanceof Date) ? now : new Date(now);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/** 8 位随机 hex（opts.rand 确定性注入，供文件化探针复现；生产省略） */
function rand8(rand) { return typeof rand === 'string' && /^[0-9a-f]{8}$/.test(rand) ? rand : crypto.randomBytes(4).toString('hex'); }

/** changeRecordId = cr-<YYYYMMDDTHHMMSSZ>-<8位随机>（OQ-R7-3=A） */
export function formatChangeRecordId(now, rand) {
  return `cr-${formatStamp(now)}-${rand8(rand)}`;
}

/**
 * 幂等键（§2.2/§6.2，OQ-R7-6=A）：canonical sha256({basePlan, baseVersion, reason, impactClass, owner})，
 * 键序固定为契约书写的字面序。已用幸存实物 cr-20260917T035212Z-c2026fdf 的键值逐字节复现验证（见文件头）。
 */
export function canonicalIdempotencyKey(fields) {
  const canonical = JSON.stringify({
    basePlan: fields.basePlan,
    baseVersion: fields.baseVersion,
    reason: fields.reason,
    impactClass: fields.impactClass,
    owner: fields.owner,
  });
  return sha256Hex(Buffer.from(canonical, 'utf8'));
}

// ---------------------------------------------------------------------------
// 存储布局（§5.2，OQ-R7-1=A；append-only）
// ---------------------------------------------------------------------------

function discrepanciesDir(workspace) { return path.join(workspace, 'contracts', 'discrepancies'); }
function recordFile(workspace, changeRecordId) { return path.join(discrepanciesDir(workspace), `${changeRecordId}.json`); }

/** 索引落点：sessionId 非空 ⇒ plans/active/changes/<sessionId>/index.jsonl（namespaced 下随 session）；否则 plans/active/changes/index.jsonl */
function indexFileFor(workspace, session) {
  const base = path.join(workspace, 'plans', 'active', 'changes');
  return session ? path.join(base, session, 'index.jsonl') : path.join(base, 'index.jsonl');
}

/** rollback 台账（plans/active/changes/rollbacks.json，追加数组；回填 [R4冻结] §5.2 rollback 失效条款的判定输入；登记重建判定） */
function rollbacksFileFor(workspace) { return path.join(workspace, 'plans', 'active', 'changes', 'rollbacks.json'); }

/** approval 消费登记（plans/active/changes/.approvals-registry.json；同 receipt 二次消费拒绝，对齐 phase.mjs §5.4 双向引用登记） */
function approvalsRegistryFor(workspace) { return path.join(workspace, 'plans', 'active', 'changes', '.approvals-registry.json'); }

/** 记录本体写入（write-once：已存在即不覆写——append-only 纪律 §5.2；返回 false 表示文件已在） */
function writeRecordOnce(file, record) {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n', 'utf8');
  return true;
}

/** 索引追加（一行一事件，永不覆写） */
function appendIndexLine(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(obj) + '\n', 'utf8');
}

/** 扫描全部 change record 本体（cr-*.json）；不可解析文件跳过并产出诊断（旧证据只读保留，不删除不阻塞） */
function scanRecords(workspace, warnings) {
  const dir = discrepanciesDir(workspace);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!/^cr-.*\.json$/.test(name)) continue;
    const rec = readJson(path.join(dir, name));
    if (!rec || typeof rec !== 'object' || isBlank(rec.changeRecordId)) {
      warnings.push(`SCAN_SKIP: contracts/discrepancies/${name} 不可解析（旧证据保留在原位，未删除；诊断可见）`);
      continue;
    }
    out.push(rec);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 失效传播与 READY 重算（§3.2 核心 / §6.1）
// ---------------------------------------------------------------------------

/** 传递下游闭包：沿 edge 表 from→to 正向遍历（§3.2.2 反向遍历依赖图的等价实现：失效沿依赖向下游传播） */
function downstreamClosure(seeds, edges) {
  const adj = new Map();
  for (const e of edges ?? []) {
    if (!e || isBlank(e.from) || isBlank(e.to)) continue;
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push(e.to);
  }
  const seen = [];
  const seenSet = new Set();
  const queue = [...seeds];
  for (const s of queue) { // seeds 本身入集（去重保序）
    if (!seenSet.has(s)) { seenSet.add(s); seen.push(s); }
  }
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const nxt of adj.get(cur) ?? []) {
      if (!seenSet.has(nxt)) { seenSet.add(nxt); seen.push(nxt); queue.push(nxt); }
    }
  }
  return seen;
}

/**
 * computeInvalidatedNodes：按 impact class + 依赖图精确计算失效节点清单（§3.2）。
 * - DOC_ONLY：仅受影响的 PRD/设计/任务草案本体（GWT-R7-01 [计划输入]：下游代码/冻结契约保持有效，
 *   不向下游级联——[计划输入] 优先于 [草案] §3.2.2，登记重建判定）；
 * - TASK_GRAPH/CONTRACT/IMPLEMENTATION：primary + 传递下游（§3.2.2 级联）；
 * - SECURITY：CONTRACT 级联全部规则 + 失效集扩展至 opts 传入的全部安全相关 gate（OQ-R7-5=A）。
 * 结果去重保序（primary 在前，闭包次之，securityNodes 最后），禁止全量清空 READY。
 */
export function computeInvalidatedNodes({ impactClass, primaryNodes, dependencies, securityNodes }) {
  const primary = (primaryNodes ?? []).filter((n) => !isBlank(n));
  if (impactClass === 'DOC_ONLY') {
    const seen = new Set();
    const out = [];
    for (const n of primary) if (!seen.has(n)) { seen.add(n); out.push(n); }
    return out;
  }
  const closed = downstreamClosure(primary, dependencies ?? []);
  const extra = impactClass === 'SECURITY' ? (securityNodes ?? []).filter((n) => !isBlank(n)) : [];
  const seen = new Set();
  const out = [];
  for (const n of [...closed, ...extra]) {
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

/**
 * recomputeReady（§6.1）：READY 重算 = R4 canonical state 的 READY 集（readyBefore 输入投影）
 * ⊖ invalidatedNodes；未受影响节点 READY 不变；不重定义 READY 公式（PRD0 §5.5 只读消费）。
 */
export function recomputeReady({ readyBefore, invalidatedNodes }) {
  const before = (readyBefore ?? []).filter((n) => !isBlank(n));
  const invalidated = new Set(invalidatedNodes ?? []);
  const after = before.filter((n) => !invalidated.has(n));
  const exited = before.filter((n) => invalidated.has(n));
  return { before, after, exited };
}

// ---------------------------------------------------------------------------
// 冻结契约边界判据（OQ-R7-4=A 最严类规则）
// ---------------------------------------------------------------------------

/** 路径归一（正斜杠；容忍反斜杠输入） */
function normPath(p) { return String(p ?? '').replace(/\\/g, '/').replace(/^\.\/+/, ''); }

/** 冻结契约面 = contracts/ 下、排除 drafts/（永远不解锁）与 discrepancies/（change records 证据层） */
function isFrozenContractPath(p) {
  const n = normPath(p);
  return n.startsWith('contracts/')
    && !n.startsWith('contracts/drafts/')
    && !n.startsWith('contracts/discrepancies/');
}

/** 图/文档面 = G2.2 图、PRD0、任务文档（OQ-R7-4=A：仅触及这些 ⇒ TASK_GRAPH） */
function isGraphOrDocsPath(p) {
  const n = normPath(p);
  return n.startsWith('plans/') || n.startsWith('docs/tasks/');
}

/**
 * resolveImpactClass：impact class 边界判定（OQ-R7-4=A）。
 * 声明类触及冻结契约规范性内容而声明为低类 ⇒ 从严升级 CONTRACT（fail-closed 方向，附 warning）；
 * 仅触及图/文档 ⇒ 声明类维持；CONTRACT/SECURITY 已是最严类，不降级。
 */
function resolveImpactClass(declared, touchedFiles, warnings) {
  const touched = (touchedFiles ?? []).map(normPath).filter((p) => p.length > 0);
  const frozen = touched.filter(isFrozenContractPath);
  const graphDocs = touched.filter(isGraphOrDocsPath);
  if (frozen.length > 0 && declared !== 'CONTRACT' && declared !== 'SECURITY') {
    warnings.push(`OQ-R7-4=A 最严类规则：触及冻结契约规范性内容（${frozen.join(', ')}），从严归 CONTRACT（原声明 ${declared}）——owner approval receipt 成为必要条件（§3.1）`);
    return 'CONTRACT';
  }
  if (frozen.length === 0 && graphDocs.length > 0 && declared === 'CONTRACT') {
    warnings.push(`OQ-R7-4=A 边界提示：touchedFiles 仅含图/文档面（${graphDocs.join(', ')}）而声明 CONTRACT——不降级（fail-closed 方向），请核对声明（§3.1）`);
  }
  return declared;
}

// ---------------------------------------------------------------------------
// owner approval receipt 校验（§3.3/§5.1：消费 [R4冻结] §5.2 schema，不重定义、不放宽；
// 全部无效形态统一收口 CHANGE_OWNER_REQUIRED——语义对应 [R4冻结] §5.3"需批准而无批准"，
// 码名沿用 dev-plan 原文，不复用 R4 transition 通道码，登记重建判定）
// ---------------------------------------------------------------------------

/**
 * validateOwnerApprovalReceipt({receipt, basePlan, baseVersion, impactClass, at, workspace})
 * → {ok:true, approvalId} | {ok:false, reason}
 * 校验面（清单 R7-06）：schema 八字段 / approvalId 形 / approvedBy=owner / reason 必填 /
 * approvedAt ISO 且先于变更记录时点（审批先于执行，时点倒挂无效）/ expiresAt=null（绑定语义）/
 * target.scope='change' 且 scopeId = <basePlan>@<baseVersion>:<impactClass>（绑定 plan+version+class，
 * 跨类/跨 plan 复用拒绝）/ approvalEvidence = 路径#SHA256 且文件字节可验（不可抵赖）/
 * rollback 失效条款（rollback 前签发的 approval 对 rollback 后变更一律失效，OQ-R4-6=A）/
 * 同 receipt 二次消费拒绝（.approvals-registry.json 登记，跨变更复用禁止）。
 */
export function validateOwnerApprovalReceipt(args) {
  const { receipt, basePlan, baseVersion, impactClass, at, workspace } = args;
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { ok: false, reason: `${impactClass} 类需 owner approval receipt（§5.1，消费 [R4冻结] §5.2 schema）但未提供——fail-closed，不解锁任何节点` };
  }
  // 字段缺失判定按 undefined 口径（expiresAt 的合法值 null 不误判为缺失；undefined 值与缺键同罚）
  const missing = OWNER_RECEIPT_FIELDS.filter((k) => receipt[k] === undefined);
  if (missing.length > 0) {
    return { ok: false, reason: `ownerApprovalReceipt 缺字段: ${missing.join(', ')}（[R4冻结] §5.2 schema 八字段）` };
  }
  if (!APPROVAL_ID_RE.test(String(receipt.approvalId))) {
    return { ok: false, reason: `approvalId 格式不符: ${JSON.stringify(receipt.approvalId)}（须 apr-<YYYYMMDDTHHMMSSZ>-<8位随机>，OQ-R4-6=A 紧凑形）` };
  }
  if (receipt.approvedBy !== 'owner') {
    return { ok: false, reason: `approvedBy 非 owner: ${JSON.stringify(receipt.approvedBy)}（非 owner 身份 ⇒ receipt 无效，[R4冻结] §5.2）` };
  }
  if (isBlank(receipt.reason)) {
    return { ok: false, reason: 'receipt.reason 必填（Owner 给出的批准理由，禁止空，[R4冻结] §5.2）' };
  }
  const approvedMs = Date.parse(receipt.approvedAt);
  if (Number.isNaN(approvedMs)) {
    return { ok: false, reason: `approvedAt 非 ISO 8601: ${JSON.stringify(receipt.approvedAt)}（[R4冻结] §5.2）` };
  }
  const nowMs = Date.parse(at);
  if (approvedMs > nowMs) {
    return { ok: false, reason: '审批时点倒挂：approvedAt 晚于 change record 记录时点（审批先于执行，不可抵赖，[R4冻结] §5.2；清单 R7-06c）' };
  }
  if (receipt.expiresAt !== null) {
    return { ok: false, reason: `expiresAt 必须为 null（批准绑定特定 plan+version+class，不跨作用域复用，OQ-R4-6=A）；实得 ${JSON.stringify(receipt.expiresAt)}` };
  }
  if (!Array.isArray(receipt.relatedReceipts) || receipt.relatedReceipts.some((r) => !r || typeof r !== 'object')) {
    return { ok: false, reason: 'relatedReceipts 须为 receiptRef 对象数组（[R4冻结] §5.2）' };
  }
  const tg = receipt.target;
  if (!tg || typeof tg !== 'object' || Array.isArray(tg)) {
    return { ok: false, reason: 'target 缺失或非对象（[R4冻结] §5.2 target 绑定）' };
  }
  if (tg.scope !== 'change') {
    return { ok: false, reason: `target.scope 非法: ${JSON.stringify(tg.scope)}（R7 通道合法值 'change'；'plan' 属 R4 phase.transition 通道，§3.3）` };
  }
  const expectedScopeId = `${basePlan}@${baseVersion}:${impactClass}`;
  if (String(tg.scopeId ?? '') !== expectedScopeId) {
    return { ok: false, reason: `target.scopeId 绑定不符: ${JSON.stringify(tg.scopeId ?? null)} ≠ ${JSON.stringify(expectedScopeId)}（绑定 plan+version+impactClass；跨类/跨基线复用拒绝，验收报告 "scopeId carries :impactClass"；清单 R7-06b）` };
  }
  // approvalEvidence = 指令文件路径 + 该文件 SHA256（OQ-R4-6=A；对话引用为辅，不解析）
  const ev = String(receipt.approvalEvidence ?? '');
  const m = ev.match(/([0-9a-fA-F]{64})/);
  if (!m) return { ok: false, reason: 'approvalEvidence 缺 SHA256（OQ-R4-6=A：approvalEvidence 缺 SHA256 即 defect，清单 R7-06）' };
  const declaredHash = m[1].toLowerCase();
  const filePath = ev.slice(0, m.index).replace(/[#\s]+$/, '').trim();
  if (!filePath) return { ok: false, reason: 'approvalEvidence 缺指令文件路径（OQ-R4-6=A）' };
  const abs = path.isAbsolute(filePath) ? filePath : path.join(workspace, filePath);
  if (!fs.existsSync(abs)) {
    return { ok: false, reason: `approvalEvidence 指令文件不可读: ${filePath}（不可抵赖 fail-closed，[R4冻结] §5.2）` };
  }
  const actual = sha256Hex(fs.readFileSync(abs));
  if (actual !== declaredHash) {
    return { ok: false, reason: `approvalEvidence SHA256 与指令文件字节不一致（声明 ${declaredHash.slice(0, 12)}… 实测 ${actual.slice(0, 12)}…；不可抵赖 fail-closed）` };
  }
  // rollback 失效条款（OQ-R4-6=A）：approval 签发于最近一次 rollback 之前 ⇒ 对 rollback 后的变更一律失效
  const rollbacks = readJson(rollbacksFileFor(workspace));
  if (Array.isArray(rollbacks)) {
    const times = rollbacks
      .filter((r) => r && typeof r.at === 'string' && !Number.isNaN(Date.parse(r.at)))
      .map((r) => Date.parse(r.at));
    if (times.length > 0) {
      const lastRollbackMs = Math.max(...times);
      if (approvedMs < lastRollbackMs && nowMs >= lastRollbackMs) {
        return { ok: false, reason: 'rollback 失效条款：approval 签发于最近一次 rollback 之前，对 rollback 后的变更一律失效，须重新签发（OQ-R4-6=A；清单 R7-06d）' };
      }
    }
  }
  // 同 receipt 二次消费拒绝（跨变更复用禁止；幂等重放在本判定之前已返回，不受影响）
  const registry = readJson(approvalsRegistryFor(workspace));
  const priorUses = (registry && Array.isArray(registry[receipt.approvalId])) ? registry[receipt.approvalId] : [];
  if (priorUses.length > 0) {
    return { ok: false, reason: `approval 已被 change record ${priorUses[0].changeRecordId} 消费（.approvals-registry.json 登记在案）——同 receipt 跨变更复用禁止（[R4冻结] §5.2 expiresAt=null 绑定语义；清单 R7-06b）` };
  }
  return { ok: true, approvalId: receipt.approvalId };
}

// ---------------------------------------------------------------------------
// sourceEvidence 比较（幂等重放 vs CHANGE_SCOPE_UNCLEAR 的分界）
// ---------------------------------------------------------------------------

/** 证据集等价：集合等价判定（排序后逐项比较；顺序不属证据内容） */
function sameEvidence(a, b) {
  const norm = (arr) => (Array.isArray(arr) ? arr.map((x) => String(x ?? '')).slice().sort() : []);
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

// ---------------------------------------------------------------------------
// change.record（契约 §7.1：校验 → 判类 → 失效计算 → owner 审批 → 落盘 → READY 重算；全部通过才落盘）
// ---------------------------------------------------------------------------

/**
 * recordChange(input, opts) — 操作名 change.record。
 *
 * input（dev-plan:308 输入列逐字 + [草案] 补入项）：
 *   basePlan            变更所基于的计划（必填）
 *   baseVersion         变更基线版本（必填；惯例为 sha256 或版本标识）
 *   reason              变更原因（必填，禁止空）
 *   impactClass         五类之一（必填；§2.1 无法可靠判定 ⇒ CHANGE_SCOPE_UNCLEAR 语义）
 *   owner               变更负责人/审批人（必填；缺失时按类差异化收码：CONTRACT/SECURITY ⇒
 *                       CHANGE_OWNER_REQUIRED，其余 ⇒ CHANGE_RECORD_INVALID，§2.1 原文）
 *   sourceEvidence      来源证据引用数组（必填非空，GWT-R7-04 source 不得缺失；元素形如
 *                       '<路径>#<sha256>' 或证据描述）
 *   ownerApprovalReceipt 仅 CONTRACT/SECURITY 必需（[R4冻结] §5.2 schema）；其他类可选提供，
 *                       提供即校验（fail-closed），approvalId 记入审计
 *   newVersionRef       仅 IMPLEMENTATION 必需：<新文件路径>#<sha256>（§4.2.5）
 *   newVersion          仅 IMPLEMENTATION：顺序整数版本号 v2,v3,…（缺省时从 newVersionRef 路径提取，OQ-R7-7=A）
 *   snapshotRef         仅 IMPLEMENTATION 必需：版本切换前已落快照的引用（§8.2 无备份不迁移）
 *   touchedFiles        可选：变更触及的仓库相对路径清单（OQ-R7-4=A 边界判据的机检输入；
 *                       缺省时信任声明类——幸存实物驱动即此形态）
 *
 * opts：{ workspace, sessionId=null, recordedBy, dependencies=[], readyBefore=[], primaryNodes=[],
 *         securityNodes=[], terminalNodes=[], now?, rand? }
 *   workspace    仓库/工作区根（contracts/discrepancies/ 与 plans/active/changes/ 的落点；必填 fail-closed）
 *   sessionId    namespaced index 的会话标识（null ⇒ 根 index.jsonl；非法值 fail-closed）
 *   recordedBy   记录方 session/agent 标识（§2.2 审计字段；必填 fail-closed）
 *   dependencies G2.2 §2 edge table（[{from,to}]；§3.2.1 失效传播的依赖图输入）
 *   readyBefore  当前 READY 节点集（R4 canonical state 的 READY 投影；§6.1 重算输入）
 *   primaryNodes 变更直接命中的节点（失效传播种子）
 *   securityNodes SECURITY 类扩展失效的全部安全相关 gate（OQ-R7-5=A）
 *   terminalNodes 已到终态（done/failed）的节点——不原地改写，仅 warning 提示走新链（§4.2.1）
 *   now/rand     确定性注入（Date|ISO, 8hex；供文件化探针复现；生产省略）
 *
 * 返回：shell {ok, code, data: changeRecord, evidence: {invalidatedNodes, readyRecomputed,
 *       snapshotEcho, recordedAt}, warnings}；ok:false ⇒ 调用方/CI 必须 exit non-zero（§7.2）。
 */
export async function recordChange(input = {}, opts = {}) {
  const warnings = [];
  const workspace = opts.workspace;
  const invalid = (reason, extra) => respond(false, 'CHANGE_RECORD_INVALID', { reason, stateUnchanged: true, ...(extra ?? {}) }, {}, warnings);
  const unclear = (reason) => respond(false, 'CHANGE_SCOPE_UNCLEAR', { reason, stateUnchanged: true }, {}, warnings);
  const ownerRequired = (reason) => respond(false, 'CHANGE_OWNER_REQUIRED', { reason, stateUnchanged: true, missingApproval: true }, {}, warnings);

  // (0) 载体与审计前置（fail-closed：无 workspace 不落盘、无 recordedBy 不落盘）
  if (!workspace) return invalid('opts.workspace 未指定（fail-closed：存储落点缺失，§5.2）');
  const session = opts.sessionId ?? null;
  if (session != null && (typeof session !== 'string' || !SESSION_RE.test(session))) {
    return invalid(`非法 sessionId: ${JSON.stringify(session)}（白名单 ^[A-Za-z0-9_-]+$，防路径穿越；namespaced index 落点）`);
  }
  if (isBlank(opts.recordedBy)) return invalid('opts.recordedBy 缺失（recordedBy 审计字段，§2.2：记录方 session/agent 标识）');
  const now = opts.now ?? new Date();
  const at = new Date(now).toISOString();

  // (1) 必填字段校验（§2.1 dev-plan:308 输入列；GWT-R7-04 fail-closed；owner 按类差异化收码）
  const basePlan = input.basePlan;
  const baseVersion = input.baseVersion;
  const reason = input.reason;
  const owner = input.owner;
  const missingBase = [];
  if (isBlank(basePlan)) missingBase.push('basePlan');
  if (isBlank(baseVersion)) missingBase.push('baseVersion');
  if (isBlank(reason)) missingBase.push('reason');
  if (isBlank(input.impactClass)) missingBase.push('impactClass');
  if (missingBase.length > 0) {
    return invalid(`必填字段缺失: ${missingBase.join(', ')}（GWT-R7-04 fail-closed：missing source/impact/reason ⇒ 不解锁任何节点）`, { missingFields: missingBase });
  }
  if (!IMPACT_CLASSES.includes(input.impactClass)) {
    return invalid(`impactClass 枚举外: ${JSON.stringify(input.impactClass)}（五类：${IMPACT_CLASSES.join('|')}，§3.1）`);
  }
  const needsReceipt = OWNER_APPROVAL_REQUIRED_CLASSES.includes(input.impactClass);
  if (isBlank(owner)) {
    // §2.1 原文：owner 缺失 ⇒ CHANGE_OWNER_REQUIRED（§5）；impact class 不需额外审批而 owner 缺失 ⇒ CHANGE_RECORD_INVALID
    return needsReceipt
      ? ownerRequired('CONTRACT/SECURITY 类 owner（变更负责人/审批人）缺失（§2.1：变更负责人/审批人标识必填）')
      : invalid('owner 缺失（§2.1：impact class 不需要额外审批而 owner 缺失 ⇒ CHANGE_RECORD_INVALID）', { missingFields: ['owner'] });
  }
  if (!Array.isArray(input.sourceEvidence) || input.sourceEvidence.length === 0 || input.sourceEvidence.some((e) => isBlank(e))) {
    return invalid('sourceEvidence 缺失或为空（GWT-R7-04：source 不得缺失；须为非空证据引用数组）', { missingFields: ['sourceEvidence'] });
  }

  // (2) 幂等（§6.2，操作入口判定；先于副作用与审批校验——重复提交不产生副作用）
  const idempotencyKey = canonicalIdempotencyKey({ basePlan, baseVersion, reason, impactClass: input.impactClass, owner });
  const existing = scanRecords(workspace, warnings);
  const prior = existing.find((r) => r.idempotencyKey === idempotencyKey) ?? null;
  if (prior) {
    if (sameEvidence(prior.sourceEvidence, input.sourceEvidence)) {
      // GWT-R7-05：ok:true 返回既有 changeRecordId，data 指回原记录，warnings 记 DUPLICATE_REPLAY；不写新记录、不产生副作用
      warnings.push(`DUPLICATE_REPLAY: change.record 已存在同幂等键记录 ${prior.changeRecordId}（§2.2/§6.2，OQ-R7-6=A），幂等返回原 changeRecordId，不写新记录、不产生副作用`);
      const ready = recomputeReady({ readyBefore: opts.readyBefore, invalidatedNodes: prior.invalidatedNodes ?? [] });
      const rf = recordFile(workspace, prior.changeRecordId);
      return respond(true, null, {
        ...prior,
        duplicate: true,
      }, {
        invalidatedNodes: prior.invalidatedNodes ?? [],
        readyRecomputed: ready,
        snapshotEcho: fs.existsSync(rf) ? sha256Hex(fs.readFileSync(rf)) : null,
        recordedAt: prior.recordedAt ?? at,
      }, warnings);
    }
    // 同键不同 sourceEvidence ⇒ 范围不能唯一确认（§2.3/OQ-R7-6=A）：不放行也不重放
    return unclear('幂等键命中但 sourceEvidence 不同（§2.3/OQ-R7-6=A）：同一变更已存在但证据来源不同 ⇒ 范围不能唯一确认，需 Owner 澄清后重提；本次未创建记录、未解锁任何节点');
  }

  // (3) impact class 判定（OQ-R7-4=A 边界机检 + 最严类升级；touchedFiles 缺省 = 信任声明类）
  const impactClass = resolveImpactClass(input.impactClass, input.touchedFiles, warnings);
  const needsReceiptFinal = OWNER_APPROVAL_REQUIRED_CLASSES.includes(impactClass);

  // (4) 失效节点精确计算（§3.2；禁止全量回退）
  if ((!Array.isArray(opts.dependencies) || opts.dependencies.length === 0) && impactClass !== 'DOC_ONLY') {
    warnings.push('依赖图（G2.2 §2 edge table）缺失：失效传播退化为 primaryNodes 本体（§3.2.1 需 impact class + 依赖图；登记重建判定）');
  }
  const invalidatedNodes = computeInvalidatedNodes({
    impactClass,
    primaryNodes: opts.primaryNodes,
    dependencies: opts.dependencies,
    securityNodes: opts.securityNodes,
  });
  if (invalidatedNodes.length === 0) {
    // §2.3 + §5.3 原子性（清单 R7-08b）：受影响节点清单无法唯一计算/为空 ⇒ 拒绝；记录与节点清单必须同时写入
    return unclear('受影响节点清单为空/无法唯一计算（§2.3；§5.3 原子性：change record 与 invalidatedNodes 必须同时写入，禁止"记录已写但节点清单缺失"中间态）——需 Owner 澄清 primaryNodes/依赖图后重提');
  }
  const terminalHit = (opts.terminalNodes ?? []).filter((n) => invalidatedNodes.includes(n));
  if (terminalHit.length > 0) {
    warnings.push(`终态节点不原地改写: ${terminalHit.join(', ')}（§4.2.1 终态不可追加/[R4冻结] §3.2——通过新链（新 sourceHash/新版本）开启，旧记录保持只读）`);
  }

  // (5) IMPLEMENTATION 附加校验（GWT-R7-03 / §4.2；newVersionRef = 路径#sha256 + 顺序整数版本 + 无备份不迁移）
  let newVersionRef = null;
  let newVersion = null;
  if (impactClass === 'IMPLEMENTATION') {
    if (isBlank(input.newVersionRef)) {
      return invalid('IMPLEMENTATION 类必需 newVersionRef（GWT-R7-03：新 PRD/plan 版本引用旧版本链；§4.2.5：非 IMPLEMENTATION 类方可为 null）', { missingFields: ['newVersionRef'] });
    }
    const ref = String(input.newVersionRef);
    const mh = ref.match(/^(.+)#([0-9a-fA-F]{64})$/);
    if (!mh) {
      return invalid(`newVersionRef 形状非法: ${JSON.stringify(ref)}（§4.2.5：须为 <新文件路径>#<sha256>；缺 sha256 即 defect，清单 R7-03）`);
    }
    // 版本号 scheme 机检（OQ-R7-7=A：顺序整数 v2,v3,…，禁 semver）
    const label = isBlank(input.newVersion)
      ? (normPath(mh[1]).match(/v(\d+(?:\.\d+)*)$/)?.[0] ?? null)
      : String(input.newVersion);
    if (!label) {
      return invalid('无法机验版本号 scheme：newVersionRef 路径不含版本段且未提供 newVersion（OQ-R7-7=A：新版本号须顺序整数 v2,v3,…）');
    }
    if (!/^v[2-9]\d*$/.test(label)) {
      return invalid(`新版本号非法: ${JSON.stringify(label)}（OQ-R7-7=A：顺序整数 v2,v3,…——基线即 v1、semver/小数版本禁用；清单 R7-03 defect 面）`);
    }
    // 新版本号与已有版本冲突（清单 R7-03 defect 面）
    const conflict = existing.find((r) => r.impactClass === 'IMPLEMENTATION'
      && r.basePlan === basePlan && r.newVersion === label && r.idempotencyKey !== idempotencyKey);
    if (conflict) {
      return invalid(`新版本号与已有版本冲突: ${label} 已被 ${conflict.changeRecordId} 占用（清单 R7-03；版本链 = changeRecordId → baseVersion → newVersionRef 不允许分叉）`, { conflictingChangeRecordId: conflict.changeRecordId });
    }
    // 无备份不迁移（§8.2/[R4冻结] §8.3：版本切换前必须先落快照）
    if (isBlank(input.snapshotRef)) {
      return invalid('无备份不迁移（§8.2/[R4冻结] §8.3/PRD0 §9.3.2）：IMPLEMENTATION 版本切换前必须先落快照，snapshotRef 缺失 ⇒ 拒绝迁移（清单 R7-07b）', { missingFields: ['snapshotRef'] });
    }
    newVersionRef = ref;
    newVersion = label;
  }

  // (6) owner 审批（§5；CONTRACT/SECURITY 需有效 receipt；其他类提供即校验，approvalId 记入审计）
  let approvalId = null;
  if (input.ownerApprovalReceipt !== undefined && input.ownerApprovalReceipt !== null) {
    const v = validateOwnerApprovalReceipt({
      receipt: input.ownerApprovalReceipt, basePlan, baseVersion, impactClass, at, workspace,
    });
    if (!v.ok) return ownerRequired(v.reason);
    approvalId = v.approvalId;
  } else if (needsReceiptFinal) {
    return ownerRequired(`${impactClass} 类需 owner approval receipt（§5.1，消费 [R4冻结] §5.2 schema：approvalId/target/reason/approvedBy/approvedAt/approvalEvidence/expiresAt/relatedReceipts）但未提供——fail-closed，不解锁任何节点，返回缺失批准的诊断`);
  }

  // (7) 落盘（§5.2 append-only + §5.3 原子性：记录本体（含 invalidatedNodes）+ 索引同临界区写入）
  const changeRecordId = formatChangeRecordId(now, opts.rand);
  const record = {
    changeRecordId,
    basePlan,
    baseVersion,
    reason,
    impactClass,
    owner,
    sourceEvidence: input.sourceEvidence.map((e) => String(e)),
    invalidatedNodes,
    newVersionRef,
    supersededBy: null,
    status: 'active',
    recordedAt: at,
    recordedBy: opts.recordedBy,
    // 以下为 additive 审计字段（§2.2 schema 之外；幂等复现与 receipt 双向引用所需，登记 RESULTS.md 偏差表）
    idempotencyKey,
    approvalId,
    ...(newVersion !== null ? { newVersion } : {}),
    ...(Array.isArray(input.touchedFiles) && input.touchedFiles.length > 0 ? { touchedFiles: input.touchedFiles.map(normPath) } : {}),
    ...(isBlank(input.snapshotRef) ? {} : { snapshotRef: String(input.snapshotRef) }),
  };
  const rf = recordFile(workspace, changeRecordId);
  const created = writeRecordOnce(rf, record);
  if (!created) {
    // 竞态防护：同 id 文件已在 ⇒ 不覆写（append-only），按幂等重放语义收口
    warnings.push(`DUPLICATE_REPLAY: 记录本体已存在 ${changeRecordId}（append-only 不覆写，§5.2），按幂等重放收口`);
    const prior2 = readJson(rf);
    return respond(true, null, { ...(prior2 ?? record), duplicate: true }, {
      invalidatedNodes: record.invalidatedNodes,
      readyRecomputed: recomputeReady({ readyBefore: opts.readyBefore, invalidatedNodes: record.invalidatedNodes }),
      snapshotEcho: sha256Hex(fs.readFileSync(rf)),
      recordedAt: at,
    }, warnings);
  }
  appendIndexLine(indexFileFor(workspace, session), {
    event: 'create',
    changeRecordId,
    impactClass,
    status: 'active',
    recordedAt: at,
    recordedBy: opts.recordedBy,
    idempotencyKey,
    invalidatedNodes,
    file: `contracts/discrepancies/${changeRecordId}.json`,
  });
  if (approvalId) {
    // approvalId ↔ changeRecordId 双向引用登记（[R4冻结] §5.4(a) 消费面）
    const regFile = approvalsRegistryFor(workspace);
    const registry = readJson(regFile) ?? {};
    registry[approvalId] = [...(registry[approvalId] ?? []), { changeRecordId, recordedAt: at, impactClass, basePlan }];
    fs.mkdirSync(path.dirname(regFile), { recursive: true });
    fs.writeFileSync(regFile, JSON.stringify(registry, null, 2) + '\n', 'utf8');
  }
  if (impactClass === 'SECURITY') {
    warnings.push('SECURITY: 全部安全相关 gate 失效且安全相关验收强制重跑（OQ-R7-5=A；失效集 = CONTRACT 级联规则 ∪ securityNodes）——重跑执行属验收面，本操作只登记判定与失效集');
  }

  // (8) READY 重算（§6.1：PRD0 §5.5 + R4 canonical state 只读消费；未受影响节点 READY 不变）
  const ready = recomputeReady({ readyBefore: opts.readyBefore, invalidatedNodes });
  return respond(true, null, record, {
    invalidatedNodes,
    readyRecomputed: ready,
    snapshotEcho: sha256Hex(fs.readFileSync(rf)),
    recordedAt: at,
  }, warnings);
}

// ---------------------------------------------------------------------------
// 回滚（§6.3 supersede-not-delete；证据面辅助——操作面仍仅 change.record 一个，不新增操作名）
// ---------------------------------------------------------------------------

/**
 * supersedeChangeRecord(input, opts) — §6.3 回滚步骤 1-4 的证据面实现：
 *   1. 新增回滚 change record（supersedes 指针；审计链不断——失败/回滚记录保留）；
 *   2. 原 record 的 status → 'superseded' + supersededBy 指针回填（R6 迁移报告记载的实物回填形态；
 *      这是全模块唯一的就地字段回填，仅指针三字段，旧证据本体永不删除）；
 *   3. rollbacks 台账登记（此后 rollback 前签发的 approval 对 rollback 后变更一律失效，OQ-R4-6=A）；
 *   4. READY 重算（被回滚记录失效的节点，在不被其他 active 记录覆盖时恢复）。
 *
 * input: { targetChangeRecordId, reason, owner, sourceEvidence, restoreVersionRef? }
 * opts:  { workspace, sessionId?, recordedBy, readyBefore?, dependencies?, now?, rand? }
 * 返回：shell 同构（data = { rollbackRecord, target, restoreVersionRef }）。
 * 幂等：同目标 + 同 {reason, owner} 重复回滚 ⇒ ok:true 幂等返回 + DUPLICATE_REPLAY，不重复创建。
 */
export async function supersedeChangeRecord(input = {}, opts = {}) {
  const warnings = [];
  const invalid = (reason, extra) => respond(false, 'CHANGE_RECORD_INVALID', { reason, stateUnchanged: true, ...(extra ?? {}) }, {}, warnings);
  const unclear = (reason) => respond(false, 'CHANGE_SCOPE_UNCLEAR', { reason, stateUnchanged: true }, {}, warnings);
  const workspace = opts.workspace;
  if (!workspace) return invalid('opts.workspace 未指定（fail-closed）');
  if (isBlank(opts.recordedBy)) return invalid('opts.recordedBy 缺失（recordedBy 审计字段，§2.2）');
  const targetId = input.targetChangeRecordId;
  if (!CHANGE_ID_RE.test(String(targetId ?? ''))) {
    return invalid(`targetChangeRecordId 格式非法: ${JSON.stringify(targetId ?? null)}（须 cr-<YYYYMMDDTHHMMSSZ>-<8位随机>，OQ-R7-3=A）`);
  }
  const rf = recordFile(workspace, targetId);
  const target = readJson(rf);
  if (!target || typeof target !== 'object') {
    return invalid(`目标 change record 不存在或不可解析: contracts/discrepancies/${targetId}.json（fail-closed；不创建任何记录）`);
  }
  const now = opts.now ?? new Date();
  const at = new Date(now).toISOString();
  // 回滚记录自身的必填校验（owner 按目标类差异化收码，§2.1 同一规则）
  const missing = [];
  if (isBlank(input.reason)) missing.push('reason');
  if (!Array.isArray(input.sourceEvidence) || input.sourceEvidence.length === 0 || input.sourceEvidence.some((e) => isBlank(e))) missing.push('sourceEvidence');
  if (isBlank(input.owner)) {
    if (OWNER_APPROVAL_REQUIRED_CLASSES.includes(target.impactClass)) {
      return respond(false, 'CHANGE_OWNER_REQUIRED', { reason: 'CONTRACT/SECURITY 类变更的回滚记录 owner（变更负责人/审批人）缺失（§2.1 类差异化收码）', stateUnchanged: true, missingApproval: true }, {}, warnings);
    }
    missing.push('owner');
  }
  if (missing.length > 0) {
    return invalid(`回滚记录必填字段缺失: ${[...new Set(missing)].join(', ')}（§2.1/§6.3：回滚记录同样入审计链，fail-closed）`, { missingFields: [...new Set(missing)] });
  }

  // 幂等（同目标 + 同 {reason, owner} 键 ⇒ 幂等返回既有回滚记录）
  const rollbackKey = canonicalIdempotencyKey({
    basePlan: target.basePlan, baseVersion: target.baseVersion,
    reason: input.reason, impactClass: target.impactClass, owner: input.owner,
  });
  const existing = scanRecords(workspace, warnings);
  const priorRb = existing.find((r) => r.supersedes === targetId && r.idempotencyKey === rollbackKey) ?? null;
  if (priorRb) {
    warnings.push(`DUPLICATE_REPLAY: ${targetId} 的同键回滚记录已存在 ${priorRb.changeRecordId}（§6.3 幂等），幂等返回，不重复创建`);
    // 指针自愈：若此前回填中断，补齐指针（不静默——warning 可见）
    if (target.status !== 'superseded' || target.supersededBy !== priorRb.changeRecordId) {
      backfillSuperseded(rf, target, priorRb.changeRecordId, at);
      warnings.push(`supersededBy 指针自愈回填: ${targetId} → ${priorRb.changeRecordId}（§6.3 步骤 1）`);
    }
    const ready = readyAfterRollback(workspace, target, priorRb, opts.readyBefore, opts.dependencies, warnings);
    return respond(true, null, {
      rollbackRecord: priorRb, target: readJson(rf) ?? target, restoreVersionRef: input.restoreVersionRef ?? null, duplicate: true,
    }, {
      invalidatedNodes: target.invalidatedNodes ?? [],
      readyRecomputed: ready,
      snapshotEcho: sha256Hex(fs.readFileSync(recordFile(workspace, priorRb.changeRecordId))),
      recordedAt: priorRb.recordedAt ?? at,
    }, warnings);
  }
  if (target.status === 'superseded' && !isBlank(target.supersededBy)) {
    return unclear(`目标记录 ${targetId} 已被 ${target.supersededBy} 取代（status=superseded）——回滚链不唯一（§2.3），需 Owner 澄清后重提；本次未创建记录`);
  }

  // (1) 新增回滚 change record（审计链不断）
  const rollbackId = formatChangeRecordId(now, opts.rand);
  const invalidated = Array.isArray(target.invalidatedNodes) ? target.invalidatedNodes : [];
  if (invalidated.length === 0) warnings.push(`目标记录 ${targetId} 的 invalidatedNodes 为空（legacy/异常形态）——回滚记录沿用空集，登记诊断`);
  const rollbackRecord = {
    changeRecordId: rollbackId,
    basePlan: target.basePlan,
    baseVersion: target.baseVersion,
    reason: String(input.reason),
    impactClass: target.impactClass,
    owner: input.owner,
    sourceEvidence: input.sourceEvidence.map((e) => String(e)),
    invalidatedNodes: invalidated,
    newVersionRef: input.restoreVersionRef ?? null,
    supersededBy: null,
    status: 'active',
    recordedAt: at,
    recordedBy: opts.recordedBy,
    idempotencyKey: rollbackKey,
    approvalId: null,
    // additive 审计字段（回滚链专用）：
    supersedes: targetId,
    restoresVersion: input.restoreVersionRef ?? target.baseVersion,
  };
  const rbf = recordFile(workspace, rollbackId);
  if (!writeRecordOnce(rbf, rollbackRecord)) {
    return invalid(`回滚记录写入冲突（append-only 防护）: ${rollbackId}`);
  }
  appendIndexLine(indexFileFor(workspace, opts.sessionId ?? null), {
    event: 'supersede',
    changeRecordId: rollbackId,
    supersedes: targetId,
    impactClass: rollbackRecord.impactClass,
    status: 'active',
    recordedAt: at,
    recordedBy: opts.recordedBy,
    idempotencyKey: rollbackKey,
    invalidatedNodes: invalidated,
    file: `contracts/discrepancies/${rollbackId}.json`,
  });

  // (2) supersededBy 指针回填（§6.3 步骤 1；唯一允许的就地回填——指针三字段，本体证据不动）
  backfillSuperseded(rf, target, rollbackId, at);

  // (3) rollbacks 台账（OQ-R4-6=A rollback 失效条款的判定输入）
  const rbFile = rollbacksFileFor(workspace);
  const rollbacks = readJson(rbFile);
  if (!Array.isArray(rollbacks) && fs.existsSync(rbFile)) {
    return invalid('rollbacks.json 存在但非数组（fail-closed，不覆写）');
  }
  const nextRollbacks = [...(Array.isArray(rollbacks) ? rollbacks : []), {
    at,
    targetChangeRecordId: targetId,
    rollbackRecordId: rollbackId,
    restoreVersionRef: input.restoreVersionRef ?? null,
    recordedBy: opts.recordedBy,
  }];
  fs.mkdirSync(path.dirname(rbFile), { recursive: true });
  fs.writeFileSync(rbFile, JSON.stringify(nextRollbacks, null, 2) + '\n', 'utf8');

  // (4) READY 重算（§6.3 步骤 4：重跑受影响节点的 READY 重算——恢复面 = 其余 active 记录失效集的补集）
  const ready = readyAfterRollback(workspace, target, rollbackRecord, opts.readyBefore, opts.dependencies, warnings);
  return respond(true, null, {
    rollbackRecord,
    target: readJson(rf) ?? { ...target, status: 'superseded', supersededBy: rollbackId, supersededAt: at },
    restoreVersionRef: input.restoreVersionRef ?? null,
  }, {
    invalidatedNodes: invalidated,
    readyRecomputed: ready,
    snapshotEcho: sha256Hex(fs.readFileSync(rbf)),
    recordedAt: at,
  }, warnings);
}

/** 指针回填（status/supersededBy/supersededAt 三字段；本体其余证据不动） */
function backfillSuperseded(file, target, rollbackId, at) {
  const updated = { ...target, status: 'superseded', supersededBy: rollbackId, supersededAt: at };
  fs.writeFileSync(file, JSON.stringify(updated, null, 2) + '\n', 'utf8');
}

/** 回滚后的 READY 重算：readyBefore ⊖ 全部仍 active 记录的失效集并集（§6.3 步骤 4） */
function readyAfterRollback(workspace, target, rollbackRecord, readyBefore, dependencies, warnings) {
  const before = (readyBefore ?? []).filter((n) => !isBlank(n));
  const others = scanRecords(workspace, warnings)
    .filter((r) => r.status === 'active' && r.changeRecordId !== rollbackRecord.changeRecordId
      && r.changeRecordId !== target.changeRecordId);
  const stillInvalid = new Set();
  for (const r of others) {
    for (const n of computeInvalidatedNodes({
      impactClass: r.impactClass,
      primaryNodes: r.invalidatedNodes ?? [],
      dependencies,
      securityNodes: [],
    })) stillInvalid.add(n);
  }
  return { before, after: before.filter((n) => !stillInvalid.has(n)), exited: [] };
}

// ---------------------------------------------------------------------------
// 读侧消费面（R8/R9/R10 必须读取 change record 的影响范围——R7 doc Dependencies；只读，不属操作面）
// ---------------------------------------------------------------------------

/**
 * listChangeRecords(workspace)：按 recordedAt 排序返回全部 change record（含 superseded——
 * 审计链对消费方完整可见）。返回 shell；data = {count, records, unparsable}。
 */
export function listChangeRecords(workspace) {
  const warnings = [];
  if (!workspace) return respond(false, 'CHANGE_RECORD_INVALID', { reason: 'workspace 未指定（fail-closed）' });
  const records = scanRecords(workspace, warnings);
  records.sort((a, b) => String(a.recordedAt ?? '').localeCompare(String(b.recordedAt ?? '')));
  const dir = discrepanciesDir(workspace);
  return respond(true, null, {
    count: records.length,
    records,
    unparsable: warnings.map((w) => w.replace(/^SCAN_SKIP: /, '')),
  }, { dir, appendOnly: true }, warnings);
}

// ---------------------------------------------------------------------------
// run() 分发入口
// ---------------------------------------------------------------------------

/** run('change.record', input) → 统一响应壳（R7 仅此一操作由本模块承载；input.opts 携带 opts 形参） */
export function run(op, input = {}) {
  if (op === 'change.record') return recordChange(input, input.opts ?? {});
  return respond(false, 'CHANGE_RECORD_INVALID', {
    reason: `未知操作: ${op}（R7 操作面仅 change.record 一个，[计划输入 dev-plan:308]；不新增操作名）`,
  });
}

export default {
  run, recordChange, supersedeChangeRecord, listChangeRecords,
  computeInvalidatedNodes, recomputeReady, canonicalIdempotencyKey,
  formatChangeRecordId, validateOwnerApprovalReceipt,
  IMPACT_CLASSES, OWNER_APPROVAL_REQUIRED_CLASSES, REWIND_TARGETS,
  STATUS_VALUES, CHANGE_ID_RE, OWNER_RECEIPT_FIELDS, ERROR_CODES,
};
