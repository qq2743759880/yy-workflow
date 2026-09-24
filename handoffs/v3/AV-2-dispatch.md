# AV-2 派单 — Manifest 构建器 + 16 资产数据填充（批 1）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §二/§v3.1（Manifest v2.1 增量裁定）与 `handoffs/v3/write-faces-batch1.md`。完成后交付证据，不自称 DONE。

## 防超时纪律
切 6 小步每步 ≤10 分钟落盘：①manifest-build.mjs ②sidecar×16 ③构建 16 行产物 ④drop_allowed 旗标 ⑤自测 ⑥RESULTS。

## 任务 A：`scripts/manifest-build.mjs`（manifest 唯一构建器——单源由此确立）
构建 `contracts/asset-manifest-v2.json`（asset-manifest-v2@1.0.0 schema，AV-1 冻结单口径）。数据流：`contracts/manifest-sources/<asset>.yaml`（sidecar，本单新建）→ 构建器合并 vendor 指针 → 产物。**vendor 文件一字不改**——三字段的方法论内容写在 sidecar（我们署责任），sidecar 内 `source:` 字段引用 vendor 路径与行号。

## 任务 B：sidecar × 16（现资产集，drop 7 尚未执行）
每资产 sidecar 字段：`id / when_to_use[] / when_not_to_use[] / verification / source("vendor/<name>/...#Lxx") / drop_pending:false / drop_allowed:false`。
- 内容依据 = 资产源文档（vendor 头部 + reference）与 EA-1 基线的实测消费语义；**不确定的内容宁可写窄，禁止编造**（缺字段 = CANDIDATE_INVALID fail-closed，与 evolution.propose 同口径）；
- 资产清单权威源 = `scripts/lib/matrix.mjs` CLUSTERS（16 个）；
- 构建器校验：三核心字段非空、source 路径存在、drop_allowed 显式布尔；缺失 → CANDIDATE_INVALID 具名。

## 任务 C：drop_allowed 旗标语义落产物
全部 16 行 `drop_pending:false, drop_allowed:false`（当前无 drop 意图）——B1-GATE 的 preflight 会读本产物做断言，字段名必须与派单 B1-GATE 一致。

## 自测（证据落 `test-reports/autopilot-work/AV-2/`）
1. 构建 16/16 行成功，`asset.mjs` 的 `readManifest`（AV-1 接口）读产物全字段通过；
2. fail-closed：删一个 sidecar 字段 → 构建器 CANDIDATE_INVALID 具名；source 路径不存在 → 具名；
3. 单源：产物 hash 打印（供 Gate-2 runtime hash 绑定用）；
4. 回归：regression 14 段（B1-GATE 并行加了 S14——若其未合入则 13 段，RESULTS 里如实注明你跑到的段数）+ validate 0。
5. RESULTS.md：16 行摘要 + 逐测试 + D-偏差。

## 白名单
scripts/manifest-build.mjs（新建）、contracts/manifest-sources/（新建目录×16 sidecar）、contracts/asset-manifest-v2.json（新建产物）、test-reports/autopilot-work/AV-2/。

## 禁止
改 vendor/ 内文件、scripts/lib/asset.mjs（AV-1 面）、scripts/orchestrator.mjs、regression-all.mjs（B1-GATE 领地）、SKILL.md、commands/、webview/、plans/；禁 git；禁跑 BFX/FE 历史回归目录。