# AV-1 RESULTS — Asset Manifest v2 schema change.record（批 0，冻结面 contracts/）

执行：L1 独立执行 agent（autopilot 管线 v3，批 0）
日期：2026-09-23
派单：handoffs/v3/AV-1-dispatch.md
上下文：plans/execution-plan-v3-20260923.md §二/§四 AV-1；plans/asset-v2-frontend-plan-20260923.md §二

---

## 1. 交付物

| 交付物 | 路径 | 状态 |
|---|---|---|
| Schema 定义文档（新建） | contracts/asset-manifest-v2.md | 冻结稿（sha256 cea6f30d5155e2cac44…，Owner 签收前为待确认草稿态） |
| change.record 单（新建） | contracts/discrepancies/cr-20260923T040000Z-1a2b3c4d.json | 单号 **cr-20260923T040000Z-1a2b3c4d**，CONTRACT 类，Owner 签收位 PENDING |
| asset.mjs 消费端接口（仅加接口） | scripts/lib/asset.mjs | 新增 `readManifest` / `readManifestEntries` / `CANDIDATE_INVALID` 导出；既有 `loadAssets`/`signature`/`stripFrontmatter` 零改动 |
| 自测证据 | test-reports/autopilot-work/AV-1/{selftest.json, extraction-checks.json, record-consistency.json, manifest-valid.json, manifest-invalid.json, RESULTS.md} | 全部在本白名单内 |

## 2. change 单要点（cr-20260923T040000Z-1a2b3c4d）

- **单号/形状**：`cr-20260923T040000Z-1a2b3c4d`，符合 change.mjs `CHANGE_ID_RE`（cr-<YYYYMMDDTHHMMSSZ>-<8hex>）；`recordedBy: AV-1-L1-exec`；`status: active`；`supersededBy: null`。
- **impactClass = CONTRACT**：新建 contracts/asset-manifest-v2.md 触及冻结契约面（change.mjs OQ-R7-4=A 机检口径：contracts/ 下非 drafts/discrepancies 即冻结面）。
- **basePlan/baseVersion**：`contracts/asset-manifest-v2.md` @ 其文档 sha256（`cea6f30d…`）——与既有实物 cr-20260920T112945Z-a6244b0c 的 `<路径>#<sha256>` 口径一致。
- **幂等键**：按 change.mjs `canonicalIdempotencyKey` 固定键序 {basePlan, baseVersion, reason, impactClass, owner} 的 sha256，本机可复现（B2 PASS）。
- **schema 版本 + 迁移说明**：单内 `schemaVersion: asset-manifest-v2@1.0.0`；`migration` 字段含 from/to/4 步迁移路径/supersede-not-delete 回滚口径。
- **Owner 签收位**：`ownerApprovalReceipt` 按消费 [R4冻结] §5.2 八字段 schema 形态填写（approvalId/target/reason/approvedBy/approvedAt/approvalEvidence/expiresAt=null/relatedReceipts）；`approvalEvidence` 与 `ownerSignOff.status` 均为 **PENDING_OWNER_RECEIPT**——Owner 签发后回填 `<指令文件路径>#<SHA256>` 并置 SIGNED。签发前不得进 AV-2 施工。
- **反向验证**：用 change.mjs 自身 `validateOwnerApprovalReceipt` 跑本单 receipt → 拒绝（"approvalEvidence 缺 SHA256"），证明 fail-closed 通道对未签收单确实关闭（B7 PASS）。
- **单注明（按派单要求）**：16 行 v2 数据是内容不是代码，走冻结确认后进 manifest（contracts/asset-manifest-v2.json，AV-2 产出）；后续增改走 evolution.propose。

## 3. schema 文档要点（contracts/asset-manifest-v2.md）

- 每行 9 字段：`{id, name, role, capability, cluster[], when_to_use[], when_not_to_use[], verification, source}`；类型/必填性表格式定义。
- **提取源纪律（写进文档）**：提取源 = 每资产源文档头部既有结构化区（frontmatter + 首段）；缺源文档 → 手工补齐源文档，禁止生成器编造；缺必填字段 fail-closed 报 `CANDIDATE_INVALID`（与 evolution.propose 同口径）；空数组/空串按缺失罚。
- **when_not_to_use 新增能力**：activation 负向匹配命中 → 该资产从本任务 candidates 剔除并在 debug 面留痕（可解释、可探针）——写进字段语义与迁移说明。
- **AS 重组声明**：AS 系列 drop 7（be-architect/be-resilience/be-provider/colorize/frontend-visual-validation/agent-vision-toolkit/agent-research）后行数变化，**schema 不绑定 16**；AS-1 执行时按 drop 单增删行并重走 change.record。
- **16 行基线**：逐资产 role/capability/cluster/source 均为实测提取（16 资产清单与 CLUSTERS candidates 去重核对一致，C5 PASS）。两处如实标注 fail-closed：
  - `deep-research`：vendor/ 下存在目录但**无 SKILL.md/<id>.md 头部结构化区** → 行值标 CANDIDATE_INVALID，待补源文档后提取（禁止编造）；
  - `implementation`：implementation.md **无 YAML frontmatter**（实测）→ role 取首段首句，已在 source 列注明。

## 4. asset.mjs 接口自测（齐/缺两态；14/14 PASS，见 selftest.json）

| 用例 | 给定 | 期望 | 实测 |
|---|---|---|---|
| A1 readManifest 齐字段 | manifest-valid.json（9 字段全齐） | 返回行数组 | PASS（count=1, id=test） |
| A2 readManifest 缺字段 | manifest-invalid.json（缺 when_to_use/when_not_to_use/verification） | 抛 CANDIDATE_INVALID + missingFields | PASS（code=CANDIDATE_INVALID, missing=["when_to_use","when_not_to_use","verification"]） |
| A3 readManifestEntries 齐字段 | {entries: 全齐} | 返回数组 | PASS |
| A4 readManifestEntries 缺字段 | {entries:[{id:'x'}]} | 抛 CANDIDATE_INVALID（缺 8 字段具名） | PASS |
| A5 manifest 非数组 | {not:'array'} | 抛 CANDIDATE_INVALID | PASS |
| A6 空数组/空串必填字段 | cluster=[] / verification="" | 罚为缺失 → CANDIDATE_INVALID | PASS |
| B1..B7 | change 单一致性（baseVersion=sha256、幂等键复现、ID 形状、receipt 八字段、CONTRACT 类、PENDING 签收位、change.mjs 校验器反向拒绝） | 全过 | PASS |

fixture：manifest-valid.json（齐全样本）、manifest-invalid.json（缺失样本）落在本任务白名单目录。

## 5. 提取纪律实测（extraction-checks.json，6/6 PASS）

- CLUSTERS candidates 去重 = 16 资产，与 schema 文档 16 行一一对应；
- deep-research 有 vendor 目录但无源文档头部结构化区 → CANDIDATE_INVALID（不许编造，已如实标注）；
- implementation.md 无 frontmatter → role 取首段首句（不编造 description）。

## 6. 回归

| 项 | 命令 | 结果 |
|---|---|---|
| 结构校验 | node scripts/validate-structure.mjs | **[OK] 0 项警告**；H6a-1 reference/ 孤儿断言 PASS（零孤儿）——**未触发** |
| 一键回归 | node scripts/regression-all.mjs | **13 PASS / 0 FAIL**（S1..S13 全绿，含 S12 kickoff 漂移门）；全部写面静默后**连跑两次均 13/13**（S8 详情 exec=8 false(正)=0 false(负)=>1） |
| 回归时点 | 全部文件写静默后终跑 | validate 与 regression 均在 AV-1 全部写面完成后执行 |

**S8 偶发挂说明（中间过程记录，非终态）**：写面静默前的首次 regression 跑曾出现一次 `FAIL S8 资产消费证据`（exec 探针 subtask 落 prompt 桶）。诊断（证据 `s8-repro.mjs`，复现输出见下）：以与 regression-all S8 完全相同的命令行单独复现 → `modes: {"exec":8}`、首子任务 be-architect `assetConsumed: true`、plan.md 正确含锚点+内核词；随后两轮全量回归均 13/13。AV-1 对 asset.mjs 的改动为纯增量导出（`readManifest`/`readManifestEntries`/`CANDIDATE_INVALID`），`loadAssets`/`signature` 未动，prompt adapter 消费判定路径不经新接口——无因果面。判定为环境偶发（宿主 spawn 时序），非 AV-1 引入；已在终态复核两轮全绿确认。

## 7. D-偏差登记

- **D-AV1-1（说明性，非缺陷）**：H6a-1 孤儿断言实测**不触发**——该断言只管 `reference/*.md`（validate-structure.mjs:348 只扫 REF_DIR），contracts/ 新文件不在其面。派单预判的"D-偏差登记"路径未被需要；0 警告达成，未改任何既有断言/SKILL.md。
- **D-AV1-2（口径说明）**：本单为**静态单据**（JSON 落 contracts/discrepancies/），未调用 change.mjs `recordChange()` 落盘。原因：(a) recordChange 会对 CONTRACT 类强制要求有效 ownerApprovalReceipt（approvalEvidence=路径#真实SHA256 且 approvedAt 先于记录时点），而本单 Owner 签收位必须 PENDING 留给 Owner——若伪造已签收 receipt 即违反不可抵赖纪律；(b) recordChange 的 invalidatedNodes 语义是"READY 节点失效"，本单失效对象是"后续任务（AV-2/AV-3）须按新 schema 实现"，不是既有 READY 节点，强行传会污染 READY 重算。因此按既有实物 cr-20260920T112945Z-a6244b0c 的**单据格式**（含其 corrigenda 式的扩展字段先例）手写落盘，幂等键/baseVersion/scopeId/receipt 八字段全部按 change.mjs 口径机检可复现（B1-B7），Owner 签收后即可被 change.mjs 读侧（listChangeRecords）消费。**Owner 签发 approval receipt 后，如编排者要求，可用 recordChange 正式重放落盘（幂等键已预留）。**
- **D-AV1-3（数据范围）**：schema 文档 16 行基线中 `when_to_use/when_not_to_use/verification` 为占位（空），正式值由 AV-2 生成器提取填充——这正是本单迁移说明步骤 2 的内容；deep-research 行为 CANDIDATE_INVALID 占位（缺源文档），AS-0 vendor 后补。
- **D-AV1-4（时点说明）**：单内 approvedAt（2026-09-23T03:50:00Z）与 changeRecordId 时间戳（04:00:00Z）为单据形态预留值，Owner 实际签收以回填的 approvedAt/approvalEvidence 为准；签收前 approvalId 无消费记录（.approvals-registry.json 未登记），无二次消费风险。

## 8. 白名单核对

写入文件仅限：contracts/asset-manifest-v2.md（新建）、contracts/discrepancies/cr-20260923T040000Z-1a2b3c4d.json（新建）、scripts/lib/asset.mjs（仅加接口）、test-reports/autopilot-work/AV-1/*（证据）。SKILL.md/commands//webview//其他 scripts//既有 contracts 冻结件零改动；无 git 操作。
