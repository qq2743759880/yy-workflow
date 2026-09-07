# Task: BE-06 契约冻结 gate

## 概述
把 TT 方法论里的「契约冻结 ①~⑭」从 Markdown 规范变成**可强制校验的代码 gate**：在子任务执行前后各跑一次契约比对，一致则 pass，不一致则阻塞并输出差异。这是 TT 从「手册」变成「系统」的关键卡点。

## 所属与定位
- **阶段**：MVP / Phase 0
- **层级**：Backend（运行时）
- **上游依赖**：BE-02（GateResult 模型）、BE-05（运行时在 before/after 调用）
- **下游被依赖**：BE-09（portman/contracteer 适配器作为校验实现）、BE-10（契约违约触发失败流程）、BE-11（报告含 gate 结果）

## 目标与非目标
**目标**
- 实现 `gate.before(subtask)` 采集「执行前快照」、`gate.after(subtask)` 比对并产出 `GateResult`。
- 支持 OpenAPI/JSON-Schema 两种契约来源；MVP 以 JSON 结构化契约为准。
- 违约时抛出 `ContractViolationError`（含 diff），由 BE-10 转成 exit code 4。

**非目标**
- 不实现 portman/contracteer 的具体调用（BE-09 适配器负责）；
- 不做跨仓库/远程契约抓取（离线约束）。

## 前置条件
- BE-02 完成（`GateResult` typedef）；BE-05 已在 before/after 处埋好调用点。
- 已阅读 `templates/contract.md`（TT 的契约模板）与 `templates/orchestration-frontend-backend.md`（契约冻结 ①~⑭）。

## 输入
- `SubTask.contract`（契约描述或契约文件路径）；工作区内的契约文件（如 `contracts/*.json`）。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `scripts/lib/gate.mjs` | 改写 | 实现 `before()` / `after()` / `snapshot()` / `diffContracts()` |
| `contracts/` | 创建目录 | 存放契约文件（MVP 可先放示例） |

## 实现步骤
1. 实现 `parseContract(subtask)`：
   - 若 `subtask.contract` 是文件路径且存在 → 读文件（支持 `.json` / `.yaml`，MVP 先只支持 `.json`）。
   - 否则把 `contract` 当作「契约描述文本」，退化为记录文本的 hash（不做结构比对），并在结果中标注 `mode:'describe'`。
2. 实现 `snapshot(subtask)`：对解析出的契约做规范化（键排序、去空值）后计算稳定 hash（`crypto.createHash('sha256')`），返回 `{ hash, normalized }`。
3. 实现 `diffContracts(a, b)`：
   - 对 JSON 契约做逐字段比较，输出可读差异列表（如 `paths./login.post.requestBody: 字段 phone 缺失`）。
   - 优先输出结构化 diff（数组），再提供 `formatDiff()` 转字符串。
4. 实现 `before(subtask)`：把快照存入内部 Map（key = subtask.id），返回 `GateResult{ pass:true, diff:null }`。
5. 实现 `after(subtask)`：重新快照并与 before 比对：
   - 一致 → `{ pass:true, diff:null }`
   - 不一致 → `{ pass:false, diff:<formatted> }` 并抛 `ContractViolationError`
6. 支持环境变量/开关 `TT_GATE_MODE=warn|block`（默认 `block`）：`warn` 时只告警不抛错，便于首版灰度（见风险 R2）。
7. 在 `orchestrator.mjs` 中：捕获 `ContractViolationError` → 打印差异 → `exit(4)`。

## 关键契约 / 数据结构

```js
/**
 * @typedef {Object} GateResult
 * @property {string} subtaskId
 * @property {boolean} pass
 * @property {string|null} diff
 * @property {string} checkedAt
 */
export async function before(subtask) { /* -> GateResult */ }
export async function after(subtask)  { /* -> GateResult, throw ContractViolationError */ }
export async function snapshot(subtask){ /* -> {hash:string, normalized:object} */ }
export function diffContracts(a, b)   { /* -> string[] */ }
export class ContractViolationError extends Error { constructor(subtaskId, diff) { /* ... */ } }
```

## 验收标准（Given / When / Then）
- Given 一个含合法 JSON 契约的子任务，When 依次调用 `before()` 与 `after()` 且期间契约未变，Then 两次 hash 相同、`after()` 返回 `pass:true` 且 `diff` 为 null。
- Given 同一子任务，When `before()` 之后人为修改契约文件（增删字段），Then `after()` 返回 `pass:false`、抛出 `ContractViolationError`，且 `diff` 中含被改动字段的路径。
- Given `TT_GATE_MODE=warn`，When 契约被改动后调用 `after()`，Then 返回 `pass:false` 但**不抛错**，仅输出 warn 日志。
- Given `subtask.contract` 为一段描述文本而非文件，When 调用 `snapshot()`，Then 返回稳定 hash 且结果标注 `mode:'describe'`，不抛异常。
- Given 契约违约发生，When `orchestrator` 捕获到 `ContractViolationError`，Then 打印差异并以退出码 4 结束。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
# 构造临时契约文件后
node -e "
import('./scripts/lib/gate.mjs').then(async g=>{
  const st={id:'s1', contract:'contracts/demo.json'};
  const b=await g.before(st); const a=await g.after(st);
  console.log('pass=',a.pass,'diff=',a.diff);
});"
TT_GATE_MODE=warn node scripts/orchestrator.mjs --task "实现后端登录模块"
```

## 失败与回滚
- 失败：契约文件路径不存在 → `parseContract` 抛出 `ContractMissingError`，需在 orchestrator 中提示「契约文件缺失」而非崩溃。
- 回滚：恢复 `gate.mjs` 占位；删除 `contracts/`（若仅为测试创建）。

## 风险与注意
- **R2 误报风险**：首版建议默认 `warn` 运行一段时间，确认无误报后再切 `block`（在 BE-12 回归中切换并验证）。
- hash 必须基于**规范化后**的契约，否则键顺序变化会产生假违约。
- 契约文件路径一律用相对路径，避免泄露本机绝对路径（与 BE-03 一致的可移植性要求）。

## 交付物检查清单
- [ ] `before` / `after` 快照比对可用
- [ ] `diffContracts` 输出可读差异
- [ ] `TT_GATE_MODE` warn/block 双模式生效
- [ ] 违约时 exit code 4 且打印差异
- [ ] 所有路径为相对路径
