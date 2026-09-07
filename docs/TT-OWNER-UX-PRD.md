# TT-OWNER-UX-PRD — 版本迭代「owner 可驾驶」（阶段导航 / Prompt 注入 / 报告白话化 / 多分支编排 / 资产透明化）

- 版本：v1.0（2026-09-07 初版）
- 状态：概念版已用户确认，进入正式 PRD（TT §2.1 需求挖掘 gate 已完成，5 痛点全部流程体验类，已确认）
- 基线：TT 2.9.1（`SKILL.md` L7；Node 零依赖；`regression-all` 8/8 PASS、validate 0）
- 本阶段范围：**F1 阶段导航/进度图 + F2 阶段化 Prompt 注入 + F3 报告白话化 + F4 多分支自动编排 + F5 资产指定透明化**
- 附加约束（用户确认）：**上下文输入量优化 = 结合方案**——阶段命令注入摘要 + 进度状态外置按需读（渐进披露三级模型，见 T17 调研）
- 范围外（明确不做）：向量记忆/swarm、pipx 类安装器、Python 依赖链（T17 结论：TT 零依赖是优势，勿丢）；自动派发子会话（F4 只做建议+隔离+汇总，不做全自动）

---

## 1. 需求来源

### 1.1 用户痛点（§2.1 需求挖掘 gate 已确认，勿重测）

| # | 痛点 | 用户原话要点 | 对应 FR |
|---|---|---|---|
| P1 | 阶段导航缺失 | 会话长了不知 agent 到哪个阶段、会跳阶段（需求挖掘→直接执行 task） | F1 |
| P2 | Prompt 重复粘贴 | 各阶段固定 Prompt 散在指南文档里，需手动复制，有时要粘多个阶段 | F2 |
| P3 | 报告看不懂 | 术语多、不知从何审起（对术语不了解、对进度不清晰） | F3 |
| P4 | 多分支不会编排 | task 多线时希望自动升级为编排者+子会话交接，而非单会话跑爆上下文 | F4 |
| P5 | 资产指定不可见 | agent 不说调了哪些资产；想知道 task 在哪个域（前端/后端/设计/修 bug）以便在 Prompt 里指定资产 | F5 |

### 1.2 需求挖掘 gate 结论（前置已完成）

- TT 2.9.1 基线、回归 8/8、validate 0 已核实（本轮实测 `regression-all.mjs` 输出 `结果: 8 PASS / 0 FAIL`，与既有记录一致）。
- 竞品调研已交付且真实核验：`docs/history/specs/T17-RESEARCH-context-injection.md`（GitHub API 2026-09-07 实时数据），本 PRD 直接引用其结论，不重复调研。
- 用户已确认「5 痛点全做 + 上下文优化取结合方案」的边界，本 PRD 不再扩大范围。

---

## 2. 设计对齐

### 2.1 参考项目借鉴点（只借设计，不引依赖；数据均出自 T17 实时核验）

| 参考项目 | URL | 借鉴点（如何落到 TT） |
|---|---|---|
| `anthropics/skills`（Agent Skills 标准，174.9k★） | https://github.com/anthropics/skills | **渐进披露三级模型**（agentskills.io 规范原文）：① 元数据 ~100 token 常驻（命令文件 frontmatter 的 name/description）；② 正文激活加载，建议 <5k token——TT 收紧为 **300-500 token 阶段摘要**；③ references/ 按需读——TT 只给路径指针（guide 对应章节 + SKILL.md 相关节），不整篇复制 |
| `SuperClaude-Org/SuperClaude_Framework`（23.9k★ MIT） | https://github.com/SuperClaude-Org/SuperClaude_Framework | **斜杠命令 = 阶段注入单元**：6 个 `commands/yy-*.md` 对齐其 `/sc:*` 形态（它用 30 个命令验证了可行性，TT 只需 6 个）。**反面教训同样采纳**：其 pipx 安装器 + TS 插件跳票（README 明示 no ETA）→ TT 保持纯 markdown 零安装 |
| `bmad-code-org/BMAD-METHOD`（52.7k★ MIT） | https://github.com/bmad-code-org/BMAD-METHOD | **状态外置 + 最小化纪律**：state 文件只记 phase/gates_passed/artifacts 路径（"agents read code better than prose about code"）；**人工 gate 显式化**（先 approve 再执行）→ TT 的跳阶段防线：注入前先读 state，前置阶段未 done 即警告（机器可校验，比 prompt 叮嘱可靠） |
| `ruvnet/claude-flow`（现 ruflo，71.0k★ MIT） | https://github.com/ruvnet/claude-flow | **明确不借**：向量记忆/AgentDB/HNSW/swarm/314 个 MCP 工具——TT 零依赖 Node，JSON/MD 文件态足够（ruflo 自己 README 都承认工具数是负担）。仅借"命名空间化"思想给 F4 的 `--session <id>` 隔离 |
| `zhu1090093659/spec_driven_develop` | https://github.com/zhu1090093659/spec_driven_develop | F4 参考：并行 lane 判据（文件集不相交 + 可独立验收）已在 TT plan 的 phase/dependsOn 中体现；子会话拆分建议复用该判据，本阶段不做 drift 自动重拆 |

### 2.2 与现有 TT 架构的衔接（已有基础，勿重复造）

| 现有组件 | 本阶段如何衔接 |
|---|---|
| `scripts/orchestrator.mjs` 收尾已写 `state-summary.json`（L165-229） | F1 的 journey.json 与其**同源派生**（收尾同步更新），不做第二套独立事实源 |
| `scripts/summary-read.mjs`（`--workspace`/`--latest`/`--all`，L8-10） | F4 汇总会话直接复用：逐分支 `--workspace` + `--all` 合并断点，不改语义 |
| `docs/TT-USER-PROMPT-GUIDE.md`（阶段 0-7 Prompt 模板，L29/48/63/77/96/109/127/139） | F2 命令文件的**内容母本**：只做压缩改写 + 路径指针，无新写作量 |
| `scripts/lib/matrix.mjs` CLUSTERS（T1-T5，candidates/phases/contract/preconditions，L1-6） | F5 资产清单的唯一数据源：candidates + preconditions 具名注入开工 prompt |
| `templates/kickoff-prompt.md` T4 专用段（L31-41，具名资产清单） | F5 的现有先例：把 T4 模式**泛化到 T1-T5 全簇** |
| `templates/completion-report.md` 资产消费证据段（L5-11，硬约束必填） | F5 在其上补「按域展示」分组视图，不改动既有硬约束语义 |
| `scripts/asset-call-rate.mjs`（assetConsumed 统计，L136-137） | F5 验收抽查声明与 assetConsumed 一致性的机验数据源 |
| `scripts/lib/store.mjs`（`.tt-state/` 目录，L4） | F1 journey.json 落点：`.tt-state/journey.json`，与 state.json 同域 |
| `scripts/critique-backlog-next.mjs`、memory-snapshot/execution-feedback | 不改动；journey 只引用其产物路径，不复述内容 |

### 2.3 关键设计决策

1. **结合方案锁定**：`/tt <阶段>` 注入的是 300-500 token 摘要（第②级），详细规则留在第③级文件给路径指针——不整篇复制 guide，上下文预算对齐 anthropics/skills 规范的收紧版。
2. **状态外置最小化**：journey.json 只记 step/gates_passed/artifacts 路径，禁止复述文档内容（BMAD 纪律："smaller or equal, never larger"）。
3. **机器防跳阶段**：命令文件内含「先读 journey 再注入」指令；前置阶段 `status != done` 时输出警告并阻断执行类注入——这是 BMAD"先 approve 再执行"的 TT 代码级等价物。
4. **零依赖不动摇**：全部新增为纯 markdown + 原生 Node（fs/path），不引任何 npm 依赖；F4 的 `--session` 是目录命名空间前缀，不是新状态机。
5. **诚实红线**：journey 无历史时标 INFERRED 不编造；域声明缺失标 warning 不静默；F4 建议是建议、批准权在 owner。

---

## 3. 源码实况核对（改造点）

> 全部相对路径引用；行号为 2.9.1 基线实测值。

### 3.1 现有事实（已核实）

| 位置 | 实况 | 对本阶段的意义 |
|---|---|---|
| `scripts/orchestrator.mjs` L165 `writeStateSummary` | 收尾生成 `schema: 'tt/state-summary@1'`（L194），含 planId/task/cluster/status/modes/summary（done/failed/skipped/assetCallRate/contractFrozen）/critiqueBacklog/files；写 `artifacts/<planId>/state-summary.json`（L226-228）；失败路径也写（L392），成功路径随 memory-snapshot/execution-feedback 一并落盘（L435） | **F1 数据源之一**：journey.json 在同一收尾点同步派生，保证单轮口径一致 |
| `scripts/summary-read.mjs` L8-10 | 用法：`--workspace <dir>` 列全部摘要（mtime 倒序）/ `--latest` 打印最近一份完整 JSON / `--all` 合并全部摘要为汇总清单；L98-111 `collectSummaries` 扫 `<workspace>/artifacts/<planId>/state-summary.json` | **F4 汇总通道现成**：子会话各自 workspace/命名空间完工后，汇总侧逐分支拉断点，无需新写扫描器 |
| `docs/TT-USER-PROMPT-GUIDE.md` L29/48/63/77/96/109/127/139 | 阶段 0-7 共 8 段 Prompt 模板（立项/挖掘/拆任务/契约/派单/验收/改需求/打假）+ L150 一张表总结 + L165 贯穿技巧 | **F2 内容母本**：6 个命令文件覆盖线性主干（阶段 0-5），改需求（阶段 6）/打假（阶段 7）为回跳层与贯穿技巧，并入 tt-3/tt-5 的指针段 |
| `scripts/lib/matrix.mjs` L1-6 | `CLUSTERS` 五簇：T1_DATABASE/T2_BACKEND/T3_AI_RAG_MCP/T4_FRONTEND/T5_OPS，各含 `keywords/candidates/phases/contract/preconditions`（如 T4 preconditions：前端契约冻结、Gate A 用户 APPROVED + PARITY_CHECK、锚点+内核词） | **F5 唯一数据源**：开工 prompt 资产清单 = candidates 具名路径 + preconditions 逐条 |
| `templates/kickoff-prompt.md` L31-41 | T4_FRONTEND 专用开工 prompt 已有具名必读资产清单（frontend-design/taste-skill/search.py/taste-blocks/设计规范） | F5 泛化先例：T4 模式推广至 T1/T2/T3/T5 |
| `templates/completion-report.md` L5-11 | 「资产消费证据（硬约束，必填）」段：资产具名路径 + 实际调用证据 + 锚点+内核词；未调用须如实写、禁止伪造 | F5 按域分组在此段之上扩展，不改硬约束 |
| `scripts/asset-call-rate.mjs` L136-137 | 逐 subtask 统计 `assetConsumed === true` 计数 | F5 机验：域声明与实际消费的一致性抽查数据源 |
| `scripts/lib/store.mjs` L4 | state 落 `<workspace>/.tt-state/` | F1 journey.json 同目录落 `.tt-state/journey.json` |
| `scripts/lib/state.mjs` L2-3 | `STATE`（idle/planning/executing/frozen/reviewing/done/failed）与 `TRANSITIONS` | F1/F4 **不动状态机**：journey 记录的是 8 步闭环视角（SKILL.md §0b），与执行态 state.json 互补不冲突 |
| `SKILL.md` L30-42 | §0b 闭环全景：8 步可回跳（0 资产整合/1 文档化/2 重执行/3 拆任务/4 重执行/5 规划/6 重执行/7 并行派单/8 批判反哺） | F1 进度图的节点事实源：按 §0b 渲染，不自造步骤表 |
| `SKILL.md` L83/L136-143 | §2.1 需求挖掘 gate（三视角诊断 + 概念版明确认可）；§5.2 资产调用硬约束（具名路径 + 完工报告消费证据 + assetConsumed 机验） | F2 阶段摘要中 gate 清单的原文依据；F5 域声明的纪律依据 |

### 3.2 改造点清单

| # | 改造点 | 影响面 | 类型 |
|---|---|---|---|
| M1-1 | 新增 `scripts/tt-journey.mjs`（读 journey.json 渲染 ASCII 进度图；`--update` 供逐 gate 更新；无历史时按 state-summary/state.json 推断并标 INFERRED） | 新增 | 新增 |
| M1-2 | journey 写入挂钩：orchestrator 收尾（`writeStateSummary` 处）同步派生 `.tt-state/journey.json`；编排者 agent 每 gate 通过后跑 `--update` | `scripts/orchestrator.mjs`（一处挂钩） | 改 |
| M1-3 | 新增 `commands/` 目录 6 个阶段命令文件（frontmatter + 300-500 token 摘要 + 第③级路径指针 + 「先读 journey」指令） | 新增 `commands/yy-0-init.md` … `yy-5-critique.md` | 新增 |
| M2-1 | 新增 `templates/owner-review/` 5 份 owner 审核指引（概念版/前提/契约/HTML-APPROVED/验收报告） | 新增 | 新增 |
| M2-2 | 完工报告与 gate 产物模板头部加指引引用行 | `templates/completion-report.md`、`templates/contract.md`、`templates/dev-plan.md`（各 1 行） | 改 |
| M2-3 | 开工 prompt 泛化：全簇（T1-T5）注入「本 task 资产清单」+ 域声明要求 | `templates/kickoff-prompt.md`（T4 专用段改通用段 + 全簇清单表） | 改 |
| M2-4 | 完工报告补「资产消费证据·按域展示」分组视图 | `templates/completion-report.md`（追加小节） | 改 |
| M3-1 | dev-planner 拆解报告附「建议拆子会话」段（判据：并行 lane >2 且估算总量大）+ 每子会话交接 prompt 要素 | `vendor/dev-planner/dev-planner.md`（拆解输出规范追加） | 改 |
| M3-2 | orchestrator `--session <id>`：`.tt-state/<id>/`、`contracts/<id>/`、`artifacts/<id>/` 命名空间隔离；无该 flag 行为不变 | `scripts/orchestrator.mjs`（parseArgs + 路径归一） | 改（向后兼容） |
| M3-3 | 汇总链路文档化：子会话完工 → 汇总会话 `summary-read --workspace <分支> --all` 拉断点（复用现成能力，写进 F4 指引与 kickoff 模板） | 文档 + 模板 | 改 |

---

## 4. 功能条目化

> 优先级：🔴 本阶段必修 ｜ 🟡 本阶段应做 ｜ ⚪ 增强项
> 验收一律 GWT（Given/When/Then）。

### FR-1 阶段导航/进度图（tt-journey + journey.json）🔴

以状态外置文件记录 8 步闭环进度，输出 ASCII 进度图，注入前先读以机器防跳阶段。

- **行为**：
  - state 文件 `<workspace>/.tt-state/journey.json`：记 8 步闭环（节点与 SKILL.md §0b 一致：0 资产整合/1 文档化/2 重执行文档层/3 拆任务/4 重执行+重拆/5 规划+契约/6 重执行三层/7 并行派单/8 批判反哺）各步 `status`（pending/in_progress/done）+ `gates_passed`（如 concept-signed/contract-frozen/gate-a-approved）+ `artifacts`（相对路径）+ `updated_at`。
  - `node scripts/tt-journey.mjs [--workspace <dir>]`：输出 ASCII 进度图（done=✓、当前=●、pending=○）+ 当前位置 + 下一阶段 + 待办 gate 清单。
  - 更新时机：orchestrator 收尾（与 state-summary 同点派生）；每阶段 gate 通过后由编排者跑 `tt-journey.mjs --update --step <n> --gate <g>`。
  - 防跳阶段：F2 命令文件内含「先读 journey」指令；前置步骤未 done → 输出「阶段 N 未完成，阶段 M 不得开工」警告（机器可校验防线，借鉴 BMAD 先 approve 再执行）。
- **GWT**：
  - Given journey.json 记步骤 0-3 done、步骤 5 in_progress；When 运行 `tt-journey.mjs`；Then 输出 8 步进度图（含 ✓/●/○ 标记）+「当前位置：规划+契约」「下一阶段：并行派单」「待办 gate：contract-frozen」。
  - Given orchestrator 一轮执行收尾；When `writeStateSummary` 写 state-summary.json；Then journey.json 同步更新（同 planId/cluster/产物路径），两文件字段可交叉核对且无矛盾。
  - Given journey 中「5 规划+契约」未 done（gates_passed 无 contract-frozen）；When 用户请求注入阶段 4（派单执行）Prompt；Then agent 先读 journey，输出跳阶段警告并阻断执行类 Prompt 注入，提示先回阶段 3/5。
  - Given 棕地首跑无 journey.json 且无 state-summary；When 运行 tt-journey；Then 输出「INFERRED（journey 未初始化）」的空进度图并给初始化指引，不编造进度。
- **状态标注**：⬜ 待实现（state-summary/summary-read 既有能力 ✅，journey 层 ⬜）。

### FR-2 阶段化 Prompt 快捷注入（commands/ 6 文件）🔴

新增 6 个阶段命令文件，用户一句话即可注入对应阶段摘要 Prompt，消除手动复制粘贴。

- **行为**：
  - 新增 `commands/` 目录：`yy-0-init.md`（立项/资产整合）、`yy-1-requirement.md`（需求挖掘）、`yy-2-planning.md`（拆任务+前提挑战）、`yy-3-contract.md`（契约冻结）、`yy-4-execute.md`（派单执行）、`yy-5-critique.md`（验收批判）。
  - 每文件三级结构（对齐 anthropics/skills 渐进披露）：① frontmatter（name/description 各一行，~100 token）；② 300-500 token 阶段摘要（该阶段目标 + 人工 gate 清单 + 纪律钥匙词 + 产物路径），改写自 guide 对应阶段（无新写作量）；③ 第③级指针：`docs/TT-USER-PROMPT-GUIDE.md` 对应章节 + `SKILL.md` 相关节的相对路径，按需 Read。
  - 触发：用户说 `/tt 3` 或「注入阶段 3 prompt」→ agent 读 `commands/tt-3-contract.md` 注入摘要。斜杠仅为入口之一，无斜杠机制的平台用同义触发词同样生效。
  - 结合方案：命令文件首行指令 = 「先读 `.tt-state/journey.json`，前置未 done 输出警告」（与 F1 联动）；回跳层（guide 阶段 6 改需求/阶段 7 打假）作为贯穿技巧并入 tt-3/tt-5 的指针段。
- **GWT**：
  - Given 用户说「/tt 3」；When agent 读 `commands/tt-3-contract.md`；Then 注入 ≤500 token 阶段摘要（含契约审阅 gate 清单与钥匙词「契约先冻结」）+ 第③级详情路径，不整篇复制 guide 正文。
  - Given 6 个命令文件全部存在；When validate-structure 扫描；Then 0 警告 0 泄露（不含本机绝对路径），且每文件含指向 guide 具名章节的指针行（防双源漂移，见 §5 C1）。
  - Given 用户说「注入阶段 3 prompt」（非斜杠形式）；When agent 匹配同义触发词；Then 注入行为与「/tt 3」完全一致。
  - Given 同一会话需连续推进阶段 1→2→3；When 用户逐个说 /tt 1、/tt 2、/tt 3；Then 每次仅注入当前阶段摘要（~500 token），累计上下文增量 ≤1.5k token（对比整篇 guide 注入显著降低）。
- **状态标注**：⬜ 待实现（guide 母本 ✅）。

### FR-3 报告白话化（owner 审核指引）🟡

每个人工 gate 产出一份「owner 审核指引」，让不了解术语的负责人知道审什么、看哪几行、怎么判 PASS/FAIL。

- **行为**：
  - 新增 `templates/owner-review/` 5 份指引：`concept-signoff.md`（概念版签收）、`premise-challenge.md`（前提挑战 Step0）、`contract-review.md`（契约审阅）、`html-approved.md`（HTML APPROVED / Gate A）、`acceptance-report.md`（验收报告）。
  - 每份固定四段结构：**这个 gate 在审什么**（一句白话）/ **看哪几个字段**（指向对应产物模板的具名段落，如 completion-report 的「资产消费证据」段、契约文件的接口/错误码）/ **PASS-FAIL 判断口径**（可操作的判据）/ **常见坑**（敷衍签收的后果，对齐 guide「人工 gate 决策表」）。
  - 术语首次出现给一句白话解释（如 contractMode:'frozen' = "接口清单已锁定，改动须走变更单"）。
  - 引用接线：`templates/completion-report.md`、`templates/contract.md`、`templates/dev-plan.md` 头部各加一行「owner 审核指引：templates/owner-review/<对应指引>.md」；gate 产物（契约冻结单/HTML 原型说明/验收报告）落盘时由模板自带该引用。
- **GWT**：
  - Given owner 打开任一份指引；When 阅读；Then ≤1 屏内获得四段结构（审什么/看哪几个字段/PASS-FAIL/常见坑），每个术语首次出现有白话解释，无裸术语堆砌。
  - Given owner 拿到一份契约冻结产物；When 查看产物头部或完成报告头部；Then 能看到 `templates/owner-review/contract-review.md` 的相对路径引用并按指引审查。
  - Given 5 份指引全部存在；When validate-structure；Then 0 泄露（不含本机绝对路径）；Given 指引中所有产物字段引用；Then 均指向真实存在的模板段落名（无悬空引用）。
- **状态标注**：⬜ 待实现（guide 人工 gate 决策表为母本 ✅）。

### FR-4 多分支自动编排（拆子会话建议 + 会话隔离 + 汇总拉断点）🟡

task 多线时自动升级为编排者+子会话交接模式，防单会话跑爆上下文。

- **行为**：
  - **拆分建议**：dev-planner 拆解产出后，若并行分支数 >2 条并行线且估算总量大（判据：plan 并行 lane ≥3，或估算总量达"单会话上下文风险"级——S/M/L 分级中多个 L 级并行），拆解报告附「建议拆子会话」段：逐 lane 列子会话建议（范围/前置/产物路径/state 位置），并附每子会话的交接 prompt 要素。建议不自动执行，owner 批准后才拆。
  - **会话隔离**：orchestrator 新增 `--session <id>`：state 落 `.tt-state/<id>/state.json`、journey 落 `.tt-state/<id>/journey.json`、契约落 `contracts/<id>/`、产物落 `artifacts/<id>/`；不传该 flag 时全部路径行为与 2.9.1 完全一致（零回归面）。子会话各持有独立 state/journey，互不污染。
  - **汇总拉断点**：子会话完工后，汇总会话对每个分支 workspace/命名空间运行 `node scripts/summary-read.mjs --workspace <分支> --all`（复用既有 `--all` 合并能力），得到各分支 done/failed/skipped + 产物路径的合并断点清单；编排者据此生成集成任务与合并检查点计划（复用既有 L0 changed-files 交集扫描，SKILL.md §5.4）。
- **GWT**：
  - Given 拆解草案含 3 条并行 lane 且含多个 L 级估算 task；When dev-planner 产出拆解报告；Then 报告附「建议拆子会话」段，逐 lane 列出范围/前置/产物路径与交接 prompt 要素；Given 分支数 ≤2 或估算总量小；Then 不出现该建议段（不噪音打扰）。
  - Given orchestrator 以 `--session branch-a` 执行；When 收尾；Then state/journey/contracts/artifacts 全部落于 `<id>` 命名空间内；Given 不带 `--session` 重复回归场景；Then 路径行为与 2.9.1 完全一致，`regression-all` 8/8 PASS。
  - Given 两个子会话各自完工且各具 state-summary.json；When 汇总会话逐分支运行 `summary-read --workspace <分支> --all`；Then 输出合并断点清单（各分支 status/assetCallRate/产物路径），编排者据此产出集成任务开工 prompt。
  - Given 某子会话中断；When 汇总会话拉断点；Then 断点清单如实含 failed/skipped 项与 recovery 提示（state-summary 现有字段直读，不加工不美化）。
- **状态标注**：⬜ 待实现（`--session` 现不存在——parseArgs L24 无此字段；summary-read 单分支能力 ✅）。

### FR-5 资产指定透明化（域声明 + 全簇资产清单 + 按域展示）🟡

让 owner 看得见 task 属哪个域、必用哪些资产，从而能在 Prompt 里主动指定。

- **行为**：
  - **开工清单注入**：开工 prompt 按 matrix cluster（T1-T5）自动注入「本 task 资产清单」段——`candidates` 具名路径 + `preconditions` 逐条（数据源 `scripts/lib/matrix.mjs` L1-6）；把 kickoff-prompt.md 已有的 T4 专用段泛化为全簇通用段。
  - **域声明**：agent 开工时首行输出声明：「本 task 属 <域>（T1 数据库/T2 后端/T3 AI-RAG-MCP/T4 前端/T5 运维；bug 修复按缺陷定位归属对应簇并标注 bugfix）」+ 必用资产清单；声明缺失由验收抽查记 warning（数据源 `asset-call-rate.mjs` 的 assetConsumed 字段）。
  - **按域展示**：完工报告「资产消费证据」段（已有，硬约束不变）追加按域分组视图：域（前端/后端/设计/修 bug/运维）→ 资产具名路径 → 调用证据，owner 一眼可见"这个 task 消费了哪个域的哪些资产"。
- **GWT**：
  - Given 某 task 路由到 T4_FRONTEND；When 生成开工 prompt；Then 含「本 task 资产清单」：frontend-design/frontend-visual-validation/agent-vision-toolkit/colorize/planning/review/security 具名路径 + preconditions 逐条（契约冻结/Gate A/锚点+内核词），与现 T4 专用段内容一致不缩水。
  - Given 执行 agent 开工；When 输出开工信息；Then 首行为域声明 + 必用资产清单；Given 未声明；When 验收抽查；Then 记 warning 并要求补充（不静默放行）。
  - Given 完工报告含跨域资产消费（如前端 task 亦消费了 review 资产）；When 阅读「资产消费证据」段；Then 先按域分组列出再平铺明细，域标签与开工声明一致。
  - Given 用户想在 Prompt 里指定资产；When 参照开工清单里的具名路径；Then 可直接写出「本 task 必须消费 <具名资产路径>」类指令并被开工 prompt 承接（清单与 Prompt 用词同源）。
- **状态标注**：◐ 部分——T4 具名清单 ✅（kickoff-prompt.md L31-41）、消费证据段 ✅（completion-report.md L5-11）；全簇泛化/域声明/按域分组 ⬜。

---

## 5. 批判审查（默认假设非最优）

> ≥3 条，含竞品对标与真实 URL（全部取自 T17 调研的 2026-09-07 实时核验数据）。结论已回灌 §2 设计决策。

### C1 渐进披露摘要的"双源漂移"风险：commands 摘要会和 guide/SKILL.md 长歪吗？

**假设**：把 guide 各阶段 Prompt 压缩进 commands 文件，一劳永逸。
**批判**：摘要一旦脱离母本就是第二事实源，阶段纪律更新时极易只改一处（anthropics/skills 用 references/ 单向引用规避此问题；规范原文"smaller files mean less use of context"的前提是引用不复制）。TT 若 commands 与 guide 并行维护，半年后必漂移。
**证据**：https://github.com/anthropics/skills （agentskills.io 渐进披露规范：③级按需读、reference 单一来源）
**结论**：commands 文件内容定位为"压缩改写 + 指针"，validate 增加漂移门——每个命令文件必须含指向 guide 具名章节的指针行，缺指针行 = 警告（已落入 FR-2 GWT 与 M1-3）。

### C2 命令形态会不会重蹈 SuperClaude 的安装器覆辙？30 个命令的爆炸教训

**假设**：命令文件越多越细，覆盖越全越好。
**批判**：SuperClaude 30 个 `/sc:*` 命令 + pipx 安装器 + TS 插件系统跳票（README 明示 "not yet available, no ETA"）——命令面扩大必然拖出安装链、版本管理、跨平台分发三类工程负担；TT 的用户是单编排者 + 子会话，6 个线性主干命令已覆盖全部必经 gate，改需求/打假是回跳层不该独立成命令。
**证据**：https://github.com/SuperClaude-Org/SuperClaude_Framework （30 命令形态验证可行；安装器跳票即反面教训）
**结论**：只做 6 个命令文件、纯 markdown 零安装（已在 §2.3 决策锁定）；命令数上限写死，后续加命令须先过 PRD。

### C3 状态外置会不会反而变成新的上下文负担？BMAD 最小化纪律能否守住

**假设**：journey.json 记得越详细，agent 越不容易迷路。
**批判**：BMAD 原文："Repo overviews, directory trees, and tech-stack lists never enter: agents read code better than prose about code"，且块纪律是 "smaller or equal, never larger"。若 journey 复述文档内容或记录每个 task 明细，它会自己变成需要"摘要的摘要"，重演 P2 的注入膨胀。
**证据**：https://github.com/bmad-code-org/BMAD-METHOD （durable context 哲学：只存重新发现代价高的事）
**结论**：journey 只记 step/gates_passed/artifacts 路径三字段，禁止复述（已在 §2.3 决策 2 锁定）；进度展示职责归 tt-journey 渲染层，不落盘。

### C4 F4 的"多分支编排"是不是在重造 ruflo 的 swarm？

**假设**：多分支就该上多 agent 拓扑自动调度。
**批判**：ruflo 的 swarm/GOAP 依赖向量记忆与 314 个 MCP 工具，与 TT"人守 gate + 零依赖"哲学相反；TT 5.0 节的并行度分级（简单单线/中等 2 线/复杂 N 线）已经给出分支上限的判断框架，缺的只是"何时建议拆"的判据与隔离机制。且自动派发子会话会绕过 owner 的审批权。
**证据**：https://github.com/ruvnet/claude-flow （swarm 拓扑 + 向量记忆；其 README 自认 314 工具是负担）
**结论**：F4 只做「建议 + `--session` 隔离 + summary-read 汇总」三件套，不自动派发、不引 swarm（已在 §2.3 与范围外锁定）。

### C5 F4 的拆分判据（lane >2 且估算大）会不会误报或漏报？

**假设**：机器判据可以直接决定是否拆会话。
**批判**：spec_driven_develop 的 lane 判据（文件集不相交 + ≤L 工作量 + 可独立验收 + ≤4 lanes）是"能不能并行"的判据，不是"要不要拆会话"的判据——后者还取决于平台可用会话数与 owner 精力。判据过松会产生噪音建议（每 plan 都建议拆），过紧则漏掉真跑爆的会话。且拆分后合并冲突风险真实存在（两分支同文件双改）。
**证据**：https://github.com/zhu1090093659/spec_driven_develop （lane 判据原文）；https://github.com/open-multi-agent/open-multi-agent （approve 门与 checkpoint）
**结论**：判据保守（lane ≥3 起建议）、建议不自动执行、合并走既有 L0 changed-files 交集检查（SKILL.md §5.4）；drift 自动重拆仍归下期（已在范围外标注）。

---

## 6. 状态标注

| 能力 | 状态 | 说明 |
|---|---|---|
| 8 步闭环编排内核（收尾 state-summary/memory-snapshot/execution-feedback） | ✅ 已具备 | `scripts/orchestrator.mjs` L165-229/L392/L435，2.9.1，回归 8/8 |
| 摘要读取工具（--workspace/--latest/--all） | ✅ 已具备 | `scripts/summary-read.mjs` L8-10 |
| 8 阶段 Prompt 模板母本 | ✅ 已具备 | `docs/TT-USER-PROMPT-GUIDE.md` 阶段 0-7 |
| 矩阵簇 preconditions/candidates（T1-T5） | ✅ 已具备 | `scripts/lib/matrix.mjs` L1-6 |
| T4 开工 prompt 具名资产清单（F5 先例） | ✅ 已具备 | `templates/kickoff-prompt.md` L31-41 |
| 完工报告资产消费证据段（硬约束） | ✅ 已具备 | `templates/completion-report.md` L5-11 |
| 竞品调研结论（三级模型/斜杠命令/状态外置） | ✅ 已具备（调研） | T17-RESEARCH 已固化并实时核验；落地 ⬜ |
| journey.json + tt-journey.mjs 进度图（F1） | ⬜ 待实现 | M1-1/M1-2 |
| commands/ 6 阶段命令文件（F2） | ⬜ 待实现 | M1-3 |
| owner-review 5 份指引（F3） | ⬜ 待实现 | M2-1 |
| 全簇开工资产清单 + 域声明（F5） | ◐ 部分 | T4 专用段 ✅；泛化/声明/按域分组 ⬜ |
| 拆子会话建议（F4 建议层） | ⬜ 待实现 | M3-1 |
| orchestrator `--session <id>`（F4 隔离层） | ⬜ 待实现 | parseArgs 现无此字段（L24 实测） |
| 跨分支断点汇总链路（F4 汇总层） | ◐ 部分 | summary-read 单分支能力 ✅；跨分支汇总流程文档化 ⬜ |

---

## 7. 里程碑 / 风险 / 验收

### 7.1 里程碑

| 里程碑 | 范围 | 出口条件 |
|---|---|---|
| **M1 导航与注入** | F1 + F2（M1-1/M1-2/M1-3） | `tt-journey.mjs` 进度图 + journey 派生挂钩 + 6 命令文件全可注入；防跳阶段警告生效；GWT 逐条过；回归 8/8；validate 0 |
| **M2 可读化与透明化** | F3 + F5（M2-1/M2-2/M2-3/M2-4） | owner-review 5 指引 + 模板引用行 + 全簇资产清单 + 域声明 + 按域分组；GWT 逐条过；回归 8/8；validate 0 |
| **M3 多分支编排** | F4（M3-1/M3-2/M3-3） | 拆分建议判据生效；`--session` 隔离且无 flag 行为不变；summary-read 跨分支断点汇总链路打通；回归 8/8 |

### 7.2 风险

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | commands 摘要与 guide 双源漂移 | 注入的 Prompt 与文档纪律脱节 | 摘要只压缩不改写语义 + validate 漂移门（须含 guide 具名章节指针行）（C1） |
| R2 | journey 与 state-summary 口径冲突 | agent 拿到两套矛盾进度 | journey 由 writeStateSummary 同点派生，单轮单事实；gate 级更新只增不改历史（M1-2） |
| R3 | `--session` 命名空间遗漏（某产物路径未隔离） | 分支产物互相覆盖 | 收尾断言：session 模式下全部落盘路径含 `<id>` 前缀，断言失败 exit 非零（M3-2） |
| R4 | 域声明流于形式（agent 空喊域不认资产） | 透明化退化为口号 | 声明与 assetConsumed 一致性抽查（asset-call-rate.mjs 数据源）；缺失 → warning + 要求补充（FR-5 GWT） |
| R5 | 多分支合并冲突 | 两子会话同文件双改 | 复用既有 L0 changed-files 交集扫描（SKILL.md §5.4），冲突即触发完整 gate（FR-4） |
| R6 | 命令文件在无斜杠机制平台不可用 | 触发面收窄 | 斜杠仅为入口之一，同义触发词（"注入阶段 N prompt"）等效（FR-2 GWT 锁定） |

### 7.3 验收总纲

1. **回归门**：M1/M2/M3 完成后 `node scripts/regression-all.mjs` 均 8/8 PASS；`--session` 无 flag 时行为与 2.9.1 逐字节一致。
2. **功能门**：FR-1～FR-5 的 GWT 逐条通过（见 §4）。
3. **可移植性门**：本 PRD 及全部新增/修改文件不含本机绝对路径（validate 0 泄露）。
4. **上下文预算门**：单阶段注入 ≤500 token（三级模型第②级）；journey.json 字段数只减不增（BMAD "smaller or equal" audit）。
5. **诚实门**：INFERRED 标注不编造进度；域声明缺失必 warning；拆分会话是建议、批准权在 owner；不夸大任何"自动"能力。

---

## 8. 修订记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v1.0 | 2026-09-07 | 初版：需求来源（§2.1 已确认 5 痛点 + 结合方案约束）、设计对齐（T17 调研落地：渐进披露/斜杠命令/状态外置）、源码实况核对（2.9.1 实测行号）、FR-1～FR-5（含 GWT）、批判审查 5 条（含 URL）、状态标注（✅/◐/⬜）、里程碑 M1-M3 / 风险 6 条 / 验收总纲 |