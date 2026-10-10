---
name: yy-1-requirement
description: 阶段 1 需求挖掘。触发词「/yy 1」「注入阶段 1 prompt」「需求挖掘」「挖掘需求」。
journey-step: 1
prereq-gates: [step0]
---

> 首行指令：先跑 `node "$SKILL_DIR/scripts/host-adapter.mjs" prepare --workspace "$PROJECT_ROOT" --session <session> --intent "/yy 1" --subtask-id <id> --save` 展示包，仅 `ok=true` 且 `data.execution_permitted=true` 继续。再跑 `node "$SKILL_DIR/scripts/host-adapter.mjs" check --workspace "$PROJECT_ROOT" --session <session> --subtask-id <id>`，通过后做原生工作。session 边界见接口指针。

## 阶段 1 · 需求挖掘

**目标**：你当唯一事实源，按 forcing-questions 逐轮追问（每次 ≤2 题），产出概念版并签收后才进下一步。

**人工 gate 清单**：概念版签收（明确说「确认」才推进）——方向正确性的第一道人工闸。

**产物路径**：`docs/`（概念版 / PRD 草案）；只凭真实签收证据记录 `concept-signed`，记录状态不代替下次 adapter 准入。

**owner 审阅**：产出 gate 产物后，读取 templates/owner-review/concept-signoff.md，按其四段结构向 owner 呈现审阅要点（审什么/看哪几字段/PASS-FAIL/常见坑）——owner 不懂术语也能做判断。

**指针**：宿主准入见 `reference/decision-interface.md`；需求方法与签收记录见 `reference/documentation.md`。
