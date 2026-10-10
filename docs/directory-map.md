# YY 目录职责与迁移边界

当前执行路径见根 README；决策契约与身份见 `contracts/decision-contract-v1.yaml` 和 `plans/project-handoff.md`。本文描述物理目录、分发边界与部署方法，不新增阶段规则。目录移动不会代替语义整合；源码保留现有模块位置，发行包由一个显式入口选择必需内容。

## 根目录

| 目录 | 作用 / 当前边界 | 迁移处理 |
|---|---|---|
| `commands/` | 七个阶段 / research 命令和命令导航；引导宿主取得 Decision Packet | 随包；不是独立阶段权威 |
| `contracts/` | 冻结行为、资产元数据、生成身份及历史契约 | 必须随包；试验区按下表排除 |
| `scripts/` | Node CLI、生成器、运行实现和开发检查 | CLI / 库随包；测试与全仓 CI 留在源码库 |
| `reference/` | Skill 按需协议、变量、Decision / M1 / receipt 边界 | 随包；避免把正文复制到长期上下文 |
| `vendor/` | 九个治理资产和单独 research 内核 | 仅 ASSET-FILES.yaml 中分类通过的文件随包；生命周期门拒绝未接线与退役残留 |
| `governance-skills/` | 调试、TDD、完成验证等按需方法 | 随包；不替代 Decision 准入 |
| `templates/` | 工作项目的规划、交接、报告与 owner-review 模板 | 随包；实例写入 `$PROJECT_ROOT` |
| `webview/` | 只读 journey 展示与生成的使用手册 | 随包；展示不授予执行许可 |
| `integrations/` | MCP 宿主适配和已有服务运维 | `mcp` profile 仅携带当前双挂载所需文件 |
| `docs/` | 架构导航、开发设计、部署记录、历史说明 | 发行包只带本文；其余属于源码维护材料 |
| `plans/` | YY 自身开发计划、当前身份 ledger、审计索引和任务卡 | 发行包只带当前 `project-handoff.md`；不复制旧派单 |
| `tasks/` | YY 自身 ngrok / 外部接入实施任务 | 源码开发材料；不随发行包 |
| `handoffs/` | YY 自身历史 FE / fix / hard / v3 派单 | 历史证据；不随包；用户项目的交接另写其项目根 |
| `test-reports/` | 断言结果、固定 regression fixtures、事故证据 | 源码验证依赖；不按日期整删；不随包 |
| `artifacts/` | YY 自身实验与 C2/C3/C4 验收产物，含隔离副本 | 不随包；保留仍被证据索引引用的内容 |
| `prototypes/` | 旧控制室 / workflow-panel 原型及设计基线 | 保留历史引用和手动原型入口；不随当前包 |
| `.learnings/` | 本机历史错误与修复记录 | 本机状态，不随包；不是项目现状权威 |
| `.mimosa/` | 外部审查 hook 的状态、历史、报告 | 本机 hook 状态，不随包、不覆盖 |
| `secrets/` | 本机凭据预留区 | 永不随包；新机器独立配置 |
| `node_modules/` | Node 可选检查 / 内核依赖安装结果 | 不随包；目标机按 lockfile 安装所需依赖 |
| `.git/` | 源码历史和未提交工作区索引 | 不随发行包；迁移源码开发库用 Git 本身 |
| `compatibility/m1-source/` | 可选：独立迁移后的 M1 固定旧 Git 投影 | 默认读取位置；不随当前源码包；原 commit/tree/blob pins 不变 |

根文件：`SKILL.md` 是宿主发现入口；`README.md` 是当前架构导航；`ONBOARDING.md` 是使用入口；`package.json` 是产品版本、依赖和 CLI 登记；`package-lock.json` 固定依赖；`config.example.json` 是用户项目平台配置模板；`.memory` 只保存指针。`CHANGELOG.md` 是演进记录。`.ignore` / `.gitignore` / `.zcodeignore` 管理搜索、版本库和宿主发现边界，不能代替分发入口的选择规则。

## 子目录

| 目录 | 具体职责 | 分发 |
|---|---|---|
| `contracts/generated/` | 当前 authority/transport 组件、intent map、owner projection 与 delegation-schema ESM 生成清单；组件数以当前 manifest 为准 | 必须；身份由已有 builder 生成 |
| `contracts/v3/` | 九个资产的 V3 能力、输入输出与执行模式契约 | 必须；不改方法论正文 |
| `contracts/manifest-sources/` | 资产治理清单的源 YAML | 随包；重建 asset manifest 使用 |
| `contracts/candidates/` | 候选投影 / 开发试验，未替代当前冻结来源 | 不随包 |
| `contracts/drafts/` | 未冻结契约草稿 | 不随包 |
| `contracts/discrepancies/` | change loop 差异 / 修正记录 | 不随包；保留历史证据 |
| `scripts/lib/` | Decision、journey、phase、activation、runtime、store 等实际实现 | 随包；CLI 保持薄层 |
| `scripts/lib/adapters/` | Prompt / 宿主执行 / Semgrep / scanner / Spectral 等真实执行 seam | 随包；缺少能力按已有规则失败或未验证 |
| `integrations/yy-web-mcp/` | 当前 server / auth / binding / M1 bridge / V2 bridge；不启用 Local 服务工具 | 当前模块随 `mcp`；旧 Local 代码已冷移出源码 |
| `integrations/yy-web-mcp/runtime/` | lifecycle 模块、schema；运行时配置、PID、日志、隧道文件及 M1 本地位置配置 | 只带 module / schema / ownership 文档；所有实例状态排除 |
| `integrations/yy-web-mcp/runtime/logs/` | 当前服务与隧道日志 | 本机；不随包 |
| `integrations/yy-web-mcp/tests/` | 冻结 ABI、认证、绑定、只读、安全、启动、C4 等行为验证 | 源码开发依赖；不随包 |
| `integrations/yy-web-mcp/tests/fixtures/` | M1 冻结六工具完整输入 schema 等 fixture | 源码开发依赖 |
| `integrations/yy-web-mcp/tests/integration/` | Core / V2 / C4 真实边界的合成集成验证 | 源码开发依赖 |
| `integrations/yy-web-mcp/baseline/`、`probe/`、`tasks/` | 旧服务指纹、探针和实施派单 | 留作维护证据；不随包 |
| `integrations/yy-web-mcp/synthetic-workspace/` | 本机演示 / 测试绑定工作区 | 不随包；迁移后创建目标机自己的绑定 |
| `integrations/yy-web-mcp/.venv/`、`__pycache__/`、`.pytest_cache/`、`.mimosa/` | Python 依赖、缓存、hook 状态 | 不随包 |
| `plans/active/`、`plans/tasks/`、`tasks/ngrok-v2/` | 开发阶段 / 派单与运维任务 | 不随包；不作为用户项目阶段状态 |
| `handoffs/fe/`、`fix/`、`hard/`、`v3/` | 对应历史实施任务交接 | 不随包 |
| `docs/history/`、`docs/history/tasks/` | 历史设计、token snapshot 和真实被读取的 backlog 任务 | 保留源码验证路径；不随包 |
| `docs/examples/`、`executor-setup/` | 示例与执行宿主设置说明 | 源码参考；目标机配置见下方迁移步骤 |
| `docs/preview/`、`prototype/`、`tasks/`、`yy-web-mcp-ngrok/` | 旧展示、设计任务、部署方案与日期化记录 | 不随包 |
| `templates/owner-review/` | owner 分阶段评审模板 | 随包 |
| `webview/journey/` | render / bridge / CSS / index / 生成 content 手册 | 随包；按 `guide:build` 重建 |
| `vendor/planning/` | 需求 / PRD 资产 | 随包 |
| `vendor/dev-planner/` | 任务拆解 / dev-plan 资产 | 随包 |
| `vendor/frontend-design/` | 前端设计资产、设计数据与参考 | 随包 |
| `vendor/implementation/` | 代码实施资产 | 随包 |
| `vendor/review/` | 评审资产 | 随包 |
| `vendor/sdlc/` | SDLC 入口、按阶段角色资料与 reference；旧插件子 Skill 已外部退役 | 随包 |
| `vendor/security/` | 安全审计资产与规则 | 随包 |
| `vendor/skill-sentinel/` | Skill 扫描资产 | 随包 |
| `vendor/be-validator/` | 后端 / OpenAPI 校验资产和 rulesets | 随包 |
| `vendor/deep-research/`、`src/` | `research-gate.mjs` 调用的 vendored 研究内核，不计入九个治理资产 | 源码随包；其 node_modules 不随包 |

vendor 内进一步的 `reference/`、`references/`、`rulesets/`、`resources/`、`skills/`、`scripts/` 等由各资产自有入口定义；导出保留这些目录和许可文件，不展平、不改资产正文。任何深度的 node_modules / venv / cache 均排除。

以下补齐维护树和资产内部有实际源文件的深层目录。日期化 artifacts / test-reports 的实验副本沿用其父目录证据职责；第三方依赖安装目录由包管理器管理，不逐项列其实现细节。

| 深层目录 | 作用 |
|---|---|
| `contracts/candidates/project-bath/` | 清理候选 / 对照材料，未替代当前生成身份 |
| `docs/history/specs/` | 历史实现规格；冻结行为是否有效须查现行契约 |
| `docs/history/tasks/reports/` | 历史任务评审结果 |
| `docs/tasks/yy-skill-loading-v3/` | Skill 按需加载迭代的历史实施任务 |
| `docs/yy-web-mcp-ngrok/evidence/` | 日期化 MCP / ngrok 部署验证证据 |
| `governance-skills/systematic-debugging/` | 根因定位方法 |
| `governance-skills/test-driven-development/` | RED → GREEN 开发方法 |
| `governance-skills/verification-before-completion/` | 完成声明前的证据要求 |
| `handoffs/v3/amendments/` | V3 派单变更 / 追认记录 |
| `integrations/yy-web-mcp/tests/unit/` | OAuth provider 等单元行为测试 |
| `integrations/yy-web-mcp/tests/fixtures/w6/` | W6 持久路径 / 只读边界夹具 |
| `plans/active/changes/` | 当前变更流程记录 |
| `plans/active/yy-web-mcp-ngrok-20260928/` | 对应部署批次的计划、配置候选与源指纹 |
| `prototypes/yy-workflow-panel/` | 旧 workflow-panel 原型和设计规格 |
| `tasks/ngrok-v2/cards/` | ngrok V2 实施任务卡 |
| `vendor/be-validator/rulesets/` | 当前 Spectral 校验规则；旧 contract-testing 说明已退役 |
| `vendor/deep-research/src/ai/` | research 内核的模型 / prompt 支持代码 |
| `vendor/frontend-design/.openclaw/` | 上游平台来源元数据；不登记 YY 当前版本 |
| `vendor/frontend-design/reference/` | 前端设计资产的子方法与参考入口 |
| `vendor/frontend-design/reference/design-data/` | 设计检索 / 规则数据子资产 |
| `vendor/frontend-design/reference/design-data/data/`、`data/stacks/` | 设计目录数据和按技术栈组织的指南数据 |
| `vendor/frontend-design/reference/design-data/references/` | 设计数据使用说明 / 扩展参考 |
| `vendor/frontend-design/reference/design-data/scripts/` | 设计数据检索与检查程序 |
| `vendor/frontend-design/reference/taste-blocks/` | 页面区块设计参考 |
| `vendor/frontend-design/reference/taste-blocks/cta/`、`feature/`、`footer/` | 行动入口、功能区、页脚的区块参考 |
| `vendor/frontend-design/reference/taste-blocks/hero/`、`navigation/`、`portfolio/` | 首屏、导航、作品展示参考 |
| `vendor/frontend-design/reference/taste-blocks/pricing/`、`social-proof/`、`transition/` | 定价、用户信任证据、区块衔接参考 |
| `vendor/implementation/reference/` | Matt 固定字节方法论与依赖资源；可选外部 provider 说明只在显式选用时加载 |
| `vendor/planning/reference/` | formal/vibe 统一模板与完整 MIT 许可 |
| `vendor/frontend-design/templates/`、`vendor/review/templates/` | 已接入生产入口的条件式交付模板 |
| `vendor/review/.openclaw/`、`vendor/security/.openclaw/` | 上游平台来源元数据；不登记 YY 当前版本 |
| `vendor/review/agents/`、`reference/` | 评审角色提示与规则参考 |
| `vendor/sdlc/agents/`、`reference/` | 仅按 Heavy Profile 阶段读取的角色资料与参考；无额外执行主体 |
| `vendor/security/agents/`、`reference/`、`rulesets/` | 安全角色提示、规则说明和扫描规则 |

## 可迁移分发

```text
node "$SKILL_DIR/scripts/export-package.mjs" --out <尚不存在的绝对目标目录> --profile core
node "$SKILL_DIR/scripts/export-package.mjs" --out <另一个尚不存在的绝对目标目录> --profile mcp
```

`core` 包包含本地 Core / C4、冻结契约、资产与模板；只需可用 Node 即可做只读决策。`mcp` 在同一 Core 字节上增加当前双挂载 transport 与 lifecycle 文件。导出检查声明组件 SHA-256、输出 `distribution-manifest.json`，相同源字节的清单可复现；目标存在、与源码重叠、源码链接或组件漂移则中止。旧 `make-release.mjs` 已停用并返回 `LEGACY_RELEASE_RETIRED`，不会 purge 安装面。

迁移 Skill：复制经校验的 `core` 或 `mcp` 包到目标机选择的位置，并让宿主发现该目录中的 SKILL.md。当前 Codex junction 继续指向本机 canonical；导出不会修改 junction，也不会自动替换其它宿主的安装。开发者迁移整个源码库应保留固定 test fixtures；发行包不承诺运行源码库的全仓 CI。

迁移 MCP：目标机创建自己的 Python 环境并按 `integrations/yy-web-mcp/requirements.txt` 安装，选定 Node / Python 可执行文件、空闲 loopback 端口、可信 workflow binding 和认证参数，再使用已有 start script。不得复制本机 runtime/config.json、PID、ngrok YAML、token、OAuth 密钥或 synthetic/production 绑定。Windows lifecycle 沿用现有 PowerShell；其它系统可调用 `python server.py --port <YY端口> --auth-mode <none|oauth>`，进程与隧道由目标宿主管理。本轮仅在 Windows 实测，不声称其它 OS 已验收。

M1 可选迁移：在目标 `compatibility/m1-source/` 中以 Git 获取 `bridge_client.py` 的固定 `EXPECTED_HEAD`（可以从持有该对象的本地 repository 浅 fetch 后 detached checkout），保留 `.git`。需要其它目录时由可信 `YY_M1_AUTHORITY_ROOT` 或 `runtime/m1-source.local.json` 指定绝对位置，格式为 `{"schema":"yy/m1-source@1","root":"<目标绝对目录>"}`。位置配置不更改固定 commit/tree/blob 校验。缺失 / 配错 / 漂移时 M1 返回失败，Core/V2 仍是当前决策权威；M1 不随当前包冒充 canonical。

完整执行内核按任务需要安装：Node 检查依赖用根 lockfile；research 内核用其自有 lockfile；Semgrep / Skill Scanner / 执行宿主在目标机分别配置。离线 Core 决策不等于联网研究已完成，也不等于外部执行能力齐备。

## 本轮退出活动树的内容

`.tmp-demo/` 是旧页面临时副本（8 文件），`recovery-20260919/` 是已完成源码恢复的材料（3 文件）；其原字节冷移出项目。未被当前 server、测试或运维入口加载的旧 Local 模块 `tools_services.py`、`config.py`、`errors.py`、`projects.py`、`security.py`（5 文件）也冷移出。旧 `stop-all.bat` 改为调用现有 YY ownership lifecycle 的 stop 入口，不再按进程名停止隧道。上轮根 `.agent-archive/` 也移入统一外部批次，保留内层原始 manifest 和恢复工具的全部字节。旧 archive 的内部绝对路径未重写；要使用旧恢复脚本，先按本轮 manifest 恢复旧 archive 到原位置。

所有停用文件及编辑前字节统一在 `D:/project-bath/<项目名-规范根路径哈希8位>/<批次>/`。恢复按该批次 manifest 校验；后续修改发生冲突时保留现状，不能全局 reset/clean。历史证据、原型和 hook 状态暂留的原因是存在有效引用或外部入口，年代久不等于失效。

## 文件级生命周期与以后迭代

每个 vendor 资产及 research 内核都有 ASSET-FILES.yaml；scripts/asset-file-hygiene.mjs 是物理分类与引用检查单点，export-package 只消费通过门的文件列表。永久迭代协议见 [asset-iteration](../reference/asset-iteration.md)。planning 的 reference/agents、SDLC 的 skills/scripts、旧 scanner src、设计数据上游测试和缓存已退出生产树；完整原件与恢复清单在 <private-backup-root>/20261005-asset-file-reconciliation/manifest.json。planning/reference/LICENSE 保留完整 MIT；资料目录的法律与来源记录按 PROVENANCE 随包。

平台中立执行：scripts/lib/host-execution.mjs 持有执行包与嵌入接口，contracts/host-execution-contract.yaml 持有字段/mode 契约，reference/host-execution.md 为宿主接入说明。九个 vendor/<asset>/METHODOLOGY.json 由 scripts/lib/methodology.mjs 统一读取，登记逻辑依赖、pin、wrapper policy、条件资源和可选 profile，不持有第二份方法论；reference/matt/* 保留原文、依赖资料和许可证，agents 元数据只作 provenance。

方法论调用冻结：每资产 UPSTREAM-REUSE.yaml 记录按 upstream-first 阶梯的复用选择与拒绝理由；scripts/asset-upstream-reuse.mjs 核对固定源、license、方法闭包与适配器，生成 contracts/generated/asset-invocation-matrix.json（九行）。validate/export/cheap regression 均消费此门。Matt 原件集中在 vendor/implementation/reference/matt/，planning/review/dev-planner 跨资产引用同一份包内固定字节；frontend 保持 taste/design-data 条件加载；tool-backed 资产没有虚构 Matt 依赖。新增原件、映射、provenance 均由 ASSET-FILES.yaml 分类。

人工交接公开入口为 `scripts/handoff.mjs`，旧 executor-setup --handoff 复用它。delegation policy、final input budget、quota、handoff state/package、return intake/checker、methodology source read 和 TaskView projection 均保留在 `scripts/lib/`，随 core/mcp 的现有 scripts 递归选择导出；共享 JSON schema 与 generated ESM 随 contracts，handoff prompt/return 模板随 templates。方法原件与许可仍按 ASSET-FILES 分类，不展平或另复制一份来源图。入口与私有字段边界见 [人工交接](../reference/manual-handoff.md)。

用户项目的 `.tt-state/state.json` 保存批准配置、source snapshot core、project_root、checker/返回证据和版本状态；`artifacts/` 保存受控 portable 包、暂存/检查/接受产物与集成 before/proof。这些是该项目私有运行物件，不随 YY 代码发行，不能作为公开 Web 字段。TaskView 只读投影状态、测量与允许复制的预览；无 usageObservation 时 UNKNOWN，不生成虚构费用。旧三字段 REPORT 校验仍是兼容格式检查，正式 ReturnEnvelope 接受只由当前 handoff 状态事务处理。
