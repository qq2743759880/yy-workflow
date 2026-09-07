# Task: BE-07 opencode 适配器（实现簇）

## 概述
为「实现簇」（`dev-backend` / `be-implementer`）实现 opencode 适配器，让编排内核能把代码生成类子任务真正交给 `opencode-ai/opencode`（~95k 星，终端内 AI 软件工程师）执行，而不是只写文档描述。

## 所属与定位
- **阶段**：MVP / Phase 2（高杠杆替换）
- **层级**：Backend（运行时 / 适配器）
- **上游依赖**：BE-05（运行时与适配器注册表）、FE-04（实现簇已合并）、FE-07（资产文档已指向 opencode）
- **下游被依赖**：BE-10（失败重试）、BE-11（报告含产物路径）

## 目标与非目标
**目标**
- 实现 `scripts/lib/adapters/opencode.mjs`，符合统一 `Adapter` 接口。
- 能在检测到 opencode 可用时实际调用并产出代码文件；不可用时安全降级（明确提示，不静默失败）。
- 把产物路径写入共享上下文，供后序子任务与报告使用。

**非目标**
- 不 fork / vendored opencode 源码（仅调用其 CLI，避免许可与体积问题，见风险 R1）。
- 不实现 opencode 自身的模型配置（由宿主/用户环境提供）。

## 前置条件
- BE-05 完成，`scripts/lib/adapters/index.mjs` 注册表可用。
- FE-04（实现簇 2→1 合并）与 FE-07（文档改写）建议先完成，至少簇名需与适配器匹配。
- 本机或目标环境已安装 opencode CLI（可通过 `opencode --version` 验证）；未安装时适配器必须降级而非崩溃。

## 输入
- `SubTask`（asset 为 `implementation` 簇 / 或 `dev-backend`、`be-implementer`）；
- `ContextBus`（读取任务上下文与前序产物）；
- 选项 `{ dryRun, timeoutMs }`。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `scripts/lib/adapters/opencode.mjs` | 创建 | opencode 适配器实现 |
| `scripts/lib/adapters/index.mjs` | 修改 | 注册 `implementation` / `dev-backend` / `be-implementer` → opencode |
| `scripts/lib/exec.mjs` | 创建 | 统一的子进程调用封装（超时、输出捕获、错误码） |

## 实现步骤
1. 编写 `scripts/lib/exec.mjs`：
   - `runCommand({ cmd, args, cwd, timeoutMs })` → 用 `node:child_process.spawn`（**不用 exec**，避免 shell 注入）。
   - 捕获 stdout/stderr；超时则 kill 并返回 `{ ok:false, error:'TIMEOUT' }`。
   - 返回 `{ ok, code, stdout, stderr }`。
2. 编写 `opencode.mjs`：
   - `isAvailable()`：执行 `opencode --version`，成功返回 true。
   - `run(subtask, ctx)`：
     - 构造调用参数：把 `subtask.contract` 与任务描述拼成 opencode 的输入（MVP 用 `--prompt "<task + contract>"` 或 `opencode run "<prompt>"`，具体子命令以本机 `opencode --help` 为准，实现时必须先确认）。
     - `dryRun` 时只返回 `{ ok:true, dryRun:true, artifactPath:null }`。
     - 调用 `runCommand`，超时默认 10 分钟（可配置）。
     - 成功 → 从 stdout 解析产物路径（或约定产物落在工作区 `artifacts/<subtaskId>/`），写 `ctx.set('artifact:'+subtask.id, path)`，返回 `DispatchResult`。
     - 不可用 → 返回 `{ ok:false, error:'OPENCODE_NOT_AVAILABLE' }` 并附安装提示。
3. 在 `adapters/index.mjs` 注册：键为 `implementation`、`dev-backend`、`be-implementer`（三个键指向同一适配器，兼容簇化前后）。
4. 保持相对路径：产物路径用 `path.relative(process.cwd(), abs)` 输出。

## 关键契约 / 数据结构

```js
/** @typedef {{name:string, run:(subtask:object, ctx:object, opts?:object)=>Promise<DispatchResult>}} Adapter */

export const opencodeAdapter = {
  name: 'opencode',
  isAvailable: async () => boolean,
  run: async (subtask, ctx, opts = {}) => DispatchResult,
};

// DispatchResult: { ok:boolean, artifactPath:string|null, error:string|null, dryRun?:boolean }
export function runCommand({ cmd, args = [], cwd, timeoutMs = 600000 }) { /* ... */ }
```

## 验收标准（Given / When / Then）
- Given opencode CLI 已安装，When 调用 `opencodeAdapter.isAvailable()`，Then 返回 true。
- Given opencode CLI 未安装，When 调用 `isAvailable()`，Then 返回 false 且不抛异常；随后 `run()` 返回 `{ok:false, error:'OPENCODE_NOT_AVAILABLE'}`。
- Given 一个实现类子任务，When 以 `dryRun:true` 调用 `run()`，Then 返回 `dryRun:true` 且**不产生任何子进程调用与文件写入**。
- Given 一个实现子任务且 opencode 可用，When 调用 `run()`，Then 返回 `ok:true` 且 `artifactPath` 指向真实存在的产物路径（相对路径）。
- Given `run()` 成功，When 之后读取 `ctx.get('artifact:'+subtask.id)`，Then 得到与返回值一致的产物路径。
- Given opencode 执行超过 `timeoutMs`，When 调用 `run()`，Then 子进程被终止且返回 `{ok:false, error:'TIMEOUT'}`。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
opencode --version                      # 确认 CLI 与本任务使用的子命令
node -e "import('./scripts/lib/adapters/opencode.mjs').then(async a=>console.log('available=',await a.isAvailable()))"
node -e "import('./scripts/lib/adapters/opencode.mjs').then(async a=>{const ctx={set:()=>{},get:()=>null};console.log(await a.run({id:'s1',contract:'x'},{set:()=>{}},{dryRun:true}))})"
```

## 失败与回滚
- 失败：CLI 子命令名称与预期不符 → 先执行 `opencode --help` 确认后修正参数构造逻辑（**不要臆造命令行**）。
- 回滚：从 `adapters/index.mjs` 移除注册；删除 `opencode.mjs` 与 `exec.mjs`（若无其他适配器依赖）。

## 风险与注意
- **R1 许可**：只调用 CLI，不复制 opencode 源码进仓库（私密分发也要避免许可风险）。
- 必须使用 `spawn` + 参数数组，**禁止拼接 shell 字符串**（防注入）。
- 产物目录建议 `artifacts/<subtaskId>/` 并加入 `.gitignore`，避免污染仓库。

## 交付物检查清单
- [ ] `exec.mjs` 支持超时与输出捕获
- [ ] `opencode.mjs` 实现 `isAvailable` + `run`
- [ ] 已在 `adapters/index.mjs` 注册三个键
- [ ] 不可用/超时/dry-run 三种降级路径均有明确返回
- [ ] 产物路径为相对路径且写入 `.gitignore`
