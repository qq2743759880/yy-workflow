# Task: BE-05 agent 运行时与上下文共享

## 概述
实现 agent 运行时：按 `TaskPlan` 顺序派单执行子任务，维护进程内共享上下文（前序子任务的产物路径可被后序读取），并在每个子任务前后调用契约 gate 钩子。

## 所属与定位
- **阶段**：MVP / Phase 0
- **层级**：Backend（运行时）
- **上游依赖**：BE-02（状态模型）、BE-04（TaskPlan）
- **下游被依赖**：BE-07/08/09（适配器由运行时调用）、BE-10（失败重试挂在这里）、BE-11（报告）

## 目标与非目标
**目标**
- 实现 `executePlan(plan, ctx)`：顺序遍历 subtasks，逐个派单。
- 实现共享上下文 `ContextBus`：读写 key-value，前序产物路径可被后序子任务读取。
- 在子任务执行前后调用 `gate.before()` / `gate.after()`（gate 本体 BE-06，本任务先按接口调用）。
- 支持 `--dry-run`：只打印将要执行的子任务，不真正派单。

**非目标**
- 不实现具体适配器（BE-07/08/09）、不实现 gate 逻辑（BE-06）、不实现重试策略细节（BE-10，本任务只留钩子）。

## 前置条件
- BE-02、BE-04 完成；`scripts/lib/gate.mjs` 已有接口定义（可先为占位）。
- 适配器目录 `scripts/lib/adapters/` 已建（BE-01）。

## 输入
- `TaskPlan`；`{ dryRun, verbose, workspace }` 选项。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `scripts/lib/runtime.mjs` | 改写 | 实现 `createContextBus()` / `executePlan()` / `dispatch()`（done 子任务跳过，resume 语义） |
| `scripts/lib/adapters/index.mjs` | 改写 | 适配器注册表（BE-07/08/09 逐个注册）+ 内置 prompt 兜底（P1-1：16 资产全部可达） |
| `scripts/lib/asset.mjs` | 创建 | 资产加载器：读 SKILL.md 全文 / agent 正文、剥离 frontmatter，按 manifest name 索引（P1-1 根治） |
| `scripts/lib/adapters/prompt.mjs` | 创建 | 内置 Prompt 执行后端：资产方法论 + 任务 + contract + 上游产物引用 → `artifacts/<subtaskId>/brief.md`（P1-1 根治） |

## 实现步骤
1. 实现 `createContextBus()`：内部 `Map`，暴露 `set(key,value)` / `get(key)` / `has(key)` / `dump()`；所有值必须可 JSON 序列化。
2. 实现 `resolveAdapter(assetName, backend='auto')`：`auto`（默认）有专用 CLI 适配器走 CLI、无则回落内置 prompt 后端（不再返回 null）；`prompt` 一律走内置后端（纯本地）；`cli` 只走专用适配器、无则返回 null（运行时降级为 skipped，不中断整体流程）。
3. 实现 `dispatch(subtask, ctx, opts)`：
   - 调用 `gate.before(subtask)`（若 gate 未实现则跳过并记录 warn）。
   - `opts.dryRun` 为 true 时只打印 `[dry-run] 将执行 <asset>` 并返回 `{ ok:true, dryRun:true }`。
   - 否则调用适配器 `run(subtask, ctx, opts)`，得到 `{ ok, artifactPath, error }`。
   - 调用 `gate.after(subtask, opts)`（产物存在性检测，无产物 throw `ContractViolationError` 并透传）。
   - 成功则 `ctx.set('artifact:'+subtask.id, artifactPath)` **且 `subtask.artifactPath = artifactPath`**，subtask.status 转 `done`。
4. 实现 `executePlan(plan, opts)`：
   - 遍历 `plan.subtasks`，对每个调用 `dispatch`；**status 已是 `done` 的子任务直接跳过（resume 语义，不重跑）**；任一步失败按 BE-10 钩子处理（MVP 选中止并转 `failed`）。
   - 全 skipped → `plan.degraded = true`（结果不撒谎）。
   - 返回更新后的 plan 与 `ctx.dump()`。
5. 全程用 logger 输出每个 subtask 的开始/结束/耗时。

## 关键契约 / 数据结构

```js
export function createContextBus() {
  return { set, get, has, dump };  // values JSON-serializable
}
/**
 * @typedef {Object} DispatchResult
 * @property {boolean} ok
 * @property {string|null} artifactPath
 * @property {string|null} error
 * @property {boolean} [dryRun]
 */
export async function dispatch(subtask, ctx, opts) { /* -> DispatchResult */ }
export async function executePlan(plan, opts) { /* -> { plan, context } */ }
export function resolveAdapter(assetName) { /* -> Adapter|null */ }

// 适配器统一接口（BE-07/08/09 实现）
/** @typedef {{name:string, run:(subtask:object, ctx:object)=>Promise<DispatchResult>}} Adapter */
```

## 验收标准（Given / When / Then）
- Given 一个含 3 个子任务的 plan，When 以 `dryRun:true` 执行 `executePlan`，Then 打印 3 条 `[dry-run] 将执行 <asset>` 且**不产生任何文件写入**，返回计划中每个 subtask 的 `attempts` 未增加。
- Given 子任务 A 执行成功并写入 `ctx.set('artifact:A','path/to/a')`，When 子任务 B 执行，Then B 可通过 `ctx.get('artifact:A')` 读到 `'path/to/a'`。
- Given 某 subtask 的资产未注册专用适配器，When 以 `backend='auto'` 执行 `dispatch`，Then 回落内置 prompt 后端：产出 `artifacts/<subtaskId>/brief.md`（含资产方法论全文），subtask 转 `done`；When 以 `backend='cli'` 执行，Then 该 subtask 标记为 `skipped`、记录 warn 日志，且**整体流程不抛未捕获异常**。
- Given 一个 plan 中某 subtask 已是 `done`，When 以 resume 语义执行 `executePlan`，Then 该 subtask 直接跳过（`skip subtask ... (already done)`），不重跑、attempts 不增加。
- Given gate 模块尚未实现（抛 NOT_IMPLEMENTED），When `executePlan`，Then 捕获该错误、输出 warn 并继续执行（不中断）—— 或按实现选择显式跳过；两种行为必须在代码注释中写明。
- Given 一个子任务适配器返回 `{ok:false, error:'boom'}`，When `executePlan`，Then 该 subtask.status 为 `failed`，plan.status 转为 `failed`，且错误被记录。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
node -e "import('./scripts/lib/runtime.mjs').then(async r=>{const ctx=r.createContextBus();ctx.set('artifact:A','p/a');console.log(ctx.get('artifact:A'))})"
# dry-run 端到端（需在 BE-04 接入后）
node scripts/orchestrator.mjs --task "实现后端登录模块" --dry-run --verbose
```

## 失败与回滚
- 失败：适配器抛同步异常 → 用 try/catch 包住并转成 `DispatchResult{ok:false,error}`。
- 回滚：恢复 `runtime.mjs` 占位；删除 `adapters/index.mjs`。

## 风险与注意
- 上下文禁止存放不可序列化对象（如函数、Stream），否则 `dump()` 与报告生成会失败。
- MVP 采用「遇错即中止」的保守策略；重试/降级在 BE-10 统一实现，本任务不要提前埋复杂逻辑。
- `--dry-run` 必须真正无副作用，这是后续所有自动化验证的安全阀。

## 交付物检查清单
- [ ] `ContextBus` 可跨 subtask 共享数据
- [ ] `resolveAdapter` 未注册时安全降级
- [ ] `--dry-run` 零副作用
- [ ] gate 钩子已在 before/after 两处调用
