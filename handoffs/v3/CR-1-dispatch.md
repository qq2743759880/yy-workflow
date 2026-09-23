# CR-1 派单 — 批判协议 v2（批 0）

你是 autopilot 管理 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §四 CR-1，严格按其执行。完成后交付证据，不自称 DONE。

## 任务 A：批判源清单绑定（防"自己定标准自己批判"）
改 `scripts/review-gate.mjs`（白名单内唯一脚本）：
- 新增 `--critique-sources <path>[,<path>...]` 参数（来源=向导 ON-1 落盘的 `orchestrator.config.yaml` 的 `critique.sources` 段，缺省=none）；
- 批判条目 schema 强制三元绑定：`claim → evidence → source`，**无 source 的批判判 INVALID**（fail-closed）；
- source 枚举：`knowledge-base`（知识库路径）/ `search-tool`（搜索工具）/ `standard-doc`（标准文档）/ `none`——若用户向导选了 `none`，批判仍可执行但每条必须标注"本批判无外部源，仅基于项目内部资料"，不得静默。

## 任务 B：批判看板 v2
升级 `plans/critique-backlog-tracker.md` 字段：`claim / source / severity / status(registered|accepted|converted|done|rejected) / converted_task_id / implementation_steps 引用`。
- 新增统计段：收录数 / 各状态计数 / 转化率 / 无 source 条目数（机验可读）。

## 任务 C：转化纪律
批判转 task 必须复用 TK-1 的七字段模板（**只写目标结果的转化单判 INVALID**）；review-gate 新增 `--convert-critique`：产出 task 文档时跑 TK-1 机验，不过则拒绝落盘。

## 约束
白名单：`scripts/review-gate.mjs`、`plans/critique-backlog-tracker.md`（仅模板面，不动既有登记行）、`test-reports/autopilot-work/CR-1/`。
不得破坏既有 S7 review-gate self-test（regression S7 必须真跑过）；不得改 SKILL.md/commands/webview/contracts/reference/plans/其他 scripts；禁 git。

## 自测（必须，证据落 CR-1 目录）
1. 源绑定：构造含"无 source 批判"的样本 → 判 INVALID 且 detail 指名缺失 source；含 source 的样本 → 通过；
2. 看板：样本批判入库 → 统计段各状态计数正确、无 source 计数>0；
3. 转化：批判转 task 缺 implementation_steps → 拒绝落盘；合规 → 落盘且含 verify_command；
4. 回归：`node scripts/regression-all.mjs` 13/13（S7 必须真跑）+ `node scripts/validate-structure.mjs` 0 警告。
5. RESULTS.md：逐项证据 + D-xxx 偏差。

## 验收要点（编排者 L2 将复核）
三元绑定 fail-closed；看板统计可读；转化强制七字段；S7 全绿。