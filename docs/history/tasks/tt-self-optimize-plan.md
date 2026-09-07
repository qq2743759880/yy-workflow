# dev-plan：TT 自举优化（契约先行流水线 + agent-vision-toolkit 内核 + 方法论反哺）

> 由编排者按 dev-planner（优化版）执行 · 版本 v0.1 · 2026-08-31

## 设计文档前置链
- 设计文档：无（本批为编排内核 + 资产改造，直接以本计划为准）
- 依据：上一轮「下一阶段方案」Phase A/C；前 4 轮独立批判验收结论

## 需求前提挑战

| # | Forcing Question | 结论 |
|---|---|---|
| Q1 | 需求真实性：最强证据 | 三轮独立验收均指出"契约先行未代码化"（§5.1 方法论 vs runtime 只按 phase）；agent-vision-toolkit 是 16 资产唯一无对标 |
| Q2 | 现状方案 | 契约依赖靠主 agent 人工判 READY 集；vision 资产纯方法论无 VLM 内核声明 |
| Q3 | 窄楔子 | ① runtime 契约依赖解锁 ② vision-toolkit kernel ③ SKILL.md 系统卡点章节；Phase B（真机宿主）需用户配置，记录待办 |
| Q4 | 未来适配 | 核心（编排内核可信度 + 资产全覆盖），3 年后仍是基础能力 |

| # | Premise | 确认 |
|---|---|---|
| P1 | 契约先行应代码化（下游在依赖契约验收后才调度），非仅文档 | agree |
| P2 | agent-vision-toolkit 应补 VLM grounding 内核（OmniParser/UI-TARS） | agree |
| P3 | 不破坏现有回归（8/8）与硬约束 | agree |

## 任务总纲（GWT）

| task | 标题 | 依赖 | GWT 验收摘要 | 执行者 |
|---|---|---|---|---|
| task01 | 契约先行流水线代码化 | 无 | 当 subtask.dependsOn 含契约依赖且依赖契约未验收时，该子任务不调度；验收后解锁。回归 8/8 不破 | 编排者 |
| task02 | agent-vision-toolkit VLM 内核 | 无 | 当检查 vendor/agent-vision-toolkit/SKILL.md 时，含 Execution kernel 段（OmniParser v2 + UI-TARS，probe/降级），S3 扩至 14 项 | 编排者 |
| task03 | SKILL.md 系统卡点反哺 | task01, task02 | 当读 SKILL.md §5.1/§4 时，契约先行代码化 + 资产消费证据 + 规划 gate 以"系统卡点"呈现 | 编排者 |
| task04 | 独立批判验收 + 回归 | task01-03 | 当独立测试 agent 审查时，契约依赖解锁真实生效、S3 14 项、回归 8/8 | 独立测试 agent |

## 规划自审

- **CEO 范围**：Scope = HOLD（契约先行代码化 + vision 内核 + 文档反哺，不扩）；不做 = Phase B 真机宿主（需用户配 claude/codex）、Outside Voice（需外部 codex）。处置：采纳 HOLD。
- **Eng 架构**：task01 改 runtime.mjs 调度器（dependsOn 加类型字段，契约依赖检查契约文件存在 + gate hash）；风险 = 并行调度器回归 → S4 契约 tamper + S5 并行 smoke 兜底。
- **Design 体验**：task03 文档用"系统卡点"呈现，主 agent 可读；视觉无新 UI。处置：采纳。

## 契约冻结清单
- [ ] task01 无契约文件（内核改造，S4 回归兜底）；task04 以 regression-all 8/8 + 独立批判为验收

## 风险清单
| 风险 | 影响 | 缓解 |
|---|---|---|
| 契约依赖改造破坏并行 DAG | 回归失败 | S4/S5 兜底；先串行再并行验证 |
| vision kernel 与 S3 marker 冲突 | S3 FAIL | 写段时保证 marker 词含 ACTIVE 语境 |
