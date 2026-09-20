# C-R4-control — Phase Authority / Gate / Session / CI Truthfulness Contract（DRAFT）

> 文档状态：`OWNER-REVIEWED / PENDING-FREEZE / C-R4=DRAFT`（非冻结；本草案不解锁任何任务，G2.2 图 §8：contract drafts never unlock tasks；OQ-R4-1…9 已于 2026-09-14 由 Owner 裁决并逐字吸收正文，见各节 `[Owner 决断 …]` 标注）
>
> 契约登记名：`C-R4-control`（G2.2 图 §3 R4 行与 §8 冻结序列为准）。本文件与配套清单 `contracts/drafts/C-R4-review-checklist.md` 是该契约的草案载体；文件名取自任务文档 `R4-phase-authority.md`（handoff 指定，不改名以免触碰冻结文件引用）。
>
> 操作名：仅 `phase.check`、`phase.transition` 两个（`[计划输入 dev-plan:304-305]`）。不新增操作名。
>
> 快照：`240f3fbdb4ee757dffc4d5ab80407d1b2c84863c`。全部 grounding sources 的 sha256 已在撰写前重算并逐一匹配（见 §0 表）。
>
> 证据标签沿用 C-R3 惯例：`[代码佐证]` = 冻结快照源码 file:line；`[计划输入]` = PRD0/dev-plan/G2.2 图/R4 task doc 条目；`[草案]` = 本文件新提出、需 Owner 场景审查确认的内容；`[待补充]` = 无实测值或 Owner 未裁决，禁止编造；`[C5复现]` = `test-reports/C5-reproduction-20260914b/REPORT.md`（REPRODUCED，锚点修正版）；`[R3冻结]` = `contracts/C-R3-activation.md`（FROZEN，hash 见 §0）。

## 0. Grounding sources（read-only，撰写前已逐一 sha256 校验）

| source | sha256 | 口径 | used for |
|---|---|---|---|
| `plans/tasks/G2.2-task-graph-20260911.md` | `5574f88f…` | tree | R4 节点规格（§3 R4：GWT-R4-01…05、L1-L3、C5/C7 锚点）、冻结顺序（§8）、C5 解锁条件（§5） |
| `plans/tasks/PRD0-contract-revision-v3.md` | `88c125fa…` | tree | MVP 边界（§2.2）、READY 公式 R4 行（§5.5）、文件映射 Phase Authority/Receipt Store/CI truth 行（§7）、MW0-MW4 与五 flag（§9.1/§9.2）、回滚纪律（§9.3）、OBS-01/02 验收（§11） |
| `docs/tasks/yy-skill-loading-v3/R4-phase-authority.md` | `684fcb3d…` | tree | Boundary/non-goals、Exact files、Freeze order 5 步、GWT-R4-01…05、Evidence and rollback |
| `contracts/C-R3-activation.md` | `cfb07784…` | tree（FROZEN） | receipt 生命周期（§7.1-§7.2）、P1-P5 谓词地板（§7.4）、telemetry-only 读法（§7.8/§8.3）、per-artifact 存储（§7.6）、三模式与 MW 映射（§8.1-§8.2） |
| `contracts/C-R3-review-checklist.md` | `c9e00d57…` | tree（FROZEN） | 清单格式惯例、R3-7/R3-8 兼容场景期望 |
| `docs/yy-dev-plan-skill-loading-v3.md` | `d2e8e5b4…` | tree | 操作表 `:304-305`（phase.check/phase.transition 输入输出+错误码）、R4 冻结顺序 `:164`、R4 GWT 1-6 `:167-174`、R3→R4 后置 `:146` |
| `scripts/lib/state.mjs` | tree `28b8690f…` = blob `28b8690f…` | 两口径一致 | 现状状态机词汇与转换矩阵（§3.1/§3.2）[代码佐证] |
| `scripts/lib/runtime.mjs` | tree `4561877b…`（blob `77e9872b…`） | tree（handoff 锚点口径） | gate.before 吞异常 `:38`、直写 status `:68/:100-114`、CONTRACT_NOT_FROZEN `:105-108`、gate.after warn 吞掉 `:78-81` [代码佐证] |
| `scripts/lib/gate.mjs` | blob(LF) `65fdb68e…`（C5 锚点；tree CRLF 形 `b7e683be…`） | blob（handoff 指明 commit blob LF canonical；C5 复现所用口径） | TT_GATE_MODE `:37`、before 恒 pass `:43-47`、after 的 warn 路径 `:58/:64/:74` [代码佐证] |
| `scripts/lib/store.mjs` | tree `c15544b4…`（blob `68629154…`） | tree | createStore 无版本字段 `:4-11`；receiptStore 增量层（C-R3 §7.6 已冻结） |
| `scripts/ci.mjs` | tree `1483a7b3…` = blob `1483a7b3…` | 两口径一致 | C7/OBS-02 锚点 `:95-100`、`process.exitCode=1` 缺省 `:107` [代码佐证] |
| `scripts/tt-journey.mjs` | tree `4ea8c179…` = blob `4ea8c179…` | 两口径一致 | GATE_VOCAB `:6`、STEPS 0-8 `:9-20`、session namespace `:51-52`、--force 留痕 `:120-152`、锁常量与 fail-open `:181-217`、OBS-01 写入路径 `:3/:156-165` [代码佐证] |
| `scripts/orchestrator.mjs` | 快照内源码（未列冻结锚点，只读引用） | — | `--session` 校验 `:47`、syncJourney 异步 fs 写 stageVerification `:175-215` [代码佐证] |
| `test-reports/C5-reproduction-20260914b/REPORT.md` | 见报告（本表引用其结论） | — | C5 = REPRODUCED（锚点修正版）；首报 20260914（UNRESOLVED）原样保留 [C5复现] |
| `test-reports/R3-reacceptance-20260914/REPORT.md` | 见报告 | — | R3 复验 ACCEPTED；receipt 层现状基线 |
| `docs/tasks/yy-skill-loading-v3/R4-phase-authority.md` §Boundary | （同上行 3） | — | 范围/非目标原文 |

> 口径说明：handoff 对 `gate.mjs` 明确给出 commit blob LF canonical 形（C5 复现口径），对其余文件给 tree 形。本表对五个锚点同时记录 tree 与 blob 两个哈希（一致者记"两口径一致"），供复验方任一口径核对。`ENV-RESOLUTION.md` 在本仓不存在（已记录，不阻塞）。

## 0.1 设计前提（handoff 指定四项）

1. **Session authority over journey projection**：R4 task doc Boundary 原文——"Journey is not the authority; the runtime state and receipts are" `[计划输入]`。本契约把 journey 定位为只读投影面（R5a 消费），授权面 = runtime state + receipt + gate；现状 `journey.plans[]` 的 `prereq-bypassed` 留痕（`tt-journey.mjs:142`）在 strict 模式下降格为投影记录，不是 override 授权记录（§5.4）。
2. **Additive fields + migration window**：现有 CLI、state、adapters 保持兼容；R4 新增字段走增量字段 + MW0-MW4 迁移窗口（PRD0 §9.1），不删除旧字段、不破坏现有读取（GWT-R4-03 legacy no-session 路径迁移期内保持可读）。
3. **C5 状态 = REPRODUCED → RESOLVED（仅证据阻塞清除）**：`[C5复现]` 2026-09-14 Owner 将锚点修正为 commit blob LF canonical 形（`65fdb68e…`）后，第三方会话在快照 `240f3fbd` 复现成功（首报 UNRESOLVED 原样保留，分歧由锚点修正解释）。**gate 行为缺陷本身未被修复**——malformed contract 下 gate.before 被 skip、dispatch 以 `done` 收口的现状（`runtime.mjs:38` + `gate.mjs:43-47` 恒 pass）仍是快照现状。**本契约不宣称 C5 已修复；R4 是修复主体，修复落地前 gate 不得被跳过**。G2.2 图 §1 ledger 的 `UNRESOLVED` 原文作为历史记录保留不改（本草案不改任何受治理文件）。
4. **R3 receipt 是前提证据源**：`[R3冻结]` §7.4 P1-P5 是行为验证的必要条件地板；R4 的 phase gate 以 C-R3 receipt 事件链的 `behavior_verified` 判定为 gate 输入（`[计划输入 dev-plan:146]` R3 后置行"R4 可以把 required activation/behavior receipt 作为 phase gate 前置"）。R4 可在 P1-P5 地板之上定义**更强**验证，**不得弱化**任何 P1-P5 谓词、不得把 legacy `assetConsumed` 裸布尔升格为 gate 输入（`[R3冻结]` §7.8/§8.3 + OQ-R3-7 决断：telemetry-only，永不满足 phase gate）。

---

## 1. Scope and non-goals

### 1.1 In scope `[计划输入 R4 task doc §Boundary]`

- 修复 authoritative phase transitions：单一状态转换入口、fail-closed gates（PRD0 §7 Phase Authority 行："让所有状态写入和 dispatch 先经过同一 transition/eligibility 函数"）。
- contract prerequisites、session isolation、lock behavior、override policy、CI fail-closed reporting。
- 两个操作契约：`phase.check`、`phase.transition`（§6），完整输入/输出/错误码/response shell。
- OBS-01/OBS-02 验收（PRD0 §11；G2.2 图 R4 行"carries OBS-01/OBS-02 acceptance"）。
- Exact files（实现边界，非本草案修改对象）：`scripts/lib/runtime.mjs`、`scripts/lib/gate.mjs`、`scripts/lib/store.mjs`、`scripts/lib/state.mjs`、`scripts/tt-journey.mjs`（仅 projection 输入与 CLI 兼容）、`scripts/ci.mjs`、additive state/contract docs `[计划输入 R4 doc §Exact files]`。
- 修复主体声明：C5 的 gate-skip/dispatch 缺陷与 OBS-01 写入缺陷、OBS-02 CI 真实性缺陷均在本契约验收范围内由 R4 实现任务修复；本契约只定义修复必须满足的判定规则，不修改任何运行时代码。

### 1.2 Non-goals `[计划输入 R4 doc §Boundary + G2.2 图 R4 行]`

- 不做前端实现（PRD0 §6.1 R4 行"不接 UI"；Frontend Gate A: N/A）。
- 不做全机器技能发现（PRD0 §2.2.2）。
- 不替换 CLI（现有 CLI 命令面保持兼容，只加增量字段/flag）。
- 不把 override 视为正常流（§5.1：override 是显式 Owner 授权的例外通道，不是默认路径）。
- **路由零改动**：不改变 R2 `router.select` 语义、路由关键词、簇或状态；`route41Rerun.required = false`（草案阶段，handoff 指定）。R4 消费 R2/R3 产物，不回改。
- 不改 R3 冻结契约的任何条款（`[R3冻结]` 只读消费；P1-P5 不得弱化）。
- 不修改状态表（G2.2 图）、PRD0、任何 finding 状态。
- 不引入向量数据库、远程注册中心、模型微调、新服务端运行时（PRD0 §2.2.5）。

---

## 2. Session identity, state version, lock ownership

### 2.1 Session identity `[代码佐证]` + `[草案]`

| 项 | 现状锚点 | 本契约规则 |
|---|---|---|
| session 标识来源 | CLI `--session` 显式传入；orchestrator 校验 `^[A-Za-z0-9_-]+$` 防路径穿越（`orchestrator.mjs:47`）`[代码佐证]` | 校验规则沿用（同一白名单），所有 R4 写入面（state/journey/receipt/override）统一执行同一校验；非法值 ⇒ `SESSION_INVALID`（`[计划输入 dev-plan:304]` 原码），fail-closed |
| session namespace 落点 | journey 已命名空间化：`.tt-state/<sessionId>/journey.json`（`tt-journey.mjs:51-52`）；**state.json 未命名空间化**（`store.mjs:4-11` 恒写 `.tt-state/state.json`）`[代码佐证]` | namespaced 模式下 state 写入与 artifacts 归入 session namespace（GWT-R4-03"state/contract/artifact/journey 写入不串写"）；具体 namespace 布局 = §8.2 迁移窗口内增量字段实现，布局细节 `[草案]` 待实现任务按本节约束细化 |
| 缺省 session（无 --session） | 现状 = 旧路径 `.tt-state/` 根，行为不变（task12 复用语义，`tt-journey.mjs:50`）`[代码佐证]` | legacy 模式保留缺省路径；**strict 模式下缺省自动生成 UUIDv4 session** `[Owner 决断 OQ-R4-4=B，2026-09-14]`。(a) 元数据：自动生成 session 的**生成时间、生成方、算法版本**写入 state 元数据，与 receipt `session` 字段同源可查（任何 session id 必须能在审计字段中追溯到创建时点与创建方）；namespaced 模式下缺省行为按 strict 同一规则。(b) MW4 对账：MW4 清理变更单须先对账全部自动生成 session 的元数据与审计引用，确认无悬空引用后方可清理（沿 §8.3 无备份不迁移纪律）。 |
| 与 R3 receipt 的 session 字段 | receipt 事件携带 `session` 透传（`[R3冻结]` §3.4），namespace 规则属 R4——即本节 | 本节规则即 receipt `session` 字段的语义归宿：同一 session 的 receipt 与 state/journey 同 namespace；跨 session 读取 receipt 允许（对账），跨 session 写入禁止（GWT-R4-03） |

### 2.2 State version 字段与迁移 fallback `[草案， handoff §2]`

- 现状：`store.mjs:4-11` `createStore` 直接 JSON 序列化 plan，**无 version 字段** `[代码佐证]`。
- 本契约要求：state.json 增加顶层 `stateVersion` 字段（additive；旧文件缺该字段 = 合法 legacy 形态）。
- 读取 fallback 规则 `[Owner 决断 OQ-R4-2=A，2026-09-14]`：`stateVersion` 缺失 ⇒ 按 legacy v0 形态读取（双读窗口 MW0 内合法）；存在但不认识的高版本 ⇒ fail-closed，走独立新码 **`STATE_VERSION_UNSUPPORTED`**（Owner 定名，不复用 `SESSION_INVALID` 通道；禁止静默降级读取后覆写）。低版本写入路径在 MW1 后停用（PRD0 §9.1）。
- `stateVersion` 初始值 = **`1`** `[Owner 决断 OQ-R4-2=A，2026-09-14]`（缺字段 = legacy v0 双读，MW0 内合法；不认识的高版本 fail-closed 确认句见上条）。
- 与 R3 receipt 存储不冲突：`stateVersion` 属 state.json 通道（`createStore`）；receipt 走 `receiptStore` per-artifact 增量层（`[R3冻结]` §7.6），两通道各自独立演化，receipt.json 不引入本字段。

### 2.3 Lock 语义 `[代码佐证]` + `[草案]`

| 项 | 现状锚点 | 本契约规则 |
|---|---|---|
| 现有锁机制 | journey 锁：`withJourneyLock`（`tt-journey.mjs:195-217`）——`wx` 独占创建 + 重试 `{times:5, delayMs:400}`（`:181-182`）+ stale 自愈（mtime > 30s 接管）+ **耗尽后 `WARN: journey lock busy, proceeding without lock` 继续** `[代码佐证]` | **现状是 fail-open**。strict 模式下锁耗尽必须 fail-closed：操作失败、返回显式安全结果、**不得在锁外继续执行**（GWT-R4-04 原文"it must not continue after exhausting retries without an explicit safe result"） |
| 持有者字段 | 现状 lock 文件无持有者信息（空文件占位，`:184-189` `wx` 创建）`[代码佐证]` | `[草案]` lock 文件内容 = `{holder: sessionId, pid, acquiredAt, purpose}`；stale 判定除 mtime 外须校验持有者进程存活性（避免活进程长任务被误接管）——接管条件与判定细节 `[草案]` 待 Owner 审查 |
| 超时/重试/接管数值 | `{times:5, delayMs:400}`、`STALE_MS 30000` 为现状常量 `[代码佐证]` | **沿用现状常量** `{times:5, delayMs:400}` 与 `STALE_MS 30000` `[Owner 决断 OQ-R4-3=A，2026-09-14]`。理由：常量沿用 + GWT-R4-04 新 fixture 在 fail-closed 语义下首次验证，不达标走 change record。 |
| 耗尽错误码 | 现状无错误码（console.warn 后继续）`[代码佐证]` | 行为已由 GWT-R4-04 固定（fail-closed + 显式安全结果）；错误码 = **`LOCK_ACQUIRE_FAILED`** `[Owner 决断 OQ-R4-3=A，2026-09-14；新码，Owner 命名]`（dev-plan 既有码表外新增的唯一新码） |
| 锁的归属面 | journey 锁只护 journey.json | `[草案]` state.json 写入（含 transition）必须有自己的锁协议或复用同一锁原语（单锁原语、按资源路径键控）；不允许"state 无锁直写、journey 有锁"的双轨长期并存——迁移窗口内允许 legacy 路径无锁（现状），strict 路径必须有锁 |

### 2.4 与 R3 receipt per-artifact 存储的共存 `[R3冻结]` + `[草案]`

- receipt 写入已由 `receiptStore` 进程级锁注册表串行化（`store.mjs` receiptStore 层，`[R3冻结]` §7.6：现状机制复用、不新增并发协议）。R4 的 transition 写 state.json **不得**复用 receipt 的锁注册表键空间（不同资源、不同锁），两者互不阻塞、互不共享可变状态 `[草案]`。
- receipt.json 路径（`artifacts/<subtaskId>/receipt.json`）与 state.json（`.tt-state/state.json`）物理分离；session namespace 扩展时 receipt 路径的 namespace 化 = R4 实现任务按 §2.1 布局执行，per-artifact 布局本身不变（`[R3冻结]` §7.6 冻结条款）。

---

## 3. Phase state machine and allowed transitions

### 3.1 现状两套状态面（枚举自代码，词汇不改名）`[代码佐证]`

**A 面：plan 状态机**（`state.mjs:2-3`，7 状态）：

```text
STATE = { idle, planning, executing, frozen, reviewing, done, failed }
```

**B 面：journey 9 节点**（`tt-journey.mjs:9-20`，step 0-8）：

```text
0 资产整合 / 1 文档化(gate: concept-signed) / 2 重执行1 / 3 拆任务(gate: premise-signed)
/ 4 重执行1,2 / 5 规划+契约(gate: contract-frozen) / 6 重执行1,2,3
/ 7 并行派单(gate: gate-a-approved) / 8 批判反哺
GATE_VOCAB = ['concept-signed', 'premise-signed', 'contract-frozen', 'gate-a-approved']（:6）
```

- 两面的关系现状 = 推断：`inferSources`（`tt-journey.mjs:222+`）从 `.tt-state/state.json` 与 `artifacts/*/state-summary.json` 推断 journey 进度（注释："推断用"）`[代码佐证]`。
- **已决权威划分** `[Owner 决断 OQ-R4-1=A，2026-09-14]`：**A 面（plan 7 态）为执行权威**、**B 面（journey 9 step + 4 闸）为里程碑 gate 权威**。grounding = R4 task doc Boundary 原文 "Journey is not the authority; the runtime state and receipts are" `[计划输入 R4 task doc §Boundary]`（见 §0.1 前提 1）；即 journey 为只读投影面，授权面 = runtime state + receipt + gate。B 面向 A 面的约束关系（哪些 step gate 阻断哪些 plan transition）按 §4.2 最小映射约束执行。（单一 transition 入口要求另见 §3.3 引用 PRD0 §7。）

### 3.2 转换矩阵（A 面，现状矩阵逐字 + 负向收口）`[代码佐证 state.mjs:3]` + `[草案]`

```text
idle      → planning | failed
planning  → executing | failed
executing → frozen | reviewing | failed
frozen    → executing | reviewing | failed
reviewing → done | executing | failed
done      → ∅（终态）
failed    → ∅（终态）
```

- 矩阵本体为现状代码原样（`state.mjs:3` `TRANSITIONS`），本契约不增删状态名、不改转换边 `[草案约束：状态集与矩阵的任何变更须 Owner 决断后走变更控制]`。
- **终态不可追加**（handoff §3）：`done`/`failed` 的合法后继为空；任何对终态 plan/subtask 的状态再写入 ⇒ `INVALID_TRANSITION`（`[计划输入 dev-plan:305]` 原码）。回退/重开只能通过**新链**（新 stateVersion 记录 + 回滚快照，§8.4），不得原地改写终态记录 `[草案， 对齐 R3 N2"新链由新 sourceHash 开启"的同一纪律]`。
- 负向转换（任一非终态 → `failed`）全部合法且**必须**保留（现状矩阵已含）；strict 模式下负向转换与正向一样必须过单一入口并留 receipt/审计记录，禁止旁路直写。

### 3.3 单一入口规则 `[计划输入 PRD0 §7]` + `[草案]`

- 现状缺陷（C5 修复主体）`[代码佐证]`：`runtime.mjs` 直写 `subtask.status`（`:68/:73-75/:151/:156/:173/:185/:194/:202-204`）与 `plan.status`（`:100-114`），**不经过** `state.mjs` 的 `canTransition/assertTransition`（`:7-8`）；`gate.before` 异常被吞（`:38`）、`gate.after` 在 warn 模式吞 `ContractViolationError`（`:78-81`）；`gate.mjs:43-47` `before()` 恒 `pass:true`（无前置校验）。C5 复现证实 malformed contract 下该路径以 `done` 收口 `[C5复现]`。
- 本契约要求：**所有** plan/subtask 状态写入（正向、负向、skip、degraded）必须经过同一 transition/eligibility 函数（PRD0 §7 Phase Authority 行原文）；该函数内部执行 §3.2 矩阵断言 + §4 前置谓词 + §5 override 检查，任一失败 ⇒ `PHASE_PREREQ_UNMET` / `INVALID_TRANSITION` / `OWNER_APPROVAL_REQUIRED` / `OVERRIDE_NOT_ALLOWED`（按因），fail-closed。
- gate 异常不再吞（dev-plan R4 GWT 3 原文："Given `gate.before` 或 `gate.after` 抛异常；When runtime 收尾；Then blocking gate 不被吞掉" `[计划输入]`）；降级只允许 `YY_GATE_MODE=legacy-warn` 窗口内（PRD0 §9.2：安全/破坏性 gate 不得被 legacy-warn 削弱——本契约的 prereq/override/transition gate 全部属于不得削弱集合）。

### 3.4 与 R3 receipt lifecycle 的衔接点 `[R3冻结]` + `[草案]`

R3 receipt 生命周期：`discovered → eligible → selected → instructions_delivered → execution_observed → behavior_verified`（终态）+ 负向收口 `SELECTED_NOT_CONSUMED`/`FAILED`/`UNRESOLVED`。衔接约束：

| 衔接点 | 规则 | 依据 |
|---|---|---|
| gate 输入合法性 | phase gate 的 receipt 证据 = C-R3 receipt 事件链（重放推导，§7.6 回放规则），**不是** telemetry | `[R3冻结]` §7.6/§7.8 + OQ-R3-7 |
| 裸布尔隔离 | pre-R3 `assetConsumed=true` 可读、可对账，但**永不**满足任何 phase 前置（本契约 §4.3 fail-closed 重申） | `[R3冻结]` §7.8/§8.3（Owner 决断 7） |
| 衔接点 1：`reviewing → done` | `[草案]` 该转换的前置含：plan 内全部被派单 subtask 的资产 receipt 处于终态（`behavior_verified` 或显式负向/未决），且不存在未收口的 `UNRESOLVED` 被静默计为通过 | dev-plan R3 GWT 5（"缺证据为 not_verified/blocked，不是 PASS"）+ GWT-R4-01 |
| 衔接点 2：`planning → executing` | `[草案]` 前置含：plan 的 `requireExec` preconditions（现状 `DEP_PRECONDITION` 机制，`runtime.mjs:165-180`）全部满足，且上游 subtask 的消费证据按 §4.2 映射到达要求类别 | `[代码佐证 runtime.mjs:165-180]` + dev-plan R4 GWT 1 |
| 衔接点 3：override 转换 | 带 override receipt 的转换仍须记录触达的 receipt 终态快照进审计字段（§5.3），但不改变 receipt 本身 | `[草案]` |
| 更强验证 | R4 可在 P1-P5 地板之上定义更强验证（如产物-方法论结构对应性），**更强行为验证标准保留 `[待补充]`，由 R4 实现阶段定义** `[Owner 决断 OQ-R4-5=A 残余项，归属 R4 实现阶段；R4 不得弱化 P1-P5 地板]` | `[R3冻结]` §7.4 |

---

## 4. Prerequisite predicates and evidence receipt requirements

### 4.1 `phase.check` 的前置类别（谓词输入面）`[计划输入]` + `[草案]`

| 前置类别 | 判定来源 | 缺失/不满足 ⇒ |
|---|---|---|
| journey gate（Owner 闸） | `GATE_VOCAB` 四闸在目标 step 上的置位记录（B 面） | `PHASE_PREREQ_UNMET` |
| contract frozen | subtask/plan 契约文件存在且冻结（现状 `CONTRACT_NOT_FROZEN` 机制，`runtime.mjs:105-108/:155-160/:182-191`） | `CONTRACT_NOT_FROZEN`（`[计划输入 dev-plan:304]` 原码；与 runtime 现状同码同语义） |
| receipt 证据 | C-R3 receipt 终态按 §4.2 映射到达要求类别 | `PHASE_PREREQ_UNMET` |
| session 合法 | §2.1 校验 | `SESSION_INVALID` |
| lock 可得 | §2.3（写操作才需要） | `LOCK_ACQUIRE_FAILED` `[Owner 决断 OQ-R4-3=A]` |

### 4.2 每 step/phase 前置映射（最小提案；Owner 已审并冻结 OQ-R4-5=A，2026-09-14）`[草案]`

| 目标（B 面为主） | 必要前置 | grounding |
|---|---|---|
| step 1/3/5/7（有 gate 节点） | 对应 `GATE_VOCAB` 闸已置位（`tt-journey.mjs:9-20` 现状映射） | `[代码佐证]` |
| step 5（规划+契约） | 契约冻结检查（`CONTRACT_NOT_FROZEN` 通道）；plan 的 `_contractMissing` 为假 | `[代码佐证 runtime.mjs:105-108]` + 现状 prereqCheck |
| step 7（并行派单） | `gate-a-approved` + 待派 subtask 的 eligibility（R2 `matrix.mjs`/`planner.mjs` 现有机制投影，不重定义） | `[计划输入]` + `[代码佐证]` |
| step 8（批判反哺）/ plan `reviewing → done` | §3.4 衔接点 1（receipt 终态全覆盖） | `[草案]` |
| A 面 `planning → executing` | §3.4 衔接点 2（DEP_PRECONDITION 全满足） | `[草案]` |

- 映射表已由 Owner 逐行审查并原样冻结 `[Owner 决断 OQ-R4-5=A，2026-09-14]`；未列出的转换 = 仅矩阵合法性 + session + lock 前置（不额外加 receipt 要求）。**更强行为验证标准（P1-P5 地板之上）保留 `[待补充]`，由 R4 实现阶段定义**（OQ-R4-5 残余项，见 §3.4 末行）。
- **fail-closed 默认**（handoff §4）：前置谓词的证据**缺失 = 不通过**；"无法判定"与"不满足"同归 `PHASE_PREREQ_UNMET`，不得默认放行。此为 GWT-R4-01 的判定语义。

### 4.3 证据要求与 fail-closed 重申 `[R3冻结]` + `[计划输入]`

1. receipt 类证据的校验 = 事件数组重放推导 + `result` 缓存一致性（重放不一致 ⇒ `RECEIPT_INVALID`，`[R3冻结]` §7.6——R4 gate 消费同一校验，不得另立宽松读法）。
2. telemetry（裸布尔/锚点回显/内核词回显）对前置谓词**视而不见**（`[R3冻结]` §7.8 分离规则）；gate 输入集 = receipt 事件链判定，仅此一路。
3. `--force` 不改变本节任何谓词的判定结果；它只触发 §5 的 override 通道。

---

## 5. Override policy, owner approval, and audit fields

### 5.1 Override ≠ 正常流 `[计划输入]`

- R4 doc Boundary 原文："accepting an override as normal flow" 是 non-goal `[计划输入]`。override 是显式、逐例、可审计的例外通道；同一点位反复 override = 流程缺陷信号，进入 R8 批判通道（不在本契约范围）。
- 现状对照 `[代码佐证]`：`tt-journey.mjs:120-152` 已有 `--force` 越过 prereq：`PrereqError`（exit 3，journey 不落盘）→ `--force` 时 stderr WARN + `journey.plans[]` 追加 `{planId:'__manual__', status:'prereq-bypassed', updatedAt, reason}` 留痕。**该留痕不是 override receipt**：无 Owner 授权字段、无批准引用、且写在投影面（journey）——strict 模式下不构成 §5.2 意义上的批准。legacy 模式原样保留（additive）。

### 5.2 Owner approval receipt schema `[草案， handoff §5]`

```text
ownerApprovalReceipt = {
  approvalId: string,              // 唯一；格式 = apr-<YYYYMMDDTHHMMSSZ>-<8位随机>（时间戳紧凑形去冒号）[Owner 决断 OQ-R4-6=A]
  targetType: 'phase_transition',  // 本契约内唯一合法值
  target: { from: string, to: string, scope: 'plan'|'step', scopeId: string },
  reason: string,                  // Owner 给出的理由（必填，禁止空）
  approvedBy: 'owner',             // 固定字面；非 owner 身份 ⇒ 该 receipt 无效
  approvedAt: string(ISO 8601),
  approvalEvidence: string,        // = Owner 指令文件路径 + 该文件 SHA256；对话记录引用为辅 [Owner 决断 OQ-R4-6=A]
  expiresAt: null,                 // = null；批准绑定特定 from/to/scope，不跨作用域/跨转换复用 [Owner 决断 OQ-R4-6=A]
  relatedReceipts: receiptRef[],   // 触达的 R3 receipt 终态快照引用（§3.4 衔接点 3）
}
```

- schema 字段集为 `[草案]` 提案，Owner 场景审查后冻结；`approvalId`/`approvalEvidence`/`expiresAt` 形态已由 OQ-R4-6=A 落笔。
- **批准先于执行**：`approvedAt` 晚于引用它的 transition 时点的 receipt 无效（不可抵赖性要求，§5.4）。
- **rollback 失效条款** `[Owner 决断 OQ-R4-6=A，2026-09-14]`：rollback 前签发的 approval 对 rollback 后的 transition 一律失效（即 approval 绑定签发时点的 state 快照基线，回滚后须重新签发）。

### 5.3 `--force` 不得绕过未批准的 override `[计划输入 GWT-R4-01/02]` + `[草案]`

| 场景 | strict 模式行为 | 依据 |
|---|---|---|
| 无未决转换、正常前置满足 | `--force` 无效果（不产生任何 bypass 记录） | `[草案]` |
| 前置未满足 + **无**已批准 override receipt | 拒绝：`OWNER_APPROVAL_REQUIRED`；状态不变；输出缺失批准的诊断（GWT-R4-02："reports the missing approval rather than silently advancing"） | `[计划输入]` |
| 前置未满足 + **有**已批准 override receipt | 执行转换 + 写 override 执行记录（§5.4）；**目标状态不得被伪装为"前置自然满足"**（GWT-R4-01："cannot create a completed state without an explicit approved override receipt"——有批准 receipt 时允许转换，但转换记录必须带 `override: true` 标注，下游可辨识） | `[计划输入]` + `[草案]` |
| override receipt 无效（非 owner / 字段缺失 / 批准时点倒挂 / 过期） | `OVERRIDE_NOT_ALLOWED`（`[计划输入 dev-plan:305]` 原码），fail-closed | `[计划输入]` |
| `PHASE_PREREQ_UNMET` + `--force` 试图直改终态 | 拒绝：终态不可追加（§3.2）+ 无批准 ⇒ `INVALID_TRANSITION`/`OVERRIDE_NOT_ALLOWED` 按因 | `[计划输入]` |

### 5.4 审计字段与不可抵赖 `[草案]`

- **override 执行记录**（区别于批准 receipt）：`{executionId, approvalId（引用）, executedAt, sessionId, fromState, toState, prereqUnmet: [逐项], toolTrace}`——追加式、不可改写；存储于**运行时证据层**（receipt/store 侧），**不得**只写 journey 投影（§0.1 前提 1）。**存储路径 = `.tt-state/overrides/`（namespaced 模式下 `.tt-state/<sessionId>/overrides/`），追加式，禁 `vendor/`** `[Owner 决断 OQ-R4-9=A，2026-09-14]`。
- **不可抵赖要求**：(a) 批准 receipt 与执行记录双向引用（approvalId ↔ executionId）；(b) 批准时点先于执行时点且两者进入同一哈希对账（无实测哈希方案前 `[待补充]`，归属 R4 实现阶段）；(c) 任何 override 执行在 plan/journey 输出中可见（非静默）。
- **禁止静默推进**（handoff §5）：strict 模式下任何状态推进（含 override 通道）必须有对应写入记录与可读输出；"无记录的 done" 即 defect（GWT-R4-01/02 的 defect 条件，见清单 R4-01/R4-02/R4-07 行）。

---

## 6. `phase.check` / `phase.transition` schemas

Response shell 沿用 dev-plan 全表统一壳（C-R2 §6.1 / C-R3 §2 同构）`[计划输入]`：

```json
{ "ok": true, "code": null, "data": { }, "evidence": { }, "warnings": [ ] }
```

### 6.1 `phase.check` `[计划输入 dev-plan:304]` + `[草案]`

| 项 | 定义 |
|---|---|
| 语义 | 对目标 phase/step 计算前置谓词（§4），返回允许性与缺失清单。**只读**：不写任何状态、journey、receipt（lock 不需要）。 |
| 输入 | `journey`（journey 引用或快照）、`target step`（B 面 step 号或 A 面 from/to 对——两面兼容按 §4.2 最小映射约束执行 `[Owner 决断 OQ-R4-1=A]`）、`session`（可选；缺省 = legacy 通道；strict 模式下缺省自动生成 UUIDv4，见 §2.1） |
| 输出 | shell `data: {allowed, reason, missing}`（`[计划输入 dev-plan:304]` 原形）；`missing` = 未满足前置逐项列表（含类别与判定依据）；`evidence` 含 `{snapshot, stateVersionEcho, sessionEcho, checkedAt}` `[草案]` |
| 错误码 | `PHASE_PREREQ_UNMET`（allowed=false 的机器可查码）、`CONTRACT_NOT_FROZEN`、`SESSION_INVALID`（三码均 `[计划输入 dev-plan:304]` 原码）；`STATE_VERSION_UNSUPPORTED`（读到不认识的高版本 state，`[Owner 决断 OQ-R4-2=A]` 新码） |
| fail-closed | 前置证据缺失 ⇒ allowed=false + `PHASE_PREREQ_UNMET`（不区分"缺失"与"不满足"，§4.2）；输入形状非法 ⇒ `SESSION_INVALID`/输入校验通道，**禁止**对非法输入返回 allowed=true |
| 幂等 | 相同输入 + 相同 state/journey/receipt 状态 ⇒ 相同输出（`checkedAt` 豁免进 evidence）`[草案]` |

### 6.2 `phase.transition` `[计划输入 dev-plan:305]` + `[草案]`

| 项 | 定义 |
|---|---|
| 语义 | 执行一次状态转换：矩阵断言（§3.2）→ 前置谓词（§4）→ override 判定（§5）→ 写入（单一入口，§3.3）。全部通过才落盘。 |
| 输入 | `from/to`、`owner receipt`（§5.2 形状的 ownerApprovalReceipt；仅 override 通道需要）、`evidence refs`（前置证据引用） |
| 输出 | shell `data: transition`（`[计划输入 dev-plan:305]` 原形）——`[草案]` 细化：`{from, to, at, sessionId, override: null \| executionId, stateVersionWritten}` |
| 错误码 | `INVALID_TRANSITION`（矩阵外/终态追加/from 不符）、`OWNER_APPROVAL_REQUIRED`（需批准而无批准）、`OVERRIDE_NOT_ALLOWED`（批准 receipt 无效）——三码均 `[计划输入 dev-plan:305]` 原码；`PHASE_PREREQ_UNMET`（前置不满足时先于 override 判定返回，GWT-R4-01 措辞）；锁失败码 = `LOCK_ACQUIRE_FAILED` `[Owner 决断 OQ-R4-3=A 新码]`；高版本 state 读失败 = `STATE_VERSION_UNSUPPORTED` `[Owner 决断 OQ-R4-2=A 新码]` |
| 幂等 | 相同 `from/to` + 已在 `to` 态 ⇒ 幂等返回既有终态（no-op，不写重复记录）；不同 from 的重复调用 ⇒ `INVALID_TRANSITION` `[草案]` |
| 原子性 | 状态写入 + 审计记录（§5.4）在同一临界区完成（锁内），不允许"状态已变、记录缺失"的中间态（OBS-01 教训：写失败必须显式失败，不得静默）`[草案]` |

### 6.3 CI fail-closed 行为（两操作的 CI 面）`[计划输入]`

- 任何 `phase.*` 操作以 `ok:false` 收口时，调用它的 CI/脚本路径必须 exit non-zero；**不得**打印"成功""PASS""done"类字样（GWT-R4-05 的操作面投影；`[草案]` 具体字面约束见 §7.3）。
- `PHASE_PREREQ_UNMET` 是**正常决策结果**；**通道分叉已决** `[Owner 决断 OQ-R4-7=A，2026-09-14]`：`phase.check` 走 **data 通道**（查询语义，`data.allowed=false`）；`phase.transition` 走 **error 通道**（阻断语义，exit non-zero）。

---

## 7. CI truthfulness

### 7.1 现状锚点（只描述，不声称修复）`[代码佐证]` + `[计划输入]`

- C7（REPRODUCED，G2.2 图 §1）：`scripts/ci.mjs` 整体 exit 0，但 `asset-call-rate` 段 exit 1 仅作 `[INFO]` 输出，末尾仍无条件打印 `CI PASS`——`ci.mjs:95-99`（`[INFO] 资产质量评分（exit …）——exit 1 = 有需审查资产（信息，不阻断 CI）` + `console.log('\nCI PASS')` + `process.exit(0)`）；`ci.mjs:107` 缺省 `process.exitCode = 1` 被 `:100` 显式覆盖 `[代码佐证]`。
- OBS-01（PRD0 §3.2/§11）`[代码佐证]`：`tt-journey.mjs:3` 导入 `node:fs/promises`，`:156-165` 却调用 `readdirSync/readFileSync/writeFileSync`（promises 命名空间上不存在）→ TypeError 被 `catch` 吞掉 → standalone `tt-journey --update` 的 `stageVerification` 静默缺失（PRD0 探针实测 `stageVerification-present=false`）；orchestrator 路径 `syncJourney`（`orchestrator.mjs:175-215`）用真正的异步 API，写入正常——两路径现状不一致。

### 7.2 分类与退出码映射 `[计划输入 GWT-R4-L1 + PRD0 §11；边界已决 OQ-R4-8=A]`

| 检查结果 | 分类 | CI 行为 | 判定来源 |
|---|---|---|---|
| `CONTRACT_NOT_FROZEN`、R3 receipt 校验失败、GWT-R4-01…04 行为检查失败 | `BLOCKING_FAIL` | CI exit non-zero；不打印成功状态 | `[Owner 决断 OQ-R4-8=A，2026-09-14]` |
| 资产质量段 exit 1 | `QUALITY_WARN` | CI 可 exit 0；输出必须携带该分类与失败段明细（PRD0 §11"summary 必须同时列出 exit code、失败段、是否阻断和 artifact 路径"）；信息不阻断 | `[Owner 决断 OQ-R4-8=A，2026-09-14]`；依据 = `test-reports/R2-catalog-router-20260912/R2-completion-report.md`（asset-quality exit 1 = informational / non-blocking 结论） |
| 其余未分类段 exit 1 | `QUALITY_FAIL` | 带明细、不阻断，直至 Owner 另定 | `[Owner 决断 OQ-R4-8=A，2026-09-14]` |

- 三类判定边界已由 Owner 裁决 `[OQ-R4-8=A，2026-09-14]`：阻断类 = `CONTRACT_NOT_FROZEN` / R3 receipt 校验 / GWT-R4-01…04 行为检查；资产质量段 exit 1 = `QUALITY_WARN`（信息不阻断，依据 R2 验收 20260912 结论）；其余未分类段 = `QUALITY_FAIL`（带明细、不阻断，直至 Owner 另定）。PRD0 §11 固定"必须被分类"与"blocking 后不得无条件 PASS"不变。
- OBS-01 验收 `[计划输入 PRD0 §11]`：standalone 与 orchestrator 两路径分别测试；`stageVerification` 真实出现（fs API 修复后）或写入失败产生非零结果/显式 warning receipt——不得静默吞掉。

### 7.3 字面约束（机器可查）`[草案， handoff §7]`

1. CI 输出中成功字面（`CI PASS` 等）**只允许**在"全部 mandatory 段 exit 0"时打印；任何 blocking 失败后出现成功字面 = defect（GWT-R4-05 defect 条件）。
2. CI summary 必含字段：每段 exit code、失败段名、是否阻断（blocking 与否）、artifact 路径（PRD0 §11 原文）。
3. exit code 传播：子段 exit 1 且分类为阻断 ⇒ CI 进程 exit non-zero（`ci.mjs:100` 现状的显式 `process.exit(0)` 覆盖必须被修复路径取代——修复方式属实现任务，本契约固定行为）。
4. fixture-only 通过不能替代真实资产消费验证（PRD0 §11 原文）。

### 7.4 与 R2/R3 检查矩阵的集成点 `[计划输入]` + `[草案]`

- CI 段序沿用现状 S1-S5 结构（`ci.mjs:61-68`），新增的分类层作用于 S5 资产质量段与未来的 contract check 段 `[草案]`；R2 catalog 检查、R3 receipt 校验（`c6SevenCaseGate` 等）作为 mandatory 段纳入同一分类矩阵 `[草案]`（具体段清单 = 实现任务按 §7.2 执行，Owner 审查 CI summary 样例）。
- 集成不改变 R2/R3 冻结契约的任何错误码语义（`CONTRACT_NOT_FROZEN` 沿用 runtime 现状同码）。

---

## 8. Migration and rollback

### 8.1 Feature flags `[计划输入 PRD0 §9.2]` + `[草案]`

R4 相关 flag（PRD0 五 flag 清单原文）：

```text
YY_GATE_MODE=legacy-warn|strict
YY_SESSION_MODE=legacy|namespaced
YY_RECEIPT_MODE=legacy|dual|strict   （R3 已冻结载体，本契约只消费不重定义）
```

- **命名分歧记录（discrepancy）**：PRD0 §9.2 的规范名是 `YY_GATE_MODE`，但现状代码读取的是 `TT_GATE_MODE`（`gate.mjs:37`、`runtime.mjs:79`）`[代码佐证]`。修复实现必须统一到 `YY_GATE_MODE`（PRD0 为规范源）；**MW0 双读（`YY_GATE_MODE` 优先、`TT_GATE_MODE` 兼容回退），MW1 起 `TT_` 停用** `[Owner 决断 OQ-R4-7=A，2026-09-14]`。
- `legacy-warn` 不得削弱安全/破坏性 gate（PRD0 §9.2 通则）；本契约的 prereq/override/transition/锁 gate 属**不得削弱集合**——`legacy-warn` 只豁免兼容性诊断，不豁免 GWT-R4-01…04 的任何行为 `[草案， 对齐 PRD0 原文语义]`。
- flag 值非法 ⇒ fail-closed（对齐 C-R3 §8.1 `ACTIVATION_MODE_UNSUPPORTED` 的禁 silent fallback 纪律）`[草案]`。

### 8.2 MW0-MW4 映射 `[计划输入 PRD0 §9.1]` + `[草案]`

| 窗口 | R4 语义 |
|---|---|
| MW0 | 双读：state.json 有无 `stateVersion` 均可读；journey namespaced 与 legacy 路径均可读；`YY_GATE_MODE`（优先）/ `TT_GATE_MODE`（兼容回退）双读均可 `[OQ-R4-7=A]`。不自动改写旧文件。 |
| MW1 | 新路径单写：transition 单一入口生效；session namespace 写入生效；旧直写路径停用；`TT_GATE_MODE` 停用（仅 `YY_GATE_MODE` 生效）`[OQ-R4-7=A]`。 |
| MW2 | 双报告：legacy warn 留痕（journey `prereq-bypassed`）与 override 执行记录并存对账（对账文件惯例沿 C-R2 清单 C2r）。 |
| MW3 | Owner 确认后启用 strict blocking gate：GWT-R4-01…05 全量生效；`legacy-warn` 退出生产路径。 |
| MW4 | 另立变更单清理旧字段/旧路径（不在本契约执行）；**清理前须先对账全部自动生成 session（§2.1）的元数据与审计引用，确认无悬空引用后方可清理** `[OQ-R4-4(b)=B]`（沿 §8.3 无备份不迁移纪律）。 |

### 8.3 禁止原地改写旧 state；无备份不迁移 `[计划输入 PRD0 §9.3]`

- "state、journey、contract、receipt 写入前保留快照"（PRD0 §9.3.2 原文）——迁移（stateVersion 升级、namespace 重排）前必须先落快照；**无备份不迁移**（handoff §8 原文）。
- 迁移只做增量字段和双读，不删除旧字段（PRD0 §9.3.3）。
- 回滚不能把已发生的真实执行改写为成功，也不能删除审计 receipt（PRD0 §9.3.6）。

### 8.4 Rollback 步骤 `[计划输入 PRD0 §9.3.4-5]` + `[草案]`

1. 切 flag 回 `legacy`/`dual`（运行时兼容回归时的第一动作，PRD0 §9.3.4）；
2. 从 §8.3 快照恢复 state/journey（恢复目标 = 迁移前最后一个快照）；
3. 保留失败/回滚 receipt 与 override 执行记录（审计链不断）；
4. 记录：flag、commit、受影响 session、快照路径、恢复验证结果（PRD0 §9.3.5 五要素）；
5. strict 重启前重跑 GWT-R4-01…04 回归（清单 R4-06 行的 rollback 验证列）。

---

## 9. Owner decisions absorbed（2026-09-14，v2 修订版）

> OQ-R4-1…9 已于 2026-09-14 由 Owner 全部裁决（DECIDED），正文已逐字吸收（见各节 `[Owner 决断 OQ-R4-x=…]` 标注）。**残余 `[待补充]` 仅两项**：(1) 更强行为验证标准（P1-P5 地板之上）——归属 R4 实现阶段；(2) approval↔execution 哈希对账方案——归属 R4 实现阶段。其余数值均已落笔。

| OQ | 决断点 | 落点 | Owner 决断（2026-09-14，v2） |
|---|---|---|---|
| OQ-R4-1 | A/B 两状态面的授权关系与映射（§3.1） | §3.1、§6.1 | =A：A 面（plan 7 态）执行权威、B 面（journey 9 step + 4 闸）里程碑 gate 权威；grounding 引 R4 task doc Boundary 原文，B→A 按 §4.2 最小映射约束 |
| OQ-R4-2 | `stateVersion` 初始值与高版本 fail-closed 读法 | §2.2、§6.1/§6.2 | =A：初始值=1；缺字段=legacy v0 双读（MW0 合法）；高版本 fail-closed 走独立新码 `STATE_VERSION_UNSUPPORTED`（不复用 SESSION_INVALID） |
| OQ-R4-3 | 锁常量沿用或另测；锁耗尽错误码命名 | §2.3、§4.1、§6.2 | =A：沿用 `{times:5, delayMs:400}`、`STALE_MS 30000`；新码 `LOCK_ACQUIRE_FAILED`；理由=常量沿用+GWT-R4-04 新 fixture 首次验证，不达标走 change record |
| OQ-R4-4 | 缺省 session 策略与可追溯字段 | §2.1、§8.2(MW4) | =B：strict 缺省 UUIDv4 自动生成；元数据含生成时间/生成方/算法版本（与 receipt session 同源）；MW4 清理前先对账无悬空引用 |
| OQ-R4-5 | 前置→receipt 类别映射；更强行为验证标准 | §3.4、§4.2 | =A：§4.2 最小映射表原样冻结；更强验证标准留 `[待补充]` 归 R4 实现阶段 |
| OQ-R4-6 | approvalEvidence 形态、approvalId 规则、expiry、rollback 失效 | §5.2、§5.4 | =A：approvalEvidence=指令文件路径+SHA256（对话引用为辅）；approvalId=`apr-<YYYYMMDDTHHMMSSZ>-<8位随机>`；expiresAt=null（绑定 from/to/scope）；rollback 前 approval 对 rollback 后 transition 一律失效 |
| OQ-R4-7 | YY_/TT_ 双读窗口；`PHASE_PREREQ_UNMET` 通道分叉 | §6.3、§8.1、§8.2 | =A：MW0 双读（YY_ 优先/TT_ 回退）、MW1 起 TT_ 停用；check=data 通道、transition=error 通道（exit non-zero） |
| OQ-R4-8 | CI 分类边界（BLOCKING_FAIL/QUALITY_WARN/QUALITY_FAIL） | §7.2 | =A：CONTRACT_NOT_FROZEN/R3 receipt 校验/GWT-R4-01…04 行为=BLOCKING_FAIL；资产质量 exit 1=QUALITY_WARN（依据 R2 验收 20260912 non-blocking 结论）；其余未分类=QUALITY_FAIL 带明细不阻断 |
| OQ-R4-9 | override 执行记录存储路径与 namespace | §5.4 | =A：`.tt-state/overrides/`（namespaced 下 `.tt-state/<sessionId>/overrides/`），追加式，禁 `vendor/` |

---

## 10. OQ-R4-x index

| 编号 | 落点（章节） | 状态 |
|---|---|---|
| OQ-R4-1 | §3.1、§6.1 | **DECIDED**（2026-09-14，Owner=A；v2：grounding 引 R4 task doc Boundary） |
| OQ-R4-2 | §2.2、§6.1/§6.2 | **DECIDED**（2026-09-14，Owner=A；v2：初始值=1，高版本新码 STATE_VERSION_UNSUPPORTED） |
| OQ-R4-3 | §2.3、§4.1、§6.2 | **DECIDED**（2026-09-14，Owner=A；v2：常量沿用 + 理由；新码 LOCK_ACQUIRE_FAILED） |
| OQ-R4-4 | §2.1、§8.2(MW4) | **DECIDED**（2026-09-14，Owner=B；v2：UUIDv4 + 元数据三字段 + MW4 对账注记） |
| OQ-R4-5 | §3.4、§4.2 | **DECIDED**（2026-09-14，Owner=A；映射表冻结；更强验证标准 `[待补充]` 归 R4 实现） |
| OQ-R4-6 | §5.2、§5.4 | **DECIDED**（2026-09-14，Owner=A；v2：approvalId 紧凑形、rollback 失效条款） |
| OQ-R4-7 | §6.3、§8.1、§8.2 | **DECIDED**（2026-09-14，Owner=A；MW0 双读/MW1 停 TT_、通道分叉已决） |
| OQ-R4-8 | §7.2 | **DECIDED**（2026-09-14，Owner=A；v2：QUALITY_WARN 依据 R2 验收 20260912） |
| OQ-R4-9 | §5.4 | **DECIDED**（2026-09-14，Owner=A；.tt-state/overrides/ 追加式） |

> 本草案阶段（drafts/）的修订按 C-R3 §9.6 惯例：每次修订重算并登记文件 sha256；draft 永远不解锁任务。
