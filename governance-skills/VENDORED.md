# VENDORED — governance-skills/（治理增强层）

| 字段 | 值 |
|---|---|
| 来源 | https://github.com/obra/superpowers（obra/superpowers） |
| commit | `5bf4e78011075bcfc0dc295f0724994cd123ee71`（v6.4.1，2026-09-18，浅克隆快照） |
| license | MIT（Copyright (c) 2025 Jesse Vincent）——原 LICENSE 随各 skill 上游仓库分发；本层顶部声明适用 |
| vendor 方式 | 2026-09-24 Owner 圈选后，从 AS-0 留档 clone 按目录快照拷贝（robocopy /E），未改任何文件 |
| 选品记录 | plans/superpowers-selection-v1.json（Owner 批准记录：3 选 2 缓，判定依据=能力缺口分析） |

## 层定位（Owner 裁定）

`governance-skills/` = **治理增强层（系统能力）**，独立于 16 业务资产注册表：
- 不进 CLUSTERS candidates、不进 asset-manifest-v2.json、不占 16 槽位；
- 业务能力（security/review/frontend/planning 等）走 vendor/ + 资产注册表；本层是 agent 行为规则（verification/debugging/TDD）；
- 类比：Linux 不是应用，是系统能力。

## 入选清单与绑定

| skill | 绑定阶段 | 激活时机 |
|---|---|---|
| verification-before-completion | verification | before_final_receipt |
| systematic-debugging | failure_recovery | gate_failed / regression_failed / migration_failed |
| test-driven-development | implementation | stage_7 或 migration shadow run 前 |

运行时消费接线（dispatch prompt/命令引用 skill 正文）为后续任务；deferred：writing-plans（reserve）、receiving-code-review（重叠）。

## 升级方式

git pull 换 pin + 本目录重新快照 + 本文件记录；vendored 文件永不手改。
