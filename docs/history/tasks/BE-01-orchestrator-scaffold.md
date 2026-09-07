# Task: BE-01 编排内核脚手架与 CLI 入口

## 概述
创建 TT 编排内核的可执行入口与目录骨架，让 `node scripts/orchestrator.mjs --task "..."` 能启动、解析参数、打印状态机日志并正常退出。本任务只做「骨架与入口」，不含路由/派单/校验逻辑。

## 所属与定位
- **阶段**：MVP / Phase 0（补骨架）
- **层级**：Backend（运行时）
- **上游依赖**：无（本任务最先执行）
- **下游被依赖**：BE-02 ~ BE-12 全部

## 目标与非目标
**目标**
- 建立 `scripts/lib/` 模块目录与 `scripts/orchestrator.mjs` CLI 入口。
- 支持命令行参数解析（task / workspace / dry-run / verbose / help）。
- 建立统一的 logger 与状态机占位，使后续模块可挂载。

**非目标**
- 不实现 planner 路由（BE-04）、不实现 agent 运行时（BE-05）、不实现契约 gate（BE-06）。
- 不引入构建步骤、不引入第三方依赖（保持零依赖、离线可用）。

## 前置条件
- Node.js >= 18（仓库现有 `.mjs` 脚本已要求 Node≥18）。
- 仓库根：`D:/.ai-hub/skills/tt`（Git 远程 `qq2743759880/tt-together-agent`，private）。
- 已存在 `scripts/validate-structure.mjs` 可参照其 ESM 写法。
- 实现语言：**ESM JavaScript（`.mjs`）+ JSDoc 类型注解**。理由：与现有 `.mjs` 脚本一致、零构建、离线可直接运行；TypeScript 迁移留到 Next 阶段。

## 输入
- 命令行：`--task <string>`（必填）、`--workspace <path>`（默认仓库根）、`--dry-run`、`--verbose`、`--help`。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `scripts/orchestrator.mjs` | 创建 | CLI 入口，解析参数、编排流程占位、退出码 |
| `scripts/lib/logger.mjs` | 创建 | 统一日志（info/warn/error/debug），受 `--verbose` 控制 |
| `scripts/lib/state.mjs` | 创建 | 状态机定义与转换（本任务仅定义枚举与空壳） |
| `scripts/lib/manifest.mjs` | 创建 | 占位模块，BE-03 实现 |
| `scripts/lib/planner.mjs` | 创建 | 占位模块，BE-04 实现 |
| `scripts/lib/runtime.mjs` | 创建 | 占位模块，BE-05 实现 |
| `scripts/lib/gate.mjs` | 创建 | 占位模块，BE-06 实现 |
| `scripts/lib/report.mjs` | 创建 | 占位模块，BE-11 实现 |
| `scripts/lib/adapters/` | 创建目录 | 适配器目录，BE-07/08/09 实现 |

## 实现步骤
1. 在 `scripts/` 下新建 `lib/` 目录与 `lib/adapters/`。
2. 编写 `scripts/lib/logger.mjs`：导出 `createLogger(verbose)`，含 `info/warn/error/debug`；`debug` 仅在 verbose 时输出；错误统一前缀 `[tt]`。
3. 编写 `scripts/lib/state.mjs`：导出状态枚举 `{ IDLE:'idle', PLANNING:'planning', EXECUTING:'executing', FROZEN:'frozen', REVIEWING:'reviewing', DONE:'done', FAILED:'failed' }` 与 `canTransition(from,to)`（先允许任意合法转移，返回 true；BE-02 收紧）。
4. 编写其余 `lib/*.mjs` 为占位模块：每个导出一个同名 `async function`，内部 `throw new Error('NOT_IMPLEMENTED: 见 BE-XX')`，并注明对应任务编号。
5. 编写 `scripts/orchestrator.mjs`：
   - 解析 `process.argv`（手写解析，不引第三方），支持上述 5 个参数。
   - 校验 `--task` 非空，为空则打印 `任务描述不能为空` 并 `process.exit(2)`。
   - 按状态机顺序调用占位函数（本任务中占位函数会抛错 → 用 `try/catch` 捕获并打印 `[tt] 模块未实现: <name>`，exit code 3）。
   - `--help` 打印用法并 exit 0。
6. 保证文件顶部有 `#!/usr/bin/env node`（可选）与简短文件头注释。

## 关键契约 / 数据结构

```js
// scripts/lib/state.mjs
export const STATE = {
  IDLE: 'idle', PLANNING: 'planning', EXECUTING: 'executing',
  FROZEN: 'frozen', REVIEWING: 'reviewing', DONE: 'done', FAILED: 'failed',
};
/** @typedef {'idle'|'planning'|'executing'|'frozen'|'reviewing'|'done'|'failed'} StateName */

// scripts/lib/logger.mjs
/** @returns {{info:Function,warn:Function,error:Function,debug:Function}} */
export function createLogger(verbose = false) { /* ... */ }
```

## 验收标准（Given / When / Then）
- Given 终端在仓库根，When 执行 `node scripts/orchestrator.mjs --help`，Then 输出用法说明且退出码为 0。
- Given 执行 `node scripts/orchestrator.mjs --task "实现后端登录模块"`，When 内核启动，Then 依次打印 `idle → planning → executing → reviewing → done` 状态日志（或打印「模块未实现」提示），且退出码 ∈ {0,3}。
- Given 执行 `node scripts/orchestrator.mjs`（无 `--task`），When 内核启动，Then 输出 `任务描述不能为空` 且退出码为 2，不生成任何计划。
- Given 执行时加 `--verbose`，When 运行，Then 额外输出 debug 级日志；不加则不输出 debug。
- Given 执行 `node scripts/orchestrator.mjs --task "..."`（未加 --verbose），When 参数为空值 `--task ""`，Then 与第二条一致输出错误并 exit 2。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
node scripts/orchestrator.mjs --help
node scripts/orchestrator.mjs --task "实现后端登录模块"
node scripts/orchestrator.mjs            # 期望 exit 2
node scripts/orchestrator.mjs --task ""  # 期望 exit 2
node scripts/orchestrator.mjs --task "x" --verbose
```

## 失败与回滚
- 失败：Node 版本 < 18 → 提示升级。
- 回滚：`git checkout -- scripts/` 并删除新建的 `scripts/lib/`（本任务尚未提交，可直接删目录）。

## 风险与注意
- 不要引入 `yargs`/`commander` 等第三方依赖（离线约束）。
- 占位模块必须注明对应任务号，避免后续遗漏实现。
- 退出码约定：0 成功 / 2 参数错误 / 3 模块未实现 / 4 契约违约（BE-06）/ 5 执行失败（BE-10）。

## 交付物检查清单
- [ ] `scripts/lib/` 与 `scripts/lib/adapters/` 已创建
- [ ] 8 个 `lib/*.mjs` 存在（含 5 个占位）
- [ ] `--help` / 空任务 / `--verbose` 三种行为符合 AC
- [ ] 零第三方依赖
