# B1-GATE 派单 — 三机制单：preflight + change-lock + migration contract（批 1）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §v3.1/v3.2/v3.3 与 `handoffs/v3/write-faces-batch1.md`（你是 regression-all.mjs 的批内唯一 owner）。完成后交付证据，不自称 DONE。

## 防超时纪律
切 6 小步，每步 ≤10 分钟必须落盘：①preflight ②S14 段接入 ③change-lock CLI ④migration contract ⑤自测 ⑥RESULTS。证据边跑边写。

## 任务 A：`scripts/preflight.mjs`（全静态、零 LLM、零网络、确定性）
1. **语法门**：scripts/**/*.mjs 全量过 `node --check`（blindqueue 重复声明教训——这类错 self-test 跑不起来，只有编译器级预检能抓）；
2. **导出查重**：跨模块解析 `export const/function/class <name>`，同名导出报警（同文件内重复声明 node --check 已覆盖，这里抓跨文件冲突）；
3. **ADAPTERS 一致性**：`scripts/lib/adapters/index.mjs` 注册的每个 adapter 名，其映射目标存在且 import 路径有效；每个注册资产名 ∈ CLUSTERS candidates ∪ 已知资产集；
4. **CLUSTERS ↔ 磁盘**：candidates 逐个检查 vendor/<name> 或对应源文件存在（现态 16 资产须全过；AS-1 drop 后自动收缩）；
5. **buildManifest 单源**：grep 全仓 manifest 产物写路径，断言只有 `scripts/manifest-build.mjs` 写 contracts/asset-manifest-v2.json（防 runtime 走旧 buildManifest 绕过——第四位审计反例）；
6. **DROP_ALLOWED 断言**：读 contracts/asset-manifest-v2.json（AV-2 产物，本批并行生成中——文件缺失时此检查 SKIP 并注明），凡标记 drop-pending 的资产行，`drop_allowed` 必须显式为 true 才允许存在 drop 意图（当前无 drop 意图 → 全 SKIP 不 FAIL）；
7. **change-lock 核查**：`--changed` 参数接 git status 输出，被锁文件（plans/change-lock.json 中 owner≠当前 且未过期）出现在改动列表 → FAIL。

## 任务 B：regression-all.mjs 接入 S14 段
新增 `S14 preflight invariants` 段（跑 preflight.mjs，FAIL 即 regression FAIL）；S15 注释占位（migration invariants，AS-1 时填充）。S1-S13 零改动。

## 任务 C：`scripts/change-lock.mjs` + `plans/change-lock.json`
CLI：`--acquire <file> --owner <task> --reason <r> [--ttl 分钟默认120]` / `--check <file>` / `--release <file> --owner <task>` / `--list`。锁字段：{file, owner, task, locked, reason, expires}——**必须含 expiry**（agent 崩溃防悬挂锁，store.js 过期锁先例）；过期锁自动视为可抢。语义=建议性（真强制力在派发拒发+L2 diff 核查），注释里如实写明。

## 任务 D：`contracts/asset-migration.md`（新建，走 change.record 冻结流程，AV-1 同款单据）
内容：Migration State 机（ACTIVE→SHADOW→MIGRATING→PRIMARY→DEPRECATED→REMOVED，非法流转列举）、replace 五元组 schema（old_asset/new_asset/shadow_result/promotion_receipt/runtime_binding）、三硬门定义（legacy 禁静默/hash 绑定/五元组）、**drop_allowed 旗标语义**、影子跑夹具规范（临时、跑完即删、不留永久 Migration Adapter）。注明：全量门栈只压首个 replace，复制走机械化清单。

## 自测（证据落 `test-reports/autopilot-work/B1-GATE/`）
1. preflight 全绿（当前仓态）+ 注入探针各一：临时造重复导出/造坏 adapter 指向/造孤儿 candidates → 各自 FAIL 具名（探针文件测完删净）；
2. change-lock：acquire→check（他人视角 FAIL）→release→check（PASS）；ttl 过期自动失效（注入过期时间戳实测）；
3. S14 接入后 `node scripts/regression-all.mjs` **14 段全绿**；validate 0 警告；
4. migration contract：change.record 单齐备（Owner 签收位 PENDING）、状态机非法流转表在场。

## 白名单
scripts/preflight.mjs（新建）、scripts/change-lock.mjs（新建）、scripts/regression-all.mjs（仅加 S14/S15）、contracts/asset-migration.md + change 单（新建）、plans/change-lock.json（新建）、test-reports/autopilot-work/B1-GATE/。

## 禁止
改其他任何文件（尤其 AV-2 领地 manifest-build.mjs/manifest-sources/、SKILL.md、commands/、webview/、既有冻结件）；禁 git 操作；禁跑 BFX/FE 历史回归目录。