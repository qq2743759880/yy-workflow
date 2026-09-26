# GOV-AUTHORITY 派单 — 第十五审计四件事：真实 migration authority + before_final_receipt 生产发射点 + canonical 签收字段统一 + audit-index semantic freshness（批 1 close 前最后一批）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `contracts/asset-migration.md`（六态）、`scripts/lib/change.mjs`（CONTRACT fail-closed 规则——isFrozenContractPath/最严类）、`scripts/lib/phase.mjs`（transitionPhase 真实 authority 参照）、`scripts/lib/governance.mjs`（FROZEN_STAGE_EVENT_BINDINGS）、`plans/audit-index-selftest.mjs`（reference-health 现状）。完成后交付证据，不自称 DONE。

## 防超时纪律
四步各 ≤12 分钟落盘；探针输出存文件（GOV-AUTHORITY 目录）。这是批 1 close 前最后一批——纪律优先于速度。

## 任务一【P0】真实 Migration Authority：新建 `scripts/lib/migration.mjs`
仓内不存在生产 migration transition/promotion authority（S16-2/3 的 promote()/validatePromotionEvidence() 是 test oracle——第十四/十五审计均实证）。新建生产模块：
1. `transition(record, from, to, evidence)`：实现契约五条合法转移；**非法转移抛 INVALID_TRANSITION**；三种失败形态（shadow_fail/rollback_fail/runtime_binding_fail）→ SHADOW→MIGRATING 与 MIGRATING→PRIMARY 硬拒绝（MIGRATION_BLOCKED:<形态>）；promotion evidence 校验内化（terminal=FAILED/UNRESOLVED/INVALID/缺失 → 拒绝；behavior_verified → 放行）；
2. `promotionReceiptOf(record)` 或等价：生成 promotionReceipt 前强制走 evidence 校验（S16-3 的生成处校验从 test oracle 升为生产函数）；
3. **S16-2/S16-3 改为调用 `scripts/lib/migration.mjs`**（regression-all 内自造 oracle 删除——它们测生产 authority 而非本地函数）；S16-1 保留（phase.mjs 已是真 authority）；
4. AS-2 三张已 PRIMARY 的 migration-record 回放验证：真实 authority 对既有合法链放行（兼容性证明）。

## 任务二【P0】before_final_receipt 生产发射点
现状：governPlanAssets 唯一生产调用传 event:'stage_7'，verification 技能（before_final_receipt）生产路径不可达（F-035）。
实现：orchestrator/review-gate 流程中 **review 类子任务完成判定前**（before_final_receipt 语义位）调用 `governPlanAssets(assets, reviewSubtasks, { event: 'before_final_receipt' })`——定位：review 子任务收尾/receipt 落账前的既有代码点（最自然的是 orchestrator 派单循环里 review 资产子任务 run 前，或 review-gate 验收输出组装前——读代码选最小 diff 处），使 review/be-validator/sdlc/skill-sentinel 的 brief 在终验收前注入 verification skill。
探针：review 子任务 brief 含 verification-before-completion 正文（生产路径，非 probe 直调）；implementation 子任务仍注 TDD 不受影响。

## 任务三【P0】canonical 签收字段统一（F-033/F-034 连带）
1. **canonical = ownerApprovalReceipt.status**（已有 approvedBy/approvedAt/approvalEvidence/SIGNED + 机器校验函数 change.mjs）；
2. 新建 `scripts/lib/signoff-canonical.mjs`（或并入 change.mjs 导出）：`canonicalSignoff(record)` 单点读函数——读 ownerApprovalReceipt；**ownerSignOff 若在场且≠投影值 → 视为 stale 字段忽略并 warning**；
3. 存量六张 SIGNED 单的 `ownerSignOff` 字段：**删除**（或置 `"projectedFrom":"ownerApprovalReceipt"` 投影标记——二选一，选删除更彻底）；
4. F-031 两份冻结正文的指针声明改指 canonical（措辞："Owner 签收状态唯一权威 = <cr id>.json 的 ownerApprovalReceipt.status"）；
5. **F-034 修复**：cr-20260926T000000Z-g0v3cons1 的 DOC_ONLY 声明系绕过最严类规则（touchedFiles 含两份冻结契约 → 按	change.mjs 必须自动归 CONTRACT + owner approval receipt）——处置：作废旧单（voided 标记+reason），重立 `cr-20260926T010000Z-g0v3cons1-r2.json`（impactClass=CONTRACT，ownerApprovalReceipt=**PENDING_OWNER_RECEIPT** 等 Owner 签收——**本单须 Owner 签收后 F-031 才算完成**，如实登记）；编制说明写明原 DOC_ONLY 声明错误（"治理一致性不改机器语义"≠不触冻结契约）。

## 任务四【P1】audit-index semantic freshness（F-038）
1. **拆分 historical/current 两节**：C-1/C-2（旧版 S16，已被 REMEDIATION-2 废除）移入 historical 节（标注 superseded_by: REMEDIATION-2 S16 三段、current=false）；
2. selftest 升级：current 节每项检查 **canonical pointer/version**（证据文件 sha256 == 索引登记值 / 路径存在）+ historical 节只查路径存在不查 freshness；任一 current 项 sha256 不符 → FAIL 具名（"reference-health-check"→真 semantic freshness）；
3. 新增 current 行：REMEDIATION-2 S16 三段 + migration.mjs authority。

## 自测（证据落 `test-reports/autopilot-work/GOV-AUTHORITY/`）
1. migration.mjs：五合法转移放行 + 三失败形态拒绝 + evidence 校验四负终态拒绝 + AS-2 三张回放兼容；
2. S16-2/3 改调用后全绿（生产 authority）；
3. before_final_receipt 生产探针（review brief 注入 verification + implementation TDD 不受影响）；
4. canonical 单点：六张单 ownerSignOff 删除后 canonicalSignoff 全 SIGNED；g0v3cons1 voided + r2 PENDING 显式；
5. audit-index selftest 含 sha256 freshness（current 节）；
6. 回归三件（regression 24 项+preflight 8+validate 0）全绿。

## 白名单
scripts/lib/migration.mjs（新建）、scripts/lib/signoff-canonical.mjs（新建或 change.mjs 导出）、scripts/regression-all.mjs（S16-2/3 改调用+S16-1 保留）、scripts/orchestrator.mjs（review 前注入点）、scripts/lib/runtime.mjs（如 review 注入需经 runtime，最小改动）、contracts/discrepancies/（g0v3cons1 voided+r2 新单+六张 SIGNED 单 ownerSignOff 删除）、contracts/asset-migration.md+asset-manifest-v2.md（仅指针声明行改 canonical 措辞）、test-reports/autopilot-work/GOV-AUTHORITY/。

## 禁止
改 asset-migration/manifest-v2 冻结正文其他内容、governance-skills/、webview/、SKILL.md、commands/、plans/ 既有文件（audit-index 修订除外）、vendor/、其他 scripts/；禁 git。
**红线**：本单产出物（migration.mjs/r2 单）不得再绕 change.mjs 最严类规则——若发现自身触碰冻结面，主动声明 CONTRACT 归类并挂 Owner PENDING，禁止 DOC_ONLY 逃逸。

## 验收要点（编排者 L2 将复核）
migration.mjs 为 S16-2/3 唯一 authority（test oracle 删除）；before_final_receipt 生产可达（review brief 实证）；canonical 单点（ownerSignOff 清除/g0v3cons1 voided/r2 CONTRACT+PENDING）；audit-index current/historical 分节+sha256 freshness；回归全绿。