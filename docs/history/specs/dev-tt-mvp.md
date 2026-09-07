# Feature: tt-mvp（TT 优化迭代 · MVP 专属拆解）

## 概述（개요）

本 spec 由 `dev-planner` 资产依据 `tt-together-agent-vibe-coding-prd.md` 的 **MVP 范围** 单独拆解。**MVP = Phase 0 编排骨架 + Phase 1 资产簇化(26→16) + Phase 2 三个高杠杆替换**，共 6 件事：

1. 编排内核（让 TT 能自主跑编排）
2. 契约冻结 gate（规范变强制校验）
3. 资产簇化 26→16（降维护面）
4. 实现簇 → opencode
5. sdlc → BMAD-METHOD + cline
6. be-validator → portman / contracteer

> 本 spec **仅含 MVP**。`ITERATION_PLAN.md` 中的 Next（其余 8 类资产替换）与 Later（竞品反哺 + SkillOps 闭环）**不在本 spec 内**，后续另立 spec。

## 任务分解（태스크 분해）

### Backend / 运行时（内核与集成，编码为主）

- [ ] **BE-1：编排内核脚手架（服务于 MVP-1）**
  - AC：Given 执行 `node scripts/orchestrator.mjs --task "<任务>"` 且任务非空，When 内核启动，Then 输出状态机日志 `idle→planning→executing→frozen→reviewing→done` 且不抛未捕获异常。
  - AC：Given 任务描述为空，When 调用，Then 输出「任务描述不能为空」并以非 0 退出，不生成计划。

- [ ] **BE-2：planner 路由 / 矩阵驱动（服务于 MVP-1）**
  - AC：Given `SKILL.md` 矩阵定义与 `vendor/` 清单，When 传入任务，Then 产出 `VendorManifest` 并路由到 T1–T5 中至少一个簇。
  - AC：Given planner 无匹配资产，When 路由，Then 输出「无匹配资产」并以非 0 退出。

- [ ] **BE-3：agent 运行时 + 上下文共享（服务于 MVP-1）**
  - AC：Given 一个含 ≥2 子任务的任务，When 内核派单，Then 子任务间可经进程内上下文共享状态（参考 claude-flow 范式），后序子任务能读取前序产物路径。

- [ ] **BE-4：契约冻结 gate（服务于 MVP-2）**
  - AC：Given 带契约/OpenAPI 的任务，When 子任务执行前后各跑一次 portman/contracteer 式校验，Then 一致输出 `pass`、不一致阻塞并输出 `diff`（不进入下一子任务）。

- [ ] **BE-5：接入 opencode（服务于 MVP-4）**
  - AC：Given MVP 任务含「实现代码」类子任务，When 内核派单，Then 实际调用 opencode CLI 产出代码文件到工作区，并在报告中标注产物路径。

- [ ] **BE-6：接入 BMAD-METHOD + cline（服务于 MVP-5）**
  - AC：Given 任务含「生命周期/规划」类子任务，When 内核路由命中 sdlc 簇，Then 按 BMAD phase + cline plan/exec 模式产出计划与执行记录。

- [ ] **BE-7：接入 portman / contracteer（服务于 MVP-6，并回写 BE-4）**
  - AC：Given be-validator 子任务，When 执行，Then 以 OpenAPI→契约测试方式运行，并将结果回写 BE-4 的 gate。

- [ ] **BE-8：回归校验（MVP 收口）**
  - AC：Given 任一 MVP 替换/重组完成，When 运行 `validate-structure.mjs` 与 SkillOps `sweep()`，Then 报告 `16/16 vendor`、`0 漂移`、`0 泄露`。

### Frontend / 资产层（skill 资产与文档，文件编辑为主）

- [ ] **FE-1：资产簇化 26→16 重组（服务于 MVP-3）**
  - AC：Given `ITERATION_PLAN.md` 附录 A 的 5 簇定义，When 重组 `vendor/`，Then 生成 16 个顶层簇目录，原 26 资产独有内容并入对应簇且不丢失功能。

- [ ] **FE-2：更新 SKILL.md §1c 与 validate 条目（服务于 MVP-3）**
  - AC：Given FE-1 完成，When 更新 `SKILL.md` 资产表与 `validate-structure.mjs` 的 `SKILL_ENTRIES`/`AGENT_ENTRIES`，Then `validate-structure.mjs` 报告 `16/16`、`0 泄露`。

- [ ] **FE-3：实现簇文档指向 opencode（服务于 MVP-4）**
  - AC：Given BE-5 接入完成，When 更新 dev-backend 与 be-implementer 资产说明，Then 文档明确实现内核=opencode 并附调用示例。

- [ ] **FE-4：sdlc 资产替换为 BMAD+cline（服务于 MVP-5）**
  - AC：Given BE-6 接入完成，When 改写 sdlc 资产，Then 其 SKILL.md 以 BMAD phase + cline plan/exec 模式组织且可被内核路由命中。

- [ ] **FE-5：be-validator 替换为 portman/contracteer（服务于 MVP-6）**
  - AC：Given BE-7 接入完成，When 改写 be-validator 资产，Then 说明以 OpenAPI→契约测试运行并接入 gate，附示例。

- [ ] **FE-6：README 使用说明 + `tt run` 示例（MVP 收口）**
  - AC：Given 内核与替换就绪，When 更新 README，Then 含 `node scripts/orchestrator.mjs --task "..."` 最小可运行示例与预期输出。

## 依赖（의존성）

- **基础链**：BE-1 → BE-2 → BE-3（内核三件套，必须先有派单能力）。
- **gate**：BE-4 依赖 BE-1（gate 挂在内核流程内）。
- **替换挂载**：BE-5/BE-6/BE-7 均依赖 BE-1（需先能派单）。
- **资产层**：FE-1 → FE-2（先重组再更新校验）；FE-3/FE-4/FE-5 依赖对应 BE-5/BE-6/BE-7。
- **收口**：BE-8 与 FE-6 依赖上述全部 MVP 任务完成。
- **外部可调用项**：opencode / BMAD-METHOD / cline / portman / contracteer 需本地可调用或被引用（许可需先核验，见风险 R1）。

## 风险（리스크，MVP 子集）

- **R1 许可可 vendored 性**：opencode/BMAD/cline 等许可是否允许 vendored 进私密 skill 包需先核验；缓解：仅引用其方法论/CLI 调用，不复制全部源码。
- **R2 gate 误报**：portman 式校验首版可能误判；缓解：先非阻塞告警，验证稳定后再转阻塞。
- **R3 合并丢功能**：26→16 可能丢某资产独有能力；缓解：合并前先 diff 各资产功能点并保留。
- **R4 宿主耦合**：orchestrator 若强依赖某宿主 API 会违背离线可用；缓解：内核只定义契约，模型/执行由宿主提供。

## MVP 完成定义（DoD）

- BE-1~BE-8 与 FE-1~FE-6 全部完成且 Given/When/Then 验收通过。
- 一次端到端任务能实际：路由 → 派单（调 opencode/BMAD/portman）→ 过契约 gate → 产出验收报告。
- `validate-structure.mjs` + `sweep()` 报告 `16/16`、`0 漂移`、`0 泄露`。
- 关键失败路径（空任务 / 无匹配 / 契约违约 / agent 失败）有明确提示且不产生脏数据。
