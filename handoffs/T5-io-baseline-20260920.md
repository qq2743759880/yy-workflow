# T5 派单 — IO 口径调用率基线跑（P1-C）

你是本任务的独立执行 agent。工作区：`D:\.ai-hub\skills\yy`。任务：按
`plans/wiring-and-audit-plan-20260920.md` P1 节的基线协议，实测 yy 六阶段会话中 16 资产的
真实读取基线（接线前）。**验收探针你不可见。**

## 必读

1. `plans/wiring-and-audit-plan-20260920.md` P1 节
2. `scripts/lib/io-audit-hook.mjs`（用法头注释；`YY_IO_AUDIT_DIR` / `YY_IO_AUDIT_MAX_BYTES`）
3. `scripts/asset-io-report.mjs`（`--label` / `--input` / `--out` 参数）

## 执行协议

1. 建沙箱项目 `test-reports/rebuild-20260920/io-baseline/sandbox-project/`（真实项目素材：
   一个小需求，如"命令行 TODO 工具"，写入 sandbox 的 task.md）
2. 基线环境：你的会话/子进程设置 `NODE_OPTIONS=--import file:///<仓库>/scripts/lib/io-audit-hook.mjs`
   + `YY_IO_AUDIT_DIR=<沙箱>/io-audit-run<N>/`（每轮独立目录）
3. **固定 6 条阶段指令**（逐字写在 fixtures/prompts.json，先建好）：
   0"盘点资产与平台，只做需求澄清不写代码" 1"逐轮挖掘需求产出概念版" 2"前提挑战后拆任务"
   3"规划并冻结契约" 4"派单执行并独立实证验收" 5"强制技术批判对标竞品"
4. 每条指令在沙箱项目目录下执行一轮（你作为 agent 正常响应该指令，遵守命令文件的阶段纪律；
   **不真正派外部子代理**，用本会话模拟执行），同一指令跑 **N=3 轮**，共 18 份 JSONL
5. 每轮后跑 `asset-io-report.mjs --input <该轮 JSONL> --label baseline-stage<N>-run<k>`
6. 汇总交付 `test-reports/rebuild-20260920/io-baseline/REPORT.md`：
   阶段×资产 consumption 矩阵（18 轮中位数）、routing/consumption 比、16 资产零调用清单、
   与"声明口径"（`asset-call-rate.mjs --task` 同 6 条指令的路由模拟）并排对比表

## 允许写入（白名单）

`test-reports/rebuild-20260920/io-baseline/` 目录（含沙箱项目与 fixtures）。**禁止**写仓库
其他任何位置；禁止 git 操作；`.tt-state/` 产物只允许出现在沙箱项目内。

## 纪律

- 你只跑测量，不修改任何 yy 运行时；不因测量结果"顺手优化"任何文件
- 数字如实：某阶段零调用就写零调用，禁止推测补全；每轮原始 JSONL 保留在交付目录内
- REPORT.md 含：协议执行说明（你实际怎么跑的，诚实到"哪一步是本会话模拟而非真派单"）、
  矩阵、对比表、局限申报
