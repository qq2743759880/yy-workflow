---
task_id: task02-bad-missing-steps
title: 违规样本：缺 implementation_steps 字段块
status: pending
complexity_touched_files: 2
complexity_dep_depth: 1
complexity_score: 4
must_split: false
spec_budget_tokens: 1200
---

## GWT 验收（既有结构，保留）
- Given 文档缺 implementation_steps 字段块 When 机验器运行 Then exit 1 且 detail 指名 implementation_steps。

## 前后置与联节点（既有结构，保留）
- 前置：无。后置：无。联节点：无。选型依据：无。

```json executor_acceptance
[
  { "ac": "样例 AC（本样本其余字段合规，仅缺 implementation_steps）", "verify_command": "node scripts/validate-task.mjs test-reports/autopilot-work/TK-1/fx-02-missing-steps.md", "expected_exit": 1 }
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
  "never": ["禁止无 steps 即派发"],
  "edge_matrix": [ { "input": "缺 steps", "expected": "FAIL" } ]
}
```
