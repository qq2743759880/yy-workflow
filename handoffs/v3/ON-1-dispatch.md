# ON-1 派单 — 接入向导问题清单 + 决策卡格式（批 0）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §四 ON-1 与 §七/§八，严格按其执行。完成后交付证据，不自称 DONE。

## 任务 A：接入向导问题清单（落 `orchestrator.config.yaml`）
扩展现有 `scripts/executor-setup.mjs`（T9 向导底座，已实测可用），逐项问（每项带默认值+理由+可后改），落盘 `orchestrator.config.yaml`，幂等可重跑、CLI flag 可覆盖：

| 字段 | 选项 | 默认 | 说明 |
|---|---|---|---|
| `orchestrator.subagentSource` | `session` / `claude-cli` / `codex-cli` | `session` | 子 agent 从哪来 |
| `orchestrator.delegationMode` | `self-dispatch` / `handoff-prompt` | `self-dispatch` | 编排者自己派 vs 给用户交接 Prompt |
| `critique.sources` | 知识库路径 / 搜索工具 / 标准文档 / `none` | `none` | 批判源清单（接 CR-1） |
| `report.style` | `plain` / `technical` / `both` | `plain` | 验收报告风格（接点 7） |
| `blindwalk.enabled` | `true` / `false` | `true` | 阶段盲测开关（接 SB-1） |
| `mcp.tools` | MCP server 列表 | `[]` | chrome-devtools-mcp 等（接 AS-3） |

约束：`executor-setup.mjs` 改动须与既有 `executor.json`/`config.example.json` 口径一致；向导输出必须可被 `--apply`/`--dry-run` 区分；落盘前打印"你将写入这些字段"的预览（大白话，禁术语）。

## 任务 B：决策卡格式（写进 `scripts/executor-setup.mjs` 或新建 `scripts/decision-card.mjs`）
```
### 决策：<一句话大白话标题>
为什么要现在决定：<2 句大白话，禁止术语>
架构影响：<```mermaid flowchart 源码，改动点高亮 classDef```>
选项对照：| 选项 | 对你意味着什么 | 对工期/风险的影响 |
默认建议 + 一句理由
```
- mermaid 源码由 agent 生成（**不手写**），改动点用 `classDef` 高亮；
- 终端不渲染 mermaid 时回落 ASCII 图（实测 AskUserQuestion preview 支持）；
- 决策卡必须可被 `AskUserQuestion` 的 option/preview 字段直接映射。

## 自测（必须，证据落 `test-reports/autopilot-work/ON-1/`）
1. `node scripts/executor-setup.mjs` 交互向导产出 `orchestrator.config.yaml`，字段与上表一致（用 `--dry-run` 打印 + 临时目录落盘比对）；
2. 幂等：跑两次字段一致；
3. 决策卡：生成一张样例决策卡（含 mermaid 源码+ASCII 回落+选项对照表），人工可读性自评；
4. 回归：`node scripts/validate-structure.mjs` 0 警告 + `node scripts/regression-all.mjs` 13/13（新增脚本不触发既有门）。
5. RESULTS.md：逐项证据 + D-xxx 偏差。

## 禁止
改 SKILL.md、commands/、webview/、contracts/、reference/、plans/、其他 scripts/；读 test-reports/acceptance-*/；git 操作。

## 验收要点（编排者 L2 将复核）
六字段落盘且可后改；决策卡大白话可读；validate/regression 全绿。