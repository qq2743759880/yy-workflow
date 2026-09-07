# yy-dev-plan — YY owner-UX 迭代任务拆解（M1 窄楔子先行）

> 由 dev-planner（只读规划）生成 · 版本 v1.0 · 日期 2026-09-07 · 分支 feature-yy-owner-ux
> 上游 PRD：`docs/TT-OWNER-UX-PRD.md` v1.0（5 FR / 19 GWT / 里程碑 M1-M3）；基线 TT 2.9.1 fork（yy v0.1.0）
> 机器校验：`node scripts/review-gate.mjs --plan docs/yy-dev-plan.md`（yy/ 内）或仓库根 `node yy/scripts/review-gate.mjs --plan yy/docs/yy-dev-plan.md`
> 范围声明：本计划只改 `yy/` 包内文件，TT 本体零改动；全部路径为仓库相对路径；选型依据统一引自 PRD §2.1（T17-RESEARCH 2026-09-07 实时核验数据）。

## 设计文档前置链（FR-301）

- 设计文档：有 —— PRD 本身承担 design-doc 职责（§2 设计对齐 / §2.3 关键设计决策 / §3 源码实况核对）
- `Supersedes:`（修订时引用上一版文件名）：无（首版）
- 评审依据声明：本计划以 PRD §2.1 竞品借鉴点 + §2.2 衔接表 + §2.3 决策为选型依据（引用处标注章节号）
- 缺失处理：不适用（PRD 已过 §2.1 需求挖掘 gate，5 痛点已确认）

## 目标

一句话：让 owner 在 YY 里「知道到哪一步（F1）、一句话注入阶段 Prompt（F2）、看得懂报告（F3）、多分支不跑爆（F4）、看得见资产与域（F5）」——先以 M1（F1+F2）窄楔子验证，通过后落 M2（F3+F5）、M3（F4）。

## 需求前提挑战（FR-101）

> 拆任务前 6 条前提逐条确认（用户已确认，本轮复核无推翻）；4 问结论已定。

### Premise 确认表

| # | 前提陈述 | 确认 |
|---|---------|------|
| P1 | YY 是 fork 改造（独立身份 yy v0.1.0，`SKILL.md` frontmatter name: yy），不在 TT 本体上迭代 | agree |
| P2 | 全部 5 个 FR 落在 yy 包内实现；TT 2.9.1 main 稳定不动，作为上游基线与回退锚点 | agree |
| P3 | 依赖策略=能用就用（yy 自带 node_modules：culori/poline/chroma-js/tsyringe/inversify/cockatiel/polly-js/playwright-core 等），不为「零依赖」而砍能力；但 F1-F5 新增实现仍以原生 Node/markdown 为主（PRD §2.3 决策 4） | agree |
| P4 | 验收口径=yy 自身回归（`scripts/regression-all.mjs` 8 段全 PASS）+ PRD GWT 逐条实测，不引用外部测试替身 | agree |
| P5 | 触发方式务实：以文件读取（commands/*.md）为主通道，斜杠命令仅为入口之一；无斜杠机制的平台用同义触发词（「注入阶段 N prompt」）等效（PRD R6） | agree |
| P6 | 自包含分发：新增内容全部随 yy 包分发（commands/templates/vendor/scripts/docs），离线可用，不依赖外部 AI-Hub | agree |

### 4 问结论区

| # | Forcing Question | 结论 |
|---|-----------------|------|
| Q1 | 需求真实性：为什么现在做？ | owner 体验是当前最大摩擦（PRD §1.1 P1-P5 五痛点全部流程体验类，用户已确认）；竞品机制（anthropics/skills 渐进披露、SuperClaude 斜杠命令、BMAD 状态外置）已被 T17 2026-09-07 实时核验为成熟，「只借设计不引依赖」的窗口期成立 |
| Q2 | 现状方案与代价？ | TT 2.9.1 main 稳定不动：用户手动复制 guide 各阶段 Prompt、无进度导航、报告术语裸奔、多分支单会话跑爆；代价=跳阶段返工 + 每阶段粘贴成本 + owner 审核失焦 |
| Q3 | 窄楔子（+不做清单）？ | M1=F1 阶段导航（journey.json + tt-journey.mjs + 收尾挂钩）+ F2（commands 6 文件 + 防跳机验）先行验证，通过后再 M2/M3；不做清单=swarm/向量记忆/pipx 安装器/Python 依赖链/自动派发子会话（PRD §范围外） |
| Q4 | 未来适配？ | owner 可驾驶是编排类 skill 的长期核心面；成熟后可反哺 main 或独立演进——fork 隔离使两条路都不被锁死（4 问结论已由需求方确认） |

结论：6 条前提逐条 agree、无推翻，4 问结论已确认——前提挑战通过，进入拆解。

## 任务总纲

| task | 标题 | 依赖类型 | 依赖 | GWT 验收摘要 | 平台/agent | 契约(如有) |
|------|------|---------|------|-------------|-----------|-----------|
| task01 | tt-journey.mjs + journey.json schema（F1 核心） | 无（schema 先冻结） | — | 8 步进度图 ✓/●/○ + INFERRED 空态 + --update 幂等 | opencode（dev）+ 独立测试 agent（验收） | 内部契约 C1：journey.json schema（yy/journey@1） |
| task02 | orchestrator 收尾挂钩 journey | 完成 | task01 | writeStateSummary 同点派生、失败/resume 路径覆盖、单点写 | opencode | 复用 C1 |
| task03 | commands/ 6 阶段命令文件（F2） | 契约 | task01（C1 schema） | 6 文件各 ≤500 token 摘要 + guide 指针行 + 先读 journey 指令 | opencode | 内部契约 C2：commands frontmatter 格式 |
| task04 | 防跳阶段机验 + validate 扫描扩展 | 完成 | task01, task03 | 前置未 done 阻断+警告；命令文件漂移门机验 | opencode | 复用 C1/C2 |
| task05 | M1 回归 + 验收 | 完成 | task01-04 | regression 8/8 + validate 0 泄露 + FR-1/FR-2 GWT 逐条 | 独立测试 agent | — |
| task06 | templates/owner-review/ 5 份指引（F3） | 无（结构先冻结） | — | 四段结构 ≤1 屏 + 术语白话 + 无悬空引用 | opencode | 内部契约 C3：owner-review 四段结构 |
| task07 | 3 产物模板头部指引引用行 | 完成 | task06 | completion-report/contract/dev-plan 各 1 行 | opencode | — |
| task08 | 开工 prompt 全簇资产清单 + 域声明（F5） | 完成 | —（与 M1 并行） | T4 清单不缩水 + 全簇泛化 + 域声明要求 | opencode | — |
| task09 | 完工报告资产消费按域分组 | 完成 | task08 | 域标签与开工声明同源、硬约束段不变 | opencode | — |
| task10 | M2 回归 + 验收 | 完成 | task06-09 | 8/8 + 0 泄露（含 owner-review）+ FR-3/FR-5 GWT 逐条 | 独立测试 agent | — |
| task11 | dev-planner 拆子会话建议段（F4 建议层） | 完成 | —（与 M1/M2 并行） | lane≥3 或多 L 级出建议段；≤2 不出段 | opencode | — |
| task12 | orchestrator --session 隔离（F4 隔离层） | 完成 | task02 | 命名空间隔离 + 无 flag 8/8 + 收尾路径断言 | opencode | 内部契约 C4：session 命名空间规则 |
| task13 | 汇总链路（F4 汇总层） | 完成 | task12 | summary-read 跨 session/分支断点清单 + 文档可执行 | opencode | — |
| task14 | M3 回归 + 全量验收 | 完成 | task11-13, task05, task10 | 8/8 + PRD §7.3 五门逐门过 | 独立测试 agent | — |

## 契约冻结顺序（本迭代无外部 API 契约——内部契约先行）

> 原则：先定 schema/格式，再写实现；实现 task 不得改契约，改契约须回本文件修订记录。本迭代无对外 API 契约，以下 4 项为 yy 内部契约，是 task01-14 的「契约型依赖」锚点。

- [ ] **C1 journey.json schema（yy/journey@1）**——task01 开工前冻结：
  - 落点 `<workspace>/.tt-state/journey.json`（与 state.json 同域，`scripts/lib/store.mjs:4` 同目录约定）
  - 顶层字段：`schema:"yy/journey@1"`、`steps[]`、`plans[]`、`updated_at`
  - `steps[]` 9 节点（0-8）与 `SKILL.md` §0b 闭环全景一致：0 资产整合 / 1 文档化 / 2 重执行1 / 3 拆任务 / 4 重执行1,2 / 5 规划+契约 / 6 重执行1,2,3 / 7 并行派单 / 8 批判反哺；每节点仅 `step/name/status(pending|in_progress|done)/gates_passed[]/artifacts[]/updated_at` 六字段
  - `plans[]` 只增追加：`{planId, cluster, status, summaryPath, updatedAt}`（与 state-summary 交叉核对用，字段名对齐 `tt/state-summary@1`）
  - gate 词汇表：`concept-signed` / `premise-signed` / `contract-frozen` / `gate-a-approved`
  - 纪律：只记进度/产物路径，禁止复述文档内容（BMAD "smaller or equal"，PRD C3）；gates/artifacts 只增不清
- [ ] **C2 commands frontmatter 格式**——task03 开工前冻结：每文件 frontmatter 含 `name` / `description`（各一行，~100 token 当量）+ `journey-step` + `prereq-gates`（gate 词汇表子集）；正文=300-500 token 阶段摘要（目标+人工 gate 清单+纪律钥匙词+产物路径）+ 第③级指针行（guide 具名章节 + SKILL.md 相关节）
  - 命名与步骤映射（冻结）：`commands/yy-0-init.md`→step 0（无 prereq）；`yy-1-requirement.md`→step 1（prereq step0）；`yy-2-planning.md`→step 3（prereq step1+gate concept-signed）；`yy-3-contract.md`→step 5（prereq step3）；`yy-4-execute.md`→step 7（prereq step5+gate contract-frozen）；`yy-5-critique.md`→step 8（prereq step7 in_progress 或 done）
  - 命名决策：取 `yy-*` 前缀（`SKILL.md` 附C L315 已登记 `commands/yy-*.md`；与上游 TT 同装时命令面不冲突）；PRD §3.2 M1-3 / FR-2 的 `tt-*` 命名行在 task03 内一并修订（PRD 修订记录追加 1 行）
- [ ] **C3 owner-review 四段结构**——task06 开工前冻结：每份指引固定四段「这个 gate 在审什么（一句白话）/ 看哪几个字段（指向产物模板具名段落）/ PASS-FAIL 判断口径（可操作判据）/ 常见坑（敷衍签收后果）」，术语首次出现给白话解释，全份 ≤1 屏
- [ ] **C4 --session 命名空间规则**——task12 开工前冻结：`--session <id>` 时 state 落 `.tt-state/<id>/state.json`、journey 落 `.tt-state/<id>/journey.json`、契约落 `contracts/<id>/`、产物落 `artifacts/<id>/`；id 仅允许 `[A-Za-z0-9_-]+`（防路径穿越）；不传 flag 全部路径与 2.9.1 逐字节一致

## 任务拆解（逐 task 详单）

### M1 导航与注入（窄楔子，先做）

#### task01 · tt-journey.mjs + journey.json schema（F1 核心，PRD M1-1）

- 前置依赖：无脚本依赖；**C1 schema 先冻结再实现**（契约型）
- 涉及文件（只改 yy/ 内）：新增 `scripts/tt-journey.mjs`（schema 定义与路径归一函数随脚本导出，供 task02/task12 复用）
- 契约冻结顺序：先冻结 C1（本文件§契约冻结顺序）→ 再实现
- 选型依据：BMAD 状态外置+最小化纪律（PRD §2.1：agents read code better than prose about code；journey 只记 step/gates/artifacts 三类字段）；进度图渲染层不落盘（PRD §2.3 决策 2）
- 行为要点：
  - 读取 `<workspace>/.tt-state/journey.json` 渲染 ASCII 进度图：done=✓、当前=●、pending=○ + 当前位置 + 下一阶段 + 待办 gate 清单
  - `--update --step <n> [--gate <g>] [--artifact <相对路径>]`：步骤 n 置 done、gate/产物追加（幂等去重、只增不改历史）
  - 无 journey.json 时按 state-summary/state.json 推断并整图标 `INFERRED`（注明推断来源）；完全无历史输出空图+初始化指引
  - `--prereq-check` 机验入口见 task04（本 task 预留子命令挂点，不做阻断逻辑）
- GWT 验收（全文）：
  - Given journey.json 记步骤 0-3 done、步骤 5 in_progress；When 运行 `node scripts/tt-journey.mjs --workspace <dir>`；Then 输出 8 步进度图（含 ✓/●/○ 标记）+「当前位置：规划+契约」「下一阶段：并行派单」「待办 gate：contract-frozen」
  - Given 编排者完成某轮 gate 审批；When 运行 `tt-journey.mjs --update --step 5 --gate contract-frozen`；Then 步骤 5 置 done、gates_passed 追加 contract-frozen、updated_at 刷新；重复执行幂等（gate 不重复追加）；既有历史 gates 不清除
  - Given 棕地首跑无 journey.json 且无 state-summary/state.json；When 运行 tt-journey；Then 输出「INFERRED（journey 未初始化）」空进度图并给初始化指引，exit 0，不编造进度
  - Given 无 journey.json 但存在 `artifacts/<planId>/state-summary.json`（status=done）；When 运行 tt-journey；Then 按 state-summary 推断步骤 7 进度、整图标注 INFERRED（注明推断数据源），不落盘、不伪装已初始化
  - Given journey.json 写出；When 逐字段核对；Then 完全符合 C1 schema（steps 0-8 对齐 SKILL.md §0b，无复述文档内容的字段）

#### task02 · orchestrator 收尾挂钩 journey（F1 派生点，PRD M1-2）

- 前置依赖：task01（完成依赖：C1 schema + journey 写入函数就绪）
- 涉及文件：改 `scripts/orchestrator.mjs`（仅一处挂钩：`writeStateSummary`（L165-229）内部同步派生 journey；复用 task01 导出的路径归一/写入函数）
- 契约冻结顺序：复用 C1；不新增字段
- 选型依据：journey 与 state-summary **同源派生、单点写**（PRD §2.2 衔接表 + R2 风险缓解：单轮单事实，防两套进度矛盾）；gate 级更新（--update）是第二写入口但只增不改，两口径可交叉核对
- 行为要点：成功路径（L434）与失败路径（L392）共用 writeStateSummary → 挂钩放函数内部天然双覆盖；resume 全部完成短路（L282-287）补一次 journey 同步；dry-run 路径（L371-376）维持不写任何盘（含 journey）
- GWT 验收（全文）：
  - Given orchestrator 一轮执行收尾；When `writeStateSummary` 写 `artifacts/<planId>/state-summary.json`；Then `.tt-state/journey.json` 同步更新（同 planId/cluster/产物路径写入 plans[] 追加段），两文件字段可交叉核对且无矛盾
  - Given 执行失败（plan status=failed）走 L392 收尾；When state-summary 以 failed 落盘；Then journey 同步更新（如实记录，失败路径不缺 journey）
  - Given resume 且全部子任务已 done 的短路分支；When 直接出报告退出；Then journey 仍被同步一次（不滞留旧位置）
  - Given dry-run；When `--plan --dry-run`；Then 不写 state/contracts/journey 任何文件（维持 2.9.1 行为）
  - Given journey 已有历史 gates；When 收尾派生再次写入；Then 历史 gates 只增不改，全程仅 writeStateSummary 一个派生写入点（无双源）

#### task03 · commands/ 6 阶段命令文件（F2，PRD M1-3）

- 前置依赖：task01 的 C1 schema（契约型：文件内 journey 读取指令需引用 journey 落点与词汇表）；与 task02 可并行
- 涉及文件：新增 `commands/yy-0-init.md`、`yy-1-requirement.md`、`yy-2-planning.md`、`yy-3-contract.md`、`yy-4-execute.md`、`yy-5-critique.md`（6 文件）；改 `docs/TT-OWNER-UX-PRD.md`（§3.2 M1-3/FR-2 中 `tt-*` 命名行修订为 `yy-*`，修订记录追加）
- 契约冻结顺序：先冻结 C2（frontmatter 格式 + 步骤映射）→ 再写文件
- 选型依据：anthropics/skills 渐进披露三级模型收紧版（①frontmatter ~100 token ②正文 300-500 token ③路径指针按需读，PRD §2.1）；SuperClaude 斜杠命令形态 + 反面教训（30 命令/pipx 安装器跳票 → 只做 6 个、纯 markdown 零安装，PRD C2）；双源漂移门（PRD C1：每文件必须含 guide 具名章节指针行）
- 行为要点：内容母本=`docs/TT-USER-PROMPT-GUIDE.md` 对应段压缩改写（阶段 0→L29、1→L48、2→L63、3→L77、4→L96、5→L109；回跳层阶段 6（L127）并入 yy-3、阶段 7（L139）并入 yy-5 的指针段——只压缩不改语义，无新写作量）；每文件首行指令=「先读 `.tt-state/journey.json`（或运行 `node scripts/tt-journey.mjs`）确认前置，前置未 done 输出警告并阻断注入」
- GWT 验收（全文）：
  - Given 用户说「/yy 3」；When agent 读 `commands/yy-3-contract.md`；Then 注入 ≤500 token 阶段摘要（含契约审阅 gate 清单与钥匙词「契约先冻结」）+ 第③级详情路径，不整篇复制 guide 正文
  - Given 6 个命令文件全部存在；When 运行 `node scripts/validate-structure.mjs`；Then 0 警告 0 泄露（不含本机绝对路径），且每文件含指向 guide 具名章节的指针行（漂移门，PRD C1）
  - Given 用户说「注入阶段 3 prompt」（非斜杠形式）；When agent 匹配同义触发词；Then 注入行为与「/yy 3」完全一致
  - Given 同一会话连续推进阶段 1→2→3；When 逐个说 /yy 1、/yy 2、/yy 3；Then 每次仅注入当前阶段摘要（≤500 token），累计上下文增量 ≤1.5k token（3 文件正文合计 ≤4500 汉字当量，实测字符数入验收证据）
  - Given 任一命令文件；When 查看首行指令；Then 为 journey 读取+前置未过阻断指令（与 task04 机验联动）

#### task04 · 防跳阶段机验 + validate 扫描扩展（F1×F2 联动，PRD M1-3/FR-1 GWT3）

- 前置依赖：task01（tt-journey 骨架）、task03（命令文件与 C2 frontmatter 就位）
- 涉及文件：改 `scripts/tt-journey.mjs`（新增 `--prereq-check --cmd <commands/yy-N-*.md>` 子命令：读命令文件 frontmatter 的 journey-step/prereq-gates，对照 journey 判定，exit 0 放行 / exit 3 阻断+警告行）；改 `scripts/validate-structure.mjs`（扫描清单扩展：`commands/*.md` 与 `templates/owner-review/*.md` 纳入可移植性扫描与命令文件结构校验——frontmatter 必含 journey-step/prereq-gates、正文必含 guide 指针行与「先读 journey」指令行，缺任一 FAIL）
- 契约冻结顺序：复用 C1/C2；不新增契约
- 选型依据：BMAD「人工 gate 显式化：先 approve 再执行」的 TT 代码级等价物（PRD §2.3 决策 3：机器可校验，比 prompt 叮嘱可靠）；validate 漂移门承接 PRD C1 结论
- GWT 验收（全文）：
  - Given journey 中步骤 5 未 done（gates_passed 无 contract-frozen）；When 运行 `node scripts/tt-journey.mjs --prereq-check --cmd commands/yy-4-execute.md`；Then exit≠0 且输出「阶段 5 未完成，派单执行不得开工，先回阶段 3/5」类警告
  - Given 步骤 0-5 全 done 且 gates_passed 含 contract-frozen；When 同上机验；Then exit 0，允许注入阶段 4 Prompt
  - Given validate 扩展后；When 扫描 commands/ 6 文件；Then 每文件 frontmatter 含 journey-step/prereq-gates + 指针行 + 先读 journey 指令行，缺任一 → validate FAIL（机验可复现）
  - Given agent 执行注入流程；When 前置未过；Then 行为=输出警告并阻断执行类注入、提示回退阶段，命令文件中不存在绕过 journey 的注入路径描述

#### task05 · M1 回归 + 验收（验收 task）

- 前置依赖：task01-04 全部完成
- 涉及文件：无新增/修改（只跑机验与 GWT 实测；证据记入验收记录）
- 契约冻结顺序：—（验收方）
- 选型依据：验收口径=P4（yy 回归 8 段 + GWT 逐条）；独立实证验收纪律（guide 阶段 4：不采信完工报告）
- 验收动作：`node scripts/regression-all.mjs`（在 yy/ 内）→ 8/8 PASS；`node scripts/validate-structure.mjs` → 0 错误（泄露 0，含 commands/*.md 新扫描面）；FR-1 四条 + FR-2 四条 GWT 逐条实测（命令输出/文件路径留证）；上下文预算抽查（6 文件正文各 ≤500 汉字当量）
- GWT 验收（全文）：
  - Given M1 全部实现；When 运行 regression-all；Then 结果 8 PASS / 0 FAIL（S1-S8 与 2.9.1 基线一致，新增代码零破坏）
  - Given 新增 commands/ 与 journey 文件；When validate-structure；Then 0 错误 0 泄露（commands/*.md 已入可移植性扫描清单）
  - Given FR-1/FR-2 GWT 全集（task01 五条 + task02 五条 + task03 五条 + task04 四条）；When 逐条实测；Then 全部 PASS 且证据可复现
  - Given 上下文预算门（PRD §7.3 第 4 条）；When 抽测命令文件正文长度；Then 单阶段注入 ≤500 token 当量

### M2 可读化与透明化

#### task06 · templates/owner-review/ 5 份指引（F3，PRD M2-1）

- 前置依赖：无（母本=guide「人工 gate 决策表」L18-23 + 各产物模板既有段落）；与 M1 并行，出口在 M2
- 涉及文件：新增 `templates/owner-review/concept-signoff.md`（概念版签收）、`premise-challenge.md`（前提挑战 Step0）、`contract-review.md`（契约审阅）、`html-approved.md`（HTML APPROVED / Gate A）、`acceptance-report.md`（验收报告）
- 契约冻结顺序：先冻结 C3（四段结构）→ 再写 5 份
- 选型依据：guide 人工 gate 决策表为母本（PRD FR-3 状态标注）；四段结构对齐 PRD §4 FR-3 行为定义；术语白话化（如 contractMode:'frozen'=「接口清单已锁定，改动须走变更单」）
- GWT 验收（全文）：
  - Given owner 打开任一份指引；When 阅读；Then ≤1 屏内获得四段结构（审什么/看哪几个字段/PASS-FAIL 判断口径/常见坑），术语首次出现有白话解释，无裸术语堆砌
  - Given 指引中「看哪几个字段」的产物引用；When 对照对应模板（completion-report「资产消费证据」段、contract 接口/错误码段、dev-plan「需求前提挑战」段等）；Then 段落名真实存在，无悬空引用
  - Given 5 份指引全部存在；When validate-structure；Then 0 泄露（不含本机绝对路径）

#### task07 · 产物模板头部加指引引用行（F3 接线，PRD M2-2）

- 前置依赖：task06（引用行指向 5 指引的真实文件名）
- 涉及文件：改 `templates/completion-report.md`、`templates/contract.md`、`templates/dev-plan.md`（各 1 行：`> owner 审核指引：templates/owner-review/<对应指引>.md`——completion-report→acceptance-report.md、contract→contract-review.md、dev-plan→premise-challenge.md）
- 契约冻结顺序：—（纯引用行，不改既有段落语义）
- 选型依据：PRD FR-3 引用接线（gate 产物落盘时模板自带引用，owner 拿到产物即拿到审法）；concept-signoff/html-approved 的入口由 task08 开工 prompt 段与 guide 指针段承接（不在本 task 强加第 4 处改动）
- GWT 验收（全文）：
  - Given owner 拿到一份契约冻结产物；When 查看产物头部；Then 能看到 `templates/owner-review/contract-review.md` 的相对路径引用并按指引审查
  - Given completion-report.md / dev-plan.md；When diff 检查；Then 各仅新增 1 行引用（既有段落零改动），引用目标文件真实存在
  - Given 3 个模板；When validate-structure；Then 0 泄露

#### task08 · 开工 prompt 全簇资产清单 + 域声明（F5，PRD M2-3）

- 前置依赖：无（数据源 `scripts/lib/matrix.mjs` CLUSTERS L1-6 只读不改；先例=模板 T4 专用段 L31-41）
- 涉及文件：改 `templates/kickoff-prompt.md`（T4 专用段保留为 T4 深化层，其上新增「按簇注入本 task 资产清单」通用段：T1-T5 各列 candidates 具名路径 + preconditions 逐条；新增域声明要求段：agent 开工首行声明「本 task 属 <域>（T1 数据库/T2 后端/T3 AI-RAG-MCP/T4 前端/T5 运维；bug 修复按缺陷定位归属对应簇并标注 bugfix）」+ 必用资产清单）
- 契约冻结顺序：—（数据源为既有 CLUSTERS，无新契约）
- 选型依据：F5 唯一数据源=matrix.mjs（PRD §2.2：candidates + preconditions 具名注入）；SuperClaude 反面教训反面印证——清单注入是纯 markdown 增量，无安装链负担（PRD C2）
- GWT 验收（全文）：
  - Given 某 task 路由到 T4_FRONTEND；When 生成开工 prompt；Then 含「本 task 资产清单」：frontend-design/frontend-visual-validation/agent-vision-toolkit/colorize/planning/review/security 具名路径 + preconditions 逐条（契约冻结/Gate A/锚点+内核词），与现 T4 专用段内容一致不缩水
  - Given task 路由到 T1/T2/T3/T5；When 生成开工 prompt；Then 同样注入对应簇 candidates 具名路径 + preconditions（与 matrix.mjs CLUSTERS 逐条一致，不缩水不杜撰）
  - Given 执行 agent 开工；When 输出开工信息；Then 首行为域声明 + 必用资产清单；Given 未声明；When 验收抽查（数据源 `scripts/asset-call-rate.mjs` assetConsumed 字段）；Then 记 warning 并要求补充，不静默放行
  - Given owner 想在 Prompt 里指定资产；When 参照开工清单具名路径；Then 可直接写「本 task 必须消费 <具名资产路径>」类指令并被开工 prompt 承接（清单与 Prompt 用词同源）

#### task09 · 完工报告资产消费按域分组（F5 展示层，PRD M2-4）

- 前置依赖：task08（域标签与开工声明同源——T1-T5 label + bugfix 标注规则）
- 涉及文件：改 `templates/completion-report.md`（「资产消费证据（硬约束，必填）」段之下追加「按域展示」小节：域（前端/后端/设计/修 bug/运维）→ 资产具名路径 → 调用证据；不改动既有硬约束语义）
- 契约冻结顺序：—（展示层）
- 选型依据：completion-report 资产消费证据段为既有硬约束（L5-11）——按 PRD §2.2 只在其上补分组视图；域标签取 matrix label 保证与开工声明一字不差
- GWT 验收（全文）：
  - Given 完工报告含跨域资产消费（如前端 task 亦消费 review 资产）；When 阅读「资产消费证据」段；Then 先按域分组列出再平铺明细，域标签与开工声明一致
  - Given 模板改动；When diff 检查；Then 「资产消费证据（硬约束，必填）」既有行零改动，按域展示为追加小节
  - Given 未调用任何资产的完工报告；When 按模板填写；Then 如实写「本次执行未调用外部资产」，按域展示小节写「无（未调用）」，不伪造

#### task10 · M2 回归 + 验收（验收 task）

- 前置依赖：task06-09 完成；复用 task04 的 validate 扫描扩展（owner-review 子目录已在清单内）
- 涉及文件：无新增/修改
- 契约冻结顺序：—（验收方）
- 选型依据：同 task05 口径（P4）
- GWT 验收（全文）：
  - Given M2 全部实现；When 运行 regression-all；Then 8 PASS / 0 FAIL
  - Given templates/owner-review/ 5 文件 + 3 模板引用行；When validate-structure；Then 0 错误 0 泄露（owner-review/*.md 已入扫描清单）
  - Given FR-3（task06 三条 + task07 两条）/FR-5（task08 四条 + task09 三条）GWT 全集；When 逐条实测；Then 全部 PASS
  - Given 指引中的模板段落引用；When grep 比对对应模板文件；Then 段落名真实存在（无悬空引用）

### M3 多分支编排

#### task11 · dev-planner 拆子会话建议段（F4 建议层，PRD M3-1）

- 前置依赖：无；与 M1/M2 并行
- 涉及文件：改 `vendor/dev-planner/dev-planner.md`（Output Format 规范追加「建议拆子会话」段规范 + 质量纪律追加判据行；不改动既有前提挑战/审批纪律）
- 契约冻结顺序：—（行为层规范，判据写死进提示词）
- 选型依据：spec_driven_develop lane 判据（文件集不相交+可独立验收，PRD §2.1）；判据保守（lane ≥3 起建议）+ 建议不自动执行（PRD C5：lane 判据是「能不能并行」，不是「要不要拆会话」）；approve 门与 checkpoint（open-multi-agent 先例）
- 行为要点：判据=plan 并行 lane ≥3，或估算总量达单会话上下文风险级（S/M/L 分级中多个 L 级并行）；建议段逐 lane 列子会话建议（范围/前置/产物路径/state 位置）+ 每子会话交接 prompt 要素；明示「建议不自动执行，批准权在 owner」
- GWT 验收（全文）：
  - Given 拆解草案含 3 条并行 lane 且含多个 L 级估算 task；When dev-planner 产出拆解报告；Then 报告附「建议拆子会话」段，逐 lane 列出范围/前置/产物路径与交接 prompt 要素
  - Given 分支数 ≤2 或估算总量小；When 产出拆解报告；Then 不出现该建议段（不噪音打扰）
  - Given 建议段存在；When owner 阅读；Then 明示「建议不自动执行、批准权在 owner」，且每子会话附交接 prompt 要素清单（可复制即用）

#### task12 · orchestrator --session 隔离（F4 隔离层，PRD M3-2）

- 前置依赖：task02（orchestrator 收尾挂钩已就位，避免二次改同区域；串行防冲突）
- 涉及文件：改 `scripts/orchestrator.mjs`（parseArgs 新增 `--session <id>` + 路径归一：`.tt-state/<id>/`、`contracts/<id>/`、`artifacts/<id>/` + 收尾断言：session 模式下全部落盘路径含 `<id>`，断言失败 exit 非零（R3 缓解））；改 `scripts/lib/store.mjs`（createStore 增加可选 session 参数，缺省行为不变）
- 契约冻结顺序：先冻结 C4（命名空间规则 + id 字符白名单 `[A-Za-z0-9_-]+`）→ 再实现
- 选型依据：ruflo 命名空间化思想（仅借思想不引 swarm，PRD C4：TT 人守 gate + 零依赖哲学）；`--session` 是目录前缀不是新状态机（PRD §2.3 决策 4）
- GWT 验收（全文）：
  - Given orchestrator 以 `--session branch-a` 执行；When 收尾；Then state/journey/contracts/artifacts 全部落于 `<id>` 命名空间内（`.tt-state/branch-a/state.json`、`.tt-state/branch-a/journey.json`、`contracts/branch-a/<planId>.json`、`artifacts/branch-a/...`）
  - Given 不带 `--session` 重复回归场景；When 运行 regression-all；Then 8/8 PASS，全部路径行为与 2.9.1 完全一致（零回归面）
  - Given session 模式收尾断言；When 任一落盘路径缺 `<id>` 前缀；Then 断言失败 exit 非零
  - Given `--session ../evil` 等含路径穿越/非法字符的值；When parseArgs 校验；Then 拒绝并报错（id 仅允许 `[A-Za-z0-9_-]+`）

#### task13 · 汇总链路（F4 汇总层，PRD M3-3）

- 前置依赖：task12（session 命名空间路径确定后才能定扫描规则）
- 涉及文件：改 `scripts/summary-read.mjs`（collectSummaries 兼容 session 嵌套：扫描 `artifacts/<planId>/state-summary.json` 与 `artifacts/<session>/<planId>/state-summary.json` 两层，向后兼容单层行为不变）；改 `templates/kickoff-prompt.md`（追加「多分支汇总」段：子会话完工 → 汇总会话逐分支 `node scripts/summary-read.mjs --workspace <分支> --all` 拉断点 → 生成集成任务开工 prompt，复用 L0 changed-files 交集扫描，SKILL.md §5.4）；改 `SKILL.md`（附C F4 行状态更新：规划中→M3 落地）
- 契约冻结顺序：—（复用既有 `tt/state-summary@1` 与 summary-read 语义，PRD §2.2：不改语义）
- 选型依据：summary-read `--workspace/--latest/--all` 现成能力直用（PRD §2.2 衔接表）；ruflo 教训=汇总靠轻文件不靠新工具（PRD C4）
- GWT 验收（全文）：
  - Given 两个子会话各自完工且各具 state-summary.json；When 汇总会话逐分支运行 `summary-read --workspace <分支> --all`；Then 输出合并断点清单（各分支 status/assetCallRate/产物路径），编排者据此产出集成任务开工 prompt
  - Given 某子会话中断；When 汇总会话拉断点；Then 断点清单如实含 failed/skipped 项与 recovery 提示（state-summary 现有字段直读，不加工不美化）
  - Given 无 session 命名空间的既有 workspace；When summary-read；Then 行为与 2.9.1 一致（单层扫描向后兼容，0 回归）
  - Given kickoff 模板汇总段；When owner 照做；Then 子会话完工→拉断点→集成开工的链路可执行（文档即操作手册）

#### task14 · M3 回归 + 全量验收（验收 task）

- 前置依赖：task11-13 完成，且 task05/task10 已通过
- 涉及文件：无新增/修改
- 契约冻结顺序：—（验收方）
- 选型依据：PRD §7.3 验收总纲五门（回归/功能/可移植/上下文预算/诚实）
- GWT 验收（全文）：
  - Given M3 全部实现；When 运行 regression-all；Then 8 PASS / 0 FAIL（含无 flag 场景与 2.9.1 逐字节一致）
  - Given PRD §7.3 五门；When 逐门验收；Then 回归门（8/8）✓ 功能门（FR-1~FR-5 GWT 全集逐条，含 task11 建议段正反例）✓ 可移植性门（全部新增/修改文件 0 泄露）✓ 上下文预算门（单阶段注入 ≤500 token；journey 字段数只减不增）✓ 诚实门（INFERRED 不编造、域声明缺失必 warning、拆会话是建议、不夸大自动能力）✓
  - Given M1/M2 已验收项；When M3 后复跑抽测；Then 无回退

## 执行顺序

- **串行主干**：C1 冻结 → task01 → task02 → task04 → task05（M1 出口闸）
- **并行集 A（M1 期间）**：task03（依赖 C1，与 task02 并行）｜task06、task08、task11（无 M1 依赖，文件不相交）
- **M2 收尾**：task07（task06 后）∥ task09（task08 后）→ task10
- **M3 收尾**：task12（task02 后）∥ task11 → task13 → task14
- **里程碑出口顺序**：M1 → M2 → M3（出口验收按序，开发可跨里程碑并行，前提=文件集不相交）
- 里程碑出口条件（PRD §7.1）：M1=进度图+派生挂钩+6 命令文件可注入+防跳警告生效+GWT 过+8/8+validate 0；M2=5 指引+引用行+全簇清单+域声明+按域分组+GWT 过+8/8+validate 0；M3=建议判据生效+--session 隔离且无 flag 不变+汇总链路通+8/8

## 风险清单

| 风险 | 影响 | 回滚/缓解 |
|------|------|----------|
| R1 commands 摘要与 guide 双源漂移 | 注入 Prompt 与文档纪律脱节 | 摘要只压缩不改语义 + validate 漂移门（必含 guide 具名章节指针行，task04 机验）（PRD C1） |
| R2 journey 与 state-summary 口径冲突 | agent 拿到两套矛盾进度 | writeStateSummary 单点派生 + gate 级更新只增不改历史（task02）（PRD R2） |
| R3 --session 命名空间遗漏 | 分支产物互相覆盖 | 收尾断言路径含 `<id>` 前缀，失败 exit 非零（task12）（PRD R3） |
| R4 域声明流于形式 | 透明化退化为口号 | 声明与 assetConsumed 一致性抽查（asset-call-rate.mjs）；缺失→warning+要求补充（task08/task09） |
| R5 多分支合并冲突 | 两子会话同文件双改 | 复用既有 L0 changed-files 交集扫描（SKILL.md §5.4），冲突触发完整 gate（task13 文档化） |
| R6 无斜杠平台命令不可用 | 触发面收窄 | 斜杠仅入口之一，同义触发词等效（task03 GWT 锁定）（PRD R6） |
| R7 validate 可移植性扫描盲区 | 新增 commands/owner-review 泄露漏检 | task04 扩展扫描清单（含子目录），task05/task10 验收断言覆盖 |
| R8 dev-planner 行为层改动不可纯机验 | 建议段不生效或噪音 | 判据写死进提示词 + task14 用 3-lane/2-lane 正反样例草案实测；改动只追加不改既有纪律段 |

## 验收总纲（对齐 PRD §7.3）

1. 回归门：M1/M2/M3 出口各跑 `node scripts/regression-all.mjs`（yy/ 内）8/8 PASS；`--session` 无 flag 行为与 2.9.1 一致
2. 功能门：FR-1~FR-5 GWT 逐条实测（证据=命令输出/文件路径，不采信口头报告）
3. 可移植性门：全部新增/修改文件不含本机绝对路径（validate 0 泄露，扫描面含 commands/ 与 owner-review/）
4. 上下文预算门：单阶段注入 ≤500 token 当量；journey 字段数只减不增（BMAD smaller-or-equal audit）
5. 诚实门：INFERRED 不编造；域声明缺失必 warning；拆会话是建议、批准权在 owner；不夸大任何「自动」能力

## 规划自审（FR-201，CEO→Eng→Design 串行）

### CEO 范围自审

- Scope Mode 判定：SELECTIVE EXPANSION（5 FR 全部在 PRD 范围内，未新增功能面）
- 不做清单复核：无遗漏——swarm/向量记忆/pipx/Python 依赖链/自动派发子会话/drift 自动重拆均已在 PRD §范围外与 C4/C5 锁定，本计划未偷偷扩入
- 每项 deferred 写了理由：是——M2/M3 的验收 task（task10/task14）独立成行，防止验收被开发 agent 自采信；F4 只做三件套（建议/隔离/汇总）与 PRD C4 结论一致
- Finding（P2）：task03 与 task04 职责有重叠面——「防跳阶段」既出现在命令文件指令层（task03 首行指令）又有机验层（task04），若拆解边界不清会导致同一文件被两个 task 改、双源修改冲突
- 处置：采纳并冻结边界——task03 只写「先读 journey」指令文本与 frontmatter 声明（不写判定逻辑），task04 只做机验工具（tt-journey --prereq-check + validate 扩展）与回归断言，不改命令文件正文；两 task 文件集不相交，可在任务单中显式写明

### Eng 架构自审

- 架构边界 / 数据流 shadow path 已检查：是——journey 派生点覆盖成功/失败/resume/dry-run 四条路径（task02 GWT 逐条）；INFERRED 空态覆盖「无 journey/有 state-summary/全无」三态（task01 GWT）
- 测试覆盖缺口：task11（dev-planner 行为层）无纯机验手段，靠 task14 正反样例草案实测兜底（风险 R8）；其余 task 均有机验断言
- 性能与 N+1：journey.json 单文件 ≤9 节点+plans 只增数组，读写 O(1) 量级；summary-read 两层扫描不增加网络/依赖
- Finding 1（confidence: 8/10）scripts/orchestrator.mjs:282-287 —— resume「全部子任务 done」短路分支直接出报告退出，不经过 writeStateSummary（L434）也不走失败路径（L392）；task02 若只挂 writeStateSummary 内部，该分支 journey 会滞留旧位置（shadow path 漏更新）
- 处置：task02 行为要点已显式覆盖——resume 短路分支补一次 journey 同步调用；dry-run 维持不写盘；task02 GWT 第 3 条将该分支锁进验收
- Finding 2（confidence: 7/10）scripts/tt-journey.mjs:（新增，落点预测）——若 task01 把 journey 路径写死为 `.tt-state/journey.json`，task12 的 `--session` 要求 `.tt-state/<id>/journey.json` 时需二次改 tt-journey.mjs 与 orchestrator 两处，违反单点路径归一
- 处置：C1 契约即冻结「路径归一函数随 task01 导出（`journeyPath(workspace, sessionId?)`，session 缺省行为不变）」，task12 只复用不重写；task02 挂钩直接调用该函数
- Finding 3（confidence: 8/10）scripts/validate-structure.mjs:78-83 —— 可移植性扫描清单仅覆盖 SKILL/README/ONBOARDING/scripts/*.mjs/templates 顶层 .md（L82 为非递归 readdir），新增 `commands/*.md` 与 `templates/owner-review/*.md` 均不在扫描面，泄露检查会漏（正是本迭代新增文件的主落点）
- 处置：采纳——task04 扩展 validate 扫描清单（commands/ 全量 + templates 子目录递归），task05/task10 把「0 泄露含新扫描面」写进 GWT 断言
- 命名决策登记：PRD §3.2 M1-3/FR-2 用 `commands/tt-*.md`，`SKILL.md` 附C L315 登记 `commands/yy-*.md`——取 `yy-*`（fork 独立身份，与上游 TT 同装时命令面不冲突），task03 内同步修订 PRD 命名行并登记修订记录，防两文档漂移

### Design 体验自审

- 交互状态表：LOADING（不适用，纯本地文件）/ EMPTY=INFERRED 空态+初始化指引（task01 GWT）/ ERROR=前置未过警告+阻断（task04）/ SUCCESS=进度图+注入摘要 / PARTIAL=failed/skipped 如实直读不美化（task13）
- AI slop 检查：owner-review 四段结构写死（C3），禁空洞形容词；命令摘要只压缩母本不新写营销句（PRD C1）；按域展示用既有字段重组不造新概念
- 无障碍（对比度 4.5:1 / 命中区 44px）：不适用（本迭代无 UI 渲染面，ASCII 进度图用 ✓/●/○ 三态符号+文字冗余标注当前位置，色弱可辨）
- Finding（P2）：300-500 token 压缩若过度，可能把 guide「人工 gate 决策表」的关键判据压丢——owner 拿到精简 Prompt 却不知道自己在 gate 前该拍什么板，体验目标（决策权留人）被 token 预算反噬
- 处置：采纳——task03 摘要固定三要素（该阶段人工 gate 清单+纪律钥匙词+产物路径）缺一不可，task05 抽查 6 文件逐份核对 gate 清单在场；owner-review 指引「≤1 屏四段结构」写进 GWT 而非「越短越好」
- Finding（P3）：INFERRED 空态若只输出空图，owner 首次接触会误读为「坏了」
- 处置：task01 GWT 锁定空态必须附初始化指引文案且 exit 0（引导而非报错），诚实门同步覆盖「不编造进度」

## 修订记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v1.0 | 2026-09-07 | 初版：6 前提+4 问结论（已确认）、task01-14（M1 窄楔子 5 / M2 5 / M3 4，各含 GWT 全文+前后置+文件+选型依据）、内部契约 C1-C4 先冻结后实现、执行顺序与并行集、风险 8 条、验收总纲五门、规划自审三视角（CEO/Eng/Design 各 ≥1 finding+处置） |