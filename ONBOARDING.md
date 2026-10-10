# YY Skill 上手指南

先让当前宿主消费一个 Decision Packet，再运行小任务。架构见 `README.md`；决策与 receipt 边界见 `reference/decision-interface.md`。

## 1. 解析安装与项目路径

`$SKILL_DIR` 是已安装 YY 的绝对路径，`$PROJECT_ROOT` 是用户项目根目录。解析规则见 `reference/variables-and-config.md`。将发行包解压到独立目录并让宿主加载其中的 `SKILL.md`；保留随包 contracts、scripts、commands、reference 和 vendor 的相对布局。

Node.js ≥18 用于核心脚本；执行 Spectral、Semgrep 或 MCP 服务时使用其已声明依赖。`config.example.json` 可复制到用户项目并填写 `projectRoot`、`platforms`；凭据放环境变量或本机秘密存储。随包 vendor 是资产来源，环境变量不替换同名资产。

## 2. 自检与查询

```text
node "$SKILL_DIR/scripts/validate-structure.mjs"
node "$SKILL_DIR/scripts/detect-platforms.mjs" --json
node "$SKILL_DIR/scripts/host-adapter.mjs" prepare --workspace "$PROJECT_ROOT" --intent "当前进度"
```

平台探测只读；结果供配置使用。进度 packet 的 `execution_permitted=false`，不能据此开工。新项目从 `/yy 0` 消费阶段 packet，完成立项后按 Decision 接口记录 journey；记录状态不代替下一次准入。

## 3. 按阶段消费 Decision

Agent 加载 `SKILL.md`，按 `/yy 0..5` 或 `/yy research` 读取对应 command，再调用 `host-adapter.mjs prepare`。需要 task brief 的阶段传本次有界任务与 subtask id。`/yy 2` 必须先得到 stage admission，再得到 dev-planner brief。

完整展示 packet，最终 `ok=true` 且 `data.execution_permitted=true` 才允许继续。显式 `--save` 保存后，默认 HOST_NATIVE：先 `check` 重核，再由当前宿主消费包；嵌入接口自动复用相同复核。`execute --exec` 只用于显式外部路径。当前可信 session 必须贯穿调用；不从旧记录恢复 session。具体参数与真实执行 / 独立 checker 例子见 `reference/decision-interface.md`。

一个平台可以串行执行。缺少所需资产、analyzer、gate 或证据时，以 Decision blocker / UNVERIFIED 处理，不凭旧说明假设自动放行。

## MCP 宿主

用现有 lifecycle 启动同进程双挂载服务，再配置可信 workflow binding。阶段决策连接 `/mcp-v2`；`/mcp` 仅作旧版兼容读取。服务地址、认证与 ngrok 配置以 integration README 和本机 runtime 配置为准。

MCP 三个 Decision 工具均只读；宿主负责实际展示、记录与执行。真实任务行为验收仍是 LEGACY_V1_ONLY，不表示 C5 / Receipt v2 methodology_applied 已完成。

## 维护时的检查

运行 `validate-structure.mjs`，以及 `decision:authority:check`、`decision:transport:check`、`decision:ledger:check`。它们分别检查结构、实际组件身份、transport 与当前 handoff 投影；身份一致不替代行为验收。旧 token snapshot 的已知失败应保留，不为清理而改写基线。

## 嵌入宿主默认执行

默认 HOST_NATIVE 不要求任何外部 CLI。嵌入接入使用 reference/host-execution.md 的 executePreparedHost 接口，先消费 C4 packet，再绑定当前宿主 execute 回调。独立 CLI 无回调时返回完整 BRIEF_ONLY 包，不能算执行成功。--exec 或 --provider 是显式可选的外部路径，不以探测到安装为默认选择。

## 人工交接与旧配置

当前任务选择 MANUAL_HANDOFF 后，旧 command/provider/hosts 均不能自动执行。使用 `scripts/handoff.mjs preview|prepare --workspace "$PROJECT_ROOT" --plan-id <id> --task-id <id> --config <approved.json>`；preview 零业务写，prepare 经当前 C4 展示与本端登记后等待返回。旧 `executor-setup.mjs --handoff` 使用相同入口，并要求 `--handoff-config <approved.json>`。

批准 JSON 必须完整给出预算、权限、固定 checker、允许项目输入与验收条目；不采用示例默认限额或返回者命令。返回经 import、确定性 checker validate、当前快照与版本 CAS accept 才接受原任务；远端过程/费用保持 UNKNOWN，C5 未完成。完整参数、digest 计算来源、单文件 patch 边界和 `--migration-preview <existing.json>` 零写迁移见 [人工交接](reference/manual-handoff.md)。
