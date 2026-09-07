# T14 Report — TT-OPTIMIZATION-PRD 撰写

- 日期：2026-09-02
- 执行方：TT 工作流 PRD 撰写子 agent
- 任务：为 TT 下一阶段优化（自动任务拆解规划 + 终端 TUI 实时 DAG）生成正式 PRD（8 步法）并出具本报告
- 交付物：`docs/TT-OPTIMIZATION-PRD.md`（新增）+ 本报告

## 任务执行说明

按派单要求完成 8 节 PRD，写作前对源码做了**只读核对**（未改动任何内核代码），确保 §3「源码实况核对」引用的行号/字段为 2.3.0 基线实测值，非凭记忆编写：

- `scripts/lib/planner.mjs` `buildPlan`（L21-41）：plan schema 事实源，含 `phase`/`dependsOn`，缺估算/lane/描述字段
- `scripts/lib/runtime.mjs` `executePlan`（L42-89）+ `runGroup`（L91-133）：phase 分组执行、DAG 归一化、`--parallel` 上限；缺逐子任务 onStatus 事件钩子
- `scripts/orchestrator.mjs` `parseArgs`（L18-37）、`freezeContract`（L54-62）、`resumePlan`（L43-52）：现有 flag 清单与契约冻结路径
- `scripts/lib/state.mjs` `STATE`/`TRANSITIONS`：审批采用 `approvedAt` + 逐 task `approved` 字段，不新增状态值（防回归）
- `scripts/lib/store.mjs` `.tt-state/state.json`：TUI 数据源；指出「收尾全量写、无实时事件」这一诚实缺口（FR-4 前置依赖 M2-1）

## PRD 要点摘要

1. **需求来源**：用户五痛点 + 两块范围 + 长期优先级（编排智能度>真机执行>前端设计）+ 辅助建议模式 + 纯 ANSI 零依赖 TUI + 不造轮子。
2. **设计对齐**：spec_driven_develop（拆解三层 + S.U.P.E.R + 并行判据 + 确认门）、open-multi-agent（preview→approve→freeze→replay 状态机）、turbo-ui（自绘任务树 + 状态色 + 非 TTY 降级）；明确不引 ink/dagre（行结构 + 零依赖理由）。衔接点：buildPlan schema、state.json、freezeContract、dev-planner、matrix 簇 phases。
3. **源码实况核对**：5 张实况表 + 9 条改造点（M1: deconstruct/approve/--plan/兼容扩展；M2: onStatus 钩子/tui 渲染器/触发/关键路径计算）。
4. **功能条目化**：FR-1 拆解引擎🔴 / FR-2 审批🔴 / FR-3 plan 兼容🔴 / FR-4 TUI DAG🟡 / FR-5 TUI 触发⚪，每条含 GWT 验收。
5. **批判审查**：5 条（C1 完整框架 vs 零依赖、C2 ink vs 自绘、C3 审批疲劳可用性、C4 LLM 幻觉/漂移兜底、C5 Windows/CI TTY 兼容），均带真实 URL，结论回灌 §2/§7。
6. **状态标注**：✅（8 步闭环/plan schema/调研结论）◐（估算 lane 缺、兼容扩展）⬜（拆解引擎/审批/TUI/onStatus）。
7. **里程碑/风险/验收**：M1 拆解+审批、M2 TUI；5 条风险（拆解质量、TTY 兼容、审批疲劳、回归破坏、flag 组合）；验收=回归 8/8 + GWT + 可移植性 0 泄露 + 诚实门。
8. **修订记录**：v1.0 2026-09-01 初版。

## 节数统计

8 节齐全（需求来源 / 设计对齐 / 源码实况核对 / 功能条目化 / 批判审查 / 状态标注 / 里程碑风险验收 / 修订记录）。

## 批判条数

**5 条**（≥3 达标），每条含竞品对标 + 证据 URL。

## 验收对照

- [x] `docs/TT-OPTIMIZATION-PRD.md` 存在，8 节齐全
- [x] FR-1～FR-5 各含 GWT 验收（Given/When/Then 格式）
- [x] 批判审查 ≥3 条（实为 5 条）且含真实 URL（open-multi-agent / MetaGPT / TaskWeaver / OpenHands / ink / turborepo / dagre / spec_driven_develop）
- [x] 参考项目带真实 URL（§2.1 表）
- [x] 本机绝对路径 0 泄露：PRD 与报告均使用相对路径（`scripts/...`、`docs/...`），未出现盘符前缀、用户目录或用户名
- [x] 诚实标注：✅/◐/⬜ 三态均如实；明确标注「拆解调研完成但实现⬜」「onStatus 缺口」「drift 重拆归下期」

## 诚实声明

- 本任务为文档层交付：仅新增 2 个文档文件，未改动任何 scripts/、vendor/、SKILL.md、frontmatter/version。
- 未运行 `node scripts/regression-all.mjs`（本次无内核改动，不适用）；PRD 中引用的行号/字段经只读源码核对，回归基线 8/8 为任务派单给定已核实事实。
- PRD 中对「范围外」功能（批判反哺自动化、失败自动恢复、监控驱动自动优化、drift 重拆）均明确标注归下期，未夸大本阶段交付。
