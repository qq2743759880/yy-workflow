# Task: BE-08 BMAD+cline 适配器（sdlc）

## 概述
为 sdlc 簇实现适配器，把「软件生命周期编排」交给 `bmad-code-org/BMAD-METHOD`（~49.5k，多 Agent 软件构建方法论）+ `cline/cline`（~63.7k，plan/execute 模式）的组合，替换 TT 现有的自研 sdlc 编排。

## 所属与定位
- **阶段**：MVP / Phase 2（高杠杆替换）
- **层级**：Backend（运行时 / 适配器）
- **上游依赖**：BE-05（运行时与注册表）、FE-08（sdlc 资产已改写为 BMAD+cline）
- **下游被依赖**：BE-10（失败处理）、BE-11（报告）

## 目标与非目标
**目标**
- 实现 `scripts/lib/adapters/bmad-cline.mjs`，符合统一 `Adapter` 接口。
- 把 sdlc 子任务拆成 BMAD 的 phase 序列，并以 cline 的 plan/exec 模式驱动执行。
- 任一环节不可用时安全降级并明确提示。

**非目标**
- 不复制 BMAD / cline 源码（仅按方法论组织 + 调用其 CLI，见风险 R1）。
- 不实现它们自身的功能（那是上游项目的事）。

## 前置条件
- BE-05、BE-07 完成（`exec.mjs` 可复用）。
- FE-08 已完成 sdlc 资产改写（至少簇名 `sdlc` 与适配器键一致）。
- 已阅读 `vendor/sdlc/` 现有结构（复合 skill，含 `skills/plan`、`skills/develop`、`skills/review`、`skills/summarize` 与 6 个 agent）。

## 输入
- `SubTask`（asset 为 `sdlc`）；`ContextBus`；`{ dryRun, timeoutMs }`。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `scripts/lib/adapters/bmad-cline.mjs` | 创建 | sdlc 适配器实现 |
| `scripts/lib/adapters/index.mjs` | 修改 | 注册 `sdlc` → bmad-cline |

## 实现步骤
1. 在适配器内定义 BMAD phase 序列常量（与 FE-08 改写后的 sdlc 资产保持一致）：
   `PHASES = ['plan', 'develop', 'review', 'summarize']`（对齐现有 `vendor/sdlc/skills/` 四个子 skill）。
2. 实现 `isAvailable()`：检测 cline 或 BMAD 是否可用（MVP 判定：能取到 `sdlc` 资产的四个 phase 定义即视为「方法论可用」；若需调用 cline CLI 则额外检测 `cline --version`）。
3. 实现 `run(subtask, ctx, opts)`：
   - 按 `PHASES` 顺序逐个阶段推进，每阶段产出该阶段的产物描述（MVP 阶段产物可以是「阶段计划/结果的结构化对象」，落盘到 `artifacts/<subtaskId>/<phase>.json`）。
   - 若 `cline` CLI 可用：对 `develop` 阶段调用 cline 执行（参照 `cline --help` 确认参数，禁止臆造）。
   - 不可用：按 BMAD 方法论生成阶段计划后标记为 `planned-only`，返回 `ok:true` 但附 `warning`（MVP 允许「产出计划」即算完成，实际编码由 BE-07 opencode 承接）。
   - `dryRun` 时只打印将要执行的 phase 序列，不落盘。
4. 每完成一个 phase 写 `ctx.set('sdlc:'+phase, artifactPath)`。
5. 在 `adapters/index.mjs` 注册键 `sdlc`。

## 关键契约 / 数据结构

```js
export const BMAD_PHASES = ['plan', 'develop', 'review', 'summarize'];

export const bmadClineAdapter = {
  name: 'bmad-cline',
  isAvailable: async () => boolean,
  run: async (subtask, ctx, opts = {}) => DispatchResult,
};

// 阶段产物结构（落盘 artifacts/<subtaskId>/<phase>.json）
/** @typedef {{phase:string, inputs:object, outputs:object, status:'planned'|'done'|'failed', notes:string}} PhaseResult */
```

## 验收标准（Given / When / Then）
- Given `sdlc` 子任务，When 以 `dryRun:true` 调用 `run()`，Then 打印 `plan → develop → review → summarize` 序列且不产生任何文件。
- Given `sdlc` 子任务（非 dry-run），When 调用 `run()`，Then `artifacts/<subtaskId>/` 下生成 4 个 phase 的 JSON 文件，每个含 `phase` 与 `status` 字段。
- Given 各 phase 执行完成，When 读取 `ctx.get('sdlc:plan')`，Then 得到 plan 阶段产物路径。
- Given `cline` CLI 不可用，When 调用 `run()`，Then 返回 `ok:true` 且结果附 `warning`（planned-only），不抛异常、不中断整体流程。
- Given 某个 phase 失败，When 调用 `run()`，Then 该 phase 的 `status` 为 `failed`，整体返回 `{ok:false, error}` 并注明失败阶段。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
node -e "import('./scripts/lib/adapters/bmad-cline.mjs').then(a=>console.log(Object.keys(a), a.name))"
node -e "
import('./scripts/lib/adapters/bmad-cline.mjs').then(async a=>{
  const ctx={set:(k,v)=>{},get:()=>null};
  console.log(await a.run({id:'s1',contract:'x'},ctx,{dryRun:true}));
});"
ls artifacts   # 非 dry-run 后检查 phase 产物
```

## 失败与回滚
- 失败：BMAD phase 名称与 FE-08 改写后的资产不一致 → 以 `vendor/sdlc/` 实际目录为准修正 `BMAD_PHASES`。
- 回滚：从 `adapters/index.mjs` 移除 `sdlc` 注册；删除 `bmad-cline.mjs`。

## 风险与注意
- BMAD 是**方法论**而非可执行 CLI，MVP 中它的作用是「组织阶段序列」；真正的执行由 cline（如可用）或 opencode 承接，别把两者职责混淆。
- 调用 cline 前必须先 `cline --help` 确认参数，禁止凭印象构造命令。
- 阶段产物落 `artifacts/` 并加 `.gitignore`。

## 交付物检查清单
- [ ] `BMAD_PHASES` 与 sdlc 资产实际结构一致
- [ ] `run()` 按 phase 顺序推进并落盘 JSON
- [ ] cline 不可用时降级为 planned-only 且附 warning
- [ ] 已注册到 `adapters/index.mjs`
- [ ] dry-run 零副作用
