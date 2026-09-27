# task07｜当前阶段卡与前置投影（M1）

状态：本地 current-stage 投影已修正并通过 fixture 用例；部分阶段缺精确命令/退出条件，Stage 全量验收未建立。依据：PRD FR-03；AT-05。证据：`docs/yy-web/RELEASE-EVIDENCE-20260927.json`。

## 交付与关联

- 交付 `yy_get_stage` 的阶段说明、前置/退出条件、证据要求、阻塞原因和下一步。0–8 节点及命令别名与现有 journey/phase 同源。
- 前置：task06 同源快照、task03 权限合同；后置：task11。选型：读取现有阶段定义和激活逻辑，不维护另一份硬编码阶段表。
- 候选 seam：现有 `scripts/lib/journey.mjs` / activation 与生产 M 的只读投影；错误码和卡片文案在阶段 5 冻结。

## GWT 验收

1. Given 每个 0–8 节点及有效别名，When 读取阶段卡，Then 前置和退出条件与现有 journey 判定一致，包含对应证据要求。
2. Given 阶段阻塞或别名未知，When 查询，Then明确说明阻塞/未知，不给出可执行错觉或跳过门槛的建议。
3. Given workflow 版本变更，When 重新读取，Then卡片明确归属新版本，旧卡片不冒充实时状态。

停止条件：与 Core 阶段判定不一致时，以 Core 为权威并阻断该卡发布。
