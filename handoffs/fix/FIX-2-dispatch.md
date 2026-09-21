# FIX-2 派单 — executor.json↔orchestrator 接线（写面区 B）

你是本任务的独立执行 agent（autopilot 管线 L1，全新上下文）。工作区：`D:\.ai-hub\skills\yy`。
完成后交付证据，不自称 DONE。

## 背景（编排者过度推论闭环）
T9 交付的 executor-setup.mjs 写 `<ws>/.tt-state/executor.json`（schema tt/executor-config@1，
含 cli/model/isolate 字段），但 orchestrator 只读 config.json 的 executor.command/hosts
（scripts/orchestrator.mjs:511-514）——向导输出从未被消费。

## 任务
orchestrator 启动时读取 `<workspace>/.tt-state/executor.json`，把 cli/模型偏好映射为
`--exec`/`--hosts` 缺省（优先级：显式命令行 > executor.json > config.json > 无）。
约束：
1. **presence≠可用**：executor.json 的 cli 只映射命令名，不做可用性推断，不自动跑 roundtrip
2. cli 不在已知清单（claude/codex/openclaw/cursor/trae/opencode）→ warning + 跳过（fail-soft）
3. isolate 字段只透传登记（warning 提示"隔离未实施"），不改变 spawn 行为
4. 老 config.json 路径零回归

## 白名单
`scripts/orchestrator.mjs`、`scripts/executor-setup.mjs`（如需补 schema 导出）、
自测目录 `test-reports/autopilot-work/FIX-2/`。

## 自测（必须）
- executor.json 存在且 cli=claude → `--plan --dry-run` 时派单缺省含 claude 命令形态
- 显式 --exec 覆盖 executor.json（优先级实测）
- cli=unknown-cli → warning + 不崩溃
- 无 executor.json → 行为与现状逐字节一致（对同一 task 归一化 diff）
- regression 12/12 + validate 0
- RESULTS.md + D-xxx 偏差

## 禁止
改 commands/、SKILL.md、webview/、tt-journey、summary-read（并行面）、contracts/、队列/看板；
读 test-reports/acceptance-*/；git 操作。

