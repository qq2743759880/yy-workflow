# R8 rebuild results — `scripts/lib/remediation.mjs` 行为级重建（2026-09-20）

> 重建对象：`scripts/lib/remediation.mjs`（Critique-to-Remediation Orchestration，C-R8-remediation 契约实现）。
> 原文件未恢复（原 sha256 前 16 位 `b65381d4f0eb2059`，见 `test-reports/impl-acceptance-20260915/REPORT.md` R8 节 implementation）。
> 重建依据（唯一权威）：`contracts/C-R8-remediation.md`（FROZEN 2026-09-15，OQ-R8-1…7 全项=A 逐字吸收）
> + `contracts/C-R8-review-checklist.md`（R8-01/02/03/04/05/L1 期望列）
> + R8 验收证据 `test-reports/impl-acceptance-20260915/REPORT.md` R8 节（contractConformance / independent reruns 11 fixture 反推行为面）。
> 风格对齐：`scripts/lib/evolution.mjs`（R10 重建参考实现；中文注释、响应壳、错误码纪律、fail-closed）。
> 新文件 sha256：`4e2ac2e667bcafdbcc6a3c2b915cb37e756da982ee6becb8c934ba8f1bc56748`。
> 增量纪律：仅新建 `scripts/lib/remediation.mjs` 与本目录；零既有文件改动（`git status` 仅 2 个 untracked 新条目，
> `git diff` 为空；真实 `plans/critique-backlog-tracker.md` 字节未动，tracker 哈希 `dea1f24b…` 与重建前一致）；
> 仅 node 内置依赖（fs/path/crypto/url）；未 commit。

## 1. 操作面（仅一操作，不新增操作名 [计划输入 dev-plan:309 原码]）

| 项 | 定义 |
|---|---|
| `remediation.register` | 流水（§6.1）：证据门（§1.4）→ duplicate 检查（§2.2）→ map（§2.1）/ create-draft（§3）/ NO_ACTION 出口（§5.3）→ 注入 GWT/evidence 要求（§4.1）→ 返回稳定 findingId 与 taskRef/status |
| 输入 | `finding`（§1.3 字段集）、`mapMode`（`map-to-existing` \| `create-draft` \| `NO_ACTION`；缺省=自动两阶段）、`draft`（五要素，create-draft 面）、`candidates`（R4 canonical task state 活跃 R-task 只读投影，R8 不读不写 R4 state.json）、`ownerDecision`（NO_ACTION 面）、`registeredBy`、`opts.{repoRoot,now,rand,snapshot}` |
| 响应壳 | `{ok, code, data, evidence, warnings}`；data 恒三键 `{findingId, taskRef, status}`（dev-plan:309 原文壳形，不增删键）；evidence 恒五键 `{snapshot, findingHashEcho, critiqueFileEcho, matchedTaskEcho, registeredAt}`（§6.1），键集成功/失败完全一致 |
| 错误码 | 仅三：`INVALID_EVIDENCE`（证据门 fail-closed，零写入）/ `REMEDIATION_DUPLICATE`（幂等命中标记，ok:true 进 data 通道，OQ-R8-2=A）/ `REMEDIATION_REVIEW_REQUIRED`（review 门标注，ok:true 进 data 通道，§5.2） |
| 分支矩阵 | §6.2 五行逐行实现（含冲突分支不走 DUPLICATE 码、draft 五要素不齐 code null + warnings） |
| 存储布局 | §6.3（OQ-R8-1=A）：`plans/active/remediation/findings.jsonl`（append-only 唯一权威注册面）、`plans/active/remediation/drafts/<findingId>.md`（一 finding 一文件）+ `<findingId>.approval.json`（Owner 批准记录，append-only）、`evidence/critique/<critiqueFile.sha256>/`（原件 write-once 不可变 + registrations.jsonl）、tracker 只追加不迁移 |
| 只读保证 | 不修改 `vendor/**`、`scripts/**`、`contracts/**`、`plans/tasks/**`、G2.1 ledger、R4 state.json；不自动编辑源文件（Boundary non-goal） |

辅助面导出（非 dev-plan 操作表，供 R6/R10/Owner 通道与探针只读消费；`run(op,input)` 分发面仍仅 `remediation.register` 一个操作名）：
`registerG21L1`（GWT-R8-L1 批量投影）、`applyOwnerReview`/`validateApprovalRecord`/`formatApprovalEvidence`（§5.1 Owner 批准通道，逐字对齐 [R4冻结] §5.2）、`supersede`/`effectiveStatus`（§5.4 追加式回滚）、`listFindings`/`isAccepted`/`cannotUnlock`/`normalizeTitle`（R10 evolution 只读消费面：finding schema 字段命名 findingId/status/taskRef 与契约 §1.3 逐字一致）、冻结常量（SNAPSHOT/ERROR_CODES/FINDING_STATUSES/EXTERNAL_SOURCE_KINDS/ANCHOR_KINDS/G21_VERDICTS/DRAFT_REQUIRED_ELEMENTS/OWNER_REVIEW_STATES/MAP_MODES/APPROVAL_TARGET_TYPE/G21_L1_MAP/G21_L1_SERIALS）。

## 2. 探针表（run-probes.mjs，全部沙箱于 `.sandbox/<pNN>/`，跑后清理）

对照标准 = 契约 GWT/清单行 + 验收报告 R8 节 independent reruns 清单；实际输出见 `out-probe-results.json`。

| probe | ok | 断言 | 覆盖（契约小节 / 清单行 / 验收复跑项） | summary |
|---|---|---|---|---|
| p01-gwt-r8-01-evidence-qualified-finding | ✓ 24 | 24 | §1.3/§1.4/§6.1、OQ-R8-6=A；清单 R8-01；GWT-R8-01 | 五要素注册→稳定 `fnd-<YYYYMMDD>-<6hex>`、REGISTERED、壳三键五键、ledger §1.3 字段集、evidence/critique 原件索引、ID 确定性重放同 ID、probe 形锚点过闸 |
| p02-gwt-r8-02-map-to-existing | ✓ 18 | 18 | §2.1/§4.1/§5.2 触发 2、OQ-R8-4=A；清单 R8-02；GWT-R8-02 | 精确命中 taskRef=命中 R-task、tracker 承接项追加（前缀字节不变、findingId+GWT+evidence requirement）、不建重复任务、语义不命中不映射、contracts/** 锚点与显式申报触发 review 门（映射仍发生） |
| p03-gwt-r8-03-create-draft | ✓ 16 | 16 | §3.1/§3.2、OQ-R8-6=A；清单 R8-03；GWT-R8-03 | draft 五要素齐备落盘（文件名=findingId、rem-<同日期>）、ownerReviewState=PENDING、REVIEW_REQUIRED+DRAFT_PROPOSED、非 implementation READY（无 .tt-state/state.json、tracker 不动）、自动两阶段同样触发 review 门 |
| p04-gwt-r8-04-idempotency | ✓ 17 | 17 | §2.2、OQ-R8-2=A；清单 R8-04；GWT-R8-04 | 二次注册零写（ledger/draft/tracker 计数不变）、返回原 ID/原 taskRef/原 status、ok:true+REMEDIATION_DUPLICATE（data 通道）、registeredAt 豁免回显、normalizedTitle 归一命中、REGISTERED 态幂等 |
| p05-gwt-r8-05-evidence-gate | ✓ 26 | 26 | §1.3/§1.4；清单 R8-05a-d；GWT-R8-05 | 清单四分支（缺 externalSource/空 url/非法 date/锚点不存在/哈希不符/有竞品无 reproCommand/无锚点）全 INVALID_EVIDENCE 零写入、kind 枚举外拒、citedAs 空拒、行号越界拒、批判文件哈希不符拒、不降级"待补证据"、authoritative 单独即满足类别 B（§1.4 三类任取一） |
| p06-gwt-r8-l1-g21-c1-c7 | ✓ 24 | 24 | §4.2、OQ-R8-7=A；清单 R8-L1；L1 C1–C7 | C1/C3/C6/C7 映射到正式表验收条目（taskRef=主承接面+l1.taskRefs 全表）；C2/C5 REGISTERED 不映射不解锁、C5 probeRegression=[待确认/未执行] 且 closureClaimed=false、C6 不宣称底层已修、C2 阻断 R9/R6 注记；C4 注册面收口（正式表无其行）；cannotUnlock 投影（C2/C5/C4=true）；7 行 ledger 永不删除；整批 fail-closed（任一证据门不过/serial 缺失/重复/verdict 投影失真 ⇒ 零写入） |
| p07-draft-missing-element-fail-closed | ✓ 13 | 13 | §3.2、OQ-R8-5=A；清单 R8-03(a) | 五要素缺 contractImpact/gwts/空 nonGoals/空 scope/无 draft 对象 ⇒ 不写 draft、无 draftId、finding 保持 REGISTERED、warnings 列缺失项、tracker 零追加 |
| p08-map-ambiguous | ✓ 10 | 10 | §2.1、OQ-R8-4=A；清单 R8-02(d) | 双候选精确命中 ⇒ REGISTERED + warnings 具名候选 + Owner 指定待办；自动两阶段遇歧义也不得自动落 draft（五要素齐备同样不落） |
| p09-duplicate-conflict | ✓ 15 | 15 | §2.2 冲突分支、OQ-R8-2=A；清单 R8-04(d) | 同键异内容 ⇒ 新 findingId + duplicateOf 链 + REMEDIATION_REVIEW_REQUIRED + DRAFT_PROPOSED（五要素门）；五要素不齐 ⇒ code null + REGISTERED + warnings；不自动合并证据；全程不产生 DUPLICATE 码 |
| p10-no-action-owner-only | ✓ 13 | 13 | §5.3、OQ-R8-5=A；dev-plan:244 | Owner 显式 NO_ACTION（status+reason+owner+date 内联同条记录、不另建文件、终态不可删除）；非 owner/空 reason/registeredBy='owner' 隔离 ⇒ fail-closed 零写入；register 永不自动产生 NO_ACTION |
| p11-self-approve-blocked | ✓ 17 | 17 | §5.1/§3.2、OQ-R8-3=A | createdBy='owner' 自批拒绝（隔离判定）；合法 Owner 批准 → APPROVED（approvalId=`apr-<YYYYMMDDTHHMMSSZ>-<8hex>`、targetType='remediation_draft'、target={draftId,findingId}、approvalEvidence=指令文件路径#SHA256 机验、expiresAt=null、draft md 生成后不改写）；批准记录 write-once 幂等；approvedBy 非 owner/证据缺失/哈希不符/targetType 错误/批准晚于执行 ⇒ 全部无效零写入；哈希对账 [待补充] 显式透传 |
| p12-shell-error-codes-rollback | ✓ 37 | 37 | §6/§6.2/§5.4 + §2.2 | 错误码面恒三、状态枚举恒六；未知操作名/未知 mapMode fail-closed 零写入；显式 map miss ⇒ REGISTERED；四分支响应壳逐键一致；supersede 追加式（supersedeBy/supersededAt/reason）、ledger/原始证据字节不变、draft 不删除仅派生 SUPERSEDED、无 mapping 拒绝；listFindings/isAccepted/cannotUnlock 消费面投影 |

**TOTAL: 12/12 PASS（230 断言）；EXIT=0**

## 3. 全量自验

| 项 | 结果 |
|---|---|
| `node test-reports/rebuild-20260920/R8-remediation/run-probes.mjs` | 12/12 PASS（230 断言），EXIT=0 |
| `node scripts/regression-all.mjs` | 12 PASS / 0 FAIL，exit 0 |
| `node scripts/validate-structure.mjs` | `[OK] 结构校验通过 (0 项警告)`——可移植性泄露 0、U+FFFD 0，无新警告 |
| 沙箱纪律 | 全部写入限制于本目录 `.sandbox/<pNN>/`（跑后清理）；真实 `plans/critique-backlog-tracker.md` 未写（哈希 `dea1f24b…` 不变）；仓库根无 `plans/active/`、`evidence/critique/` 泄漏；vendor/ 未触碰 |
| 增量纪律 | `git status --porcelain` 仅 2 个 untracked 新条目（`scripts/lib/remediation.mjs`、`test-reports/rebuild-20260920/R8-remediation/`）；`git diff` 为空；未 commit |

## 4. 偏差与重建推断（行为级重建，非逐字节恢复；逐项标注依据）

1. **`REMEDIATION_OWNER_REQUIRED` 码名（重建推断，非契约三码面）**：§5.1/§5.3 冻结的是"NO_ACTION 只能 Owner 显式写入 / creator 通道写 APPROVED 即 defect"行为，未冻结 Owner 通道被越权触发时的返回码。本重建沿 R4 重建 `FLAG_UNSUPPORTED_CODE` 先例，采用独立码 `OWNER_CHANNEL_CODE='REMEDIATION_OWNER_REQUIRED'`，只用于 Owner 通道违规（非 owner NO_ACTION、自批、批准记录校验失败）；`remediation.register` 主面的证据/幂等/review 三分支严格使用契约三码，`ERROR_CODES` 导出面不变。
2. **辅助面 data 键集**：`registerG21L1` 批量投影在恒三键外附加 `registered`/`counts`（批量结果无可折叠进单 finding 三键而不失真）；`remediation.register` 主操作严格恒三键（p01/p12 逐响应机验）。
3. **L1 多验收条目去向的 taskRef 取形**：§1.3 冻结 `taskRef: null | string`，而 OQ-R8-7=A 正式表 C1/C3/C6 的承接去向含两个验收条目。本重建取 taskRef=首条（主承接面），完整去向表记 `l1.taskRefs`，承接项仍逐条追加 tracker（p06 机验 7 行承接记录）。条目标识采用契约表措辞 slug（如 `R1-baseline-16-asset`）；canonical 验收条目 ID 未随快照幸存（G2.2 图不在恢复仓库内），`registerG21L1` 提供 `acceptanceEntryMap` 覆盖面。
4. **C4 的收口（重建推断）**：GWT-R8-L1 原文"全部 C1-C7 一经注册即永不删除"，但 OQ-R8-7=A 正式表与 G2.2 R8 行原文均未给 C4 逐条行。本重建按注册面收口：C4 必须、status=REGISTERED、不映射不落 draft、g21Verdict 按 ledger 原样投影、cannotUnlock 随投影判定；映射去向缺 Owner 逐条裁决这一事实记入 [待补充] 清单。
5. **L1 verdict 投影真实性门（重建推断）**：C1/C3/C6/C7 投影须为 REPRODUCED、C2/C5 须为 UNRESOLVED（G2.1 §1 verdict 原文保留、非 G2.1 记录不可改写，前提 5）；投影失真 ⇒ 整批 fail-closed。
6. **显式 `map-to-existing` 未命中的行为**：契约只定义"缺省自动两阶段：先匹配未命中再 create-draft"，未定义显式 map-to-existing 落空时的行为。本重建选择 REGISTERED + warnings（不自动改道 create-draft，保持调用方显式意图；出口仍留给 Owner 改判），p12 锁定该行为。
7. **歧义（多候选命中）的通道**：清单 R8-02(d) 要求"返回待 Owner 指定而非自动落 draft"；§5.2 review 触发面未含歧义。本重建：注册成功、status=REGISTERED、code null、warnings 具名候选与 Owner 指定待办（不占用 REVIEW_REQUIRED 码，避免扩张其 §5.2 冻结触发面）。
8. **§5.2 触发条件 2 的 status**：契约头注"data.status 同步为 DRAFT_PROPOSED"按触发条件 1（create-draft）理解；触发条件 2 映射已发生，若强写 DRAFT_PROPOSED 将与 §1.5（DRAFT_PROPOSED ⇒ taskRef=draft ID）矛盾。本重建：映射仍发生、status 保持 MAPPED_EXISTING、code=REMEDIATION_REVIEW_REQUIRED（p02 机验）。
9. **触发条件 2 的机检面**："承接项影响契约冻结面"以两条确定性通道实现：sourceAnchor.path 落在 `contracts/**`（路径机检）或调用方显式申报 `contractSurfaceTouched=true`；语义级"弱化冻结契约"判定留给 Owner review。
10. **冲突分支的 map 跳过**：§6.2 冲突行 map 结果列为"—"，本重建实现为：同键异内容时不做 map/create-draft 决策，仅按五要素门注册新 finding（齐 ⇒ DRAFT_PROPOSED + draft 落盘；不齐 ⇒ REGISTERED + code null + warnings）。
11. **`<findingId>.approval.json`（重建推断）**：§3.2 冻结 ownerReviewState 初始 PENDING 与"APPROVED 只能 Owner 通道写入"，未冻结批准落点。本重建：draft md 生成后不改写（PENDING 快照不可变），批准以 write-once `drafts/<findingId>.approval.json` 承载（append-only，落点在 §6.3 布局内）；生效 review 状态 = md PENDING + 批准记录存在。
12. **approvalEvidence 形（重建推断）**：OQ-R8-3=A 冻结"指令文件路径 + 该文件 SHA256"，未冻结字符串形。本重建沿 R4 重建同款 `<路径>#<sha256>`（`formatApprovalEvidence`），且指令文件须真实可读、字节哈希一致（不可抵赖 fail-closed）。
13. **INVALID_EVIDENCE 被拒线索不落账**：§6.2 分支矩阵行 1"可在 ledger 记一条被拒线索 [草案]"为可选；本重建选择零写入（与 GWT-R8-05"tracker/draft 计数不变"最保守一致），拒绝理由走 warnings 通道。
14. **supersede 记录落点（重建推断）**：§5.4 冻结"追加式记录（supersedeBy/supersededAt/reason），不是原地删除"与"ledger 禁改写已追加行"；§6.3 未列 supersede 文件。本重建落 `plans/active/remediation/superseded.jsonl`（§6.3 布局目录内 append-only），finding 生效状态由其派生（`effectiveStatus`），finding 本体与原始批判证据字节不变（p12 机验）。
15. **GWT-R8-05 清单 defect (d) 的口径**：清单 defect 列"把 competitor 缺失但 authoritative 齐的情况误判为通过"与契约 §1.4"三类枚举内任取一"存在措辞张力。按"契约是唯一权威"，本重建实现类别 B = 三分类任取一 + url/date/citedAs 机验（GWT-R8-05 原文"缺少竞品**或**权威来源"——有其一即不缺），p05 断言 authoritative 单独过闸；"三类全缺（含声称 authoritative 但字段残缺）"仍一律拒。

## 5. [待补充] 清单（fail-closed 保持待补充，禁止编造）

| 项 | 状态 | 本实现处置 |
|---|---|---|
| 批准↔执行哈希对账方案（§5.1 校验 (d) 残余，OQ-R8-3=A） | 契约原文 `[待补充]`，归属 R8 实现阶段/Owner，与 C-R4 残余同形态（impl-acceptance-20260915 非阻塞注记同口径） | 不定义、不编造；导出 `HASH_RECONCILIATION_STATUS` 常量并在每次 Owner 批准 warnings 显式透传（p11 断言）；批准记录先 append-only 落账 |
| L1 验收条目 canonical ID（§4.2 表"承接去向"无冻结条目 ID） | 快照内 G2.2 图未随恢复仓库幸存，无实测值 | 采用契约表措辞 slug + `acceptanceEntryMap` 覆盖面；不得宣称即权威 ID |
| C4 的 Owner 逐条映射行（OQ-R8-7=A 正式表未含） | Owner 未裁决 | 注册面收口（REGISTERED、不映射、不落 draft、never dropped），事实如实登记于 `l1.note` |
| 已注册 finding 的后续 NO_ACTION（Owner 对既有 finding 补标） | §5.3 冻结"内联写 findings ledger"且"禁改写已追加行"，两者对已存在行如何合并没有冻结解法 | 本重建仅实现注册时点 NO_ACTION（单条记录四字段内联，OQ-R8-5=A 主案）；已注册 finding 的补标通道保持未定义，不由本实现编造 |
| receiptRef 的可解析机验（§1.4 类别 C"receiptRef 可解析"） | 依赖 R3 receipt 落点与 workspace 上下文，R8 只读投影不重判（前提 2） | 形状机检（subtaskId/eventSeq）+ 不可解析走 warnings；不重放 P1-P5、不改判终态 |

## 6. 覆盖契约小节总表

| 契约小节 | 覆盖探针 |
|---|---|
| §0 操作名/错误码面（仅 register + 三码） | p12 |
| §1.1/§1.2 Scope/non-goals（不自动编辑源文件、不写 R4 state、不解锁） | p02、p03、p10 |
| §1.3 finding schema 与必含不变量 | p01、p05、p07 |
| §1.4 证据类别 A/B/C 与 fail-closed | p01、p05（A/B 全分支、C 可选不触发）、p11（批准证据机验） |
| §1.5 status 枚举六值与终态语义 | p12（枚举恒六）、p10（NO_ACTION 终态）、p12（SUPERSEDED 派生） |
| §2.1 匹配面与精确命中谓词/歧义 | p02、p08 |
| §2.2 幂等键/命中分支/通道分叉/冲突分支 | p04、p09 |
| §3.1 两 map mode/taskRef 产生/自动两阶段/candidate≠READY | p03、p08、p12 |
| §3.2 draft schema/五要素门/ownerReviewState=PENDING/自批禁止 | p03、p07、p11 |
| §3.3 与 R4/R3 接口（不写 R4 state、dependencies 只读引用） | p02、p03 |
| §4.1 注入内容（findingId 前缀、additive、GWT+evidence requirement） | p02（tracker 承接项）、p06（L1 承接行） |
| §4.2 GWT-R8-L1 投影与 C1-C7 逐条映射表 | p06 |
| §5.1 自批禁止/批准记录字段与四条校验/隔离判定 | p10、p11 |
| §5.2 review 通道三触发面/不触发面 | p02（触发 2）、p03/p09（触发 1/3）、p04/p10/p12（不触发面） |
| §5.3 NO_ACTION owner-only/内联四字段/不可删除 | p10 |
| §5.4 rollback/supersede 追加式/证据不可变 | p12 |
| §6 响应壳/操作表/分支矩阵/幂等/只读保证 | p01、p04、p05、p12 + 全部探针（零冻结面写入） |
| §6.3 存储布局（ledger/drafts/evidence-critique/tracker 只读兼容） | p01、p02、p03、p04、p06、p10、p12 |
| §7 OQ-R8-1…7=A 裁决落点 | p01（OQ-6）、p02/p08（OQ-4）、p04/p09（OQ-2）、p07（OQ-5）、p10/p11（OQ-3/5）、p06（OQ-7）、布局面（OQ-1） |
| 清单 R8-01/02/03/04/05/L1 | p01 / p02+p08 / p03+p07+p11 / p04+p09 / p05 / p06 |
