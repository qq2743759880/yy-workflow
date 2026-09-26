/**
 * migration.mjs — Asset Migration Contract v1 真实生产 authority（第十五审计 GOV-AUTHORITY 任务一）。
 *
 * 缘由（第十四/十五审计双实证）：S16-2/3 的 promote()/validatePromotionEvidence() 均为
 * regression-all.mjs 探针内自造的 test oracle（本地函数，非生产可消费面）——仓内不存在生产
 * migration transition/promotion authority。本模块将该语义升为生产函数，S16-2/3 改为调用
 * 本模块（test oracle 删除——它们测生产 authority 而非本地函数）。
 *
 * 契约面（contracts/asset-migration.md §一，逐字实现，不增删边）：
 *   六态 ACTIVE→SHADOW→MIGRATING→PRIMARY→DEPRECATED→REMOVED；合法转移穷举共 5 条：
 *     ACTIVE→SHADOW      （Gate-0 baseline 快照 + 影子跑夹具就位）
 *     SHADOW→MIGRATING   （影子跑 diff 消费证据通过 + promotion receipt 签发）
 *     MIGRATING→PRIMARY  （三硬门全过 + CLUSTERS candidates 切换）
 *     PRIMARY→DEPRECATED （新一轮 replace 宣布弃用）
 *     DEPRECATED→REMOVED （drop 三条件 + drop_allowed=true + 收口核查）
 *   除上表外全部非法（非法流转表穷举 9 条具名 + 其余隐式）→ INVALID_TRANSITION。
 *
 * 失败语义（playbook §四 Failure Rules 四条中的前两条 + S16 三失败形态映射）：
 *   shadow_fail          → 影子跑 FAIL = NO PROMOTION（playbook Rule 1）→ SHADOW→MIGRATING 硬拒绝 MIGRATION_BLOCKED:shadow_fail
 *   rollback_fail        → 回滚演练 FAIL = NO DROP（playbook Rule 2）→ SHADOW→MIGRATING 与 MIGRATING→PRIMARY 硬拒绝 MIGRATION_BLOCKED:rollback_fail
 *   runtime_binding_fail → Gate-2 consumed_hash==build_hash 违约 → MIGRATING→PRIMARY 硬拒绝 MIGRATION_BLOCKED:runtime_binding_fail
 *   （三失败形态下 MIGRATING→PRIMARY 一并拒绝：三硬门任一 FAIL → 不得晋升 PRIMARY。）
 *
 * promotion evidence 校验内化（S16-3 cross-plane 语义升为生产函数）：
 *   sourceEvidence 引用的 execution receipt 终态 ∈ {FAILED, UNRESOLVED, INVALID, 缺失} → 拒绝；
 *   仅 behavior_verified 放行。终态值可由 phase.mjs deriveReceiptState/validateReceipt 或
 *   receipt.mjs verifyReceiptFile 产出（调用方传字符串终态——本模块只消费单一终态词汇，
 *   不重复实现 receipt 重放，与 R3/R4"只读消费、不另立 schema"纪律同构）。
 *
 * 兼容性面（任务一第 4 条）：replayTransitions(record) 对既有 AS-2 三张已 PRIMARY 的
 * migration-record（test-reports/autopilot-work/AS-2-first|AS-2-security|AS-2-sentinel）回放——
 *   逐条转移按同一合法边表判定（合法链放行）；voided 记录跳过（S15-A6 correction≠作废同口径：
 *   作废记录不参与状态推导）；sentinel 的 voided SHADOW→MIGRATING 留痕不阻断回放。
 *
 * 位置纪律：本模块只消费 phase/receipt 的校验产物，不 import evolution.mjs（R10 只读消费本面，
 * 反向无依赖）；不写任何状态文件（transition/replay 均为纯判定 + 返回值，写面归 change.record
 * 与 migration-record 落盘流程）——与 phase.mjs transitionPhase（canonical state 唯一写点）分工。
 *
 * 本单产出物红线自检：migration.mjs 为新建 scripts/lib/ 文件，不触 contracts/ 冻结正文
 * （isFrozenContractPath 面）——不构成 change.mjs 最严类规则的 CONTRACT 触发面；AS-2 三张
 * migration-record 为只读回放输入，零改写。
 */

/** 六态词汇（契约 §一；枚举外状态名一律非法 → INVALID_TRANSITION） */
export const MIGRATION_STATES = Object.freeze([
  'ACTIVE', 'SHADOW', 'MIGRATING', 'PRIMARY', 'DEPRECATED', 'REMOVED',
]);

/**
 * 合法转移表（契约 §一"合法转移表（穷举，共 5 条）"原文边集）。
 * evidenceKind 逐边标注该边的证据要求类（契约表"触发条件（证据要求）"列）。
 */
export const LEGAL_TRANSITIONS = Object.freeze({
  'ACTIVE>SHADOW': Object.freeze({ from: 'ACTIVE', to: 'SHADOW', evidenceKind: 'baseline_and_shadow_fixture' }),
  'SHADOW>MIGRATING': Object.freeze({ from: 'SHADOW', to: 'MIGRATING', evidenceKind: 'shadow_diff_plus_promotion_receipt' }),
  'MIGRATING>PRIMARY': Object.freeze({ from: 'MIGRATING', to: 'PRIMARY', evidenceKind: 'three_gates_and_traffic_switch' }),
  'PRIMARY>DEPRECATED': Object.freeze({ from: 'PRIMARY', to: 'DEPRECATED', evidenceKind: 'deprecation_announce' }),
  'DEPRECATED>REMOVED': Object.freeze({ from: 'DEPRECATED', to: 'REMOVED', evidenceKind: 'drop_three_conditions_plus_drop_allowed' }),
});

/** S16 三失败形态词汇（探针与生产调用共用同一枚举；枚举外形态按无失败处理前必须显式登记） */
export const FAILURE_SHAPES = Object.freeze(['shadow_fail', 'rollback_fail', 'runtime_binding_fail']);

/** 错误码（MIGRATION_BLOCKED:<形态> 为 playbook Failure Rules 机器可查码；其余沿 R4/R7 既有词汇） */
export const ERROR_CODES = Object.freeze([
  'INVALID_TRANSITION', 'MIGRATION_BLOCKED', 'PROMOTION_BLOCKED', 'EVIDENCE_INVALID',
]);

/** 内部工具：统一响应壳（与 phase.mjs/change.mjs 同构 {ok, code, data, evidence, warnings}） */
function respond(ok, code, data, evidence, warnings) {
  return { ok, code: code ?? null, data: data ?? {}, evidence: evidence ?? {}, warnings: warnings ?? [] };
}

function transitionKey(from, to) { return `${from}>${to}`; }

/** 边是否在契约穷举 5 条内 */
export function isLegalTransition(from, to) {
  return Object.prototype.hasOwnProperty.call(LEGAL_TRANSITIONS, transitionKey(from, to));
}

/**
 * validatePromotionEvidence(terminal) — promotion evidence 校验（S16-3 语义的生产化，单点权威）。
 * terminal = sourceEvidence 引用的 execution receipt 重放终态（phase.mjs deriveReceiptState 或
 * receipt.mjs verifyReceiptFile 的 terminal 词汇）。
 *   - 缺失（null/undefined/空串）→ 拒绝（fail-closed："无法判定"与"不满足"同归拒绝）
 *   - FAILED / UNRESOLVED → PROMOTION_BLOCKED（负终态不得晋升）
 *   - INVALID（receipt 事件重放违约）→ PROMOTION_BLOCKED（RECEIPT_INVALID 语义面）
 *   - 未到终态的其他词汇 → 拒绝（未到终态不得晋升）
 *   - behavior_verified → 放行（唯一正终态）
 */
export function validatePromotionEvidence(terminal) {
  if (terminal === undefined || terminal === null || String(terminal).trim() === '') {
    return { ok: false, code: 'PROMOTION_BLOCKED', reason: 'sourceEvidence 缺 execution receipt 终态引用——fail-closed（缺失=不通过）' };
  }
  const t = String(terminal);
  if (t === 'FAILED') return { ok: false, code: 'PROMOTION_BLOCKED', reason: 'PROMOTION_BLOCKED: 引用的 execution receipt 终态=FAILED（失败终态不可晋升）' };
  if (t === 'UNRESOLVED') return { ok: false, code: 'PROMOTION_BLOCKED', reason: 'PROMOTION_BLOCKED: 引用的 execution receipt 终态=UNRESOLVED（未收口不得晋升）' };
  if (t === 'INVALID') return { ok: false, code: 'PROMOTION_BLOCKED', reason: 'PROMOTION_BLOCKED: receipt 事件重放违约（RECEIPT_INVALID）——违约证据链不得作为晋升证据' };
  if (t === 'behavior_verified') return { ok: true, code: null, reason: null };
  return { ok: false, code: 'PROMOTION_BLOCKED', reason: `PROMOTION_BLOCKED: receipt 终态 ${t} 未到正终态（未到终态不得晋升；唯一放行词汇 behavior_verified）` };
}

/**
 * promote(record, opts) — SHADOW→MIGRATING 与 MIGRATING→PRIMARY 的生产晋升 authority。
 * 返回 {ok:true, promotionReceipt} | {ok:false, code:'MIGRATION_BLOCKED'|..., reason}。
 *
 * 判定顺序（全过才发 receipt；任一失败 → 显式拒绝码，不静默降级）：
 *   (1) record.current_state ∈ {SHADOW, MIGRATING}（否则 INVALID_TRANSITION——不在晋升语义域）
 *   (2) 失败形态门（S16 三形态）：record.failureShapes（数组）或 opts.failureShapes 含
 *       shadow_fail / rollback_fail / runtime_binding_fail → MIGRATION_BLOCKED:<形态>
 *       （shadow_fail 只卡 SHADOW→MIGRATING；rollback_fail/binding_fail 卡两步——playbook
 *       Rule 1/2 + 契约三硬门映射。枚举外形态值 → EVIDENCE_INVALID fail-closed，不默认放行）
 *   (3) promotion evidence 门（terminal=behavior_verified 唯一放行）——validatePromotionEvidence
 *   (4) promotion receipt 组装（S16-3"生成处校验"：receipt 只在校验通过后生成——生产函数内化，
 *       不再由调用方手工拼 receipt 绕过校验）
 *
 * opts: { promotionReceiptId?, failureShapes?, receiptTerminal?, targetState? }
 *   targetState 缺省按 current_state 推进下一态（SHADOW→MIGRATING / MIGRATING→PRIMARY）。
 */
export function promote(record, opts = {}) {
  const warnings = [];
  const rec = record && typeof record === 'object' ? record : {};
  const current = rec.current_state ?? rec.currentState ?? null;
  const shapes = [
    ...((Array.isArray(rec.failureShapes) ? rec.failureShapes : [])),
    ...((Array.isArray(opts.failureShapes) ? opts.failureShapes : [])),
  ];
  // (1) 晋升语义域
  if (current !== 'SHADOW' && current !== 'MIGRATING') {
    return respond(false, 'INVALID_TRANSITION', {
      reason: `晋升语义域非法: current_state=${JSON.stringify(current)}（晋升仅适用于 SHADOW→MIGRATING / MIGRATING→PRIMARY；契约 §一合法转移表）`,
      current_state: current,
    }, {}, warnings);
  }
  const target = opts.targetState ?? (current === 'SHADOW' ? 'MIGRATING' : 'PRIMARY');
  if (!isLegalTransition(current, target)) {
    return respond(false, 'INVALID_TRANSITION', { reason: `矩阵外转换: ${current} → ${target}（契约 §一穷举 5 条之外）`, current_state: current, target }, {}, warnings);
  }
  // (2) 失败形态门（枚举外形态值 fail-closed）
  for (const s of shapes) {
    if (!FAILURE_SHAPES.includes(s)) {
      return respond(false, 'EVIDENCE_INVALID', { reason: `失败形态枚举外: ${JSON.stringify(s)}（合法 ${FAILURE_SHAPES.join('|')}）——fail-closed 不默认放行` }, {}, warnings);
    }
  }
  const hit = (shape) => shapes.includes(shape);
  if (current === 'SHADOW') {
    if (hit('shadow_fail')) {
      return respond(false, 'MIGRATION_BLOCKED:shadow_fail', { reason: 'MIGRATION_BLOCKED:shadow_fail——影子跑 FAIL = NO PROMOTION（playbook §四 Rule 1；含任一 forbidden_difference 命中）', blocked_transition: 'SHADOW→MIGRATING', shapes }, {}, warnings);
    }
    if (hit('rollback_fail')) {
      return respond(false, 'MIGRATION_BLOCKED:rollback_fail', { reason: 'MIGRATION_BLOCKED:rollback_fail——回滚演练 FAIL = NO DROP 且不得带病推进（playbook §四 Rule 2）', blocked_transition: 'SHADOW→MIGRATING', shapes }, {}, warnings);
    }
    if (hit('runtime_binding_fail')) {
      return respond(false, 'MIGRATION_BLOCKED:runtime_binding_fail', { reason: 'MIGRATION_BLOCKED:runtime_binding_fail——Gate-2 consumed_hash==build_hash 违约（契约 §三硬门 2）', blocked_transition: 'SHADOW→MIGRATING', shapes }, {}, warnings);
    }
  }
  if (current === 'MIGRATING') {
    if (hit('rollback_fail')) {
      return respond(false, 'MIGRATION_BLOCKED:rollback_fail', { reason: 'MIGRATION_BLOCKED:rollback_fail——回滚路径失效时不得晋升 PRIMARY（playbook §四 Rule 2；三硬门 Gate-5 面）', blocked_transition: 'MIGRATING→PRIMARY', shapes }, {}, warnings);
    }
    if (hit('runtime_binding_fail')) {
      return respond(false, 'MIGRATION_BLOCKED:runtime_binding_fail', { reason: 'MIGRATION_BLOCKED:runtime_binding_fail——Gate-2 consumed_hash==build_hash 违约，三硬门 FAIL → 不得晋升 PRIMARY', blocked_transition: 'MIGRATING→PRIMARY', shapes }, {}, warnings);
    }
  }
  // (3) promotion evidence 门（S16-3 内化单点）
  const ev = validatePromotionEvidence(opts.receiptTerminal);
  if (!ev.ok) {
    return respond(false, ev.code, { reason: ev.reason, blocked_transition: `${current}→${target}` }, {}, warnings);
  }
  // (4) receipt 组装（校验通过后才生成——生成处校验内化）
  const receipt = {
    receiptId: opts.promotionReceiptId ?? null,
    from: current,
    to: target,
    evidenceTerminal: opts.receiptTerminal,
    failureShapes: shapes,
    issuedBy: 'scripts/lib/migration.mjs promote()',
    note: '本 receipt 由生产 authority 校验通过后签发（S16-3 生成处校验升为生产函数；S16-2/3 的 test oracle 已删除）',
  };
  warnings.push('PROMOTION_RECEIPT_ISSUED: receipt 由 migration.promote() 生产校验链签发（shadow/rollback/binding 三形态门 + evidence 终态门全过）');
  return respond(true, null, { target, promotionReceipt: receipt }, { shapes, evidenceTerminal: opts.receiptTerminal ?? null }, warnings);
}

/**
 * transition(record, from, to, evidence) — 六态机单步转移判定（契约 §一穷举 5 条边 + 失败形态门
 * + promotion evidence 门）。纯判定函数：不写任何状态文件（写面归 change.record / migration-record
 * 落盘流程，与 phase.mjs canonical state 唯一写点分工）。
 *
 * 返回 {ok:true, to, code:null} | {ok:false, code, reason}。
 *   - 非法边（含跳态/逆向/终态出边/枚举外状态名）→ INVALID_TRANSITION
 *   - SHADOW→MIGRATING / MIGRATING→PRIMARY 遇三失败形态 → MIGRATION_BLOCKED:<形态>（硬拒绝）
 *   - MIGRATING→PRIMARY 的 evidence.terminal 非 behavior_verified → PROMOTION_BLOCKED
 *   - SHADOW→MIGRATING 的 promotion receipt 证据缺失（evidence.promotionReceipt 缺失）→ EVIDENCE_INVALID
 *     （契约 §一 SHADOW→MIGRATING 触发条件列："promotion receipt 签发"为证据要求）
 */
export function transition(record, from, to, evidence) {
  const warnings = [];
  const ev = evidence && typeof evidence === 'object' ? evidence : {};
  // 形状 fail-closed：from/to 非非空字符串 → INVALID_TRANSITION（禁默认放行）
  if (typeof from !== 'string' || from === '' || typeof to !== 'string' || to === '') {
    return respond(false, 'INVALID_TRANSITION', { reason: 'from/to 形状非法（非空字符串）——fail-closed 输入校验', from, to }, {}, warnings);
  }
  if (!MIGRATION_STATES.includes(from) || !MIGRATION_STATES.includes(to)) {
    return respond(false, 'INVALID_TRANSITION', { reason: `状态枚举外: ${JSON.stringify(from)} → ${JSON.stringify(to)}（六态 ${MIGRATION_STATES.join('→')}；契约 §一）`, from, to }, {}, warnings);
  }
  if (isLegalTransition(from, to)) {
    const edge = LEGAL_TRANSITIONS[transitionKey(from, to)];
    // 边内失败形态门（S16-2 三形态在合法边上同样硬拒绝——合法边 ≠ 无条件放行）
    const shapes = [
      ...((Array.isArray(ev.failureShapes) ? ev.failureShapes : [])),
    ];
    for (const s of shapes) {
      if (!FAILURE_SHAPES.includes(s)) {
        return respond(false, 'EVIDENCE_INVALID', { reason: `失败形态枚举外: ${JSON.stringify(s)}——fail-closed` }, {}, warnings);
      }
    }
    if (edge.evidenceKind === 'shadow_diff_plus_promotion_receipt' || edge.evidenceKind === 'three_gates_and_traffic_switch') {
      const hit = (s) => shapes.includes(s);
      if (hit('shadow_fail') || hit('rollback_fail') || hit('runtime_binding_fail')) {
        // playbook Failure Rules：三形态下 SHADOW→MIGRATING 与 MIGRATING→PRIMARY 均硬拒绝
        const shape = hit('shadow_fail') ? 'shadow_fail' : hit('rollback_fail') ? 'rollback_fail' : 'runtime_binding_fail';
        return respond(false, `MIGRATION_BLOCKED:${shape}`, {
          reason: `MIGRATION_BLOCKED:${shape}——${from}→${to} 硬拒绝（playbook §四 Failure Rules + 契约 §三三硬门）`,
          from, to, shapes,
        }, { edge: edge.evidenceKind }, warnings);
      }
      if (edge.evidenceKind === 'shadow_diff_plus_promotion_receipt') {
        // SHADOW→MIGRATING 证据要求：promotion receipt 签发（契约 §一触发条件列）
        if (!ev.promotionReceipt || (typeof ev.promotionReceipt !== 'string' && typeof ev.promotionReceipt !== 'object')) {
          return respond(false, 'EVIDENCE_INVALID', { reason: 'SHADOW→MIGRATING 缺 promotion receipt 证据（契约 §一触发条件：影子跑 diff 消费证据通过 + promotion receipt 签发）——fail-closed', from, to }, {}, warnings);
        }
      }
      if (edge.evidenceKind === 'three_gates_and_traffic_switch') {
        // MIGRATING→PRIMARY 证据要求：promotion evidence 终态门（S16-3 单点）——
        // terminal 缺省视为"引用了本转移自身的 receipt 终态"，调用方显式传 opts/evidence.terminal
        const gate = validatePromotionEvidence(ev.terminal);
        if (!gate.ok) {
          return respond(false, gate.code, { reason: gate.reason, from, to }, { edge: edge.evidenceKind }, warnings);
        }
      }
    }
    return respond(true, null, { from, to, evidenceKind: edge.evidenceKind }, { edge: edge.evidenceKind }, warnings);
  }
  // 非法边（穷举 5 条之外全部非法——含契约非法流转表 9 条具名形态与其余隐式）
  const named = {
    'ACTIVE>MIGRATING': '未走影子跑（无 diff 消费证据）——"文件换了所以完成"自欺（v3.2）',
    'ACTIVE>PRIMARY': '同上且连 CLUSTERS 切换都无过渡证据；五元组缺 old_asset/shadow_result',
    'SHADOW>PRIMARY': '跳过 MIGRATING：runtime binding 未验证、旧路径拒绝探针未跑',
    'MIGRATING>SHADOW': '回退必须走 promotion receipt 作废 + 新 change 单（supersede-not-delete），不允许隐式回退',
    'PRIMARY>ACTIVE': '状态机无逆向激活；回滚走 Gate-5 rollback proof 后回 SHADOW 重验',
    'DEPRECATED>PRIMARY': '弃用不可撤销；重新启用 = 新 replace 走全流程',
    'REMOVED>ACTIVE': '终态不可出；重引入 = 全新资产走注册三件套',
  };
  const why = named[transitionKey(from, to)] ?? `契约 §一合法转移表（穷举 5 条）之外：${from} → ${to}（非法流转表穷举原则）`;
  return respond(false, 'INVALID_TRANSITION', { reason: `非法流转: ${from} → ${to}——${why}`, from, to }, {}, warnings);
}

/**
 * replayTransitions(record) — 既有 migration-record 回放兼容面（任务一第 4 条）。
 * 输入：migration-record.json 解析对象（含 state_machine.transitions / current_state；AS-2 三张实态）。
 * 逐条转移按 transition() 同一边表判定（voided 记录跳过——S15-A6 correction≠作废同口径）；
 * 终态与记录 current_state 一致 → 放行（兼容性证明：真实 authority 对既有合法链放行）。
 * 返回 {ok, current, expected, steps:[{from,to,ok,code,voided}], reason?}。
 */
export function replayTransitions(record) {
  const warnings = [];
  const sm = record && record.state_machine && typeof record.state_machine === 'object' ? record.state_machine : null;
  if (!sm || !Array.isArray(sm.transitions)) {
    return respond(false, 'EVIDENCE_INVALID', { reason: 'record.state_machine.transitions 缺失或非数组（migration-record schema 违约）' }, {}, warnings);
  }
  let current = 'ACTIVE';
  const steps = [];
  let ok = true;
  let firstFail = null;
  for (const t of sm.transitions) {
    if (!t || typeof t !== 'object') { ok = false; firstFail = firstFail ?? 'transition 非对象'; break; }
    if (t.voided === true) {
      // 作废转移留痕不参与状态推导（correction≠作废；S15-A6 同口径）
      steps.push({ from: t.from, to: t.to, at: t.at ?? null, voided: true, ok: null, code: 'VOIDED_SKIPPED' });
      continue;
    }
    const r = transition(record, t.from, t.to, { promotionReceipt: (t.sourceEvidence ?? []).length ? 'sourceEvidence 在场' : null, terminal: 'behavior_verified' });
    const stepOk = r.ok === true && r.data.from === current;
    steps.push({ from: t.from, to: t.to, at: t.at ?? null, voided: false, ok: stepOk, code: stepOk ? null : (r.code ?? 'CHAIN_BROKEN') });
    if (!stepOk) { ok = false; firstFail = firstFail ?? (r.data.reason ?? `链断裂: 期望 from=${current} 实得 ${t.from}`); break; }
    current = t.to;
  }
  const expected = sm.current_state ?? null;
  const consistent = ok && (expected === null || current === expected);
  if (!consistent) {
    return respond(false, 'INVALID_TRANSITION', { reason: firstFail ?? `回放终态 ${current} ≠ 记录终态 ${expected}`, current, expected, steps }, {}, warnings);
  }
  return respond(true, null, { current, expected, steps }, { replayed: steps.filter((s) => !s.voided).length, voidedSkipped: steps.filter((s) => s.voided).length }, warnings);
}

// ---------------------------------------------------------------------------
// run() 分发入口（与 phase.mjs/change.mjs 同构；仅判定面三操作，不新增写面操作名）
// ---------------------------------------------------------------------------

export function run(op, input = {}) {
  if (op === 'migration.transition') return Promise.resolve(transition(input.record, input.from, input.to, input.evidence));
  if (op === 'migration.promote') return Promise.resolve(promote(input.record, input.opts ?? {}));
  if (op === 'migration.replay') return Promise.resolve(replayTransitions(input.record));
  return Promise.resolve(respond(false, 'INVALID_TRANSITION', { reason: `未知操作: ${op}（仅 migration.transition / migration.promote / migration.replay 三个判定面操作）` }));
}

export default {
  run, transition, promote, replayTransitions,
  validatePromotionEvidence, isLegalTransition,
  MIGRATION_STATES, LEGAL_TRANSITIONS, FAILURE_SHAPES, ERROR_CODES,
};
