# YY 重构与依赖盘点报告（YY-RESTRUCTURE report）

> 执行方：YY 项目独立执行子 agent · 日期 2026-09-07 · 分支 `feature-yy-owner-ux`（基于 main，TT 2.9.1）
> 任务：①重构 YY 目录（自包含分发单元）②资产依赖缺口盘点（真实数据依据）
> 本报告全部为实测结果，无推断性"应该可以"表述。

---

## 1. 目录结构（验收①）

```
yy/                          ← YY 包根（fork 自 TT 2.9.1，独立身份）
├── SKILL.md                 frontmatter name:yy / version 0.1.0 + 正文复用 TT + 「附 C：YY 与 TT 差异段」（F1-F5 登记表）
├── package.json             name:yy · type:module · scripts(validate/regression/journey/ci/orchestrate/…) · dependencies 9 + optionalDependencies 2
├── README.md / CHANGELOG.md / ONBOARDING.md / config.example.json   ← 自仓库根复制（SKILL.md §0 引用 config.example.json，缺了无法初始化）
├── LICENSE                  ← 见下方「修正」说明（原计划未列，已补）
├── scripts/                 33 个 .mjs + lib/（16 模块 + adapters 7 文件）＝ TT 全量复制，未删改逻辑；仅 validate-structure.mjs 输出前缀 [TT]→[YY]（1 行）
│   └── audit-deps.mjs       ★YY 新增：依赖可用性机验（DEPENDENCY-AUDIT 的可执行版）
├── templates/               12 个模板全量复制
├── docs/                    107 个文件全量复制（TT-OWNER-UX-PRD.md ✓ TT-USER-PROMPT-GUIDE.md ✓）
│   ├── DEPENDENCY-AUDIT.md  ★YY 新增：依赖缺口盘点（§2 验收③）
│   └── YY-RESTRUCTURE-report.md  ★本报告
├── commands/                空目录 + .gitkeep（F2 阶段化 Prompt 注入的落点，PRD 规划中）
├── vendor/                  16 资产全量复制（含 4MB design-data；总 5.8MB，可接受）
└── node_modules/            npm 实装 18 包（.gitignore 已排除，分发时 npm i 重建）
```

体积：`yy/` 6.9 MB（vendor 5.8 + node_modules 约 20MB 运行时按需 `npm i`，源码包不含）。

**LICENSE 修正**：任务书要求 `yy/SKILL.md` 等 6 项，未列 LICENSE；自包含分发单元需要许可文件，故复制了根 `LICENSE`（GPL-3.0，fork 合规必需）。

## 2. 复制清单（含校验）

| 项 | 数量 | 校验 |
|----|------|------|
| scripts/*.mjs | 33 | `node --check` 全过（含 lib/ 递归共 45 文件） |
| scripts/lib | 17 + adapters 7 | regression-all 依赖的 `lib/adapters/index.mjs` 在 ✓ |
| templates | 12 | 与源逐一同名 ✓ |
| docs | 107 | OWNER-UX-PRD + USER-PROMPT-GUIDE 均在 ✓ |
| vendor | 16 资产 / 301 文件 | validate-structure 报 16/16 ✓ |
| 根文档 | SKILL/README/CHANGELOG/ONBOARDING/config.example/LICENSE | SKILL.md frontmatter name=yy / version=0.1.0 ✓ |

复制实现：PowerShell `Copy-Item -Recurse`（首踩坑：目标目录已存在时 `Copy-Item scripts yy\scripts` 会嵌套成 `yy\scripts\scripts`——已发现并改为 `Copy-Item scripts\*` 平铺修正）。

## 3. 依赖盘点（验收③，完整表见 docs/DEPENDENCY-AUDIT.md）

每条经注册表 API / GitHub API / 本机 PATH 实测（2026-09-07），要点：

| 类别 | 结论 |
|------|------|
| 补装进 yy/package.json | culori 4.0.2 / poline 0.13.1 / chroma-js 3.2.0（colorize 内核）；tsyringe 4.10.0 + reflect-metadata 0.2.2 + tslib 2.8.1（be-provider）；cockatiel 4.0.0 + polly-js 1.8.3（be-resilience）；playwright-core 1.63.0（截图链，optional 加 playwright 1.63.0）——此前"零依赖"实际是把这些库外置到 `AIHUB_ROOT/thirdparty`，换机即失效 |
| venv（Python 生态） | gpt-researcher（本机 0.12.3，PyPI 最新 0.16.0）、crewai（1.15.18→1.15.20）、（新发现）**NVIDIA SkillSpector 已发布 v2.11.0**（旧文档记"未发布"已过时；`uv tool install git+https://github.com/NVIDIA/skillspector.git`） |
| 系统 CLI（不进包，ONBOARDING 注明） | semgrep（PyPI 1.176.1）/ gitleaks（v8.30.1）/ @apideck/portman 1.35.0（内嵌 newman 6.2.2）/ opencode 1.18.29 / claude-code / codex |
| 诚实标注 | shadcn CLI 未装（`npx shadcn@latest` 即用即走，不预装）；bolt.new 上游停更（2024-12，→bolt.diy）；metagpt 现代版 PyPI 依赖未发布不可装；UI-TARS 全量 7B > 本机 RTX 4060 8GB VRAM（部分可装：OmniParser 检测分支可试）；pr-agent 本地 Docker 未部署；playwright 浏览器未下载（ms-playwright 目录空，npx 缓存仅 alpha） |
| F1-F5 | 全部零新依赖（PRD §2.3 决策 4 与本盘点一致；@mermaid-cli 评估后拒绝引入——与终端 ASCII 需求错位） |

## 4. 验证结果（验收②④）

| 检查 | 命令 | 结果 |
|------|------|------|
| 语法全检 | `node --check` yy\scripts 全部 .mjs（递归） | **全过** |
| yy 自识别结构 | `cd yy && node scripts/validate-structure.mjs` | **[OK] 0 警告**：frontmatter OK / 16/16 vendor / 变量全声明 / 可移植性无泄露 / 无 U+FFFD。脚本用 `__dirname` 相对定位（validate-structure.mjs:11,14），**天然自适应**，复制后无需改路径 |
| npm scripts | `npm run validate` / `npm run audit:deps` | 均正常（[YY] 前缀生效） |
| 依赖实装 | `cd yy && npm install` | 18 包 50s 装完；`audit-deps` 输出 **17 OK / 7 WARN / 0 MISS**（WARN 全部为可选/降级合规项） |
| tt 本体回归 | 仓库根 `node scripts/regression-all.mjs` | **8 PASS / 0 FAIL**（S1-S8 全绿） |
| yy 包内回归 | `cd yy && npm run regression` | **8 PASS / 0 FAIL**（脚本路径自适应验证成立） |
| tt 本体零改动 | `git status --porcelain` | **仅 `?? yy/`，0 个 tracked 文件修改**（`git diff` 空） |

> journey 脚本在无编排历史时输出"先跑 orchestrator"提示（summary-read.mjs 的 empty-state 正确行为，非故障）。

## 5. 诚实声明

- yy/vendor 是复制品，**与 tt/vendor 当前内容一致**；后续 YY 迭代产生的 vendor 变更不会自动回流上游（fork 语义，符合"独立身份"前提）。
- audit-deps.mjs 的 venv 探测依赖 `AIHUB_ROOT` env（本机未默认设——审计脚本输出已如实区分两种环境下的结果；YY 自包含目标下 venv 属"可选增强"，不影响包内 0 MISS）。
- SkillSpector 状态修正（已发布）仅登记于 DEPENDENCY-AUDIT §2.8，**未接线**到 regression S3 kernel marker（那是上游 tt/ 的文件，本任务不许改；接线属后续 YY 任务）。
- `yy/docs/` 沿用了 TT 的 107 个历史文档（含 history/），未做 YY 化裁剪——超出本任务授权范围，保持全量复制最诚实。