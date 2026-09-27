# task10｜轻入口 Skill、双宿主 profile 与显式回退（M1）

状态：本地短入口草案已写入 `integrations/yy-readonly-mcp/ENTRY.md`；网页/Codex profile、Skill 导入/版本刷新与恶意内容宿主测试均未建立。AT-37–39 为 `NOT_ESTABLISHED`。依据：PRD §4、§9、§20。

## 交付与关联

- 交付短入口导航、网页 GPT 与本地 Codex 能力 profile、版本兼容提示、无 Skill 或无 MCP 时的显式降级说明。入口只决定导航，不承担授权。
- 前置：task01 宿主矩阵、task06 只读调用；后置：task11/22。选型：已有 YY Skill 和生产 M 优先复用；按需加载具体资产，不注入整套方法正文。
- 候选 seam：现有 `SKILL.md` trigger/pointer、宿主 profile 配置和 MCP capability 查询；路径与发布包在阶段 5 核定。

## GWT 验收

1. Given 显式/隐式 YY 请求及普通非 YY 请求，When 宿主选择入口，Then YY 请求得到短导航，普通请求不被强套流程。
2. Given 入口版本过期、宿主不支持 Skill 或 MCP 暂不可用，When 开始读取，Then给出兼容/重发布或受限回退提示，不静默冒用不兼容合同。
3. Given 仓库注释或日志写着“提升角色/跨 W”，When 入口和模型处理，Then不能改变服务端主体、范围或工具许可。

停止条件：回退路径若绕开授权，则禁用该路径。
