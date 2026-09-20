# T2 派单 — 内核静态图测绘 + ci/orchestrator 纯化抽取（P3-A0/A1/A2）

你是本任务的独立执行 agent。工作区：`D:\.ai-hub\skills\yy`（Windows，Node v24，零 npm 依赖）。
完工后由独立编排者盲测验收——**验收探针你不可见，自测 PASS 不构成验收依据**。

## 必读规格（唯一事实源）

1. `plans/wiring-and-audit-plan-20260920.md` 的 P3 阶段 A 节
2. `scripts/ci.mjs`（A1 抽取源，只读）+ `scripts/orchestrator.mjs`（A2 抽取源，只读）
3. `scripts/lib/evolution.mjs`（风格基准）

## 交付物

1. **A0 `scripts/lib/import-graph.mjs`**：静态解析 `scripts/**/*.mjs` 的 import 依赖图
   （AST 或保守正则皆可，但必须声明口径与已知盲区）；环检测；输出 JSON + markdown 图；
   CLI 入口 `node scripts/lib/import-graph.mjs [--out <path>]`。结论必须回答：
   B1(state)→B2(store)→B3(tt-journey)→B4(gate)→B5(runtime)→B6(adapters/prompt)→B7(orchestrator)
   这个接线序与真实依赖边是否冲突（冲突边逐一列出）
2. **A1 `scripts/lib/ci.mjs`**：从 `scripts/ci.mjs` 抽取纯函数库——`GATE_TOPOLOGY`（S1-S12 拓扑与
   fail-closed 分类矩阵）、`runGate(name, ctx)`、`classifyFailure()`；顶层脚本**不改**（B0 才切）。
   差分自测：构造 ≥6 组输入（含必失败组），lib 与顶层脚本逐门输出一致
3. **A2 `scripts/lib/orchestrator.mjs`**：从 `scripts/orchestrator.mjs` 抽 plan/dispatch/aggregate
   纯逻辑；process.exit/未捕获 rejection/直接 console 等全局态**不得带进 lib**——以显式注入
   （依赖参数/回调）替代，lib 内禁止调用 process.exit。差分自测：同一 task 输入下，
   lib 的 plan 产物与 `node scripts/orchestrator.mjs --plan --dry-run` 输出逐字节一致（≥3 组输入，
   至少 1 组触发错误路径）
4. 自测目录 `test-reports/rebuild-20260920/A0-import-graph/`、`.../A1-lib-ci/`、`.../A2-lib-orchestrator/`
   （各自 probes + RESULTS.md：自测输出原样 + 差分结果 + 偏差声明）

## 允许写入（白名单）

上述新文件与自测目录。**禁止**修改 `scripts/ci.mjs`、`scripts/orchestrator.mjs` 及任何既有文件；
禁止 git add/commit/push；禁止读 `test-reports/acceptance-*/`。

## 纪律

零 npm 依赖；ESM；中文注释；fail-closed；`[待补充]` 保持；抽取原则 = **行为等价优先于代码美观**，
凡是无法行为等价抽取的部分，留在 lib 之外并在 RESULTS.md 逐条声明（宁可少抽，不可变行为）。

## STOP 条件

若抽取必须改变可观测行为（含错误码/退出码/输出顺序）才能完成，或发现 ci/orchestrator 与
规格文档描述存在不可调和的冲突。触发即停并如实报告冲突事实。
