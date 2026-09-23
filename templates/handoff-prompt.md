# 交接 Prompt（Handoff Prompt）模板 — ON-1 批 0

> 用途：`orchestrator.delegationMode: handoff-prompt` 时，编排者不自己派单，而是生成一段**交给用户粘贴到另一个会话/另一个 agent** 的 Prompt。
> 格式纪律：provenance 头（这段 Prompt 谁生成、何时、基于哪份计划）+ 去授权声明（接手者只做本单内的事）+
> 逐值来源（每个关键值后面注明从哪来：派单/计划/Owner 指令/向导默认）+ 验收标准固化（写死，交接后不许口头放宽）。

---

## 一、模板结构（六段，段名固定）

```markdown
# 交接 Prompt — <task-id>（<plan-id>）

## Provenance（来源链）
- 生成者：<编排者身份，如 "autopilot 管线 L1 编排 agent">
- 生成时间：<ISO 8601>
- 生成依据：<计划/派单文件路径引用，不复制内容>
- 配置快照：orchestrator.config.yaml 六字段值 <逐值列出，或 "见 <workspace>/orchestrator.config.yaml">
- 交接链：<上一棒是谁/哪一棒；本次是第几跳>

## 去授权声明（接手者必读）
- 你只被授权完成本 Prompt「任务与范围」段内的事；范围外一律不做、不猜、不代替决定。
- 白名单外不写文件；禁止 git 写操作；禁止读写凭据文件；禁止改本 Prompt 自身。
- 发现范围问题或信息缺口 → 停下上报（回填报告如实记录），不静默扩权。

## 任务与范围
- 任务：<一句话说明，占位派单时补齐>
- 背景：<2-3 句，接手者不需要读完整仓库就能理解>
- 必读（路径引用，不复制内容）：
  - <占位：派单/计划/上游契约路径>
- 允许写入（白名单）：<占位：逐路径；白名单外一律禁止>

## 逐值来源（关键值 × 来源，缺一不可）
| 值 | 内容 | 来源 |
|---|---|---|
| <字段/输入 1> | <值> | <派单 <path> §x / Owner 口头指令 / 向导默认（executor-setup --configure）/ 上游产物 <path>> |
| <字段/输入 2> | <值> | <同上形态，逐行注明> |
| <…> | <…> | <…> |

> 纪律：来源只认四类——派单/计划文件、Owner 指令、上游真实产物、向导默认值。
> 接手者对"来源不明"的值应停下上报，不得当作已授权事实使用。

## 验收标准（固化：交接后不改、不口头放宽）
- <可机验断言 1，如：node scripts/xxx.mjs 退出码 0>
- <可机验断言 2，如：字段 A/B/C 齐全且值满足 <条件>>
- <可人工核对断言 3，如：证据文件落 <path>，含逐项实测输出>
- 回填报告：按 templates/completion-report.md 写到 <约定路径>；缺「资产消费证据」「完工前自检」两段 = 未完成。

## 完成后
- 只回传报告路径与结论（PASS/FAIL/PARTIAL + 一句话），不复制报告正文。
- 无法完成 → 如实回填 BLOCKED + 缺什么，不编造完成假象。
```

---

## 二、填写纪律（生成者遵守）

1. **逐值来源表必须穷尽**接手者要用的全部关键输入；一行值没有来源 = 该值不得出现在 Prompt 里。
2. **验收标准写死**：能写机验命令的写命令 + 期望退出码；写不了的写"人工可核对"的具体核对点，不写"质量要高"这类不可判定话术。
3. **去授权声明不省略**：handoff-prompt 模式的接手者不在编排者视线内，越权行为只能靠声明前置约束 + 回填报告留痕兜底。
4. **provenance 配置快照**：六字段值在生成时点快照（防止 config 后改导致接手者拿到的口径与编排者决策时不一致）。
5. 与 `executor-setup.mjs --handoff`（schema tt/handoff-brief@1 的 brief 骨架）的关系：本模板是 handoff-prompt 委派模式的**人读 Prompt 面**；
   brief 骨架是机验回填面（taskId/taskVerdict/evidencePaths）。二者可同时使用：Prompt 给人看，brief 骨架定回填格式。

---

## 三、样例（可整体复制后改值）

```markdown
# 交接 Prompt — FE-7（v3-20260923）

## Provenance（来源链）
- 生成者：autopilot 管线编排 agent（orchestrator.delegationMode=handoff-prompt）
- 生成时间：2026-09-23T12:00:00Z
- 生成依据：plans/execution-plan-v3-20260923.md §五 批 2
- 配置快照：subagentSource=session / delegationMode=handoff-prompt / critique.sources=none
  / report.style=plain / blindwalk.enabled=true / mcp.tools=[]
- 交接链：Owner → 编排者（第 1 跳）→ 你（第 2 跳）

## 去授权声明（接手者必读）
- 你只被授权完成「任务与范围」段内的事；范围外不做、不猜、不代替决定。
- 白名单外不写文件；禁止 git 写操作；禁止读写凭据文件；禁止改本 Prompt 自身。
- 发现范围问题或信息缺口 → 停下上报，不静默扩权。

## 任务与范围
- 任务：前端适配决策卡/研究门产物/盲测看板渲染（执行计划 FE-7）
- 背景：v3 管线新增三类产物，需要在前端 journey 渲染面各加一卡；
  数据源 schema 见对应 contracts 文件。
- 必读（路径引用，不复制内容）：plans/execution-plan-v3-20260923.md §五 FE-7 行
- 允许写入（白名单）：webview/journey/、test-reports/autopilot-work/FE-7/

## 逐值来源（关键值 × 来源）
| 值 | 内容 | 来源 |
|---|---|---|
| 渲染面 | webview/journey | 执行计划 FE-7 行 |
| 三类产物 | 决策卡/研究门/盲测看板 | 执行计划 §五 FE-7 行 |
| schema 来源 | contracts/ 对应文件 | 上游产物（AV-2/SB-1/RG-1 交付） |

## 验收标准（固化）
- node scripts/regression-all.mjs → 13 PASS / 0 FAIL，exit 0
- 三类产物各渲染 1 卡（fixtures 驱动，产物 id 与 contracts 登记 id 一致）
- 证据落 test-reports/autopilot-work/FE-7/，含逐项实测输出
- 回填报告按 templates/completion-report.md，缺「资产消费证据」「完工前自检」两段 = 未完成

## 完成后
- 只回传报告路径与结论（PASS/FAIL/PARTIAL + 一句话）。
- 无法完成 → 如实回填 BLOCKED + 缺什么，不编造完成假象。
```
