# TT-OPTIMIZATION-PRD — 编排智能度优化（自动拆解规划 + 终端 TUI 实时 DAG）

- 版本：v1.0（2026-09-01 初版）
- 状态：概念版已用户确认，进入正式 PRD（TT §2.1 需求挖掘 gate 已完成）
- 基线：TT 2.3.0（编排内核 `scripts/orchestrator.mjs` 零依赖，8 步闭环，回归 8/8）
- 本阶段范围：**自动任务拆解规划（辅助建议模式）** + **终端 TUI 实时 DAG 视图**
- 范围外（下期）：批判反哺自动化、失败自动恢复、监控驱动自动优化

---

## 1. 需求来源

### 1.1 用户原话要点（对话确认结论）

| 项 | 内容 |
|---|---|
| 长期优先级 | 编排智能度 > 真机执行自动化 > 前端设计质变 |
| 五痛点（驱动本阶段） | ① 大任务无自动拆解，靠人工在 dev-planner 里手写 task；② 无依赖/并行估算，派单靠经验；③ 计划无逐任务审批，冻结太黑盒；④ 执行过程无实时可视，只能跑完看报告；⑤ 计划状态看不到瓶颈/等待阻塞 |
| 本阶段先做两块 | **① 自动任务拆解规划（辅助建议模式）**：大任务 → 自动拆解候选 task（含依赖/并行分组/估算）→ plan 草案 → 终端交互逐 task 审批（y/n/编辑）→ 批准后冻结进编排。**② 终端 TUI 实时 DAG 视图**：纯 ANSI 自绘（零新依赖），实时刷新每子任务状态色（待执行/执行中/完成/失败/跳过+降级），瓶颈高亮（关键路径+等待阻塞，反色）。 |
| 产物约束 | 拆解产物与现有 orchestrator plan 格式兼容（`phase`/`dependsOn`/`contractMode` 不破回归 8/8） |
| 形态要求 | 辅助建议模式（AI 给草案、人来批），非全自动直跑 |
| TUI 形态 | 纯 ANSI 自绘，`\x1b[H` 整帧覆写 + `\x1b[1;7m` 反色瓶颈，不引 ink/blessed 保持零依赖 |
| 不造轮子 | 参考 GitHub 已有项目（spec_driven_develop 拆解流程 / open-multi-agent 状态机 / turbo-ui TUI 思路），不重写已验证方案 |
| 诚实红线 | 现有能力标 ✅/◐，不夸大；PRD 不写本机绝对路径（validate 可移植性扫描） |

### 1.2 需求挖掘 gate 结论（前置已确认，勿重测）

- TT 2.3.0 版本与回归 8/8 基线已核实。
- 两块功能的调研报告已交付：`docs/history/specs/T12-RESEARCH-planning.md`、`docs/history/specs/T13-RESEARCH-tui.md`（本 PRD 直接引用其结论）。
- 用户已确认「先做两块、范围外留到下期」的边界，本 PRD 不再扩大范围。

---

## 2. 设计对齐

### 2.1 参考项目借鉴点（只借设计，不引依赖）

| 参考项目 | URL | 借鉴点（如何落到 TT） |
|---|---|---|
| `zhu1090093659/spec_driven_develop` | https://github.com/zhu1090093659/spec_driven_develop | **拆解流程首选（形态与 TT 同构：零依赖 Markdown + 多平台 + 人确认门）**。取其：① 拆解前 intent 确认（Phase 2）；② phase/task/lane 三层拆解 + S.U.P.E.R 标注（Phase 3）；③ 并行 lane 判据「文件集不相交 + ≤L 工作量/lane + 可独立验收 + ≤4 lanes」；④ plan 摘要 + 确认门（Phase 5）；⑤ drift_score >40% 重新拆解（自适应再拆解，本阶段不实现，作为下期反哺机制的输入设计预留） |
| `open-multi-agent/open-multi-agent` | https://github.com/open-multi-agent/open-multi-agent | **工程状态机蓝图**。取其：goal→task DAG 数据结构（节点/依赖边/分组）、"preview → approve → freeze → replay" 审批状态机（对应 TT 的 plan 草案 → 逐 task 审批 → 冻结派单）、checkpoint 断点续跑。仅借鉴设计，不引 npm 包（守零依赖） |
| `vercel/turborepo`（`crates/turborepo-ui`） | https://github.com/vercel/turborepo | **TUI 思路参考（Rust 自绘任务树）**。业界标准做法就是「逐行 ANSI 手绘任务树」而非通用 TUI 框架。取其：状态色映射（缓存命中/完成=绿、执行中=蓝/spinner、等待依赖=灰、失败=红、跳过）、非 TTY 降级纯文本 |
| `FoundationAgents/MetaGPT` | https://github.com/FoundationAgents/MetaGPT | 拆解 prompt 范式补充：「产物即契约」表达依赖（task 依赖 = 依赖前置角色的交付物）。仅参考 SOP 拆解 prompt 写法 |
| `vadimdemedes/ink` / `dagrejs/dagre` | https://github.com/vadimdemedes/ink 、 https://github.com/dagrejs/dagre | **明确不引入（决策记录）**。ink 需 react/react-reconciler/yoga 原生 binding（数 MB + 审计面扩大）；dagre 分层布局对 TT 的「phase 天然行结构」无增益（dependsOn 只需行内箭头）。TT 的 DAG 是行结构非图形，自绘几十行即最小且正确 |

### 2.2 与现有 TT 架构的衔接

| 现有组件 | 本阶段如何衔接 |
|---|---|
| `scripts/orchestrator.mjs` 编排内核 | 新增 `--plan`（自动拆解→逐 task 审批→冻结）与 `--tui`（实时 DAG 视图）两条入口；原执行路径不动 |
| `scripts/lib/planner.mjs` `buildPlan` | 已是 plan 产物的 schema 事实源。拆解引擎产物必须走 `buildPlan` 相同的 schema（或经它归一化），保证 `phase`/`dependsOn`/`contractMode` 兼容 |
| `scripts/lib/runtime.mjs` 执行器 | 执行期注入状态变更钩子（onStatus），供 TUI 实时读取；不做 schema 改动 |
| `scripts/lib/state.mjs` 状态机 | 审批流在 planning → executing 之间插入 approved 门；状态常量复用，不新增非法迁移 |
| `scripts/lib/store.mjs` `.tt-state/state.json` | TUI 数据源。注意：当前 state.json 仅在整轮执行结束时全量写（`store.save`），需补逐子任务实时写入/事件，否则 TUI 看不到"执行中"态 |
| 契约冻结 `freezeContract` → `contracts/<planId>.json` | 审批批准的 plan 走既有冻结路径（`subtask.contractMode='frozen'`），审批 = 冻结前的门，不新造冻结机制 |
| `vendor/dev-planner`（agent 资产） | 拆解 prompt 的宿主：把 spec_driven_develop 的 phase/task/lane + S.U.P.E.R 拆解范式改写进 dev-planner（或新增 planning prompt），输出结构化 JSON 草案 |

### 2.3 关键设计决策

1. **辅助建议模式**：AI 只产「候选 plan 草案」，人逐 task 审批后才冻结。绝不让 AI 跳过审批直接派单（对齐 open-multi-agent 的 approve 门 + spec_driven_develop 的确认门）。
2. **草案 Schema 化**：LLM 拆解输出必须是可校验的结构化 JSON（phase/task/lane/estimate/dependsOn），经 schema 校验 + 依赖完整性校验后归一化成 plan，失败则拒绝进入审批，防 LLM 幻觉破坏 runtime。
3. **零依赖**：拆解用现有 dev-planner prompt 化 + orchestrator 新增模块；审批与 TUI 全部原生 Node（readline + ANSI），不引 ink/blessed/dagre。
4. **TUI 只读**：TUI 是辅助视图（读 state + 事件流渲染），不做键盘写操作，规避交互复杂度与终端兼容风险。

---

## 3. 源码实况核对（改造点）

> 全部相对路径引用；行号为 2.3.0 基线实测值。

### 3.1 现有事实（已核实）

| 位置 | 实况 | 对本阶段的意义 |
|---|---|---|
| `scripts/lib/planner.mjs` `buildPlan`（L21-41） | 路由到 cluster → 生成 subtasks，字段：`id/planId/asset/contract/status/artifactPath/attempts/phase/dependsOn`；`phases` 二维分组（同 phase 并行、跨 phase 串行），`dependsOn` = 前一个 phase 全部 subtask.id；未定义 phases 时降级为逐候选独立 phase（L30） | plan schema 事实源；**缺**：逐 task 描述、估算、lane 并行分组、工作量分级。需在兼容前提下扩展字段 |
| `scripts/lib/runtime.mjs` `executePlan`（L42-89） | 按 phase 分组执行；DAG 归一化（L49-51：无 phase 字段则强制逐项串行）；`--parallel N` 并发上限（L53）；`runGroup`（L91-133）逐 subtask dispatch，状态流转 `idle→done/skipped/failed` | 执行语义不动。**缺**：逐子任务状态变更的对外事件钩子——TUI 需要"执行中"实时态（当前状态只在 dispatch 前后由日志体现，state.json 到收尾才全量写） |
| `scripts/orchestrator.mjs` `parseArgs`（L18-37） | `--task/--workspace/--backend/--exec/--max-retries/--exec-timeout/--parallel/--contract/--dry-run/--verbose/--resume/--validate` | **缺**：`--plan`（审批模式）、`--tui`（实时视图）两个 flag；`--plan` 与 `--resume`/`--dry-run` 的组合约束需定义 |
| `scripts/orchestrator.mjs` `freezeContract`（L54-62） | 冻结 `contracts/<planId>.json`，subtask 置 `contractMode='frozen'`（L123），执行期 gate hash 比对（篡改 exit 4） | 审批批准后复用此冻结路径，不新造 |
| `scripts/orchestrator.mjs` `resumePlan`（L43-52） | done 保留、skipped/failed 重试 | 审批生成的 plan 需可被 resume 复用（字段兼容即可） |
| `scripts/lib/state.mjs` | `STATE`/`TRANSITIONS`；`planning→executing` 无审批中间态 | 审批不新增状态值：用「approvedAt + subtask 全 approved」字段表达，避免动状态机（防回归） |
| `scripts/lib/store.mjs` | `.tt-state/state.json` 全量读写 | TUI 数据源；实时化需在 runtime 增加低频落盘/事件流 |
| `scripts/lib/matrix.mjs` `CLUSTERS` | 每簇已含 `phases`（如 T2 四 phase）与 `contract` | 拆解引擎的 phase 分组可先以簇 phases 为初稿，再由 LLM 细化 |

### 3.2 改造点清单

| # | 改造点 | 影响面 | 类型 |
|---|---|---|---|
| M1-1 | 新增拆解模块（LLM 拆解 → 结构化草案 → schema/依赖校验 → 归一化 plan） | 新增 `scripts/lib/deconstruct.mjs` | 新增 |
| M1-2 | dev-planner prompt 化拆解（phase/task/lane + S.U.P.E.R + 并行判据 + 估算） | `vendor/dev-planner/` | 改写 |
| M1-3 | 终端逐 task 审批交互（y/n/编辑 + 批量 + 默认值） | 新增 `scripts/lib/approve.mjs` | 新增 |
| M1-4 | `--plan` 流程接入 orchestrator（拆解→审批→冻结→进编排） | `scripts/orchestrator.mjs`（parseArgs + 新流程分支） | 改 |
| M1-5 | plan schema 向后兼容扩展（可空新字段：`task.desc/estimate/lane`） | `scripts/lib/planner.mjs` | 改（向后兼容） |
| M2-1 | runtime 状态事件钩子（逐 subtask 状态/耗时/降级 onStatus） | `scripts/lib/runtime.mjs`（`runGroup`/`dispatch`） | 改 |
| M2-2 | ANSI TUI 渲染器（状态色 + 瓶颈高亮 + `\x1b[H` 整帧覆写 + 非 TTY 降级） | 新增 `scripts/lib/tui.mjs` | 新增 |
| M2-3 | `--tui` 触发（运行中挂载）与独立 watch 模式 | `scripts/orchestrator.mjs` + 新增 `scripts/tt-tui.mjs` | 改+新增 |
| M2-4 | 关键路径/等待阻塞计算（关键路径 = 当前未完成链最长依赖；阻塞 = 等待中且依赖未完成） | `scripts/lib/tui.mjs` 内 | 新增 |

---

## 4. 功能条目化

> 优先级：🔴 本阶段必修 ｜ 🟡 本阶段应做 ｜ ⚪ 增强项
> 验收一律 GWT（Given/When/Then）。

### FR-1 自动拆解引擎 🔴

输入一个大任务，产出拆解候选 plan 草案：三层结构（phase/task/lane）+ 依赖 + 并行分组 + 工作量估算，供人审批。

- **行为**：读入 `--task` 大任务 → 调 dev-planner 拆解 prompt（spec_driven_develop 三层 + S.U.P.E.R + 并行 lane 判据 + 估算分级 S/M/L 或人天）→ 输出结构化 JSON 草案 → schema 校验 + 依赖完整性校验（dependsOn 引用已存在 task、无环）→ 归一化为 plan 兼容对象。
- **校验失败处理**：草案不合法则报明确错误并提示重新拆解，绝不静默修正进入审批。
- **GWT**：
  - Given 输入一个大任务（如"为项目 A 交付完整登录模块后端"）；When 运行拆解引擎；Then 产出含 ≥1 个 phase、每 phase ≥1 个 task、task 均带 `phase`/`dependsOn`/`estimate`/`desc` 的草案，且依赖图无环、dependsOn 引用的 id 均存在。
  - Given 拆解草案含同一并行组 ≥2 个 task；When 校验并行判据（文件集/验收独立性/工作量）；Then 组内 task 的 `lane` 标注一致且 ≤4 lanes，跨 lane 任务无共享产物依赖。
  - Given 草案 JSON 缺失必需字段（如 task 无 `phase`）或依赖引用不存在的 id；When schema/完整性校验；Then 草案被拒绝并输出具体错误项，不进入审批。
- **状态标注**：⬜ 待实现（拆解方法论调研已完成）。

### FR-2 终端交互审批 🔴

对拆解草案逐 task 审批（y/n/编辑），全部批准后冻结进编排；拒绝可回拆解或手动改。

- **行为**：审批界面展示 plan 摘要（phase 数/总 task 数/并行 lane/估算汇总）→ 逐 task 提示 `[task-id] <asset> <desc> <estimate> (dependsOn: …) y/n/e> `；`y`=批准，`n`=拒绝，`e`=进入编辑（改 asset/desc/estimate/dependsOn/phase）；支持批量批准与"剩余全批准"快捷输入；任一 `n` 时给出拒绝原因记录，并回到「回拆解 / 保持现状 / 手动修正」三选一。
- **批准语义**：全部 task 批准 → 草案冻结为正式 plan → 走既有 `freezeContract` → 进入执行。此过程不改变 `scripts/lib/state.mjs` 状态机（用 `approvedAt` + 逐 task `approved:true` 记录，不动 `planning→executing` 迁移表）。
- **GWT**：
  - Given 拆解草案含 N 个 task；When 逐 task 输入 `y` 直至最后；Then 生成正式 plan，逐 task `approved:true`，`contractMode:'frozen'` 生效，`contracts/<planId>.json` 生成，进入执行。
  - Given 审批中对某 task 输入 `e`；When 编辑 `estimate` 与 `desc` 并保存；Then 该 task 以编辑后内容冻结，其余 task 不受影响。
  - Given 审批中对某 task 输入 `n`；When 选择"回拆解"；Then 不产生正式 plan、不写 contracts、退出码为审批中止语义（不污染状态文件）。
  - Given 大 plan（>20 task）；When 审批输入 `a`（剩余全批准）；Then 余下未审 task 全部标记批准并进入冻结。
- **状态标注**：⬜ 待实现。

### FR-3 plan 兼容（不破回归） 🔴

拆解/审批产物与现有 orchestrator plan 格式完全兼容，`phase`/`dependsOn`/`contractMode` 不破坏回归 8/8。

- **行为**：新字段（`task.desc/estimate/lane/approved`）必须可空且不影响现有消费方（`executePlan`/`resumePlan`/`writeReport`/gate）；无新字段时行为与 2.3.0 完全一致。`--resume` 能直接恢复审批生成的 plan。`--dry-run` 不写任何文件。
- **GWT**：
  - Given 一份含新字段的审批后 plan；When 执行 `node scripts/regression-all.mjs`；Then S1–S8 全 PASS（8/8），尤其 S4 契约冻结、S5 宿主执行、S8 资产消费证据不回归。
  - Given 审批后 plan 已冻结并中断执行；When 以 `--resume` 恢复；Then 已完成 task 跳过、未完成 task 按 phase/dependsOn 续跑，状态字段与 2.3.0 语义一致。
  - Given `--plan` 流程；When 以 `--dry-run` 组合运行；Then 不写 state.json/contracts/产物，仅打印草案与审批摘要。
- **状态标注**：◐ 部分——`buildPlan` 已产出 `phase`/`dependsOn`、`contractMode:'frozen'` 已存在；估算/lane/审批字段 ⬜。

### FR-4 TUI 实时 DAG 视图 🟡

运行中读取 state + 状态事件，纯 ANSI 渲染 DAG：每子任务状态色 + 瓶颈反色高亮，`\x1b[H` 整帧覆写刷新。

- **行为**：
  - 布局：每 phase 一行标题，task 缩进树（`├─/└─`），dependsOn 行尾 `→` 箭头标注依赖方向。
  - 状态色映射：待执行 dim/gray · 执行中 cyan+spinner · 完成 green · 失败 red · 跳过 yellow · 降级（planned-only/prompt 兜底）红色弱化/警示标记。
  - 瓶颈高亮：关键路径（当前最长未完成依赖链）与等待阻塞（依赖未完成导致排队）用 `\x1b[1;7m` 加粗反色 + 行尾 `(BLOCKING)`。
  - 刷新：`\x1b[H` 光标归位 + 整帧覆写；非 TTY（`!process.stdout.isTTY`）降级为一次性静态文本输出，不崩溃。
  - 数据源：`runGroup`/`dispatch` 注入 `onStatus(subtask, phase)` 钩子（M2-1），TUI 订阅实时流；state.json 全量写入仍保留。
- **GWT**：
  - Given 一个含 ≥3 phase 的 plan 正在执行（含 `--parallel` 并行组）；When 打开 TUI；Then 每 phase/每 task 一屏可见，状态色与当前实际状态一致，刷新间隔内自动覆写更新。
  - Given 某 task 依赖未完成且处于等待；When TUI 渲染；Then 该 task 以反色高亮并标注 `(BLOCKING)`，其所在依赖链为关键路径候选。
  - Given 某个 task 失败或降级为 skipped/planned-only；When 状态事件到达；Then TUI 立即变红/黄并在底部汇总「failed=1 skipped=0 degraded=1」。
  - Given 在非 TTY 环境（CI 管道/重定向）运行 `--tui`；When 检测 `process.stdout.isTTY=false`；Then 输出一次性静态 DAG 文本后退出，退出码 0。
  - Given 执行结束（done/failed）；When TUI 收尾；Then 打印最终汇总与报告路径后退出，不残留光标/终端转义脏状态。
- **状态标注**：⬜ 待实现（T13 调研/技术卡片已完成，属方法论 ✅）。

### FR-5 TUI 触发 ⚪（本阶段应做，优先级低于 FR-1/2）

两种触发方式：`orchestrator.mjs --tui`（执行时挂载）与独立 `scripts/tt-tui.mjs`（watch 已落盘的 state.json）。

- **行为**：`--tui` 在正常执行路径上叠加渲染（不改变执行语义）；独立 watch 模式轮询 `.tt-state/state.json`（低频，如 500ms）渲染，供已跑任务事后复盘；两者共享同一渲染器（`tui.mjs`）。
- **GWT**：
  - Given 执行 `orchestrator.mjs --task ... --tui`；Then 执行语义与不带 `--tui` 完全一致（回归面为零），仅叠加渲染。
  - Given 已有一个完成/中断的 state.json；When 运行 `node scripts/tt-tui.mjs`；Then 渲染该计划最终 DAG 与状态汇总并退出。
- **状态标注**：⬜ 待实现。

---

## 5. 批判审查（默认假设非最优）

> 至少 3 条，含竞品对标与证据 URL。审查结论已回灌至 §2 设计决策。

### C1 为什么不用完整 agent 框架（直接引入 open-multi-agent / MetaGPT / TaskWeaver / OpenHands）？

**假设**：直接引入成熟框架省事。
**批判**：open-multi-agent 是 TypeScript 带依赖的完整编排框架（npm 包 + Node ≥20 生态）；MetaGPT（~70k★）与 TaskWeaver、OpenHands 均为 Python/重型全栈框架，引入意味着：① 破坏 TT「零依赖、可审计、离线可用」内核原则（validate 与 regression 都以此为前提）；② 引入与自身 8 步闭环/契约冻结重复的另一套编排语义，双轨漂移风险；③ 部署与维护面扩大。TT 需要的只是「拆解流程 + 审批状态机」两个设计点，全部可以几十行原生实现，不值得为两成需求拖入十成依赖。
**证据**：https://github.com/open-multi-agent/open-multi-agent 、 https://github.com/FoundationAgents/MetaGPT 、 https://github.com/microsoft/TaskWeaver 、 https://github.com/OpenHands/OpenHands
**结论**：不引入，只抄设计（已在 §2.1 锁定）。

### C2 为什么自绘 TUI 而不引 ink？

**假设**：ink 是 Node TUI 事实标准，用库更稳。
**批判**：ink 底层依赖 react + react-reconciler + yoga（原生布局 binding），安装数 MB、审计面扩大、与零依赖原则冲突；而 TT 的 plan 已有 `phase` 分组 = 天然行结构，dependsOn 只需行内箭头，dagre 的分层布局算法完全用不上。turborepo 官方自绘任务树（console crate 逐行 ANSI）证明「任务进度 TUI 自绘」是业界标准做法而非妥协。自绘的成本只有几十行 + 明确的非 TTY 降级，收益是内核保持零依赖、零安装、可读可审计。
**证据**：https://github.com/vadimdemedes/ink 、 https://github.com/vercel/turborepo 、 https://github.com/dagrejs/dagre
**结论**：自绘（已在 §2.3 决策 3 锁定）。

### C3 审批交互的可用性边界：逐 task y/n 在超长 plan 下会疲劳

**假设**：逐 task 审批最稳妥，体验可接受。
**批判**：spec_driven_develop 的确认门是「plan 摘要一次确认」，而逐 task y/n 在 20+ task 的大 plan 下是反人类的点击马拉松，可能导致用户「全 y 盲批」退化为形同虚设。TT 需要分层：默认逐 task，但提供批量/剩余全批准（`a`）+ 编辑（`e`）入口；同时审批摘要首屏必须给「phase/依赖/并行/估算」总览，让用户先审结构再审细节。这是对 spec_driven_develop 单层确认门的明确增强，也是 TT 与它的差异化点。
**证据**：https://github.com/zhu1090093659/spec_driven_develop
**结论**：审批默认逐 task + 批量快捷 + 首屏摘要（已落入 FR-2）。

### C4 拆解质量依赖 LLM：幻觉与漂移如何兜底？

**假设**：LLM 拆解结果可直接信任。
**批判**：拆解引擎的输入是 prompt、输出是 JSON，LLM 可能产出不存在的资产名、循环依赖、漏拆子任务或对工作量系统性低估。spec_driven_develop 为此设计了 `drift_score`（实际 vs 估算偏差 >40% → 中止重拆），open-multi-agent 有 append-only plan repair；两者都在「执行后」兜底，但本阶段范围外。本阶段至少要有「事前兜底」：schema 校验 + 依赖完整性校验 + 资产名白名单（必须命中 `manifest` 中真实存在的资产），校验不过则拒绝进入审批。把「事后 drift 重拆」作为下期反哺自动化的输入设计预留，本 PRD 明确标注不实现。
**证据**：https://github.com/zhu1090093659/spec_driven_develop 、 https://github.com/open-multi-agent/open-multi-agent
**结论**：事前 schema/白名单/无环校验为硬门槛（已落入 FR-1），事后 drift 归下期。

### C5 TUI 在 Windows/CI 终端兼容性是否被低估？

**假设**：ANSI escape 在主流终端可用即可。
**批判**：TT 开发环境为 Windows PowerShell 5.1，老 console/部分 CI 日志查看器对 `\x1b[1;7m` 反色与整帧覆写的支持不齐（可能乱码或残留）。必须：① `process.stdout.isTTY` 为 false 一律降级静态输出（FR-4 已含）；② 显式 `TT_TUI=off` 或 `--no-tui` 逃生舱；③ 退出前 `\x1b[0m` 复位 + 清屏归位，防脏状态。turborepo 同样在非 TTY 下降级纯文本，业界印证此风险真实存在。
**证据**：https://github.com/vercel/turborepo
**结论**：isTTY 降级 + 逃生舱 + 退出复位（FR-4 已含，补充逃生舱字段）。

---

## 6. 状态标注

| 能力 | 状态 | 说明 |
|---|---|---|
| 8 步闭环编排内核 | ✅ 已具备 | `scripts/orchestrator.mjs`，2.3.0，回归 8/8 |
| plan schema（phase/dependsOn/contractMode 冻结） | ✅ 已具备 | `buildPlan` + `freezeContract` + gate hash 比对 |
| 逐 task 估算/lane/描述 | ◐ 部分 | 估算与 lane 不存在（⬜）；描述可复用资产 description（✅） |
| 拆解方法论（phase/task/lane + S.U.P.E.R + 并行判据） | ✅ 已具备（调研） | T12-RESEARCH 结论已固化；落地实现 ⬜ |
| TUI 技术卡片（ANSI/状态色/瓶颈高亮/降级策略） | ✅ 已具备（调研） | T13-RESEARCH 结论已固化；渲染器实现 ⬜ |
| 自动拆解引擎（FR-1） | ⬜ 待实现 | 新增 deconstruct 模块 + dev-planner 改写 |
| 终端交互审批（FR-2） | ⬜ 待实现 | 新增 approve 模块 |
| plan 兼容扩展（FR-3） | ◐ 部分 | 兼容字段设计完成；新字段落地 ⬜ |
| TUI 实时 DAG（FR-4） | ⬜ 待实现 | 需 M2-1 状态事件钩子先行 |
| TUI 触发（FR-5） | ⬜ 待实现 | `--tui` + 独立 watch |
| 实时状态事件流（onStatus） | ⬜ 待实现 | runtime 现仅日志 + 收尾全量写 state.json |

---

## 7. 里程碑 / 风险 / 验收

### 7.1 里程碑

| 里程碑 | 范围 | 出口条件 |
|---|---|---|
| **M1 拆解 + 审批** | FR-1 + FR-2 + FR-3 | 大任务 → 拆解草案 → 逐 task 审批 → 冻结 → 执行全链路可用；`node scripts/regression-all.mjs` 8/8 PASS；validate 0 泄露 |
| **M2 TUI** | FR-4 + FR-5 | 执行中实时 DAG + 状态色 + 瓶颈高亮可用；非 TTY 降级验证通过；回归 8/8 不破 |

### 7.2 风险

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | 拆解质量依赖 LLM（幻觉/格式/漏拆） | 草案不可用或误导审批 | schema + 资产白名单 + 无环校验硬门槛（FR-1）；人审批兜底（FR-2）；drift 重拆归下期明确标注 |
| R2 | TUI 在 Windows/CI 终端兼容 | 乱码/脏残留/不可用 | isTTY 降级静态输出 + 逃生舱（`TT_TUI=off`/`--no-tui`）+ 退出复位（FR-4/C5） |
| R3 | 审批交互体验退化（大 plan 疲劳→盲批） | 审批形同虚设 | 首屏结构摘要 + 批量/剩余全批准 + 编辑入口（FR-2/C3） |
| R4 | plan schema 扩展破坏回归 | 回归 8/8 失败 | 新字段必须可空 + 无新字段行为与 2.3.0 一致（FR-3）；每里程碑跑 regression-all |
| R5 | `--plan`/`--tui` 与既有 flag 组合冲突 | 参数解析回归 | parseArgs 组合约束显式化（`--plan` 禁与 `--resume`/`--dry-run` 并存，`--tui` 只叠加不改变执行语义）；补参数组合回归样例 |

### 7.3 验收总纲

1. **回归门**：M1/M2 完成后 `node scripts/regression-all.mjs` 均 8/8 PASS（S1 validate 0 警告 0 泄露、S4 契约工作流、S5 宿主执行、S8 资产消费证据等）。
2. **功能门**：FR-1～FR-5 的 GWT 逐条通过（见 §4）。
3. **可移植性门**：本 PRD 及全部新增/修改文件不含本机绝对路径（validate 可移植性扫描 0 命中）。
4. **诚实门**：报告与 state 继续标注 `mode`/`assetConsumed`/`degraded`，不夸大「AI 直跑」——审批未通过的草案不产生任何产物。

---

## 8. 修订记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v1.0 | 2026-09-01 | 初版：需求来源（§2.1 已确认范围）、设计对齐（T12/T13 调研落地）、源码实况核对（2.3.0 实测行号）、FR-1～FR-5（含 GWT）、批判审查 5 条（含 URL）、状态标注、里程碑/风险/验收 |
