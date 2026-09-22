# task01 · a6api 参考宿主固化

> 执行者：子 agent（派单）。验收者：独立测试 agent（task03）。
> 承接批判：C-04（真机宿主不可用）。

## 目标
固化一个可复制的真实 LLM `--exec` 宿主，使 orchestrator 无需手动拼命令即可用真机 LLM 执行任务（读 brief → 调 LLM → 写产物 → assetConsumed=true）。

## 范围
1. **新增 `scripts/exec-host-a6api.mjs`**（零依赖，node ≥18）：
   - 入参：brief 绝对路径（argv[2]，orchestrator 追加为最后参数）
   - 读 brief → 提取资产名（`- asset: X`）与任务
   - 调 `https://api.a6api.com/v1/chat/completions`，model=`DeepSeek-V4-Flash-0731`，**key 从 `process.env.A6API_KEY` 读（禁写死）**
   - 回复（`message.content` 或 `reasoning_content` fallback）写 `plan.md` 到 brief 同目录，**须含资产名/方法论标题锚点**（供 assetConsumed）
   - max_tokens 限 2000，超时 120s
2. **config.example.json**：`executor.command` 给参考示例（含 `$A6API_KEY` env 说明，不写 key）
3. **README.md**：--exec a6api 可复制命令 + env 设置说明

## GWT
- Given 脚本存在；When `A6API_KEY=... node scripts/exec-host-a6api.mjs <brief>`；Then 调 LLM 成功、plan.md 含锚点、stdout 摘要、无硬编码 key
- Given `grep A6API_KEY` 全仓；Then 无 key 值（仅 env 名）
- Given 缺 A6API_KEY；Then 明确报错 exit 1（不挂起）
- Given `node --check scripts/exec-host-a6api.mjs`；Then 语法通过

## 纪律（C-01）
- 实现由子 agent 完成，编排者不编辑核心脚本；完成后自测上述 GWT，提交任务结果报告。

## Kickoff prompt（派单用）
```
你是执行 agent。任务 task01：为 TT 仓库（~/.ai-hub/skills/tt）实现 a6api 参考 --exec 宿主。
读 spec：~/.ai-hub/skills/tt/.claude/specs/tasks/task01-a6api-host.md
只改：scripts/exec-host-a6api.mjs（新）、config.example.json、README.md。不碰其它。
key 只从 process.env.A6API_KEY 读（测试时我注入 env，不写仓库）。实现后自测 GWT，报告结果。
```
