# IMP-1 机器可读 state 摘要（state-summary）实现报告

- 版本：TT 2.8.0
- 日期：2026-09-05
- 范围：orchestrator 收尾新增机器可读 `state-summary.json` + `scripts/summary-read.mjs` 读取器；保留人类可读 `memory-snapshot.md` / `execution-feedback.md`。
- 目标：新会话不再靠人粘贴断点，可程序化 `--latest` 拉取完成/阻塞/契约/批判 backlog。

## 1. 字段设计（schema `tt/state-summary@1`）

顶层 + `summary` + `critiqueBacklog` + `files`。所有文件路径为 **workspace 相对路径（正斜杠）**，portable，不含本机绝对路径。

| 字段 | 说明 | 数据来源 |
|---|---|---|
| `schema` | `tt/state-summary@1` | 常量 |
| `planId` / `task` / `cluster` | 计划标识 | `result.plan` |
| `status` | done/failed 等 | `result.plan.status`（失败路径也写，schema status='failed'） |
| `degraded` | 是否降级 | `result.plan.degraded === true` |
| `generatedAt` | ISO 时间 | 写时生成 |
| `modes` | mode→计数映射 | `plan.modes` |
| `summary.total/done/failed/skipped` | 子任务状态计数 | `plan.subtasks[].status` |
| `summary.assetConsumed` / `assetCallRate` | 真实消费数 / 百分比 | `subtask.assetConsumed === true`；`consumed/total*100`（与 memory-snapshot.md 同口径） |
| `summary.requireExecViolation` | requireExec 计划下 prompt brief-only 兜底数 | `plan.requireExec===true` 时统计 `mode==='prompt' && assetConsumed!==true` |
| `summary.depPrecondition` | DEP_PRECONDITION 跳过数 | `subtask.error === 'DEP_PRECONDITION'`（与 runtime 逐字一致） |
| `summary.blockedSubtasks[]` | 阻塞资产去重清单 | `subtask.status ∈ {skipped,failed}` 的 `subtask.asset` |
| `summary.contractFrozen` | 冻结契约相对路径或 null | `contracts/<planId>.json` 存在性 |
| `summary.recovery[]` | 去重 recovery 链（stage from→to） | `subtask.recovery[]` |
| `critiqueBacklog` | `{open, nextItems[]}` | 本机 `plans/critique-backlog-tracker.md`（SKILL_DIR）；不可读 → null + `critiqueBacklogNote`（不阻断） |
| `files` | `state/memorySnapshot/executionFeedback/report` 相对路径或 null | 对应文件存在性 |

## 2. orchestrator diff

- `writeStateSummary(result, workspace)` 新增（`scripts/orchestrator.mjs`，收尾段前置）：解析 backlog tracker（与 `critique-backlog-next.mjs` 同源语义，内联避免 import 顶层副作用；读不到返回 null 不阻断）、统计 summary、写 `artifacts/<planId>/state-summary.json`。内置的 `readCritiqueBacklog` 从 **SKILL_DIR**（仓库根）读 tracker，与本仓库一致；workspace 不同的部署在摘要内以相对路径呈现，不受影响。
- **成功路径**：非 dry-run 收尾段（F3/F2 之后）调用 `writeStateSummary`，与 memory-snapshot.md / execution-feedback.md 并存，不互相替代。
- **失败路径**：`status==='failed'` 时也写（md 摘要未生成则 `files.memorySnapshot/executionFeedback` 为 null），新会话可核对卡点。
- 不改 vendor/、不提交不 push。

## 3. summary-read.mjs（读取器）

`node scripts/summary-read.mjs --workspace <dir> [--latest|--all]`

- **默认**：列 `artifacts/*/state-summary.json`（按 mtime 时间倒序），一行 `planId | task | status[(degraded)] | callRate | blocked:... | 相对路径`。无摘要 → 提示、exit 0。
- **`--latest`**：打印最新一个摘要全文 JSON（供恢复断点）。无摘要 → stderr 报错、**exit 1**。
- **`--all`**：合并全部为精简 JSON 数组（planId/task/cluster/status/degraded/generatedAt/modes/total/done/failed/skipped/assetConsumed/assetCallRate/requireExecViolation/depPrecondition/blockedSubtasks/contractFrozen/recovery/critiqueBacklogOpen）。
- **自包含优先**：摘要内 `critiqueBacklog` 为 null 时才尝试用本机 tracker 补算；读不到 → 保持 null + note，不报错。
- 零外部依赖（node 内建）。

## 4. summary-read 实测

对临时 workspace（`--backend prompt`）执行真实 orchestrator 验证：

- 全绿计划：`status=done, total=7, done=7, assetCallRate=0.0%`（prompt 后端无真实消费，符合口径）；`critiqueBacklog={open:3, nextItems:[C-10,C-11,C-12]}`。
- 阻塞计划：`modes={prompt:1, skipped:7}`，`depPrecondition=7`，`blockedSubtasks` 非空（7 个资产：implementation/be-provider/be-resilience/sdlc/security/review/be-validator），`degraded=true`——验证「有 skipped 时 blockedSubtasks 非空」。
- `--latest` 打印最新全文 JSON；`--all` 返回 3 项按时间倒序；`--workspace` 无摘要默认提示 exit 0、`--latest` 报错 exit 1。
- `assetCallRate` 与同 plan 的 `memory-snapshot.md` callRate 一致。
- 生成的 artifacts 与两个源文件均无本机绝对路径。

## 5. 排障记录（诚实）

- 初版 `summary-read.mjs` 在 `node --check` 报 `Invalid or unexpected token` at line 98。根因：line 98 文档注释 `/** 扫描 workspace/artifacts/*/state-summary.json ... */` 内含 `*/` 序列（`artifacts/*/` 的 `/*/`），词法器在注释内提前闭合，`state-summary.json，… */` 被当代码 → 语法错误。修复：注释改 `artifacts/<planId>/state-summary.json`。全文件仅此一处 `*/` 提前闭合。
- `--all` 经 PowerShell 管道/`>` 重定向出现 JSON 乱码，为控制台 UTF-16 编码伪象，非文件问题（cmd 重定向验证通过）。

## 6. 回归

- `regression-all`：**8 PASS / 0 FAIL**。
- `validate-structure`：OK，**可移植性泄露：无**，编码损坏：无。

## 7. 结论

按验收全部满足：回归 8/8、validate 0 泄露；真实 orchestrator 生成 `state-summary.json` 且字段齐全（有 skipped 时 blockedSubtasks 非空、assetCallRate 正确）；`summary-read --latest/--all/--workspace` 行为正确；产物与源码不含本机绝对路径。