# Decision 接口：宿主先消费 packet，再执行

按 `variables-and-config.md` 解析绝对路径：`$SKILL_DIR` 是技能源码，`$PROJECT_ROOT` 是用户项目。Decision Core 决定阶段、资产与准入；CLI 和 `/mcp-v2` 共享语义。adapter 读取 command frontmatter 与冻结 `contracts/generated/decision-intent-map.json` 解析触发，不另写阶段判定。

## 本地宿主入口

`/yy N` 或冻结自然语言触发先运行 `scripts/host-adapter.mjs`。CLI 展示原始 stage→task envelope，包括 blockers、owner projection、evidence refs 和资产 brief。宿主必须消费原包，最终 `ok=true` 且 `data.execution_permitted=true` 才工作；拒绝或过期按包处理，不能改状态绕过。

```text
node "$SKILL_DIR/scripts/host-adapter.mjs" prepare --workspace "$PROJECT_ROOT" --session <session> --intent "/yy 2" --task-text "<本次有界任务>" --subtask-id <id> --save
node "$SKILL_DIR/scripts/host-adapter.mjs" check --workspace "$PROJECT_ROOT" --session <session> --subtask-id <id>
# 以下为显式外部 provider 的可选路径
node "$SKILL_DIR/scripts/host-adapter.mjs" execute --workspace "$PROJECT_ROOT" --session <session> --subtask-id <id> --exec '<JSON argv 数组>' --artifact <项目内相对产物路径> --checker '<独立验收 JSON argv 数组>'
```

`prepare` 默认零写；显式 `--save` 在展示且允许后才保存 `artifacts/<id>/host-decision.json`。id 以字母/数字开头，可含 `_`、`-`、`.`，禁止 `..`。task 文本必须是本次实际有界任务。prepare 可选 `--capability`、`--activation-level`、`--requested-resources <csv>`、`--budget <正整数>`，由 Decision 核查。

`<session>` 来自当前宿主的可信上下文，在 prepare/check/execute 中保持同值，不能从旧 record 自行恢复。没有命名 session 时三个命令均省略 `--session`，绑定默认 null，不传字符串 "null"。workspace/session/task id 必须一致；check/execute 不接受 prepare 专用 flags。

`check` 读取已展示记录，重新 Decision 并展示当前包。输入、journey、资产、证据或 authority 语义变化使记录失效，重新 prepare/展示/save。缺包、换绑定或直接执行属于 `HOST_INTEGRATION_BYPASS`，验收 FAIL。journey 快照、旧 `--prereq-check`、手写 prompt 或声称 gate 已过，都不代替宿主入口。

显式外部执行时，`execute` 再核验记录，复用 Decision CLI 的显式 `--emit-brief --record` 写 brief/T1–T4，再进 legacy host consumption。执行进程收到 brief/artifact 绝对路径，须留下本次新建或字节变化的非空产物。独立 checker 在另一进程检查产物，输出 `{pass:true,artifact_sha256,checks:[{name,passed:true}]}`。真实退出码、hash、checker 和 receipt 共同提供任务行为证据；直接 legacy CLI 不能替代 C4 packet gate。

无 task brief 时，prepare/save 后跑 `node "$SKILL_DIR/scripts/host-adapter.mjs" check --workspace "$PROJECT_ROOT" --session <session> --subtask-id <id>`，允许后做原生工作，不能 execute 合成 receipt。有 brief 时默认 check 后由当前宿主原生消费执行包；嵌入入口 executePreparedHost 自动复用同一 C4 复核，接入见 [平台中立执行](host-execution.md)。外部 provider 仅显式选用，其 execute 路径自行重核展示。brief 路径来自冻结 `stage_entry_defaults`；研究触发来自原 frontmatter 1.5，仍由 Core 准入，另过 `research-gate.mjs` 真实 proof。

`当前进度`、`进度图` 和未命中输入只查询，`execution_permitted=false`；歧义用明确 `/yy N`。新项目先消费 `/yy 0` Decision，完成立项后以 `tt-journey.mjs --workspace "$PROJECT_ROOT" --update --step 0` 记录基线；命名 session 时同传 `--session`。完成记录不是许可，下次重新 Decision。

## MCP 宿主消费同一协议

从 `scripts/lib/host-adapter.mjs` 导入 `createV2Transport`、`prepareHostDecision`、`verifyHostDecision`、`hostRecord`。`createV2Transport({workflowId, callTool})` 接真实 MCP client callback，调用现有 `yy_stage_decision`、`yy_task_decision`、`yy_validate_consumption`，不加工具。workflowId 须来自启用、显式 scope 的绑定，不接受任意路径。

原始请求交 `prepareHostDecision(input, {transport, present})`，present 实际展示完成后才返回许可；允许后才存 `hostRecord`。执行前同 input/transport 调 `verifyHostDecision`，宿主展示复核包，重新允许才执行。库负责核验/返回包，宿主负责真实展示/保存/执行；Core/V2 不重写准入、selector、receipt。

MCP 保持只读，不替宿主写本地 brief/receipt。此 CLI 的执行记录绑定本地 Core workspace/session；V2 记录不可当 Core CLI 记录，须按真实 transport 与绑定保存、复核、执行。

## 证据与版本边界

receipt 为 `LEGACY_V1_ONLY`；独立任务 checker 辅助证明本次产物行为，不证明九资产方法论应用。T5/T6/T7 与 C5 V2 完整闭环保持 `DEFERRED`、`c5_v2_complete=false`，不把流程事件升格为方法论 APPLIED。详见 `receipt-mode-boundary.md`。

M1 六工具属 `LEGACY_COMPATIBILITY`；旧 worktree 的 CANONICAL 文字不构成当前 stage/SOURCE_CANONICAL authority，不能代替 V2 准入。详见 `m1-authority-boundary.md`；当前/历史 manifest 身份和验收范围引用 `plans/project-handoff.md` ledger。

底层 `decision.mjs stage|task|validate` 仅作只读诊断，成功返回不证明宿主已消费 packet。服务入口 `integrations/yy-web-mcp/start-yy-mcp.ps1`，`/mcp` 是 M1，`/mcp-v2` 是 Decision；认证和绑定见该目录 README.md。
