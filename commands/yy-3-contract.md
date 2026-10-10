---
name: yy-3-contract
description: 阶段 5 规划+契约冻结。触发词「/yy 3」「注入阶段 3 prompt」「契约冻结」「冻结契约」。
journey-step: 5
prereq-gates: [step3]
---

> 首行指令：先跑 `node "$SKILL_DIR/scripts/host-adapter.mjs" prepare --workspace "$PROJECT_ROOT" --session <session> --intent "/yy 3" --subtask-id <id> --save` 展示包，仅 `ok=true` 且 `data.execution_permitted=true` 继续。再跑 `node "$SKILL_DIR/scripts/host-adapter.mjs" check --workspace "$PROJECT_ROOT" --session <session> --subtask-id <id>`，通过后做原生工作。session 边界见接口指针。

## 阶段 5 · 规划 + 契约冻结

**目标**：执行矩阵与排序、契约冻结时序；接口/schema/错误码逐条审完才冻结。

**人工 gate 清单**：契约审阅（用真实业务场景逐条审接口/错误码）——你业务知识最值钱的地方。

**产物路径**：`contracts/<planId>.json`（冻结契约）；只凭实际审阅证据记录 `contract-frozen`。冻结后变更走变更单和重验收，下次阶段仍由 adapter 准入。

**owner 审阅**：按 `templates/owner-review/contract-review.md` 呈现审阅要点。

**棕地补充**：老系统无 OpenAPI 可用 contract-reverse 反推草案，由后端确认后冻结；草案不授予实现许可，前端仍需契约和 HTML APPROVED gate。

**变更**：只重验影响层，保留已实施产物。

**指针**：宿主准入见 `reference/decision-interface.md`；规划、契约与变更方法见 `reference/planning.md`、`reference/frontend-gate.md`。
