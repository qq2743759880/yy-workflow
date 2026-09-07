# task F1 · asset-call-rate.mjs 统计+阈值触发

> 执行者：子 agent。验收者：独立测试 agent。

## 目标
跑 orchestrator 任务后读 state.json，统计每个资产的调用率（路由/正文/消费证据），低于阈值的资产标记"需审查"并登记 tracker。

## 改动
新增 `scripts/asset-call-rate.mjs`（零依赖 Node）：
- 输入：`--state <state.json 路径>` 或 `--task <任务文本>`（自动跑 orchestrator）
- 读 state.json → 逐子任务统计：路由（asset 非空）、正文（brief 含方法论正文）、消费（assetConsumed=true）
- 计算总调用率 + 每资产调用率
- 阈值：消费率 < 50% → 标记"需审查"（输出 + 提示登记 tracker）
- 输出：控制台报告（每资产行 + 总调用率 + 需审查清单）+ 写 `artifacts/asset-call-rate-report.md`

## GWT
- Given state.json（T2 8 子任务）；When 跑 asset-call-rate；Then 输出每资产调用率 + 总率 + planned-only 资产标"需审查"
- Given 全 exec assetConsumed=true；Then 调用率 100% + 无需审查
- Given `node scripts/regression-all.mjs`；Then 8/8 不破（asset-call-rate 是独立脚本不影响回归）

## 纪律
- 只新增 `scripts/asset-call-rate.mjs`；自测 GWT；不 commit。
