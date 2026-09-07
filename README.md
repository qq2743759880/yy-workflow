# TT（Together Agent）v2.2.9 — 安装与快速上手

> 多 Agent 平台编排闭环方法论（开源通用版）。一个编排者调度多个 AI 平台并行完成大项目，并在每次执行后把经验回写本 skill 自进化。

**自包含版（自 v2.2.0 起）**：16 个增强资产（前端/设计/调研 + 后端 agent/工程）已随包内置在 `vendor/`，**无需任何外部 AI-Hub 即可离线使用**。任何用户把本目录整体拷走都能直接跑，不依赖网络、不依赖机器专属路径。当前版本 **v2.2.9**（2026-09-01，已装库真调脚本接线；完整演进见 CHANGELOG.md）。

---

## 目录

- [这是什么](#这是什么)
- [随包内置资产（16 个）](#随包内置资产16-个)
- [系统要求](#系统要求)
- [安装方式](#安装方式)
  - [A. WorkBuddy](#a-workbuddy)
  - [B. 通用 Agent 客户端](#b-通用-agent-客户端)
  - [C. 接入自己的 AI-Hub（可选）](#c-接入自己的-ai-hub可选)
- [安装后校验（强烈建议）](#安装后校验强烈建议)
- [配置说明](#配置说明)
- [目录结构](#目录结构)
- [快速上手（8 步闭环）](#快速上手8-步闭环)
- [可移植性说明](#可移植性说明)
- [开源协作](#开源协作)
- [许可证](#许可证)

---

## 这是什么

TT（Together Agent，前身 Tgent）把一整套经过实战沉淀的编排能力封装成可复用 skill：

1. **整合资产** → 需求文档化 → 任务拆解 → 任务×agent×skill×workflow×MCP 矩阵
2. **单/多平台并行派单** → 契约冻结 → 独立实证验收
3. **强制技术批判（竞品对标）** → 批判反哺自动优化（自进化闭环）

**给谁用**：想调度多个 AI 平台 / Agent 并行完成大项目、摆脱"单 Agent 单次对话"局限的人——独立开发者当团队用、团队并行开发、研究者跑调研流水线、AI 工具爱好者编排自有 agent。**核心价值**：一套可复制、可机验的编排纪律（验收不采信报告、批判必有竞品对标、契约冻结防返工），外加 16 个离线可用的自包含资产，任何拿到本目录的用户都能直接跑。

平台数 `N` 自适应：N≥2 走完整闭环；N=1 退化为「串行编排 + 换子 agent/换视角复验」，八步框架不变。

---

## 随包内置资产（16 个）

全部位于 `$SKILL_DIR/vendor/`（即本目录下的 `vendor/`），开箱即用，不依赖外部 AI-Hub：

| 类别 | 资产 | 竞品整合内核（Execution kernel，S3 漂移门校验） | 路径 |
|------|------|------|------|
| 核心规划 | dev-planner（只读规划 agent） | 保留核心（前提挑战/GWT/多视角评审，TT 差异化） | `vendor/dev-planner/dev-planner.md` |
| 需求挖掘簇 | planning（formal-prd + vibe-prd 双模式） | **MetaGPT** / **crewAI**（PRD 生成内核对标） | `vendor/planning/SKILL.md` |
| 前端设计簇 | frontend-design（五合一） | **shadcn-ui/ui** + **bolt.new**（组件底座/原型生成） | `vendor/frontend-design/SKILL.md` |
| 前端辅助 | colorize | **culori** + **chroma-js** + **poline**（色彩计算内核） | `vendor/colorize/SKILL.md` |
| 前端辅助 | frontend-visual-validation | **playwright toHaveScreenshot**（L0 像素）+ VLM（L1 语义抽样） | `vendor/frontend-visual-validation/SKILL.md` |
| 评审簇 | review（critique + be-tester + polish 三合一） | **qodo-ai/pr-agent** + **continue**（行级批注/规则即代码） | `vendor/review/SKILL.md` |
| 安全簇 | security（audit + harden + be-security 三合一） | **semgrep** + **gitleaks**（SAST/密钥扫描） | `vendor/security/SKILL.md` |
| 调研 | agent-research | **gpt-researcher**（自主 deep-research 对标） | `vendor/agent-research/SKILL.md` |
| 视觉质检 | agent-vision-toolkit | **OmniParser v2** + **UI-TARS**（VLM grounding） | `vendor/agent-vision-toolkit/SKILL.md` |
| 安全扫描 | skill-sentinel | **NVIDIA/SkillSpector**（对标）+ 自带 Python 工具 | `vendor/skill-sentinel/SKILL.md` |
| 后端工程 | sdlc（BMAD-METHOD 四阶段） | **BMAD-METHOD** + **cline** | `vendor/sdlc/SKILL.md` |
| 后端 agent（4） | be-architect / be-provider / be-resilience / be-validator | **system-design-template** / **tsyringe**+**InversifyJS** / **cockatiel**+**Polly** / **portman** | `vendor/be-*/<name>.md` |
| 实现簇 | implementation（dev-backend + be-implementer 合并） | **opencode** | `vendor/implementation/implementation.md` |

> 说明：资产**名字保留原名**（方法论身份 + 可被 `AIHUB_ROOT` 同名替换）；竞品作为**执行内核**整合在资产正文 `## Execution kernel` 段（内核声明 + probe + 降级），由 `regression-all` S3 漂移门（14 项）机器校验。

> **竞品直用策略（Competitor-first）**：当某任务所需竞品已部署且可用时（真实部署清单见 `docs/history/COMPETITOR-DEPLOYMENT.md`），允许编排者/执行 agent **直接调用竞品**（CLI/库/venv），TT 16 资产保留为方法论兜底；仅当 TT 资产有明确差异化优势时优先用 TT 资产（详见 SKILL.md §1 竞品直用策略）。

> 触发词与详细用法见 `SKILL.md`（description 段落）。

---

## 系统要求

- **Node.js ≥ 18**（脚本为零依赖 `.mjs`，仅需 `node` 运行；不装也能用本 skill，只是少了平台探测/结构校验脚本）。
- 任意支持「读取 `skills/<name>/SKILL.md`」的 Agent 客户端（WorkBuddy、Claude Code、Codex、Cursor、Roo Code 等）。

---

## 安装方式

### A. WorkBuddy

把整个 `tt` 目录复制到用户级技能目录：

```text
Windows : %USERPROFILE%\.workbuddy\skills\tt
macOS/Linux: ~/.workbuddy/skills/tt
```

然后**重启/刷新** WorkBuddy，在对话中输入 `/tt` 或描述「多 Agent 并行编排 / 任务拆解调度 / 跨平台契约冻结 / 任务验收批判」等需求即可触发。

### B. 通用 Agent 客户端

把 `tt` 目录放到对应客户端的 skills 目录（目录名必须是 `tt`）：

```text
Claude Code : ~/.claude/skills/tt        或  项目根/.claude/skills/tt
Codex       : ~/.codex/skills/tt
Cursor/Roo  : 参照各自 skills 目录约定
```

客户端加载 `SKILL.md` 的 frontmatter（`name` / `description` / `version`）后，会按 `description` 中的触发词自动启用。

### C. 接入自己的 AI-Hub（可选）

若你已有完整的 AI-Hub 资产中心，且想用其中**同名 skill** 而非随包副本：

- 设环境变量 `AIHUB_ROOT`（或在 `config.json` 里设 `aihubRoot`）指向你的 AI-Hub 根目录
- 本 skill 会优先引用 `$AIHUB_ROOT/skills/<name>/SKILL.md` 的外部版本
- **不设** `AIHUB_ROOT` → 全部走 `$SKILL_DIR/vendor/` 内置副本（默认、推荐、离线可用）

---

## 安装后校验（强烈建议）

```bash
cd <tt 目录>

# 1) 探测可用平台，结果写入 config.json
node scripts/detect-platforms.mjs

# 2) 校验本 skill 结构完整性
node scripts/validate-structure.mjs
```

`validate-structure.mjs` 会检查：

- `SKILL.md` frontmatter 合法（name/description/version）
- `vendor/` 16 个资产齐全（10 skill + 6 agent）
- **可移植性**：扫描 `SKILL.md`、脚本、README/ONBOARDING/模板是否残留本机绝对路径（盘符路径、用户目录、用户名等，正常应为 **0 泄露**）

全部通过即可放心使用。

---

## 配置说明

复制 `config.example.json` 为 `config.json` 并填写：

| 字段 | 说明 |
|------|------|
| `aihubRoot` | 默认 `~/.ai-hub`；设环境变量 `AIHUB_ROOT` 可覆盖（见安装方式 C） |
| `projectRoot` | 你的项目根目录，产物落点 |
| `memoryRoot` | 记忆中心；未设 `AIHUB_ROOT` 时回退为 `$SKILL_DIR/memory` |
| `platforms` | 平台列表与角色映射；也可让 `detect-platforms.mjs` 自动探测 |
| `model` | `fast` / `strong` 的 `baseUrl` 与 `model`；**API key 放环境变量或本机 `.env`，勿提交仓库** |
| `enhancedAssets` | 各增强资产的启用开关（`true` 表示启用对应随包资产） |

> 所有 `$VAR` 都由脚本/客户端解析，skill 内部**不硬编码任何机器路径**。

---

## 目录结构

```text
tt/
├── SKILL.md                 # 核心方法论（必须）
├── README.md                # 本文件
├── CHANGELOG.md             # 版本历史
├── ONBOARDING.md            # 上手流程
├── config.example.json      # 配置样例
├── LICENSE                  # MIT
├── assets/                  # 占位（可选）
├── docs/                    # 补充文档
│   ├── OPENSOURCE-PLAN.md   # 开源发布方案（面向维护者，见「开源协作」）
│   ├── TT-USER-PROMPT-GUIDE.md # 用户各阶段 Prompt 模板（触发 gate + 人工决策表）
│   └── history/             # 历史日志文档（开发期报告/spec/PRD，非开源必需）
├── scripts/                 # 零依赖 Node 脚本
│   ├── detect-platforms.mjs # 平台探测
│   ├── validate-structure.mjs # 结构/可移植性校验
│   └── sync.mjs             # 记忆与产物同步
├── templates/               # 完工报告/契约/批判等模板
└── vendor/                  # 16 个随包内置增强资产（自包含核心：10 skill + 6 agent）
    ├── dev-planner/         # agent：只读规划
    ├── planning/            # skill：formal-prd + vibe-prd（原 prd-writer + vibe-coding-prd）
    ├── frontend-design/     # skill：五合一前端设计簇（原 frontend-design + ui-ux-pro-max + taste-skill + pick-ui-library + prototype）
    ├── colorize/            # skill：前端配色
    ├── frontend-visual-validation/ # skill：浏览器视觉验证
    ├── review/              # skill：critique + be-tester + polish（原 critique + polish）
    ├── security/            # skill：audit + harden + be-security（原 audit + harden）
    ├── agent-research/      # skill：科研/深度调研
    ├── agent-vision-toolkit/# skill：视觉质检
    ├── skill-sentinel/      # skill：skill 包安全扫描
    ├── sdlc/                # skill：BMAD-METHOD 四阶段 + cline
    ├── be-architect/        # agent
    ├── be-provider/         # agent
    ├── be-resilience/       # agent
    ├── be-validator/        # agent：契约校验（portman/contracteer）
    └── implementation/      # agent：dev-backend + be-implementer 合并，执行内核接 opencode
```

---

## 快速上手（8 步闭环）

```text
0 资产整合     盘点平台 / skills / workflows / MCP / 项目记忆，映射各平台角色
1 需求文档化   需求挖掘 gate → PRD + 设计规范 + 技术架构 + 选型审计 + 任务总纲
2 重执行①      用户改进 → 只重做文档层（不回退已实施产物）
3 拆任务       dev-planner 拆成几十~上百 task，每 task 带 GWT 验收
4 重执行①②    用户改进 → 文档 + 重拆任务
5 规划         任务×agent×skill×workflow×MCP 矩阵 + 契约冻结时序 + 开工 prompt
6 重执行①②③   用户改进 → 文档 + 重拆 + 重规划
7 并行派单     多平台并行 → 员工写完工报告 → 编排者独立实证验收（可并行集动态调度）
8 批判反哺     每次验收强制技术批判（竞品对标）→ 结论反哺下一轮分配（自进化）
```

完整纪律、gate、契约冻结、前端 HTML 原型双 gate 等细节见 `SKILL.md`。

---

## 可移植性说明

- 本 skill **不依赖任何机器专属路径**；所有内置资产都以 `$SKILL_DIR`（= `SKILL.md` 所在目录）为根引用。
- 任意用户把 `tt` 目录整体拷贝到自己机器即可使用，**无需联网、无需 AI-Hub**。
- 已通过可移植性校验（`validate-structure.mjs` check ⑤：**0 泄露**）。
- 如需替换为自己的同名资产，仅设 `AIHUB_ROOT` 即可，不影响随包副本。

---

## 开源协作

TT 以 MIT 协议开源，欢迎任何用户、团队与研究者参与。详见 [`docs/OPENSOURCE-PLAN.md`](./docs/OPENSOURCE-PLAN.md)：

- **定位与场景**：方法论 + 编排内核 + 自包含资产包，给想调度多平台并行完成大项目的人（§1-2）。
- **快速上手**：安装 → 探测平台 → 跑第一个编排 → 看报告，与本文「快速上手」一致（§4）。
- **差异化卖点**：8 步闭环 / 契约冻结机器校验 / 竞品直用 / 16 自包含资产 / 零依赖脚本（§5）。
- **已知边界**：真实 LLM 执行需配置宿主；部分竞品不可部署已诚实标注（§6）。
- **贡献指南**：怎么加资产、怎么报 bug、开发环境 setup（§8）。

---

## 许可证

本 skill（TT）以 **MIT** 许可分发。`vendor/` 内各随包资产遵循其**原有许可证**，详见各资产目录内的 `LICENSE` / `NOTICE` 文件。分发时请保留各自版权与许可声明。
 
## 编排器用法（可选，Node ≥ 18）

编排内核 `scripts/orchestrator.mjs` 实现「路由 → 派单 → 契约 gate → 验收 → 报告」闭环，平台无关（纯 Node 零依赖）。执行后端三模式（`--backend`）：

- **auto（默认）**：有专用 CLI 适配器（opencode / cline / portman）且工具可用时走 CLI；**无专用适配器的资产自动回落内置 prompt 后端**——把资产顶层 `SKILL.md` 正文（frontmatter 剥离）+ 资产根目录 + 任务 + contract + 上游产物引用组装为子任务执行指令包 `artifacts/<subtaskId>/brief.md`（正文内的 `reference/*.md` 相对引用可凭「资产根目录」解析）。16 个资产全部可达，不再有「不可执行」资产。
- **prompt**：一律走内置 prompt 后端（纯本地、零外部依赖），产物为各子任务指令包。
- **cli**：只走专用 CLI 适配器；外部工具缺失时子任务诚实降级为 skipped 并标记 degraded。

```bash
node scripts/orchestrator.mjs --task "实现后端登录模块"
node scripts/orchestrator.mjs --task "实现后端登录模块" --backend prompt        # 纯本地，产出子任务指令包
node scripts/orchestrator.mjs --task "实现后端登录模块" --max-retries 3         # 执行超时重试 3 次（默认 2）
node scripts/orchestrator.mjs --task "实现后端登录模块" --dry-run --verbose    # 演练，零文件副作用
node scripts/orchestrator.mjs --task "实现后端登录模块" --validate              # 执行后跑结构回归
node scripts/orchestrator.mjs --plan --task "做一个学习平台"                     # 自动拆解 + 逐 task 审批（y/n/e/a）→ 冻结进编排
node scripts/orchestrator.mjs --plan --draft draft.json --task "..."            # 用已写好的拆解草案 JSON 审批（可跳过 LLM 拆解）
node scripts/orchestrator.mjs --plan --task "..." --exec node .../exec-host-a6api.mjs  # 以宿主 LLM 拆解产出草案
node scripts/orchestrator.mjs --resume                                           # 从上次 state.json 续跑（跳过已完成）
node scripts/orchestrator.mjs --resume --backend prompt                          # 以 prompt 后端重试上次 skipped/failed
node scripts/orchestrator.mjs --task "..." --workspace /path/to/project          # 产物落指定项目（默认 config.json 的 projectRoot）
node scripts/orchestrator.mjs --task "..." --exec opencode run                   # 配置宿主执行：brief 路径追加为最后参数，prompt 兜底升级为真实执行
node scripts/orchestrator.mjs --task "..." --exec opencode run --hosts "node .../exec-host-openclaw.mjs,node .../exec-host-a6api.mjs --model gpt-5.6-luna"   # 失败自动恢复：主宿主失败 → 自动换备选宿主 → 换模型(换视角)，全失败才诚实降级
node scripts/orchestrator.mjs --task "..." --contract ./openapi.json            # 提供 OpenAPI 契约：be-validator 真跑 portman 校验（契约本体以该文件为准，冻结文件记录 contractSource）
node scripts/orchestrator.mjs --task "..." --tui                                # 实时 DAG 视图（纯 ANSI 自绘：状态色 + spinner + 关键路径/等待阻塞反色高亮；仅叠加渲染，不改变执行语义）
node scripts/tt-tui.mjs --workspace <project>                                   # 独立复盘：轮询 .tt-state/state.json 渲染计划 DAG（低频 500ms；无 state 文件报错 exit 1）
node scripts/summary-read.mjs --workspace <project> --latest                    # 新会话恢复断点：打印最新 state-summary.json 全文（机器可读）
# 执行结束后自动产出机器可读 state 摘要 artifacts/<planId>/state-summary.json（schema tt/state-summary@1：
# 完成/阻塞/契约/批判 backlog，供新会话程序化拉取断点，不替代 memory-snapshot.md）——node scripts/summary-read.mjs --workspace <dir> --latest 即可恢复。失败路径也写（schema status='failed'）。
```

**终端 TUI 实时 DAG 视图（`--tui`，零依赖自绘）**：参考 turborepo-ui「逐行 ANSI 手绘任务树」思路（不引 ink/blessed/dagre，批判 C2 回灌）。每 phase 一行标题（`▸`），task 缩进树（`├─/└─`），dependsOn 行尾 `→ #n` 箭头标注依赖方向；状态色映射：待执行 dim/灰 · 执行中 cyan+spinner · 完成绿 · 失败红 · 跳过黄 · 降级（planned-only/prompt 兜底）红弱化 + ⚠。瓶颈高亮：关键路径（当前最长未完成依赖链）与等待阻塞（依赖未完成导致排队）用 `\x1b[1;7m` 加粗反色 + 行尾 `(CRITICAL)`/`(BLOCKING)`；底部汇总 `failed=N skipped=N degraded=N`。**非 TTY 降级**：`stdout` 非交互（CI 管道/重定向）时输出一次性静态 DAG 文本，退出码跟随执行结果（0 成功），不崩溃。**逃生舱**：`TT_TUI=off` 或 `--no-tui` 完全不渲染，行为与不带 `--tui` 完全一致。**退出复位**：结束前 `\x1b[0m` + 恢复光标 + 清屏归位，不残留终端转义脏状态。与 `--backend prompt`/`--exec`/`--plan`/`--resume` 均可组合（只叠加渲染）。独立复盘 `node scripts/tt-tui.mjs [--workspace PATH]` 与 `--tui` 共享同一渲染器（`scripts/lib/tui.mjs`）。

**a6api 参考宿主（真机 LLM，无需本地模型）**：用 `scripts/exec-host-a6api.mjs` 作 `--exec` 宿主，读 brief → 调 `api.a6api.com`（默认 model `DeepSeek-V4-Flash-0731`）→ 写 `plan.md` 到 brief 同目录（含资产名/方法论标题锚点，供 assetConsumed 校验）：

```powershell
# 一次性设置 key（只放环境变量，勿写仓库；PowerShell）
$env:A6API_KEY="sk-..."
# 直接以 a6api 宿主执行（宿主以 --workspace 为 cwd 运行，宿主脚本须用绝对路径；$PWD 须为 tt 目录）
node scripts/orchestrator.mjs --task "实现后端登录模块" --exec node "$PWD/scripts/exec-host-a6api.mjs"
# 或在 config.json 的 executor.command 里固化（改为 ["node","<TT目录>/scripts/exec-host-a6api.mjs"]），并设好 A6API_KEY
node scripts/orchestrator.mjs --task "实现后端登录模块"
```

**Outside Voice 跨模型批判（`--model`）**：a6api 宿主支持 `--model <id>` 指定第二模型作跨模型宿主——`--exec` 段内**未知 `--flag`/值会原样透传给宿主脚本**（遇到 `--task`/`--workspace` 等已知编排器参数才结束透传）：

```powershell
# 第二宿主用 gpt-5.6-luna 审同一任务，与默认 DeepSeek-V4-Flash-0731 对比分歧（结论落到各自的 plan.md）
node scripts/orchestrator.mjs --task "实现后端登录模块" --exec node "$PWD/scripts/exec-host-a6api.mjs" --model gpt-5.6-luna
# config 固化方式（参数一并写进 command 数组）：
#   ["node","<TT目录>/scripts/exec-host-a6api.mjs","--model","gpt-5.6-luna"]
```

> 用途：不同模型审同一 brief，独立产出 plan.md 后人工/编排器对比分歧点，规避单一模型盲区；plan.md 头部标注实际使用模型，便于核对。缺 `--model` 时回落默认 `DeepSeek-V4-Flash-0731`。

**失败自动恢复（`--hosts` 换宿主 / 换视角）**：子任务执行失败时按「同一宿主重试 → 换宿主重试 → 换模型(视角)重试 → 诚实降级」逐级升级，减少人工介入。三档递进：

1. **同一宿主重试**（既有 `withRetry`）：`TimeoutError`/`RetryableError` 指数退避重试（`--max-retries` 控制），保持 2.5.0 语义。
2. **换宿主重试**：主宿主（`--exec` 或 `config.json executor.command`）超时/宿主无输出/上游不可用等诚实降级失败 → 自动用 `--hosts`（或 `config.json executor.hosts`，优先级低于命令行）里的备选宿主重跑同一 brief；记录 `subtask.recovery = [{ stage:'host-switch', from, to, attempt }]`。
3. **换视角重试（跨模型）**：宿主支持 `--model` 透传时（如 `exec-host-a6api.mjs`），`--hosts` 每项可带 `--model <id>` 后缀，同一宿主不同模型视为换视角重试，`subtask.recovery` 记 `stage:'model-switch'`。

全部宿主失败 → 不直接中止，按现有语义诚实降级（`degraded: true` + warning，子任务 `mode=prompt` 仅指令包）；`requireExec` 资产保持强制语义不变。恢复尝试计入 `subtask.attempts` 与 `execution-feedback.md`。

```powershell
# 主宿主(a6api)失败 → 自动换 openclaw → 再换 a6api gpt-5.6-luna（换视角）
node scripts/orchestrator.mjs --task "实现后端登录模块" --exec node "$PWD/scripts/exec-host-a6api.mjs" --hosts "node $PWD/scripts/exec-host-openclaw.mjs,node $PWD/scripts/exec-host-a6api.mjs --model gpt-5.6-luna"
# 也可不传 --exec，仅用 --hosts 兜底链
node scripts/orchestrator.mjs --task "实现后端登录模块" --backend prompt --hosts "node $PWD/scripts/exec-host-a6api.mjs,node $PWD/scripts/exec-host-openclaw.mjs"
# config 固化方式：executor.hosts = [ ["node","<TT目录>/scripts/exec-host-openclaw.mjs"], ["node","<TT目录>/scripts/exec-host-a6api.mjs","--model","gpt-5.6-luna"] ]
```

### 宿主认证备忘（真实教训，2026-08-31）

| 宿主 | 免登录/认证机制 | 教训 |
|---|---|---|
| **claude CLI** | 用户级 `ANTHROPIC_AUTH_TOKEN=PROXY_MANAGED`（cc-switch 本地代理放行）→ 交互式 TUI 免 `/login`；`-p` 模式用 `~/.claude/settings.json` env 的 `ANTHROPIC_API_KEY`；`~/.claude/config.json` 的 `primaryApiKey` | **cc-switch/Claude 管理的 `~/.claude/settings.json` 等配置文件，编排者不得擅自加字段**（曾误加 `modelOverrides`/`model` 致 `Not logged in`，删除后恢复）。`-p` 用 env key，TUI 检查 OAuth——无 `.credentials.json` 时需 AUTH_TOKEN 或 TUI 里 `/login` 选 API key 粘贴 `PROXY_MANAGED` 一次 |
| **codex CLI** | 走 cc-switch 本地代理 15724 + `gpt-5.6-luna`（用户验证可用） | `@openai/codex-win32-x64` 缺失时 `npm install -g @openai/codex@latest` 补装；exec 挂起多因 stdin 继承，用 `--exec`（stdio ignore）或关闭 stdin |
| **openclaw CLI** | 本地 agent `deepseek-v4-flash`，`openclaw agent --agent main --message-file <brief> --json` | `--model` 测试可能触发 openclaw 写入空模型项致 `config is invalid`——用 `openclaw config validate` 检查，出问题删空模型项（备份后） |
| **a6api 参考宿主** | `A6API_KEY` env，`--model <id>` 跨模型 | key 走 env 禁写仓库 |

### 多宿主统一探测 + 通用宿主（2026-09-05，只读接入，绝不改宿主配置）

- **`node scripts/exec-host-probe.mjs`**：只读探测本机可用 AI CLI 宿主（opencode/claude/codex/cursor/trae/openclaw/a6api）——只跑 `--version` 类命令，不写任何配置、不改环境、不登录。输出 JSON（name/command/version/available/note）。探测失败不崩（available=false 如实记录）。
- **`node scripts/exec-host-generic.mjs --cli claude|codex|cursor|trae --brief <brief.md>`**：通用宿主——读 brief → 以该 CLI 的**非交互调用**（brief 内容经 stdin 喂入防 argv 超长；spawn stdio 显式接管 + 结束后关闭 stdin 防挂起）→ 捕获输出写 plan.md（含资产锚点+内核词，仿 openclaw/a6api 宿主）→ 超时/失败诚实 exit 1。**只经 CLI 参数 + 进程 env 接入，绝不写宿主配置文件**（claude settings / codex config / cc-switch 一律只读）。

```powershell
# 探测本机宿主（只读）
node scripts/exec-host-probe.mjs
node scripts/exec-host-probe.mjs --only claude,codex --json

# 以 claude 为宿主执行一个 brief（用你现有 env 认证，不写 ~/.claude）
node scripts/exec-host-generic.mjs --cli claude --brief <path>\brief.md --timeout 180000
# 以 codex 为宿主（codex exec 子命令非交互；若挂起如实报 TIMEOUT，不尝试改其代理配置）
node scripts/exec-host-generic.mjs --cli codex --brief <path>\brief.md
```

> **红线**：claude/codex/cursor 等宿主配置由用户/cc-switch 管理，TT 只允许只读探测 + CLI 参数接入。若某 CLI 无干净非交互模式（如 cursor/trae 的部分场景），probe 如实标注 `no-noninteractive-cli`，不强接。

> 通用：**改任何用户代理体系（cc-switch/Claude/Codex/OpenClaw）管理的配置文件前先备份，改动最小化，出问题可回滚**。编排者只应通过 env/CLI 参数接入宿主，不写宿主配置文件。

> 缺 `A6API_KEY` 时宿主会明确报错并 exit 1（编排器诚实回退 brief-only，不假报执行）；key 仅从 `process.env.A6API_KEY` 读取，仓库内不得出现任何 key 值。

**openclaw 真机宿主（本地 agent，无需任何 key）**：用 `scripts/exec-host-openclaw.mjs` 作 `--exec` 宿主，读 brief → 写临时 message 文件 → spawn 本机 `openclaw agent --agent main --message-file <tmp> --json`（cwd 继承，超时 180s）→ 解析 `result.payloads[0].text` 原样写 `plan.md` 到 brief 同目录（含方法论标题锚点，供 assetConsumed 校验）。模型由 openclaw 本机 agent 配置决定（本机已配 deepseek-v4-flash），不写死任何 key：

```powershell
# 直接以 openclaw 真机宿主执行（宿主以 --workspace 为 cwd 运行，宿主脚本须用绝对路径；$PWD 须为 tt 目录）
node scripts/orchestrator.mjs --task "实现后端登录模块" --exec node "$PWD/scripts/exec-host-openclaw.mjs"
# 或在 config.json 的 executor.command 里固化（改为 ["node","<TT目录>/scripts/exec-host-openclaw.mjs"]）
```

> openclaw 宿主超时（默认 180s）/失败/空回复 → 明确报错 exit 1（编排器诚实回退 brief-only，不假报执行）；临时 message 文件用后即删；Windows 下 openclaw 为 .cmd shim，宿主自动走 shell 调用。

> 宿主执行（消费链闭环，可选）：`--exec PROG [ARGS...]` 或 `config.json` 的 `executor.command`（数组）指定宿主 CLI；prompt 后端写出 `brief.md` 后会把 brief 绝对路径作为**最后一个参数**投喂宿主，stdout 捕获到 `result.txt`，该子任务标记 `mode: exec`（真实执行）。宿主超时（`--exec-timeout N` 毫秒，或 `config.json executor.timeoutMs`，默认 600s）/无实质输出/失败 → 诚实回落 `brief-only`（`mode: prompt` + degraded），不假报成功。空命令 = 仅产出指令包（默认）。

> Windows 下若 `--task` 含中文且显示乱码：先执行 `chcp 65001` 再运行（GBK 控制台会把 argv 按本地代码页传给 Node）。

编排内核执行路由、契约 gate 与状态记录，报告写在 `artifacts/report-<planId>.md`（产物与状态默认落在 `config.json` 的 `projectRoot` 下，未配置则为当前目录；可用 `--workspace` 指定）；`--dry-run` 不写任何文件；外部执行工具（opencode/cline/portman）缺失时子任务降级为 skipped / planned-only 并明确标注 degraded，绝不假报成功。**契约冻结机器校验**：每次执行把 plan 契约冻结为 `contracts/<planId>.json`，`gate` 在每个子任务执行前后做 hash 比对，执行期契约被篡改 → **exit 4**（`--dry-run` 不写）。**执行模式诚实标注**：报告与 `state.json` 中每个子任务带 `mode` 字段——`exec`（宿主真实执行）/ `cli`（专用 CLI 执行）/ `prompt`（内置指令包兜底，产物为 brief.md，需宿主消费）/ `planned-only`（cli 缺失仅记录 BMAD 阶段计划）/ `skipped`；markdown 报告含执行摘要，提示 `prompt`/`planned-only` 未真实执行，防止误读为已完成。**超时与重试已解耦**：真实执行调用（opencode/cline）超时抛 `TimeoutError` 由 withRetry 指数退避重试（`--max-retries` 控制），工具探测（--version）超时保持降级语义。退出码：0 成功 / 2 参数错误 / 3 模块未实现 / 4 契约违约 / 5 执行失败。

当前资产为 16 个：10 个 skill（含 frontend-design、planning、review、security、sdlc）+ 6 个 agent（含 implementation、be-validator、dev-planner 等），详见上文资产表。

回归测试（一键卡点）：`node scripts/regression-all.mjs`（六段全绿：结构校验 / 超时重试 / 契约工作流 / 宿主执行 / 资产缓存 / Phase2 替换清单，任一失败 exit 1）；单段命令：`node scripts/validate-structure.mjs`（16 资产结构）/ `node scripts/test-retry.mjs`（P3 超时与重试解耦，6 用例，exit 0 全过）。

**批判反哺自动化（review-gate `--auto-register`）**：批判闸门校验通过后自动完成「登记 tracker + 生成优化任务文档」，把批判结论从人工回写变为自动沉淀（TT §5.6 / §7 硬闸门机验化）。

```bash
node scripts/review-gate.mjs --auto-register <产物目录> --id <taskNN>
# 校验通过（有效批判≥3 含 URL+日期 / 优化修改方案存在 / tracker 就绪）后自动：
#  1) 解析 task{id}-技术批判.md 每条有效批判 → 追加 plans/critique-backlog-tracker.md 新行
#     （新序号延续现有 C-13/C-14…，状态 ⬜ 待落地，来源=文件名+日期）
#  2) 逐条生成 docs/history/tasks/critique-<序号>-task.md 优化任务文档
#     （修复措施 / 落点 / 验收指标 / 引用原批判文件与竞品 URL），作为可派单的 task 草案
# 幂等：按「来源文件名+批判标题」查重，重跑不重复登记、不重复生成文档。
# 未过闸门 → 仍 exit 1 且不登记；--dir/--id 不带 --auto-register 行为不变；--self-test 含自动登记幂等自测。
```

解析兼容三种批判写法：模板表格（`批判点/竞品对标/优化方案/级别`）、`## C1/C2/…` 分节、数字列表（`1. …`）；无 URL 或日期者按闸门规则判无效、跳过登记。写入保持 UTF-8 无 BOM + LF。

**监控驱动自动优化（asset-call-rate 阈值触发三级动作，MUSE F1-F5 自进化）**：消费率 < 50% 的资产不再只报告，而是自动执行动作——低调用率自动标记 / 持续低调用率建议降级 / 自动登记 tracker：

```bash
node scripts/asset-call-rate.mjs --state <project>/.tt-state/state.json        # 报告 + auto-actions.json 生成（tracker 仅 dry-run 打印）
node scripts/asset-call-rate.mjs --state <project>/.tt-state/state.json --apply # 显式 --apply：写回 auto-actions.json + 登记 tracker
node scripts/asset-call-rate.mjs --task "实现后端登录模块" [--apply]            # 自动跑 orchestrator 后统计（用法不变）
```

三级动作语义：

1. **低调用率自动标记**：每次运行把消费率 < 50% 的资产写入 `<workspace>/.tt-state/auto-actions.json`（资产 / 调用率 / 动作建议 / 触发时间），报告末尾追加「自动动作清单」。
2. **建议降级**：按 auto-actions.json 历史累计触发，同一资产跨 ≥2 次运行仍低调用率 → 动作升级为「建议降级为 optional」并打印（**不自动改 SKILL**，留人工审查）。
3. **自动登记**：`--apply` 时把新发现的低调用率资产登记进 `plans/critique-backlog-tracker.md`（新 C-xx 行、状态 ⬜、来源标注 `asset-call-rate`），与批判反哺共享同一 tracker；**幂等**（按「资产名+触发日期」查重，重跑不重复登记）。缺省（不带 `--apply`）只打印待登记，不改 tracker。

> 说明：auto-actions.json 每次运行都会生成/更新（作为跨运行触发历史，供②升级判断）；`--apply` 与缺省模式的差异只在**是否真正改写 tracker 文件**。退出码语义保持：有需审查资产 exit 1（信息，不阻断 CI）。

