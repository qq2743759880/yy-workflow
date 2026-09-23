---
task_id: task03-bad-empty-verify
title: 违规样本：executor_acceptance 的 verify_command 为空
status: pending
complexity_touched_files: 1
complexity_dep_depth: 1
complexity_score: 3
must_split: false
spec_budget_tokens: 1200
---

## GWT 验收（既有结构，保留）
- Given AC 的 verify_command 为空串 When 机验器运行 Then exit 1 且 detail 指名 executor_acceptance。

## 前后置与联节点（既有结构，保留）
- 前置：无。后置：无。联节点：无。选型依据：无。

```json implementation_steps
[
  { "target": "templates/task-v2.md", "action": "示例动作", "rationale": "示例理由" }
]
```

```json executor_acceptance
[
  { "ac": "AC-1 verify_command 为空串（缺陷所在）", "verify_command": "", "expected_exit": 0 },
  { "ac": "AC-2 expected_exit 非整数", "verify_command": "node scripts/validate-task.mjs templates/task-v2.md", "expected_exit": "zero" }
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
  "never": ["禁止无 verify_command 的 AC 进队列"],
  "edge_matrix": [ { "input": "verify_command 为空", "expected": "FAIL executor_acceptance" } ]
}
```
