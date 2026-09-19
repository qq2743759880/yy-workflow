# YY Skill Loading v3 · 阶段 2 任务总纲

> 状态：`PROVISIONAL / G2.1-BLOCKED / READY = {}`
>
> 本计划由阶段 2 Step0 前提挑战确认后生成，并在架构复核后扩展为 R1-R10。它是候选任务图，不是执行授权，不替代 `PRD0-contract-revision-v3.md` 的 Gate 2、Gate 3、Gate 4 和最终 Owner 确认。
>
> 设计文档前置链：`docs/designs/` 不存在；本计划 `build-on` `plans/tasks/PRD0-contract-revision-v3.md`、`plans/tasks/PRD1-yy-brownfield-repair.md`、`docs/yy-architecture-v3.md` 和当前源码，不覆盖旧的 `docs/yy-dev-plan.md`（该文件是历史 M1 owner-UX 计划）。

## 目标

在不重写 YY 的前提下，覆盖全部 16 个内置资产的 metadata、trigger、activation、receipt 和行为验收，并把现有 Journey 原型升级为真实阶段/资产可视化的 HTML 控制室；保留 CLI、manifest、state 和现有宿主适配器兼容，先形成可验证的控制面，再分批进入实现。

“覆盖全部 16 个资产”不等于“每个会话全文加载 16 个资产”。目标是：16 个资产都进入统一契约和测试矩阵，单次执行仍只按阶段和任务选择最小必要集合。

## 需求前提挑战（FR-101）

### 4 问结论区

| # | Forcing Question | 结论 |
|---|---|---|
| Q1 | 需求真实性：最强证据是什么？ | Owner 持续遭遇阶段跳转、技能遗漏、重复输入 Prompt、token 和时间成本；当前实跑还观察到资产消费证据 0% 和 stageVerification 写入缺陷。结论：对 YY owner 是真实高频问题，不扩张为泛化市场产品。 |
| Q2 | 现状方案：用户当前 workaround 是什么？代价多大？ | 当前依赖 `/yy`、关键词路由、全文 brief、日志和人工补 Prompt；失败后由 Owner 重新解释阶段纪律。代价是重复上下文、等待、人工确认和不可审计的“已调用”声明。具体节省比例由 R1 baseline 冻结。 |
| Q3 | 窄楔子：本周可交付的最小版本是什么？ | 覆盖范围扩大到全部 16 个资产的统一 metadata/trigger/activation/receipt 契约，但第一条真实运行链仍只验证一个 session、一个任务、一个 asset、一个 host adapter、一个 phase transition 和一页 Journey HTML 控制室；不同时全文激活 16 个资产，不进入 React/新 Bridge。 |
| Q4 | 未来适配：3 年后此功能更核心还是更边缘？ | 上下文预算、技能选择证据、阶段/契约控制、可恢复状态和独立验收仍是核心；16 个当前资产、host-visible 目录形态和当前 HTML 组件只是可替换实现。 |

### Premise 确认表

| # | 前提陈述 | Owner 确认 |
|---|---|---|
| P1 | 本轮是 YY 棕地修复，不是新建 Agent 平台；保留 CLI、manifest、state、artifact 和现有 adapter 兼容。 | agree |
| P2 | `journey.json` 是 owner-facing progress projection；日志可形成 inferred 观察，但不能单独授权阶段推进。 | agree |
| P3 | 全部 16 个资产都要进入优化覆盖面，但执行按最小激活集合和批次推进，不把全文加载 16 个资产当成功标准。 | agree |
| P4 | 阶段、契约、session、receipt 和阻塞条件由确定性代码控制；Agent 只在允许范围内解释、选择和产出。 | agree |
| P5 | 后端接口/文件契约先由 contract-reverse 反推，再由 Owner 用真实业务场景审查，冻结后执行期禁止直接修改。 | agree |
| P6 | 前端只扩展现有 HTML 原型为 Journey/资产控制室；每个页面独立 task，先 Gate A，未批准不得进入框架实现。 | agree |

### Step0 决策结果

前提全部确认，允许进入候选任务拆解；但 G2.1 尚未独立完成，所有 R-task 仍为 `BLOCKED/PROVISIONAL`，不得生成实现 handoff。

## 任务总纲

| task | 标题 | 依赖类型 | 依赖 | GWT 验收摘要 | 资产/平台 | 契约 |
|---|---|---|---|---|---|---|
| G2.1 | 六条 Critical 独立复现与裁决 | Gate | Gate 1 v2 | Given 冻结 C1/C2/C3/C5/C6/C7；When 第三方在固定 snapshot 复现；Then 每条得到 REPRODUCED/COUNTEREVIDENCE_CONFIRMED/UNRESOLVED，critique-level verdict 可计算 | dev-planner；独立 Execution Agent | G2.1 reproduction contract（已提案，未 READY） |
| G2.2 | 根据 verdict 生成并确认 R1-R10 | 完成 | G2.1 | Given verdict ledger；When 映射 finding、OBS 和四类新增闭环能力；Then 生成无环 R1-R10 图并由 Owner 确认 | dev-planner/review | PRD0 v3 task graph |
| R1 | 工程 baseline 与 16 资产实况矩阵 | 完成 | G2.2 | Given 固定 source snapshot；When 运行测量；Then 输出 16 资产、路由、token、延迟、gate、receipt 的可复现 baseline | review；dev-planner | `C-R1-baseline`（后续冻结） |
| R2 | Catalog/metadata/trigger/router 全 16 资产优化 | 完成 | R1 | Given 16 个资产；When ingestion 和 route battery 执行；Then metadata 无语义损坏、description 可诊断、route 支持 ambiguous/abstain、缓存可验证 | 全部 16 资产的 metadata/trigger | `C-R2-catalog`（后端审查后冻结） |
| R3 | Activation/receipt/behavior 全 16 资产优化 | 完成 | R2 | Given 任务只选必要资产；When activation 和宿主执行；Then 未激活正文不进入上下文，生命周期 receipt 完整，行为检查不接受 marker-only | 全部 16 资产；现有 prompt/CLI adapters | `C-R3-activation`（后端审查后冻结） |
| R4 | Phase Authority/gate/session/CI truth | 完成 | R3 | Given prereq、contract、receipt、session 任一失败；When dispatch/transition；Then fail-closed、状态不伪装 done、session 不串写、OBS-01/02 有独立验收 | `state/runtime/gate/store/ci` | `C-R4-control`（后端审查后冻结） |
| R5a | Journey Projection 与 CLI session 读模型 | 完成 | R4 | Given state、receipt、日志和 session；When read/project；Then 输出 observed/inferred/authorized/stale，不能由 inferred 授权 | `tt-journey/orchestrator` | `C-R5-journey`（后端审查后冻结） |
| R5b | Journey/资产可视化 HTML 控制室 | Gate/完成 | R5a + UI-GA | Given R5a 数据契约和现有原型；When 页面加载/切换 session/查看资产；Then 五类状态和证据来源可见，真实 nextPrompt 可复制，Bridge 未连接不伪造成功 | `frontend-design`、`frontend-visual-validation`、`colorize`、`review`、`security` | `C-R5-ui`；Gate A → PARITY → Gate B |
| R7 | 需求变更回退与 PRD 重跑闭环 | 控制面 | R4 + G2.2 | Given 新增需求或范围变更；When impact classification 执行；Then 受影响 PRD/任务/契约/READY 被精确失效，回退到正确 PRD gate 并可重新计算 READY | `planning`、`dev-planner`、`review` | `C-R7-change-loop`（Owner 审查后冻结） |
| R8 | 批判结论到修复任务的动态编排 | 控制面 | R4 + G2.2 | Given 新批判 finding；When tracker/register 执行；Then 幂等生成或关联 remediation task，注入依赖/GWT/证据要求，不直接自动改代码 | `review`、`planning`、`dev-planner` | `C-R8-remediation`（Owner 审查后冻结） |
| R9 | 前后端联调与契约变更重验收 | 集成 | R2/R3/R4/R5b | Given contract draft 和真实业务场景；When 后端确认、前端接入、联调和 discrepancy 发生；Then 变更级联失效并完成 CDC/E2E/视觉 parity 重验收 | `be-architect`、`implementation`、`be-validator`、`frontend-design`、`frontend-visual-validation` | `C-R9-integration`（后端确认后冻结） |
| R10 | Skill 资产自进化与独立上下文验收策略 | 控制面/证据 | R3/R4/R8 | Given 资产消费/失败/批判证据；When evolution candidate 进入压力测试；Then fresh isolated context 验证通过才可晋级，候选版本与回滚记录完整 | 全部 16 资产；`review`、`skill-sentinel`、`agent-vision-toolkit` | `C-R10-evolution`（策略确认后冻结） |
| R6 | 迁移、回滚、兼容与最终独立验收 | 完成 | R5b/R7/R8/R9/R10 | Given 旧 CLI/manifest/state/journey 和新闭环；When legacy/dual/strict 矩阵运行；Then 旧读路径可用、新 receipt 可追踪、失败可回滚、最终独立验收不采信报告 | `review`、`security`、`be-validator` | `C-R6-migration`（最终冻结） |

## 16 个资产覆盖矩阵

| 资产 | R1 baseline | R2 metadata/trigger | R3 activation/behavior | R5b 可视化 |
|---|---:|---:|---:|---:|
| agent-research | ✓ | ✓ | ✓ | 资产状态/receipt |
| agent-vision-toolkit | ✓ | ✓ | ✓ | 资产状态/receipt |
| be-architect | ✓ | ✓ | ✓ | 资产状态/receipt |
| be-provider | ✓ | ✓ | ✓ | 资产状态/receipt |
| be-resilience | ✓ | ✓ | ✓ | 资产状态/receipt |
| be-validator | ✓ | ✓ | ✓ | 资产状态/receipt |
| colorize | ✓ | ✓ | ✓ | 资产状态/receipt |
| dev-planner | ✓ | ✓ | ✓ | 资产状态/receipt |
| frontend-design | ✓ | ✓ | ✓ | 资产状态/receipt |
| frontend-visual-validation | ✓ | ✓ | ✓ | 资产状态/receipt |
| implementation | ✓ | ✓ | ✓ | 资产状态/receipt |
| planning | ✓ | ✓ | ✓ | 资产状态/receipt |
| review | ✓ | ✓ | ✓ | 资产状态/receipt |
| sdlc | ✓ | ✓ | ✓ | 资产状态/receipt |
| security | ✓ | ✓ | ✓ | 资产状态/receipt |
| skill-sentinel | ✓ | ✓ | ✓ | 资产状态/receipt |

资产优化的共同验收字段：`name`、`description`、`phaseEligibility`、`sourceHash`、`resources`、`activationLevel`、`tokenEstimate`、`receiptRefs`、`behaviorChecks`。资产正文仍按需加载，不能因覆盖 16 个资产而变成全量启动注入。

## 任务详细契约

### G2.1 · 六条 Critical 独立复现与裁决

- 前置：Gate 1 v2 已确认；source snapshot、finding anchor、命令和 expected observation 已冻结。
- 后置：G2.2 才能重新生成 R1-R10；不能直接修改 runtime、vendor 或 HTML。
- 契约冻结顺序：先冻结 C-G21 reproduction contract；第三方定义、可复现定义、72 小时 correction window 和默认 7 日复现窗口必须进入交接包。
- 选型依据：PRD0 v3 §4；Superpowers 的 verification-before-completion 和 writing-skills RED/GREEN/REFACTOR 只作为验证方法，不作为 finding 事实来源。

GWT：

1. Given 六条 finding 已固定；When 第三方执行；Then 不得替换集合。
2. Given 一条 source anchor 无法在 snapshot 找到；When 复现；Then 标记 UNRESOLVED，不删除。
3. Given Owner 提供同源 counterevidence；When 第三方复现成功；Then 只撤回对应 finding。
4. Given 至少一条 Critical REPRODUCED；When 汇总；Then critique ACCEPTED，旧 Gate 2 提案整体撤回。

### G2.2 · 重新生成并确认 R1-R10

- 前置：G2.1 有独立 verdict。
- 后置：R1 才可成为候选 baseline task；Owner 确认前不进入实现。
- 契约冻结顺序：先冻结 finding → task 映射 → 依赖 → GWT → 选型依据，再生成 task docs。
- 选型依据：PRD0 v3 §5-§6；旧 `SL0` 只能作为输入，不能延续 READY。

GWT：

1. Given 每条 C finding 有 verdict；When 生成任务图；Then 只把 accepted/independently supported finding 映射进 R-task。
2. Given OBS-01/OBS-02 未进入 Critical 集合；When 生成图；Then 仍映射到 R4/R6，不丢失。
3. Given R2-R10 有依赖；When 做拓扑检查；Then 无循环，R2 完成后才进入 R3，R6 只能在 R7-R10 相关闭环完成后进入最终验收。
4. Given Owner 尚未确认；When 计算 READY；Then READY 仍为空。

### R1 · 工程 baseline 与 16 资产实况矩阵

- 前置：G2.2 确认；不修改实现。
- 后置：R2 Catalog 契约可以冻结。
- 文件范围：新增 baseline fixture/report；只读扫描 `vendor/`、`scripts/`、现有 prototype 和 test harness。
- 契约冻结顺序：`C-R1-baseline` 先冻结字段、样本、命令、分母和状态，再运行测量。
- 选型依据：知识库 P-002 上下文纪律；Superpowers cache read-count test 的可重复测量方法；不用单一 CI PASS 代表行为正确。

GWT：

1. Given 16 个资产；When 运行 inventory；Then 每个资产都有 path、type、sourceHash、metadata status 和当前 body/resource 大小。
2. Given route battery；When 执行 positive、negative、near-miss、ambiguous、no-match；Then 记录输入、候选、结果、margin 和 abstain。
3. Given cold/warm/changed-content；When 运行 catalog/asset load；Then 记录读取次数、token、延迟和 cache identity。
4. Given OBS-01/02 probes；When 运行；Then 分别记录 standalone journey、orchestrator 和 CI 的 exit/output/artifact。

### R2 · Catalog/metadata/trigger/router 全 16 资产优化

- 前置：R1 baseline；不读取全机器技能目录。
- 后置：R3 只能消费冻结的 Catalog 和 route 输出契约。
- 文件范围：`scripts/lib/manifest.mjs`、`scripts/lib/planner.mjs`、`scripts/lib/matrix.mjs`、16 个 `vendor/*` metadata；新增 parser helper 只有在现有 façade 无法隔离测试时才允许。
- 契约冻结顺序：`C-R2-catalog` → metadata schema → diagnostics schema → route decision schema → cache key；后端 Owner 审查后冻结。
- 选型依据：Agent Skills progressive disclosure；Superpowers description 只写 trigger；知识库 P-003 ACI；不引入 vector DB。

GWT：

1. Given 16 个资产包含不同 frontmatter 形态；When build catalog；Then root name/description/version/keywords/resources 无语义破坏，非法项有 diagnostics。
2. Given description 有块标量、数组、嵌套字段或中文；When parse；Then 不再把 `|`/`>-` 当正文，也不因 nested description 覆盖 root。
3. Given route 输入包含 false positive、near-miss、mixed intent 和 tie；When select；Then explicit > phase eligibility > bounded lexical > abstain，低 margin 不首胜。
4. Given source content、parser version 或 schema version 变化；When reload cache；Then cache invalidated，并能解释失效原因。
5. Given 未激活资产；When startup catalog；Then 只读取 metadata，不读取正文和引用资源。

### R3 · Activation/receipt/behavior 全 16 资产优化

- 前置：R2 Catalog/route contract frozen。
- 后置：R4 可以把 required activation/behavior receipt 作为 phase gate 前置。
- 文件范围：`scripts/lib/asset.mjs`、`scripts/lib/adapters/prompt.mjs`、相关 adapter、16 个资产的 resource index/behavior fixture。
- 契约冻结顺序：`C-R3-activation` → activation package → token budget → asset receipt → behavior-check result；后端 Owner 逐条审查接口、schema、错误码和 response envelope 后冻结。
- 选型依据：Agent Skills metadata/body/resource 三层；Superpowers writing-skills 的行为压力测试；P-002 上下文外置。

GWT：

1. Given task 只选择 planning；When build activation package；Then 不出现其他 15 个资产正文。
2. Given body 未激活；When startup；Then body read count 为 0；resource read count 为 0。
3. Given body/resource 被激活；When host starts；Then receipt 记录 sourceHash、activationLevel、tokenEstimate、host command hash 和 artifact。
4. Given executor 只复制标题/kernel token；When behavior check；Then `behavior_verified=false`，不能凭 marker 升级成功。
5. Given 任一 16 资产被调用；When completion report；Then 至少有 lifecycle 状态和对应 behavior check；缺证据为 not_verified/blocked，不是 PASS。

### R4 · Phase Authority/gate/session/CI truth

- 前置：R3 receipt contract frozen。
- 后置：R5a 才能生成 authorized Journey projection；R6 才能进入 strict migration。
- 文件范围：`scripts/lib/state.mjs`、`scripts/lib/runtime.mjs`、`scripts/lib/gate.mjs`、`scripts/lib/store.mjs`、`scripts/orchestrator.mjs`、`scripts/tt-journey.mjs`、`scripts/ci.mjs`、`scripts/regression-all.mjs`。
- 契约冻结顺序：`C-R4-control` → transition table → error codes → session namespace → CI result semantics。
- 选型依据：P-001 固定步骤用 deterministic workflow；Anthropic workflow/agent 复杂度边界；现有 fail-open 代码锚点。

GWT：

1. Given prereq/contract/receipt/session 任一缺失；When dispatch/transition；Then blocking error、canonical state 保持、非零 exit。
2. Given `--force`；When bypass；Then 只写 bypass receipt，不把节点改成 done，不自动解锁下游。
3. Given `gate.before` 或 `gate.after` 抛异常；When runtime 收尾；Then blocking gate 不被吞掉。
4. Given session A/B 同时执行；When state/contract/artifact/journey 写入；Then namespace 不串写。
5. Given OBS-01；When standalone `tt-journey --update`；Then stageVerification 真正存在或返回明确失败。
6. Given OBS-02；When asset quality exit 1；Then CI 输出准确分类，不无条件打印 CI PASS。

### R5a · Journey Projection 与 CLI session 读模型

- 前置：R4 transition/session contract frozen。
- 后置：R5b HTML 页面只能读取 R5a projection；R6 才能做迁移兼容。
- 文件范围：`scripts/tt-journey.mjs`、`scripts/orchestrator.mjs`、`scripts/summary-read.mjs`、Journey fixtures。
- 契约冻结顺序：`C-R5-journey` → schema additive fields → observed/inferred/authorized semantics → session path → nextPrompt contract。
- 选型依据：保留用户认可的 Journey 功能；修正旧 8 phase 与当前 0–8 step 不一致；日志只做观察。

GWT：

1. Given 0–8 journey；When read；Then 显示 9 个节点、当前状态、下一步和 evidence refs。
2. Given 只有 state-summary/log；When render；Then 显示 `INFERRED`/stale/source，不写 Journey、不授权派单。
3. Given session A/B；When `--session` read/render/update；Then 所有路径属于同一 namespace。
4. Given current projection 有 nextPrompt；When copy；Then 返回当前数据的 nextPrompt，不返回固定 SAMPLE。

### R5b · Journey/资产可视化 HTML 控制室

- 页面粒度：一个页面 task，页面名为 `Journey Control Room`；不拆成多个前端页面。
- 前置：R5a data contract；Gate A 前只改 HTML 原型，不写 React/新 Bridge。
- 后置：UI-GA APPROVED 后冻结 token 和截图基线；PARITY_CHECK 通过后才允许框架实现。
- 文件范围：`prototypes/yy-workflow-panel/index.html`、`docs/prototype/journey-widget.html`、`prototypes/yy-workflow-panel/design-spec.md`、对应 validation/screenshot fixtures。
- 契约冻结顺序：`C-R5-ui` → data states → interaction states → design tokens → Gate A → PARITY → Gate B。
- 选型依据：`reference/frontend-gate.md`；现有原型；UI 不是新平台，只是现有 Journey 原型的真实数据接入。

GWT：

1. Given LOADING/EMPTY/ERROR/SUCCESS/PARTIAL；When page loads projection；Then each state has readable status, evidence source and recovery path。
2. Given current session；When switch session；Then state, assets, receipts and Journey all change consistently。
3. Given real loaded journey；When copy next prompt；Then copied text equals current projection data。
4. Given Bridge disconnected；When click high-impact action；Then show command preview/simulation or explicit failure, never fake exit code 0。
5. Given 16 asset catalog；When open asset view；Then show metadata status, eligibility, activation level, token estimate, receipt and verification state without loading all bodies。
6. Given prototype submitted；When visual validation runs；Then no horizontal overflow, controls ≥44px, text contrast ≥4.5:1, no AI-slop red-line violation, and owner must explicitly sign Gate A before framework implementation。

### R6 · 迁移、回滚、兼容与独立验收

- 前置：R2/R3/R4/R5b done；UI-GA/PARITY/Gate B status recorded where applicable。
- 后置：最终 PRD acceptance；独立验收报告；strict mode release decision。
- 文件范围：compat fixtures、migration readers/writers、`scripts/ci.mjs`、`scripts/regression-all.mjs`、release report。
- 契约冻结顺序：`C-R6-migration` → flags → dual-read/single-write rules → rollback snapshot format → release gate。
- 选型依据：PRD0 v3 MW0-MW4；Ponytail 的最小变更和可回滚；不删除旧字段。

GWT：

1. Given legacy manifest/state/journey；When new reader loads；Then old fields remain readable and unknown fields are preserved。
2. Given `legacy|dual|strict` flags；When run compatibility matrix；Then each mode has declared behavior and no silent fallback。
3. Given migration failure；When rollback flag/commit is applied；Then previous reader remains usable, snapshot exists, and receipt records rollback。
4. Given completion claim；When independent verifier runs commands；Then report distinguishes declaration, observation, verification and unverified items。
5. Given 16 assets; When final matrix runs; Then all assets have metadata, trigger, activation, receipt and behavior status; missing status blocks release.

### R7 · 需求变更回退与 PRD 重跑闭环

- 目标：把“新增需求/范围变更”从一句聊天反馈变成可审计的 change record，并精确回退到 PRD、拆任务、契约或实现层；不得全量重做，也不得让旧 READY 继续有效。
- 前置：R4 canonical state/READY 失效能力；G2.2 任务图确认。
- 后置：R8/R9/R10 和未来所有任务必须读取 change record 的影响范围；受影响节点重新走对应 gate。
- 文件范围：新增 `plans/active/changes/`、`contracts/discrepancies/` 的索引/草案；复用 `commands/`、`reference/documentation.md`、`scripts/` 现有入口；不删除旧计划。
- 契约冻结顺序：change schema → impact classes → invalidation rules → rewind target → owner approval → READY recomputation。
- 选型依据：旧版 `reference/documentation.md` 的按影响面重跑；R4 的 fail-closed 状态；P-001 固定流程；Ponytail 的增量字段和最小迁移。

GWT：

1. Given 新增需求只影响文档；When change record 提交；Then 只失效 PRD/设计/任务草案层，已完成代码和已验收契约保持有效。
2. Given 需求影响冻结契约；When classify；Then 受影响契约、前端/后端下游和 READY 集全部退出 READY，回到 contract-reverse/Owner review。
3. Given 需求影响实现行为；When rewind；Then 创建新的 PRD/plan version，保留旧版本、source hash、原因和 owner；禁止覆盖旧验收报告。
4. Given change record 缺少影响范围、owner 或 reason；When recompute；Then 返回 `CHANGE_RECORD_INVALID`，不推进任何阶段。
5. Given 同一 change record 重跑；When apply；Then 幂等，不重复生成任务、契约或 backlog 项。

### R8 · 批判结论到修复任务的动态编排

- 目标：批判不再停留在报告或 tracker；每条 finding 必须映射到已有任务、生成修复任务草案，或明确标记 `NO_ACTION` 并由 Owner 说明原因。
- 前置：R4 canonical task state；G2.1/G2.2 finding 状态模型；批判规则要求真实竞品、权威文献/官方项目资料和 source anchor。
- 后置：R6 release gate 必须核对所有 `REPRODUCED`/accepted finding 的 remediation 状态；R10 消费低质量资产调用和行为失败 finding。
- 文件范围：复用 `reference/critique-protocol.md`、`reference/dispatch-and-acceptance.md`、`plans/critique-backlog-tracker.md`、`scripts/review-gate.mjs`；增加 finding-to-task mapper 的契约和幂等索引。
- 契约冻结顺序：finding schema → evidence classes → remediation mapping → task insertion rules → dependency/GWT enrichment → Owner override rules。
- 选型依据：Superpowers `writing-skills` 的 RED/GREEN/REFACTOR 压力测试；现有 `--auto-register` 历史能力；P-003 可行动错误；不让 LLM 自由生成未审任务。

GWT：

1. Given 一条批判包含 file/line、证据 URL、日期、竞品/权威来源、影响和修复方向；When register；Then 产生稳定 finding ID 和状态。
2. Given finding 命中已有 R-task；When map；Then 追加批判承接项、GWT 和 evidence requirement，不创建重复任务。
3. Given finding 不命中已有任务；When map；Then 生成 `remediation-draft`，带范围、依赖、GWT、契约影响和 owner review 状态；不自动实现。
4. Given 相同批判文件重复注册；When register twice；Then tracker 和任务草案不重复，输出原有 ID。
5. Given 批判缺少竞品或权威来源；When gate；Then finding 为 `INVALID_EVIDENCE`，不能进入 remediation READY。

### R9 · 前后端联调与契约变更重验收

- 目标：将“后端接口实现”和“前端页面接入”拆成显式联调任务，不允许前端凭猜测接接口，也不允许后端改 schema 后只跑后端测试。
- 前置：R2/R3/R4 的 catalog、activation、receipt、phase 和 Journey draft contract；R5b HTML Gate A 不等于接口已冻结。
- 后置：R6 只接受通过 CDC/真实场景联调/关键 E2E/视觉 parity 的 integration receipt。
- 文件范围：`contracts/drafts/`、`contracts/frozen/`、`contracts/discrepancies/`；复用 `be-architect`、`be-validator`、`frontend-design`、`frontend-visual-validation` 的任务边界；不直接引入新框架。
- 契约冻结顺序：contract-reverse → backend schema/error/response confirmation → Owner real-scenario review → frozen hash → frontend adapter → integration fixtures → discrepancy revalidation。
- 选型依据：现有 `reference/planning.md` 的 contract-first；`reference/dispatch-and-acceptance.md` 的 L0-L4 gate；P-003 ACI；Superpowers 的任务 brief 与独立 review。

GWT：

1. Given `journey.read`/`journey.project`/`router.select` 等草案；When 后端确认；Then 输入、响应壳、错误码、空/失败/权限场景均有 owner 审查记录。
2. Given frozen contract；When 前端使用；Then 页面只消费 contract 字段，不读内部 state 文件或拼接隐式字段。
3. Given backend schema/error/response 改动；When discrepancy submitted；Then 受影响 frontend task、fixtures、READY 和 parity 状态失效。
4. Given updated contract；When CDC、真实业务 fixture、关键 E2E 和视觉 parity rerun；Then integration receipt 同时记录后端、前端、契约 hash 和结果。
5. Given contract draft only；When frontend starts in brownfield mode；Then task 明确标 `contract-draft`，所有偏差进入 discrepancy，不得把草案当 frozen。

### R10 · Skill 资产自进化与独立上下文验收策略

- 目标：把 16 个资产的低调用率、误路由、token 超标、行为失败、批判 finding 转化为候选版本；候选版本必须经隔离上下文压力测试和独立验收，不能由生成者自证。
- 前置：R3 activation/receipt/behavior evidence；R4 session/receipt authority；R8 remediation mapping。
- 后置：候选资产只有在 promotion receipt 完成后才能更新 catalog；R6 复核版本、回滚和全 16 资产矩阵。
- 文件范围：`vendor/` 资产本体、生成的 catalog/version index、`evidence/evolution/`、`CHANGELOG.md`、`skill-sentinel` 检查结果；不在本任务直接改宿主配置。
- 契约冻结顺序：candidate schema → evidence threshold → isolated context profile → pressure scenarios → independent verdict → promotion/rollback policy。
- 选型依据：F-C10 Superpowers `writing-skills` 的压力测试和 fresh-context 思路；Agent Skills progressive disclosure；P-002 context discipline；现有 asset receipt；默认标准库和现有宿主，不新增评估平台。

GWT：

1. Given asset consumption/behavior/critique evidence；When candidate generated；Then candidate 记录 source version、变更原因、目标症状、预期收益、风险和 rollback ref。
2. Given positive、near-miss negative、mixed-intent、typo 场景；When baseline without candidate runs；Then baseline result is recorded before candidate evaluation。
3. Given candidate; When isolated fresh context runs repeated pressure tests; Then route, activation, evidence, and behavior results are recorded with model/session identity and no access to candidate conclusions。
4. Given platform supports an independent context/subagent; When acceptance runs; Then acceptance uses a separate context, task brief, and evidence-only input, and the producer cannot mark its own candidate accepted。
5. Given platform cannot provide an internal isolated context; When fallback runs; Then use a separate execution session/agent identity, record the limitation, and keep candidate `PROVISIONAL` until independent verification completes。
6. Given candidate fails or regresses token/behavior/compatibility; When promotion gate runs; Then candidate is rejected or rolled back, catalog remains on last accepted version, and evidence is retained。

## 后端契约冻结顺序（本阶段只列清单，不冻结）

后端契约冻结前，Owner 要用真实业务场景逐条审查以下清单。当前只列草案，不代表接口已冻结。

| 契约操作 | 输入 schema | 输出 response shell | 主要错误码 | 真实场景审查点 |
|---|---|---|---|---|
| `catalog.read` | workspace、asset scope、refresh | `{ok, code, data: catalog, evidence, warnings}` | `CATALOG_INVALID`, `ASSET_SCOPE_INVALID` | 只读 YY 内置资产，是否能解释缺项 |
| `router.select` | task、phase、explicit assets | `{ok, code, data: {selected, candidates, margin, abstained}, evidence, warnings}` | `ROUTE_AMBIGUOUS`, `ROUTE_NO_MATCH`, `ASSET_NOT_ELIGIBLE` | 真实 mixed intent 是否应停下让 Owner 选 |
| `activation.prepare` | plan、subtask、asset、budget | `{ok, code, data: activationPackage, evidence, warnings}` | `ACTIVATION_BUDGET_EXCEEDED`, `ASSET_BODY_MISSING`, `RESOURCE_NOT_FOUND` | 未激活正文是否真的不进入上下文 |
| `receipt.append` | receipt event、source hash、session | `{ok, code, data: receiptRef, evidence, warnings}` | `RECEIPT_INVALID`, `RECEIPT_HASH_MISMATCH`, `RECEIPT_INCOMPLETE` | 宿主失败/重试/缓存命中如何记录 |
| `phase.check` | journey、target step、session | `{ok, code, data: {allowed, reason, missing}, evidence, warnings}` | `PHASE_PREREQ_UNMET`, `CONTRACT_NOT_FROZEN`, `SESSION_INVALID` | 失败是否保持 canonical state |
| `phase.transition` | from/to、owner receipt、evidence refs | `{ok, code, data: transition, evidence, warnings}` | `INVALID_TRANSITION`, `OWNER_APPROVAL_REQUIRED`, `OVERRIDE_NOT_ALLOWED` | `--force` 是否仍然不能伪装 done |
| `journey.read` | workspace、session、projection mode | `{ok, code, data: journey, evidence, warnings}` | `JOURNEY_NOT_FOUND`, `JOURNEY_STALE`, `JOURNEY_INVALID` | inferred 与 authorized 是否明确区分 |
| `journey.project` | state、receipts、logs、session | `{ok, code, data: projection, evidence, warnings}` | `PROJECTION_SOURCE_INVALID`, `PROJECTION_CONFLICT` | failed/skipped 是否会被错误显示为 done |
| `change.record` | base plan/version、reason、impact class、owner | `{ok, code, data: changeRecord, evidence, warnings}` | `CHANGE_RECORD_INVALID`, `CHANGE_SCOPE_UNCLEAR`, `CHANGE_OWNER_REQUIRED` | 只失效受影响节点还是错误地全量回退 |
| `remediation.register` | finding、evidence refs、candidate task/map mode | `{ok, code, data: {findingId, taskRef, status}, evidence, warnings}` | `INVALID_EVIDENCE`, `REMEDIATION_DUPLICATE`, `REMEDIATION_REVIEW_REQUIRED` | 批判是否有竞品/权威来源和可复现锚点 |
| `integration.validate` | contract hash、consumer map、fixtures、run refs | `{ok, code, data: integrationResult, evidence, warnings}` | `CONTRACT_HASH_MISMATCH`, `CDC_FAILED`, `PARITY_FAILED`, `DISCREPANCY_OPEN` | 前后端是否都基于同一 frozen contract |
| `evolution.propose` | asset、source version、evidence、candidate diff | `{ok, code, data: candidate, evidence, warnings}` | `CANDIDATE_INVALID`, `BASELINE_MISSING`, `ASSET_VERSION_CONFLICT` | 候选是否有 baseline、目标症状和 rollback |
| `evolution.accept` | candidate、isolated verdict、promotion decision | `{ok, code, data: promotion, evidence, warnings}` | `INDEPENDENT_VERIFICATION_REQUIRED`, `EVOLUTION_REGRESSION`, `PROMOTION_NOT_ALLOWED` | 生产者是否试图自验或绕过独立上下文 |

冻结前禁止实现期修改以上 schema、错误码和 response shell；需要变更时走 discrepancy change record + 重新审查 + 重验收。

## 资产与平台选型依据

| 领域 | 选型 | 依据 | 不选项 |
|---|---|---|---|
| metadata/parser | 现有 Node 文件控制面 + 有限 schema parser | 保持离线、自包含、兼容 CLI；Agent Skills 只要求有限 frontmatter contract | 不引入向量库/远程 registry |
| routing | explicit → phase eligibility → bounded lexical → abstain | 可解释、可测、适合 16 个固定资产 | 不把 embedding 当 MVP 必需 |
| activation | metadata/body/resource progressive disclosure | 降低启动 token 和上下文污染 | 不把 16 个正文打包进 brief |
| phase authority | 纯函数 transition + 现有 runtime/gate/store | 可复现、容易回归和回滚 | 不把阶段授权交给 LLM |
| receipts | 文件 receipt + source hash + artifact refs | 自包含、可离线、符合现有文件事实源 | 不新增数据库 |
| Journey UI | 现有 HTML 原型 + Playwright/静态验证 | 已有用户认知和设计资产 | 不在 Gate A 前写 React |
| asset review | 全 16 资产统一矩阵，按批次修复 | 统一 contract、减少复制逻辑 | 不为每个资产造一套运行时 |

## 契约与执行顺序

```text
G2.1 reproduction contract
  → G2.1 independent verdict
  → G2.2 R1-R10 graph confirmation
  → C-R1 baseline schema
  → C-R2 catalog/route
  → C-R3 activation/receipt
  → C-R4 phase/session/CI
  → C-R5 journey projection
  → R5a projection
  → C-R5-ui + UI-GA
  → HTML prototype validation + Gate A
  → PARITY_CHECK
  → C-R7 change-loop
  → C-R8 remediation
  → C-R9 frontend/backend integration
  → C-R10 evolution/independent acceptance
  → C-R6 migration/rollback
  → Gate B / independent release verification
```

## 规划自审（FR-201，CEO→Eng→Design）

### CEO 范围自审

- Scope Mode：`SELECTIVE EXPANSION`。
- Finding：Owner 把范围扩展到全部 16 个资产和前端可视化；若把它解释为 16 个资产同时重写，会重新制造 token、时间和依赖爆炸。
- 处置：采纳“全 16 覆盖、批次实现、单资产最小真实链、一个 HTML 控制室页面”的窄化方式；不新增 React、Bridge、全机器发现或远程 registry。
- 不做清单复核：完整；未延期的只有 16 资产统一覆盖和一页 Journey 控制室，其他能力延期并写入非目标。

### Eng 架构自审

- 架构边界 / data-flow shadow path：已检查 happy、nil、空、上游错误和 stale/inferred 路径。
- 测试覆盖缺口：standalone journey 与 orchestrator stageVerification 需要分开测试；CI quality exit 语义需要真实失败 fixture。
- 性能与 N+1：主要风险是 16 个正文全文进入 brief、重复读取资源和多 session 重复写 summary；R1 必须记录 read count/token/latency。
- Finding：[P1] (confidence: 9/10) `scripts/lib/manifest.mjs:3-15` — 伪 frontmatter parser 和反向 keyword split 不能承载 16 资产统一 metadata contract。
- 处置：纳入 R2，先冻结 C-R2 schema/diagnostics/cache，再改 parser；旧 manifest 字段保留兼容。

### Design 体验自审

- 交互状态表：LOADING 有 skeleton/读取状态；EMPTY 有未初始化引导；ERROR 显示原始错误/路径/重试；SUCCESS 显示 evidence/receipt；PARTIAL 显示哪些资产或 session 缺失。
- AI slop 检查：不得使用紫蓝渐变、霓虹、玻璃拟态、装饰性指标、通用字体或只用颜色表达状态。
- 无障碍：文本对比度 ≥4.5:1，UI 对比度 ≥3:1，按钮/选择控件命中区 ≥44px，状态同时有文字和图形。
- Finding：[P1] (confidence: 10/10) `docs/prototype/journey-widget.html:141-187` — 原型只接受 8 phase，且复制按钮固定读取 `SAMPLE.nextPrompt`，会把当前 Journey 和复制 Prompt 错配。
- 处置：纳入 R5b；按 0–8 projection 渲染当前数据，复制真实 `nextPrompt`，Bridge disconnected 时只提供预览/复制，不伪造执行。

## 执行顺序与可并行集

当前不产生 READY 集，原因是 G2.1 尚未完成。

候选拓扑顺序：

```text
{G2.1}
→ {G2.2}
→ {R1}
→ {R2}
→ {R3}
→ {R4}
   ├─→ {R7}
   ├─→ {R8}
   └─→ {R5a} → {R5b} ─┐
                       ├─→ {R9}
{R7} + {R8} + {R9} + {R10} ─→ {R6}
```

G2.1 之前没有实现并行集。G2.2 确认后，R1 仍先行；R2/R3 不并行；R4 完成后 R7、R8 和 R5a 可按契约依赖重新计算 READY；R9 必须等待 R5b 与后端契约；R10 必须消费 R3/R8 证据；R6 最后执行。

## 风险与回滚

| 风险 | 影响 | 回滚/缓解 |
|---|---|---|
| 16 资产同时改造导致范围爆炸 | token、测试、review 和上下文成本上升 | R2/R3 统一机制 + 16 资产矩阵；按批次执行，禁止全文并发加载 |
| 新 parser 改坏旧 manifest | CLI 或 resume 失败 | `legacy/dual/strict` reader mode；旧字段保留；R6 fixture 回归 |
| receipt 变成新的 marker password | 误判资产真的被采用 | delivery、execution、behavior 三态分离；marker 只作 telemetry |
| strict gate 阻断旧任务 | 兼容性回归 | `YY_GATE_MODE` feature flag、双读单写、写前快照、独立 revert commit |
| Journey projection 与 state 漂移 | UI 显示错误阶段 | 唯一 projection writer；inferred 不得授权；session namespace 统一 |
| HTML 原型变成 fake execution panel | Owner 被错误成功状态误导 | R5b 只读接入真实 evidence；simulation/real 明确标识；Gate A 前不进框架 |
| OBS-01/02 被静态 fixture 掩盖 | CI 继续虚绿 | standalone/orchestrator 双路径测试；quality exit 分类纳入 blocking 验收 |
| 目录搬迁破坏旧路径 | CLI、宿主、历史报告无法读取 | 先建立逻辑 namespace 和 index；R6 前只保留兼容 façade，不做大规模 rename |
| 新增需求让旧 READY 继续执行 | 返工和契约漂移 | R7 按影响面失效下游 contract/task/READY，旧版本只读保留 |
| 批判报告只登记不修复 | 技术债永久堆积 | R8 幂等生成 remediation task，R6 对 accepted finding 做 closure check |
| 前后端各自通过但联调失败 | UI 假数据或接口错配 | R9 强制 frozen hash、CDC、真实 fixture、E2E、visual parity |
| 自进化把坏资产推广 | 误路由、token 膨胀和行为退化 | R10 fresh isolated context、候选版本、独立 verdict、promotion/rollback |

## 契约冻结清单

- [ ] G2.1 reproduction contract 已由 Owner 确认
- [ ] G2.1 六条 finding 已固定且第三方身份/复现规则明确
- [ ] G2.2 verdict ledger 已独立验证
- [ ] C-R1 baseline schema 已冻结
- [ ] C-R2 catalog/route schema、错误码、response shell 已由 Owner 逐条审查
- [ ] C-R3 activation/receipt/token schema、错误码、response shell 已由 Owner 逐条审查
- [ ] C-R4 phase/session/CI schema、错误码、response shell 已由 Owner 逐条审查
- [ ] C-R5 journey projection schema 已冻结
- [ ] UI-GA 已明确 APPROVED/REJECTED
- [ ] C-R6 migration/rollback contract 已冻结
- [ ] C-R7 change-loop contract 已冻结
- [ ] C-R8 remediation contract 已冻结
- [ ] C-R9 integration contract 已冻结
- [ ] C-R10 evolution/independent-acceptance contract 已冻结

## 当前 READY 计算

```text
G2.1 = NOT_STARTED
G2.2 = BLOCKED
R1 = BLOCKED
R2 = BLOCKED
R3 = BLOCKED
R4 = BLOCKED
R5a = BLOCKED
R5b = BLOCKED
R7 = BLOCKED
R8 = BLOCKED
R9 = BLOCKED
R10 = BLOCKED
R6 = BLOCKED
READY = {}
```

## 相关 task 文档

- `docs/tasks/yy-skill-loading-v3/R1-baseline.md`
- `docs/tasks/yy-skill-loading-v3/R2-catalog-router.md`
- `docs/tasks/yy-skill-loading-v3/R3-activation-receipts.md`
- `docs/tasks/yy-skill-loading-v3/R4-phase-authority.md`
- `docs/tasks/yy-skill-loading-v3/R5-journey-control-room.md`
- `docs/tasks/yy-skill-loading-v3/R6-migration-verification.md`
- `docs/tasks/yy-skill-loading-v3/R7-requirements-change-loop.md`
- `docs/tasks/yy-skill-loading-v3/R8-critique-remediation.md`
- `docs/tasks/yy-skill-loading-v3/R9-frontend-backend-integration.md`
- `docs/tasks/yy-skill-loading-v3/R10-asset-evolution-acceptance.md`
- `docs/yy-architecture-v3.md`
