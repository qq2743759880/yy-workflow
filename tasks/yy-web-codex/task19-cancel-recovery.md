# task19｜取消、断网、UNKNOWN 恢复与写面开关（M3）

状态：后续分门，未获实施授权。依据：PRD FR-11、§13；AT-28–29、43–44。

## 交付与关联

- 交付 `yy_cancel_job` 的幂等取消请求、worker 确认、断网继续/停止策略、UNKNOWN 核验路径和可审计 read-only/kill switch。
- 前置：task17/18；后置：task20/22。选型：取消是请求而非立即停止承诺；恢复先查真实副作用再决定重试。
- 候选 seam：job ledger、真实 YY adapter 和生产 M 写能力开关；开关位置需覆盖所有受管入口，阶段 5 冻结。

## GWT 验收

1. Given job 正在运行，When 网页重复取消，Then只记录一个取消意图，状态明确区分 requested 与 worker confirmed，结果可继续查询。
2. Given 网页断线或副作用后崩溃，When worker 恢复，Then依已授权策略继续/停下并核查副作用，UNKNOWN 不被改写为成功，也不盲重跑。
3. Given kill switch 打开，When 网页或旧入口尝试新业务写，Then受管写面关闭且已有 ledger、原始证据可读；恢复步骤明确。

停止条件：无法区分取消确认或恢复副作用时，后续任务保持人工核验。
