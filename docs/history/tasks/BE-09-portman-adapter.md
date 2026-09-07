# Task: BE-09 portman/contracteer 适配器（be-validator）

## 概述
为 `be-validator` 实现契约测试适配器，用 `apideck-os/portman`（OpenAPI→Postman 契约测试）或 `sabai-tech/contracteer`（OpenAPI→契约测试）替换 TT 现有的自定义契约校验，并作为 BE-06 契约 gate 的实际校验实现。

## 所属与定位
- **阶段**：MVP / Phase 2（高杠杆替换）
- **层级**：Backend（运行时 / 适配器）
- **上游依赖**：BE-05（运行时与注册表）、BE-06（gate 接口）、FE-09（be-validator 资产已改写）
- **下游被依赖**：BE-06（gate 调用本适配器做真实校验）、BE-10（契约违约→失败流程）

## 目标与非目标
**目标**
- 实现 `scripts/lib/adapters/portman.mjs`，符合统一 `Adapter` 接口。
- 能用 OpenAPI 契约为输入，跑出契约测试结果，并把 pass/fail 与差异回写给 gate。
- 工具不可用时降级为 BE-06 的本地快照比对（保证 gate 仍可工作）。

**非目标**
- 不实现 portman/contracteer 自身功能；不引入需要联网的安装步骤（离线约束，见风险）。

## 前置条件
- BE-05、BE-06 完成（`gate.mjs` 暴露 `before/after`，且支持注入校验器）。
- FE-09 已完成 be-validator 资产改写。
- 仓库内已有或待建 `contracts/` 目录（BE-06 创建），内含 OpenAPI JSON 契约。

## 输入
- `SubTask`（asset 为 `be-validator`）；`contracts/*.json`（OpenAPI）；`{ dryRun, timeoutMs }`。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `scripts/lib/adapters/portman.mjs` | 创建 | 契约测试适配器 |
| `scripts/lib/gate.mjs` | 修改 | 支持注入 `validator`，优先用适配器、不可用时回退本地比对 |
| `scripts/lib/adapters/index.mjs` | 修改 | 注册 `be-validator` → portman |

## 实现步骤
1. 实现 `isAvailable()`：检测 `portman` / `contracteer` CLI 是否可用（执行 `--version`）；两者任一可用即 true。
2. 实现 `run(subtask, ctx, opts)`：
   - 解析 `subtask.contract` 得到 OpenAPI 文件路径（MVP 只支持本地 `.json`）。
   - 若工具可用：调用对应 CLI 生成/运行契约测试（**先执行 `--help` 确认参数**，禁止臆造），捕获输出。
     - 解析结果 → `{ ok:true, artifactPath:<report路径>, meta:{ pass:true/false, diff } }`
   - 若不可用：返回 `{ ok:false, error:'CONTRACT_TOOL_NOT_AVAILABLE' }`，由 gate 回退本地快照比对。
   - `dryRun` 时只打印将校验的契约文件，不执行。
3. 报告落盘到 `artifacts/<subtaskId>/contract-result.json`，含 `{ pass, diff, checkedAt, tool }`。
4. 修改 `gate.mjs`：新增 `setValidator(fn)`；`after()` 时若存在 validator 则调用它，pass 为 false 时按 `TT_GATE_MODE` 决定是否抛 `ContractViolationError`；validator 不可用则沿用本地快照比对。
5. 注册键 `be-validator`。

## 关键契约 / 数据结构

```js
export const portmanAdapter = {
  name: 'portman|contracteer',
  isAvailable: async () => boolean,
  run: async (subtask, ctx, opts = {}) => DispatchResult,
};

// 契约报告 artifacts/<subtaskId>/contract-result.json
/** @typedef {{pass:boolean, diff:string[]|null, checkedAt:string, tool:string}} ContractReport */

// gate.mjs 新增
export function setValidator(fn) { /* fn: (subtask)=>Promise<{pass:boolean,diff:string[]|null}> */ }
```

## 验收标准（Given / When / Then）
- Given `contracts/demo.json` 存在且契约工具可用，When 调用 `run()`，Then 返回 `ok:true`，且 `artifacts/<subtaskId>/contract-result.json` 含 `pass`、`diff`、`tool` 字段。
- Given 契约工具不可用，When 调用 `run()`，Then 返回 `{ok:false, error:'CONTRACT_TOOL_NOT_AVAILABLE'}` 且不抛异常。
- Given gate 已 `setValidator(portmanValidator)`，When 契约检查未通过且 `TT_GATE_MODE=block`，Then 抛出 `ContractViolationError` 且 diff 来自适配器结果。
- Given gate 未设置 validator 或 validator 不可用，When 执行 `after()`，Then 自动回退到本地快照比对（BE-06 行为），gate 功能不中断。
- Given `dryRun:true`，When 调用 `run()`，Then 只打印待校验契约路径，不执行 CLI、不落盘。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
portman --version || contracteer --version || echo "tool not available (expected fallback)"
node -e "import('./scripts/lib/adapters/portman.mjs').then(async a=>console.log('available=',await a.isAvailable()))"
node -e "
import('./scripts/lib/adapters/portman.mjs').then(async a=>
  console.log(await a.run({id:'s1',contract:'contracts/demo.json'},{set:()=>{}},{dryRun:true})));"
```

## 失败与回滚
- 失败：OpenAPI 文件路径不存在 → 返回 `{ok:false, error:'CONTRACT_FILE_MISSING'}` 并提示路径。
- 回滚：从 `adapters/index.mjs` 移除注册；`gate.mjs` 移除 `setValidator` 注入点（保留本地比对）。

## 风险与注意
- **离线约束**：portman/contracteer 通常需 npm 安装，MVP 允许「不可用即降级」，不要为了接入而引入联网安装步骤。
- 必须先 `--help` 确认 CLI 参数，禁止臆造命令行。
- 契约文件路径一律相对路径。

## 交付物检查清单
- [ ] `portman.mjs` 实现 `isAvailable` + `run`
- [ ] 报告落盘 `contract-result.json` 含 pass/diff/tool
- [ ] `gate.mjs` 支持 validator 注入与回退
- [ ] 不可用/缺文件/dry-run 三种降级路径明确
- [ ] 已注册 `be-validator`
