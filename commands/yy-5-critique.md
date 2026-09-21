---
name: yy-5-critique
description: 阶段 8 批判反哺。触发词「/yy 5」「注入阶段 5 prompt」「验收批判」「强制技术批判」。
journey-step: 8
prereq-gates: [step7]
---

> 首行指令：先跑 `node scripts/tt-journey.mjs --workspace "$PROJECT_ROOT" --prereq-check --step 8` 机验前置。`--workspace "$PROJECT_ROOT"` 必带（坑#2：cd 技能目录执行时缺它误读技能目录 journey，绕开用户工作区）。前置 step 7 需 in_progress 或 done，否则 exit 1 阻断注入，先回阶段 7。

## 阶段 8 · 验收批判（反哺）

**目标**：每轮验收后强制技术批判——真实搜索竞品对标（GitHub stars/官方文档/近 1-2 年 benchmark），URL 可达性机验（--verify-urls），不足 3 条有效批判按硬闸门拒绝；批判要毒舌，结论反哺下一轮。

**人工 gate 清单**：批判方向感（重点批判库/架构是否过时、有无现成开源方案重复造轮子、真实负载哪里崩、与竞品差在哪）。

**纪律钥匙词**：`真实竞品对标`、`--verify-urls`、`不足 3 条有效批判按硬闸门拒绝`、`毒舌不许客气`、`登记 tracker 生成后续任务`。

**产物路径**：`plans/critique-backlog-tracker.md`（批判登记）；`node scripts/tt-journey.mjs --workspace "$PROJECT_ROOT" --update --step 8`。

**owner 审阅**：产出 gate 产物后，读取 templates/owner-review/acceptance-report.md，按其四段结构向 owner 呈现审阅要点（审什么/看哪几字段/PASS-FAIL/常见坑）——owner 不懂术语也能做判断。

**回跳指针**：怀疑结果/防幻觉（guide 阶段 7）用独立复现 + 禁自证打假。

**指针**：`docs/TT-USER-PROMPT-GUIDE.md` §6 阶段 5（L109）+ §8 阶段 7（L139）；`SKILL.md` §7 强制技术批判 + 优化修改。
