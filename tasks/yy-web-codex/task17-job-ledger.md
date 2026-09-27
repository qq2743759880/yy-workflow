# task17｜持久 job 状态、查询、租约与 fencing（M3）

状态：后续分门，未获实施授权。依据：PRD FR-09、§13；AT-26–27、29。

## 交付与关联

- 交付 `yy_get_job`、持久 job ledger、重试查询、worker lease/fencing 和日志/结果增量；请求超时后能找回同一个 job。
- 前置：task16 的授权请求合同；后置：task18/19。选型：在 YY 单一状态权威的协调面持久化 job 与 lease，不靠网页连接存活维持执行。
- 候选 seam：task02 冻结的存储策略及现有 YY adapter/worker 控制入口；实际 job 状态机在阶段 5 冻结。

## GWT 验收

1. Given 提交 job 后客户端超时，When 同键重试或按 job ID 查询，Then找回唯一已接受任务及日志游标，无第二次副作用。
2. Given 老 worker lease 失效并被新 owner 接管，When 老 worker 回传，Then fencing 拒绝其状态覆盖，保留审计记录。
3. Given job 崩溃在副作用与回执之间，When 查询，Then标 `UNKNOWN` 或待核验，不伪造成功或盲目重跑。

停止条件：持久性或 fencing 无法实证时，task18 不调用真实业务 adapter。
