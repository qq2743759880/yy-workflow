---
task_id: task01-task-v2-template
title: task 模板 v2 七字段 + 独立机验器
status: completed
complexity_touched_files: 2
complexity_dep_depth: 1
complexity_score: 4
must_split: false
spec_budget_tokens: 1200
---

## GWT 验收（既有结构，保留）
- Given 派单方提交七字段齐备的 task 文档 When 机验器运行 Then exit 0 且七字段逐项 PASS。
- Given 文档缺任一字段或字段不合规 When 机验器运行 Then exit 1 且 detail 指名字段。

## 前后置与联节点（既有结构，保留）
- 前置：execution-plan-v3 §五 TK-1 派单已确认。后置：AS-3 引入施工消费本模板。联节点：validate-structure H6a-1 孤儿断言（模板落 templates/ 面）。选型依据：BMAD 文件-动作-理由 + spec-kit frozen-after-approval 结构。

```json implementation_steps
[
  { "target": "templates/task-v2.md", "action": "新建 task 模板 v2：七字段定义 + 机读格式 + 空白骨架", "rationale": "统一任务结构，派单面有单一事实源" },
  { "target": "scripts/validate-task.mjs", "action": "新建独立机验器，七字段逐项断言，FAIL 时 detail 指名字段", "rationale": "机验先于执行，reject 逐任务 LLM 评分" }
]
```

```json executor_acceptance
[
  { "ac": "合规样本七字段全过", "verify_command": "node scripts/validate-task.mjs test-reports/autopilot-work/TK-1/fx-01-valid.md", "expected_exit": 0 },
  { "ac": "缺 implementation_steps 样本被抓", "verify_command": "node scripts/validate-task.mjs test-reports/autopilot-work/TK-1/fx-02-missing-steps.md", "expected_exit": 1 }
]
```

```json trajectory_checkpoints
[
  { "step": 1, "artifact": "templates/task-v2.md 存在且含七字段定义表", "evidence": "文件在场；机验器字段 1 断言 target 存在性通过" },
  { "step": 2, "artifact": "scripts/validate-task.mjs 可执行且 fx 样本判定正确", "evidence": "node scripts/validate-task.mjs 逐样本实跑输出，日志 test-reports/autopilot-work/TK-1/" }
]
```

```json boundaries
{
  "always": ["机验先于派发：七字段不全的 task 文档不进执行队列", "路径一律工作区相对路径", "complexity 评分只用文件数+依赖深度确定性公式"],
  "never": ["禁止逐任务 LLM 评分 complexity", "禁止执行者改 boundaries 既有条目（批准后只许追加）", "禁止 spec_budget 超限仍单任务派发"],
  "edge_matrix": [
    { "input": "steps=8 步的 task 文档", "expected": "FAIL implementation_steps（步数越界）" },
    { "input": "status=completed 但 changed_files 指向不存在文件", "expected": "FAIL dev_record（目标不存在）" }
  ]
}
```

```json dev_record
{
  "changed_files": ["templates/task-v2.md", "scripts/validate-task.mjs"],
  "notes": "模板 + 机验器 + 7 样本全部落地，回归全绿。",
  "deviations": "无"
}
```
