# C-R8-remediation — Critique-to-Remediation Orchestration Contract

> 文档状态：`C-R8=FROZEN`（2026-09-15 冻结；OQ-R8-1…7 已由 Owner 全项裁决 = A 并逐字吸收正文，见各节 `[Owner 决断 OQ-R8-x=A，2026-09-15]` 标注；本契约不解锁任何任务，G2.2 图 §8：contract drafts never unlock tasks；R8 自身状态 = BLOCKED until G2.1/G2.2 and R4，见 R8 task doc 首行与 G2.2 图 R8 行；残余 `[待补充]`：批准-执行哈希对账方案，归属 R8 实现阶段）
>
> 契约登记名：`C-R8-remediation`（G2.2 图 §3 R8 行与 §8 冻结序列为准）。本文件与配套清单 `contracts/C-R8-review-checklist.md` 是该契约的冻结载体。
>
> 操作名：仅 `remediation.register` 一个（`[计划输入 dev-plan:309]` 原码）。不新增操作名。
>
> 错误码：仅 `INVALID_EVIDENCE`、`REMEDIATION_DUPLICATE`、`REMEDIATION_REVIEW_REQUIRED` 三个（`[计划输入 dev-plan:309]` 原码）。不新增错误码。
>
> 快照：`240f3fbdb4ee757dffc4d5ab80407d1b2c84863c`。全部 grounding sources 的 sha256 已在撰写前重算并逐一匹配（见 §0 表）。
>
> 证据标签沿用 C-R3/C-R4 惯例：`[代码佐证]` = 冻结快照源码 file:line；`[计划输入]` = PRD0/dev-plan/G2.2 图/R8 task doc 条目；`[草案]` = 本文件新提出、需 Owner 场景审查确认的内容；`[待补充]` = 无实测值或 Owner 未裁决，禁止编造；`[R3冻结]` = `contracts/C-R3-activation.md`（FROZEN，hash 见 §0）；`[R4冻结]` = `contracts/C-R4-control.md`（FROZEN，hash 见 §0；2026-09-14 冻结——原 `[R4草案]` 引用随 C-R4 冻结同步改指冻结件）。

## 0. Grounding sources（read-only，撰写前已逐一 sha256 校验）

| source | sha256（前 8 位） | 口径 | used for |
|---|---|---|---|
| `plans/tasks/G2.2-task-graph-20260911.md` | `d48f1fba…` | tree | R8 节点规格（§R8：GWT-R8-01…05 + GWT-R8-L1、prerequisites `R4==DONE && C-R8==FROZEN`、独立证据/身份约束、兼容回滚原文）、契约依赖边（R4→R8、R8→R10/R8→R6）、冻结顺序 |
| `plans/tasks/PRD0-contract-revision-v3.md` | `a7cbc5df…` | tree | R8 READY 公式（§5.5：`R8 READY := R4 == DONE && Remediation contract == FROZEN`）、R8 行（§7 文件映射 Critique Remediation 行）、风险表（§"批判到修复任务"行：LLM 自动改代码/无证据批判解锁/重复生成任务为禁止）、幂等注册目标 |
| `docs/tasks/yy-skill-loading-v3/R8-critique-remediation.md` | `de14cdcc…` | tree | Boundary/non-goals、Exact files（6 复用件 + 2 索引目录）、Dependencies、Freeze order 5 步、GWT-R8-01…05、Selection basis、Evidence and rollback 原文 |
| `contracts/C-R4-control.md` | `19055ff7…` | tree（FROZEN） | C-R4 契约结构先例（§0/§0.1 标签、响应壳、OQ 索引惯例）；§5.2 `ownerApprovalReceipt` 字段形状与校验（OQ-R8-3 逐字对齐源）；R8 消费 R4 canonical task state（prerequisite，不重定义） |
| `contracts/C-R3-activation.md` | `cfb07784…` | tree（FROZEN） | receipt 证据类别（§7.3 每 transition 必需 evidence）、P1-P5 谓词地板（§7.4）、weak telemetry 分离（§7.8）——R8 **消费**其 receiptRef 作为 finding evidence 类别之一，**不重定义** |
| `docs/yy-dev-plan-skill-loading-v3.md` | `d2e8e5b4…` | tree | R8 节（`:242-257`：目标/前置/后置/文件范围/冻结顺序/选型依据/GWT 1-5）、操作表 `:309`（`remediation.register` 输入/输出壳/三错误码/review column 原文"批判是否有竞品/权威来源和可复现锚点"）、R8 控制面定位（`:54`） |
| `reference/critique-protocol.md` | 快照内存在（只读引用，不哈希登记——非冻结锚点） | — | R8 复用的批判协议本体（Exact files 原文）；本草案不读不解释其内容，只登记复用关系 |
| `reference/dispatch-and-acceptance.md` | 同上 | — | R8 复用的派发/验收协议 |
| `plans/critique-backlog-tracker.md` | 同上 | — | 现状批判 backlog tracker（R8 复用 `--auto-register` 历史能力与 completion-report 字段） |
| `scripts/review-gate.mjs` | 同上 | — | 现有 review-gate（R8 复用其 `--auto-register` 形态与 evidence gate 判定入口） |
| `scripts/critique-backlog-next.mjs` | 同上 | — | 现有 backlog-next 选择器（Exact files 原文） |
| `plans/active/remediation/`、`evidence/critique/` | **快照内不存在**（已实测 ABSENT） | — | R8 实现阶段新建的 remediation draft 索引与 critique 证据索引目录；本草案只定义其契约角色，存储布局见 §6.3（`[Owner 决断 OQ-R8-1=A，2026-09-15]`） |

> 口径说明：六个冻结输入（前四行 + C-R3 + dev-plan）的 sha256 已在撰写前重算并逐一匹配 handoff 值，无 mismatch。五个复用文件（critique-protocol/dispatch-and-acceptance/backlog-tracker/review-gate/critique-backlog-next）在快照中存在但**不在冻结清单内**——本草案把它们登记为"复用对象"而非"冻结锚点"，不对其内容做任何断言；两个索引目录在快照中不存在，标注为实现阶段新建。

## 0.1 设计前提（handoff 指定 + 冻结输入原文）

1. **批判必须有竞品/权威来源与可复现锚点；evidence 缺失 = `INVALID_EVIDENCE` fail-closed**。dev-plan 操作表 review column 原文："批判是否有竞品/权威来源和可复现锚点" `[计划输入 dev-plan:309]`；dev-plan R8 前置原文："批判规则要求真实竞品、权威文献/官方项目资料和 source anchor" `[计划输入 dev-plan:245]`；GWT-R8-05 原文："Given 批判缺少竞品或权威来源；When gate；Then finding 为 `INVALID_EVIDENCE`，不能进入 remediation READY" `[计划输入 dev-plan:257 / R8 doc GWT-R8-05]`。本契约把"可复现锚点 + 竞品/权威来源"作为 finding 注册的**必要条件地板**，缺任一项即 fail-closed 拒绝，不得降级为"待补证据"后放行。`[Owner 决断 OQ-R8-5=A，2026-09-15]` 把同一地板延伸到 draft 侧：五要素不齐 ⇒ fail-closed 不写 draft，finding 保持 REGISTERED + warnings 列缺失项（§3.2）。
2. **消费 C-R3 receipt 证据类别，不重定义**。finding 的 evidence refs 可指向 `[R3冻结]` §7.3 定义的 receipt 事件（receiptRef），但 R8 **不重定义** receipt 每 transition 的必需 evidence、**不重定义** §7.4 P1-P5 谓词地板、**不重定义** §7.8 weak telemetry 分离规则。R3 receipt 对 R8 而言是**已判定的证据成品**（behavior_verified / FAILED / UNRESOLVED），R8 只投影其终态作为 finding 的证据类别之一，不打开事件链重判。
3. **不允许 LLM 自批自过、不自动改代码、不发明未审任务**。R8 doc Boundary 原文 non-goals："allowing an LLM to invent an implementation task without review, treating an unverified claim as accepted, or auto-editing source files" `[计划输入 R8 doc §Boundary]`；G2.2 图 R8 行原文："no self-approval, no auto-editing. Non-goals: LLM-invented tasks, unverified claims unlocking work, direct code edits" `[计划输入 G2.2 R8 行]`；G2.2 独立证据/身份原文："producer cannot self-accept a remediation; Owner override/`NO_ACTION` recorded explicitly" `[计划输入 G2.2 R8 行]`。本契约据此把"新 remediation-draft 生成"与"任务可执行 READY"严格分离：draft 生成 ≠ 任务解锁。`[Owner 决断 OQ-R8-3=A，2026-09-15]`：R8 自有批准记录的字段形状与校验逐字对齐 `[R4冻结]` §5.2（approvedBy='owner'、approvalEvidence 必填、批准先于执行、哈希对账同构、approvedBy≠createdBy 隔离），targetType 记 `remediation_draft`；**不扩展 C-R4 冻结枚举、不触发其变更控制**（§5.1/§3.1）。
4. **幂等：同一批判文件 + 同一 finding title 重复注册 → 返回原 ID，计数不变**。GWT-R8-04 原文："Given the same critique file and finding title are registered twice, when the gate runs, then tracker and task draft counts remain unchanged and the original ID is returned" `[计划输入 R8 doc / dev-plan:256]`。幂等键定义见 §2.2。`[Owner 决断 OQ-R8-2=A，2026-09-15]`：幂等命中 = `ok:true` + `code=REMEDIATION_DUPLICATE` + `data` 返回原 findingId（正常决策进 data 通道）；同题异内容 = 新 finding + `REMEDIATION_REVIEW_REQUIRED`，不走 DUPLICATE 码。
5. **原始批判证据不可变；rollback 只 supersede 新 mapping/draft**。R8 doc §Evidence and rollback 原文："Rollback removes only the new mapping/draft by superseding its record; original critique evidence stays immutable" `[计划输入 R8 doc §Evidence and rollback]`；G2.2 兼容/回滚原文同 `[计划输入 G2.2 R8 行]`。回滚不得改写已注册 finding 的证据原文、不得删除 G2.1 verdict 记录。

---

## 1. Scope and non-goals（对应 Freeze order 第 1 步：Finding schema and evidence classes）

### 1.1 In scope `[计划输入 R8 doc §Boundary + §Exact files + dev-plan:244-248]`

- 把每条已接受批判 finding 变成可执行项：注册稳定 finding ID、连接已有任务或创建 remediation-draft、注入 GWT/依赖/证据要求、防止重复与自批。
- 一个操作契约：`remediation.register`（§6），完整输入/输出/错误码/response shell/幂等。
- finding schema 与证据类别（§1.2-§1.4）；映射规则（§2）；remediation-draft schema（§3）；依赖/GWT 注入规则（§4）；Owner override 与 `NO_ACTION` 规则（§5）。
- Exact files（复用对象，非本草案修改对象）：`reference/critique-protocol.md`、`reference/dispatch-and-acceptance.md`、`plans/critique-backlog-tracker.md`、`scripts/review-gate.mjs`、`scripts/critique-backlog-next.mjs` `[计划输入 R8 doc §Exact files]`；新建索引 `plans/active/remediation/` 与 `evidence/critique/`（快照内 ABSENT，实现阶段建，布局见 `[Owner 决断 OQ-R8-1=A，2026-09-15]` §6.1）。
- 后置衔接：R6 release gate 复核 `REPRODUCED`/accepted finding 的 remediation 状态；R10 消费低质量资产/行为失败 finding `[计划输入 dev-plan:246]`。

### 1.2 Non-goals `[计划输入 R8 doc §Boundary + G2.2 R8 行]`

- 不允许 LLM 发明一个未经审查的实现任务（§3：draft 生成后必须停在 review 态，不得自动 READY）。
- 不把未验证 claim 当作 accepted（§1.4 证据门 fail-closed）。
- 不自动编辑源文件（本契约只登记/映射/生成 draft，不触碰 `vendor/`/`scripts/`/`contracts/`/`plans/` 冻结文件）。
- 不重定义 R3 receipt 证据类别与 P1-P5 谓词（前提 2；消费不重定义）。
- 不重定义 R4 canonical task state/phase transition 语义（R8 消费 R4 任务状态作为 map-to-existing 的匹配面；任务状态机词汇属 C-R4）。
- 不做独立验收（验收属 R6/独立 Execution Agent）；本契约只定义注册/映射/草案生成的判定规则。
- 不改 G2.1 ledger 的 verdict 记录（REPRODUCED/COUNTEREVIDENCE_CONFIRMED/UNRESOLVED 原文保留）。
- 不新增操作名、不新增错误码（§0 头部约束）。

### 1.3 Finding schema（注册后稳定记录）`[草案， grounding = GWT-R8-01 + dev-plan:253]`

```text
finding = {
  findingId: string,                  // 稳定 ID；格式 = fnd-<YYYYMMDD>-<6位随机> [Owner 决断 OQ-R8-6=A，2026-09-15]
  title: string,                     // finding 标题（幂等键分量之一，§2.2）
  sourceAnchor: {                    // 可复现锚点（§1.4 类别 A）
    kind: 'file:line' | 'probe',
    path: string,                    // 仓库相对路径；probe 时为探针脚本路径
    line?: number,                   // kind=file:line 时必填
    sha256: sha256 hex               // 锚点目标字节哈希（file:line = 文件字节哈希；probe = 探针脚本字节哈希）
  },
  reproCommand: string,              // 可复现命令/观察（GWT-R8-01 原文 "reproducible command/observation"）
  externalSource: {                   // 竞品/权威来源（§1.4 类别 B；缺失 ⇒ INVALID_EVIDENCE）
    kind: 'competitor' | 'authoritative' | 'official_project',
    url: string,
    date: string(ISO 8601),           // 来源访问/发布日期
    citedAs: string                   // 引用片段或标题
  },
  impact: string,                     // 影响陈述（GWT-R8-01 原文）
  proposedVerification: string,       // 提议的验证方式/修复方向（GWT-R8-01 原文 "proposed verification"）
  critiqueFile: { path: string, sha256: sha256 hex },   // 来源批判文件身份（幂等键分量之一，§2.2）
  g21Verdict: null | 'REPRODUCED' | 'COUNTEREVIDENCE_CONFIRMED' | 'UNRESOLVED',
  // ^ G2.1 ledger verdict 投影；非 G2.1 来源的 finding 可为 null，但 null 的 finding 不得解锁其依赖 [计划输入 G2.2 R8 行 L1]
  r3ReceiptRefs: receiptRef[],        // 可选；指向 C-R3 receipt 事件（§1.4 类别 C；消费不重定义）
  status: <§1.5 枚举>,
  taskRef: null | string,             // 映射结果（§2/§3）；未映射为 null
  registeredAt: string(ISO 8601),     // 幂等豁免字段
  registeredBy: string                // 注册方身份（session/agent id）；与 §5 自批禁止联动
}
```

- 字段集为 `[草案]` 提案，Owner 场景审查后冻结；`g21Verdict` 是否必填非 G2.1 finding 等细节见 §7 残余 OQ。`findingId` 格式已由 `[Owner 决断 OQ-R8-6=A，2026-09-15]` 落笔（§1.3/§3.2）。
- 必含不变量（fail-closed）：`sourceAnchor` + `reproCommand` + `externalSource` + `impact` + `proposedVerification` 五者缺一 ⇒ 不进 finding，直接 `INVALID_EVIDENCE`（§1.4 门）。

### 1.4 证据类别（finding 证据的三分类；与 C-R3 receipt 类别的关系 = 消费不重定义）`[草案]`

| 类别 | 定义 | 机器可查判定 | 缺失后果 |
|---|---|---|---|
| A. 可复现锚点 | `file:line`（仓库内文件相对路径 + 行号 + 文件字节 sha256）或 `probe`（探针脚本相对路径 + 脚本字节 sha256 + 探针输出观察） | 锚点路径存在且 `sha256 == 实际字节哈希`；`file:line` 的行号落在文件行范围内；`probe` 的 `reproCommand` 可重放并产出与 `proposedVerification` 对齐的观察 | `INVALID_EVIDENCE`（fail-closed） |
| B. 竞品/权威外部来源 | `competitor`（竞品产品/实现）、`authoritative`（权威文献/标准）、`official_project`（官方项目文档/发布说明）三类之一；必含 url + date + citedAs | 三类枚举内任取一；url 非空；date 为合法 ISO 日期；citedAs 非空 | `INVALID_EVIDENCE`（GWT-R8-05 原文："缺少竞品或权威来源"） |
| C. R3 receipt 终态引用（可选） | 指向 `[R3冻结]` §7.6 `artifacts/<subtaskId>/receipt.json` 的 receiptRef（subtaskId + assetId + eventSeq），投影其 §7.1 终态（`behavior_verified` / FAILED / UNRESOLVED） | receiptRef 可解析；**终态判定沿用 `[R3冻结]` §7.4 P1-P5 重放结果**；R8 不重放、不改判、不接受 weak telemetry（`[R3冻结]` §7.8） | 可选类别，缺失不触发 INVALID_EVIDENCE；但若引用的 receipt 终态为 FAILED/UNRESOLVED，finding 不得据此进入 remediation READY（§5 review 门） |

- **与 C-R3 receipt 证据类别的关系**：类别 C 是对 `[R3冻结]` §7.3 每 transition 必需 evidence 的**只读投影引用**。R8 不定义 receipt 事件 schema、不定义 P1-P5 谓词、不定义 weak telemetry 读法；这些在 C-R3 已冻结。若 R3 receipt 重放结果与缓存 `result` 不一致，错误通道 = `RECEIPT_INVALID`（`[R3冻结]` §7.6 原码），R8 只透传不另立码。
- **类别 A 的"可复现"判定** = file:line 锚点存在且哈希一致 + reproCommand 可重放。重放本身的执行属 R8 实现任务（复用 `scripts/review-gate.mjs` 的 `--auto-register` 证据门入口，`[计划输入 R8 doc §Selection basis]`）；本契约固定"锚点缺失/哈希不符 = INVALID_EVIDENCE"的判定规则。

### 1.5 Finding status 枚举 `[草案， 对齐 R8 doc "explicit status" + dev-plan GWT]`

```text
REGISTERED            // 证据门通过，已注册稳定 ID，尚未映射（GWT-R8-01 收口）
MAPPED_EXISTING       // 命中已有 R-task，taskRef = 该 R-task（GWT-R8-02 收口）
DRAFT_PROPOSED        // 生成 remediation-draft，taskRef = draft ID，等待 Owner review（GWT-R8-03 收口；status 伴 REMEDIATION_REVIEW_REQUIRED）
INVALID_EVIDENCE      // 证据门未过；不进 remediation READY（GWT-R8-05 收口）
NO_ACTION             // Owner 显式标记不修复并附理由（dev-plan:244；§5.3）
SUPERSEDED            // 回滚时新 mapping/draft 被 supersede（§5.4；原 finding 证据不可变）
```

- `INVALID_EVIDENCE` 与 `NO_ACTION` 均为**终态**（在该 finding 记录上）；`SUPERSEDED` 只作用于 mapping/draft 记录，不改写 finding 本体证据。
- `MAPPED_EXISTING` / `DRAFT_PROPOSED` 不自动等于 remediation READY：READY 还需 R6 closure check 与对应任务自身的 phase gate（属 C-R4/R6，本契约不替代）。

---

## 2. Mapping rules to existing tasks（Freeze order 第 2 步）+ duplicate 判定

### 2.1 匹配面 `[草案]`

- map-to-existing 的候选集 = R4 canonical task state 中的活跃 R-task（`[R4冻结]` §3.1 A 面 plan/subtask；任务状态机词汇属 C-R4，R8 不重定义）。
- 匹配谓词 `[Owner 决断 OQ-R8-4=A，2026-09-15]`：map-to-existing **仅精确命中**——finding 的 `sourceAnchor`（`kind='file:line'`）的 `path:line` 落在候选 R-task 验收文件范围内（机器可查：路径相等 + 行号落在该验收文件行范围内）⇒ `MAPPED_EXISTING`；**不做语义匹配**（`title`/`impact` 语义覆盖不构成命中依据）；歧义（多个候选命中）一律 Owner 指定，不自动落 create-draft。
- 命中后动作（GWT-R8-02 原文 `[计划输入]`）：被命中 R-task 追加一条"批判承接项"（critique-consumption entry，记录 findingId + 要求追加的 GWT/evidence requirement）；**不创建重复任务**；finding.status = `MAPPED_EXISTING`，taskRef = 该 R-task ID。

### 2.2 Duplicate 判定与 `REMEDIATION_DUPLICATE`（GWT-R8-04）`[草案]`

- **幂等键** `[草案]`：`(critiqueFile.sha256, normalizedTitle)`。
  - `critiqueFile.sha256` = 来源批判文件字节 sha256（不是路径；路径可移动，字节内容不变）；
  - `normalizedTitle` = finding.title 经大小写折叠 + 去首尾空白 + 连续空白归一（最小归一，不做语义相似度——语义相似度属 §2.1 匹配，不是 duplicate 键）。
- **命中分支**：相同幂等键已存在 finding ⇒
  - tracker 不新增记录、task draft 计数不变（GWT-R8-04 原文）；
  - 返回**原 findingId**（GWT-R8-04 原文）；
  - 响应壳 `data: {findingId: 原ID, taskRef: 原值, status: 原status}`；
  - code = `REMEDIATION_DUPLICATE`；`ok:true`（幂等命中是正常决策，走 data 通道）`[Owner 决断 OQ-R8-2=A，2026-09-15]`。
- **通道分叉裁决** `[Owner 决断 OQ-R8-2=A，2026-09-15]`：幂等命中 = `ok:true` + `code=REMEDIATION_DUPLICATE` + `data` 返回原 findingId（正常决策进 data 通道，不进错误通道）；**同题异内容 = 新 finding + `REMEDIATION_REVIEW_REQUIRED`，不走 DUPLICATE 码**（见冲突分支）。dev-plan:309 虽把该码列在"错误码"列，Owner 裁决其语义为幂等命中标记而非失败——GWT-R8-04 措辞 "the original ID is returned" 不含拒绝义。
- **冲突分支**：相同幂等键但 `sourceAnchor`/`externalSource`/`impact` 字节不等（即同题不同证据）⇒ **不**判 duplicate、**不产生 `REMEDIATION_DUPLICATE`**；按 §1.4 证据门重新过闸后作为**新 finding** 注册（新 findingId），并在新 finding 上记录 `duplicateOf: 原findingId`（人工合并线索，不自动合并证据）`[草案]`。code 走 `REMEDIATION_REVIEW_REQUIRED`（§5.2 触发条件 3）；draft 五要素不齐时按 §3.2 fail-closed 停在 `REGISTERED` + warnings，仍不走 DUPLICATE 码 `[Owner 决断 OQ-R8-2=A，2026-09-15]`。

---

## 3. Remediation-draft schema for new tasks / candidate task & map mode semantics（Freeze order 第 3 步）

### 3.1 两种 map mode 与 taskRef 产生 `[草案， grounding = dev-plan:309 输入列 "candidate task/map mode" + GWT-R8-02/03]`

`remediation.register` 的输入含 `mapMode`，取以下两值之一（外加 §5.3 的 `NO_ACTION` 出口，由 Owner 显式触发，不由 register 自动产生）：

| mapMode | 触发条件 | taskRef 如何产生 | finding.status | 谁能批 |
|---|---|---|---|---|
| `map-to-existing` | §2.1 谓词命中活跃 R-task | taskRef = 命中的 R-task ID（来自 R4 canonical task state，R8 不新建任务） | `MAPPED_EXISTING` | 映射本身不需新批（追加承接项是 additive）；但该 R-task 的 READY 仍走 C-R4 phase gate，R8 不代为批准 |
| `create-draft` | §2.1 未命中任何 R-task | taskRef = 新 remediation-draft ID（落在 `plans/active/remediation/`，布局见 §6.1 `[Owner 决断 OQ-R8-1=A，2026-09-15]`） | `DRAFT_PROPOSED` | **必须经 Owner review 才成为可执行任务**（§5.2）；draft 生成方/批判作者**不得自批**（前提 3；approvedBy≠createdBy 隔离见 §5.1 `[Owner 决断 OQ-R8-3=A]`） |

- **candidate task ≠ implementation READY**（GWT-R8-03 原文 `[计划输入]`："it is not implementation READY"）。`create-draft` 产出的是草案形态（§3.2），停在 `DRAFT_PROPOSED` + `REMEDIATION_REVIEW_REQUIRED`；Owner 未 review 前，该 draft 不进入 R4 task state、不被派单、不解锁任何下游。
- **map mode 由谁决定** `[草案]`：register 调用方传入 `mapMode`；若调用方未指定，默认走 `map-to-existing` 先匹配，未命中再走 `create-draft`（自动两阶段）。**自动两阶段产生 draft 时同样触发 review 门**——不因为"自动"而跳过 Owner review。
- **谁能批（已裁决）**：draft → 可执行任务的批准方 = Owner。`[Owner 决断 OQ-R8-3=A，2026-09-15]`：批准记录 = R8 自有记录，**字段形状与校验逐字对齐 `[R4冻结]` §5.2** `ownerApprovalReceipt`（approvedBy='owner'、approvalEvidence 必填、批准先于执行、哈希对账同构、approvedBy≠createdBy 隔离），`targetType` 记 `remediation_draft`；不扩展 C-R4 冻结枚举、不触发其变更控制（schema 逐字段对齐见 §5.1）。本契约不发明新批准操作名。

### 3.2 Remediation-draft schema（GWT-R8-03 原文要素）`[草案]`

```text
remediationDraft = {
  draftId: string,                  // = taskRef；格式 = rem-<同日期>-<6位随机> [Owner 决断 OQ-R8-6=A，2026-09-15]；与 findingId 可互查
  findingId: string,                // 来源 finding
  scope: string,                   // 范围（GWT-R8-03 原文）
  nonGoals: string[],               // 非目标（GWT-R8-03 原文）
  dependencies: string[],          // 依赖（GWT-R8-03 原文；引用 R4 canonical task 或 R3 receipt 类别）
  gwts: gwt[],                     // 注入的 GWT/dependency 要求（§4）
  contractImpact: string[],        // 契约影响（GWT-R8-03 原文：列出可能触及的契约/文件）
  ownerReviewState: 'PENDING'|'APPROVED'|'REJECTED',   // GWT-R8-03 原文 "owner review state"；初始 PENDING
  createdAt: string(ISO 8601),
  createdBy: string
}
```

- 字段集为 `[草案]`；`scope`/`nonGoals`/`dependencies`/`gwts`/`contractImpact` 五要素逐项对应 GWT-R8-03 原文。`[Owner 决断 OQ-R8-5=A，2026-09-15]`：五要素**不齐 ⇒ fail-closed 不写 draft**——finding 保持 `REGISTERED` + warnings 列缺失项，不产生 draftId、不落盘残缺 draft；与 §1.4 证据门同类地板，禁止"先落盘后补齐"。（原 OQ 中的备选"写残 draft 附 REMEDIATION_REVIEW_REQUIRED 标记"已被否决。）
- `ownerReviewState` 初始恒为 `PENDING`；`APPROVED` 只能由 Owner 通道写入（§5.2），`createdBy` 字段不允许把它自己改成 `APPROVED`（自批禁止，前提 3）。

### 3.3 与 R4/R3 的接口 `[草案]`

- draft 的 `dependencies` 引用 R4 canonical task（plan/subtask ID）或 R3 receipt 终态类别；R8 不新建任务状态、不写 R4 state.json。
- draft → 正式任务的升格（ownerReviewState: PENDING → APPROVED）属 R4/R6 执行面：R8 只产出"待批草案"，升格后的任务注册、phase gate、派单均走 C-R4 既有通道，本契约不定义升格操作。

---

## 4. Dependency/GWT enrichment rules（Freeze order 第 4 步）

### 4.1 注入内容 `[计划输入 GWT-R8-02/03 + dev-plan:254-255]`

- 对 `map-to-existing`（GWT-R8-02 原文）：被命中 R-task 的承接项 =
  1. 引用 findingId；
  2. 追加一条 GWT 要求（描述该 finding 修复后的可观察结果）；
  3. 追加一条 evidence requirement（修复完成后必须提供的验证证据——类别 A 可复现锚点更新 + 类别 B 外部来源对照，若 finding 引用了 R3 receipt 则对应类别 C 的终态迁移）。
- 对 `create-draft`（GWT-R8-03 原文）：draft 自身的 `gwts[]` 字段（§3.2）承载同样的三要素。
- **注入是 additive**：不改动既有 R-task 已冻结的 GWT 文本；追加项带 `findingId` 前缀可辨识、可独立回滚（§5.4）。

### 4.2 GWT-R8-L1 投影（G2.1 ledger 注册）`[计划输入 G2.2 R8 行 L1]`

G2.2 图 R8 行规定："Given the G2.1 ledger, when registered, then C1/C3/C6/C7 map to R2/R3/R4 acceptance entries and C2/C5 register as `UNRESOLVED`-status findings that cannot unlock their dependents (§5) and are never dropped."

- 本契约据此把 G2.1 ledger 的 C1-C7 逐条作为既有 finding 注册面：
  - C1/C3/C6/C7（verdict = REPRODUCED）⇒ `map-to-existing` 到 R2/R3/R4 的验收条目（taskRef = 对应验收条目 ID）；
  - C2/C5（verdict = UNRESOLVED）⇒ 注册为 `g21Verdict=UNRESOLVED` 的 finding，status = `REGISTERED`（不自动 create-draft、不映射到可解锁任务），**不得解锁其依赖**（G2.2 原文）；
  - 全部 C1-C7 一经注册即**永不删除**（"are never dropped"）；回滚只 supersede mapping/draft（前提 5）。
- L1 的 C1–C7 逐条映射表 `[Owner 决断 OQ-R8-7=A，2026-09-15]`（承接锚点均在修订时点实证存在，file:line 见表后注；行内引用不改写任何冻结文件）：

| C | G2.1 §1 verdict | 承接去向（taskRef 落点） | 承接内容 | 状态标注 |
|---|---|---|---|---|
| C1（skill/manifest 计数不变量） | `REPRODUCED` | R1 基线 + R2 catalog 实现验收 | 已承接：R1 16-asset 证据基线（`nestedSkillCount=46` / `manifestEntries=16`）+ R2 catalog 实现验收继续维持该不变量 | 已闭环（R1/R2 验收链） |
| C3（七条路由观测全中） | `REPRODUCED` | R2 路由准入实现 + 41 样本机制 | 已承接：R2 路由准入实现 + R2.5/R2.6 41 样本 real-query replay 机制（同一 41 inputs 口径） | 已闭环（R2 验收链） |
| C6（assetConsumed 口令） | `REPRODUCED → RESOLVED` | C-R3 §7 receipt 契约 + R3 remediation（F-1/F-2/F-3） | 已承接：C-R3 §7 receipt 契约层回应（显式拒绝 marker-only / copier-only 证据）+ R3 remediation F-1/F-2/F-3 修复；底层 assetConsumed 行为缺陷按 C-R3 §0.1 前提 1 不宣称已修 | 已承接（契约层 + F-1/F-2/F-3；底层行为缺陷修复状态以 C-R3/R3 验收口径为准） |
| C7（CI 真实性） | `REPRODUCED` | R4 ci.mjs 分类矩阵 + exit 传播 | 已承接：R4 `ci.mjs` 分类矩阵（BLOCKING_FAIL/QUALITY_WARN/QUALITY_FAIL）+ exit 传播（GWT-R4-L1） | 已闭环（R4 实现验收链） |
| C5（gate-skip） | `UNRESOLVED → RESOLVED`（证据阻塞清除，G2.2 §5 2026-09-14 Owner 更新） | R4 phase.mjs 单一入口 + GWT-R4-01 fixture | 已承接：修复主体 = R4 `scripts/lib/phase.mjs` 单一入口（runtime.mjs 直写点改道 funnel）+ `fixtures/gwt-r4-01.mjs`；**如实标注：修复后 C5 原始探针回归 [待确认/未执行]，不得写成已闭环** | 已承接（修复主体 R4；原始探针回归待执行，本表不宣称 gate-skip 行为缺陷已闭环） |
| C2（punctuationKeywordCount 9 vs 16） | `UNRESOLVED` | 保持 UNRESOLVED 注册形态 | 阻断 R9/R6 前置链（G2.2 §4/§5）；承接要求 = 同快照（`240f3fbd`）第三方复现，或 Owner 重发布冻结项后第三方复现（G2.2 §5 原文 unlock 条件）；诊断变体不可替代冻结命令 | UNRESOLVED 注册（不映射、不解锁、永不删除） |

> 表注（承接锚点实证，修订时点快照 `240f3fbd`）：`scripts/lib/phase.mjs` 存在且暴露 `checkPhase`/`transitionPhase`（`test-reports/R4-implementation-20260915/REPORT.md` §单一入口）；`test-reports/R4-implementation-20260915/fixtures/gwt-r4-01.mjs` 存在；ci.mjs 分类矩阵与 exit 传播为 R4 实现验收项（同报告 CI 节 + gwt-r4-05 行 PASS）；41 样本 = R2.5/R2.6 real-query replay 同一 41 inputs（`test-reports/R2.6-keyword-expansion-fixes-20260912/REPORT.md` Baseline pinning 节）；F-1/F-2/F-3 = `test-reports/R3-remediation-20260914/REPORT.md` findingsFixed。C6→C-R3（而非 R3 验收报告）的落点沿 C-R3 §0.1 前提 1 原文："C6 的验收裁决已存在（执行报告 verdict `REPRODUCED`）；底层 assetConsumed 行为缺陷仍未被修复，receipt 契约以显式拒绝 marker-only / copier-only 证据作为对缺陷的契约层回应，不宣称缺陷已修"。

---

## 5. Owner override, NO_ACTION, and review channel（Freeze order 第 5 步）

### 5.1 自批禁止 `[计划输入 G2.2 R8 行 + R8 doc Boundary]`

- finding 的 `registeredBy` 与 remediation-draft 的 `createdBy` **不得**同时是该 draft `ownerReviewState` 的批准方（producer cannot self-accept）。
- 批判作者、注册 agent、draft 生成 agent 三者与 Owner 身份必须可区分；批准记录必须携带批准方身份。`[Owner 决断 OQ-R8-3=A，2026-09-15]`：R8 自有批准记录（approval record，targetType = `remediation_draft`）的字段形状与校验**逐字对齐 `[R4冻结]` §5.2** `ownerApprovalReceipt`：

```text
remediationApprovalRecord = {
  approvalId: string,              // 唯一；格式 = apr-<YYYYMMDDTHHMMSSZ>-<8位随机>（时间戳紧凑形去冒号）——与 [R4冻结] §5.2 逐字一致
  targetType: 'remediation_draft', // R8 域内唯一合法值（对应 [R4冻结] §5.2 的 'phase_transition'；本行是 R8 与 C-R4 的唯一差异点）
  target: { draftId: string, findingId: string },   // 对齐 C-R4 §5.2 target 的 from/to/scope/scopeId 位置——R8 域内以 draft+finding 二元组为作用域
  reason: string,                  // Owner 给出的理由（必填，禁止空）
  approvedBy: 'owner',             // 固定字面；非 owner 身份 ⇒ 该 receipt 无效；approvedBy ≠ createdBy（隔离校验同构）
  approvedAt: string(ISO 8601),
  approvalEvidence: string,        // = Owner 指令文件路径 + 该文件 SHA256；对话记录引用为辅（必填）
  expiresAt: null,                 // = null；批准绑定特定 draft/finding，不跨作用域复用
  relatedReceipts: receiptRef[],   // 触达的 R3 receipt 终态快照引用
}
```

- **校验逐字对齐**（四条，与 `[R4冻结]` §5.2 同构）：(a) `approvedBy` 非 `'owner'` ⇒ 批准记录无效；(b) `approvalEvidence` 必填（指令文件路径 + SHA256），缺失 ⇒ 无效；(c) **批准先于执行**：`approvedAt` 晚于引用它的升格/派单时点的记录无效；(d) **哈希对账同构**：批准记录与执行记录进入同一哈希对账（无实测哈希方案前 `[待补充]`，归属 R8 实现阶段，与 C-R4 残余项同形态）。
- **隔离判定**：`approvedBy='owner'` 且 ≠ 该 draft 的 `createdBy`（也 ≠ finding 的 `registeredBy`、≠ 批判作者身份）；creator 通道写入 `APPROVED` 即 defect（§3.2）。
- **边界声明**：本记录是 R8 自有记录，**不扩展 C-R4 冻结枚举**（`targetType: 'phase_transition'` 枚举在 C-R4 内不变）、**不触发 C-R4 变更控制**；仅字段形状与校验规则同构复用。

### 5.2 Review 通道：`REMEDIATION_REVIEW_REQUIRED` 何时触发 `[草案]`

触发条件（满足任一即返回该码，`data.status` 同步为 `DRAFT_PROPOSED`）：

1. **`mapMode=create-draft` 且新 remediation-draft 生成成功**（GWT-R8-03 原文：draft 带 owner review 状态、不是 implementation READY）——这是主触发面；
2. **`map-to-existing` 命中但被命中 R-task 的承接项影响了契约冻结面**（如追加 GWT/evidence requirement 触及已冻结 C-R2/C-R3/C-R4 的错误码语义）⇒ 映射仍发生，但 review 门打开，要求 Owner 确认承接项不弱化冻结契约 `[草案]`；
3. **duplicate 冲突分支（§2.2 同题不同证据）产生新 finding 时**⇒ 新 finding 默认 `DRAFT_PROPOSED`，由 Owner 决定合并或分线 `[草案]`。

不触发 review 门的分支：`INVALID_EVIDENCE`（直接 fail-closed，无 draft）；`REMEDIATION_DUPLICATE` 幂等命中（§2.2，无新记录）；`NO_ACTION`（§5.3，Owner 显式动作本身即 review 结果，不二次触发）。

- 通道语义 `[草案]`（与 OQ-R8-2=A 裁决原则同构）：`ok:true` + `code=REMEDIATION_REVIEW_REQUIRED`（注册/映射已成功，review 是状态标注不是失败——同一"正常决策进 data 通道"原则）。

### 5.3 `NO_ACTION` 规则（dev-plan:244 原文要素）`[计划输入 + 草案]`

- 每条 finding **必须**有出口：映射到已有任务、生成 remediation-draft、**或**显式标记 `NO_ACTION` 并由 Owner 说明原因（dev-plan:244 原文："或明确标记 `NO_ACTION` 并由 Owner 说明原因"）。
- `NO_ACTION` **只能由 Owner 显式写入**（不由 register 自动产生、不由批判作者自批）；写入记录含：findingId、reason（必填非空）、owner 身份、日期。
- `NO_ACTION` 后 finding.status = `NO_ACTION`（终态）；该 finding 不进 R6 closure check 的待办集，但记录本身不可删除（前提 5）。
- 记录位置 `[Owner 决断 OQ-R8-5=A，2026-09-15]`：`NO_ACTION` **内联写 findings ledger**（`status` + `reason` + `owner` + `date` 四字段同条记录），**不另建文件**。

### 5.4 Rollback / supersede `[计划输入 R8 doc §Evidence and rollback + G2.2 R8 行]`

- rollback = 只 supersede 本次新产生的 mapping/draft 记录（status → `SUPERSEDED`），**不删除**原始批判证据、**不改写** G2.1 verdict、**不改写**已注册 finding 的 `sourceAnchor`/`externalSource`/`impact`/`proposedVerification`。
- supersede 是追加式记录（带 supersedeBy、supersededAt、reason），不是原地删除。
- rollback 不影响已映射到活跃 R-task 的承接项内容本身——若要回退承接项，须走该 R-task 自己的变更控制（C-R4/PRD0 §9.3），R8 rollback 只管自己生成的 mapping/draft 记录。

---

## 6. `remediation.register` operation contract

Response shell 沿用 dev-plan 全表统一壳（C-R2/C-R3/C-R4 同构，`[计划输入 dev-plan:309]`）：

```json
{ "ok": true, "code": null, "data": { "findingId": "", "taskRef": null, "status": "" }, "evidence": { }, "warnings": [ ] }
```

> `data` 三键 `{findingId, taskRef, status}` 为 dev-plan:309 原文壳形，本契约不增删键。

### 6.1 操作表 `[计划输入 dev-plan:309 原码 + 草案细化]`

| 项 | 定义 |
|---|---|
| 语义 | 对一条新批判 finding 执行：证据门（§1.4）→ duplicate 检查（§2.2）→ map（§2.1）或 create-draft（§3）→ 注入 GWT/evidence 要求（§4）→ 返回稳定 findingId 与 taskRef/status。只读复用 `review-gate.mjs` 的 evidence gate 判定入口；不自动编辑源文件。 |
| 输入 | `finding`（§1.3 字段集：title/sourceAnchor/reproCommand/externalSource/impact/proposedVerification/critiqueFile/g21Verdict/r3ReceiptRefs）、`evidence refs`（§1.4 类别 A/B/C 的机器可查引用）、`mapMode`（`map-to-existing` \| `create-draft`；缺省 = 自动两阶段，§3.1）；findings ledger = `plans/active/remediation/findings.jsonl`（append-only，布局 §6.3）`[Owner 决断 OQ-R8-1=A，2026-09-15]` |
| 输出 | shell `data: {findingId, taskRef, status}`（§1.5 枚举值）；`evidence` 含 `{snapshot, findingHashEcho, critiqueFileEcho, matchedTaskEcho, registeredAt}` `[草案]` |
| 错误码 | `INVALID_EVIDENCE`（§1.4 类别 A/B 缺失或哈希不符；fail-closed；GWT-R8-05）、`REMEDIATION_DUPLICATE`（§2.2 幂等命中，返回原 ID）、`REMEDIATION_REVIEW_REQUIRED`（§5.2 draft 生成/契约影响分支；注册成功但需 Owner review）——三码均 `[计划输入 dev-plan:309]` 原码，不新增 |
| fail-closed | 证据门任一类别 A/B 不通过 ⇒ 不写 finding、不写 tracker、不写 draft；`ok:false` + `INVALID_EVIDENCE`。禁止"证据不全先注册后补"。 |
| 幂等 | 幂等键 `(critiqueFile.sha256, normalizedTitle)`（§2.2）；相同键 ⇒ 返回原 ID、计数不变、无新写，`ok:true` + `code=REMEDIATION_DUPLICATE`（`[Owner 决断 OQ-R8-2=A]`）。`registeredAt` 显式豁免进 evidence 对账。 |
| 只读保证 | 本操作不修改 `vendor/**`、`scripts/**`、`contracts/**`（冻结契约）、`plans/tasks/**`（冻结计划）、G2.1 ledger；只在 §6.3 布局（`[Owner 决断 OQ-R8-1=A]`）定义的 `plans/active/remediation/`、`evidence/critique/` 与现有 `plans/critique-backlog-tracker.md` 上做追加式写。 |

### 6.2 分支矩阵 `[草案]`

| 证据门 | duplicate | map 结果 | code | data.status | 写动作 |
|---|---|---|---|---|---|
| 不通过（A/B 缺或哈希不符） | — | — | `INVALID_EVIDENCE` | `INVALID_EVIDENCE` | 无 finding 写入（fail-closed）；可在 ledger 记一条被拒线索 `[草案]` |
| 通过 | 命中（同键同内容） | — | `REMEDIATION_DUPLICATE` | 原 status | 零写（幂等） |
| 通过 | 未命中 | 命中现有 R-task | `null`（成功） | `MAPPED_EXISTING` | R-task 追加承接项；finding 落 ledger |
| 通过 | 未命中 | 未命中任何 R-task | `REMEDIATION_REVIEW_REQUIRED` | `DRAFT_PROPOSED` | draft 落 `plans/active/remediation/`；finding 落 ledger；ownerReviewState=PENDING |
| 通过 | 冲突（同键异内容） | — | `REMEDIATION_REVIEW_REQUIRED`（§5.2 触发条件 3；不产生 `REMEDIATION_DUPLICATE`，`[Owner 决断 OQ-R8-2=A]`）；draft 五要素不齐 ⇒ §3.2 fail-closed：code `null` + warnings 缺失项 | `DRAFT_PROPOSED` / `REGISTERED`（按 §3.2 五要素门） | 新 finding 落 ledger，附 `duplicateOf`；不产生 `REMEDIATION_DUPLICATE` |

### 6.3 存储布局（findings ledger / drafts / evidence）`[Owner 决断 OQ-R8-1=A，2026-09-15]`

| 位置 | 角色 | 写规则 |
|---|---|---|
| `plans/active/remediation/findings.jsonl` | findings ledger（唯一权威注册面） | append-only；一行一条 finding 记录（§1.3 schema）；`NO_ACTION` 内联写同 ledger（§5.3：status+reason+owner+date，不另建文件）；禁改写已追加行 |
| `plans/active/remediation/drafts/<findingId>.md` | remediation-draft 载体 | 一 finding 一文件，文件名 = 其 findingId；五要素齐备才落盘（§3.2 fail-closed） |
| `evidence/critique/<critiqueFile.sha256>/` | 原始批判证据原件索引 | 按批判文件字节 sha256 分目录；原件不可变（前提 5），rollback 只 supersede mapping/draft |
| `plans/critique-backlog-tracker.md` | 现有 backlog tracker（只读兼容面） | **只读、只追加不迁移**：R8 不迁移、不改写 tracker 既有记录，只按 GWT-R8-02 承接语义追加；历史能力（`--auto-register`）照旧复用 |

> `findings.jsonl` 与 tracker 的关系 = ledger 权威、tracker 只读兼容投影；两目录在快照 `240f3fbd` 内 ABSENT，R8 实现阶段按本节布局新建。

---

## 7. OQ-R8-x index（2026-09-15 Owner 全项裁决 = A；逐字吸收正文见各落点节）

| 编号 | 决断点 | 落点 | 状态 |
|---|---|---|---|
| OQ-R8-1 | remediation ledger 与新建索引目录的精确存储布局 | §6.3（findings ledger = `plans/active/remediation/findings.jsonl` append-only；draft = `plans/active/remediation/drafts/<findingId>.md`；evidence 原件 = `evidence/critique/<critiqueFile.sha256>/`；tracker 只读只追加不迁移）、§1.1、§6.1 | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R8-2 | `REMEDIATION_DUPLICATE` 通道分叉；同题异内容是否走该码 | §2.2（命中 = `ok:true` + code 携带 DUPLICATE + data 回原 ID；冲突 = 新 finding + REVIEW 码不走 DUPLICATE）、§6.2、前提 4 | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R8-3 | draft → 可执行任务的批准 receipt 形状 | §5.1（R8 自有记录，字段形状与校验逐字对齐 `[R4冻结]` §5.2；approvedBy='owner'、approvalEvidence 必填、批准先于执行、哈希对账同构、approvedBy≠createdBy 隔离；targetType='remediation_draft'；不扩展 C-R4 冻结枚举、不触发其变更控制）、§3.1、前提 3 | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R8-4 | map-to-existing 匹配谓词阈值 | §2.1（仅精确命中：sourceAnchor file:line 落在候选 R-task 验收文件范围内 ⇒ MAPPED_EXISTING；不做语义匹配；歧义一律 Owner 指定） | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R8-5 | `NO_ACTION` 记录位置；draft 五要素不齐的处理 | §5.3（NO_ACTION 内联写 ledger：status+reason+owner+date，不另建文件）+ §3.2（五要素不齐 ⇒ fail-closed 不写 draft，finding 保持 REGISTERED + warnings 列缺失项）、前提 1 | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R8-6 | `findingId` 格式与 draft ID 命名空间 | §1.3（`fnd-<YYYYMMDD>-<6位随机>`）+ §3.2（`rem-<同日期>-<6位随机>`；与 findingId 可互查） | **DECIDED**（2026-09-15，Owner=A） |
| OQ-R8-7 | GWT-R8-L1 的 C1-C7 逐条映射表 | §4.2 正式表（C1→R1 基线 + R2 catalog 实现验收；C3→R2 路由准入 + 41 样本机制；C6→C-R3 §7 receipt 契约 + R3 F-1/F-2/F-3；C7→R4 ci.mjs 分类矩阵 + exit 传播；C5→R4 phase.mjs 单一入口 + GWT-R4-01 fixture，原始探针回归 `[待确认/未执行]` 如实标注；C2→UNRESOLVED 注册形态，阻断 R9/R6 前置链）+ checklist 6 行期望列 | **DECIDED**（2026-09-15，Owner=A） |

> 冻结记录 = `plans/tasks/C-R8-freeze-20260915.md`（含冻结前后 sha256 对账）；draft 原稿保留于 `contracts/drafts/`（read-only revision-evidence，沿 C-R4 先例）；本契约永远不解锁任务（G2.2 图 §8）。`route41Rerun.required = false`（R8 不改动 R2 路由关键词/簇/状态）。
