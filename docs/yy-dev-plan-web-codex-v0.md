# YY 网页 GPT × 本地 Codex 协作迭代：任务总纲 V0

> 阶段：`/yy 2` 任务拆分已完成；Owner 2026-09-27 最新指令授权在本 worktree 尝试完成 M0/M1 只读实现与验证；基线：`main@f88a193299d6939850befda8a21c8248e6285627`；规划分支：`codex/yy-web-codex-planning`。
> 上游：`docs/YY工作流迭代优化PRD-V0.md`（DRAFT，2026-09-27）；前提：`docs/YY工作流迭代优化-前提挑战-V0.md`（Owner 在本次对话确认 P1–P6 与概念基线）。
> P1–P6 已确认，M2/M3 仍未获实施授权。本地 M1 schema 是候选实现合同，尚无 Owner 的 API 冻结签收；外部 Web/auth/E2E 未建立时不得宣称可发布。旧 `docs/yy-dev-plan.md` 服务 2026-09-07 Owner-UX PRD，保留不覆盖。

## 设计文档前置链

- 独立 `docs/designs/`：当前未发现对应设计文档。PRD §4–5、§11–13、§21–22 已给出方案权衡、架构、契约草案、阶段和验收，足以支持本轮**任务级拆分**；M0 的 ADR 负责冻结实施选择。
- 选型：build-on 当前 `scripts/lib/{store,state,journey,activation}.mjs`、现有 adapter 与 local MCP FastMCP；禁止复制第二套 YY 状态机或 fork 第二份 local MCP。
- `Supersedes`：无。本计划与旧 Owner-UX 任务总纲是不同迭代。

## 目标与发布边界

让网页 GPT 和本地 Codex读取同一授权 workflow 的状态、阶段、资产与证据。首次发布只包含 M0 基线/契约准备和 M1 只读最小产品；M2 提案审阅、M3 受控执行是后续分别过门的任务库存。M4 的评测和发布控制可针对 M1 只读版本先执行，并在扩大能力后重做。M5 UI、通知、多租户和大规模调度不入本计划。不得重开 RF1 或自动执行旧 backlog。

## 需求前提挑战

`node scripts/tt-journey.mjs --workspace <本规划工作树> --prereq-check --step 3` 已返回 `prereq OK`。Owner 2026-09-27 对 P1–P6 逐条确认；概念签收仅授权规划。

| 问题 | 结论 |
|---|---|
| Q1 为什么现在 | Owner 报告手工搬运网页建议/本地结果，P01/P05 为直接需求；其它设计风险由 M0/M1 验证。 |
| Q2 现状代价 | YY 本地状态和工具已存在，网页仍靠通用读取与人工转述；时间和错误率尚未量化，M0 建立基线。 |
| Q3 窄楔子 | M0→M1：鉴权后的只读快照、阶段/资产/证据按需读取与轻入口；业务写、自动派单、新大型 UI 均不在首发。 |
| Q4 未来适配 | 同一 YY Core + 两种宿主 profile，后续提案/执行复用权威；方法强度以同条件评测裁定。 |

| 前提 | Owner 结论 |
|---|---|
| P1 独立新迭代，RF1 保持关闭，先用独立分支/工作树 | agree |
| P2 首发 M0→M1 只读，M2/M3 分门 | agree |
| P3 单一 YY Core 权威，local MCP 复用适配 | agree |
| P4 网页无 Owner 签权，Codex 可接受/修改/拒绝 | agree |
| P5 R/M/W 分离，业务写前核清全部写者与恢复 | agree |
| P6 按配对评测选方法强度，预算数值先当目标 | agree |

## 任务总纲

每个 `taskNN` 的完整前后置、候选写面、调用/复用路径和 Given/When/Then 见 `tasks/yy-web-codex/README.md` 的任务卡索引。表中“验收”是必须可观察的结果，不能靠报告自述代替。

| ID | 里程碑 / 可交付切片 | 前置（类型） | FR / 主验收 | GWT 验收摘要 |
|---|---|---|---|---|
| task01 | M0 固定 R/M/宿主基线和真实能力 | 无 | AT-45 | Given 当前部署，When 固定源码/账号/依赖，Then 每项有版本、可用性和 unknown 边界。 |
| task02 | M0 全写者清单与单一权威 ADR | task01 完成 | AT-25,47 前置 | Given 旧 CLI 与新入口并存，When 绘制写路径并故障推演，Then 决定串行/冲突/恢复策略。 |
| task03 | M0 身份、R/M/W 绑定、角色与接口边界草案 | task01 完成；task02 决策 | AT-02–04,21,23,39 前置 | Given 未授权 W，When 请求拟议工具，Then 服务端范围合同规定拒绝。 |
| task04 | M0 快照、证据、分页与预算合同草案 | task01/03 完成 | AT-10–15,48 前置 | Given 源变更或 critical 超预算，When 包装上下文，Then 合同规定完整性/版本/错误。 |
| task05 | M0 验收 oracle、配对评测和目标值冻结候选 | task01 完成 | AT-46 前置 | Given PRD 48 个 AT，When 建基线，Then requirement→真实调用→证据一一映射、阈值待 Owner 冻结。 |
| task06 | M1 授权 workflow 绑定与只读快照 | task02–04 契约 | FR-01、FR-02；AT-01–04,14,42 | Given 新会话，When 调 open/snapshot，Then 返回同源版本且不创建任务。 |
| task07 | M1 当前阶段卡与前置投影 | task06 完成 | FR-03；AT-05 | Given step/别名，When 查询阶段，Then 与现有 journey/phase 权威一致。 |
| task08 | M1 动态资产目录与执行可用性 | task06 完成；task03 契约 | FR-04；AT-06–09 | Given 内核缺失/覆盖不足，When 列资产，Then 候选仍可见且 blocked_reason 正确。 |
| task09 | M1 资产正文和证据的固定版本分页 | task06 完成；task04 契约 | FR-05、FR-06；AT-10–15,34–36,48 | Given 长行/源变，When 翻页，Then 摘要匹配且不混版、不假完整。 |
| task10 | M1 轻入口 Skill、双宿主 profile 和显式回退 | task01/06 完成 | AT-37–39 | Given 支持/不支持 Skill 的宿主，When 进入 YY，Then 只加载短导航并按需调用授权工具。 |
| task11 | M1 双宿主只读 E2E 与里程碑门 | task07–10 完成 | AT-01–15,30–39,42,48 适用读面 | Given 两个授权项目和一个未授权项目，When 真网页/本地读取，Then 状态、权限、RF1 历史/当前解释可复查。 |
| task12 | M2 版本化 proposal 提交 | task02/03 冻结；task11 完成 | FR-07；AT-16,18–20 | Given 旧版本/重复键，When 提交建议，Then 只写提案且冲突/幂等正确。 |
| task13 | M2 Codex disposition 与结构化 review | task12 完成 | FR-08；AT-17,40–41 | Given 有/无 finding，When 接受、修订或拒绝，Then 原提案与独立性记录保留。 |
| task14 | M2 提案/审阅增量游标与状态解释 | task12/13 完成 | UJ-02/05；AT-17–18 | Given 网页断线或游标过期，When 恢复，Then 读到增量或具名要求重取。 |
| task15 | M2 写者、旁路、权限与跨宿主门 | task12–14 完成 | AT-16–25,39–42 | Given 旧 CLI/通用写 API/伪 Owner，When 尝试越门，Then 拒绝或具名冲突且无业务推进。 |
| task16 | M3 精确审批绑定与执行请求 | task02/15 完成；执行合同冻结 | FR-10；AT-21–24 | Given 具体模板、输入、写面和有效签收，When 请求执行，Then 仅该版本可入队。 |
| task17 | M3 持久 job 状态、查询、租约与 fencing | task16 完成 | FR-09；AT-26–27,29 | Given 超时/旧 worker，When 查询或回传，Then 不重复执行且旧 owner 被拒。 |
| task18 | M3 受控 Worker→真实 YY adapter→回执 | task17 完成 | FR-10；AT-30–35 | Given 有效 OpenAPI capability，When 真执行，Then Spectral exec 消费用户合同且流程/验证分列。 |
| task19 | M3 取消、断网、UNKNOWN 恢复与写面开关 | task17/18 完成 | FR-11；AT-28–29,43–44 | Given 副作用后崩溃，When 恢复或取消，Then 不把 UNKNOWN 写成成功、不盲重跑。 |
| task20 | M3 网页请求→本地执行→网页回读 E2E | task16–19 完成 | AT-21–36,42–44,47 | Given 授权与失效/重放反例，When 跑真实链，Then 回执、证据、版本与关闭条件一致。 |
| task21 | M1 四组配对评测基线；能力扩展后复跑 | task05/11 完成；扩展评测另需 task20 | AT-46 | Given 同模型/工具/任务，When A/B/C/D 配对，Then 质量/成本/安全分报，证据不足写 NOT_ESTABLISHED。 |
| task22 | M1 只读发布、kill switch 与回滚 | task11/21 M1 结果完成；写面迁移/恢复留后续 | AT-37–39,44–45,47–48 的只读部分 | Given 只读服务故障，When 停用或回退，Then 旧 CLI 可用且 W 不变；写面场景记 DEFERRED_BY_PHASE。 |
| task23 | M1 Owner 只读操作说明与交付索引 | task21/22 的真实 M1 结果 | UJ-01–06；AT-42/44 的只读部分 | Given 新 Owner 接手，When 按说明绑定、查证、停用，Then 不需搬长报告且不误触执行。 |

## 依赖拓扑与首发范围

`task01 → {task02, task03, task05}; task03 → task04; {task02,task03,task04} → task06; task06 → {task07,task08,task09,task10}; {task07..10} → task11`。task02 的 ADR 必须在任何 M2 持久写前落实；task12 的第一次写本身就需验证旧写者不会覆盖。

首发候选：task01–11 + task21–23 中针对只读版本的评测、回滚和说明。task12–20 仍是**后续分门任务**，Owner 的概念签收不构成其派单批准。task21 从 M1 起可与 M2/M3 研究并行；涉及同一 core/state/MCP bridge 的写任务串行。没有估工期，等 task01/02 的技术切片后再估。

## 契约冻结顺序（当前均为候选，未冻结）

1. **C1 身份/绑定/权限**（task03）：principal→scope、R/M/W/workflow 绑定、请求错误码、readOnly 真实语义；先于 task06。
2. **C2 只读内容**（task04）：Snapshot/Stage/Catalog/EvidenceRef、source/payload digest、完整性与游标、预算与版本；先于 task06–09。
3. **C3 协作记录**（task02 ADR + task12）：proposal/review/disposition、expected_state_version、idempotency、旧写者并发；先于 task12 首次持久写。
4. **C4 授权作业**（task16/17）：approval 对象/hash/scope/expiry、job 状态、lease/fencing、取消与 UNKNOWN 恢复；先于 task16–19 真业务写。
5. **C5 执行结果映射**（task18）：execution_status、verification_status、coverage、evidence_refs、closeability，RF1 五场景同源回归；先于 task20。
6. **C6 评测与发布**（task05/21）：冻结 oracle、非劣界限和成本预算；首发与每次宿主/模型/工具变更前复核。

契约的机器冻结、审批、具体路径和版本号由 `/yy 3`（journey step 5）完成；本阶段只确定顺序与负责人。不得把 PRD 示例 JSON 当成已部署 schema。

## FR / AT 覆盖索引

| 需求 | 主任务 | 需求 | 主任务 |
|---|---|---|---|
| FR-01、FR-02 | task06 | FR-03 | task07 |
| FR-04 | task08 | FR-05、FR-06 | task09 |
| FR-07 | task12 | FR-08 | task13 |
| FR-09 | task17 | FR-10 | task16/18 |
| FR-11 | task19 | — | — |

| 验收编号 | 主归属 | 验收编号 | 主归属 |
|---|---|---|---|
| AT-01–04 | task06/11 | AT-05 | task07 |
| AT-06–09 | task08 | AT-10–15 | task09 |
| AT-16,18–20 | task12 | AT-17,40–41 | task13 |
| AT-21–23 | task16 | AT-24–25 | task02/15 |
| AT-26–27 | task17 | AT-28–29 | task19 |
| AT-30–35 | task18/20（M3 实际执行）；task09/11 只读核验历史 RF1 原始证据 | AT-36,48 | task09/11 |
| AT-37–38 | task10/22 | AT-39 | task10/11/15 |
| AT-42 | task06/11 | AT-43 | task19/20 |
| AT-44–45 | task22 | AT-46 | task21 |
| AT-47 | task02/22 | — | — |

AT-01–48 全部有主归属；表中的 M0 映射是**准备/冻结责任**，不是宣布后期场景已通过。实际 gate 用 `requirement ID → production caller → 原始证据 → 结果`，不沿用旧固定 PASS 数。

## 规划自审（CEO→Eng→Design）

独立报告：`docs/yy-plan-review-web-codex-v0.md`；完整 findings、处置及交互状态见该报告。

### CEO 范围自审

- Scope Mode：SCOPE REDUCTION（首发只保留 M0→M1 只读）；不做清单覆盖 PRD §2.3、§21 的 M5/多候选/大 UI/自动派单。
- Finding：把 M2/M3 与 M1 同批施工会把只读价值验证和高风险业务写捆绑，延误首个可用结果。
- 处置：task12–20 标记后续分门，不进入首发派单；task21–23 仅先覆盖只读发布。

### Eng 架构自审

- Finding：[P1] (confidence: 9/10) `scripts/lib/store.mjs:7` 与 `scripts/lib/state.mjs:115` — 现有 state 保存与 namespace 追加是不同写入口；若 M2 新 proposal 直接混写，旧 CLI 可能覆盖记录。
- 处置：task02 先盘点全部写者并冻结 ADR；task12 首次持久写以前实证隔离/串行，task15/20 覆盖旧 CLI 并发与通用写旁路。
- Shadow path：空/缺状态、读时变更、来源不可见、工具超时由 task06/09 具名返回。测试缺口是当前真实网页宿主与 local MCP 源版本，task01/11 负责实证。性能风险是首屏全文资产和重复工具 schema，task04/10 测最终 payload。

### Design 体验自审

- Finding：仅显示 `done` 会让用户把 RF1 的 `pass=null/degraded=true` 当作验证通过；仅显示“工具不可用”又会掩盖有定义但当前环境缺内核的资产。
- 处置：task06/08/09/11 分开显示流程、验证、定义、许可、内核、覆盖状态；LOADING/EMPTY/ERROR/SUCCESS/PARTIAL 均有文字解释和下一步。M1 不新建大型 UI，沿用宿主可读卡片；不能只靠颜色，具体无障碍规则留给真实 UI 任务（若后续另立）。

## 重要风险与停止条件

| 风险 | 对应任务 / 停止条件 |
|---|---|
| local MCP 真实源非 Git、宿主能力不明 | task01 固定 SHA/备份与兼容矩阵；无法核验时 AT 记 `ENVIRONMENT_UNAVAILABLE`，不假 PASS。 |
| 协作记录成为第二 workflow 真值 | task02/12 证明命名空间边界、状态版本和恢复；证明不足时不开放 M2 写。 |
| 通用写 API 或旧 CLI 旁路 | task15/20 证实服务端策略及冲突；无法封堵则停业务推进。 |
| critical 被截断或不同源拼页 | task04/09 返回具名 incomplete/source changed；不静默裁切。 |
| 发布方法使质量下降 | task05/21 预注册同条件实验；不足写 NOT_ESTABLISHED，只发布较小 profile。 |
| PRD 仍为草案 | task03/04/12/16 的接口需阶段 5 正式冻结；不得把本任务总纲当审批回执。 |

## 本阶段可判定完成条件

1. `task01`–`task23` 各有独立详细任务文档，含调用/复用路径、依赖、选型依据和全文 GWT。
2. FR-01–11 与 AT-01–48 无漏项，M1 首发和后续写面分界明确。
3. `node scripts/review-gate.mjs --plan docs/yy-dev-plan-web-codex-v0.md` 通过规划闸门；随后记录 journey step 3 `premise-signed`，不推进到契约冻结或派单。
