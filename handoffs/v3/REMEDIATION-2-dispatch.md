# REMEDIATION-2 派单 — 第十四审计五项处置闭环（F-028 重做 S16 三层真实拒绝路径 / F-029 写面追认补单 / F-030 governance stage-event 真实输入 / F-031 split-brain 方案 B / F-032 audit-index self-test）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `contracts/asset-migration.md`（六态+五条合法转移——S16 重做的判定基准）、`scripts/regression-all.mjs`（S15/S16 现状）、`scripts/lib/governance.mjs`（STAGE_BY_ASSET 现状）、`plans/audit-index-20260925.md`（A-4 命令现状）。完成后交付证据，不自称 DONE。

## 防超时纪律
五步各 ≤10 分钟落盘：①F-028 S16 重做 ②F-029 追认单 ③F-030 governance 真实输入 ④F-031 split-brain 方案 B ⑤F-032 index self-test + 回归 + RESULTS。探针输出存文件（REMEDIATION-2 目录）。

## 任务 F-028【P0】S16 重做：跨三层真实拒绝路径，废除文本身份匹配
审计实证：现 S16 验的是错误关系（asset-migration 六态无 failed；runtime promotionReceipt 字段无真实生产者；change receipt 身份域是 cr-/apr- 不是 plan-id——两套 ID 本不相引，"零违例"是恒真）。
重做为三段：
1. **Runtime plane**：调真实 phase/状态转移逻辑（gate/adapter 失败形态——mech 主链自然 failed 先例），断言 failed 子任务**不可转入 done/executing**（INVALID_TRANSITION 语义——按 runtime 现有 transition 实现写探针，若 runtime 无显式 transition 拒绝函数则探针验证 dispatch 返回 error≠null 且 status 未变 done）；
2. **Migration plane**：构造真实失败输入走 migration/change validator（shadow FAIL 夹具 / rollback FAIL / runtime_binding FAIL 三形态——AS-2-first 影子证据可参照），断言三种形态下 **SHADOW→MIGRATING 与 MIGRATING→PRIMARY 均被拒绝**（拒绝路径=playbook Failure Rules 对应代码/机验器，非文本扫描）；
3. **Cross-plane**：migration sourceEvidence 引用 runtime execution receipt 时，断言 result=FAILED/UNRESOLVED 的引用阻断 promotion（migration-record 的 promotionReceipt 生成处加校验，或 validator 探针证明会拒）。
废除 S16 旧文本扫描（migration_object.status==='failed' 与 SIGNED receipt 文本 include plan-id——身份域错配，恒真无意义）。回归段注释声明重做缘由。

## 任务 F-029【P1】D-3 写面越界正式追认
D-3-RESIDUAL 改 regression-all.mjs（A1 豁免名单收缩）超出其派单白名单（HARDEN-1 零触碰条款）——agent 自解释不构成授权。
处置：新建 `handoffs/v3/amendments/D-3-RESIDUAL-amendment-1.md`（编排者签发）：写明越界事实（文件+diff 摘要+commit 815da11）、追认理由（A1 名单收缩系处置项自身必需，断言逻辑零变化，编排者 L2 已亲验 22/22）、今后同类情况必须先申请 amendment 再动刀。**注意：本轮 HARDEN-1 已在 regression-all 加 S16（在 HARDEN-1 白名单内）——你的追认单只覆盖 D-3 的部分。**

## 任务 F-030【P1】governance stage-event 真实输入（语义校正，非重构）
现状：governanceFor 的 stage 来自 STAGE_BY_ASSET 资产映射（asset-role binding），event 字符串未参与判定——Owner 冻结的是 stage/event binding（before_final_receipt / stage_7 / gate_failed 等真实时机），当前实现是语义扩张。
校正（最小改动，禁造复杂 stage engine）：
1. `scripts/lib/governance.mjs`：governanceFor 签名不变，但判定改为**两键均须匹配冻结绑定**（plans/superpowers-selection-v1.json 的 activation 定义内化为常量表：{verification: before_final_receipt, implementation: stage_7, failure_recovery: [gate_failed, regression_failed, migration_failed]}）——stage 由调用方传入，event 由调用方传入，不匹配冻结集 → 返回 null（不注入）；
2. 调用端真实传参：orchestrator brief 组装处传 stage（implementation/review-gate 前后等既有阶段语义）+ 事件（stage_entry）；runtime 失败分支传真实事件码（CAPABILITY_MISSING/OUTPUT_INVALID 等映射到 failure_recovery 组——映射表显式声明"广义 failure_recovery 组"并在 governance.mjs 头注释声明与 Owner 冻结的对应关系）；
3. 探针：TDD 注入仅发生在 implementation 事件（review-gate 子任务不注 TDD——原 STAGE_BY_ASSET 下 review 会注 verification，新语义下 review 子任务须显式传 before_final_receipt 事件才注）。

## 任务 F-031【P1】split-brain 方案 B：冻结正文去 mutable 状态
contracts/asset-migration.md:102 与 contracts/asset-manifest-v2.md:77 的 PENDING/草稿态行改为**指针声明**（方案 B，审计者倾向+你此前裁定方向一致）：
- 替换为：`Owner 签收状态唯一权威 = contracts/discrepancies/<对应 cr id>.json（SIGNED）；本文档只记录 changeRecordId，不复制 mutable status`；
- 两份冻结正文属 Owner SIGNED 面——**最小 diff 原则**：只改该两行，其余冻结内容零触碰；改动本身按 change.record 补充单登记（类型 GOVERNANCE_CONSISTENCY，Owner PENDING）。

## 任务 F-032【P2】audit-index self-test + A-4 命令修正
1. A-4 命令修正：`j.assertions` → `j.probes.js_file_rejected.assertions`（实测 artifact 结构）；
2. 新建 `plans/audit-index-selftest.mjs`：逐行读取 audit-index 表，对每项断言：证据路径存在 + 复验命令可执行（child_process exec 逐条跑，输出含 expected token 或 exit 0）→ 任一失败具名列出；exit 0/1；
3. 自测自身进 preflight（P5c）或回归段——**audit-index 从此不能 stale**。

## 白名单
scripts/regression-all.mjs（S16 重做+P5c）、scripts/lib/governance.mjs、scripts/orchestrator.mjs（传参最小改动）、scripts/lib/runtime.mjs（失败分支传真实事件码）、contracts/asset-migration.md（102 行）、contracts/asset-manifest-v2.md（77 行）、contracts/discrepancies/（GOVERNANCE_CONSISTENCY 单）、handoffs/v3/amendments/（新建）、plans/audit-index-20260925.md（A-4 修正）、plans/audit-index-selftest.mjs（新建）、test-reports/autopilot-work/REMEDIATION-2/。

## 禁止
改 asset-migration/manifest-v2 两份冻结正文的其他内容、governance-skills/、webview/、SKILL.md、commands/、plans/ 既有文件（audit-index 修正除外）、其他 scripts/；禁 git。

## 回归
regression 22 项（S16 重做后计数可变，如实登记）+ preflight 8 + validate 0 全绿；F-028 三段探针、F-030 校正探针、F-032 self-test 输出全部存文件。

## 验收要点（编排者 L2 将复核）
S16 三层真实拒绝路径探针（非文本匹配）；F-029 追认单签发；governance 两键匹配冻结集（review 不再注 TDD 类错配）；两份冻结正文 PENDING 行变指针声明；audit-index self-test 进门禁；回归全绿。