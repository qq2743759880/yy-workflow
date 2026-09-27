# task01｜固定 R/M/宿主基线与真实能力（M0）

状态：部分完成。依据：PRD §3、§4、§18、§22；AT-45。R/M 版本与 M 非 Git 来源摘要已记录；宿主/干净环境恢复仍为 `NOT_ESTABLISHED`。证据：`docs/yy-web/BASELINE-MANIFEST.json`、`docs/yy-web/COMPATIBILITY-20260927.md`。

## 交付与关联

- 交付 R（YY 项目）、M（当前生产 local MCP）、W（获授权业务工作区）及网页 GPT/本地 Codex 的版本、源码摘要、部署/账号能力、安装依赖和恢复来源清单。确认哪一份 MCP 是生产源；未证实的路径标 `UNKNOWN`。
- 前置：无。后置：task02–05；task10/11 使用实际宿主能力矩阵。选型：先核实已有 FastMCP 和 YY Core，优先复用生产部署，不从临时副本重建。
- 调用面：只读查询 YY Git、manifest、MCP 版本/备份与两宿主实连能力；本任务不改业务状态。候选记录位置 `docs/`，具体清单路径由执行阶段定。

## GWT 验收

1. Given 当前实际部署及两个宿主，When 核查每项版本/来源/可用工具/权限，Then 清单逐项有来源、时间、摘要、可复现查询与未知边界，网页账号限制单列。
2. Given MCP 源不在 Git，When 固定基线，Then 保存可核对的文件摘要与备份恢复步骤；不能证明生产来源时标 `ENVIRONMENT_UNAVAILABLE`，不宣称 AT-45 通过。
3. Given 干净环境，When 依据清单重建，Then 仅用清单依赖可恢复只读调用；外部凭据不可获得时记录阻塞点，不伪造实测。

停止条件：生产 M 身份或网页连接不可证实时，task11 的对应真实 E2E 保持 blocked。
