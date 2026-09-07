# Task: BE-11 执行报告与日志输出

## 概述
实现编排执行的结构化报告与统一日志：一次任务跑完后产出一个可读、可机读的报告文件（含每子任务状态、产物路径、契约 gate 结果、失败原因与耗时），并在终端输出清晰的分级日志。

## 所属与定位
- **阶段**：MVP / Phase 0
- **层级**：Backend（运行时）
- **上游依赖**：BE-02（状态）、BE-05（运行时）、BE-06（GateResult）、BE-10（失败分类）
- **下游被依赖**：BE-12（回归校验读取报告）、FE-10（README 需给出示例输出）

## 目标与非目标
**目标**
- 产出 `artifacts/report-<planId>.md`（人可读）与 `.json`（机读）。
- 终端日志分级（info/warn/debug/error），受 `--verbose` 控制。
- 报告含：任务、簇、每个子任务的 asset/status/attempts/artifactPath/gate 结果/耗时、总体结论。

**非目标**
- 不做可视化 UI / 图表；不做远程上报（离线约束）。

## 前置条件
- BE-05、BE-06、BE-10 完成；`logger.mjs`（BE-01）可用。
- `artifacts/` 目录约定已建立（BE-07 引入），并已加入 `.gitignore`。

## 输入
- 执行完成后的 `TaskPlan`、`GateResult[]`、`ContextBus.dump()`、耗时数据。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `scripts/lib/report.mjs` | 改写 | `buildReport()` / `renderMarkdown()` / `writeReport()` |
| `scripts/lib/logger.mjs` | 修改 | 补充分级与耗时计时工具 |
| `scripts/orchestrator.mjs` | 修改 | 执行结束后调用报告生成并打印摘要 |

## 实现步骤
1. `logger.mjs`：保持 `createLogger(verbose)` 接口，增加 `time(label)` 返回 `end()` 计时函数；error 统一写 stderr，info/warn 写 stdout。
2. `report.mjs`：
   - `buildReport({ plan, gates, context, timings })` → 组装报告对象 `{ planId, task, cluster, startedAt, finishedAt, durationMs, summary:{total,done,failed,skipped}, subtasks:[...], conclusion }`。
   - `renderMarkdown(report)` → Markdown：标题、概览表、每个子任务一小节（状态/尝试次数/产物/gate diff/失败原因）、结论段。
   - `writeReport(report, { outDir })` → 写 `artifacts/report-<planId>.md` 与 `.json`，返回两个路径（相对路径）。
3. `orchestrator.mjs`：
   - 在流程结束（`done` 或 `failed`）时调用 `buildReport` + `writeReport`。
   - 打印摘要（总子任务数、成功/失败/跳过、报告路径）。
   - 失败时在 stderr 输出首个失败原因。
4. 报告中所有路径使用相对路径（与 BE-03 一致的可移植性要求）。

## 关键契约 / 数据结构

```js
/**
 * @typedef {Object} ExecutionReport
 * @property {string} planId
 * @property {string} task
 * @property {string} cluster
 * @property {string} startedAt
 * @property {string} finishedAt
 * @property {number} durationMs
 * @property {{total:number,done:number,failed:number,skipped:number}} summary
 * @property {Array<{id:string,asset:string,status:string,attempts:number,artifactPath:string|null,gate:{pass:boolean,diff:string|null}|null,error:string|null,durationMs:number}>} subtasks
 * @property {'done'|'failed'|'partial'} conclusion
 */
export function buildReport({ plan, gates, context, timings }) { /* -> ExecutionReport */ }
export function renderMarkdown(report) { /* -> string */ }
export function writeReport(report, { outDir = 'artifacts' } = {}) { /* -> {mdPath, jsonPath} */ }
```

## 验收标准（Given / When / Then）
- Given 一次含 3 个子任务的执行（2 成功 1 跳过），When 调用 `buildReport`，Then `summary` 为 `{total:3, done:2, failed:0, skipped:1}` 且 `conclusion` 为 `'partial'`。
- Given 全部子任务成功，When `buildReport`，Then `conclusion` 为 `'done'`；任一 `failed` 时为 `'failed'`。
- Given 报告对象，When `renderMarkdown`，Then 输出含任务标题、概览表、每个子任务小节与结论段，且 Markdown 表格语法可被正常渲染。
- Given 报告对象，When `writeReport`，Then `artifacts/` 下生成 `report-<planId>.md` 与 `.json`，JSON 可被 `JSON.parse` 还原为同字段对象。
- Given 生成的报告，When 检查其中任意路径字段，Then 均为相对路径（不以盘符开头）。
- Given 执行失败，When orchestrator 结束，Then stderr 输出首个失败原因，且报告仍被写出（`conclusion='failed'`）。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
node -e "
import('./scripts/lib/report.mjs').then(r=>{
  const rep=r.buildReport({plan:{id:'p1',task:'t',cluster:'T2',subtasks:[{id:'s1',asset:'a',status:'done',attempts:1}]},gates:{},context:{},timings:{}});
  console.log(rep.summary.total, rep.conclusion);
  console.log(r.renderMarkdown(rep).split('\n')[0]);
});"
node scripts/orchestrator.mjs --task "实现后端登录模块" --verbose
ls artifacts
```

## 失败与回滚
- 失败：`artifacts/` 不可写 → 报告改写到 `.tt-state/` 并在终端警告，不中断主流程。
- 回滚：恢复 `report.mjs` 占位与 `orchestrator.mjs`。

## 风险与注意
- 报告是「执行证据」，必须在失败路径下也写出，否则无法复盘。
- 路径一律相对化，避免把本机绝对路径提交进仓库（TT 对可移植性有硬要求，且仓库是私密的但不应泄露路径）。
- Markdown 渲染要保证表格列数与表头一致，否则渲染错乱。

## 交付物检查清单
- [ ] `buildReport` 汇总正确（summary/conclusion）
- [ ] `renderMarkdown` 输出结构完整
- [ ] `writeReport` 同时产出 md 与 json
- [ ] 失败路径下仍写出报告
- [ ] 所有路径为相对路径
- [ ] orchestrator 已接入并打印摘要
