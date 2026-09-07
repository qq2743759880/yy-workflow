# M2 毒舌技术批判报告（owner-review 白话指引 + 资产透明化）

- 日期：2026-09-07
- 批判人：TT §7 硬闸门毒舌子 agent（YY M2 派单）
- 对象：`templates/owner-review/` 5 份指引（C3 四段结构）、`templates/kickoff-prompt.md` 全簇资产清单（30 资产 + 域声明）、`templates/completion-report.md` 按域展示小节
- 设计来源：`docs/TT-OWNER-UX-PRD.md` FR-3 / FR-5
- 交付物：`plans/tasks/M2-技术批判.md`（5 条有效）+ `plans/tasks/M2-优化修改方案.md` + `plans/critique-backlog-tracker.md` C-25~C-29

## 1. 总判决

**文案层合格，机制层失守。** 五份指引的 C3 四段结构、术语白话化、按域展示表格，作为「给 owner 读的文章」没有问题。但 M2 的两条验收 GWT 本质上是**没有执行者的空头支票**：

- **FR-3 GWT3「指引引用均指向真实存在的模板段落名（无悬空引用）」**：`validate-structure.mjs:95` 只把 owner-review 目录列入文件存在性清单，全仓库**没有任何一处代码**交叉核对段落名。段落改名 → 五份指引静默全悬空 → owner 按指引找不到字段 → 白话化失效且无报错。
- **FR-5 GWT「域声明缺失 → 验收抽查记 warning」**：`asset-call-rate.mjs:136-137` 只读 asset/assetConsumed/mode/briefBody 四个字段，**根本没有域声明字段**；state.json 也不落域声明。「记 warning」的执行者是空气——agent 自觉 + owner 肉眼，正是 YY 自己批判别人的「纪律代替机验」。

一句话：**M2 把「让 owner 看懂」做成了五篇好文章，没做成五个可机验的机制**——而 YY 的立身之本恰是「机验代替纪律」。此外 kickoff 五簇 30 资产清单是 `matrix.mjs` 的手抄第二事实源（`kickoff-prompt.md:33` 自己承认要「逐条一致不缩水」，用纪律代替机验），S3 漂移门只管 Phase 2 替换清单，不管这条。

## 2. 五条批判（详见 M2-技术批判.md）

| # | 批判 | 级别 | 核心证据（本仓库实测） |
|---|------|------|----------------------|
| C-25 | 段落名引用悬空 0 机验，FR-3 GWT3 无执行者 | P1 | `validate-structure.mjs:95` 仅 listMd；5 份指引引用 completion-report/contract/dev-plan 段落名，无一处核对 |
| C-26 | kickoff 30 资产清单 = matrix.mjs 手抄镜像，无比对机制，CLUSTERS 变更即静默漂移 | P1 | `kickoff-prompt.md:44-74` vs `scripts/lib/matrix.mjs:2-6`；regression S3 只覆盖 Phase 2 替换清单 |
| C-27 | 域声明 warning 无数据源、无执行者，FR-5 GWT 落空 | **P0** | `asset-call-rate.mjs:136-137` 无域声明读取；state-summary 无字段 → warning 无从记起 |
| C-28 | 白话化没有「测」：零可读性度量、零 owner 试读留痕，违反 plainlanguage.gov「Test for understanding」纪律 | P2 | 五份指引验收仅「文件存在 + 0 泄露」；术语解释项自己含未解释黑话（「冻结」「变更单」） |
| C-29 | 五份指引无 L1 元数据层，触发靠模型情面；M1 批判 C-22 教训未承接又添同类债 | P2 | SKILL.md 0a 手动表；无「自列全部入口」枚举能力 |

## 3. 竞品对标（全部 2026-09-07 真实抓取）

| 竞品 | URL | 结论 |
|------|-----|------|
| anthropics/skills（175.0k★） | https://github.com/anthropics/skills | frontmatter name/description 两字段即自动发现，官方文档原话「use the skill by just mentioning it」——触发是机器行为不是记忆行为 |
| Agent Skills 开放规范 | https://agentskills.io | Discovery/Activation/Execution 三级渐进披露：启动只加载 name+description，任务匹配自动激活全文 |
| MCP Tools | https://modelcontextprotocol.io/docs/concepts/tools | tools/list 机器枚举 manifest + listChanged 变更自动通知 + inputSchema 结构化校验（漏字段是协议 error 不靠自觉） |
| US 联邦白话指南 | https://www.plainlanguage.gov/guidelines/ | Plain Writing Act of 2010；白话写作四环节：原则/写作/设计/**测试理解**——写完不测 = 不合格 |
| textstat 0.7.13（2026-02-18 发布） | https://pypi.org/project/textstat/ | Flesch Reading Ease 等公式把「可读性」这种主观事做成可复现机验指标——域声明这种布尔事实没理由机验不了 |
| SuperClaude v4.3.0（23.9k★） | https://github.com/SuperClaude-Org/SuperClaude_Framework | 30 命令 + `/sc` 一条命令自列全部入口（用户可枚举不靠记忆）；反面教训仍在：TS 插件系统未发布、No ETA |

**差距的本质**：竞品把「引用、清单、声明、触发」全部建模为**机器可枚举、可校验的协议字段**；YY 把同一批东西建模为**散文 + 祈使句**，然后祈求 agent 和编排者自觉。YY 的机验能力（review-gate/regression/validate）本来是护城河，但 M2 新交付面恰好全部落在护城河外面。

## 4. 优化方案摘要（详见 M2-优化修改方案.md）

1. **C-27（P0）先行**：state-summary 增 `domainDeclared` 字段 + asset-call-rate.mjs 缺声明输出 `DOMAIN_DECL_MISSING warning`（≤60 行，FR-5 GWT 从 0 机验变可机验）。
2. **C-25/C-26（P1）并行**：`owner-review-linkcheck.mjs`（引用段落名 grep 目标模板）+ `kickoff-drift-check.mjs`（kickoff 五簇段 vs CLUSTERS diff），两个只读脚本互不依赖。
3. **C-28/C-29（P2）收尾**：指引末尾「30 秒自测三问」（答案指针化防双源）+ 1 次 owner 试读留痕 + 可读性基线；SKILL.md 0a 升级为 ≤120 token 的 L1 元数据块并被 validate 断言覆盖 5/5。
4. 验收总口径：regression 8/8（+ 新增 S9 linkcheck 段）全绿；每条批判 ≥1 个可复现 FAIL→PASS 演示；量化指标实测入 docs/history。

## 5. 机验结果

```
node scripts/review-gate.mjs --dir plans/tasks --id M2 --verify-urls
PASS 批判文档存在  5 条
PASS 有效批判≥3（含URL+日期）  有效 5/5
PASS 优化修改方案存在  存在
PASS tracker 已登记  含 M2
[URL 真验] 网络可用
  PASS https://github.com/anthropics/skills (200)
  PASS https://modelcontextprotocol.io/docs/concepts/tools (200)
  PASS https://www.plainlanguage.gov/guidelines/ (200)
  PASS https://agentskills.io/ (200)
[URL 真验] 有效批判 5 条：真实对标可达 5 / 无效 0
[OK] M2 批判闸门通过 + 竞品 URL 全部真实可达（PASS 5/5）  exit 0
```

**诚实备注（不夸大）**：review-gate 对每条批判仅机验「竞品对标」单元格的**首个 URL**（解析器 `parseTableEntries` 只取首个匹配），故上表 4 个唯一 URL 被探测。pypi.org/project/textstat/ 与 SuperClaude_Framework 两个次级 URL 由批判人当日手动 webfetch 核验均为 HTTP 200 可达，未被 gate 覆盖——这一解析器盲区本身可作下轮批判素材。登记状态：C-25~C-29 已人工登记至 `plans/critique-backlog-tracker.md`（M2 段，格式对齐 M1 段），状态 ⬜ 待落地。

## 6. 版本

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-09-07 | 初版：5 条有效批判（C-25~C-29，P0×1/P1×2/P2×2）、6 个竞品 URL 当日真实核验、gate exit 0（URL 真验 5/5 可达）、登记完成、优化方案含落地顺序与验收总口径 |
