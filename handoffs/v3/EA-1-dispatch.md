# EA-1 派单 — 16 资产基线测量（批 0 补派，实测修正后口径）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §五 EA-1 与其"实测修正"注记，严格按其执行。完成后交付证据，不自称 DONE。

## 背景（重要——口径已修正）
BW 四工作区走 N=1 手动模式，只有 journey.json **无 state.json**，asset-call-rate 的 --state 口径无法直接计量。你的基线走两条腿：
- **腿①（机验链路消费证据）**：跑 S8/S3 探针链路产生的 state.json（`test-reports/` 下回归产物）+ `node test-reports/autopilot-work/FIX-2/run-probes.mjs --json` 等现有机器产物，提取每资产 consumed 证据；
- **腿②（人工取证）**：BW 四工作区 session-notes（已归档 `test-reports/autopilot-work/BW-*/session-notes.md`）+ BW 工作区残留，逐条记录哪些资产被真实消费（如 dev-planner 前提挑战、frontend-design）、哪些仅被提及、哪些零出现。

## 任务
1. 从 `scripts/lib/matrix.mjs` CLUSTERS 提取 16 资产权威清单；
2. 逐资产出基线行：`资产 | 簇 | 机验链路 consumed 次数 | BW 取证（消费/提及/零现） | 适配器（dedicated/prompt） | vendor 体积 | 评级输入备注`；
3. 汇总：明确"零真实消费"资产清单（这是 AS-1 drop 7 的最硬输入）与"高消费"资产清单；
4. 产出 `test-reports/asset-eval-20260923/BASELINE.md` + 逐项证据（命令输出/取证引用）。

## 白名单
只读分析 + 新建 `test-reports/asset-eval-20260923/` 目录。**零仓库源文件改动**。

## 自测
1. 16 行基线表齐备，每行有证据引用（标注 实测/推断）；
2. 数字可复算（抽查 3 行给出复算命令）；
3. RESULTS 即 BASELINE.md，含 D-偏差（如证据缺失的口径说明）。

## 禁止
改任何源文件/SKILL.md/webview/contracts/plans；禁 git；禁跑会写仓库的命令（跑探针时用临时目录）。

## 验收要点（编排者 L2 将复核）
16 行齐+证据引用+零消费清单明确。