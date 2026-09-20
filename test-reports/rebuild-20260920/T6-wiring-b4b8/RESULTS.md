# T6 接线 B4-B8 施工结果（rebuild-20260920）

> 派单：`handoffs/T6-wiring-B4-B8-20260920.md`。计划：`plans/wiring-and-audit-plan-20260920.md` P3 阶段 B B4-B8。
> 白名单可写：仅 `scripts/lib/gate.mjs`、`scripts/lib/runtime.mjs`、`scripts/lib/adapters/prompt.mjs`、`scripts/orchestrator.mjs` + 本自测目录。未改 contracts/、vendor/、plans/tasks/、其他 lib/（含 adapters/index.mjs）。无 git 操作。

## 总门（最终复跑，全绿）

| 门 | 结果 |
|---|---|
| `node scripts/regression-all.mjs` | **12 PASS / 0 FAIL** |
| `node scripts/validate-structure.mjs` | **0 警告** |
| `node test-reports/R10-rebuild-20260920/run-fixtures.mjs` | **12/12** |
| R3-activation-receipt 探针 | 16/16 |
| R4-phase 探针 | 12/12 |
| R5a-journey 探针 | 16/16 |
| R7-change 探针 | 12/12 |
| R8-remediation 探针 | 12/12 |
| B0 `T4-wiring-b0b3/b0-diff.mjs`（--lib 双跑） | **5/5**（G1-G4 逐字节一致 + 退出码一致） |
| T6 本探针 `run-probes.mjs`（B4-B7） | **21/21** |

## 各步落点

### B4 gate.mjs → remediation.register（桥接）
- 新增导出 `registerReviewFindings(input, opts)`（纯 additive，不动既有 before/after）。
- 接受**已解析**批判条目（`{title,url,date,plan,minVerify,level}`）——不 import review-gate.mjs（其顶层 `process.exitCode=1` 副作用会污染退出码）。
- **污染防护**：`opts.registerFindings !== true` 走 DRY-PRINT，只组装 finding 返回，**零写盘**。
- **落盘路径**：`withLock(<ws>/.tt-state/state.json)`（B2 fail-closed）包裹 → `remediationRegister` 写自带 append-only ledger → `appendNamespace('finding', ...)` 在 B1 finding 命名空间登记索引记录。
- 幂等码实测为 `REMEDIATION_DUPLICATE`（非派单摘要所写 `DUPLICATE_IDEMPOTENT`，已按源码修正）；重跑 0 新增。
- 日期归一：review-gate 的 `2026/09/02` 斜杠日期自动转 ISO `2026-09-02`（remediation evidence gate 要求 ISO）。
- 调和说明：remediation.register 自带 ledger 是权威 finding 存储；B1 finding 命名空间只作索引镜像（与派单「写入走 B1+B2」一致——桥接写路径经 B1+B2 包裹）。

### B5 runtime.mjs → activation.prepare（含 DI）
- **DI 落点**：模块级 `_adapterResolver`（默认静态 import）+ `export setAdapterResolver(fn)`（返回旧 resolver 便于还原）+ 单次 `opts.resolveAdapter` 覆盖。**未改 adapters/index.mjs**。
- **YY_ACTIVATION=lib|legacy**（默认 legacy）路由：仅 `lib` 且 prompt 后端时调 `activationPrepare(...)` 并把 `activationPackage` 挂到 opts 传给 adapter。
- 任何失败（asset 不在 16 catalog / manifest 缺失 / 异常）→ **降级 legacy + logger.warn，绝不 BLOCK**（try/catch 包裹）。
- `YY_RECEIPT_MODE`（activation 自身 legacy/dual/strict）与 `YY_ACTIVATION`（lib/legacy）是两个变量，未混淆。

### B6 adapters/prompt.mjs 模板组装
- legacy（无 `activationPackage`）保持**逐字旧 brief**（行为零变化）。
- lib 路径：用 `renderBrief(activationPackage.briefFrame)` 渲染，并用运行期动态值覆盖静态帧（upstreamRefs/前置/正文/资产根），字段一一对应（8 字段覆盖矩阵探针通过）。
- **journey copyNextPrompt 快照引用**：`options.nextPrompt` 存在时追加「下一步提示（快照引用，recompute=false）」段。
- `renderBrief` 与 `extractPayloadFromBrief` 往返一致（探针验证）。

### B7 orchestrator.mjs 集成
- **核心循环 import lib/orchestrator.mjs**：`parseArgs/validateOpts/isOpenApiSpec/parseBacklogRows/backlogIsPending` 改从 lib 导入，删除顶层全部内联副本（逐字等价，A2 已差分验证；B0 b0-diff 5/5 再次确认逐字节一致）。
- 新增旗标（纯无值，argv 扫描，不进 lib parseArgs）：`--allow-out-of-order`、`--evolve`。
- `maybeRunB7Hooks()`：全部旗标制、默认 no-op、best-effort try/catch 不阻断——
  - `--allow-out-of-order`：只读 `checkPhase` 观察并 warn（真正 force+ownerReceipt 在 phase.mjs，编排器默认不推进 phase）；
  - 契约改动（--contract/--contract-draft/--evolve）走 `recordChange`；
  - `--evolve`：对 done 子任务 best-effort 调 `evolutionPropose` 产候选壳。
- **未翻任何默认行为**：无旗标时与改造前一致（regression 12/12、S7 等全绿为证）。

### B8 端到端冒烟
- `--help` 正常打印（exit 0）；非法 `--backend` 经 lib validateOpts 返回 exit 2（参数门接线正确）。
- `YY_ACTIVATION=lib --evolve --allow-out-of-order` 对无匹配任务不崩溃（graceful NoMatchError）。
- 真实回归面由 regression-all 12/12 + R10 + 六探针 + B0 双跑覆盖（e2e/ws 沙箱用于冒烟，不污染仓库）。

## 已知偏差 / 登记
- **P2-4 BL_PENDING_RE**：B7 删除了顶层 orchestrator.mjs:110 的副本，现统一引用 lib/orchestrator.mjs:108。ci S5 仍只检 `⬜`，维持现状不统一（按派单要求登记，未强行统一）。
- 派单摘要中 remediation 幂等码记为 `DUPLICATE_IDEMPOTENT`，源码实测为 `REMEDIATION_DUPLICATE`——已按源码为准实现并登记此偏差。
- io-audit hook：本轮 e2e consumption 初值以 run-probes.mjs 的 B4/B6 读写面为证（临时目录）；io-audit 既有 p01-p08 为路径/basename 探针，与本次接线面无直接耦合，未改。

## 产物
- `run-probes.mjs`：B4-B7 单元探针（21 断言）。
- `e2e/ws/`：冒烟工作区。
- 四个白名单文件已改（gate/runtime/prompt/orchestrator）。
