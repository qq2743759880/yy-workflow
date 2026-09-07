# T12-RESEARCH — 自动任务拆解/依赖排序/规划审批 开源项目调研

- 日期：2026-09-02
- 执行方：TT 工作流调研子 agent
- 任务：为 TT「自动任务拆解规划」功能（输入大任务 → 候选 task（前置依赖/并行分组/工作量估算）→ plan 草案 → 人审批）精选 1-3 个可参考的开源项目，不重复造轮子。
- 数据来源：GitHub REST API（search/repositories 实时查询，2026-09-02）；stars 为 API 返回的近似值。
- 诚实声明：`gh` CLI 本机未装；GitHub core API 配额耗尽后改用 search API 与 raw README 核实，所有 stars/许可证/语言均为 API 实时值，未编造。

---

## 一、候选筛选过程

用 GitHub search 检索了 task planning agent / task decomposition LLM / plan-and-execute agent / repo 限定等 6 组查询，从约 40 个结果中按「与 TT 目标（拆解→依赖→并行→审批）贴合度」筛出 7 个深入核实。其中 4 个为最终入选/参考对象，3 个经核实后**不推荐**（附原因）。

---

## 二、结构化对比（核心 4 项）

### 1. open-multi-agent/open-multi-agent —— ⭐ 首选工程蓝图

| 项 | 值 |
|---|---|
| 地址 | https://github.com/open-multi-agent/open-multi-agent |
| stars | ~6,852（活跃，2026-08-31 有 push） |
| 语言/许可证 | TypeScript / MIT |
| 一句话 | "Describe the goal, not the graph"——TS 多 agent 编排框架，coordinator 把**一个 goal 在运行时拆成 task DAG**，确定性 scheduler 执行，全程可**检查/审批/回放**。 |

**核心机制（README 原文核实）：**
- 三种运行模式：`runTeam()`（从 goal 规划）、`runAgent()`（单 agent）、`runTasks()`（显式流水线）。
- 动态编排：coordinator 运行时建 DAG、分配任务、汇总结果，无需手写图。
- **受控执行**："Preview, approve, or durably suspend plans, task dispatches, and tool calls; **freeze approved plans for replay**"——即审批门 + 已批计划冻结回放，与 TT 需要的"plan 草案→人审批"完全同构。
- 可靠性：checkpoint 断点续跑、append-only plan repair（任务结果关卡处自动修订计划）、超时/重试/环路检测/token 预算。
- 可观测：Run Viewer 回放 DAG + 瀑布图，OpenTelemetry 导出。
- 生态：npm `@open-multi-agent/core`，Node ≥20，可混用 Claude Code / Codex 等进程后端与 LLM agent——**与 TT 的多平台派单场景同构**。

**可借鉴点：** task DAG 数据结构（节点=task，边=依赖）、coordinator→scheduler 两层职责分离、"preview→approve→freeze→replay"的审批状态机、checkpoint + plan-repair 对"审批后执行跑偏"的兜底。

**能否直接引入：** 不能直接引入——它是有依赖的完整框架，TT 内核是 Node 零依赖。**取其机制设计（DAG 模型 + 审批门 + 回放），不取代码。**

---

### 2. zhu1090093659/spec_driven_develop —— ⭐ 首选工作流形态（最贴 TT）

| 项 | 值 |
|---|---|
| 地址 | https://github.com/zhu1090093659/spec_driven_develop |
| stars | ~976（活跃，2026-07-26 有 push） |
| 语言/许可证 | Shell（纯 Markdown 工作流）/ MIT |
| 一句话 | 面向 AI 编码 agent 的 spec-driven 开发工作流：**架构先行 → 分阶段任务拆解 → GitHub Issue/PR 追踪 → 进度延续 → 自适应控制**。**"No SDK. No third-party runtime dependencies. Just Markdown workflows plus small helper scripts."** |

**核心机制（README 原文核实）：**
- 6 阶段流水线：Phase 2 Intent Refinement（拆解前先给用户看分析结论定范围）→ **Phase 3 Task Decomposition（把工作拆成 phase/task/并行 lane，每个 task 标注 S.U.P.E.R 设计驱动，规划交付批次）** → Phase 5 **Confirm & Execute（先呈现 plan 摘要、获得确认、再串/并行执行）**。
- 并行规则量化：并行 lane 需「文件集不相交 + ≤L 工作量/ lane + 可独立验收 + ≤4 lanes」——正是 TT 需要的并行分组判据。
- 任务追踪：自动建 GitHub Issues + Milestones（每 phase 一个）+ Labels（优先级/规模/lane），按依赖/共享文件/验收边界分组交付批次。
- **自适应再拆解**（Qian Xuesen 工程控制论）：执行后收集 telemetry（实际工作量 vs 估算、未预见依赖），累积 `drift_score`；漂移 >40% 任务即**中止并重新拆解剩余任务**——与 TT 的"批判反哺自动优化"闭环同构。
- 分层执行/验收：Tier 0 编排者直跑 → Tier 1 单 task-executor → Tier 2 并行 lane；验收 L1 机器校验 → L2 编排者 diff review → L3 独立 code-reviewer，只有 APPROVED/FIXED lane 才合入。

**可借鉴点：** 几乎整套拆解流程可直接搬——拆解前 intent 确认、phase/task/lane 三层结构、S.U.P.E.R 标注、并行 lane 判据、plan 摘要+确认门、drift 触发再拆解阈值。

**能否直接引入：** **可以**。它就是零依赖 Markdown skill（支持 Claude Code/Codex/OpenCode/Cursor/Windsurf/Cline/Aider），形态与 TT 的 `dev-planner` prompt 替换完全同构——可直接改写成 TT 的 planning skill，不引入任何运行时依赖。

---

### 3. FoundationAgents/MetaGPT —— 拆解方法论参考（SOP 范式）

| 项 | 值 |
|---|---|
| 地址 | https://github.com/FoundationAgents/MetaGPT（原 geekan/MetaGPT，已迁移改名） |
| stars | ~70,154 |
| 语言/许可证 | Python / MIT |
| 一句话 | 多 agent 软件公司范式："First AI Software Company"——用 SOP 把软件工程流水线（PRD→设计→任务→实现→测试→文档）固化为角色协作流程。 |

**核心机制（公开文档描述，本次未逐文件重读源码）：**
- SOP 驱动拆解：`WritePRD → WriteDesign → WriteTasks`，WriteTasks 阶段产出**带依赖关系的任务列表**（waterfall 式依赖图），后续角色按依赖顺序执行。
- 依赖排序即"角色下游依赖"：下游角色（开发/测试）依赖上游（产品/架构）产物，天然形成任务序。

**可借鉴点：** 用"产物即契约"表达任务依赖（task 依赖=依赖前置角色的交付物）、SOP 拆解 prompt 模板范式。

**能否直接引入：** 不能——Python 重型框架，且强耦合完整 agent 运行时；TT 只借鉴其拆解 prompt 的思路，不值得引入。

---

### 4. microsoft/TaskWeaver —— 次要参考（plan-and-execute 模式）

| 项 | 值 |
|---|---|
| 地址 | https://github.com/microsoft/TaskWeaver |
| stars | ~6,171 |
| 语言/许可证 | Python / MIT |
| 一句话 | "code-first" agent 框架：以**代码片段**作为可执行中间表示，先规划（planner）再执行，专攻数据分析任务。 |

**可借鉴点：** plan→execute 两阶段分离、规划结果可校验化（代码即计划）。

**能否直接引入：** 不能——Python 重型框架，聚焦数据分析域，与 TT 的多平台派单场景不贴。

---

### 5. OpenHands/OpenHands —— 次要参考（planner 子代理模式）

| 项 | 值 |
|---|---|
| 地址 | https://github.com/OpenHands/OpenHands |
| stars | ~85,855 |
| 语言/许可证 | TypeScript / MIT |
| 一句话 | AI 驱动开发平台；内建 **planner 子代理**，把目标转成带 Task 数据结构的逐步计划（顺序执行），CodeActAgent 再按计划执行。 |

**可借鉴点：** "计划对象化（Task 数据结构）+ 计划与执行解耦"的 agent 内部模式。

**能否直接引入：** 不能——巨型全栈框架，TT 只需其 planner 抽象这一概念参考。

---

## 三、经核实后不推荐的候选

| 项目 | stars | 不推荐原因 |
|---|---|---|
| OthmanAdi/planning-with-files | ~26,551 | 是**计划持久化** skill（task_plan/findings/progress 三文件 + hook 注入 + 抗 /clear + 确定性完成门），**不做拆解**——仅可作为 TT plan 草案持久化/上下文防腐的参考，非拆解引擎 |
| Taoidle/plan-cascade | ~124 | 做级联拆解+并行执行+设计文档（Claude Code/Codex/Aider 多 agent），但 Rust CLI + MCP 形态，stars 少、生态小，且 README 默认分支不齐（本次靠 master 分支核实） |
| All-Hands-AI/OpenHands → OpenHands/OpenHands | 同第 5 项 | 组织/仓库已迁移改名，本调研确认现名为 `OpenHands/OpenHands`（防止 TT 引用旧地址） |

---

## 四、结论：TT 该参考谁

**首选：`zhu1090093659/spec_driven_develop`（工作流形态参考）+ `open-multi-agent/open-multi-agent`（工程架构蓝图）。**

具体分工：

1. **工作流/拆解方法论 → spec_driven_develop（首选，直接可搬）**
   与 TT 形态同构：零依赖 Markdown skill、多平台通用、人确认门、自适应再拆解。TT 的 `dev-planner` prompt 化拆解可直接改写成其 Phase 2→3→5 流程（拆解前 intent 确认 → phase/task/lane 三层 + S.U.P.E.R 标注 + 并行判据 → plan 摘要 + 审批门），并把 `drift_score >40% 重新拆解`的机制嫁接到 TT 的"批判反哺"环节。MIT，无引入成本。

2. **规划引擎数据结构 → open-multi-agent（架构参考）**
   若要给 `orchestrator.mjs` 加真正的 task DAG 引擎，参考它的三点：task DAG 数据模型（节点/依赖边/分组）、"preview→approve→freeze→replay"审批状态机（对应 TT 的 plan 草案→审批→冻结派单）、checkpoint + plan-repair 兜底。仅借鉴设计，不引入 npm 依赖（守住 TT 零依赖约束）。

3. **方法论补充 → MetaGPT**：SOP 拆解 prompt 与"产物即依赖契约"的思想，作为拆解 prompt 模板的参考素材。

**一句话**：拆解流程抄 spec_driven_develop（零依赖可直接落地），DAG+审批+回放引擎参照 open-multi-agent（只抄设计不抄代码），MetaGPT 提供 SOP prompt 范式兜底。
