# task F3 · orchestrator 尾部自动经验摘要（memory 自动化）

> 执行者：子 agent。验收者：独立测试 agent。

## 目标
orchestrator 执行完后自动写经验摘要文件（runtime 是纯 Node 不能直接调 MCP memory_write，故写文件 + console 提示编排者 memory_write）。

## 改动
`scripts/orchestrator.mjs` main 尾部（state: done 后）：
- 提取经验摘要：plan.modes、plan.warnings、plan.status、plan.degraded、子任务 assetConsumed 比例、失败/skipped 原因
- 写 `artifacts/<planId>/memory-snapshot.md`（含：执行结果、调用率、改进点、memory_write 提示）
- console 输出 `[tt] memory-snapshot: <路径>（编排者可 memory_write）`
- dry-run 不写

## GWT
- Given orchestrator 跑完任务；When state: done；Then artifacts/<planId>/memory-snapshot.md 存在含 modes/warnings/调用率
- Given --dry-run；Then 不写 memory-snapshot
- Given `node scripts/regression-all.mjs`；Then 8/8 不破（S4/S5 临时 workspace 也会产 snapshot，清理不影响）

## 纪律
- 只改 `scripts/orchestrator.mjs`（尾部追加，不破坏既有逻辑）；自测 GWT；不 commit。
