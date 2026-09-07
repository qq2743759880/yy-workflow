# Feature: tt-optimization-iteration（TT 优化迭代）— 任务索引

## 概述（개요）

将 tt-together-agent 从「方法论手册」升级为「可运行的指挥系统」。
MVP 范围 = **Phase 0 编排骨架 + Phase 1 资产簇化(26→16) + Phase 2 三个高杠杆资产替换**（实现簇→opencode / sdlc→BMAD+cline / be-validator→portman）。
技术栈：Node/ESM JavaScript（`.mjs` + JSDoc），零第三方依赖、零构建、离线可用。

本文件是**索引**；每个任务的完整实现 spec 见 `tasks/` 目录下对应的独立文件。

> 原 `dev-planner` 约定用户态文字用韩文，此处按运行环境本地化为中文，技术标识符保持英文。

---

## 任务总览（22 个）

### Backend / 运行时（12 个）

| 编号 | 任务 | 文件 | 依赖 |
|---|---|---|---|
| BE-01 | 编排内核脚手架与 CLI 入口 | [BE-01-orchestrator-scaffold.md](tasks/BE-01-orchestrator-scaffold.md) | — |
| BE-02 | 状态模型与状态机 | [BE-02-state-model.md](tasks/BE-02-state-model.md) | BE-01 |
| BE-03 | VendorManifest 扫描器 | [BE-03-vendor-manifest.md](tasks/BE-03-vendor-manifest.md) | BE-01 |
| BE-04 | planner 路由引擎 | [BE-04-planner-router.md](tasks/BE-04-planner-router.md) | BE-02, BE-03 |
| BE-05 | agent 运行时与上下文共享 | [BE-05-agent-runtime.md](tasks/BE-05-agent-runtime.md) | BE-02, BE-04 |
| BE-06 | 契约冻结 gate | [BE-06-contract-gate.md](tasks/BE-06-contract-gate.md) | BE-02, BE-05 |
| BE-07 | opencode 适配器（实现簇） | [BE-07-opencode-adapter.md](tasks/BE-07-opencode-adapter.md) | BE-05, **FE-04**, FE-07 |
| BE-08 | BMAD+cline 适配器（sdlc） | [BE-08-sdlc-adapter.md](tasks/BE-08-sdlc-adapter.md) | BE-05, BE-07, **FE-08** |
| BE-09 | portman/contracteer 适配器（be-validator） | [BE-09-portman-adapter.md](tasks/BE-09-portman-adapter.md) | BE-05, BE-06, **FE-09** |
| BE-10 | 失败处理、重试与降级 | [BE-10-failure-handling.md](tasks/BE-10-failure-handling.md) | BE-05, BE-06, BE-07/08/09 |
| BE-11 | 执行报告与日志输出 | [BE-11-execution-report.md](tasks/BE-11-execution-report.md) | BE-05, BE-06, BE-10 |
| BE-12 | 回归校验集成（validate + sweep） | [BE-12-regression-integration.md](tasks/BE-12-regression-integration.md) | BE-01, **FE-01~FE-06** |

### Frontend / 资产层（10 个）

| 编号 | 任务 | 文件 | 依赖 |
|---|---|---|---|
| FE-01 | 簇化：前端设计簇（5→1） | [FE-01-cluster-frontend.md](tasks/FE-01-cluster-frontend.md) | — |
| FE-02 | 簇化：需求/规划簇（2→1） | [FE-02-cluster-planning.md](tasks/FE-02-cluster-planning.md) | — |
| FE-03 | 簇化：安全簇（3→1） | [FE-03-cluster-security.md](tasks/FE-03-cluster-security.md) | — |
| FE-04 | 簇化：实现簇（2→1） | [FE-04-cluster-implementation.md](tasks/FE-04-cluster-implementation.md) | — |
| FE-05 | 簇化：评审簇（3→1） | [FE-05-cluster-review.md](tasks/FE-05-cluster-review.md) | — |
| FE-06 | 资产表与校验条目更新（确定 16 项） | [FE-06-manifest-and-validator-update.md](tasks/FE-06-manifest-and-validator-update.md) | **FE-01~FE-05** |
| FE-07 | 实现簇文档改写（opencode） | [FE-07-opencode-doc.md](tasks/FE-07-opencode-doc.md) | FE-04 |
| FE-08 | sdlc 资产改写（BMAD+cline） | [FE-08-sdlc-doc-bmad.md](tasks/FE-08-sdlc-doc-bmad.md) | — |
| FE-09 | be-validator 资产改写（portman） | [FE-09-validator-doc-portman.md](tasks/FE-09-validator-doc-portman.md) | — |
| FE-10 | README、索引文档同步与最终自检 | [FE-10-docs-and-index-sync.md](tasks/FE-10-docs-and-index-sync.md) | 全部 |

---

## 簇化映射（26 → 16）

| 新簇 | 类型 | 来源 | 任务 |
|---|---|---|---|
| `frontend-design` | skill | frontend-design + taste-skill + ui-ux-pro-max + pick-ui-library + prototype | FE-01 |
| `planning` | skill | prd-writer + vibe-coding-prd | FE-02 |
| `security` | skill | audit + harden（+ 嵌套 `agents/be-security.md`） | FE-03 |
| `implementation` | **agent** | dev-backend + be-implementer | FE-04 |
| `review` | skill | critique + polish（+ 嵌套 `agents/be-tester.md`） | FE-05 |

**保留独立（11 个）**：
- skill：`agent-research`、`agent-vision-toolkit`、`colorize`、`frontend-visual-validation`、`sdlc`、`skill-sentinel`
- agent：`be-architect`、`be-provider`、`be-resilience`、`be-validator`、`dev-planner`

> 最终：**10 skill + 6 agent = 16 个顶层资产**（由 FE-06 以 `ls vendor` 实际核对后固化）。

---

## 执行顺序（의존성 순）

```
阶段一（可并行，资产重组）
  FE-01 ∥ FE-02 ∥ FE-03 ∥ FE-04 ∥ FE-05 ∥ FE-08 ∥ FE-09
                    ↓
阶段二（收口）      FE-06  ← 确定 16 项、更新 SKILL.md 与 validate 条目
                    ↓
阶段三（骨架）      BE-01 → BE-02 → BE-03 → BE-04 → BE-05 → BE-06
                    ↓
阶段四（替换接入）  BE-07(opencode) ∥ BE-08(BMAD+cline) ∥ BE-09(portman)
                    ↓
阶段五（健壮性）    BE-10 → BE-11 → BE-12
                    ↓
阶段六（收尾）      FE-10（文档同步 + 最终自检 + 提交）
```

**关键约束**
- FE-04 必须**早于** BE-07（opencode 适配器挂在 `implementation` 上）。
- FE-06 是簇化的**唯一收口点**：FE-01~05 在此之前都不提交，避免中间态不可回滚。
- BE-07/08/09 的适配器契约必须与其对应的文档任务（FE-07/08/09）**双向对齐**。
- BE-12 依赖 FE-06 确定的资产数量（预期 16）。

---

## 全局风险（리스크）

- **R1 竞品许可**：opencode / BMAD / cline / portman 只**调用或引用方法论**，不复制源码进仓库；文档与代码均需注明。
- **R2 gate 误报**：契约 gate 首版建议 `TT_GATE_MODE=warn` 灰度，稳定后再切 `block`（BE-06 / BE-12）。
- **R3 合并丢能力**：簇化前必须先列「独有内容清单」，合并后逐条核对（FE-01~05）。
- **R4 宿主耦合**：orchestrator 只定义契约，模型与执行由宿主提供，保证离线可用。
- **R5 类型漂移**：`implementation` / `be-validator` 必须保持 **agent 型（无 SKILL.md）**；`be-security` / `be-tester` 降级为嵌套 agent 后需从 `AGENT_ENTRIES` 移除。
- **R6 CLI 参数臆造**：所有外部 CLI（opencode / cline / portman）的参数必须以实际 `--help` 为准，禁止凭印象编写。
- **R7 路径泄露**：所有产物与报告路径必须相对化，不得出现本机绝对路径（TT 可移植性硬要求）。

---

## 完成定义

- `node scripts/validate-structure.mjs` → **16/16 vendor、0 警告、0 漂移、0 泄露**。
- `node scripts/orchestrator.mjs --task "..."` 可完成 `路由 → 派单 → 契约冻结 → 验收` 闭环并产出报告。
- 三个高杠杆替换（opencode / BMAD+cline / portman）均可在一次端到端任务中被内核实际调用（或明确降级）。
- 关键失败路径（空任务 / 无匹配 / 契约违约 / 适配器不可用 / 超时）均有明确提示与退出码（0/2/3/4/5），且不产生脏数据。
- 全仓文档口径一致（无「26 个资产」残留）。
