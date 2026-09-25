# HARDEN-1 派单 — 批 1 收口前硬化三轮（H1/H2/H3，第十三审计采纳）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `test-reports/autopilot-work/FINAL-E2E/final-e2e-assert.mjs`（宿主模式现状）、`plans/execution-plan-v3-20260923.md` v3.3（S15/S16 定义位）、`test-reports/autopilot-work/AS-1/RESULTS.md` 与 `GW-1/RESULTS.md`（H3 索引材料）。完成后交付证据，不自称 DONE。

## 防超时纪律
三步各 ≤10 分钟落盘；探针输出存文件。

## H1【P0】：failed state cannot promote 机验
新增 `scripts/regression-all.mjs` S16 段（继 S15）——两条断言：
1. **行为探针**：跑 FINAL-E2E 同款 mech 主链（--backend auto + MECH_HOST）于临时 workspace（含会令 implementation 失败的形态——opencode 未登录即自然 failed），断言：status=failed 的子任务 → `promotionReceipt==null` 且 migration-record 无其 PRIMARY transition 且相关 receipt 无 SIGNED 引用该子任务；
2. **静态断言**：全仓 migration-record/state 文件扫描——凡 status=failed 的 plan/subtask 记录，不得存在 SIGNED promotion receipt 指向它（现行仓态应零违例）。
证据落 `test-reports/autopilot-work/HARDEN-1/`。

## H2【P1】：FINAL-E2E 更名 + Host Mode 显式声明
- 更名（目录不动防证据路径断裂，只改文档与账面）：RESULTS.md 标题"批 1 终验·真实 production 主链"→"**Runtime Boundary E2E**（Host Mode: mechanical acceptance host——验证 runtime 执行链，非 LLM 规划质量）"；ACCEPTANCE-ENTRY.md 同步；ledger 已有表述追加更正行。
- llm 模式声明：`--host-mode=llm` 路径存在但依赖真实 LLM 宿主（E-4 张力在案），标注"post-Owner-ruling 可选项"。
- 白名单：FINAL-E2E/RESULTS.md、FINAL-E2E/ACCEPTANCE-ENTRY.md、plans/autopilot-ledger-20260921.md（追加更正段）。

## H3【P1】：审计索引（外部受限审计者导航用）
新建 `plans/audit-index-20260925.md`：第十三轮审计"UNVERIFIED/未读取"项的证据指针表——AS-1 RESULTS/GW-1 RESULTS/governance 探针/七 vendor 删除的 git 记录等，每项：finding → 证据文件路径 → 复验命令一行。目的：受限 MCP 审计者按索引直读，不再 NOT FOUND。

## 禁止
改 contracts/、governance-skills/、webview/、SKILL.md、commands/、其他 scripts/（S16 在 regression-all.mjs 内追加）、plans/ 既有文件（audit-index 新建除外）；禁 git。

## 验收要点
S16 两断言正反探针齐（含注入反例：临时造 failed+SIGNED receipt 组合→FAIL 具名）；更名三处一致；audit-index 覆盖第十三轮全部 UNVERIFIED 项。