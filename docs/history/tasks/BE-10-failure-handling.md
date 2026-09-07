# Task: BE-10 失败处理、重试与降级

## 概述
为编排内核实现统一的失败处理：子进程失败、适配器不可用、契约违约、超时等错误的分类、重试（cockatiel 风格：重试/熔断/隔离思路）与降级策略，并保证失败时不产生脏数据。

## 所属与定位
- **阶段**：MVP / Phase 0
- **层级**：Backend（运行时）
- **上游依赖**：BE-02（状态转移）、BE-05（运行时）、BE-06（ContractViolationError）、BE-07/08/09（各类失败来源）
- **下游被依赖**：BE-11（报告需含失败原因）、BE-12（回归需验证失败路径）

## 目标与非目标
**目标**
- 建立错误分类与统一处理：`RetryableError` / `ContractViolationError` / `AdapterUnavailableError` / `TimeoutError` / `IllegalTransitionError`。
- 实现重试（默认最多 2 次、指数退避）、熔断（连续失败达阈值则跳过后续同类子任务）、降级（适配器不可用 → 标记 skipped 继续）。
- 保证失败时已成功的产物不被污染（幂等：重试使用同一输出目录，先清理再写）。

**非目标**
- 不引入 cockatiel 依赖（离线约束），仅借鉴其**模式**（重试/熔断/隔离/回退）。
- 不做分布式容错。

## 前置条件
- BE-05、BE-06 完成；BE-07/08/09 至少有一个适配器已注册（否则无失败来源可测）。
- 已理解 PRD 中的失败恢复约定：子任务失败 → 重试一次 → 仍失败则降级并标注，不污染已成功产物。

## 输入
- 各模块抛出的错误；配置 `{ maxRetries, backoffMs, circuitThreshold }`。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `scripts/lib/errors.mjs` | 创建 | 错误类型定义 |
| `scripts/lib/resilience.mjs` | 创建 | `withRetry()` / `CircuitBreaker` / `fallback()` |
| `scripts/lib/runtime.mjs` | 修改 | 在 `dispatch` 中接入重试与降级 |
| `scripts/orchestrator.mjs` | 修改 | 统一错误 → 退出码映射 |

## 实现步骤
1. `errors.mjs`：定义错误类，均继承 `Error` 且带 `code` 字段（便于映射退出码）。
2. `resilience.mjs`：
   - `withRetry(fn, { maxRetries=2, backoffMs=500 })`：捕获 `RetryableError` 与 `TimeoutError` 后重试，退避 `backoffMs * 2^n`；其他错误直接抛出。**backoff 等待不得 `unref`**（否则事件循环空转时 await 永久挂起，纯库/单测场景进程悬挂——P3 已修）。超时与重试解耦（P3 落地）：`runCommand` 新增 `throwOnTimeout` 选项——默认 false 超时 resolve 失败对象（探测/降级语义）；`true` 时超时抛 `TimeoutError` 供 withRetry 重试（opencode/bmad 真实执行启用，`--version` 探测保持默认）；`--max-retries N` 由 orchestrator 透传。
   - `CircuitBreaker`：`threshold=3`，连续失败达阈值后 `open`，后续调用直接返回降级结果；提供 `reset()`。
   - `fallback(fn, fallbackValue)`：捕获 `AdapterUnavailableError` 返回兜底值。
3. 修改 `runtime.mjs` 的 `dispatch`：
   - 用 `withRetry` 包裹适配器调用；`subtask.attempts` 每次加一。
   - 捕获 `AdapterUnavailableError` → 标记 `skipped` + warn，继续流程（不中止）。
   - 其他错误 → 标记 `failed`，按 MVP 策略中止 plan 并转 `failed`。
4. 幂等：适配器重跑前先清理 `artifacts/<subtaskId>/`，避免残留旧产物（脏数据）。
5. `orchestrator.mjs` 退出码映射：
   - 0 成功 / 2 参数错误 / 3 模块未实现 / 4 契约违约 / 5 执行失败（含超时、适配器硬失败）
   - 顶层 `try/catch` + `process.on('unhandledRejection')` 兜底，保证不出现未捕获异常栈。

## 关键契约 / 数据结构

```js
// errors.mjs
export class RetryableError extends Error { code = 'RETRYABLE'; }
export class TimeoutError extends Error { code = 'TIMEOUT'; }
export class AdapterUnavailableError extends Error { code = 'ADAPTER_UNAVAILABLE'; }
// ContractViolationError / IllegalTransitionError 已在 BE-06 / BE-02 定义

// resilience.mjs
export async function withRetry(fn, { maxRetries = 2, backoffMs = 500 } = {}) { /* ... */ }
export function createCircuitBreaker({ threshold = 3 } = {}) { /* {run, reset, state} */ }
export async function fallback(fn, fallbackValue) { /* ... */ }

// 退出码
export const EXIT = { OK:0, ARGS:2, NOT_IMPL:3, CONTRACT:4, FAILED:5 };
```

## 验收标准（Given / When / Then）
- Given 一个始终抛 `RetryableError` 的函数，When 以 `maxRetries=2` 调用 `withRetry`，Then 该函数被调用 3 次（首次 + 2 次重试）后抛出错误。
- Given 一个第 2 次才成功的函数，When 调用 `withRetry`，Then 返回成功结果且总调用次数为 2。
- Given 一个抛 `ContractViolationError` 的函数，When 调用 `withRetry`，Then **不重试**，直接抛出（契约违约不可重试）。
- Given `CircuitBreaker` threshold=3，When 连续 3 次失败，Then 第 4 次调用直接返回降级结果且不再执行原函数。
- Given 适配器抛 `AdapterUnavailableError`，When `dispatch` 处理，Then 该 subtask 标记为 `skipped`，日志含 warn，整体流程继续不中止。
- Given 某 subtask 重试后仍失败，When 重试发生，Then `artifacts/<subtaskId>/` 被先清理再写入，目录中不含上一次的残留文件。
- Given 执行失败，When orchestrator 结束，Then 退出码为 5；契约违约时为 4。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
node -e "
import('./scripts/lib/resilience.mjs').then(async r=>{
  let n=0; const {RetryableError}=await import('./scripts/lib/errors.mjs');
  const f=async()=>{n++; if(n<3) throw new RetryableError('x'); return 'ok';};
  console.log(await r.withRetry(f), 'calls=',n);
});"
node -e "
import('./scripts/lib/resilience.mjs').then(r=>{
  const cb=r.createCircuitBreaker({threshold:2});
  const f=()=>{throw new Error('boom')};
  console.log(cb.run(f,'degraded'), cb.run(f,'degraded'), cb.run(f,'degraded'));
});"
```

## 失败与回滚
- 失败：重试导致产物残留 → 检查「先清理再写」是否在所有适配器路径生效（含 opencode / bmad-cline）。
- 回滚：恢复 `runtime.mjs` 与 `orchestrator.mjs`；删除 `errors.mjs`、`resilience.mjs`。

## 风险与注意
- 契约违约**不可重试**（重试只会重复违约），必须从重试白名单中排除。
- 重试次数与退避时长要可配置，避免长任务把总时长拖爆。
- 所有错误必须带 `code`，否则退出码映射会退化成 5，掩盖真实原因。

## 交付物检查清单
- [ ] 五类错误已定义且带 `code`
- [ ] `withRetry` 只对可重试错误重试
- [ ] `CircuitBreaker` 达阈值后短路
- [ ] 适配器不可用降级为 skipped 且不中止
- [ ] 重试前清理产物目录（幂等）
- [ ] 退出码 0/2/3/4/5 映射正确
