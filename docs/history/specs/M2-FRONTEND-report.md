# M2-FRONTEND 里程碑报告 — 前后端联调（FR-3 / FR-4 / FR-5）

- 日期：2026-09-02
- 基线：TT 2.6.0（回归 8/8、validate 0）
- 实现范围：FR-3（前端按契约实现）+ FR-4（契约变更检测）+ FR-5（前后端联调自动测试）
- 优先级落地：FR-5 > FR-3 > FR-4

---

## 文件清单

| # | 文件 | 操作 | 职责 |
|---|------|------|------|
| FE-5 | `scripts/contract-change-detect.mjs` | 新增 | FR-4 契约变更检测：复用 gate.mjs `snapshot` 稳定化 hash；扫描前端页面引用的契约路径，与 OpenAPI `paths` 交叉 → 受影响页面清单 + 建议重适配；`--record` 更新 baseline；报告 JSON+MD |
| FE-6 | `scripts/integration-e2e.mjs` | 新增 | FR-5 前后端联调：启动前后端（spawn 跟随项目栈）→ Playwright 交互流（goto/click/fill/submit/expect-response，断言接口真实返回）→ 后端侧可选 newman/portman 真实请求互为印证 → 报告 JSON+MD；诚实降级（INTEGRATION_BLOCKED exit 2 / E2E_NOT_AVAILABLE） |
| FE-4 | `scripts/lib/planner.mjs` | 改 | 新增 `FRONTEND_IMPL_ASSETS` + `isFrontendImplementation()`；`buildPlan` 对 T4_FRONTEND 前端实现子任务标 `contractRequired:true` |
| FE-4 | `scripts/orchestrator.mjs` | 改 | 新增 `applyFrontendContractGate()`：freezeContract 后对前端实现子任务按真实契约裁决——有 `--contract` OpenAPI（或 contracts/<planId>.json 为 OpenAPI）→ 指向它（contractMode:'frozen' 派单）；无真实契约 → 指向缺失路径 → runtime `CONTRACT_NOT_FROZEN` skip + 计划 failed（exit 5）+ 提示提供 `--contract` |
| FE-4 | `templates/kickoff-prompt.md` | 改 | T4_FRONTEND 模板补「按契约写接口调用（FR-3）」段：开工前必须有冻结契约、接口层路径/参数/响应字段/错误码一律取自契约、接口层标注所消费契约路径、描述串契约如实降级 |

### 设计说明（FR-3 契约门落点）

- **不破坏现有非实现子任务**：契约门只作用于「调用后端接口的实现」子任务（资产 `implementation`，且处于前端上下文：cluster=`T4_FRONTEND` 或任务文本命中前端关键词）。`frontend-design`/`frontend-visual-validation`/`colorize` 等设计/视觉子任务不要求契约。
- **T4 簇现状（诚实标注）**：`matrix.mjs` 的 `T4_FRONTEND` candidates 当前不含 `implementation` 资产，故常规前端任务路由下没有「调用后端接口的实现」子任务可门控——契约门机制已实现（planner 标记 + orchestrator 裁决），在当前 matrix 下对该类子任务处于就绪态。
- **可验证性**：通过 `--plan --draft`（前端任务 + 含 `implementation` 子任务）真实驱动契约门，正反两路径均已实测（见 FR-3 GWT）。
- **exit 5 语义**：`EXIT.FAILED=5`；`CONTRACT_NOT_FROZEN` 令 `plan._contractMissing` → `executePlan` 置 failed → orchestrator 返回 5。

---

## GWT 逐条验收

### FR-3 前端按契约实现（契约硬前置）

| GWT | 结果 | 证据 |
|-----|------|------|
| Given 前端页面任务，后端契约未冻结；When 派单；Then 子任务 skip `CONTRACT_NOT_FROZEN`、计划 failed（exit 5），明确提示先跑后端契约冻结/提供 --contract，不派前端实现 | ✅ | `--plan --draft` 前端任务 + `implementation` 子任务、**无 --contract** → 日志：`FR-3 contract gate applied: 1 个前端实现子任务按契约前置（无真实契约，缺契约将 CONTRACT_NOT_FROZEN skip，请提供 --contract）`；`subtask skipped: CONTRACT_NOT_FROZEN（契约未冻结: contracts\plan-xxx.frontend-missing.json）`；**exit=5** |
| Given 后端契约已冻结（--contract OpenAPI）；When 前端开工；Then 接口调用路径/参数/响应字段/错误码取自契约，接口层产物标注契约路径，前端按契约派 | ✅ | 同 draft + **`--contract openapi.json`** → 日志：`FR-3 contract gate applied: 1 个前端实现子任务按契约前置（契约=...openapi.json）`；state.json 确认 `contract=...openapi.json`、`contractMode=frozen`、`status=done`（已派单，非 skip）；**exit=0**。kickoff-prompt.md §FR-3 要求接口层产物标注所消费契约路径 |
| Given 契约仅为描述串（非 OpenAPI 文件）；When portman 判定；Then 标注 degraded「契约不可真校验」，前端按契约实现降级并按字段清单实现，报告如实说明 | ✅ | `applyFrontendContractGate` 用 `isOpenApiSpec()`（openapi/swagger 字段）判定，冻结文件/描述串均不满足 → 走缺契约降级（skip + 提示 --contract），不假装可校验；kickoff-prompt §FR-3.4 声明描述串契约如实降级 |
| Given 前端实现出现契约外字段/臆造路径；When 契约对照检查；Then 差异列阻断项 | ◐ | 对照机制就绪（FR-3 kickoff §4 + FR-4 交叉比对可捕获引用路径漂移）；字段级 diff 依赖 FR-4/评审，非本里程碑独立脚本 |

### FR-4 契约变更检测

| GWT | 结果 | 证据 |
|-----|------|------|
| Given 后端契约部署后内容变化；When 跑 contract-change-detect.mjs；Then 输出受影响页面清单 + 契约 hash 前后值，变更页标需重适配 | ✅ | 契约 v1 → v2（新增 `/api/orders`）→ 日志：`契约已变更（hash 103e... → 0bbae...），受影响页面 1 个，需重适配`；报告列 `js/api.js 引用 /api/login` + 建议重适配；**exit=1** |
| Given 受影响页面已重适配；When 验收；Then 页面接口层与最新契约一致，标注 ADAPTED，重跑 FR-5 联调 PASS | ◐ | 报告已给重适配建议（ADAPTED-契约变更-{日期} + 重跑 integration-e2e）；字段级一致性靠评审，重适配执行属流程 |
| Given 契约未变更；When 跑检测；Then 输出「无契约变更」，不触发重适配 | ✅ | 同一契约二次检测 → `changed=false`，`无契约变更（hash 与 baseline 一致），不触发重适配`；**exit=0** |
| Given 契约变更但前端未适配仍声称完成；When 验收核对映射表；Then 判不通过 → 返工 | ◐ | `contract-change-detect.mjs` exit=1（变更）可作为验收阻断信号；返工流程依赖编排层，非脚本独立判定 |

### FR-5 前后端联调自动测试

> 环境说明（诚实）：本机 **Playwright 执行层不可用**（`require.resolve('playwright')` 失败），**newman/portman 可用**（npm 全局）。故页面交互流按诚实降级标 `E2E_NOT_AVAILABLE`，后端侧以 **portman `--runNewman --baseUrl <真实后端>`** 对真实后端做真实 HTTP 请求验证连通（非 mock）。已构造最小前后端实测。

| GWT | 结果 | 证据 |
|-----|------|------|
| Given 前端实现完成且后端可启动；When 跑 integration-e2e.mjs；Then 每页交互流真实执行，接口返回预期数据，输出含每页 PASS/FAIL 的联调报告 | ◐ | 最小前后端：后端 `node server.js`（真实返回 JSON，POST `/api/login` → `{token,user}`）、前端 `node static.js` serve `index.html`（页面 fetch 真实后端）。跑通：frontend=UP、backend=UP、**newman 真实请求 PASS**（连通真实后端非 mock）；页面交互流因 Playwright 缺失标 `E2E_NOT_AVAILABLE`（如实降级，不伪造）。**verdict=PARTIAL、exit=0**，报告含每页状态 |
| Given 页面调用未就绪接口（404/字段不匹配）；When 执行到该步；Then 该页 FAIL 记录具体路径+错误，判不通过 → 返工 | ◐ | 逻辑已实现（`expect-response` 断言 HTTP 状态 + 响应字段，FAIL → 该页 FAIL → exit=1）；本机 Playwright 缺失无法实测交互 FAIL 分支，降级路径诚实标注 |
| Given 后端无法启动（阻塞）；When 跑联调；Then 报告标注 INTEGRATION_BLOCKED + 阻塞原因，不伪造 PASS | ✅ | 后端 `server.js` 立即 `exit(1)` → 报告：`backend.status=BLOCKED`、`reason=后端启动失败: backend crashed: missing DB dependency`、`verdict=INTEGRATION_BLOCKED`、**exit=2**，不伪造 PASS |
| Given 联调报告全页 PASS；When 验收；Then 前端任务可置 DONE，报告归档 | ◐ | 报告生成 `integration-report.json/md`（含每页 PASS/FAIL + newman + 失败明细）供归档；「全页 PASS → DONE」属编排 gate，Playwright 可用场景下全 PASS → exit=0 可直接作为通过依据 |
| 降级：Playwright 不可用 → 标 E2E_NOT_AVAILABLE 只跑 newman；两者都不可用 → 诚实标注不可联调 exit 2 | ✅ | ① 有契约+无 Playwright：`e2e=E2E_NOT_AVAILABLE` + `newman=PASS`（verdict=PARTIAL exit=0）；② 无契约+无 Playwright：`e2e=E2E_NOT_AVAILABLE` + `newman=NOT_RUN` → **verdict=INTEGRATION_BLOCKED exit=2**，摘要「联调工具均不可用...诚实标注不可联调」 |

---

## 最小前后端联调实测

### 环境
- 后端：`node server.js` → `http://127.0.0.1:3200`，POST `/api/login` 真实返回 `{token,user}`；GET `/health`。
- 前端：`node static.js` → `http://127.0.0.1:3100`，`index.html` 表单提交时 `fetch('http://127.0.0.1:3200/api/login')`（真实后端）。
- 契约：最小 OpenAPI 3.0（paths: `/health`、`/api/login`）。
- 页面流配置 `pages.json`：`goto /index.html → fill #username → fill #password → click #loginBtn → expect-response POST /api/login status=200 fields=[token,user]`。

### 结果（Playwright 缺失，诚实降级）
- 后端 UP / 前端 UP。
- **newman（portman `--runNewman --baseUrl http://127.0.0.1:3200`）真实请求 → PASS**（连通真实后端，非 mock）。
- 页面交互流 `E2E_NOT_AVAILABLE`（Playwright 执行层缺失，如实标注，不伪造交互 PASS）。
- verdict=PARTIAL，exit=0；报告 `integration-report.md/json` 落盘。

### 阻塞场景（后端无法启动）
- 后端 `exit(1)` → `INTEGRATION_BLOCKED`、exit=2、reason 含崩溃日志，不伪造 PASS。

---

## 回归结果

| 检查 | 结果 |
|------|------|
| `node scripts/validate-structure.mjs` | ✅ [OK] 结构校验通过（0 警告 0 泄露；新增脚本/模板均无可移植性泄露、无 U+FFFD） |
| `node scripts/regression-all.mjs` | ✅ 8/8 PASS（S1 validate / S2 retry / S3 Phase2 / S4 契约工作流含篡改→exit4 / S5 宿主执行 / S6 缓存 / S7 review-gate / S8 资产消费证据） |
| `node scripts/ci.mjs` | ✅ CI PASS |

---

## 诚实标注

- **Playwright 不可用**：本机未装 Playwright，FR-5 页面交互流真实执行（点击/跳转/表单）无法在本机实测，如实标 `E2E_NOT_AVAILABLE`，不伪造交互 PASS。交互流代码路径已实现（`runPlaywrightFlows`：goto/click/fill/submit/expect-response + `page.waitForResponse` 断言 HTTP 状态与响应字段），待有 Playwright 环境即可跑通。
- **后端连通证据**：以 portman `--runNewman` 对**真实后端**的真实 HTTP 请求为连通证据（非 mock），符合 PRD C3「mock 不当真实联调证据」。
- **FR-3 门当前就绪态**：T4_FRONTEND 簇现无 `implementation` 资产，契约门机制已实现并对该类子任务生效（经 `--plan --draft` 正反路径实测），不夸大「已在常规前端路由自动触发」。
- **◐ 项**：FR-3 字段级契约外差异阻断、FR-4 重适配执行与 ADAPTED 标注、FR-5 交互 FAIL 分支（依赖 Playwright 环境）为「机制就绪、流程/环境依赖」，未伪造成 ✅。

---

## 硬性约束检查

| 约束 | 结果 |
|------|------|
| 新增：`scripts/integration-e2e.mjs`、`scripts/contract-change-detect.mjs` | ✅ |
| 改：`scripts/lib/planner.mjs`、`scripts/orchestrator.mjs`、`templates/kickoff-prompt.md` | ✅ |
| 零外部依赖内核（仅 Node 内置 fs/path/child_process；Playwright/newman 走执行层探测） | ✅ |
| 不写本机绝对路径（validate 可移植性扫描 0 泄露） | ✅ |
| 不碰 vendor/、SKILL.md | ✅（仅动以上 5 文件；SKILL.md 归 M3） |
| 不提交不 push | ✅（`git status` 仅 3 改 + 2 新增，未 commit） |
