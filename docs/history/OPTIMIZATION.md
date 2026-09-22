# TT skill 优化记录（配合 SkillOps · v2.1.0）

> 依据 `tgent/SKILL.md`（实战沉淀版）与 SkillOps 技能库维护框架，对 `tt`（开源参数化版）做自包含化与可移植性优化。
> 关键约束：**不能硬编码本机路径，确保任何用户拿到本 skill 即可直接使用**。

## 1. SkillOps 图分析（17 节点技能图）

把 `tt` + 16 个引用资产建模为 SkillOps `SkillLibrary`（External Graph-of-Graphs）：

- **节点**：tt（编排者）+ dev-planner / prd-writer / vibe-coding-prd / ui-ux-pro-max / taste-skill / agent-research / agent-vision-toolkit / skill-sentinel / frontend-design / prototype / colorize / polish / audit / critique / pick-ui-library / frontend-visual-validation。
- **边**：12 条 dependency（各资产 artifact → tt 消费中心）、25 条 alternative（前端链 8 个 + PRD 双选）、1 条 redundancy 碰撞。
- **规划器路由验证**（Graph-of-Graphs Planner）：拆任务→dev-planner、设计系统→ui-ux-pro-max、安全扫描→skill-sentinel、PRD→prd-writer、调研→agent-research，全部命中正确技能。

### 维护扫描（MaintenanceEngine.sweep）结论
- **冗余**：prd-writer ↔ vibe-coding-prd 签名碰撞 → 经核对为**备选(alternatives)**（三视角诊断 vs 四道确认关卡），非重复，保留两者（tt §2.1 本就同时引用）。**未合并**。
- **缺失校验器**：对 tt 契约施加 `portability:no_hardcoded_paths` 校验器 → 落实为 `scripts/validate-structure.mjs` 的 **⑤ 可移植性校验**。
- **接口漂移交叉校验**：tt 引用的 16 个资产名全部在打包集合内，全覆盖，零漂移。

## 2. 自包含打包（vendor/）

```
tt/vendor/
├── dev-planner/dev-planner.md          # 核心规划 agent（来自 agents/dev-planner.md）
├── prd-writer/  vibe-coding-prd/       # 需求挖掘
├── ui-ux-pro-max/  taste-skill/        # 设计系统 / 品味护栏
├── frontend-design/ prototype/ colorize/ polish/ audit/ critique/
│   pick-ui-library/ frontend-visual-validation/   # 前端链 8 个
├── agent-research/                     # 调研
├── agent-vision-toolkit/               # 视觉质检
└── skill-sentinel/                     # 第三方 skill 安全扫描
```
共 6.3 MB，随包分发，离线即用。

## 3. 去硬编码 / 可移植性

- **tt 自身**：所有资产引用改为 `$SKILL_DIR/vendor/<name>/SKILL.md` + 新增 `$SKILL_DIR` 变量；`$AIHUB_ROOT` 仅作可选外部覆盖。SKILL.md + 脚本经 ⑤ 可移植性校验，**零泄露**（无盘符绝对路径 / 用户目录绝对路径 / 本机用户名）。
- **打包资产**：`vendor/agent-research` 内原作者绝对路径 `/Users/<user>/...` 已中性化为 `<USER_HOME>` 占位，避免泄露且保持语义正确。
- **脚本独立化**：`sync.mjs` / `detect-platforms.mjs` 在缺 `$AIHUB_ROOT` 时从脚本自身位置解析 `$SKILL_DIR`，离线模式不要求外部 AI-Hub。

## 4. 校验结果

```
validate-structure.mjs → frontmatter OK · 0 警告 · 6 变量全声明 · vendor 16/16 · 可移植性泄露: 无 ✅
detect-platforms.mjs  → 离线运行正常
sync.mjs --dry-run    → 离线(自包含)模式正常
```

## 5. 给其他用户的说明

拿到本 skill 后：
1. 无需任何外部 AI-Hub，所有增强资产已在 `vendor/`。
2. 想用自己 AI-Hub 中的同名 skill：设置环境变量 `AIHUB_ROOT` 即可优先外部引用。
3. 改 skill 后跑 `node scripts/validate-structure.mjs --verbose` 自检（含可移植性校验）。

## 6. 第二次迭代（SkillOps 2nd-iteration sweep · 2026-08-28）

重跑 SkillOps 维护循环，目标：消除接口漂移、收紧可移植性、补校验器/适配边。

### 6.1 分析结果
- **库规模**：17 节点（tt + 16 随包资产，agent-research 作为 29 子技能 hub 建模为单节点）。
- **边统计**：alternative=2、dependency=2（dependency 为 tt→资产消费中心；alternative 由同 domain_type 派生）。
- **冗余簇**：**0** —— 确认所有随包资产为互补能力，无重复 skill（prd-writer/vibe-coding-prd、audit/critique 为**备选**非冗余，保留两者，与 1st 迭代一致）。
- **备选簇**：`requirements_elicitation`(prd-writer↔vibe-coding-prd)、`design_review`(audit↔critique)。
- **接口漂移**：扫描发现 16 个随包资产 frontmatter **缺 `version` 字段**（与 tt 2.1.0 不一致）→ 记为缺失校验器 `frontmatter_version_present`。

### 6.2 应用的库级维护动作（MaintenanceEngine + 定向动作）
- **add_validator ×16**：为每个随包资产施加 `frontmatter_version_present` 校验器（落实为 `validate-structure.mjs` ⑥）。
- **add_adapter ×1**：`frontend-design → frontend-visual-validation` 插入适配技能 `RenderToScreenshot`（消费设计 spec，产出截图，供视觉 QA 消费），生成 lineage 边。
- 规则式 sweep 本体：`merged=0, retired=0, repaired=0`（无冗余、无低效、无高失败资产）。

### 6.3 文件级落地
- 14 个标准 `SKILL.md` 补 `version: 1.0.0`；`agent-research` 新增索引 `SKILL.md`（含 version）。
- `skill-sentinel` "Tgent 插件市场" → "插件市场"（去品牌硬编码，可移植）。
- `validate-structure.mjs` 新增 ⑥（vendor frontmatter 一致性）+ ⑦（vendor 可移植性），并修复 CRLF 容错（归一化 `\r\n`→`\n`）。

### 6.4 校验结果（迭代后）
```
validate-structure.mjs → frontmatter OK · 0 警告 · 16/16 vendor · 接口漂移: 无 · 可移植性泄露: 无 ✅
```

### 6.5 规划器路由（5 样例任务）
| task | 路由命中 |
|------|---------|
| requirements_elicitation | three_view_diagnosis (prd-writer) |
| frontend_design | design_page (frontend-design) |
| design_review | five_dim_audit (audit) |
| visual_qa | visual_verify (frontend-visual-validation) |
| security_scan | scan_skill (skill-sentinel) |

## 7. 第三次迭代（SkillOps 3rd-iteration · 2026-08-29 · 后端资产补全）

用户指出 tt 缺少后端资产。根因：tt 是从 `tgent`（全栈实战版）fork 的开源参数化版，开源化时只把前端/设计/科研链（16 资产）写进 §1c，`tgent` 中引用的后端 agent（be-*）/ 后端 skill（sdlc/harden）**从未被重新声明为 tt 依赖**，是依赖图的「孤儿」，故前两轮未打包。

### 7.1 资产盘点（~/.ai-hub）
- **后端 agent**（agents/）：be-architect、be-implementer、be-provider、be-resilience、be-security、be-tester、be-validator、dev-backend（共 8，均无本机路径硬编码）。
- **后端 skill**（skills/）：sdlc（复合：plan/develop/review/summarize 子技能 + 6 子 agent）、harden。其中 `sdlc/.claude-plugin/marketplace.json` 含 `~/.claude/plugins/sdlc` 硬编码（Claude 插件专属，与 tt 无关）→ 已从包移除。
- **缺失模板**：`task-agent-matrix.md`、`orchestration-frontend-backend.md` 在全 ~/.ai-hub 均不存在，tt/SKILL.md 却引用之 → 新建。

### 7.2 落地（vendor 16 → 26）
- 8 个后端 agent → `vendor/<name>/<name>.md`；sdlc/harden → `vendor/<name>/SKILL.md`（sdlc 补索引 SKILL.md 含 version，harden 补 version:1.0.0）。
- 新建 `templates/task-agent-matrix.md`（T1 数据库/T2 后端/T3 AI-RAG-MCP/T4 前端/T5 运维 五类任务×agent×skill 调度链）、`templates/orchestration-frontend-backend.md`（执行排序 + 契约冻结 ①~⑭）。
- tt/SKILL.md §1c 增补后端资产表与后端任务链引用；自包含说明计数 16 → 26；版本 bump 2.1.1 → 2.2.0。

### 7.3 校验器升级（validate-structure.mjs）
- 拆分 `SKILL_ENTRIES`（有 SKILL.md，需 name/description/version）与 `AGENT_ENTRIES`（有 `<name>.md` 提示词，无 frontmatter）。`dev-planner` + 8 后端 agent 归为 agent 型；可移植性扫描覆盖两类条目。

### 7.4 校验结果（迭代后）
```
validate-structure.mjs → frontmatter OK · 0 警告 · 26/26 vendor · 接口漂移: 无 · 可移植性泄露: 无 ✅
```

### 7.5 规划器路由（补全后端链）
| task | 路由命中 |
|------|---------|
| backend_api_impl | be-architect→be-implementer→be-tester (sdlc/harden) |
| db_migration | be-architect→be-provider |
| backend_review | be-security→be-resilience→be-validator |
| ops_deploy | be-resilience→be-validator (harden) |

