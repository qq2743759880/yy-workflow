---
task_id: critique-convert-01
title: 缺陷一
status: pending
complexity_touched_files: 1
complexity_dep_depth: 0
complexity_score: 1
must_split: false
spec_budget_tokens: 1200
---

# 缺陷一（批判转化单，CR-1 七字段口径）

> 由 review-gate --convert-critique 生成；承接批判 claim→evidence→source 三元绑定（CR-1）。

## GWT 验收
- Given 批判已通过三元绑定校验 When 执行者按 implementation_steps 施工 Then executor_acceptance 逐条 exit 0

```json implementation_steps
[
  {
    "target": "sample-critique-with-source.md",
    "action": "在 scripts/review-gate.mjs 加 --critique-sources 全局绑定",
    "rationale": "承接批判：缺陷一"
  }
]
```

```json executor_acceptance
[
  {
    "ac": "node scripts/review-gate.mjs --self-test",
    "verify_command": "node scripts/review-gate.mjs --self-test",
    "expected_exit": 0
  }
]
```

```json trajectory_checkpoints
[
  {
    "step": 1,
    "artifact": "批判 01 的修复措施已落具体文件（claim→evidence→source 三元可溯）",
    "evidence": "对照原批判 sample-critique-with-source.md 的「优化方案」逐句核对"
  }
]
```

```json boundaries
{
  "always": [
    "承接批判目标逐条落地",
    "改动落在派单白名单内"
  ],
  "never": [
    "跳过 verify_command 实跑",
    "改写既有 tracker 登记行"
  ],
  "edge_matrix": [
    {
      "input": "批判条目缺优化方案（implementation_steps 缺失）",
      "expected": "转化拒绝落盘并具名条目"
    }
  ]
}
```

```json dev_record
{
  "changed_files": [],
  "notes": "（完工后回填）",
  "deviations": "（完工后回填，无偏离写「无」）"
}
```
