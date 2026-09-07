# 开工 prompt（由主 agent 唯一派生，每平台/每 agent 一份）

## 职责
（角色：开发/测试/调研 + 域 + 任务范围）

## 必读文档（路径引用，不复制内容）
- 任务文档: `$PROJECT_ROOT/.ai-hub/plans/tasks/taskNN-*.md`
- 契约: `$PROJECT_ROOT/.ai-hub/handoffs/taskNN-contract.md`（如有）
- 看板: `$MEMORY_ROOT/project-handoff.md`（只读自己行）
- 前置条件（编排计划 `plan.preconditions`，如有）: 开工前逐条核对——上游契约未冻结/上游产物未真实执行（无资产消费证据）时，如实上报等待，不得静默开工
- 批判追踪（硬约束，开工前必跑）: `node $SKILL_DIR/scripts/critique-backlog-next.mjs --task "<本任务关键词>"`（或 `--task-doc $PROJECT_ROOT/.ai-hub/plans/tasks/taskNN-*.md`）拉取 tracker 中「⬜ 待落地」C-xx 清单 + `docs/history/tasks/critique-<Cxx>-task.md` 摘要。**命中（HIT C-xx）= 本任务须承接的待优化执行项**：完工报告「批判承接核对」段必须逐条列完成证据；HIT_NONE = 无承接项（报告如实写"无承接项"）

## 当前任务
- taskNN + 精简 GWT 验收准则（≤200 token）

## 硬性守则
1. 只做本任务，完成必须等验收指令，禁止跳序/连做
2. 需要 skill/子 agent → 加载具名路径（`$AIHUB_ROOT/skills/<name>/SKILL.md` 或 `$SKILL_DIR/vendor/<name>/SKILL.md`），完工报告列实际调用证据
3. 越界不直改：需改对方文件 → 写 `handoffs/taskNN-discrepancy.md` 上浮
4. 前端任务：未收到用户 APPROVED 不得进入框架实现（Gate A）
5. **完工前自检（硬约束）**：按 `vendor/review/SKILL.md` critique 内核过一遍自己改动（交互态/边界/错误反馈三视角），发现问题先修再交；无发现如实写"自检无发现"

## 完工报告要求
- 按 `templates/completion-report.md` 写 `$PROJECT_ROOT/.ai-hub/test-reports/taskNN-completion-report.md`
- 只回传文件路径引用，不复制内容
- **必含「资产消费证据」段**：写实际读了哪个资产文件（具名路径）+ 产物锚点/内核词；未调用外部资产如实写"本次未调用外部资产"，禁止略过此段
- **必含「完工前自检」段**：critique 三视角发现与处置；无发现写"自检无发现"，禁止略过

---

# 按簇注入本 task 资产清单（通用段，全簇适用）

> 本段覆盖 T1-T5 全簇。任务经 `scripts/lib/matrix.mjs` CLUSTERS 路由后，按下表注入**本 task 所属簇**的 candidates 具名路径 + preconditions（与 matrix.mjs 逐条一致，不缩水不杜撰）。前端任务另需加载下方「T4_FRONTEND 专用开工 prompt」作为深化层。

## 域声明要求（agent 开工首行，硬约束）
开工首行必须声明：
- **域标签**：`本 task 属 <域>`（T1 数据库 / T2 后端 / T3 AI-RAG-MCP / T4 前端 / T5 运维；bug 修复按缺陷定位归属对应簇并标注 `bugfix`）
- **必用资产清单**：具名列出下方本簇 candidates 路径

未声明 → 验收抽查（`scripts/asset-call-rate.mjs` assetConsumed 字段）记 warning，并要求补充，不静默放行。owner 如需在 Prompt 指定资产，直接写「本 task 必须消费 <具名资产路径>」类指令即可被本清单承接（清单与 Prompt 用词同源）。

## 各簇 candidates + preconditions（数据源：matrix.mjs CLUSTERS）

### T1 数据库
candidates：`$SKILL_DIR/vendor/be-architect/be-architect.md`、`$SKILL_DIR/vendor/implementation/implementation.md`、`$SKILL_DIR/vendor/be-validator/be-validator.md`、`$SKILL_DIR/vendor/be-provider/be-provider.md`、`$SKILL_DIR/vendor/sdlc/SKILL.md`
preconditions：
1. be-architect 数据库 schema/数据契约产物须先冻结（contracts/\<planId\>.json 或 --contract），下游 implementation/be-provider 才开工
2. 每子任务产物须含资产消费锚点 + ≥1 内核词（D-1 机验，缺则 assetConsumed=false）

### T2 后端
candidates：`$SKILL_DIR/vendor/be-architect/be-architect.md`、`$SKILL_DIR/vendor/implementation/implementation.md`、`$SKILL_DIR/vendor/be-provider/be-provider.md`、`$SKILL_DIR/vendor/be-resilience/be-resilience.md`、`$SKILL_DIR/vendor/sdlc/SKILL.md`、`$SKILL_DIR/vendor/security/SKILL.md`、`$SKILL_DIR/vendor/review/SKILL.md`、`$SKILL_DIR/vendor/be-validator/be-validator.md`
preconditions：
1. be-architect 接口/错误契约产物须先冻结（contracts/\<planId\>.json 或 --contract OpenAPI），下游才放行
2. 实现类子任务须经 --exec 宿主真实执行，禁纯 prompt 兜底（requireExec）
3. 每子任务产物须含资产消费锚点 + ≥1 内核词（D-1）；上游 done 且 assetConsumed=true 后下游才派单

### T3 AI-RAG-MCP
candidates：`$SKILL_DIR/vendor/be-provider/be-provider.md`、`$SKILL_DIR/vendor/implementation/implementation.md`、`$SKILL_DIR/vendor/agent-research/SKILL.md`、`$SKILL_DIR/vendor/be-validator/be-validator.md`、`$SKILL_DIR/vendor/dev-planner/dev-planner.md`
preconditions：
1. 模型/工具选型契约（be-provider/agent-research 调研结论）须先产出冻结，implementation 后行
2. 每子任务产物须含资产消费锚点 + ≥1 内核词（D-1 机验）

### T4 前端
candidates：`$SKILL_DIR/vendor/frontend-design/SKILL.md`、`$SKILL_DIR/vendor/frontend-visual-validation/SKILL.md`、`$SKILL_DIR/vendor/agent-vision-toolkit/SKILL.md`、`$SKILL_DIR/vendor/colorize/SKILL.md`、`$SKILL_DIR/vendor/planning/SKILL.md`、`$SKILL_DIR/vendor/review/SKILL.md`、`$SKILL_DIR/vendor/security/SKILL.md`
preconditions：
1. 后端接口契约先冻结（FR-3：contractMode:'frozen'，缺契约 CONTRACT_NOT_FROZEN skip）
2. Gate A 用户 APPROVED + PARITY_CHECK 冻结 token 先于组件实现
3. 每子任务产物须含资产消费锚点 + ≥1 内核词（D-1 机验）

### T5 运维
candidates：`$SKILL_DIR/vendor/be-resilience/be-resilience.md`、`$SKILL_DIR/vendor/security/SKILL.md`、`$SKILL_DIR/vendor/skill-sentinel/SKILL.md`、`$SKILL_DIR/vendor/be-validator/be-validator.md`、`$SKILL_DIR/vendor/review/SKILL.md`
preconditions：
1. 加固/扫描产物（be-resilience/security/skill-sentinel）须先于验收子任务（be-validator/review）
2. 每子任务产物须含资产消费锚点 + ≥1 内核词（D-1 机验）

---

# T4_FRONTEND 专用开工 prompt（前端页面任务，FR-1/FR-2 强制化）

> 仅当任务经 `matrix.mjs` 路由到 `T4_FRONTEND` cluster 时使用本模板；其余 cluster 用上方通用模板。
> 强制加载 + 产出机验 + 一致性门三段均为硬约束，缺一不可。

## 必读资产（开工前必须加载，具名路径）
- `$SKILL_DIR/vendor/frontend-design/SKILL.md`（前端设计簇：Design Read → 三 dials → Pre-Flight Check 三步必做）
- `$SKILL_DIR/vendor/frontend-design/reference/taste-skill.md`（§14 FINAL PRE-FLIGHT CHECK，50+ 项矩阵）
- `$SKILL_DIR/vendor/frontend-design/reference/design-data/scripts/search.py`（ui-ux-pro-max 真实设计数据查询：风格/色板/字体）
- `$SKILL_DIR/vendor/frontend-design/reference/taste-blocks/`（9 个 ready-made 块：bento-grid/asymmetric-split 等）
- 设计规范: `$PROJECT_ROOT/.ai-hub/plans/doc-frontend-design-spec.md`（缺失先补规范，见 SKILL.md §6.5 硬 gate）

## 开工前必须完成的资产流程（§4 硬约束，非可选）
1. **Design Read**：先出一行 `Reading this as: <page kind> for <audience>, with a <vibe> language, leaning toward <system or aesthetic family>.`
2. **三 dials**：给出 `DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY`（基线 8/6/4，须从 brief 推断并说明理由）
3. **search.py 查真实数据**：选定风格/色板/字体前必须跑 `python search.py "<query>" --domain style|color|typography`，不手捏值
4. **Pre-Flight Check**：交付前逐项跑 taste-skill §14 矩阵（50+ 项），任一项不过 → 返工重跑

## 按契约写接口调用（FR-3，前端实现子任务硬约束）
> 仅当本任务包含「调用后端接口的实现」（接口层 / api-client / 页面数据获取）时执行；纯设计（frontend-design）/视觉校验（visual-validation）子任务不适用。
1. 开工前必须有**冻结契约**（`$PROJECT_ROOT/.ai-hub/handoffs/taskNN-contract.md` 或用户提供的 `--contract` OpenAPI 文件）；**缺契约不得开工接口实现**，如实上报「需先冻结后端契约/提供 --contract」，不得臆造。
2. 接口层产物（`api-client` / 类型定义 / fetch 调用）的**请求路径 / 请求参数 / 响应字段 / 错误码一律取自契约**，禁止臆造字段与路径大小写不符。
3. 接口层产物须标注所消费契约路径（如 `// contract: GET /api/xxx`），供 FR-4 契约变更检测交叉比对。
4. 契约仅为描述串（非可消费 OpenAPI）时，如实标注 degraded「契约不可真校验」，按字段清单实现并在报告说明，不假装可校验。

## 产出必含
- **资产消费锚点**：产物（HTML/组件/报告）必须含「消费了 frontend-design 资产」字样（锚点）
- **方法论内核词**：产物必须含 ≥1 个内核词（`shadcn` / `bolt.new` / `Pre-Flight`）——缺内核词会被判 `assetConsumed=false`
- **Pre-Flight 机验产物**：跑 `$SKILL_DIR/scripts/frontend-quality-gate.mjs <页面目录|文件> --out <report>.json`，输出机验 JSON 报告附完工报告；任一机验项不过（warning）→ 返工，不得进入 Gate B
- **一致性门（FR-2）**：HTML 原型 APPROVED（Gate A）后 React 实现前，须与冻结的 `design-tokens.json` 对齐；实现完成跑 `$SKILL_DIR/scripts/prototype-parity-check.mjs --proto <原型.html> --impl <实现> --out <report>.json`，tokenDiff 须为 0（截图接近度 Playwright 可用时 ≥ 1-threshold；不可用如实标注 SCREENSHOT_UNAVAILABLE）

## 硬性守则（前端附加）
1. 未收到用户 APPROVED 不得进入框架实现（Gate A）
2. Gate A 与 Gate B 之间必须过「原型→实现一致性门」（PARITY_CHECK 态），不一致返工
3. 禁止硬编码色值（hex 直写），一律引用冻结 token（`var(--...)` / design-tokens.json）
4. 踩 AI Slop 红线（SKILL.md §6.3 任一命中）→ 一票否决返工

## 完工报告要求（前端附加）
- 附 `frontend-quality-gate.mjs` 机验 JSON（或文件路径）
- 附 `prototype-parity-check.mjs` 一致性报告（或文件路径）
- 资产消费证据：锚点行 + 内核词 + 实际调用证据（search.py 查询记录 / taste-skill 流程声明）
