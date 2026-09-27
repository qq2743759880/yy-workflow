# task20｜网页请求→本地执行→网页回读 E2E（M3）

状态：后续分门，未获实施授权。依据：PRD UJ-04/06、§22；AT-21–36、42–44、47。

## 交付与关联

- 交付真实授权链的完整原始调用、job/状态/证据回读、RF1 五场景回归、越权/重放/断网/迁移故障结果与分项 gate 判定。
- 前置：task16–19 与 task05 oracle；后置：task22 扩大写面发布。选型：在真实双宿主、生产 M 和隔离授权 W 上验证；闭环不能只靠单元模拟。
- 调用面：网页 GPT→生产 M→YY Core/Worker/真实 adapter→证据→网页回读，同时运行旧 CLI 并发与通用写旁路反例。

## GWT 验收

1. Given 有效 Owner 签收和授权 W，When 网页请求、worker 执行并回读，Then签收对象、job、原始输入/输出、状态版本及 evidence refs 同链可核对；流程/验证分列。
2. Given 失效签收、重放键、旧 lease、伪 Owner、通用写旁路和旧 CLI 并发，When 逐项尝试，Then拒绝或具名冲突，不能丢回执、跨 W 或绕过阶段门。
3. Given 客户端断线、崩溃/取消、迁移失败与 RF1 五场景，When 恢复和回读，Then结果不假绿、不复活已关闭 RF1、状态可回退；不可实测项明示 `ENVIRONMENT_UNAVAILABLE`。

停止条件：任一受管业务写绕过授权、证据缺失却关闭流程，M3 门 FAIL。
