# 附 A5：规划——矩阵 / 排序 / 契约冻结 / 开工 prompt（来源：SKILL.md §4，自包含可读）

> 本文件是 YY 规划阶段（闭环第 5 步）的权威说明（原 SKILL.md §4 迁移至此）。阶段 3（契约冻结）时读取。

- `task-agent-matrix.md`：任务×agent 链×skill×workflow×MCP 全表（按平台角色分配），含 **T1 数据库 / T2 后端 / T3 AI-RAG-MCP / T4 前端 / T5 运维** 五类任务链。
- `orchestration-frontend-backend.md`：执行排序总表 + **契约冻结机制**（①~⑭ 闸门）。
- **后端任务链**：T2 由 `be-architect`（契约）→ implementation（sdlc/develop 实现）→ security/be-resilience 加固 → be-validator/review 独立验收；sdlc 为工程主干。详见 `templates/task-agent-matrix.md`。
- **契约冻结（代码级，替代手工单点权威文件）**：orchestrator 将 plan 契约冻结为 `contracts/<planId>.json`；用户可用 `--contract <OpenAPI>.json` 提供可真校验契约本体（be-validator 走 portman 真验）。契约 = 下游开工前置：缺契约 → `CONTRACT_NOT_FROZEN` skip + 计划 failed（§5.1/§5.4，见 `reference/dispatch-and-acceptance.md`）；执行期被篡改 → exit 4。人工交接仅剩 `handoffs/taskNN-discrepancy.md` 越界上浮仲裁；**仅当使用外部 TTHP 协议包才沿用其 handoff 契约单文件格式**。
- `templates/kickoff-prompt.md`：给每个平台的整段开工 prompt（必读文档清单 + 当前任务 + 前置条件 + 硬性守则 + 完工报告要求）。
- **skill/子 agent 强制调用检查（硬约束）**：①开工 prompt 必须列**具名 skill 路径 + 具名子 agent**，禁止"按需调用"空话 ②完工报告必须列**实际调用证据** ③验收抽查 skill 产物，"加载了 skill 但没跑工具"= 违规 ④代码级强制：产物须含资产消费证据（`assetConsumed` 指纹），缺失 → warning；`regression-all` S8 断言 exec 子任务全 true。
- **跨平台资产调用策略（防幻觉）**：其他平台调用本工作流时优先用已部署竞品或 TT 资产更优者（见 `reference/asset-integration.md` 竞品直用策略）；TT 资产在方法论差异化场景保留（`$SKILL_DIR/vendor/`），不得用平台自有同名 skill 冒充。验收抽查：子任务 `artifactPath` 须指向 `$SKILL_DIR/vendor/` 产物或竞品真实调用证据（CLI/库实际执行），仅文档声明冒充 = 违规。**独立子 agent 派单硬约束**：执行任务必须先派独立子 agent（task / claude -p / codex exec / openclaw agent），编排者不得自写自验（C-01）；网络失败降级时必须诚实记录 + 仍须独立验收。
- 看板（唯一事实源）：`$PROJECT_ROOT/plans/project-handoff.md`，状态 TODO/DOING/READY_FOR_FRONTEND/DONE/BLOCKED。**两种 READY**：`READY_FOR_FRONTEND`＝看板行状态；`READY 集`＝调度时判定的可并行集合；二者以"契约已验收"为共同前置。