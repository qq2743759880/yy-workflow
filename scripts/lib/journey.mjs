/**
 * journey.mjs — R5a: Journey Control Room 后端投影（C-R5-journey 契约实现）
 *
 * 操作面（仅两操作，不新增操作名，dev-plan :306-307 逐字）：journey.read / journey.project。
 * 统一响应壳：{ok, code, data, evidence, warnings}（契约 §5；键集成功/失败完全一致；
 * 正常决策结果如 INFERRED/PARTIAL 进 data 通道，不进 error）。shell.evidence 为对象
 * （源身份/时点回声，契约 §5 示例 "evidence": { }）；data.journey.evidence /
 * data.projection.evidence 为数组（OQ-R5-6=A evidence links，与 R8 sourceAnchor 同构）。
 *
 * 错误码仅五（逐字沿用 dev-plan 原码，不新增不改名）：
 *   journey.read   → JOURNEY_NOT_FOUND / JOURNEY_STALE / JOURNEY_INVALID
 *   journey.project → PROJECTION_SOURCE_INVALID / PROJECTION_CONFLICT
 *   session 非法 / 输入形状违约 → 两操作均 JOURNEY_INVALID（契约 §3.3，白名单消费 [R4冻结] §2.1）
 *
 * 四类绑定源（§2.1）：state（A 面，phase/progress 维权威）、receipts（C-R3 资产维权威）、
 * logs（inferred-only 旁证，必附 source）、session（隔离键，非内容源）。
 * 分维权威归并（OQ-R5-1=A）：两源同值矛盾 → 各维如实投影 + discrepancy warning，互不覆盖；
 * 仅当同维内两权威值矛盾且不可归并时才 PROJECTION_CONFLICT（节点级双方 evidence，OQ-R5-7=A）。
 *
 * 展示态词汇（§3.1，投影层，非 A/B 面状态名）：
 *   AUTHORIZED / OBSERVED / INFERRED / STALE / PARTIAL / ERROR
 *   + 负向归并映射（OQ-R5-8=A）：failed→FAILED、skipped→SKIPPED、UNRESOLVED→UNRESOLVED。
 *   永不静默 SUCCESS：缺/旧/冲突/畸形源必须落到可见 STALE/PARTIAL/ERROR 并带 reason。
 * 判据（OQ-R5-2=A）：STALE = 相对判据（journey/源时点落后于其他权威源最新时点，不引入墙钟）；
 *   PARTIAL = 任一绑定源缺失（含不可读/不可解析），已投影部分带缺项说明。
 * 展示态优先级（实现归并序，见 RESULTS.md 登记）：ERROR > STALE > INFERRED（仅旁证整图降级）
 *   > PARTIAL > AUTHORIZED/OBSERVED；GWT-R5A-02 场景（仅 state-summary/log、无 journey/state）
 *   落 INFERRED（dev-plan R5a GWT2 原文期望），缺口仍写进 reason/warnings。
 * 组级聚合取最坏态（OQ-R5-8=A）：组内任一 failed/skipped/UNRESOLVED ⇒ 组不得显示完成
 *   （修现状 D-2 "有任一 plan 源即 step7=done"）。
 *
 * nextPrompt（OQ-R5-5=A）= 结构化对象 {actionHint, targetNode, requiredInputs[]} +
 *   生成时 projection 快照哈希回声；复制 = 快照引用不重算（copyNextPrompt 纯函数，
 *   snapshotRef.recompute 恒 false）；禁固定 SAMPLE（dev-plan R5a GWT4，D-4 修复）。
 *
 * session 布局（OQ-R5-9=A）：.tt-state/<sessionId>/{state.json, journey.json,
 *   artifacts/<subtaskId>/receipt.json, overrides/}；logs 随 artifacts 在 session 根下；
 *   legacy 无 session 保持现状根（state/journey 在 .tt-state/ 根、artifacts 在 workspace 根）。
 *   namespaced 模式投影读源必须随 session 命名空间（修现状 D-1：读源与落点同 namespace，
 *   禁跨 session 串读，GWT-R5A-03）。
 *
 * writer（OQ-R5-10=A / D-7）：YY_JOURNEY_WRITER=legacy → 本模块不落盘（现状写路径所有）；
 *   =projection 或未设（MW0 双写并存窗口）→ journey.project 为唯一 projection writer，
 *   且仅当展示态 ∈ {AUTHORIZED, OBSERVED} 时落盘 journey.json（§4.3：inferred/PARTIAL/STALE/
 *   ERROR 投影永不落盘为权威 Journey）。落盘为 additive 合并：保留 B 面 gates_passed/artifacts
 *   置位记录与 plans[] __manual__ 留痕行，不删旧字段（yy/journey@1 兼容读取保留）。
 * 只读保证（§4.3）：两操作不写 state/receipt/override，不推进任何 step/gate，不派单；
 *   不调用 phase.check / phase.transition（§2.3，投影不构成授权）。
 *
 * [待补充] 登记（fail-closed，不编造数值）：C-R5 §8.1 非 OQ 残留——JOURNEY_NOT_FOUND 的
 *   data/error 通道归属。本实现沿 R3 "正常决策进 data" 惯例 + 幸存消费面实测
 *   （webview/journey/render-core.mjs isJourneyNotFound 读 ok=false + code，诊断取
 *   data.journey；test-reports/R6-migration-20260917/compat-probe.mjs 同口径）走 data 通道
 *   （ok=false + code=JOURNEY_NOT_FOUND + data.journey 诊断），并在该响应 warnings 中显式
 *   标注等 Owner 复核。除此之外 C-R5 无数值型 [待补充]。
 *
 * 重建说明（recovery-20260919）：本文件为按 C-R5-journey（FROZEN 2026-09-15）+ 幸存消费方
 * （webview/journey/render-core.mjs、webview/journey/host-bridge.mjs、
 * test-reports/R6-migration-20260917/compat-probe.mjs、test-reports/impl-acceptance-20260915/
 * REPORT.md R5a 节）的行为级重建，非逐字节恢复（原 sha256 前 16 位 fe9bb851f8a36359）。
 * journey.json 存储形状与 scripts/tt-journey.mjs（yy/journey@1）兼容：STEPS/GATE_VOCAB/
 * PREREQ 前置逐字对照其 :8-:37（该文件本体未改动）；行为级自验见
 * test-reports/rebuild-20260920/R5a-journey/。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// 常量（与 scripts/tt-journey.mjs 逐字对照，只读复用，存储形状兼容锚）
// ---------------------------------------------------------------------------

/** journey schema（tt-journey.mjs:8 逐字） */
export const JOURNEY_SCHEMA = 'yy/journey@1';

/** 4 闸词汇（tt-journey.mjs:9 逐字；B 面里程碑 gate 权威，投影原样展示不重定义） */
export const GATE_VOCAB = ['concept-signed', 'premise-signed', 'contract-frozen', 'gate-a-approved'];

/** 9 节点 0-8（tt-journey.mjs:12-22 逐字；对齐 SKILL.md §0b 闭环全景） */
export const STEPS = [
  { step: 0, name: '资产整合', gate: null },
  { step: 1, name: '文档化', gate: 'concept-signed' },
  { step: 2, name: '重执行1', gate: null },
  { step: 3, name: '拆任务', gate: 'premise-signed' },
  { step: 4, name: '重执行1,2', gate: null },
  { step: 5, name: '规划+契约', gate: 'contract-frozen' },
  { step: 6, name: '重执行1,2,3', gate: null },
  { step: 7, name: '并行派单', gate: 'gate-a-approved' },
  { step: 8, name: '批判反哺', gate: null },
];

/** 正向主干（tt-journey.mjs:23 同构；下一阶段按当前之后第一个未完成节点） */
const FORWARD_LINE = [0, 1, 3, 5, 7, 8];

/** 防跳阶段前置（tt-journey.mjs:27-34 逐字；本模块只读消费——用于 blockerReason/requiredInputs，
 *  不做任何推进判定；推进权威在 tt-journey --update / phase.check / phase.transition） */
const PREREQ_MAP = {
  1: [{ step: 0 }],
  2: [{ step: 1 }],
  3: [{ step: 1, gate: 'concept-signed' }],
  5: [{ step: 3 }],
  7: [{ step: 5, gate: 'contract-frozen' }],
  8: [{ step: 7, inProgressOk: true }],
};

/** 投影展示态词汇（§3.1 + OQ-R5-8 负向映射；与幸存 render-core DISPLAY_STATES 一致） */
export const DISPLAY_STATES = ['AUTHORIZED', 'OBSERVED', 'INFERRED', 'STALE', 'PARTIAL', 'ERROR'];

/** 负向展示态（OQ-R5-8=A 归并映射；与幸存 render-core NEGATIVE_STATES 一致） */
export const NEGATIVE_STATES = ['FAILED', 'SKIPPED', 'UNRESOLVED'];

/** 错误码仅五（dev-plan :306-307 原码；不新增不改名） */
export const ERROR_CODES = Object.freeze([
  'JOURNEY_NOT_FOUND', 'JOURNEY_STALE', 'JOURNEY_INVALID',
  'PROJECTION_SOURCE_INVALID', 'PROJECTION_CONFLICT',
]);

/** 最坏态序（与幸存 render-core WORST_RANK 一致；组级聚合取最坏，OQ-R5-8） */
export const WORST_RANK = Object.freeze({
  FAILED: 9, UNRESOLVED: 8, SKIPPED: 7, ERROR: 6, STALE: 5,
  PARTIAL: 4, INFERRED: 3, OBSERVED: 2, AUTHORIZED: 1, DONE: 1,
});

/** projection mode 枚举与缺省（OQ-R5-4=A：summary|full，缺省 summary） */
export const PROJECTION_MODES = ['summary', 'full'];

/** session 白名单（[R4冻结] §2.1 / orchestrator.mjs:47 同一规则，防路径穿越） */
const SESSION_RE = /^[A-Za-z0-9_-]+$/;

/** 源状态 → 展示态映射（OQ-R5-3/OQ-R5-8；覆盖 A 面 7 态 [R4冻结] §3.1 + B 面 step 词表 +
 *  负向归并；unknown/未决收口 → UNRESOLVED，不得升格 done） */
const STATUS_TO_DISPLAY = {
  done: 'AUTHORIZED', in_progress: 'OBSERVED', pending: 'PARTIAL',
  failed: 'FAILED', skipped: 'SKIPPED',
  idle: 'PARTIAL', planning: 'OBSERVED', executing: 'OBSERVED',
  frozen: 'OBSERVED', reviewing: 'OBSERVED',
};

/** 活跃态（A 面 7 态 + B 面 in_progress；组级聚合的"进行中"判定） */
const ACTIVE_STATUSES = ['in_progress', 'planning', 'executing', 'frozen', 'reviewing'];

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

function respond(ok, code, data, evidence, warnings) {
  return { ok, code: code ?? null, data: data ?? {}, evidence: evidence ?? {}, warnings: warnings ?? [] };
}

function isBlank(v) {
  return v === undefined || v === null || v === '';
}

function sha256Of(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function toIso(ms) {
  return new Date(ms).toISOString();
}

function toMs(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isNaN(t) ? null : t; }
  return null;
}

function worstOf(a, b) {
  const ra = WORST_RANK[a] ?? 0;
  const rb = WORST_RANK[b] ?? 0;
  return ra >= rb ? a : b;
}

function isNegative(d) {
  return NEGATIVE_STATES.includes(d);
}

function readJsonFile(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (error) {
    if (error.code === 'ENOENT') return { exists: false };
    return { exists: true, problem: '不可读: ' + error.message };
  }
  try { return { exists: true, data: JSON.parse(text), raw: text }; }
  catch (error) { return { exists: true, problem: '不可解析: ' + error.message }; }
}

function relWorkspace(workspace, abs) {
  const rel = path.relative(workspace, abs).replace(/\\/g, '/');
  return rel.startsWith('..') ? abs.replace(/\\/g, '/') : rel;
}

// ---------------------------------------------------------------------------
// session 布局与输入校验（OQ-R5-9 / §3.3 / [R4冻结] §2.1）
// ---------------------------------------------------------------------------

/**
 * 布局解析：namespaced = .tt-state/<sessionId>/{state.json, journey.json, artifacts/…}；
 * legacy 无 session = .tt-state/ 根（state/journey）+ workspace/artifacts（现状根，修 D-1：
 * 投影读源与 journey 落点同 namespace；namespaced 下禁读 workspace 根，防跨 session 串读）。
 */
function resolveLayout(workspace, sessionId) {
  const ttState = path.join(workspace, '.tt-state');
  const base = sessionId ? path.join(ttState, sessionId) : ttState;
  const artifactsDir = sessionId ? path.join(base, 'artifacts') : path.join(workspace, 'artifacts');
  return {
    sessionId: sessionId ?? null,
    ttState,
    base,
    artifactsDir,
    stateFile: path.join(base, 'state.json'),
    journeyFile: path.join(base, 'journey.json'),
  };
}

/**
 * 输入校验（fail-closed；session 非法/形状违约 → JOURNEY_INVALID，契约 §3.3）。
 * 输入键：workspace（必填）、session | sessionId（可选，兼容两写法——幸存 compat-probe
 * 用 sessionId，dev-plan :306-307 输入列为 session）、mode（OQ-R5-4=A，缺省 summary）。
 */
function validateInput(input, forOp) {
  if (!input || typeof input !== 'object') {
    return { error: respond(false, 'JOURNEY_INVALID', { reason: '输入缺失或非对象（fail-closed，§3.3 输入形状违约）' }) };
  }
  if (isBlank(input.workspace) || typeof input.workspace !== 'string') {
    return { error: respond(false, 'JOURNEY_INVALID', { reason: 'workspace 缺失或非字符串（输入形状违约）' }) };
  }
  const session = input.sessionId !== undefined ? input.sessionId : input.session;
  if (session !== undefined && session !== null) {
    if (typeof session !== 'string' || !SESSION_RE.test(session)) {
      return { error: respond(false, 'JOURNEY_INVALID', {
        reason: 'session 非法：仅允许 [A-Za-z0-9_-]+（防路径穿越；白名单消费 [R4冻结] §2.1，§3.3）',
        session: String(session),
      }) };
    }
  }
  const mode = input.mode === undefined || input.mode === null ? 'summary' : input.mode;
  if (!PROJECTION_MODES.includes(mode)) {
    return { error: respond(false, 'JOURNEY_INVALID', {
      reason: 'mode 非法：projection mode 枚举 summary|full，缺省 summary（OQ-R5-4=A）',
    }) };
  }
  return { session: session ?? null, mode, workspace: input.workspace, forOp };
}

// ---------------------------------------------------------------------------
// 四类绑定源 gathering（§2.1；inline 直注优先，否则读 session 命名空间）
// ---------------------------------------------------------------------------

function sourceShell(kind, present, readable, pathLabel, sha, updatedAtMs, data, extra) {
  return Object.assign({
    kind, present, readable,
    problem: readable ? null : (extra && extra.problem) || '不可读',
    path: pathLabel,
    sha256: sha ?? null,
    updatedAtMs: updatedAtMs ?? null,
    data: data ?? null,
  }, extra ?? {});
}

/** state 源（A 面，phase/progress 维权威；v0/v1 形状兼容：{schema?, id, status, subtasks?}） */
function gatherState(layout, input, opts) {
  const nowMs = opts.nowMs;
  if (input.state !== undefined && input.state !== null) {
    const arr = Array.isArray(input.state) ? input.state : [input.state];
    for (const s of arr) {
      if (!s || typeof s !== 'object' || isBlank(s.id)) {
        return sourceShell('state', true, false, 'input:state', null, nowMs, null,
          { problem: 'inline state schema 违约：须为含字符串 id 的对象（§5.3 形状违约）', inline: true });
      }
    }
    const text = JSON.stringify(arr);
    return sourceShell('state', arr.length > 0, true, 'input:state', sha256Of(text), nowMs, arr, { inline: true });
  }
  const r = readJsonFile(layout.stateFile);
  if (!r.exists) return sourceShell('state', false, false, relWorkspace(opts.workspace, layout.stateFile), null, null, null);
  const pathLabel = relWorkspace(opts.workspace, layout.stateFile);
  if (r.problem) return sourceShell('state', true, false, pathLabel, null, null, null, { problem: 'state.json ' + r.problem });
  if (!r.data || typeof r.data !== 'object' || Array.isArray(r.data) || isBlank(r.data.id) || typeof r.data.id !== 'string') {
    return sourceShell('state', true, false, pathLabel, null, null, null,
      { problem: 'state.json schema 违约：须为含字符串 id 的对象（§5.3 形状违约）' });
  }
  const stat = fs.statSync(layout.stateFile);
  return sourceShell('state', true, true, pathLabel, sha256Of(r.raw), stat.mtimeMs, [r.data]);
}

/** receipt 记录校验 + 事件重放（C-R3 §3.4/§7；result 缓存与重放不一致 ⇒ 形状违约，fail-closed） */
function deriveReceiptResult(receipt) {
  const events = Array.isArray(receipt.events) ? receipt.events : [];
  if (events.length === 0) return null;
  const last = events[events.length - 1] || {};
  const t = last.transition;
  if (t === 'behavior_verified') return 'VERIFIED';
  if (t === 'verification_failed') return 'FAILED';
  if (t === 'unresolved' || t === 'not_consumed') return 'UNRESOLVED';
  return null;
}

function validateReceiptRecord(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return 'receipt 须为对象（C-R3 §3.4）';
  if (isBlank(rec.subtaskId) || typeof rec.subtaskId !== 'string') return 'receipt 缺 subtaskId（C-R3 §3.4）';
  if (!Array.isArray(rec.events)) return 'receipt.events 须为数组（append-only 事件链，C-R3 §7.6）';
  const derived = deriveReceiptResult(rec);
  if (Array.prototype.hasOwnProperty.call(rec, 'result') && rec.result !== undefined && rec.result !== derived) {
    return 'receipt.result 缓存与事件重放不一致（' + JSON.stringify(rec.result) + ' ≠ 重放 ' + JSON.stringify(derived) + '；C-R3 §3.4 fail-closed）';
  }
  return null;
}

/** receipts 源（资产消费维权威；C-R3 per-artifact：artifacts/<subtaskId>/receipt.json 事件数组） */
function gatherReceipts(layout, input, opts) {
  const nowMs = opts.nowMs;
  let records = [];
  let pathLabel = 'input:receipts';
  let inline = true;
  if (input.receipts !== undefined && input.receipts !== null) {
    if (Array.isArray(input.receipts)) records = input.receipts.slice();
    else if (typeof input.receipts === 'object') {
      records = Object.entries(input.receipts).map(([subtaskId, rec]) => Object.assign({ subtaskId }, rec));
    } else {
      return sourceShell('receipts', true, false, pathLabel, null, nowMs, null,
        { problem: 'inline receipts 形状违约：须为数组或 subtaskId 映射（§5.3）', inline: true, records: [] });
    }
  } else {
    inline = false;
    const found = [];
    let dirNames = [];
    try { dirNames = fs.readdirSync(layout.artifactsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { /* 无 artifacts 目录 → 源缺失 */ }
    for (const name of dirNames) {
      const file = path.join(layout.artifactsDir, name, 'receipt.json');
      const r = readJsonFile(file);
      if (!r.exists) continue;
      if (r.problem) {
        return sourceShell('receipts', true, false, relWorkspace(opts.workspace, file), null, null, null,
          { problem: 'receipt.json ' + r.problem + '（§5.3 不可解析）', inline: false, records: [] });
      }
      found.push({ rec: r.data, file, raw: r.raw });
    }
    records = found.map((f) => f.rec);
    pathLabel = null; // 逐记录具名
    const problems = [];
    const normalized = [];
    for (const f of found) {
      const problem = validateReceiptRecord(f.rec);
      if (problem) { problems.push(relWorkspace(opts.workspace, f.file) + ': ' + problem); continue; }
      normalized.push({
        record: f.rec,
        path: relWorkspace(opts.workspace, f.file),
        sha256: sha256Of(f.raw),
        updatedAtMs: fs.statSync(f.file).mtimeMs,
      });
    }
    if (problems.length > 0) {
      return sourceShell('receipts', true, false, layout.artifactsDir.replace(/\\/g, '/'), null, null, null,
        { problem: problems.join('; '), inline: false, records: [] });
    }
    return sourceShell('receipts', normalized.length > 0, true, null, null,
      normalized.reduce((m, n) => Math.max(m, n.updatedAtMs), 0) || null,
      normalized, { inline: false });
  }
  // inline 分支校验
  for (const rec of records) {
    const problem = validateReceiptRecord(rec);
    if (problem) {
      return sourceShell('receipts', true, false, pathLabel, null, nowMs, null,
        { problem, inline: true, records: [] });
    }
  }
  return sourceShell('receipts', records.length > 0, true, pathLabel, sha256Of(JSON.stringify(records)), nowMs,
    records.map((rec) => ({ record: rec, path: 'input:receipts/' + rec.subtaskId, sha256: null, updatedAtMs: toMs(rec.recordedAt ?? rec.updatedAt) ?? nowMs })),
    { inline: true });
}

/** logs 源（inferred-only 旁证；state-summary 须含 planId，result.txt 为纯证据行） */
function gatherLogs(layout, input, opts) {
  const nowMs = opts.nowMs;
  if (input.logs !== undefined && input.logs !== null) {
    if (!Array.isArray(input.logs)) {
      return sourceShell('logs', true, false, 'input:logs', null, nowMs, null,
        { problem: 'inline logs 形状违约：须为数组（§5.3）', inline: true, entries: [] });
    }
    for (const e of input.logs) {
      if (!e || typeof e !== 'object') {
        return sourceShell('logs', true, false, 'input:logs', null, nowMs, null,
          { problem: 'inline logs 行形状违约：须为对象（§5.3）', inline: true, entries: [] });
      }
    }
    return sourceShell('logs', input.logs.length > 0, true, 'input:logs', sha256Of(JSON.stringify(input.logs)), nowMs,
      input.logs.map((e) => ({ planId: e.planId ?? null, cluster: e.cluster ?? null, status: e.status ?? null, source: e.source ?? 'input:logs', kind: 'inline', updatedAtMs: toMs(e.at ?? e.updatedAt) ?? nowMs })),
      { inline: true });
  }
  const entries = [];
  let dirNames = [];
  try { dirNames = fs.readdirSync(layout.artifactsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { /* 无目录 → 源缺失 */ }
  for (const name of dirNames) {
    const dir = path.join(layout.artifactsDir, name);
    const ssFile = path.join(dir, 'state-summary.json');
    const r = readJsonFile(ssFile);
    if (r.exists) {
      const rel = relWorkspace(opts.workspace, ssFile);
      if (r.problem) {
        return sourceShell('logs', true, false, rel, null, null, null,
          { problem: 'state-summary.json ' + r.problem + '（§5.3 不可解析）', inline: false, entries: [] });
      }
      if (isBlank(r.data.planId) || typeof r.data.planId !== 'string') {
        return sourceShell('logs', true, false, rel, null, null, null,
          { problem: rel + ' schema 违约：state-summary 缺 planId（tt/state-summary@1）', inline: false, entries: [] });
      }
      entries.push({
        planId: r.data.planId, cluster: r.data.cluster ?? null, status: r.data.status ?? null,
        source: rel, kind: 'state-summary',
        sha256: sha256Of(r.raw),
        updatedAtMs: fs.statSync(ssFile).mtimeMs,
      });
    }
    const rtFile = path.join(dir, 'result.txt');
    if (fs.existsSync(rtFile)) {
      const st = fs.statSync(rtFile);
      entries.push({
        planId: null, cluster: null, status: null,
        source: relWorkspace(opts.workspace, rtFile), kind: 'result.txt',
        sha256: sha256Of(fs.readFileSync(rtFile)),
        updatedAtMs: st.mtimeMs,
      });
    }
  }
  return sourceShell('logs', entries.length > 0, true, null, null,
    entries.reduce((m, e) => Math.max(m, e.updatedAtMs), 0) || null, entries, { inline: false });
}

/** journey.json 记录（read 主对象 / project 的 B 面 gates 置位记录源） */
function gatherJourneyRecord(layout, opts) {
  const r = readJsonFile(layout.journeyFile);
  const pathLabel = relWorkspace(opts.workspace, layout.journeyFile);
  if (!r.exists) return { kind: 'journey', present: false, readable: false, problem: null, path: pathLabel, sha256: null, updatedAtMs: null, data: null };
  if (r.problem) return { kind: 'journey', present: true, readable: false, problem: 'journey.json ' + r.problem, path: pathLabel, sha256: null, updatedAtMs: null, data: null };
  if (!r.data || typeof r.data !== 'object' || !Array.isArray(r.data.steps)) {
    return { kind: 'journey', present: true, readable: false, problem: 'journey.json 形状畸形：steps 须为数组（yy/journey@1）', path: pathLabel, sha256: null, updatedAtMs: null, data: null };
  }
  const updatedAtMs = toMs(r.data.updated_at) ?? fs.statSync(layout.journeyFile).mtimeMs;
  return { kind: 'journey', present: true, readable: true, problem: null, path: pathLabel, sha256: sha256Of(r.raw), updatedAtMs, data: r.data };
}

// ---------------------------------------------------------------------------
// 投影计算核心（§3 诚实投影 / §4 evidence + nextPrompt）
// ---------------------------------------------------------------------------

function blankSteps() {
  return STEPS.map((s) => ({ step: s.step, name: s.name, status: 'pending', displayStatus: undefined, gate: s.gate, gates_passed: [], artifacts: [], updated_at: null }));
}

/** 记录 steps 归一（兼容 tt-journey ensureSteps 语义：缺节点补 pending，非法 status 落 pending） */
function normalizeRecordSteps(recordSteps) {
  const byStep = new Map((recordSteps || []).map((s) => [Number(s && s.step), s]));
  return blankSteps().map((base) => {
    const ex = byStep.get(base.step);
    if (!ex) return base;
    const valid = ['pending', 'in_progress', 'done'];
    return Object.assign(base, {
      status: valid.includes(ex.status) ? ex.status : 'pending',
      displayStatus: typeof ex.displayStatus === 'string' ? ex.displayStatus : undefined,
      blockerReason: typeof ex.blockerReason === 'string' ? ex.blockerReason : undefined,
      recordStatus: valid.includes(ex.status) ? ex.status : 'pending',
      gates_passed: Array.isArray(ex.gates_passed) ? ex.gates_passed.slice() : [],
      artifacts: Array.isArray(ex.artifacts) ? ex.artifacts.slice() : [],
      updated_at: ex.updated_at ?? null,
    });
  });
}

/** 当前/下一阶段（tt-journey currentAndNext 同构，FORWARD_LINE 正向主干） */
function currentAndNext(steps) {
  const inProgress = steps.find((s) => s.status === 'in_progress');
  const pendingAll = steps.filter((s) => s.status !== 'done');
  const current = inProgress || pendingAll[0] || null;
  let next = null;
  if (current) {
    const ci = FORWARD_LINE.indexOf(current.step);
    if (ci >= 0) {
      for (let i = ci + 1; i < FORWARD_LINE.length; i += 1) {
        const cand = steps[FORWARD_LINE[i]];
        if (cand.status !== 'done') { next = cand; break; }
      }
    }
  }
  return { current, next };
}

/** 组级聚合取最坏态（OQ-R5-8=A）：全 AUTHORIZED 才 done；任一负向 ⇒ 组不得显示完成 */
function rollupGroup(members) {
  if (!members || members.length === 0) return { status: 'pending', displayStatus: undefined, worst: null };
  let worst = members[0].displayStatus;
  let allAuthorized = true;
  let anyActive = false;
  for (const m of members) {
    worst = worstOf(worst, m.displayStatus);
    if (m.displayStatus !== 'AUTHORIZED') allAuthorized = false;
    if (ACTIVE_STATUSES.includes(m.status)) anyActive = true;
  }
  if (allAuthorized) return { status: 'done', displayStatus: members[0].provenance === 'inferred' ? 'INFERRED' : 'AUTHORIZED', worst };
  if (isNegative(worst)) return { status: 'pending', displayStatus: worst, worst };
  if (anyActive) return { status: 'in_progress', displayStatus: 'OBSERVED', worst };
  return { status: 'pending', displayStatus: undefined, worst };
}

/**
 * 相对 STALE 判据（OQ-R5-2=A）：在可用权威时点（journey 记录 / state / receipts 最新）中，
 * 最老者落后于最新者 ⇒ STALE（不引入墙钟数值）。
 */
function computeStale(sources) {
  const points = [];
  if (sources.journey.present && sources.journey.readable && sources.journey.updatedAtMs != null) {
    points.push({ name: 'journey', updatedAtMs: sources.journey.updatedAtMs, path: sources.journey.path });
  }
  if (sources.state.present && sources.state.readable && sources.state.updatedAtMs != null) {
    points.push({ name: 'state', updatedAtMs: sources.state.updatedAtMs, path: sources.state.path });
  }
  if (sources.receipts.present && sources.receipts.readable && sources.receipts.updatedAtMs != null) {
    points.push({ name: 'receipts', updatedAtMs: sources.receipts.updatedAtMs, path: (sources.receipts.data || []).map((n) => n.path).join(', ') || 'receipts' });
  }
  if (points.length < 2) return null;
  let newest = points[0];
  let oldest = points[0];
  for (const p of points) {
    if (p.updatedAtMs > newest.updatedAtMs) newest = p;
    if (p.updatedAtMs < oldest.updatedAtMs) oldest = p;
  }
  if (oldest.updatedAtMs < newest.updatedAtMs) {
    return {
      reason: oldest.name + ' 时点（' + toIso(oldest.updatedAtMs) + '）落后于 ' + newest.name + ' 最新时点（' + toIso(newest.updatedAtMs) + '）（相对判据 OQ-R5-2=A，无墙钟）',
      lagging: { source: oldest.name, path: oldest.path, updatedAt: toIso(oldest.updatedAtMs) },
      latest: { source: newest.name, path: newest.path, updatedAt: toIso(newest.updatedAtMs) },
      // journey 记录本身落后 ⇒ read 的 JOURNEY_STALE 错误码语义（§5.1 "journey 过期"）；
      // 上游权威源互相落后 ⇒ 仅可见 STALE 展示态 + reason（不误触发 read 的码，§1.2 不新增码）
      journeyLagging: oldest.name === 'journey',
    };
  }
  return null;
}

/** evidence link（OQ-R5-6=A 形状：{sourceKind, path, sha256, updatedAt, sessionId}；logs 加 inferred:true） */
function toEvidenceLink(kind, pathLabel, sha, updatedAtMs, sessionId, inferred) {
  const link = {
    sourceKind: kind,
    path: pathLabel,
    sha256: sha ?? null,
    updatedAt: updatedAtMs != null ? toIso(updatedAtMs) : null,
    sessionId: sessionId ?? null,
  };
  if (inferred) link.inferred = true; // §4.1：logs 作为 evidence 必须标 inferred
  return link;
}

/**
 * 投影计算核心。
 * 入参经 gather* 归一；输出 { body, displayStatus, stale, missingNotes, errorSources, conflicts, links, warnings }。
 */
function computeProjection(ctx) {
  const { layout, mode, opts, sources } = ctx;
  const warnings = [];
  const conflicts = [];
  const missingNotes = [];
  const errorSources = [];

  for (const kind of ['state', 'receipts', 'logs']) {
    const s = sources[kind];
    if (s.present && !s.readable) {
      errorSources.push({ sourceKind: kind, path: s.path || s.kind, problem: s.problem });
    }
    if (!s.present) {
      missingNotes.push(kind + '（' + (kind === 'state'
        ? relWorkspace(opts.workspace, layout.stateFile)
        : kind === 'receipts'
          ? relWorkspace(opts.workspace, path.join(layout.artifactsDir, '<subtaskId>', 'receipt.json'))
          : relWorkspace(opts.workspace, layout.artifactsDir)) + ' 无匹配）');
    }
  }

  const record = sources.journey;
  const stale = computeStale(sources);

  // ── 计划/子任务执行成员（plans/subtasks 行 + 逐成员 receipt 最坏归并，OQ-R5-8）──
  const plans = [];
  const subtasks = [];
  const assets = [];
  const inferredSourceLabels = [];
  const members = [];

  const receiptsBySub = new Map();
  if (sources.receipts.readable) {
    for (const n of sources.receipts.data || []) {
      const rec = n.record;
      const result = deriveReceiptResult(rec) ?? (rec.result ?? null);
      const display = result === 'VERIFIED' ? 'AUTHORIZED' : (result === 'FAILED' ? 'FAILED' : (result === 'UNRESOLVED' ? 'UNRESOLVED' : 'PARTIAL'));
      const row = {
        subtaskId: rec.subtaskId,
        assetId: rec.assetId ?? null,
        result: result ?? null,
        displayStatus: result ? display : 'UNRESOLVED', // 事件链未到终态 ⇒ 未决，不升格
        receiptPath: n.path,
        updatedAt: n.updatedAtMs != null ? toIso(n.updatedAtMs) : null,
        sessionId: layout.sessionId,
      };
      assets.push(row);
      const prev = receiptsBySub.get(rec.subtaskId);
      if (prev && prev.result && row.result && prev.result !== row.result) {
        // 同一 subtaskId 两份 receipt 终态矛盾且不可归并 ⇒ 节点级冲突（OQ-R5-7=A）
        conflicts.push({
          node: 'assets.' + rec.subtaskId,
          dimension: '资产 verified 维',
          sides: [
            { sourceKind: 'receipts', path: prev.path, sha256: prev.sha256, updatedAt: prev.updatedAtMs != null ? toIso(prev.updatedAtMs) : null, value: prev.result },
            { sourceKind: 'receipts', path: row.receiptPath, sha256: n.sha256, updatedAt: row.updatedAt, value: row.result },
          ],
        });
      }
      if (!prev || (row.result && !prev.result)) receiptsBySub.set(rec.subtaskId, { result: row.result, path: row.receiptPath, sha256: n.sha256, updatedAtMs: n.updatedAtMs });
    }
  }

  const stateReadable = sources.state.readable;
  const stateRows = stateReadable ? (sources.state.data || []) : [];
  let seenSubIds = new Map();
  for (const st of stateRows) {
    plans.push({
      planId: st.id, cluster: st.cluster ?? null, status: st.status ?? 'unknown',
      displayStatus: STATUS_TO_DISPLAY[st.status] ?? 'UNRESOLVED',
      summaryPath: sources.state.inline ? 'input:state' : sources.state.path,
      updatedAt: sources.state.updatedAtMs != null ? toIso(sources.state.updatedAtMs) : null,
      inferred: false,
    });
    members.push({ displayStatus: STATUS_TO_DISPLAY[st.status] ?? 'UNRESOLVED', status: st.status ?? 'pending', provenance: 'state' });
    for (const sub of Array.isArray(st.subtasks) ? st.subtasks : []) {
      if (!sub || isBlank(sub.id)) continue;
      if (seenSubIds.has(sub.id) && seenSubIds.get(sub.id) !== (sub.status ?? 'unknown')) {
        // 同一 subtask 权威状态在 state 内自相矛盾 ⇒ 节点级冲突（OQ-R5-7=A）
        conflicts.push({
          node: 'state.' + sub.id,
          dimension: 'phase/progress 维',
          sides: [
            { sourceKind: 'state', path: sources.state.path, sha256: sources.state.sha256, updatedAt: sources.state.updatedAtMs != null ? toIso(sources.state.updatedAtMs) : null, value: seenSubIds.get(sub.id) },
            { sourceKind: 'state', path: sources.state.path, sha256: sources.state.sha256, updatedAt: sources.state.updatedAtMs != null ? toIso(sources.state.updatedAtMs) : null, value: sub.status ?? 'unknown' },
          ],
        });
      }
      seenSubIds.set(sub.id, sub.status ?? 'unknown');
      const display = STATUS_TO_DISPLAY[sub.status] ?? 'UNRESOLVED';
      const rcpt = receiptsBySub.get(sub.id);
      let memberDisplay = display;
      let memberStatus = sub.status ?? 'pending';
      if (rcpt && rcpt.result && rcpt.result !== 'VERIFIED') {
        // 子任务资产维负向（FAILED/UNRESOLVED）⇒ 成员取最坏，组不得显示完成（OQ-R5-8）
        memberDisplay = worstOf(memberDisplay, rcpt.result === 'FAILED' ? 'FAILED' : 'UNRESOLVED');
        if (memberDisplay !== STATUS_TO_DISPLAY[sub.status]) memberStatus = 'pending';
        warnings.push('DISCREPANCY: subtask ' + sub.id + ' state 维=' + (sub.status ?? 'unknown') + ' vs receipts 维=' + rcpt.result + '（分维如实投影互不覆盖 + 组级取最坏，OQ-R5-1/OQ-R5-8）');
      } else if (!rcpt && sub.status === 'done') {
        // done 子任务缺 receipt ⇒ 资产维未决（C-R3 P1 地板），不升格完成
        memberDisplay = 'UNRESOLVED';
        memberStatus = 'pending';
        warnings.push('DISCREPANCY: subtask ' + sub.id + ' state=done 但 receipt 缺失（资产维 UNRESOLVED，C-R3 §7.4 P1；组级取最坏 OQ-R5-8）');
      }
      subtasks.push({
        subtaskId: sub.id, asset: sub.asset ?? null, status: sub.status ?? 'unknown',
        displayStatus: memberDisplay, receipt: rcpt ? rcpt.path : null,
      });
      members.push({ displayStatus: memberDisplay, status: memberStatus, provenance: 'state' });
    }
  }

  const logsReadable = sources.logs.readable;
  const logRows = logsReadable ? (sources.logs.data || []) : [];
  for (const e of logRows) {
    if (e.kind === 'result.txt') { inferredSourceLabels.push(e.source); continue; } // 纯证据行，无进度声明
    inferredSourceLabels.push(e.source);
    const display = e.status == null ? 'PARTIAL' : (STATUS_TO_DISPLAY[e.status] ?? 'UNRESOLVED');
    plans.push({
      planId: e.planId, cluster: e.cluster ?? null, status: e.status ?? 'unknown',
      displayStatus: display === 'AUTHORIZED' ? 'INFERRED' : display, // logs 推导永不授权/升格（OQ-R5-3）
      summaryPath: e.source, updatedAt: e.updatedAtMs != null ? toIso(e.updatedAtMs) : null,
      inferred: true,
    });
    members.push({ displayStatus: display, status: e.status ?? 'pending', provenance: 'inferred' });
    // 同 planId 的 logs 旁证与 state 权威矛盾 ⇒ discrepancy warning（OQ-R5-1：各维如实双列，不覆盖）
    const stateRow = stateRows.find((st) => st.id === e.planId);
    if (stateRow && e.status != null && stateRow.status !== e.status) {
      warnings.push('DISCREPANCY: plan ' + e.planId + ' state 维=' + (stateRow.status ?? 'unknown') + ' vs logs 旁证=' + e.status
        + '（source: ' + e.source + '；inferred 旁证不升格、不否决权威维，OQ-R5-1/OQ-R5-3）');
    }
  }

  // ── step7（并行派单）诚实归并（修 D-2：非"有源即 done"）──
  // OQ-R5-1 分维互不覆盖：组级聚合只由权威成员（state/receipt 归并）投票；
  // 仅当无权威成员时才由 inferred 旁证成员推导（GWT2 整图 INFERRED 场景）。
  // logs 旁证永不升格完成，也不越权否决权威成员（矛盾 → discrepancy warning 双列）。
  const derived = record.readable ? normalizeRecordSteps(record.data.steps) : blankSteps();
  const step7 = derived[7];
  const authMembers = members.filter((m) => m.provenance === 'state');
  const inferredMembers = members.filter((m) => m.provenance === 'inferred');
  const roll = rollupGroup(authMembers.length > 0 ? authMembers : inferredMembers);
  if (!record.readable) {
    // 派生路径：组级聚合直接决定 step7（全 AUTHORIZED 才 done）
    step7.status = roll.status;
    step7.displayStatus = roll.displayStatus;
    if (roll.displayStatus === 'INFERRED') step7.displayStatus = 'INFERRED';
    step7.updated_at = roll.status === 'pending' && members.length === 0 ? null : opts.nowIso;
  } else if (isNegative(roll.worst)) {
    // 记录在场但执行源负向 ⇒ §3.2 不变量：不得显示为 done（记录原值留 recordStatus，警告双列）
    if (step7.status === 'done') {
      step7.recordStatus = 'done';
      step7.status = 'pending';
      step7.blockerReason = 'B 面记录 done 但执行源存在 ' + roll.worst + '（组级取最坏态 OQ-R5-8；原记录见 recordStatus）';
      warnings.push('DISCREPANCY: journey.json step7 记录 done，但 plan/subtask 源存在 ' + roll.worst + '（§3.2 不变量：负向不得显示完成；两维如实双列不覆盖）');
    }
    step7.displayStatus = roll.worst;
  }

  // ── 其余节点：记录在场原样展示（B 面 gate/step 权威，§2.3）；gate 置位 → authorized（OQ-R5-3）──
  const steps = derived.map((s) => {
    const row = {
      step: s.step, name: s.name, status: s.status,
      gate: STEPS[s.step].gate,
      gates_passed: s.gates_passed || [],
      artifacts: s.artifacts || [],
      updated_at: s.updated_at ?? null,
    };
    if (s.displayStatus !== undefined) row.displayStatus = s.displayStatus;
    if (s.blockerReason !== undefined) row.blockerReason = s.blockerReason;
    if (s.recordStatus !== undefined && s.recordStatus !== s.status) row.recordStatus = s.recordStatus;
    if (row.displayStatus === undefined && s.status === 'done') row.displayStatus = 'AUTHORIZED';
    if (row.displayStatus === undefined && s.status === 'in_progress') row.displayStatus = 'OBSERVED';
    return row;
  });

  const { current, next } = currentAndNext(steps);

  // ── gates：B 面置位记录原样（GATE_VOCAB 内），pending = 词表余集 ──
  const passed = [];
  for (const s of steps) for (const g of s.gates_passed) if (GATE_VOCAB.includes(g) && !passed.includes(g)) passed.push(g);
  const gates = { passed, pending: GATE_VOCAB.filter((g) => !passed.includes(g)) };
  if (!record.readable && record.present) warnings.push('journey.json 不可读（' + record.problem + '）：gates 置位记录不可用，全部按 pending 投影');

  // ── 展示态判定（优先级：ERROR > STALE > INFERRED > PARTIAL > AUTHORIZED/OBSERVED；见文件头登记）──
  const stateMissing = !sources.state.present || !stateReadable;
  const isInferredOnly = !record.readable && stateMissing && logRows.length > 0;
  const missingSources = ['state', 'receipts', 'logs'].filter((k) => !sources[k].present);
  let displayStatus;
  const reasonParts = [];
  if (conflicts.length > 0) {
    displayStatus = 'ERROR';
    reasonParts.push('同维权威字段矛盾且不可归并（节点级 ' + conflicts.length + ' 处，OQ-R5-7）');
  } else if (errorSources.length > 0 && ctx.op !== 'journey.read') {
    // project 路径已在 journeyProject 前置短路为 PROJECTION_SOURCE_INVALID；此分支为防御兜底
    displayStatus = 'ERROR';
    reasonParts.push('权威源畸形/违约: ' + errorSources.map((e) => e.sourceKind + '（' + e.problem + '）').join('; '));
  } else if (errorSources.length > 0) {
    // read 无 PROJECTION_* 错误码（§1.2 不新增码）：不可读/不可解析按 PARTIAL 判据落地（OQ-R5-2=A
    // "PARTIAL = 任一绑定源缺失（含不可读/不可解析）"），reason 具名畸形源
    displayStatus = 'PARTIAL';
    reasonParts.push('绑定源畸形/不可读: ' + errorSources.map((e) => e.sourceKind + '（' + e.problem + '）').join('; '));
  } else if (stale) {
    displayStatus = 'STALE';
    reasonParts.push(stale.reason);
  } else if (isInferredOnly) {
    displayStatus = 'INFERRED';
    reasonParts.push('INFERRED: state 权威源缺失，仅 logs/state-summary 旁证（source: ' + inferredSourceLabels.join(', ') + '）；不写 Journey、不授权派单');
    if (missingSources.length > 0) reasonParts.push('另缺绑定源: ' + missingSources.join(', '));
  } else if (missingSources.length > 0) {
    displayStatus = 'PARTIAL';
    reasonParts.push('PARTIAL: 绑定源缺失: ' + missingSources.join(', ') + '；已投影部分带缺项说明（OQ-R5-2=A）');
  } else {
    const doneSubs = subtasks.filter((s) => s.status === 'done');
    const corroborated = doneSubs.every((s) => {
      const a = assets.find((x) => x.subtaskId === s.subtaskId);
      return a && a.result === 'VERIFIED';
    });
    displayStatus = doneSubs.length > 0 && !corroborated ? 'OBSERVED' : 'AUTHORIZED';
    reasonParts.push('四源齐备：phase/progress 以 state 为权威、资产维以 receipts 为权威（OQ-R5-1=A）');
  }
  if (missingNotes.length > 0 && displayStatus !== 'PARTIAL' && displayStatus !== 'INFERRED') {
    for (const n of missingNotes) warnings.push('PARTIAL 缺项说明: ' + n);
  }

  const phaseAuthoritative = stateReadable;
  const stepsDone = steps.filter((s) => s.status === 'done').length;
  const progress = {
    stepsDone,
    stepsTotal: steps.length,
    percent: Math.round((stepsDone / steps.length) * 100),
    subtasksDone: subtasks.filter((s) => s.status === 'done').length,
    subtasksTotal: subtasks.length,
    planStatus: stateRows.length === 1 ? (stateRows[0].status ?? null) : null,
  };

  // ── evidence links（OQ-R5-6=A；与 R8 sourceAnchor 同构）──
  const links = [];
  if (record.readable) links.push(toEvidenceLink('gates', record.path, record.sha256, record.updatedAtMs, layout.sessionId, false));
  if (stateReadable) links.push(toEvidenceLink('state', sources.state.path, sources.state.sha256, sources.state.updatedAtMs, layout.sessionId, false));
  if (sources.receipts.readable) {
    for (const n of sources.receipts.data || []) links.push(toEvidenceLink('receipts', n.path, n.sha256, n.updatedAtMs, layout.sessionId, false));
  }
  if (logsReadable) {
    for (const e of logRows) links.push(toEvidenceLink('logs', e.source, e.sha256 ?? null, e.updatedAtMs, layout.sessionId, true));
  }
  for (const e of errorSources) links.push(toEvidenceLink(e.sourceKind === 'state' ? 'state' : (e.sourceKind === 'receipts' ? 'receipts' : 'logs'), e.path, null, null, layout.sessionId, false));

  // ── nextPrompt（OQ-R5-5=A；由当前投影数据派生，禁 SAMPLE）──
  const target = next || current;
  const requiredInputs = [];
  if (target) {
    const unmet = prereqUnmet(steps, target.step);
    for (const u of unmet) requiredInputs.push(u);
    if (target.gate && !gates.passed.includes(target.gate)) requiredInputs.push('gate:' + target.gate);
  }
  for (const k of missingSources) requiredInputs.push('source:' + k);
  if (roll.worst && isNegative(roll.worst)) requiredInputs.push('blocker:' + roll.worst);
  const actionHint = !target
    ? '闭环 9 节点全部完成：无下一阶段（仅复核/批判反哺）。本投影不授权任何推进。'
    : '推进节点 ' + target.step + ' ' + target.name + (target.gate ? '（需 gate: ' + target.gate + '）' : '')
      + '——前置机验通过后经 tt-journey --update 记录；本投影为只读视图，不授权推进、不派单。';

  const body = {
    schema: JOURNEY_SCHEMA,
    generatedBy: ctx.op === 'journey.read' ? 'journey.read' : 'journey.project',
    displayStatus,
    displayReason: reasonParts.join('；'),
    phase: current ? { step: current.step, name: current.name, status: current.status } : null,
    phaseAuthoritative,
    progress,
    current: current ? { step: current.step, name: current.name, status: current.status, gate: current.gate } : null,
    next: next ? { step: next.step, name: next.name, status: next.status, gate: next.gate } : null,
    gates,
    steps,
    nextPrompt: {
      actionHint,
      targetNode: target ? { step: target.step, name: target.name } : null,
      requiredInputs,
      snapshotHash: null, // 下方以投影快照哈希回声回填（OQ-R5-5=A）
      snapshotRef: null,
    },
    updated_at: opts.nowIso,
  };

  if (mode === 'full') {
    body.plans = plans;
    body.subtasks = subtasks;
    body.assets = assets;
    body.evidence = links;
    body.evidenceCount = links.length;
    if (isInferredOnly || inferredSourceLabels.length > 0) body.inferredSources = inferredSourceLabels;
  }

  // 快照哈希回声：对不含哈希本身的投影体做 sha256（确定性，禁 SAMPLE）
  const snapshotHash = sha256Of(JSON.stringify(body));
  body.nextPrompt.snapshotHash = snapshotHash;
  body.projectionHash = snapshotHash;

  return { body, displayStatus, stale, missingNotes, errorSources, conflicts, links, warnings, missingSources };
}

/** 前置门只读判定（PREREQ_MAP 消费；返回未满足项描述数组，不推进任何状态） */
function prereqUnmet(steps, n) {
  const deps = PREREQ_MAP[n];
  if (!deps || deps.length === 0) return [];
  const unmet = [];
  for (const dep of deps) {
    const node = steps[dep.step];
    const done = node && (node.status === 'done' || (dep.inProgressOk && node.status === 'in_progress'));
    if (!done) unmet.push('step:' + dep.step + '（status=' + (node ? node.status : '缺失') + (dep.gate ? '，缺 gate: ' + dep.gate : '') + '）');
    else if (dep.gate && !(node.gates_passed || []).includes(dep.gate)) unmet.push('gate:' + dep.gate + '（step ' + dep.step + ' 未过）');
  }
  return unmet;
}

// ---------------------------------------------------------------------------
// 落盘（OQ-R5-10=A 唯一 projection writer；additive 合并，保 B 面置位记录与 __manual__ 留痕）
// ---------------------------------------------------------------------------

function writerMode(opts) {
  const env = (process.env.YY_JOURNEY_WRITER || '').trim().toLowerCase();
  if (env === 'legacy') return 'legacy';
  if (opts && opts.writerMode) return opts.writerMode === 'legacy' ? 'legacy' : 'projection';
  return 'projection'; // 未设 = MW0 双写窗口：journey.project 为 projection writer（OQ-R5-10=A）
}

function persistProjection(layout, computed, record, opts) {
  // additive 合并：steps 用投影体（含 gates_passed/artifacts 原值与诚实聚合 status）；
  // plans 保留记录中 __manual__/prereq-bypassed 留痕行（[R4冻结] §5.1 投影面留痕，原样消费）。
  const manualRows = (record.readable && Array.isArray(record.data.plans))
    ? record.data.plans.filter((p) => p && p.planId === '__manual__') : [];
  const doc = {
    schema: JOURNEY_SCHEMA,
    steps: computed.body.steps,
    plans: [...manualRows, ...(computed.body.plans || [])],
    updated_at: computed.body.updated_at,
    // additive 投影字段（投影展示态非 A/B 面状态名，§3.1）
    displayStatus: computed.body.displayStatus,
    displayReason: computed.body.displayReason,
    phase: computed.body.phase,
    phaseAuthoritative: computed.body.phaseAuthoritative,
    progress: computed.body.progress,
    gates: computed.body.gates,
    nextPrompt: computed.body.nextPrompt,
    projectionHash: computed.body.projectionHash,
    generatedBy: 'journey.project',
  };
  fs.mkdirSync(layout.base, { recursive: true });
  fs.writeFileSync(layout.journeyFile, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  return layout.journeyFile;
}

// ---------------------------------------------------------------------------
// journey.read（§5.1：读已存在 Journey/投影，按 mode 渲染；只读）
// ---------------------------------------------------------------------------

/**
 * journey.read
 * 输入 input: { workspace, session|sessionId?, mode?, opts? }
 * 输出：统一壳。data.journey = 投影体；JOURNEY_NOT_FOUND 走 data 通道（§8.1，见文件头登记）；
 * JOURNEY_STALE 时 data 仍携带 journey 投影体 + data.stale（幸存 render-core 消费口径）。
 */
export function journeyRead(input) {
  const v = validateInput(input, 'journey.read');
  if (v.error) return v.error;
  const opts = input.opts ?? {};
  const now = opts.now ?? new Date();
  const nowMs = now instanceof Date ? now.getTime() : toMs(now);
  const nowIso = toIso(nowMs);
  const layout = resolveLayout(v.workspace, v.session);
  const warnings = [];
  const warningsBase = [];

  const record = gatherJourneyRecord(layout, { workspace: v.workspace });
  if (record.present && !record.readable) {
    // journey 形状畸形 / JSON 畸形 ⇒ fail-closed 不渲染成功（§5.3 JOURNEY_INVALID）
    return respond(false, 'JOURNEY_INVALID', {
      reason: record.problem,
      journey: { path: record.path },
    }, buildEvidenceShell(v, layout, nowIso, []), warningsBase);
  }

  const sources = {
    state: gatherState(layout, input, { nowMs, workspace: v.workspace }),
    receipts: gatherReceipts(layout, input, { nowMs, workspace: v.workspace }),
    logs: gatherLogs(layout, input, { nowMs, workspace: v.workspace }),
    journey: record,
  };

  // JOURNEY_NOT_FOUND：无 journey 文件且无可推断源（state 文件缺席且 logs 空）
  const hasInferable = sources.state.present || sources.logs.present;
  if (!record.present && !hasInferable) {
    warnings.push('C-R5 §8.1 非 OQ 残留 [待补充]: JOURNEY_NOT_FOUND 通道归属等 Owner 复核——本实现沿 R3 "正常决策进 data" 惯例与幸存消费面（render-core/compat-probe）走 data 通道');
    return respond(false, 'JOURNEY_NOT_FOUND', {
      journey: {
        reason: '无 journey 文件且无可推断源（state.json / state-summary / logs 均缺席）',
        schema: JOURNEY_SCHEMA,
        searchedPaths: [record.path, sources.state.path],
        initGuidance: '初始化：node scripts/orchestrator.mjs --task "<任务>" --plan，或 node scripts/tt-journey.mjs --workspace <目录> --update --step 0',
      },
    }, buildEvidenceShell(v, layout, nowIso, []), warnings);
  }

  const computed = computeProjection({
    op: 'journey.read', layout, mode: v.mode, opts: { nowIso, nowMs, workspace: v.workspace }, sources,
  });
  warnings.push(...computed.warnings);
  if (computed.displayStatus === 'INFERRED') {
    warnings.push('INFERRED: 推断结果只渲染不落盘、不授权派单（dev-plan R5a GWT2）');
  }
  if (computed.displayStatus === 'ERROR') {
    // PROJECTION_CONFLICT 属 journey.project 错误码（§1.2 不新增码）；read 以 ERROR 展示态 + reason 呈现
    warnings.push('ERROR: 多源冲突未解——节点级双方 evidence 见 journey.project 的 data.conflicts（read 不新增错误码，§1.2）');
  }
  for (const k of computed.missingSources) warnings.push('PARTIAL 缺项说明: 绑定源 ' + k + ' 缺失（OQ-R5-2=A）');

  const evidence = buildEvidenceShell(v, layout, nowIso, computed.links);

  if (computed.stale && computed.stale.journeyLagging) {
    // journey 记录落后于权威源最新时点 ⇒ read 码通道（ok=false），data 仍携带投影体 + stale 信息
    return respond(false, 'JOURNEY_STALE', {
      journey: computed.body,
      stale: computed.stale,
    }, evidence, warnings);
  }
  if (computed.stale) {
    // 上游源互相落后（journey 不是落后方）⇒ 可见 STALE 展示态随 data 投影体呈现（OQ-R5-2=A），
    // 不占用 read 错误码（journey 本身未过期）
    warnings.push('STALE: ' + computed.stale.reason + '（journey 记录非落后方，不触发 JOURNEY_STALE 码）');
  }
  return respond(true, null, { journey: computed.body, mode: v.mode, session: layout.sessionId }, evidence, warnings);
}

function buildEvidenceShell(v, layout, nowIso, links) {
  // shell.evidence = 对象（契约 §5 示例）；sources = OQ-R5-6 links 数组（时点/身份回声）
  return {
    op: v.forOp,
    session: layout.sessionId,
    generatedAt: nowIso,
    sources: links ?? [],
  };
}

// ---------------------------------------------------------------------------
// journey.project（§5.2：从 state+receipts+logs+session 重算一次投影；只读权威源，不授权转换）
// ---------------------------------------------------------------------------

/**
 * journey.project
 * 输入 input: { workspace, session|sessionId?, state?, receipts?, logs?, mode?, opts? }
 *   - state/receipts/logs：四键逐字沿用 dev-plan :307 输入列。缺席时从 session 命名空间读取
 *     （OQ-R5-9 布局）；给出时作为 inline 权威源直注（探针/宿主直连用，形状违约 → PROJECTION_SOURCE_INVALID）。
 * 输出：统一壳。data.projection = 投影体；PROJECTION_CONFLICT 时 data.conflicts =
 *   节点级冲突双方 evidence（OQ-R5-7=A），projection.displayStatus=ERROR 仍随附（不静默选一边）。
 */
export function journeyProject(input) {
  const v = validateInput(input, 'journey.project');
  if (v.error) return v.error;
  const opts = input.opts ?? {};
  const now = opts.now ?? new Date();
  const nowMs = now instanceof Date ? now.getTime() : toMs(now);
  const nowIso = toIso(nowMs);
  const layout = resolveLayout(v.workspace, v.session);
  const warnings = [];

  const record = gatherJourneyRecord(layout, { workspace: v.workspace });
  const sources = {
    state: gatherState(layout, input, { nowMs, workspace: v.workspace }),
    receipts: gatherReceipts(layout, input, { nowMs, workspace: v.workspace }),
    logs: gatherLogs(layout, input, { nowMs, workspace: v.workspace }),
    journey: record,
  };

  // 源畸形/不可解析/schema 违约 ⇒ PROJECTION_SOURCE_INVALID（§5.3，fail-closed 不渲染成功）
  const bad = ['state', 'receipts', 'logs'].filter((k) => sources[k].present && !sources[k].readable);
  if (bad.length > 0) {
    return respond(false, 'PROJECTION_SOURCE_INVALID', {
      reason: bad.map((k) => k + ': ' + sources[k].problem).join('; '),
      sources: bad.map((k) => ({ sourceKind: k, path: sources[k].path, problem: sources[k].problem })),
    }, buildEvidenceShell(v, layout, nowIso, []), warnings);
  }

  const computed = computeProjection({
    op: 'journey.project', layout, mode: v.mode, opts: { nowIso, nowMs, workspace: v.workspace }, sources,
  });
  warnings.push(...computed.warnings);
  if (computed.displayStatus === 'INFERRED') warnings.push('INFERRED: 仅旁证投影，不落盘、不授权派单（§4.3）');
  for (const k of computed.missingSources) warnings.push('PARTIAL 缺项说明: 绑定源 ' + k + ' 缺失（OQ-R5-2=A）');

  const evidence = buildEvidenceShell(v, layout, nowIso, computed.links);

  // PROJECTION_CONFLICT：节点级双方 evidence，不静默选一边渲染成成功（OQ-R5-7=A / GWT-R5A-02）
  if (computed.conflicts.length > 0) {
    computed.body.displayReason = '节点级冲突 ' + computed.conflicts.length + ' 处：同维权威字段矛盾且按 OQ-R5-1 分维归并仍不可并（双方 evidence 见 data.conflicts）';
    return respond(false, 'PROJECTION_CONFLICT', {
      projection: computed.body,
      conflicts: computed.conflicts,
    }, evidence, warnings);
  }

  // 唯一 projection writer（OQ-R5-10=A）：仅 projection 模式 + 健康展示态落盘（§4.3）
  let persisted = null;
  if (writerMode(opts) === 'projection' && (computed.displayStatus === 'AUTHORIZED' || computed.displayStatus === 'OBSERVED')) {
    try {
      persisted = relWorkspace(v.workspace, persistProjection(layout, computed, record, opts));
      evidence.persistedTo = persisted;
    } catch (error) {
      warnings.push('W Persist 失败（投影仍返回，不阻塞只读面）: ' + error.message);
    }
  } else if (writerMode(opts) === 'legacy') {
    warnings.push('YY_JOURNEY_WRITER=legacy：journey.project 不落盘（现状写路径所有，OQ-R5-10=A）');
  } else {
    warnings.push('展示态 ' + computed.displayStatus + ' 不落盘（§4.3：inferred/partial/stale/error 投影永不落盘为权威 Journey）');
  }

  return respond(true, null, { projection: computed.body, mode: v.mode, session: layout.sessionId, persistedTo: persisted }, evidence, warnings);
}

// ---------------------------------------------------------------------------
// nextPrompt 复制语义（OQ-R5-5=A：复制 = 快照引用，不重算）
// ---------------------------------------------------------------------------

/**
 * copyNextPrompt(source) — 纯函数：从既有投影体/响应壳提取 nextPrompt 并附快照引用。
 * 不重算投影、不读盘、不触发重新投影（snapshotRef.recompute 恒 false）。
 */
export function copyNextPrompt(source) {
  const np = source && source.data && (source.data.journey || source.data.projection)
    ? (source.data.journey || source.data.projection).nextPrompt
    : (source && source.nextPrompt ? source.nextPrompt : null);
  if (!np || typeof np !== 'object') return null;
  return {
    actionHint: np.actionHint ?? null,
    targetNode: np.targetNode ?? null,
    requiredInputs: Array.isArray(np.requiredInputs) ? np.requiredInputs.slice() : [],
    snapshotHash: np.snapshotHash ?? null,
    snapshotRef: {
      snapshotHash: np.snapshotHash ?? null,
      copiedAt: new Date().toISOString(),
      recompute: false,
    },
  };
}

// ---------------------------------------------------------------------------
// run() 分发入口
// ---------------------------------------------------------------------------

/** run('journey.read'|'journey.project', input) → 统一响应壳（未知操作 → JOURNEY_INVALID） */
export function run(op, input) {
  if (op === 'journey.read') return journeyRead(input);
  if (op === 'journey.project') return journeyProject(input);
  return respond(false, 'JOURNEY_INVALID', { reason: '未知操作: ' + op + '（仅 journey.read / journey.project 两操作，dev-plan :306-307 逐字）' });
}

export const journey = { read: journeyRead, project: journeyProject };

export default {
  run, journey, journeyRead, journeyProject, copyNextPrompt,
  JOURNEY_SCHEMA, GATE_VOCAB, STEPS, DISPLAY_STATES, NEGATIVE_STATES,
  ERROR_CODES, WORST_RANK, PROJECTION_MODES,
};
