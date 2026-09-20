# C-R5-journey — Journey Control Room 后端投影契约（DRAFT / OWNER-REVIEWED / FROZEN-SOURCE）

> 文档状态：`C-R5=DRAFT / OWNER-REVIEWED / FROZEN-SOURCE`（2026-09-15；Owner 冻结授权 OQ 全项 = A，正文已逐字吸收 `[Owner 决断 OQ-R5-1…10=A，2026-09-15]`；**规范冻结副本 = `contracts/C-R5-journey.md`（FROZEN）**；本草案为 revision 源件，drafts/ 永不解锁任务）。配套清单 `contracts/drafts/C-R5-journey-review-checklist.md`（冻结副本 `contracts/C-R5-journey-review-checklist.md`）。
>
> 契约登记名：`C-R5-journey`（G2.2 图 §3 R5a 行与 §8 冻结序列为准；dev-plan 后端操作表 `:306-307`）。
>
> 操作名：仅 `journey.read`、`journey.project` 两个（`[计划输入 dev-plan:306-307]`，**逐字沿用，不新增、不改名**）。错误码逐字沿用 dev-plan 原码：`JOURNEY_NOT_FOUND`、`JOURNEY_STALE`、`JOURNEY_INVALID`（`journey.read`）；`PROJECTION_SOURCE_INVALID`、`PROJECTION_CONFLICT`（`journey.project`）。
>
> 快照：`240f3fbdb4ee757dffc4d5ab80407d1b2c84863c`。全部 grounding sources 的 sha256 已在撰写前重算并逐一匹配（见 §0 表）。
>
> 证据标签沿用 C-R3/C-R4 惯例：`[代码佐证]` = 冻结快照工作树源码 file:line；`[计划输入]` = PRD0/dev-plan/G2.2 图/R5 task doc 条目；`[草案]` = 本文件新提出、需 Owner 场景审查确认；`[Owner 决断 OQ-R5-x=A，2026-09-15]` = Owner 冻结授权裁决（全项 A，正文逐字吸收，不得只写附页）；`[R4冻结]` = `contracts/C-R4-control.md`（FROZEN）；`[R3冻结]` = `contracts/C-R3-activation.md`（FROZEN）。

## 0. Grounding sources（read-only，撰写前已逐一 sha256 校验）

| source | sha256 | 口径 | used for |
|---|---|---|---|
| `plans/tasks/G2.2-task-graph-20260911.md` | `d48f1fba8f6e1e41d500baec53c7576be03dc4ce3a4afd1bed590b9bf5857a98` | 文件字节 | R5a 节点规格（§3 R5a：read-only projection、observed/inferred/authorized/stale、9-node 显示、INFERRED 标注、session namespace、非 SAMPLE nextPrompt；`GWT-R5A-01…03`）、契约行 `C-R5-journey` create+freeze、下游 R5b/R9/R6、READY 公式 `R5a READY := R4 == DONE`（§4/§5.5） |
| `plans/tasks/PRD0-contract-revision-v3.md` | `a7cbc5df7383287f55194b721ac61b590d17872b59bdf3c2ee13978f7cdc90fd` | 文件字节 | MVP 观察面（§2 `可从 Journey 观察当前阶段/进度/阻塞/下一步`）、READY 公式（§5.5 `R5a READY := R4 == DONE`）、Journey Projection 文件映射行（§7：tt-journey.mjs/orchestrator.mjs；保留 CLI 与 journey schema 兼容读取；统一 projection 写入与 session 参数）、禁第二套 Journey writer（§7）、`YY_JOURNEY_WRITER=legacy|projection`（§9.2）、UI-GA 非 R5a 前置（§8） |
| `docs/tasks/yy-skill-loading-v3/R5-journey-control-room.md` | `cfae5c960ddb88090368d5962f7e854fc291ab4fbb3da72ac055ee2169bb7507` | 文件字节 | Boundary/non-goals 原文、Exact files、Dependencies、Freeze order 5 步、`GWT-R5A-01…03`、`GWT-R5B-01…04`（R5b 范围，本草案只登记不展开）、Selection basis、Evidence and rollback |
| `contracts/C-R4-control.md` | `19055ff7a5c881ef4daab4d323e8710467ae5f0ffd2a4db2d1ba21c34cb1a666` | 文件字节（FROZEN） | A/B 面权威划分（§3.1，Owner OQ-R4-1=A）、journey 非权威表述（§0.1 前提 1）、session 命名空间与缺省策略（§2.1）、stateVersion（§2.2）、锁语义与 `LOCK_ACQUIRE_FAILED`（§2.3）、override/审计字段（§5）、单一 transition 入口（§3.3）、CI 分类（§7）、MW0-MW4 与 flag 双读（§8）——**全部只消费不重定义** |
| `contracts/C-R3-activation.md` | `cfb077840fa83b6bf408441256d0bd7e25534b7f8b9b380dadb511d74455ceff` | 文件字节（FROZEN） | receipt 生命周期（§7.1-§7.2）、`behavior_verified` 终态、per-artifact `artifacts/<subtaskId>/receipt.json`（§7.6）、回放推导状态（§7.6）、裸布尔 telemetry-only（§7.8/§8.3）——投影的 receipt 证据源语义只读消费 |
| `docs/yy-dev-plan-skill-loading-v3.md` | `d2e8e5b45466ca23c81420dd6b18a9384b648e7c23cb4dbcaba13a0b8168a8db` | 文件字节 | 操作表 `:306-307`（`journey.read`/`journey.project` 输入/壳/错误码/审查点原文）、全表统一壳、`P2` 行（journey.json 是 owner-facing projection，日志只形成 inferred 观察，不能单独授权阶段推进）、R5a GWT 1-4（`:186-189`）、R5a 契约冻结顺序（`:181`）、冻结前禁改 schema/错误码/壳（`:314`） |
| `test-reports/R4-acceptance-20260915/REPORT.md` | `6ec11ec545979c116be12b643a976d0a5a11bc3ea62b22ec4bc35839c22ee43f` | 文件字节 | R4 = ACCEPTED（2026-09-15）；`scripts/tt-journey.mjs` 接受哈希 `e06865bd…`（与本工作树逐字节一致，已复算）；`route41Rerun.required=false` 先例；`acceptancePerformedBy=orchestrator`（非 executor） |
| `scripts/tt-journey.mjs` | 工作树 `e06865bd0adf8498498fa7c7bd1e927d1025c5043c1f18e7273a3f8178407726`（= R4 接受哈希） | 工作树（post-R4 ACCEPTED） | `JOURNEY_SCHEMA='yy/journey@1'`（:8）、`GATE_VOCAB`（:9）、STEPS 0-8（:12-22）、`VALID_STATUS=pending/in_progress/done`（:38）、`journeyPath` 命名空间化（:52-55）、`inferSources` 读根 state.json+artifacts（:206-224）、`inferJourney` 有 source 即置 step7=done（:226-240）、渲染 INFERRED 标注（:280-310）、`--update`/锁/stageVerification（:125-203）[代码佐证] |

> 口径说明：七个冻结输入文件均按"文件字节 sha256"在撰写前重算并与任务书给定值逐一匹配（无 mismatch）。`scripts/tt-journey.mjs` 非冻结输入清单文件，按 R4 验收报告登记的接受哈希引用，本草案复算一致；仅作现状对照锚点，本草案不修改它。

## 0.1 设计前提（handoff 指定）

1. **Journey 非权威——投影只读，授权面在别处**：R4 task doc Boundary 原文——"Journey is not the authority; the runtime state and receipts are" `[计划输入 R4 doc §Boundary]`；`[R4冻结]` §3.1 已决 A/B 面：**A 面（plan 7 态，`state.mjs`）= 执行权威**，**B 面（journey 9 step + 4 闸）= 里程碑 gate 权威**（`[Owner 决断 OQ-R4-1=A，已吸收]`）。本契约的 Journey 是**只读投影面（R5a 后端投影）**：它读 runtime state + receipt + gate + logs，把 A/B 面的权威状态投影成 owner 可见进度；它**不授权任何 phase 推进、不派单**。dev-plan `:31` P2 原文："journey.json 是 owner-facing progress projection；日志可形成 inferred 观察，但不能单独授权阶段推进"。
2. **R5a = 后端投影；UI/HTML 归 R5b**：R5 doc Boundary 原文——"R5a repairs Journey as a read-only projection of authoritative session state, receipts, gates, and logs. R5b improves exactly one frontend page… It does not authorize transitions." `[计划输入 R5 doc §Boundary]`。本契约只定义后端读模型（`journey.read`/`journey.project` 的输入/壳/错误码/schema/诚实投影语义）；R5 doc Freeze order 第 4 步"one-page interaction states and accessibility expectations"与 Gate A/B 属 R5b（`C-R5-ui`），本草案不展开、不替 R5b 决定视觉。
3. **observed / inferred / authorized / stale 四态词汇**：dev-plan R5a 行（`:51`）要求"输出 observed/inferred/authorized/stale，不能由 inferred 授权"；dev-plan R5a GWT2（`:187`）"只有 state-summary/log → 显示 `INFERRED`/stale/source，不写 Journey、不授权派单"。权威来源（A 面 state、B 面 gate 置位、C-R3 receipt 终态）投影为 **authorized/observed**；仅由日志/state-summary 推断出的进度标注为 **inferred** 并附 source；缺失/陈旧/冲突/畸形来源投影为 **stale/partial/error**。**inferred 永不授权**——这是本契约的核心诚实边界（§4）。**字段级映射（`[Owner 决断 OQ-R5-3=A，2026-09-15]`）：state→authorized（phase/progress 维）、receipts→authorized（资产 verified 维）、gates 置位→authorized（milestone gate 维）、logs/state-summary→inferred（必附 source）。**
4. **只消费、不重定义 R3/R4 已冻结语义**：C-R4 的 A/B 权威裁决、单一 transition 入口、锁/override/phase.gate 语义、`[R3冻结]` P1-P5 谓词地板与裸布尔 telemetry-only 规则，本契约只作投影输入消费，不重新定义、不弱化。`journey.plans[]` 现状的 `__manual__/prereq-bypassed` 留痕（`tt-journey.mjs:142-144`）按 `[R4冻结]` §5.1 定性为投影面留痕、不是 override 授权记录，原样消费。

---

## 1. Scope and non-goals

### 1.1 In scope `[计划输入 R5 doc §Boundary + G2.2 R5a 行]`

- 把 Journey 修复为 authoritative session state、receipts、gates、logs 的**只读投影**；定义 observed/inferred/authorized/stale 语义、证据来源链与 `nextPrompt` 数据契约的后端面。
- 两个操作契约：`journey.read`、`journey.project`（§5），完整输入/输出壳/错误码/投影 schema。
- 数据源绑定与优先级（§2）：state（A 面）、receipts（`[R3冻结]` per-artifact）、logs（inferred-only 观察）、session（`[R4冻结]` §2.1 命名空间）。
- stale/conflict/partial 语义与错误码映射（§3）；诚实投影语义单列（§4）：failed/skipped 不得显示为 done。
- 兼容读取：保留现有 CLI 与 `journey.json`（`yy/journey@1`）兼容读取；投影字段走 additive（PRD0 §7 Journey Projection 行"保留 CLI 和 journey schema 兼容读取"）。
- Exact files（实现边界，非本草案修改对象）：`scripts/tt-journey.mjs`、`scripts/orchestrator.mjs`、`scripts/summary-read.mjs`、Journey fixtures、additive projection schema（`[计划输入 R5 doc §Exact files + dev-plan:180]`）。

### 1.2 Non-goals `[计划输入 R5 doc §Boundary + G2.2 R5a 行]`

- **不做前端实现**：R5b 的 HTML 控制室、interaction states、accessibility、Gate A/B 不在本契约；`C-R5-ui` 另立。
- **不做第二个 Journey writer / 不建第二套 state truth**（PRD0 §7 原文"禁止新增一个与 `tt-journey.mjs` 并行的第二套 Journey writer，也禁止新增一个与 `store.mjs` 并行的 state truth"）；projection 是派生视图，不引入新的权威存储。
- **不授权任何转换/派单**：投影只读；"accepting an override as normal flow"、"authorization from inferred states" 均为 non-goal（R5 doc Boundary；G2.2 R5a 行 non-goals "authorization from inferred states"）。
- 不新增操作名、错误码、状态名：仅 dev-plan `:306-307` 已列的两操作五码；投影层状态词汇（STALE/PARTIAL/ERROR/SUCCESS、observed/inferred/authorized）是投影展示态，其阈值与格式 = 本契约 §3.1（`[Owner 决断 OQ-R5-2/OQ-R5-3，2026-09-15]`，已吸收，不再 `[待补充]`）。
- 不改 R3/R4 冻结契约任何条款；不改路由（`route41Rerun.required=false`，草案阶段）；不改状态表/PRD0/G2.2/任何 finding 状态。
- 不做验收：本草案是 Owner 场景审查输入；R6 拥有独立视觉/行为验收，R5 不框架化（不建 React scaffold）。

---

## 2. Projection input sources and precedence（Freeze order 第 1 步）

> 沿 R5 doc Freeze order：先冻数据源与优先级，再冻字段/states/evidence，再冻壳/错误码。本节冻结**来源身份与权威层级**；来源间数值冲突的判定见 §3 与 §2.2（OQ-R5-1）。

### 2.1 四类绑定源 `[计划输入 R5 doc Boundary + dev-plan:307]`

| 源 | 权威面 | 投影角色 | grounding |
|---|---|---|---|
| **state**（A 面 plan/subtask 状态） | 执行权威 `[R4冻结]` §3.1 | 决定"authoritative phase/progress"的主源（OQ-R5-1：phase/progress 维权威） | `[计划输入 dev-plan:307]` 输入列 `state`；A 面 7 态 `idle/planning/executing/frozen/reviewing/done/failed`（`[R4冻结]` §3.1/§3.2，词汇不改名） |
| **receipts**（C-R3 per-artifact receipt 事件链） | 行为验证终态源 | 决定资产 activated/verified 的诚实投影（OQ-R5-1：资产消费维权威）；`behavior_verified`/FAILED/UNRESOLVED 如实投影 | `[R3冻结]` §7.1-§7.6（`artifacts/<subtaskId>/receipt.json`，回放推导）；`[计划输入 dev-plan:307]` 输入列 `receipts` |
| **logs**（journey 日志、`result.txt`、执行 stdout/stderr 等） | **inferred-only 观察源** | 只能形成 `INFERRED` 观察 + source 标注；**不能单独授权或把日志标签升格为完成态**（OQ-R5-3：logs/state-summary→inferred） | `[计划输入 dev-plan:31]` P2；R5 doc GWT-R5A-01"cannot manufacture a completion state from a log label alone"；dev-plan R5a GWT2（`:187`） |
| **session** | 隔离键（非内容源） | 决定读哪一组 state/receipts/logs；命名空间规则消费 `[R4冻结]` §2.1 | `[计划输入 dev-plan:307]` 输入列 `session`；`[R4冻结]` §2.1（session 白名单校验、namespace 落点、legacy 缺省路径） |

### 2.2 优先级与"唯一 projection writer"纪律 `[草案]` + `[计划输入 PRD0 §7]`

- **分维权威归并** `[Owner 决断 OQ-R5-1=A，2026-09-15]`：**phase/progress 维度以 state（A 面）为权威**；**资产消费维度以 receipts（`[R3冻结]` 每资产终态）为权威**；logs 仅作 inferred 旁证。**两源在同一数值上矛盾时，各自维度如实投影、互不覆盖**，并产出 `discrepancy warning`（进 `warnings` 通道）。此为本契约多源归并的顶层规则。
- 当 state 缺失而仅存 logs/state-summary 时，整图降级为 `INFERRED`（§3.1），并显式标注 source（对齐现状 `renderJourney` 的 INFERRED 标注，`tt-journey.mjs:283`）；任一绑定源缺失 ⇒ `PARTIAL`（OQ-R5-2）。
- **唯一 projection writer**（PRD0 风险表 `:406` 缓解："唯一 projection writer；inferred 不得授权；session namespace 统一"）：投影内容只由一个 writer 产生 = **`journey.project`（projection 模式）**。`YY_JOURNEY_WRITER=legacy|projection`（PRD0 §9.2 `:372`）两模式语义 `[Owner 决断 OQ-R5-10=A，2026-09-15]`：**legacy = 沿用现状写路径**（`tt-journey.mjs`）；**projection = `journey.project` 为唯一 projection writer**；**MW0 双写并存并对账，MW1 起 legacy 写停用**；切换时机**挂靠 PRD0 §9.1 MW 表**（MW0/MW1），不单设时机。
- **现状 discrepancy D-1（入册，不改代码）**：`inferSources(workspace)`（`tt-journey.mjs:206-224`）读的是**根** `.tt-state/state.json` 与**根** `artifacts/*/state-summary.json`，**未接收 sessionId**；而 `journeyPath`（`:52-55`）已按 session 命名空间化。即在 namespaced 模式下，现状推断源与 journey 落点不同根——这正是 GWT-R5A-03 / dev-plan R5a GWT3 要求修的"所有路径同 namespace"。本契约把"投影源必须随 session 命名空间读取"列为契约期望（§3.3，布局 OQ-R5-9），实现属 R5a 实现任务，本草案不改 `scripts/`。
- **现状 discrepancy D-3（入册）**：现状 `inferSources` 只读 state.json + state-summary.json，**未绑定 receipts 与 logs**；R5 doc Boundary 要求投影 state/receipts/gates/logs 四源。四源绑定是 R5a 新增投影源（§2.1 表）；读取范围按分维权威归并（OQ-R5-1：receipts 供资产维、logs 供 inferred 旁证）；任一绑定源缺失 ⇒ `PARTIAL`（OQ-R5-2）。

### 2.3 与 R4 gate / B 面闸的消费关系 `[R4冻结]`

- B 面 9 step + 4 闸（`GATE_VOCAB=concept-signed/premise-signed/contract-frozen/gate-a-approved`，`tt-journey.mjs:9`）的置位记录是 milestone gate 权威，投影**原样展示**其 `gates_passed` 与 step，不重定义谓词、不改词表（OQ-R5-3：gates 置位→authorized）。
- phase transition 的授权判定属 `phase.check`/`phase.transition`（`[R4冻结]` §6）；`journey.read`/`journey.project` 是**只读读模型**，不调用、不替代 transition 入口；投影里某 step 显示为 blocked/next-action 仅作 owner 决策辅助，点击/复制**不构成授权**（对齐 R5 doc "It does not authorize transitions"）。

---

## 3. Projection modes, stale / conflict / partial semantics（Freeze order 第 2、3 步）

### 3.1 投影展示态词汇（投影层，非 A/B 面状态名）`[计划输入 R5 doc GWT-R5A-02 + dev-plan:51]`

投影对一次生成结果给出一个顶层展示态，取值集合（**词汇为投影层新增展示标签；STALE/PARTIAL 判据与字段级映射 `[Owner 决断 OQ-R5-2 / OQ-R5-3，2026-09-15]`，见表后判据**）：

| 展示态 | 含义 | grounding |
|---|---|---|
| `AUTHORIZED` / `OBSERVED` | 由权威 state + receipt 链支撑的 phase/progress | dev-plan `:51` observed/authorized；§0.1 前提 3 |
| `INFERRED` | 仅 state-summary/log 等旁证推出；附 source；**不写 Journey、不授权派单** | dev-plan R5a GWT2（`:187`）；现状 INFERRED 标注 `tt-journey.mjs:283` |
| `STALE` | 权威源存在但**时点落后于其他权威源最新时点**（相对判据；原因 + source） | R5 doc GWT-R5A-02；`JOURNEY_STALE` 错误码（§5.1）`[Owner 决断 OQ-R5-2=A]` |
| `PARTIAL` | **任一绑定源缺失**或不可读，已投影部分带缺项说明 | R5 doc GWT-R5A-02 `[Owner 决断 OQ-R5-2=A]` |
| `ERROR` | 源畸形/不可解析/多源冲突未解，返回 reason | R5 doc GWT-R5A-02；`PROJECTION_SOURCE_INVALID`/`PROJECTION_CONFLICT`（§5.2） |

- **永不静默 `SUCCESS`**（R5 doc GWT-R5A-02 原文）：缺/旧/冲突/畸形源必须落到可见 `STALE`/`PARTIAL`/`ERROR` 并带 reason，不得默认渲染成成功/完成。
- **判定判据（`[Owner 决断 OQ-R5-2/OQ-R5-3，2026-09-15]`）**：
  - `STALE` = **相对判据**：journey/某源时点**落后于其他权威源最新时点**（不引入墙钟数值）`[Owner 决断 OQ-R5-2=A]`。
  - `PARTIAL` = **任一绑定源缺失**（含不可读/不可解析）；已投影部分带缺项说明 `[Owner 决断 OQ-R5-2=A]`。
  - **字段级映射** `[Owner 决断 OQ-R5-3=A，2026-09-15]`：**state → authorized/observed（phase/progress 维）**；**receipts → authorized（资产 verified 维）**；**gates 置位 → authorized**；**logs/state-summary → inferred（必附 source）**。
  - 判定优先级遵守**分维诚实投影**：STALE/PARTIAL/ERROR 按各自判据如实落到可见态并带 reason，**互不覆盖**（OQ-R5-1）；冲突/畸形（`PROJECTION_SOURCE_INVALID`/`PROJECTION_CONFLICT`）落 `ERROR`，冲突回落**节点级**证据（OQ-R5-7）。

### 3.2 诚实投影：failed/skipped 不得显示为 done（dev-plan review 列原文要求，单列）

> 这是 dev-plan 操作表 `:307` 对 `journey.project` 的**真实场景审查点原文**："failed/skipped 是否会被错误显示为 done"。本节把它固化为契约不变量。

- **不变量**：任一 subtask/plan 源状态为 `failed`、`skipped`（或 `unknown`/负向收口）时，投影**不得**把它或它所属 step 聚合显示为 `done`/SUCCESS。完成态必须由权威 A 面 `done` 或 C-R3 receipt 正终态 `behavior_verified` 支撑；负向/未决状态必须如实投影为 failed/skipped/unresolved 展示，并携带 reason 与 evidenceRef。
- **归并映射表** `[Owner 决断 OQ-R5-8=A，2026-09-15]`：

| 源负向/未决态 | 投影展示 | 备注 |
|---|---|---|
| `failed`（A 面 / receipt FAILED） | `FAILED` | 如实投影，不得显示为 done/SUCCESS |
| `skipped` | `SKIPPED` | **附 reason source** |
| receipt `UNRESOLVED` | `UNRESOLVED` | 未决，不得升格为 verified/done |
| 组级聚合（plan 内多 subtask / step 内多 plan） | **取最坏态** | 组内任一 failed/skipped/UNRESOLVED ⇒ 组**不得显示完成** |

- **现状 discrepancy D-2（入册，缺陷形态对照）**：`inferJourney`（`tt-journey.mjs:229-233`）在 `hasPlan = sources.length > 0` 为真时**无条件**置 `journey.steps[7].status = 'done'`，**不看**任一 source 的 `status`；随后 `plans[]` 才逐条写入 `src.status`（`:236`，含 failed/skipped/unknown 原值）。即"有任何 plan 源"就把 step7 标 done，即使该 plan 是 failed/skipped——这正是 review 列担心的"failed/skipped 被错误显示为 done"的现状形态。R5a 实现必须让 step 的聚合态由各 plan 源状态**诚实归并**（全 done 才 done；组级取最坏态，OQ-R5-8），而非"有即 done"。这条归并规则已由 `[Owner 决断 OQ-R5-8=A，2026-09-15]` 落定。
- 与 `[R3冻结]` 的衔接：资产维度的 failed/unresolved 直接投影 receipt 的 `FAILED`/`UNRESOLVED` 终态（§7.5 表），不得用 telemetry-only 裸布尔升格为 verified/done（`[R3冻结]` §7.8/§8.3，本契约不弱化）。

### 3.3 Session selection（GWT-R5A-03）`[计划输入]` + `[草案]`

- 给定多个 session：投影**只读所选 session** 的 state/receipts/logs；跨 session 只读对账允许、跨 session 投影混淆禁止（对齐 `[R4冻结]` §2.1 session isolation）。
- 无 `session` 输入时**保留 legacy 缺省路径**（现状 `.tt-state/` 根，`tt-journey.mjs:52-55`；GWT-R5A-03 原文"preserves the legacy default path when no session is supplied"）。
- namespaced 模式下投影源读取必须随 session 命名空间（修 D-1）；缺省 session 策略（strict 下自动生成 UUIDv4）沿用 `[R4冻结]` §2.1/OQ-R4-4=B，本契约不另立。
- **namespaced 目录布局** `[Owner 决断 OQ-R5-9=A，2026-09-15]`：`.tt-state/<sessionId>/{state.json, journey.json, artifacts/<subtaskId>/receipt.json, overrides/}`；**logs 随 artifacts 落在 session 根下**；**legacy 无 session 时保持现状根路径**（修复 D-1，投影源与落点同 namespace）。
- session id 非法 ⇒ 输入校验失败走 `JOURNEY_INVALID`（§5.1；白名单规则消费 `[R4冻结]` §2.1，不另立码）。

---

## 4. Evidence, nextPrompt, and read-only guarantee

### 4.1 Evidence links `[计划输入 R5 doc GWT-R5A-01/02]`

- 投影必须随每步/每资产携带 **source evidence**：哪个源（state/receipt/log/gate）、源标识（planId/subtaskId/artifact 路径/receiptSeq/session）、源的 sha/时点回声。GWT-R5A-01 原文"reports the authoritative phase and progress plus source evidence"；GWT-R5A-02 要求 stale/partial/error 带 reason。
- **evidence links 形状** `[Owner 决断 OQ-R5-6=A，2026-09-15]`：数组，每条 `{sourceKind: state|receipts|logs|gates, path, sha256, updatedAt, sessionId}`（**与 R8 sourceAnchor 同构**）。原则：投影可被回指到产生它的权威源字节/事件，owner 能从 Journey 跳到证据，而非只看一个进度条。
- logs 作为 evidence 时**必须标 `inferred`**，且不得作为完成态的唯一证据（§0.1 前提 3 / OQ-R5-3）。

### 4.2 nextPrompt 数据契约（后端面）`[计划输入 dev-plan R5a GWT4 :189]`

- dev-plan R5a GWT4 原文："Given current projection 有 nextPrompt；When copy；Then 返回当前数据的 nextPrompt，不返回固定 SAMPLE。"
- 后端投影的 `data` 中携带**当前数据派生**的 `nextPrompt`；复制/读取必须返回当前 projection 计算出的真实值，不得返回硬编码 SAMPLE 字符串。
- **nextPrompt 字段与复制语义** `[Owner 决断 OQ-R5-5=A，2026-09-15]`：`nextPrompt` = **结构化对象 `{actionHint, targetNode, requiredInputs[]}`**，并携带**生成时 projection 快照的哈希回声**；**复制 = 快照引用，不重算**（复制返回生成该 nextPrompt 时的投影快照引用，不触发重新投影/重算）。
- **现状 discrepancy D-4（入册）**：`journey.json` schema（`yy/journey@1`，顶层仅 `schema/steps/plans/updated_at`，`tt-journey.mjs:8/:37`）**无 nextPrompt 字段**；CLI 渲染（`renderJourney`，:280-310）也不产出 nextPrompt。"固定 SAMPLE.nextPrompt"缺陷在前端原型 `docs/prototype/journey-widget.html:141-187`（G2.2 R5b 行登记，属 R5b）。R5a 冻结"nextPrompt 必须由当前投影数据派生、禁 SAMPLE"这条后端不变量，字段形状与复制语义 = OQ-R5-5（上月，本页已吸收）。

### 4.3 Read-only guarantee（两操作均只读）`[草案]`

- `journey.read`、`journey.project` 均**只读**：不写 state、journey、receipt、override；不推进任何 step/gate；`journey.project` 产出的是投影对象（`data.projection`），其**落盘经唯一 projection writer = `journey.project`（projection 模式）写入 `.tt-state/<sessionId>/journey.json`**（OQ-R5-10 / OQ-R5-9）。
- inferred 投影**不落盘**为权威 Journey（对齐现状：推断结果只渲染、`exists3 === null` 即不写，`tt-journey.mjs:375`）。
- 任何"投影把状态写成成功/完成"的路径 = defect（§3.2）。

---

## 5. `journey.read` / `journey.project` schemas（Freeze order 第 3 步）

Response shell 沿用 dev-plan 全表统一壳（`:298-313`；C-R2/C-R3/C-R4 同构）`[计划输入]`：

```json
{ "ok": true, "code": null, "data": { }, "evidence": { }, "warnings": [ ] }
```

shell 键集在成功与失败间完全一致；正常决策结果（如 INFERRED）进 `data` 而非 error（沿 C-R2/C-R3 惯例）。

### 5.1 `journey.read` `[计划输入 dev-plan:306]`

| 项 | 定义 |
|---|---|
| 语义 | 读已存在的 Journey/投影，按 `projection mode` 渲染当前 phase、9 节点、下一步与 evidence refs（dev-plan R5a GWT1：显示 9 个节点、当前状态、下一步和 evidence refs）。只读。 |
| 输入 | `workspace`、`session`（可选；缺省 = legacy 根路径，§3.3）、`projection mode`（dev-plan 输入列原文；**枚举与缺省 `[Owner 决断 OQ-R5-4=A，2026-09-15]`：`summary|full`，缺省 `summary`**；`summary`=phase/progress/next，`full`=9 节点+资产+evidence 全量）——三键逐字沿用 `[计划输入 dev-plan:306]` |
| 输出 | shell `data: journey`（`[计划输入 dev-plan:306]` 原形）；`data` 内含 9 节点（step 0-8）、当前状态、下一步、evidence refs（§4.1，形状 OQ-R5-6）、`nextPrompt`（§4.2，形状 OQ-R5-5）、展示态（§3.1）；`evidence` 含源身份/时点回声 `[草案]`；`warnings` 收集 partial/inferred 旁证提示与分维 discrepancy warning `[草案]` |
| 错误码 | `JOURNEY_NOT_FOUND`（无 journey 且无可推断源）、`JOURNEY_STALE`（权威源存在但过期，相对判据 OQ-R5-2）、`JOURNEY_INVALID`（journey 形状畸形/session 非法/输入校验失败）——**三码均 `[计划输入 dev-plan:306]` 原码，不改名不新增** |
| 诚实性 | 仅旁证可得时返回 `INFERRED` 标注（`data` 通道，不进 error），不写 Journey、不授权（dev-plan R5a GWT2）；failed/skipped 按 §3.2/OQ-R5-8 如实展示 |
| 审查点（Owner） | dev-plan `:306` 原文："inferred 与 authorized 是否明确区分"——投影必须让 inferred 与 authorized 在 data 中可机读区分（OQ-R5-3 字段级映射），不得混为一谈 |

### 5.2 `journey.project` `[计划输入 dev-plan:307]`

| 项 | 定义 |
|---|---|
| 语义 | 从权威 `state` + `receipts` + `logs` + `session` 重新计算一次投影（projection writer 的后端读模型面），返回 `data: projection`。只读权威源；不授权转换。 |
| 输入 | `state`、`receipts`、`logs`、`session`——四键逐字沿用 `[计划输入 dev-plan:307]`；各源读取范围按**分维权威归并**（OQ-R5-1）：state→phase/progress 维、receipts→资产维、logs→inferred 旁证、session→隔离键 |
| 输出 | shell `data: projection`（`[计划输入 dev-plan:307]` 原形）；projection = §3.1 展示态 + 9 节点 + 诚实归并后的 plan/资产状态 + evidence refs + `nextPrompt`；`evidence` 含各源 sha/时点/会话回声 `[草案]`（形状 OQ-R5-6） |
| 错误码 | `PROJECTION_SOURCE_INVALID`（某源畸形/不可解析/形状违约）、`PROJECTION_CONFLICT`（多权威源互相矛盾、无法在不臆断下归并；**节点级，OQ-R5-7**）——**两码均 `[计划输入 dev-plan:307]` 原码，不改名不新增** |
| 诚实性 | §3.2 不变量：failed/skipped 不得显示为 done（OQ-R5-8 归并映射）；冲突时落 `PROJECTION_CONFLICT` + 节点级双方 evidence，不得静默选一边渲染成成功（R5 doc GWT-R5A-02 / OQ-R5-7） |
| 审查点（Owner） | dev-plan `:307` 原文："failed/skipped 是否会被错误显示为 done"——投影归并必须把 failed/skipped/负向收口如实呈现，禁止"有源即 done"（对照 D-2）；组级取最坏态（OQ-R5-8） |

**PROJECTION_CONFLICT 节点级判定** `[Owner 决断 OQ-R5-7=A，2026-09-15]`：**同一 plan/subtask 的权威字段（phase/progress 维或资产 verified 维）在两源间矛盾，且按 OQ-R5-1 分维归并仍不可并** ⇒ 列**节点级**冲突双方 evidence（谁与谁冲突、各自路径/sha/时点）；**展示态词汇差异（如一侧 INFERRED、另一侧 AUTHORIZED）不算冲突**——只有数值/权威字段矛盾才触发。

### 5.3 错误码→场景映射（草案表，判据按 OQ 已决）`[计划输入]` + `[草案]`

| 码 | 触发场景（否定式/定性） | 通道 |
|---|---|---|
| `JOURNEY_NOT_FOUND` | 无 journey 文件且无可推断源（§3.2/现状空目录形态） | data 诊断 或 error（通道归属 `[待补充]`，见 §8.1 非 OQ 残留） |
| `JOURNEY_STALE` | journey/权威源存在但**时点落后**（相对判据，OQ-R5-2） | 携带 reason + source |
| `JOURNEY_INVALID` | journey JSON 畸形/session id 非法/输入形状违约 | fail-closed，不渲染成功 |
| `PROJECTION_SOURCE_INVALID` | state/receipts/logs 某源不可解析或 schema 违约 | 返回 ERROR + reason |
| `PROJECTION_CONFLICT` | 多权威源互相矛盾，无法在不臆断下归并 | 返回 ERROR + **节点级**冲突双方 evidence（OQ-R5-7）；展示态词汇差异不算冲突 |

- 冻结前不改上述 schema/错误码/壳（dev-plan `:314` 原文："冻结前禁止实现期修改以上 schema、错误码和 response shell；需要变更时走 discrepancy change record + 重新审查 + 重验收"）。
- 除 `JOURNEY_NOT_FOUND` 通道归属（§8.1，非 OQ 残留，归 R5a 实现阶段沿 R3 "正常决策进 data"惯例定）外，各码与 `data`/`error` 通道分叉均按本契约已决语义执行。

---

## 6. Migration, flags, rollback（消费 R4，不重定义）

- **flag**：`YY_JOURNEY_WRITER=legacy|projection`（PRD0 §9.2 `:372`），两模式语义与切换见 §2.2（`[Owner 决断 OQ-R5-10=A，2026-09-15]`：legacy=现状写路径；projection=`journey.project` 唯一 writer；MW0 双写并存对账、MW1 起 legacy 写停用；切换挂靠 PRD0 §9.1 MW 表，不单设时机）；session 命名空间消费 `YY_SESSION_MODE=legacy|namespaced`（`[R4冻结]` §8.1）；目录布局见 §3.3（OQ-R5-9：`.tt-state/<sessionId>/{state.json, journey.json, artifacts/<subtaskId>/receipt.json, overrides/}`，logs 随 artifacts 在 session 根下）；gate/receipt mode 消费 `[R4冻结]`/`[R3冻结]`，本契约不新增 flag、不重定义其值。
- **兼容读取保留**：现有 CLI、`yy/journey@1` 字段、legacy 无 session 根路径在迁移窗口内可读（PRD0 §7 Journey Projection 行；dev-plan R5a GWT3）；投影字段 additive，不删旧字段。
- **唯一 writer / 无第二 truth**（PRD0 §7）：projection 不引入新的权威存储；rollback 恢复 prior HTML/CLI 路径并保持 projection API additive（R5 doc Evidence and rollback）；R5 不建 React scaffold。
- MW0-MW4 窗口语义沿 PRD0 §9.1 与 `[R4冻结]` §8.2，本契约只在投影读法层面消费；窗口推进的执行与验收属 R6。

---

## 7. Discrepancy log（现状代码 vs 计划；入册，不改冻结文件）

> 以下为冻结快照工作树实测与计划/本契约期望的差异，仅登记为审查输入与实现任务的修复对象；本草案**不修改** `scripts/`、plans、contracts 任何冻结文件。

| # | discrepancy | 现状锚点 | 计划/期望 | 处置 |
|---|---|---|---|---|
| D-1 | 推断源未随 session 命名空间 | `inferSources(workspace)` 读根 state.json + 根 artifacts，不接 sessionId（`tt-journey.mjs:206-224`）；journeyPath 已命名空间化（`:52-55`） | namespaced 模式下投影读源与落点同 namespace（GWT-R5A-03 / dev-plan R5a GWT3）；布局 `.tt-state/<sessionId>/…`（OQ-R5-9） | R5a 实现修复；本草案 §3.3 固化期望 |
| D-2 | 有任一 plan 源即把 step7 置 done，无视 failed/skipped | `inferJourney`：`hasPlan ⇒ steps[7].status='done'`（`:229-233`），不看 `src.status` | failed/skipped 不得显示为 done；组级取最坏态（OQ-R5-8） | R5a 实现修复；§3.2 归并映射冻结 |
| D-3 | 投影源未绑定 receipts/logs | 现状只读 state.json + state-summary.json（`:206-224`） | 投影 state/receipts/gates/logs 四源（R5 doc Boundary）；读取范围按分维权威归并（OQ-R5-1）；缺失⇒PARTIAL（OQ-R5-2） | R5a 新增绑定 |
| D-4 | journey schema 无 nextPrompt；无真实 nextPrompt 数据 | `yy/journey@1` 顶层仅 schema/steps/plans/updated_at（`:8/:37`）；CLI 不产出 nextPrompt | nextPrompt 由当前投影数据派生，禁固定 SAMPLE（OQ-R5-5：结构化对象 + 快照哈希回声 + 复制=快照引用） | R5a 后端补派生字段；SAMPLE 缺陷在 R5b 原型 |
| D-5 | 无投影层展示态词汇 | step 仅 pending/in_progress/done（`:38`）；无 STALE/PARTIAL/ERROR/observed/inferred/authorized | R5 doc GWT-R5A-02 / dev-plan `:51` 要求这些展示态 | 词汇集合冻结（§3.1），判据 OQ-R5-2/3 |
| D-6 | CLI 输出为 ASCII，非统一壳 | `renderJourney` 打印文本（`:280-310`），无 `{ok,code,data,evidence,warnings}` | `journey.read`/`journey.project` 返回统一壳（dev-plan `:306-307`） | 壳 schema 冻结（§5）；CLI→壳桥接属实现 |
| D-7 | `YY_JOURNEY_WRITER` 模式未在代码读取 | PRD0 §9.2 `:372` 定义；工作树 tt-journey 未见读取 | 唯一 projection writer 两模式语义（OQ-R5-10：legacy=现状写路径；projection=journey.project；MW0 双写对账、MW1 停 legacy 写；切换挂 PRD0 §9.1 MW 表） | §2.2/§6 固化，R5a 实现读取 |

---

## 8. OQ index（2026-09-15 全部 DECIDED）

> 以下 OQ-R5-1…10 已于 2026-09-15 由 Owner 冻结授权**全部裁决（全项 = A）**，正文各落点已逐字吸收（见各处 `[Owner 决断 OQ-R5-x=A，2026-09-15]` 标注），**不得只写附页**。本索引状态 **OPEN→DECIDED**。残余 `[待补充]` 仅见 §8.1 非 OQ 残留（非冻结十项）。

| 编号 | 落点 | 待决内容（裁决后） | 状态 |
|---|---|---|---|
| OQ-R5-1 | §2.2 | 分维权威归并：phase/progress 以 state 为权威，资产消费维度以 receipts 为权威；两源矛盾时各自维度如实投影 + discrepancy warning，互不覆盖 | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R5-2 | §3.1 | 相对判据：STALE = journey/源时点落后于其他权威源最新时点；PARTIAL = 任一绑定源缺失；不引入墙钟数值 | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R5-3 | §3.1/§5 | 字段级映射：state→authorized（phase/progress）、receipts→authorized（资产 verified 维）、gates 置位→authorized、logs/state-summary→inferred（必附 source） | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R5-4 | §5.1 | projection mode 枚举 `summary|full`，缺省 `summary`（summary=phase/progress/next；full=9 节点+资产+evidence 全量） | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R5-5 | §4.2 | nextPrompt = 结构化对象 `{actionHint, targetNode, requiredInputs[]}` + 生成时 projection 快照哈希回声；复制 = 快照引用，不重算 | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R5-6 | §4.1 | evidence links：数组，每条 `{sourceKind: state|receipts|logs|gates, path, sha256, updatedAt, sessionId}`（与 R8 sourceAnchor 同构） | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R5-7 | §5.2 | PROJECTION_CONFLICT 节点级：同一 plan/subtask 权威字段两源矛盾且按 OQ-R5-1 不可归并 → 列节点级冲突双方 evidence；展示态词汇差异不算冲突 | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R5-8 | §3.2 | 归并映射：failed→FAILED、skipped→SKIPPED（附 reason source）、UNRESOLVED→UNRESOLVED；组级聚合取最坏态（组内任一 failed/skipped/UNRESOLVED ⇒ 组不得显示完成） | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R5-9 | §3.3/§6 | 布局：`.tt-state/<sessionId>/{state.json, journey.json, artifacts/<subtaskId>/receipt.json, overrides/}`；logs 随 artifacts 在 session 根下；legacy 无 session 保持现状根（修复 D-1） | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R5-10 | §2.2/§6 | writer：legacy=现状写路径；projection=journey.project 唯一 writer；MW0 双写并存对账、MW1 起 legacy 写停用；切换挂靠 PRD0 §9.1 MW 表，不单设时机 | **DECIDED**（2026-09-15，Owner=A） |

### 8.1 非 OQ 残留（允许带进冻结契约，沿 C-R4 先例）

- `JOURNEY_NOT_FOUND` 的 data/error 通道归属（§5.3）`[待补充]`——**不属冻结的 OQ-R5-1…10**，沿 R3 "正常决策进 data"惯例倾向，归 R5a 实现阶段定；不弱化本契约诚实边界，不构成冻结阻断。

> drafts/ 永不解锁任务：本草案为 revision 源件（`OWNER-REVIEWED / FROZEN-SOURCE`），**规范版本 = `contracts/C-R5-journey.md`（FROZEN，2026-09-15）**；drafts/ 原件保留不删（沿 C-R4 先例）。`route41Rerun.required=false`（零路由改动，与 R4 同判）；不登记状态台账。本草案不做验收：`acceptancePerformedByExecutor=false`（冻结 = Owner 决策，执行器不自验）。