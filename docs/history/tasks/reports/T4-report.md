# T4 报告：竞品直用策略（Competitor-first）最小策略调整

- 日期：2026-09-01
- 任务：修改 TT 工作流策略，允许直接使用已部署竞品，TT 资产仅在明确更优时优先
- 范围：只加策略文字，不删资产、不改 scripts/ 内核、不动 frontmatter/version（version 保持 2.2.7）

## 改动文件与改动点

### 1. `SKILL.md`（改动 2 处，共 ~8 行新增/改写）

1. **§1c 末尾新增「竞品直用策略（Competitor-first）」段**（约 4 行）
   - 说明：当任务所需竞品已部署且可用时（引用 `$SKILL_DIR/COMPETITOR-DEPLOYMENT.md`，列 opencode 1.18.25 / portman 1.35.0 / semgrep+gitleaks / culori/poline / gpt-researcher / crewai），允许编排者/执行 agent 直接调用竞品（CLI/库/venv），TT 16 资产保留为方法论兜底。
   - 含判断一句：「竞品可用 → 直用竞品；竞品不可用或 TT 资产有明确差异化优势 → 用 TT 资产。」
   - 明确差异化优势例举（dev-planner 前提挑战/GWT 多视角评审、review 批判滞后闭环纪律）。
   - 声明不删资产、不改内核机制，仅放宽 §4 调用选择。

2. **§4 硬约束措辞放宽**（原「跨平台资产调用硬约束」改写为「跨平台资产调用策略（2026-09-01 放宽）」）
   - 原：「必须使用 TT 随包内置资产」→ 改为「优先使用已部署竞品或 TT 资产中更优者（竞品直用策略见 §1），TT 资产在方法论差异化场景保留」。
   - 保留防幻觉机制但按两条路径细化：调用 TT 资产 → `artifactPath` 须指向 `$SKILL_DIR/vendor/`（指向平台自有同名资产 = 违规）；直用已部署竞品 → 须列真实调用证据（CLI/库/venv 实际执行），仅凭文档声明冒充调用 = 违规。
   - 「独立子 agent 派单硬约束」原样保留。

### 2. `README.md`（改动 1 处，约 2 行新增）

- 「随包内置资产」节「说明」blockquote 之后新增一句竞品直用策略：引用 `COMPETITOR-DEPLOYMENT.md`，说明竞品可用直用、TT 资产兜底、仅差异化优势时优先，详见 SKILL.md §1。

## 未改动（按任务约束）

- `scripts/` 全部保持原样（编排内核 / adapter / 回归逻辑不触碰——其「竞品可用时真调竞品，否则回落 TT 资产」机制与本次策略一致）。
- `vendor/` 16 资产未删未改。
- `SKILL.md` frontmatter 与 `version: 2.2.7` 未动（§9 迭代优化要求「改策略时 bump version」与任务「不改 version」冲突，按任务约束优先——未 bump，若后续要 bump 应单独提交）。

## 验收

- SKILL.md 含「竞品直用」「Competitor-first」关键词 ✅
- §4 硬约束措辞已放宽 ✅
- README 含策略引用 ✅
- 改动最小：3 处文字编辑，未破坏任何章节结构 ✅
- `node scripts/validate-structure.mjs` 通过，0 警告（frontmatter OK / 16/16 资产 / 0 泄露 / 0 编码损坏）✅

## 诚实说明

- 未做 regression-all 全量回归（任务验收标准仅要求 validate-structure，未要求跑全套）；本次只加策略文字，不触及脚本与 vendor，回归风险极低。
- version 未 bump（任务明确要求不改 frontmatter/version）。
