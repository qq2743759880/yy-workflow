# RG-1 RESULTS.md — 研究门（批 0）执行证据

执行 agent：RG-1 L1（独立上下文）；日期：2026-09-23。
派单：handoffs/v3/RG-1-dispatch.md；上下文：plans/execution-plan-v3-20260923.md §四 RG-1。
**状态：全部自测完成、证据落盘——等待编排者 L2 复核，不自称 DONE。**

---

## A. 任务 A：vendor 原仓库（禁自研复刻）

| 项 | 结果 |
|---|---|
| clone | `git clone --depth 1 https://github.com/dzhng/deep-research` → `vendor/deep-research/`，exit 0（网络实测可达，clone/npm/gh-api 均通；WebSearch 工具不可用不影响） |
| commit hash | `1f8f3e285bbc23e80b98a66a64effab9069f3ad4`（"Update README: change sponsorship from Aomni to created by Duet"） |
| commit 日期 | 2026-04-11T23:58:21Z（本地 git log 与 api.github.com `/repos/dzhng/deep-research/commits?per_page=1` 交叉核对一致：远端 HEAD 即此 commit，未漂移） |
| license | MIT（仓库 LICENSE：Copyright (c) 2025 David Zhang；GitHub API `license.spdx_id=MIT` 一致） |
| 星标 | 19,717（2026-09-23 实测 `api.github.com/search/repositories?q=deep-research+user:dzhng`） |
| 记录 | `vendor/deep-research/VENDORED.md`（repo/hash/日期/license/星标/内核 API/探针证据/升级纪律/pin 历史） |
| 禁自研复刻 | 未写任何复述实现；唯一桥接 = `scripts/research-gate.mjs`（行数见 B），vendored 文件零改动（探针临时文件 `rg1-kernel-probe.mts` 运行后即删，工作区已还原） |

**内核真跑自测（不是复述）**：

```
node scripts/research-gate.mjs --kernel-probe
→ {"ok":false,"loopRan":true,"error":"No model found","logBytes":84}   exit 0
```

- 路径：spawn node → `vendor/deep-research/node_modules/tsx/dist/cli.mjs` → 临时 `.mts` →
  `import dr from './src/deep-research.ts'` → `dr.deepResearch({query,breadth:1,depth:1})`。
- 无 API key 时 vendored 循环体真实执行至 `generateSerpQueries → getModel()` 边界，
  由 **vendored 代码路径自身**抛 `'No model found'`（src/ai/providers.ts:56）——
  该错误只在真跑了原仓库循环时才会出现，即"内核真跑"证据；`loopRan=true` + 该错误 = 探针通过。
- 依赖安装：vendor/deep-research 内 `npm install`（165 包，含 tsx 4.19.2；node_modules 为运行产物，
  非 vendor 提交物，已计入 VENDORED.md 说明）。
- 遇到的平台坑（已解决并留注释）：Windows Node≥18.20 spawn `.cmd` 无 shell 报 EINVAL
  （CVE-2024-27980 缓解）→ 改 spawn `process.execPath` 直调 tsx `dist/cli.mjs`；
  `tsx -e` 上下文 default-export 解析异常 → 改写临时 `.mts` 探针文件运行后删除。

## B. 任务 B：research-gate.mjs 胶水 + 两 gate 文档 + 机验

**胶水量**：`scripts/research-gate.mjs` 共 220 行（含注释/空行）；非注释非空行 170，
其中自测 `selfTest()` 24 行 → **研究门主逻辑 146 行**（≤150 达标）。
行数口径已登记（D-REG1-3）："≤150 行胶水"按主逻辑行计；若 Owner 按"全文件≤150"口径，
则需删 self-test 或外移，交 Owner 裁决。

**功能面**：
- `runKernel(query)`：调 vendored deepResearch 循环（任务 A 探针）。
- `runQueries(queries)`：兜底检索（api.github.com + registry.npmjs.org），返回逐条证据行。
- `verifyPriorArt(doc)` / `verifyMarket(doc)`：fail-closed 机验，只认文档内 ```json block。
- `--self-test`（9 断言）/ `--kernel-probe` / `--workspace <dir>`（gate 主校验）三入口。

**机验 6 样本结果**（`node scripts/research-gate.mjs --self-test`，全部 PASS，exit 0，
日志：test-reports/autopilot-work/RG-1/self-test.txt）：

| # | 样本 | 期望 | 结果 |
|---|---|---|---|
| ① | json block 提取（正常/坏块） | 正常→可解析；坏 JSON→null→FAIL | PASS |
| ② | prior-art 合规样本 | gate PASS | PASS |
| ③ | 缺 search_queries（<5） | FAIL 且 detail 指名 `search_queries>=5` | PASS |
| ④ | wheel_status=novel 无 novelty_evidence | **FAIL 指名 `novel_novelty_evidence`（fail-closed 核心）** | PASS |
| ⑤ | wheel_status=novel 带证据行 | gate PASS | PASS |
| ⑥ | market 合规样本 | gate PASS | PASS |
| ⑦ | 缺 pain_evidence（<3） | FAIL 且 detail 指名 `pain_evidence>=3` | PASS |
| ⑧ | verdict 非法枚举（'maybe'） | FAIL 指名 `verdict+confidence` | PASS |
| ⑨ | kernel 真跑探针 | loopRan=true 且（completed 或 No model found） | PASS |

**真实 gate 校验**（对仓库内 docs/prior-art.md + docs/market.md 实跑，
日志：test-reports/autopilot-work/RG-1/gate-verify.txt）：

```
PASS prior-art/search_queries>=5  实得 8 条（需≥5）
PASS prior-art/sources_used>=2    实得 2 类合法源 [github-api/npm-registry]
PASS prior-art/candidates         5 个候选字段齐+枚举合法
PASS prior-art/wheel_status       wheel_status=partial
PASS market/pain_evidence>=3      5 条带外链+引文+日期
PASS market/competitors>=3        4 个竞品 name+gap 齐
PASS market/verdict+confidence    verdict=build confidence=medium
[OK] 研究门通过（gate=research-done）   exit 0
```

**兜底检索证据**（WebSearch 不可用 → 兜底源实测可达，检索日期 2026-09-23；完整记录内嵌两文档 JSON）：
- github-api：`deep-research user:dzhng` → 19717★ MIT；`gpt-researcher` → assafelovic/gpt-researcher
  29580★ Apache-2.0（last commit 2026-08-23）；`stanford-oval/storm` → 31485★ MIT（2025-09-30）；
  `langchain-ai/open_deep_research` → 12683★ MIT（2026-08-10）；`"prior art" "research gate"`
  仓库精确检索 **0 命中**（issue 检索命中均为各项目内部流程术语，非通用实现）。
- npm-registry：`deep-research@0.1.4`（Apache-2.0，JigsawStack）；
  `-/v1/search?text=deep research agent` → @multimodal/deep-research-agent 等均为运行时服务/CLI。

## C. 任务 C：tt-journey step 1.5（研究门前置链）

**改动面**（git diff：+101/−34，仅 scripts/tt-journey.mjs 单文件；未碰沙箱修剪/BFX 段/blindqueue）：

1. `STEPS` 增 `{ step: 1.5, name: '研究门', gate: 'research-done' }`（位于 1 与 2 之间）。
2. `GATE_VOCAB` 增 `'research-done'`（B 面写入口径；lib/journey.mjs / lib/phase.mjs 的
   4 闸冻结投影按各自词表过滤，不受影响——实测：投影 gates.pending 仍为 4 闸余集）。
3. `FORWARD_LINE` = [0, 1, 1.5, 3, 5, 7, 8]；`PREREQ_MAP` 增 `1.5: [{ step: 1, gate: 'concept-signed' }]`。
4. 因 1.5 引入后**数组下标 ≠ step id**，把 5 处按位置索引（`steps[dep.step]`/`steps[n]`/`steps[0]`/
   `steps[7]`/`steps[FORWARD_LINE[i]]`）全部改为按 id 精确查找（`find`/`Map.get`）——
   这是本单对既有语义最大的守卫动作；orchestrator/lib/phase/webview 的消费路径逐一排查，
   其余消费方均按 `step` 字段匹配或整体遍历，无位置依赖。
5. `--prereq-check --step` / `--update --step` 接受 `1.5`（其余仍限 0-8 整数，错误信息更新）。
6. 新增 `STEP_IDS`/`normalizeStepWithGate`/`stepDef` 导出；自测新增 **GWT9**。

**step 1.5 前置链自测**（进程内 GWT9 全过 + CLI E2E 7 场景全过；
日志：test-reports/autopilot-work/RG-1/tt-journey-selftest.txt、prereq-1.5-e2e.txt）：

| 场景 | 期望 | 实测 |
|---|---|---|
| step1 未 done → `--update --step 1.5` | PrereqError exit 3，journey 不落盘 | exit 3，含"阶段 1 未完成…缺 gate: concept-signed" |
| 铺链 0→1+concept-signed 后 `--prereq-check --step 1.5` | exit 0 | `prereq OK: step 1.5`，exit 0 |
| `--update --step 1.5 --gate research-done --artifact docs/prior-art.md` | exit 0 且落盘 | step1.5 done + gate research-done + artifact 落盘 |
| 抹掉 step1 gate（模拟未签收）→ `--prereq-check --step 1.5` | exit 1 拦截 | exit 1，具名原因 |
| 同状态 `--update --step 1.5` | exit 3 | PrereqError |
| 既有语义：`--prereq-check --step 3`（step1 缺 gate） | exit 1 旧规则照常 | exit 1，原错误文案 |
| journey.json 全 id 序 | `0,1,1.5,2,3,4,5,6,7,8` | 一致 |

`node scripts/tt-journey.mjs --self-test`：**GWT1-GWT9 全 PASS**（exit 0）。

## D. 回归硬门（写面完成后实跑）

| 项 | 结果 |
|---|---|
| `node scripts/regression-all.mjs` | **13 PASS / 0 FAIL**（exit 0；S1-S13 逐段全绿，日志 regression.txt） |
| `node scripts/validate-structure.mjs` | **[OK] 结构校验通过（0 项警告）**（exit 0，日志 validate.txt） |
| `node scripts/ci.mjs` | CI PASS（import-graph：0 cycle；wiring conflict 1 处为 B5→B6 既有状态，与本单无关、改动前后一致） |
| `node scripts/orchestrator.mjs --self-test` 路径 | orchestrator 经 tt-journey 导入的 5 个符号签名未变，syncJourney/prereqCheck 路径复跑正常 |

并行单（EX-1/SB-1 等）同窗口对 executor-setup/runtime/regression-all 等文件有改动，本单未触碰；
回归是在包含其改动的工作区上跑绿的（联合口径），详见偏差 D-REG1-5。

## E. 偏差登记（D-xxx，待 Owner 裁决项如实列出）

| id | 偏差 | 状态 |
|---|---|---|
| **D-REG1-1** | **离线 SKIP 语义（须 Owner 裁决）**：兜底检索源（github-api/npm-registry）整体不可达时，`runQueries` 逐源返回"不可达"证据行，gate 主校验当前**不因断网而 FAIL**（沿 review-gate `VERIFY_SKIPPED` 先例：不误杀也不假装验证过）。替代方案：断网时直接 gate FAIL（更严）。本实现选了前者并诚实标注；**若 Owner 裁决应 FAIL，改 `main()` 一行聚合即可**。 | 待裁决 |
| **D-REG1-2** | research-done 未入 lib/journey.mjs / lib/phase.mjs 的 4 闸冻结词表：A 面 phase.check/transition 不认识 step 1.5（其 target 校验仍限 0-8 整数）。挂点由编排者批 2（FE-7 前端适配 + 收口接线）统一补——本单只在 B 面 tt-journey 语义内闭环，未越白名单改两个冻结投影面。 | 已登记（编排者接线项） |
| **D-REG1-3** | "≤150 行胶水"口径：主逻辑 146 行达标；全文件 220 行（含 50 行自测/注释）。若 Owner 要求全文件 ≤150，需把 self-test 外移。 | 待裁决（口径） |
| **D-REG1-4** | 内核探针为"探针级真跑"（无 API key，循环执行至模型调用边界抛错）；有 key 的全链路跑（搜索+报告）不在本轮（key 不在环境，未伪造）。VENDORED.md 升级纪律里的"探针重跑"沿用此探针。 | 已登记 |
| **D-REG1-5** | 回归为联合工作区口径：批 0 并行单（EX-1/SB-1/ON-1/AV-1/CR-1/TK-1）的改动同场在场，13/13 是包含全部在场改动的结果；未做"仅本单改动"的隔离回归（工作区不可冻结）。 | 已登记 |
| D-REG1-6 | vendor/deep-research 内 node_modules（npm install 产物，165 包）为探针运行依赖，留在工作区未删；是否随包分发由 AV-2/打包侧定（VENDORED.md 已注明其非 vendor 提交物）。 | 待打包侧裁决 |

## F. 白名单遵守声明

本单写面仅：`scripts/research-gate.mjs`（新）、`scripts/tt-journey.mjs`（改，+101/−34）、
`vendor/deep-research/`（新，含 VENDORED.md）、`docs/prior-art.md` + `docs/market.md`（新）、
`test-reports/autopilot-work/RG-1/`（新）。未改 SKILL.md/commands/webview/contracts/reference/plans/
其他 scripts；未提交任何 git commit（clone 属 vendor 行为例外）。
