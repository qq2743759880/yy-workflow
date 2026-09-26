# REMEDIATION-2 RESULTS — 第十四审计五项处置闭环（F-028 / F-029 / F-030 / F-031 / F-032）

> 执行：autopilot 管线 L1 独立执行 agent（全新上下文）｜派单：`handoffs/v3/REMEDIATION-2-dispatch.md`｜日期：2026-09-26
> 工作区：`D:\.ai-hub\skills\yy`｜禁 git 遵守（本报告内 git diff/status 为只读现场快照，供编排者收口，无 commit/无 stage）
> 本文档不自称 DONE——L2 复核后方可关账。

## 一、五项任务结果总览

| 任务 | 内容 | 结果 | 核心证据 |
|---|---|---|---|
| F-028 P0 | S16 重做：废除文本身份匹配旧两断言，改三段真实拒绝路径探针 | **完成** | REMEDIATION-2/s16-1-runtime-plane.json + s16-2-migration-plane.json + s16-3-cross-plane.json |
| F-029 P1 | D-3 写面越界正式追认单（编排者签发） | **完成** | handoffs/v3/amendments/D-3-RESIDUAL-amendment-1.md |
| F-030 P1 | governance stage×event 两键匹配冻结集 + 调用端真实传参 | **完成** | REMEDIATION-2/f030-governance-probe.json（all_pass=true） |
| F-031 P1 | 两份冻结正文 PENDING 行改指针声明（方案 B）+ GOVERNANCE_CONSISTENCY 补充单 | **完成** | f031-frozen-docs.diff + contracts/discrepancies/cr-20260926T000000Z-g0v3cons1.json |
| F-032 P2 | A-4 命令修正（probes.js_file_rejected.assertions）+ audit-index selftest 进门禁 | **完成** | plans/audit-index-selftest.mjs（40 PASS / 0 FAIL）+ regression S14b 段 |

## 二、F-028 S16 重做（三层真实拒绝路径证据）

**废除声明（旧逻辑零保留）**：旧 S16-1/S16-2（HARDEN-1 版，regression-all.mjs 原约 483-648 行）整段删除。废除缘由已按派单写入 regression-all.mjs 头注与 S16 段注释：①asset-migration 六态无 `failed`（`migration_object.status==='failed'` 不是契约词汇）；②runtime `promotionReceipt` 字段无真实生产者（恒 undefined，断言恒真）；③change receipt 身份域是 cr-/apr- 不是 plan-id——failed 身份 ids 与 SIGNED receipt 文本 `includes` 匹配两套 ID 本不相引，"零违例"恒真（vacuous）。全部替换为机验器真实代码路径判定，无一处文本 include 身份匹配。

### S16-1 Runtime plane（真实状态机拒绝）

- 机验器：`scripts/lib/phase.mjs` transitionPhase（§3.2 转换矩阵）/ checkPhase 只读面——mech 主链同一状态机。
- 探针：真实走完整合法链 idle→planning→executing→reviewing→failed（canonical state.json 真实落盘，终态 failed），再断言 failed→done / failed→executing / failed→reviewing 三条转移全部 `ok:false + INVALID_TRANSITION + "终态不可追加"` 且 canonical state 保持 failed 不变；只读面 checkPhase 同拒（allowed=false）。
- 真实拒绝路径证据（s16-1-runtime-plane.json）：`rejections[3] 全 rejected=true`、`canonical_state_unchanged=true`；mech 主链自然 failed 先例佐证 = HARDEN-1/s16-orchestrator.log（opencode 失败 → subtask failed → plan failed）。

### S16-2 Migration plane（三失败形态真实机验器）

按派单三形态，全部走真实执行/os.tmpdir 夹具跑完即删：
1. **shadow FAIL**：真实 spectral（be-validator adapter portman.mjs）真扫缺陷 OpenAPI 夹具（缺 responses）→ `findings_total=6, pass=false, mode=exec`（AS-2-first 影子跑 FAIL 判据同源）；
2. **rollback FAIL**：PATH 剥离 → spectral 不可达 → 无 EXPLICIT_COMPAT_MODE 旗标 → adapter 返回 `SPECTRAL_NOT_AVAILABLE (legacy portman path blocked…Gate-1)`（真实拒绝，非旗标回退）；
3. **runtime_binding FAIL**：假 spectral（垃圾输出+exit 0）注入 PATH → `SPECTRAL_OUTPUT_INVALID, invalid_output=true`。

三形态下按 playbook Failure Rules（契约 §一转移表）判定：**SHADOW→MIGRATING 与 MIGRATING→PRIMARY 均拒绝**（3×2 全拒），且干净记录放行（对照组，非恒拒）。附加：receipt 事件链机验器（receipt.mjs receiptAppend 真实 T1-T5 链 → verification_failed 负终态）后追加 behavior_verified → `RECEIPT_INVALID "链已到终态，禁止再验证"`——失败终态不可升级为晋升证据。

### S16-3 Cross-plane（FAILED/UNRESOLVED 引用阻断 promotion）

- migration sourceEvidence 引用 runtime execution receipt 的机验：状态层把上游伪装 done（cross-plane 注入），其 receipt 终态 FAILED（真实 receiptAppend 链构造）→ phase.transition planning→executing 被 depPrecondition/receiptCoverage 校验拒绝（`PHASE_PREREQ_UNMET: receipt 终态 FAILED 非 behavior_verified`）；UNRESOLVED 同拒；对照组 behavior_verified → 放行（非恒拒）。
- promotionReceipt 生成处校验（探针内显式函数 + 断言）：sourceEvidence 引用 receipt 终态 ∈ {FAILED, UNRESOLVED, INVALID, 缺失} → PROMOTION_BLOCKED 全阻断；仅 behavior_verified 放行。

## 三、F-029 追认单要点

`handoffs/v3/amendments/D-3-RESIDUAL-amendment-1.md`（编排者署名，2026-09-26）：
- 越界事实：D-3-RESIDUAL 改 regression-all.mjs（A1_REGISTERED_RESIDUALS 名单收缩 + 猎手名单自命中显式豁免 + 头注去重抄，共两处，断言逻辑零变化），超出其派单白名单且触其"零触碰"条款；commit 815da11；agent 自解释（偏差 R-1）不构成授权。
- 追认理由：A1 名单收缩系处置项自身必需（不收缩则 S15-A1 误报已清理文件）；编排者 L2 已亲验 22/22；diff 归属核查确认改动不超两处。
- 追认范围**只覆盖 D-3 的部分**——HARDEN-1 的 S16 在其白名单内系合法写面，本单明文排除；REMEDIATION-2 本轮 S16 重做在 REMEDIATION-2 白名单内，同样不涉本单。
- 程序纪律生效：今后同类情况必须先申请 amendment 再动刀。

## 四、F-030 governance 校正（review 不再错配）

1. `scripts/lib/governance.mjs`：
   - `governanceFor(stage, eventType, opts)` 签名不变，判定改为**两键均须匹配冻结绑定**：冻结集常量表 `FROZEN_STAGE_EVENT_BINDINGS`（verification→[before_final_receipt] / implementation→[stage_7] / failure_recovery→[gate_failed, regression_failed, migration_failed]），权威 = plans/superpowers-selection-v1.json 逐 skill activation 定义内化。event 缺省/枚举外/未知 stage → null（不注入，fail-closed）。
   - **runtime 失败码 → failure_recovery 组映射表显式声明**（governance.mjs 头注释 + `governanceEventForFailureCode` 单点）：CAPABILITY_MISSING → gate_failed（EX-1 能力门）；INELIGIBLE_* → gate_failed（AV-3 资格门族）；RESOLVER_INTERNAL_ERROR → gate_failed；*_NOT_AVAILABLE → gate_failed（adapter/宿主/工具不可用族）；*_OUTPUT_INVALID → gate_failed（输出契约违约族）；真实执行失败（ok:false 无码）→ gate_failed（调用端兜底）；regression_failed/migration_failed 字面量直通；未映射码 → null（不语义扩张）。
   - 旧 `BINDINGS` 表废除；`STAGE_BY_ASSET` 保留为两键之一的 stage 映射（stageForAsset 不回归）。
2. 调用端真实传参：
   - `scripts/orchestrator.mjs` L741：brief 组装处 `governPlanAssets(assets, plan.subtasks, { event: 'stage_7' })`（派单 = stage 7 并行派单的 stage entry 事件）；
   - `scripts/lib/runtime.mjs` L380：失败分支 `governanceEventForFailureCode(govFailCode)` 真实传参（具名码映射；无码失败兜底 gate_failed；指路行带 `gov_event=` 具名）。
3. 探针（REMEDIATION-2/f030-governance-probe.mjs，6 探针组 all_pass=true）：
   - 冻结集正配三技能全命中；event 不匹配/缺省 6 形态全 null；
   - **错配校正核心**：review（旧 STAGE_BY_ASSET → verification 阶段级注入）在派单事件 stage_7 下零注入，显式传 before_final_receipt 才注入 verification；implementation 在 stage_7 注 TDD；
   - 端到端：governPlanAssets(stage_7) 下 implementation 注 TDD、review/sdlc 零注入、未列资产零注入；
   - 失败码映射表 15 项全对 + 未映射码 null；
   - 真实 executePlan 失败路径（adapter 返回 CAPABILITY_MISSING）：指路行输出 `failure=CAPABILITY_MISSING gov_event=gate_failed | GOVERNANCE: systematic-debugging…`。

## 五、F-031 split-brain 方案 B（两行修正）

- `contracts/asset-migration.md`：原 `| Owner 签收位 | PENDING（…草稿态） |` 一行替换为指针声明（唯一权威 = contracts/discrepancies/cr-20260924T090000Z-b1g4te5c.json 的 ownerSignOff 字段；本文档只记录 changeRecordId，不复制 mutable status）。**其余冻结内容零触碰**（f031-frozen-docs.diff 逐行核验 = 各仅 1 行 +/-）。
- `contracts/asset-manifest-v2.md`：原 `| Owner 签收 | approvalId: apr-… / approvalEvidence: PENDING_OWNER_RECEIPT（…草稿态） |` 一行同样替换（唯一权威 = cr-20260923T040000Z-av1schema.json）。
- 改动后 sha256：asset-migration.md `0ccbdd24…`；asset-manifest-v2.md `247f3c62…`（f031-sha256-after.txt）。
- 补充单：`contracts/discrepancies/cr-20260926T000000Z-g0v3cons1.json`——changeType=**GOVERNANCE_CONSISTENCY**（派单指定类型名；change.mjs IMPACT_CLASSES 五类无此类，故 impactClass 取最接近的 DOC_ONLY + changeType 字段显式携带，单内 note 声明），Owner PENDING（ownerSignOff 位），方案 B 系审计者倾向与执行方向一致的最小处置，Owner 可改判/否决（supersede-not-delete）。

## 六、F-032 audit-index self-test + A-4 修正

1. **A-4 命令修正**（plans/audit-index-20260925.md A-4 行）：`j.assertions` → `j.probes.js_file_rejected.assertions`（实测 artifact 结构 `{probes:{js_file_rejected:{assertions:{assert_scope_language_unsupported:true}}}}`）；修正后命令实测输出 `{"assert_scope_language_unsupported":true}`。
2. **`plans/audit-index-selftest.mjs`（新建）**：逐行解析索引表（A/B/C/N 系 20 条目）——①证据路径存在（组内主路径在场口径，具名缺失面）；②复验命令逐条 child_process 真跑（bash -c，60s 超时），exit 0 判过、具名打印首行输出；git 类命令 SKIP-git（L1 禁 git，命令在案）；N 系披露行按 GAP 登记不阻断。**结果 40 PASS / 0 FAIL，exit 0**（audit-index-selftest.log）。
3. **进门禁**：regression-all.mjs 新增 **S14b 段（preflight P5 系延续编号 P5c）**——`node plans/audit-index-selftest.mjs` exit 0 才 PASS，STALE 具名输出。audit-index 从此不能 stale。

## 七、回归（计数如实登记）

| 项 | 改前基线（本轮开工时实测） | 改后终态 | 说明 |
|---|---|---|---|
| regression-all | 22 PASS / 0 FAIL（旧 S16 两断言计入） | **24 PASS / 0 FAIL**（exit 0） | 计数变化：旧 S16-1+S16-2（2 段）废除 → 新 S16-1/2/3（3 段）+ 新 S14b（1 段）= +1 净增；24=22-2+3+1。全绿 |
| preflight | 8 PASS / 0 FAIL | 8 PASS / 0 FAIL（exit 0） | 无变化 |
| validate-structure | 0 警告（exit 0） | 0 警告（exit 0） | 无变化 |

regression 终态逐段（regression-final.log）：S1-S13 全 PASS；S14 preflight 8 PASS；S14b audit-index selftest 40 PASS/0 FAIL——未 stale；S15-A1..A6 全 PASS；S16-1/2/3 全 PASS。

## 八、偏差登记（交 L2/Owner）

| id | 内容 | 状态 |
|---|---|---|
| V-1 | F-030 冻结集 implementation 事件取 `stage_7`：选择文件原文为"stage_7_implementation 或 migration shadow run 前"，派单 F-030 冻结集裁定 `implementation: stage_7`——从派单，"migration shadow run 前"触发未内化（影子跑事件暂无运行时发射点，如实登记）。L2 如需补 migration shadow 事件可后续 amendment | 登记待 L2 |
| V-2 | F-030 P3b 探针以 sdlc 替换 security 验证 verification 绑定零注入——security 的 STAGE_BY_ASSET 映射是 implementation（非 verification），review/sdlc 才是 verification 系；探针断言面不受影响，仅为表格用词精确性登记 | 备查 |
| V-3 | F-031 补充单 changeRecordId 形（cr-20260926T000000Z-g0v3cons1）走 change.mjs CHANGE_ID_RE 口径但经手工登记（change.record 机验要求 CONTRACT/SECURITY 类 receipt，本单为 DOC_ONLY 补充单形态，reason/touchedFiles/sourceEvidence 齐备）——Owner PENDING 待签收 | 登记待 L2 |
| V-4 | REMEDIATION-2 目录内 debug-helpers/ 子目录（scan*.mjs 5 个临时括号配平扫描脚本 + s16-new-block.txt 拼装中间产物）——S16 重做组装期工具，留痕不删除供 L2 复核组装过程；不参与任何门禁 | 备查 |
| V-5 | S16-2 中"SHADOW→MIGRATING 与 MIGRATING→PRIMARY 均拒绝"的转移判定函数为探针内显式 `promote()`（playbook Failure Rules 的代码化映射，表驱动 + 对照组防恒拒）——仓库内无独立 migration 状态机机验器可消费（migration-record 为登记面 JSON），此为派单"拒绝路径=playbook Failure Rules 对应代码/机验器"口径下的最小实现；三失败形态本体全部走真实机验器（spectral adapter/ receipt 事件链） | 登记待 L2 |

## 九、不自称 DONE

五项任务处置完毕、回归三件全绿、证据全部落盘 REMEDIATION-2/（三段探针 JSON + governance 探针 JSON + selftest 日志 + 三件回归日志 + frozen-docs diff 快照）。关账条件：编排者 L2 复核本报告与全部证据 + Owner 对 cr-20260926T000000Z-g0v3cons1（V-3）与 D-3-RESIDUAL-amendment-1 追认范围的最终裁定。
