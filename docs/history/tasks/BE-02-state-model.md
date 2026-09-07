# Task: BE-02 状态模型与状态机

## 概述
定义编排过程的核心数据实体（TaskPlan / SubTask / GateResult）与严格的状态机转换规则，并实现持久化到工作区 `.tt-state/`。这是所有后续模块的「数据地基」。

## 所属与定位
- **阶段**：MVP / Phase 0
- **层级**：Backend（运行时）
- **上游依赖**：BE-01（脚手架与状态枚举占位）
- **下游被依赖**：BE-04（路由产出计划）、BE-05（运行时消费计划）、BE-06（gate 结果）、BE-10（失败转移）、BE-11（报告读取状态）

## 目标与非目标
**目标**
- 用 JSDoc typedef 固化三个核心实体的字段。
- 实现 `canTransition()` 的合法转移表，非法转移抛错。
- 实现状态持久化（写 `.tt-state/state.json`）与恢复（`--resume`）。

**非目标**
- 不决定任务如何路由（BE-04）、不执行子任务（BE-05）。

## 前置条件
- BE-01 已完成，`scripts/lib/state.mjs` 已存在枚举。
- 仓库可写（工作区目录 `.tt-state/` 可创建）。

## 输入
- 无外部输入；由内核内部构造。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `scripts/lib/state.mjs` | 改写 | 加入 typedef、转移表、`canTransition`、`createStore` |
| `scripts/lib/store.mjs` | 创建 | 读写 `.tt-state/state.json`，支持 resume |

## 实现步骤
1. 在 `state.mjs` 中用 JSDoc 定义：
   - `TaskPlan`：`{ id, task, cluster, subtasks: SubTask[], status: StateName, createdAt }`
   - `SubTask`：`{ id, planId, asset, contract, status: StateName, artifactPath, attempts }`
   - `GateResult`：`{ subtaskId, pass: boolean, diff: string|null, checkedAt }`
2. 定义合法转移表（例）：
   - `idle → planning`；`planning → executing | failed`
   - `executing → frozen | failed`；`frozen → executing | failed`
   - `executing → reviewing`；`reviewing → done | executing`
   - 终止态：`done`、`failed`（不可再转出）
3. 实现 `canTransition(from, to)`：查表，非法返回 false 并附原因；实现 `assertTransition()` 抛 `IllegalTransitionError`。
4. 实现 `scripts/lib/store.mjs`：
   - `save(plan)` → 写 `.tt-state/state.json`（`JSON.stringify(...,2)`）
   - `load()` → 读取；文件不存在返回 `null`
   - `clear()` → 删除状态文件
5. `.tt-state/` 必须加入 `.gitignore`（TT 仓库根已有 `.gitignore`，追加一行 `.tt-state/`）。
6. 支持 `--resume`：`orchestrator` 启动时若带此参数，则 `load()` 并从记录状态继续（本任务只需 store 支持，接入在 BE-04/05）。

## 关键契约 / 数据结构

```js
/**
 * @typedef {Object} SubTask
 * @property {string} id
 * @property {string} planId
 * @property {string} asset       // vendor 资产路径或簇名
 * @property {string} contract    // 契约描述或 OpenAPI 路径
 * @property {StateName} status
 * @property {string|null} artifactPath
 * @property {number} attempts
 */
/**
 * @typedef {Object} TaskPlan
 * @property {string} id
 * @property {string} task
 * @property {string} cluster     // T1..T5
 * @property {SubTask[]} subtasks
 * @property {StateName} status
 * @property {string} createdAt
 */
/** @type {Record<StateName, StateName[]>} */
export const TRANSITIONS = { /* 见步骤 2 */ };
export function canTransition(from, to) { /* boolean */ }
export function assertTransition(from, to) { /* throw IllegalTransitionError */ }
export function createStore(workspace) { return { save, load, clear }; }
```

## 验收标准（Given / When / Then）
- Given 一个 `TaskPlan` 对象，When 调用 `save(plan)`，Then `.tt-state/state.json` 存在且内容可被 `JSON.parse` 还原为同样字段。
- Given 状态为 `idle`，When 调用 `canTransition('idle','planning')`，Then 返回 true。
- Given 状态为 `done`，When 调用 `canTransition('done','executing')`，Then 返回 false（终止态不可转出）。
- Given 状态为 `idle`，When 调用 `assertTransition('idle','reviewing')`（非法），Then 抛出 `IllegalTransitionError` 且消息含当前与目标状态。
- Given `.tt-state/state.json` 不存在，When 调用 `load()`，Then 返回 `null` 而不抛异常。
- Given 仓库根，When 执行 `git check-ignore .tt-state`，Then 输出 `.tt-state/`（已被忽略）。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
node -e "import('./scripts/lib/state.mjs').then(m=>{console.log(m.canTransition('idle','planning'));console.log(m.canTransition('done','executing'))})"
node -e "import('./scripts/lib/store.mjs').then(m=>{const s=m.createStore('.');s.save({id:'t1'});console.log(JSON.stringify(s.load()))})"
git check-ignore .tt-state
```

## 失败与回滚
- 失败：`.tt-state` 写入权限不足 → 提示「工作区不可写」并降级为不持久化（内存中运行）。
- 回滚：`git checkout -- scripts/lib/state.mjs`；删除 `scripts/lib/store.mjs` 与 `.tt-state/`。

## 风险与注意
- `done`/`failed` 必须是终止态，否则会出现僵尸流程。
- 状态文件可能含绝对路径，提交前确认 `.gitignore` 已生效，避免泄露本机路径（TT 对可移植性有硬要求）。

## 交付物检查清单
- [ ] 三个 typedef 已定义并被 JSDoc 引用
- [ ] 转移表与 `canTransition`/`assertTransition` 实现
- [ ] `store.mjs` 的 save/load/clear 可用
- [ ] `.gitignore` 已含 `.tt-state/`
