# task06｜授权 workflow 绑定与只读快照（M1）

状态：本地六工具切片/合成 W 隔离与无副作用测试通过（15 项 suite 直接命中 `server.py` / `bridge.mjs`）；真实授权 W、Web caller 授权、terminal CLOSED 重读及 AT-14 并发版本验证未建立。Web 激活环境为 `WEB_ACTIVATION_ENVIRONMENT_BLOCKED`。依据：PRD FR-01、FR-02、§12；AT-01–04、14、42。证据：`docs/yy-web/RELEASE-EVIDENCE-20260927.json`。

## 交付与关联

- 交付 `yy_open_workflow` / `yy_get_snapshot` 的实际只读调用与可读状态投影；返回 workflow、项目、版本、delta、阻塞、允许动作与验证状态，但读取绝不创建任务、批次或执行请求。
- 前置：task02–04 的 C1/C2 契约冻结；后置：task07–11。选型：由 YY Core 的状态与 journey 构造同源快照，MCP 是薄适配，避免复制流程状态机。
- 候选实现 seam：现有 `scripts/lib/state.mjs`、`journey.mjs`、生产 M 的 FastMCP 工具注册；具体文件由阶段 5 核定。

## GWT 验收

1. Given 已授权的两个独立 W，When 各自 open 并 snapshot，Then项目、阶段、版本和 Core 原值一致，跨 W 不串数据。
2. Given 未授权 W、R 被误当 W 或快照时并发写，When 调用，Then分别得到拒绝、绑定错误或一致性错误；无目录泄露、不返回混合版本。
3. Given 已关闭 workflow，When 网页反复读取，Then只返回其最终快照，不新建批次/作业；流程完成与验证通过分列。

停止条件：同源版本或无副作用无法证明时，不开放 M1 页面级入口。
