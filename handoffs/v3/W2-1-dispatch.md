# W2-1 派单 — Planner Capability Production（Batch 3 Wave 2 Step 1）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先完整读派单 `D:\.ai-hub\skills\yy\handoffs\v3\W2-1-dispatch.md`（十六字段+白名单+禁改+步骤全在其中）与 Ingress Mini-Contract `plans/W2-0-ground-truth-ingress-contract-20260927.md`（唯一契约权威）。完成后交付证据，不自称 DONE。

## 防超时纪律
切 6 小步每步 ≤10 分钟落盘：①派生规则模块 ②planner 接线 ③CLI/KNOWN 集合 ④探针 ⑤回归 ⑥RESULTS。探针输出存文件（W2-1 目录）。

## 任务
1. 新建 `scripts/lib/capability-derivation.mjs`：静态派生规则表 `DERIVATION_RULES`（受控关键词组 → CAPABILITY_MAP 已有键）+ `deriveCapability(taskText)` 纯函数（确定：同输入同 key；无命中 → null）；**规则表须与 `scripts/lib/matrix.mjs` CLUSTERS[].keywords 同源校验**（构建时断言 ⊆ 已有键；禁复制第二份 taxonomy）；派生规则表不得含自由文本语义匹配（禁正则/模糊，只允许受控关键词包含判定，与 route() 同款）。
2. `scripts/lib/planner.mjs` buildPlan 接线：`route()` 命中 cluster 后 → `deriveCapability(taskText)` → 有命中则 subtask 附加 `capability`/`capabilitySource:'derived'` 字段（**加法字段，asset 原语义零改动**；cluster 与 capability 解析的 asset 不在同簇 → `CAPABILITY_CLUSTER_MISMATCH` fail-closed，不静默取一）。
3. `scripts/lib/orchestrator.mjs`：CLI `--capability <key>`（走显式输入优先级，override 派生；不在 CAPABILITY_MAP → `CAPABILITY_UNKNOWN` argError）+ `--exec` 透传 KNOWN 集合同步 `--capability`。
4. `scripts/lib/activation.mjs`：CAPABILITY_MAP 键 ⊆ 值域断言（探针已有）保持；新增导出 `derivationRulesConsistent()`（供探针）。

## 自测（证据落 `test-reports/autopilot-work/W2-1/`）
1. 派生探针：含"安全审计"关键词任务 → capability=security-audit；含"OpenAPI 校验" → be-validator 对应键；无命中任务 → null；
2. cluster 交叉校验：派生 asset 不在同簇 → CAPABILITY_CLUSTER_MISMATCH；
3. CLI：`--capability security-audit` 显式输入；`--capability unknown-key` argError；`--exec --capability x` 被透传（KNOWN 集合生效）；
4. 向后兼容：无 capability 任务 → plan/subtask 零字段变化（字节级比对 plan JSON）；
5. 同源校验：DERIVATION_RULES 键 ⊆ CAPABILITY_MAP keys（探针实测）；
6. 回归三件（regression 24 项/preflight 8 项/validate 0）全绿 + audit-index selftest 68；
7. RESULTS.md：逐项 + D-xxx 偏差。

## 白名单
scripts/lib/capability-derivation.mjs（新建）、scripts/lib/planner.mjs（buildPlan 最小 diff）、scripts/lib/orchestrator.mjs（parseArgs+KNOWN+plan 后处理）、scripts/lib/activation.mjs（仅导出断言辅助）、test-reports/autopilot-work/W2-1/。

## 禁止
改 contracts/、scripts/lib/runtime.mjs、scripts/lib/activation.mjs 既有逻辑、scripts/lib/prompt-composer.mjs、scripts/lib/governance.mjs、scripts/lib/migration.mjs、scripts/regression-all.mjs、webview/、SKILL.md、commands/、plans/ 既有文件、vendor/、governance-skills/；禁 git。

## 验收要点（编排者 L2 将复核）
派生确定性（同输入同 key）、同源校验探针、cluster 交叉校验、CLI+KNOWN、向后兼容字节级、回归三件全绿。