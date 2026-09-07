# T11 Report — 开源发布规划（OPENSOURCE-PLAN + 开源入口文档更新）

- 日期：2026-09-01
- 执行方：TT 工作流独立规划子 agent
- 目标：为 TT（v2.2.9，开源发布包形态）重新规划面向广大用户的开源发布方案，产出规划文档 + 更新开源入口文档（README / ONBOARDING）。

## 规划要点摘要

TT 定位为「**多 Agent 平台编排闭环方法论 + 编排内核 + 自包含资产包**」，面向想调度多个 AI 平台并行完成大项目、摆脱"单 Agent 单次对话"局限的人群。核心交付：

1. **docs/OPENSOURCE-PLAN.md**（新文件，面向维护者）：
   - **定位**：方法论 + `scripts/orchestrator.mjs` 编排内核 + 16 个自包含 vendor 资产；明确"不是替代所有 agent 平台"。
   - **5 个用户画像/场景**：独立开发者做产品 / 团队并行开发 / 研究者跑调研流水线 / AI 工具爱好者编排自有 agent / 关注自进化的 MAS 用户。
   - **发布渠道方案**：GitHub 仓库结构建议（README 即快速上手）；**纯 git 分发 vs npm/pnpm 对比表，首发推荐纯 git**（skill 形态天然匹配客户端目录约定）；社区接入三种方式（当 skill / 当编排内核 / 接自有 AI-Hub）。
   - **快速上手路径**：安装 → 探测平台 → 校验 → 读 SKILL.md 按 8 步闭环 → 冒烟 → 看报告 + 回写 CHANGELOG（对应 ONBOARDING）。
   - **7 条差异化卖点**（≥5 达标）：8 步闭环 / 契约冻结机器校验 / 竞品直用（Competitor-first）/ 16 自包含资产 / 零依赖脚本 / 诚实执行标注 / 自进化闭环——并逐条 vs claude-flow、lobehub、OpenHands、agentops。
   - **已知边界与诚实声明**：真实 LLM 执行需配置宿主（无宿主诚实产出 brief-only）；前端设计靠 taste-skill/ui-ux-pro-max/search.py 数据驱动 + HTML 原型双 gate；bolt.new/SkillSpector/OmniParser 等竞品不可部署已诚实标注；key 只走 env；不替代平台。
   - **演进路线 3 阶段**：Phase 1 发布稳定版 2.2.9 → Phase 2 文档站/示例库 → Phase 3 社区模板/CI 集成 + 可选 npm 打包。
   - **社区贡献指南**：报 bug / 提需求流程、加资产 5 步（含 validate 注册）、开发环境 setup（Node ≥18 + 宿主 + 先读 architecture.md）、行为准则（可移植性 0 泄露 / key 不入口 / 批判须竞品对标）。

2. **README.md**（最小改动）：
   - 头部版本从过时的 v2.2.6 修正为 **v2.2.9**（标题 + 自包含说明行，与 SKILL.md frontmatter / CHANGELOG 对齐）。
   - 「这是什么」补目标用户与价值定位段（给谁用 + 核心价值）。
   - 目录结构节加 `docs/OPENSOURCE-PLAN.md` 条目。
   - 新增「开源协作」章节 + 目录索引，指向 OPENSOURCE-PLAN.md 各节。

3. **ONBOARDING.md**（最小改动）：
   - 顶部引用块加一行指向 `docs/OPENSOURCE-PLAN.md`（"本文件只讲怎么跑起来"），不增不删其余主体。

## 文档改动点

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `docs/OPENSOURCE-PLAN.md` | 新增 | 开源发布方案全文（定位/画像/渠道/上手/差异/边界/路线/贡献） |
| `README.md` | 修改 | 版本 2.2.6→2.2.9（2 处）；「这是什么」+2 句定位；目录结构 +OPENSOURCE-PLAN.md；新增「开源协作」节 + ToC |
| `ONBOARDING.md` | 修改 | 顶部引用块 +1 行指向 OPENSOURCE-PLAN.md |
| `docs/history/specs/T11-report.md` | 新增 | 本报告 |

**未动**：SKILL.md / CHANGELOG.md / COMPETITORS.md / config.example.json / install.* / scripts/ / templates/ / vendor/ —— README 与 ONBOARDING 均只增不删主体。

## 可移植性把关

- 新增/修改内容均不含盘符路径、用户目录、用户名（`docs/OPENSOURCE-PLAN.md`、README 新节、ONBOARDING 新行均扫过，0 命中）。
- 路径引用一律相对：README → `./docs/OPENSOURCE-PLAN.md`；ONBOARDING → `docs/OPENSOURCE-PLAN.md`。

## validate 结果

```
node scripts/validate-structure.mjs --verbose
[TT] validate .../SKILL.md
  frontmatter: OK
  章节数: 30, 闭环关键节 10 项检查中警告 0 项
  变量使用: 6 个 (AIHUB_ROOT, MEMORY_ROOT, PLATFORMS, PROJECT_ROOT, SKILL_DIR, VAR)
  未声明变量: 无
  随包 vendor 资产: 16/16 存在
  接口漂移(vendor frontmatter): 无
  可移植性泄露: 无
  编码损坏(U+FFFD): 无
[OK] 结构校验通过 (0 项警告, exit 0)
```

## 验收对照

- [x] `docs/OPENSOURCE-PLAN.md` 存在且完整（5 用户场景 / 卖点 7 条≥5 / 路线 3 阶段 / 贡献指南含 setup）
- [x] README 只增不删主体，新增内容 0 本机路径
- [x] `node scripts/validate-structure.mjs` 0 警告
- [x] README 引用 `docs/OPENSOURCE-PLAN.md` 路径正确（./docs/OPENSOURCE-PLAN.md）
- [x] 不夸大定位：全文强调"方法论 + 编排内核 + 资产包"，明确"非替代所有 agent 平台"

## 诚实声明

- README 原本存在版本滞后（标题/自包含说明仍为 v2.2.6，而 SKILL.md frontmatter 与 CHANGELOG 顶部均为 v2.2.9），本次一并修正为 v2.2.9，非新增不实信息。
- 本规划为文档层交付，未引入新脚本/新测试；未运行 `regression-all.mjs`（本次无内核改动，validate 0 警告已覆盖文档变更面）。
