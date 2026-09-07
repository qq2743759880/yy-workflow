# dev-plan：Phase B 真机宿主闭环（严格派单版）

> 编排者按 dev-planner 执行 · v0.1 · 2026-08-31
> 承接批判：C-01 派单给子 agent / C-02 资产调用链验证 / C-03 完整切分 / C-04 真机宿主 / C-05 独立验收+记忆

## 设计文档前置链
- 设计文档：无（真机宿主接口设计见 task01 spec，已参考宿主验证记录）
- 依据：宿主真机验证记录（a6api HTTP 200，DeepSeek-V4-Flash-0731）；上轮独立验收 C-04

## 需求前提挑战
| # | Forcing Question | 结论 |
|---|---|---|
| Q1 | 需求真实性：最强证据 | C-04 已实锤：claude/codex 模型路由坏（exit 1），--exec 无可用真机宿主；a6api 单独验证成功但未固化 |
| Q2 | 现状方案 | --exec 通道就绪，宿主命令靠手动拼；无参考脚本/config/文档 |
| Q3 | 窄楔子 | ① a6api 参考宿主脚本 ② config/README 固化 ③ 真机端到端验证资产调用链 |
| Q4 | 未来适配 | 核心（编排内核可用性），长期需要 |

| # | Premise | 确认 |
|---|---|---|
| P1 | 本轮必须派单给子 agent 实现 + 独立测试 agent 验收（C-01） | agree |
| P2 | 本轮必须真实触发资产调用链并验证 assetConsumed（C-02） | agree |
| P3 | 不破坏回归 8/8；key 走 env 不写仓库 | agree |

## 任务总纲（GWT）
| task | 标题 | 依赖 | GWT 验收摘要 | 执行者 |
|---|---|---|---|---|
| task01 | a6api 参考宿主固化 | 无 | 当检查 scripts/exec-host-a6api.mjs + config.example + README 时，存在可复制宿主（读 brief→调 a6api→写 plan.md，key 走 env），无硬编码 key | **子 agent** |
| task02 | 真机资产调用链验证 | task01 | 当跑 T2 + `--exec` a6api 宿主时，be-* 资产 brief 含正文、宿主消费、assetConsumed=true、真实 LLM 产物 | **独立测试 agent** |
| task03 | 独立验收 + 回归 + 记忆 | task02 | 当独立测试 agent 审查时，回归 8/8、S3 14、无假成功；memory_write 记录 | **独立测试 agent** |

## 规划自审
- CEO：Scope=HOLD（只做真机宿主闭环 + 资产调用链验证，不扩）。不做=修 claude/codex 全局配置（用户代理体系）。处置：采纳。
- Eng：task01 宿主脚本零依赖（node fetch）；task02 用 --exec 链路（已有 S5 兜底）；key 注入用 env。风险=LLM 调用成本（真机）→ 单次小任务验证。
- Design：README 给可复制命令（key 占位 env）；config.example executor 参考。处置：采纳。

## 契约冻结清单
- [ ] 本轮无新契约文件（内核既有契约冻结覆盖）；task03 以回归 8/8 + 独立批判验收

## 风险清单
| 风险 | 影响 | 缓解 |
|---|---|---|
| a6api key 泄露 | 敏感 | key 只走 env（A6API_KEY），脚本不写死 |
| LLM 调用成本 | 费用 | 单次小任务（T2 login）验证，max_tokens 限 |
| 派单子 agent 质量 | 偏离 | task03 独立测试 agent 双盲验收 |
