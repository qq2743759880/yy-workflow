# task03｜身份、R/M/W 绑定与角色边界草案（M0）

状态：本地 `workflow_id → W` 静态绑定已实现；没有 Web caller principal 或 principal→workflow ACL，宿主共享前置仍未满足。M1 release blocker。依据：PRD §5、§11–12；AT-02–04、21、23、39 前置。证据：`integrations/yy-readonly-mcp/bridge.mjs`、`docs/yy-web/COMPATIBILITY-20260927.md`。

## 交付与关联

- 交付 principal、workflow、R/M/W 绑定、scope、只读/提案/执行能力与错误语义的候选合同及威胁模型。网页 GPT 只有 advisor/reviewer 角色，Owner 签权需要可验证的独立主体。
- 前置：task01 真实能力，task02 权威决策；后置：task04/06/08/12/16。选型：授权与路径解析在服务端稳定 seam 上一次完成，入口 Skill 和模型文本都不成为权限源。
- 调用面：复用现有 YY workspace/activation 语义及生产 M 的授权机制；协议字段与代码路径在阶段 5 冻结。

## GWT 验收

1. Given 用户获准访问 W-A 而未获准 W-B，When 按候选接口查询/提案 W-B，Then 服务端拒绝且响应不泄露 B 的目录、摘要或动作。
2. Given 请求把 R 路径当 W 或给出模糊别名，When 绑定 workflow，Then 要求显式合法绑定，绝不猜测业务工作区。
3. Given 模型文本自称 Owner 或日志夹带指令，When 请求审批/跨项目调用，Then 权限不提升；拒绝有审计线索和安全的用户说明。

停止条件：身份来源不可验证时只能继续本地只读探索，不冻结执行合同。
