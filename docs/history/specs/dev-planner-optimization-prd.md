# dev-planner 优化 PRD：需求前提挑战 + 规划多视角评审 + design-doc 前置链

**文档版本**：v1.0
**创建日期**：2026-08-31
**产品代号**：dev-planner-optimization
**对标基准**：gstack（garrytan-gstack-07b59e3，本地源码逐文件实读，非转述）

---

## 1. 背景与目标

### 1.1 背景

TT skill 的 `dev-planner`（`vendor\dev-planner\dev-planner.md`，60 行）是核心规划资产：GWT 拆任务（Given/When/Then）+ 写 `.claude/specs`。现状三条短板，对照竞品 gstack 逐一成立：

| # | TT 现状短板 | 后果 | gstack 对应机制 |
|---|---|---|---|
| 1 | dev-planner 收到需求直接「解析→拆任务」，不挑战需求前提 | 需求方向错误时整批 task 白拆，返工成本放大到几十个 task | `office-hours` 六问（demand reality / status quo / desperate specificity / narrowest wedge / observation / future-fit）+ Phase 3 Premise Challenge |
| 2 | TT §7 批判 gate 只在**任务验收后**（事后批判），`dev-plan.md` 产出时无**事前**多视角审视 | 范围/架构/体验问题到实现后（跨平台派单后）才暴露，返工跨平台 | `autoplan` 串 CEO→Design→DX→Eng 四层自动评审 + `plan-ceo-review` 4 scope mode / 9 Prime Directives |
| 3 | §2 文档化产 PRD/架构/设计规范后直接进拆任务，缺"design doc 级"聚焦单功能的设计决策记录 | 评审无上游事实源，前提/方案对比/不做清单易丢 | `office-hours` Phase 5 写 design doc（含 Premises/Approaches/Supersedes）→ `plan-*` 评审以 design doc 为 truth |

### 1.2 目标

把 dev-planner 从"需求→任务的翻译器"升级为"**前提挑战 → 设计决策 → 多视角评审 → GWT 任务**"的规划内核，对标 gstack 只强不弱：

1. **R1 需求重构 forcing questions**：拆任务前 4-6 强制问题挑战前提，写入 dev-plan.md 头部（gstack office-hours 六问 + Premise Challenge）。
2. **R2 规划多视角评审**：dev-plan.md 产出后 CEO 范围 / Eng 架构 / Design 体验 三层自审（gstack autoplan 串 CEO→Eng→Design→DX），并入 TT §7 批判 gate 生态（review-gate 已代码化）。
3. **R3 design-doc 上游概念**：dev-plan.md 增"设计文档→评审→任务"前置链（gstack office-hours 写 design doc → plan-* 评审 → 实现）。

### 1.3 约束（不可违反）

- **融入 TT 体系不孤立**：dev-planner 是提示词资产 → 改动面 = `dev-planner.md` + `templates/*` + 可选脚本；**GWT 保留（差异化）**，`.claude/specs` 输出格式不动。
- **零外部依赖**：不新增 npm 包；不动 `orchestrator.mjs` / `scripts/lib/planner.mjs` / `matrix.mjs` 核心路由（planner.mjs 是 orchestrator 代码路由，与 dev-planner 提示词资产是两个东西，勿混淆）。
- **平台无关**：纯 markdown 提示词为主，脚本可选且只用 Node 内置 API。
- **向后兼容**：既有 dev-plan.md 结构保留，新内容以 append 区块形式；不重写旧 spec。
- 按"能加入多少是多少"排 P0/P1/P2。

---

## 2. 竞品对标（真实源码引用）

| gstack 文件 | 具体机制（要点） | 本 PRD 吸收 |
|---|---|---|
| `office-hours/sections/phase-2a-startup-diagnostic.md` | **六问**：Q1 Demand Reality（"最有力的需求证据是什么——不是感兴趣，是明天消失会抓狂"）Q2 Status Quo（现状 workaround 代价）Q3 Desperate Specificity（指名道姓的人/头衔/后果）Q4 Narrowest Wedge（本周愿意付费的最小版本）Q5 Observation & Surprise（亲眼看用户用，被什么惊到）Q6 Future-Fit（3 年后更核心还是更边缘） | R1 核心：4 问精简版入 dev-plan.md 头部（P0），六问全文 + red flags + smart routing 入模板（P1） |
| 同上 | **Pushback Patterns**（5 种：vague market→force specificity / social proof→demand test / platform vision→wedge challenge / growth stats→vision test / undefined terms→precision demand）+ **Anti-Sycophancy Rules**（禁"That's interesting"，必须 take a position + 什么证据会改变立场） | R1-P1 模板含推压话术与反谄媚红线 |
| `office-hours/SKILL.md` | **HARD GATE**：本 skill 只产 design doc 不写码（"Do NOT invoke any implementation skill, write any code… Your only output is a design document."）；**Premise Challenge**：输出 `PREMISES: 1. [statement] — agree/disagree?` 逐条 AskUserQuestion 确认；**Escape hatch**：用户不耐烦时先说服一次→降级问 2 个最关键问题→二度拒绝直接放行 | R1 核心：premise 确认表 + escape hatch 降级规则（FR-102/104） |
| `office-hours/sections/design-and-handoff.md` | **design doc 模板**（Startup/Builder 双模式）：Problem Statement / Demand Evidence / Status Quo / Target User & Narrowest Wedge / Constraints / Premises / Approaches Considered（≥2）/ Recommended Approach / Open Questions / Success Criteria / Distribution Plan / Next Steps；`Supersedes:` 字段形成修订链；repo 双写 `docs/designs/`；**Spec Review Loop**：dispatch 独立子 agent 5 维（Completeness/Consistency/Clarity/Scope/Feasibility）对抗评审，≤3 轮，收敛守卫（同问题重复→持久化为 Reviewer Concerns） | R3 核心：design-doc.md 模板（P1）去 YC 特有部分（资源推荐/个人 plea），保留决策记录结构 |
| `plan-ceo-review/SKILL.md` | **4 scope mode**（EXPANSION/SELECTIVE/HOLD/REDUCTION，用户选模式后忠实执行不漂移）；**9 Prime Directives**（Zero silent failures / Every error has a name / Data flows have shadow paths / Interactions have edge cases / Observability is scope / Diagrams mandatory / Everything deferred written down / 6-month future / Permission to say "scrap it"）；**PRE-REVIEW SYSTEM AUDIT**（git log -30 / diff --stat / TODO-FIXME grep / 读 CLAUDE.md+TODOS.md）；**design doc check + Prerequisite Skill Offer**（无 design doc 先推 office-hours，非强制） | R2 核心：CEO 范围自审视角（scope mode 判定 + Prime Directives 精简）；R3：design doc 缺失提示链 |
| `plan-eng-review/sections/review-sections.md` | **4 review sections**（Architecture / Code quality / Test / Performance）；**Confidence Calibration**（每条 finding 带 1-10 置信度，格式 `[P1] (confidence: 9/10) file:line — desc`）；**Pre-emit verification gate**（必须引用触发 finding 的具体代码行，引不出→强制降置信度）；**REGRESSION RULE**（回归测试必加，不可跳过）；**Outside Voice**（独立模型二读，Cross-Model Tension 呈现，User Sovereignty 用户裁决） | R2 核心：Eng 架构自审视角（4 项 + confidence + pre-emit 引用行）；P2：outside voice 预留 |
| `plan-design-review/SKILL.md` | **9 Design Principles**（Empty states are features / hierarchy / specificity over vibes / edge cases are UX / AI slop is enemy / responsive / a11y / subtraction default / trust）；**7 passes**（IA / Interaction State 表 LOADING-EMPTY-ERROR-SUCCESS-PARTIAL / Journey & Emotional Arc / AI Slop Risk / Design System / Responsive & A11y / Unresolved Decisions）；AI Slop blacklist 11 条 | R2 核心：Design 体验自审视角（交互状态表 + AI slop + 无障碍，精简为 3 项） |
| `plan-devex-review/SKILL.md` | **DX First Principles 8 条**（Zero friction at T0 / Learn by doing / Decide for me let me override / Fight uncertainty…）；**Seven DX Characteristics**（Usable/Credible/Findable/Useful/Valuable/Accessible/Desirable）；TTHW Benchmarks（Time to Hello World <2min champion） | R2-P2：DX 视角（TT 资产本身即开发者工具，可选用） |
| `autoplan/SKILL.md` | **一键串流水线**：Phase 0 intake（restore point + scope 探测 grep 词表：UI 2+ 命中 / DX 2+ 命中）→ CEO（永远先）→ Design（仅 UI）→ DX（仅 DX）→ **Eng（永远最后，ship gate）**；**Sequential Execution MANDATORY**（严格顺序不并行）；**6 Decision Principles**（completeness / boil lakes / pragmatic / DRY / explicit over clever / bias toward action）；**Decision Classification**（Mechanical 静默自动 / Taste 自动+final gate 呈现 / **User Challenge 永不自动**） | R2 核心：顺序强制（CEO→Eng→Design 串行，Eng 收尾）+ 自动裁决原则（P2 脚本版）；User Challenge 不自动裁决 |

> 对标结论：gstack 把"规划"做成 6 问 → design doc → 4 层评审的完整前链；TT 已有 GWT 拆任务 + 事后批判 gate，缺的正是这段**事前**前链。本 PRD 补的就是它，GWT 拆任务保留为差异化后段。

---

## 3. 需求拆解（R1 / R2 / R3，含 GWT 验收）

### 3.0 痛点 → 需求映射

| 痛点 | 来源 | 映射需求 |
|---|---|---|
| 拆任务不挑战需求前提，方向错误时整批 task 白拆 | 现状 dev-planner.md 无前提校验；gstack 用六问+Premise 前置拦截 | R1（FR-101~104） |
| 规划产出无事前多视角评审，问题到实现/派单后才暴露 | TT §7 批判 gate 仅在验收后；gstack autoplan 事前串评 | R2（FR-201~204） |
| 缺 design-doc 级上游决策记录，评审无事实源 | TT §2 文档化直接跳拆任务；gstack office-hours→plan-* 以 design doc 为 truth | R3（FR-301~303） |

---

### 3.1 R1 需求重构 forcing questions（拆任务前挑战前提）

**目标**：dev-planner 在拆任务前强制回答"为什么现在做、现状方案、最小范围、前提是否成立"，未确认前提不得拆任务。

#### 功能点：dev-plan.md 头部「需求前提挑战」区块（P0）

- 需求 ID：FR-101
- 来源证据：`office-hours/sections/phase-2a-startup-diagnostic.md` 六问 + `office-hours/SKILL.md` Phase 3 Premise Challenge
- 描述：`templates/dev-plan.md` 在「目标」之后新增「需求前提挑战」区块，含 4 个 forcing questions 的结论区 + Premise 确认表（agree/disagree 逐条）。
- 验收标准：
  - Given 一份 `dev-plan.md` 模板文件
  - When 打开模板头部
  - Then 存在「需求前提挑战」区块，包含 4 问（Q1 需求真实性：最强证据；Q2 现状方案：用户当前 workaround 与代价；Q3 窄楔子：最小可交付版本 + 不做清单；Q4 未来适配：3 年后更核心还是更边缘）各留结论填写位，且含 Premise 确认表（`| # | 前提陈述 | 确认 |`，允许 agree/disagree 两态）

#### 功能点：dev-planner.md 增加 Step 0「前提挑战」（P0）

- 需求 ID：FR-102
- 来源证据：`office-hours/SKILL.md` "PREMISES: 1. [statement] — agree/disagree?" 输出格式 + HARD GATE 前置思想（规划前先确认方向）
- 描述：`vendor/dev-planner/dev-planner.md` Process 增加 Step 0：解析需求后先产出 premise 列表（≤6 条）与 4 问初步结论，逐条向用户确认；**任一前提被推翻 → 回到需求澄清，不进入 태스크 분해**。保留 GWT 输出格式不变。
- 验收标准：
  - Given 调用 dev-planner 且输入一个含隐含假设的需求
  - When 按 Process 执行
  - Then 输出顺序为 Step 0（前提挑战）→ Step 1（요구사항 분석）→ Step 2（태스크 분해）；且前提确认表为"全部 agree"前不产出 `태스크 분해` 章节；前提被推翻时明确要求用户澄清后重跑
  - Given 输出 spec 文件
  - When 检查 `.claude/specs/dev-{feature-slug}.md` 结构
  - Then 原 GWT 格式（`## 태스크 분해` / FE-NN、BE-NN + AC）完整保留，仅在文件头新增「前提与确认」小节

#### 功能点：forcing questions 深度模板（六问全文 + red flags + smart routing）（P1）

- 需求 ID：FR-103
- 来源证据：`phase-2a-startup-diagnostic.md` 六问全文（含各问 red flags：如"People say it's interesting"、"500 waitlist signups"、"The market is growing 20% per year"）+ 产品阶段路由（pre-product→Q1,2,3 / has users→Q2,4,5 / has paying customers→Q4,5,6 / pure engineering→Q2,4）+ Anti-Sycophancy Rules + Pushback Patterns 5 种
- 描述：新增 `templates/forcing-questions.md`：六问完整话术（TT 化措辞）、每问 red flags、按产品阶段 smart routing 表、反谄媚红线（禁"有意思/可以考虑"→必须给立场+什么证据改变立场）、推压话术 5 模式。
- 验收标准：
  - Given `templates/forcing-questions.md` 文件
  - When 检查内容
  - Then 包含六问（demand/status-quo/specificity/wedge/observation/future-fit）、每问 red flags 清单、产品阶段→问题路由表、反谄媚禁语清单 ≥5 条、推压模式 ≥3 种（各含 BAD/GOOD 对照话术）

#### 功能点：escape hatch 降级规则（P1）

- 需求 ID：FR-104
- 来源证据：`phase-2a-startup-diagnostic.md` Escape hatch（先说服一次 → 问 2 个最关键问题 → 二度拒绝直接放行；仅当用户提供完整证据型方案才允许全跳，但仍跑 Premise Challenge）
- 描述：dev-planner.md Step 0 注明降级路径：用户不耐烦时最多保留 2 个最关键问题（按 smart routing 选），二次拒绝则跳过 4 问、仅做 Premise 确认；Premise 环节不可跳过（对齐 gstack"仍跑 Premise Challenge"）。
- 验收标准：
  - Given 用户连续两次拒绝回答 forcing questions
  - When dev-planner 继续执行
  - Then 不再追问 4 问，但仍输出 Premise 确认表供用户快速确认/修正；Premise 全拒绝时不产出任务

---

### 3.2 R2 规划多视角评审（CEO 范围 / Eng 架构 / Design 体验 三层自审）

**目标**：dev-plan.md 产出后、派单前，强制 CEO/Eng/Design 三视角自审各 ≥1 条 finding；并入 §7 批判 gate 生态（review-gate 已代码化，规划阶段自审 + 验收阶段批判两层并存）。

#### 功能点：dev-plan.md 新增「规划自审」区块（P0）

- 需求 ID：FR-201
- 来源证据：`autoplan/SKILL.md` 流水线（CEO→Eng 顺序、Eng 最后收尾）+ `plan-ceo-review` 4 scope mode + `plan-eng-review` 4 sections + `plan-design-review` 7 passes
- 描述：`templates/dev-plan.md` 新增「规划自审（plan-review）」区块，三视角各一子表：CEO 范围（scope mode 判定：EXPANSION/SELECTIVE/HOLD/REDUCTION + 不做清单复核 + 每项 deferred 写理由）、Eng 架构（架构边界/数据流 shadow path/测试覆盖缺口/性能与 N+1，每 finding 带 confidence 1-10 与引用行）、Design 体验（交互状态表 LOADING-EMPTY-ERROR-SUCCESS-PARTIAL + AI slop 检查 + 无障碍）。每视角要求 ≥1 条 finding（允许"No issues found + 说明检查了什么"，对齐 anti-skip 规则）与处置结论（采纳/驳回+理由）。
- 验收标准：
  - Given 一份 `dev-plan.md`
  - When 检查「规划自审」区块
  - Then 存在三视角子表（CEO/Eng/Design）；每子表要求 ≥1 finding 行 + 处置结论列；Eng 子表含 confidence 列与引用文件/行列；Design 子表含交互状态表模板；无"整块留空跳过"
  - Given 区块为空或全视角零说明
  - When 主 agent 验收 dev-plan.md
  - Then 判定为未完成（对应 §7 硬闸门精神，不允许无说明跳过）

#### 功能点：评审视角提示词库（P1）

- 需求 ID：FR-202
- 来源证据：`plan-ceo-review` 9 Prime Directives 与 18 认知模式 / `plan-eng-review` Confidence Calibration + Pre-emit verification gate / `plan-design-review` 9 Design Principles + 7 passes / `plan-devex-review` Seven DX Characteristics（可选）
- 描述：新增 `templates/plan-review-perspectives.md`：三（+1 可选 DX）视角的独立提示词段——CEO（9 Prime Directives 精简为 6 条 + 每模式姿态）、Eng（4 项检查 + finding 格式 `[P1] (confidence: N/10) file:line — desc` + 必须引用代码/模板具体行）、Design（交互状态表 + AI slop blacklist 11 条精简 + 无障碍 44px/对比度 4.5:1）、DX 可选（TTHW + 7 characteristics）。供测试 agent / 批判者 / 子 agent 在规划阶段复用。
- 验收标准：
  - Given `templates/plan-review-perspectives.md`
  - When 检查内容
  - Then 含 ≥3 个视角段（CEO/Eng/Design），每段含检查项清单 + 输出格式要求；Eng 段含 confidence 规则与 pre-emit 引用行规则；Design 段含交互状态表模板；DX 段标注"可选"

#### 功能点：review-gate.mjs 扩展 --plan 模式（P1）

- 需求 ID：FR-203
- 来源证据：`scripts/review-gate.mjs` 现有结构（extractRows/isValidRow/checkReview/selfTest）
- 描述：`scripts/review-gate.mjs` 新增 `--plan <dev-plan.md 路径>` 模式：校验文件含「需求前提挑战」「规划自审」两区块头（正则匹配），任一缺失 exit 1；`--self-test` 增加好/坏样例断言保持通过；不改变现有 task 批判校验路径。
- 验收标准：
  - Given 含两区块的 dev-plan.md
  - When 运行 `node scripts/review-gate.mjs --plan <path>`
  - Then 输出 PASS 并 exit 0
  - Given 缺「规划自审」区块的 dev-plan.md
  - When 运行同一命令
  - Then 输出 FAIL 并 exit 1
  - Given 任意改动后
  - When 运行 `node scripts/review-gate.mjs --self-test`
  - Then 输出 PASS（原 task 批判校验路径行为不变）

#### 功能点：autoplan 式一键串评审脚本（P2）

- 需求 ID：FR-204
- 来源证据：`autoplan/SKILL.md` Phase 0-4（scope 探测 grep 词表 / Sequential Execution MANDATORY / 6 Decision Principles / User Challenge 永不自动）
- 描述：新增 `scripts/plan-review.mjs`：输入 dev-plan.md → 顺序执行 CEO→Eng→Design 三视角（每视角调 `templates/plan-review-perspectives.md` 对应段作提示词），自动裁决（6 principles：completeness/boil lakes/pragmatic/DRY/explicit/action）→ 汇总 `plan-review-report.md` + final gate 呈现 taste 分歧；User Challenge（改变用户既定方向）不自动，输出到 gate 等人工。仅用 Node 内置 API。
- 验收标准：
  - Given 一份含任务的 dev-plan.md
  - When 运行 `node scripts/plan-review.mjs --plan <path>`
  - Then 依次输出 CEO→Eng→Design 三阶段报告（顺序固定，Eng 最后），产出 `plan-review-report.md`，exit 0
  - Given 提示词模板缺失
  - When 运行
  - Then 输出明确错误并 exit 1（不静默降级跳过）

---

### 3.3 R3 design-doc 上游概念（设计文档→评审→任务前置链）

**目标**：dev-plan.md 明确"先有 design-doc（可选但推荐）→ 评审引用 → 再拆任务"的链式依赖，缺失时显式提示走 §2.1 需求挖掘。

#### 功能点：dev-plan.md「设计文档前置链」区块（P0）

- 需求 ID：FR-301
- 来源证据：`plan-ceo-review/SKILL.md` PRE-REVIEW 的 design doc check + Prerequisite Skill Offer（无 design doc 先推 office-hours，**非强制**）；`office-hours` design-and-handoff "Other skills will find it automatically"
- 描述：`templates/dev-plan.md` 新增「设计文档前置链」区块：`design-doc.md`（若存在）路径引用 → 评审依据声明 → 任务拆分；缺失时提示"建议先走 §2.1 需求挖掘或产出 design-doc，可跳过但需在区块标注跳过理由"。
- 验收标准：
  - Given 一份 `dev-plan.md`
  - When 检查区块
  - Then 含设计文档引用位（有/无 + 路径 + Supersedes 记录位）与"缺失时如何处理"的说明（推荐补、可跳过、跳过须注明理由）
  - Given 项目存在 design-doc.md
  - When dev-planner 拆任务
  - Then 任务总纲的选型依据/依赖列可引用 design-doc 章节号（如 `design-doc.md §Premises`）

#### 功能点：design-doc.md 模板（P1）

- 需求 ID：FR-302
- 来源证据：`office-hours/sections/design-and-handoff.md` Startup 模板（Problem Statement / Demand Evidence / Status Quo / Target User & Narrowest Wedge / Constraints / Premises / Approaches Considered≥2 / Recommended Approach / Open Questions / Success Criteria / Distribution Plan / Next Steps；`Supersedes:` 修订链；Spec Review Loop 5 维对抗评审）
- 描述：新增 `templates/design-doc.md`：TT 化 design doc 模板（去掉 YC 特有：创始人资源/Garry plea），保留决策记录核心结构 + `Supersedes:` 修订链 + "Reviewer Concerns" 段（评审未决问题持久化）+ 复用 §7 批判 gate 的 URL+日期对标段作为方案对比证据位。
- 验收标准：
  - Given `templates/design-doc.md`
  - When 检查内容
  - Then 含章节：问题陈述/需求证据/现状方案/目标用户与窄楔子/约束/前提(表)/方案对比(≥2 备选，各含取舍)/推荐方案/开放问题/成功标准/不做清单/下一步；头部含 `Status: DRAFT|APPROVED` 与 `Supersedes:` 字段说明；不含 YC 品牌内容

#### 功能点：design-doc 修订链与检索约定（P2）

- 需求 ID：FR-303
- 来源证据：`office-hours` design-and-handoff `Supersedes:` 修订链 + `grep -li` 关键词发现既有 design doc（Phase 2.5 Related Design Discovery）
- 描述：约定 design-doc 落 `docs/designs/{topic-slug}.md`（项目内，可提交共享）；dev-planner Step 0 开工前 grep 关键词检索既有 design doc（如 `grep -li "<keyword>" docs/designs/*.md`），命中则读入并声明 build-on/start-fresh；修订时填 `Supersedes:` 引用上一版。
- 验收标准：
  - Given `docs/designs/` 存在 ≥1 份旧 design doc
  - When 产出新 design doc
  - Then 新文档含 `Supersedes: {旧文件名}` 且目录内可追溯完整修订链
  - Given 需求含与既有 design doc 相同关键词
  - When dev-planner Step 0 执行
  - Then 检索输出提示命中既有 design doc 并给出路径（提示 build-on 或 start-fresh 由用户裁决）

---

## 4. 与 TT 体系集成点（每项落哪个文件/流程）

| 需求 | 落点文件 | TT 流程位置 | 不破坏项 |
|---|---|---|---|
| R1（FR-101/102） | `vendor/dev-planner/dev-planner.md`（Step 0）+ `templates/dev-plan.md`（前提挑战头） | §3 任务拆解的前置步骤 | `.claude/specs` GWT 格式、`태스크 분해` 输出、AGENT_ENTRIES 校验（目录存在性不变） |
| R1 深度（FR-103/104） | `templates/forcing-questions.md`（新增） | §3 前置 + §2.1 需求挖掘 gate 衔接 | planning 簇职责不变（§2.1 管"做什么"，Step 0 管"为什么现在做/最小范围"） |
| R2（FR-201） | `templates/dev-plan.md`（规划自审区块） | §5 规划（第 5 步）产出后、派单前；与 §7 批判 gate 形成"事前自审 + 事后批判"两层 | 批判 gate 验收路径（task 批判文档）不动 |
| R2 深度（FR-202/203/204） | `templates/plan-review-perspectives.md`（新增）+ `scripts/review-gate.mjs`（扩展 --plan）+ `scripts/plan-review.mjs`（新增，P2） | §7 强制技术批判的规划侧扩展；`--self-test` 保证既有调用零回归 | `review-gate.mjs` 原 task 校验逻辑与输出格式 |
| R3（FR-301） | `templates/dev-plan.md`（设计文档前置链区块） | §2 文档化 → §3 拆任务之间 | 文档集路径（`.ai-hub/plans/`）不变 |
| R3 深度（FR-302/303） | `templates/design-doc.md`（新增）+ `docs/designs/` 目录约定 | §2 文档化产出链；Sync 自动复制新模板 | `sync.mjs` templates→项目复制逻辑（新模板自动进 `.ai-hub/templates`） |

流程串（改造后）：

```
§2 文档化（PRD/架构/设计规范）
  ↓ 可选：design-doc.md（FR-302/303）── R3 前置链（FR-301）
  ↓ dev-planner Step 0 前提挑战（FR-102，4 问 + Premise 表）── R1（FR-101/103/104）
  ↓ GWT 拆任务（保留，差异化）
  ↓ 规划自审 CEO→Eng→Design（FR-201，串行 Eng 收尾）── R2
  ↓ 派单/契约冻结/验收
  ↓ §7 批判 gate（review-gate.mjs，不变）→ 批判反哺
```

---

## 5. 范围 P0-P2

### P0（MVP，必做）

| FR | 内容 | 文件 |
|---|---|---|
| FR-101 | dev-plan.md 头部「需求前提挑战」区块（4 问结论区 + Premise 确认表） | `templates/dev-plan.md` |
| FR-102 | dev-planner Step 0 前提挑战流程（前置确认，GWT 保留） | `vendor/dev-planner/dev-planner.md` |
| FR-201 | dev-plan.md「规划自审」区块（CEO/Eng/Design 三视角 ≥1 finding + 处置） | `templates/dev-plan.md` |
| FR-301 | dev-plan.md「设计文档前置链」区块（有/无 + 跳过须注明） | `templates/dev-plan.md` |

P0 即形成完整闭环：**前提挑战 → 设计文档引用 → GWT 任务 → 三视角自审**。

### P1（增强，推荐）

| FR | 内容 | 文件 |
|---|---|---|
| FR-103 | 六问全文 + red flags + smart routing + 反谄媚 + 推压话术 | `templates/forcing-questions.md`（新增） |
| FR-104 | escape hatch 降级规则 | `vendor/dev-planner/dev-planner.md` |
| FR-202 | 三（+DX 可选）视角提示词库 | `templates/plan-review-perspectives.md`（新增） |
| FR-203 | review-gate.mjs `--plan` 模式 + self-test 扩样 | `scripts/review-gate.mjs` |
| FR-302 | design-doc.md 模板（决策记录 + Supersedes + Reviewer Concerns） | `templates/design-doc.md`（新增） |

### P2（搁置/可选）

| FR | 内容 | 文件 |
|---|---|---|
| FR-204 | autoplan 式一键串评审脚本（6 decision principles + User Challenge 不自动） | `scripts/plan-review.mjs`（新增） |
| FR-303 | design-doc 修订链 + 关键词检索约定（grep 既有 design doc） | `docs/designs/` 约定 + dev-planner Step 0 |
| 附加 | Outside Voice 跨模型独立评审（对齐 plan-eng-review，需外部 codex，暂不符合"零外部依赖"约束 → 搁置） | — |

> 排级依据：P0 全部是"模板/提示词资产"改动（零脚本、零回归风险、直接可落地）；P1 是深度与可机验（含 review-gate 扩展但 self-test 兜底）；P2 是脚本自动化与跨会话检索（有价值但可后置）。

---

## 6. 风险与回归影响

### 6.1 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| forcing questions 拖慢拆任务、用户反感 | 规划变重 | FR-104 escape hatch：二次拒绝只留 2 问 → Premise 快速确认 → 放行；Premise 环节不可省（对齐 gstack） |
| 与 §2.1 需求挖掘 gate 职责重叠（planning 簇） | 两处都问、流程冗长 | 边界声明：§2.1 挖"做什么/给谁"，dev-planner Step 0 验"为什么现在做/最小范围/前提成立"；forcing-questions.md 注明衔接 |
| 规划自审流于形式（全 PASS 讨好） | 闸门空转 | FR-201 要求每视角 finding 必带说明（"No issues found + 检查了什么"），对齐 anti-skip；FR-202 要求 Eng finding 引用具体行，无法引用即降置信度（pre-emit 精神） |
| design-doc 缺失导致前置链阻断开发 | 流程卡死 | FR-301 明确"推荐补、可跳过、跳过须注明理由"（对齐 Prerequisite Skill Offer 非强制） |
| 改动破坏既有校验 | regression | 见 6.2 回归影响矩阵 + 验收命令 |

### 6.2 回归影响矩阵（已实测源码确认）

| 被影响资产 | 校验逻辑（源码行） | 本 PRD 改动是否触碰 | 兜底 |
|---|---|---|---|
| `scripts/validate-structure.mjs` | L56 `AGENT_ENTRIES` 含 `dev-planner`（目录存在性）；L82 扫描全部 `templates/*.md` 做可移植性检查（禁盘符绝对路径、`C:` 盘 Users 目录、本机用户名等泄露） | 改 dev-planner.md **内容**不删目录 → 安全；新增模板**文件**会自动被扫描 → 新模板禁止含本机绝对路径 | 改动后跑 validate-structure |
| `scripts/sync.mjs` | L65-67 templates → 项目 `.ai-hub/templates` 全量复制 | 新增模板自动同步 → 安全 | sync.mjs 模板渲染 dry-run |
| `scripts/review-gate.mjs` | L50-68 self-test 好/坏样例断言；L39-48 checkReview | FR-203 扩展为 append 新 check + 新样例，不删既有路径 | `--self-test` 必须 PASS |
| `scripts/regression-all.mjs` | 8 段回归（含 S1 结构校验 / S3 资产替换清单漂移门） | 模板/提示词改动影响 S1 结构校验面（只增不减 → 安全）；S3 若含模板清单需同步（FR-302 新增模板时核对） | 全量回归保持全绿 |
| `scripts/lib/planner.mjs` + `matrix.mjs` | T3 簇 candidates 含 `dev-planner`（orchestrator 代码路由） | **本 PRD 明确不触碰** | 不改文件 |
| `SKILL.md` §3/§7 | 引用 `vendor/dev-planner/dev-planner.md` 与 review-gate 命令 | §3 描述可随 Step 0 增补一句（可选），§7 不动 | 若改 §3 文字，validate ④ 引用资产存在性仍通过 |

---

## 7. 验收标准（Given/When/Then + 命令）

### 7.1 功能验收（P0）

| # | Given | When | Then |
|---|---|---|---|
| A1 | 本 PRD 实施完成 | 打开 `templates/dev-plan.md` | 依次含「需求前提挑战」「设计文档前置链」「规划自审」三个新区块（位于目标/任务总纲之间与之后），原有任务总纲/执行顺序/契约冻结清单/风险清单四段完整保留 |
| A2 | 调用 dev-planner 处理含隐含假设的需求 | 按 Process 执行 | 先产出前提表（≤6 条 + 4 问结论）→ 用户确认 → 才出现 `태스크 분해`；spec 文件头含「前提与确认」，GWT 结构不变 |
| A3 | 用户对 4 问连续拒绝 | 执行 Step 0 | 不再追问 4 问，仍输出 Premise 表快速确认；Premise 全拒则不拆任务 |
| A4 | `templates/plan-review-perspectives.md` 存在 | 检查内容 | 含 CEO/Eng/Design 三视角段，Eng 段含 confidence 与引用行规则，Design 段含交互状态表 |
| A5 | 存在 design-doc.md | dev-planner 拆任务 | 任务总纲选型依据列可引用 design-doc 章节号 |

### 7.2 命令验收（全部 exit 0 即过）

```bash
# 1. 结构校验：vendor/dev-planner 目录存在 + 全部模板可移植性（新模板无绝对路径）
node scripts/validate-structure.mjs

# 2. 批判闸门自检（FR-203 若实施）：好样例 PASS、坏样例拦截，原有 task 校验不变
node scripts/review-gate.mjs --self-test

# 3. 规划闸门（FR-203 若实施）：
#    含三区块的 dev-plan.md → PASS exit 0；缺「规划自审」区块 → FAIL exit 1
node scripts/review-gate.mjs --plan <dev-plan.md>

# 4. 模板同步：新模板出现在渲染清单（FR-103/202/302 若实施）
node scripts/sync.mjs --templates-only --dry-run

# 5. 一键回归（S1 结构 / S2 重试 / S3 替换清单 等 8 段全绿）
node scripts/regression-all.mjs

# 6. 一键串评审（FR-204 若实施）：输出 CEO→Eng→Design 顺序报告 + plan-review-report.md
node scripts/plan-review.mjs --plan <dev-plan.md>
```

### 7.3 非功能验收（NFR）

| NFR | 验收 |
|---|---|
| 零外部依赖 | `git diff --stat` 无新依赖文件；新脚本仅 import node 内置模块 |
| 平台无关 | 新增模板/脚本中 grep 无盘符绝对路径、`C:` 盘 Users 目录、`/Users/`、`/home/` 绝对路径（validate-structure ⑤ 自动拦截） |
| GWT 保留 | 任一既有 `.claude/specs/dev-*.md` 样例经新 dev-planner 重跑，`## 태스크 분해` 与 FE/BE-NN + AC 结构不变 |
| 向后兼容 | 既有 dev-plan.md（旧版）文件不被重写；review-gate 原 task 批判调用路径行为不变 |
| 评审可机验 | review-gate --plan 用正则校验区块头存在（不依赖 LLM 判断） |

---

## 8. 实施建议顺序（供实现方）

1. **P0-1**：改 `templates/dev-plan.md`（三区块一次性加齐，结构最小冲击）
2. **P0-2**：改 `vendor/dev-planner/dev-planner.md`（Step 0 + escape hatch）
3. **P1-1**：新增 `templates/forcing-questions.md`、`templates/plan-review-perspectives.md`、`templates/design-doc.md`
4. **P1-2**：扩展 `scripts/review-gate.mjs`（--plan + self-test 新样例）
5. **P2**：`scripts/plan-review.mjs` + design-doc 检索约定
6. 每步后跑 §7.2 命令 1/5 确认零回归
