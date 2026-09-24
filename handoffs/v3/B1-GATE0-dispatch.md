# B1-GATE0 派单 — Baseline Freeze（批 1 Gate-0）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §v3.3 Gate-0 与 `handoffs/v3/write-faces-batch1.md`。完成后交付证据，不自称 DONE。

## 任务：迁移前逐资产机器可读基线快照
生成 `test-reports/asset-eval-20260923/asset-baseline-before.json`，16 资产逐行：
```json
{ "asset_id":"", "current_adapter":"prompt|opencode|bmad|portman", "current_routes":["所属簇 ids"], "current_consumption":{"mechanism":"S8链内|无","bw":"消费|提及|零现"}, "current_manifest_hash":null, "vendor_path":"vendor/<name> 或 null", "snapshot_at":"ISO 时间" }
```
数据源（全部实测提取，标注 实测/推断）：
- adapter：`scripts/lib/adapters/index.mjs` ADAPTERS Map
- routes：`scripts/lib/matrix.mjs` CLUSTERS candidates
- consumption：EA-1 BASELINE.md 结论映射
- vendor_path：磁盘实存
- manifest hash：null（AV-2 产物尚未存在——正是"迁移前状态"的忠实记录）

## 纪律
- 该文件是 Gate-5 回滚演练与"迁移后对照"的输入——**快照后不得因批 1 改动而重写**（首批 replace 完成后由编排者生成 after 版本对照）。
- 与 EA-1 BASELINE.md 交叉核对：16 行集合必须一致，不一致处登记 D-偏差。

## 白名单
只读 + 新建 `test-reports/asset-eval-20260923/asset-baseline-before.json`。

## 验收要点
16 行齐、字段与 ADAPTERS/CLUSTERS/EA-1 三源交叉一致、复算命令可给。