---
name: yy-4-execute
description: 阶段 7 派单执行。触发词「/yy 4」「注入阶段 4 prompt」「派单执行」「并行派单」。
journey-step: 7
prereq-gates: [step5, contract-frozen]
---

> 首行指令：先跑 `node "$SKILL_DIR/scripts/host-adapter.mjs" prepare --workspace "$PROJECT_ROOT" --session <session> --intent "/yy 4" --task-text "<本次有界子任务>" --subtask-id <id> --capability <子任务能力> --save` 展示原始 stage→task/brief 包，仅 `ok=true` 且 `data.execution_permitted=true` 继续。再跑 `host-adapter.mjs check` 重核展示，同 workspace/session/id；默认 HOST_NATIVE 消费执行包。只有显式选择外部 provider 才用 `execute --exec`；接入见 `reference/decision-interface.md`。

## 阶段 7 · 派单执行

**目标**：由当前宿主原生执行已准入子任务；实现与独立实证验收分开，不采信完工报告。缺执行或独立验收能力时明确返回未执行/未验证，不假报完成。

**人工 gate 清单**：独立实证验收（跑测试/真实请求/git log）+ 前端 HTML 原型 APPROVED（Gate A）——验收口径与审美签收。

**产物路径**：`artifacts/<planId>/state-summary.json`（收尾派生）及每个子任务的真实产物、独立 checker 证据。每项派单消费本项 packet，状态摘要或其他任务的 brief 不授予本项许可。

**指针**：派单和独立验收见 `reference/dispatch-and-acceptance.md`、`reference/frontend-gate.md`。
