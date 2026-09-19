/**
 * phase.mjs — R4: Phase Authority / Gate / Session / CI Truthfulness（C-R4-control 契约实现）
 *
 * 操作面（仅两操作，不新增操作名，契约头/[计划输入 dev-plan:304-305]）：
 *   phase.check        —— 只读前置查询：data 通道（查询语义，data.allowed=false + PHASE_PREREQ_UNMET 机器可查码，OQ-R4-7=A）
 *   phase.transition   —— 单一状态入口：矩阵断言(§3.2) → 前置谓词(§4) → override 判定(§5) → 锁内写入(§3.3/§6.2)
 *
 * 统一响应壳（契约 §6，dev-plan 全表统一壳）：{ok, code, data, evidence, warnings}；
 * evidence 为对象（契约 §6 示形 "evidence": { }）。
 *
 * 错误码（dev-plan 原码 + OQ-R4-2/3=A 新码 + [R3冻结] §7.6 消费码，共九）：
 *   PHASE_PREREQ_UNMET / CONTRACT_NOT_FROZEN / SESSION_INVALID / INVALID_TRANSITION /
 *   OWNER_APPROVAL_REQUIRED / OVERRIDE_NOT_ALLOWED / LOCK_ACQUIRE_FAILED(新, OQ-R4-3=A) /
 *   STATE_VERSION_UNSUPPORTED(新, OQ-R4-2=A) / RECEIPT_INVALID([R3冻结] §7.6，R4 gate 消费同一校验)
 *
 * fail-closed 纪律（契约 §4.2/§5.3/§8.1）：
 *   - 前置证据「缺失 = 不通过」，"无法判定"与"不满足"同归 PHASE_PREREQ_UNMET，禁止默认放行；
 *   - 裸布尔 assetConsumed / 锚点回显 / 内核词回显（weak telemetry）对前置谓词视而不见（[R3冻结] §7.8，OQ-R3-7）；
 *   - 锁耗尽 = LOCK_ACQUIRE_FAILED 显式失败，禁止锁外继续（GWT-R4-04，现状 fail-open 为 C5 同族缺陷，本模块不再复刻）；
 *   - 不认识的 stateVersion 高版本 = STATE_VERSION_UNSUPPORTED，禁止静默降级读取后覆写（OQ-R4-2=A）；
 *   - flag 值非法 = fail-closed，禁 silent fallback（§8.1，对齐 C-R3 §8.1 纪律）。
 *
 * Owner 决断吸收（2026-09-14，OQ-R4-1…9=A/B，契约 §9/§10）：
 *   - A 面（plan 7 态）执行权威、B 面（journey 9 step + 4 闸）里程碑 gate 权威；journey 只读投影（OQ-R4-1=A）；
 *   - stateVersion 初始值=1；缺字段=legacy v0 双读（MW0 合法）；高版本独立新码 fail-closed（OQ-R4-2=A）；
 *   - 锁常量沿用 {times:5, delayMs:400}、STALE_MS 30000；接管 = 持有者 pid 确认死亡 OR（过期 且 pid 不存活）（OQ-R4-3=A）；
 *   - strict 缺省自动生成 UUIDv4 session，生成时间/生成方/算法版本写入 state 元数据（OQ-R4-4=B）；
 *   - §4.2 前置映射表原样冻结；更强行为验证标准保持 [待补充]（OQ-R4-5 残余，归属 R4 实现阶段，本重建不定义、不弱化 P1-P5 地板）；
 *   - approvalId=apr-<YYYYMMDDTHHMMSSZ>-<8位随机>；approvalEvidence=指令文件路径+SHA256；expiresAt=null（绑定 from/to/scope）；
 *     rollback 前签发的 approval 对 rollback 后 transition 一律失效（OQ-R4-6=A）；
 *   - YY_GATE_MODE 优先 / TT_GATE_MODE 兼容回退（MW0 双读）；check=data 通道、transition=error 通道（OQ-R4-7=A）；
 *   - CI 分类：CONTRACT_NOT_FROZEN/R3 receipt 校验/GWT-R4-01…04 行为 = BLOCKING_FAIL；资产质量 exit 1 = QUALITY_WARN；
 *     其余未分类 = QUALITY_FAIL（均带明细，OQ-R4-8=A）；
 *   - override 执行记录落 .tt-state/overrides/（namespaced 下 .tt-state/<sessionId>/overrides/），追加式，禁 vendor/（OQ-R4-9=A）。
 *
 * approval↔execution 对账（契约 §5.4(b) 残余项的参数化解决，沿 R4 验收报告口径
 * "append-only audit + canonical hash = parameter-2 resolution of contract residual"）：
 *   执行记录携带 approvalHash（对 approval receipt 规范化 JSON 的 sha256），与 approvalId ↔ executionId
 *   双向引用登记（.approvals-registry.json）共同构成对账对；两时点进入同一哈希对账。
 *
 * 重建说明（recovery-20260920）：本文件为按 C-R4-control 冻结契约 + R4 验收证据
 * （test-reports/R4-acceptance-20260915/REPORT.md，原 sha256 前 16 位 59b19bd2721bbe70）
 * 的行为级重建实现，非逐字节恢复。行为面机验见 test-reports/rebuild-20260920/R4-phase/。
 * 本模块为增量文件：只读消费既有内核词汇（state.mjs 矩阵/gate.mjs 模式/tt-journey.mjs GATE_VOCAB），
 * 零 npm 依赖、仅 node 内置模块；不修改任何既有文件；R10 evolution 只读消费本模块的 CI truth 分类，反向无依赖。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// 常量（契约 §2/§3/§7/§8；矩阵与词汇为既有内核原样，词汇不改名 [代码佐证 state.mjs:2-3 / tt-journey.mjs:6-21]）
// ---------------------------------------------------------------------------

/** A 面 plan 状态机 7 态（执行权威，OQ-R4-1=A；state.mjs:2 原样） */
export const STATE = Object.freeze({
  IDLE: 'idle', PLANNING: 'planning', EXECUTING: 'executing', FROZEN: 'frozen',
  REVIEWING: 'reviewing', DONE: 'done', FAILED: 'failed',
});

/** A 面转换矩阵（state.mjs:3 逐字原样；契约 §3.2 不增删状态名、不改转换边） */
export const TRANSITIONS = Object.freeze({
  idle: ['planning', 'failed'],
  planning: ['executing', 'failed'],
  executing: ['frozen', 'reviewing', 'failed'],
  frozen: ['executing', 'reviewing', 'failed'],
  reviewing: ['done', 'executing', 'failed'],
  done: [],
  failed: [],
});

/** 终态不可追加（§3.2）：done/failed 合法后继为空；再写入 ⇒ INVALID_TRANSITION */
export const TERMINAL_STATES = Object.freeze(['done', 'failed']);

/** B 面 4 闸词汇（tt-journey.mjs:8 原样） */
export const GATE_VOCAB = Object.freeze(['concept-signed', 'premise-signed', 'contract-frozen', 'gate-a-approved']);

/** B 面 9 节点（tt-journey.mjs:11-21 原样投影；journey 为只读投影面，OQ-R4-1=A） */
export const STEPS = Object.freeze([
  { step: 0, name: '资产整合', gate: null },
  { step: 1, name: '文档化', gate: 'concept-signed' },
  { step: 2, name: '重执行1', gate: null },
  { step: 3, name: '拆任务', gate: 'premise-signed' },
  { step: 4, name: '重执行1,2', gate: null },
  { step: 5, name: '规划+契约', gate: 'contract-frozen' },
  { step: 6, name: '重执行1,2,3', gate: null },
  { step: 7, name: '并行派单', gate: 'gate-a-approved' },
  { step: 8, name: '批判反哺', gate: null },
]);

/** 有 gate 节点 → 闸映射（§4.2 第 1 行：对应 GATE_VOCAB 闸已置位） */
export const STEP_GATE = Object.freeze({
  1: 'concept-signed', 3: 'premise-signed', 5: 'contract-frozen', 7: 'gate-a-approved',
});

/** stateVersion 初始值（OQ-R4-2=A：写 v1；缺字段 = legacy v0 双读；高版本 fail-closed） */
export const STATE_VERSION = 1;

/** session 白名单（§2.1：沿 orchestrator.mjs:47 同一规则，防路径穿越；非法 ⇒ SESSION_INVALID） */
export const SESSION_RE = /^[A-Za-z0-9_-]+$/;

/** flag 合法值（§8.1 PRD0 五 flag 清单之 R4 相关三项） */
export const GATE_MODES = Object.freeze(['legacy-warn', 'strict']);
export const SESSION_MODES = Object.freeze(['legacy', 'namespaced']);

/** 锁常量沿用现状（OQ-R4-3=A：{times:5, delayMs:400}、STALE_MS 30000 [代码佐证 tt-journey.mjs:181-182]） */
export const LOCK_RETRY = Object.freeze({ times: 5, delayMs: 400 });
export const LOCK_STALE_MS = 30000;

/** R3 receipt 生命周期词汇（[R3冻结] §7.1/§7.2；R4 只读消费，不重定义） */
export const RECEIPT_POSITIVE_CHAIN = Object.freeze([
  'discovered', 'eligible', 'selected', 'instructions_delivered', 'execution_observed', 'behavior_verified',
]);
export const RECEIPT_NEGATIVE_EVENTS = Object.freeze(['not_consumed', 'verification_failed', 'unresolved']);

/** 错误码面（九码，见文件头；GATE_MODE_UNSUPPORTED 为 flag fail-closed 通道的重建推断码，见 RESULTS.md 偏差表） */
export const ERROR_CODES = Object.freeze([
  'PHASE_PREREQ_UNMET', 'CONTRACT_NOT_FROZEN', 'SESSION_INVALID', 'INVALID_TRANSITION',
  'OWNER_APPROVAL_REQUIRED', 'OVERRIDE_NOT_ALLOWED', 'LOCK_ACQUIRE_FAILED',
  'STATE_VERSION_UNSUPPORTED', 'RECEIPT_INVALID',
]);
/** flag 非法值 fail-closed 通道码（§8.1 行为冻结；码名未被契约冻结，为重建推断，禁 silent fallback 本身是冻结纪律） */
export const FLAG_UNSUPPORTED_CODE = 'GATE_MODE_UNSUPPORTED';

/** 更强行为验证标准状态（OQ-R4-5=A 残余项；契约原文 [待补充]，禁止编造——本重建不定义、只透传登记） */
export const STRONGER_VERIFICATION_STATUS = '[待补充]（OQ-R4-5 残余项：P1-P5 地板之上的更强行为验证标准，归属 R4 实现阶段/Owner；本重建不定义，P1-P5 不弱化）';

/** CI truth 分类矩阵（§7.2，OQ-R4-8=A） */
export const CI_CLASSIFICATION = Object.freeze({
  BLOCKING_FAIL: Object.freeze(['CONTRACT_NOT_FROZEN', 'RECEIPT_INVALID', 'GWT-R4-01…04 行为检查失败']),
  QUALITY_WARN: Object.freeze(['资产质量段（asset-call-rate/asset-quality）exit 1 —— 信息不阻断，依据 R2 验收 20260912 non-blocking 结论']),
  QUALITY_FAIL: Object.freeze(['其余未分类段 exit 1 —— 带明细、不阻断，直至 Owner 另定']),
});

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

/** 统一响应壳（契约 §6：evidence 为对象） */
function respond(ok, code, data, evidence, warnings) {
  return { ok, code: code ?? null, data: data ?? {}, evidence: evidence ?? {}, warnings: warnings ?? [] };
}

function isBlank(v) { return v === undefined || v === null || (typeof v === 'string' && v.trim() === ''); }

function nowIso(now) { return new Date(now ?? Date.now()).toISOString(); }

/** 紧凑时间戳 YYYYMMDDTHHMMSSZ（OQ-R4-6=A approvalId 形；去冒号紧凑形） */
function formatStamp(now) {
  const d = (now instanceof Date) ? now : new Date(now);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function rand8(rand) { return typeof rand === 'string' && /^[0-9a-f]{8}$/.test(rand) ? rand : crypto.randomBytes(4).toString('hex'); }

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function sha256Hex(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function sha256File(file) { return sha256Hex(fs.readFileSync(file)); }

/** 规范化 JSON（键排序，值不丢弃）——approval/execution 对账哈希的 canonical 形 */
function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = canonicalJson(value[k]);
    return out;
  }
  return value;
}

function sha256JsonValue(value) { return sha256Hex(JSON.stringify(canonicalJson(value))); }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** 持有者进程存活性（§2.3 stale 接管须校验持有者进程，避免活进程长任务被误接管） */
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try { process.kill(pid, 0); return true; } catch (e) {
    if (e.code === 'ESRCH') return false;
    if (e.code === 'EPERM') return true; // 存在但无权发信号 ⇒ 视为存活
    return null;
  }
}

// ---------------------------------------------------------------------------
// 路径布局（§2.1 namespace 规则；OQ-R4-9=A overrides 落点）
// ---------------------------------------------------------------------------

/** state.json 落点：legacy = .tt-state/state.json（store.mjs:4-11 现状语义）；namespaced = .tt-state/<sessionId>/state.json */
function statePathFor(workspace, session, sessionMode) {
  const base = (sessionMode === 'namespaced' && session) ? path.join(workspace, '.tt-state', session) : path.join(workspace, '.tt-state');
  return path.join(base, 'state.json');
}

/** journey.json 落点（tt-journey.mjs:51-52 同构，只读消费） */
function journeyPathFor(workspace, session) {
  const base = session ? path.join(workspace, '.tt-state', session) : path.join(workspace, '.tt-state');
  return path.join(base, 'journey.json');
}

/** R3 receipt per-artifact 落点（[R3冻结] §7.6 artifacts/<subtaskId>/receipt.json；namespace 化为 §2.1 授权面增量） */
function receiptPathFor(workspace, subtaskId, session, sessionMode) {
  const base = (sessionMode === 'namespaced' && session) ? path.join(workspace, 'artifacts', session) : path.join(workspace, 'artifacts');
  return path.join(base, subtaskId, 'receipt.json');
}

/** 审计落点：transition 审计流 / override 执行记录 / rollback 登记（均在 state 同目录，锁内同临界区写入） */
function transitionsLogFor(workspace, session, sessionMode) {
  return path.join(path.dirname(statePathFor(workspace, session, sessionMode)), 'transitions.jsonl');
}
function overridesDirFor(workspace, session, sessionMode) {
  const base = path.dirname(statePathFor(workspace, session, sessionMode));
  return (sessionMode === 'namespaced' && session) ? path.join(base, 'overrides') : path.join(base, 'overrides');
}
function rollbacksFileFor(workspace, session, sessionMode) {
  return path.join(path.dirname(statePathFor(workspace, session, sessionMode)), 'rollbacks.json');
}

// ---------------------------------------------------------------------------
// flag 解析（§8.1，OQ-R4-7=A：MW0 双读 YY_ 优先 / TT_ 回退；非法值 fail-closed 禁 silent fallback）
// ---------------------------------------------------------------------------

/**
 * resolveGateMode(env) → {ok:true, mode:'legacy-warn'|'strict', source} | {ok:false, code, reason}
 * YY_GATE_MODE ∈ {legacy-warn, strict}（PRD0 规范源）；TT_GATE_MODE ∈ {warn, block}（现状兼容回退，MW1 起停用）。
 */
export function resolveGateMode(env = process.env) {
  const yy = env.YY_GATE_MODE;
  const tt = env.TT_GATE_MODE;
  if (!isBlank(yy)) {
    if (yy === 'legacy-warn' || yy === 'strict') return { ok: true, mode: yy, source: 'YY_GATE_MODE' };
    return { ok: false, code: FLAG_UNSUPPORTED_CODE, reason: `YY_GATE_MODE 非法值: ${yy}（合法 legacy-warn|strict；§8.1 fail-closed 禁 silent fallback）` };
  }
  if (!isBlank(tt)) {
    if (tt === 'warn') return { ok: true, mode: 'legacy-warn', source: 'TT_GATE_MODE(MW0 兼容回退)' };
    if (tt === 'block') return { ok: true, mode: 'strict', source: 'TT_GATE_MODE(MW0 兼容回退)' };
    return { ok: false, code: FLAG_UNSUPPORTED_CODE, reason: `TT_GATE_MODE 非法值: ${tt}（兼容回退仅接受 warn|block；§8.1 fail-closed）` };
  }
  return { ok: true, mode: 'legacy-warn', source: 'default' };
}

/** resolveSessionMode(env) → {ok:true, mode:'legacy'|'namespaced'} | {ok:false, code, reason}（无 TT_ 通道，§8.1 仅 YY_SESSION_MODE） */
export function resolveSessionMode(env = process.env) {
  const yy = env.YY_SESSION_MODE;
  if (isBlank(yy)) return { ok: true, mode: 'legacy', source: 'default' };
  if (yy === 'legacy' || yy === 'namespaced') return { ok: true, mode: yy, source: 'YY_SESSION_MODE' };
  return { ok: false, code: FLAG_UNSUPPORTED_CODE, reason: `YY_SESSION_MODE 非法值: ${yy}（合法 legacy|namespaced；§8.1 fail-closed）` };
}

// ---------------------------------------------------------------------------
// session 身份（§2.1 / OQ-R4-4=B）
// ---------------------------------------------------------------------------

export function isValidSession(s) { return typeof s === 'string' && SESSION_RE.test(s); }

/** strict 缺省自动生成 UUIDv4（OQ-R4-4=B）；生成元数据三字段与 receipt session 同源可查 */
function newAutoSessionMeta(sessionId, at, generatedBy) {
  return { sessionId, generatedAt: at, generatedBy, algorithmVersion: 'uuidv4' };
}

// ---------------------------------------------------------------------------
// state 读取与版本 fallback（§2.2，OQ-R4-2=A）
// ---------------------------------------------------------------------------

/**
 * readStateVersioned(stateFile) →
 *   {ok:true, state:object|null, stateVersion:number, found:boolean}   // 缺字段 = legacy v0 双读（MW0 合法）
 *   {ok:false, code:'STATE_VERSION_UNSUPPORTED', foundVersion}         // 不认识的高版本/陌生值，禁静默降级
 *   {ok:false, code:'INVALID_TRANSITION', reason}                      // 文件存在但不可解析（fail-closed，绝不覆写）
 */
function readStateVersioned(stateFile) {
  if (!fs.existsSync(stateFile)) return { ok: true, state: null, stateVersion: 0, found: false };
  let raw;
  try { raw = fs.readFileSync(stateFile, 'utf8'); } catch (e) {
    return { ok: false, code: 'INVALID_TRANSITION', reason: 'state.json 不可读（fail-closed）: ' + e.message };
  }
  let state;
  try { state = JSON.parse(raw); } catch (e) {
    return { ok: false, code: 'INVALID_TRANSITION', reason: 'state.json 不可解析（fail-closed，禁止对损坏 state 覆写）: ' + e.message };
  }
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    return { ok: false, code: 'INVALID_TRANSITION', reason: 'state.json 顶层非对象（fail-closed）' };
  }
  const v = state.stateVersion;
  if (v === undefined || v === null) return { ok: true, state, stateVersion: 0, found: true }; // legacy v0 双读
  if (v === STATE_VERSION) return { ok: true, state, stateVersion: v, found: true };
  return { ok: false, code: 'STATE_VERSION_UNSUPPORTED', foundVersion: v, reason: `不认识的 stateVersion: ${JSON.stringify(v)}（当前实现版本 ${STATE_VERSION}；OQ-R4-2=A fail-closed，禁静默降级读取后覆写）` };
}

// ---------------------------------------------------------------------------
// R3 receipt 校验（[R3冻结] §7.6/§7.2/§3.4 —— R4 gate 只读消费同一校验，不另立宽松读法）
// ---------------------------------------------------------------------------

/**
 * deriveReceiptState(events)：事件数组重放推导（状态是事件链的派生视图，[R3冻结] §7.1）。
 * 返回 {terminal, idx, violations}；terminal ∈ 'behavior_verified'|'FAILED'|'UNRESOLVED'|null。
 * 违约面：枚举外/跳步/终态后追加/eventSeq 断档/必含字段缺失/sourceHashEcho 链断裂（§7.2 禁止跃迁）。
 */
function deriveReceiptState(events) {
  const violations = [];
  let idx = -1;
  let terminal = null;
  if (!Array.isArray(events)) return { terminal: null, idx: -1, violations: ['events 非数组（§3.4 schema 违约）'] };
  events.forEach((ev, i) => {
    const seq = i + 1;
    if (!ev || typeof ev !== 'object') { violations.push(`事件 ${seq} 非对象`); terminal = 'INVALID'; return; }
    if (terminal) { violations.push(`事件 ${seq}: 终态后追加事件（§7.2 禁止；新链须由新 sourceHash 的新 activation 开启）`); return; }
    if (terminal === 'INVALID') return;
    const t = ev.transition;
    const positive = RECEIPT_POSITIVE_CHAIN.includes(t);
    const negative = RECEIPT_NEGATIVE_EVENTS.includes(t);
    if (!positive && !negative) { violations.push(`事件 ${seq} transition 枚举外: ${JSON.stringify(t)}`); terminal = 'INVALID'; return; }
    if (ev.eventSeq !== seq) violations.push(`事件 ${seq} eventSeq 不连续（P1 完整性）`);
    for (const k of ['assetId', 'sourceHash', 'session', 'idempotencyKey']) {
      if (isBlank(ev[k])) violations.push(`事件 ${seq} 缺必含字段 ${k}（dev-plan:303 输入列）`);
    }
    if (i > 0) {
      if (ev.sourceHashEcho !== events[i - 1].sourceHash) violations.push(`事件 ${seq} sourceHashEcho 与链上前环不一致（P3 hash 链断裂）`);
    } else if (ev.sourceHashEcho != null && ev.sourceHashEcho !== ev.sourceHash) {
      violations.push('事件 1 sourceHashEcho 与自身 sourceHash 不一致');
    }
    if (negative) {
      terminal = t === 'verification_failed' ? 'FAILED' : 'UNRESOLVED'; // not_consumed/unresolved ⇒ UNRESOLVED
      return;
    }
    const expect = RECEIPT_POSITIVE_CHAIN[idx + 1];
    if (t !== expect) { violations.push(`事件 ${seq} 跃迁跳步: 期望 ${expect} 实得 ${t}（§7.2）`); terminal = 'INVALID'; return; }
    idx += 1;
    if (t === 'behavior_verified') terminal = 'behavior_verified';
  });
  return { terminal, idx, violations };
}

/**
 * validateReceipt(receipt)：R3 §3.4 schema + §7.6 回放一致性。
 * 返回 {ok:true, derived} | {ok:false, code:'RECEIPT_INVALID', reason}。
 * result 缓存与重放不一致 ⇒ RECEIPT_INVALID（防手改 receipt.json）。
 * P5：证据类别合法性——裸布尔 assetConsumed 不参与本校验（telemetry 视而不见，[R3冻结] §7.8）。
 */
export function validateReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { ok: false, code: 'RECEIPT_INVALID', reason: 'receipt 非 §3.4 对象形' };
  }
  if (typeof receipt.subtaskId !== 'string' || receipt.subtaskId === '') {
    return { ok: false, code: 'RECEIPT_INVALID', reason: 'receipt.subtaskId 缺失（§3.4）' };
  }
  const derived = deriveReceiptState(receipt.events);
  if (derived.terminal === 'INVALID' || derived.violations.length > 0) {
    return { ok: false, code: 'RECEIPT_INVALID', reason: 'receipt 事件重放违约: ' + derived.violations.slice(0, 3).join('; ') };
  }
  if (receipt.result != null) {
    if (!receipt.result || typeof receipt.result !== 'object' || typeof receipt.result.result !== 'string') {
      return { ok: false, code: 'RECEIPT_INVALID', reason: 'receipt.result 缓存形违约（§3.3 behaviorCheck）' };
    }
    const expected = derived.terminal === 'behavior_verified' ? 'VERIFIED' : derived.terminal;
    if (receipt.result.result !== expected) {
      return { ok: false, code: 'RECEIPT_INVALID', reason: `result 缓存(${receipt.result.result})与事件重放(${expected})不一致（§3.4/§7.6 防手改）` };
    }
  }
  return { ok: true, derived };
}

// ---------------------------------------------------------------------------
// 锁协议（§2.3，OQ-R4-3=A：常量沿用；lock 文件 schema [草案]：{holder, pid, acquiredAt, purpose}）
// ---------------------------------------------------------------------------

function readLockHolder(lockFile) {
  const raw = readJson(lockFile);
  if (raw && typeof raw === 'object') return raw;
  return null; // legacy 空锁占位（tt-journey.mjs:184-189 wx 空文件）⇒ 持有者未知
}

/**
 * withStateLock(lockFile, holder, fn)：
 *   wx 独占创建 + 重试 {times:5, delayMs:400}（OQ-R4-3=A 沿用现状常量）。
 *   接管判定（验收口径 takeover = dead || (stale && !pidAlive)）：
 *     - 持有者 pid 确认死亡 ⇒ 接管（无论 mtime）；
 *     - 锁过期（mtime > 30s）且无法证明持有者存活（含 legacy 无持有者锁）⇒ 接管；
 *     - 持有者存活 ⇒ 永不接管（活进程长任务不被误接管，清单 R4-04 defect 面）。
 *   耗尽 ⇒ {acquired:false, holder, lockFile}——调用方必须显式失败（LOCK_ACQUIRE_FAILED），禁止锁外继续。
 */
export async function withStateLock(lockFile, holder, fn) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  for (let attempt = 0; attempt <= LOCK_RETRY.times; attempt += 1) {
    if (attempt > 0) await sleep(LOCK_RETRY.delayMs);
    try {
      fs.writeFileSync(lockFile, JSON.stringify(holder), { flag: 'wx' });
      try { return { acquired: true, value: await fn() }; }
      finally { try { fs.unlinkSync(lockFile); } catch { /* 锁已被接管方删除 */ } }
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    const current = readLockHolder(lockFile);
    const alive = current ? pidAlive(current.pid) : null;
    let stale = false;
    try { stale = Date.now() - fs.statSync(lockFile).mtimeMs > LOCK_STALE_MS; } catch { continue; }
    const takeover = alive === false || (stale && alive !== true);
    if (takeover) {
      // 审计可见的接管：接管事实写入接管方锁内容之外，由 transitions/override 审计与 evidence.lockTakeover 留痕
      try { fs.unlinkSync(lockFile); } catch { /* 他方已释放，下轮重试 */ }
    }
  }
  return { acquired: false, holder: readLockHolder(lockFile), lockFile };
}

// ---------------------------------------------------------------------------
// 前置谓词（§4；§4.2 映射表 OQ-R4-5=A 原样冻结；fail-closed：证据缺失 = 不通过）
// 块形：{code, category, reason}；code ∈ PHASE_PREREQ_UNMET | CONTRACT_NOT_FROZEN | RECEIPT_INVALID | INVALID_TRANSITION
// ---------------------------------------------------------------------------

function canTransition(from, to) { return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to)); }

/** 契约冻结检查（§4.1 contract frozen 行；CONTRACT_NOT_FROZEN 与 runtime 现状同码同语义 [代码佐证 runtime.mjs:105-108]） */
function contractFrozenBlock(plan, workspace) {
  if (!plan) {
    return { code: 'CONTRACT_NOT_FROZEN', category: 'contract_frozen', reason: '契约冻结证据缺失（无 plan/state 上下文）——缺失=不通过（§4.2 fail-closed）' };
  }
  if (plan._contractMissing === true) {
    return { code: 'CONTRACT_NOT_FROZEN', category: 'contract_frozen', reason: 'plan._contractMissing=true（契约未冻结，runtime 现状同码同语义）' };
  }
  const declared = [];
  if (plan.contractMode === 'frozen' && !isBlank(plan.contract)) declared.push({ id: plan.id ?? '<plan>', contract: plan.contract });
  for (const st of (Array.isArray(plan.subtasks) ? plan.subtasks : [])) {
    if (st && st.contractMode === 'frozen' && !isBlank(st.contract)) declared.push({ id: st.id, contract: st.contract });
  }
  for (const d of declared) {
    const p = path.isAbsolute(d.contract) ? d.contract : path.join(workspace || '.', d.contract);
    if (!fs.existsSync(p)) {
      return { code: 'CONTRACT_NOT_FROZEN', category: 'contract_frozen', reason: `冻结契约文件缺失: ${d.contract}（subtask/plan ${d.id}；contractMode=frozen 要求文件在场）` };
    }
  }
  return null;
}

/**
 * receipt 终态全覆盖（§3.4 衔接点 1：reviewing→done / step8）。
 * 通过面 = behavior_verified（唯一正终态）或显式负向 FAILED；UNRESOLVED/未到终态/缺失 ⇒ 不通过，
 * UNRESOLVED 不得被静默计为通过；裸布尔 assetConsumed(telemetry) 对本谓词视而不见（[R3冻结] §7.8）。
 */
function receiptCoverageBlocks(plan, workspace, session, sessionMode) {
  const blocks = [];
  const subtasks = Array.isArray(plan?.subtasks) ? plan.subtasks : [];
  const dispatched = subtasks.filter((st) => st && !isBlank(st.asset));
  for (const st of dispatched) {
    const rp = receiptPathFor(workspace, st.id, session, sessionMode);
    const raw = readJson(rp);
    if (!raw) {
      blocks.push({
        code: 'PHASE_PREREQ_UNMET', category: 'receipt_evidence',
        reason: `subtask ${st.id} 缺 receipt.json（[R3冻结] §7.6 per-artifact）——证据缺失=不通过；assetConsumed 布尔为 telemetry-only，永不满足 phase gate（OQ-R3-7）`,
      });
      continue;
    }
    const v = validateReceipt(raw);
    if (!v.ok) { blocks.push({ code: v.code, category: 'receipt_evidence', reason: `subtask ${st.id} ${v.code}: ${v.reason}` }); continue; }
    const t = v.derived.terminal;
    if (t === 'behavior_verified' || t === 'FAILED') continue; // 正终态 / 显式负向收口
    if (t === 'UNRESOLVED') {
      blocks.push({ code: 'PHASE_PREREQ_UNMET', category: 'receipt_evidence', reason: `subtask ${st.id} receipt 终态 UNRESOLVED 未收口——不得静默计为通过（§3.4 衔接点 1）` });
      continue;
    }
    blocks.push({ code: 'PHASE_PREREQ_UNMET', category: 'receipt_evidence', reason: `subtask ${st.id} receipt 未到终态（事件链止于第 ${v.derived.idx + 1} 环）——"无法判定"与"不满足"同归不通过（§4.2）` });
  }
  return blocks;
}

/** 上游消费证据（§3.4 衔接点 2：planning→executing 的 DEP_PRECONDITION 投影 [代码佐证 runtime.mjs:165-180]） */
function depPreconditionBlocks(plan, workspace, session, sessionMode) {
  const blocks = [];
  if (!plan?.requireExec || !Array.isArray(plan.preconditions) || plan.preconditions.length === 0) return blocks;
  const subtasks = Array.isArray(plan.subtasks) ? plan.subtasks : [];
  for (const st of subtasks) {
    const deps = Array.isArray(st?.dependsOn) ? st.dependsOn : [];
    for (const depId of deps) {
      const dep = subtasks.find((s) => s && s.id === depId);
      if (!dep) { blocks.push({ code: 'PHASE_PREREQ_UNMET', category: 'dependency_precondition', reason: `DEP_PRECONDITION: 依赖 ${depId} 不存在（fail-closed）` }); continue; }
      if (dep.status !== 'done') {
        blocks.push({ code: 'PHASE_PREREQ_UNMET', category: 'dependency_precondition', reason: `DEP_PRECONDITION: 上游 ${dep.asset ?? '?'}(${depId}) 状态 ${dep.status} 非 done` });
        continue;
      }
      // 消费证据按 §4.2 映射到达要求类别 = C-R3 receipt 终态 behavior_verified；裸布尔升格禁止
      const rp = receiptPathFor(workspace, dep.id, session, sessionMode);
      const raw = readJson(rp);
      if (!raw) {
        blocks.push({ code: 'PHASE_PREREQ_UNMET', category: 'dependency_precondition', reason: `上游 ${dep.asset ?? '?'}(${depId}) 缺消费 receipt——assetConsumed=${JSON.stringify(dep.assetConsumed ?? null)} 为 telemetry-only，不作为 gate 输入（OQ-R3-7）` });
        continue;
      }
      const v = validateReceipt(raw);
      if (!v.ok) { blocks.push({ code: v.code, category: 'dependency_precondition', reason: `上游 ${depId} ${v.code}: ${v.reason}` }); continue; }
      if (v.derived.terminal !== 'behavior_verified') {
        blocks.push({ code: 'PHASE_PREREQ_UNMET', category: 'dependency_precondition', reason: `上游 ${dep.asset ?? '?'}(${depId}) receipt 终态 ${v.derived.terminal ?? '未到终态'} 非 behavior_verified——消费证据未达要求类别（§4.1 receipt 证据行）` });
      }
    }
  }
  return blocks;
}

/**
 * evaluatePrereqs(ctx)：§4.2 最小映射（未列出的转换 = 仅矩阵合法性 + session + lock 前置，不额外加 receipt 要求）。
 * ctx: {kind:'step'|'transition', step?, from?, to?, plan, workspace, session, sessionMode, journey}
 */
function evaluatePrereqs(ctx) {
  const blocks = [];
  const plan = ctx.plan;
  if (ctx.kind === 'transition') {
    // 矩阵断言先行（§6.2 顺序：矩阵 → 前置 → override；终态不可追加 §3.2）
    if (!canTransition(ctx.from, ctx.to)) {
      const terminal = TERMINAL_STATES.includes(ctx.from);
      blocks.push({
        code: 'INVALID_TRANSITION', category: 'transition_matrix',
        reason: terminal ? `终态不可追加: ${ctx.from} 的合法后继为空（§3.2）；回退/重开只能通过新链（§8.4）` : `矩阵外转换: ${ctx.from} → ${ctx.to}（§3.2）`,
      });
      return blocks;
    }
    if (ctx.from === 'planning' && ctx.to === 'executing') {
      const c = contractFrozenBlock(plan, ctx.workspace);
      if (c) { blocks.push(c); return blocks; }
      blocks.push(...depPreconditionBlocks(plan, ctx.workspace, ctx.session, ctx.sessionMode));
    }
    if (ctx.from === 'reviewing' && ctx.to === 'done') {
      blocks.push(...receiptCoverageBlocks(plan, ctx.workspace, ctx.session, ctx.sessionMode));
    }
    return blocks;
  }
  // B 面 step（里程碑 gate 权威投影，OQ-R4-1=A；映射 §4.2 第 1-4 行）
  const gate = STEP_GATE[ctx.step];
  if (gate != null) {
    const steps = Array.isArray(ctx.journey?.steps) ? ctx.journey.steps : [];
    const node = steps.find((s) => s && s.step === ctx.step);
    const passed = Boolean(node && Array.isArray(node.gates_passed) && node.gates_passed.includes(gate));
    if (!passed) {
      blocks.push({ code: 'PHASE_PREREQ_UNMET', category: 'journey_gate', reason: `step ${ctx.step} 的 Owner 闸 ${gate} 未置位（journey 投影缺失或 gates_passed 不含）——缺失=不通过（§4.1 journey gate 行）` });
    }
  }
  if (ctx.step === 5) {
    const c = contractFrozenBlock(plan, ctx.workspace);
    if (c) blocks.push(c);
  }
  if (ctx.step === 7) {
    // gate-a-approved + 待派 subtask 的 eligibility 投影（R2 机制不重定义：仅查结构在场——asset 非空）
    const subtasks = Array.isArray(plan?.subtasks) ? plan.subtasks : [];
    for (const st of subtasks) {
      if (st && st.status !== 'done' && isBlank(st.asset)) {
        blocks.push({ code: 'PHASE_PREREQ_UNMET', category: 'eligibility', reason: `待派 subtask ${st.id} 无 asset（R2 eligibility 投影缺失；深判定属 router/matrix，本处不重定义 §4.2 step7 行）` });
      }
    }
  }
  if (ctx.step === 8) {
    blocks.push(...receiptCoverageBlocks(plan, ctx.workspace, ctx.session, ctx.sessionMode));
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// override 裁定（§5；ownerApprovalReceipt schema §5.2，OQ-R4-6=A）
// ---------------------------------------------------------------------------

/** approvalEvidence 规范形：`<指令文件路径>#<SHA256>`（OQ-R4-6=A；对话记录引用为辅，本实现不解析） */
export function formatApprovalEvidence(file, sha256hex) { return `${file}#${sha256hex}`; }

const APPROVAL_ID_RE = /^apr-\d{8}T\d{6}Z-[0-9a-zA-Z]{8}$/;
const OWNER_RECEIPT_FIELDS = ['approvalId', 'targetType', 'target', 'reason', 'approvedBy', 'approvedAt', 'approvalEvidence', 'expiresAt', 'relatedReceipts'];

/**
 * validateOwnerReceipt({receipt, from, to, scopeId, at, workspace, session, sessionMode}) →
 *   {ok:true, receipt} | {ok:false, code:'OVERRIDE_NOT_ALLOWED'|'OWNER_APPROVAL_REQUIRED', reason}
 * 校验面（清单 R4-07）：schema 字段集 / approvalId 形 / targetType / target 绑定(from,to,scope,scopeId) /
 * approvedBy=owner / reason 必填 / approvedAt ISO 且先于执行（不可抵赖）/ expiresAt=null /
 * approvalEvidence 路径+SHA256 且文件字节可验 / relatedReceipts 形 / rollback 失效条款 / 跨转换复用登记。
 */
function validateOwnerReceipt(args) {
  const { receipt, from, to, at, workspace, session, sessionMode } = args;
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { ok: false, code: 'OWNER_APPROVAL_REQUIRED', reason: '缺失已批准 override receipt（GWT-R4-02：输出缺失批准的诊断而非静默推进）' };
  }
  const missing = OWNER_RECEIPT_FIELDS.filter((k) => !(k in receipt));
  if (missing.length > 0) {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: `ownerApprovalReceipt 缺字段: ${missing.join(', ')}（§5.2 schema）` };
  }
  if (!APPROVAL_ID_RE.test(receipt.approvalId)) {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: `approvalId 格式不符: ${receipt.approvalId}（须 apr-<YYYYMMDDTHHMMSSZ>-<8位随机>，OQ-R4-6=A）` };
  }
  if (receipt.targetType !== 'phase_transition') {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: `targetType 非法: ${JSON.stringify(receipt.targetType)}（本契约内唯一合法值 phase_transition，§5.2）` };
  }
  const tg = receipt.target ?? {};
  if (tg.from !== from || tg.to !== to) {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: `target 绑定不符: receipt(${tg.from}→${tg.to}) ≠ 请求(${from}→${to})——批准绑定特定 from/to/scope，不跨转换复用（§5.2 expiresAt=null 条款）` };
  }
  if (tg.scope !== 'plan') {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: `target.scope 非法: ${JSON.stringify(tg.scope)}（合法 plan|step；A 面转换为 plan）` };
  }
  const expectedScopeId = args.scopeId == null ? '' : String(args.scopeId);
  if (String(tg.scopeId ?? '') !== expectedScopeId) {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: `target.scopeId 不符: ${JSON.stringify(tg.scopeId ?? null)} ≠ ${JSON.stringify(expectedScopeId)}（跨作用域复用禁止，§5.2）` };
  }
  if (receipt.approvedBy !== 'owner') {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: `approvedBy 非 owner: ${JSON.stringify(receipt.approvedBy)}（非 owner 身份 ⇒ receipt 无效，§5.2）` };
  }
  if (isBlank(receipt.reason)) {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: 'reason 必填（Owner 给出的理由，禁止空，§5.2）' };
  }
  const approvedMs = Date.parse(receipt.approvedAt);
  if (Number.isNaN(approvedMs)) {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: `approvedAt 非 ISO 8601: ${JSON.stringify(receipt.approvedAt)}` };
  }
  const execMs = Date.parse(at);
  if (approvedMs > execMs) {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: '批准时点倒挂：approvedAt 晚于 transition 时点（批准先于执行，不可抵赖性 §5.2/§5.4）' };
  }
  if (receipt.expiresAt !== null) {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: `expiresAt 必须为 null（批准绑定特定 from/to/scope，不跨作用域/跨转换复用，OQ-R4-6=A）；实得 ${JSON.stringify(receipt.expiresAt)}` };
  }
  if (!Array.isArray(receipt.relatedReceipts) || receipt.relatedReceipts.some((r) => !r || typeof r !== 'object')) {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: 'relatedReceipts 须为 receiptRef 对象数组（§5.2）' };
  }
  // approvalEvidence = 指令文件路径 + 该文件 SHA256（对话引用为辅）
  const ev = String(receipt.approvalEvidence ?? '');
  const m = ev.match(/([0-9a-fA-F]{64})/);
  if (!m) return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: 'approvalEvidence 缺 SHA256（OQ-R4-6=A）' };
  const declaredHash = m[1].toLowerCase();
  const filePath = ev.slice(0, m.index).replace(/[#\s]+$/, '').trim();
  if (!filePath) return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: 'approvalEvidence 缺指令文件路径（OQ-R4-6=A）' };
  const abs = path.isAbsolute(filePath) ? filePath : path.join(workspace || '.', filePath);
  if (!fs.existsSync(abs)) {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: `approvalEvidence 指令文件不可读: ${filePath}（不可抵赖性 fail-closed）` };
  }
  const actual = sha256File(abs);
  if (actual !== declaredHash) {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: `approvalEvidence SHA256 与指令文件字节不一致（声明 ${declaredHash.slice(0, 12)}… 实测 ${actual.slice(0, 12)}…）` };
  }
  // rollback 失效条款（OQ-R4-6=A）：rollback 前签发的 approval 对 rollback 后的 transition 一律失效
  const rbFile = rollbacksFileFor(workspace, session, sessionMode);
  const rollbacks = readJson(rbFile);
  if (Array.isArray(rollbacks)) {
    const times = rollbacks.filter((r) => r && typeof r.at === 'string' && !Number.isNaN(Date.parse(r.at))).map((r) => Date.parse(r.at));
    if (times.length > 0) {
      const lastRollbackMs = Math.max(...times);
      if (approvedMs < lastRollbackMs && execMs >= lastRollbackMs) {
        return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: 'rollback 失效条款：approval 签发于最近一次 rollback 之前，对 rollback 后的 transition 一律失效，须重新签发（OQ-R4-6=A）' };
      }
    }
  }
  // 同 receipt 二次引用（清单 R4-07b/c）：双向引用登记在案 ⇒ 非幂等支路的再次使用一律拒绝（不跨转换复用）
  const regFile = path.join(overridesDirFor(workspace, session, sessionMode), '.approvals-registry.json');
  const registry = readJson(regFile);
  const priorUses = (registry && Array.isArray(registry[receipt.approvalId])) ? registry[receipt.approvalId] : [];
  if (priorUses.length > 0) {
    return { ok: false, code: 'OVERRIDE_NOT_ALLOWED', reason: `approval 已被引用过（executionId ${priorUses[0].executionId}，双向引用登记在案）——同 receipt 二次引用走幂等或拒绝，跨转换复用禁止（§5.2/清单 R4-07b）` };
  }
  return { ok: true, receipt };
}

// ---------------------------------------------------------------------------
// phase.check（§6.1，只读：不写任何状态、journey、receipt；lock 不需要）
// ---------------------------------------------------------------------------

/**
 * checkPhase(input)
 * input: { workspace?, target?(B 面 step 号) | from+to(A 面), session?, journey?(快照对象|路径|缺省读盘), opts? }
 * opts:  { now, env }（确定性注入，供文件化探针复现；生产省略）
 * 输出:  data {allowed, reason, missing}；evidence {snapshot, stateVersionEcho, sessionEcho, checkedAt, …}
 * 通道（OQ-R4-7=A）：allowed=false 且仅 PHASE_PREREQ_UNMET ⇒ ok:true + code='PHASE_PREREQ_UNMET'（data 通道，查询语义）；
 * 硬错误（INVALID_TRANSITION/CONTRACT_NOT_FROZEN/RECEIPT_INVALID/SESSION_INVALID/STATE_VERSION_UNSUPPORTED/flag 非法）⇒ ok:false。
 */
export async function checkPhase(input = {}) {
  const warnings = [];
  const opts = input.opts ?? {};
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();
  const at = nowIso(now);
  const workspace = input.workspace ?? '.';

  // (1) flag fail-closed（§8.1）
  const gm = resolveGateMode(env);
  if (!gm.ok) return respond(false, gm.code, { reason: gm.reason }, {}, warnings);
  const sm = resolveSessionMode(env);
  if (!sm.ok) return respond(false, sm.code, { reason: sm.reason }, {}, warnings);

  // (2) session 校验（§2.1）；缺省 = legacy 通道；strict 缺省自动生成（只读面仅回显，元数据随写入面落盘）
  let session = input.session ?? null;
  let generated = false;
  if (isBlank(session)) {
    session = null;
    if (gm.mode === 'strict') { session = crypto.randomUUID(); generated = true; }
  } else if (!isValidSession(session)) {
    return respond(false, 'SESSION_INVALID', { reason: `非法 session id: ${JSON.stringify(input.session)}（§2.1 白名单 ^[A-Za-z0-9_-]+$，防路径穿越，fail-closed）` }, {}, warnings);
  }
  if (generated) warnings.push('check 只读：strict 缺省自动生成 session 仅在 evidence 回显；生成元数据（时间/生成方/算法版本）随写入面（phase.transition）落盘（OQ-R4-4=B）');

  // (3) 输入形状：B 面 step 号或 A 面 from/to 对（§6.1；两面兼容按 §4.2 最小映射，OQ-R4-1=A）
  const hasStep = input.target !== undefined && input.target !== null;
  const hasPair = input.from !== undefined || input.to !== undefined;
  if (hasStep === hasPair) {
    return respond(false, 'INVALID_TRANSITION', { reason: '输入形状非法：须提供 target（B 面 step 号）或 from+to（A 面转换对）二者之一；禁止对非法输入返回 allowed=true（§6.1）' }, {}, warnings);
  }
  let from = null; let to = null; let step = null;
  if (hasStep) {
    step = input.target;
    if (!Number.isInteger(step) || step < 0 || step > 8) {
      return respond(false, 'INVALID_TRANSITION', { reason: `target step 非法: ${JSON.stringify(step)}（B 面 0-8 整数，tt-journey.mjs:66-69 同口径）` }, {}, warnings);
    }
  } else {
    from = input.from; to = input.to;
    if (typeof from !== 'string' || from === '' || typeof to !== 'string' || to === '') {
      return respond(false, 'INVALID_TRANSITION', { reason: 'from/to 形状非法（非空字符串，§6.2 输入列）' }, {}, warnings);
    }
  }

  // (4) 读 state（版本 fallback，OQ-R4-2=A）与 journey 投影（只读）
  const stateFile = statePathFor(workspace, session, sm.mode);
  const rs = readStateVersioned(stateFile);
  if (!rs.ok) {
    return respond(false, rs.code, { reason: rs.reason, foundVersion: rs.foundVersion }, {}, warnings);
  }
  const plan = rs.state;

  let journey = null; let journeySource = null;
  if (input.journey && typeof input.journey === 'object') { journey = input.journey; journeySource = 'input.snapshot'; }
  else if (typeof input.journey === 'string') { journey = readJson(input.journey); journeySource = input.journey; }
  else {
    const jp = journeyPathFor(workspace, session);
    journey = readJson(jp); journeySource = jp;
  }

  // (5) 前置谓词（§4）
  const blocks = evaluatePrereqs({ kind: hasStep ? 'step' : 'transition', step, from, to, plan, workspace, session, sessionMode: sm.mode, journey });
  const allowed = blocks.length === 0;

  const evidence = {
    snapshot: rs.found ? sha256Hex(fs.readFileSync(stateFile)) : null,
    stateVersionEcho: rs.found ? rs.stateVersion : null,
    sessionEcho: session,
    sessionGenerated: generated,
    sessionMode: sm.mode,
    gateMode: gm.mode,
    journeySource,
    checkedAt: at,
    strongerBehaviorVerification: STRONGER_VERIFICATION_STATUS,
  };

  if (allowed) return respond(true, null, { allowed: true, reason: '允许（前置谓词全部满足或无额外前置，§4.2）', missing: [] }, evidence, warnings);

  // 通道分叉（OQ-R4-7=A）：PHASE_PREREQ_UNMET 走 data 通道；硬错误码走 error 通道（ok:false ⇒ CI exit non-zero，§6.3）
  const hard = blocks.find((b) => b.code !== 'PHASE_PREREQ_UNMET');
  if (hard) {
    return respond(false, hard.code, { allowed: false, reason: hard.reason, missing: blocks }, evidence, warnings);
  }
  return respond(true, 'PHASE_PREREQ_UNMET', { allowed: false, reason: blocks[0].reason, missing: blocks }, evidence, warnings);
}

// ---------------------------------------------------------------------------
// phase.transition（§6.2，单一入口 §3.3：矩阵 → 前置 → override → 锁内写入；全部通过才落盘）
// ---------------------------------------------------------------------------

/**
 * transitionPhase(input)
 * input: { workspace?, from, to, session?, ownerReceipt?, evidenceRefs?, force?, opts? }
 * opts:  { now, env, rand, toolTrace }
 * 输出:  data {from, to, at, sessionId, override: null|executionId, stateVersionWritten}
 * 错误码：INVALID_TRANSITION / PHASE_PREREQ_UNMET（先于 override 判定返回，GWT-R4-01）/ OWNER_APPROVAL_REQUIRED
 *        （--force 且无批准，GWT-R4-02）/ OVERRIDE_NOT_ALLOWED（批准 receipt 无效）/ LOCK_ACQUIRE_FAILED /
 *        STATE_VERSION_UNSUPPORTED / CONTRACT_NOT_FROZEN / RECEIPT_INVALID / SESSION_INVALID。
 * 幂等（§6.2）：同 from/to 且已在 to 态 ⇒ 幂等返回既有终态（no-op 不写重复记录）；不同 from ⇒ INVALID_TRANSITION。
 */
export async function transitionPhase(input = {}) {
  const warnings = [];
  const opts = input.opts ?? {};
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();
  const at = nowIso(now);
  const workspace = input.workspace ?? '.';

  // (0) flag fail-closed（§8.1）
  const gm = resolveGateMode(env);
  if (!gm.ok) return respond(false, gm.code, { reason: gm.reason }, {}, warnings);
  const sm = resolveSessionMode(env);
  if (!sm.ok) return respond(false, sm.code, { reason: sm.reason }, {}, warnings);

  // (1) session 身份（§2.1/OQ-R4-4=B）
  let session = input.session ?? null;
  let generated = false;
  if (isBlank(session)) {
    session = null;
    if (gm.mode === 'strict') { session = crypto.randomUUID(); generated = true; }
  } else if (!isValidSession(session)) {
    return respond(false, 'SESSION_INVALID', { reason: `非法 session id: ${JSON.stringify(input.session)}（§2.1 白名单，fail-closed）` }, {}, warnings);
  }

  // (2) 输入形状
  const from = input.from; const to = input.to;
  if (typeof from !== 'string' || from === '' || typeof to !== 'string' || to === '') {
    return respond(false, 'INVALID_TRANSITION', { reason: 'from/to 形状非法（非空字符串）——fail-closed 输入校验通道' }, {}, warnings);
  }

  // (3) 锁（写操作必须持锁，§4.1 lock 可得行；耗尽 = 显式安全结果，禁止锁外继续，GWT-R4-04）
  const stateFile = statePathFor(workspace, session, sm.mode);
  const lockFile = path.join(path.dirname(stateFile), 'state.lock');
  const holder = { holder: session ?? 'legacy', pid: process.pid, acquiredAt: at, purpose: 'phase.transition' };
  const lock = await withStateLock(lockFile, holder, async () => {
    // (4) 读 state + 版本 fallback（§2.2）
    const rs = readStateVersioned(stateFile);
    if (!rs.ok) return respond(false, rs.code, { reason: rs.reason, foundVersion: rs.foundVersion }, {}, warnings);
    const state = rs.state;
    const current = state ? state.status : 'idle'; // 缺 state = 虚拟 idle（单一入口 bootstrap，store.mjs 无文件时 load()=null 同语义）
    const scopeId = state?.id ?? '';

    const evidence = {
      snapshot: rs.found ? sha256Hex(fs.readFileSync(stateFile)) : null,
      stateVersionEcho: rs.found ? rs.stateVersion : null,
      sessionEcho: session,
      sessionGenerated: generated,
      sessionMode: sm.mode,
      gateMode: gm.mode,
      lockFile,
      checkedAt: at,
      evidenceRefs: Array.isArray(input.evidenceRefs) ? input.evidenceRefs : [],
    };

    // (5) 幂等（§6.2）：同 from/to + 已在 to 态 ⇒ no-op；不同 from 的重复调用 ⇒ INVALID_TRANSITION
    if (current === to) {
      const lt = state?.lastTransition;
      if (lt && (lt.from !== from || lt.to !== to)) {
        return respond(false, 'INVALID_TRANSITION', { reason: `已在 to 态(${to}) 但 from 与既有转换记录不符（${lt.from}→${lt.to}）——不同 from 的重复调用 ⇒ INVALID_TRANSITION（§6.2 幂等）`, current, from, to }, evidence, warnings);
      }
      warnings.push('IDEMPOTENT_REPLAY: 已在目标态，幂等返回既有终态，不写重复记录（§6.2）');
      return respond(true, null, {
        from, to, at: state?.updatedAt ?? at, sessionId: session, override: lt?.override ?? null,
        stateVersionWritten: rs.stateVersion, idempotent: true,
      }, evidence, warnings);
    }

    // (6) from 不符 ⇒ INVALID_TRANSITION
    if (current !== from) {
      return respond(false, 'INVALID_TRANSITION', { reason: `from 不符: canonical 当前态 ${current} ≠ 请求 from ${from}（§6.2 错误码行）`, current, from, to }, evidence, warnings);
    }

    // (7) 矩阵断言（§3.2；终态不可追加）
    if (!canTransition(from, to)) {
      const terminal = TERMINAL_STATES.includes(from);
      return respond(false, 'INVALID_TRANSITION', {
        reason: terminal ? `终态不可追加: ${from} 的合法后继为空（§3.2）` : `矩阵外转换: ${from} → ${to}（§3.2）`,
        current, from, to,
      }, evidence, warnings);
    }

    // (8) 前置谓词（§4；PHASE_PREREQ_UNMET 先于 override 判定返回，GWT-R4-01 措辞）
    const blocks = evaluatePrereqs({ kind: 'transition', from, to, plan: state, workspace, session, sessionMode: sm.mode, journey: null });
    const hard = blocks.find((b) => b.code !== 'PHASE_PREREQ_UNMET');
    if (hard) return respond(false, hard.code, { allowed: false, reason: hard.reason, missing: blocks, stateUnchanged: true }, evidence, warnings);

    let executionId = null;
    let approval = null;
    if (blocks.length > 0) {
      // 前置未满足：
      //  - 无 --force ⇒ PHASE_PREREQ_UNMET（error 通道，exit non-zero 语义属调用方；canonical state 不变，GWT-R4-01）
      //  - 有 --force ⇒ override 通道（§5.3）：无批准 ⇒ OWNER_APPROVAL_REQUIRED；无效批准 ⇒ OVERRIDE_NOT_ALLOWED；
      //    有效批准 ⇒ 执行转换 + override 执行记录（目标状态带 override 标注，不伪装为"前置自然满足"）
      if (input.force !== true) {
        return respond(false, 'PHASE_PREREQ_UNMET', { reason: blocks[0].reason, missing: blocks, prereqUnmet: blocks, stateUnchanged: true, from, to }, evidence, warnings);
      }
      const adj = validateOwnerReceipt({ receipt: input.ownerReceipt, from, to, scopeId, at, workspace, session, sessionMode: sm.mode });
      if (!adj.ok) {
        const data = { reason: adj.reason, prereqUnmet: blocks, from, to, stateUnchanged: true };
        if (adj.code === 'OWNER_APPROVAL_REQUIRED') data.missingApproval = true;
        return respond(false, adj.code, data, evidence, warnings);
      }
      approval = adj.receipt;
      executionId = `exc-${formatStamp(now)}-${rand8(opts.rand)}`;
    }

    // (9) 单一入口写入（锁内同临界区：状态 + 审计记录原子完成，§6.2 原子性行；OBS-01 教训：写失败必须显式失败）
    const prevBytes = rs.found ? fs.readFileSync(stateFile) : null;
    try {
      // bootstrap：缺 state 时建立最小 plan 形（此时 current 必为 idle，即 from==='idle' 才走到这里）
      const plan = state ?? { id: '', status: from, subtasks: [] };
      plan.status = to;
      plan.stateVersion = STATE_VERSION; // 新写初始值 = 1（OQ-R4-2=A；缺字段 legacy v0 双读不自动改写，仅在真实写入时升版）
      plan.updatedAt = at;
      if (generated) plan.sessionMeta = newAutoSessionMeta(session, at, 'phase.transition'); // 生成时间/生成方/算法版本（OQ-R4-4=B）
      plan.lastTransition = { from, to, at, sessionId: session, override: executionId };
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify(plan, null, 2));

      // transition 审计流（追加式；strict 单一入口留痕，§3.2 负向/§3.3 单入口）
      const logFile = transitionsLogFor(workspace, session, sm.mode);
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      fs.appendFileSync(logFile, JSON.stringify({ at, sessionId: session, from, to, override: executionId, forced: input.force === true, stateVersion: STATE_VERSION }) + '\n');

      // override 执行记录（§5.4/OQ-R4-9=A：.tt-state[/session]/overrides/ 追加式，禁 vendor/；非 journey 投影）
      let overrideRecordPath = null;
      if (executionId) {
        const odir = overridesDirFor(workspace, session, sm.mode);
        fs.mkdirSync(odir, { recursive: true });
        const record = {
          executionId,
          approvalId: approval.approvalId,
          approvalHash: sha256JsonValue(approval), // approval↔execution 哈希对账（§5.4(b) 残余的参数化解决）
          executedAt: at,
          sessionId: session,
          fromState: from,
          toState: to,
          prereqUnmet: blocks.map((b) => ({ category: b.category, reason: b.reason })),
          toolTrace: opts.toolTrace ?? null,
          approvalEvidence: approval.approvalEvidence,
        };
        const recFile = path.join(odir, `${executionId}.json`);
        if (fs.existsSync(recFile)) throw new Error('override 执行记录冲突（append-only 违约防护）: ' + executionId);
        fs.writeFileSync(recFile, JSON.stringify(record, null, 2));
        overrideRecordPath = recFile;
        // 双向引用登记：approvalId ↔ executionId（§5.4(a)）
        const regFile = path.join(odir, '.approvals-registry.json');
        const registry = readJson(regFile) ?? {};
        registry[approval.approvalId] = [...(registry[approval.approvalId] ?? []), { executionId, executedAt: at, from, to }];
        fs.writeFileSync(regFile, JSON.stringify(registry, null, 2));
        warnings.push('OVERRIDE_APPLIED: 目标状态带 override 标注（state.lastTransition.override + 执行记录），下游可辨识，非"前置自然满足"（GWT-R4-01/§5.3）');
      }

      evidence.snapshotAfter = sha256Hex(fs.readFileSync(stateFile));
      evidence.transitionsLog = logFile;
      evidence.overrideRecord = overrideRecordPath;
      evidence.statePath = stateFile;
      return respond(true, null, {
        from, to, at, sessionId: session, override: executionId,
        stateVersionWritten: STATE_VERSION, idempotent: false,
      }, evidence, warnings);
    } catch (e) {
      // 原子性回补：状态已写而审计缺失的中间态不允许——尽力恢复原字节后显式失败（不得静默）
      try {
        if (prevBytes != null) fs.writeFileSync(stateFile, prevBytes);
        else fs.unlinkSync(stateFile);
      } catch { /* 恢复失败也须显式上抛 */ }
      throw e;
    }
  });

  if (!lock.acquired) {
    // 显式安全结果（GWT-R4-04）：输出携带锁持有者信息；不锁外继续执行
    return respond(false, 'LOCK_ACQUIRE_FAILED', {
      reason: `锁耗尽（重试 ${LOCK_RETRY.times}×${LOCK_RETRY.delayMs}ms）——禁止锁外继续执行（GWT-R4-04）；接管判定 = 持有者死亡 OR（过期且无法证明存活），持有者存活时不接管（§2.3）`,
      lockFile: lock.lockFile,
      holder: lock.holder,
      from, to,
      stateUnchanged: true,
    }, { checkedAt: nowIso(now) }, warnings);
  }
  return lock.value;
}

// ---------------------------------------------------------------------------
// 回滚登记（§8.4 步骤 2/3 的证据面辅助；非操作面操作名——操作面仍仅 phase.check/phase.transition）
// ---------------------------------------------------------------------------

/**
 * recordRollback({workspace?, session?, at?, reason?, flags?, opts?})
 * 在 state 同目录登记 rollback 事件（rollbacks.json 追加数组）；此后 rollback 前签发的 approval 一律失效（OQ-R4-6=A）。
 */
export function recordRollback(input = {}) {
  const env = input.opts?.env ?? process.env;
  const sm = resolveSessionMode(env);
  if (!sm.ok) return respond(false, sm.code, { reason: sm.reason }, {}, []);
  const session = input.session ?? null;
  if (session != null && !isValidSession(session)) {
    return respond(false, 'SESSION_INVALID', { reason: `非法 session id: ${JSON.stringify(session)}` }, {}, []);
  }
  const workspace = input.workspace ?? '.';
  const file = rollbacksFileFor(workspace, session, sm.mode);
  const list = readJson(file);
  if (!Array.isArray(list)) {
    if (fs.existsSync(file)) return respond(false, 'INVALID_TRANSITION', { reason: 'rollbacks.json 存在但非数组（fail-closed，不覆写）' }, {}, []);
  }
  const entry = {
    at: input.at ?? nowIso(),
    session,
    reason: input.reason ?? null,
    flags: input.flags ?? null, // §8.4 五要素：flag/commit/session/快照路径/恢复验证——由调用方补齐登记
    recordedBy: 'phase.recordRollback',
  };
  const next = [...(Array.isArray(list) ? list : []), entry];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  return respond(true, null, { rollbacksFile: file, count: next.length }, { entry }, []);
}

// ---------------------------------------------------------------------------
// CI truthfulness（§7.2 分类与退出码映射 + §7.3 字面约束，OQ-R4-8=A；R10 evolution 只读消费本分类）
// ---------------------------------------------------------------------------

/**
 * classifyCiResult({segment, code}) → 'PASS' | 'BLOCKING_FAIL' | 'QUALITY_WARN' | 'QUALITY_FAIL'
 * 阻断类 = CONTRACT_NOT_FROZEN / R3 receipt 校验失败(RECEIPT_INVALID) / GWT-R4-01…04 行为检查失败；
 * 资产质量段 exit 1 = QUALITY_WARN（信息不阻断，依据 R2 验收 20260912 non-blocking 结论）；
 * 其余未分类段 exit 1 = QUALITY_FAIL（带明细、不阻断，直至 Owner 另定）。
 */
export function classifyCiResult(result = {}) {
  const code = result.code;
  if (code == null || code === 0) return 'PASS';
  const seg = String(result.segment ?? '');
  const codeStr = typeof code === 'string' ? code : '';
  if (codeStr === 'CONTRACT_NOT_FROZEN' || codeStr === 'RECEIPT_INVALID') return 'BLOCKING_FAIL';
  if (/gwt[-_ ]?r4[-_ ]?0[1-4]/i.test(seg)) return 'BLOCKING_FAIL';
  if (/r3\s*receipt|receipt\s*(校验|validation)|c6SevenCaseGate/i.test(seg)) return 'BLOCKING_FAIL';
  if (/asset[-_ ]?(call[-_ ]?rate|quality)|资产质量/i.test(seg)) return 'QUALITY_WARN';
  return 'QUALITY_FAIL';
}

/**
 * ciSummary(rows) —— §7.3 字面约束的 summary 字段（PRD0 §11：每段 exit code、失败段名、是否阻断、artifact 路径）。
 * rows: [{name, code, artifactPath?}]；successLiteralAllowed=false 时任何 'CI PASS' 类成功字面 = defect（GWT-R4-05）。
 */
export function ciSummary(rows = []) {
  const classified = rows.map((r) => {
    const classification = classifyCiResult(r);
    return {
      name: r.name,
      exitCode: r.code ?? 0,
      classification,
      blocking: classification === 'BLOCKING_FAIL',
      artifactPath: r.artifactPath ?? null,
    };
  });
  const failedSegments = classified.filter((r) => r.exitCode !== 0).map((r) => r.name);
  const anyBlocking = classified.some((r) => r.blocking);
  return {
    rows: classified,
    failedSegments,
    anyBlocking,
    successLiteralAllowed: !anyBlocking, // 成功字面只允许在全部 mandatory 段 exit 0 时打印（§7.3.1）
    note: 'blocking 失败 ⇒ CI exit non-zero 且不得打印成功字面（§6.3/§7.3）；QUALITY_WARN/QUALITY_FAIL 带分类与失败段明细、不阻断（OQ-R4-8=A）',
  };
}

// ---------------------------------------------------------------------------
// run() 分发入口
// ---------------------------------------------------------------------------

/** run('phase.check'|'phase.transition', input) → 统一响应壳（仅两操作，不新增操作名） */
export function run(op, input) {
  if (op === 'phase.check') return checkPhase(input);
  if (op === 'phase.transition') return transitionPhase(input);
  return Promise.resolve(respond(false, 'INVALID_TRANSITION', { reason: `未知操作: ${op}（仅 phase.check / phase.transition 两操作，契约头/[计划输入 dev-plan:304-305]）` }));
}

export default {
  run, checkPhase, transitionPhase, recordRollback,
  resolveGateMode, resolveSessionMode, isValidSession, validateReceipt,
  classifyCiResult, ciSummary, formatApprovalEvidence, withStateLock,
  STATE, TRANSITIONS, TERMINAL_STATES, GATE_VOCAB, STEPS, STEP_GATE,
  STATE_VERSION, SESSION_RE, GATE_MODES, SESSION_MODES, LOCK_RETRY, LOCK_STALE_MS,
  RECEIPT_POSITIVE_CHAIN, RECEIPT_NEGATIVE_EVENTS, ERROR_CODES, FLAG_UNSUPPORTED_CODE,
  STRONGER_VERIFICATION_STATUS, CI_CLASSIFICATION,
};
