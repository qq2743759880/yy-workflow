---
task_id: task04-bad-checkpoint-coverage
title: 违规样本：trajectory_checkpoints 未覆盖全部 steps
status: pending
complexity_touched_files: 2
complexity_dep_depth: 1
complexity_score: 4
must_split: false
spec_budget_tokens: 1200
---

## GWT 验收（既有结构，保留）
- Given steps 有 2 步而 checkpoints 只覆盖 step 1 When 机验器运行 Then exit 1 且 detail 指名未覆盖 steps。

## 前后置与联节点（既有结构，保留）
- 前置：无。后置：无。联节点：无。选型依据：无。

```json implementation_steps
[
  { "target": "templates/task-v2.md", "action": "示例动作一", "rationale": "示例理由一" },
  { "target": "scripts/validate-task.mjs", "action": "示例动作二", "rationale": "示例理由二" }
]
```

```json executor_acceptance
[
  { "ac": "样例 AC", "verify_command": "node scripts/validate-task.mjs test-reports/autopilot-work/TK-1/fx-04-checkpoint-gap.md", "expected_exit": 1 }
]
```

```json trajectory_checkpoints
[
  { "step": 1, "artifact": "只覆盖第 1 步（缺陷所在：缺 step 2）", "evidence": "示例证据" }
]
```

```json boundaries
{
  "always": ["checkpoint 覆盖全部 steps"],
  "never": ["禁止留无 checkpoint 的施工步"],
  "edge_matrix": [ { "input": "2 步只有 1 个 checkpoint", "expected": "FAIL trajectory_checkpoints" } ]
}
```
