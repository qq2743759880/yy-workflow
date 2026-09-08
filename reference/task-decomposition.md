# 附 A4：任务拆解（来源：SKILL.md §3，自包含可读）

> 本文件是 YY 拆任务阶段（闭环第 3 步）的权威说明（原 SKILL.md §3 迁移至此）。阶段 2（拆任务）时读取。

- 调 `$SKILL_DIR/vendor/dev-planner/dev-planner.md`（只读规划 agent）产 `dev-plan.md`：几十~上百 task，每 task 含 GWT 验收全文 + 前后置 + 联节点 + 选型依据引用。
- **前提挑战前置（dev-planner Step 0）**：拆任务前先产 premise 表（≤6 条）+ 4 问结论（为什么现在/现状方案/窄楔子/未来适配），逐条用户确认；任一前提推翻 → 回需求澄清。用户拒绝追问时走 escape hatch（二次拒绝 → 只留 2 问 → 仍跑 Premise 确认）。话术见 `$SKILL_DIR/templates/forcing-questions.md`。
- **设计文档前置链（可选）**：有 `docs/designs/{slug}.md` 时以其为选型依据（可引用章节号）；缺失可跳过但须注明理由。模板 `$SKILL_DIR/templates/design-doc.md`。
- **规划自审（派单前）**：按 CEO 范围 / Eng 架构 / Design 体验 三视角各 ≥1 finding + 处置（CEO→Eng→Design，Design 收尾作最终体验闸门）；一键生成 `node scripts/plan-review.mjs --plan <dev-plan.md>`，填后机验 `--check <plan-review-report.md>`。总机验：`node scripts/review-gate.mjs --plan <dev-plan.md>`（须含「需求前提挑战」「规划自审」实质区块，未过 exit 1）。
- 每 task 生成独立详细文档 `tasks\taskNN-*.md`（agent/mcp/tool/skill/workflow 调用逻辑 + 关联 + 规划要点）——**不要只有简略清单**。
- 前端页面类任务：每页一个 task，内置"HTML 效果图审核 gate"（详见 `reference/frontend-gate.md`）。