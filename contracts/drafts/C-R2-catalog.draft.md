# C-R2-catalog — Catalog / Metadata / Route Contract (DRAFT)

> 文档状态：`DRAFT / OWNER-SCENARIO-REVIEW-REQUIRED / NOT-FROZEN / DOES-NOT-UNLOCK-R2`
>
> 本文是 `C-R2-catalog` 的草案，供 Owner 用真实业务场景逐条审查（配套审查清单：`contracts/drafts/C-R2-review-checklist.md`）。草案不冻结、不批准、不 READY；`contracts/drafts/` 永远不解锁任务（G2.2 图 §8 change-control route）。R2 READY 只能由 `R1 == DONE && C-R2 == FROZEN`（PRD0 §5.5）满足，冻结由 Owner 的 freeze 决定产生，本文无权自宣告。
>
> 快照：`240f3fbdb4ee757dffc4d5ab80407d1b2c84863c`（draft 于冻结提交之后的工作树中撰写；运行时事实全部引用该提交的 R1 baseline 证据与源码锚点）。
>
> 证据标签遵循本项目惯例：`[R1实测]` = R1 baseline 测量值；`[代码佐证]` = 冻结源码 file:line；`[计划输入]` = PRD0/dev-plan/G2.2 图条目；`[草案]` = 本文件新提出、需 Owner 决断的内容；`[待补充]` = 无实测值，禁止编造。

## 0. Grounding sources (read-only)

| source | used for |
|---|---|
| `test-reports/R1-baseline-20260911/`（schemaHash `8db3278d…fa9c4`，REPORT + `baseline/normalized-baseline.json` + `baseline/unresolved-probes.md`） | 16 资产实况、9 行路由实测、margin 结构、cache 读次数、负路径分类 |
| `scripts/lib/manifest.mjs`（66 行）、`scripts/lib/planner.mjs`（56 行）、`scripts/lib/matrix.mjs`（35 行）、`scripts/lib/asset.mjs`（78 行） | parser / 路由 / 簇表 / 缓存签名的现状机制锚点 |
| `plans/tasks/PRD0-contract-revision-v3.md` §2、§5.5、§7、§9.1、§9.2、§10 | MVP 边界、READY 公式、Catalog 文件映射与允许的增量、flags、迁移窗口、指标纪律 |
| `docs/yy-dev-plan-skill-loading-v3.md` R2 节 + 后端契约冻结顺序表（`:300-301` 两行） | 操作名、response shell、既有错误码、R2 文件范围、冻结顺序 |
| `plans/tasks/G2.2-task-graph-20260911.md`（sha256 `1C5756…DDF6`，Owner 已确认）§3 R2、§5 | GWT-R2-L1/L2/L3、C2 阻塞规则、mode flags、无字段删除承诺 |
| `plans/tasks/G2.2-owner-confirmation-20260911.md` | G2.2 = CONFIRMED、READY = {R1}、standing constraints |

R1 baseline 事实按 handoff 指示**只消费、不重推导**：16 内置资产（10 `skill` + 6 `agent`，零重复、零 parser warnings）；`campaign`/`email`/`painting` 全部误路由 `T3_AI_RAG_MCP`（margin 1/0）；2 个 description 为块标量标记（`agent-research`=`|`、`agent-vision-toolkit`=`>-`）；6/16 缺 `version`（全部 6 个 `agent` 型资产）；`database frontend` 静默首胜（T1 2/1，子串膨胀，`planner.mjs:25`）；无 `AMBIGUOUS` 状态；C2 `UNRESOLVED`。

---

## 1. Scope and non-goals

### 1.1 In scope `[计划输入]`

- 恰好 16 个 YY 内置资产（`vendor/` depth-1 目录，`buildManifest` 产出集合）；资产类型枚举 `skill | agent`（`skill` = `<dir>/SKILL.md`，`agent` = `<dir>/<name>.md`，`manifest.mjs:29-44`）。
- 现有宿主适配器（`scripts/lib/adapters/`：`prompt`、`opencode`、`bmad-cline`、`portman`、`sdlc`、`util`）的现有边界；本契约不为任何新宿主协议定义字段。
- Catalog 读取（`catalog.read`）与路由选择（`router.select`）两个操作的输入/输出/错误/幂等契约。
- Metadata 规范化不变量、诊断码、路由决策状态机、cache identity、兼容模式（`YY_CATALOG_MODE`）。

### 1.2 Non-goals `[计划输入]`

- 不做全机器技能发现，不扫描用户家目录或其他项目目录（PRD0 §2.2.2）；host-catalog-visible 形态不在 R2 范围（G2.2 图 GWT-R2-L1）。
- 不引入向量数据库、远程技能注册中心、模型微调、新的服务端运行时（PRD0 §2.2.5；dev-plan 选型表「不引入 vector DB」）。
- 不实现 Activation body/resource 生命周期（R3 范围，PRD0 §6.1）；启动 catalog 只读 metadata，不读正文与资源（dev-plan R2 GWT 5；R1 实测冷构建每 entry 恰好 1 个文件读取）。
- 不改变阶段授权、gate、session、receipt（R4 范围）。
- 不删除任何旧字段、旧 CLI、旧 manifest/state reader（G2.2 图 R2 节「no field deletion during R2」；PRD0 §2.2.4）。
- 本契约不修复 C2、不裁决 C2；`C2` 保持 `UNRESOLVED`。

### 1.3 Additive-only rule `[计划输入]`

对 `scripts/lib/manifest.mjs` 现有 façade（`buildManifest` / `loadManifest` 及其返回字段 `name/type/path/version/description/keywords/warnings/generatedAt`）只增不改：新增字段允许，现有字段语义与取值不允许变化（PRD0 §7 Catalog 行「保留现有导出作为 façade；增加 schema、diagnostics、source hash 和 parser version」）。

---

## 2. Operations

只携带 dev-plan 已列出的两个操作名，不新增操作名（dev-plan 后端契约冻结顺序表 `:300-301`）。

### 2.1 `catalog.read`

| 项 | 定义 |
|---|---|
| 语义 | 返回当前快照下 16 资产的 metadata 视图（§3 字段集）+ 诊断（§5）+ cache identity（§7）。只读 metadata 层。 |
| 输入 | `workspace`（目录路径）、`assetScope`（缺省 = 全部 16 个内置 id；白名单子集）、`refresh`（bool，缺省 false → 允许读缓存）、`mode`（缺省 = `YY_CATALOG_MODE` 环境值，缺省环境值 = `legacy`） |
| 输出 | shell（§6）`data: catalog`；`catalog.entries[]`（§3.1）、`catalog.diagnostics[]`（§5）、`catalog.cacheIdentity`（§7.2）、`catalog.scope`（echo 输入 scope）、`catalog.parserVersion`、`catalog.schemaVersion` `[草案]`（版本字段本身为 PRD0 §7 允许的增量） |
| 错误 | `CATALOG_INVALID`（内部 parse 失败）、`ASSET_SCOPE_INVALID`（scope 引用未知 id 或非法形状）`[计划输入 dev-plan:300]`；`CATALOG_MODE_UNSUPPORTED` `[草案]`（§8） |
| 幂等 | 相同输入 + 相同文件状态 ⇒ 相同输出（`generatedAt`/`cacheIdentity` 除外，二者须在 §7 定义为确定性派生或显式豁免字段）。允许写缓存文件（现状：`loadManifest` 写 `.tt-state/manifest.json`，`manifest.mjs:63-64` `[代码佐证]`），但缓存写不得改变返回数据，且不得写 `vendor/`。 |
| 只读保证 | 不修改 `vendor/**`、`scripts/**`、state、journey。 |

### 2.2 `router.select`

| 项 | 定义 |
|---|---|
| 语义 | 对一条任务输入返回路由决策（§4 状态机）+ 证据（margin/tie/candidates）。是 `route(taskText, manifest)`（`planner.mjs:18`）契约化后的读操作；不含 plan 构建（`buildPlan` 的 planId/subtasks 生成不属于本操作）。 |
| 输入 | `task`（string，必填，非空）、`catalog`（`catalog.read` 的输出引用或内联快照）、`phase`（可选，当前阶段，用于 eligibility）、`explicitAssets`（可选，显式指定资产列表 —— 显式指定 > 簇路由，dev-plan 选型表「explicit → phase eligibility → bounded lexical → abstain」） |
| 输出 | shell（§6）`data: {selected, candidates, margin, abstained}`（dev-plan `:301` 原文 shell）；`selected` = `{state, clusterId?, assetIds[]}`；`margin` = §4.6 结构；`abstained` = `{reason}` 或 null |
| 错误 | `ROUTE_NO_MATCH`、`ROUTE_AMBIGUOUS`、`ASSET_NOT_ELIGIBLE` `[计划输入 dev-plan:301]`；`INPUT_INVALID`（task 非法：缺失/非字符串/空白）`[草案]`；`CATALOG_INVALID`（引用的 catalog parse 失败）`[计划输入]` |
| 幂等 | 纯函数：相同 `(task, catalog, phase, explicitAssets)` ⇒ 相同决策输出。决策路径不得引用时钟或随机源 `[草案]`（现状对照：`route()` 本身确定；时钟只出现在 `buildPlan` 的 planId，不在本操作范围）。 |
| 不抛异常 | 本操作以 shell 返回失败（`ok:false` + `code`），不向调用方抛 `NoMatchError`；legacy 模式兼容例外见 §8.2 与 Owner 决断 OQ-9。 |

---

## 3. Schemas

字段命名尽量沿用 R1 baseline schema（`test-reports/R1-baseline-20260911/schema/C-R1-baseline.schema.md` §1）已冻结的名字，保证 R1 测量行可以无损映射进契约视图。

### 3.1 Catalog entry

| field | type | presence | grounding |
|---|---|---|---|
| `id` | string | required | R1 schema §1 `id` = manifest `name`；16 个实测 id 见 §9 |
| `type` | enum `skill\|agent` | required | R1 实测 10/6；判定规则 `manifest.mjs:29-44` |
| `sourcePath` | string（正斜杠） | required | R1 schema §1：`vendor/<id>/` |
| `manifestPath` | string | required | R1 schema §1：`vendor/<id>/SKILL.md`（skill）或 `vendor/<id>/<id>.md`（agent） |
| `bodyPath` | string | required | R1 schema §1：棕地布局下与 manifestPath 同文件，按现状如实记录 |
| `sourceHash` | sha256 hex | required | R1 schema §1：`vendor/<id>/<manifest file>` 字节 sha256；PRD0 §7 允许的增量「source hash」 |
| `metadataStatus` | object | required | R1 schema §1 原结构：`{type, namePresent, versionPresent, descriptionPresent, descriptionIsScalarMarker}`；`[草案]` 增补可选子字段 `unparsedFrontmatterKeys: string[]`（见 §5 DIAG-06） |
| `bodyBytes` | int | required | R1 实测字段（P6：body p50 5,012 B / p95 16,369 B，总量 84,924 B） |
| `resourceBytes` | int | required | R1 实测字段（P6：资源总量 5,772,608 B；overfetch 30 = 46 nested − 16 entries） |
| `triggerTerms` | string[] | optional | `[草案][CONTRACT_DRAFT_REQUIRED]` 声明式触发词。现状：16 个 manifest 均无 `triggers` 键（本轮逐文件 survey），现有关键词全部派生（§3.2）。该字段引入与否、与 `keywords` 的优先关系 = Owner 决断（OQ-4）。未冻结前实现不得假设其存在。 |
| `keywords` | string[] | required | Derived from `name` + `description` via bounded derivation (§5.1). Keyword expansion per Owner ruling 2026-09-12: see keyword-expansion table below. | 

#### 3.1bis Keyword expansion table (Owner ruling 2026-09-12)

| Cluster | New keywords | Rationale | Excluded keywords |
|---|---|---|---|
| T1_DATABASE | `migration`, `schema migration`, `分表`, `query`, `index`, `optimize` | T1-03/T1-04 coverage; 高特异性 | `迁移` (too generic), `优化` (too generic) |
| T2_BACKEND | `middleware`, `rate limiting`, `限流`, `队列`, `异步任务`, `任务队列`, `payment`, `provider abstraction` | T2-02/T2-03/T2-04 coverage | `邮件` (independent system), `服务` (too generic), `重构` (too generic) |
| T3_AI_RAG_MCP | `extract`, `structured output`, `字段提取` | T3-04 coverage | — |
| T4_FRONTEND | `色彩`, `配色`, `design token`, `palette`, `loading state`, `form`, `表单` | T4-03/T4-04 coverage | `token` (auth conflict), `error` (backend also has), `状态` (too generic) |
| T5_OPS | `审计`, `凭据`, `secret`, `明文`, `灾备`, `RPO`, `RTO`, `跨区域`, `disaster recovery`, `alerting`, `5xx`, `monitoring`, `监控` | T5-03/T5-04/T5-02 coverage | `gateway` (would tie with T2's `api` on API gateway input) |

| `keywords` | string[] | required（现状派生） | 现状机制：`manifest.mjs:13-16` 对 `name + ' ' + description` 按 `/[a-z0-9\u4e00-\u9fff]+/` 切分并保留分隔碎片 —— 即关键词是**标点/CJK 边界碎片**（R1 实测：16/16 资产的关键词全部为非实词碎片，C2 的 regex 类）。契约保留该字段向后兼容；修复其语义属 R2 实现，且受 C2 阻塞（§10）。 |
| `description` | string\|null | required | 规范化不变量（§9.3）：必须是 prose 或 `null`+诊断；禁止存储块标量标记字面量（`\|`、`>-`）。R1 实测：`colorize.description` = `The feature or component to colorize (optional)`（真 prose）；`agent-research`/`agent-vision-toolkit` 当前违规（C2 缺陷类）。 |
| `version` | string\|null | optional | 现状：10/16 有（全部 skill 型），6/16 缺失（全部 agent 型，R1 实测）。是否升为 required = Owner 决断（OQ-1）。 |
| `cacheIdentity` | object | required | §7.2 `[草案]`；R1 只测量了现状读次数与现状签名机制（`asset.mjs:12-22`），未测量任何候选 hash 方案的延迟。 |

### 3.2 说明：`triggerTerms` vs `keywords`（避免术语合并）

- `keywords`：现状派生字段（parser 产物，向后兼容保留）。
- `triggerTerms`：契约草案引入的**声明式**触发词位（若 Owner 批准）。dev-plan R2 文件范围含「16 个 `vendor/*` metadata」修改授权（G2.2 图 R2 节），因此补写 frontmatter 字段在 R2 范围内是允许的实现动作，但字段本身的契约地位必须先由 Owner 冻结。

### 3.3 Route decision

| field | type | grounding |
|---|---|---|
| `state` | enum `MATCHED\|NO_MATCH\|AMBIGUOUS\|INELIGIBLE` | R1 schema §2 resultState 枚举原样升级为契约状态机（§4） |
| `clusterId` | string\|null | R1 实测行 `cluster` 字段（如 `T2_BACKEND`） |
| `assetIds` | string[] | 簇 ∩ catalog 的候选（R1 实测行 `candidates`；`planner.mjs:36` 现状同义） |
| `margin` | object | §4.6；R1 实测行 margin 结构原样（`{topScore, runnerUpScore, tie, tieBrokenBy}`） |
| `abstained` | object\|null | dev-plan shell 字段；R1 实测现状恒 null（路由器无弃权能力 —— 该缺席本身是 R1 记录的观察） |

---

## 4. Route decision states

四状态机沿用 R1 schema §2 的枚举（该枚举是 R1 冻结测量词汇，不是本草案发明）。现状快照只有两个状态可达：`MATCHED`（首胜）与 `NO_MATCH`（`NoMatchError`，`planner.mjs:20,28,37`）；`AMBIGUOUS` 在现状实现中**不存在**（R1 OBSERVED_DEFECT）；`INELIGIBLE` 为 R1 schema 预留、未观测运行时到达。

### 4.1 `MATCHED`

- 条件 `[草案， grounded in R1 margin 结构]`：恰好一个簇（或显式资产集合）取得最高证据分，且 `topScore > runnerUpScore`，且 `topScore ≥ τ`（τ 为最低证据阈值，Owner 决断，OQ-2；现状等效 τ=1）。
- 返回：`clusterId`、`assetIds`（簇 ∩ catalog）、完整 margin。
- R1 实测锚点：`build backend login API` → `T2_BACKEND` 3/1；`design responsive page` → `T4_FRONTEND` 2/0。

### 4.2 `NO_MATCH`

- 条件：所有簇得分 0（`topScore = runnerUpScore = 0`）。
- 现状对照：`NoMatchError`（`planner.mjs:2,28`）；R1 实测 3 例 0/0 tie（`review security findings`、`find no matching nonsense`、`quantum crochet patterns`）—— 现状把「全 0 平局」按插入序首胜簇后因空候选而抛错，本质是 0/0；契约把 0/0 直接归 `NO_MATCH`，与 R1 实测分类一致。
- 错误码：`ROUTE_NO_MATCH`（shell 形式；legacy 抛错兼容见 §8.2）。

### 4.3bis Phase-aware review routing (A8-symmetric, Owner ruling 2026-09-12)

When input matches `/^review\s+/i`:

- If `phase ∈ {review, verification}` → route to the domain of the object (e.g. `review frontend code` → T4_FRONTEND, `review API contract` → T2_BACKEND, `review security findings` → T5_OPS)
- If `phase ∉ {review, verification}` → NO_MATCH (review intent not allowed outside review phases)
- A8 original rule (`review security findings` → T5_OPS) is subsumed by this rule

When input does NOT match `/^review\s+/i` → normal phase-aware routing (unchanged).

### 4.3 `AMBIGUOUS`（现状不可达 —— 使其可达是 R2 的验收点）

- 条件 `[草案]`：≥2 个簇取得**相等且非零**的最高分：`topScore == runnerUpScore > 0`。
- 返回：不选胜者；`assetIds` = 并列簇候选并集（或按 OQ-2 的 Owner 决定返回并列簇清单）；margin 带 `tie: true`、并列簇 id 列表 `[草案字段]`。
- 现状实现要产生该状态所需的条件变化 `[代码佐证 + R1实测]`：
  1. `planner.mjs:26` 的 `score > bestScore`（严格大于 → 插入序首胜）需要改为保留并列集合并显式判定；
  2. `planner.mjs:25` 的子串计分（`text.includes(keyword)`）使 `database frontend` 实测为 T1=2（`data` ⊂ `database` 膨胀）对 T4=1 —— 2/1 非平局，静默首胜。按词边界计分后同一输入为 1/1 平局，恰好落入 `AMBIGUOUS` 条件。匹配语义本身是 Owner 决断（OQ-3），本契约不预先绑死修复方案。
- R2 验收挂钩（G2.2 图 GWT-R2-L2）：修复后 `campaign`/`email`/`painting` 不得再路由 `T3_AI_RAG_MCP`，两个 no-match 输入仍弃权 —— 与 R1 baseline 对比陈述，不得编造新数值。

### 4.4 `INELIGIBLE`

- 条件 `[草案]`：证据分选出唯一簇/资产，但该资产在当前输入的 eligibility 谓词下不可派发。
- 现状已存在的 eligibility 机制锚点 `[代码佐证]`：
  - `planner.mjs:3-4` `FRONTEND_IMPL_ASSETS = ['implementation']`；`planner.mjs:7-11` `isFrontendImplementation`；
  - `matrix.mjs:5` T4 precondition「FR-3：contractMode:'frozen'，缺契约 CONTRACT_NOT_FROZEN skip」；`planner.mjs:52-54` `contractRequired` 标记。
- 两个候选语义，Owner 决断（OQ-6）：(a) 簇匹配但候选集与 catalog 交集为空（R1 schema 预留语义：cluster matched, zero intersect）；(b) 每资产 eligibility 谓词失败（如 `implementation` 缺冻结契约）。二者可并存：前者 = `INELIGIBLE` + `ASSET_NOT_ELIGIBLE` 空集；后者 = `INELIGIBLE` + 指名资产。
- 错误码：`ASSET_NOT_ELIGIBLE` `[计划输入 dev-plan:301]`。

### 4.5 状态优先级 `[草案]`

`explicitAssets 指定未知 id` → `ASSET_NOT_FOUND`（§6）→ 终止；`explicitAssets 指定已知但不合格 id` → `INELIGIBLE`；无显式指定 → 证据分 → `AMBIGUOUS` > `NO_MATCH` > `MATCHED`/`INELIGIBLE` 判定顺序为：平局先于首胜，零分先于一切，eligibility 检查只在有唯一胜者后进行。

### 4.6 margin / tie 证据结构

```text
margin = {
  topScore: int,          // 胜者证据分
  runnerUpScore: int,     // 次高簇证据分
  tie: bool,              // topScore == runnerUpScore
  tieBrokenBy: null | 'insertion-order',   // 契约目标态：MATCHED 下恒 null
  topClusters: string[]   // [草案] 并列簇 id（AMBIGUOUS 时 ≥2 项；MATCHED 时 1 项）
}
```

`{topScore, runnerUpScore, tie, tieBrokenBy}` 四字段为 R1 实测结构原样（R1 schema §2 + 9 行实测）；`topClusters` 为 `[草案]` 增量。

---

## 5. Metadata diagnostics（每失败类一个诊断码）

R1 观测到的失败类 → 一个诊断码；每个码带 id、severity、机器可查检测规则。severity 枚举 `info | warning | blocking` `[草案]`（现状快照无任何分类词汇 —— OBS-02 证实 `QUALITY_FAIL/QUALITY_WARN/BLOCKING_FAIL` 在快照中缺席；本枚举与 PRD0 §11 的 OBS-02 验收词汇对齐，但分类归属是 R4 的 CI-truth 工作，这里只定义 catalog 层诊断）。

| id | severity | failure class | machine-checkable detection rule | R1 evidence |
|---|---|---|---|---|
| `META_DESCRIPTION_BLOCK_SCALAR` | warning | description 为 YAML 块标量标记而非 prose | 归一化后 `description` 严格等于 `\|`、`>-`、`>`、`\|-`、`>\-`、`\|+`、`>+` 之一（trim 后字符串全等）；等价于 R1 `metadataStatus.descriptionIsScalarMarker` 的超集 | R1 实测：`agent-research`(`\|`)、`agent-vision-toolkit`(`>-`)，2/16 |
| `META_VERSION_MISSING` | warning | 缺 `version` | `metadataStatus.versionPresent == false` | R1 实测 6/16（be-architect、be-provider、be-resilience、be-validator、dev-planner、implementation —— 全部 agent 型） |
| `KEYWORDS_NON_PROSE` | warning | 派生关键词不含任何实词 token | 任一 `keywords[]` 元素匹配 `/^[^a-z0-9\u4e00-\u9fff]+$/i`（单反斜杠 regex，文件内字节稳定 —— C2 复现教训的文件化应用） | R1/C2 实测：16/16 资产 `punctuationKeywordCount=16`（文件化探针 `test-reports/C2-republication-20260911/`） |
| `META_DUPLICATE_ID` | blocking | 重复 id | 归一化 id 集 size < entry 数 | R1 实测 0 例（P6 probePass=true）；检测规则沿用 P6 fail rule |
| `ASSET_BODY_MISSING` | blocking | manifest 存在但 body 文件缺失 | skill 型：`SKILL.md` 不可读；agent 型：`<id>.md` 不可读 | R1 P5 实测：去掉 `vendor/colorize/SKILL.md` 的拷贝 → `warnings:["unrecognized asset: colorize"]` 且 entry 被丢弃、exit 0（`manifest.mjs:42-47`） |
| `ASSET_UNRECOGNIZED` | blocking | vendor depth-1 目录两者皆无 | 目录既无 `SKILL.md` 也无 `<name>.md`（`manifest.mjs:44-45` 同一分支） | 同上（现状两者共用一个 warning 文案；契约拆为两个码） `[草案拆分]` |
| `META_FRONTMATTER_UNPARSED`（DIAG-06） | info | frontmatter 存在无法归位的键（行式伪 parser 的产物） | `metadataStatus.unparsedFrontmatterKeys` 非空：键名 ∉ 允许集 | 本轮 survey 实测：`agent-vision-toolkit` 出现伪键 `Local vision CLIs`；`colorize` 出现嵌套伪键 `user-invokable`、`args`、`- name`、`required`（`manifest.mjs:7-9` 逐行 `indexOf(':')` 切分的必然产物） |

### 5.1 Suggestion rule (A5, Owner ruling 2026-09-12)

Allow suggestion if:
- `levenshtein(token, keyword) <= 2` (after `.toLowerCase()` normalization)
- AND `max(longest_common_prefix(token, keyword), longest_common_suffix(token, keyword)) >= 3`

This allows `frontned → frontend` (prefix `front` = 5 chars) while rejecting `form → from` (prefix `fo` = 2 chars).

规则：

1. 诊断只附加、不静默改数据（对照 R1 P5 `SILENT_SWALLOW`/`SILENTLY_NORMALIZED` 教训：本契约要求任何丢弃/归一化都必须伴随诊断行）。
2. `blocking` 级诊断 ⇒ 该 entry 不得进入 `selected` 候选集（可进 catalog 视图，带 `metadataStatus`）。
3. 检测规则全部是纯谓词（字符串全等、集合 size、正则），可由独立第三方逐条机验。
4. C2 阻塞声明：涉及 parser 语义的验收（块标量正读、嵌套 description、keywords 修复）在 C2 `UNRESOLVED` 期间只能产出 blocked-evidence（G2.2 图 §5 / GWT-R2-L3），不得完成 R2 验收。

---

## 6. Error codes and response shell

### 6.1 Response shell（成功与失败同构）`[计划输入 dev-plan:300-301 原文]`

```json
{
  "ok": true,
  "code": null,
  "data": { },
  "evidence": { },
  "warnings": [ ]
}
```

- `ok`：bool。true ⇔ 操作语义完成（含 `NO_MATCH`/`AMBIGUOUS` 这类**正常决策结果** —— 它们是 data，不是 error）。
- `code`：失败时为 §6.2 之一；成功时 `null` `[草案， OQ-7 由 Owner 定成功态取值]`。
- `data`：成功时的载荷（§2 表）；失败时 `data` 为 `{}` 或带部分诊断上下文，不得为 `undefined`。
- `evidence`：`{snapshot, parserVersion, schemaVersion, cacheIdentity, inputEcho}` `[草案字段内容， OQ-7]` —— 目的是让每条响应可对账到冻结快照与输入原文（R1 证据纪律的响应层映射）。
- `warnings`：§5 诊断码数组（机器可查），与人类可读文案分离。
- shell 键集在成功与失败间**完全一致**；唯一允许的差异是各键取值。

### 6.2 Error codes

| error class | code | grounding |
|---|---|---|
| invalid input | `INPUT_INVALID` | `[草案]` handoff 要求项；命名风格沿用 dev-plan 全大写惯例。适用：task 空白/非字符串、scope 形状非法（scope 引用未知 id 走 `ASSET_SCOPE_INVALID`） |
| unsupported mode | `CATALOG_MODE_UNSUPPORTED` | `[草案]` handoff 要求项；`mode` 值域本身 grounded（`YY_CATALOG_MODE=legacy\|bounded\|dual`，PRD0 §9.2） |
| asset not found | `ASSET_NOT_FOUND` | `[草案]` handoff 要求项（现状无对应错误 —— 现状未知资产只是不命中簇或被丢弃） |
| asset ineligible | `ASSET_NOT_ELIGIBLE` | `[计划输入 dev-plan:301]` 原码 |
| ambiguous match | `ROUTE_AMBIGUOUS` | `[计划输入 dev-plan:301]` 原码 |
| no match | `ROUTE_NO_MATCH` | `[计划输入 dev-plan:301]` 原码 |
| asset scope invalid | `ASSET_SCOPE_INVALID` | `[计划输入 dev-plan:300]` 原码 |
| internal parse failure | `CATALOG_INVALID` | `[计划输入 dev-plan:300]` 原码；catalog 层 parse 失败统一走此码（router.select 引用坏 catalog 时同样返回它） |

`[草案]` 码名的最终确认属于 Owner 场景审查（OQ-7）；本表不引入 dev-plan/PRD0 之外的新操作，码集合是 handoff 六个要求类 + dev-plan 已有四码的并集。

---

## 7. Cache identity

### 7.1 现状机制（只描述，不声称修复）`[代码佐证]`

- metadata catalog 缓存：`loadManifest` 直接读 `.tt-state/manifest.json`，**无任何失效校验**（仅 `refresh` 旗标强制重建，`manifest.mjs:56-61`）。
- 资产层缓存签名：`signature()` = sha1 over `entries.length + manifest.generatedAt + 每资产 (SKILL.md|<name>.md) 的 mtimeMs + size`（`asset.mjs:12-22`）；比较后决定命中或重建（`asset.mjs:45-53`）。`generatedAt` 每次新建都会变，使该签名跨进程不稳定（结构观察，非缺陷裁决）。

### 7.2 契约定义 `[草案]`

- `cacheIdentity`（catalog 级）= hash over：`parserVersion ‖ schemaVersion ‖ entries[].(id, sourceHash, metadataStatus)`。内容寻址（sourceHash），非 mtime 寻址。
- 每资产 `cacheIdentity` = 同一 hash 的 per-entry 投影，用于 R3 activation 层复用。
- 失效条件（全部）：任一 manifest 文件字节变化（sourceHash 变）；资产集合增删；parserVersion 变；schemaVersion 变。显式 `refresh=true` 绕过读缓存但仍须写回新 identity。
- cold/warm/changed-content 行为（只允许声明结构读次数，不得声称未测延迟）：
  - cold：每 entry 恰好 1 个文件读取（`manifest.mjs:36` `[代码佐证]`，R1 STRUCTURAL 标注）；
  - warm：总计 1 个缓存文件读取（`manifest.mjs:60` `[代码佐证]`，R1 STRUCTURAL）；
  - changed-content：签名不匹配 → 走 cold 路径重建并写回（`asset.mjs:48` 语义的 catalog 层推广）。
  - R1 实测延迟参考值（不得外推）：cold median 10.195 ms、warm median 0.927 ms（run1，5 runs）。
  <!-- 2026-09-12 rework: warm latency corrected from 0.662 (R1 REPORT.md:102 misattribution to run1; actual source = CRLF-contaminated worktree) to 0.927 (normalized-baseline.json run1.probes.cost.warmCatalogLatencyMs.median). -->
- `[待补充]` 内容寻址 identity 对 warm 路径读次数/延迟的影响 —— R1 未测量任何候选方案，禁止在此给出数字（OQ-5）。

---

## 8. Compatibility and migration

### 8.1 三模式 `[计划输入 PRD0 §9.2]`

| mode | 保证 |
|---|---|
| `legacy` | 现状行为逐字保留：`buildManifest`/`route` 现有返回形状、`NoMatchError` 抛出语义、现有 CLI exit code。新契约字段可以缺席，不得出现。旧 manifest/state/CLI 读取兼容（PRD0 §2.2.3）。 |
| `bounded` | 本契约全量生效：16 资产边界内的 schema、诊断、四态路由、shell。 |
| `dual` | bounded 语义 + legacy 形状并行输出（增量字段叠加；两路结果都进 evidence），用于 MW0-MW2 双读验证。 |

- 安全与破坏性 gate 不因 mode 降级（PRD0 §9.2 通则，适用于本 flag 的邻接集合）。
- mode 值非法 → `CATALOG_MODE_UNSUPPORTED`（§6.2）。

### 8.2 legacy 兼容细节 `[草案 → OQ-9]`

现状 `route()` 以抛 `NoMatchError` 表达 no-match（`planner.mjs:2`）。`legacy` 模式必须保留抛出语义（CLI exit code 依赖它）；`bounded`/`dual` 用 shell（`ok:true` + `state:NO_MATCH`，或 `ok:false` + `ROUTE_NO_MATCH` —— 二选一属 Owner 决断）。`dual` 模式下两语义并存时以 bounded shell 为响应、legacy 抛出仅记入 evidence。

### 8.3 迁移窗口与永不删除 `[计划输入]`

- 迁移窗口命名 `MW0-MW4`（PRD0 §9.1），与原型里程碑 `M3` 无关。
- R2 期间**永不删除**：旧 manifest 字段（`name/type/path/version/description/keywords`）、`.tt-state/manifest.json` 缓存形状、`NoMatchError` 类型与名称、CLI flag 集、`CLUSTERS` 现有键（`id/label/keywords/candidates/phases/contract/requireExec/preconditions`，`matrix.mjs:2-6`）。
- 目录整理先逻辑 namespace/index 后兼容迁移，禁止一次性 rename（PRD0 §7 末段）。

---

## 9. Frontmatter contract for the 16 assets

### 9.1 规范化字段集 `[草案；基础为逐文件 survey 实测]`

现状 16 manifest 实际出现的键：`name`、`description`、`version`（10 个 skill 型）；`name`、`mode`、`description`（6 个 agent 型）；另有伪键（§5 DIAG-06）。

| 字段 | 地位 | 规则 |
|---|---|---|
| `name` | required | 必须等于目录 id（现状 `manifest.mjs:33,39` 的容错：不一致时以 fm.name 覆盖 —— 契约改为不一致即 `META_FRONTMATTER_UNPARSED` 级诊断 + 保持目录 id 为准 `[草案， OQ-10]`） |
| `description` | required，prose | 非空、非块标量标记（§9.3 规则）；CJK 描述原样保留（`frontend-visual-validation`、`skill-sentinel` 为 CJK prose —— 现状实测），不做翻译/改写 |
| `version` | optional（升 required 与否 = OQ-1） | 现状 6/16 缺失且全部集中在 agent 型 |
| `mode` | agent 型 optional | 仅 agent 型 frontmatter 出现（现状实测），进 `metadataStatus` 观察不进路由 |
| `triggers` | reserved（OQ-4） | 若 Owner 批准 `triggerTerms`，此为声明位；未批准前任何 manifest 不得依赖它 |

### 9.2 body 约定（现状如实）

skill 与 agent 的 manifest/body 同文件（R1 schema §1 bodyPath = manifestPath）；拆分 frontmatter/正文是 R3 activation 的输入，不在本契约定义新格式。

### 9.3 块标量标记禁止存储规则（精确谓词）

```text
normalize(description):
  raw   = frontmatter 'description' 原始右侧值（未做块标量展开前）
  if trim(raw) ∈ {'|', '>-', '>', '|-', '>-', '|+', '>+'}:   # 字符串全等，含双字符标记
      return { description: null, diagnostics: [META_DESCRIPTION_BLOCK_SCALAR] }
  else:
      return { description: raw（prose 原样）, diagnostics: [] }
```

- 该规则是**输出不变量**（无论 parser 内部如何解析，catalog 存储层不允许出现标记字面量作为 description），因此它本身不被 C2 阻塞；
- 但「把块标量真正展开为多行 prose」的 parser 语义修复**被 C2 阻塞**：C2 `UNRESOLVED` 期间，受影响资产（`agent-research`、`agent-vision-toolkit`）的相关验收只能产出 blocked-evidence，R2 不得据此宣称 parser 语义验收完成（G2.2 图 §5 unlock 条件不变）。
- 后果声明 `[推演]`：规范化后这两个资产 `description=null` → 派生 keywords 退化 → 依赖 description 的路由证据减少；是否在冻结前先修 16 资产 metadata（R2 文件范围允许）由 Owner 决断（OQ-11）。

---

## 10. C2 handling（照 handoff 原文义务）

- `C2` 状态：`UNRESOLVED`（G2.1 verdict；R1 P4 携带未升级；C2-republication 探针是证据替换工程，不改状态）。
- 本契约中 parser 依赖字段/验收（keywords 语义修复、块标量展开、嵌套 description、伪键归位）全部标注 `CONTRACT_DRAFT_REQUIRED` / blocked-evidence；在 C2 解决前它们不能成为 R2 的完成依据。
- 结构性规划（本草案的 schema/状态机/迁移设计）不被 C2 阻塞（G2.2 图 §5「R2 structural planning may proceed」）。

## 11. Open questions for the Owner（场景审查时逐条决断）

| # | 决断点 | 现状事实 | 选项 |
|---|---|---|---|
| OQ-1 | `version` 是否升为 required | 6/16 缺失（全部 agent 型） | 保持 optional+warning / 升 required（需 6 资产补写） |
| OQ-2 | `AMBIGUOUS` 判定阈值 τ 与返回物 | 现状无 AMBIGUOUS；0/0 与 ≥1 平局均可能 | τ=1 任意非零平局即 AMBIGUOUS / τ=2 需多证据；返回并列簇清单 or 候选并集 |
| OQ-3 | 关键词匹配语义 | 子串计分（`planner.mjs:25`），`data`⊂`database` 实测膨胀 2/1 | 词边界 token 计分 / 保留子串+降权 / 声明式 triggerTerms 精确匹配 |
| OQ-4 | 是否引入声明式 `triggerTerms` | 16 manifest 均无 triggers 键 | 引入（R2 范围可改 vendor metadata）/ 不引入，仅修复派生 |
| OQ-5 | cache identity 寻址方式 | 现状 mtime+size+generatedAt（跨构建不稳，`asset.mjs:12-22`） | 内容 hash（本草案默认）/ 维持 mtime 系 + 补失效校验；warm 路径读次数影响 `[待补充]` |
| OQ-6 | `INELIGIBLE` 语义 | R1 预留未观测；现状唯一 eligibility 机制 = implementation 缺冻结契约 skip | 簇∩catalog 空集才算 / 每资产谓词也算 / 两者并存 |
| OQ-7 | shell 成功态 `code` 取值 + evidence 字段内容 | dev-plan shell 有 `code` 键但未定义成功值 | `null` / `'OK'`；evidence 内容按 §6.1 提案或裁剪 |
| OQ-8 | 诊断 severity 归类 | 现状无分类词汇（OBS-02 证实缺席） | §5 表的 warning/blocking 分配是否成立（尤其 `META_DUPLICATE_ID`/body 类 blocking） |
| OQ-9 | legacy 模式 no-match 语义 | 现状抛 `NoMatchError` | legacy 保留抛出（本草案默认）/ legacy 也走 shell |
| OQ-10 | `name` 与目录 id 不一致的处理 | 现状 fm.name 静默覆盖（`manifest.mjs:39`） | 目录 id 为准 + 诊断 / 维持覆盖 |
| OQ-11 | 2 个块标量资产的 metadata 修复时点 | `agent-research`/`agent-vision-toolkit` description 违规 | 冻结前修复（R2 vendor 范围内）/ 与 parser 修复同批（受 C2 阻塞连带） |
| OQ-12 | CJK 词元匹配规则 | CJK 无空白分词；现状 CJK 关键词（前端/页面/数据库等）靠子串命中 | CJK 词按最长子串匹配 / 按声明 triggerTerms 全词匹配 / 混合 |

---

## 附：R1 实测速查（本草案引用的全部测量值）

| 项 | 值 | 来源 |
|---|---|---|
| 资产数 | 16（10 skill + 6 agent） | R1 P6 |
| 路由实测 | `campaign`/`email`/`painting`→T3 1/0；`build backend login API`→T2 3/1；`design responsive page`→T4 2/0；`review security findings`、`find no matching nonsense`、`quantum crochet patterns`→NO_MATCH 0/0；`database frontend`→T1 2/1 静默首胜 | R1 P2/P5（9 行） |
| 块标量 description | 2（agent-research `\|`、agent-vision-toolkit `>-`） | R1 P6/P4 |
| 缺 version | 6/16（全部 agent 型） | R1 P6 |
| 缓存读次数 | cold 1 file/entry；warm 1 cache file | R1 STRUCTURAL（`manifest.mjs:36`/`:60`） |
| 延迟（不外推） | cold median 10.195 ms；warm median 0.927 ms | R1 cost group |
| token 数 | `[待补充]`（无 tokenizer；字节代理 metaBytes/bodyBytes 已测） | R1 cost group |

<!-- 2026-09-12 rework: warm latency corrected from 0.662 (R1 REPORT.md:102 misattribution to run1; actual source = CRLF-contaminated worktree) to 0.927 (normalized-baseline.json run1.probes.cost.warmCatalogLatencyMs.median). -->
