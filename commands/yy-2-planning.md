---
name: yy-2-planning
description: 阶段 3 拆任务。触发词「/yy 2」「注入阶段 2 prompt」「拆任务」「任务拆解」。
journey-step: 3
prereq-gates: [step1, concept-signed, step1.5, research-done]
---

> 首行指令：先跑 `node "$SKILL_DIR/scripts/host-adapter.mjs" prepare --workspace "$PROJECT_ROOT" --session <session> --intent "/yy 2" --task-text "<本次有界拆分任务>" --subtask-id <id> --save` 展示原始 stage→task/brief 包，仅 `ok=true` 且 `data.execution_permitted=true` 继续。再跑 `host-adapter.mjs check` 重核展示，同 workspace/session/id；默认 HOST_NATIVE 消费执行包。只有显式选择外部 provider 才用 `execute --exec`；接入见 `reference/decision-interface.md`。

## 阶段 3 · 拆任务（前提挑战）

**目标**：拆任务前先走 dev-planner Step0 前提挑战（≤6 条前提 + 4 问结论），逐条确认后拆成带 GWT 验收 + 前后置 + 契约冻结顺序 + 选型依据的 task。

**人工 gate 清单**：前提挑战签收（逐条确认前提）——方向正确性的最后一次人工把关。

**产物路径**：`docs/yy-dev-plan.md`（任务总纲）；只凭真实前提签收证据记录 `premise-signed`。command 元数据只参与冻结映射核对，不自行计算前置或授权。

**owner 审阅**：产出 gate 产物后，读取 templates/owner-review/premise-challenge.md，按其四段结构向 owner 呈现审阅要点（审什么/看哪几字段/PASS-FAIL/常见坑）——owner 不懂术语也能做判断。

**指针**：宿主准入与执行见 `reference/decision-interface.md`；拆分方法见 `reference/task-decomposition.md`。
