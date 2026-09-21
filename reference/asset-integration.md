# 附 A2：资产整合与平台探测（来源：SKILL.md §1 + §1c，自包含可读）

> 本文件是 YY 资产整合阶段的权威说明（原 SKILL.md §1/§1c 迁移至此）。阶段 0（立项/资产整合）或组装 kickoff prompt 时读取。

## 资产整合红线（第 0 步，前置）

- **资产清单以实际部署为准**：引用任何 skill/mcp 前先确认存在（`scripts/detect-platforms.mjs` 或 `Test-Path`），**不引用不存在的资产**。
- **平台能力差异必须先探明**：无 `Workflow()` API/某 MCP → 手动阶段调度 + CLI/Python 校验；沙箱拦 git commit/受保护路径 → 编排者沙箱外补；先验证渲染产物非过时，缺失先注入再开工。
- **角色分配算法**（替代固定平台角色）：探测到 N 个平台 → 编排者 = 用户指定或首个平台；其余按能力启发式分域（前端/后端/调研/审查），结果可手工覆写；N=1 → 单平台模式。
- **资产分级**（核心/增强/外部三级明细见 `reference/frontend-gate.md` §6.6）：核心 = dev-planner + templates（必须有，validate 校验）；增强 = 随包 vendor 资产（下表），缺失走内置通用步骤；外部 = TTHP（可选）。

## 随包内置资产清单（vendor/，自包含核心）

下列资产已随本 skill 分发于 `$SKILL_DIR/vendor/<name>/`，任何拿到本 skill 的用户都能直接用，不依赖外部 AI-Hub：

| 类别 | 资产 | 路径 |
|------|------|------|
| 核心规划 | dev-planner（只读规划 agent） | `$SKILL_DIR/vendor/dev-planner/dev-planner.md` |
| 需求挖掘簇 | planning（formal-prd + vibe-prd，原 prd-writer + vibe-coding-prd 合并） | `$SKILL_DIR/vendor/planning/SKILL.md` |
| 前端设计簇 | frontend-design（生成/品味/设计数据/组件选型/原型五合一） | `$SKILL_DIR/vendor/frontend-design/SKILL.md` |
| 前端辅助 | colorize、frontend-visual-validation | `$SKILL_DIR/vendor/<name>/SKILL.md` |
| 评审簇 | review（critique + be-tester + polish 三合一） | `$SKILL_DIR/vendor/review/SKILL.md` |
| 安全簇 | security（audit + harden + be-security 三合一） | `$SKILL_DIR/vendor/security/SKILL.md` |
| 调研 | agent-research | `$SKILL_DIR/vendor/agent-research/SKILL.md` |
| 视觉质检 | agent-vision-toolkit | `$SKILL_DIR/vendor/agent-vision-toolkit/SKILL.md` |
| 安全扫描 | skill-sentinel | `$SKILL_DIR/vendor/skill-sentinel/SKILL.md` |
| 后端工程 | sdlc（BMAD-METHOD 四阶段 + cline 执行） | `$SKILL_DIR/vendor/sdlc/SKILL.md` |
| 后端 agent（4） | be-architect、be-provider、be-resilience、be-validator（提示词，无 SKILL.md） | `$SKILL_DIR/vendor/be-*/<name>.md` |
| 实现簇 | implementation（dev-backend + be-implementer 合并，执行内核接 opencode） | `$SKILL_DIR/vendor/implementation/implementation.md` |

## 竞品整合与直用策略

> 引用任何增强资产前先确认存在；增强资产均随包内置，故默认存在。若用户自设 `$AIHUB_ROOT`，可改为引用 `$AIHUB_ROOT/skills/<name>/SKILL.md` 的同名外部版本。后端任务链（T1/T2/T5）的 agent×skill 调度见 `templates/task-agent-matrix.md` 与 `templates/orchestration-frontend-backend.md`。
>
> **竞品整合内核**：每个增强资产正文含 `## Execution kernel` 段——声明对标竞品（frontend-design→shadcn-ui/bolt.new、agent-research→gpt-researcher、security→semgrep+gitleaks、skill-sentinel→SkillSpector 等）+ probe + 降级；`regression-all` S3 漂移门机器校验。资产名保留原名（方法论身份 + AIHUB_ROOT 同名替换），竞品以执行内核整合。完整内核表见 README「随包内置资产」。
>
> **竞品直用策略（Competitor-first，2026-09-01）**：当某任务所需竞品**已部署且可用**（清单见 `$SKILL_DIR/docs/history/COMPETITOR-DEPLOYMENT.md`：opencode/portman/semgrep+gitleaks/gpt-researcher 等），允许直接调用竞品（CLI/库/venv），TT 16 资产保留为方法论兜底。判断：**竞品可用 → 直用竞品；不可用或 TT 资产有明确差异化优势 → 用 TT 资产**（如 dev-planner 前提挑战/GWT 评审、review 批判滞后闭环）。本策略不删资产、不改内核，仅放宽规划阶段的调用选择。