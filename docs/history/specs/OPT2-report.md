# OPT2 报告 — SKILL 去冗余 + 前置条件替换 describe

- 日期: 2026-09-02 · 执行: TT 工作流（子 agent 实现，中断后编排者接续验证）
- 基线: TT 2.7.0

## 一、SKILL.md 去冗余（减幻觉）

| 项 | 前 | 后 |
|---|---|---|
| 行数 | 342 | 300（-42 行） |
| 失效引用 | schemas.py / error_codes.py / collaboration-protocol / §6.7 / §5d / "v2.2 自包含" | 全部清除 |
| 版本引用 | v2.7 过时 | v2.8 |
| 章节骨架 | 12 节 | 12 节全保留（validate 0 警告） |

清除内容：失效的 schemas.py/error_codes.py/collaboration-protocol 引用（改为与 orchestrator 契约冻结一致）；§2.2 与 §5 重复的"独立实证/不采信报告"句；§6 与 §5.4 重复验收门；§0 自包含说明版本修正。

## 二、前置条件替换 describe 契约（提调用率）

- matrix.mjs：5 个 cluster 各加 `preconditions` 结构化前置条件（T2 含 requireExec 硬约束）
- planner.mjs：cluster.preconditions 复制到 plan.preconditions + subtask
- prompt.mjs：brief 组装加「前置条件（硬约束）」段
- runtime.mjs：`plan.requireExec && preconditions.length` 时，上游未 done/未 consumed → 下游 `skipped DEP_PRECONDITION`（诚实降级，不假装开工）
- kickoff-prompt.md：开工前核对前置条件

## 三、独立验收（编排者实测）

- validate 0 警告 0 泄露；regression 8/8；ci PASS
- 失效引用 grep 全清除；SKILL 300 行
- T2 --backend prompt 实测：brief 含「前置条件（硬约束）」段；7 个子任务因上游未满足资产消费前置被 skipped（DEP_PRECONDITION）——无真实资产消耗不开工，调用率机制生效

## 四、诚实局限

- DEP_PRECONDITION 使无宿主时 T2 大量 skip（更诚实但"完成度"更低）——这是设计意图：宁可不做假开工
- preconditions 是声明式字符串（人类可读），非机器可执行断言；机验仍靠 assetConsumed/D-1