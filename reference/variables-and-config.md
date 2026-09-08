# 附 A1：变量与配置（来源：SKILL.md §0，自包含可读）

> 本文件是 YY 变量与配置的唯一权威说明（原 SKILL.md §0 迁移至此）。首次使用或换环境时读取。

## 变量表

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `$SKILL_DIR` | 本 skill 目录（SKILL.md 所在目录） | 内置资产根：`$SKILL_DIR/vendor/<name>/SKILL.md`、`$SKILL_DIR/templates/`、`$SKILL_DIR/scripts/` |
| `$AIHUB_ROOT` | 可选覆盖：环境变量或 `config.json`，默认 `~/.ai-hub` | 若你拥有完整 AI-Hub 资产中心，可设此变量优先引用外部 skill；否则一律使用随包内置的 `$SKILL_DIR/vendor/` 副本 |
| `$PROJECT_ROOT` | 当前项目根 | 所有产物（plans/handoffs/reports）的落点 |
| `$MEMORY_ROOT` | `$AIHUB_ROOT/memory`（未设 `$AIHUB_ROOT` 时可用 `$SKILL_DIR/memory`） | 记忆中心（分区见 `reference/memory-and-sync.md`） |
| `$PLATFORMS` | 由 `$SKILL_DIR/scripts/detect-platforms.mjs` 探测 | 可用平台列表与角色映射，可手工覆写 |

## 初始化

首次使用先跑 `node $SKILL_DIR/scripts/detect-platforms.mjs` 探测平台，结果写 `config.json`；跑 `node $SKILL_DIR/scripts/validate-structure.mjs` 确认本 skill 结构完整。

> **自包含说明**：本版本为自包含版，所有增强资产已随包置于 `$SKILL_DIR/vendor/`（共 16 个：10 个 skill + 6 个 agent，清单见 `reference/asset-integration.md`）。**无需任何外部 AI-Hub 即可离线使用**；若你想用自己 AI-Hub 中的同名 skill，设 `$AIHUB_ROOT` 后本 skill 会优先引用外部版本。

> 配置文件样例：`config.example.json`（自仓库根）；接入指引见 ONBOARDING.md。