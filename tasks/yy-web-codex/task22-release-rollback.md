# task22｜M1 只读发布、kill switch 与回滚

状态：本地 kill switch smoke 通过：`YY_READONLY_ENABLED=false` 时 MCP server 拒绝启动（exit 2），旧 `scripts/summary-read.mjs --workspace .` 仍 exit 0；当前没有部署的 Web 暴露可停止，也没有真实服务停用、生产 W fingerprint 或干净环境装配演练。完整灾备为 P2，业务写迁移/恢复留待后续阶段。依据：PRD §20–22；AT-37–39、44–45、47–48。证据：`docs/yy-web/RELEASE-EVIDENCE-20260927.json`、`docs/yy-web/P2-P3-BACKLOG-20260927.md`。

## 交付与关联

- 交付只读入口版本清单、宿主兼容实测、kill switch、停止服务后的旧 CLI 回退证据及过期引用语义。M1 不做业务状态迁移、备份恢复演练或写面兼容发布。
- 前置：task11、task21 的实际 M1 结果。后续任何写面发布另需 task20 PASS 和独立授权。后置：task23。选型：关闭隔离只读服务即可回退，不修改 active store。
- 候选 seam：现有发布包/manifest、YY 状态存储和生产 M 配置；变更目标与回滚命令由阶段 5 锁定。

## GWT 验收

1. Given 干净环境与固定版本清单，When 装配并启用只读入口，Then双宿主版本兼容可核对，无本机临时依赖；过期 Skill 给明确提示。
2. Given 只读服务故障或 kill switch，When 停用，Then新只读工具不可调用，旧 YY CLI 仍可用，既有 W 不变。
3. Given 写面迁移或 job 场景，When M1 收口，Then这些验证明确为 `DEFERRED_BY_PHASE`，不能计入 M1 PASS。

停止条件：回滚无证据或旧状态可能丢失时，不扩大发布范围。
