# YY Workflow Panel 功能覆盖矩阵

> 本矩阵以 `SKILL.md`、`commands/yy-*.md`、`reference/*.md`、`package.json` 与 `scripts/*.mjs` 为事实源。每项能力必须有且只有一个主入口；低频能力允许从主入口跳入工具抽屉。

| YY 内部能力 | 用户主入口 | 展开层/交互 | 对应脚本或产物 | 风险级别 |
|---|---|---|---|---|
| 工作区与配置 | 更多 · 项目环境 | 工作区、memory、AI-Hub、模型、并行度 | `config.json` / `config.example.json` | 中 |
| 平台与宿主探测 | 更多 · 项目环境 | 平台、CLI、主备宿主状态 | `detect-platforms.mjs` / `exec-host-probe.mjs` | 低 |
| 16 项资产盘点 | 更多 · 资产 | 核心/增强/外部资产与降级态 | `vendor/` / `audit-deps.mjs` | 低 |
| 0–8 journey | 进度 | 当前阶段、前置、gate、产物、恢复 | `tt-journey.mjs` / `.tt-state/journey.json` | 中 |
| `/yy 0` 立项 | 进度 · 阶段 0 | 边界、平台和资产盘点 Prompt | `commands/yy-0-init.md` | 低 |
| `/yy 1` 需求 | 规划 · 需求 | 对话问题、证据标签、概念签收 | `commands/yy-1-requirement.md` / PRD | 高 |
| `/yy 2` 拆解 | 规划 · 前提挑战 | premise、四问、GWT、任务 DAG | `commands/yy-2-planning.md` / `dev-plan.md` | 高 |
| 三视角规划审查 | 规划 · 任务 | CEO/Eng/Design finding 与处置 | `plan-review.mjs` / `review-gate.mjs --plan` | 中 |
| T1–T5 任务矩阵 | 规划 · 矩阵 | agent、skill、workflow、MCP、前置 | `scripts/lib/matrix.mjs` | 中 |
| 拆 session 建议 | 规划 · 任务 | lane 判据、交接 Prompt、owner 批准 | `vendor/dev-planner/dev-planner.md` | 高 |
| `/yy 3` 契约 | 规划 · 契约 | draft、审阅、freeze、hash、变更 | `commands/yy-3-contract.md` / `contracts/` | 严格确认 |
| 棕地契约反推 | 规划 · 契约 | source/frontend/out 参数 | `contract-reverse.mjs` | 中 |
| 契约变更与差异 | 规划 · 契约 | baseline、变更单、discrepancy handoff | `contract-change-detect.mjs` / `contract-discrepancy.mjs` | 严格确认 |
| `/yy 4` 派单执行 | 执行 | backend、host、model、parallel、retry | `orchestrator.mjs` | 严格确认 |
| dry-run 与正式运行 | 执行 · 启动 | 命令预览、影响范围、确认 | `orchestrator.mjs --dry-run` / 正式运行 | 低/严格确认 |
| resume 与 TUI | 执行 · 恢复 | 恢复断点、DAG、实时日志 | `orchestrator.mjs --resume` / `tt-tui.mjs` | 高 |
| session 隔离 | 执行 · 分支 | state/contract/artifact 命名空间 | `--session <id>` | 严格确认 |
| 跨分支汇总 | 执行 · 集成 | summary、changed-files、集成开工 | `summary-read.mjs --all` | 高 |
| 前端 Gate A | 证据 · 前端 Gate | HTML 状态、owner 签收、返工日志 | `reference/frontend-gate.md` | 严格确认 |
| token 与 parity | 证据 · 前端 Gate | token 冻结、原型实现一致性 | `prototype-parity-check.mjs` | 高 |
| 视觉回归与 Gate B | 证据 · 前端 Gate | 视口、基线、diff、技术验收 | `visual-regression.mjs` / `frontend-quality-gate.mjs` | 高/严格确认 |
| 独立实证验收 | 证据 · 验收 | 报告声明与复现实证分栏 | `completion-report.md` / 测试报告 | 高 |
| L0–L4 集成 gate | 证据 · 验收 | changed-files、CDC、集成、E2E、回归 | `integration-e2e.mjs` / `regression-all.mjs` | 高 |
| CI、安全与依赖 | 证据 · 质量 | validate、CI、Semgrep、Gitleaks、依赖 | `ci.mjs` / `security-scan.mjs` / `audit-deps.mjs` | 中 |
| 资产消费与域声明 | 证据 · 质量 | assetConsumed、domainDeclared、调用率 | `asset-call-rate.mjs` | 中 |
| `/yy 5` 技术批判 | 证据 · 批判 | ≥3 条、竞品 URL、验证日期、优化方案 | `review-gate.mjs --verify-urls` | 高 |
| 批判 backlog | 证据 · 批判 | C-xx、承接任务、指标、落地率 | `critique-backlog-next.mjs` / tracker | 中 |
| 产物浏览 | 证据 · 产物 | PRD、plan、contract、brief、report、截图 | `docs/` / `contracts/` / `artifacts/` | 只读 |
| 摘要与断点恢复 | 证据 · 记忆 | latest/all、失败/跳过、恢复建议 | `summary-read.mjs` | 低 |
| 记忆与 handoff 同步 | 证据 · 记忆 | 同步方向、影响文件、确认 | `sync.mjs` / `project-handoff.md` | 严格确认 |
| 结构/链接/漂移/token 工具 | 更多 · 高级工具 | 表单、命令、exit code、报告 | validate/linkcheck/drift/token 脚本 | 低/中 |
| 强制越级 | 进度 · 当前阶段 | 原因、命令、审计留痕、二次确认 | `tt-journey.mjs --force` | 严格确认 |

覆盖结论：YY 用户可见能力 31/31 均有主入口；工具抽屉不创造新语义，仅承接低频参数化执行。
