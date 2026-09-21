# FIX-1 派单 — 坑#2：命令文件前置机验 workspace 缺失（P0）

你是本任务的独立执行 agent（autopilot 管线 L1，写面区 B）。工作区：`D:\.ai-hub\skills\yy`。
完成后交付证据，不自称 DONE。

## 坑复述（盲测实测）
命令文件首行指令 `node scripts/tt-journey.mjs --prereq-check --step N` 不带 `--workspace`；
tt-journey.mjs:501 `workspace = arg('workspace') || '.'`——agent cd 到技能目录执行时读技能目录
的 .tt-state，用户项目工作区的 journey 被绕开 → 阶段 1+ 死锁风险（盲行截图证据）。

## 修法（择一，REPORT 申报选择理由）
- 方案 A：六个 `commands/yy-*.md` 首行指令统一加 `--workspace "$PROJECT_ROOT"`（SKILL.md 变量表已有该变量）+ 注入纪律行说明
- 方案 B：tt-journey.mjs 支持 `YY_WORKSPACE` 环境变量兜底（`arg('workspace') || env || '.'`）+ 命令文件说明设置方式

## 白名单
方案 A：commands/yy-*.md + SKILL.md；方案 B：scripts/tt-journey.mjs + commands/yy-*.md（说明行）。
另加自测目录 test-reports/autopilot-work/FIX-1/。

## 自测（必须）
- 所选方案下：在任意非 yy 目录（临时目录）设好最小 journey 工作区 → `--prereq-check --step 1` 读到的是**该工作区**的 journey（非技能目录）
- 未设工作区语义不回归：`--workspace .` 原行为不变
- regression 12/12 + validate 0 + junction 冒烟（若方案 B 改了 tt-journey）
- RESULTS.md：方案选择理由 + 每步输出原样 + D-xxx 偏差

## 禁止
改 render-core/host-bridge/content.js/index.html/styles.css（FE 面）、contracts/、队列/看板；
读 test-reports/acceptance-*/；git 操作。

