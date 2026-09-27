# plan-review-report

- plan: docs/yy-dev-plan-web-codex-v0.md
- 生成: 2026-09-27T10:32:46.723Z

## 执行顺序（CEO → Eng → Design，Design 收尾）

## CEO 范围视角

- Scope Mode：SCOPE REDUCTION。首个用户价值是网页和本地能读到同一授权 workflow 及可信证据；首发只含 M0→M1 与只读版本的评测/回退。
- 不做清单：M2 提案与审阅要先解决持久写一致性；M3 执行要另有 Owner 签权和 Worker 恢复；大型 UI、通知、多租户、大规模调度不解决首发读取问题，均延后。
- Finding：若把 task12–20 与 M1 同批放行，首次可用时间将被旧 CLI 并发写和业务授权风险拖住，也无法区分只读方案的效果。
- 处置：task12–20 保留为后续分门任务，不在首发派单；task11 对真实双宿主只读链给可判定门，task21 先评测 M1。

## Eng 架构视角

- Finding：[P1] (confidence: 9/10) `scripts/lib/store.mjs:7` 直接覆盖 `state.json`，`scripts/lib/state.mjs:115` 另有 namespace 追加入口。若 M2 在未盘点旧写者时持久化 proposal，旧 CLI 可能覆盖新记录。这是需要实验证明/排除的并发风险，当前未宣称已经复现。
- 处置：task02 绘制全写者与 ADR，在隔离副本做交错写、迁移失败恢复实验；task12 的首次持久写以实证无丢失为前提，task15/20 再用生产路径验证旧 CLI 和通用写旁路。
- Shadow paths：空/缺状态、并发源变、证据不可见和预算不足分别由 task06/09 返回具名结果；job 副作用后崩溃由 task17/19 的 UNKNOWN 与 fencing 处理。
- 覆盖缺口与性能：真实网页账号和生产 M 身份在 task01 核实，task11 跑真实 E2E；task04/10 测首屏 payload 与分页，不将全文资产注入入口。

## Design 体验视角

- Finding：用户容易把流程 `done` 看成验证 `pass`；RF1 的 `pass=null/degraded=true` 和 security 部分覆盖尤其容易被误读为通过。资产定义存在也可能被误读为执行内核可用。
- 处置：task06/08/09/11 分列流程、验证、定义、许可、内核和覆盖状态。真实宿主的只读卡片保留短文字与证据链接；不新增大型 UI。
- 交互状态：LOADING 显示“正在读取”和 workflow 范围；EMPTY 解释未有证据/候选；ERROR 显示权限、源变或超预算的具名错误与重试/重新绑定动作；SUCCESS 附版本和来源；PARTIAL 标出不完整文件与不可验收项。
- 视觉与无障碍：首发沿用宿主呈现，不引入装饰性卡片或颜色编码；状态词和下一步由文字表达。若后续开发独立 UI，再以文本对比度 ≥4.5:1、控件对比度 ≥3:1、命中区 ≥44px 和键盘操作做页面级验收。
