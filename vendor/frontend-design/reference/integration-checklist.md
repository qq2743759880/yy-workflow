# 前端联调适用性清单（frontend-design 生产资源）

**适用判定**：任务涉及真实 Web 应用（页面有真实后端交互）→ applicable；纯静态页/无后端 →
not applicable（不强造后端；仍走 L2 设计链 + 机检门）。

## 链路核对（applicable 时逐项）

页面动作 → 请求（method/参数/鉴权头）→ 后端响应 → 状态呈现，四段每段留证据指针：

| 状态面 | 核对项 | 证据形态 |
|---|---|---|
| loading | 请求在途的 UI 态（骨架/禁用/指示） | 代码位置+触发条件 |
| empty | 空数据集呈现（非报错） | 用例或 fixture |
| error | 非 2xx 呈现（含超时/网络失败） | 用例+错误契约引用 |
| auth | 401/403 呈现与跳转 | 用例 |
| schema mismatch | 响应与前端 schema 不符的降级 | 用例或契约 diff |

## 边界声明

- 本地 mock/fixture 只证明 fixture 链路成立，**不等于真实生产联调**——报告须区分两者。
- 原型审批与原型一致性沿用现有 Gate A / PARITY_CHECK 规则（T4 前置），本资源不重建。
- 后端行为本身的问题移交对应后端资产（be-validator/security），此处只核对呈现层契约消费。
