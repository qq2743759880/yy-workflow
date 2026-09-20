# C-R3-activation — Activation / Delivery / Receipt Contract（草案：receipt 部分已完成设计）

> 文档状态：`DRAFT / OWNER-SCENARIO-REVIEW-REQUIRED / NOT-FROZEN / NOT-APPROVED / DOES-NOT-UNLOCK-R3 / RECEIPT-DESIGN-DRAFT-COMPLETE`
>
> 本文是 `C-R3-activation` 的**完整草案**：receipt 部分（§7）已按 C6 裁决（`REPRODUCED → RESOLVED`，2026-09-13）与 Owner 十项决断（2026-09-13）完成**草案级设计**，替换 2026-09-12 框架草案的 receipt 骨架。**receipt 设计在草案中完成 ≠ 已验收、已冻结**：本文仍处 DRAFT，待独立验收 + Owner 场景审查 + Owner 显式 freeze 决定；`contracts/drafts/` 永远不解锁任务（G2.2 图 §8 change-control route）。R3 READY 只能由 `R2 == DONE && Activation/Receipt contract == FROZEN`（PRD0 §5.5）满足；冻结由 Owner 的 freeze 决定产生，本文无权自宣告。
>
> 版本沿革：本版替换框架草案（hash `d832e77d9db9b9829585d0c8d409828b50e3392133420ca3e7775bb4e825e83a`，其独立验收见 `test-reports/C-R3-framework-acceptance-20260913/REPORT.md`，ACCEPTED AS DRAFT，遗留 N-1 = 旧版 receipt 占位标记族措辞过时——本版按该验收建议解除该标记族并完成 receipt 设计）。C6 裁决已存在（执行报告 `test-reports/C6-execution-20260913/REPORT.md`：verdict `REPRODUCED`，两次运行一致）；**底层 assetConsumed 行为缺陷仍未被修复**，receipt 契约以"显式拒绝 marker-only / copier-only 证据"作为对缺陷的契约层回应，不宣称缺陷已修。
>
> 快照：`240f3fbdb4ee757dffc4d5ab80407d1b2c84863c`（运行时事实全部引用该提交的 R1 baseline 证据、C6 设计/执行证据与源码锚点；全部输入 sha256 已在本版撰写前重算并逐一匹配，无 mismatch）。
>
> 证据标签遵循 C-R2 草案惯例：`[R1实测]` = R1 baseline 测量值；`[代码佐证]` = 冻结源码 file:line；`[计划输入]` = PRD0/dev-plan/G2.2 图/R3 task doc 条目；`[Owner决断 2026-09-13]` = Owner 已决断、本版逐字执行的条款；`[草案]` = 本文件新提出、需 Owner 场景审查确认的内容；`[待补充]` = 无实测值，禁止编造。

## 0. Grounding sources（read-only，撰写前已逐一 sha256 校验）

| source | sha256（前 8 位） | used for |
|---|---|---|
| `plans/tasks/PRD0-contract-revision-v3.md` | `66b64303` | MVP 边界（§2）、READY 公式（§5.5）、文件映射 Receipt Store 行（§7）、MW0-MW4 与 flags（§9）、指标纪律（§10） |
| `plans/tasks/G2.2-task-graph-20260911.md` | `f377d924` | R3 节点规格（§3 R3，含 GWT-R3-L1 冻结锚点）、契约冻结顺序（§8）、变更控制路线（§8） |
| `plans/tasks/R2-acceptance-20260912.md` | `4f017a8e` | R3 READY 前置分解（`R3 READY := R2.5 == DONE && R2 release-ready == ACCEPTED && C-R3 == FROZEN && C6 == RESOLVED`）、C6 状态措辞 |
| `contracts/drafts/C-R2-catalog.draft.md` | `871bc3b5` | catalog entry schema（sourceHash/口径）、R1 实测速查表、证据标签惯例 |
| `contracts/drafts/C-R2-review-checklist.md` | `f36405a3` | Owner 场景审查清单格式惯例 |
| `docs/yy-dev-plan-skill-loading-v3.md` | `d2e8e5b4` | 操作名（`:302` `activation.prepare`、`:303` `receipt.append`）、response shell、错误码、R3 冻结顺序、共同验收字段（`:80`） |
| `test-reports/C6-design-20260912/DESIGN.md` | `06f73bc6` | C6 探针设计、边界 case 表、trivial copier 定义 |
| `D:/.ai-hub/tmp/c6-exec-20260913/probe.mjs` | `7ff20222` | C6 探针本体（执行报告 verdict `REPRODUCED`，两次运行 results 一致） |
| `test-reports/C6-execution-20260913/REPORT.md` | `b54ab390` | C6 执行证据：7 case 逐例观测值、runStability `IDENTICAL`、verdict `REPRODUCED` |
| `test-reports/R1-baseline-20260911/`（REPORT + normalized-baseline.json） | schemaHash `8db3278d` | bodyBytes/resourceBytes/overfetch/read-count 实测；token 显式 `[待补充]` |
| `docs/tasks/yy-skill-loading-v3/R3-activation-receipts.md` | —（计划输入） | R3 冻结顺序 5 步、GWT-R3-01…05 词汇 |
| `test-reports/C-R3-framework-acceptance-20260913/REPORT.md` | `0c538b90` | 框架草案独立验收（ACCEPTED AS DRAFT）、N-1 措辞缺陷记录（本版解除依据） |
| `scripts/lib/asset.mjs`、`scripts/lib/adapters/prompt.mjs`、`scripts/exec-host-generic.mjs`、`scripts/token-audit.mjs`、`scripts/validate-structure.mjs` | 快照内源码 | 激活/投递/消费校验的现状机制锚点 |

## 0.1 C6 前提（记录在案，非修复声明）

1. **C6 状态**：`REPRODUCED → RESOLVED`（G2.2 图 §1 ledger 原样；C6 执行报告 verdict `REPRODUCED`，runStability `IDENTICAL`）。证据阻塞已解除，但**底层 assetConsumed 行为缺陷未被修复**——本文与 R2 acceptance（`C6 = REPRODUCED → RESOLVED (does not claim the underlying asset-evidence behavior is fixed)`）采用同一措辞，不宣称 C6 已修；本文也不改变任何 finding 状态。
2. **trivial-copier bypass 是设计前提与 §7 的反证基线**：C6 探针证实（两次运行一致）一个零方法论、只回显标题 + 1 个内核词的 copier 产物得到 `assetConsumed=true`（case `title-plus-kernel-word`，7/7 case 观测值与设计常量一致）。机制锚点 `[代码佐证]`：
   - `scripts/lib/adapters/prompt.mjs:107-108`：`assetConsumed` = 产物文本包含锚点（且 kernel 资产再含 ≥1 内核词）——纯字符串包含判定，布尔饱和于一次回显；
   - `scripts/exec-host-generic.mjs:65-84`：非交互宿主注入指令**明确要求**真机模型"回复第一行必须写方法论标题锚点……回复正文须包含……至少一个内核 token"——即消费校验所检查的 token 正是执行方被指导复述的 token（verifier-coached password）。
3. **对本文的约束**：任何 receipt/verification 规则不得把"回显型布尔"当作消费证据的终态。§7 的行为验证谓词把 marker-only / copier-only 证据**显式排除**在 behavior_verified 之外（Owner 指令 2026-09-13）；assetConsumed 弱证据同时保留为 legacy telemetry（§8.3），不断链、不删除。

---

## 1. Scope and non-goals

### 1.1 In scope `[计划输入]`

- 恰好 16 个 YY 内置资产（`vendor/` depth-1 目录，R1 实测 10 `skill` + 6 `agent`）的 metadata / body / resource 三级激活（dev-plan R3 GWT、任务总纲 R3 行）。
- 现有宿主适配器（`scripts/lib/adapters/`：`prompt`、`opencode`、`bmad-cline`、`portman`、`sdlc`、`util`）边界内的投递包改造——以有界 activation payload 替换 `prompt.mjs` 现状"资产全文进 brief"路径（§5）；不为任何新宿主协议定义字段。
- 两个操作契约：`activation.prepare` 与 `receipt.append`，均完整（§2；行为验证内嵌于 receipt.append 事件，不设第三操作，`[Owner决断 2026-09-13]`）。
- 激活记录、投递包、token 估算方法的字段级 schema（§3、§6）。
- asset receipt 完整契约：生命周期状态机、事件 schema、验证谓词、幂等、存储布局、与 legacy 的兼容/迁移规则（§3.3、§3.4、§7、§8）。
- additive 兼容：legacy `assetConsumed` 布尔产物（telemetry-only）、receipt 缺失降级（§8.3；清单场景 7/8）。

### 1.2 Non-goals `[计划输入]`

- 不改变路由选择语义——路由是 R2 产物（`C-R2-catalog`），本契约只消费 `router.select` 的已选资产；不新增路由关键词、簇或状态。
- 不引入向量数据库、远程技能注册中心、模型微调、新的服务端运行时（PRD0 §2.2.5）。
- 不做全机器技能发现，不扫描用户家目录或其他项目目录（PRD0 §2.2.2）。
- 不改变阶段授权、gate、session、transition 语义（R4 范围）；本契约只提供 R4 将来消费的 receipt 输入。receipt 契约定义 behavior_verified 判定，但**何时以 receipt 阻断 phase transition 属 R4**。
- 不改写 16 个资产正文、不加通用记忆系统、不启用无界 subagent、不改前端（R3 task doc Non-goals）。
- 不删除任何旧字段、旧 CLI、旧 manifest/state reader、现有 adapter 入口（PRD0 §2.2.3/§2.2.4；G2.2 图 R3 兼容行）。
- 不实现激活（本文件是契约设计，不是实现）；不改 C6 或任何 finding 状态；不修复 assetConsumed 缺陷的运行时代码（修复属实现任务，本契约只定义验收该修复所依据的规则）。
- 不新增操作名（§2 只含 dev-plan 已列的两个操作）。

### 1.3 Additive-only rule `[计划输入]`

对 `scripts/lib/asset.mjs`（`loadAssets` 及其返回 `Map<name, {name, type, meta, body}>` 形状）、`scripts/lib/adapters/prompt.mjs`（`run(subtask, ctx, options)` 签名、返回形状、`brief.md` 产物、degraded 语义）只增不改：新增字段/新增响应键允许，现有字段语义与取值不允许变化（PRD0 §7 Activation Broker 行："保留 `loadAssets`/adapter 兼容入口；增加 metadata/body/resource 级别和 activation package"）。

---

## 2. Operations

只携带 dev-plan 已列出的两个操作名，不新增操作名（dev-plan 后端契约冻结顺序表 `:302-303`）。`activation.deliver`、`activation.verify` 等名称**不存在于 dev-plan**，本文不使用。**行为验证内嵌于 `receipt.append`**：验证结果是 receipt 事件链上的一个 transition 事件（§7.4），不是独立操作（`[Owner决断 2026-09-13]`，对应框架草案 OQ-R3-9 的"验证内嵌"选项）。

Response shell 沿用 dev-plan 全表统一壳（C-R2 §6.1 同构，`[计划输入]`）：

```json
{ "ok": true, "code": null, "data": { }, "evidence": { }, "warnings": [ ] }
```

shell 键集在成功与失败间完全一致；语义与 C-R2 §6.1 相同（`NO_MATCH` 类正常决策结果进 `data` 不进 error 的原则同样适用）。

### 2.1 `activation.prepare` `[计划输入 dev-plan:302]`

| 项 | 定义 |
|---|---|
| 语义 | 对一个已选资产（`router.select` 输出的 selected 之一，或显式指定）按请求的激活级别（§4）与 token 预算（§6）构建 activationPackage：激活记录（§3.1）+ 投递包（§3.2）。只读资产源文件；不执行、不派单。 |
| 输入 | `plan`（planId 引用或内联 plan 快照）、`subtask`（子任务引用，含 `asset` 与**资源请求字段**，见下）、`asset`（资产 id；必须存在于 C-R2 catalog 视图）、`activationLevel`（`metadata\|body\|resource`；缺省策略 = hybrid，`[Owner决断 2026-09-13]` §4.4）、`requestedResources`（level=resource 时的显式资源相对路径列表；**请求来源 = subtask 字段**，`[Owner决断 2026-09-13]`）、`budget`（**可选**；首轮无硬预算，见下） |
| 输出 | shell `data: activationPackage`（§3.2）；`evidence` 含 `{snapshot, catalogCacheIdentity, sourceHashEcho, inputEcho}`（对账 C-R2 §6.1 evidence 纪律）`[草案]` |
| 错误 | `ACTIVATION_BUDGET_EXCEEDED`（仅当调用方显式提供 budget 且超限时触发，见下）、`ASSET_BODY_MISSING`、`RESOURCE_NOT_FOUND` `[计划输入 dev-plan:302 原码]`；`ASSET_NOT_FOUND`（id 不在 catalog）`[草案， C-R2 §6.2 已提案该码]`；`INPUT_INVALID`（level/requestedResources/budget 形状非法）`[草案， C-R2 §6.2 同名码]`；`ACTIVATION_MODE_UNSUPPORTED`（mode 值非法，§8.1）`[草案， 对应 C-R2 §6.2 CATALOG_MODE_UNSUPPORTED 命名风格]` |
| token 预算纪律 | **首轮不设硬 token 预算**：`budget` 输入缺席时本操作不执行预算拦截，只在激活记录中登记 `tokenEstimate`（§6 量尺的估算值，明确标注估算方法与时点）（`[Owner决断 2026-09-13]`）。预算数值本身 = `[待补充]`（Owner 给数或授权实测后回填，§6/§10）。 |
| 超预算动作 | 当且仅当调用方显式提供 `budget.limit` 且 payload 估算超限：**block，fail-closed**——`ok:false` + `ACTIVATION_BUDGET_EXCEEDED`，不产出投递包（`[Owner决断 2026-09-13]`；GWT-R3-01 现行 fail-closed 措辞 `[计划输入]`）。truncate 选项已被 Owner 决断排除，本文不再提供。 |
| 幂等 | 相同输入 + 相同资产文件状态（相同 sourceHash）⇒ 相同 activationPackage（`generatedAt` 类时间戳除外，须显式豁免并记入 evidence）`[草案， 对齐 C-R2 §2.1 幂等条款]`。允许写激活缓存（复用 `asset.mjs` 既有 `.tt-state/assets-cache.json` 机制或其增量扩展），但缓存写不得改变返回数据，且不得写 `vendor/`。 |
| 只读保证 | 不修改 `vendor/**`、`scripts/**`、state、journey、artifacts（本操作不产生执行产物；artifacts 由适配器投递与 receipt 写入，§5、§7.6）。 |
| body 缺失语义 | skill/agent manifest 同文件（R1 schema bodyPath=manifestPath）；文件不可读 ⇒ `ASSET_BODY_MISSING`（fail-closed）。现状对照 `[代码佐证]`：`asset.mjs:62-70` 对缺失文件静默置 `body=''`、`prompt.mjs:17` 注入占位文案继续投递——现状是 silent-degrade，bounded 模式下改为显式错误码（清单场景 5）。 |
| source hash 失效语义 | `activation.prepare` 时记录的 `sourceHash`（C-R2 §3.1 口径：manifest 文件字节 sha256）在投递/校验时点不一致 ⇒ `RECEIPT_HASH_MISMATCH` 通道（§7.5；错误码本身 `[计划输入 dev-plan:303]`）。清单场景 6。 |

### 2.2 `receipt.append` `[计划输入 dev-plan:303]`

| 项 | 定义 |
|---|---|
| 语义 | 向 `artifacts/<subtaskId>/receipt.json`（§7.6）追加一条资产生命周期 transition 事件（§7.2 枚举），返回 `receiptRef`。行为验证的判定结果以 `behavior_verified` transition 事件的形式由同一操作记录（§7.4），**不设独立验证操作**（`[Owner决断 2026-09-13]`）。 |
| 输入 | `event`：`{transition, subtaskId, assetId, sourceHash, session, idempotencyKey, evidence}`——`transition` ∈ §7.2 枚举；`sourceHash` 为该事件时点的资产 manifest 字节 sha256；`session` 为会话标识（namespace 规则属 R4，本操作只透传）；`evidence` 为该 transition 的必需证据（§7.3 列）；`idempotencyKey` 见幂等行 |
| 输出 | shell `data: receiptRef = {subtaskId, assetId, receiptPath, eventSeq, sourceHash}` `[草案]`；追加后返回的 `eventSeq` 为事件在 receipt.json 事件数组中的序号 |
| 错误 | `RECEIPT_INVALID`（事件 schema 违约、transition 枚举外、幂等键冲突但 payload 不同）、`RECEIPT_HASH_MISMATCH`（事件 sourceHash 与当前资产字节或链上前一事件不一致）、`RECEIPT_INCOMPLETE`（该 transition 的必需 evidence 缺失，§7.3）`[计划输入 dev-plan:303 原码]` |
| 幂等 | 键 = `idempotencyKey`（调用方生成，`[草案]` 建议为 `subtaskId + assetId + transition + evidence 哈希`）。相同键 + 字节等价事件 ⇒ 返回既有 `receiptRef`，receipt.json 不变（不产生重复事件）；相同键 + 不同 payload ⇒ `RECEIPT_INVALID`。时间戳字段（`recordedAt`）显式豁免（进 evidence 对账）`[草案]`。 |
| 存储位置 | **per-artifact：`artifacts/<subtaskId>/receipt.json`**（`[Owner决断 2026-09-13]`）；文件为 append-only 事件数组（§7.6）；增量读写走 `store.mjs` 增量层，**不混进旧 plan 字段** `[计划输入 PRD0 §7 Receipt Store 行]`。 |
| 宿主失败/重试/缓存命中如何记录 | 宿主失败（executor 缺失/超时/空输出）⇒ 无 `execution_observed` 事件，若已投递则 subtask 以 degraded 诊断收口，资产结果 UNRESOLVED（§7.3）；重试 ⇒ 新事件携带新 `idempotencyKey`（重试是真实的新执行观察，禁止复用失败尝试的键）`[草案]`；缓存命中（相同 sourceHash 的重复激活）⇒ 激活缓存层处理，receipt 侧只记录实际发生的 transition，不为缓存命中补写执行/验证事件 `[草案]`。 |

---

## 3. Schemas

字段命名以 dev-plan 已列的资产优化共同验收字段为骨架（`[计划输入 dev-plan:80]`）：`name`、`description`、`phaseEligibility`、`sourceHash`、`resources`、`activationLevel`、`tokenEstimate`、`receiptRefs`、`behaviorChecks`。本文不做删改，只补类型与 presence。

### 3.1 Activation record

| field | type | presence | grounding |
|---|---|---|---|
| `assetId` | string | required | = C-R2 catalog entry `id`（manifest `name`；16 实测 id 集） |
| `assetType` | enum `skill\|agent` | required | C-R2 §3.1 同名原样 |
| `sourceHash` | sha256 hex | required | C-R2 §3.1 同口径：manifest 文件字节 sha256；激活时点记录 |
| `sourcePath` / `bodyPath` | string | required | C-R2 §3.1 原样（bodyPath=manifestPath，棕地布局如实） |
| `phaseEligibility` | object | required | 该资产在当前 phase 的 eligibility 结果快照（含 `eligible: bool`、`reason`）；谓词语义属 R2/R4 已有机制（`matrix.mjs:5` FR-3、`planner.mjs:3-11`），本字段只投影不重定义 |
| `activationLevel` | enum `metadata\|body\|resource` | required | §4；单一激活记录恰取一个级别（多级叠加由 resource 级包含 body 表达，不并行多条）`[草案]`；级别选择策略 = hybrid（§4.4，`[Owner决断 2026-09-13]`） |
| `resources` | string[] | required | level=resource 时：实际选中并投递的资源相对路径列表（= subtask 字段显式请求 ∩ 实际存在，`[Owner决断 2026-09-13]`）；其他级别 = `[]` |
| `resourceHashes` | object（path→sha256） | required | 每个选中资源的字节 sha256（对账 `RESOURCE_NOT_FOUND` / hash 失效）`[草案， sourceHash 纪律的 resource 投影]` |
| `tokenEstimate` | object | required | `{method, level, estimate, estimatedAt}`；`method` = §6 量尺标识（Owner 已决断该量尺仅作回归量尺，非实测声明，`[Owner决断 2026-09-13]`）；`estimate` = prepare 时点对该次 payload 的估算值；估算值必须带方法与时点标识，**禁止在任何输出中表述为实测 token** |
| `budget` | object | required | `{limit, action}`；**首轮 `limit` 缺席**（无硬预算，只记录估算，`[Owner决断 2026-09-13]`；数值 `[待补充]`）；`action` 固定 `block`（fail-closed，`[Owner决断 2026-09-13]`）——仅在 limit 显式提供且超限时生效 |
| `receiptRefs` | array | required | `receipt.append` 返回的 `receiptRef` 列表（§2.2）；结构已定稿于 §7.2/§7.6 `[草案]` |
| `behaviorChecks` | array | required | 行为检查结果列表（§3.3），由 `behavior_verified` transition 事件填充（§7.4） |
| `preparedAt` | string（ISO 8601） | required | 显式豁免幂等的字段（进 evidence 对账）`[草案]` |

### 3.2 Delivery package（activationPackage 的投递投影）

见 §5 逐字段定义。schema 上它是 §3.1 记录的派生视图：`{record: <§3.1>, payload: <按级别的有界内容>, briefFrame: <宿主指令框架字段>}`。

### 3.3 Behavior-check result（定稿）

```text
behaviorCheck = {
  checkId: string,                    // [草案] 建议格式：<subtaskId>#<assetId>
  assetId: string,
  subtaskId: string,
  result: 'VERIFIED' | 'FAILED' | 'UNRESOLVED',   // [计划输入 GWT-R3-05]；16 资产矩阵逐资产显式结果，禁止聚合百分比掩盖缺行
  reason: string | null,              // FAILED/UNRESOLVED 时必填；词汇表见下
  evidenceRefs: receiptRef[],         // 指向 §7.6 事件；VERIFIED 时必须覆盖 §7.4 P1-P5 全链
  checkedAt: string(ISO 8601)         // 幂等豁免字段
}
```

- result 枚举 `VERIFIED | FAILED | UNRESOLVED` 为 dev-plan GWT-R3-05 原词汇 `[计划输入]`；`SELECTED_NOT_CONSUMED`（GWT-R3-03）作为 UNRESOLVED 的 reason 值保留（路由选中但未达适配器使用时，结果不得是 consumed/PASS）。
- reason 词汇表 `[草案， dev-plan 三码为面、新增原因为收口]`：`RECEIPT_HASH_MISMATCH`、`RECEIPT_INCOMPLETE`、`RECEIPT_INVALID`（沿用 dev-plan `:303` 码面）；`SELECTED_NOT_CONSUMED`（GWT-R3-03）；`EVIDENCE_ECHO_ONLY`（§7.4 P4 反回显谓词拒绝——marker-only / copier-only 证据，`[草案， Owner 指令 2026-09-13 的命名收口]`）；`DEGRADED_NO_EXECUTION`（降级投递，无执行观察）。
- 现状锚点（只描述，不声称修复）：回显型布尔检查位于 `prompt.mjs:107-108` 与 `exec-host-generic.mjs:65-84`（§0.1）。本契约不修改该代码；§7 谓词定义的是**验收将来修复时必须满足的判定规则**。
- **marker-only 不接受为行为验证**：`anchor 回显`、`kernel token 回显`、任何"字符串包含"型 marker 证据只能进 telemetry（§8.3），不能支撑 `VERIFIED`（dev-plan R3 GWT 4 原文 `behavior_verified=false` + Owner 指令 2026-09-13）。

### 3.4 Receipt record（定稿）

```text
receipt（artifacts/<subtaskId>/receipt.json，append-only 事件数组）= {
  subtaskId: string,
  events: [
    {
      eventSeq: number,                 // 从 1 递增，文件内连续
      transition: <§7.2 枚举>,
      assetId: string,
      assetType: 'skill'|'agent',
      sourceHash: sha256 hex,           // 事件时点 manifest 字节 sha256
      sourceHashEcho: sha256 hex,       // 链上前一事件（或 activation 记录）的 sourceHash，用于链内比对
      session: string,                  // 透传；namespace 规则属 R4
      idempotencyKey: string,
      evidence: object,                 // 按 transition 的必需证据（§7.3）
      recordedAt: string(ISO 8601)      // 幂等豁免字段
    }
  ],
  result: null | <§3.3 behaviorCheck>   // 终态缓存；未到终态为 null
}
```

- 必含不变量（框架草案已定，保留）：每事件含 `assetId`、`sourceHash`、`session`、幂等键（dev-plan `:303` 输入列）。
- `result` 字段是事件链的派生缓存，**可由事件数组整体重放推导**；重放结果与缓存不一致 ⇒ `RECEIPT_INVALID`（防手改 receipt.json）`[草案]`。

---

## 4. Activation levels（三级精确定义）

级别命名沿用 Agent Skills metadata/body/resource 三层与 dev-plan 选型表"activation: metadata/body/resource progressive disclosure"（`[计划输入]`）。

### 4.1 `metadata`

- 内容：仅 catalog entry 的 metadata 视图 = `name` + `description` + `phaseEligibility`（+ C-R2 §3.1 的 id/type/sourceHash 等身份字段）。
- **无 body**：不读 manifest 正文、不读任何 `reference/` 资源。机验口径：body read count = 0 且 resource read count = 0（dev-plan R3 GWT 2 原文）。
- 适用：**catalog 展示、路由评估、eligibility 判定**（`[Owner决断 2026-09-13]` hybrid 策略的 metadata 适用面）。
- 现状对照：R2 已保证 startup catalog 只读 metadata（C-R2 §1.2）；metadata 级激活是该保证在 R3 的延续，不新增读取。

### 4.2 `body`

- 内容：metadata + manifest 文件正文，**剥离 frontmatter 后原样全文**。
- 剥离机制沿用现状 `[代码佐证]`：`asset.mjs:5-10` `stripFrontmatter`（CRLF 归一 + `^---\n…\n---\n?` 头块切除；无 frontmatter 原样返回）。C6 探针同机制（probe.mjs `stripFrontmatter` 注释：mirrors `asset.mjs`）——本契约不得改变该剥离语义，否则 C6 证据对账失效。
- 不含任何 `reference/` 资源。
- 投递侧：body 内容进入投递包 payload（§5），受 §6/§2.1 预算纪律约束。
- 现状实测参照（不得外推为预算值）`[R1实测]`：bodyBytes p50 = 5,012 B、p95 = 16,369 B、min = 1,009 B、max = 16,369 B；16 资产总量 84,924 B。token 估算按 §6 量尺在 prepare 时点计算并标注，契约内不冻结任何数值。

### 4.3 `resource`

- 内容：body 级全部内容 + **显式请求**的 `reference/` 资源（`requestedResources` 逐项）。
- "显式"的含义：资源路径必须出现在 **subtask 的资源请求字段**中（`[Owner决断 2026-09-13]`：请求来源 = subtask 字段）；禁止隐式全量加载（现状 R1 实测资源总量 5,772,608 B、overfetch 30 = 46 nested − 16 entries——全量注入正是 R3 要消除的 overfetch）。
- 请求路径不存在 ⇒ `RESOURCE_NOT_FOUND`（fail-closed，`[Owner决断 2026-09-13]`）；禁止静默跳过。
- 现状对照：现适配器不加载任何资源，只在 brief 中给出 `assetRoot` 供消费者自行解析相对引用（`prompt.mjs:25-28` 注释）——resource 级激活是新能力，不是现状的契约化。

### 4.4 级别选择策略 `[Owner决断 2026-09-13]`

**Hybrid 策略**：metadata 级用于 catalog 展示、路由评估与 eligibility 判定；**body 为默认投递级别**；resource 级仅在 subtask 字段显式请求资源时启用。不采用 planner 静态分类、prepare 自动降级、Owner 逐单指定三种单一路线（框架草案 OQ-R3-4 的决断记录，见 §10）。

---

## 5. Delivery package contract

### 5.1 被替换的现状（只描述）`[代码佐证]`

`prompt.mjs:34-59` 组装 brief.md：任务/子任务/资产根目录/上游产物引用/前置条件/执行要求框架 + `## 方法论正文（资产全文）`（L52-54 注入 `asset.body` 全文）。`exec-host-generic.mjs` 随后把整份 brief + 宿主注入指令喂给非交互 CLI（§0.1）。即：**现状投递 = 每个被派单资产全文进宿主上下文**；R1 实测 body p50 5,012 B / p95 16,369 B 是该路径的单资产成本代理。

### 5.2 契约定义 `[草案， 框架字段 grounded、数值待 Owner]`

投递包 = `briefFrame` + `payload`：

**briefFrame（宿主指令框架，字段名与现状 brief 逐字兼容）**：

| field | 现状锚点 | R3 规则 |
|---|---|---|
| `subtaskId` / 标题 | `prompt.mjs:35` | 不变 |
| `task`（父任务） | L38 | 不变 |
| `asset` / `assetRoot` / `说明` / `contract` | L41-44 | 不变 |
| 上游产物引用 | L47 | 不变 |
| 前置条件（硬约束） | L50 | 不变（含"仍须产出资产消费证据"要求句——该要求句与 §7 验证规则的衔接：证据形态由 §7.4 谓词定义，回显型 marker 不再满足） |
| `## 方法论正文（资产全文）` 段标题 | L52-54 | **标题文字逐字保留**（`[Owner决断 2026-09-13]`；宿主解析锚：`exec-host-generic.mjs:67` regex `/##\s*方法论正文/` 与 `:81` 注入指令均依赖该标题）。段内内容 = §4 对应级别的 payload；metadata 级该段内容为占位行 `（未激活正文）`，防宿主误以为遗漏 |
| 执行要求尾注 | L57-58 | 保留语义；其中"标明你消费了哪个资产"的要求句保留（additive 兼容），但其回显结果按 §7.4 只计 telemetry，不再作为 VERIFIED 依据 |
| 产物文件名 `brief.md` | L61-64 | 不变（宿主以 brief 路径为末参的调用契约不变） |

**payload（按 §4 级别）**：metadata 级 = 资产身份块（无正文）；body 级 = 剥离 frontmatter 的全文；resource 级 = 全文 + 每个选中资源的全文。

**token budget**：

- **首轮不设硬 token 预算**：`budget.limit` 缺席，投递包不做预算拦截；激活记录仅登记 §6 量尺的 `tokenEstimate`（`[Owner决断 2026-09-13]`）。预算数值 = `[待补充]`（无实测，禁止编造；R1 只有字节代理与 H9 的 SKILL.md ≤1500 tok 结构性上限可参照，后者是资产维护 gate 不是投递预算——见 §6）。
- 当 Owner 未来提供 `budget.limit` 时：超限 ⇒ **block，fail-closed**（`ok:false` + `ACTIVATION_BUDGET_EXCEEDED`，不产出投递包；`[Owner决断 2026-09-13]`；GWT-R3-01 fail-closed 措辞 `[计划输入]`）。truncate 路线已被决断排除，`truncated` 诊断机制不再设计。

**Never included（投递包禁止包含，无论级别）** `[草案， handoff 指定 + dev-plan GWT-R3-01]`：

1. 其他 15 个资产的正文（dev-plan R3 GWT 1 原文机验口径：`Given task 只选择 planning；When build activation package；Then 不出现其他 15 个资产正文`）；
2. 历史日志（journey 日志、`result.txt`、执行 stdout/stderr）；
3. 完整报告（过往验收报告、baseline 报告全文）；
4. 其他 session 的 artifacts；
5. 未被 subtask 字段显式请求的任何 `reference/` 资源（`[Owner决断 2026-09-13]`）。

**降级语义（兼容现状）**：executor 缺失/失败/空输出时现状返回 `degraded: 'brief-only …'` 且产物为 brief 本身（`prompt.mjs:118,120`）——该语义保留不变（additive rule）；bounded 模式下 degraded 响应须**额外**携带 activation 记录引用，使"brief-only 降级"可对账。降级**不计为消费**：无 `execution_observed` 事件（§7.3），资产结果 UNRESOLVED / reason `DEGRADED_NO_EXECUTION`（§7.4）。

---

## 6. Token estimate method

- **量尺公式**（`[Owner决断 2026-09-13]`：仅作回归量尺，采用；非实测声明）：

```text
tokens ≈ round(CJK字符数 × 0.75 + 非CJK字符数 ÷ 4)
CJK 范围：\u4e00-\u9fff（统一表意文字）、\u3000-\u303f（CJK 标点）、\uff00-\uffef（全角形式）
```

`[代码佐证]` 该公式与 CJK 范围逐字来自快照内 `scripts/token-audit.mjs:24-32`（"近似口径：CJK×0.75 + 其余÷4，非精确 tokenizer，仅作回归量尺"），并被 `validate-structure.mjs:382-397` 的 H9 硬断言（SKILL.md ≤60 行且 CJK 加权 token ≤1500）采用为同一量尺。

- **量尺地位（Owner 决断原文语义）**：CJK×0.75 + 非CJK÷4 **只是回归量尺，不是实测 token 的声明**。R1 baseline 本身**没有** token 实测——normalized-baseline.json 明确记录 `metadataStartupTokens` / `bodyActivationTokensP50P95` = `[待补充] no tokenizer available; byte proxies are measured instead`，实测替代是 `metaBytes`/`bodyBytes` 字节代理。因此：字节代理是 R1 的实测；CJK 加权公式是快照内工具链已采用的近似量尺；本契约将其登记为 `tokenEstimate.method` 的标识，用于 prepare 时点估算与回归对比。
- **纪律**（对齐 PRD0 §10.2 与 C-R2 §C6r）：任何 `tokenEstimate` 输出必须带 method 标识与估算时点；**禁止把估算值写成实测**；禁止出现任何编造的 token 数、节省比例；验收对比一律相对 R1 字节代理或该回归量尺，标注量尺身份；token 数值 `[待补充]` 直到真实 tokenizer 实测存在（若有）。

---

## 7. Receipt contract（草案完成——待独立验收与 Owner 冻结）

> 本节由框架草案的占位骨架升级为完整草案设计。C6 裁决已存在（`REPRODUCED → RESOLVED`，执行报告 `test-reports/C6-execution-20260913/REPORT.md`，7/7 case 观测与设计一致、两次运行 `IDENTICAL`）；本节按 Owner 十项决断（2026-09-13）定稿设计。**设计完成 ≠ 验收/冻结**：本节内容仍处 DRAFT，须经独立验收与 Owner 场景审查后才可进入 freeze 流程（§9）。本节不实现任何运行时行为，不改变 C6 状态，不宣称 assetConsumed 缺陷已修。

### 7.1 Lifecycle states（canonical）

```text
discovered → eligible → selected → instructions_delivered → execution_observed → behavior_verified
```

终态：`behavior_verified`（唯一正终态）；负向终态/未决出口：`SELECTED_NOT_CONSUMED`（reason of UNRESOLVED，GWT-R3-03）、`FAILED`（证据被判无效）、`UNRESOLVED`（证据链不完整，GWT-R3-05 词汇）。

- 状态是 receipt 事件链的**派生视图**（事件数组重放即得当前状态，§3.4），不单独存储状态机变量 `[草案]`。
- 状态语义与 dev-plan 风险表"delivery、execution、behavior 三态分离；marker 只作 telemetry"一致 `[计划输入]`：`instructions_delivered` 只证明指令送达，`execution_observed` 只证明有真实产物，二者均**不构成**行为验证。

### 7.2 Transitions（legal transitions 与事件类型）

`receipt.append` 的 `transition` 枚举 = 以下 6 个正向 transition + 3 个负向收口事件（事件类型枚举是 receipt 内部词汇，不是操作名）：

| # | transition（事件类型） | from → to | 触发 | legal next |
|---|---|---|---|---|
| T1 | `discovered` | ∅ → discovered | 资产进入 catalog（`loadAssets`/catalog 缓存构建时） | T2 |
| T2 | `eligible` | discovered → eligible | 当前 phase 的 eligibility 判定为 true（投影 matrix/planner 现有机制，不重定义） | T3；或 subtask 关闭仍未选中 ⇒ N1 |
| T3 | `selected` | eligible → selected | `router.select` 为某 subtask 选中该资产 | T4 |
| T4 | `instructions_delivered` | selected → instructions_delivered | `activation.prepare` 成功产出 activationPackage 且适配器完成投递（brief.md 写出） | T5 |
| T5 | `execution_observed` | instructions_delivered → execution_observed | 适配器 `run()` 返回 `executed=true` 且存在真实产物（非 brief.md/result.txt、非空） | T6 |
| T6 | `behavior_verified` | execution_observed → behavior_verified | §7.4 谓词 P1-P5 全部满足，写入 §3.3 behaviorCheck（result=VERIFIED） | 终态 |
| N1 | `not_consumed` | eligible/selected → UNRESOLVED(SELECTED_NOT_CONSUMED) | subtask 关闭时资产被选中但无 T4 事件 | 终态（负） |
| N2 | `verification_failed` | execution_observed → FAILED | §7.4 P2（hash 失效）或 P4（回显型证据）不满足 | 终态（负）；可因资产更新+重激活开启新链 |
| N3 | `unresolved` | 任意 → UNRESOLVED | P1/P3 不满足（receipt 缺失/事件链断裂）或投递降级（`DEGRADED_NO_EXECUTION`） | 终态（未决） |

- 禁止的跃迁：任何跳步（如 selected → execution_observed 无 T4 事件）、任何负终态 → 正终态、`behavior_verified` 后同链再追加事件 ⇒ `RECEIPT_INVALID`（新链须由新 sourceHash 的新 activation 开启）`[草案]`。
- `assetConsumed`（legacy 布尔，`prompt.mjs:107-108`）不映射为任何 transition；它作为 pre-R3 telemetry 字段按 §8.3 读法处理。

### 7.3 Required evidence（每 transition 的必需 evidence，缺失 ⇒ `RECEIPT_INCOMPLETE`）

| transition | required evidence（`event.evidence` 键） | 机器可查判定谓词（全部可用文件字节 + 已记录字段判定） |
|---|---|---|
| `discovered` | `catalogCacheIdentity`, `sourceHash` | `sourceHash == sha256(manifest 文件字节)`（C-R2 §3.1 口径） |
| `eligible` | `phaseEligibility`（{eligible:true, reason, phase}） | `phaseEligibility.eligible === true`；谓词来源为现有 matrix/planner 投影，本事件只登记结果 |
| `selected` | `planId`, `subtaskId`, `sourceHash` | `assetId ∈ router.select(plan, subtaskId)` 的输出集 |
| `instructions_delivered` | `activationLevel`, `payloadSha256`, `briefPath`, `sourceHashEcho`, `budgetResult` | (a) `sourceHashEcho == T1.sourceHash`（不一致 ⇒ `RECEIPT_HASH_MISMATCH`，§7.5）；(b) `payloadSha256 == sha256(投递 payload 字节)`；(c) level=metadata 时 body read count = 0 且 resource read count = 0（GWT-R3-02 口径）；(d) level=resource 时 `evidence.resources == record.resources` |
| `execution_observed` | `artifactPath`, `artifactSha256`, `executed:true` | (a) artifact 文件存在、非空、后缀 ∈ {`.md`,`.json`,`.yaml`,`.yml`}（对齐现状扫描白名单 `prompt.mjs:97-112` `[代码佐证]`）；(b) `artifactSha256 == sha256(artifact 字节)`；(c) artifact ≠ brief.md、≠ result.txt（现状扫描排除项同上） |
| `behavior_verified` | `behaviorCheck`（§3.3）, `evidenceRefs`（覆盖 T1-T5 事件） | §7.4 谓词 P1-P5 全部通过 |
| `not_consumed` | `subtaskId`, `closeReason` | subtask 关闭时该 (subtaskId, assetId) 无 T4 事件 |
| `verification_failed` | `behaviorCheck`（result=FAILED）, `reason` | P2 或 P4 失败的事实记录 |
| `unresolved` | `behaviorCheck`（result=UNRESOLVED）, `reason` | P1/P3 失败或降级的事实记录 |

### 7.4 Behavior verification predicates（machine-checkable）

`execution_observed → behavior_verified`（T6）当且仅当以下谓词**全部**为真；任一为假 ⇒ N2/N3（结果永不是 VERIFIED，也不得是 consumed/PASS）：

- **P1（receipt 完整性）**：`artifacts/<subtaskId>/receipt.json` 存在、schema 合法（§3.4）、`result` 缓存与事件重放一致。缺失/违约 ⇒ `RECEIPT_INCOMPLETE` / `RECEIPT_INVALID`，UNRESOLVED。
- **P2（source hash 一致性）**：T6 时点重算的 `sha256(manifest 字节)` == T1.sourceHash == 每个 `sourceHashEcho`（全链一致）。不一致 ⇒ `RECEIPT_HASH_MISMATCH`，FAILED（GWT-R3-04：稳定错误码，资产行为不得被标记 verified）。
- **P3（事件链完整）**：T1-T5 事件齐备且 hash 链连续（`sourceHashEcho` 逐环相等；`artifactSha256` == T6 时点 artifact 字节 sha256）。断裂 ⇒ UNRESOLVED。
- **P4（反回显谓词，anti-echo）**：对 T5 产物做归一化（大小写折叠 + 去空白）后，**移除**以下内容——激活记录的 `anchor`（`prompt.mjs:79-82` 同源：正文首个标题）、`Kernel:` 行内核 token 集（`prompt.mjs:88-90` 同源）、宿主注入指令明示复述的 token（`exec-host-generic.mjs:82-83`）、以及投递 payload 的逐字节片段——剩余实质内容必须**非空**。剩余为空 ⇒ 该产物是 marker-only / copier-only 证据，reason `EVIDENCE_ECHO_ONLY`，FAILED。P4 的机验实现必须首先通过 §7.7 的 7 个 C6 case 回归（全部不得 VERIFIED）。
- **P5（证据类别合法性）**：`evidenceRefs` 所指事件中不存在以 legacy `assetConsumed` 布尔或 marker-presence（锚点/内核词字符串包含）作为验证依据的记录；该两类记录只能以 telemetry 身份存在于链外（§8.3）。
- **诚实边界**：P1-P5 是行为验证的**必要条件地板**（fail-closed：回显型与 copier 型证据永远过不去），**不是**"方法论真实被应用"的充分证明；更强行为验证（如产物与资产方法论的结构对应性审查）= `[待补充]`，留给 Owner/R4 在 receipt 消费侧决断，本契约不发明不可机验的"理解度"判定。

### 7.5 Failure handling（失败语义汇总）

| 失败 | 触发谓词 | 操作面错误码（稳定） | receipt 侧收口 | 禁止 |
|---|---|---|---|---|
| 激活输入非法 | §2.1 形状检查 | `INPUT_INVALID` / `ASSET_NOT_FOUND` / `ACTIVATION_MODE_UNSUPPORTED` | 无事件写入 | 静默降级为可用包 |
| body 缺失 | manifest 不可读 | `ASSET_BODY_MISSING` | 无事件写入（fail-closed，不投递） | 注入占位文案继续投递（现状 `prompt.mjs:17` 行为在 bounded 模式下即 defect） |
| 资源缺失 | subtask 请求的路径不存在 | `RESOURCE_NOT_FOUND` | 无事件写入（fail-closed） | 静默跳过缺失资源 |
| 预算超限（仅当显式给 limit） | 估算 > limit | `ACTIVATION_BUDGET_EXCEEDED` | 无事件写入（block，fail-closed） | 无诊断截断投递 |
| sourceHash 失效 | P2 任一环不等 | `RECEIPT_HASH_MISMATCH` | N2 `verification_failed`；旧事件保留为历史证据，不得改写（PRD0 §9.3.6） | 覆盖/删除旧 receipt；把失效产物重算为有效 |
| receipt 缺失/不完整 | P1 失败 | `RECEIPT_INCOMPLETE` | N3 `unresolved` | 崩溃；或无诊断当作已验证 |
| receipt 事件违约 | schema/跃迁/幂等冲突 | `RECEIPT_INVALID` | 拒绝追加，文件不变 | 静默丢弃事件 |
| 降级（executor 失败/空输出） | `degraded` 响应 | —（`ok:true` + `degraded`，现状语义） | N3 `unresolved` / reason `DEGRADED_NO_EXECUTION` | 计为消费或 VERIFIED |
| 选中未消费 | subtask 关闭无 T4 | —（决策结果非错误） | N1 `not_consumed`（进 `data`，不进 error） | 输出 consumed/PASS（GWT-R3-03） |

### 7.6 Idempotency and storage

- **存储布局**：per-artifact，`artifacts/<subtaskId>/receipt.json`（`[Owner决断 2026-09-13]`）；append-only 事件数组（§3.4）；增量读写走 `store.mjs` 增量层，不混进旧 plan 字段 `[计划输入 PRD0 §7]`；不写 `vendor/`。
- **幂等**：键 = `idempotencyKey`（建议 `subtaskId + assetId + transition + evidence 哈希`，`[草案]`）。同键 + 字节等价事件 ⇒ 幂等返回既有 `receiptRef`，文件不变；同键 + 不同 payload ⇒ `RECEIPT_INVALID`。`recordedAt` 显式豁免。重试 = 新 `idempotencyKey`（§2.2）。
- **并发**：同 receipt.json 的并发追加由 store.mjs 增量层串行化（现状增量写机制的复用，不新增并发协议）`[草案]`；`eventSeq` 连续性是完整性校验的一部分（P1）。
- **回放**：任何消费方（R4 gate、R5a 投影、R6 复核）从事件数组重放推导状态；缓存 `result` 仅作加速，重放不一致 ⇒ `RECEIPT_INVALID`。

### 7.7 C6 regression fixture set（7 case 最小回归集）

C6 探针的 7 个边界 case（`test-reports/C6-design-20260912/DESIGN.md` §5 + 执行报告 §2；两次运行结果与设计常量全部一致 `[C6实测]`）是本契约验证谓词的**最小回归 fixture 集**：任何 receipt 验证实现必须在这 7 个 case 上产出下表"receipt 语义"列的结果；**legacy 观测列**记录 C6 实测的 assetConsumed 行为，作为缺陷证据基线（3/7 case 被现状布尔误判为已消费）。

| case | legacy 观测（C6 实测） | receipt 语义（P1-P5 判定） |
|---|---|---|
| `title-only-with-kernel` | `assetConsumed=false` | FAILED（P4：移除 anchor 后无实质内容，`EVIDENCE_ECHO_ONLY`） |
| `title-only-without-kernel` | `assetConsumed=true` ← **缺陷证据** | FAILED（同上：非 kernel 资产的纯锚点回显在 P4 下同样不通过） |
| `title-plus-kernel-word` | `assetConsumed=true` ← **C6 reproduction case** | FAILED（P4：anchor+1 内核词回显被拒绝） |
| `unrelated-prose` | `assetConsumed=false` | UNRESOLVED（P3：无 T4/T5 事件链，产物不与任何投递关联；即使有链，P4 剩余内容与资产方法论无关联性判定留给消费侧） |
| `kernel-word-only-no-title` | `assetConsumed=false` | FAILED（P4） |
| `fake-methodology-repeat5` | `assetConsumed=true` ← **缺陷证据**（重复回显不增加信息，布尔已饱和） | FAILED（P4：重复的 anchor/kernel token 移除后无实质内容） |
| `empty-output` | `degraded`（无 assetConsumed 字段，归一 false） | UNRESOLVED（无 T5：`DEGRADED_NO_EXECUTION`） |

- 关键性质：legacy 下 3 个 case（`title-only-without-kernel`、`title-plus-kernel-word`、`fake-methodology-repeat5`）观测为"已消费"；本契约下 **7/7 case 均不得 VERIFIED**。该 7 case 集是 P4 的回归门（P4 的机验实现必须先过它，再谈其他产物的判定）。
- fixture 内容（anchor/内核词的精确文本）随快照资产正文派生（DESIGN §5 注：echo 内容派生自快照 SKILL.md，expected 判定为固定常量）；本契约固定的是上表右列语义与左列 legacy 观测的对应关系，不重述 fixture 字节。

### 7.8 Compatibility with `assetConsumed` boolean（定稿）

- 兼容义务（handoff 指定，保留）：pre-R3 产物中的**裸布尔** `assetConsumed=true` 必须被 R3 层无破坏处理（§8.3）；subtask 产物缺 receipt 字段必须优雅降级、不得崩溃（§8.3；清单场景 8）。
- **裸布尔读法（`[Owner决断 2026-09-13]`）**：legacy `assetConsumed=true` 是 **telemetry-only** 字段——可读、计为 legacy 观察、可进入 dual 报告对账，但**永远不能单独或组合地满足 phase gate**（gate 输入 = receipt 事件链的 behavior_verified 判定，属 R4 消费）；不能升级为 behavior_verified，不能参与 P1-P5 的任何谓词。
- 三模式读法（§8.1）：`legacy` 模式下布尔按现状读法原样保留（该模式整体是现状快照）；`dual`/`strict` 模式下布尔只进 telemetry 通道。
- marker / telemetry 与验证证据的分离规则：`assetConsumed` 布尔、锚点回显、内核词回显统称 weak telemetry；weak telemetry 可与 receipt 事件**并存**（便于对账与 R6 复核），但验证判定（§7.4）对 weak telemetry 视而不见。

---

## 8. Compatibility and migration

### 8.1 三模式 `[计划输入 PRD0 §9.2]`

| mode | 保证 |
|---|---|
| `legacy` | 现状行为逐字保留：全文 brief（`prompt.mjs:52-54` 原样）、回显型 `assetConsumed` 布尔（L107-108 原样）、degraded 语义、CLI exit code。新契约字段可以缺席，不得出现。裸布尔 `assetConsumed=true` 按现状读法处理（该模式即现状，不含 receipt 事件写入）。 |
| `dual` | bounded 激活/投递 + legacy 形状并行输出（增量字段叠加；两路结果都进 evidence；对账文件惯例沿 C-R2 清单 C2r 的 Owner 补充：dual 两路必须落可机读对账文件）。receipt 事件写入生效；裸布尔只作 telemetry。 |
| `strict` | 本契约全量生效：三级激活、有界投递包、receipt 事件链与 §7.4 谓词生效；behavior_verified 只能由 §7 产生。phase gate blocking 语义属 R4 消费侧（MW3）。 |

- mode 载体 flag：**复用 `YY_RECEIPT_MODE=legacy|dual|strict`，不新增激活 flag**（`[Owner决断 2026-09-13]`，框架草案 OQ-R3-6 决断记录见 §10；PRD0 §9.2 五 flag 清单不变）。
- mode 值非法 ⇒ `ACTIVATION_MODE_UNSUPPORTED`（§2.1），禁止 silent fallback。
- 安全与破坏性 gate 不因 mode 降级（PRD0 §9.2 通则）。

### 8.2 迁移窗口与永不删除 `[计划输入]`

- 迁移窗口 `MW0-MW4`（PRD0 §9.1）：MW0 双读旧/新、不自动改写旧文件；MW1 新路径单写；MW2 旧弱字段（裸布尔）与新 receipt 双报告；MW3 Owner 确认后启用 strict blocking gate（gate 消费 receipt 的 behavior_verified；裸布尔不在输入集）；MW4 另立变更单清理旧字段。R3 契约层只定义各窗口的读法要求；窗口推进的执行与验收属 R6。
- R3 期间**永不删除**：`assetConsumed` 字段（裸布尔形态）、brief.md 产物与其路径约定、adapter `run()` 签名与返回键、degraded 文案语义、`loadAssets` 返回形状、`.tt-state/assets-cache.json` 缓存形状、CLI flag 集、brief 的 `## 方法论正文（资产全文）` 标题锚（§5.2，`[Owner决断 2026-09-13]`）。

### 8.3 Legacy 产物与 receipt 缺失的降级规则 `[草案， handoff 义务 + Owner决断 2026-09-13]`

| 输入 | bounded/dual/strict 读法 | 禁止 |
|---|---|---|
| pre-R3 产物：`assetConsumed: true`（裸布尔，无 receipt） | 可读、不崩溃；计为 legacy 观察（telemetry-only）。**不能单独或组合地满足 phase gate**；不能升格为 behavior_verified | 静默把裸布尔升格为"已验证"；或因缺 receipt 结构而抛异常/崩溃；或把它当作 gate 输入 |
| pre-R3 产物：`assetConsumed: false` 或字段缺失 | 同上；缺字段的 subtask 产物 = receipt-missing 场景，降级为带诊断的"未验证"视图（清单场景 8；谓词面 = §7.4 P1 失败 → UNRESOLVED / `RECEIPT_INCOMPLETE`） | 崩溃；或无诊断地当作 PASS/已验证 |
| sourceHash 失效（文件字节已变） | `RECEIPT_HASH_MISMATCH` 通道（§7.5 → N2）；旧产物保留为历史证据，不得改写（PRD0 §9.3.6：回滚不能把已发生的真实执行改写为成功） | 覆盖/删除旧 receipt；把失效产物重算为有效 |

### 8.4 回滚 `[计划输入 G2.2 图 R3 兼容行]`

rollback = 关闭 bounded activation（mode 切回 `legacy`），恢复 legacy adapter 路径；已写入的 receipt 作为 additive 诊断保留。回滚记录 flag、commit、受影响 session、快照路径与恢复验证结果（PRD0 §9.3.5）。

---

## 9. Change control

沿 G2.2 图 §8 change-control route（`[计划输入]`）：

1. 本契约冻结后任何变更 → discrepancy record 写入 `contracts/discrepancies/`（附原冻结 hash、变更理由、影响分类）。
2. Owner 以真实业务场景重新审查受影响条款。
3. 通过后以**新 hash** 重新冻结；旧冻结版本只读保留。
4. 下游 READY 失效：按 PRD0 §5.5 公式重算（R4/R10/R9/R6 等消费 `C-R3` 的节点退出 READY）；R7 机制可用后由 R7 执行精确失效。
5. 受影响的消费者（实现、adapter、测试）重新验收后才能恢复 READY。
6. `contracts/drafts/` 阶段（现状）的修订不需要 discrepancy record，但每次修订必须重算并登记文件 sha256（本版登记：见本文件头部版本沿革与完成报告 `test-reports/C-R3-receipt-completion-20260913/REPORT.md`）；draft 永远不解锁任务。

---

## 10. Owner decision record（2026-09-13 十项决断 — 框架草案 OQ 的收口）

框架草案 §10 的 OQ-R3-1…OQ-R3-10 已由 Owner 于 2026-09-13 全部决断；本表为决断记录（选项即决断结果），不再是待决断清单。后续新增决断点须走 §9 变更控制（draft 阶段为版本修订 + hash 登记）。

| OQ | 决断点 | Owner 决断（2026-09-13） | 落点 |
|---|---|---|---|
| OQ-R3-1 | 三级激活与投递包的 token 预算数值 | **首轮不设硬 token 预算，只记录估算值；数值保持 `[待补充]`** | §2.1、§3.1（budget/tokenEstimate）、§5.2、§6 |
| OQ-R3-2 | token 估算方法是否采用 CJK×0.75+÷4 量尺 | **采用，但仅作回归量尺，不是实测 token 的声明** | §6、§3.1 tokenEstimate.method |
| OQ-R3-3 | 预算超限动作 | **block，fail-closed**（truncate 路线排除） | §2.1、§5.2、§7.5 |
| OQ-R3-4 | 级别选择策略 | **Hybrid：metadata 用于 catalog/eligibility，body 为默认，resource 仅显式请求时** | §4.4、§2.1 |
| OQ-R3-5 | resource 级请求协议与缺资源处理 | **请求来源 = subtask 字段；缺失 ⇒ `RESOURCE_NOT_FOUND`（fail-closed）** | §4.3、§2.1、§7.5 |
| OQ-R3-6 | 激活侧 mode flag | **复用 `YY_RECEIPT_MODE`，不新增激活 flag** | §8.1 |
| OQ-R3-7 | 裸布尔 `assetConsumed=true` 是否可参与 phase gate | **telemetry-only，不能作为 gate 输入** | §7.8、§8.3、§8.2（MW3） |
| OQ-R3-8 | receipt 存储布局 | **per-artifact：`artifacts/<subtaskId>/receipt.json`** | §2.2、§7.6、§3.4 |
| OQ-R3-9 | 行为验证是否需要独立操作名 | **不需要：行为验证内嵌于 `receipt.append`（`behavior_verified` transition 事件）** | §2.2、§7.2 T6、§7.4 |
| OQ-R3-10 | brief 框架兼容边界 | **保留 `## 方法论正文` 标题原文（宿主解析锚不动）；段内改为有界内容** | §5.2、§8.2 |

仍开放（非决断点，为 `[待补充]` 事实缺口）：token/预算数值（待 Owner 给数或授权实测）；更强行为验证的充分性标准（§7.4 诚实边界，待 Owner/R4）。

---

## 附：本草案引用的全部实测/结构值速查

| 项 | 值 | 来源 |
|---|---|---|
| 资产数 | 16（10 skill + 6 agent） | R1 P6 |
| bodyBytes | p50 5,012 B；p95 16,369 B；min 1,009 B；max 16,369 B；总量 84,924 B | R1 cost group / C-R2 §3.1 |
| resourceBytes / overfetch | 总量 5,772,608 B；overfetch 30 = 46 nested − 16 entries | R1 P6 / C-R2 §3.1 |
| token 数 | `[待补充]`（R1 无 tokenizer；字节代理为实测；CJK 公式仅回归量尺） | R1 cost group 原文 + `[Owner决断 2026-09-13]` |
| 冷/暖读次数 | cold 每 entry 1 文件；warm 共 1 缓存文件（STRUCTURAL） | R1（`manifest.mjs:36`/`:60`） |
| 延迟（不外推） | cold median 10.195 ms；warm median 0.927 ms | R1 cost group |
| C6 探针 | 7 case，两次运行 results 一致（runStability `IDENTICAL`）；`title-plus-kernel-word` / `title-only-without-kernel` / `fake-methodology-repeat5` observed `assetConsumed=true`，其余 case `false`/`degraded` | C6 execution REPORT §1-§2、§7 |
| H9 上限 | SKILL.md ≤60 行且 CJK 加权 token ≤1500（资产维护 gate，非投递预算） | `validate-structure.mjs:382-397` |
