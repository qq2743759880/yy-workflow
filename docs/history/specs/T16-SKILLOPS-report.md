# TT vendor SkillOps 自进化体检报告

- 生成: (tt-skillops, 只读分析, 无 LLM)
- 资产库: D:\.ai-hub\skills\tt\vendor

## 1. 资产→五元组映射
| skill | domain_type(截断) | artifact_kind | validator 数 | type |
|---|---|---|---|---|
| tt_agent-research | research | planning | 1 | skill |
| tt_agent-vision-toolkit | vision | methodology | 1 | skill |
| tt_be-architect | frontend | code | 4 | agent |
| tt_be-provider | backend | planning | 2 | agent |
| tt_be-resilience | frontend | verification | 2 | agent |
| tt_be-validator | backend | methodology | 2 | agent |
| tt_colorize | vision | design | 3 | skill |
| tt_dev-planner | frontend | code | 2 | agent |
| tt_frontend-design | frontend | design | 1 | skill |
| tt_frontend-visual-validation | frontend | design | 3 | skill |
| tt_implementation | backend | code | 1 | agent |
| tt_planning | planning | planning | 1 | skill |
| tt_review | review | code | 1 | skill |
| tt_sdlc | planning | planning | 1 | skill |
| tt_security | security | code | 2 | skill |
| tt_skill-sentinel | security | verification | 1 | skill |

## 2. 边统计（HSEG）

| edge_type | 数量 |
|---|---|
| alternative | 16 |

## 3. redundancy 边（签名冲突 → 冗余/替代候选）

- 无 redundancy 边（各资产签名互异，无重复实现）

## 4. alternative 边（同域不同路径）

- `tt_agent-vision-toolkit` → tt_colorize
- `tt_be-architect` → tt_be-resilience, tt_dev-planner, tt_frontend-design, tt_frontend-visual-validation
- `tt_be-resilience` → tt_dev-planner, tt_frontend-design, tt_frontend-visual-validation
- `tt_dev-planner` → tt_frontend-design, tt_frontend-visual-validation
- `tt_frontend-design` → tt_frontend-visual-validation
- `tt_be-provider` → tt_be-validator, tt_implementation
- `tt_be-validator` → tt_implementation
- `tt_planning` → tt_sdlc
- `tt_security` → tt_skill-sentinel

## 5. MaintenanceEngine.sweep 结果

- merged: 0 · retired: 0 · validators_added: 0

## 6. 缺 validator 建议（技能自进化候选）

- 全部资产至少含 1 validator

## 7. 规划测试（GraphOfGraphsPlanner）

- task(frontend): match_level=domain_neighbor · chosen=tt_be-architect · plan=['LoadSkill(be-architect)', 'ApplyMethodology(code)']
- task(research): match_level=domain_neighbor · chosen=tt_agent-research · plan=['LoadSkill(agent-research)', 'ApplyMethodology(planning)']

## 8. 结论与建议

- 资产库健康：无冗余、无缺 validator、边结构可用。

---
> 本报告只读分析 TT vendor 资产，不修改任何文件。