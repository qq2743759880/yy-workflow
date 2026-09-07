# dev-plan（任务总纲）

> 由 dev-planner 生成 · 版本 v0.0 · 更新日期

## 设计文档前置链（FR-301）

> 设计文档→评审→任务。有 design-doc 时以此为准，缺失可跳过但须注明理由。

- 设计文档：有 / 无（路径：`docs/designs/{slug}.md`）
- `Supersedes:`（修订时引用上一版文件名）：___
- 评审依据声明：本计划以 `design-doc.md` 的 `§Premises` / `§Approaches` 为选型依据（可引用章节号）
- 缺失处理：推荐先补（走 §2.1 需求挖掘或产出 design-doc），可跳过；跳过理由：___

## 目标

（一句话：本阶段要交付什么）

## 需求前提挑战（FR-101）

> 拆任务前必须回答"为什么现在做 / 现状方案 / 最小范围 / 前提是否成立"，前提未确认不得拆任务。

### 4 问结论区

| # | Forcing Question | 结论 |
|---|---|---|
| Q1 | 需求真实性：最强证据是什么？（不是"感兴趣"，而是"明天消失会抓狂"） | ___ |
| Q2 | 现状方案：用户当前 workaround 是什么？代价多大？ | ___ |
| Q3 | 窄楔子：本周可交付的最小版本是什么？（+ 不做清单） | ___ |
| Q4 | 未来适配：3 年后此功能更核心还是更边缘？ | ___ |

### Premise 确认表（逐条 agree/disagree，任一推翻 → 回需求澄清）

| # | 前提陈述 | 确认 |
|---|---|---|
| P1 | ___ | agree / disagree |
| P2 | ___ | agree / disagree |
| P3 | ___ | agree / disagree |

## 任务总纲
| task | 标题 | 依赖类型(契约/完成) | 依赖 | GWT 验收摘要 | 平台/agent | 契约(如有) |
|------|------|------|------|------|------|------|
| task01 | ... | 契约 | task00 | 当 X 时 Y 应 Z | backend/trae | contracts/<planId>.json（机器冻结）· handoffs/task01-contract.md（人工单） |

## 规划自审（FR-201，CEO→Eng→Design 串行，Design 收尾）

> 派单前强制三视角自审各 ≥1 条 finding（可写"No issues found + 检查了什么"，不许整块留空）。
> 视角提示词与输出格式见 `$SKILL_DIR/templates/plan-review-perspectives.md`；机验：`node scripts/review-gate.mjs --plan <本文件>`。

### CEO 范围自审
- Scope Mode 判定：EXPANSION / SELECTIVE EXPANSION / HOLD SCOPE / SCOPE REDUCTION（选一）
- 不做清单复核：无遗漏 / 有遗漏（列出）
- 每项 deferred 写了理由：是 / 否
- Finding（≥1）：___
- 处置（采纳 / 驳回+理由）：___

### Eng 架构自审
- 架构边界 / 数据流 shadow path（nil/空/上游错误）已检查：是 / 否
- 测试覆盖缺口：___
- 性能与 N+1：___
- Finding（≥1，格式 `[P1] (confidence: N/10) file:line — desc`，须引用具体行）：___
- 处置：___

### Design 体验自审
- 交互状态表：LOADING / EMPTY / ERROR / SUCCESS / PARTIAL
- AI slop 检查：___
- 无障碍（对比度 4.5:1 / 命中区 44px）：___
- Finding（≥1）：___
- 处置：___

## 执行顺序
（拓扑排序 + 可并行集说明）

## 契约冻结清单
- [ ] `contracts/<planId>.json` 已机器冻结 + gate hash 比对通过（`node scripts/orchestrator.mjs --resume` 验证 exit 0）
- [ ] taskNN-contract.md 已冻结 + 测试 agent 核验 `契约已验收`

## 风险清单
| 风险 | 影响 | 回滚/缓解 |
|------|------|----------|
