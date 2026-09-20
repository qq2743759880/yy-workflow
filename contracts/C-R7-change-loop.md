# C-R7-change-loop — Requirements Change Loop and PRD Re-entry Contract

> 文档状态：`C-R7=FROZEN`（冻结契约，2026-09-15）。规范性版本；冻结源见 `contracts/drafts/C-R7-change-loop.draft.md`。本契约不解锁任何任务，G2.2 图 §8：contract drafts never unlock tasks。
>
> 契约登记名：`C-R7-change-loop`（G2.2 图 §3 R7 行与 §8 冻结序列为准）。本文件与配套清单 `contracts/C-R7-change-loop-review-checklist.md` 是该契约的冻结载体（OQ-R7-1…7 已由 Owner 冻结授权 2026-09-15 裁决为 A 并吸收进正文）。
>
> 操作名：仅 `change.record` 一个（`[计划输入 dev-plan:308]`）。不新增操作名。
>
> 快照：`240f3fbdb4ee757dffc4d5ab80407d1b2c84863c`。全部 grounding sources 的 sha256 已在撰写前重算并逐一匹配（见 §0 表）。
>
> 证据标签沿用 C-R4 惯例：`[计划输入]` = PRD0/dev-plan/G2.2 图/R7 task doc 条目；`[草案]` = 本文件新提出、需 Owner 场景审查确认的内容；`[待补充]` = 无实测值或 Owner 未裁决，禁止编造；`[R4冻结]` = `contracts/C-R4-control.md`（FROZEN，hash 见 §0）；`[Owner 决断 OQ-…=A，2026-09-15]` = Owner 冻结授权 2026-09-15 已裁决项（逐字吸收进正文）。

## 0. Grounding sources（read-only，撰写前已逐一 sha256 校验）

| source | sha256 | 口径 | used for |
|---|---|---|---|
| `plans/tasks/G2.2-task-graph-20260911.md` | `d48f1fba8f6e1e41d500baec53c7576be03dc4ce3a4afd1bed590b9bf5857a98` | tree | R7 节点规格（§3 R7：purpose、non-goals、prerequisites、downstream、contract 名、compatibility/rollback）、冻结顺序（§8）、READY 公式 R7 行（§4）、edge `R4→R7`（§2 行 8） |
| `plans/tasks/PRD0-contract-revision-v3.md` | `a7cbc5df7383287f55194b721ac61b590d17872b59bdf3c2ee13978f7cdc90fd` | tree | READY 公式 R7 行（§5.5）、需求变更闭环能力定义（§6.2）、文件映射 Change Control 行（§7）、迁移/回滚纪律（§9.3）、MW0-MW4（§9.1） |
| `docs/tasks/yy-skill-loading-v3/R7-requirements-change-loop.md` | `db0c2d1e3227b3f3e0df9ccdd0cdb35d43659d7091c76a8872e4970ccd630272` | tree | Boundary/non-goals、Exact files、Dependencies、Freeze order 5 步、GWT-R7-01…05、Selection basis、Evidence and rollback |
| `contracts/C-R4-control.md` | `19055ff7a5c881ef4daab4d323e8710467ae5f0ffd2a4db2d1ba21c34cb1a666` | tree（FROZEN） | canonical state/transition 语义（§3）、终态不可追加（§3.2）、override receipt schema（§5.2）、override 执行记录（§5.4）、无备份不迁移（§8.3）、rollback 步骤（§8.4） |
| `docs/yy-dev-plan-skill-loading-v3.md` | `d2e8e5b45466ca23c81420dd6b18a9384b648e7c23cb4dbcaba13a0b8168a8db` | tree | 操作表 `:308`（`change.record` 输入列/base plan+version+reason+impact class+owner、输出壳 `{ok,code,data:changeRecord,evidence,warnings}`、错误码 `CHANGE_RECORD_INVALID`/`CHANGE_SCOPE_UNCLEAR`/`CHANGE_OWNER_REQUIRED`、review column"只失效受影响节点还是错误地全量回退"）、R7 GWT 1-5（`:234-240`）、R7 契约冻结顺序（`:231`） |

> 口径说明：本表五个文件为派单指定的全部冻结输入，撰写前已逐一重算 SHA256 并与派单值逐字节匹配（见完成报告 §1）。C-R4 为已冻结契约，本草案只读消费其语义，不修改。

## 0.1 设计前提（handoff 指定）

1. **`change.record` 是"失效传播"机制，不是全量回退**：dev-plan review column 原文——"只失效受影响节点还是错误地全量回退" `[计划输入 dev-plan:308]`。本契约的核心判定规则是：一次变更记录必须**精确计算并列出受影响节点清单**，仅使这些节点及其下游依赖退出 READY；**禁止错误地全量回退**（R7 doc Boundary non-goal 原文："globally resetting every task"）。这是 `change.record` 与 R4 `phase.transition` 的本质区别——R4 管单次状态转换的 fail-closed gate，R7 管一次需求变更引发的**传播级联**。
2. **消费 R4 canonical state authority，不重定义**：R7 doc Dependencies 原文——"Contract dependency: R4 canonical state and transition semantics" `[计划输入 R7 doc]`。本契约不重新定义状态机、转换矩阵或 gate 谓词；当 change.record 触发节点状态退出 READY 时，状态写入路径必须经 R4 单一 transition 入口（`[R4冻结]` §3.3）。R7 对 R4 只读消费。
3. **消费 C-R4 §5 override receipt 语义，不重定义**：当某 impact class 需要 Owner 审批时（§3），R7 引用 `[R4冻结]` §5.2 的 `ownerApprovalReceipt` schema（approvalId/target/reason/approvedBy/approvedAt/approvalEvidence/expiresAt/relatedReceipts）和 §5.3 的审批先于执行/rollback 失效条款；**R7 不另立 receipt schema**，也不放宽 C-R4 的任何谓词。
4. **Additive namespace + supersede-not-delete**：R7 doc Exact files 原文——`plans/active/changes/`（additive namespace/index）、`contracts/discrepancies/`（change records）`[计划输入 R7 doc]`。变更记录只追加，旧版本/旧证据只读保留；rollback = 标记 change record 为 superseded 并恢复前一计划版本，**永不删除旧证据**（R7 doc Evidence and rollback 原文）。
5. **无工作流引擎、无数据库**：R7 doc Selection basis 原文——"Reuse the existing documentation back-jump rule, R4 state authority, JSON/file storage, and standard-library hashing. Do not add a workflow engine or database for this MVP." `[计划输入 R7 doc]`。

---

## 1. Scope and non-goals

### 1.1 In scope `[计划输入 R7 doc §Boundary + G2.2 图 §3 R7 行]`

- 把新需求或范围变更转化为可审计的 change record（R7 doc Boundary 原文）。
- 影响分类（impact class）、精确下游失效、回到正确 PRD gate、READY 重算。
- 一个操作契约：`change.record`（§7），完整输入/输出/错误码/response shell。
- Exact files（实现边界，非本草案修改对象）：`reference/documentation.md`、`commands/yy-1-requirements.md`、`commands/yy-2-planning.md`、`commands/yy-3-contract.md`（as applicable）、`plans/active/changes/`（additive namespace/index）、`contracts/discrepancies/`（change records）、canonical state/READY logic from R4 `[计划输入 R7 doc §Exact files]`。
- 下游消费声明：R8/R9/R10 必须读取 change record 的影响范围并使受影响节点重新走对应 gate；R6 必须验证旧版本保留和回滚（R7 doc Dependencies 原文）。

### 1.2 Non-goals `[计划输入 R7 doc §Boundary + G2.2 图 §3 R7 行]`

- 不做旧 PRD 的静默改写（R7 doc non-goal 原文："silently rewriting old PRDs"）。
- 不自动实现新需求（R7 doc non-goal 原文："automatically implementing the new requirement"）。
- 不全量重置每个任务（R7 doc non-goal 原文："globally resetting every task"）。
- 不重新定义 R4 状态机/transition/gate 谓词（`[R4冻结]` 只读消费）。
- 不新增工作流引擎或数据库（R7 doc Selection basis 原文）。
- **路由零改动**：不改变 R2 `router.select` 语义、路由关键词、簇或状态；`route41Rerun.required = false`（草案阶段，handoff 指定）。R7 消费 R2/R3/R4 产物，不回改。
- 不修改 R4 冻结契约的任何条款（`[R4冻结]` 只读消费）。
- 不修改状态表（G2.2 图）、PRD0、任何 finding 状态。
- 不引入向量数据库、远程注册中心、模型微调、新服务端运行时（PRD0 §2.2.5）。

---

## 2. Change-record schema and identity（Freeze order step 1）`[计划输入 dev-plan:308 + R7 doc]`

### 2.1 操作输入列（dev-plan 原文，禁止增删）

`change.record` 的输入面逐字取自 dev-plan 操作表 `:308`：

| 输入列 | 含义 | 必填 | 缺失 ⇒ |
|---|---|---|---|
| `base plan/version` | 变更所基于的计划及其版本（标识"从哪个版本开始变更"） | 是 | `CHANGE_RECORD_INVALID`（GWT-R7-04：missing source ⇒ fail closed） |
| `reason` | 变更原因（Owner 给出的理由，禁止空） | 是 | `CHANGE_RECORD_INVALID`（GWT-R7-04：missing reason ⇒ fail closed） |
| `impact class` | 影响分类（§3 五类之一） | 是 | `CHANGE_RECORD_INVALID`（GWT-R7-04：missing impact ⇒ fail closed）；无法可靠判定 ⇒ `CHANGE_SCOPE_UNCLEAR`（§2.3） |
| `owner` | 变更负责人/审批人标识 | 是 | `CHANGE_OWNER_REQUIRED`（§5）；若 impact class 不需要额外审批而 owner 缺失 ⇒ `CHANGE_RECORD_INVALID` |

### 2.2 changeRecord schema（`[草案]` 提案，Owner 审查后冻结）

```text
changeRecord = {
  changeRecordId: string,          // 唯一；格式 cr-<YYYYMMDDTHHMMSSZ>-<8位随机> [Owner 决断 OQ-R7-3=A，2026-09-15]
  basePlan: string,                // = 输入 base plan/version 的 plan 部分
  baseVersion: string,             // = 输入 base plan/version 的 version 部分
  reason: string,                  // 必填，禁止空 [计划输入]
  impactClass: 'DOC_ONLY'|'TASK_GRAPH'|'CONTRACT'|'IMPLEMENTATION'|'SECURITY',
  owner: string,                   // 必填 [计划输入]
  sourceEvidence: string[],        // 来源证据引用（PRD 行/聊天记录/finding ID）；GWT-R7-04 要求 source 不得缺失
  invalidatedNodes: string[],      // 失效传播计算结果（§3）；提交时可为空数组，由 §3 规则计算后回填
  newVersionRef: string|null,      // 新 PRD/plan 版本引用（仅 IMPLEMENTATION 类必需，GWT-R7-03）
  supersededBy: string|null,      // 回滚时指向取代它的新 changeRecordId（supersede-not-delete）
  status: 'active'|'superseded',  // active = 当前生效；superseded = 被后续变更取代
  recordedAt: string(ISO 8601),
  recordedBy: string,              // 记录方 session/agent 标识
}
```

- `changeRecordId` 格式已裁定 = `cr-<YYYYMMDDTHHMMSSZ>-<8位随机>`（对齐 C-R4 approvalId 紧凑形）[Owner 决断 OQ-R7-3=A，2026-09-15]；`sourceEvidence[]` 必填（GWT-R7-04 要求 source 不得缺失）；`invalidatedNodes` 由 §3 规则在提交时计算后回填（§5.3 原子性）。
- **幂等键** = canonical `sha256({basePlan, baseVersion, reason, impactClass, owner})`，键序固定（`[Owner 决断 OQ-R7-6=A，2026-09-15]`）。相同幂等键的重复提交不得创建重复记录（GWT-R7-05）；重复提交 `ok:true` 返回原 `changeRecordId` + `warnings` 记 `DUPLICATE_REPLAY`（不新增错误码）；同键不同 `sourceEvidence` ⇒ `CHANGE_SCOPE_UNCLEAR`（§2.3）。

### 2.3 `CHANGE_SCOPE_UNCLEAR` 语义

- 当 `impact class` 无法从变更描述可靠判定（例如变更同时触及文档措辞和接口字段，但无法确定主分类），或受影响节点清单无法唯一计算时 ⇒ `CHANGE_SCOPE_UNCLEAR`（`[计划输入 dev-plan:308]` 原码）。
- 幂等键命中但 `sourceEvidence` 不同（§2.2）⇒ `CHANGE_SCOPE_UNCLEAR`：`basePlan+baseVersion+reason+impactClass+owner` 相同说明同一变更已存在，但证据来源不同 ⇒ 范围不能唯一确认，需 Owner 澄清后重提 [Owner 决断 OQ-R7-6=A，2026-09-15]。
- 与 `CHANGE_RECORD_INVALID` 的区别：后者 = 必填字段缺失或形状非法（fail-closed，GWT-R7-04）；前者 = 字段齐全但语义范围不清，需 Owner 澄清后重提。
- 返回 `CHANGE_SCOPE_UNCLEAR` 时不解锁任何节点、不创建 change record。

---

## 3. Impact classes 与失效规则（Freeze order step 2）`[计划输入 R7 doc + dev-plan]`

### 3.1 五类 impact class（R7 doc Freeze order 原文）

| impact class | 定义（grounding） | 失效节点 | 保留节点 | owner 审批 |
|---|---|---|---|---|
| `DOC_ONLY` | 仅改措辞或验收细节（GWT-R7-01 原文） | 受影响的 PRD/设计/任务草案 | 已完成代码、已冻结契约 | 仅 owner 字段命名（§2.1），不需额外 approval receipt `[草案]` |
| `TASK_GRAPH` | 改任务结构/依赖但不改契约接口 [Owner 决断 OQ-R7-4=A，2026-09-15] | 受影响任务节点及其 READY 状态；回到 planning/contract-reverse | 已冻结契约、已完成代码 | 仅 owner 字段命名（不需 receipt，变更生效以 G2.2 图重新 Owner CONFIRMED 为闸 [Owner 决断 OQ-R7-2=A，2026-09-15]） |
| `CONTRACT` | 改接口或状态字段（GWT-R7-02 原文） | 受影响契约 + 全部依赖的前端/后端任务退出 READY，回到 contract-reverse/Owner review [Owner 决断 OQ-R7-4=A，2026-09-15] | 不直接依赖该契约的任务/代码 | **需要** owner approval receipt（§5） |
| `IMPLEMENTATION` | 改运行时行为（GWT-R7-03 原文） | 受影响任务 + 对应 PRD/plan 开新版本；旧报告只读保留 | 旧版本证据只读保留（GWT-R7-03：old reports remain read-only） | 新 PRD/plan 版本回到 PRD gate 时需要 Owner review `[草案]` |
| `SECURITY` | 改安全相关行为 `[草案]`（R7 doc 列名原文，无独立 GWT） | 级联 CONTRACT 全部失效规则 + 失效节点集扩展至全部安全相关 gate，安全相关验收强制重跑 [Owner 决断 OQ-R7-5=A，2026-09-15] | 旧证据只读保留 | **需要** owner approval receipt（§5）[Owner 决断 OQ-R7-5=A，2026-09-15] |

- **DOC_ONLY** 规则直接来自 GWT-R7-01 `[计划输入]`："only the affected PRD/design/task draft is invalidated; completed code and frozen contracts remain valid."
- **CONTRACT** 规则直接来自 GWT-R7-02 `[计划输入]`："the contract and all dependent frontend/backend tasks leave READY and return to contract-reverse/owner review."
- **IMPLEMENTATION** 规则直接来自 GWT-R7-03 `[计划输入]`："a new PRD/plan version references the old version, reason, source evidence, and affected tasks; old reports remain read-only."
- **TASK_GRAPH** 和 **SECURITY** 在 R7 doc 中列出但无独立 GWT；其失效规则已由 Owner 裁决并吸收（OQ-R7-4/OQ-R7-5=A）。

**TASK_GRAPH vs CONTRACT 边界机器判据 [Owner 决断 OQ-R7-4=A，2026-09-15]**：变更触及任何冻结契约的规范性内容（操作名、错误码、schema、状态词、谓词）⇒ `CONTRACT`；仅触及 G2.2 图/PRD0/任务文档 ⇒ `TASK_GRAPH`；同时触及 ⇒ 从严归 `CONTRACT`。

### 3.2 失效传播规则（核心判定）

1. **精确失效，禁止全量回退**（§0.1 前提 1）：`invalidatedNodes` 必须由 impact class + 依赖图（G2.2 §2 edge table）计算得出，仅包含受影响节点及其直接/传递下游；**不得**将全部 READY 节点清空。
2. **下游级联**：当一个节点因变更退出 READY 时，其所有依赖该节点的下游节点（按 G2.2 §2 edge table 反向遍历）同步退出 READY，直到到达不受影响的分支 `[草案]`。
3. **保留证据**：已完成的代码、已验收的契约、旧版本报告**不因变更而失效**（DOC_ONLY 类）或保持只读（IMPLEMENTATION 类）——变更只影响 READY 状态和版本链，不销毁历史证据（R7 doc Boundary 原文："Preserve completed evidence and compatibility artifacts"）。
4. **fail-closed**（GWT-R7-04）：change record 缺少 impact/owner/reason/source 任一项 ⇒ 返回 `CHANGE_RECORD_INVALID`，**不解锁任何节点**。
5. **与 C-R4 transition 的关系**：节点退出 READY 的状态写入路径必须经 R4 单一 transition 入口（`[R4冻结]` §3.3）；R7 不绕过 R4 gate 直接写状态。

### 3.3 与 C-R4 §5 override 的关系

- R7 **消费** C-R4 override receipt 语义，**不重定义**：
  - 当 CONTRACT 或 SECURITY 类变更需要 Owner 审批时（§3.1），使用 `[R4冻结]` §5.2 的 `ownerApprovalReceipt` schema（approvalId/target/reason/approvedBy/approvedAt/approvalEvidence/expiresAt/relatedReceipts）。
  - 审批先于执行（`[R4冻结]` §5.2："approvedAt 晚于引用它的 transition 时点的 receipt 无效"）。
  - rollback 失效条款（`[R4冻结]` §5.2："rollback 前签发的 approval 对 rollback 后的 transition 一律失效"）。
- R7 **不另立** approval receipt schema；`CHANGE_OWNER_REQUIRED` 错误码在语义上对应 `[R4冻结]` §5.3 的"需批准而无批准"场景，但错误码名沿用 dev-plan 原文（`CHANGE_OWNER_REQUIRED`），不复用 `OWNER_APPROVAL_REQUIRED`（后者属 R4 transition 通道）。

---

## 4. Rewind targets 与新链纪律（Freeze order step 3）`[计划输入 R7 doc + R4 消费]`

### 4.1 Rewind targets（回退目标层级）

| impact class | rewind target | grounding |
|---|---|---|
| `DOC_ONLY` | 回到 PRD/设计/任务草案层（不涉及代码或契约） | GWT-R7-01 `[计划输入]` |
| `TASK_GRAPH` | 回到 planning 层（任务图重新规划） | `[草案]` |
| `CONTRACT` | 回到 contract-reverse/Owner review 层 | GWT-R7-02 `[计划输入]` |
| `IMPLEMENTATION` | 回到 PRD gate，开新版本；旧版本只读 | GWT-R7-03 `[计划输入]` |
| `SECURITY` | 回到安全 gate + contract-reverse [Owner 决断 OQ-R7-5=A，2026-09-15] |

### 4.2 新链纪律（对齐 C-R3 N2 / C-R4 §3.2 / §8.3）

1. **终态不可追加**（`[R4冻结]` §3.2）：`done`/`failed` 的合法后继为空。当变更影响已到达终态的节点时，**不得**原地改写终态记录；必须通过新链（新 PRD/plan 版本 + 新 change record）开启，与 `[R4冻结]` §3.2"回退/重开只能通过新链"同一纪律，对齐 C-R3 N2"新链由新 sourceHash 开启"。
2. **Supersede-not-delete**（R7 doc Evidence and rollback 原文）：rollback = 标记 change record 为 `superseded` 并恢复前一计划版本；**永不删除旧证据**。旧 PRD/plan/report 保持只读。
3. **无备份不迁移**（`[R4冻结]` §8.3，PRD0 §9.3.2）：变更引发的版本切换前必须先落快照；无快照不迁移。
4. **新版本引用链**（GWT-R7-03）：IMPLEMENTATION 类的新 PRD/plan 版本必须引用：旧版本、原因、source evidence、受影响任务清单。版本链 = `changeRecordId → baseVersion → newVersionRef`。
5. **版本 bump scheme**：IMPLEMENTATION 类新 PRD/plan 版本号用**顺序整数**（`v2`, `v3`, …），`newVersionRef` 指向新文件路径**及其 sha256**；**不用 semver** [Owner 决断 OQ-R7-7=A，2026-09-15]。newVersionRef 为 null 仅限非 IMPLEMENTATION 类。
6. **旧报告只读**（GWT-R7-03 原文："old reports remain read-only"）：任何变更不得覆盖旧验收报告或把已发生的真实执行改写为成功（对齐 PRD0 §9.3.6 / `[R4冻结]` §8.3）。

---

## 5. Owner 审批点、审计字段（Freeze order step 4）`[计划输入 + R4 消费]`

### 5.1 Owner 审批点

| impact class | 是否需要 owner approval receipt | 依据 |
|---|---|---|
| `DOC_ONLY` | 否（仅需 owner 字段命名） | `[草案]`：文档措辞变更不触及契约/安全 |
| `TASK_GRAPH` | 否（仅需 owner 字段命名；不需 ownerApprovalReceipt；变更生效以 G2.2 图重新 Owner CONFIRMED 为闸 [Owner 决断 OQ-R7-2=A，2026-09-15]） | `[草案]`：任务结构变更可经 planning 层处理 |
| `CONTRACT` | **是** | GWT-R7-02："return to contract-reverse/owner review" `[计划输入]`；消费 `[R4冻结]` §5.2 receipt |
| `IMPLEMENTATION` | 新 PRD/plan 版本回 PRD gate 时需要 Owner review | GWT-R7-03 `[计划输入]`；审批形态 = PRD gate 审查，不另立 receipt |
| `SECURITY` | **是** | [Owner 决断 OQ-R7-5=A，2026-09-15]：安全类变更须 Owner 审批（消费 `[R4冻结]` §5.2 receipt），并强制重跑全部安全相关验收 |

- `CHANGE_OWNER_REQUIRED`（`[计划输入 dev-plan:308]` 原码）在以下场景返回：impact class 需要 owner approval receipt（CONTRACT/SECURITY）但未提供有效 receipt；或 owner 字段缺失且该 impact class 要求 owner。
- 未提供有效 receipt 时：fail-closed，不解锁任何节点，返回缺失批准的诊断。

### 5.2 审计字段

每个 change record 必须携带以下审计字段（§2.2 schema 已列）：

- `changeRecordId`（唯一标识，格式 `cr-<YYYYMMDDTHHMMSSZ>-<8位随机>` [Owner 决断 OQ-R7-3=A，2026-09-15]）
- `basePlan` + `baseVersion`（变更基线）
- `reason`（必填）
- `impactClass`（§3 五类之一）
- `owner`（必填）
- `sourceEvidence[]`（来源证据引用）
- `invalidatedNodes[]`（失效节点清单——这是"精确失效"的机器可查证据）
- `recordedAt` + `recordedBy`（时间与记录方）
- `supersededBy`（回滚链）
- 若使用了 owner approval receipt：引用 `approvalId`（消费 `[R4冻结]` §5.2）

- **存储** [Owner 决断 OQ-R7-1=A，2026-09-15]：记录本体 = `contracts/discrepancies/<changeRecordId>.json`（append-only，每记录一文件、以 changeRecordId 命名）；索引 = `plans/active/changes/index.jsonl`（additive；namespaced 下随 session）。记录本体与索引均为追加式写入，永不覆写。
- **追加式**：change record 一旦写入不可改写；supersede 通过新增记录 + `supersededBy` 指针实现，不原地修改。

### 5.3 不可抵赖

- change record 与 invalidatedNodes 清单同时写入，不允许"记录已写但节点清单缺失"的中间态（对齐 `[R4冻结]` §6.2 原子性原则）。
- 任何变更在 READY 重算输出中可见（非静默）；无记录的 READY 变化即 defect。

---

## 6. READY recomputation and idempotency（Freeze order step 5）`[计划输入 R7 doc]`

### 6.1 READY 重算

- change record 生效后，必须按 PRD0 §5.5 READY 公式重算全部节点的 READY 状态 `[计划输入 PRD0 §5.5]`。
- 被 `invalidatedNodes` 覆盖的节点及其下游按 §3.2 规则退出 READY；未受影响节点的 READY 状态保持不变。
- READY 重算的输入 = R4 canonical state（`[R4冻结]` §3.1：A 面 plan 7 态为执行权威）+ change record 的 `invalidatedNodes` 清单。
- R7 不重新定义 READY 公式；它只消费 PRD0 §5.5 和 R4 canonical state，把变更影响投影到 READY 集。

### 6.2 幂等（GWT-R7-05）

- 同一 change record 被重复提交时：不得创建重复的任务、契约、tracker 或失效事件（GWT-R7-05 原文 `[计划输入]`）。
- 幂等键 = canonical `sha256({basePlan, baseVersion, reason, impactClass, owner})`，键序固定（§2.2）[Owner 决断 OQ-R7-6=A，2026-09-15]。重复提交：`ok:true` 返回既有记录的 `changeRecordId`，`data` 指回原 change record，`warnings` 记 `DUPLICATE_REPLAY`（不新增错误码）；不写新记录、不产生副作用。
- 同键不同 `sourceEvidence` ⇒ `CHANGE_SCOPE_UNCLEAR`（§2.3），不放行也不重放。
- 幂等判定在 `change.record` 操作入口完成；重复提交不产生副作用。

### 6.3 回滚

- R7 doc Evidence and rollback 原文："Rollback means marking the change record superseded and restoring the previous plan version; never delete the old evidence." `[计划输入]`
- 回滚步骤（对齐 `[R4冻结]` §8.4）：
  1. 新 change record 标记原记录为 `superseded`（supersededBy 指针）；
  2. 恢复前一 plan version；
  3. 保留失败/回滚记录（审计链不断）；
  4. 重跑受影响节点的 READY 重算。
- 回滚不能把已发生的真实执行改写为成功，也不能删除审计 receipt（PRD0 §9.3.6 / `[R4冻结]` §8.3）。

---

## 7. `change.record` operation schema

Response shell 沿用 dev-plan 全表统一壳（C-R2 §6.1 / C-R3 §2 / C-R4 §6 同构）`[计划输入 dev-plan:308]`：

```json
{ "ok": true, "code": null, "data": { }, "evidence": { }, "warnings": [ ] }
```

### 7.1 `change.record` `[计划输入 dev-plan:308]` + `[草案]`

| 项 | 定义 |
|---|---|
| 语义 | 接受一条需求变更记录：校验必填字段（§2.1）→ 判定 impact class（§3）→ 计算失效节点清单（§3.2）→ 检查 owner 审批（§5）→ 写入 change record（§5.2）→ 重算 READY（§6）。全部通过才落盘。 |
| 输入 | `base plan/version`、`reason`、`impact class`、`owner`（`[计划输入 dev-plan:308]` 原列）；`sourceEvidence`（GWT-R7-04 要求不得缺失，`[草案]` 补入输入面）；`ownerApprovalReceipt`（仅 CONTRACT/SECURITY 类需要，消费 `[R4冻结]` §5.2 schema） |
| 输出 | shell `data: changeRecord`（`[计划输入 dev-plan:308]` 原形）——`[草案]` 细化：changeRecord schema 见 §2.2；`evidence` 含 `{invalidatedNodes, readyRecomputed, snapshotEcho, recordedAt}` `[草案]` |
| 错误码 | `CHANGE_RECORD_INVALID`（必填字段缺失/形状非法，GWT-R7-04 `[计划输入]`）；`CHANGE_SCOPE_UNCLEAR`（impact class/节点范围无法唯一判定，§2.3 `[计划输入]`）；`CHANGE_OWNER_REQUIRED`（需 owner 审批而未提供，§5.1 `[计划输入]`） |
| fail-closed | 必填字段缺失 ⇒ `CHANGE_RECORD_INVALID` + 不解锁任何节点（GWT-R7-04）；impact class 无法判定 ⇒ `CHANGE_SCOPE_UNCLEAR`；owner 审批缺失 ⇒ `CHANGE_OWNER_REQUIRED`。禁止对非法输入返回 ok:true 并解锁节点。 |
| 幂等 | 相同幂等键 = canonical `sha256({basePlan, baseVersion, reason, impactClass, owner})` ⇒ `ok:true` 返回既有 `changeRecordId` + `warnings` 记 `DUPLICATE_REPLAY`（不新增错误码，不写新记录）；同键不同 `sourceEvidence` ⇒ `CHANGE_SCOPE_UNCLEAR` [Owner 决断 OQ-R7-6=A，2026-09-15] |
| 原子性 | change record 写入 + invalidatedNodes 清单 + READY 重算在同一临界区完成，不允许"记录已写、节点清单缺失"的中间态（§5.3）`[草案]` |

### 7.2 CI / fail-closed 行为

- `change.record` 以 `ok:false` 收口时，调用它的脚本/CI 路径应 exit non-zero；不得打印成功字面。
- `CHANGE_RECORD_INVALID` / `CHANGE_SCOPE_UNCLEAR` / `CHANGE_OWNER_REQUIRED` 均为 fail-closed 结果，不解锁任何节点。

---

## 8. Migration and rollback

### 8.1 与 MW0-MW4 的关系

- R7 复用 PRD0 §9.1 MW0-MW4 窗口命名 `[计划输入]`；G2.2 图 R7 行明确"MW naming isolated from M3" `[计划输入 G2.2 §3 R7]`。
- R7 不引入新 feature flag；变更记录机制在 strict 模式下生效，legacy 模式下旧路径只读兼容（R7 doc Exact files：旧路径只读兼容）。
- 安全/破坏性 gate 不得被 `legacy-warn` 削弱（PRD0 §9.2 通则；`[R4冻结]` §8.1 同一纪律）。

### 8.2 无备份不迁移（对齐 `[R4冻结]` §8.3）

- 版本切换前必须先落快照（PRD0 §9.3.2）；无备份不迁移。
- 迁移只做增量字段和追加记录，不删除旧字段（PRD0 §9.3.3）。
- 回滚不能删除审计 receipt 或把真实执行改写为成功（PRD0 §9.3.6）。

---

## OQ-R7-x index

| 编号 | 决断点 | 落点 | 状态 |
|---|---|---|---|
| OQ-R7-1 | change record 存储布局：`plans/active/changes/` 与 `contracts/discrepancies/` 的分工（哪个写记录本体、哪个写索引）；namespace 形态 | §5.2 | **DECIDED** `[Owner 决断 OQ-R7-1=A，2026-09-15]` |
| OQ-R7-2 | TASK_GRAPH 类是否需要 owner approval receipt（当前提案：仅字段命名，不需 receipt） | §3.1、§5.1 | **DECIDED** `[Owner 决断 OQ-R7-2=A，2026-09-15]` |
| OQ-R7-3 | `changeRecordId` 格式（建议沿用 C-R4 approvalId 紧凑形 `apr-<timestamp>-<rand>` 惯例，改前缀为 `cr-`） | §2.2 | **DECIDED** `[Owner 决断 OQ-R7-3=A，2026-09-15]` |
| OQ-R7-4 | TASK_GRAPH vs CONTRACT 的边界判定规则（何时算"只改任务图"vs"触及契约接口"） | §3.1 | **DECIDED** `[Owner 决断 OQ-R7-4=A，2026-09-15]` |
| OQ-R7-5 | SECURITY 类的完整失效规则（失效节点集、是否级联 CONTRACT 全部规则、安全 gate 重跑范围） | §3.1、§4.1、§5.1 | **DECIDED** `[Owner 决断 OQ-R7-5=A，2026-09-15]` |
| OQ-R7-6 | 幂等键设计与重复提交返回形态（no-op 返回既有 record vs 显式 DUPLICATE 码；当前提案沿用既有 record，不新增错误码） | §2.2、§6.2 | **DECIDED** `[Owner 决断 OQ-R7-6=A，2026-09-15]` |
| OQ-R7-7 | 版本 bump scheme（IMPLEMENTATION 类的新 PRD/plan 版本号格式：semver/sequential/custom） | §4.2 | **DECIDED** `[Owner 决断 OQ-R7-7=A，2026-09-15]` |

> OQ-R7-1…7 全部经 Owner 冻结授权 2026-09-15 裁决为 A 并逐字吸收进正文。本契约于 2026-09-15 冻结（C-R7=FROZEN），登记见 `plans/tasks/C-R7-freeze-20260915.md`；此后任何变更走 Owner 审查 + 重新冻结，不就地改写。drafts/ 永远不解锁任务（G2.2 图 §8）。
