---
task_id: task05-bad-complexity-missing
title: 违规样本：complexity 四键未填（frontmatter 缺失）
status: pending
spec_budget_tokens: 1200
---

## GWT 验收（既有结构，保留）
- Given frontmatter 缺 complexity_touched_files/dep_depth/score/must_split When 机验器运行 Then exit 1 且 detail 逐个指名缺失键。

## 前后置与联节点（既有结构，保留）
- 前置：无。后置：无。联节点：无。选型依据：无。

```json implementation_steps
[
  { "target": "templates/task-v2.md", "action": "示例动作", "rationale": "示例理由" }
]
```

```json executor_acceptance
[
  { "ac": "样例 AC", "verify_command": "node scripts/validate-task.mjs test-reports/autopilot-work/TK-1/fx-05-complexity-missing.md", "expected_exit": 1 }
]
```

```json trajectory_checkpoints
[
  { "step": 1, "artifact": "中间产物示例", "evidence": "示例证据" }
]
```

```json boundaries
{
  "always": ["complexity 用确定性公式"],
  "never": ["禁止 LLM 评分 complexity"],
  "edge_matrix": [ { "input": "frontmatter 缺 complexity 四键", "expected": "FAIL complexity_score+must_split" } ]
}
```
