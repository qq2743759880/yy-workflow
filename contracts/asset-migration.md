# Asset Migration Contract v1 — 资产迁移状态机与三硬门（批 1，冻结面 contracts/）

> Contract 版本：`asset-migration@1.0.0`
> 变更单：contracts/discrepancies/（见文末变更单编号，change.record，B1-GATE，CONTRACT 类）
> 适用范围：AS 系列 replace 4（be-validator 引擎换 Spectral 等）与 AS-1 drop 7；AV-2 manifest drop_allowed 旗标、preflight.mjs P6 断言、S14/S15 回归段为机检面。
> 机制缘由：plans/execution-plan-v3-20260923.md §v3.1（Asset Migration Contract v1 adopt 核心，砍永久层）、§v3.2（三硬门 / DROP_ALLOWED=false 硬门 / 消费证据词汇）、§v3.3（单个 replace 先行验证）。

## 一、Migration State 机（replace 资产生命周期，六态）

每个被 replace 的资产处于且仅处于下列一态。状态记录于该资产的 change 单（contracts/discrepancies/）migration.state 字段；转移必须逐条留下证据引用（sourceEvidence），禁止跳态。

```
ACTIVE ──(影子跑夹具就位+baseline 快照)──▶ SHADOW
SHADOW ──(影子跑证据比对通过+promotion receipt)──▶ MIGRATING
MIGRATING ──(runtime binding 验证+旧路径拒绝探针通过)──▶ PRIMARY
PRIMARY ──(后续 replace 宣布弃用)──▶ DEPRECATED
DEPRECATED ──(drop 三条件全过+drop_allowed=true+收口核查)──▶ REMOVED
```

### 合法转移表（穷举，共 5 条）

| from | to | 触发条件（证据要求） |
|---|---|---|
| ACTIVE | SHADOW | Gate-0 baseline 快照（asset-baseline-before.json 逐资产 adapter/routes/consumption/manifest_hash）+ 影子跑夹具就位（见 §五） |
| SHADOW | MIGRATING | 影子跑 diff 消费证据通过（Design consumption CONFIRMED + Runtime consumption 证据，v3.2 词汇）+ promotion receipt 签发 |
| MIGRATING | PRIMARY | 三硬门全过（§三）；CLUSTERS candidates 完成切换（Traffic Switch = candidates 切换，v3.1 裁定） |
| PRIMARY | DEPRECATED | 新一轮 replace 宣布本资产弃用，新 SHADOW 启动 |
| DEPRECATED | REMOVED | drop 三条件缺一不可（candidate + runtime invocation + quality，v3.2）+ drop_allowed=true（§四）+ 6 处联动改收口核查通过 |

### 非法流转表（穷举，除上表外全部非法；高频误用逐条具名）

| 非法流转 | 为什么非法 |
|---|---|
| ACTIVE → MIGRATING | 未走影子跑（无 diff 消费证据）——"文件换了所以完成"自欺，v3.2 目标重述明令禁止 |
| ACTIVE → PRIMARY | 同上且连 CLUSTERS 切换都无过渡证据；五元组缺 old_asset/shadow_result |
| SHADOW → PRIMARY | 跳过 MIGRATING：runtime binding 未验证、旧路径拒绝探针未跑 |
| MIGRATING → SHADOW | 回退必须走 promotion receipt 作废 + 新 change 单（supersede-not-delete），不允许隐式回退 |
| PRIMARY → ACTIVE | 状态机无逆向激活；回滚走 Gate-5 rollback proof（new→simulate failure→rollback→old restore→receipt）后回 SHADOW 重验 |
| DEPRECATED → PRIMARY | 弃用不可撤销；重新启用 = 新 replace 走全流程 |
| DEPRECATED → REMOVED（drop_allowed≠true） | v3.2 硬门：无显式旗标的 drop 意图一律拒绝（preflight P6 + 回归断言双卡点） |
| 任意态 → REMOVED（非经 DEPRECATED） | REMOVED 唯一入口是 DEPRECATED；直接删除 = 绕过 drop 三条件 |
| REMOVED → 任意态 | 终态不可出；重引入 = 全新资产走注册三件套（manifest 三字段 + S8 锚点内核词 + CLUSTERS/matrix 更新） |

## 二、replace 五元组 schema（每个 replace 资产的 change 单必填）

```json
{
  "old_asset": "<vendor/<id>/ 路径 + 现态 adapter/路由引用清单（取自 Gate-0 baseline）>",
  "new_asset": "<新资产 vendor 路径 + 引入方式（clone/npm/自研）+ 许可证核查结论引用（AS-0）>",
  "shadow_result": {
    "fixture": "<影子跑夹具临时路径（跑完即删，见 §五）>",
    "evidence": "<新旧资产同 fixture 消费 diff 产物引用；Design consumption: CONFIRMED / Runtime consumption: <证据>>",
    "baseline_ref": "test-reports/asset-eval-20260923/asset-baseline-before.json#<资产行>"
  },
  "promotion_receipt": "<apr-* 格式 approval receipt；CONTRACT 类 owner approval，approvedBy=owner，expiresAt=null>",
  "runtime_binding": {
    "consumed_hash": "<runtime 实际消费产物 sha256>",
    "build_hash": "<manifest-build.mjs 构建产物 sha256>",
    "assertion": "consumed_hash == build_hash（Gate-2 机验）"
  }
}
```

五元组任一字段缺失或为空 → 该 replace 的 change 单不成立（CONTRACT 类 fail-closed，同 change.mjs CHANGE_RECORD_INVALID 口径）。

## 三、三硬门定义（v3.2 批 1 验收门，逐资产机验）

1. **Gate-1 legacy BLOCKED / EXPLICIT_COMPAT_MODE**：迁移期共存 ≠ 无限共存。旧 loader/旧路径的每次调用必须显式携带 EXPLICIT_COMPAT_MODE 旗标且留痕（debug 面可查），静默并存 = 门 FAIL；Phase 2 一律删除旧 loader。S15 段（migration invariants，AS-1 时填充）承接此断言。
2. **Gate-2 runtime consumed hash == build hash**：runtime 实际消费的 manifest/资产产物 sha256 必须等于 manifest-build.mjs 构建产物 sha256——防 runtime 走旧 buildManifest 绕过（第四位审计反例）；preflight P5（buildManifest 单源）为其静态面。
3. **Gate-3 replace 五元组**：§二 schema 五字段齐备且证据可回查（receipt 验证走 change.mjs validateOwnerApprovalReceipt 口径，不另立 schema）。

**门栈适用范围声明（v3.3 编排者补充，防"门的自嗨"）**：全量门栈（Gate-0 baseline freeze / Gate-1..3 / Gate-5 rollback proof / 影子跑 / 五元组）**只压首个 replace**（be-validator 引擎换 Spectral，AS-2-first，验收载体）；其余三个 replace 复制同一机器，证据负担**机械化为 wizard 式清单**（逐项勾选 + 产物引用，不再逐项重新论证）。禁四路并行 replace。

## 四、drop_allowed 旗标语义（v3.2 DROP_ALLOWED=false 硬门）

- 旗标挂两处：资产 change 单 + manifest 行（contracts/asset-manifest-v2.json 对应资产行）。
- **`drop_pending: true`（drop 意图标记）与 `drop_allowed: true`（放行标记）是两个字段**：任何 agent 可以标记 drop_pending（登记意图），但只有满足下列全部条件后才允许置 drop_allowed=true：
  1. drop 三条件全过：candidate（在 CLUSTERS/manifest 中）+ runtime invocation（连续两轮盲行零调用即触发评审；有真实消费记录则不可 drop）+ quality（资产质量评审结论）；
  2. 6 处联动改清单就绪（PHASE2 表 / CLUSTERS / matrix / validate 断言资产数 / kickoff 清单 / manifest 行数）；
  3. change 单（CONTRACT 类）在案且 promotion/drop receipt 链完整。
- 机检面：preflight.mjs P6——凡 drop_pending 行 drop_allowed 非显式 true → FAIL；无 drop 意图 → 全 PASS。**旗标防并行，流程序防护只防串行**（v3.2 裁定原文）。
- 旗标方向 fail-closed：字段缺失按未放行处理（drop_allowed 非 true = 拒绝）。

## 五、影子跑夹具规范（临时、跑完即删、不留永久制品）

1. 影子跑夹具 = 临时 workspace（os.tmpdir() mkdtemp 模式，同 regression S4-S8 先例）：同一 fixture 输入分别喂旧资产与新资产，diff 消费证据落 `test-reports/<replace 单>/shadow-<date>/`（证据落盘，夹具本身不落盘）。
2. **Migration Adapter 不得为永久制品**（v3.1"砍永久层"裁定）：影子跑期间的临时接线代码只存在于夹具临时目录，跑完即删；正式接线 = adapter 注册表 + CLUSTERS candidates 切换，走冻结流程。违胶水 ≤150 行纪律的永久迁移层一律拒绝。
3. 影子跑证据三件：新旧消费产物 diff、runtime invocation 记录、与 Gate-0 baseline 的对照结论。三者齐 = SHADOW→MIGRATING 的放行证据。

## 六、与既有机器的关系（只消费，不另立）

- 冻结流程：本契约自身走 change.record（CONTRACT 类，AV-1 同款单据格式）；后续 replace/drop 的 change 单同口径。
- 锁面：replace 施工文件经 plans/change-lock.json 建议性锁（scripts/change-lock.mjs），真强制力 = 派发拒发 + 收口 diff 归属核查。
- 回归面：S14（preflight invariants，B1-GATE 已接入）/ S15（migration invariants 占位，AS-1 时填充 EXPLICIT_COMPAT_MODE 门 / import 零命中 / manifest 路由断言 / 旧 adapter 不可达）。

## 变更单

| 项 | 值 |
|---|---|
| changeRecordId | cr-20260924T090000Z-b1g4te5c（contracts/discrepancies/ 同名 .json） |
| impactClass | CONTRACT（触及冻结契约规范性内容） |
| Owner 签收状态 | 本文档不复制品 mutable 签收状态（split-brain 方案 B，第十四审计 F-031）：Owner 签收状态唯一权威 = contracts/discrepancies/cr-20260924T090000Z-b1g4te5c.json（ownerSignOff 字段）；本文档只记录 changeRecordId，不复制 mutable status |
