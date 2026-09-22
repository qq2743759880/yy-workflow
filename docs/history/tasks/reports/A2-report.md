# A2 验证报告：implementation → opencode 实跑（orchestrator --exec 宿主执行）

- 日期：2026-08-31
- 验证身份：TT 派单执行验证 agent
- 任务：验证已部署 opencode 1.18 作为 orchestrator `--exec` 宿主真实执行
- 结论：**有条件通过** —— 编排链路与 opencode 实跑闭环已打通（mode=exec、result.txt 落盘），但发现一处 adapter 与 opencode CLI 集成缺陷（见 §4），真实产物内容有待修正后再判全绿。

---

## 1. 验证步骤与执行命令

1. **确认 opencode 1.18 非交互调用方式**：`opencode --help`
   - 结果：1.18.25；非交互消息命令为 **`opencode run [message..]`**；`serve`/`web` 为无头服务；默认无参数/带 `[project]` 启动 TUI。
2. **用临时 workspace 跑 orchestrator**（临时目录 `~/.openclaw/workspace/tmp/tt-a2`）：
   ```
   node ~/.ai-hub/skills/tt/scripts/orchestrator.mjs `
     --task "backend 实现一个加法函数 add(a,b) 返回 a+b" `
     --workspace ~/.openclaw/workspace/tmp/tt-a2 `
     --exec opencode run --exec-timeout 60 --verbose
   ```
   - `backend` 关键词命中 `T2_BACKEND` cluster → candidates 含 `implementation`。
   - 契约冻结 → `config.json` 的 executor.command 为空数组 → `opts.exec=['opencode','run']` 来自 CLI。
3. **检查 `.tt-state/state.json`**：见 §2。
4. **写本报告**。
5. **清理临时 workspace**：见 §6。

---

## 2. state.json 关键证据

### 2.1 modes 汇总（`plan-mthcvtrm`）
```
"modes": { "prompt": 5, "exec": 1, "planned-only": 1, "skipped": 1 }
```
- **含 `exec`（=1）** ✅ —— 满足"modes 应含 exec"。

### 2.2 implementation 子任务（核心目标，plan-mthcvtrm-1）
```json
{
  "asset": "implementation",
  "status": "done",
  "artifactPath": "artifacts\\plan-mthcvtrm-1\\result.txt",
  "attempts": 1,
  "mode": "exec",
  "adapter": "opencode"
}
```
- 状态 done、mode=exec、adapter=opencode、attempts=1 ✅
- 全 plan 仅此 1 个子任务为 exec（其余：be-architect/be-provider/be-resilience/security/review=prompt 兜底仅 brief；sdlc=planned-only 降级缺 bmad/cline；be-validator=skipped 缺 portman 的 CONTRACT_TOOL_NOT_AVAILABLE）。

### 2.3 assetConsumed
- **本 plan 所有子任务均无 `assetConsumed` 字段**（undefined / 未置 true）。
- 根因：`assetConsumed` 仅在 `prompt.mjs` adapter 中计算；**opencode.mjs adapter 不计算该字段**（只写 artifactPath + mode + adapter）。因此以"产物含方法论文本锚点/内核词"判定资产消费的机制，在 opencode 专用 CLI 路径上不生效。
- 处理：诚实标注为「opencode 专用 adapter 未输出 assetConsumed」，不虚报。这是 tt「资产消费证据（D-1）只对 prompt 产物生效」的具体表现。

---

## 3. 产物样例

`artifacts\plan-mthcvtrm-1\result.txt` 内容：
```
completed
```
- 该值来自 `util.mjs` 的默认：`if (!output) output = 'completed'`（子进程退出码 0 但 stdout 为空时写入）。
- 说明 opencode.exe 被**真实 spawn 且成功退出（exit 0）**，但**未向 stdout 产出 prompt 响应内容**。见 §4 根因。

---

## 4. 关键缺陷（adapter 与 opencode 1.18 CLI 集成不一致）

- **现象**：`opencode.mjs` 探测成功后执行 `runCommand('opencode', [String(input)])`，即 `opencode <task>`——把任务文本作为**单个位置参数**传给 opencode。
- **opencode 1.18 实际 CLI 语义**：`opencode <path>` 位置参数被当作**项目路径**（默认启动 TUI），**不是** prompt 消息；非交互执行 prompt 应使用 **`opencode run <message>`**。
- **结果**：`opencode "backend 实现…"` 把该字符串当项目路径 → 无 headless stdout 输出 → result.txt 仅「completed」。编排闭环（exec 模式、退出码、落盘、state 记录）成立，但**真实产物内容缺失**。
- **证明**：手动 `node spawn 完整exe --version` → 输出 `1.18.25`；手动 `opencode run "…"` → 真实返回（前述人工链路验证）。差异完全由「是否用 `run` 子命令」决定。
- **影响**：这是 brief 中「opencode 适配器 = 专用 CLI」设计假设与实际 opencode CLI 的偏差；`--exec opencode run`（prompt backend 特性）与 opencode.mjs 自带的 `opencode <task>` 是两条独立路径，本次按 asset=implementation 走了 opencode.mjs，`--exec` 未被其消费。

---

## 5. 通过 / 失败判断

| 判定项 | 结果 |
|--------|------|
| A. opencode 已部署（1.18.25，exe 可用） | ✅ |
| B. orchestrator 识别 task → cluster → implementation 子任务 | ✅ |
| C. 契约冻结（contracts/plan-mthcvtrm.json） | ✅ |
| D. opencode adapter 探测 → spawn → 退出码 0 | ✅ |
| E. state.json modes 含 exec | ✅ |
| F. result.txt 已落盘（非仅 brief） | ✅（但内容为默认 "completed"）|
| G. 产物为真实 opencode 响应内容 | ❌（stdout 空，因用 `opencode <task>` 而非 `opencode run <task>`）|
| H. assetConsumed 置 true | ⚠️（opencode adapter 不计算该字段）|

- **总体判定**：**有条件通过（orchestration 层绿）+ 待修正（execution 层灰）**。
  - 编排＋实跑闭环（exec 模式、spawn、退出码、落盘、state/report）**已验证通过**。
  - 但「真实产物非仅 brief」目标未完全达成——result.txt 为默认占位值，因 adapter 调用方式与 opencode 1.18 的 `run` 子命令不一致。
- **建议**：opencode.mjs 的调用改为 `opencode run <task>`（或在消息前追加 `--model`/`--format` 等非交互参数），重新验证后 result.txt 应含 opencode 实际 prompt 响应；届时 G 转 ✅、H 需补充 assetConsumed 机制或明确豁免。

---

## 6. 清理

临时 workspace `~/.openclaw/workspace/tmp/tt-a2` 已清理（含 .tt-state、artifacts、contracts）。验证报告保留于本文档路径。
