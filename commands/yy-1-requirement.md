---
name: yy-1-requirement
description: 阶段 1 需求挖掘。触发词「/yy 1」「注入阶段 1 prompt」「需求挖掘」「挖掘需求」。
journey-step: 1
prereq-gates: [step0]
---

> 首行指令：先跑 `node scripts/tt-journey.mjs --prereq-check --step 1` 机验前置。前置 step 0 未 done 时 exit 1 输出原因并阻断注入，先回阶段 0。

## 阶段 1 · 需求挖掘

**目标**：你当唯一事实源，按 forcing-questions 逐轮追问（每次 ≤2 题），产出概念版并签收后才进下一步。

**人工 gate 清单**：概念版签收（明确说「确认」才推进）——方向正确性的第一道人工闸。

**纪律钥匙词**：`先别产文档`、`逐轮问我 ≤2 题`、`回源核验`、`查不到标 [待补充] 禁止编造`（防幻觉红线）。

**产物路径**：`docs/`（概念版 / PRD 草案）；签收后 `node scripts/tt-journey.mjs --update --step 1 --gate concept-signed`。

**owner 审阅**：产出 gate 产物后，读取 	emplates/owner-review/concept-signoff.md，按其四段结构向 owner 呈现审阅要点（审什么/看哪几字段/PASS-FAIL/常见坑）——owner 不懂术语也能做判断。

**反例**：跳过需求 gate 直接按想象拆任务。

**指针**：`docs/TT-USER-PROMPT-GUIDE.md` §2 阶段 1（L48）；`SKILL.md` §2.1 需求挖掘 gate。
