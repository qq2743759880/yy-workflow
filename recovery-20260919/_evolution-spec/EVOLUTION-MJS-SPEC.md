# scripts/lib/evolution.mjs — 重建规格书（evolution-spec）

> 目标文件：`D:/.ai-hub/skills/yy/scripts/lib/evolution.mjs`（已删除；sha256 前 16 位 `9ea238c4de3a3fd7`）。
> 本规格书汇编自 codex 会话转录中**全部**可考的规格细节，逐条标注来源。实现者会话确认丢失
> （全盘 09-08..09-19 的 84 个 jsonl 中无一含 run-fixtures/evolution.mjs 的写入痕迹；09-19 删除后取证会话
> 全盘搜索 evolution.mjs 零命中）。重建者按本规格书实现后，可用 §11 的行为断言 + §12 哈希目标自验。

---

## 0. 文件身份与可验目标

| 项 | 值 | 来源 |
|---|---|---|
| 路径 | `scripts/lib/evolution.mjs`（新增文件，untracked） | 编排者 git status（jsonl line#2129 OUT） |
| sha256 前 16 位 | `9ea238c4de3a3fd7` | Get-FileHash 表（line#2129 OUT）；验收报告 write-scope 行 |
| 文件长度 | **≥507 行**（L507 实测存在；非任务简报误传的 L178——L178 是 REPORT.md 的 route41Rerun 行） | Select-String 输出（line#2145 OUT） |
| `evolution.(propose\|accept)` 出现次数 | `src_ops=5` | 同上 |
| 六错误码相关行数 | `six-code-lines=42`（42 行含六码之一） | 同上 |
| 文件头注释主题 | catalog/change records/R3 receipt/R8 finding ledger 的"只读保证"（§2.2） | L14（同上） |

## 1. 操作面（仅两操作）

- 仅 `evolution.propose` 与 `evolution.accept` 两个操作；**不新增操作名**。
  来源：R10 实现派单要求 1（jsonl line#2110 MSG）；C-R10 契约头「操作名：仅 `evolution.propose`、`evolution.accept` 两个（`[计划输入 dev-plan:311-312]` 原码）」（11-17-31 会话 git diff 输出）。
- 消费方只读：R3 receipt/behavior 证据类别与 P1-P5、R4 CI truth 分类、R8 finding schema/accepted finding —— **只读消费，不重定义**（派单要求 9；契约 §1.2 non-goals L57-L59）。

## 2. 统一响应壳与错误码

- 响应壳：`{ok, code, data, evidence, warnings}`（派单要求 1；fixture 断言逐字段使用）。
- 错误码**仅六个**（新增第七码 = STOP 条件）：
  1. `CANDIDATE_INVALID` — 候选违反 §2.1 十项不变量（f02 实测 reason：`候选缺少十项不变量字段: trigger（§2.1 fail-closed）`）或 assetId 不在 16 白名单（f03）。
  2. `BASELINE_MISSING` — baseline 五键缺任一（§4）。
  3. `ASSET_VERSION_CONFLICT` — 同 assetId 同 sourceVersion 已有未终态候选（f05）。
  4. `INDEPENDENT_VERIFICATION_REQUIRED` — producer 自验/自批或独立 verdict 缺失（f07；契约 §6.1 L201-205）。
  5. `EVOLUTION_REGRESSION` — token/behavior/compatibility 任一维度回归或重复压测不一致（f09；契约 §6.2 表 L211）。
  6. `PROMOTION_NOT_ALLOWED` — promotion decision 缺基线对标/独立 verdict/目标符号未满足（f08/f11；契约 §6.2 表 L212）。
- 六码均为 dev-plan:311-312 原码（契约标注 `[计划输入 dev-plan:312] 原码`）。

## 3. 候选 schema（契约 §2.1 要点）

- 字段：候选 schema + `sourceVersion` + `proposedBy`（§2.1）；assetId ∈ 16 资产白名单（§8）。
- **十项不变量**：f02 实测证明 propose 对十项不变量字段逐一校验、fail-closed、错误信息指名缺失字段（已证实字段名之一：`trigger`）；其余九项字段名未在转录中出现（GAP）。
- `candidateId = cnd-<YYYYMMDDTHHMMSSZ>-<8位随机>`（紧凑形，对齐 C-R4/C-R7 惯例）【OQ-R10-1=A 逐字】。
  实测样例：`cnd-20260917T025555Z-e0755918`、`cnd-20260917T025555Z-d5b2d6cf`。
- `idempotencyKey`：propose 支持幂等；同 key 重复调用返回原 candidateId 并附 warning
  `DUPLICATE_REPLAY: evolution.propose 已存在同 idempotencyKey 候选，返回原 candidateId <id>`（f06 实测原文）。
  （注：DUPLICATE_REPLAY 以 **warnings** 通道表达，不在六错误码内。）
- 存储布局：`evidence/evolution/<assetId>/<candidateId>/{candidate/, baseline/, promotion/}` 三目录，append-only【OQ-R10-1=A】。
  实现约束：fixtures 沙箱化在报告目录下，仓库根不创建 `evidence/evolution/`（验收报告 write-scope 行）。
- 候选状态集：`CANDIDATE_STATUSES` 六值（REPORT.md L154 提到"状态集 = `CANDIDATE_STATUSES` 六…"，转录截断）；
  16 资产闭环行状态 ∈ `UNCHANGED | CANDIDATE | PROMOTED | REJECTED | UNRESOLVED`（契约 §5.3 L193；派单要求 8）。

## 4. Baseline-first 五键（propose 侧前置）

- baseline 必须先在**不含候选**情况下运行并记录 route/activation/token/receipt/behavior 结果（GWT-R10-02 原文，契约 §0.1 L33）。
- `BASELINE_REQUIRED_KEYS` 五键 = **结构 / manifest / receipt 终态 / CI 段 / rollback 目标**；缺任一键 ⇒ `BASELINE_MISSING`，fail-closed，不臆断补全【OQ-R10-2=A 逐字】。
- REPORT.md L150 证实实现侧常量名为 `BASELINE_REQUIRED_KEYS`（`evolution.propose` 侧 `BASELINE_REQUIRED_KEYS` 检查）。
- `baseline.baselineRef` 精确结构 = 契约 `[待补充]`，实现仅要求含五键（REPORT.md L166 残余清单）。

## 5. Promotion 三维判定（accept 侧）

- 判定结构 = **token 预算不增 + behavior（receipt 终态）不劣于 baseline + compatibility（结构/CI）全过**【OQ-R10-3=A】；由 R1/R4 测量基线驱动，单 call-rate 指标不得单独判升（契约 §3.3 L150：asset-call-rate 仅 telemetry 输入之一）。
- 三维输入对象（evolution.mjs L390-392 注释原行）：
  ```text
  L390:  *     tokenResult: { ok (bool), [待补充阈值数值] }
  L391:  *     behaviorResult: { ok (bool), [待补充阈值数值] }
  L392:  *     compatibilityResult: { ok (bool), [待补充阈值数值] }
  ```
- 阈值数值 = 显式参数，保持 `[待补充]`；缺失时**不得自动判升**，按 `PROMOTION_NOT_ALLOWED` / `UNRESOLVED` fail-closed 收口（派单要求 4；契约 §3.2 L142-146）。
- 恢复的源码行（Select-String，line#2145 OUT 原文）：
  ```text
  L473: //   任一缺失或 ok 非 true → PROMOTION_NOT_ALLOWED fail-closed（阈值数值 [待补充]，不编造）
  L489: // 阈值数值缺 Owner 给定的具体判定字段 → 如实登记 [待补充]
  L503: // 三维任一缺失 → PROMOTION_NOT_ALLOWED（fail-closed，阈值数值 [待补充]）
  L507: warnings.push('等 Owner 给数: promotion 三维判定缺 ' + missingDims.join(', ') + '（OQ-R10-3=A 阈值数值 [待补充]）');
  ```
- promotionDecision 三维字段名（REPORT.md L81）：`budgetDelta` / `receiptTerminalWorse` / `ciPass`；缺失时 `unresolvedThresholds` 如实登记。
- f08 实测：tokenResult.ok 缺失 → `PROMOTION_NOT_ALLOWED` + `verdict=UNRESOLVED`（unresolved 列表随响应输出）。

## 6. 防自验与 isolated-context（OQ-R10-4=A）

- isolated-context profile 五字段 = `{sessionId, agentIdentity, contextSeed, limitations[], provisionalStatus}`【OQ-R10-4=A 逐字】。
- `accept.isolatedVerdict` 必填 sessionId/agentIdentity/…（REPORT.md L151；截断）。
- fresh 独立子代理优先；否则独立 session + 记录 limitation（沿 GWT-R10-04）。
- **防自验**：`candidate.proposedBy` 或 producer 不得作为自身候选的验收方；accept 调用携带的 isolated verdict 缺失/非独立身份出具/producer 试图自验 ⇒ `INDEPENDENT_VERIFICATION_REQUIRED`，fail-closed，候选保持 CANDIDATE/PROVISIONAL（契约 §6.1 L201-205；f07 实测 reason 原文：`验收方身份与 proposedBy 相同（producer 自验，§6.1 禁止）`）。
- 平台降级（本环境无原生独立子代理）：独立会话/身份 + limitations 显式记录（实测值 `limitations: ["同会话执行，平台降级"]`，REPORT.md L10）+ 候选保持 PROVISIONAL；不允许 producer 盖章 PROMOTED（§6.1 L205）。

## 7. PROVISIONAL 升格与 rollback rehearsal（OQ-R10-5=A）

- PROVISIONAL→PROMOTED 升格证据 = **独立上下文验收 exit 0 + 无 EVOLUTION_REGRESSION + rollback 排练通过**（`rollbackRehearsalPassed=true`，REPORT.md L99）。
- 任一回归 ⇒ 回退 catalog 到 last accepted + 失败候选证据轨迹保留【OQ-R10-5=A】。
- 重复压测两次不一致 ⇒ UNRESOLVED/REJECTED，不得以一次通过晋升（契约 §5.2 L189；派单要求 6）。
- f11 实测：PROVISIONAL 缺 rollbackRehearsalPassed → `PROMOTION_NOT_ALLOWED` + `verdict=UNRESOLVED`。

## 8. Promotion/rollback receipt 与 catalog 纪律（OQ-R10-6=A）

- receipt schema = `{promotionId, candidateId, baselineRef, verdict, promotionDecision, rollbackTarget, executedAt, approvedBy, canonicalHash}`【OQ-R10-6=A 逐字】；`canonicalHash` = sha256 同构 C-R4。
- **catalog 不由实现写入**：catalog 只在 promotion receipt 完成后才更新；本实现只签 receipt，不直改 catalog（evolution.mjs L30 注释原行："catalog 只在 promotion receipt 完成后才更新；本实现只签 receipt，不直改 catalog"；派单禁止条款"catalog 更新只许经 promotion receipt 路径且须在报告中给出落点证据"）。f10 实测 receipt=true。
- 失败/未决：候选 → REJECTED/UNRESOLVED；失败候选留证据轨迹；catalog 停留最后接受版本（契约 §6.2 表 L213）。
- EVOLUTION_REGRESSION / PROMOTION_NOT_ALLOWED 时 **promotion receipt 仍签发（append-only 轨迹）**（REPORT.md L153，截断于"（appen…"）。

## 9. 16 资产闭环（summarizeAssetStates）

- `summarizeAssetStates` 遍历 16 白名单资产，每行显式状态 ∈ UNCHANGED|CANDIDATE|PROMOTED|REJECTED|UNRESOLVED；`hasGap`/`missingRows` 如实输出；聚合百分比不得掩盖缺失行（REPORT.md L154；契约 §5.3 L193-195）。
- f12 实测：`rows=16 aggregate={"UNCHANGED":14,"REJECTED":1,"PROMOTED":1}`（exit 0）。
- 缺行 = R6 阻塞信号；实现侧如实输出，不宣告 R6 状态（派单要求 8）。
- **16 资产白名单**（幸存 snap `vendor/` 目录逐字，16 根）：
  `agent-research, agent-vision-toolkit, be-architect, be-provider, be-resilience, be-validator, colorize, dev-planner, frontend-design, frontend-visual-validation, implementation, planning, review, sdlc, security, skill-sentinel`

## 10. 纪律声明与写入范围

- `route41Rerun.required = false`（零路由改动；R10 不改 R2 路由关键词/簇/状态，evolution.mjs 零涉及路由面——REPORT.md L178）。
- `acceptancePerformedByExecutor = false`（实现方未自验；验收属编排者）。
- 允许写入：`scripts/lib/evolution.mjs`（新）、`evidence/evolution/`（实现期新建目录；实际未在仓库根创建）、`CHANGELOG.md`（追加式）、`test-reports/R10-implementation-20260917/` 全部。
- STOP 条件（派单原文）：冻结输入哈希 mismatch；需要第七个错误码或第三个操作名；promotion 落地必须改 catalog 既有文件结构；需要 Owner 未给出的阈值数值（按要求 4 收口后继续，不算 STOP）；16 资产闭环基线数据不存在（如实登记 UNRESOLVED 行）。

## 11. 文件头注释恢复行（L14-L30，Select-String `待补充|等 Owner 给数|catalog` 命中原文）

```text
L14:  *    catalog、change records、R3 receipt、R8 finding ledger（§2.2 "只读保证"）。
L19:  *    baseline + compatibility（结构/CI）全过。阈值数值 [待补充] → 实现侧为显式参数，
L21:  *    在 warnings 中显式标注 "等 Owner 给数"，禁止编造数值。
L28:  *    无 EVOLUTION_REGRESSION + rollback 排练通过；任一回归 → 回退 catalog 到 last accepted
L30:  *    catalog 只在 promotion receipt 完成后才更新；本实现只签 receipt，不直改 catalog
```
（L14-L30 为 JSDoc 文件头，主题依次：只读保证 → 三维判定 → 阈值治理 → 升格/回退 → catalog 纪律。）

## 12. 行为级验收断言（重建后必须复现）

run-fixtures 12 用例与逐行期望输出见 `../test-reports/R10-implementation-20260917/fixtures/README-recovered-semantics.md`
（fixture-results.json 幸存副本同目录 `out-fixture-results.surviving-copy.json`）。重建通过标准：
`node test-reports/R10-implementation-20260917/run-fixtures.mjs` → `[PASS] ×12`、`TOTAL: 12/12 PASS`、`EXIT=0`，
且 12 行摘要与 README 表"复跑实测摘要"列逐字一致。

## 13. 契约 C-R10 恢复文本（verbatim 片段汇编）

> 契约全文（`contracts/C-R10-evolution.md` = `87301cec11c5146d7cde8591c3888017b4a401cd7916dc9b146ea41c20c2ec53`，
> checklist = `31cd4e08a37d4cd809773672c6943a7b935b26acd8a034e736b6f07818692659`）本体未在任何存活转录中完整出现
> （09-15 起草会话与 09-16 冻结会话均丢失）。以下为编排者会话逐行引用的片段（行号为契约真实行号）。

### 13.1 头部（drafts→frozen 的 4 行迁移，11-17-31 会话 git diff 逐字）

- 标题：`# C-R10-evolution — Skill Asset Evolution and Independent-Context Acceptance Contract`（冻结稿去 Draft 后缀）
- 状态行（冻结稿）：`> 文档状态：C-R10=FROZEN（2026-09-16 冻结；OQ-R10-1…6 已由 Owner 全项裁决 = A 并逐字吸收正文，见各节 [Owner 决断 OQ-R10-x=A，2026-09-16] 标注；本契约不解锁任何任务，G2.2 图 §8：contract drafts never unlock tasks；R10 状态 = BLOCKED，见 R10 task doc 首行与 G2.2 图 R10 行；残余 [待补充]：OQ-R10-3 阈值数值，归属 R10 实现阶段 Owner 给数或保持待补充进实现）。本件为冻结载体，原稿 FROZEN-SOURCE 保留于 contracts/drafts/C-R10-evolution.draft.md，冻结记录 plans/tasks/C-R10-freeze-20260916.md。`
- 登记名行：`> 契约登记名：C-R10-evolution（G2.2 图 §3 R10 行与 §8 冻结序列为准：C-R10-evolution（R10 creates: evolution.propose, evolution.accept；consumed by R6））。本文件与配套清单 contracts/C-R10-evolution-review-checklist.md 是该契约的冻结载体（沿 C-R8 先例）。`
- 纪律声明行（冻结稿）：`> 纪律声明：本契约由 C-R10-evolution draft agent 起草、2026-09-16 由 C-R10 revision/freeze agent 吸收 Owner 裁决并冻结——不改 runtime/contracts-drafts以外的 contracts/plans/vendor、不做验收。route41Rerun.required = false；acceptancePerformedByExecutor = false。16 个 vendor/ 根只读引用、不修改。`
- 操作名行（drafts/frozen 共同正文，diff 上下文）：`> 操作名：仅 evolution.propose、evolution.accept 两个（[计划输入 dev-plan:311-312] 原码）。不新增操作名。`
- 证据标签行（diff 上下文）：`> 证据标签沿用 C-R3/C-R4/C-R8 惯例：[计划输入] = PRD0/dev-plan/G2.2 图/R10 task doc 条目；[R3冻结] = contracts/C-R3-activation.md（FROZEN，hash 见 §0）；[R4冻结] = contracts/C-R4-control.md（FROZEN，hash 见 §0）；[R8冻结] = contracts/C-R8-remediation.md（FROZEN，hash 见 §0）；[草案] = 本文件新提出、需 Owner 场景审查确认的内容；[Owner 决断 OQ-R10-x=A，2026-09-16] = Owner 已裁决并逐字吸收的正文（见各节）；[待补充] = 无实测值或缺 Owner 裁决，禁止编造、不替决。`

### 13.2 §0.1 设计前提五项（L31-L37 逐字）

1. **Baseline-first 压力测试**：候选进入评估前，baseline 必须先在**不含候选**的情况下运行并记录结果（GWT-R10-02 原文："the baseline runs without the candidate and records route, activation, token, receipt, and behavior results first" `[计划输入 dev-plan:288 / R10 doc GWT-R10-02]`；本文件 §5 场景协议）。
2. **生产者禁止自验/自批**：R10 doc Boundary non-goals 原文"allowing the producer to accept its own candidate"；dev-plan:312 accept review column 原文"生产者是否试图自验或绕过独立上下文"；G2.2 R10 行"no self-acceptance"。独立上下文验收与判责分离是 promotion 的必要条件（§4/§6，`INDEPENDENT_VERIFICATION_REQUIRED` 防自验）。
3. **平台降级诚实标注**：无平台原生独立上下文时，使用独立执行会话/身份、报告点明限制、候选保持 `PROVISIONAL` 直至独立验收完成（GWT-R10-04 原文；§4）。不允许静默把非独立验证当作已独立验收。
4. **Rollback 排练**：失败候选或被拒候选必须保留证据轨迹，catalog 停留最后接受版本，回滚必须有排练（GWT-R10-05 原文与 G2.2 R10 兼容/回滚"rollback rehearsal required"；§5/§6）。回滚不得改写已发生的真实观察。
5. **不凭单指标直接升级资产**：R10 doc Boundary non-goals 原文"changing the 16 assets directly from a metric threshold"；GWT-R10-L1 原文"the R1/R4 measurement baseline (not a single call-rate metric) drives promotion decisions"；PRD0 §6.2"不能接受…用调用率单指标升级"（§3 阈值治理）。

### 13.3 §1 scope / non-goals（L41-L62 逐字）

- §1.1 in scope：版本化候选；两操作契约完整输入/输出/response shell/错误码/幂等；候选 schema 与 source version（§2）、阈值治理（§3）、fresh isolated-context profile（§4）、pressure scenarios（§5）、独立 verdict 与 promotion/rollback 政策（§6）。
- Exact files（复用对象）：16 个 `vendor/` 资产根、`reference/memory-and-sync.md`、`reference/planning.md`、`reference/dispatch-and-acceptance.md`、`scripts/asset-call-rate.mjs`、`scripts/review-gate.mjs`、`scripts/validate-structure.mjs`、`evidence/evolution/`（实现期新建）、`CHANGELOG.md`（版本/index 记录）`[计划输入 R10 doc §Exact files / dev-plan:281]`。
- 默认验收机制 = 平台原生独立上下文/subagent；不可用时走 GWT-R10-04 降级。
- 后置衔接：候选资产只有在 **promotion receipt 完成后**才能更新 catalog（dev-plan:280）；R6 复核版本、回滚与全 16 资产矩阵。
- §1.2 non-goals：不从单指标阈值直接改动 16 资产本体；不允许 producer 验收自己的候选；不为 MVP 增加远程模型/评估平台；不重定义 R3 receipt/behavior 证据类别与 P1-P5 谓词；不重定义 R4 CI truth 分类语义；不重定义 R8 finding schema 或状态枚举；不修改任何冻结文件；不做最终独立验收（属 R6/独立 Execution Agent）；不新增操作名、不新增错误码；不改 R2 路由（`route41Rerun.required = false`）。

### 13.4 §3.2 阈值数值与完整度标准（L142-L146 逐字，见 §5 引用）

### 13.5 §5.2/§5.3（L186-L195 逐字）

- §5.2 重复压力测试（isolated）：验收方在 fresh isolated-context 中对每个候选运行**重复压力测试**（GWT-R10-03 原文 "repeated pressure tests"）；结果（route, activation, evidence, behavior）与模型/session 身份同记。重复运行稳定性 = promotion 判定的输入（两次不一致的判定按 UNRESOLVED/REJECTED 收口，不得以一次通过晋升）。
- §5.3 16 资产闭环：演化审查完成后，每个资产必须有显式状态 ∈ `UNCHANGED | CANDIDATE | PROMOTED | REJECTED | UNRESOLVED`（GWT-R10-06 原文）；**聚合百分比不得掩盖缺失行**（GWT-R10-06 原文："aggregate percentages cannot hide missing rows"）。任一 16 资产缺显式状态 ⇒ R6 复核/发布阻塞。catalog 停留在最后接受版本；失败候选留证据轨迹。

### 13.6 §6.1/§6.2（L201-L215 逐字，见 §6/§8 引用）

### 13.7 OQ-R10-1…6=A（冻结记录逐字授权原文）

```text
OQ-R10-1=A：candidateId = cnd-<YYYYMMDDTHHMMSSZ>-<8位随机>（紧凑形，对齐 C-R4/C-R7 惯例）；存储布局
  evidence/evolution/<assetId>/<candidateId>/{candidate/, baseline/, promotion/} 三目录，append-only。
OQ-R10-2=A：BASELINE_MISSING 完整度标准 = baseline 五键齐备（结构 / manifest / receipt 终态 / CI 段 /
  rollback 目标），缺任一键 ⇒ BASELINE_MISSING，fail-closed，不臆断补全。
OQ-R10-3=A：promotion 由 R1/R4 测量基线驱动，不凭单 call-rate 指标；三维判定 = token 预算不增 +
  behavior（receipt 终态）不劣于 baseline + compatibility（结构/CI）全过；阈值数值留 [待补充]，
  冻结时标注"由 Owner 在实现阶段前给数或保持 [待补充] 进实现，不得由草案编造"。
OQ-R10-4=A：isolated-context profile 字段 = {sessionId, agentIdentity, contextSeed, limitations[],
  provisionalStatus}；fresh 独立子代理优先，否则独立 session + 记录 limitation（沿 R10 doc GWT-R10-04）。
OQ-R10-5=A：PROVISIONAL→PROMOTED 升格证据 = 独立上下文验收 exit 0 + 无 EVOLUTION_REGRESSION +
  rollback 排练通过；降级路径 = 任一回归 ⇒ 回退 catalog 到 last accepted + 失败候选证据轨迹保留。
OQ-R10-6=A：promotion/rollback receipt schema = {promotionId, candidateId, baselineRef, verdict,
  promotionDecision, rollbackTarget, executedAt, approvedBy, canonicalHash}；canonical = sha256 同构 C-R4；
  与 R6 复核衔接 = R6 复核 promotion receipt 链完整性。
```
来源：`plans/tasks/C-R10-freeze-20260916.md`（= `aeabf6164cdaf83f6557d7d31053b46f33319acd15cda1ef9fac879c1990f749`）
在 11-17-31 会话的 Get-Content 输出（jsonl line#79→83 OUT，截断前部分全文恢复）。

## 14. R10 实现派单（2026-09-17，逐字全文，jsonl line#2110 MSG）

> 实现要求十条、允许写入、禁止、STOP 条件、完成报告模板——与 §1-§10 一一对应，原文已全文收录于
> 编排者消息；关键句摘要（全文见 jsonl）：
> 1. 仅两操作/六错误码/统一响应壳；2. candidateId 与三目录 append-only（OQ-R10-1=A）；3. baseline 五键（OQ-R10-2=A）；
> 4. 三维判定结构、阈值 [待补充] fail-closed（OQ-R10-3=A）；5. isolated profile 五字段 + 降级 + 防自验（OQ-R10-4=A）；
> 6. 升格证据与回退（OQ-R10-5=A）；7. receipt schema 九字段 + canonicalHash 同构 C-R4（OQ-R10-6=A）；
> 8. 16 资产闭环六态；9. 消费不重定义；10. route41Rerun.required=false。
> 冻结输入 10 件（逐一 sha256 校验）：契约 87301cec…、清单 31cd4e08…、冻结记录 aeabf616…、
> R10 task doc `docs/tasks/yy-skill-loading-v3/R10-asset-evolution-acceptance.md` = 9fefb972c0971351a8d08fb51bf9e73d3bb80a7a938f42f0ba5d7ce39ebc9617、
> dev-plan d2e8e5b4…、G2.2 e2b63a2b…、PRD0 14f4dfe8…、C-R3 cfb07784…、C-R4 19055ff7…、C-R8 d9d33d48…。

## 15. GWT 定义（G2.2 图 L194 原文）

`GWT-R10-01…06` (R10 doc: candidate traceability, baseline-first, isolated acceptance, platform-fallback honesty, promotion/rollback, 16-asset closure) + `GWT-R10-L1`: Given C7's quality findings, when candidates form, then the R1/R4 measurement baseline (not a single call-rate metric) drives promotion decisions.

## 16. 重建后的回归核对表（post-R10 任务前基线，编排者复测）

| 文件 | sha256 前 16 位（R10 完成后实测；重建不得改动） |
|---|---|
| scripts/lib/journey.mjs | fe9bb851f8a36359 |
| scripts/tt-journey.mjs | 0d5a42c61940a362 |
| scripts/lib/change.mjs | 3f37d9b5dedf7ce8 |
| scripts/lib/remediation.mjs | b65381d4f0eb2059 |
| scripts/lib/phase.mjs | 59b19bd2721bbe70 |
| scripts/lib/activation.mjs | 923396877c5bcdd4 |
| scripts/lib/receipt.mjs | 9f3b5c4674a05d4a |
| scripts/lib/adapters/prompt.mjs | 69d4dc8a92fe8746 |
| scripts/lib/asset.mjs | e1fdf5168213f456 |
| scripts/lib/gate.mjs | e63b97dcb7c4ed53 |
| scripts/lib/state.mjs | 3da5734e9115e5f8 |
| scripts/lib/store.mjs | 94ce8d01f705baee |
| scripts/lib/runtime.mjs | d3fbe5a6851ed176 |
| CHANGELOG.md | 41e948d6ef659564 |

## 17. GAP 清单（逐字未恢复的部分）

1. evolution.mjs 除 L14/L19/L21/L28/L30、L390-L392、L473/L489/L503/L507 外的全部源码行（含 import、
   `CANDIDATE_STATUSES` 六值的完整字面、十项不变量字段表的九个未知字段名、run() 入口签名、
   evidence 写盘实现、idempotencyKey 存储、receipt 落盘函数、summarizeAssetStates 聚合实现）。
2. run-fixtures.mjs 本体与 12 个 fixture 文件本体。
3. R10 REPORT.md 的 GAP 行（见 ../test-reports/R10-implementation-20260917/REPORT.md 行间标注）与 REPORT.yaml 全文。
4. C-R10 契约 §2（候选 schema 全表）、§4（isolated profile 全节）、§5.1（baseline 记录完整度判定全节）、
   §7（证据合成）逐字文本；§2/§4 的存在与要点由派单、OQ 裁决与 REPORT.md 恢复行交叉证实。
