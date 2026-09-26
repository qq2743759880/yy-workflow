# Asset Manifest v2 — Schema 定义（批 0，冻结面 contracts/）

> Schema 版本：`asset-manifest-v2@1.0.0`（冻结确认后进 manifest；后续增改走 evolution.propose）
> 变更单：contracts/discrepancies/cr-20260923T040000Z-av1schema.json（change.record，AV-1，CONTRACT 类）
> 适用范围：AV-2 manifest 生成器（数据源）、AV-3 activation 负向匹配、FE-5 资产卡渲染。

## Schema 定义（每行字段）

每行 JSON 对象，字段严格如下。AV-2 生成器输出每行必须通过字段齐全校验；缺必填字段 fail-closed 报 `CANDIDATE_INVALID`（与 evolution.propose 同口径）。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 资产标识符（小写连字符，与 vendor/<id>/ 目录及 CLUSTERS candidates 对齐） |
| `name` | string | 是 | 资产中文名/展示名（用于 journey 资产卡、kickoff 清单） |
| `role` | string | 是 | 资产角色定位（一句话；取自源文档头部既有结构化区） |
| `capability` | string | 是 | 核心能力描述（取自源文档 frontmatter `description`） |
| `cluster` | string[] | 是 | 所归属簇 id（T1_T5，来自 matrix.mjs CLUSTERS） |
| `when_to_use` | string[] | 是 | 正向激活条件（任务匹配到即推荐该资产） |
| `when_not_to_use` | string[] | 是 | 负向匹配条件（activation 负向匹配命中 → 该资产从本任务 candidates 剔除并在 debug 面留痕） |
| `verification` | string | 是 | 验收口径（S8 锚点 + 内核词机验；产物含什么、如何验证） |
| `source` | string | 是 | 源定位：`vendor/<id>/<file>.md#L<n>-L<n>`；指向源文档头部结构化区 |

## 提取源纪律（写死，违反即退回）

1. **提取源 = 每资产源文档头部既有结构化区**：`id`/`name`/`capability` 取自源文档 YAML frontmatter；`role` 取首段正文首句。
2. **缺源文档 → 手工补齐源文档，不允许生成器编造**：若 vendor/<id>/ 下无 SKILL.md 或 <id>.md，字段值标注 `CANDIDATE_INVALID`（缺字段 fail-closed 报 CANDIDATE_INVALID），不臆造 role/capability/source 行号。
3. **缺字段 fail-closed**：当 generator 提取到必填字段（id/name/role/capability/cluster/source）为空或行号无效 → 产出 CANDIDATE_INVALID 拒绝继续，与 evolution.propose 同口径。
4. **`when_to_use` / `when_not_to_use` / `verification`**：AV-1 阶段为 schema 定义位（字段在 schema 中占位），AV-2 生成器从资产源文档的"使用场景/限制/验证"章节提取内容；generator 提取为空字符串 → fail-closed CANDIDATE_INVALID，禁止以空串进 manifest。
5. **`when_not_to_use` 是新增能力**：activation 负向匹配命中 → 该资产从本任务 candidates 剔除并在 debug 面留痕（可解释、可探针）。

## AS 系列资产重组说明

AS 系列后续会 drop 7 资产（be-architect / be-resilience / be-provider / colorize / frontend-visual-validation / agent-vision-toolkit / agent-research，见 §三 drop 7 施工单）。**行数随资产重组变化，schema 不绑定 16**。本 schema 文档 16 行是当前批 0 冻结确认的数据基线；AS-2/AS-3 replace 与引入完成后、AS-1 drop 执行前重新冻结行数。

## 迁移说明

- 从 v1（无 schema）→ v2：16 资产全量重新提取三字段 + 基线行号定位，进入 `contracts/asset-manifest-v2.json`（manifest 消费端）。
- 变更单走冻结确认（CONTRACT 类 change.record，需 owner approval receipt），冻结后进 manifest。
- 后续增改不直接改 manifest 源文件，走 evolution.propose 重新生成（同 fail-closed 纪律）。
- manifest 消费端（`scripts/lib/asset.mjs`、`scripts/lib/activation.mjs`、`webview/journey/render-core`）按本 schema 字段读取；字段缺失时抛 CANDIDATE_INVALID 停止消费（不降级使用残缺数据）。

## 16 行 v2 数据（冻结确认基线；后续随 AS 重组调整）

> 提取源 = 每资产源文档头部既有结构化区（frontmatter + 首段）。缺字段的标注 CANDIDATE_INVALID。
> 实测口径：CLUSTERS candidates 去重 = 16 资产（T1 be-architect/implementation/be-validator/be-provider/sdlc；T2 同前+be-resilience/security/review；T3 be-provider/implementation/agent-research/be-validator/dev-planner；T4 frontend-design/frontend-visual-validation/agent-vision-toolkit/colorize/planning/review/security；T5 be-resilience/security/skill-sentinel/be-validator/review）。
> `when_to_use` / `when_not_to_use` / `verification` 在 AV-2 生成器上线后由其按 §提取源纪律 从源文档提取填充，当前为 schema 占位（`[]` / 空串表示待提取；generator 提取为空 → fail-closed CANDIDATE_INVALID，禁止以空值进 manifest）。

| id | name | role | capability | cluster | source |
|---|---|---|---|---|---|
| agent-research | Agent 科研技能集 hub | Agent 科研技能集（hub）——聚合 29 个科研子技能，供编排者在调研/论文/实验类任务中按需调用 | \|（frontmatter description 为多行 YAML literal；取首行"Agent 科研技能集集（hub）"） | ["T3_AI_RAG_MCP"] | vendor/agent-research/SKILL.md#L1-L8 |
| agent-vision-toolkit | vision-skills 五 CLI | vision-skills：五个本地视觉 CLI（glance/ground/detect/trace/crop + scripts/html_shot.py），给文本代理的眼睛 | \|（frontmatter description 为多行 YAML literal；取首行"Local vision CLIs"） | ["T4_FRONTEND"] | vendor/agent-vision-toolkit/SKILL.md#L1-L13 |
| be-architect | Backend Architect Agent | Backend Architect Agent：Node.js API 设计、Hono/Express 分层 | API design, resource modeling, route structure, middleware layering, and error strategy for Hono/Express backends | ["T2_BACKEND"] | vendor/be-architect/be-architect.md#L1-L5 |
| be-provider | Backend Provider Agent | Multi-provider LLM API adapters — streaming, token counting, cost tracking, rate limiting, graceful fallback | Multi-provider LLM API adapters — streaming, token counting, cost tracking, rate limiting, graceful fallback | ["T3_AI_RAG_MCP"] | vendor/be-provider/be-provider.md#L1-L5 |
| be-resilience | Backend Resilience Agent | Backend Resilience Agent：Circuit breakers, exponential backoff retries, timeouts, graceful degradation, health checks, bulkhead isolation | Circuit breakers, exponential backoff retries, timeouts, graceful degradation, health checks, bulkhead isolation | ["T5_OPS"] | vendor/be-resilience/be-resilience.md#L1-L5 |
| be-validator | Backend Validator Agent | Backend Validator Agent：Zod schemas, OpenAPI generation, RFC 9457 error responses, input sanitization | Zod schemas, OpenAPI generation, RFC 9457 error responses, input sanitization | ["T5_OPS"] | vendor/be-validator/be-validator.md#L1-L5 |
| colorize | colorize | Strategically introduce color to designs that are too monochromatic, gray, or lacking visual warmth and personality. | The feature or component to colorize (optional) | ["T4_FRONTEND"] | vendor/colorize/SKILL.md#L1-L10 |
| dev-planner | dev-planner | dev-planner：分析需求、拆解前后端任务、Given/When/Then AC、handoff spec；分解前挑战前提 | Analyzes feature requirements, breaks them into frontend/backend tasks, defines acceptance criteria in Given/When/Then format, writes handoff specs | ["T3_AI_RAG_MCP"] | vendor/dev-planner/dev-planner.md#L1-L5 |
| frontend-design | Frontend Design Cluster | Frontend Design Cluster：generation, taste, design data, component selection, prototyping | Unified frontend design cluster covering generation, taste, design data, component selection, and prototyping | ["T4_FRONTEND"] | vendor/frontend-design/SKILL.md#L1-L5 |
| frontend-visual-validation | 前端视觉验证 Skill | 前端视觉验证 Skill：截图 → 审查 → 修正 → 复测闭环（L0 像素 diff + L1 VLM 语义抽样） | Web 前端视觉验证闭环 — 启动 dev server、Playwright 截图、对照 tokens/规格审查、输出结构化视觉报告、驱动修正 | ["T4_FRONTEND"] | vendor/frontend-visual-validation/SKILL.md#L1-L5 |
| implementation | implementation | implementation：Unified implementation agent — 冻结契约与需求落地为可运行后端代码 | Unified implementation agent: turn requirements and frozen contracts into runnable backend code and land it in the repository | ["T1_DATABASE"] | vendor/implementation/implementation.md#L1-L5（无 YAML frontmatter，role 取首段首句） |
| planning | Planning Cluster | Planning Cluster：formal PRD + Vibe Coding PRD 生成（含四确认关卡） | Unified PRD and planning cluster for formal PRDs and Vibe Coding PRDs | ["T4_FRONTEND"] | vendor/planning/SKILL.md#L1-L5 |
| review | Review Cluster | Review Cluster：critique、自动验证、polish 三合一（qodo-ai/pr-agent + continuedev/continue 内核） | Unified review cluster for critique, automated verification, and polish | ["T5_OPS"] | vendor/review/SKILL.md#L1-L5 |
| sdlc | sdlc | SDLC BMAD + cline：PHASES = plan, develop, review, summarize；六 agent 控制/开发/对等/冲刺/总结/监督 | BMAD-METHOD phase orchestration with cline plan and exec execution | ["T2_BACKEND"] | vendor/sdlc/SKILL.md#L1-L5 |
| security | Security Cluster | Security Cluster：audit, hardening, backend security verification（semgrep + gitleaks 扫描内核） | Unified security cluster for audit, hardening, and backend security verification | ["T5_OPS"] | vendor/security/SKILL.md#L1-L5 |
| skill-sentinel | skill-sentinel | Skill Sentinel：Agent Skill 包安全扫描器（恶意模式/凭据泄露/C2 基础设施），插件市场/社区资产上线前审查 | Agent Skill 包安全扫描器。扫描 SKILL.md 中的恶意模式、凭据泄露、C2 基础设施，用于插件市场/社区资产上线前安全审查。触发：安装第三方 skill 前、社区资产审查、插件市场安全扫描 | ["T5_OPS"] | vendor/skill-sentinel/SKILL.md#L1-L5 |
| deep-research | deep-research（Dzhng） | dzhng/deep-research：全量 vendor 的科研门生成器（研究门 RG-1 直接调其循环） | CANDIDATE_INVALID（实测 vendor/deep-research/ 无 SKILL.md/<id>.md 头部结构化区——缺源文档，须先手工补齐源文档，禁止生成器编造） | ["T3_AI_RAG_MCP"]（注：deep-research 当前不在 CLUSTERS 16 资产内，为 RG-1 引入预留） | CANDIDATE_INVALID（待 AS-0 vendor 后补 #L?-L?） |

**`when_to_use` / `when_not_to_use` / `verification` 三字段**：本 schema 文档内暂记为空（`when_to_use: []` / `when_not_to_use: []` / `verification: ""`），表示"待 AV-2 生成器按 §1 提取纪律从源文档提取后替换为正式值"；generator 提取为空字符串 → fail-closed CANDIDATE_INVALID，禁止以空串进 manifest。

## Owner 签收位

| 项 | 值 |
|---|---|
| Schema 版本 | asset-manifest-v2@1.0.0 |
| 变更单 | cr-20260923T040000Z-1a2b3c4d（contracts/discrepancies/cr-20260923T040000Z-av1schema.json，CONTRACT 类） |
| 影响类别 | CONTRACT（变更触及冻结契约规范性内容；失效传播至 AV-2/AV-3） |
| Owner 签收状态 | 本文档不复制品 mutable 签收状态（split-brain 方案 B，第十四审计 F-031）：Owner 签收状态唯一权威 = contracts/discrepancies/cr-20260923T040000Z-av1schema.json（ownerSignOff 字段）；本文档只记录 changeRecordId，不复制 mutable status |
| Owner 备注 | 三字段（when_to_use / when_not_to_use / verification）采纳，R2 T3-04 A6 词汇缺口 + BW-3 模糊 prompt 缺口 |

## 变更历史

| 版本 | 时间 | 变更 | 变更单 |
|---|---|---|---|
| 1.0.0 | 2026-09-23 | 初始冻结（16 行 v2 数据 + 三字段定义 + 提取纪律 + AS-drop 声明）；走 AV-1 change.record | cr-20260923T040000Z-1a2b3c4d |
