# EX-1 派单 — executor.json v2 能力握手 + 措辞纪律（批 0）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §一 EX-1，严格按其执行。完成后交付证据，不自称 DONE。

## 任务 A：executor.json v2 = ACP 式能力握手
改 `scripts/orchestrator.mjs` + `scripts/executor-setup.mjs`（同写面，串行本单内）：
- 启动时探测执行器并**交换能力集**：`write_files / run_cmd / network / spawn_subagent / mcp_client`（能力名固定枚举，不随平台命名）；
- 派单按**能力门控**：子任务需要的能力若执行器不支持 → 诚实降级（mode=prompt 或 skipped），不静默改用弱能力；
- executor.json 增加 `capabilities` 块（Agent Card 式自描述）：`{name, version, capabilities:{...}, detectedAt}`；
- 探测失败时如实上报（aider 模式），不假报已用外部内核。

## 任务 B：措辞纪律（实测根因）
- 代码注释/日志/文档里"已接线 X"→"能力探测验证 X 支持 write_files/run_cmd"；
- `scripts/lib/adapters/index.mjs` 注释同步；
- opencode adapter 降为回归渠道之一，不进主路径描述。

## 约束
- 白名单：`scripts/orchestrator.mjs`、`scripts/executor-setup.mjs`、`test-reports/autopilot-work/EX-1/`；
- 不得破坏既有 `--exec/--hosts` 注入语义（FIX-2 探针 12/12 必须复跑全绿，P5 确定性断言保留）；
- 新能力探测不得引入非确定性（禁 modes.exec 类断言——FIX-3 教训）。

## 自测（必须，证据落 EX-1 目录）
1. 能力握手：临时 executor.json 带 capabilities → orchestrator 派单按能力门控（构造"缺 run_cmd 的执行器"→ 子任务降级且日志留痕）；
2. 措辞：grep 全仓"已接线"→0 命中，改为能力探测描述；
3. 回归：`node test-reports/autopilot-work/FIX-2/run-probes.mjs` 12/12 + `node scripts/regression-all.mjs` 13/13 + validate 0；
4. RESULTS.md：逐项证据 + D-xxx 偏差。

## 禁止
改 SKILL.md、commands/、webview/、contracts/、reference/、plans/、其他 scripts/；读 test-reports/acceptance-*/；git 操作。

## 验收要点（编排者 L2 将复核）
能力门控生效且降级诚实；措辞零残留；FIX-2 探针 12/12 + regression 13/13。