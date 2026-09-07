# dev-plan：A/B 级竞品实跑验证（多宿主派单）

> 编排者按 dev-planner 执行 · v0.1 · 2026-08-31
> 依据 PRD：`.claude/specs/thirdparty-replacement-plan.md`（A/B/C 三档）

## 需求前提挑战
| # | Forcing Question | 结论 |
|---|---|---|
| Q1 | 需求真实性 | 用户批评资产空壳——A/B 级竞品已部署但未验证真实调用 |
| Q2 | 现状 | portman/opencode 已装未真跑；gpt-researcher/metagpt 未装（pip 冲突） |
| Q3 | 窄楔子 | A1 portman 实际契约校验 / A2 opencode 实跑 / B1 venv gpt-researcher / B2 venv metagpt |
| Q4 | 未来适配 | 核心（资产真实可执行） |

| # | Premise | 确认 |
|---|---|---|
| P1 | 用真机宿主（claude/codex/openclaw）独立上下文执行验证（TT 派单） | agree |
| P2 | 不破坏回归 8/8 | agree |
| P3 | B 级用独立 venv（避免污染主环境） | agree |

## 任务总纲（GWT）
| task | 标题 | 依赖 | GWT 验收摘要 | 执行宿主 |
|---|---|---|---|---|
| A1 | be-validator→portman 实际契约校验 | 无 | 当用 portman 校验真实 OpenAPI 契约时，产出 pass/diff 结果（非仅探测 --version） | claude |
| A2 | implementation→opencode 实跑 | 无 | 当 orchestrator `--exec opencode` 跑实现任务时，opencode 真实执行产出方案 | codex |
| B1 | venv 装 gpt-researcher（agent-research 打通） | 无 | 当独立 venv 装 gpt-researcher 时，import 成功且可跑基本调研 | openclaw |
| B2 | venv 装 metagpt（planning 打通） | B1 | 当独立 venv 装 metagpt 时，import 成功 | openclaw |

## 规划自审
- CEO：HOLD scope（只验证 A/B 实跑，不扩）。不做=C 级（闭源/GPU）。处置：采纳。
- Eng：A1 用真实 OpenAPI 契约文件（构建最小样例）；A2 opencode 实跑会真实产生代码（用小任务，限时）；B1/B2 venv 隔离。风险=宿主执行慢/环境 → 超时兜底。
- Design：宿主 kickoff prompt 含 spec 路径 + GWT + 产出要求。处置：采纳。

## 契约冻结清单
- [ ] 无新契约；验收 = 各宿主验证报告 + 回归

## 风险清单
| 风险 | 缓解 |
|---|---|
| 宿主 CLI 执行慢/挂起 | 超时 + 宿主自超时 |
| B venv 装包大/失败 | 独立 venv 隔离，失败诚实记录 |
