/**
 * lib/ci.mjs — A1 纯函数库（从 scripts/ci.mjs 抽取）
 *
 * 抽取范围：
 *   - GATE_TOPOLOGY：ci.mjs 顶层段拓扑（S1-S6）与 fail-closed 分类
 *   - buildTempReportContent()：S3 临时报告内容（纯字符串生成，不写盘）
 *   - runGate(name, ctx)：按拓扑跑一个门，ctx 注入 spawn/fs/path
 *   - classifyFailure(results)：根据各门退出码分类失败原因
 *
 * 口径声明（与规格文档 S1-S12 的偏差）：
 *   - ci.mjs 顶层实际只有 S1-S4（子进程门）+ S5（P0 硬闸门，进程内检查）+
 *     S6（asset-call-rate，信息段非阻断）。
 *   - S1-S12 是 regression-all.mjs 内部的 12 段断言，ci.mjs 将其整体作为 S4 调用。
 *   - 本 lib 不抽取 regression-all.mjs 内部逻辑（那是另一个文件），
 *     GATE_TOPOLOGY 仅反映 ci.mjs 顶层视角。
 *
 * 设计原则：行为等价优先于代码美观。ci.mjs 的 spawn/process.exit/console 全局态
 * 不进 lib——以 ctx 注入替代。
 *
 * S5 口径（T7 收尾批①，2026-09-20 裁决）：`OPEN_P0_PATTERN` 为"P0 未清零"行的单点定义，
 * ⬜ 与 ◐ 都算未清零；`EVIDENCE_REF_PATTERN`/`hasEvidenceRef` 承载防护 3（◐ 行无落点/
 * 收据引用 → 归类无证据 ⬜，计数不变）。ci.mjs 与 orchestrator.mjs 共同引用，杜绝第三处分叉。
 */

// ---------------------------------------------------------------------------
// GATE_TOPOLOGY — ci.mjs 顶层段定义（fail-closed 分类矩阵）
// ---------------------------------------------------------------------------

/**
 * 门拓扑（与 ci.mjs main() 中 segments 数组一一对应）。
 * blocking=true → 失败即 exit 1（fail-closed）；blocking=false → 仅日志不阻断。
 * needsTempReport=true → 该门需要先构造 S3 临时报告文件。
 */
export const GATE_TOPOLOGY = Object.freeze([
  Object.freeze({
    id: 'S1',
    name: 'S1 validate-structure',
    script: 'validate-structure.mjs',
    args: Object.freeze([]),
    blocking: true,
    description: '结构/16 资产/接口漂移/可移植性校验',
  }),
  Object.freeze({
    id: 'S2',
    name: 'S2 review-gate self-test',
    script: 'review-gate.mjs',
    args: Object.freeze(['--self-test']),
    blocking: true,
    description: '批判闸门代码级自测',
  }),
  Object.freeze({
    id: 'S3',
    name: 'S3 plan-review --check',
    script: 'plan-review.mjs',
    args: Object.freeze(['--check', '<temp-report>']), // <temp-report> 占位由 runGate 替换
    blocking: true,
    needsTempReport: true,
    description: '三视角评审报告机验',
  }),
  Object.freeze({
    id: 'S4',
    name: 'S4 regression-all',
    script: 'regression-all.mjs',
    args: Object.freeze([]),
    blocking: true,
    description: '全量回归（内含 S1-S12 子段断言）',
  }),
  Object.freeze({
    id: 'S5',
    name: 'S5 P0 硬闸门',
    script: null, // 进程内检查，不 spawn
    args: Object.freeze([]),
    blocking: true,
    description: 'critique-backlog-tracker.md 中 P0 未闭环条数 = 0（严格口径：⬜ 与 ◐ 都算未清零）',
  }),
  Object.freeze({
    id: 'S6',
    name: 'S6 资产质量评分（asset-call-rate）',
    script: 'asset-call-rate.mjs',
    args: Object.freeze(['--task', 'backend login module']),
    blocking: false,
    description: '信息段：资产质量评分，exit 1 = 有需审查资产（不阻断 CI）',
  }),
]);

/** 门 id → 门定义 的查找表。 */
export const GATE_MAP = Object.freeze(
  Object.fromEntries(GATE_TOPOLOGY.map((g) => [g.id, g])),
);

// ---------------------------------------------------------------------------
// buildTempReportContent — S3 临时报告内容（纯函数，不写盘）
// ---------------------------------------------------------------------------

/**
 * 构造 plan-review --check 可机验的最小通过报告内容。
 * 与 ci.mjs buildTempReport() 逐字一致（除时间戳字段）。
 * @param {object} opts - { now?: Date } 时间注入（测试可确定性）
 * @returns {string} 报告 markdown 内容
 */
export function buildTempReportContent(opts = {}) {
  const now = (opts.now instanceof Date) ? opts.now : new Date();
  const report = [
    '# plan-review-report',
    '',
    '- plan: scripts/ci.mjs（临时最小通过报告）',
    '- 生成: ' + now.toISOString(),
    '',
    '## CEO 范围视角',
    '',
    '- Finding: ci.mjs 覆盖 spec 四段回归（validate/review-gate/plan-review/regression-all）',
    '- 处置: 保持与 task C-2 契约一致',
    '',
    '## Eng 架构视角',
    '',
    '- Finding: spawn 以 process.execPath 直跑，零依赖顺序执行 (confidence: 9/10) scripts/ci.mjs:31',
    '- 处置: 任一失败短路 exit 1，全过输出 CI PASS',
    '',
    '## Design 体验视角',
    '',
    '- Finding: 分段继承子命令输出，失败段立即可定位',
    '- 处置: 统一 CI PASS/FAIL 出口，退出码可被 CI 消费',
    '',
  ].join('\n');
  return report;
}

// ---------------------------------------------------------------------------
// S5 P0 硬闸门逻辑（纯函数，读入文本）——口径单点定义（2026-09-20 裁决，T7 落地）
// ---------------------------------------------------------------------------

/**
 * OPEN_P0_MARKERS — 未清零状态标记（严格口径）：`⬜` 与 `◐`。
 * 本数组是"未清零"标记集的**唯一事实源**：OPEN_P0_PATTERN（整行判定）与
 * OPEN_P0_MARKER_RE（状态单元判定，供 orchestrator.backlogIsPending 引用）都由它派生。
 * 历史 ⬜-only 口径已被 2026-09-20 裁决取代（grandfathering 见 change record）。
 */
export const OPEN_P0_MARKERS = Object.freeze(['⬜', '◐']);

/** 状态单元级判定：状态以未清零标记开头（⬜/◐，单点派生）。 */
export const OPEN_P0_MARKER_RE = new RegExp('^(?:' + OPEN_P0_MARKERS.join('|') + ')');

/**
 * OPEN_P0_PATTERN — "P0 未清零"行的**单点定义**（唯一事实源）。
 *
 * 判定（对 trim 后的 tracker 数据行）：
 *   1) 行首为 `| C-`（critique-backlog-tracker 的数据行）；
 *   2) 含 `| P0 |` 级别单元（允许空白宽松匹配 `|\s*P0\s*|`）；
 *   3) 级别单元**之后**的状态区含 `⬜` 或 `◐` —— 二者皆算未清零。
 *
 * 口径来源：`plans/decision-s5-p0-semantics-20260920.md`（Owner 2026-09-20 授权编排者裁决）
 * 选择 2「统一严格口径」：go/no-go 时刻的 in-progress = no-go，进行中的 P0 修复没有完成证据。
 * 历史 ACCEPTED 报告按取得时口径（⬜-only）有效（grandfathering 声明见同批 change record）。
 * ci.mjs / orchestrator.mjs`backlogIsPending` 必须共同引用本常量，禁止第三次分叉。
 */
export const OPEN_P0_PATTERN = new RegExp(
  '^\\|\\s*C-.*\\|\\s*P0\\s*\\|.*[' + OPEN_P0_MARKERS.join('') + ']',
);

/**
 * EVIDENCE_REF_PATTERN — ◐ 行的"证据卫生规则"判定：行内是否携带落点任务/收据引用。
 *
 * 防护 3（裁决文档）：gate 时 ◐ 行必须携带落点任务/收据引用，**无引用按 ⬜ 处理**
 * （计数不变，只产出分类信息）。可识别的引用形态仅限**可核验的具体引用**：
 *   - 任务/节点 id：T7 / R5-02 / C-31 / M2 / W1a / A1（首次出现在行内即可）
 *   - change/promotion/approval receipt id：cr-…/prm-…/apr-…/rcp-…
 *   - 仓库相对路径：test-reports/…、contracts/…、plans/…、scripts/…、artifacts/…、docs/…、vendor/…
 * 刻意**不**把"落点"字段名本身当证据——tracker 表头带落点列时，把列名当引用会让卫生规则
 * 永不触发（防护 3 失效）。空占位（如"落点X"）不算引用。
 * 仅作分类用；命中与否都不改变未清零计数（严格口径下两者都算未清零）。
 */
export const EVIDENCE_REF_PATTERN = new RegExp([
  '\\b(?:[TRCWMA]\\d{1,3}(?:-[A-Za-z0-9_]+)?)\\b',
  '\\b(?:cr|prm|apr|rcp)-[0-9A-Za-z]{6,}\\b',
  '(?:test-reports|contracts|plans|scripts|artifacts|docs|vendor)\\/[^\\s|]*[A-Za-z0-9]',
].join('|'));

/** 行是否携带落点任务/收据引用（防护 3 判定；纯函数）。 */
export function hasEvidenceRef(line) {
  return EVIDENCE_REF_PATTERN.test(String(line ?? ''));
}

/**
 * classifyOpenP0 — 从 tracker 文本产出 S5 的计数与分类（严格口径 + 证据卫生规则）。
 *
 * @param {string} trackerText - critique-backlog-tracker.md 全文
 * @returns {{openP0: number, pending: string[], inProgress: string[], unbacked: string[], warnings: string[]}}
 *   - openP0      未清零 P0 条数（⬜ + ◐，单点口径 OPEN_P0_PATTERN）
 *   - pending     状态 ⬜ 的行标识（serial）
 *   - inProgress  状态 ◐ 且携带落点/收据引用 → 分类 in-progress（仍计未清零）
 *   - unbacked    状态 ◐ 但无引用 → 归类为"无证据 ⬜"（按 ⬜ 处理；计数不变）
 *   - warnings    卫生规则的分类信息（供 CI 输出；无 ◐ 行时为空数组）
 */
export function classifyOpenP0(trackerText) {
  const out = { openP0: 0, pending: [], inProgress: [], unbacked: [], warnings: [] };
  if (!trackerText) return out;
  const lines = String(trackerText).split('\n').map((l) => l.trim());
  for (const line of lines) {
    if (!OPEN_P0_PATTERN.test(line)) continue;
    out.openP0 += 1;
    const serial = (line.match(/\|\s*(C-\d+)/) ?? [])[1] ?? '(未编号)';
    const isInProgress = line.includes('◐');
    if (!isInProgress) {
      out.pending.push(serial);
      continue;
    }
    if (hasEvidenceRef(line)) {
      out.inProgress.push(serial);
      out.warnings.push(`S5 证据卫生规则：${serial} 状态 ◐ 且携带落点/收据引用 ⇒ 分类 in-progress（进行中，仍计未清零；防护 3）`);
    } else {
      out.unbacked.push(serial);
      out.warnings.push(`S5 证据卫生规则：${serial} 状态 ◐ 但无落点任务/收据引用 ⇒ 归类为无证据 ⬜（按 ⬜ 处理，计数不变；防护 3）`);
    }
  }
  return out;
}

/**
 * 从 critique-backlog-tracker.md 文本中统计未闭环 P0 条数。
 *
 * 口径（2026-09-20 裁决后）：`⬜` 与 `◐` **都算未清零**——计数由单点常量
 * OPEN_P0_PATTERN 决定（历史 ⬜-only 口径的 ACCEPTED 报告按 grandfathering 有效）。
 * @param {string} trackerText - tracker markdown 全文
 * @returns {number} 未闭环 P0 条数
 */
export function countOpenP0(trackerText) {
  return classifyOpenP0(trackerText).openP0;
}

// ---------------------------------------------------------------------------
// runGate — 跑一个门（ctx 注入依赖）
// ---------------------------------------------------------------------------

/**
 * 跑指定门。
 * @param {string} gateId - GATE_TOPOLOGY 中的 id（如 'S1'）
 * @param {object} ctx - 注入依赖
 * @param {function} ctx.spawn - (script, args) => Promise<number> 退出码
 * @param {object} [ctx.tempReportFile] - S3 需要的临时报告文件路径（由外层构造）
 * @param {string} [ctx.trackerText] - S5 需要的 tracker 文本（进程内门）
 * @returns {Promise<{gateId: string, name: string, code: number, blocking: boolean}>}
 */
export async function runGate(gateId, ctx) {
  const gate = GATE_MAP[gateId];
  if (!gate) throw new Error('未知门: ' + gateId);

  // S5 是进程内门（不 spawn）
  if (gateId === 'S5') {
    const cls = classifyOpenP0(ctx.trackerText || '');
    return {
      gateId,
      name: gate.name,
      code: cls.openP0 > 0 ? 1 : 0,
      blocking: gate.blocking,
      detail: cls.openP0 > 0 ? 'P0 未闭环: ' + cls.openP0 : 'P0 未闭环: 0',
      // 严格口径分类信息（防护 3）：计数以外的分类只走 warnings 通道，不改判定
      warnings: cls.warnings,
      classification: { pending: cls.pending, inProgress: cls.inProgress, unbacked: cls.unbacked },
    };
  }

  // 子进程门
  let args = [...gate.args];
  if (gateId === 'S3' && ctx.tempReportFile) {
    args = args.map((a) => a === '<temp-report>' ? ctx.tempReportFile : a);
  }
  const code = await ctx.spawn(gate.script, args);
  return {
    gateId,
    name: gate.name,
    code,
    blocking: gate.blocking,
  };
}

// ---------------------------------------------------------------------------
// classifyFailure — 根据各门结果分类失败
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GateResult
 * @property {string} gateId
 * @property {string} name
 * @property {number} code - 退出码（0 = pass）
 * @property {boolean} blocking
 */

/**
 * @typedef {Object} ClassifyResult
 * @property {boolean} pass - 是否全部通过
 * @property {GateResult[]} failures - 失败的门（含非阻断信息段）
 * @property {GateResult[]} blockingFailures - 阻断失败的门
 * @property {string} summary - 人类可读摘要
 */

/**
 * 分类门执行结果。
 * @param {GateResult[]} results
 * @returns {ClassifyResult}
 */
export function classifyFailure(results) {
  const failures = results.filter((r) => r.code !== 0);
  const blockingFailures = failures.filter((r) => r.blocking);
  const pass = blockingFailures.length === 0;

  const lines = [];
  for (const r of failures) {
    lines.push((r.blocking ? '[BLOCK] ' : '[INFO]  ') + r.name + ' (exit ' + r.code + ')');
  }
  return {
    pass,
    failures,
    blockingFailures,
    summary: pass
      ? (failures.length ? 'PASS (信息段有非阻断退出码: ' + failures.map((f) => f.name).join(', ') + ')' : 'CI PASS')
      : 'FAIL (' + blockingFailures.map((f) => f.gateId).join(', ') + ')',
  };
}

// ---------------------------------------------------------------------------
// 导出
// ---------------------------------------------------------------------------

export default {
  GATE_TOPOLOGY,
  GATE_MAP,
  buildTempReportContent,
  OPEN_P0_MARKERS,
  OPEN_P0_MARKER_RE,
  OPEN_P0_PATTERN,
  EVIDENCE_REF_PATTERN,
  hasEvidenceRef,
  classifyOpenP0,
  countOpenP0,
  runGate,
  classifyFailure,
};
