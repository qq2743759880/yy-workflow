# task16｜精确审批绑定与执行请求（M3）

状态：后续分门，未获实施授权。依据：PRD FR-10、§12–13；AT-21–24。

## 交付与关联

- 交付指定 template、inputs、write_scope、state_version、内容 hash、过期时间和 Owner 主体的执行请求门；有效授权只适用于同一对象与范围。
- 前置：task15 门通过，task02 ADR，M3 C4 合同冻结；后置：task17/20。选型：批准对象结构化并在服务端校验，不从自然语言或网页按钮推断 Owner 意图。
- 候选 seam：YY 现有签收/审批记录、生产 M 请求入口和授权主体；具体签名/凭据机制必须根据 task01 真实宿主能力决定。

## GWT 验收

1. Given 有效 Owner 对具体 template/inputs/W/版本签收，When 请求执行，Then仅该 hash 和 scope 可进入队列，其他状态不变。
2. Given 模型自报 Owner、网页只点“确认”或不同 W 的签收，When 请求，Then拒绝且无 job；拒绝原因可审计。
3. Given 签收后内容被改、版本变化或过期，When 请求同一模板，Then要求新授权，不沿用旧签收。

停止条件：不能证明主体、hash、scope 与有效期时写面保持关闭。
