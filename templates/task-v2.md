<!-- 阶段机验: (由编排者填写：--prereq-check --step N 通过时间戳，或 N/A(非编排内核产物)) -->

# task 文档模板 v2（七字段机验版）

> 定位：在既有 task 文档结构（GWT 验收全文 + 前后置 + 联节点 + 选型依据，口径见 `reference/task-decomposition.md`）之上叠加七个机验字段。派单（阶段 5）按本模板产 task 文档；执行者回填 `dev_record`；完工验收由机验器与 `executor_acceptance` 逐条把关。
> 机验入口：`node scripts/validate-task.mjs <task文档路径>` —— exit 0=合规 / 1=FAIL（detail 指名字段）/ 2=用法或文件读取错误。
> 来源：`plans/execution-plan-v3-20260923.md` §五 TK-1（批 0）。frozen-after-approval 纪律对标 spec-kit 模板结构（批准后只许追加）。

## 一、七字段定义与机验口径

| # | 字段 | 定义 | 机验断言（validate-task.mjs） |
|---|------|------|------------------------------|
| 1 | `implementation_steps[]` | 施工步清单，1-7 步；每步 `{target, action, rationale}`（文件-动作-理由） | 步数 ∈[1,7]；三键均须非空字符串；target 须为工作区相对路径且真实存在 |
| 2 | `executor_acceptance[]` | 执行者验收条目，≥1 条；每条 AC 附 `verify_command`（CLI + 期望退出码） | ac / verify_command 非空；expected_exit 为 0-255 整数。阶段 4 逐条实跑，exit 0=完工 |
| 3 | `trajectory_checkpoints[]` | 每步一个可观测中间产物 `{step, artifact, evidence}`（文件存在 / 单测过 / 命令输出片段） | step 索引须覆盖 1..N 全部 steps，缺任一步 FAIL；step 越界 FAIL；artifact / evidence 非空 |
| 4 | `complexity_score` + `must_split` | 涉及文件数 + 依赖深度口径的确定性评分，**禁逐任务 LLM 评分** | frontmatter 必填；score 必须等于公式 `complexity_touched_files + complexity_dep_depth × 2`；must_split 必须等于规则 `score > 12 或 touched_files > 5`（超阈值强制拆 subtasks） |
| 5 | `boundaries` | Always / Never 各 ≤3 条 + 边缘用例矩阵（≥1 行 `{input, expected}`） | always / never 各 1-3 条非空字符串；矩阵每行 input / expected 非空。owner 批准后冻结，只许追加（append-only） |
| 6 | `dev_record` | 执行者回填：实际改动文件清单 + 完成备注 + 偏离原因 | `status: completed` 时必填：changed_files ≥1 且每个路径真实存在；notes / deviations 非空（无偏离写「无」）；status 非 completed 时可暂缺 |
| 7 | `spec_budget` | 任务描述 token 上限，v2 定额 ≤1200 tok（CJK 加权，量尺同 validate-structure H1），超限即拆 | 正文（除 frontmatter 与 dev_record 块）token 计数 ≤ 上限；上限由 frontmatter `spec_budget_tokens` 声明（缺省 1200），声明值不得 >1200 |

## 二、机读格式（validate-task.mjs 解析约定）

- 标量放 YAML frontmatter：`task_id` / `title` / `status`（completed|pending|draft，缺省 pending）/ `complexity_touched_files` / `complexity_dep_depth` / `complexity_score` / `must_split` / `spec_budget_tokens`。frontmatter 不支持行内注释。
- 五个结构化字段各占一个围栏代码块，info string 即字段名：` ```json implementation_steps ` / ` ```json executor_acceptance ` / ` ```json trajectory_checkpoints ` / ` ```json boundaries ` / ` ```json dev_record `，块内为合法 JSON。
- 同名字段块以首个为准；JSON 解析失败按该字段 FAIL 处理。
- 文件路径一律工作区相对路径（禁绝对路径）。

## 三、空白骨架（拷贝即用）

````markdown
---
task_id: taskNN-slug
title: 一句话标题
status: pending
complexity_touched_files: 0
complexity_dep_depth: 0
complexity_score: 0
must_split: false
spec_budget_tokens: 1200
---

## GWT 验收（既有结构，保留）
- Given … When … Then …

## 前后置与联节点（既有结构，保留）
- 前置：…；后置：…；联节点：…；选型依据：…

```json implementation_steps
[
  { "target": "path/relative/to/workspace", "action": "做什么", "rationale": "为什么" }
]
```

```json executor_acceptance
[
  { "ac": "验收断言一句话", "verify_command": "node scripts/xxx.mjs args", "expected_exit": 0 }
]
```

```json trajectory_checkpoints
[
  { "step": 1, "artifact": "可观测中间产物（文件/单测/输出片段）", "evidence": "在哪能看到/怎么核" }
]
```

```json boundaries
{
  "always": ["…"],
  "never": ["…"],
  "edge_matrix": [ { "input": "…", "expected": "…" } ]
}
```

```json dev_record
{
  "changed_files": [],
  "notes": "（完工后回填）",
  "deviations": "（完工后回填，无偏离写「无」）"
}
```
````

## 四、填妥样例与违规样本

- 合规实例：`test-reports/autopilot-work/TK-1/fx-01-valid.md`（TK-1 自指样例，机验实跑 exit 0）。
- 违规样本同目录 fx-02…fx-07（每份只植入一处缺陷）：缺 implementation_steps / verify_command 空 / checkpoints 不覆盖 steps / complexity 未填 / boundaries 超 3 条 / spec_budget 超限。

## 五、冻结与追加纪律

1. `boundaries` 与 `executor_acceptance` 经 owner 批准后冻结：后续修改只允许追加条目（append-only）；改写/删除既有条目视为越权变更，须走 change 单。批准版的跨版本 diff 核对由编排者在提交时执行（本单文件级机验器不承担历史 diff）。
2. `dev_record` 是唯一允许执行者直接回填的字段；其余字段改动等同改派单。
3. `trajectory_checkpoints.artifact` 的真实性（产物是否真的可观测）由 L2 独立验收复核；机验器只断言结构与覆盖完备性。
