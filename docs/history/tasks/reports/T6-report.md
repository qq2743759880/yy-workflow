# T6 Report — opencode adapter 非交互调用修复

## 1. 改动 diff（仅 `scripts/lib/adapters/opencode.mjs`）

```diff
-  const result = await runCommand(opencodeCmd.command, opencodeCmd.prefix.concat([String(input)]), { workspace, timeoutMs: options.timeoutMs, timeoutCode: 'TIMEOUT', notAvailableCode: 'OPENCODE_NOT_AVAILABLE', throwOnTimeout: true, subtask });
+  // 非交互执行：裸 `opencode <msg>` 会进入 TUI 挂起，必须走 `opencode run <msg>`
+  const args = opencodeCmd.prefix.concat(['run']);
+  const model = (subtask && subtask.model) || options.model;
+  if (model) args.push('--model', String(model));
+  args.push(String(input));
+  const result = await runCommand(opencodeCmd.command, args, { workspace, timeoutMs: options.timeoutMs || 180000, timeoutCode: 'TIMEOUT', notAvailableCode: 'OPENCODE_NOT_AVAILABLE', throwOnTimeout: true, subtask });
```

未改动：probe（仍为 `opencode --version`，快速探测）、assetConsumed 校验块、util.mjs、其他 adapter、orchestrator。

## 2. 命令形态变化

| 场景 | 改动前 | 改动后 |
|---|---|---|
| 探测 | `cmd /d /c ...\opencode.cmd --version` | 不变 |
| 执行（无 model） | `cmd /d /c ...\opencode.cmd <input>`（裸名 → TUI 挂起） | `cmd /d /c ...\opencode.cmd run <input>` |
| 执行（有 model） | — | `cmd /d /c ...\opencode.cmd run --model <model> <input>` |

- model 取自 `subtask.model || options.model`；均无则不传 `--model`，交由 opencode 默认配置。
- 默认超时从「跟随 options.timeoutMs」改为 `options.timeoutMs || 180000`（≥120000；options 显式传入仍可覆盖）。`throwOnTimeout: true` 保持，真实执行超时可被 withRetry 重试。

## 3. 实测结果（诚实）

### 3.1 语法 & 结构
- `node --check opencode.mjs`：PASS
- `node scripts/validate-structure.mjs`：**0 警告** PASS

### 3.2 命令数组验证（resolveCommandShim）
```
command = C:\Windows\system32\cmd.exe
args = ["/d","/c","...\opencode.cmd","run","--model","a6api/DeepSeek-V4-Flash-0731","test msg"]
```
含 `'run'`，`--model` 紧随其后，消息在末尾。✓

### 3.3 真实调用（短消息 driver，subtask.model=a6api/DeepSeek-V4-Flash-0731）
```
opencode-run: 17.5s
ok = true
artifactPath = artifacts\t6-smoke\result.txt
assetConsumed = true
artifact head = "pong"
```
走 `opencode run --model …`，非 TUI，stdout 落 result.txt，assetConsumed 判定正确。✓

### 3.4 回归 regression-all.mjs：**5 PASS / 3 FAIL**（S4/S5/S8）

**根因（非代码缺陷）：默认模型上游故障。** 回归里 orchestrator 以 `backend=auto` 跑 `implementation` 子任务 → opencode adapter 真实执行 `opencode run <input>`（无 `--model`）→ opencode 默认模型 `gpt-5.6-luna`（用户级 a6api provider）当前持续返回「上游服务暂时不可用」，4 次独立直测全 exit=1（每次 ~10-16s）。改为显式 `--model a6api/DeepSeek-V4-Flash-0731` 则稳定成功（见 3.3）。S4/S5/S8 的 plan 因该子任务失败而整体 failed，三个用例同源失败：

- S4「冻结失败」：s4a 首次执行时 implementation 子任务 real-run 失败 → plan failed → exit 5（篡改→exit4 闸门本身通过）。
- S5「宿主执行 smoke」：断言 s5a.ok（plan 不失败）被同一失败破坏；其余子检查（stdout→exec / 写文件→exec / 空输出→prompt 降级）逻辑上未变。
- S8「资产消费证据」：s8.ok=false → state 缺失 → 派生指标归零/-1。

**与基线对照**：stash 掉本改动后 regression 为 8/8 PASS —— 基线「通过」是因为裸 `opencode <input>` 在非 TTY spawn 下以 exit 0 快速失败（把 `<msg>` 当工作目录 cd 失败，stdout 空 → result.txt='completed'），即基线是靠失效调用的巧合 fast-success 通过的；本改动让 adapter 真实执行，暴露了默认模型当前不可用这一环境事实。**回归为慢模型真实调用 + 默认模型依赖，作者验证时默认模型可用（慢但成功），本机此刻上游故障属环境/瞬时问题，非本次代码改动引入的逻辑错误。**

### 3.5 已修改文件
- `scripts/lib/adapters/opencode.mjs`（唯一）
- 工作区另有未提交的既有改动（orchestrator.mjs `--contract` 等，非本次任务范围，未触碰）。

## 4. 验收对照
| 验收项 | 结果 |
|---|---|
| `node --check` | ✅ |
| 命令数组含 `'run'` / 真实调用走 `run` | ✅ |
| `validate-structure.mjs` 0 警告 | ✅ |
| `regression-all.mjs` 8/8 | ❌ 5/8 — S4/S5/S8 因 a6api 默认模型（gpt-5.6-luna）上游持续故障失败；代码路径本身经 `--model` 真跑验证正确。默认模型恢复或 orchestrator 显式传 `--model` 后应转绿（回归将变慢，每实现子任务一次真实 LLM 调用）。 |

## 5. 备注
- 未做 exec-host 支持：任务要求「最小改动」，且真实用法下 opencode adapter 本就该真调 opencode CLI（`--exec` 宿主是给 prompt adapter 的），加 exec 分支会违背任务目的与「assetConsumed 校验逻辑不变」约束。
- 后续可选：orchestrator 增加 `--model` 透传（本次明确不改），或在用户级 opencode 配置固定可用的默认模型。
