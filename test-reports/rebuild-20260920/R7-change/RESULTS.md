# R7 rebuild results — `scripts/lib/change.mjs` 行为级重建（2026-09-20）

> 重建对象：`scripts/lib/change.mjs`（Requirements Change Loop / 需求变更闭环，C-R7-change-loop 契约实现）。
> 原文件未恢复（原 sha256 前 16 位 `3f37d9b5dedf7ce8`，见 `test-reports/impl-acceptance-20260915/REPORT.md` R7 段）。
> 重建依据（唯一权威）：`contracts/C-R7-change-loop.md`（FROZEN，2026-09-15，OQ-R7-1…7=A 已吸收）+ `contracts/C-R7-change-loop-review-checklist.md`（R7-01…R7-08 期望列）+ **幸存实物** `test-reports/change-record-r5ui-host-plugin-20260917/`（`record-change.mjs` 驱动 + `REPORT.md` 真实运行结果 `cr-20260917T035212Z-c2026fdf`）+ R7 验收报告 9 fixture 清单与 contract conformance 行。
> 风格对齐：`scripts/lib/evolution.mjs`（R10 重建参考实现；中文注释、响应壳、fail-closed 纪律）；canonicalHash/紧凑 id 口径对齐 `receipt.mjs`/`phase.mjs`。与 evolution 的关系按契约反向约束：R10 只读消费 change records，本模块零 import evolution。
> 新文件 sha256：`383366c03fc146159a33525a6400668e620d29bebd63da6d7364f7fdf24ee3d3`（883 行）。
> 增量纪律：仅新建 `scripts/lib/change.mjs` 与本目录；零既有文件改动；仅 node 内置依赖（fs/path/crypto）；未 commit。探针沙箱全部限制于本目录 `.sandbox/<pNN>/`，真实 `contracts/discrepancies/` 与 `plans/active/changes/` 未被创建/触碰。

## 1. 操作面（仅一操作，不新增操作名 [计划输入 dev-plan:308]）

| 操作 | 语义 | 输入（要点） | 输出 | 错误码 |
|---|---|---|---|---|
| `change.record` | 校验必填（§2.1）→ 判定 impact class（§3/OQ-R7-4）→ 精确计算失效节点（§3.2）→ owner 审批（§5）→ append-only 落盘（§5.2）→ READY 重算（§6.1）；全部通过才落盘 | input：`basePlan`/`baseVersion`/`reason`/`impactClass`/`owner`（dev-plan:308 四列原样）+ `sourceEvidence`（GWT-R7-04）+ `ownerApprovalReceipt`（CONTRACT/SECURITY 必需，[R4冻结] §5.2 八字段）+ `newVersionRef`/`newVersion`/`snapshotRef`（IMPLEMENTATION）+ `touchedFiles`（OQ-R7-4 机检，可选）。opts：`workspace`、`sessionId`、`recordedBy`、`dependencies`（G2.2 §2 edge 表）、`readyBefore`、`primaryNodes`、`securityNodes`、`terminalNodes`、`now/rand`（确定性注入） | shell `{ok, code, data: changeRecord(§2.2 schema), evidence: {invalidatedNodes, readyRecomputed, snapshotEcho, recordedAt}, warnings}`；重复提交幂等返回原记录 + `DUPLICATE_REPLAY` warning | `CHANGE_RECORD_INVALID` / `CHANGE_SCOPE_UNCLEAR` / `CHANGE_OWNER_REQUIRED`（仅 dev-plan:308 三原码） |

非操作面导出（消费面/探针复现用，同 phase.mjs `recordRollback` 惯例）：`supersedeChangeRecord`（§6.3 回滚证据面：新增回滚记录 + `supersededBy` 指针回填 + rollback 台账 + READY 恢复重算；幂等）、`listChangeRecords`（R8/R9/R10 只读消费面，R7 doc Dependencies）、`computeInvalidatedNodes`/`recomputeReady`（§3.2/§6.1 纯函数）、`canonicalIdempotencyKey`（OQ-R7-6=A）、`validateOwnerApprovalReceipt`、`formatChangeRecordId`、`run(op,input)` 分发、冻结常量（`IMPACT_CLASSES` 五类、`REWIND_TARGETS`、`OWNER_APPROVAL_REQUIRED_CLASSES`、`STATUS_VALUES`、`CHANGE_ID_RE`、`OWNER_RECEIPT_FIELDS`、`ERROR_CODES`）。

关键行为判定（契约裁决的机器落实）：

- **幂等键**（OQ-R7-6=A）= `sha256(JSON.stringify({basePlan, baseVersion, reason, impactClass, owner}))` 固定键序字面 JSON——已用幸存实物 REPORT.md §1 记载的 `3b244b29528d18641e8e20b50e750b0fcc1520c4d8599e102f0c9e081afd2292` **逐字节复现验证**（p12）；重复提交 `ok:true` + 原记录 + `DUPLICATE_REPLAY` warnings（不新增错误码）；同键不同 `sourceEvidence` ⇒ `CHANGE_SCOPE_UNCLEAR`。
- **失效传播**（§3.2）：CONTRACT/TASK_GRAPH/IMPLEMENTATION = primary + G2.2 edge 表传递下游闭包（实物复现：R5b → [R5b,R9,R6]）；SECURITY = 上述级联 ∪ `securityNodes`（OQ-R7-5=A）；**DOC_ONLY 仅失效 primary 本体、不向下游级联**——GWT-R7-01 [计划输入]（"completed code and frozen contracts remain valid"）优先于 §3.2.2 [草案] 级联规则（登记为重建判定，见偏差 §4.1）。禁止全量回退：未受影响节点 READY 不变逐探针断言。
- **owner 缺失类差异化收码**（§2.1 原文）：CONTRACT/SECURITY ⇒ `CHANGE_OWNER_REQUIRED`；DOC_ONLY/TASK_GRAPH/IMPLEMENTATION ⇒ `CHANGE_RECORD_INVALID`。
- **边界机检**（OQ-R7-4=A）：`touchedFiles` 中 `contracts/`（排除 `drafts/`、`discrepancies/`）= 冻结契约面，`plans/`、`docs/tasks/` = 图/文档面；低类声明触及冻结契约 ⇒ 从严升级 CONTRACT（升级 warning 显式、非静默），无 receipt 即拦截；仅图/文档面维持 TASK_GRAPH（不需 receipt，OQ-R7-2=A）。
- **IMPLEMENTATION**（GWT-R7-03/§4.2/OQ-R7-7=A）：`newVersionRef` 必需 = `<路径>#<sha256>`；版本号顺序整数 `v2,v3,…`（v1/semver/与已有版本冲突均 `CHANGE_RECORD_INVALID`）；`snapshotRef` 缺失拒绝（无备份不迁移 §8.2）；版本链 `changeRecordId → baseVersion → newVersionRef` 落入记录；终态节点命中仅 warning（不原地改写、走新链 §4.2.1）。
- **receipt 消费**（[R4冻结] §5.2，不重定义/不放宽，清单 R7-06）：八字段齐备（实物 REPORT.md §1 记载的首跑失败 = 缺 `reason` ⇒ `CHANGE_OWNER_REQUIRED`，补齐后成功——本重建复现该行为面）；`approvedBy='owner'`；`approvedAt` 先于记录时点（时点倒挂无效）；`expiresAt=null`；`target.scope='change'` 且 `scopeId = <basePlan>@<baseVersion>:<impactClass>`（跨类/跨基线复用拒绝）；`approvalEvidence = 路径#SHA256` 且文件字节可验；rollback 失效条款（rollback 前签发的 approval 对 rollback 后变更一律失效，OQ-R4-6=A）；同 receipt 跨变更二次消费拒绝（`.approvals-registry.json` 登记）。全部无效形态统一收口 `CHANGE_OWNER_REQUIRED`（清单 R7-06b 明示"按因"选项，见偏差 §4.3）。
- **存储**（OQ-R7-1=A，append-only）：本体 `contracts/discrepancies/<changeRecordId>.json`（write-once，永不覆写/删除）；索引 `plans/active/changes/index.jsonl`（追加行；`sessionId` 非空 ⇒ `plans/active/changes/<sessionId>/index.jsonl`，namespaced 下随 session）；`id` 形 `cr-<YYYYMMDDTHHMMSSZ>-<8hex>`（OQ-R7-3=A）。
- **回滚**（§6.3 supersede-not-delete）：新增回滚 change record（`supersedes` 指针、审计链不断）+ 原记录 `status/supersededBy/supersededAt` 三字段指针回填（R6 迁移报告记载的实物回填形态；全模块唯一允许的就地写入，本体证据不动）+ `plans/active/changes/rollbacks.json` 台账（供失效条款判定）+ READY 恢复重算；同键回滚重放幂等。

## 2. 探针表（run-probes.mjs，全部沙箱于 `.sandbox/<pNN>/`）

对照标准 = 契约 GWT-R7-01…05 + 清单 R7-01…R7-08 + R7 验收报告 9 fixture 清单（gwt-r7-01…05, approval-sec, audit-precise, rollback-supersede, taskgraph-boundary）；实际输出见 `out-probe-results.json`。

| probe | exit | ok | 断言 | 覆盖（契约小节 / 清单行 / 验收 fixture） | summary |
|---|---|---|---|---|---|
| p01-gwt-r7-01-doc-only | 0 | true | 11/11 | §3.1 DOC_ONLY 行/§3.2、§5.2、OQ-R7-1=A；清单 R7-01；gwt-r7-01 | DOC_ONLY 仅失效文档草案本体，下游代码/契约与无关节点 READY 不变（非全量回退）；布局落盘正确 |
| p02-gwt-r7-02-contract-cascade | 0 | true | 8/8 | §3.1 CONTRACT 行/§4.1、OQ-R7-2=A；清单 R7-02；gwt-r7-02 | 有效 receipt 下契约+依赖任务精确退出 READY（R5b/R9/R6，与实物 REPORT §1 一致），不相关分支 R8 保持 READY；rewind target=contract-reverse/owner-review |
| p03-gwt-r7-03-implementation-newversion | 0 | true | 24/24 | §4.2/§8.2，OQ-R7-7=A；清单 R7-03/R7-07；gwt-r7-03 | newVersionRef=路径#sha256；顺序整数 v2（v1/semver/版本冲突拒绝）；无备份不迁移；版本链三环；终态节点 warning 新链；旧报告字节只读 |
| p04-gwt-r7-04-fail-closed | 0 | true | 35/35 | §2.1/§7.1 fail-closed 行；清单 R7-04；gwt-r7-04 | 六类必填缺失逐项 `CHANGE_RECORD_INVALID`；owner 缺失类差异化收码；CONTRACT 无 receipt `CHANGE_OWNER_REQUIRED`+诊断；未知操作不发明码；全程零落盘 |
| p05-gwt-r7-05-idempotent-replay | 0 | true | 15/15 | §2.2/§6.2，OQ-R7-6=A；清单 R7-05；gwt-r7-05 | 重放幂等返回原 id + DUPLICATE_REPLAY（warnings 通道）；零新文件/零新增失效事件；READY 一致；证据集顺序无关；同键不同证据 ⇒ SCOPE_UNCLEAR |
| p06-approval-sec | 0 | true | 11/11 | §3.1 SECURITY 行/§5.1，OQ-R7-5/2=A；清单 R7-06e；approval-sec | SECURITY 无 receipt fail-closed；失效集=CONTRACT 级联 ∪ securityNodes；强制重跑 warning；跨类 receipt 复用拒绝；TASK_GRAPH 不强制 receipt |
| p07-receipt-validation | 0 | true | 39/39 | §3.3/§5.1/§5.3，消费 [R4冻结] §5.2；清单 R7-06；approval-sec | 11 类无效/越权 receipt 全部 `CHANGE_OWNER_REQUIRED`（含实物首跑缺 reason 形态、时点倒挂、expiresAt 非 null、scopeId 绑定、evidence 哈希失配）；二次消费拒绝；零落盘 |
| p08-audit-precise | 0 | true | 21/21 | §5.2/§5.3/§6.1/§7.1 evidence；清单 R7-08；audit-precise | evidence 恒四键；本体/索引/读侧三通道可查；闭包一致；未受影响 READY 不变；空失效清单拒绝（原子性）；上游变更下游级联 |
| p09-rollback-supersede | 0 | true | 19/19 | §4.2/§6.3，OQ-R4-6=A 消费；清单 R7-07c/d；rollback-supersede | 回滚记录+指针回填+旧证据零删除；READY 恢复；同键回滚幂等；rollback 失效条款（旧 receipt 拒绝/新签发放行）；历史不改写为成功 |
| p10-taskgraph-boundary | 0 | true | 10/10 | §3.1 OQ-R7-4=A 边界判据；清单 R7-02 defect 面；taskgraph-boundary | 仅图/文档 ⇒ TASK_GRAPH；触及冻结契约误声明 ⇒ 升级 CONTRACT + 无 receipt 拦截；+receipt 通过且记录为 CONTRACT；DOC_ONLY 触契约同样升级；drafts/discrepancies 豁免 |
| p11-shell-codes | 0 | true | 30/30 | §7/§7.1/§7.2；dev-plan:308 壳与码 | 五键壳成败一致；成功 code=null；三码面无发明码；data=changeRecord（§2.2 十三字段逐键在场）；ok:false 即 CI non-zero 语义；五类/回退目标/状态/receipt 常量面 |
| p12-storage-append-only-golden | 0 | true | 18/18 | §2.2/§5.2，OQ-R7-1/3/6=A；**幸存实物全量复现** | 指令文件逐字节复现 b70bcd4c…；幂等键逐字节= 3b244b29…；固定 now/rand 下 id=cr-20260917T035212Z-c2026fdf；invalidated/READY 与实物 REPORT §1 逐字一致；重放字节零变；namespaced index；非法 session fail-closed |

**TOTAL: 12/12 PASS（241 断言）；EXIT=0**

## 3. 全量自验

| 项 | 结果 |
|---|---|
| `node test-reports/rebuild-20260920/R7-change/run-probes.mjs` | 12/12 PASS，EXIT=0 |
| `node scripts/regression-all.mjs` | 12 PASS / 0 FAIL，exit 0（重建前后各跑一次一致） |
| `node scripts/validate-structure.mjs` | `[OK] 结构校验通过 (0 项警告)`——与重建前基线一致，无新警告（新模块可移植性泄露 0、U+FFFD 0） |
| 沙箱纪律 | 全部写入限制于 `test-reports/rebuild-20260920/R7-change/.sandbox/<pNN>/`；真实 `contracts/discrepancies/`、`plans/active/changes/` 未创建（探针后复查确认）；未触碰任何既有文件 |
| 增量纪律 | `git status` 新增仅：`scripts/lib/change.mjs`、`test-reports/rebuild-20260920/R7-change/`（`scripts/lib/remediation.mjs` 为并行任务产物，本模块未依赖、未改动）；未 commit |

## 4. 偏差与重建推断（行为级重建，非逐字节恢复；逐项标注依据）

1. **DOC_ONLY 不向下游级联（重建判定）**：§3.1 DOC_ONLY 行/GWT-R7-01 [计划输入]（"only the affected PRD/design/task draft is invalidated; completed code and frozen contracts remain valid"）与 §3.2.2 [草案] 通用级联规则存在张力；按冻结纪律 [计划输入] > [草案]，DOC_ONLY 失效集 = primary 本体。CONTRACT/SECURITY/TASK_GRAPH/IMPLEMENTATION 级联不受影响（实物 cr-20260917T035212Z-c2026fdf 的 [R5b,R9,R6] 逐字复现）。
2. **additive 记录字段（重建判定）**：§2.2 schema 之外，记录追加 `idempotencyKey`（幂等判定与审计所需；验收报告 conformance 行"canonical sha256"的载体）、`approvalId`（§5.2 审计字段行"若使用了 owner approval receipt：引用 approvalId"）、IMPLEMENTATION 追加 `newVersion`/`snapshotRef`/`touchedFiles`（OQ-R7-7=A 与 §8.2 机检载体）。同 receipt.mjs 对 canonicalHash 的 additive 处理惯例。
3. **receipt 失效统一收口 `CHANGE_OWNER_REQUIRED`（重建判定）**：清单 R7-06b 对"跨类复用"允许 `OVERRIDE_NOT_ALLOWED`（消费 R4 码）**或** `CHANGE_OWNER_REQUIRED` 按因——本重建统一取后者（R7 三码面内自洽，避免跨通道码混用），诊断文本逐形态区分。实物 REPORT.md 记载的首跑失败形态（缺 `reason` ⇒ `CHANGE_OWNER_REQUIRED`）逐字复现。
4. **`supersededBy` 指针回填为就地三字段写入（实物依据）**：契约 §5.2"追加式、supersede 通过新增记录 + supersededBy 指针实现，不原地修改"与 §6.3 步骤 1"新 change record 标记原记录为 superseded（supersededBy 指针）"组合读法 = 新增回滚记录 + 原记录指针回填；R6 迁移报告"cr-20260917T035212Z-c2026fdf.json supersededBy 指针回填"证实实物即此形态。回填仅限 `status/supersededBy/supersededAt` 三字段，本体证据零改写（p09 断言），旧文件永不删除。
5. **空 `invalidatedNodes` ⇒ `CHANGE_SCOPE_UNCLEAR`（重建判定）**：清单 R7-08(b) 冻结"拒绝"行为但未冻结码名；§2.3"受影响节点清单无法唯一计算 ⇒ CHANGE_SCOPE_UNCLEAR"为三码面内唯一契合码，且与 §5.3"记录与节点清单必须同时写入"的原子性一致。
6. **receipt 可选提供即校验（重建判定）**：DOC_ONLY/TASK_GRAPH/IMPLEMENTATION 不强制 receipt（OQ-R7-2=A"过度要求即 defect"）；但调用方主动提供时执行同一套 [R4冻结] §5.2 校验（fail-closed 方向，不放行无效 receipt），`approvalId` 记入审计。
7. **rollbacks 台账与 approvals registry 落点（重建推断）**：`plans/active/changes/rollbacks.json`、`plans/active/changes/.approvals-registry.json`——OQ-R7-1=A 只冻结记录本体/索引分工，未点名辅助台账落点；取 additive namespace 同目录（对齐 phase.mjs 的 `.tt-state[/session]/` 同目录惯例），不触碰 vendor/ 与冻结契约面。
8. **`recordedBy` 必填、`sessionId` 白名单（重建判定）**：§2.2 `recordedBy` 为 schema 审计字段，缺失按 fail-closed 收 `CHANGE_RECORD_INVALID`；`sessionId` 复用 phase.mjs §2.1 白名单 `^[A-Za-z0-9_-]+$`（namespaced index 落点防路径穿越）。
9. **验收报告 9 fixture 与本探针的映射**：gwt-r7-01…05 → p01…p05（+p08 深化）；approval-sec → p06+p07；audit-precise → p08；rollback-supersede → p09；taskgraph-boundary → p10。另加 p11（壳/码面）与 p12（实物 golden + append-only）两道结构门，合计 12 探针 241 断言，覆盖面 ≥ 原 9 fixture。
10. **契约冲突登记（契约优先）**：幸存 `record-change.mjs` 驱动脚本的 receipt 不含 `reason` 字段——与 [R4冻结] §5.2 八字段 schema 冲突；实物 REPORT.md 自证该形态首跑 `CHANGE_OWNER_REQUIRED`、补 `reason` 后成功，故以契约为准实现八字段校验，驱动文件按"实物为修正前版本"登记，不改其文件。

## 5. [待补充] 清单（fail-closed 保持待补充，禁止编造）

| 项 | 状态 | 本实现处置 |
|---|---|---|
| impact class 的自动判定器（从变更描述/差量推断五类） | 契约 §2.1"无法可靠判定 ⇒ CHANGE_SCOPE_UNCLEAR"语义存在，但判定算法无冻结规格 | 不实现自动判类（不编造）；`impactClass` 为显式输入，枚举外 fail-closed；`touchedFiles` 机检仅承担 OQ-R7-4=A 的 TASK_GRAPH/CONTRACT 边界复核（从严方向），不承担正向分类 |
| SECURITY"全部安全相关 gate/验收"的权威清单 | OQ-R7-5=A 冻结"级联 + 强制重跑"行为，未冻结 gate 名册（无实测值） | gate 名册由调用方经 `opts.securityNodes` 传入（缺省 = 仅 CONTRACT 级联面）；"强制重跑"以显式 warning 登记，重跑执行属验收面；不在模块内发明 gate 清单 |
| 回滚记录是否需 owner approval receipt | §6.3 回滚四步未列 receipt 要求；CONTRACT/SECURITY 回滚的审批形态无冻结规格 | 回滚记录仅要求 owner 字段命名（fail-closed），不强制 receipt；登记为开放问题待 Owner 裁决，不弱化正向 change.record 的 receipt gate |
| `baseVersion` 的强 schema（是否强制 sha256） | dev-plan:308 仅"base plan/version"；实物用 sha256，但 C-R3 N2"新链由新 sourceHash 开启"未回指本字段 | 只校验非空字符串，不强制 64hex（避免对合法版本标识误杀）；实物形态（sha256）为探针默认 |
| 索引的跨 session 聚合视图 | §5.2"namespaced 下随 session"未定义多 session 索引的合并读法 | `listChangeRecords` 以记录本体目录（全局 `contracts/discrepancies/`）为准聚合，索引仅追加留痕；不实现跨 session 索引合并 |

## 6. 覆盖契约小节总表

| 契约小节 | 覆盖探针 |
|---|---|
| §0.1 前提 1（精确失效禁全量回退）/前提 2-3（R4 只读消费） | p01/p02/p08（传播）、p06/p07（receipt 消费不重定义）、p09（回滚失效条款） |
| §2.1 输入四列与缺失后果（类差异化收码） | p04 |
| §2.2 changeRecord schema / changeRecordId 形 / 幂等键 | p11（schema 逐键）、p12（id 形 + golden 键）、p05 |
| §2.3 CHANGE_SCOPE_UNCLEAR 语义 | p05（同键不同证据）、p08（空清单）、p10（范围机检） |
| §3.1 五类失效/保留规则与 OQ-R7-2/4/5=A | p01（DOC_ONLY）、p02（CONTRACT）、p06（SECURITY/TASK_GRAPH）、p10（边界机检） |
| §3.2 失效传播（精确/级联/保留证据/fail-closed/R4 关系） | p01/p02/p03/p08/p09 |
| §3.3/§5.1/§5.3 owner 审批点、审计字段、不可抵赖、原子性 | p06/p07/p08、p09（回滚台账） |
| §4.1 rewind targets / §4.2 新链纪律（终态不可追加、supersede-not-delete、无备份不迁移、版本链、顺序整数、旧报告只读） | p03、p09、p10（REWIND_TARGETS 常量在 p02/p06 断言） |
| §6.1 READY 重算 / §6.2 幂等 / §6.3 回滚四步 | p01/p02/p08（重算）、p05（幂等）、p09（回滚） |
| §7 操作 schema（壳/输入/输出/错误码/fail-closed/幂等/原子性）+ §7.2 CI 行为 | p11、p04、p05、p08 |
| §8.1-§8.2 迁移纪律（无备份不迁移、旧证据只读） | p03、p09、p12（append-only） |
| 清单 R7-01…R7-08 | p01、p02/p06/p10、p03、p04、p05、p06/p07、p03/p09、p08 |
| OQ-R7-1…7（全部 DECIDED=A） | p12（OQ-1/3/6）、p10（OQ-4）、p06（OQ-2/5）、p03（OQ-7）、p05（OQ-6） |
