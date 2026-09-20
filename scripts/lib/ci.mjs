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
    description: 'critique-backlog-tracker.md 中 P0 未闭环条数 = 0',
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
// countOpenP0 — S5 P0 硬闸门逻辑（纯函数，读入文本）
// ---------------------------------------------------------------------------

/**
 * 从 critique-backlog-tracker.md 文本中统计未闭环 P0 条数。
 * 与 ci.mjs 内联逻辑一致：过滤 `| C-` 行，含 `| P0 |` 且含 `⬜`。
 * @param {string} trackerText - tracker markdown 全文
 * @returns {number} 未闭环 P0 条数
 */
export function countOpenP0(trackerText) {
  if (!trackerText) return 0;
  const lines = String(trackerText).split('\n').filter((l) => /^\| C-/.test(l.trim()));
  return lines.filter((l) => l.includes('| P0 |') && l.includes('⬜')).length;
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
    const p0Open = countOpenP0(ctx.trackerText || '');
    return {
      gateId,
      name: gate.name,
      code: p0Open > 0 ? 1 : 0,
      blocking: gate.blocking,
      detail: p0Open > 0 ? 'P0 未闭环: ' + p0Open : 'P0 未闭环: 0',
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
  countOpenP0,
  runGate,
  classifyFailure,
};
