# dev-plan：Phase C 编排内核深化 + D-1 证据强化（严格派单版）

> 编排者按 dev-planner 执行 · v0.1 · 2026-08-31

## 需求前提挑战
| # | Forcing Question | 结论 |
|---|---|---|
| Q1 | 需求真实性 | C-1 上轮验收登记"dependsOn 级契约验收未实现"；C-2 回归无 CI 触发；D-1 独立验收 P2 建议证据强化 |
| Q2 | 现状 | 契约=每子任务存在性校验（上游缺失下游仍执行）；regression-all 本地命令；资产消费锚点-only 弱证据 |
| Q3 | 窄楔子 | C-1 契约未验收下游 cascade skip / C-2 ci.mjs 一键 / C-3 SKILL 系统卡点 / D-1 kernel 资产锚点+内核词 |
| Q4 | 未来适配 | 核心（编排可信 + 自动验收） |

| # | Premise | 确认 |
|---|---|---|
| P1 | 实现派子 agent、验收独立测试 agent（不重蹈自写自验） | agree |
| P2 | 不破坏回归 8/8；契约 cascade skip 不误伤正常 run | agree |
| P3 | D-1 强化不破坏 S8（需同步更新 S8 宿主） | agree |

## 任务总纲（GWT）
| task | 标题 | 依赖 | GWT 验收摘要 | 执行者 |
|---|---|---|---|---|
| C-1 | dependsOn 级契约验收解锁 | 无 | 当上游契约缺失 CONTRACT_NOT_FROZEN skip 时，下游依赖子任务 cascade skip（DEP_CONTRACT_NOT_FROZEN），plan failed | 子 agent A |
| C-2 | ci.mjs 一键卡点 | 无 | 当 `node scripts/ci.mjs` 时，依次跑 validate+review-gate+plan-review+regression-all 8 段，任一 fail exit 1 | 子 agent B |
| D-1 | 资产消费证据强化 | 无 | 当带 Execution kernel 资产执行时，产物须含锚点且 ≥1 内核词；S8 宿主同步 | 子 agent C |
| C-3 | SKILL.md 系统卡点章节 | C-1, C-2, D-1 | 当读 SKILL.md §4/§5.4 时，契约 cascade/ci.mjs/证据强化以系统卡点呈现，命令真实可跑 | 编排者（文档反哺） |
| 验收 | 独立测试 agent 全面验收 | C-1..C-3 | 契约 cascade 实测、ci.mjs 一键、D-1 强化、回归 8/8、无假成功 | 独立测试 agent |

## 规划自审
- CEO：HOLD scope；不做=Outside Voice（需外部 codex）。处置：采纳。
- Eng：C-1 改 runtime 调度（cascade skip，保守）；D-1 改 prompt.mjs（kernel 词要求，需同步 S8/回归）；C-2 新脚本零依赖。风险=契约 cascade 误伤 → 正常 run 契约恒存在不受影响。
- Design：C-3 文档用"系统卡点"表呈现，命令可复制。处置：采纳。

## 契约冻结清单
- [ ] 本轮无新契约；验收 = ci.mjs 一键 + 独立批判

## 风险清单
| 风险 | 缓解 |
|---|---|
| C-1 cascade 误伤正常 run | 契约恒存在（freeze 写），仅 resume 删契约触发 |
| D-1 破坏 S8 | spec 明确同步 S8 宿主 |
| 子 agent 偏离 | 独立测试 agent 双盲验收 |
