node : 
所在位置 行:1 字符: 130
+ ... | Out-Null; node scripts/lib/import-graph.mjs --out "test-reports\reb ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
# Import 依赖图报告

- 模块数: 69
- 依赖边数: 46
- 未解析说明符: 0
- 动态 import 引用: 2

## 环检测

无环（DAG）。

## B1→B7 接线序校验

期望序: B1(state) → B2(store) → B3(tt-journey) → B4(gate) → B5(runtime) → B6(adapters/prompt) → B7(orchestrator)

**发现 1 条冲突边：**

- B5(runtime) 应先于 B6(adapters/prompt) 接线，但 lib/runtime.mjs import 了 lib/adapters/index.mjs（反向依赖）

## 邻接表（每个模块的直接依赖）

- `contract-change-detect.mjs` → `lib/gate.mjs`
- `exec-host-generic.mjs` → `lib/adapters/util.mjs`
- `exec-host-probe.mjs` → `lib/adapters/util.mjs`
- `integration-e2e.mjs` → `lib/adapters/util.mjs`
- `kickoff-drift-check.mjs` → `lib/matrix.mjs`
- `lib/activation.mjs` → `lib/manifest.mjs`, `lib/matrix.mjs`
- `lib/adapters/bmad-cline.mjs` → `lib/adapters/util.mjs`
- `lib/adapters/index.mjs` → `lib/adapters/bmad-cline.mjs`, `lib/adapters/opencode.mjs`, `lib/adapters/portman.mjs`, `l
ib/adapters/prompt.mjs`
- `lib/adapters/opencode.mjs` → `lib/adapters/util.mjs`
- `lib/adapters/portman.mjs` → `lib/adapters/util.mjs`
- `lib/adapters/prompt.mjs` → `lib/adapters/util.mjs`
- `lib/adapters/sdlc.mjs` → `lib/adapters/util.mjs`
- `lib/adapters/util.mjs` → `lib/errors.mjs`
- `lib/approve.mjs` → `lib/deconstruct.mjs`
- `lib/deconstruct.mjs` → `lib/adapters/util.mjs`
- `lib/planner.mjs` → `lib/matrix.mjs`
- `lib/receipt.mjs` → `lib/activation.mjs`
- `lib/resilience.mjs` → `lib/errors.mjs`
- `lib/runtime.mjs` → `lib/logger.mjs`, `lib/gate.mjs`, `lib/adapters/index.mjs`, `lib/resilience.mjs`, `lib/errors.mjs
`
- `orchestrator.mjs` → `lib/logger.mjs`, `lib/manifest.mjs`, `lib/asset.mjs`, `lib/planner.mjs`, `lib/runtime.mjs`, `li
b/store.mjs`, `lib/report.mjs`, `lib/regression.mjs`, `lib/gate.mjs`, `lib/errors.mjs`, `lib/deconstruct.mjs`, `lib/app
rove.mjs`, `lib/tui.mjs`, `tt-journey.mjs`
- `regression-all.mjs` → `lib/adapters/index.mjs`
- `test-retry.mjs` → `lib/adapters/util.mjs`, `lib/resilience.mjs`, `lib/errors.mjs`
- `tt-tui.mjs` → `lib/tui.mjs`

