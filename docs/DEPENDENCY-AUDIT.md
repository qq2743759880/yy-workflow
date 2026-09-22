# YY 依赖缺口盘点（真实数据依据）

> 生成：2026-09-07 · 分支 `feature-yy-owner-ux` · YY 0.1.0（fork 自 TT 2.9.1）
> 方法：本机命令实测（`Get-Command` / `npm ls -g` / npx 缓存 / venv site-packages）+ 注册表 API 实时查询（npm registry / PyPI / GitHub API，2026-09-07）。每条给真实来源，禁编造。
> 结论先行：**TT 为"零依赖"付的代价 = 8 个 npm 库被排除在包外（现补入 yy/package.json）、2 个外部 CLI 探测可用但未随包、4 个 vendor 内核诚实标注不可装/需重条件**。

---

## 0. 盘点方法与事实源

| 事实源 | 命令/URL | 结果摘要 |
|--------|----------|----------|
| 本机 CLI | `Get-Command <cli>` | opencode/claude/codex/portman/semgrep/gitleaks 在 PATH；playwright/newman/shadcn/mmdc 不在 PATH |
| npm 全局 | `npm ls -g --depth=0` | opencode-ai@1.18.25、@anthropic-ai/claude-code@2.1.261、@openai/codex@0.151.0、@apideck/portman@1.35.0、@mermaid-js/mermaid-cli@11.16.0、@cline/cli@0.0.13、openclaw@2026.7.1-2 |
| npx 缓存 | `%LOCALAPPDATA%\npm-cache\_npx` | playwright-core 1.63.0-alpha-2026-08-31（仅 alpha 预览版，无稳定版落盘） |
| 浏览器 | `%LOCALAPPDATA%\ms-playwright` | **空目录（0 个浏览器构建）**；`ms-playwright-mcp\mcp-chrome-*` 是 MCP 启动器的 Chrome 用户数据目录，非 playwright 浏览器 |
| Python venv | `~/.ai-hub/thirdparty/venv-*` | gpt_researcher 0.12.3、crewai 1.15.18（py311）、metagpt 0.1（旧版） |
| AIHUB thirdparty | `~/.ai-hub/thirdparty/node_modules` | culori/poline/chroma-js/tsyringe/inversify/cockatiel/polly-js/reflect-metadata/tslib（TT 脚本经 `AIHUB_ROOT` 间接引用——**这正是"零依赖"的缺口：不在包内，换机即失效**） |
| npm registry API | `registry.npmjs.org/<pkg>/latest`（2026-09-07 实测） | 见下表版本列 |
| PyPI API | `pypi.org/pypi/<pkg>/json`（2026-09-07 实测） | gpt-researcher 0.16.0、crewai 1.15.20、metagpt 0.8.2、pr-agent 0.45.0、semgrep 1.176.1 |
| GitHub API | `api.github.com/repos/<repo>`（2026-09-07 实测） | 见 §3 |

---

## 1. 已部署但 TT 脚本未随包（依赖外部环境，换机即缺）

> TT 脚本自身零依赖设计为优点（PRD 明确"零依赖是优势，勿丢"），但以下能力当前**只在本机可用**，不进包就不可复现：

| # | 资产/脚本 | 依赖 | 真实依据 | 建议 |
|---|-----------|------|----------|------|
| 1.1 | `scripts/prototype-parity-check.mjs`、`scripts/visual-regression.mjs`、`scripts/integration-e2e.mjs` | playwright / playwright-core（浏览器截图+像素 diff） | npx 缓存只有 1.63.0-alpha（非稳定版）；`ms-playwright` 目录为空 = **浏览器未下载**；npm registry 稳定版 `playwright 1.63.0`（2026-09-07 实测）。脚本已内置 `req.resolve('playwright')` 探测 + 诚实降级（integration-e2e.mjs:77-90） | **装进 yy**：`dependencies` 加 `playwright-core@^1.63.0`（截图走 `executablePath` 指向系统 Chrome，无需下载浏览器）；`optionalDependencies` 加 `playwright@^1.63.0`（要 `npx playwright install chromium` 才有全功能） |
| 1.2 | `scripts/security-scan.mjs` | semgrep（SAST）+ gitleaks（密钥） | 本机 PATH 实测：`semgrep.exe`（C:\Python314\Scripts，PyPI 现价 1.176.1）、`gitleaks.exe`（~/go/bin，GitHub 最新 release v8.30.1）。TT 脚本已做 ENOENT 诚实降级（security-scan.mjs:23,35） | **不进 package.json**（pip/go 二进制，非 npm 生态）；写入 ONBOARDING 安装前置：`pip install semgrep` + `go install github.com/zricethezav/gitleaks/v8@latest`；脚本降级路径已合规 |
| 1.3 | `scripts/integration-e2e.mjs`（newman 路径） | newman（契约真实请求） | 本机无独立 newman，但 `@apideck/portman@1.35.0` 内嵌 `newman 6.2.2`（node_modules 实测）；npm 独立包 `newman 6.2.2`。脚本探测 portman 优先、newman 兜底（integration-e2e.mjs:93-101） | **不进 package.json**：portman 已在 PATH 且脚本会优先用它；无 portman 的新机器按 ONBOARDING `npm i -g @apideck/portman`（自带 newman）。若要纯 newman：`npm i -g newman` |
| 1.4 | `scripts/lib/adapters/portman.mjs`、`be-validator` 内核 | portman（OpenAPI→Postman 契约校验） | 本机 `portman.ps1`（npm 全局 @apideck/portman@1.35.0）；npm 裸名 `portman` 是无关占位包 0.0.3——**真包名是 `@apideck/portman`** | 不进 package.json（CLI 全局工具）；ONBOARDING 注明 `npm i -g @apideck/portman@^1.35.0` |
| 1.5 | `scripts/lib/adapters/opencode.mjs`、`implementation` 内核 | opencode CLI | npm 全局 opencode-ai@1.18.25（registry 最新 1.18.29）；adapters/opencode.mjs 真调（assetConsumed 校验） | 不进 package.json（编排宿主，用户按平台装）；ONBOARDING 注明 |
| 1.6 | `scripts/lib/adapters/bmad-cline.mjs`、`sdlc` 内核 | cline CLI | npm 全局 @cline/cli@0.0.13；COMPETITOR-DEPLOYMENT 标注"仅探活不真执行"（未成熟） | 诚实标注：保留探活，不承诺执行 |
| 1.7 | `--exec` 宿主候选 | claude / codex CLI | npm 全局 @anthropic-ai/claude-code@2.1.261（registry 2.1.263）、@openai/codex@0.151.0；codex exec 挂起问题已知（C-10） | 不进 package.json；ONBOARDING 注明 |

## 2. vendor 资产声明内核 vs 脚本实装（逐资产，14 个有 Execution kernel 段）

> `rg "^#+ Execution kernel" vendor` 实测 14 处（10 skill + 4 agent 型）。dev-planner/implementation 无 kernel 段（implementation 经 opencode adapter 真调，见 §1.5）。

| # | 资产 | 声明内核（vendor SKILL.md 实测行） | 现状 | 真实依据 | 建议 |
|---|------|-----------------------------------|------|----------|------|
| 2.1 | colorize | culori / chroma-js / poline（SKILL.md:160） | `color-palette.mjs`/`color-mix.mjs` 真调，但**经 `AIHUB_ROOT/thirdparty` 间接加载，不在包内** | npm latest（2026-09-07）：culori 4.0.2、chroma-js 3.2.0、poline 0.13.1 | **装进 yy**（已入 yy/package.json dependencies）——自包含的关键一步 |
| 2.2 | be-provider | tsyringe / InversifyJS（be-provider.md:11） | `di-container.mjs` 双容器真调，同上经 AIHUB_ROOT | npm latest：tsyringe 4.10.0、inversify 8.2.3、reflect-metadata 0.2.2、tslib 2.8.1 | tsyringe+reflect-metadata+tslib **装进 yy**（dependencies）；inversify **optionalDependencies**（ESM 解析在 Node 24 有历史波动，保留可选） |
| 2.3 | be-resilience | cockatiel / Polly（be-resilience.md:11） | `resilience-check.mjs` 真调，同上经 AIHUB_ROOT | npm latest：cockatiel 4.0.0、polly-js 1.8.3 | **装进 yy**（dependencies） |
| 2.4 | frontend-design | shadcn-ui/ui + bolt.new（SKILL.md:48） | shadcn CLI **不在本机 PATH**（Get-Command 实测 NOT FOUND）；bolt.new 上游仓库 `stackblitz/bolt.new` 已 2024-12 停更（GitHub API pushed_at=2024-12-17，16.5k★），活跃分叉 `stackblitz-labs/bolt.diy` 19.9k★（pushed 2026-02-07） | npm `shadcn` latest 4.21.0（"Add components to your apps"） | **诚实标注 + 可选**：YY 按 ponytail 原则**不预装** shadcn（它只在"实现 shadcn 规范组件"的任务里才需要，`npx shadcn@latest <cmd>` 即用即走，无需全局装）；bolt.new 停更 → SKILL 已写降级（用内置 design-data），补记 bolt.diy 为社区延续 |
| 2.5 | agent-research | gpt-researcher（SKILL.md:57） | venv 已通（`venv-gpt-researcher`，gpt_researcher 0.12.3 实测） | PyPI 最新 0.16.0（本机 0.12.3 落后）；安装 `pip install gpt-researcher` | **venv 方案**（Python 生态，不进 package.json）；YY 分发时可带 bootstrap 说明：`python -m venv venv-gpt-researcher && venvScripts/pip install gpt-researcher`；升级到 0.16.0 需另测（0.12.3→0.16.0 跨 4 个 minor） |
| 2.6 | planning | MetaGPT / crewAI（SKILL.md:11） | crewai venv 已通（1.15.18）；metagpt 仅 0.1 旧版可装（新版依赖 `lancedb==0.4.0` 未发布） | PyPI：crewai 1.15.20、metagpt 0.8.2（新版装不上是 PyPI 发布链问题，非本机问题） | **venv 方案**：crewai `pip install crewai`；metagpt 诚实标注"现代版不可装，旧版可用" |
| 2.7 | review | qodo-ai/pr-agent + continue（SKILL.md:15） | 未部署。注意：**qodo-ai/pr-agent 仓库已迁移为 `the-pr-agent/pr-agent`**（README 实测 "community-maintained legacy project of Qodo"；GitHub API qodo-ai/pr-agent 仍可访问 12.9k★）；PyPI 有 `pr-agent 0.45.0`（非官方镜像，官方主推 Docker/GitHub Action） | GitHub: the-pr-agent/pr-agent；Docker Hub `pragent/pr-agent`（0.34.2 起新命名空间）；官方文档 https://docs.pr-agent.ai/ | **诚实标注**：CLI 本地跑需 Docker 或 `pip install pr-agent`（PyPI 0.45.0 为社区包，与官方 Docker 渠道不同源——装前自核）；YY 默认不装 |
| 2.8 | skill-sentinel | SkillSpector（SKILL.md:23） | **COMPETITOR-DEPLOYMENT.md 已过时**：当时"未发布"，现 **NVIDIA/SkillSpector 已开源且有 releases**（v2.11.0，2026-08-28 发布，GitHub API 实测 16.4k★，Apache-2.0） | 安装（README 实测）：`uv tool install git+https://github.com/NVIDIA/skillspector.git`；或 venv `pip install git+https://github.com/NVIDIA/skillspector.git`；Docker 可选；`skillspector mcp` 需装 `[mcp]` extra | **venv/uv tool 方案**：YY ONBOARDING 补该安装命令；regression S3 的 kernel marker（SkillSpector）从"对标"升级为"真调候选"——后续任务接线 |
| 2.9 | agent-vision-toolkit | OmniParser v2 + UI-TARS（SKILL.md:325） | **本机有 NVIDIA RTX 4060 Laptop 8GB VRAM**（nvidia-smi 实测）——非"无 GPU"，是"低 VRAM"：OmniParser v2 图标检测 YOLOv9-E 推理可行，caption 模型（Florence 系）8GB 勉强；UI-TARS-1.5-7B 全量推理 8GB 不足（需量化/4bit 或 HF endpoint） | OmniParser：`pip install -r requirements.txt` + HF 权重 `microsoft/OmniParser-v2.0`（https://huggingface.co/microsoft/OmniParser-v2.0）；UI-TARS：https://huggingface.co/ByteDance-Seed/UI-TARS-1.5-7B | **诚实标注"部分可装"**：RTX 4060 8GB → OmniParser 检测分支可试（低批长），UI-TARS 需量化或远程 endpoint；不预装，ONBOARDING 记录门槛 |
| 2.10 | be-architect / be-validator / sdlc / implementation / dev-planner | system-design-template 对标 / portman / cline+BMAD / opencode / （保留核心） | 方法论内嵌或已由 §1 CLI 覆盖；be-architect 为方法论对标（无独立可装内核） | COMPETITOR-DEPLOYMENT §5 矩阵 + 本机 PATH 实测 | 无新增依赖；be-validator 走 §1.4 portman |

## 3. F1-F5 实现依赖评估（PRD docs/TT-OWNER-UX-PRD.md）

| FR | 需要的能力 | 依赖结论（真实依据） |
|----|-----------|---------------------|
| F1 阶段导航 | journey.json 状态机 + ASCII 进度图 | **零新依赖**：Node 内置 fs/path 足够。PRD 明确"全部新增为纯 markdown + 原生 Node"（§2.3 决策 4）。纯 ASCII 图若想要更花哨可用 graph 库，但 ponytail 判定不值得——`@mermaid-js/mermaid-cli@11.17.0`（npm latest 实测；本机已装 11.16.0 但 mmdc shim 不在 PATH）仅渲染 Mermaid→SVG，与 owner 终端 ASCII 需求错位，**不引入** |
| F2 Prompt 注入 | commands/yy-*.md 命令文件 | **零新依赖**：纯 markdown + frontmatter（SuperClaude 30 命令先例，T17 已核验） |
| F3 报告白话化 | 术语→白话映射 + 报告模板 | **零新依赖**：复用 templates/completion-report.md 结构 + 白话视图段 |
| F4 多分支 | `--session <id>` 目录前缀 + summary-read 汇总 | **零新依赖**：fs.mkdirSync 命名空间；`claude-flow` 的向量记忆方案被 PRD 明确拒绝（T17 结论） |
| F5 资产透明化 | matrix CLUSTERS 具名注入 | **零新依赖**：scripts/lib/matrix.mjs 数据现成 |
| P7 语义验证（下期） | VLM 视觉抽样 | 暂不列（PRD 范围外）；若启动：复用 §1.1 playwright 截图链 + 外部 VLM API，无 npm 新依赖 |

## 4. 汇总：yy/package.json 依赖账本

**dependencies（装进包，`npm i` 即得）**：culori@^4.0.2、poline@^0.13.1、chroma-js@^3.2.0、tsyringe@^4.10.0、reflect-metadata@^0.2.2、tslib@^2.8.1、cockatiel@^4.0.0、polly-js@^1.8.3、playwright-core@^1.63.0
**optionalDependencies（可选，降级路径完整）**：inversify@^8.2.3、playwright@^1.63.0
**venv（Python 生态，随包 bootstrap 脚本/说明）**：gpt-researcher、crewai、（可选）skillspector
**系统级 CLI（ONBOARDING 注明，不进包）**：semgrep、gitleaks、portman、opencode/claude/codex、（可选）shadcn
**诚实标注不可装/受限**：metagpt 现代版（PyPI 依赖未发布）、UI-TARS 全量（8GB VRAM 不足）、bolt.new 上游停更（→ bolt.diy）、pr-agent 本地 Docker 未部署

> 依赖脚本 `scripts/audit-deps.mjs`：逐条 probe 本表依赖可用性（PATH/require/env），输出真实盘点结果，防本文档漂移。