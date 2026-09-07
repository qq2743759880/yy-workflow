# TT-FRONTEND-PRD — 前端设计质变 + 前后端联调

- 版本：v1.0（2026-09-01 初版）
- 状态：概念版已用户确认，进入正式 PRD（TT §2.1 需求挖掘 gate 已完成）
- 基线：TT 2.6.0（已含自动拆解 M1、TUI M2、失败恢复/批判反哺/监控驱动），回归 8/8、validate 0
- 本阶段范围：三块全做——**质量门（FR-1/2）+ 前后端联调（FR-3/4/5）+ 视觉回归（FR-6）**；设计感（FR-7 ⚪ 下期或本期低优先）
- 优先级：**联调（FR-3/4/5）> 质量门（FR-1/2）> 视觉回归（FR-6）> 设计感（FR-7）**
- 节奏：先质量后设计感；落地形态：工作流内嵌；技术栈：跟随项目栈（不绑定）
- 范围外（下期）：FR-7 v0/shadcn 级组件规范 + Awwwards 级设计感

---

## 1. 需求来源

### 1.1 用户原话要点（对话确认结论）

| 项 | 内容 |
|---|---|
| 四目标（全做） | ① 反 AI-slop 合格（taste-skill 50+ Pre-Flight）② 产品级 UI（v0/shadcn 标准）③ 高水准设计感（Awwwards 级）④ 视觉回归自动化（Playwright + VLM） |
| 核心痛点（最痛） | **前端产出后编排者没及时与后端接口适配**——页面调用接口未就绪 / 契约变更无检测 / 无联调环节 / 无自动联调测试，导致交互和跳转逻辑 bug 滞后暴露 |
| 其余痛点 | 前端产出无强制检查（不强制跑质量门）；无视觉回归；frontend-design 资产没被消费；原型→实现断层（HTML 原型与 React 实现脱节） |
| 范围确认 | 三块全做：质量门 / 视觉回归 / 前后端联调；**优先级 联调 > 质量门 > 设计感**；原型→实现一致性门（推荐） |
| 落地形态 | 工作流内嵌（非独立工具链），前端任务进编排闭环必走 |
| 技术栈 | 跟随项目栈（不绑定）；Playwright 视觉回归 + VLM 语义审查（复用现有 frontend-visual-validation） |
| 诚实红线 | 现有能力标 ✅/◐，不夸大；PRD 不写本机绝对路径（validate 可移植性扫描）；GWT 可验证 |

### 1.2 需求挖掘 gate 结论（前置已确认，勿重测）

- TT 2.6.0 基线、回归 8/8、validate 0 已核实。
- 概念版（四目标 + 三块范围 + 优先级 + 原型一致性门）已用户确认，本 PRD 不再扩大范围。
- 现有能力不重复造：frontend-design 资产、visual-diff-pages、portman --contract、planner 契约先行、HTML 原型 gate §6 均以**改造/内嵌**为主。

---

## 2. 设计对齐

### 2.1 与现有 TT 架构的衔接（改造为主，不造轮子）

| 现有组件 | 本阶段如何衔接 |
|---|---|
| `vendor/frontend-design`（taste-skill 50+ Pre-Flight + ui-ux-pro-max search.py + 9 taste-blocks） | FR-1 前端任务开工 prompt 强制加载；FR-7 设计感增强的数据底座（taste-blocks + design-data 目录） |
| `vendor/frontend-visual-validation`（L0 像素 diff toHaveScreenshot + L1 VLM 语义抽样） | FR-2/FR-6 直接复用：原型↔实现接近度比对、前端任务完成必跑的视觉回归，改造为工作流内嵌强制项 |
| `scripts/visual-diff-pages.mjs`（git diff 驱动清单） | FR-6 L1 VLM 抽样范围事实源；纳入工作流必跑 |
| `scripts/lib/adapters/portman.mjs` + `orchestrator --contract`（be-validator 真跑 portman） | FR-3 前端按契约实现的契约来源（OpenAPI 实校验）；FR-4 契约 hash 基线 |
| `scripts/lib/planner.mjs` `buildPlan` + `runtime.mjs`（契约先行 + onStatus） | FR-3 缺契约不派前端实现（复用 CONTRACT_NOT_FROZEN 语义）；FR-4 契约变更级联失效（复用 gate.mjs snapshot/diffContracts） |
| `SKILL.md §6` HTML 原型 gate（Gate A 用户签收 → Gate B 技术验收） | FR-2 原型→实现一致性门挂在 Gate A 之后、Gate B 之前，不改变双 gate 语义 |
| `SKILL.md §4` 资产消费证据（D-1：锚点 + 内核词 → assetConsumed） | FR-1 质量门机验复用该指纹机制，追加 Pre-Flight 机验项 |

### 2.2 参考项目借鉴点（只借设计/对齐标准，TT 已自包含，不引依赖）

| 参考项目 | URL | 借鉴点（如何落到 TT） |
|---|---|---|
| `microsoft/playwright` | https://github.com/microsoft/playwright | 视觉回归/交互测试的浏览器基础设施事实标准；`toHaveScreenshot` 像素基线、`page.click/goto/submit` 交互断言；TT 的 L0 像素 diff 与 FR-5 联调交互测试均基于它（已随 frontend-visual-validation 存在，只作工作流内嵌改造） |
| `shadcn-ui/ui` | https://github.com/shadcn-ui/ui | 产品级 UI 组件规范参照（FR-7）；frontend-design 执行内核已声明以 shadcn 为组件底座，本阶段仅复用其规范，不引 npm 依赖 |
| `vercel/v0` | https://v0.dev | 设计感参照（FR-7，下期）；TT 不引其服务，仅作为设计产出对标参照物 |
| `percy` / `chromatic` | https://www.percy.io 、 https://www.chromatic.com | **明确不引入（决策记录）**：SaaS 视觉回归平台，走云端 diff 与团队工作流绑定；与 TT「本地自包含 + 契约/产物落盘 + 零外部服务依赖」冲突，详见 §5 C1 |
| `americanexpress/jest-image-snapshot` / `reg-viz/reg-suit` | https://github.com/americanexpress/jest-image-snapshot 、 https://github.com/reg-viz/reg-suit | 像素回归算法参考（已固化进 frontend-visual-validation 分层内核对标），不新增依赖 |

### 2.3 关键设计决策

1. **工作流内嵌（非独立工具链）**：质量门/联调/视觉回归均以「开工 prompt 强制 + 产出机验 + 验收门」形式挂进 TT 编排闭环（第 5/6/7 步），不新增独立平台入口。
2. **零外部服务**：不用 Percy/Chromatic 等 SaaS 视觉回归（数据不出本地、可离线、契约/产物落盘原则）；像素 diff 用 Playwright `toHaveScreenshot` 本地跑。
3. **playwright 依赖取舍**：仅当项目栈已含或可装 Playwright 时启用（跟随项目栈）；缺失时按诚实降级——L0 像素 diff 跳过并在报告标注 `L0_NOT_AVAILABLE`，L1 VLM 语义审查保留（Read 读图，零依赖），L0/L1 分层确保 token 受控。
4. **契约 = 前端开工前置**：前端实现任务开工前必须有冻结契约（`contracts/` 或 `--contract` OpenAPI），缺契约不派前端实现（复用并扩展 CONTRACT_NOT_FROZEN 语义，FR-3）。
5. **原型→实现一致性门（推荐采纳）**：HTML 原型批准（Gate A）后冻结设计 token/布局快照，React 实现后跑原型↔实现截图接近度比对（阈值可配），不一致返工（FR-2）。

---

## 3. 源码实况核对（改造点）

> 全部相对路径引用；行号为 2.6.0 基线实测值（本次只读核对，未改内核）。

### 3.1 现有事实（已核实）

| 位置 | 实况 | 对本阶段的意义 |
|---|---|---|
| `SKILL.md §6.1`（L241-252） | HTML 原型 gate：Gate A（用户审美签收，看板态 `HTML_APPROVED`）→ Gate B（技术验收，`REACT_DONE`）；**两个 gate 都过才真正完成**；§6.5 硬 gate「未 APPROVED 不派组件任务」 | FR-2 一致性门应插在 Gate A 与 Gate B 之间；现有双 gate 语义不动，只加「token/布局快照 + 接近度比对」环节 |
| `SKILL.md §6.3`（L261-265） | AI Slop 红线 12 条，**可自动校验**（硬编码 hex=0 / 通用字体=0 / 纯黑白=0 / 弹性缓动=0 / layout 动画=0，grep 机验） | FR-1 质量门机验项的直接基础：把「Gate B 必查」从纪律升级为脚本强制 |
| `SKILL.md §4`（L139、L192 D-1） | 资产消费证据：产物须含**锚点 且 ≥1 方法论内核词**才计 `assetConsumed=true`；开工 prompt 必须列具名 skill 路径；`regression-all` S8 断言 | FR-1「资产消费证据（锚点+内核词）」已有机验机制，改造 = 在 T4_FRONTEND 开工 prompt 强制加载 frontend-design + 验收时抽查 Pre-Flight 产物 |
| `scripts/lib/matrix.mjs`（L5） | `T4_FRONTEND` cluster：candidates `[frontend-design, frontend-visual-validation, agent-vision-toolkit, colorize, planning, review, security]`，phases 二维分组 | FR-1 强制加载的落点：开工 prompt 的资产加载清单以该簇为准；缺「Pre-Flight 机验」子任务 |
| `scripts/lib/planner.mjs` `buildPlan`（L21-41） | plan schema 事实源：`phase`/`dependsOn`/`contract`/`contractMode:'frozen'`（由 freezeContract 置）；`cluster.contract` 为描述串（如 `frontend interaction contract`） | FR-3 需扩展：前端实现子任务要求 `contractMode:'frozen'` 且契约文件存在（当前 T4 cluster 无真实 OpenAPI 契约，需在契约冻结时序中补「前端契约」） |
| `scripts/orchestrator.mjs`（L96-100、L158-170） | `--contract <openapi.json>`：文件必须存在；be-validator 子任务契约指向该文件（portman 真校验路径）；`freezeContract` 落 `contracts/<planId>.json` | FR-3 契约来源已存在；FR-4 契约 hash 基线 = `contracts/<planId>.json` 或 `--contract` OpenAPI |
| `scripts/lib/gate.mjs`（L26-35、L43-66） | `snapshot`（sha256 稳定化 JSON）、`diffContracts`、`before/after` 执行期 hash 比对（篡改 → ContractViolationError exit 4） | FR-4 契约变更检测直接复用 `snapshot`/`diffContracts`：前端实现前后对后端契约做 hash 对比，变更 → 受影响页面重新适配 + 标注 |
| `scripts/lib/runtime.mjs`（L158-168） | 契约先行硬校验：`contractMode:'frozen'` 缺文件 → `CONTRACT_NOT_FROZEN` skip + 计划 failed（exit 5）；`runGroup` 有 onStatus 钩子（L16-31） | FR-3 缺契约不派前端实现：复用该语义；FR-5 联调测试可作为 `T4_FRONTEND` 新 phase 子任务挂进计划 |
| `scripts/lib/adapters/portman.mjs`（L40-81） | be-validator 真跑 portman：`--local` lint/collection；提供 `mockBaseUrl` 时 `--runNewman --baseUrl <mock>` 真请求校验 | FR-5 联调的后端侧可复用：联调时用真实后端 baseUrl 起 newman 或 Playwright 交互测试 |
| `scripts/visual-diff-pages.mjs`（L12-35） | git diff 驱动页面清单（含 untracked 并入），输出 `DIFF_PAGES`；L0 全量像素回归 + L1 只审 diff 页 | FR-6 L1 抽样范围事实源已存在；改造 = 纳入工作流必跑 + 报告覆盖范围 |
| `vendor/frontend-design/reference/taste-skill.md`（L906 §14） | **FINAL PRE-FLIGHT CHECK** 50+ 项矩阵（含 em-dash 禁用 L695、CTA wrap ban L222、zigzag cap L248 等机验项） | FR-1 机验的检查表来源：可机验项（hex/字体/黑白/缓动/layout 动画/em-dash/CTA wrap）落脚本，主观项留 VLM/人工 |
| `vendor/frontend-design/SKILL.md`（L9-40） | 设计任务必做两步：① taste-skill 流程（Design Read → 三 dials → Pre-Flight Check）② `search.py` 查真实设计数据；Execution kernel = shadcn-ui/ui + bolt.new | FR-1 强制加载资产即此 SKILL；FR-7 设计感增强复用其 taste-blocks + design-data |
| `vendor/frontend-visual-validation/SKILL.md`（L11-22） | 分层执行：L0 像素 diff（toHaveScreenshot 全量，零 token）+ L1 VLM 语义抽样（diff 页 + 关键页，token 受控） | FR-6 直接复用该分层；改造 = 从「可用」升级为「前端任务完成必跑」并纳入验收 gate |

### 3.2 改造点清单

| # | 改造点 | 影响面 | 类型 |
|---|---|---|---|
| FE-1 | T4_FRONTEND 开工 prompt 强制加载 frontend-design + 完工报告强制列 Pre-Flight 产物 | `templates/kickoff-prompts.md` / `templates/orchestration-frontend-backend.md` | 改（prompt） |
| FE-2 | 新增前端质量门机验脚本：taste-skill §14 可机验项（hex/字体/黑白/缓动/layout 动画/em-dash/CTA wrap/zigzag）+ 资产消费锚点+内核词 | 新增 `scripts/frontend-quality-gate.mjs` | 新增 |
| FE-3 | 原型批准后冻结 design-tokens + 布局快照（供 React 复用），Gate B 前跑原型↔实现截图接近度比对（阈值可配） | 新增 `scripts/prototype-parity-check.mjs` + `SKILL.md §6.1` 改造 | 新增 + 改 |
| FE-4 | 前端实现子任务契约硬前置：开工前必须有冻结契约（`contracts/` 或 `--contract` OpenAPI）；kickoff prompt 要求按契约写接口路径/字段/响应壳 | `scripts/lib/planner.mjs` / `scripts/orchestrator.mjs` + kickoff prompt | 改 |
| FE-5 | 契约变更检测：前端实现完成后对比后端契约 hash（复用 gate.mjs snapshot/diffContracts），变更 → 受影响页面重新适配 + 标注（页面→契约路径映射表） | 新增 `scripts/contract-change-detect.mjs` + `scripts/lib/gate.mjs` 复用 | 新增 |
| FE-6 | 前后端联调自动测试：启动前后端 → Playwright 点击/跳转/表单提交 → 验证接口真实连通 → 输出联调报告；后端侧可选 newman（portman `--runNewman`） | 新增 `scripts/integration-e2e.mjs` + `T4_FRONTEND` 新 phase 子任务 | 新增 |
| FE-7 | 视觉回归工作流内嵌：前端任务完成必跑 L0（toHaveScreenshot 全量）+ L1（visual-diff-pages 清单），输出视觉回归报告并入验收 gate | `vendor/frontend-visual-validation/SKILL.md` 改造 + `T4_FRONTEND` 子任务 | 改 |
| FE-8 | 契约可用性检查（FR-3 前置支撑）：冻结契约须为可消费 OpenAPI（portman 可 lint / 字段齐全），描述串契约不满足前端按契约实现 | `scripts/lib/adapters/portman.mjs`（已有 isOpenApiSpec）+ kickoff prompt | 改（轻） |

---

## 4. 功能条目化

> 优先级：🔴 本阶段必修（联调）｜ 🟡 本阶段应做（质量门/视觉回归）｜ ⚪ 增强项（设计感）
> 验收一律 GWT（Given/When/Then）。

### FR-1 前端质量门强制化 🟡（先于 FR-2，紧随联调）

前端任务（T4_FRONTEND cluster）开工 prompt 强制加载 frontend-design 资产；产出强制跑 taste-skill Pre-Flight Check（50+ 项）机验，不过返工；资产消费证据（锚点 + 内核词）机验。

- **行为**：① T4_FRONTEND 开工 prompt 必须列出 `frontend-design` 具名路径并声明「Design Read → 三 dials → Pre-Flight Check」必做流程（§4 硬约束）；② 完工报告必须附 Pre-Flight 机验产物（`frontend-quality-gate.mjs` 输出）；③ 机验脚本跑 taste-skill §14 中可机验项（硬编码 hex / 通用字体 / 纯黑白 / 弹性缓动 / layout 动画 / em-dash / CTA wrap / zigzag cap）+ 资产消费锚点与内核词校验；④ 任一机验项不过 → 返工（跨平台切换返工循环），不得进入 Gate B。
- **降级**：前端项目非 Web（无 CSS/字体可查）或框架不可 grep 机验时，机验脚本明确标注 `N/A` 项并人工 review 兜底，不得假装通过。
- **GWT**：
  - Given 一个 T4_FRONTEND 页面任务派单；When 生成开工 prompt；Then prompt 必含 `frontend-design` 具名路径、Pre-Flight Check 必做声明，且完工报告模板含「Pre-Flight 机验产物 + 资产消费锚点/内核词」必填项。
  - Given 前端产出含硬编码 hex（非 token 引用）或通用字体或纯黑白；When 跑 `frontend-quality-gate.mjs`；Then 输出对应机验项 FAIL 与违规行号，验收判不通过 → 返工。
  - Given 前端产物声明消费了 frontend-design；When 验收抽查；Then 产物必须含 frontend-design 标题锚点 + ≥1 方法论内核词（如 shadcn/bolt.new/Pre-Flight），否则 `assetConsumed=false` 且报告 warning「加载了资产但未消费」。
  - Given 非 Web 前端项目；When 跑机验；Then 不可机验项标 `N/A` 并人工 review，报告如实标注覆盖范围，不伪造 PASS。
- **状态标注**：◐ 部分——资产消费证据（D-1 锚点+内核词）✅；AI Slop 可机验项已有纪律（§6.3）但未脚本化 ⬜；开工 prompt 强制加载 ⬜。

### FR-2 原型→实现一致性门 🟡

HTML 原型批准（Gate A）后，React 实现复用设计 token/布局，并跑视觉接近度比对（截图 diff 阈值），防止原型→实现断层。

- **行为**：① Gate A 通过时冻结 `design-tokens.json`（颜色/字体/间距/圆角，来自 frontend-design）+ 原型截图基线；② React 实现必须引用冻结 token（Grep 禁硬编码色值）；③ 组件完成后跑原型↔实现截图接近度比对（`prototype-parity-check.mjs`，可配像素 diff 阈值，如 ≤3% 差异）；④ 超过阈值 → 返工对齐，标 `FIX-R{n}` 并回读 AUDIT LOG。
- **GWT**：
  - Given HTML 原型已 Gate A APPROVED；When 冻结设计快照；Then 产出 `design-tokens.json` + 原型各视口截图基线，React 实现开工 prompt 引用该 token 文件。
  - Given React 实现完成；When 跑 `prototype-parity-check.mjs`（同视口截图 diff 原型 vs 实现）；Then 输出接近度（差异像素 %），≤ 阈值 PASS，> 阈值 FAIL。
  - Given 实现含硬编码色值（未走 token）；When Grep 机验；Then 列出违规行 → 返工替换为 token 引用。
  - Given 一致性 FAIL；When 返工后复测；Then 重新截图比对直至 ≤ 阈值，AUDIT LOG 记录轮次。
- **状态标注**：⬜ 待实现（HTML 原型 gate ✅ 已具备；token 冻结与接近度比对 ⬜）。

### FR-3 前端按契约实现 🔴（联调第一环）

前端任务开工前必须有后端冻结契约（`contracts/` 或 `--contract` OpenAPI）；前端页面按契约写接口调用路径/字段/响应壳；缺契约不派前端实现。

- **行为**：① 前端实现子任务要求 `contractMode:'frozen'` 且契约文件存在（复用 runtime.mjs CONTRACT_NOT_FROZEN 语义——缺契约 skip + 计划 failed）；② kickoff prompt 要求前端按契约字段（请求路径/参数/响应字段/错误码）写接口调用层与响应壳，禁止臆造字段；③ 契约须为可消费 OpenAPI（portman `--local` 可 lint / 字段齐全），描述串契约不满足前端按契约实现 → 提示先补 OpenAPI；④ 前端接口层产物（`api-client` / 类型定义）标注所消费契约路径。
- **GWT**：
  - Given 一个前端页面任务，后端契约未冻结；When 派单；Then 子任务 skip `CONTRACT_NOT_FROZEN`、计划 failed（exit 5），明确提示先跑后端契约冻结，不派前端实现。
  - Given 后端契约已冻结（`contracts/<planId>.json` 或 `--contract` OpenAPI，portman lint 通过）；When 前端开工；Then 接口调用路径/请求参数/响应字段/错误码均取自契约，接口层产物标注契约路径。
  - Given 前端实现中出现契约外字段或臆造路径；When 契约对照检查；Then 差异列为阻断项 → 返工或上浮 discrepancy 单（§4 越界不直改）。
  - Given 契约仅为描述串（非 OpenAPI 文件）；When portman 判定（isOpenApiSpec=false）；Then 标注 degraded「契约不可真校验」，前端按契约实现降级为「按字段清单实现」并在报告如实说明。
- **状态标注**：◐ 部分——契约先行/冻结机制 ✅（freezeContract + runtime CONTRACT_NOT_FROZEN）；前端按契约实现（路径/字段/响应壳）⬜；T4 簇契约硬前置 ⬜。

### FR-4 契约变更检测 🔴（联调第二环）

前端实现完成后，对比后端契约 hash；契约变更 → 前端受影响页面重新适配 + 标注。

- **行为**：① 维护「前端页面 → 契约路径」映射（页面接口层标注所消费契约路径，FR-3④产出）；② 前端完成后跑 `contract-change-detect.mjs`：对每个被消费契约做 hash 快照对比（复用 gate.mjs `snapshot`/`diffContracts`）；③ 变更 → 列出受影响页面清单 → 重新适配（字段/路径/错误码）+ 标注 `ADAPTED-契约变更-{日期}`；④ 重适配后再跑 FR-5 联调测试确认连通。
- **GWT**：
  - Given 后端契约文件在部署后内容变化（如字段改名/路径变更）；When 跑 `contract-change-detect.mjs`；Then 输出受影响页面清单 + 契约 hash 前后值，变更页标为需重适配。
  - Given 受影响页面已重适配；When 验收；Then 页面接口层与最新契约字段/路径一致，标注 `ADAPTED`，并重跑 FR-5 联调测试 PASS。
  - Given 契约未变更；When 跑检测；Then 输出「无契约变更」，不触发重适配。
  - Given 契约变更但前端未适配仍声称完成；When 验收核对映射表；Then 判不通过 → 返工适配（跨平台切换返工循环）。
- **状态标注**：◐ 部分——契约 hash 机制 ✅（gate.mjs snapshot/diffContracts 已存在）；「页面→契约路径」映射与变更后重适配流程 ⬜。

### FR-5 前后端联调自动测试 🔴（联调第三环，最痛项）

前端完成后启动前后端，自动跑页面交互测试（Playwright 点击/跳转/表单提交）验证接口真实连通，输出联调报告。

- **行为**：① 前端 React 组件完成（Gate B 前置视觉门通过）后启动前后端服务（跟随项目栈：前端 dev server + 后端 API）；② `integration-e2e.mjs` 用 Playwright 对每页跑核心交互流：点击 → 跳转 → 表单提交 → 断言接口真实返回（非 mock）；③ 后端侧可选 newman（portman `--runNewman`）对契约做真实请求校验，与页面交互互为印证；④ 输出联调报告：每页交互流 / 接口连通状态 / 失败明细（HTTP 状态、断言失败、跳转错误）；⑤ 失败 → 返工修复，联调报告全 PASS 才进看板 `DONE`。
- **降级**：后端无法启动（外部依赖缺失）→ 联调测试标记 `INTEGRATION_BLOCKED` 并如实说明阻塞原因，不伪造 PASS；mock 与真实后端边界见 §5 C3。
- **GWT**：
  - Given 前端页面实现完成且后端服务可启动；When 跑 `integration-e2e.mjs`；Then 每页核心交互流（点击/跳转/表单）真实执行，接口调用返回预期数据，输出含每页 PASS/FAIL 的联调报告。
  - Given 页面调用一个未就绪接口（404/字段不匹配）；When 交互测试执行到该步；Then 该页 FAIL 并记录具体接口路径 + 错误，验收判不通过 → 返工修复或上浮后端。
  - Given 后端无法启动（阻塞）；When 跑联调；Then 报告标注 `INTEGRATION_BLOCKED` + 阻塞原因，不伪造 PASS。
  - Given 联调报告全页 PASS；When 验收；Then 前端任务可置看板 `DONE`（Gate B 通过），报告归档 `test-reports/`。
- **状态标注**：⬜ 待实现（Playwright 基础设施 ✅ 已随 frontend-visual-validation；前后端启动编排 + 交互断言 + 联调报告 ⬜）。

### FR-6 视觉回归自动化 🟡

L0 像素 diff（toHaveScreenshot 全量）+ L1 VLM 语义抽样（visual-diff-pages 清单）纳入工作流，前端任务完成必跑。

- **行为**：① 前端任务完成时强制跑 L0：全量页面 × 视口集合（375/768/1024/1280/1440）`toHaveScreenshot` 像素基线比对（基线仅规格改变时更新，禁止为通过盲目覆盖）；② 强制跑 L1：`visual-diff-pages.mjs` 清单 + 关键页进 VLM 语义审查（Read 读图，布局/遮挡/审美/AI-slop）；③ 输出视觉回归报告（L0 覆盖全量 N 页、L1 抽样 M 页 + 关键页 K）；④ L0/L1 结果并入 Gate B 验收，FAIL 返工。
- **降级**：项目无 Playwright（零依赖原则）→ L0 跳过并标注 `L0_NOT_AVAILABLE`，L1 VLM 保留（Read 读图零依赖），报告如实标注覆盖缺口。
- **GWT**：
  - Given 前端任务声称完成；When 验收；Then L0 全量像素回归 + L1 diff 页语义审查均执行，报告含 L0 覆盖页数 / L1 抽样页数与关键页数。
  - Given 某页像素 diff 超阈值（与基线不一致）；When L0 跑完；Then 该页列「像素回归违背」，无需 VLM 复核即判 FAIL → 返工。
  - Given diff 页中某页有语义问题（如元素重叠/遮挡/AI-slop）；When L1 VLM 审查；Then 列出具体语义违背 → 返工修复后复测。
  - Given 项目无 Playwright；When 验收；Then 报告标注 `L0_NOT_AVAILABLE` 且 L1 VLM 审查照常执行，不伪造 L0 PASS。
- **状态标注**：◐ 部分——分层策略与方法论 ✅（frontend-visual-validation SKILL + visual-diff-pages.mjs）；「前端任务完成必跑」工作流内嵌与验收 gate 强制 ⬜。

### FR-7 设计感增强 ⚪（下期或本期低优先）

v0/shadcn 级组件规范 + Awwwards 级设计感（依赖 frontend-design 现有 taste-blocks + ui-ux-pro-max 数据）。

- **行为**：① 沉淀项目组件规范（shadcn 底座 + 自定义 token 扩展，参考 frontend-design component-selection）；② 高水准设计感产出复用 9 taste-blocks（bento-grid/sticky-scroll-stack/asymmetric-split 等）+ design-data（style/color/typography 目录）数据决策；③ 每页产出对标 Awwwards 级参照物（可选，不引外部服务）。
- **GWT**：
  - Given 需要产品级组件；When 选型；Then 走 frontend-design component-selection（shadcn 基线），项目栈支持才引，不无依据引组件库。
  - Given 页面设计感不足（非 AI-slop 但平庸）；When 增强；Then 复用 taste-blocks 与 design-data 数据决策（真实样式名/色板/字体），产出含设计 Read 声明。
  - Given 设计感增强完成；When 验收；Then 不破坏 FR-1/FR-2 质量门与一致性门，回归 8/8 不破。
- **状态标注**：◐ 部分——taste-blocks（9 个）+ design-data 目录（79 styles/192 palettes/74 font pairings）✅ 已随 frontend-design；组件规范沉淀与 Awwwards 级产出 ⬜ 下期。

---

## 5. 批判审查（默认假设非最优）

> ≥3 条，含竞品对标与证据 URL。审查结论已回灌至 §2/§4。

### C1 为什么不用现成视觉回归平台（Percy / Chromatic）？

**假设**：Percy/Chromatic 是视觉回归行业标准，接上就省事。
**批判**：Percy（SaaS，云端 diff + 快照托管）与 Chromatic（Storybook 生态，提交级 UI 审查）都依赖云端账号/配额/团队工作流，快照数据离本地上传；TT 的原则是「自包含、离线可用、契约/产物/证据落盘」（§0b/§1c），视觉回归数据同样应落本地 `test-reports/` 可审计。且二者绑定各自框架生态（Chromatic 强绑 Storybook），与「跟随项目栈、不绑定」冲突。Playwright 自带 `toHaveScreenshot`（pixelmatch 算法）+ L1 VLM 本地读图，已覆盖「像素 diff + 语义审查」两层，无需外部服务。TT 零外部服务的收益（可离线、可审计、无配额）远大于省掉的接入成本。
**证据**：https://www.percy.io 、 https://www.chromatic.com 、 https://github.com/microsoft/playwright
**结论**：不引入（已在 §2.2/2.3 决策 2 锁定）。

### C2 契约先行够不够？前端如何真正「按契约消费」契约？

**假设**：后端契约冻结 + 前端开工时读契约 = 前端按契约实现完成。
**批判**：契约先行（§4/§5.1）解决的是「时序」——前端不早于契约开工；但**消费深度**未定义：前端可能只读了契约描述就臆造字段、路径大小写不符、错误码不齐。契约先行 + 真实 OpenAPI 实校验（portman `--local`/`--runNewman`）+ 前端接口层产物标注所消费契约路径 + FR-4 hash 变更检测，才能形成「冻结 → 消费 → 变更 → 重适配」闭环。若只冻结不验证前端消费，契约先行退化为「前端迟开工但照样错」。规范上参照 OpenAPI Codegen 生态（openapi-generator 生成前端类型），TT 不引其运行时，仅借鉴「类型/字段从契约生成而非手写」这一做法到 kickoff prompt 与接口层产物要求。
**证据**：https://openapi-generator.tech 、 https://github.com/OpenAPITools/openapi-generator
**结论**：契约先行是必要非充分；补「可消费 OpenAPI 硬门槛 + 前端接口层契约路径标注 + 契约 hash 变更检测」（FR-3/FR-4，已在 §4 锁定）。

### C3 联调自动化在真实项目的边界：mock 与真实后端如何取舍？

**假设**：前后端联调测试应当总能起真实后端跑真实接口。
**批判**：真实后端可能依赖数据库/第三方服务/认证，CI 或本地环境未必能完整启动，强行真实联调会高频假失败（flaky），导致「联调测试形同虚设」或「为通过而跳过」。业界做法是分层：契约测试（portman/newman 对 mock baseUrl）→ 集成测试（真实后端 + 可控依赖，如 testcontainers 起依赖）→ E2E（真实全栈）。TT 应采用同构边界：后端不可起 → `INTEGRATION_BLOCKED` 诚实降级（不伪造 PASS）；可起 → 真实接口连通断言（FR-5）；契约本身合法性用 portman mock 路径兜底。绝不把 mock 当真实联调证据（诚实红线）。
**证据**：https://testcontainers.com 、 https://www.portmanhq.com
**结论**：mock 只用于契约校验兜底，联调连通性必须以真实后端为证；不可起时如实降级（FR-5 降级路径已含）。

### C4 Playwright 依赖与 TT 零依赖原则冲突如何取舍？

**假设**：引入 Playwright 破坏 TT「零依赖、可离线」内核。
**批判**：TT 的零依赖约束针对**编排内核本身**（orchestrator/planner/runtime 不引 npm 包，validate 校验），而非禁止执行宿主工具。Playwright 是**执行期浏览器基础设施**，与 portman（已直用竞品，§1 竞品直用策略）同级——属「跟随项目栈」的执行依赖，非内核依赖。若项目栈无 Playwright（前端项目缺浏览器测试），应诚实降级（L0 `NOT_AVAILABLE`、L1 VLM 零依赖保留），而不是给内核强塞依赖。此边界在 §2.3 决策 3 与 FR-6 降级路径已明确：依赖进「执行层」，不进「内核层」。
**证据**：https://github.com/microsoft/playwright 、 https://github.com/martylamb/allinpay-b2b-payment（对比：竞品直用均走执行层）
**结论**：Playwright 走执行层依赖（竞品直用），内核保持零依赖；缺失时诚实降级（决策 3 已含）。

---

## 6. 状态标注

| 能力 | 状态 | 说明 |
|---|---|---|
| HTML 原型 gate（Gate A/B + AUDIT LOG） | ✅ 已具备 | `SKILL.md §6`，2.6.0 |
| AI Slop 红线 + 可机验项纪律（§6.3） | ✅ 已具备（纪律） | 硬编码 hex/字体/黑白/缓动/layout 动画 grep 机验；未脚本化 ⬜ |
| 资产消费证据（D-1：锚点 + 内核词 → assetConsumed） | ✅ 已具备 | `SKILL.md §4` + regression S8 |
| 视觉验证基础（L0 像素 diff + L1 VLM 语义抽样） | ✅ 已具备 | frontend-visual-validation SKILL + visual-diff-pages.mjs |
| 契约机制（冻结/`--contract`/gate hash 比对/portman 真跑） | ✅ 已具备 | freezeContract + gate.mjs + portman.mjs |
| 契约先行（CONTRACT_NOT_FROZEN skip + 计划 failed） | ✅ 已具备 | runtime.mjs |
| 前端质量门强制（FR-1） | ⬜ 待实现 | 开工 prompt 强制加载 + 机验脚本（§6.3 升级） |
| 原型→实现一致性门（FR-2） | ⬜ 待实现 | token 冻结 + 截图接近度比对 |
| 前端按契约实现（FR-3） | ◐ 部分 | 契约先行 ✅；前端消费契约（路径/字段/响应壳）+ T4 契约硬前置 ⬜ |
| 契约变更检测（FR-4） | ◐ 部分 | hash 机制 ✅；页面→契约映射 + 重适配流程 ⬜ |
| 前后端联调自动测试（FR-5） | ⬜ 待实现 | Playwright 基础设施 ✅；联调编排/交互断言/报告 ⬜ |
| 视觉回归工作流内嵌（FR-6） | ◐ 部分 | 分层方法论 ✅；「任务完成必跑」gate 强制 ⬜ |
| 设计感增强（FR-7） | ◐ 部分 | taste-blocks + design-data ✅；组件规范/Awwwards 产出 ⬜ 下期 |

---

## 7. 里程碑 / 风险 / 验收

### 7.1 里程碑

| 里程碑 | 范围 | 出口条件 |
|---|---|---|
| **M1 质量门 + 原型一致性** | FR-1 + FR-2 | T4_FRONTEND 开工 prompt 强制加载 frontend-design；产出跑 Pre-Flight 机验，不过返工；原型批准后 token 冻结 + 实现截图接近度比对可用；`node scripts/regression-all.mjs` 8/8 PASS；validate 0 泄露 |
| **M2 前后端联调** | FR-3 + FR-4 + FR-5 | 前端开工必有冻结契约（缺契约不派）；契约 hash 变更检测 + 受影响页重适配；前后端启动后 Playwright 交互测试全页 PASS 出联调报告；回归 8/8 不破 |
| **M3 视觉回归** | FR-6 | L0 全量 + L1 抽样纳入工作流，前端任务完成必跑、结果并入 Gate B；报告含 L0/L1 覆盖范围；回归 8/8 不破 |

### 7.2 风险

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | Playwright 依赖引入（项目栈无 / 安装失败） | L0 像素回归不可用，Gate B 被拖累 | 依赖走执行层（竞品直用），缺失时 L0 标 `L0_NOT_AVAILABLE` 降级，L1 VLM（Read 读图）零依赖保留（FR-6 降级）；不把依赖塞进内核 |
| R2 | 前端按契约实现的契约可用性（描述串/字段不全/无法 lint） | 前端「按契约」无从谈起，契约先行退化为时序摆设 | portman `isOpenApiSpec` + `--local` lint 硬门槛（FR-3 GWT4）；描述串契约明确降级标注，不假装可校验 |
| R3 | 联调测试稳定性（真实后端依赖外部/认证/数据导致 flaky 假失败） | 联调测试形同虚设或为通过而跳过 | 分层边界：mock 只兜契约校验，连通性以真实后端为证；后端不可起 → `INTEGRATION_BLOCKED` 诚实降级（FR-5 降级）；契约层用 newman mock 兜底（C3） |
| R4 | 质量门机验误杀（非 Web 项目/自定义框架不可 grep） | 有效产出被误判返工 | 机验脚本对不可机验项标 `N/A` + 人工 review 兜底（FR-1 降级），报告如实标注覆盖范围 |
| R5 | 契约变更频繁导致前端重适配返工循环 | 迭代成本上升 | 页面→契约路径映射表 + 变更影响面最小化（只重适配受影响页）；变更与重适配均标注（FR-4）；适配后强制重跑 FR-5 确认连通 |

### 7.3 验收总纲

1. **回归门**：M1/M2/M3 完成后 `node scripts/regression-all.mjs` 均 8/8 PASS（S1 validate 0 警告 0 泄露、S4 契约工作流、S5 宿主执行、S8 资产消费证据等）。
2. **功能门**：FR-1～FR-7 的 GWT 逐条通过（见 §4），优先级 联调 > 质量门 > 视觉回归 > 设计感。
3. **可移植性门**：本 PRD 及全部新增/修改文件不含本机绝对路径（validate 可移植性扫描 0 命中）。
4. **诚实门**：现有能力 ✅/◐ 如实标注；mock 不当真实联调证据；L0/L1 覆盖范围如实上报；`INTEGRATION_BLOCKED`/`L0_NOT_AVAILABLE`/`N/A` 降级均如实标注，不伪造 PASS。

---

## 8. 修订记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v1.0 | 2026-09-01 | 初版：需求来源（§2.1 已确认：四目标/三块范围/联调最痛/优先级）、设计对齐（复用 frontend-design + visual-diff-pages + portman --contract + planner 契约先行 + §6 HTML gate）、源码实况核对（2.6.0 实测行号 + 8 条改造点）、FR-1～FR-7（含 GWT，联调 FR-3/4/5🔴 > 质量门 FR-1/2🟡 > 视觉回归 FR-6🟡 > 设计感 FR-7⚪）、批判审查 4 条（含 URL，Percy/Chromatic/openapi-generator/testcontainers/portman/playwright）、状态标注（✅/◐/⬜）、里程碑 M1/M2/M3 + 5 条风险 + 4 项验收 |
