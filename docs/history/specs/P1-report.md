# P1-report — 失败自动恢复（换宿主/换视角重试 + 自动降级链）

> 独立实现子 agent 报告 · TT skill v2.5.0 · 基线 commit `424c9db` · 2026-09-02
> 范围：三档自动恢复（同宿主重试 → 换宿主 → 换视角模型 → 诚实降级），零外部依赖，只改 5 个文件。

## 一、改动文件清单

| 文件 | 改动 |
|---|---|
| `scripts/lib/resilience.mjs` | 新增 `resolveHosts(options)`（解析 `--hosts`/`config executor.hosts` → `[{command, model, commandKey}]`）+ `retryAcrossHosts(fn, {hosts, primary, ...})`（逐宿主逐模型尝试，记录 recovery 链）。原 `withRetry`/`createCircuitBreaker`/`fallback` 原样保留。 |
| `scripts/lib/runtime.mjs` | `dispatch` 用 `retryAcrossHosts` 包裹 prompt adapter 的 `adapter.run`（仅 prompt 后端且有宿主时走此路径）；`subtask.recovery` + `subtask.attempts += recovery.length`；`executePlan` 对「换宿主/换视角后仍降级」的子任务标 `plan.degraded=true` + warning。 |
| `scripts/orchestrator.mjs` | `parseArgs` 新增 `--hosts`（加入 `--exec` KNOWN 集）；`usage()` 补 `--hosts`；`main` 读 `config executor.hosts` → `opts.configHosts`；`execution-feedback.md` 每子任务追加 `recovery:` 明细。 |
| `config.example.json` | `executor.hosts` 示例（命令数组列表，含 `--model` 换视角项）+ note 说明。 |
| `README.md` | 编排器用法补 `--hosts` 示例 + 「失败自动恢复」三档说明 + config 固化方式。 |
| `docs/history/specs/P1-report.md` | 本报告。 |

硬约束遵守：零外部依赖；不写本机绝对路径（validate 可移植性 0 泄露）；不加新状态值（recovery 仅字段记录）；只改上述文件；未提交未 push。

## 二、recovery 链逻辑

宿主链 = `[--exec 主宿主] + [--hosts（优先级高）｜ config executor.hosts（优先级低）]`，逐项按序尝试：

1. **同宿主重试**（既有 `withRetry`）：`TimeoutError`/`RetryableError` 指数退避，`--max-retries` 控制，语义与 2.5.0 一致。
2. **换宿主重试**：prompt 宿主返回诚实降级（`brief-only (executor ...)`：宿主失败/超时/空输出/上游不可用）→ 记 `subtask.recovery += { stage:'host-switch', from, to, attempt }`，换下一宿主重跑同一 brief。
3. **换视角重试**：`--hosts` 项带 `--model <id>` 后缀时，同一命令不同模型判定为 `stage:'model-switch'`（换视角）。
4. **自动降级链**：全部宿主失败 → 返回最后一宿主的诚实降级结果（`mode=prompt` brief-only），`executePlan` 标 `plan.degraded=true` + warning（「失败自动恢复：N 个子任务换宿主/换视角重试后仍失败…」）；`requireExec` 资产保持既有强制语义（独立 warning 不变）。

细节：
- `subtask.recovery` 为数组（多级换宿主即多元素，实测三级链 `fail→fail2→ok` 记 attempt 2/3）。
- 恢复尝试计数：`runGroup` 首次派单 `attempts+1`，dispatch 内再 `+recovery.length`（首失败次成功 → attempts=2）。
- 连续完全相同宿主去重（`commandKey+model` 一致则跳过），避免同一宿主同模型空跑；主宿主与 `--hosts[0]` 相同也会被去重。
- 无 `--hosts`、无 `config.hosts` 时 chain 仅含主宿主 → 行为与 2.5.0 完全一致（宿主失败 → brief-only 降级，无 recovery 字段，attempts=1）。
- 状态机零改动：`recovery` 仅是 subtask 新字段，无新 status/mode 值；mode 语义（exec/prompt/planned-only/skipped）与报告逻辑不变。

## 三、两宿主模拟实测（首失败 → 次成功）

隔离验证环境：`git worktree` 于 HEAD `424c9db` + 仅覆盖本 P1 的 5 个文件（排除工作区并发改动干扰）。两个临时宿主脚本（os.tmpdir，跑完即弃）：

- `tt-host-fail.mjs`：`process.exit(1)` 故意失败（宿主不可用）。
- `tt-host-ok.mjs`：读 brief → 提取「方法论正文」后首个标题锚点 + `Kernel:` 内核词 → 写 `plan.md`（供 `assetConsumed=true`）。

实测命令（`--backend prompt` 隔离外部 CLI 依赖，任务 `backend login module` → T2 8 子任务）：

```
node scripts/orchestrator.mjs --backend prompt --task "backend login module" \
  --workspace <tmp> --exec node <fail.mjs> --hosts "node <ok.mjs>"
```

**结果（state.json）**：`status=done degraded=false modes={"exec":8}`，8/8 子任务全部 `done`、`mode=exec`、`consumed=true`、`attempts=2`、`recovery=[{"stage":"host-switch","from":"tt-host-fail.mjs","to":"tt-host-ok.mjs","attempt":2}]`。`execution-feedback.md` 每子任务含 `recovery: host-switch tt-host-fail.mjs→tt-host-ok.mjs(attempt 2)`。主宿主失败后自动切备选宿主成功，无需人工介入。**exit 0。**

补充：config 来源实测（`config.json executor.hosts=[fail2, ok]`，无 `--exec`/`--hosts`）→ 同样 `host-switch` 恢复成功；`--hosts` 命令行优先级高于 config（同时存在时用命令行，恢复链为空、attempts=1）；三级链（`--exec fail` + `config.hosts=[fail2,ok]`）→ `recovery` 两条（attempt 2/3），`attempts=3`。

## 四、换视角（model-switch）实测

同一宿主脚本支持 `--model` 透传，按模型判换视角：

```
node scripts/orchestrator.mjs --backend prompt --task "backend login module" \
  --workspace <tmp> --hosts "node <ok.mjs> --model fail-model,node <ok.mjs> --model ok-model"
```

**结果**：`recovery=[{"stage":"model-switch","from":"tt-host-ok.mjs@fail-model","to":"tt-host-ok.mjs@ok-model","attempt":2}]`，`mode=exec consumed=true attempts=2`，plan 不降级。判定依据：`commandKey`（去 `--model` 后的命令）相同、model 不同 → `model-switch`；命令不同 → `host-switch`。

## 五、全失败降级实测

```
node scripts/orchestrator.mjs --backend prompt --task "backend login module" \
  --workspace <tmp> --exec node <fail.mjs> --hosts "node <fail2.mjs>"
```

**结果**：`status=done degraded=true modes={"prompt":8}`，8/8 `mode=prompt`、`attempts=2`、`recovery=[{stage:'host-switch', from:'tt-host-fail.mjs', to:'tt-host-fail2.mjs', attempt:2}]`。plan warnings 含既有「prompt 兜底」「requireExec 强制」+ 新增「失败自动恢复：8 个子任务换宿主/换视角重试后仍失败…最终诚实降级」。全部宿主失败 → 不中止计划、诚实标 degraded，需人工介入。**exit 0（与 2.5.0 brief-only 降级退出码一致）。**

注：`--exec fail` + `--hosts "node fail.mjs"`（与主宿主完全相同）会被连续去重为单宿主链，故不产生 recovery——这是刻意行为（同一宿主同模型重跑无意义），全失败降级需两个不同宿主（如上 fail/fail2）。

## 六、回归结果

隔离环境（HEAD `424c9db` + 本 P1 5 文件）`node scripts/ci.mjs`：

- S1 validate-structure：**PASS**（可移植性泄露 0、接口漂移 0、16/16 资产、U+FFFD 0）
- S2 review-gate self-test：**PASS**
- S3 plan-review --check：**PASS**
- S4 regression-all：**8 PASS / 0 FAIL**（S1 validate / S2 test-retry / S3 Phase2 / S4 契约 / S5 宿主执行 / S6 资产缓存 / S7 review-gate / S8 资产消费证据）
- **CI PASS**

无 `--hosts` 且无 config hosts 回归对照：`--exec node <fail.mjs>` → `mode=prompt attempts=1 recovery=null`，与 2.5.0 完全一致。`node scripts/test-retry.mjs` 6/6 PASS。

**诚实说明**：主工作区 `D:\.ai-hub\skills\tt` 存在**并发外部改动**（非本 P1 引入：`scripts/review-gate.mjs` +323 行、`scripts/asset-call-rate.mjs` +124 行、`plans/critique-backlog-tracker.md`、`docs/history/specs/P2-report.md`/`P3-report.md` 等），其中 review-gate 的 `--auto-register` 扩展使主工作区 S7 self-test 暂红（应登记 3 条实得 1）。已用 `git worktree` 隔离验证：HEAD 版本 review-gate self-test PASS；**仅叠加本 P1 5 文件的纯净环境 CI 全绿 8/8**。P1 改动本身 validate 0 泄露、test-retry 全过。未触碰并发文件，未提交未 push。

## 七、验收对照

| 验收标准 | 结果 |
|---|---|
| 无 `--hosts` 行为与 2.5.0 完全一致（回归 8/8） | ✅ 隔离环境 CI PASS / regression-all 8/8；无 hosts 对照 attempts=1、无 recovery |
| 有 `--hosts` 首个宿主失败 → 第二个成功 → done + recovery 记录 | ✅ 两宿主模拟 8/8 `done` `mode=exec` + `recovery host-switch` |
| 全部宿主失败 → 诚实降级（degraded + warning），requireExec 保持强制 | ✅ `degraded=true modes={prompt:8}` + 恢复 warning + requireExec warning |
| 换视角（model-switch） | ✅ 同命令不同模型 → `stage:'model-switch'` |
| validate 0 泄露；README 补文档 | ✅ 可移植性 0 泄露；README/usage/config.example 已补 `--hosts` |
| `node scripts/ci.mjs` 通过 | ✅ 隔离纯净环境 CI PASS（主工作区 S7 暂红系并发外部改动，见上诚实说明） |
