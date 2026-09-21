---
name: yy
description: |
  YY——owner 可驾驶编排工作流（fork 自 TT 2.9.1）：多 Agent 编排闭环 + owner 体验（导航 F1 / 注入 F2 / 白话化 F3 / 多分支 F4 / 资产透明 F5）。
  触发：owner 可驾驶编排 / 阶段导航 / Prompt 注入 / 报告白话化 / 多分支编排 / 多平台并行编排。
version: 0.3.0
---

# YY：owner 可驾驶编排工作流

## 0a. 阶段命令索引（触发词 → 先 Read 命令文件再行动）

| 用户说 | 动作 |
|---|---|
| `/yy 0`、`立项` | Read `commands/yy-0-init.md` |
| `/yy 1`、`需求` | Read `commands/yy-1-requirement.md` |
| `/yy 2`、`拆任务` | Read `commands/yy-2-planning.md` |
| `/yy 3`、`契约冻结` | Read `commands/yy-3-contract.md` |
| `/yy 4`、`派单` | Read `commands/yy-4-execute.md` |
| `/yy 5`、`验收` | Read `commands/yy-5-critique.md` |
| `当前进度`、`进度图` | 跑 `node $SKILL_DIR/scripts/tt-journey.mjs --workspace <项目目录>`（`<项目目录>` 取 `$PROJECT_ROOT`，见注入纪律） |

注入纪律：命令文件首行已内置 `--prereq-check` 机验，未 done 必须阻断；gate 过后跑 `--update`；`/yy 6`（改需求）`/yy 7`（打假）并入 yy-3/yy-5。**tt-journey 每次调用必带 `--workspace "$PROJECT_ROOT"`**（坑#2）：agent cd 进技能目录执行时，缺该参数会读技能目录的 `.tt-state` 而绕开用户项目工作区（阶段 1+ 死锁）。

## 0b. 闭环全景（8 步可回跳；N=1 退化串行）

```
0 资产整合 → 1 文档化(gate) → 2/4/6 改进重跑对应层 → 3 拆任务(GWT+前提挑战)
→ 5 规划(矩阵+契约冻结) → 7 并行派单(独立实证验收,不过→切平台返工)
→ 8 批判反哺(强制竞品对标→优化方案→反哺下一轮)
```

## 三条红线

1. **契约先冻结**：开工前置是契约已验收，缺契约不派单。
2. **APPROVED before code**：前端未收 APPROVED 不得进框架实现（Gate A→PARITY→Gate B）。
3. **独立实证验收**：不采信报告，逐项复现证据（git/HTTP/实跑）。

## 分层协议（按需读取，一层深）

| 何时需要 | 读 |
|---|---|
| 变量表 / 初始化 | `reference/variables-and-config.md` |
| 阶段 0 资产整合 | `reference/asset-integration.md` |
| 阶段 1 文档化 / 需求 gate | `reference/documentation.md` |
| 阶段 2 拆任务 / 前提挑战 | `reference/task-decomposition.md` |
| 阶段 3 规划 / 契约冻结 | `reference/planning.md` |
| 阶段 4 派单 / 验收 / 批判闭环 | `reference/dispatch-and-acceptance.md` |
| 前端页面 / HTML 双 gate | `reference/frontend-gate.md` |
| 验收批判硬闸门 | `reference/critique-protocol.md` |
| YY↔TT 差异 / TTHP | `reference/yy-tt-diff.md` |

详细协议见 reference/ 按需读取。
## 附 A：变量声明清单（validate 用）
`$SKILL_DIR` `$AIHUB_ROOT` `$PROJECT_ROOT` `$PLATFORMS` `$TT_HTTP_PROXY`

## 附 B：TTHP 与 YY/TT 差异

TTHP（MIT）可选，无则退化文件+人工核对；差异见 `reference/yy-tt-diff.md`。
