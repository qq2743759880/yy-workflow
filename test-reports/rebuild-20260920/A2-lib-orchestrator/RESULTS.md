# A2 自测报告 — lib/orchestrator.mjs 纯逻辑抽取

## 运行环境

- 仓库: `D:\.ai-hub\skills\yy`
- 探针: `probe.mjs`（16 项断言）
- 日期: 2026-09-20

## 结果摘要

**16 PASS / 0 FAIL**（含 2 组错误路径）

## 差分覆盖（≥3 组输入，逐字节一致）

| 组 | 输入 | 真实 orchestrator | lib | 结果 |
|---|---|---|---|---|
| 1 | 合法单 phase 草案（implementation） | exit 0, 标准 dry-run 输出 | exit 0, stdout 逐字节一致 | PASS |
| 2 | 合法多 phase 多 task 草案（be-architect + be-provider + be-validator） | exit 0 | exit 0, stdout 逐字节一致 | PASS |
| 3 | 非法草案（asset=nonexistent-asset，错误路径） | exit 6, stderr 含校验错误 | exit 6, stderr 含同样错误 | PASS |
| 4 | 空 task（参数校验错误路径） | exit 2 | exit 2 | PASS |

### 纯函数单测

- `isOpenApiSpec`：v3/v2/null 三态
- `parseArgs`：--plan/--dry-run/--task/--draft 解析
- `validateOpts`：合法/空 task 两态

## 抽取内容

| 函数 | 来源 | 说明 |
|---|---|---|
| `parseArgs(args)` | orchestrator.mjs L24-50 | 逐字复制，纯函数 |
| `validateOpts(opts)` | orchestrator.mjs L294-302 | 校验段提取为纯函数，返回 {ok, error, exitCode} |
| `isOpenApiSpec(doc)` | orchestrator.mjs L56-59 | 逐字复制 |
| `parseBacklogRows(text)` | orchestrator.mjs L111-150 | 逐字复制 |
| `backlogIsPending(r)` | orchestrator.mjs L151-156 | 逐字复制 |
| `classifyExitError(error, types)` | orchestrator.mjs L503-508 | catch 块错误映射提取 |
| `planDryRun(argv, ctx)` | orchestrator.mjs L292-374 | --plan --dry-run 路径，IO 通过 ctx 注入 |

## 未抽取部分（留在 lib 外，声明）

1. **executePlan 调用与执行循环**（L441-443）：含 TUI hook、onStatus 回调，属 dispatch 阶段。
2. **store.save / writeReport**（L444-448）：状态持久化与报告生成，属 aggregate 阶段。
3. **syncJourney / writeStateSummary**（L175-291）：journey 派生与 state-summary 写入，含 withJourneyLock。
4. **resumePlan**（L87-96）：从 store 恢复 plan。
5. **freezeContract / applyFrontendContractGate**（L68-106）：契约冻结与前端门，含文件写入。
6. **main() 中的 process.exit / process.exitCode**：全局态不进 lib。
7. **readConfig()**：读 config.json，B7 阶段再接线。

以上未抽取部分均含文件 IO 或全局态，B7 阶段接线时以依赖注入方式接入。
