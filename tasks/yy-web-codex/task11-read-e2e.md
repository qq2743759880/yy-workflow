# task11｜双宿主只读 E2E 与 M1 门（M1）

状态：`WEB_ACTIVATION_ENVIRONMENT_BLOCKED`；未发现 tunnel-client/tunnel/workspace 配置、可证明的 Web principal、authenticated workflow ACL 或生产 W 绑定，浏览器清单请求失败。只读服务通过本地 stdio 合成测试不构成真实 Web E2E。依据：PRD UJ-01/03/05、§22；AT-01–15、30–39、42、48 的适用读面。证据：`docs/yy-web/COMPATIBILITY-20260927.md`、`docs/yy-web/RELEASE-EVIDENCE-20260927.json`。

## 交付与关联

- 交付真实网页 GPT 与本地 Codex 对两个授权 W、一个未授权 W 的调用回执、状态/证据比对和 M1 PASS/FAIL/ENVIRONMENT_UNAVAILABLE 表。RF1 历史与当前结果分辨。
- 前置：task07–10，task05 oracle；后置：task12、task21/22。选型：用实际生产调用核验而非模拟卡片；M1 只读复核历史 RF1 原始证据，AT-30–35 的新真实执行仍属 task18/20 的后续 M3 范围。
- 调用面：真实宿主→生产 M→YY Core；读取结果不写 W。证据原件与判定索引由 task05 口径保存。

## GWT 验收

1. Given 双宿主、两个授权项目与未授权项目，When 打开、查阶段/目录/证据，Then两宿主与 Core 同版，范围隔离、分页、错误及 read-only 无副作用均有原始调用证据。
2. Given RF1 旧失败与新结果，When 网页检索，Then显示 supersedes 和执行/验证分列；`done`、`pass=null`、`degraded=true` 不被显示为验证通过。
3. Given 实际网页账号或生产 M 不可用，When 跑门，Then对应项记 `ENVIRONMENT_UNAVAILABLE`，M1 不宣称端到端完成。

停止条件：任何未授权读取成功或读取触发状态写入，M1 门 FAIL。
