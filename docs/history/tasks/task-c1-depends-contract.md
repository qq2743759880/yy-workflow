# task C-1 · dependsOn 级契约验收解锁（cascade skip）

> 执行者：子 agent A。验收者：独立测试 agent。

## 目标
契约未验收（CONTRACT_NOT_FROZEN）时，下游依赖子任务不得继续执行——实现"契约未验收下游不派单"的代码化。

## 改动
`scripts/lib/runtime.mjs`（runGroup/调度）：当某子任务因契约缺失被 skip（CONTRACT_NOT_FROZEN），其**下游依赖子任务**（dependsOn 含该 skipped 子任务，或 phase 在其后且共享 plan 契约）也 cascade skip（error=`DEP_CONTRACT_NOT_FROZEN`，warn 注明"依赖契约未验收，下游不派单"），并保持 `plan._contractMissing` → plan failed（exit 5，已实现）。

**保守实现**：子任务 dispatch 前，若 plan._contractMissing 已置（上游契约缺失 skip 已发生）→ 该子任务直接 skip（DEP_CONTRACT_NOT_FROZEN），不 dispatch。依赖关系用 dependsOn 匹配（被 skip 的 CONTRACT_NOT_FROZEN 子任务 id 在自身 dependsOn 或同 plan 契约）。

## GWT
- Given 正常 run（契约存在）；Then 全部正常执行，exit 0（不误伤）
- Given resume 前删契约 + 混合状态（部分 done）；Then 未 done 子任务全 cascade skip（DEP_CONTRACT_NOT_FROZEN），plan failed，exit 5
- Given `regression-all.mjs`；Then 8/8 不破（S4 resume 复用契约存在 → 不触发）

## 纪律
- 只改 `scripts/lib/runtime.mjs`（+ 必要注释）；不碰其它文件
- 完成后自测 3 GWT，报告命令输出
