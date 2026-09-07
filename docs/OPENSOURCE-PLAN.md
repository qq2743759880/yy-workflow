# TT（Together Agent）开源发布方案（OPENSOURCE-PLAN）

> 面向维护者的开源规划文档。目标读者：TT 维护者、潜在贡献者、想引入 TT 的社区用户。
> 本文档只描述定位 / 方案 / 边界，不承诺发布进度；实际演进以 CHANGELOG.md 为唯一事实源。

## 1. 定位

**TT = 多 Agent 平台编排闭环方法论 + 编排内核 + 自包含资产包。**

它**不是**要替代某个 AI 平台，而是给"想调度多个 AI 平台并行完成大项目"的人一套可复用的编排纪律与工具：

- **方法论**：8 步闭环（资产整合 → 需求文档化 → 拆任务 → 规划矩阵 → 并行派单 → 独立实证验收 → 强制技术批判 → 批判反哺自进化），平台数 N 自适应（N≥2 完整闭环，N=1 串行退化，框架不变）。
- **编排内核**：`scripts/orchestrator.mjs` 纯 Node 零依赖，实现路由 / 契约冻结 / 并行 DAG / 资产消费证据 / CI，机器可校验。
- **自包含资产包**：16 个随包 vendor 资产（前端 / 规划 / 安全 / 后端 / 调研等），离线可用，零外部依赖。

### 给谁用

- 想调度多个 AI 平台 / Agent 并行完成大项目的人——不满足于"单 Agent 单次对话"的局限。
- 想在一套可机验纪律下保证"验收不采信报告、批判必须有竞品对标"的人。
- 想摆脱单平台绑定、资产可整体拷走离线使用的人。

## 2. 用户画像与场景

| # | 画像 | 典型场景 | 用 TT 做什么 |
|---|------|---------|-------------|
| 1 | 独立开发者做产品 | 一个人当团队用 | 一个编排者调度多平台并行拆任务，契约冻结避免接口返工，批判环节补单人视角盲区 |
| 2 | 团队并行开发 | 前端 / 后端 / 测试并行 | 多平台按角色分域派单，独立实证验收 + 跨平台切换返工直到通过 |
| 3 | 研究者跑调研流水线 | 文献综述 / 实验 / 图表 | 用 agent-research 簇做调研，编排者并行派调研与批判，验收走独立实证 |
| 4 | AI 工具爱好者编排自有 agent | 接入已有 CLI / 本地模型 | 用 `--exec` 宿主（openclaw / a6api / claude / codex）把本地 agent 接入闭环，无宿主时诚实产出指令包 |
| 5 | 关注自进化的 MAS 用户 | 想让编排越用越顺 | 用 F1-F4 自进化（资产调用率监控 / 记忆快照 / 执行反馈 / CI 质量）把经验回写 skill |

## 3. 发布渠道方案

### GitHub 仓库结构建议

```text
tt/
├── README.md            # 快速上手入口（README 即快速上手）
├── docs/                # 文档（architecture / OPENSOURCE-PLAN / examples）
│   ├── history/         # 开发期历史日志（非开源必需，保留可追溯）
│   └── examples/        # 示例（案例研究 / 样例契约）
├── CHANGELOG.md         # 版本演进唯一事实源
├── LICENSE              # MIT
├── SKILL.md             # 核心方法论（入口资产）
├── ONBOARDING.md        # 上手流程
├── install.sh / install.ps1  # 一键安装
├── config.example.json  # 配置样例
├── scripts/             # 零依赖 Node 脚本
├── templates/           # 完工报告 / 契约 / 批判模板
└── vendor/              # 16 个随包内置资产（自包含核心）
```

### 分发方式对比

| 维度 | 纯 git 分发 | npm/pnpm 打包 |
|------|-----------|--------------|
| 上手成本 | 拷目录即用，零安装 | 需注册 / 维护包名与发布流程 |
| 离线可用 | 天然离线 | 需打包内嵌，语义略重 |
| skill 形态 | 目录即 skill，天然匹配客户端加载约定 | 需解包到 skills 目录，多一层迁移 |
| 版本管理 | tag + CHANGELOG | 语义化版本 + registry |
| 适用阶段 | **当前推荐（Phase 1 首发）** | 可选（Phase 3 有生态需求时评估） |

> 结论：**首发以纯 git 分发为主**——TT 是 skill 形态，客户端按目录约定加载，纯 git 分发最贴合；npm/pnpm 留作社区壮大后的可选通道。

### 社区接入方式

- **直接当 skill 用**：拷到客户端 skills 目录（Claude Code / Codex / Cursor / Roo / WorkBuddy 等）。
- **当编排内核用**：`node scripts/orchestrator.mjs ...` 独立使用，不依赖任何客户端。
- **接入自有 AI-Hub**：设 `AIHUB_ROOT` 指向自己的资产中心，随包 vendor 作兜底。

## 4. 快速上手路径（对应 ONBOARDING.md）

```text
安装（install.sh / install.ps1 或拷目录）
  → 探测平台（node scripts/detect-platforms.mjs，结果写 config.json）
  → 校验（node scripts/validate-structure.mjs，0 警告）
  → 读 SKILL.md 按 §0b 八步闭环推进
  → 首次小任务冒烟，再上完整项目
  → 每次执行后看报告（artifacts/report-<planId>.md）+ 追加 CHANGELOG（自进化）
```

## 5. 差异化卖点（vs claude-flow / lobehub / OpenHands / agentops）

| 卖点 | 说明 | 对应用户价值 |
|------|------|-------------|
| **8 步闭环** | 资产整合 → 文档化 → 拆任务 → 规划 → 并行 → 验收 → 批判 → 反哺，全流程有 gate | 不靠临场发挥，大项目可复制、可回跳 |
| **契约冻结机器校验** | 契约 hash 冻结，执行期被篡改 → exit 4；依赖缺失 → 下游 cascade skip | 接口返工可防，下游不被烂契约解锁 |
| **竞品直用策略（Competitor-first）** | 已部署竞品直接调用，TT 资产方法论兜底 | 不重复造轮子，资产调用边界清晰 |
| **16 个自包含资产** | 前端 / 规划 / 安全 / 后端 / 调研全覆盖 | 零外部依赖，拷走即用 |
| **零依赖脚本** | 纯 Node `.mjs`，无需 npm install | 任意机器可跑，CI 易接入 |
| **诚实执行标注** | 每子任务标注 mode=exec/cli/prompt/skipped + degraded，不假报成功 | 结果可信，验收有据 |
| **自进化闭环** | F1-F4 数据驱动 + CHANGELOG 迭代 | 编排经验沉淀为 skill 持续改进 |

## 6. 已知边界与诚实声明

- **真实 LLM 执行需配置宿主**：TT 本身做编排纪律，真机执行靠 `--exec` 宿主（openclaw / a6api / claude / codex）；无宿主时产物为指令包（brief-only），**不假报已执行**。
- **前端设计靠 taste-skill / ui-ux-pro-max / search.py 数据驱动**：前端质量依赖随包资产的品味护栏与真实数据检索，不是"生成即好"，需要走 HTML 原型双 gate。
- **部分竞品不可部署已诚实标注**：bolt.new 闭源、SkillSpector 未发布、OmniParser / UI-TARS 需 GPU、pr-agent 需 Docker、cline 官方 CLI 未成熟等——不可部署时走 TT 资产兜底（详见 docs/history/COMPETITOR-DEPLOYMENT.md）。
- **API key 安全**：key 只放环境变量 / 本机 `.env`，仓库内不得出现任何 key 值。
- **不是"替代所有 agent 平台"**：TT 是编排方法论 + 资产包，具体的 agent 执行仍依赖你已有平台 / 模型。

## 7. 开源演进路线

- **Phase 1 — 发布稳定版（当前）**：冻结 2.2.9 为开源基线；README / ONBOARDING / 安装脚本 / 校验脚本齐备；`validate-structure.mjs` 0 警告；发布 GitHub 仓库。
- **Phase 2 — 文档站 / 示例库**：扩充 docs/（架构决策、案例研究、样例契约），沉淀 examples/ 为可跑示例（eduagent-case-study 等）。
- **Phase 3 — 社区模板 / CI 集成**：提供社区模板（多场景 dev-plan / 契约 / 批判报告），接 GitHub Actions 跑 `ci.mjs` / `regression-all.mjs`；评估 npm/pnpm 打包通道。

## 8. 社区贡献指南

### 怎么报 bug / 提需求

- 提 issue：附 `node scripts/validate-structure.mjs` 输出、宿主环境（平台 + 客户端 + Node 版本）、复现步骤。
- 编排方法论改进：建议先读 docs/architecture.md（5 条取舍原则）再提，避免破坏 8 步脚手架。

### 怎么加一个资产

1. 在 `vendor/<name>/` 放自包含资产（skill 型带 SKILL.md + name/description/version frontmatter；agent 型带 `<name>.md` 提示词）。
2. 在 `scripts/validate-structure.mjs` 的 `SKILL_ENTRIES` / `AGENT_ENTRIES` 注册。
3. 更新 README 资产表 + SKILL.md §1c 清单。
4. 跑 `node scripts/validate-structure.mjs`（0 警告）+ `node scripts/regression-all.mjs`（全绿）。
5. 更新 CHANGELOG + bump SKILL.md version。

### 开发环境 setup

- Node.js ≥ 18（脚本零依赖，无需 npm install）。
- 至少一个可执行宿主：openclaw（本地 agent，无需 key）或 a6api（需要 `A6API_KEY` 环境变量）或已登录的 claude / codex CLI。
- 拉代码后直接跑：`node scripts/validate-structure.mjs` → `node scripts/regression-all.mjs`。
- 改动前先读 docs/architecture.md + SKILL.md 附 A（新增 `$VAR` 需登记）。

### 行为准则

- 不引入本机绝对路径（validate 可移植性检查：盘符 / 用户目录等 0 泄露）。
- 不把 key 写进仓库；批判必须带竞品对标（URL + 日期）；契约不可被绕过。
