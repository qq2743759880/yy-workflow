# SB-1 派单 — 阶段盲测制度（批 0）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §四 SB-1 与 §五，严格按其执行。完成后交付证据，不自称 DONE。

## 任务 A：盲测队列文件 schema + 状态机
新建 `scripts/blindqueue.mjs`（白名单内）：
- 文件落 `<workspace>/.tt-state/stage-N-blindqueue.md`，字段 `| qid | 来源task | 覆盖功能点 | 验证方法(步骤+期望) | hidden | 状态 |`；
- 状态机 `pending→built→hidden→passed/failed/waived`（waived 限 CONCERNS 级且须留痕理由）；
- **hidden=true 条目的验证细节对实现 agent 不可见**（SWE-bench 实证：盲测用例保密是盲测成立的核心）——实现为导出/读取 API 上的过滤，hidden 条目只在"盲测包视图"出现；
- CLI：`--init <stage>`（task 派单时同步生成）/ `--fill <qid>`（执行者完成回填）/ `--freeze <stage>`（队列 built 后冻结）/ `--view <stage> [--blind]`（blind 视图=不含 hidden 细节）。

## 任务 B：看板
新建/扩展统计输出：阶段名 / 条目数 / built 率 / blind-pass 率 / fail 归属 task / 裁决（PASS/CONCERNS/FAIL/WAIVED 四态，BMAD TEA 口径）/ 是否阻塞下游阶段。

## 任务 C：角色切换流程文档
`scripts/blindqueue.mjs --protocol`（或 RESULTS.md 内）：编排者(建队列) → 执行者(完成回填) → 冻结 → 派独立盲行 agent（复用现有 E2E 盲行协议：身份隔离+独立工作区+session-notes）→ 编排者转修复者只按 fail 条目开修复 task（不得改盲测包）→ 全绿解锁下一阶段。

## 约束
白名单：`scripts/blindqueue.mjs`、`test-reports/autopilot-work/SB-1/`。
**不改 tt-journey.mjs**（RG-1 并行占用该文件写面——你的机验走独立脚本，不挂 prereq-check，挂点由编排者批 2 收口时统一接线）；不得改 SKILL.md/commands/webview/contracts/reference/plans/其他 scripts；禁 git。

## 自测（必须，证据落 SB-1 目录）
1. 全生命周期：--init 生成 → --fill 回填 → --freeze 冻结 → --view（正常/blind 双视图 diff：blind 视图 hidden 条目细节不可见）→ 状态机流转合法/非法路径各测一条（非法如 waived 非 CONCERNS → 拒绝）；
2. 冻结后 --fill 被拒（防篡改盲测包）；
3. 看板统计：构造 3 条目样本（1 passed/1 failed/1 waived）→ 各计数正确、fail 归属正确；
4. 回归：`node scripts/regression-all.mjs` 13/13 + `node scripts/validate-structure.mjs` 0 警告（新脚本不触发既有门）。
5. RESULTS.md：逐项证据 + D-xxx 偏差（含"hidden 保密在单会话无进程隔离下是纪律级保证非硬隔离"的如实声明）。

## 验收要点（编排者 L2 将复核）
状态机 fail-closed；blind 视图真过滤；冻结防篡改；看板四态裁决；回归全绿。