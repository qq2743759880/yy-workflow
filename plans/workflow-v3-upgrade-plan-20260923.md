# YY 工作流 v3 升级方案（Owner 8 点反馈 × 7 路开源调研，2026-09-23）

> 输入：Owner 2026-09-23 八点实测反馈（第 5 点编号重复，实为 9 条诉求）+ 7 路并行开源调研（R1-R7）。
> 调研方法声明：子代理与主会话 WebSearch 均不可用（Volcano Ark 未激活，环境级限制，实测）；
> 全部证据改走 api.github.com / raw.githubusercontent.com / registry.npmjs.org（实测可达），
> 星标为 2026-09-23 实抓值；无法核实处逐条标注 实测/推断。

## 点 1：执行器平台解耦（调研 R1）

**Owner 诉求**：不希望工作流绑定平台，任何 agent 平台都能发挥全部实力。
**实测澄清**：现状不是"绑定 opencode"——adapter 注册制 + prompt 后端 `--exec` 通用管道 + executor.json 三模式本就是解耦设计，但命名和措辞（"opencode 已接线"）造成了绑定观感，且缺"能力声明"这层标准。
**调研实证**：OpenHands 88.9k★（"Use with any agent: OpenHands, Claude Code, Codex, Gemini, or any agent with ACP"）、goose 54.6k★（15+ provider 走 MCP/ACP）、A2A 26k★（Agent Card 能力自描述）、aider 49.1k★（supports_* 能力声明 + 探测降级）；反例：claude-flow→ruflo 因 per-CLI 专用 adapter 被迫改名两次、gpt-engineer 停更 16 个月、Cline→Roo→Zoo fork 链。
**裁定**：
- **adopt**：executor.json v2 = ACP 式能力握手——启动探测并交换能力集（write_files / run_cmd / network / spawn_subagent / mcp_client），派单按能力门控不按平台命名；探测失败诚实降级（aider 模式）；executor.json 加 Agent Card 式自描述块。
- **reject**：per-CLI 专用 adapter 插件（ruflo 先例证明每个新平台重写一次）；MCP 只作工具层补充（不覆盖子 agent 会话语义）。
- 措辞纪律："已接线 X"→"能力探测验证 X 支持 write_files/run_cmd"。opencode adapter 降为回归渠道之一。

## 点 2：研究门——立项前先行调研 + 市场验证（调研 R2）

**Owner 诉求**：阶段 1 只追问不调研，会重复造轮子/伪需求。需 A（prior-art：开源/文献搜索→轮子检测→技术参考→差异化）+ B（市场：真伪需求验证→缺口分析→方向确立）。
**调研实证**：GPT-Researcher 29.6k★ Apache-2.0（MCP 数据源）、STORM 31.5k★ MIT（大纲+强制引用）、dzhng/deep-research 19.7k★ MIT（最简检索-反思循环，最适合做内核）、MaxKmet/idea-validation-agents 466★（15 个 validation skills，市场门骨架最接近）；**轮子检测无现成开源工具（实测多组关键词检索无果）——需自研薄层**（GitHub search API + awesome list + LLM 相似度）。
**裁定**：新增**阶段 1.5 研究门**（prereq-check 挂新 gate），两个机验文档：
- `docs/prior-art.md`：`search_queries[]`≥5、`sources_used`≥2 类、候选表（repo_url/stars/last_commit/license/overlap 0-1/differentiation/verdict: adopt|adapt|reject）、`wheel_status: existing|partial|novel`——**novel 必须附"检索过什么、为何没找到"证据行，否则 gate FAIL（fail-closed 防跳过调研）**。
- `docs/market.md`：`pain_evidence[]`≥3（url+quote+date 外链）、`competitors[]`≥3（name/pricing/gap）、`verdict: build|pivot|drop` + confidence。
- 内核 adopt：dzhng 循环 + idea-validation-agents 结构 + STORM 引用纪律；STORM 全家桶/付费 API reject。

## 点 3：任务拆解粒度 v2（调研 R3）

**Owner 诉求**：task 只有验收标准和方向，没有实施方案、执行者具体验收标准、可预测轨迹。
**调研实证**（npm 源码实测提取）：claude-task-master 28.1k★ schema（details/testStrategy/subtasks/复杂度强制拆解）、BMAD-METHOD 53.4k★ spec-template（"文件--动作--理由"、frozen-after-approval、Verification 强制 CLI 命令+期望判据、Dev Agent Record 回填、spec 900-1300 tok 预算防 context rot）、ADaPT 论文（固定粒度必败，**粒度应匹配执行者能否直接完成**）。
**裁定**：task 模板 v2 字段（全部可机验）：
- `implementation_steps[]`：1-7 步，每步 `{target 文件路径, action, rationale}`——脚本校验步数与 target 路径存在
- `executor_acceptance[]`：每条 AC 附 `verify_command`（CLI+期望退出码）——执行者唯一完工判据
- `trajectory_checkpoints[]`：每步对应可观测中间产物，逐点机器核对
- `complexity_score` + `must_split`（涉及文件数+依赖深度，reject 逐任务 LLM 评分——成本）、`boundaries`（Always/Never 各≤3，批准后冻结只许追加）、`dev_record`（执行者回填改动清单+偏离原因）、`spec_budget`（≤~1200 tok，超限强拆）

## 点 4：批判机制 v2（调研 R4，主会话 GitHub API 补研）

**Owner 诉求**：(a) 批判源强制多元化并在接入时确认；(b) 批判队列文件+看板统计收录落实；(c) 批判→task 转化要有实施方案。
**调研实证**：pairjudge 170★ MIT（pairwise LLM judge + **position-bias 校正**，实测机验偏差可行）、audit-the-judge 141★ MIT（paired synthetic controls + 偏差检测）、NeoLabHQ/context-engineering-kit 1.7k★ GPL-3.0（agent 产出质量技能集）、CodeRabbit 为闭源 SaaS（awesome-coderabbit 生态确认）、finding→backlog 自动化无直接轮子（实测检索无果，自研薄层接既有 tracker）。
**裁定**：
- **批判源清单机制**：接入向导采集 `critique.sources`（知识库路径/搜索工具/标准文档），批判条目 schema 强制 `claim → evidence → source` 三元绑定——**无 source 的批判判 INVALID（防"自己定标准自己批判"）**。
- **批判看板 v2**：critique-backlog-tracker 字段升级（claim/source/severity/status: registered|accepted|converted|done|rejected/converted_task_id/实施方案引用）。
- **转化纪律**：批判转 task 必须复用点 3 的 implementation_steps 模板（只写目标结果的转化单判 INVALID）。
- **偏差防护**：验收 rubric 外置 config（与批判者解耦）；关键裁决支持双 judge 分歧记录（pairjudge 模式）。

## 点 5：阶段性盲测制度（调研 R5）

**Owner 诉求**：每功能阶段 task 前后维护盲测队列文件，阶段完成后派独立盲测 agent，编排者转修复者，防"在错误前提下越走越深"。
**调研实证**：BMAD TEA（每 epic 生成 test-design 文件 + headless CLI gate + 四态裁决 PASS/CONCERNS/FAIL/WAIVED）、github/spec-kit 138.4k★（checkpoint 阶段门 + 每 story 独立可测）、SWE-bench（**盲测用例对实现者保密是盲测成立的核心**）、garak 9.3k★（探针与被测解耦可插拔）。
**裁定**：
- 盲测队列文件 `<ws>/.tt-state/stage-N-blindqueue.md`：`| qid | 来源task | 覆盖功能点 | 验证方法(步骤+期望) | hidden | 状态 |`，状态机 pending→built→hidden→passed/failed/waived；**hidden=true 条目的验证细节对实现 agent 不可见（adopt SWE-bench）**。
- 流程：编排者建队列（task 派单时同步生成）→ 执行者完成回填 → 队列 built 后冻结 → 派独立盲行 agent（复用现有 E2E 盲行协议：身份隔离+独立工作区+session-notes）→ 编排者转修复者只按 fail 条目开修复 task（不得改盲测包）→ 全绿解锁下一阶段；WAIVED 限 CONCERNS 级且留痕。
- 看板：阶段名/条目数/built 率/blind-pass 率/fail 归属/裁决/是否阻塞下游。
- reject：不强造 Gherkin 格式（轻量"步骤+期望"够用）。

## 点 6：资产重组（Owner 命令 + 调研 R6）【实测零调用证据驱动】

**Owner 裁定**：自研资产大部分是垃圾，替换大部分、只保留关键资产。
**实测证据**：agent-research/be-provider/colorize/agent-vision-toolkit 零调用（Owner 实测 + BW 坑单佐证）。
**调研实证**（星标 2026-09-23 实抓）：superpowers 290.3k★ MIT（纪律技能包）、anthropics/skills 177.7k★、spec-kit 138.4k★、browser-use 116.0k★、ui-ux-pro-max 130.0k★（本机已装）、taste-skill 89.4k★（本机已装）、BMAD 53.4k★、chrome-devtools-mcp 52.5k★、playwright-mcp 37.5k★、STORM 31.5k★、GPT-Researcher 29.6k★、claude-task-master 28.1k★、semgrep 16.7k★、Spectral 3.2k★、Schemathesis 3.6k★、cisco skill-scanner 2.5k★。
**裁定（16 槽位重组）**：
- **保留 3**：implementation（派单-验收闭环无成熟等价物）、be-validator（留槽换 Spectral/Schemathesis 引擎）、dev-planner（前提挑战实测有效，无对口替代）
- **已完成替换 2**：sdlc（BMAD+cline）、frontend-design（taste-skill+设计数据）
- **replace 4**：security→mimosa+semgrep、skill-sentinel→cisco skill-scanner、review→review-bugbot（本机已装）/CodeRabbit CLI、planning→claude-task-master/OpenSpec 69.9k★
- **drop 7**：be-architect、be-resilience、be-provider、colorize、frontend-visual-validation、agent-vision-toolkit、agent-research
- **空槽引入（不硬凑）**：superpowers 精选、spec-kit SDD、chrome-devtools-mcp（前端机验锚点）、GPT-Researcher（接研究门）、其余留空
- **自研/引入分界**（调研一致结论）：编排纪律、契约冻结、机验锚点、前提挑战必须自研——外部框架全不管"流程强制"；领域方法论与工具全部引入货架商品。
- 执行纪律：逐资产走 change.record/evolution.propose，**禁止批量换血**；每个 replace 先跑该资产的回归探针再下线。

## 点 7：决策大白话 + 架构图（调研 R7）

**Owner 诉求**：让用户拍板时看懂在决策什么。
**调研实证**：mermaid-skill 283★（图型全覆盖）、axton-obsidian-visual-skills 3.6k★（按上下文选图型）、AskUserQuestion preview 结构（本环境自带，实测）。
**裁定**：决策卡强制格式——`### 决策：<大白话标题> / 为什么要现在决定（2 句大白话禁术语）/ 架构影响（mermaid 源码+改动点高亮）/ 选项对照表（选项|对你意味着什么|工期风险影响）/ 默认建议+一句理由`；AskUserQuestion 的 preview 字段渲染 mermaid+对照表。

## 点 8：接入初始化向导（调研 R7）

**Owner 诉求**：子 agent 来源、委派方式、批判源、报告风格等接入时逐项确认。
**调研实证**：zcf 6080★（Claude Code/Codex 零配置初始化）、claude-skill-app-onboarding-questionnaire 1.2k★（逐题问卷带默认值）、aider `io.ask()`+conf 持久化模式。
**裁定**：扩展现有 executor-setup 向导（T9 底座），问题清单落 `orchestrator.config.yaml`（幂等可重跑、CLI flag 可覆盖、逐字段注释）：
- `orchestrator.subagentSource: session|claude-cli|codex-cli`
- `orchestrator.delegationMode: self-dispatch|handoff-prompt`（handoff 模式输出交接 Prompt 模板：provenance 头+去授权声明+逐值来源+验收标准固化）
- `critique.sources: [知识库路径/搜索工具/标准文档]`（接点 4）
- `report.style: plain|technical|both`（接点 7）
- 盲测开关与频率（接点 5）

## 点 9：PRD 全流程旁白（调研 R7）

**Owner 诉求**：PRD 冻结后编排者以最终用户身份逐按钮粒度旁白完整运作流程，防需求漏译。
**调研实证**：Cucumber living documentation、NN/g User Journey Map 模板。
**裁定**：PRD 冻结 gate 前强制产出走查表 `| 步骤 | 我(用户)做了什么 | 我看到什么 | 对应 PRD 锚点§ | 机验方式(测试名/断言) |`——粒度到每个按钮/跳转，每行带机验锚点；末尾固定问"哪一步和你想象不一样？"，**偏差回写 PRD 而非口头修正**。

## 执行批次（待 Owner 拍板）

| 批 | 任务 | 内容 |
|---|---|---|
| 一（并行，写面正交） | EX-1 | executor.json v2 能力握手 + 措辞纪律（点 1） |
|  | RG-1 | 研究门：两 gate 模板 + prereq-check 挂 gate + 机验脚本（点 2） |
|  | TK-1 | task 模板 v2 七字段 + 机验（点 3） |
|  | CR-1 | 批判协议 v2：源清单绑定 + 看板字段 + 转化纪律（点 4） |
|  | SB-1 | 阶段盲测制度：队列 schema + 看板 + 角色切换流程（点 5） |
|  | AS-1 | 资产重组变更单第一波：drop 7 走冻结面流程（点 6） |
|  | ON-1 | 接入向导问题清单 + 决策卡格式（点 7+8） |
| 二 | AS-2/AS-3 | replace 4 引擎接入 + 空槽新资产引入（逐资产单） |
|  | PB-1 | PRD 旁白模板 + 机验锚点（点 9） |
|  | FE-7 | 前端适配：决策卡/研究门产物/盲测看板渲染 |
| 三 | V3-ACC | 全量回归 + 新流程 E2E 盲行复测（用真实项目走一遍 9 点全落地后的工作流） |

## 残留登记（本方案自带）

1.【推断】研究门对"无外部网络"环境（如本轮 WebSearch 被拒）需要降级口径——GitHub API/npm 兜底已实测可行，但纯离线环境 gate 会卡死，需定义 SKIP 语义（须 Owner 裁决是否允许）
2.【推断】AS 系列替换涉及 7+4 个冻结面资产，change 单评审量集中，建议分两波
3.【实测】spec-kit/task-master 等"星标极高位"项目许可证多为 MIT/NOASSERTION——引入前逐个核许可证（NOASSERTION 的必须拆包看 LICENSE）
4.【推断】task v2 七字段会显著增加拆解阶段 token 消耗——spec_budget 反向约束，但总消耗增幅需盲行实测
5.【推断】阶段盲测的"hidden 条目保密"在单会话编排（无进程隔离）下依赖 prompt 纪律而非硬隔离——是纪律级保证，登记在案
6.【实测】本轮 7 路调研全部依赖 api.github.com（WebSearch 环境级不可用），rate limit 是脆弱点——关键数据已双源交叉
7.【推断】决策卡 mermaid 依赖渲染环境（终端不渲染 mermaid），回落 ASCII 图（AskUserQuestion preview 实测支持）
8.【推断】executor.json v2 能力握手改变派单协议，FIX-2 探针需同步升级（12 探针重构风险）
9.【推断】PRD 旁白逐按钮粒度对后端类项目可能空洞（无 UI）——回落"逐命令/逐输出"粒度
10.【实测】资产 drop 7 后 16 槽位语义变化大，SKILL.md 资产指针表、CLUSTERS candidates、validate H 断言三处联动改——是本方案最大联动面
