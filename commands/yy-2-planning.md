---
name: yy-2-planning
description: 阶段 3 拆任务。触发词「/yy 2」「注入阶段 2 prompt」「拆任务」「任务拆解」。
journey-step: 3
prereq-gates: [step1, concept-signed]
---

> 首行指令：先跑 `node scripts/tt-journey.mjs --prereq-check --step 3` 机验前置。前置 step 1 未 done 或 gate concept-signed 未过时 exit 1 输出原因并阻断注入，先回阶段 1。

## 阶段 3 · 拆任务（前提挑战）

**目标**：拆任务前先走 dev-planner Step0 前提挑战（≤6 条前提 + 4 问结论），逐条确认后拆成带 GWT 验收 + 前后置 + 契约冻结顺序 + 选型依据的 task。

**人工 gate 清单**：前提挑战签收（逐条确认前提）——方向正确性的最后一次人工把关。

**纪律钥匙词**：`前提挑战`、`GWT 验收`、`前后置依赖`、`契约冻结顺序`、`选型依据`、`HTML 原型 gate`、`review-gate --plan 自检三视角`。

**产物路径**：`docs/yy-dev-plan.md`（任务总纲）；前提通过后 `node scripts/tt-journey.mjs --update --step 3 --gate premise-signed`。

**owner 审阅**：产出 gate 产物后，读取 templates/owner-review/premise-challenge.md，按其四段结构向 owner 呈现审阅要点（审什么/看哪几字段/PASS-FAIL/常见坑）——owner 不懂术语也能做判断。

**关键**：你确认前提，错的是方向；任务怎么拆，错的是可改细节。

**指针**：`docs/TT-USER-PROMPT-GUIDE.md` §3 阶段 2（L63）；`SKILL.md` §3 任务拆解。
