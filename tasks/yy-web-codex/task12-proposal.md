# task12｜版本化 proposal 提交（M2）

状态：后续分门，未获实施授权。依据：PRD FR-07、§12–13；AT-16、18–20。

## 交付与关联

- 交付 `yy_propose_change` 的结构化提案、`expected_state_version`、幂等键及冲突结果。提案只能到 `PROPOSED`，不能自动推进阶段、签收或执行。
- 前置：task11 M1 门通过，task02 ADR 与 task03 C1 冻结且旧 CLI 覆盖风险已实证解决；后置：task13–15。选型：在 YY 唯一状态权威下存协作记录，namespace 边界由 ADR 定，不独立生成第二流程真值。
- 候选 seam：现有 `scripts/lib/store.mjs`、`state.mjs` 和生产 M 写工具；具体写文件与事务机制要先经阶段 5 合同冻结。

## GWT 验收

1. Given 网页提交有效建议，When 调提案接口，Then只保存原文、来源、范围与版本并返回 `PROPOSED`；workflow 阶段和 W 无变化。
2. Given 过期版本或相同幂等键不同 payload，When 提交，Then分别返回具名版本冲突或 `IDEMPOTENCY_CONFLICT`，不覆盖旧提案。
3. Given 相同幂等键与 payload 重试，When 再提交，Then回原结果且只存在一次持久副作用；旧 CLI 并发写不丢 namespace。

停止条件：任何路径可由提案直接触发执行时，M2 不开放。
