---
name: yy-0-init
description: 阶段 0 立项/资产整合。触发词「/yy 0」「注入阶段 0 prompt」「立项」「资产整合」。
journey-step: 0
prereq-gates: []
---

> 首行指令：先跑 `node scripts/tt-journey.mjs --workspace "$PROJECT_ROOT" --prereq-check --step 0`（或读 `$PROJECT_ROOT/.tt-state/journey.json`）机验前置。本阶段无前置（step 0 起点，天然放行），但若 journey 已推进到后续阶段，请勿回退覆盖已实施产物。

## 阶段 0 · 立项 / 资产整合

**目标**：一句话定边界，盘点资产与平台，只做需求澄清 + 概念版，不拆任务不写代码。

**人工 gate 清单**：无（本阶段为起点，方向边界由 owner 一句话给定）。

**纪律钥匙词**：`只做第 N 步`（激活可回跳）、`允许反驳`（打开批判 gate）、`契约先冻结 / HTML 原型 APPROVED / 每轮验收竞品批判`（TT 纪律三钥匙）。

**产物路径**：`docs/`（PRD/设计规范/技术架构/选型审计/任务总纲 的起点）；资产盘点结果写 `config.json`（`node scripts/detect-platforms.mjs`）。

**反例**：只说「帮我做个学习平台，要 AI 个性化，前端要好看」会跳过需求 gate 直接拆任务。

**指针**：`docs/TT-USER-PROMPT-GUIDE.md` §1 阶段 0（L29）；`SKILL.md` §0b 闭环全景 / §1 资产整合与平台探测。
