# AV-1 派单 — Asset Manifest v2 schema change.record（批 0，冻结面 contracts/）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §二与 §四 AV-1，严格按其执行。完成后交付证据，不自称 DONE。

## 任务：Asset Manifest v2 schema 走冻结面变更流程（change.record）
为后续 AV-2 生成器与 AV-3 激活接线提供契约基础。背景：Owner 采纳的三字段（when_to_use / when_not_to_use / verification）直接命中两个实测缺口——R2 遗留的 T3-04 A6 词汇表缺口（路由器对同义说法漏配）与 BW-3 模糊 prompt 场景（资产零调用）。

## 施工
1. 写 `contracts/asset-manifest-v2.md`（schema 定义，走 change.record 单，含 schema 版本 + 迁移说明）。每行 schema：
   ```json
   { "id", "name", "role", "capability", "cluster": [], "when_to_use": [], "when_not_to_use": [], "verification": "", "source": "vendor/<name>/...#Lxx-Lxx" }
   ```
2. 纪律要点（写进 schema 文档）：
   - 提取源 = 每资产源文档头部既有结构化区（缺则**手工补齐源文档，不允许生成器编造**——缺字段 fail-closed 报 CANDIDATE_INVALID，与 evolution.propose 同口径）
   - `when_not_to_use` 是新增能力：activation 负向匹配命中 → 该资产从本任务 candidates 剔除并在 debug 面留痕
   - change.record 单注明：16 行 v2 数据（后续随 AS 重组调整）走冻结确认后进 manifest；后续增改走 evolution.propose
3. 同步 `scripts/lib/asset.mjs`（消费端）加 manifest 字段读取接口（**只加接口，不改既有逻辑**）。

## 自测（证据落 test-reports/autopilot-work/AV-1/）
1. change.record 单齐备（含 schema 版本 + 迁移说明 + Owner 签收位）；
2. `node scripts/validate-structure.mjs` 0 警告（新增 contracts/ 文件若触发 H6a-1 孤儿断言，登记 D-偏差说明）；
3. `node scripts/regression-all.mjs` 13/13；
4. asset.mjs 新接口：读取 schema 必填字段齐全 → 返回对象；缺字段 → 抛 CANDIDATE_INVALID。

## 白名单
contracts/asset-manifest-v2.md（新建）、contracts/ 下 change.record 单、scripts/lib/asset.mjs（仅加接口）、test-reports/autopilot-work/AV-1/。

## 禁止
改 SKILL.md、commands/、webview/、其他 scripts/、既有 contracts/ 冻结件；git 操作。