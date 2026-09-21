---
name: yy-4-execute
description: 阶段 7 派单执行。触发词「/yy 4」「注入阶段 4 prompt」「派单执行」「并行派单」。
journey-step: 7
prereq-gates: [step5, contract-frozen]
---

> 首行指令：先跑 `node scripts/tt-journey.mjs --workspace "$PROJECT_ROOT" --prereq-check --step 7` 机验前置。前置 step 5 未 done 或 gate contract-frozen 未过时 exit 1 输出原因并阻断注入，先回阶段 3/5。

## 阶段 7 · 派单执行

**目标**：按 C-01 派独立子 agent 执行（task/claude/codex/openclaw），你不得自写自验；每任务完工 = 你独立实证验收，不采信完工报告。

**人工 gate 清单**：独立实证验收（跑测试/真实请求/git log）+ 前端 HTML 原型 APPROVED（Gate A）——验收口径与审美签收。

**纪律钥匙词**：`独立子 agent`、`独立实证验收`、`不采信完工报告`、`HTML 原型先 APPROVED 才准写框架`、`验收断言逐个复现`。

**产物路径**：`artifacts/<planId>/state-summary.json`（收尾派生）；验收通过 `node scripts/tt-journey.mjs --workspace "$PROJECT_ROOT" --update --step 7 --gate gate-a-approved`。

**关键**：90% 翻车发生在验收偷懒——只信报告或只走形式。

**指针**：`docs/TT-USER-PROMPT-GUIDE.md` §5 阶段 4（L96）；`SKILL.md` §5 多级派单与独立验收 / §6 前端 HTML 原型 gate。
