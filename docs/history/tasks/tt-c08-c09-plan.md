# dev-plan：C-08/C-09 adapter 真调修复（独立子 agent 派单）

> 编排者按 dev-planner 执行 · v0.1 · 2026-08-31
> 承接批判：C-08（portman adapter 未真调 CLI）/ C-09（opencode adapter 无 assetConsumed）

## 需求前提挑战
| # | Forcing Question | 结论 |
|---|---|---|
| Q1 | 需求真实性 | 上轮 claude/openclaw 宿主验证发现的真缺陷（A1/A2 报告） |
| Q2 | 现状 | portman.mjs 只 hash 记录；opencode.mjs 无 assetConsumed |
| Q3 | 窄楔子 | C-08 portman 真调 CLI 产出 pass/diff；C-09 opencode 成功路径置 assetConsumed |
| Q4 | 未来适配 | 核心（adapter 真实执行） |

| # | Premise | 确认 |
|---|---|---|
| P1 | 实现派独立子 agent、验收派独立测试 agent（TT 纪律） | agree |
| P2 | 不破坏回归 8/8；prompt adapter 的 D-1 语义不变 | agree |
| P3 | portman 真调需契约文件是 OpenAPI JSON | agree |

## 任务总纲（GWT）
| task | 标题 | 依赖 | GWT 验收摘要 | 执行 |
|---|---|---|---|---|
| C-08 | portman.mjs 真调 CLI | 无 | 当契约是 OpenAPI 文件且 portman 可用时，跑 portman 真实校验产出 pass/diff（非仅 hash 记录） | 子 agent A |
| C-09 | opencode.mjs 置 assetConsumed | 无 | 当 opencode 执行成功时，子任务 assetConsumed=true | 子 agent B |

## 规划自审
- CEO：HOLD scope；不扩。处置：采纳。
- Eng：C-08 用已装 portman 1.35 真跑（契约文件 + `portman --local --runNewman` 或 lint）；C-09 opencode 成功即 true（专用 CLI 可信）。风险=portman 校验需 baseUrl/Newman → 最小化（lint/collection 生成）。
- Design：无 UI。处置：采纳。

## 契约冻结清单
- [ ] 无新契约；验收 = 独立测试 agent + 回归 8/8

## 风险清单
| 风险 | 缓解 |
|---|---|
| portman --runNewman 需 baseUrl | 用 --local + mock baseUrl 或降级 lint/collection |
| C-09 assetConsumed 影响 S8 | 只改 opencode.mjs，prompt 不变 |
