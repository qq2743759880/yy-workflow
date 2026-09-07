---
name: yy
description: |
  YY——owner 可驾驶编排工作流（fork 自 TT 2.9.1）：在 TT 多 Agent 平台编排闭环方法论之上，面向 owner（非术语用户）的体验迭代分叉：阶段导航（F1）/ 阶段化 Prompt 注入（F2）/ 报告白话化（F3）/ 多分支编排（F4）/ 资产指定透明化（F5）。
  供编排者（主 agent）在需要调度多个 AI 平台并行完成项目、或按"用户提出改进→重跑对应层"迭代规划时加载；YY 与 TT 共享同一闭环内核，差异见 §YY（文末）。
  触发：owner 可驾驶编排 / 阶段导航与进度可视 / 阶段 Prompt 注入 / 报告白话化解读 / 多分支子会话编排 / 资产指定透明化 / 多 agent 平台并行开发编排。
version: 0.2.0
---

# YY：owner 可驾驶编排工作流（fork 自 TT 2.9.1）

> 来源：TT 2.9.1 fork（独立身份，owner-UX 迭代项目）；上游方法论见 TT 仓库（`../SKILL.md`，同一分支 `feature-yy-owner-ux`）。
> PRD：`docs/TT-OWNER-UX-PRD.md`（5 FR：F1 阶段导航 / F2 Prompt 注入 / F3 报告白话化 / F4 多分支 / F5 资产透明化）。
> 与 TT 的关系：同一编排闭环内核（0b~9 步 + 16 随包资产 + scripts）；YY 的差异只在 owner 体验层，内核改动需与上游同步评估。
> 配置：见 `config.example.json`（自仓库根）与 ONBOARDING.md；本文件所有 `$VAR` 均须替换或已在配置中定义。

## 0a. 阶段命令索引（用户一句话触发 → agent 读对应命令文件）

用户在对话里说以下任一触发词时，agent **必须先读对应命令文件再行动**（禁止凭记忆回答）：

| 用户说（任一触发词） | agent 动作 |
|---|---|
| `/yy 0`、`注入阶段 0 prompt`、`立项`、`资产整合` | Read `$SKILL_DIR/commands/yy-0-init.md` → 按其内容执行 |
| `/yy 1`、`注入阶段 1 prompt`、`需求挖掘` | Read `commands/yy-1-requirement.md` |
| `/yy 2`、`注入阶段 2 prompt`、`拆任务`、`任务拆解` | Read `commands/yy-2-planning.md` |
| `/yy 3`、`注入阶段 3 prompt`、`契约冻结`、`冻结契约` | Read `commands/yy-3-contract.md` |
| `/yy 4`、`注入阶段 4 prompt`、`派单执行`、`并行派单` | Read `commands/yy-4-execute.md` |
| `/yy 5`、`注入阶段 5 prompt`、`验收批判`、`强制技术批判` | Read `commands/yy-5-critique.md` |
| `当前进度`、`项目到哪个阶段了`、`进度图` | 运行 `node $SKILL_DIR/scripts/tt-journey.mjs --workspace <项目目录>` 并向 owner 转述结果 |

**注入纪律（每个命令文件首行已内置，agent 必须遵守）**：
1. 先按文件首行指令跑 `node $SKILL_DIR/scripts/tt-journey.mjs --prereq-check --step <n>` 机验前置；前置未 done → 告知 owner「阶段未完成」并阻断注入，**不得跳阶段**。
2. 注入时只给命令文件正文摘要（≤500 token）+ 文末指针路径（按需再读），禁止整篇复述指南文档。
3. gate 通过后（如契约审完/HTML APPROVED），agent 应跑 `tt-journey.mjs --update --step <n> --gate <g>` 记录进度（防跳状态机依赖此文件）。
4. `/yy 6`（改需求）/`/yy 7`（打假）为回跳层：并入 yy-3/yy-5 文件的「回跳指针」段处理。

> 本索引为 F2 触发接线的唯一事实源；命令文件 frontmatter 的 description 与此表一致（validate 校验）。

## 0. 变量与配置（前置，必须）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `$SKILL_DIR` | 本 skill 目录（SKILL.md 所在目录） | 内置资产根：`$SKILL_DIR/vendor/<name>/SKILL.md`、`$SKILL_DIR/templates/`、`$SKILL_DIR/scripts/` |
| `$AIHUB_ROOT` | 可选覆盖：环境变量或 `config.json`，默认 `~/.ai-hub` | 若你拥有完整 AI-Hub 资产中心，可设此变量优先引用外部 skill；否则一律使用随包内置的 `$SKILL_DIR/vendor/` 副本 |
| `$PROJECT_ROOT` | 当前项目根 | 所有产物（plans/handoffs/reports）的落点 |
| `$MEMORY_ROOT` | `$AIHUB_ROOT/memory`（未设 `$AIHUB_ROOT` 时可用 `$SKILL_DIR/memory`） | 记忆中心（分区见 §5.5） |
| `$PLATFORMS` | 由 `$SKILL_DIR/scripts/detect-platforms.mjs` 探测 | 可用平台列表与角色映射，可手工覆写 |

**初始化**：首次使用先跑 `node $SKILL_DIR/scripts/detect-platforms.mjs` 探测平台，结果写 `config.json`；跑 `validate-structure.mjs` 确认本 skill 结构完整。

> **自包含说明**：本 v2.8 为自包含版，所有增强资产已随包置于 `$SKILL_DIR/vendor/`（共 16 个：10 个 skill + 6 个 agent，清单见 §1c）。**无需任何外部 AI-Hub 即可离线使用**；若你想用自己 AI-Hub 中的同名 skill，设 `$AIHUB_ROOT` 后本 skill 会优先引用外部版本。

## 0b. 闭环全景（8 步，可回跳）

```
0 资产整合:  盘点 $AIHUB_ROOT 的 agents / skills / workflows / mcp / 项目记忆，映射各平台角色（§1）
1 文档化:    需求挖掘 gate → PRD + 设计规范 + 技术架构 + 选型审计 + 任务总纲
2 重执行1:   用户改进 → 只重做文档层（不回退已实施产物）
3 拆任务:    dev-planner 拆成几十~上百 task，每 task 带 GWT 验收 + 前后置 + 选型依据
4 重执行1,2: 用户改进 → 文档 + 重拆任务
5 规划:      任务×agent×skill×workflow×MCP 矩阵 + 执行排序 + 契约冻结时序 + 各平台开工 prompt
6 重执行1,2,3:用户改进 → 文档 + 重拆 + 重规划
7 并行派单:  多平台并行执行 → 员工写完工报告 → 编排者独立实证验收（过 → 下一任务/解锁依赖方；不过 → 跨平台切换返工，taskNN-fix 循环）
8 批判反哺:  每次验收强制技术批判（真实数据/搜索/竞品对比）→ 结论反哺下一轮分配（自动优化闭环）
```

> **平台数 N 决定模式**：N≥2 走完整闭环；N=1 退化为"串行编排 + 换子 agent/换视角复验"（§5.0），八步框架不变。

## 1. 资产整合与平台探测（第 0 步，前置红线）

- **资产清单以实际部署为准**：引用任何 skill/mcp 前先确认存在（`scripts/detect-platforms.mjs` 或 `Test-Path`），**不引用不存在的资产**。
- **平台能力差异必须先探明**：无 `Workflow()` API/某 MCP → 手动阶段调度 + CLI/Python 校验；沙箱拦 git commit/受保护路径 → 编排者沙箱外补；每平台记忆位置不同（`$MEMORY_ROOT/<平台>-projects/`，§5.5）→ 先验证渲染产物非过时，缺失先注入再开工。
- **角色分配算法**（替代固定平台角色）：探测到 N 个平台 → 编排者 = 用户指定或首个平台；其余按能力启发式分域（前端/后端/调研/审查），结果可手工覆写；N=1 → 单平台模式。
- **资产分级**（核心/增强/外部三级明细见 §6.6）：核心 = dev-planner + templates（必须有，validate 校验）；增强 = 随包 vendor 资产（§1c），缺失走内置通用步骤；外部 = TTHP（可选）。

### 1c. 随包内置资产清单（vendor/，自包含核心）

下列资产已随本 skill 分发于 `$SKILL_DIR/vendor/<name>/`，任何拿到本 skill 的用户都能直接用，不依赖外部 AI-Hub：

| 类别 | 资产 | 路径 |
|------|------|------|
| 核心规划 | dev-planner（只读规划 agent） | `$SKILL_DIR/vendor/dev-planner/dev-planner.md` |
| 需求挖掘簇 | planning（formal-prd + vibe-prd，原 prd-writer + vibe-coding-prd 合并） | `$SKILL_DIR/vendor/planning/SKILL.md` |
| 前端设计簇 | frontend-design（生成/品味/设计数据/组件选型/原型五合一） | `$SKILL_DIR/vendor/frontend-design/SKILL.md` |
| 前端辅助 | colorize、frontend-visual-validation | `$SKILL_DIR/vendor/<name>/SKILL.md` |
| 评审簇 | review（critique + be-tester + polish 三合一） | `$SKILL_DIR/vendor/review/SKILL.md` |
| 安全簇 | security（audit + harden + be-security 三合一） | `$SKILL_DIR/vendor/security/SKILL.md` |
| 调研 | agent-research | `$SKILL_DIR/vendor/agent-research/SKILL.md` |
| 视觉质检 | agent-vision-toolkit | `$SKILL_DIR/vendor/agent-vision-toolkit/SKILL.md` |
| 安全扫描 | skill-sentinel | `$SKILL_DIR/vendor/skill-sentinel/SKILL.md` |
| 后端工程 | sdlc（BMAD-METHOD 四阶段 + cline 执行） | `$SKILL_DIR/vendor/sdlc/SKILL.md` |
| 后端 agent（4） | be-architect、be-provider、be-resilience、be-validator（提示词，无 SKILL.md） | `$SKILL_DIR/vendor/be-*/<name>.md` |
| 实现簇 | implementation（dev-backend + be-implementer 合并，执行内核接 opencode） | `$SKILL_DIR/vendor/implementation/implementation.md` |

> 引用任何增强资产前先确认存在；增强资产均随包内置，故默认存在。若用户自设 `$AIHUB_ROOT`，可改为引用 `$AIHUB_ROOT/skills/<name>/SKILL.md` 的同名外部版本（§1）。后端任务链（T1/T2/T5）的 agent×skill 调度见 `templates/task-agent-matrix.md` 与 `templates/orchestration-frontend-backend.md`。
> **竞品整合内核**：每个增强资产正文含 `## Execution kernel` 段——声明对标竞品（frontend-design→shadcn-ui/bolt.new、agent-research→gpt-researcher、security→semgrep+gitleaks、skill-sentinel→SkillSpector 等）+ probe + 降级；`regression-all` S3 漂移门机器校验。资产名保留原名（方法论身份 + AIHUB_ROOT 同名替换），竞品以执行内核整合。完整内核表见 README「随包内置资产」。

> **竞品直用策略（Competitor-first，2026-09-01）**：当某任务所需竞品**已部署且可用**（清单见 `$SKILL_DIR/docs/history/COMPETITOR-DEPLOYMENT.md`：opencode/portman/semgrep+gitleaks/gpt-researcher 等），允许直接调用竞品（CLI/库/venv），TT 16 资产保留为方法论兜底。判断：**竞品可用 → 直用竞品；不可用或 TT 资产有明确差异化优势 → 用 TT 资产**（如 dev-planner 前提挑战/GWT 评审、review 批判滞后闭环）。本策略不删资产、不改内核，仅放宽 §4 调用选择。

## 2. 文档化与重执行（第 1/2/4/6 步）

- **文档集**（落 `$PROJECT_ROOT/.ai-hub/plans/`）：`README.md` 索引（决策/状态/版本）、PRD/修改规划、`tech-source-audit.md`（选型=来源+自我批判+原因）、`doc-frontend-design-spec.md`（tokens/逐页规范/交互状态机/红线）、`doc-architect-tech-arch.md`（分层架构）、`dev-plan.md`（任务总纲+执行顺序+契约冻结清单+风险）。
- **改进回跳规则**：用户提改进 → 按影响面只重跑对应层（文档→重拆→重规划→看板/开工 prompt），**已实施的产物不回退**；每次重跑 bump 版本号。
- **机器产物落点与人工文档分离**：编排内核冻结的契约 `contracts/<planId>.json`、执行报告/指令包 `artifacts/` 由 orchestrator 落在 `--workspace`（默认 `config.json` 的 `projectRoot`），不在 `.ai-hub/plans/` 人工文档区（产物表见 §5.5）。

### 2.1 需求挖掘 gate（planner 前必做）

> 定位：拆任务前用反复追问把需求挖干净，避免方向错误返工。已随包内置 planning 簇（`$SKILL_DIR/vendor/planning/SKILL.md`，含 formal-prd + vibe-prd 双模式），缺失时用本节内置流程。

1. 判断用户是否适合：问清"核心想法/解决谁的什么问题/怎么解决"——能说清→推进；模糊→追问；完全没方向→先想清楚再结构化。
2. 三视角诊断（每次只问 1-2 题，对话式）：用户视角（需求真实吗/现状/差距）、商业视角（价值/竞品/差异）、开发视角（核心能力/最难部分/MVP）。
3. 概念版对齐：一句话定位/形态/用户/价值/核心方向/不做边界 → 用户**明确认可**才推进。
4. 落地版展开：场景/动线/功能清单(🔴🟡⚪)/线框/每功能详述/数据规范/非功能需求/待确认。
5. **通用原则**：分阶段不跳跃；帮小白补盲区；**宁可标 `[待补充]` 也不编造**；用图/表代替纯文字。

### 2.2 PRD 多平台分工去幻觉（可选，N≥2 时启用）

**问单点/查多点/审交叉**：主 agent 独占"问用户"通道；验证/调研/审查并行派多平台；多平台独立理解对比 → 分歧点即幻觉点 → 追问用户。五条机制：①竞品/市场数据回源核验 ②技术可行性真实验证 ③多平台理解对比 ④证据分级标注 ⑤强制批判 gate（验收细节见 §5.2）。成本分级：简单需求单平台，复杂才多平台。

## 3. 任务拆解（第 3 步）

- 调 `$SKILL_DIR/vendor/dev-planner/dev-planner.md`（只读规划 agent）产 `dev-plan.md`：几十~上百 task，每 task 含 GWT 验收全文 + 前后置 + 联调节点 + 选型依据引用。
- **前提挑战前置（dev-planner Step 0）**：拆任务前先产 premise 表（≤6 条）+ 4 问结论（为什么现在/现状方案/窄楔子/未来适配），逐条用户确认；任一前提推翻 → 回需求澄清。用户拒绝追问时走 escape hatch（二次拒绝 → 只留 2 问 → 仍跑 Premise 确认）。话术见 `$SKILL_DIR/templates/forcing-questions.md`。
- **设计文档前置链（可选）**：有 `docs/designs/{slug}.md` 时以其为选型依据（可引用章节号）；缺失可跳过但须注明理由。模板 `$SKILL_DIR/templates/design-doc.md`。
- **规划自审（派单前）**：按 CEO 范围 / Eng 架构 / Design 体验 三视角各 ≥1 finding + 处置（CEO→Eng→Design，Design 收尾作最终体验闸门）；一键生成 `node scripts/plan-review.mjs --plan <dev-plan.md>`，填后机验 `--check <plan-review-report.md>`。总机验：`node scripts/review-gate.mjs --plan <dev-plan.md>`（须含「需求前提挑战」「规划自审」实质区块，未过 exit 1）。
- 每 task 生成独立详细文档 `tasks\taskNN-*.md`（agent/mcp/tool/skill/workflow 调用逻辑 + 关联 + 规划要点）——**不要只有简略清单**。
- 前端页面类任务：每页一个 task，内置"HTML 效果图审核 gate"（§6）。

## 4. 规划：矩阵 / 排序 / 契约冻结 / 开工 prompt（第 5 步）

- `task-agent-matrix.md`：任务×agent 链×skill×workflow×MCP 全表（按平台角色分配），含 **T1 数据库 / T2 后端 / T3 AI-RAG-MCP / T4 前端 / T5 运维** 五类任务链。
- `orchestration-frontend-backend.md`：执行排序总表 + **契约冻结机制**（①~⑭ 闸门）。
- **后端任务链**：T2 由 `be-architect`（契约）→ implementation（sdlc/develop 实现）→ security/be-resilience 加固 → be-validator/review 独立验收；sdlc 为工程主干。详见 `templates/task-agent-matrix.md`。
- **契约冻结（代码级，替代手工单点权威文件）**：orchestrator 将 plan 契约冻结为 `contracts/<planId>.json`；用户可用 `--contract <OpenAPI>.json` 提供可真校验契约本体（be-validator 走 portman 真验）。契约 = 下游开工前置：缺契约 → `CONTRACT_NOT_FROZEN` skip + 计划 failed（§5.1/§5.4）；执行期被篡改 → exit 4。人工交接仅剩 `handoffs/taskNN-discrepancy.md` 越界上浮仲裁；**仅当使用外部 TTHP 协议包才沿用其 handoff 契约单文件格式**（§附 B）。
- `templates/kickoff-prompt.md`：给每个平台的整段开工 prompt（必读文档清单 + 当前任务 + 前置条件 + 硬性守则 + 完工报告要求）。
- **skill/子 agent 强制调用检查（硬约束）**：①开工 prompt 必须列**具名 skill 路径 + 具名子 agent**，禁止"按需调用"空话 ②完工报告必须列**实际调用证据** ③验收抽查 skill 产物，"加载了 skill 但没跑工具"= 违规 ④代码级强制：产物须含资产消费证据（`assetConsumed` 指纹），缺失 → warning；`regression-all` S8 断言 exec 子任务全 true。
- **跨平台资产调用策略（防幻觉）**：其他平台调用本工作流时优先用已部署竞品或 TT 资产更优者（见 §1 竞品直用策略）；TT 资产在方法论差异化场景保留（`$SKILL_DIR/vendor/`），不得用平台自有同名 skill 冒充。验收抽查：子任务 `artifactPath` 须指向 `$SKILL_DIR/vendor/` 产物或竞品真实调用证据（CLI/库实际执行），仅文档声明冒充 = 违规。**独立子 agent 派单硬约束**：执行任务必须先派独立子 agent（task / claude -p / codex exec / openclaw agent），编排者不得自写自验（C-01）；网络失败降级时必须诚实记录 + 仍须独立验收。
- 看板（唯一事实源）：`$MEMORY_ROOT/project-handoff.md`，状态 TODO/DOING/READY_FOR_FRONTEND/DONE/BLOCKED。**两种 READY**：`READY_FOR_FRONTEND`＝看板行状态；`READY 集`＝调度时判定的可并行集合；二者以"契约已验收"为共同前置。

## 5. 多级并行派单与验收（第 7 步）

### 5.0 架构与并行度分级（N 自适应）

```
主agent（编排者）── 1 会话（规划/调度/验收汇总/集成 gate）
 ├─ 测试agent A（域 A）── 1 会话（分派 + 独立验收）→ 开发A1/A2 各 1 会话
 └─ 测试agent B（域 B）── 1 会话（分派 + 独立验收）→ 开发B1/B2 各 1 会话
```

**并行度分级（不过拟合）**：简单→单线；中等→2 线；复杂→N 线（N=可用平台/会话数上限）。**N=1 单平台模式**：跳过并行派单，"跨平台切换返工"退化为"换子 agent / 换批判视角复验"；其余纪律不变。

### 5.1 依赖调度算法（动态可并行集 + 契约先行流水线）

- **并行度受"可并行任务数"约束**，不硬凑数；"契约依赖"任务等"依赖的契约已验收"（非全部完成），"完成依赖"任务严格等前置 DONE。主 agent 每次下发前重算可并行集（动态，不一次规划死）。
- **依赖二值化**：契约依赖（接口耦合，消费冻结契约即可）→ 契约先行流水线；完成依赖（行为耦合：迁移/共享状态/schema 变更）→ 严格等 DONE。
- **契约先行已代码化（编排内核）**：冻结时子任务带 `contractMode:'frozen'`；`runtime.mjs` 调度前校验冻结契约文件存在——缺失 → `CONTRACT_NOT_FROZEN` skip 且计划 `failed`（机器可读诚实上报）。旧版 describe 契约（无 frozen 标记）保留兼容。**契约 = 下游开工的前置条件**（硬约束）。
- **三层防线**：planner 写依赖 + 主 agent 依赖图判定 + 契约验收闸门。**契约变更级联失效**：上游变更 → 受影响下游退出 READY，待重验收后解锁。

### 5.2 回传机制（最少中转开销）

- 员工完工 → 按 `templates/completion-report.md` 写报告 → **只传文件路径引用，不复制内容** → 测试 agent 读报告验收。
- **验收必须独立实证，不采信报告**：git log / 数据库实测 / 真实 HTTP / 测试实跑 / grep 审计——报告每一项都要验收方复现。
- **验收即出下一任务 prompt（强制）**：每完成一个任务验收，必须同时生成并输出下一任务开工 prompt（验收报告 + 开工 prompt 双件套）。
- **跨平台切换返工循环**：同一 task 不过，不在原平台反复改——按"切平台→修→再测"推进直到通过；N=1 时切换子 agent/视角。
- 纪律：每任务完成必须等验收指令才能做下一任务；员工跳序/连做 → 核查后纠正看板 + 注入记忆 + 追加纪律。
- **资产调用硬约束（2026-09-02 加强）**：开工 prompt 列**具名资产路径**；完工报告**必含「资产消费证据」段**（读了哪个资产 + 自检发现并修掉什么，无发现写"自检无发现"）；产物须含**资产锚点 + ≥1 内核词**（`assetConsumed` 机验）。未消费资产 = 低质量执行，验收不通过 → 返工。编排者用 `scripts/asset-call-rate.mjs` 测调用率，低于阈值登记 tracker 触发资产审查。
- **完工前自检（critique 三视角）**：子 agent 交付前按 `vendor/review/SKILL.md` critique 内核过一遍自己的改动（交互态/边界/错误反馈三视角），发现问题先修再交；报告如实记录。

### 5.3 测试 agent（验收调度员）

- 测试 agent 与开发 agent 的开工 prompt 都由**主 agent 唯一派生**（消除双源）。
- 测试 agent 只做"验收调度"（分派 + 独立实证验收），不派生开工 prompt、不重写任务要求。
- **契约独立验收闭环**：契约由开发 agent 写，但下游解锁前必须经测试 agent 独立核验（L1/CDC）置"契约已验收"；状态机：`待验收 → 已验收(解锁) → [上游改动]契约变更单 → 待重验 → 重验收/失效`。

### 5.4 集成验收 gate（主 agent 独占）

- 每次双域合并必跑**合并检查点**：①changed-files 交集扫描（git diff 两域分支，同文件双改=最高冲突信号）②L2 冒烟（合并后起服务跑关键路径）③语义级冲突（同 schema/接口/状态双改）。
- 触发完整 gate：跨测试 agent 契约变更 / 合并检查点①命中 / 里程碑 / 依赖图显示跨域耦合。
- **gate 分层**：L0 合并检查点（每次必跑）→ L1 契约 CDC → L2 集成测试 → L3 关键 E2E/回归 → L4 全量回归（仅里程碑）。
- **契约冻结机器校验（编排内核）**：契约冻结为 `contracts/<planId>.json`（`--dry-run` 不写）；`gate.mjs` 每次子任务执行前后对契约文件做 hash 比对——被篡改 → `ContractViolationError` → **exit 4**（对 §5.3 独立核验的代码级兜底）。
- **契约级 cascade（C-1）**：调度前契约文件必须存在（`contractMode:'frozen'`，缺失 → `CONTRACT_NOT_FROZEN` skip）；任一子任务因契约缺失 skip → 下游 **cascade skip（`DEP_CONTRACT_NOT_FROZEN`，不派单）**，计划 `failed`（exit 5）。
- **棕地契约模式（2026-09-05）**：真实项目常无 OpenAPI、接口边做边改，绿地 `--contract <openapi.json>` 会卡死。轻量路径：`scripts/contract-reverse.mjs` 从现有代码启发式反推契约草案（draft:true，诚实标注未确认）→ orchestrator `--contract-draft <draft.json>`（棕地：be-validator 不跑真校验、前端可凭草案开工，待后端确认后 `--contract` 升级真校验；与 `--contract` 互斥）→ 前端发现差异用 `scripts/contract-discrepancy.mjs` 生成 `handoffs/contract-change-<planId>.md` 变更单上浮后端确认。
- **一键回归/CI（BE-16 + C-2）**：`node scripts/regression-all.mjs` 顺序跑 8 段回归（含 S3 替换清单漂移门）；`node scripts/ci.mjs` = 结构校验 + review-gate self-test + plan-review --check + regression-all，任一失败 exit 1。
- **资产消费证据强化（D-1）**：带 `## Execution kernel` 的资产，产物须含**锚点 且 ≥1 方法论内核词**（culori/semgrep 等）才计 `assetConsumed=true`；无 kernel 段资产锚点即可。`regression-all` S8 断言。
- **可验证边界**：所有判定给可机验客观边界（依赖图边 / git diff 交集 / 命令退出码 / 契约文件 hash），禁止仅凭主观。
- **宿主 CLI 认证（真实教训，2026-08-31）**：接入 claude/codex/openclaw 等 `--exec` 宿主前先读 README「宿主认证备忘」。**改动用户代理体系（cc-switch/Claude/Codex/OpenClaw）配置文件前先备份、改动最小化，只经 env/CLI 参数接入、不写宿主配置**——曾误改 `~/.claude/settings.json` 致 claude `Not logged in`，openclaw 空模型项致 `config is invalid`。

### 5.5 产物落盘 / 分层记忆协议

**1. 产物落盘（引用传递，不复制内容）**：
| 产物 | 路径 | 谁写 |
|------|------|------|
| 完工报告 | `test-reports/taskNN-completion-report.md`（`$PROJECT_ROOT/.ai-hub/` 下） | 开发 agent |
| 测试验收报告 | `test-reports/taskNN-fe-tester-report.md` | 测试 agent |
| 技术批判 / 优化方案 | `plans/tasks/taskNN-技术批判.md` / `taskNN-优化修改方案.md` | 测试 agent |
| 机器契约冻结 | `contracts/<planId>.json`（编排内核自动生成） | orchestrator |
| 执行报告 / 指令包 | `artifacts/report-<planId>.md`、`artifacts/<subtaskId>/brief.md`（`--exec` 时 `result.txt`） | orchestrator |

> 编排内核的 `contracts/` 与 `artifacts/` 落在 `--workspace`（默认 `config.json` 的 `projectRoot`），与人工产物同域；均 gitignore 不入库。传递规则：开发→测试→主，每层只传文件路径引用（开工 prompt ≤200 token 准则）。

**2. 分层记忆（按执行者分区，平台无关）**：
```
$MEMORY_ROOT/
├── project-handoff.md            ← 主 agent 维护（全局看板）
├── <平台>-projects\<proj>\project_memory.md  ← 执行者=<平台> 的项目记忆
├── agent-memory\<agent>\*.md     ← 各子 agent 私有记忆
└── *.md                          ← 根级记忆专题（如 tt-project-memory.md 唯一事实源）
```
- 分区按**执行者**划分，与业务域正交；新平台接入 = 建 `<平台>-projects\` 目录 + 归集源接入。
- 各角色加载子集：主 agent=全局 plan+集成状态+契约清单（小）；测试 agent=域契约+验收准则+域记忆（中）；开发=仅本 task GWT+相关文件（最小）。

**3. 压缩规则统一**：保留（架构决策/未解决 bug/契约冻结/验收结论）；丢弃（工具输出/中间对话/冗余日志）；上下文达 70% 时压缩并写断点。

### 5.6 批判滞后任务闭环（防"只批判不修复"）

1. 每条验收批判（P2+）产出时，必须在 `plans/critique-backlog-tracker.md` 登记：修复措施 + 落点任务 + 验收指标。
2. 滞后任务文档「批判承接」段引用 tracker；开工 prompt「必读」含 tracker 路径。
3. 完工报告新增「批判承接核对」段；验收时逐条核对，未完成项标注 ❌ 不予 DONE。
4. **开工前强制拉取待优化执行项**：`node $SKILL_DIR/scripts/critique-backlog-next.mjs [--task "<任务关键词>"]` 输出 tracker 中「⬜ 待落地」C-xx 清单 + `docs/history/tasks/critique-<Cxx>-task.md` 摘要，供开工 prompt 引用；本任务领域命中某 C-xx（按 task/资产关键词与落点重叠）时，完工报告「批判承接核对」段必须列完成证据，未完成标 ❌ 不予 DONE；无重叠写"无承接项"。

## 6. 前端页面设计执行流程（每页必经，含 HTML 原型 gate）

### 6.0 为什么必须走 HTML 原型

先出 HTML 原型 → 用户签收 → 才写 React：改动只在静态文件，返工成本低一个量级。**HTML 原型 = 用户签收设计后再投入实现成本的闸门。**

### 6.1 流程总览（硬 gate，顺序不可跳）

```
0 风格定调（项目级前置）：问风格 → 无想法引导"对标品类" → 实时搜索主流/小众/获奖站点 → 出 N 个风格 Prompt → 用户选定 → 冻结
1 页面设计规范：有就用 doc-frontend-design-spec（缺失页先补规范）
2 产出 HTML 原型：纯 HTML（全交互态 + 内联样式 + 模拟数据），不写框架，让用户看效果
3 用户审核 ← 【Gate A：用户审美签收】（主观）
4 AI 按 SOP 返工改 HTML（§6.2，每步接真实工具调用）
5 循环 3↔4 直到用户签收 APPROVED ← 【Gate A 通过】（看板态 `HTML_APPROVED`）
6 冻结设计 token + 布局快照：产出 `design-tokens.json` + 原型各视口截图基线（FR-2，来自 frontend-design）
7 原型→实现一致性门 ← 【PARITY_CHECK：token 冻结 + 接近度比对】（客观机验）
8 才允许写框架组件（fe-implementer，按冻结 token 实现，禁硬编码色值）
9 测试 + 视觉验证（fe-tester + playwright 截图矩阵）← 【Gate B：技术验收】（客观机验）
```

**双 gate 区分**：Gate A（用户审美签收，HTML 阶段，主观，看板态 `HTML_APPROVED`）；Gate B（技术验收，组件阶段，客观机验，看板态 `REACT_DONE`）。**两个 gate 都过才真正完成**。

**原型→实现一致性门（PARITY_CHECK，FR-2，Gate A 与 Gate B 之间）**：Gate A APPROVED 时冻结 `design-tokens.json` + 截图基线；React 实现完成、进 Gate B 前跑 `$SKILL_DIR/scripts/prototype-parity-check.mjs --proto <原型.html> --impl <实现路径> [--threshold 0.03]`：token 差异须为 0；截图接近度（Playwright 可用时）≥ 1-threshold，不可用如实标 `SCREENSHOT_UNAVAILABLE`（不伪造）。不一致 → 返工对齐（`FIX-R{n}` 回读 AUDIT LOG），直至 tokenDiff=0 且接近度达标。

### 6.2 HTML 返工设计调用链 SOP（每步接真实工具调用）

调用链（增强资产可用时）：定方向 → 发散（≥3 个 axis 互斥变体）→ 配色（60/30/10 + 对比度）→ 打磨（12 维 checklist）→ **视觉验证（Playwright 截图多视口 + 读图真渲染 + grep hex）** → 独立审查（audit 五维 + critique UX）→ 用户签收 → 组件实现。
- **增强资产缺失时降级**：用通用设计原则（§6.3 反 AI Slop 清单 + 四大基本原则）替代具名 skill，但**视觉验证与审查两步不可省**。
- **返工类型判定**：布局/结构 → 发散；色彩 → 配色；细节/对齐 → 打磨；整体"不像设计" → 全链。
- **AUDIT LOG 状态机**：HTML 头部注释 `DRAFT → SUBMITTED → REVISING → APPROVED/REJECTED`；返工标记 `<!-- FIX-R{n}-{序号} -->`。

### 6.3 AI Slop 红线（一票否决，任一命中即返工）

1. 深色底+霓虹强调 / 紫-蓝渐变 2. 渐变文字 3. 玻璃拟态滥用 4. Hero 大数字指标模板 5. 千篇一律图标+标题+正文卡片网格 6. 通用字体（Inter/Roboto/Arial） 7. 纯黑/纯白/纯灰 8. 灰字压彩色底 9. 弹跳/弹性缓动 10. 动画 layout 属性（应只动 transform/opacity） 11. 圆角+单侧粗彩边 12. 装饰性 sparkline。

**可自动校验（Gate B 必查）**：硬编码 hex=0 / 通用字体=0 / 纯黑白=0 / 弹性缓动=0 / layout 动画=0（grep 机验）；其余主观项保留人工 review。

### 6.4 失败模式与止损

| 失败模式 | 止损 |
|---|---|
| 变体趋同（3 稿只是换色） | 重跑发散，强制 axis 命名互斥 |
| 过度打磨（功能未完成就 polish） | 先功能完整，polish 是最后一步 |
| 截图骗人（只看代码不看渲染） | 强制读图真渲染 |
| 讨好式批判（审查全 PASS） | 换视角从 UX 重审，诚实判 AI Slop |
| 返工失忆（重复上轮已改问题） | 先读 AUDIT LOG 历史轮次 |
| 猜色翻车 | 色彩决策明确澄清，禁止猜 |

### 6.5 强制要求

- README 索引列：风格定调 gate + HTML 审核流 + 设计规范 + 看板 HTML 审核态（`HTML_DRAFT/SUBMITTED/REVISING/APPROVED/PARITY_CHECK/REACT_DONE`）。
- 硬 gate：没有设计规范 → 先补规范再产出；**未 APPROVED → 不派组件任务**；PARITY_CHECK 未过 → 不得进入 Gate B。开工 prompt 硬性守则含：`未收到 APPROVED 前不得进入框架实现`。
- 视觉回归（FR-6）：前端任务完成、进入 Gate B 前必跑 `node $SKILL_DIR/scripts/visual-regression.mjs`（L0 像素回归 + L1 VLM 语义抽样），报告并入验收；L0 FAIL → 返工，L0_NOT_AVAILABLE → 如实标注（L1 照常），不伪造 PASS。
- 效果图数据用**真实数据**（贴近真实数量），禁止空数据/MOCK 冒充。

### 6.6 资产分级明细（增强资产，均可选）

| 级别 | 资产 | 用途 | 缺失降级 |
|------|------|------|---------|
| 核心（随包） | `$SKILL_DIR/vendor/dev-planner/dev-planner.md`、`$SKILL_DIR/templates/*` | 拆任务/产物模板 | — |
| 增强（随包） | frontend-design、planning（簇） | 设计系统生成/品味护栏/需求挖掘 | 内置 `$SKILL_DIR/vendor/<name>/SKILL.md`，缺失走通用步骤（§2.1/§6.2） |
| 增强（随包） | agent-research、agent-vision-toolkit、skill-sentinel | 调研/视觉质检/第三方 skill 安全扫描 | 内置 `$SKILL_DIR/vendor/<name>/SKILL.md`，跳过该环节或人工替代 |
| 外部（引用） | TTHP 协议包（handoff） | 任务交接协议 | 契约冻结退化为文件+人工核对 |

> 引用任何增强资产前先探测存在性；不引用不存在的资产（§1）。

## 7. 强制技术批判 + 优化修改（第 8 步，硬闸门）

遵循 `task-review-critique-rule.md`（如存在；缺失用内置规则）：每次验收 = 常规验收 + 技术批判 + 优化修改方案，缺一不可。

1. **常规验收**：目标完成度 / 可运行结果与证据 / 是否造假或逻辑断裂。
2. **技术批判（默认假设非最优）**：基于真实数据/真实搜索/真实调研，覆盖近 1-3 年论文/benchmark、开源、官方文档、失败案例、更优替代。
3. **竞品对标强制**：每条批判必须引用真实竞品实证（URL + 日期 + 关键结论）。**无竞品对标段的批判 = 无效批判**，不足 3 条按硬闸门拒绝。
4. **批判者人设**：以同类顶级竞品为唯一批判根据，故意挑刺（"你的 X 架构和竞品 Y 差在哪？"/"生产环境应该怎么办？"/"为什么你必然不及格？"）。
5. **输出**：`task{id}-技术批判.md`（≥3 条，每条含问题/竞品对标/证据 URL/差距/优化方案/最小验证/收益成本）+ `task{id}-优化修改方案.md`（可落地修改 + 量化指标 + 测试方案 + 风险）。
6. **批判滞后闭环**：每条批判在 tracker 登记（§5.6），滞后任务验收逐条核对。
7. **硬闸门**：批判缺失 / 有效批判<3 / 无竞品对标 / 方案不可落地 / tracker 未更新 → 不得验收通过。**代码级强制**：`node scripts/review-gate.mjs --dir <产物目录> --id <taskNN>`（校验批判 ≥3 条含 URL+日期、优化方案存在、tracker 含该 id），未过 exit 1；`--self-test` 自检。**竞品 URL 真实化（机器验证）**：`node scripts/review-gate.mjs --dir <产物目录> --id <taskNN> --verify-urls` 对每条 URL 做真实可达性检查（HEAD/GET，短超时；网络可用时 HTTP 200/301/302 → PASS，不可达/404 → FAIL 无效；整网不可用 → 诚实标 `VERIFY_SKIPPED`，不因断网误杀也不假装验证过）。代理可走 `$TT_HTTP_PROXY` env（可选），缺省直连。
8. 批判结论反哺：触发优化迭代或创建新 task 指派执行（自动优化闭环）。

## 8. 记忆与同步

- 记忆分区按执行者（`<平台>-projects\`），与业务域正交；跨工具状态 → `project-handoff.md`；编排记录 → `$PROJECT_ROOT/.ai-hub/session-memory.md`。
- 同步：每 task 完成后运行 `node $SKILL_DIR/scripts/sync.mjs`（或平台对应同步）；**同步方向先确认**（平台侧=事实源时先改平台侧再 gather，改 Hub 侧会被回滚）。
- 记忆检索：先索引/摘要（≤1000 token）→ 按需读取，禁止全量；可用 memory-mcp（`memory_index/search/read/write`）。
- 定期压缩记忆写断点，作为新会话恢复上下文的断点。

## 9. 迭代优化机制（本 skill 自进化，必做）

1. 每次执行结束，追加一条到 `CHANGELOG.md`：日期 / 项目 / 版本 / 问题 / 处置 / 修改点。
2. 定期做"外部对比自批判"：检索最新 MAS 编排/自进化研究（如 Skill-MAS），用真实数据对比本 skill 的 8 步闭环 vs 论文三段式；取可迁移原则（证据回写/脚手架保护），弃不适配项（K 多轨迹、ground-truth 依赖）。
3. 修改 skill 时必须 bump `version` 并更新 frontmatter 触发词。

## 附 A：变量声明清单（validate-structure 校验用）

> 与 §0 变量表一致，validate 机验用（凡正文出现的新 `$VAR` 必须先登记于此）。

`$SKILL_DIR` `$AIHUB_ROOT` `$PROJECT_ROOT` `$MEMORY_ROOT` `$PLATFORMS` `$TT_HTTP_PROXY`

## 附 B：与 TTHP 协议包的关系

- 本 skill 的契约冻结/handoff 概念引用 `open-source/handoff-protocol`（TTHP，MIT）——可选增强。
- 无 TTHP 时：契约冻结退化为"契约文件 + 人工核对"，状态机纪律不变。
- 版本各自独立演进：skill 版本（本文档 version）与 TTHP 协议版本互不绑定。

## 附 C：YY 与 TT 的差异段（YY 专有，TT 上游无）

> 本段是 YY fork 的差异登记处：上游 TT 2.9.1 之外的全部 YY 意图。内核（0b~9 步闭环 + scripts + vendor 16 资产）与 TT 2.9.1 相同。

| FR | 名称 | YY 差异（相对 TT 2.9.1） | 落点 |
|----|------|------------------------|------|
| F1 阶段导航/进度 | owner 随时知道编排到哪个阶段、禁跳阶段 | `.tt-state/journey.json` 与 state-summary 同源派生；命令注入前先读 journey，前置未 done 即警告 | 规划中（PRD §2.2/2.3） |
| F2 Prompt 注入 | 阶段化 Prompt 以命令文件注入 300-500 token 摘要 | `commands/yy-*.md` 为内容母本（压缩自 `docs/TT-USER-PROMPT-GUIDE.md`） | 规划中 |
| F3 报告白话化 | 术语报告附 owner 可读白话版 | 复用 completion-report 资产消费证据段，补白话视图 | 规划中 |
| F4 多分支 | task 多线自动升级编排 + `--session <id>` 隔离 | 目录命名空间前缀，非新状态机；汇总复用 summary-read.mjs | 规划中 |
| F5 资产透明化 | 指定资产/域的可见性（candidates + preconditions 具名注入） | 数据源 `scripts/lib/matrix.mjs` CLUSTERS；泛化 kickoff-prompt T4 模式至 T1-T5 | 规划中 |

约束（PRD §范围外）：不引 npm 依赖实现 F1-F5（渐进披露 + 原生 Node）；不自动派发子会话（只建议+隔离+汇总）；向量记忆/swarm 不做。依赖缺口盘点见 `docs/DEPENDENCY-AUDIT.md`。
