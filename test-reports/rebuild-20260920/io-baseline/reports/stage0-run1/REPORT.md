# IO 调用率审计报告 — baseline-stage0-run1

- 输入 JSONL: 1 个文件，36 条记录
- 资产白名单: 16 个（lib/evolution.mjs ASSET_WHITELIST）
- 阶段对齐: ⚠ journey.json 不存在（D:\.ai-hub\skills\yy\test-reports\rebuild-20260920\io-baseline\sandbox-project\.tt-state\journey.json）：整表 stage=unknown（不猜）

## 每资产计数（routing / consumption）

| 资产 | routing | consumption | 合计 |
|---|---|---|---|
| agent-research | 0 | 1 | 1 |
| agent-vision-toolkit | 0 | 1 | 1 |
| be-architect | 0 | 4 | 4 |
| be-provider | 0 | 4 | 4 |
| be-resilience | 0 | 4 | 4 |
| be-validator | 0 | 4 | 4 |
| colorize | 0 | 1 | 1 |
| dev-planner | 0 | 2 | 2 |
| frontend-design | 0 | 1 | 1 |
| frontend-visual-validation | 0 | 1 | 1 |
| implementation | 0 | 4 | 4 |
| planning | 0 | 1 | 1 |
| review | 0 | 2 | 2 |
| sdlc | 0 | 2 | 2 |
| security | 0 | 2 | 2 |
| skill-sentinel | 0 | 1 | 1 |

## 阶段 × 资产矩阵（单元格 = routing/consumption）

| 阶段 | agent-research | agent-vision-toolkit | be-architect | be-provider | be-resilience | be-validator | colorize | dev-planner | frontend-design | frontend-visual-validation | implementation | planning | review | sdlc | security | skill-sentinel |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| unknown | 0/1 | 0/1 | 0/4 | 0/4 | 0/4 | 0/4 | 0/1 | 0/2 | 0/1 | 0/1 | 0/4 | 0/1 | 0/2 | 0/2 | 0/2 | 0/1 |

## 16 资产零调用清单

全部 16 资产均被读取过（无零调用）。

