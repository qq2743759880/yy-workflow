# AS-0 五源许可证核查 + superpowers 选品清单

调研 agent：AS-0（L1 独立只读调研，全新上下文）。日期：2026-09-24。
网络通道：api.github.com / registry.npmjs.org / raw.githubusercontent.com / npm pack（WebSearch 全环境不可用，未使用）。
白名单遵守：零仓库源文件改动、零 git 写操作；superpowers clone 仅入系统临时目录。

状态：调研进行中（边跑边写）。

---

## 1. claude-task-master（npm task-master-ai@0.43.1）——【有条件】可引入

### 实测证据
- npm 拆包：`npm pack task-master-ai` → `task-master-ai-0.43.1.tgz`（2026-09-24，包内仅一个 LICENSE 文件 `package/LICENSE`）。
- GitHub 仓库 `eyaltoledano/claude-task-master`（default branch `main`）根 `LICENSE` 与 npm 包 LICENSE 内容一致；GitHub API license 字段 `spdx_id: NOASSERTION`（与 R3 实测一致，原因是 LICENSE 非标准 SPDX 单许可文本）。
- LICENSE 原文关键段（【实测】逐字摘录）：
  1. 正文开头为标准 **MIT License**（Copyright (c) 2025 — Eyal Toledano, Ralph Khreish），授予 use/copy/modify/merge/publish/distribute/sublicense/sell……
  2. 随后附 **"Commons Clause" License Condition v1.0**：`the grant of rights under the License will not include, and the License does not grant to you, the right to Sell the Software.`
  3. **适用范围原文（决定性条款）**：`Software: All Task Master associated files (including all files in the GitHub repository "claude-task-master" and in the npm package "task-master-ai").`
  4. `License: MIT`；`Licensor: Eyal Toledano, Ralph Khreish`

### 结论：templates/schema 目录是否受 Commons-Clause 约束？
**受约束。【实测】** LICENSE 的 Software 定义显式覆盖"GitHub 仓库与 npm 包内**所有文件**"，不存在对 templates/ 或 schema 目录的豁免。即 templates 与 task schema 均为 **MIT + Commons Clause**，而非纯 MIT。

### 引入方式是否合法？
- Commons Clause **只剥夺一项权利：Sell**（"对第三方收费/有偿提供，作为价值主要源自该软件的产品或服务的一部分"，含 hosting/consulting）；copy/modify/merge/distribute 等 MIT 权利全部保留。
- 本项目 vendor 其 templates/ + task schema（`src/schemas/`、`packages/tm-core/src/common/schemas/`、`src/prompts/schemas/` 均在仓库内）→ 属 MIT 允许的 copy/modify，**合法**。
- 附加义务：任何 license notice / attribution 必须一并带上 Commons Clause notice（LICENSE 原文：`Any license notice or attribution required by the License must also include this Commons Clause License Condition notice.`）。

### 风险
- 【推断】若未来 yy 项目本身被**有偿**销售/托管服务化，则 vendor 物触发 Sell 禁令；需届时移除或换源。
- 【推断】分发 vendor 物时须原样携带 LICENSE（含 Commons Clause），否则丢署名义务。

### 结论：**有条件可引入**（【实测】LICENSE 原文依据；条件=不 Sell + 携带完整许可声明；vendor 范围照旧仅 templates/ + schema 目录，不入运行时依赖）。

---

## 2. github/spec-kit ——【可引入】

### 实测证据
- GitHub API `repos/github/spec-kit`：`license.spdx_id: "MIT"`，default branch `main`（pushed_at 2026-09-24）。
- `raw.githubusercontent.com/github/spec-kit/main/LICENSE` 原文开头（【实测】逐字）：`MIT License` / `Copyright GitHub, Inc.`，随后为标准 MIT 授权条款（use/copy/modify/merge/publish/distribute/sublicense/sell…），无任何附加条款。
- `templates/` 目录清单（【实测】GitHub contents API，2026-09-24）：
  - 顶层：`checklist-template.md`、`constitution-template.md`、`plan-template.md`、`spec-template.md`、`tasks-template.md`、`commands/`（dir）、`vscode-settings.json`
  - `templates/commands/`（10 个命令模板）：`analyze.md`、`checklist.md`、`clarify.md`、`constitution.md`、`converge.md`、`implement.md`、`plan.md`、`specify.md`、`tasks.md`、`taskstoissues.md`
  - 相关可选项（同 MIT）：`presets/self-test/templates/`（checklist/constitution/plan/spec/tasks 模板）、`presets/scaffold/templates/`（myext/spec 模板）

### 引入方式是否合法？
仅 vendor 模板文件（templates/ 目录）→ MIT 允许 copy/modify/distribute，**合法**。义务：保留版权与许可声明（MIT 原文 `The above copyright notice and this permission notice shall be included...`）。

### 风险
- 【推断】极低。MIT 无传染、无领域限制；模板为 .md 文本，无运行时依赖。

### 结论：**可引入**（【实测】LICENSE 原文 = 标准 MIT，Copyright GitHub, Inc.）。

---

## 3. cisco-ai-defense/skill-scanner ——【可引入】

### 实测证据
- `raw.githubusercontent.com/cisco-ai-defense/skill-scanner/main/LICENSE` 全文仅 17 行（【实测】），为 **Apache License 2.0 标准短头版**：`Copyright 2026 Cisco Systems, Inc. and its affiliates`，标准 Apache-2.0 授权段落，**无 appendix/附加条款**。
- `pyproject.toml`（【实测】）：`license = {text = "Apache-2.0"}`；`requires-python = ">=3.11,<3.15"`。
- GitHub API license 字段显示 `NOASSERTION`——经 LICENSE 原文比对为识别误报（17 行短头版 Apache，GitHub license 检测库未识别），实际许可即 Apache-2.0（【实测】原文 + pyproject 双证）。
- CLI 入口（【实测】`[project.scripts]`）：
  - `skill-scanner = "skill_scanner.cli.cli:main"`
  - `skill-scanner-api = "skill_scanner.api.api_cli:main"`
  - `skill-scanner-pre-commit = "skill_scanner.hooks.pre_commit:main"`

### Windows 可用性
- 【推断】Python 项目、console_scripts 入口点为跨平台 Python 包装，`pip install` 后在 Windows 可生成 `skill-scanner.exe` shim；仓库含 `Makefile`/`Formula`(Homebrew) 但 CLI 本体不依赖 Unix-only 组件。
- 【推断】版本号经 hatch-vcs 从 git tag 派生——从"无 .git 的全仓拷贝"安装可能版本解析失败；vendor 时保留 git 元数据或设 `SETUPTOOLS_SCM_PRETEND_VERSION` 等价物（hatch-vcs 对应环境变量）规避。
- 【推断】部分扫描器功能（LLM 类检测）需配置 AI provider key（可选依赖组 google/azure/bedrock/vertex），基础检测不依赖。

### 引入方式是否合法？
计划为"git clone --depth 1 全仓 vendor"→ Apache-2.0 允许（保留 NOTICE/版权声明即可）。**合法**。

### 风险
- 【推断】低。Apache-2.0 有专利授权条款且无传染；唯一义务是携带 LICENSE 与 NOTICE。

### 结论：**可引入**（【实测】LICENSE 原文 + pyproject；Windows 路径为 pip/console-script，标注推断）。

---

## 4. semgrep ——【可引入】（仅作独立进程调用，不 vendor 源码）

### 实测证据
- PyPI `semgrep`（【实测】PyPI JSON API，2026-09-24）：`version: 1.178.0`，`license_expression: "LGPL-2.1-or-later"`。
- Windows 支持（【实测】PyPI classifiers 原文摘录）：`Operating System :: Microsoft :: Windows`（同时有 MacOS/POSIX）；`requires_python >=3.10`。→ **Windows 安装路径 = pip**（`pip install semgrep`）。
- npm 包名陷阱（【实测】registry.npmjs.org/semgrep）：npm 上名为 `semgrep` 的包是 `license: ISC`、`version 0.0.1`、描述 "a npm module for semgrep tool" 的**占位包，非官方**。官方分发渠道只有 PyPI/二进制。→ 引入施工必须走 pip，**禁止 `npm install semgrep`**。

### LGPL-2.1 独立进程调用无传染——复核结论
- LGPL-2.1-or-later 的传染性约束针对**链接/衍生作品**（LGPL 第 2、4 条对库的修改与反向工程信息义务；GPL-like 传染仅在被衍生作品时触发）。
- 【推断】本项目用法 = `spawn semgrep --json`（子进程 + stdout JSON 交换，无 import/link/进程内调用），形成"聚合"(mere aggregation) 而非衍生作品，**无传染**。R3 既有结论复核通过。
- 【实测】semgrep 本体按其公开结构为 LGPL 的引擎 + 独立 ruleset；ruleset 文件（`--config` 加载的 YAML）以配置数据形式输入，不构成链接。

### 引入方式是否合法？
npm/pip 依赖、非 vendor → 合法。【推断】`vendor/security-ruleset/` 固定 ruleset 若拷自 semgrep 官方规则仓库需单独核该仓库许可（本单未覆盖，AS-2 施工时确认来源与许可）。

### 风险
- 【推断】低。唯一注意：不修改 semgrep 本体、不静态链接、独立进程 + JSON 边界保持干净。

### 结论：**可引入**（【实测】LGPL-2.1-or-later + Windows classifier；无传染结论为【推断】复核，机制=独立进程聚合）。

---

## 5. Spectral（@stoplight/spectral-cli）+ Schemathesis ——【可引入】

### 实测证据
- Spectral（【实测】registry.npmjs.org）：`@stoplight/spectral-cli` latest `6.16.3`，license 字段 `Apache-2.0`；npm pack 拆包验证包内捆绑 `package/LICENSE` 为 **Apache License 2.0 全文**（2026-09-24）。
- Schemathesis（【实测】PyPI JSON API）：`schemathesis` `version: 4.28.0`，`license_expression: "MIT"`；classifiers `Operating System :: OS Independent`。
- Windows npm 安装实测（【实测】本机 win32 10.0.19044 / Git Bash，2026-09-24）：
  - `npm install @stoplight/spectral-cli --no-audit --no-fund` → 安装成功（仅 @scarf/scarf postinstall 被 allow-scripts 拦截的警告，不影响 CLI）。
  - `node_modules/.bin/spectral --version` → `6.16.3` 正常输出。
- 注意（【实测】）：Spectral 依赖树含 `@scarf/scarf`（安装遥测），安装时 postinstall 被拦即可；如需彻底关闭可设环境变量 `SCARF_ANALYTICS=false`。

### 引入方式是否合法？
两者均为 npm/pip 依赖非 vendor → Apache-2.0 / MIT 均允许，**合法**。计划中 `vendor/be-validator/rulesets/` 自带 ruleset 为自写 YAML，不涉第三方许可（若有拷自 Spectral 官方 ruleset 则按 Apache-2.0 携带声明即可）。

### 风险
- 【推断】极低。Schemathesis 为 python 可选后置（pip install schemathesis，OS Independent）。

### 结论：**可引入**（【实测】双许可原文/字段 + Windows 安装运行实测）。

---

## 6. obra/superpowers ——【可引入】（部分 vendor，选品决策归 Owner）

### 实测证据
- clone（【实测】2026-09-24，`git clone --depth 1`，仅入系统临时目录，未入仓库）：
  - 临时目录路径（后续 vendor 复用）：`C:\Users\Administrator\AppData\Local\Temp\as0-superpowers`
  - commit hash：`5bf4e78011075bcfc0dc295f0724994cd123ee71`（2026-09-18，"Release v6.4.1: diagnosing-superpowers, Native plan execution, OpenCode 2.0 and Muse support (#2338)"）
- LICENSE（【实测】原文开头）：`MIT License` / `Copyright (c) 2025 Jesse Vincent`。

### skills/ 全清单（15 个，【实测】目录扫描；一句话功能取自各 SKILL.md frontmatter description）
| # | skill | 一句话功能 |
|---|---|---|
| 1 | brainstorming | 任何创造性工作（新功能/改行为）之前，先探索用户意图、需求与设计 |
| 2 | diagnosing-superpowers | superpowers 会话出问题时（重复劳动/无视计划/结果差）诊断原因并产出 bug report |
| 3 | dispatching-parallel-agents | 面对无共享状态的 2+ 独立任务时并行派发子代理 |
| 4 | executing-plans | 在当前会话内亲自执行实施计划（无子代理工具时的内联执行路径） |
| 5 | finishing-a-development-branch | 实现完成且测试全过后，决定如何集成该开发分支 |
| 6 | receiving-code-review | 接收 code review 反馈时保持技术严谨与验证，不盲目同意/实现 |
| 7 | requesting-code-review | 完成任务/大功能/合并前发起 code review 以验证符合需求 |
| 8 | subagent-driven-development | 用子代理执行含独立任务的实施计划（编排路径） |
| 9 | systematic-debugging | 遇到任何 bug/测试失败/异常行为时，先系统化定位根因再修 |
| 10 | test-driven-development | 实现任何 feature/bugfix 前先写测试（红-绿循环纪律） |
| 11 | using-git-worktrees | 功能开发需要隔离工作区时，经原生工具或 git worktree 兜底建立隔离 |
| 12 | using-superpowers | 每次会话开始时建立"先调技能再响应"的技能查找/使用习惯 |
| 13 | verification-before-completion | 声称"完成/修好/通过"之前必须先跑验证命令并确认输出（证据先于断言） |
| 14 | writing-plans | 拿到 spec/需求后、动代码之前，为多步任务写实施计划 |
| 15 | writing-skills | 创建/编辑技能并在部署前验证其有效性 |

### 推荐短名单（3-5 个；按执行计划 §四"候选：TDD 纪律/debugging/planning 类"对齐 16 槽位需求。**决策留给 Owner，本单不代签**）
1. **test-driven-development**（含 writing-good-tests.md）——直接命中"TDD 纪律"槽位；管线各资产探针均要求先测后码，纪律可复用。
2. **systematic-debugging**（含 root-cause-tracing/defense-in-depth 等参考件，目录最厚）——命中 debugging 类；与门禁失败后的根因流程互补。
3. **writing-plans**（含 plan-document-reviewer-prompt.md）——命中 planning 类；与 TK-1 task 模板 v2 / §五任务结构同构，可作计划质量参照。
4. **verification-before-completion**——单文件、零依赖；与管线"自称 DONE 禁令/证据先于断言"纪律完全同频，接入成本最低。
5. （备选第 5）**receiving-code-review**——review 槽位相关；但管线已有 review-bugbot 宿主技能，存在功能重叠，仅当 Owner 想强化"反馈消化"侧时选。
- 不推荐首批：brainstorming/using-superpowers（会话级行为植入，与本管线编排耦合）、dispatching-parallel-agents/subagent-driven-development（与既有编排器职责重叠）、diagnosing-superpowers（面向 superpowers 自身，错配）、using-git-worktrees/finishing-a-development-branch（工作流特化）、writing-skills（本仓库技能制作已自有规范）。

### 风险
- 【推断】极低：MIT，仅拷选中 skill 目录 + SKILL.md 指针，保留版权声明即可。

---

## 7. 结论汇总表

| 源 | 许可（实测原文依据） | 引入方式 | 结论 | 关键条件/风险 |
|---|---|---|---|---|
| claude-task-master (task-master-ai@0.43.1) | MIT + Commons Clause（LICENSE 原文显式覆盖仓库与 npm 包**所有文件**） | 仅 vendor templates/ + schema 目录 | **有条件** | 不 Sell；分发须携带含 Commons Clause 的完整许可声明；【实测】 |
| github/spec-kit | MIT（Copyright GitHub, Inc.） | 仅 vendor templates/ | **可引入** | 保留版权/许可声明；【实测】 |
| cisco-ai-defense/skill-scanner | Apache-2.0（LICENSE 17 行短头版，无附加条款；GitHub API NOASSERTION 为识别误报） | 全仓 vendor | **可引入** | 携带 LICENSE；hatch-vcs 版本派生需 git 元数据或预置版本变量【推断】；Windows 走 pip console-script【推断】 |
| semgrep | LGPL-2.1-or-later（PyPI 1.178.0） | pip 依赖，独立进程调用 | **可引入** | spawn+JSON=聚合无传染【推断】；禁用 npm "semgrep"（ISC 占位假包，实测）；官方 ruleset 来源许可 AS-2 时补核 |
| Spectral @stoplight/spectral-cli@6.16.3 | Apache-2.0（npm 字段 + 包内 LICENSE 全文实测） | npm 依赖 | **可引入** | Windows 安装+运行实测通过；@scarf 遥测 postinstall 已被拦 |
| Schemathesis 4.28.0 | MIT（PyPI license_expression 实测） | pip 依赖（可选后置） | **可引入** | OS Independent |
| obra/superpowers v6.4.1 (5bf4e78) | MIT（Copyright (c) 2025 Jesse Vincent） | 部分 vendor 3-5 个 skill 目录 | **可引入**（选品归 Owner） | 保留版权声明；推荐短名单见 §6 |

执行计划遗留疑点回应：
- §八.7"task-master npm 包含 Commons-Clause"——**确认属实**（【实测】原文），且范围条款明示覆盖全部文件，templates 不豁免；vendor 仍可行（Commons Clause 仅禁 Sell）。
- §八.5"semgrep LGPL-2.1 独立进程无传染"——**复核通过**（结论留档 §4）。
- 新发现：npm `semgrep` 为占位假包（ISC），施工单须写明 pip 渠道。

偏差记录：
- 无白名单外操作。clone 与 npm pack 均在系统临时目录（%TEMP%\as0-superpowers、%TEMP%\as0-pkgs），未入仓库、零 git 写操作、零仓库源文件改动。
- skill-scanner 的 Windows 可用性只到"入口点+classifiers/项目性质推断"层面，未实际 pip 安装（属 AS-2 施工验证范围）；spectral 为实际安装运行实测。
- PyPI 侧 semgrep/schemathesis 许可读取自 PyPI JSON API 的 license_expression 字段（非逐字读 LICENSE 文件），如需原文级证据可在 AS-2 前用 `pip download` 补拆包。
