# Task: BE-04 planner 路由引擎

## 概述
实现 planner：把用户的自然语言任务路由到 T1–T5 任务簇，并为每个簇挑选负责的 vendor 资产，产出 `TaskPlan`（含子任务与契约）。这是 TT「矩阵驱动」方法论的代码化核心。

## 所属与定位
- **阶段**：MVP / Phase 0
- **层级**：Backend（运行时）
- **上游依赖**：BE-02（TaskPlan 模型）、BE-03（VendorManifest）
- **下游被依赖**：BE-05（执行计划）、BE-06（契约 gate）、BE-11（报告）

## 目标与非目标
**目标**
- 依据 `templates/task-agent-matrix.md` 的 T1–T5 分类，把任务映射到簇。
- 为每个簇从 manifest 中挑选 1~N 个资产，生成 `SubTask[]`，并附上契约描述。
- 无匹配时明确报错（不臆造资产）。

**非目标**
- 不执行子任务（BE-05）、不做契约校验（BE-06）。
- 不实现 LLM 调用——模型由宿主提供，本任务只做规则化路由（关键词/模式匹配），保证离线可测。

## 前置条件
- BE-02、BE-03 完成。
- 已阅读 `templates/task-agent-matrix.md`（T1 数据库 / T2 后端 / T3 AI-RAG-MCP / T4 前端 / T5 运维）。
- 已阅读 `SKILL.md` §1c 资产表与矩阵定义。

## 输入
- 任务描述字符串；`VendorManifest`；矩阵定义（可硬编码为常量，或解析 `templates/task-agent-matrix.md`）。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `scripts/lib/planner.mjs` | 改写 | 实现 `route()` / `buildPlan()` |
| `scripts/lib/matrix.mjs` | 创建 | T1–T5 簇定义与关键词表 |

## 实现步骤
1. 在 `matrix.mjs` 定义五个簇常量（与 `templates/task-agent-matrix.md` 保持一致）：
   `T1_DATABASE`、`T2_BACKEND`、`T3_AI_RAG_MCP`、`T4_FRONTEND`、`T5_OPS`，每簇含 `id / 关键词[] / 候选资产[]`。
2. 实现 `route(taskText, manifest)`：
   - 归一化任务文本（小写、去标点）。
   - 对每个簇计算关键词命中数，取命中最多且 >0 的簇。
   - 命中并列时按 T2→T4→T1→T3→T5 的优先级取首个（可配置）。
   - 无任何命中 → 抛出 `NoMatchError('无匹配资产')`。
3. 实现 `buildPlan(taskText, manifest)`：
   - `route` 得到簇 → 从 `候选资产` 与 manifest 求交集（过滤 manifest 中不存在的资产，避免臆造）。
   - 为每个选中资产生成 `SubTask`（id 用 `${planId}-${i}`，status 初始 `idle`，attempts 0）。
   - 契约 `contract` 取自簇的默认契约描述（如 T2 为「接口输入/输出与错误码约定」）。
   - 返回完整 `TaskPlan`（cluster、subtasks、status='planning'）。
4. 在 `orchestrator.mjs` 中接入：解析任务 → `buildPlan` → 打印计划摘要 → 转 `executing`；捕获 `NoMatchError` 打印「无匹配资产」并 exit 非 0。

## 关键契约 / 数据结构

```js
/** @typedef {{id:string,label:string,keywords:string[],candidates:string[],contract:string}} ClusterDef */
export const CLUSTERS = [ /* T1..T5 */ ];
export function route(taskText, manifest) { /* -> ClusterDef, throw NoMatchError */ }
export function buildPlan(taskText, manifest) { /* -> TaskPlan */ }
export class NoMatchError extends Error {}
```

## 验收标准（Given / When / Then）
- Given 任务「实现后端登录模块的接口与数据库读写」，When 调用 `route`，Then 返回 `T2_BACKEND`（或按关键词命中最高者）且不抛错。
- Given 任务含明显前端词（如「做一个响应式的落地页」），When 调用 `route`，Then 返回 `T4_FRONTEND`。
- Given 任务文本为空或全是无关字符（如「asdfgh」），When 调用 `route`，Then 抛出 `NoMatchError` 且消息含「无匹配资产」。
- Given `route` 成功，When 调用 `buildPlan`，Then 返回的 `TaskPlan` 含 `cluster` 非空、`subtasks.length >= 1`、每个 subtask 含 `asset` 与 `contract`。
- Given manifest 中不存在某簇的候选资产，When `buildPlan` 求交集，Then 该资产被过滤，不出现在 subtasks 中（不臆造资产）。
- Given 一个含 3 个候选资产的簇，When `buildPlan`，Then subtasks 中每个 subtask.id 唯一（`planId-0/1/2`）。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
node -e "
import('./scripts/lib/manifest.mjs').then(async ({buildManifest})=>{
  const mf = await buildManifest({vendorDir:'vendor'});
  const {route, buildPlan} = await import('./scripts/lib/planner.mjs');
  const c = route('实现后端登录模块的接口与数据库读写', mf);
  console.log('cluster=', c.id);
  const plan = buildPlan('实现后端登录模块的接口与数据库读写', mf);
  console.log('subtasks=', plan.subtasks.length);
});"
node -e "import('./scripts/lib/planner.mjs').then(({route})=>{const mf={entries:[]};try{route('asdfgh',mf)}catch(e){console.log('err=',e.message)}})"
```

## 失败与回滚
- 失败：矩阵定义与 `templates/task-agent-matrix.md` 漂移 → 以模板文件为准修正 `matrix.mjs`。
- 回滚：恢复 `planner.mjs` 占位；删除 `matrix.mjs`。

## 风险与注意
- 规则化路由只是 MVP；Next 阶段可让宿主 LLM 参与路由，但必须保留规则兜底（离线可用）。
- 候选资产名必须与 `vendor/` 真实目录一致；簇化（FE-01~05）后需同步更新 `candidates`。

## 交付物检查清单
- [ ] 五个簇定义与 `task-agent-matrix.md` 一致
- [ ] `route` 命中/无匹配两条路径均正确
- [ ] `buildPlan` 产出合法 `TaskPlan` 且不臆造资产
- [ ] `orchestrator.mjs` 已接入并在无匹配时 exit 非 0
