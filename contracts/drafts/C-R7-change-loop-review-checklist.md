# C-R7-change-loop — Owner 场景审查清单（DRAFT）

> 文档状态：`OWNER-REVIEWED / FROZEN-SOURCE / C-R7=FROZEN-SOURCE`（冻结源清单；OQ-R7-1…7 均经 Owner 冻结授权 2026-09-15 裁决为 A 并已吸收进期望列；「Owner 确认」列保持留空，冻结确认 = Owner 冻结声明，2026-09-15）
>
> 配套契约草案：`contracts/drafts/C-R7-change-loop.draft.md`（hash 登记见完成报告 `test-reports/C-R7-draft-20260915/REPORT.md`；已冻结，规范性版本见 `contracts/C-R7-change-loop.md`）。快照：`240f3fbdb4ee757dffc4d5ab80407d1b2c84863c`。
>
> 组织方式：按 R7 doc GWT 顺序 R7-01…R7-05（逐行）+ D 迁移/回滚 + E 审计/幂等补充行。每行必含：scenario / exact input / expected outcome / defect if（四要素）+ Owner 确认列留空。
>
> 判定规则（沿 C-R4 清单惯例）：**contract defect** = 冻结后的实现行为与本表「期望」列不符，或出现本表禁止的行为（全量回退、无审批静默推进、原地改写终态、删除旧证据、无备份迁移、重复创建记录等）。判定前本清单本身不是验收标准。
>
> 「期望」列预填来源 = 冻结输入（GWT-R7-01…05 原文、dev-plan R7 GWT 1-5、dev-plan:308 操作表、PRD0 §5.5/§6.2/§9.3）与 `[草案]` 提案（逐项标注）；「Owner 确认」列**全部留空**——冻结确认在冻结步骤另行复认，复认或改写即构成新决断记录。
>
> 范围说明：R7 = BLOCKED（G2.2 图 §4：R4 DONE + C-R7 FROZEN；本冻结源不解锁 R7）。R7 消费 R4 canonical state authority，不重定义状态机/transition/gate 谓词。OQ-R7-1…7 判据均为 `[Owner 决断 OQ-R7-N=A，2026-09-15]`，见使用说明 5。

## A. 影响分类与精确失效（GWT-R7-01/02/03）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R7-01 | document-only change（仅文档变更精确失效） | 提交一条 `change.record {impactClass: DOC_ONLY}`，仅改 PRD 措辞或验收细节，base plan/version、reason、owner、sourceEvidence 齐全 | 仅受影响的 PRD/设计/任务草案失效；已完成代码和已冻结契约保持有效（GWT-R7-01 原文 `[计划输入]`）；`invalidatedNodes` 仅含文档层节点，不含代码/契约节点；下游不受影响的节点 READY 不变 | 代码或已冻结契约被一并失效；或全部 READY 节点被清空（全量回退，违反 §0.1 前提 1）；或 `invalidatedNodes` 为空但实际有节点退出 READY（静默失效） | |
| R7-02 | contract-impacting change（契约变更级联失效） | 提交一条 `change.record {impactClass: CONTRACT}`，改接口或状态字段（按 OQ-R7-4 边界判据判定为 CONTRACT），base plan/version、reason、owner、sourceEvidence 齐全 + 有效 ownerApprovalReceipt（消费 `[R4冻结]` §5.2 schema） | 受影响契约 + 全部依赖的前端/后端任务退出 READY，回到 contract-reverse/Owner review（GWT-R7-02 原文 `[计划输入]`）；`invalidatedNodes` 含契约节点 + 其依赖任务；未提供有效 receipt ⇒ `CHANGE_OWNER_REQUIRED` fail-closed（§5.1）；不直接依赖该契约的任务保持 READY。触及任何冻结契约规范性内容（操作名/错误码/schema/状态词/谓词）即从严归 `CONTRACT`，仅 G2.2/PRD0/任务文档 ⇒ `TASK_GRAPH` [Owner 决断 OQ-R7-4=A，2026-09-15] | 契约变更未级联到依赖任务（失效不完整）；或级联到不相关任务（过度失效）；或无 receipt 静默推进；或 receipt 无效（非 owner/字段缺失/时点倒挂/跨作用域）仍通过；边界判据放行应归 CONTRACT 的变更、或误归 TASK_GRAPH 跳过 receipt | |
| R7-03 | implementation-impacting change（实现变更开新版本链） | 提交一条 `change.record {impactClass: IMPLEMENTATION}`，改运行时行为，base plan/version、reason、owner、sourceEvidence 齐全 | 新 PRD/plan 版本引用旧版本、reason、sourceEvidence、受影响任务清单（GWT-R7-03 原文 `[计划输入]`）；旧报告保持只读；终态节点（done/failed）不被原地改写，通过新链开启（§4.2，对齐 `[R4冻结]` §3.2）；`newVersionRef` 非空且 = 新文件路径+其 sha256；新版本号 = 顺序整数 v2,v3,…（不用 semver）[Owner 决断 OQ-R7-7=A，2026-09-15] | 旧报告被覆盖或改写；或旧版本被删除；或终态记录被原地追加状态；或新版本未引用旧版本/reason/受影响任务（版本链断裂）；或 `newVersionRef` 缺 sha256 / 用 semver / 新版本号与已有版本冲突 | |

## B. Fail-closed 与幂等（GWT-R7-04/05）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R7-04 | invalid record fails closed（无效记录不解锁任何节点） | 提交缺少 impact / owner / reason / sourceEvidence 任一项的 `change.record` | 返回 `CHANGE_RECORD_INVALID`（GWT-R7-04 原文 `[计划输入]`）；不解锁任何节点；canonical state 不变；非零 exit。若字段齐全但 impact class 无法判定 ⇒ `CHANGE_SCOPE_UNCLEAR`（§2.3） | 返回 ok:true 并解锁节点；或字段缺失仍创建空记录；或静默部分推进；或用 `CHANGE_SCOPE_UNCLEAR` 替代 `CHANGE_RECORD_INVALID` 放行字段缺失 | |
| R7-05 | idempotent replay（同一记录重放不重复创建） | 用相同幂等键 = canonical `sha256({basePlan, baseVersion, reason, impactClass, owner})`（§2.2，键序固定 [Owner 决断 OQ-R7-6=A，2026-09-15]）提交第二次 `change.record`；对照组：同键但 `sourceEvidence` 不同 | 不创建重复任务、契约、tracker 或失效事件（GWT-R7-05 原文 `[计划输入]`）；重复提交 `ok:true` 返回既有 `changeRecordId`，`data` 指回原记录，`warnings` 记 `DUPLICATE_REPLAY`（不新增错误码）；READY 重算结果一致；同键不同 `sourceEvidence` ⇒ `CHANGE_SCOPE_UNCLEAR`（不放行也不重放） | 第二次提交创建了重复节点/记录；或第二次提交产生额外 invalidation event；或第二次提交报错而非幂等 `ok:true`；或同键不同证据被当作新记录放行 / 或新增了重复错误码 | |

## C. Owner 审批与 C-R4 override 消费

> 对应 §3.3/§5.1（R7 消费 C-R4 §5.2 receipt schema，不重定义）。R7-06 行覆盖审批先于执行、rollback 失效、receipt 无效判定。

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R7-06 | owner approval consumption（R7 消费 C-R4 receipt，不重定义） | (a) CONTRACT 类变更 + 有效 ownerApprovalReceipt（approvalId/target/reason/approvedBy=owner/approvedAt/approvalEvidence=路径+SHA256/expiresAt=null）；(b) 同 receipt 用于不同 impact class；(c) receipt 的 approvedAt 晚于变更记录时间；(d) rollback 后引用 rollback 前签发的 receipt；(e) TASK_GRAPH / SECURITY 类变更 | (a) 变更记录创建 + 失效节点写入 + READY 重算；approvalId 双向引用（changeRecord ↔ approvalId）；目标状态带 override 标注可被下游辨识（消费 `[R4冻结]` §5.3）。(b) `OVERRIDE_NOT_ALLOWED`（消费 `[R4冻结]` §5.3；R7 不另立错误码）或 `CHANGE_OWNER_REQUIRED` 按因。(c) 无效（审批时点倒挂，`[R4冻结]` §5.2）。(d) 失效（rollback 前 approval 对 rollback 后变更一律失效，`[R4冻结]` §5.2）。(e) TASK_GRAPH 需 owner 字段命名、不需 receipt，变更生效以 G2.2 图重新 Owner CONFIRMED 为闸 [Owner 决断 OQ-R7-2=A，2026-09-15]；SECURITY 需 receipt + 全部安全相关验收强制重跑 [Owner 决断 OQ-R7-5=A，2026-09-15] | R7 另立 receipt schema；receipt 无效仍通过；审批时点倒挂仍生效；approvalEvidence 缺 SHA256；跨 impact class 复用同一 receipt；rollback 后旧 receipt 仍被接受；执行记录只写投影面不写证据层；TASK_GRAPH 强制要求 receipt（过度）；SECURITY 无 receipt 静默推进或漏强制重跑验收 | |

## D. 迁移与回滚

> 对应 §4/§6.3（rewind targets、新链纪律、supersede-not-delete、无备份不迁移）。R7-07 行覆盖版本切换快照、旧证据保留、终态不可追加。

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R7-07 | migration/rollback（新链纪律 + 无备份不迁移） | (a) IMPLEMENTATION 类变更触发版本切换（新版本号用顺序整数 v2,v3,…）；(b) 无快照即尝试版本迁移；(c) 变更后立即 rollback（标记 superseded + 恢复前一版本）；(d) 变更影响已 done/failed 的终态节点 | (a) 切换前先落快照（PRD0 §9.3.2，无备份不迁移）；新版本引用旧版本链（§4.2）且 `newVersionRef` 带新文件路径+sha256（顺序整数版本号，不用 semver）[Owner 决断 OQ-R7-7=A，2026-09-15]；旧证据只读保留。(b) 拒绝迁移（无备份不迁移，§8.2）。(c) 原 changeRecord 标记 `superseded`（supersededBy 指针）；前一 plan version 恢复；失败/回滚记录保留（审计链不断）；旧报告不删除。(d) 不原地改写终态；通过新链（新 sourceHash/新版本）开启（对齐 `[R4冻结]` §3.2 + C-R3 N2） | 旧文件被原地改写；无快照即迁移；回滚删除旧证据/审计 receipt；终态记录被原地追加；回滚把真实执行改写为成功（PRD0 §9.3.6）；版本链断裂（新版本未引用旧版本）；新版本号非顺序整数或用 semver | |

## E. 审计与 fail-closed 默认

> 对应 §5.2/§6.1（审计字段完整性、READY 重算精确性、evidence 缺失判定）。R7-08 行覆盖失效节点清单可查性、READY 重算非全量。

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R7-08 | audit trail + precise invalidation（失效清单可查、READY 精确重算） | (a) 任意 impact class 的 change record 生效后，读取其 `invalidatedNodes` 清单与 READY 重算结果；(b) change record 写入但 invalidatedNodes 为空；(c) 变更影响某节点的上游依赖 | (a) `invalidatedNodes` 非空且与依赖图一致（仅受影响节点 + 传递下游）；READY 重算按 PRD0 §5.5 公式执行；未受影响节点 READY 不变（§6.1）。记录本体落 `contracts/discrepancies/<changeRecordId>.json`（append-only）、索引落 `plans/active/changes/index.jsonl`，均可查 [Owner 决断 OQ-R7-1=A，2026-09-15]。(b) 拒绝（记录与节点清单必须同时写入，§5.3 原子性）。(c) 下游节点同步退出 READY（§3.2 级联规则） | `invalidatedNodes` 与实际 READY 变化不一致；全部 READY 节点被清空（全量回退）；记录已写但节点清单缺失；未受影响节点被误退出 READY；已完成证据被删除；change record 在 READY 输出中不可见（静默）；记录存放路径/命名与 OQ-R7-1 不符或非 append-only | |

## 使用说明

1. 「期望」列中标注 `[计划输入]` 的措辞来自冻结 GWT 原文（GWT-R7-01…05、dev-plan R7 GWT 1-5、dev-plan:308 操作表、PRD0 §5.5/§6.2/§9.3），标注 `[草案]` 的为本契约新提案——Owner 审查时对两类分别复认；对 `[草案]` 的改写构成新决断记录，须同步回写契约草案对应章节。
2. R7-02/R7-06 引用的 C-R4 ownerApprovalReceipt schema 与 override 执行记录语义来自 `[R4冻结]` §5.2/§5.3/§5.4；R7 不重定义这些 schema，只消费。审查时如发现 R7 草案对 C-R4 语义有任何弱化或另立，即 defect。
3. OQ-R7-1…7 均已由 Owner 冻结授权 2026-09-15 裁决为 A，判据吸收进本清单期望列与契约草案正文，逐处标注 `[Owner 决断 OQ-R7-N=A，2026-09-15]`；OQ 索引状态已置 DECIDED。
4. 本清单与配套契约草案状态为 OWNER-REVIEWED / FROZEN-SOURCE（drafts/ 目录，已冻结）：修订按 C-R4 惯例重算并登记 sha256；drafts/ 原件永远不解锁任务（G2.2 图 §8）。`route41Rerun.required = false`（路由零改动，措辞修订无路由变化）。
