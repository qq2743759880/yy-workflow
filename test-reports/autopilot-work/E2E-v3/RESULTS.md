# W2-4 RESULTS — E2E-v3 Production Ingress 完整验收（真实 CLI task 入口，Batch 3 Wave 2 Step 4）

> 执行：L1 独立 agent（全新上下文）。派单：`handoffs/v3/W2-4-dispatch.md`；契约权威：`plans/W2-0-ground-truth-ingress-contract-20260927.md`（已通读）。日期：2026-09-27。
> 纪律：第十三审计 F-025——全部场景自 `node scripts/orchestrator.mjs --task/--capability …` 真实 CLI 主链进入，**禁 probe 直调 dispatch、零手工构造 subtask**。生产代码零改动（只读验收）、零 git 操作；全部写面在本目录（白名单内）。
> 结论先行：**5 场景全部实跑留证；S1/S2 各存在实锤断言失败（F-E2E-1 / F-E2E-2），S3/S4/S5 全 PASS**。不自称 DONE，交编排者 L2 复核。

## 0. 环境与前置实测（`precheck-derive-route.log`）

- node v24.18.0，win32；无 `config.json`（仅 example）→ 无 executor/hosts 缺省注入。
- 工具在场：spectral 6.16.3（node_modules/.bin）、semgrep（PATH /c/Python314/Scripts）。
- 派生/路由实测（生产函数直读）：`对 OpenAPI 契约做安全校验` → **derive=null**（route T2_BACKEND）；`对登录接口做 OpenAPI 校验` → `{openapi-validation, matchedKey:'openapi 校验'}`（T2）；`数据库 schema 做 OpenAPI 校验` → `{openapi-validation}`（T1）；`对登录接口做安全审计` → `{security-audit, matchedKey:'安全审计'}`（T2）；`登录接口开发`/`前端页面重构` → derive=null。
- 环境注意（O-E2E-2）：本机 opencode CLI 配置模型（DeepSeek-V4-Flash-0731）无调用权限 → 凡真实派到 implementation 资产的 legacy 子任务必然失败（`s1a-cli.log`/`s2-cli.log` 中 opencode 报错原文），与 capability 面无关。

---

## 1. S1 正向（capability 派生）——逐断言

**S1a = 派单原文任务**（`tmp/ws-s1a`，`s1-dispatch-text/`）；**S1b = 原文同簇受控派生变体**（`对登录接口做 OpenAPI 校验` + `--contract`，`tmp/ws-s1b`）；**S1c = 真扫可达变体**（`数据库 schema 做 OpenAPI 校验` + `--contract`，T1 簇，`tmp/ws-s1c`）。

| # | 断言 | 结果 | 证据 |
|---|---|---|---|
| S1-1 | 派单原文任务 planner 派生 capability | **FAIL → F-E2E-1** | `s1a-state.json` 全文 0 处 `capability`/`selectedAsset`；`s1a-journey-projection.json` 5 行三字段全 null |
| S1-2 | 派单原文任务路由 T2_BACKEND（5 子任务） | PASS | `s1a-state.json` plan.cluster=T2_BACKEND |
| S1-3 | 派生命中（S1b/S1c：openapi-validation，matchedKey=`openapi 校验`） | PASS | `s1c-state.json` 3/3 子任务 `capability:'openapi-validation'`、`capabilitySource:'derived'` |
| S1-4 | orchestrator 透传 → runtime capability 模式（CLI 日志具名） | PASS | `s1c-cli.log` `capability dispatch: openapi-validation → asset=be-validator（原 asset 提示 … 被 capability 解析覆盖）`；S1b 同（`s1b-cli.log`） |
| S1-5 | resolver 解析 + 可回查链（D.4） | PASS | `s1c-state.json` `eligibility{capability:'openapi-validation', selected_asset:'be-validator', eligible:true, reason[0]='capability match: 请求「openapi-validation」→ CAPABILITY_MAP 命中 manifest id「be-validator」…'}`；Gate-2 manifest_sha256=b0268798… 与冻结 manifest 一致 |
| S1-6 | be-validator 绑定 → adapter spectral **真扫** | PASS | `s1c-spectral-contract-result.json`：`tool:spectral, version:6.16.3, mode:exec, findings_total:2, pass:true, scope:'real spectral 6.16.3 lint --ruleset vendor/be-validator/rulesets/spectral-oas.yaml against …openapi.json'`（对应子任务 2586ms 真实执行） |
| S1-7 | state.json 三字段 + 双写一致性（D.3） | PASS | `s1c-state.json` 3/3 子任务 `capability/capabilitySource/selectedAsset`，`selectedAsset==='be-validator'===asset` |
| S1-8 | journey 投影三字段（D.7） | PASS | `s1c-journey-projection.json` 3/3 行三字段与 state 一致；`s1c-journey.log`（tt-journey 真 CLI exit 0 渲染） |

S1 缺口登记（不改判 S1-6）：capability 重绑定后的子任务保留冻结 JSON 契约（`--contract` 覆盖只命中 planning 时 `asset==='be-validator'` 者，`scripts/orchestrator.mjs:706/727`）→ S1b 两个绑定子任务 spectral 诚实降级（`s1c-degraded-contract-result.sub0.json`：`degraded:true, diff:'contract file is JSON but not an OpenAPI spec…'`）→ **F-E2E-3**。真扫断言由 S1c（planning 时即 be-validator 的子任务）达成。

## 2. S2 正向（显式输入 `--capability security-audit`）——逐断言

任务=「登录接口开发」（T2 路由、派生 null，隔离显式输入变量）；S2c=同任务叠加显式覆盖探针（`对登录接口做安全审计 --capability code-review`）。

| # | 断言 | 结果 | 证据 |
|---|---|---|---|
| S2-1 | CLI 接受受控已知键（无 argError、进入 planning） | PASS | `s2-cli.log` 正常 planning→executing；exit 5 仅因 implementation 子任务 opencode 环境失败（O-E2E-2，legacy 面与 capability 无关） |
| S2-2 | `--capability security-audit` → security 资产**被 capability 选中** | **FAIL → F-E2E-2** | `s2-state.json` 全文 **0 处** `capability`/`selectedAsset`（字节级 grep）；5 子任务按 legacy 簇候选各就各位；security 子任务执行是 legacy 候选行为，非 capability 选择；CLI 日志 0 条 `capability dispatch` |
| S2-3 | journey 投影（D.7 null 显式写） | PASS | `s2-journey-projection.json` 5 行 `capability:null/capabilitySource:null/selectedAsset=asset` |
| S2-4 | D.1 precedence 1>2（显式应覆盖派生，S2c） | **FAIL → F-E2E-2** | `s2c-state.json` 观测 `security-audit/derived`，全 plan 0 处 `code-review`——显式 `--capability code-review` 被静默丢弃，派生值原样生效 |

## 3. S3 反向（`--capability unknown-key`）——逐断言

| # | 断言 | 结果 | 证据 |
|---|---|---|---|
| S3-1 | 具名失败 CAPABILITY_UNKNOWN（不猜、不静默） | PASS | `s3-cli.log` stderr 全文：`CAPABILITY_UNKNOWN: --capability 「unknown-key」不在 CAPABILITY_MAP 受控映射（fail-closed 不猜；键集事实源=scripts/lib/activation.mjs CAPABILITY_MAP）` |
| S3-2 | 退出码显式（EXIT.ARGS=2） | PASS | `s3-exit.txt` exit=2 |
| S3-3 | 零副作用（不落 state/contracts/artifacts） | PASS | `tmp/ws-s3` 为空目录（实跑后 ls） |
| S3-4 | 具名层位说明 | PASS（说明项） | 拦截发生在 CLI 参数校验层（lib validateOpts→exit 2）；契约 D.5 行 5 的 runtime 层 `INELIGIBLE_CAPABILITY_UNKNOWN` skip 因参数门先行而不可达（一致 fail-closed，两层不矛盾） |

## 4. S4 legacy 对照（无 capability 任务）——逐断言（`s4-legacy/s4-assert.log`）

任务=「前端页面重构」（T4，派生 null），真实 CLI 双跑（`tmp/ws-s4-run1`、`tmp/ws-s4-run2`）。

| # | 断言 | 结果 | 证据 |
|---|---|---|---|
| S4-1 | 双跑 state.json 挥发字段（planId/createdAt/frozenAt/checkedAt）归一后**字节级全等** | PASS | A1 true（`s4-assert.log`） |
| S4-2 | state.json 原文 0 处 `capability`/`selectedAsset` 字样（字节级零字段） | PASS | `grep -c` = 0（run1 与 run2 各 0） |
| S4-3 | 十六字段纪律（见 §6 详表） | PASS | A2：legacy 子任务序列化键 ⊆ 冻结 16 字段 ∪ 既有 runtime 执行态键，foreign keys = `[]` |
| S4-4 | capability 运行键差恰为契约追加集 | PASS | A3：S1c−S4 键差 = `["capability","capabilitySource","selectedAsset"]`，removed=`[]` |
| S4-5 | 当前 buildPlan vs W2-1 改造前基线快照（`../W2-1/baseline-planner.snapshot.mjs`）4 个 legacy 任务归一字节级全等 | PASS | A4：前端页面重构/数据库 schema 迁移/运维部署监控/知识库模型接入 全 true |
| S4-6 | journey legacy 行三字段 null 显式写（D.7）+ selectedAsset 回落 asset | PASS | `s1a/s2 journey-projection.json`（同为 legacy 行）；`s1a-journey-projection.json` 5 行实证 |

## 5. S5 resume（capability 任务中断 → --resume → 三字段保留）——逐断言

真实 CLI 两跳：run1（`tmp/ws-s5`，workspace 级 `.tt-state/executor.json` 配置 fixture `run_cmd:false` → EX-1 能力门真实降级）→ resume（`--resume`）。中断形态说明（O-E2E-3）：state.json 仅在 executePlan 完成后落盘（`scripts/orchestrator.mjs:789` 唯一写点）——进程击杀无 state 可恢复且 `--resume` 无 state 时会静默重规划；故以真实「非完整持久化 plan」（2 done-prompt + 3 skipped）走恢复路径，全部经真实 CLI 完成。

| # | 断言 | 结果 | 证据 |
|---|---|---|---|
| S5-1 | capability 任务派生 security-audit → 全部子任务 resolver 绑定 security | PASS | `s5-run1-cli.log` `capability dispatch: security-audit → asset=security…`；EX-1 `执行器能力缺失: run_cmd → 诚实降级（mode=prompt brief-only 兜底）` |
| S5-2 | 非完整 plan 持久化（状态含 skipped） | PASS | `s5-pre-resume-state.json`：5 子任务 2 done + 3 skipped（DEP_PRECONDITION），三字段在场 |
| S5-3 | `--resume` 重载旧 plan 并仅重试非 done（remaining=3），不重建不补派 | PASS | `s5-resume-cli.log` `resume plan plan-muirev5c status=done remaining=3 (skipped/failed retried, done skipped)`；-0/-2 `skip … (already done)` |
| S5-4 | resume 重执行后再落盘，三字段逐子任务保留 | PASS | `s5-post-resume-state.json` vs pre：5/5 `capability='security-audit'`、`capabilitySource='derived'`、`selectedAsset`（有则同值 'security'，pre-dispatch skip 者两侧一致回落）全 preserved=true |
| S5-5 | journey 投影 resume 前后一致 | PASS | `s5-pre-resume-journey.json` ≡ `s5-post-resume-journey.json`（5 行三字段逐行相同） |

## 6. 十六字段纪律核对（S4-3 详表）

**冻结 16 声明字段** = buildPlan 字面量 14（`id, planId, asset, contract, status, artifactPath, attempts, phase, dependsOn, desc, estimate, lane, approved, preconditions`，W2-0 §A 原文）+ 真实 CLI main 注入 2（`subtask.task` @ `scripts/orchestrator.mjs:702`、`subtask.contractMode` @ :725）。

实测（真实 CLI state.json，非探针）：
- legacy（S4）序列化键 = 冻结 16 中 12 个（`desc/estimate/lane/approved` 声明为 undefined，被 `JSON.stringify` 丢弃——W2-0 冻结形状既有事实，非本轮变化）∪ 既有 runtime 执行态键（`mode/adapter/eligibility/error` 等，W2 之前既有行为，含 AV-3 name-based `eligibility`）。**foreign keys = []**。
- capability（S1c/S5）= legacy 键集 + 恰好 `{capability, capabilitySource}`（planner 附加）+ `{selectedAsset}`（runtime 透传双写）；`eligibility` 键两侧同名（capability 模式下其内层含 `capability/selected_asset`——D.4 审计面）。**零外溢键、零删除键**（A3）。
- journey 投影行（D.7）：legacy 行三字段显式 null、capability 行三字段真实值，`selectedAsset` 缺席回落 asset——两侧均实证。

## 7. 偏差与发现登记（全部只读验收发现，未改生产代码）

| # | 级别 | 发现 | 证据与定位 |
|---|---|---|---|
| F-E2E-1 | 断言失败（验收项 1 原文不可达） | 派单任务文本「对 OpenAPI 契约做安全校验」**不命中受控派生表**（登记键为 `openapi 校验`/`接口契约校验`/`安全审计` 等逐字关键词；该文本的「安全校验」「OpenAPI 契约」均非登记项）→ derive=null → 全链 legacy。S1 断言链改由受控派生命中变体（S1b/S1c）完成验证 | `precheck-derive-route.log`、`s1a-state.json` 0 命中。处置需 Owner 裁定：改派单文本 or 扩登记词表（禁自由文本匹配的既有裁定不变） |
| F-E2E-2 | 断言失败（高危，S2 实锤） | **显式 `--capability`（D.1 precedence 1）在真实 CLI 主链未接线**：`scripts/orchestrator.mjs:700` `buildPlan(opts.task, manifest)` 未传第三参；`applyCapabilityToPlan`（`scripts/lib/orchestrator.mjs:312` 导出）在 `scripts/orchestrator.mjs` **0 个调用点**（grep 实证）。已知键被静默丢弃（无 warning），未知键被参数层拦截（exit 2）——校验层与执行层行为不一致。W2-1 RESULTS 仅验到 validateOpts 层（其 T3d），plan 应用层从未过真实 main；W2-2 D-W22-6 已登记 `scripts/orchestrator.mjs` 处于禁改清单导致接线遗留，本轮 E2E 实锤成案 | `s2-state.json`（0 capability 字段）、`s2c-state.json`（precedence 失效）、grep 记录（§2） |
| F-E2E-3 | 新发现（中） | capability 模式下 `--contract` 契约覆盖只命中 planning 时 `asset==='be-validator'` 的子任务；runtime capability 重绑定出的 be-validator 子任务保留冻结 JSON 契约 → spectral 诚实降级、真扫不可达（与 F-E2E-2 同根：plan 后处理链不感知 capability 重绑定）。孪生现象：O-1（全 plan 单 asset）语义下 `DEP_PRECONDITION` 几乎必然连锁（semgrep/portman emit 不置 `assetConsumed`） | `s1b-cli.log`、`s1c-degraded-contract-result.sub0.json` vs `s1c-spectral-contract-result.json` |
| O-E2E-1 | 前置缺口 | **W2-3 未执行**：`scripts/regression-all.mjs` 无 S17 段、`test-reports/autopilot-work/` 无 W2-3 目录、`CAPABILITY_ASSET_CONFLICT` 在 scripts/ 0 命中。派单前提「依赖 W2-1/2/3 全收」不成立（W2-1/W2-2 已收）。D.5 场景 4/9 的机验矩阵（含注入反例）整体缺席，本单不代偿 | grep/ls 实证（本轮） |
| O-E2E-2 | 环境 | 本机 opencode CLI 模型无权限 → legacy implementation 子任务必失败（S1a/S2 exit 5）。capability 模式（全 plan 绑定专用 adapter 资产）不受影响 | `s1a-cli.log`/`s2-cli.log` opencode 报错原文 |
| O-E2E-3 | 设计说明 | state.json 唯一落盘点在 executePlan 之后（`scripts/orchestrator.mjs:789`）：进程中途击杀无 state 可 resume，且 `--resume` 无 state 时静默重规划（`resumePlan` 返回 null → 走新建 plan 分支）。S5 采用真实非完整持久化 plan 恢复路径，断言不受影响 | 代码定位 + `s5-resume-cli.log` |
| D-W22-2（复核确认） | 既登记项 | pre-dispatch skip（DEP_PRECONDITION/能力门早退）子任务无 `selectedAsset` 键（S5 -1/-3/-4、S2c 同）；journey 行回落 asset。与 W2-2 §F D-W22-2 一致，非新缺陷 | `s5-pre-resume-state.json` |

## 8. 回归与越界核对

- 生产代码零改动：本轮全部文件写面 ⊆ `test-reports/autopilot-work/E2E-v3/`（含 tmp workspaces）；未执行任何 git 写操作。
- 未重跑全量回归三件（W2-1/W2-2 各自 RESULTS 已留全绿记录；本轮为只读 E2E，白名单不含 scripts/，无新回归面）。

## 9. 证据文件清单（本目录）

- 断言器：`journey-project-dump.mjs`（只读投影消费者，op=journey.project）、`s4-legacy/s4-assert.mjs` + `s4-assert.log`
- S1：`s1-dispatch-text/{s1a-cli.log,s1a-exit.txt,s1a-state.json,s1a-journey-projection.json}`；`s1b-derived-chain/{openapi.json, s1b-cli.log, s1b-exit.txt, s1b-state.json, s1b-journey-projection.json, s1c-cli.log, s1c-exit.txt, s1c-state.json, s1c-journey.log, s1c-journey-projection.json, s1c-spectral-contract-result.json, s1c-degraded-contract-result.sub0.json}`
- S2：`s2-explicit/{s2-cli.log,s2-exit.txt,s2-state.json,s2-journey-projection.json}`；`s2c-precedence/{s2c-cli.log,s2c-exit.txt,s2c-state.json,s2c-journey-projection.json}`
- S3：`s3-unknown/{s3-cli.log,s3-exit.txt}`
- S4：`s4-legacy/{s4-run1-cli.log,s4-run1-exit.txt,s4-run1-state.json,s4-run2-cli.log,s4-run2-exit.txt,s4-run2-state.json}`
- S5：`s5-resume/{s5-run1-cli.log,s5-run1-exit.txt,s5-pre-resume-state.json,s5-pre-resume-journey.json,s5-resume-cli.log,s5-resume-exit.txt,s5-post-resume-state.json,s5-post-resume-journey.json}`
- 前置：`precheck-derive-route.log`；工作区现场：`tmp/ws-s1a|ws-s1b|ws-s1c|ws-s2|ws-s2c|ws-s3|ws-s4-run1|ws-s4-run2|ws-s5`（含各自 .tt-state/state.json、artifacts、contracts 原件）
