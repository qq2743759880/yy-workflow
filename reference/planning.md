# 附 A5：规划——矩阵 / 排序 / 契约冻结 / 开工 prompt（来源：SKILL.md §4，自包含可读）

> 本文件是 YY 规划阶段（闭环第 5 步）的权威说明（原 SKILL.md §4 迁移至此）。阶段 3（契约冻结）时读取。

本文规定工作产物与方法。阶段准入由 `decision-interface.md` 的 Core/V2 packet 决定；人工看板和 kickoff prompt 不能替代该准入。

- [task-agent-matrix](../templates/task-agent-matrix.md)：五类任务的当前资产候选，分类数据来自 CLUSTERS；不是必须派完的角色链。
- [orchestration-frontend-backend](../templates/orchestration-frontend-backend.md)：项目执行排序与契约检查示例，不能代替阶段 Decision 或任务批准。
- **后端职责**：按当前批准任务选择 implementation、security、review、be-validator 等资产；SDLC 仅用于明确批准 Heavy Profile。默认 DIRECT_HOST/HOST_NATIVE，manual 禁止自动执行，optional provider 与独立性规则见 [人工交接](manual-handoff.md)。
- **契约冻结（代码级，替代手工单点权威文件）**：orchestrator 将 plan 契约冻结为 `contracts/<planId>.json`；用户可用 `--contract <OpenAPI>.json` 提供可真校验契约本体（be-validator 走 portman 真验）。契约 = 下游开工前置：缺契约 → `CONTRACT_NOT_FROZEN` skip + 计划 failed（§5.1/§5.4，见 `reference/dispatch-and-acceptance.md`）；执行期被篡改 → exit 4。人工交接仅剩 `handoffs/taskNN-discrepancy.md` 越界上浮仲裁；**仅当使用外部 TTHP 协议包才沿用其 handoff 契约单文件格式**。
- `templates/kickoff-prompt.md`：给每个平台的整段开工 prompt（必读文档清单 + 当前任务 + 前置条件 + 硬性守则 + 完工报告要求）。
- **方法消费证据**：开工材料明确当前任务与批准的方法来源/固定身份；完工报告列实际产物、检查证据和未运行项。原生方法省略须匹配可信注册观测的 version/hash；同名 skill 不算证明。载入方法、产生 brief、运行工具、接受成果与方法应用认证分别记录，缺证据保持 UNVERIFIED，不能用文件存在冒充执行。
- **跨平台与独立验收**：内置固定方法统一来自当前声明的 `$SKILL_DIR/vendor/`，外部资料不自动替换 authority。主编排者按批准任务安排同级 Standards/Spec 等 review 义务；independence=required 缺可验证独立证据时不得接受。直接 HOST_NATIVE、手动交接和明确外部路径均复用现有准入，不要求每次无限派生子 agent，也不由“需要独立验收”推导派生权限。实际能力、批准权限和最终 budget/quota 门仍须满足。
- 人工任务看板（行状态的唯一事实源）：`$PROJECT_ROOT/plans/project-handoff.md`，状态 TODO/DOING/READY_FOR_FRONTEND/DONE/BLOCKED。**两种 READY**：`READY_FOR_FRONTEND`＝看板行状态；`READY 集`＝调度时判定的可并行集合；二者以"契约已验收"为共同前置。
