# task02｜全写者清单与单一权威 ADR（M0）

状态：M0 写者/读者地图已完成；active-store 统一与恢复验证留作 M2/M3 硬门，不扩入 M1。依据：PRD §13、§18；AT-24–25、47 前置。证据：`docs/yy-web/AUTHORITY-AND-THREAT-MAP.md`。

## 交付与关联

- 交付现有 `state.json`、namespace/append、CLI、adapter、MCP、人工/通用写 API 全写路径与 lock/lease/备份恢复图；ADR 决定 proposal 与 YY workflow 状态如何共存、由谁拥有 active store。
- 前置：task01 固定版本；后置：task03 决策、task06 只读一致性、task12 首次持久写、task15/22 旁路与迁移。选型：延续 `scripts/lib/store.mjs` / `state.mjs` 与现有状态权威，不建第二套 workflow 真值。
- 调用面：阅读现存保存/追加路径并用隔离副本做并发和恢复试验；生产业务 W 不写。候选 ADR 位于 `docs/`，存储选择在 ADR 冻结。

## GWT 验收

1. Given 旧 CLI 与新入口同时写，When 用同一初始版本模拟更新，Then 给出串行或版本冲突的可复现证据，namespace/回执无丢失；无法保证时 M2 写门关闭。
2. Given 新提案准备持久化，When 对照 ADR 与全部写者，Then 能指出唯一 active store owner、备份/恢复顺序及旧客户端行为，任何遗漏写者标阻塞。
3. Given 状态迁移失败或中断，When 回滚，Then 有原始版本恢复证据且不出现两个可写主存储。

停止条件：旧 CLI 覆盖风险未实证解决前不得执行 task12 的首次写入。
