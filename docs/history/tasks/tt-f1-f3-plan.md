# dev-plan：F1 资产调用率监控 + F3 memory 自动化

> 编排者按 dev-planner · v0.1 · 2026-08-31 · MUSE 融合 F1/F3

## 需求前提挑战
| # | Q | 结论 |
|---|---|---|
| Q1 | 真实性 | 资产调用率 75%（2 planned-only 无消费）、memory 写回 35%——MUSE 融合方案 F1/F3 |
| Q2 | 现状 | 无调用率监控脚本；memory_write 靠人工触发 |
| Q3 | 窄楔子 | F1 asset-call-rate.mjs 统计+阈值触发；F3 orchestrator 尾部自动写经验摘要 |
| Q4 | 未来 | 核心（自进化闭环监控+自动化记忆） |

| # | Premise | 确认 |
|---|---|---|
| P1 | 派单子 agent + 独立验收 | agree |
| P2 | 不破坏回归 8/8 | agree |
| P3 | F3 写经验摘要文件（runtime 是纯 Node 不能直接调 MCP memory_write） | agree |

## 任务总纲（GWT）
| task | 标题 | GWT | 执行 |
|---|---|---|---|
| F1 | asset-call-rate.mjs 统计+阈值 | 当跑任务后读 state.json，统计每资产路由/正文/assetConsumed 调用率，低于 50% 消费率标记"需审查"，输出报告 | 子 agent |
| F3 | orchestrator 尾部自动经验摘要 | 当 orchestrator 执行完后，自动写 artifacts/<planId>/memory-snapshot.md（modes/warnings/status/经验），console 提示 memory_write | 子 agent |

## 规划自审
- CEO：HOLD scope。处置：采纳。
- Eng：F1 读 state.json（已有字段）；F3 改 orchestrator.mjs 尾部写文件。风险低。
- Design：F1 输出可读报告；F3 经验摘要含可操作改进点。处置：采纳。
