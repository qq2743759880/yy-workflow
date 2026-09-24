# 施工图：资产重组与 v3 升级执行版（2026-09-23，取代前两版方案的批次表）

> 回应 Owner 三点批评：①抄竞品=vendor 原仓库源码，禁止总结式重写；②replace/drop/引入给到文件级施工单；
> ③统一任务结构（合并 v3 八点方案与 asset-v2 十一任务方案，标注取代关系）。
> 已验证的抄法先例（实测）：vendor/sdlc = BMAD 完整仓库目录（含 skills/agents/scripts 原文件），
> adapter 只做 150 行内 spawn 胶水（scripts/lib/adapters/bmad-cline.mjs）；vendor/frontend-design =
> taste-skill 工作流 + design-data 原数据。**本施工图全部照此模式，零"自研复刻"。**

## 一、"抄"的纪律（写死，违反即退回）

1. **唯一合法姿势 = vendor 原仓库**：`git clone --depth 1 <repo>` 进 `vendor/<name>/`，`VENDORED.md` 记录 repo/commit hash/日期/license/星标。
2. **禁止**：读 README 后自己重写实现；"借鉴思想自研"。允许写的只有三类文件：
   - adapter 薄胶水（`scripts/lib/adapters/<name>.mjs`，只做 spawn/参数映射/输出解析，**≤150 行，超限=设计错误**）
   - SKILL.md 薄入口（只写触发词与原文件路径引用）
   - 机验探针（调原仓库 CLI 断言其真实行为，不测我们的复述）
3. LICENSE 义务：原 LICENSE/NOTICE 随 vendor 保留；NOASSERTION 仓库先拆包核 LICENSE 再 vendor（AS-0）。
4. vendored 文件永不手改（升级=git pull 换 pin，季更不追新）；胶水升级永不覆盖 vendored 目录。

## 二、replace 4 施工单（逐资产：源/范围/胶水/探针）

| 资产 | 替换源（vendor 什么） | 范围 | 胶水（新 adapter） | 探针（验收=原仓库行为） |
|---|---|---|---|---|
| security | semgrep（semgrep/semgrep 16.7k★ LGPL-2.1）| 不 vendor 源码，npm/binary 依赖 + `semgrep --config auto` 固定 ruleset 落 `vendor/security-ruleset/` | `adapters/security-semgrep.mjs`：spawn semgrep --json → 解析 findings | 对含已知漏洞 fixture（硬编码密钥+SQL 拼接）扫描 → 报出 ≥2 findings exit 0；mimosa 深扫走宿主插件层（config 登记，不在 scripts 面） |
| skill-sentinel | cisco-ai-defense/skill-scanner 2.5k★ | `git clone --depth 1` 全仓库 | `scripts/skill-scan.mjs` ≤100 行调其 CLI | 对 `vendor/` 自身跑一遍 → 出报告 exit 0；对含 prompt 注入的 fixture → 命中 |
| review | 本机已装 review-bugbot + CodeRabbit CLI（可选） | 不 vendor；薄入口引用 `C:\Users\Administrator\.agents\skills\review-bugbot\SKILL.md`（跨机器部署时该资产声明为"宿主侧技能"依赖并登记探测方式） | `adapters/review-bugbot.mjs`：组 brief 调宿主技能 | 对含已知缺陷 fixture（冒号列表键行+错误退出码）→ 产出 ≥1 finding 且含证据引用 |
| planning | claude-task-master 28.1k★（npm task-master-ai）| 仅 vendor 其 templates/ + task schema 目录（非全量服务端） | `adapters/taskmaster.mjs`：PRD 样例 → tasks.json 产出 → zod schema 校验 | fixtures/prd-sample → 产出 task 含 details/testStrategy/dependencies 字段 |
| be-validator（留槽换引擎） | Spectral（@stoplight/spectral-cli 3.2k★）+ Schemathesis 3.6k★（python 可选后置） | npm 依赖 + 自带 ruleset 落 `vendor/be-validator/rulesets/` | 改造既有 `adapters/portman.mjs` → spectral 驱动（保留契约冻结外壳不动） | fixture OpenAPI 含错误码不一致 → spectral lint 报 violation exit 1；修好 → exit 0 |

## 三、drop 7 施工单（每资产 5 步，顺序敏感）

对象：be-architect、be-resilience、be-provider、colorize、frontend-visual-validation、agent-vision-toolkit、agent-research。

1. **change.record 单**（每资产一张）：理由=实测零调用+外部等价物覆盖；记录 tombstone（git revert 可回滚）。
2. 联动改 6 处（实测定位）：`SKILL.md` 资产指针表、`scripts/lib/matrix.mjs` CLUSTERS candidates+keywords、`scripts/validate-structure.mjs` 16 资产断言、`webview/journey/content.js`（build 重建）、`config.example.json` 白名单、`scripts/lib/adapters/index.mjs` 注册表。
3. `git rm -r vendor/<name>/`。
4. CLUSTERS candidates 空簇补位：T1 candidates 缺 be-architect/be-provider 后由批 1 新引入资产补（见下表），**禁止留空引用**。
5. 回归全绿后该资产 change 单关账。

**顺序纪律：先 replace/引入（AS-2/AS-3），后 drop（AS-1 最后）**——避免 candidates 空引用窗口期回归挂。

## 四、引入施工单（明确部分/全量——回应"全量引入还是部分"）

| 源 | 全量/部分 | 具体 vendor 清单 | 接入点 | 调用率保证 |
|---|---|---|---|---|
| superpowers 290.3k★ | **部分** | 先列其 skills/ 完整清单 → 按 16 槽位需求选 3-5 个（候选：TDD 纪律/debugging/planning 类）→ 只拷选中 skill 目录 | `vendor/superpowers/<skill>/` + SKILL.md 指针 | 三件套（见 §六）+ 批 3 盲行强制消费 |
| spec-kit 138.4k★ | **部分** | 仅 spec/constitution 模板文件 → `vendor/spec-kit/templates/` | 接 TK-1 task 模板 v2 与 TK 契约模板（frozen-after-approval 字段抄其结构但**引原文件**） | S1 结构断言加模板存在性 |
| chrome-devtools-mcp 52.5k★ | **配置接入（零 vendor）** | npx 运行时依赖，落 `orchestrator.config.yaml` tools 段 + `.mcp.json` | 顶替 frontend-visual-validation 空缺：视觉验证=宿主调 MCP 截图/DOM | S8b 锚点：视觉验证产物须含 MCP 会话 id |
| dzhng/deep-research 19.7k★ | **全量 vendor** | 整仓库（代码量小） | `vendor/deep-research/`，研究门脚本（RG-1）直接调其循环 | 研究门 gate 文档须含其检索日志片段（证明真跑了） |
| GPT-Researcher / STORM | **不引入** | 前者重、后者超重；dzhng 已够研究门内核 | — | — |

## 五、统一任务结构（合并两版方案；取代关系显式标注）

**取代**：EA-2（竞品调研）→ 已由 R1-R7 完成，取消；EA-3 评级矩阵 → 被 AS 系列吸收，取消；AV-5 BW-3 复测 → 并入批 3 V3-ACC。**保留**：EA-1（修正后）、AV-1..4、FE-5/6、LS-1。

| 批 | id | 内容（写面） | 依赖 |
|---|---|---|---|
| 0（并行，纯本地） | ON-1 | 接入向导问题清单落 orchestrator.config.yaml + 决策卡格式（executor-setup.mjs） | — |
|  | EX-1 | executor.json v2 能力握手（orchestrator.mjs/executor-setup.mjs + FIX-2 探针重构） | — |
|  | TK-1 | task 模板 v2 七字段+机验（plans 模板面+validate 断言） | — |
|  | CR-1 | 批判协议 v2：claim→evidence→source 绑定+看板字段（review-gate.mjs/tracker 模板） | — |
|  | SB-1 | 阶段盲测：blindqueue schema+状态机+看板（tt-journey/新脚本） | — |
|  | RG-1 | 研究门：vendor deep-research + prior-art/market gate 模板+机验脚本（新 scripts/research-gate.mjs） | — |
|  | LS-1 | lessons.md 工作区级 fail-closed（gate.mjs/tt-journey） | — |
|  | EA-1 | 基线测量两条腿（只读+取证） | — |
|  | AV-1 | manifest v2 schema change.record（冻结面变更单） | — |
| 1（资产施工，串行+并行混合） | AS-0 | NOASSERTION 许可证拆包核查（task-master/spec-kit/skill-scanner/superpowers 选品） | 网络 |
|  | AS-2 | replace 4 逐资产施工（§二表，每资产独立单：vendor+胶水+探针） | AS-0 |
|  | AS-3 | 引入施工（§四表） | AS-0、TK-1 |
|  | AV-2 | manifest 生成器（数据源=新 9+ 资产，缺字段 fail-closed） | AV-1、AS-2 |
|  | AS-1 | drop 7（最后执行，§三 6 处联动）**+ 验收新增 S14 不变量段（Owner 审计 F-002）：①drop 资产 import/引用 0 命中 ②replace 资产真实消费探针 ③manifest 驱动路由断言 ④旧 adapter 不可达；PHASE2 清单与 CLUSTERS 同步收缩** | AS-2/AS-3 全关账 |
| 2（接线+前端） | AV-3 | activation/matrix 消费 manifest（负向剔除+留痕） | AV-2、AS-1 |
|  | AV-4 | fixtures m01-m05 + S8b 断言（regression-all 14 段） | AV-3 |
|  | FE-5 | 资产卡渲染 manifest 内容（render-core/content.js） | AV-2 |
|  | FE-6 | Action Bridge（host-bridge POST /action 白名单） | FE-5 |
|  | FE-7 | 前端适配：决策卡/研究门产物/盲测看板渲染 | SB-1、RG-1 |
|  | PB-1 | PRD 全流程旁白模板+机验锚点 | — |
| 3（终验） | V3-ACC | 全量回归 + **新资产全消费盲行**（真实项目走 9 点全落地后的工作流，盲测队列含资产消费检查项）+ BW-3 同款复测 | 前两批全关账 |

## 六、调用率保证与后续改造（回应"怎么保证引入后的调用率，后续怎么改造"）

**注册门槛（三件套，缺一不注册）**：①manifest v2 三字段齐（AV-2 机验）②S8 锚点+内核词=原仓库标志性输出片段 ③CLUSTERS candidates/keywords 更新 + matrix 排期验证。
**消费强制**：V3-ACC 盲行的盲测队列必含"每个新/换资产 ≥1 次真实消费"检查项——盲行不过=资产白引入。
**持续监控**：asset-call-rate 对每次盲行 state.json 出消费表；**任一资产连续两轮盲行零调用 → 自动进 drop 评审**（写进 evolution 纪律，防新资产重蹈 colorize 覆辙）。
**升级**：VENDORED.md 记 pin 历史，季更（git pull + 探针重跑 + 回归全绿才换 pin）；胶水永不改 vendored 文件。

## 并行写面纪律（Owner 审计 F-003 后新增，违反即退回）

- 每批派发前编排者产出**写面声明表**：task × 文件的唯一 owner 映射，同文件双写禁止；确需共同触碰的文件（如 executor-setup 被向导与能力握手同时需要）→ 该文件归属其中一个单，另一单以只读+D-偏差登记方式通过。
- 收口时 `git diff` 逐文件归属核查：改动文件不在自己派单白名单+写面声明表内 → 越权，退回。
- 批 0 实证：EX-1/ON-1 双写 executor-setup.mjs 致游离 if 块+重复 const（EX-1 修复），本节为防复发固化。

## 残留登记（10 条）

1.【实测】AS-0/AS-2/AS-3 需要网络（clone/npm）——本轮 WebSearch 挂但 git/npm 实测可达，若 clone 也挂则批 1 阻塞，需 Owner 备选源
2.【推断】superpowers 选品清单未定——AS-3 开工前须先产出其 skills/ 全清单给 Owner 圈选（防止我替 Owner 决定引入什么）
3.【推断】review 资产依赖宿主侧技能（review-bugbot）是本方案唯一非自包含依赖，跨机器部署会缺——登记为部署前提
4.【实测】drop 7 的 6 处联动改是最大回归风险面，validate 断言从 16 资产变 9 资产会牵动 S1/S3/S8/S12 多段
5.【推断】semgrep LGPL-2.1 以独立进程调用（非链接）无传染问题，但需 AS-0 复核结论留档
6.【推断】chrome-devtools-mcp 依赖宿主支持 MCP——若接入向导（ON-1）选了不支持 MCP 的执行器，视觉验证回落截图 CLI（agent-vision-toolkit 已 drop，需留一个最小 screenshot 脚本兜底）
7.【实测】task-master npm 包含 Commons-Clause 限制（R3 实测 NOASSERTION=MIT+Commons-Clause）——只 vendor templates 规避运行时依赖，AS-0 必须给结论
8.【推断】批 0 九单并行是历史最大并发（此前最多 4），回归面争抢概率高——终验纪律（写面静默后编排者串行跑）必须执行
9.【推断】V3-ACC 盲行选题须避开工已用过的 4 类项目（审查助手/记账/文件整理/密码器），防学习效应
10.【实测】本施工图取代 asset-v2-frontend-plan-20260923.md 的批次表与其 v3 方案的任务表；两文件的调研结论与 schema 设计仍有效

## v3.1 修订（2026-09-23，外部审计批判性吸收——adopt/adapt/reject 裁定）

| 提案 | 裁定 | 理由与修正 |
|---|---|---|
| Asset Migration Contract v1（shadow run→evidence compare→traffic switch→delete old） | **adopt 核心，砍永久层** | 只适用 replace 4；Shadow Run=临时夹具同 fixture 喂新旧资产 diff 消费证据（跑完即删）；"Migration Adapter"不得为永久制品（违胶水≤150 行纪律）；Traffic Switch=CLUSTERS candidates 切换；drop 7/全新引入不适用 |
| change-lock.json | **adopt 降级** | 锁是建议性的，真强制力=派发拒发+收口 diff 归属核查；字段必须含 expiry（防悬挂锁，store.js 10s 过期锁先例）；不引入 branch-protection 级重机制 |
| F-004 risk override（FAIL+--allow-offline+Receipt Override Event） | **adopt 已落地**（5e08545） | 修正：approvedBy 必须人署名（--approved-by <name>），agent 不得自填；三态探针过 |
| Manifest 字段扩 10 个（capabilities/inputs/outputs/dependencies/examples/failure_modes/replacement） | **adopt 降为 v2.1 增量** | 三核心字段保持必填底线；新六字段**可选**、仅对 replace/新增资产强制（fail-closed 提取=字段都要有源文档依据，全量补齐卡死批 1；给待换资产写详尽 manifest 是浪费）；走 schema v2.1 change 单不重开 AV-1 |
| runtime-invariants 预检（duplicate export/unreachable adapter/invalid manifest ref） | **adopt 全盘** | 事实修正：blindqueue 重复声明是 L2 node --check 抓的（文件坏了 self-test 根本跑不起来）——正说明该自动化。落地 scripts/preflight.mjs 全静态零 LLM，进回归新段 |
| Micro Checkpoint Protocol（>10min 任务必须 checkpoint：done/current/next/risk/files_changed） | **adopt 全盘** | CR-1 三灭一成即 A/B 实证；写进 autopilot 协议 |
| 路线重排（Asset Intelligence→Prompt Composer→Project Memory→Brain Layer） | **adopt 排序，两项修正** | 排序符合"先证据后智能"；批 1 与在跑 AS 系列重合不重启。修正①：Batch 3 Project Memory（.agent/）**不默认放行**——被切除记忆层的第三次回归尝试，与全局记忆有实质区别（工作区级+fail-closed+LS-1 模式已验证）但推翻旧裁定须 Owner 显式拍板，且必须带三约束（工作区作用域/fail-closed 写入/消费仅 prereq 提示级）；修正②：Brain Layer **维持拒绝**——排序调整不改变架构事实（LLM 即 brain；brain.mjs=模板加载器无增量或 LLM 调用毁确定性探针），其合理形态是批 2 Prompt Compiler 的扩展而非新 runtime 层 |
| Agent Operating System 愿景 | **登记不动** | 北极星叙事，无近期动作；警惕愿景驱动加层（本项目已有两次"先建层后填内容"教训） |

## 决策权纪律（Owner 指正 2026-09-23，最高优先级）

- **外部审计者/顾问分析的定位 = 编排者建议的输入**，不是 Owner 裁定。本项目历史上两份外部方案（迭代优化方案 docx、两轮审计分析）均有"现状评估失实/上下文不全"的实测记录，逐条批判性校准后方可吸收。
- **Owner-gated 决策（旧裁定推翻、fail-closed 语义选择、记忆层回归、批次放行）只有 Owner 本人能关账**；编排者不得因"两份分析都这么说"而代签——多数意见不构成授权。
- 编排者对 Owner-gated 项的做法：给出推荐方案 + 依据 + 可回退实现（标注"临时态待追认"），台账归因必须精确到"谁裁的"。
- 本条由 D-REG1-1 错误归因事件（编排者把审计建议实现后归因为"Owner 拍板"）触发，作为永久纪律登记。

## v3.2 修订（2026-09-23，第四位审计者批判性吸收）

| 提案 | 裁定 | 落点 |
|---|---|---|
| Legacy loader 三阶段模型（Phase1 旧 loader 每次调用须 EXPLICIT_COMPAT_MODE 门，Phase2 删除） | **adopt** | S14 设计细化："迁移期共存≠无限共存"；旧 loader 调用必须显式旗标+留痕，禁静默并存 |
| 消费证据词汇（Design consumption CONFIRMED / Runtime consumption UNKNOWN）+ drop 三条件（candidate+runtime invocation+quality 缺一不可） | **adopt** | AS-1 判据正式表述；影子跑补 runtime invocation 证据 |
| DROP_ALLOWED=false 硬门（防并行 agent 绕过计划顺序） | **adopt** | 旗标挂资产 change 单/manifest 行，preflight+回归断言；流程序防护只防串行，旗标防并行 |
| 批 1 三个硬验收门（Gate1 legacy BLOCKED/EXPLICIT_COMPAT_MODE；Gate2 runtime consumed hash==build hash；Gate3 replace 五元组 old/new/shadow_result/promotion_receipt/runtime_binding） | **adopt** | 批 1 验收标准正式化 |
| 批 1 目标重述（"建立可证明的 runtime replacement boundary + 首批迁移验证"，非"完成资产替换"） | **adopt** | 防"文件换了所以完成"自欺 |
| Capability-oriented dispatch（registry→eligibility resolver→replacement resolver→adapter；runtime 只知 capability 不知 asset name） | **adopt 方向，时序移批 2** | 批 1 保持 name-based dispatch + manifest 资格查询（AV-3 即 capability dispatch 第一版）；完整形态与 Prompt Compiler 同批（共享 manifest capability 字段）；理由：现派单链有 S8 实测消费证据，推倒违背"执行层稳定" |
| "批 1 可以进入" | **不构成放行** | 决策权纪律：审计者意见≠Owner 裁定；批次放行待 Owner |

批 1 范围（v3.2 定稿）：AS-0 许可证核查 → preflight.mjs（含 buildManifest 单源+DROP_ALLOWED 断言）→ change-lock.json → migration contract 夹具 → AS-2 replace 4（影子跑+三硬门）→ AV-2 manifest 生成（含 drop_allowed 旗标）→ AS-1 drop 7 + S14（含 EXPLICIT_COMPAT_MODE 门）。目标重述如上。
