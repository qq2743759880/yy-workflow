---
task_id: task06-bad-boundaries-over
title: 违规样本：boundaries.never 超 3 条
status: pending
complexity_touched_files: 1
complexity_dep_depth: 1
complexity_score: 3
must_split: false
spec_budget_tokens: 1200
---

## GWT 验收（既有结构，保留）
- Given boundaries.never 有 4 条 When 机验器运行 Then exit 1 且 detail 指名 never 超上限。

## 前后置与联节点（既有结构，保留）
- 前置：无。后置：无。联节点：无。选型依据：无。

```json implementation_steps
[
  { "target": "templates/task-v2.md", "action": "示例动作", "rationale": "示例理由" }
]
```

```json executor_acceptance
[
  { "ac": "样例 AC", "verify_command": "node scripts/validate-task.mjs test-reports/autopilot-work/TK-1/fx-06-boundaries-over.md", "expected_exit": 1 }
]
```

```json trajectory_checkpoints
[
  { "step": 1, "artifact": "中间产物示例", "evidence": "示例证据" }
]
```

```json boundaries
{
  "always": ["机验先于派发"],
  "never": ["第一条禁止事项", "第二条禁止事项", "第三条禁止事项", "第四条禁止事项（缺陷所在：超 3 条上限）"],
  "edge_matrix": [ { "input": "never 4 条", "expected": "FAIL boundaries" } ]
}
```
