# 附 A1：变量与配置（来源：SKILL.md §0，自包含可读）

> 本文件是 YY 变量与配置的唯一权威说明（原 SKILL.md §0 迁移至此）。首次使用或换环境时读取。

## 变量表

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `$SKILL_DIR` | 本 skill 目录（SKILL.md 所在目录） | 内置资产根：`$SKILL_DIR/vendor/<name>/SKILL.md`、`$SKILL_DIR/templates/`、`$SKILL_DIR/scripts/` |
| `$AIHUB_ROOT` | 可选的外部资料目录 | 只供人工查阅；编排器的资产来源固定为 `$SKILL_DIR/vendor/`，不会按此变量替换同名资产 |
| `$PROJECT_ROOT` | 当前项目根 | 所有产物（plans/handoffs/reports）的落点 |
| `$PLATFORMS` | 由 `$SKILL_DIR/scripts/detect-platforms.mjs` 探测 | 可用平台列表与角色映射，可手工覆写 |

## 初始化

首次使用先跑 `node "$SKILL_DIR/scripts/detect-platforms.mjs" --json` 探测平台（只读输出）；需要固化时将结果中的 platforms 按 `config.example.json` 保存。跑 `node "$SKILL_DIR/scripts/validate-structure.mjs"` 确认结构。

`$SKILL_DIR` 和 `$PROJECT_ROOT` 是协议占位符，Agent 必须先解析为实际绝对路径，再执行命令；不依赖终端预设环境变量。当前目录可以是项目目录。

> **自包含说明**：本版本为自包含版，所有增强资产已随包置于 `$SKILL_DIR/vendor/`（共 9 个：6 个 skill + 3 个 agent，清单见 `reference/asset-integration.md`）。**无需任何外部 AI-Hub 即可离线使用**。资产替换须更改资产清单并重新验证，不能仅设置环境变量。

> 配置文件样例：`config.example.json`（自仓库根）；接入指引见 ONBOARDING.md。
## 部署位置（只选择 transport / 安装位置，不选择另一套阶段语义）

| 配置 | 默认 / 边界 |
|---|---|
| `YY_DECISION_ROOT` | MCP adapter 所在发行目录；可信运维可显式指定另一个完整、通过 manifests 校验的发行根 |
| `YY_DECISION_NODE` / `YY_READONLY_NODE` | V2 优先前者，再后者，再 PATH 的 node；M1 使用后者 |
| `YY_M1_AUTHORITY_ROOT` | 可信绝对位置；优先于 `runtime/m1-source.local.json`，未配置时读取随包根 `compatibility/m1-source/` |
| `runtime/m1-source.local.json` | 本机位置配置：`schema=yy/m1-source@1` 和绝对 `root`；不随包，不更改 M1 commit/tree/blob pins；非法值失败关闭 |
| `YY_READONLY_BINDINGS` / `YY_DECISION_BINDINGS` | 目标机可信 workflow registry；V2 优先前者。每条 binding 显式声明 scope 与 workspace；不复制旧机器注册 |
| `YY_READONLY_ENABLED` / `YY_DECISION_ENABLED` | 显式启用对应只读接口；目标机按已有 start script 配置 |

运行配置 / secrets / 绑定 / 缓存属于实例，不属于发行资产。包选择、Windows / 非 Windows 运维边界和依赖安装见 `../docs/directory-map.md`；OAuth 与隧道参数沿用 integration README 和既有 lifecycle。迁移不复制已执行任务的状态到另一项目。
