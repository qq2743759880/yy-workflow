---
name: yy
description: |
  YY：owner 可驾驶编排；C4 调 Core/V2，M1 兼容读取，C5 待交付。
  触发：/yy 0 至 /yy 5、/yy research、立项、需求、拆任务、契约冻结、派单、验收、当前进度；以及 owner 可驾驶编排 / 阶段导航 / Prompt 注入 / 报告白话化 / 多分支编排 / 多平台并行编排。
license: MIT
metadata:
  version: "0.3.0"
---
# YY：owner 可驾驶编排工作流

## 0a. 阶段命令索引（先展示 Decision）

`$SKILL_DIR`、`$PROJECT_ROOT` 先解析为绝对路径。架构见 `README.md`，阶段走 `scripts/host-adapter.mjs`；command 不授权，接法见 `reference/decision-interface.md`。

| 用户说 | 动作 |
|---|---|
| `/yy 0`、`立项` | Read `commands/yy-0-init.md` |
| `/yy 1`、`需求` | Read `commands/yy-1-requirement.md` |
| `/yy research`、`研究门` | Read `commands/yy-research.md` |
| `/yy 2`、`拆任务` | Read `commands/yy-2-planning.md` |
| `/yy 3`、`契约冻结` | Read `commands/yy-3-contract.md` |
| `/yy 4`、`派单` | Read `commands/yy-4-execute.md` |
| `/yy 5`、`验收` | Read `commands/yy-5-critique.md` |
| `当前进度`、`进度图` | 跑 `node "$SKILL_DIR/scripts/host-adapter.mjs" prepare --workspace "$PROJECT_ROOT" --intent "当前进度"`，只展示当前位置，不授权执行 |

准入纪律：adapter 展示原始 stage→task/资产 brief 包，最终 `ok=true` 且 `data.execution_permitted=true` 才继续。显式 `--save` 后，有 brief 走 `execute` 重核，无 brief 走 `check` 后原生工作。未消费 packet 直接执行 = `HOST_INTEGRATION_BYPASS`，验收 FAIL。映射按冻结数据，未命中只查询，不猜授权。

可信当前 session 贯穿 prepare/check/execute，不从旧记录恢复。每次调用带 `--workspace "$PROJECT_ROOT"`，初始化/更新不是准入。Owner 缺席见 `reference/dispatch-and-acceptance.md` §5.7，仍消费 Decision。

## 0b. 闭环全景（8 步可回跳）

journey：0 资产 → 1 需求 → 1.5 研究 → 3 拆分 → 5 契约 → 7 执行 → 8 验收反哺；2/4/6 是回跳层，不是 `/yy` 编号。N=1 串行。

## 三条红线
1. **契约先冻结**：开工前置是契约已验收，缺契约不派单。
2. **APPROVED before code**：前端未收 APPROVED 不得进框架实现（Gate A→PARITY→Gate B）。
3. **独立实证验收**：不采信报告，逐项复现证据（git/HTTP/实跑）。

## 分层协议

| 何时需要 | 读 |
|---|---|
| Decision MCP / CLI 接入 | `reference/decision-interface.md` |
| M1 兼容与旧 authority | `reference/m1-authority-boundary.md` |
| Receipt/C5 版本边界 | `reference/receipt-mode-boundary.md` |
| 变量表 / 初始化 | `reference/variables-and-config.md` |
| 阶段 0 资产整合 | `reference/asset-integration.md` |
| 阶段 1 文档化 / 需求 gate | `reference/documentation.md` |
| 阶段 2 拆任务 / 前提挑战 | `reference/task-decomposition.md` |
| 规划 / 人工交接 | `reference/planning.md` / `reference/manual-handoff.md` |
| 阶段 4 派单 / 验收 / 批判闭环 | `reference/dispatch-and-acceptance.md` |
| 前端页面 / HTML 双 gate | `reference/frontend-gate.md` |
| 验收批判硬闸门 | `reference/critique-protocol.md` |
| YY↔TT 差异 / TTHP | `reference/yy-tt-diff.md` |

## 附 A：变量声明清单（validate 用）
`$SKILL_DIR` `$AIHUB_ROOT` `$PROJECT_ROOT` `$PLATFORMS` `$TT_HTTP_PROXY`

TTHP（MIT）可选，无则退化文件+人工核对；差异见 `reference/yy-tt-diff.md`。
