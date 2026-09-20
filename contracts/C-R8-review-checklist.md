# C-R8-remediation — Owner 场景审查清单

> 文档状态：`C-R8=FROZEN`（2026-09-15 冻结；「期望」列按 2026-09-15 Owner 裁决 OQ-R8-1…7=A 更新；「Owner 确认」列**保持留空**——冻结确认 = Owner 冻结声明本身，沿 C-R4 先例 `plans/tasks/C-R4-freeze-20260914.md`）
>
> 配套契约（冻结）：`contracts/C-R8-remediation.md`；draft 原稿 hash 见完成报告 `test-reports/C-R8-draft-20260915/REPORT.md` 与冻结记录 `plans/tasks/C-R8-freeze-20260915.md`。快照：`240f3fbdb4ee757dffc4d5ab80407d1b2c84863c`。
>
> 组织方式：按 R8 doc GWT 顺序 R8-01…R8-05 + GWT-R8-L1（handoff 指定；GWT-R8-L1 来自 G2.2 图 R8 行原文）。每行必含：exact input / expected outcome / defect if / Owner 确认。
>
> 判定规则（沿 C-R3/C-R4 清单惯例）：**contract defect** = 冻结后的实现行为与本表「期望」列不符，或出现本表禁止的行为（无证据批判解锁任务、LLM 自批自过、自动改源文件、重复生成任务、证据缺失被放行、原始批判证据被改写/删除等）。判定前本清单本身不是验收标准。
>
> 「期望」列预填来源 = 冻结输入（GWT-R8-01…05 原文、GWT-R8-L1 原文、dev-plan R8 GWT 1-5、dev-plan:309 操作表 review column）与 `[草案]` 提案（逐项标注）；OQ-R8-1…7 已于 2026-09-15 由 Owner 全项裁决 = A 并逐字吸收进契约草案正文（索引见契约草案 §7），本清单「期望」列已按裁决同步更新；「Owner 确认」列**保持留空**——冻结确认 = Owner 冻结声明本身（沿 C-R4 先例），复认或改写即构成新决断记录。
>
> 范围说明：R8 = BLOCKED（G2.2 图 R8 行：prerequisites `R4 == DONE && C-R8 == FROZEN` + G2.2 confirmed；本契约为 C-R8 冻结载体，不解除 R8 BLOCKED）。

## A. 证据门与稳定 ID（GWT-R8-01 / GWT-R8-05）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R8-01 | evidence-qualified finding（五要素齐备的 finding 注册） | `remediation.register` 输入一条含 sourceAnchor（file:line 或 probe 路径+字节哈希）、reproCommand、externalSource（competitor/authoritative/official_project 三类之一，含 url+date+citedAs）、impact、proposedVerification 的 finding（GWT-R8-01 原文五要素 + dev-plan:253 file/line/证据 URL/日期/竞品/权威/影响/修复方向） | (a) 证据门通过：类别 A 锚点路径存在且 sha256 一致、类别 B 三类枚举内非空（`[草案]` 契约 §1.4）；(b) 分配稳定 findingId（格式 = `fnd-<YYYYMMDD>-<6位随机>`，`[Owner 决断 OQ-R8-6=A，2026-09-15]`），status = `REGISTERED`；(c) 响应壳 `data:{findingId, taskRef, status}` 三键齐备（dev-plan:309 原文壳形）；(d) 五要素任一缺失不进 finding | (a) 五要素缺一项仍注册成功；(b) findingId 不稳定（重复注册换 ID）；(c) 响应壳出现 dev-plan:309 以外的 data 键；(d) 锚点哈希不符仍放行 | |
| R8-05 | evidence gate（缺竞品/权威来源或缺可复现锚点 ⇒ INVALID_EVIDENCE fail-closed） | (a) 注册一条缺 externalSource 的 finding；(b) 注册一条 externalSource url 为空/date 非法的 finding；(c) 注册一条 sourceAnchor 路径不存在或字节 sha256 不符的 finding；(d) 注册一条有竞品来源但无 reproCommand/无锚点的 finding（GWT-R8-05 原文 + review column "批判是否有竞品/权威来源和可复现锚点"） | 全部四分支：finding 不写入 ledger、tracker/draft 计数不变、无 draft 产生；返回 `INVALID_EVIDENCE`（GWT-R8-05 原文 "不能进入 remediation READY"）；fail-closed，不降级为"待补证据"后放行（`[草案]` §1.4/§6.2） | (a) 缺证据仍注册为 REGISTERED 并可被下游消费；(b) 错误码写成其他码（如 INPUT_INVALID）；(c) 先落 finding 再要求补证据（半放行）；(d) 把 competitor 缺失但 authoritative 齐的情况误判为通过——三类缺一即拒 | |

## B. 映射与幂等（GWT-R8-02 / GWT-R8-04）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R8-02 | existing-task mapping（命中已有 R-task） | 一条通过证据门的 finding，其 sourceAnchor（file:line）落在某活跃 R-task（R4 canonical task state 中）的验收文件范围内（map-to-existing **仅精确命中**，不做语义匹配；歧义一律 Owner 指定——`[Owner 决断 OQ-R8-4=A，2026-09-15]`），mapMode=map-to-existing（GWT-R8-02 原文） | (a) taskRef = 命中 R-task ID；(b) 被命中 R-task 追加一条 critique-consumption 承接项（含 findingId + 追加 GWT + 追加 evidence requirement，additive 不改既有 GWT 文本）；(c) 不创建重复任务（GWT-R8-02 原文 "no duplicate task"）；(d) finding.status = `MAPPED_EXISTING`；歧义（多候选）时返回待 Owner 指定而非自动落 draft（`[Owner 决断 OQ-R8-4=A]`） | (a) 命中后仍另起新 remediation-draft（重复任务）；(b) 承接项原地改写已冻结 GWT；(c) taskRef 指向不存在的任务；(d) 映射绕过 C-R4 phase gate 直接让该 R-task 变为可执行；(e) 用语义/title 匹配冒充精确命中 | |
| R8-04 | idempotency（同批判文件同 title 重复注册） | 对同一 (critiqueFile.sha256, normalizedTitle) 执行两次 `remediation.register`（GWT-R8-04 原文） | (a) 第二次调用 tracker 不新增记录、task draft 计数不变；(b) 返回**原 findingId**（GWT-R8-04 原文）；(c) 响应 `ok:true` + code = `REMEDIATION_DUPLICATE`（幂等命中 = 正常决策进 data 通道，`[Owner 决断 OQ-R8-2=A，2026-09-15]`），data 回显原 taskRef/status；(d) 同题异内容（同 title 不同 evidence）不判 duplicate、不产生 DUPLICATE 码——按证据门重新过闸后作新 finding 注册 + `REMEDIATION_REVIEW_REQUIRED` + 附 duplicateOf（`[Owner 决断 OQ-R8-2=A]`；契约 §2.2 冲突分支） | (a) 第二次注册产生新 findingId（破坏幂等）；(b) tracker/draft 计数 +1；(c) 幂等命中返回 `ok:false` 错误通道，或把"同题异内容"合并成同一条记录/走 DUPLICATE 码；(d) duplicate 命中仍触发 review 门或新建 draft | |

## C. 新 remediation-draft 与 review 门（GWT-R8-03）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R8-03 | new remediation draft（未命中现有任务 → draft，非 implementation READY） | 一条通过证据门、未命中任何活跃 R-task 的 finding，mapMode=create-draft（GWT-R8-03 原文） | (a) 生成 remediation-draft，五要素齐备：scope、nonGoals、dependencies、gwts、contractImpact（GWT-R8-03 原文逐项）；五要素不齐 ⇒ fail-closed **不写 draft**，finding 保持 `REGISTERED` + warnings 列缺失项（`[Owner 决断 OQ-R8-5=A，2026-09-15]`，契约 §3.2）；(b) ownerReviewState = `PENDING`；(c) code = `REMEDIATION_REVIEW_REQUIRED`，data.status = `DRAFT_PROPOSED`；(d) draft **不进入** R4 task state、不被派单、不解锁下游（"it is not implementation READY" 原文）；(e) draft 由 createdBy 写入，但 createdBy 不得自批改 ownerReviewState=APPROVED（自批禁止，`[草案]` §5.1/§3.2） | (a) draft 缺五要素任一仍落盘；(b) draft 生成即被当作可执行任务派单；(c) code 为 null（不触发 review 门）；(d) createdBy 自己把 ownerReviewState 改成 APPROVED（自批自过）；(e) draft 自动编辑源文件（违反 R8 doc Boundary non-goal "auto-editing source files"） | |

## D. G2.1 ledger 注册投影（GWT-R8-L1）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R8-L1 | G2.1 ledger registration（REPRODUCED 映射 / UNRESOLVED 不解锁 / 永不删除） | 注册 G2.1 ledger 全部 C1-C7 finding（逐条映射 = 契约 §4.2 正式表，`[Owner 决断 OQ-R8-7=A，2026-09-15]`） | (a) C1/C3/C6/C7 ⇒ map-to-existing：C1→R1 基线 + R2 catalog 实现验收；C3→R2 路由准入实现 + 41 样本机制；C6→C-R3 §7 receipt 契约 + R3 remediation F-1/F-2/F-3（底层 assetConsumed 行为缺陷不宣称已修，沿 C-R3 §0.1 前提 1）；C7→R4 ci.mjs 分类矩阵 + exit 传播；(b) C5 ⇒ 承接 R4 phase.mjs 单一入口 + GWT-R4-01 fixture，**如实标注：修复后 C5 原始探针回归 [待确认/未执行]，不得写成已闭环**；C2 ⇒ 保持 UNRESOLVED 注册形态（status=`REGISTERED`，不 create-draft、不映射到可解锁任务），阻断 R9/R6 前置链，承接要求 = 同快照第三方复现或 Owner 重发布冻结项；(c) 全部 C1-C7 一经注册永不删除（"are never dropped"）；(d) 回滚只 supersede mapping/draft，不改写 ledger verdict 原文（前提 5） | (a) C2/C5 被自动映射到可解锁任务或生成 draft 解锁下游，或 C5 被写成已闭环；(b) 任一 C 被删除/丢弃；(c) 回滚改写了 G2.1 ledger verdict 记录；(d) REPRODUCED 的 C 未映射到 R2/R3/R4 验收条目而悬空 | |

## 使用说明

1. 「期望」列中标注 `[计划输入]` 的措辞来自冻结 GWT 原文（GWT-R8-01…05、GWT-R8-L1、dev-plan:253-257、dev-plan:309 review column），标注 `[草案]` 的为本契约新提案，标注 `[Owner 决断 OQ-R8-x=A，2026-09-15]` 的为 2026-09-15 Owner 裁决——Owner 审查时对三类分别复认；对已有裁决或 `[草案]` 的改写构成新决断记录，须同步回写契约对应章节。
2. 本清单不做验收：R8 实现完成前不运行、不判定通过；审查对象是"冻结后期望行为"。R8 自身 BLOCKED（`R4==DONE && C-R8==FROZEN` 未满足），本草案不解除该阻塞。
3. OQ-R8-1…7 已全部 DECIDED（2026-09-15，Owner=A：存储布局、duplicate 通道分叉、批准 receipt 形状、匹配谓词、NO_ACTION/五要素 fail-closed、ID 格式、C1-C7 逐条映射表），索引与逐字裁决见契约 §7 及各落点节。
4. 本清单为冻结载体（`contracts/`）；draft 原稿保留于 `contracts/drafts/`（read-only revision-evidence）：后续修订走冻结后变更控制，不直接改写本件；draft 永远不解锁任务（G2.2 图 §8）。`route41Rerun.required = false`（R8 不改 R2 路由关键词/簇/状态）。
