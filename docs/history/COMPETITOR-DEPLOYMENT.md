# TT 竞品部署与整合现状（2026-09-01 实测）

> 目的：列出 TT 工作流已实际部署（非声明）的竞品及其调用点，供「直接使用竞品 vs TT 16 资产」择优决策。
> 方法：本机命令实测（--version / import / 真实执行），非文档声明。AI-Hub 根 = `D:\.ai-hub`（脚本经 `AIHUB_ROOT` env 读取）。

---

## 1. CLI 竞品（PATH / npm 全局）

| 竞品 | 版本 | 部署地址 | 真调脚本/适配器 | 状态 |
|------|------|----------|-----------------|------|
| opencode | 1.18.25 | `%AppData%\npm\opencode` | `scripts/lib/adapters/opencode.mjs`（assetConsumed + 空输出校验） | ✅ 真调（调用方式待改 `opencode run`） |
| portman | 1.35.0 | `%AppData%\npm\portman` | `scripts/lib/adapters/portman.mjs` | ✅ 真调（需 OpenAPI 契约源） |
| claude | 2.1.252 | `%AppData%\npm\claude` | `--exec` 宿主（免登录 = 用户级 `ANTHROPIC_AUTH_TOKEN=PROXY_MANAGED` + 本地代理 15724） | ✅ 可用 |
| codex | 0.151.0 | `%AppData%\npm\codex` | `--exec` 宿主候选 | ⚠️ exec 挂起（C-10，stdin 继承待修） |
| openclaw | 2026.7.1-2 | `%AppData%\npm\openclaw` | `scripts/exec-host-openclaw.mjs`（main agent=deepseek-v4-flash） | ✅ 真调 |
| semgrep | 1.175.0 | `C:\Python314\Scripts\semgrep.exe` | `scripts/security-scan.mjs` | ✅ 真扫（实测 0 发现） |
| gitleaks | v8 (go) | `C:\Users\Administrator\go\bin\gitleaks.exe` | `scripts/security-scan.mjs` | ✅ 真扫 |
| cline | clite 0.0.13 | npm | `scripts/lib/adapters/bmad-cline.mjs` | ⚠️ 未成熟（只探活，不真执行） |

## 2. 库竞品（`D:\.ai-hub\thirdparty\node_modules`）

| 库 | 对标 TT 资产 | 调用脚本 | 状态 |
|----|-------------|---------|------|
| culori | colorize | `scripts/color-palette.mjs`（oklch 和谐色 + WCAG 对比度） | ✅ 真算（实测 exit 0，对比度输出） |
| poline | colorize | 同上 | ✅ 真调（声学调色板） |
| chroma-js | colorize | `scripts/color-mix.mjs`（调暗/调亮/色相偏移/混色/对比度/色板） | ✅ 真调（实测 exit 0） |
| tsyringe / @inversifyjs | be-provider | `scripts/di-container.mjs`（tsyringe+inversify 双容器解析 LLM Provider 图） | ✅ 真调（实测 exit 0） |
| inversify / reflect-metadata / tslib | be-provider | 同上（inversify 分支 ESM 解析） | ✅ 真调（实测 exit 0） |
| cockatiel / polly-js | be-resilience | `scripts/resilience-check.mjs`（退避重试 + 熔断 + 等待重试） | ✅ 真调（实测 exit 0） |

## 3. Python venv 竞品（`D:\.ai-hub\thirdparty\`）

| 竞品 | venv | Python | 版本 | import | 对标 TT 资产 |
|------|------|--------|------|--------|-------------|
| gpt-researcher | `venv-gpt-researcher` | 3.10.10 | 0.12.3 | ✅ OK | agent-research（调研） |
| crewai | `venv-crewai-py311` | 3.11.15 | 1.15.18 | ✅ OK | planning（需求规划，metagpt 替代） |
| metagpt | `venv-metagpt` | 3.10.10 | 0.1（老版） | ✅ OK | planning（仅老版可装，现代版因 `lancedb==0.4.0` 未发布不可装） |

> 详见 `.claude/specs/tasks/reports/T1-report.md`（T1 修复实录）。

## 4. 源码竞品

| 竞品 | 地址 | 用途 |
|------|------|------|
| MUSE-Autoskill | `D:\.ai-hub\thirdparty\muse-autoskill` | F1-F5 自进化融合（asset-call-rate / SkillRefiner / SkillCreator） |

## 5. 资产×竞品整合矩阵（16 资产逐条）

| 资产 | Execution kernel（声明） | 实际整合 | 结论 |
|------|-------------------------|---------|------|
| implementation | opencode | ✅ 专用适配器真调 | 真整合 |
| be-validator | portman/contracteer | ✅ 专用适配器真调（需 OpenAPI 源） | 真整合 |
| sdlc | BMAD-METHOD + cline | ⚠️ BMAD 方法论内嵌；cline 仅探活 | 半整合 |
| security | semgrep + gitleaks | ✅ security-scan.mjs 真扫 | 真整合 |
| colorize | culori + chroma-js + poline | ✅ color-palette.mjs + color-mix.mjs 真算 | 真整合 |
| agent-research | gpt-researcher | ✅ venv 已通（T1） | 真整合 |
| planning | MetaGPT / crewAI | ✅ crewai venv 已通（T1） | 真整合 |
| frontend-design | shadcn-ui/ui + bolt.new | ❌ bolt.new 闭源、无 shadcn CLI；仅参考数据 | 未真接（T3 增强点） |
| review | qodo-ai/pr-agent + continue | ❌ pr-agent 需 Docker | 未部署 |
| skill-sentinel | NVIDIA/SkillSpector | ❌ SkillSpector 未发布；自带 Python 工具 | 半整合 |
| agent-vision-toolkit | OmniParser v2 + UI-TARS | ❌ 需 GPU | 未部署 |
| be-provider | tsyringe / InversifyJS | ✅ di-container.mjs 双容器真调 | 真整合 |
| be-resilience | cockatiel / Polly | ✅ resilience-check.mjs 真调 | 真整合 |
| be-architect | system-design-template | ⚠️ 方法论内嵌 | 半整合 |
| dev-planner | （保留核心） | — | TT 差异化 |
| frontend-visual-validation | playwright toHaveScreenshot | ⚠️ 依赖 playwright | 半整合 |

---

## 6. 结论与待办（供择优决策）

- **可直接顶替 TT 资产的真竞品**（已部署可用）：implementation→opencode、be-validator→portman、security→semgrep+gitleaks、colorize→culori/chroma-js、agent-research→gpt-researcher、planning→crewai、be-provider→tsyringe/inversify、be-resilience→cockatiel/polly-js。
- **已装待接脚本**：无（T5 已将 be-provider/be-resilience/colorize 三内核全部真调，见 `.claude/specs/tasks/reports/T5-report.md`）。
- **未部署（诚实标注）**：frontend-design→shadcn/bolt（bolt.new 闭源）、review→pr-agent（需 Docker）、skill-sentinel→SkillSpector（未发布）、agent-vision-toolkit→OmniParser/UI-TARS（需 GPU）。
- **用户关注点**：前端设计水平差 → T3 增强；允许直接用竞品 → T4 策略。
