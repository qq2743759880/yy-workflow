---
name: yy-5-critique
description: 阶段 8 批判反哺。触发词「/yy 5」「注入阶段 5 prompt」「验收批判」「强制技术批判」。
journey-step: 8
prereq-gates: [step7]
---

> 首行指令：先跑 `node "$SKILL_DIR/scripts/host-adapter.mjs" prepare --workspace "$PROJECT_ROOT" --session <session> --intent "/yy 5" --subtask-id <id> --save` 展示包，仅 `ok=true` 且 `data.execution_permitted=true` 继续。再跑 `node "$SKILL_DIR/scripts/host-adapter.mjs" check --workspace "$PROJECT_ROOT" --session <session> --subtask-id <id>`，通过后做原生工作。session 边界见接口指针。

## 阶段 8 · 验收批判（反哺）

**目标**：验收后用真实竞品/官方文档/benchmark 对标；`--verify-urls` 验可达性，不足 3 条有效批判拒绝，结论反哺下一轮。

**人工 gate 清单**：批判方向感（重点批判库/架构是否过时、有无现成开源方案重复造轮子、真实负载哪里崩、与竞品差在哪）。

**产物路径**：`plans/critique-backlog-tracker.md`（批判登记）及真实复现证据；只凭已完成的验收和批判记录更新 journey。command 不以现有 step 状态自行放行。

**owner 审阅**：按 `templates/owner-review/acceptance-report.md` 呈现审阅要点。

**回跳指针**：怀疑结果/防幻觉（guide 阶段 7）用独立复现 + 禁自证打假。

**指针**：宿主准入见 `reference/decision-interface.md`；批判与复验方法见 `reference/critique-protocol.md`、`reference/dispatch-and-acceptance.md`。
