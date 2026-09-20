# C-R3-activation — Owner 场景审查清单（FROZEN）

> 文档状态：`FROZEN / OWNER-APPROVED / C-R3=FROZEN`
>
> 配套契约：`contracts/C-R3-activation.md`（2026-09-13 receipt 完成版，替换框架草案 `d832e77d…`）。Owner 逐行走查；「期望」列已在冻结输入（GWT、dev-plan 原文、C6 实测）与 **Owner 十项决断（2026-09-13）** 处预填；「Owner 确认」列已按决断记录落笔（见各行情由）。快照：`240f3fbdb4ee757dffc4d5ab80407d1b2c84863c`。
>
> 判定规则：**contract defect** = 冻结后的实现行为与本表「期望」列不符，或出现本表禁止的行为（静默降级、无诊断截断、裸布尔升格为已验证/gate 输入、receipt 缺失崩溃、marker-only/copier-only 证据通过验证等）。判定前本清单本身不是验收标准。
>
> 范围说明：C6 裁决已存在（`REPRODUCED → RESOLVED`，执行报告 2026-09-13，7 case 观测与设计一致）；receipt 语义在配套契约 §7 定稿（D 组场景，R3-9…R3-12）。本清单连同配套契约经 Owner 场景审查（R3-1…R3-12）后，由 Owner 于 2026-09-13 显式决定 `C-R3 = FROZEN`（冻结记录 `plans/tasks/C-R3-freeze-20260913.md`）。

## A. 激活级别场景

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R3-1 | metadata-only 激活（不加载正文） | `activation.prepare {asset:'planning', activationLevel:'metadata'}`（subtask 仅需目录/eligibility 场景） | `data.activationPackage.activationLevel='metadata'`；payload 仅含 name/description/phaseEligibility/身份字段；body read count = 0 且 resource read count = 0（dev-plan R3 GWT 2 口径 `[计划输入]`）；`## 方法论正文（资产全文）` 段内为占位行 `（未激活正文）` `[草案 §5.2]` | payload 出现任何正文内容；或读取了 `vendor/planning/SKILL.md` 正文/任何 `reference/` 资源；或改动标题锚导致宿主 regex 失配；或无占位标注导致宿主误判遗漏 | **已决断（2026-09-13）**：hybrid 策略下 metadata 级用于 catalog 展示/路由评估/eligibility 判定（OQ-R3-4）。期望列无需改写即确认。 |
| R3-2 | body 激活（剥离 frontmatter） | `activation.prepare {asset:'colorize', activationLevel:'body'}` | payload = `vendor/colorize/SKILL.md` 内容按 `asset.mjs:5-10` stripFrontmatter 语义剥离 frontmatter 后全文（C6 探针同机制，机制不得改变 `[代码佐证]`）；tokenEstimate 带 method（CJK 回归量尺）与估算时点标识 `[Owner决断 §6]`；resource read count = 0 | frontmatter 残留进 payload；正文被改写/截断而无诊断；或将估算 token 表述为实测 | **已决断（2026-09-13）**：CJK×0.75+÷4 仅作回归量尺（OQ-R3-2）；body 为默认级别（OQ-R3-4）。首轮无硬预算、只记录估算（OQ-R3-1）。 |
| R3-3 | resource 激活（只加载显式请求的资源） | `activation.prepare {asset:'frontend-design', activationLevel:'resource', requestedResources:['<subtask 字段中列出的真实 reference/ 相对路径>']}` | payload = body 级内容 + 仅该请求资源的全文；`resources` 列出实际投递路径；`resourceHashes` 逐资源 sha256 `[草案 §3.1]`；未请求的 `reference/` 资源零读取 | 未请求的资源被加载（overfetch 回归——R1 实测全量 5,772,608 B / overfetch 30 正是要消除的行为）；或请求资源静默缺席 | **已决断（2026-09-13）**：资源请求来源 = subtask 字段；缺失 ⇒ `RESOURCE_NOT_FOUND` fail-closed（OQ-R3-5）。resource 级仅在显式请求时启用（OQ-R3-4）。 |

## B. 预算与失败场景

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R3-4 | token 预算（首轮无硬预算；显式给限时超限即 block） | (a) 首轮：`activation.prepare {asset:'<body 最大的资产，R1 实测 16,369 B>', activationLevel:'body'}`（不带 budget）——只登记估算；(b) Owner 给定 limit 后：同输入 + `budget:{limit: <小于估算值的数>}` | (a) 不拦截，activationPackage 正常产出，`tokenEstimate` 带 method/时点、`budget={limit 缺席, action:'block'}` `[Owner决断 §2.1/§6]`；(b) `ok:false` + `ACTIVATION_BUDGET_EXCEEDED`（dev-plan `:302` 原码），fail-closed 不产出投递包（GWT-R3-01 措辞 `[计划输入]`） | (a) 无 budget 时发生拦截或丢弃估算；(b) 超限后被静默全额投递；或出现 truncate 路径（已被决断排除）；或响应形状偏离 shell 同构性 | **已决断（2026-09-13）**：首轮不设硬预算、只记录估算，数值 `[待补充]`（OQ-R3-1）；超限 ⇒ block fail-closed（OQ-R3-3）。 |
| R3-5 | body 缺失（blocked） | 探针 workspace：拷贝 `vendor/<资产>` 并移除 manifest 文件后 `activation.prepare {asset:'<该资产>', activationLevel:'body'}`（不动真库） | `ok:false` + `ASSET_BODY_MISSING`（dev-plan `:302` 原码），fail-closed 不投递 `[草案 §2.1]`。现状对照：`asset.mjs:62-70` 静默 `body=''`、`prompt.mjs:17` 注入占位文案继续投递——现状 silent-degrade 在 bounded 模式下即 defect | 缺 body 仍产出含占位文案的投递包并照常派单；或错误码缺失/不可机验；或 catalog 层与 activation 层对缺失的归类互相矛盾 | **已确认（2026-09-13）**：fail-closed 纪律在 Owner 决断 3（预算超限 block）与决断 5（资源缺失 fail-closed）中一致适用；body 缺失同口径，无改写。 |
| R3-6 | source hash 失效（blocked） | `activation.prepare` 记录 `sourceHash` 后、投递/校验前修改该资产 manifest 字节（探针 fixture），随后 receipt 校验通道运行 | 校验返回稳定错误码 `RECEIPT_HASH_MISMATCH`（dev-plan `:303` 原码；§7.4 P2 / §7.5 → N2 `verification_failed`）；资产行为**不得**被标记为 verified（GWT-R3-04 `[计划输入]`）；旧产物保留为历史证据不被改写（PRD0 §9.3.6） | hash 已变仍通过校验；或行为被标记 verified；或旧证据被覆盖/删除 | **已确认（2026-09-13）**：P2 谓词与 N2 收口已按 GWT-R3-04 落入草案 §7.4/§7.5，Owner 决断未改写该期望。 |

## C. 兼容 / 降级场景

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R3-7 | legacy `assetConsumed=true` 产物（pre-R3 裸布尔，无 receipt） | 构造 pre-R3 形状 subtask 产物：`{assetId:'review', assetConsumed: true}`（无任何 receipt 字段），在 bounded/dual/strict 模式下由 R3 层读取 | 不崩溃、可读、计为 legacy 观察；**telemetry-only：不能单独或组合地满足 phase gate，不能升格为 behavior_verified**（`[Owner决断 2026-09-13]` OQ-R3-7；草案 §7.8/§8.3） | 因缺 receipt 结构抛异常/崩溃；或静默把裸布尔升格为"已验证"；或把它当作 gate 输入；或旧字段被删除/改写 | **已决断（2026-09-13）**：裸布尔 = telemetry-only，永不满足 phase gate（OQ-R3-7）。 |
| R3-8 | receipt-missing（subtask 产物存在但无 receipt 字段，R3 层须优雅降级） | R3 运行期 subtask 产物目录含 `output.md` 但产物/状态中无任何 receipt 字段（§7.4 P1 失败） | 优雅降级：带诊断的"未验证"视图（UNRESOLVED / `RECEIPT_INCOMPLETE`，§7.5 N3），流程继续（handoff 原文：`degrade gracefully, not crash`）；不产生任何 PASS/verified 状态（GWT-R3-03 精神 `[计划输入]`） | 崩溃/非零异常中断流程；或无诊断地当作已验证；或把降级状态静默显示为成功 | **已确认（2026-09-13）**：P1/`RECEIPT_INCOMPLETE`/N3 已落入草案 §7.4/§7.5，Owner 决断未改写该期望。 |

## D. Receipt 生命周期场景（本版新增——C6 裁决 + Owner 决断后可决断的 receipt 语义行）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R3-9 | marker-only 产物不得通过行为验证 | C6 fixture `title-only-with-kernel`：subtask 产物仅含资产 anchor 文本（kernel 资产，`vendor/colorize/SKILL.md` anchor = `MANDATORY PREPARATION`）；receipt 事件链 T1-T5 齐备 | behaviorCheck result = **FAILED**、reason `EVIDENCE_ECHO_ONLY`（§7.4 P4：移除 anchor/内核 token/注入指令复述 token/payload 片段后无实质内容）；result 不得是 VERIFIED，不得是 consumed/PASS（GWT-R3-03/04 `[计划输入]`） | 该产物被判 VERIFIED；或 reason 缺失/不可机验；或 P4 实现未先通过 §7.7 全部 7 case 回归 | **已落笔（2026-09-13）**：Owner 指令——receipt 契约须显式拒绝 marker-only 证据作为行为验证；谓词 P4 与 7 case 回归门据此写入草案 §7.4/§7.7。 |
| R3-10 | copier-only 产物不得通过行为验证（C6 reproduction case） | C6 fixture `title-plus-kernel-word`（零方法论 copier 产物：anchor + 1 内核词，C6 实测 legacy `assetConsumed=true`，两次运行一致）；同上事件链 | behaviorCheck result = **FAILED**、reason `EVIDENCE_ECHO_ONLY`；同 fixture 集内 `title-only-without-kernel`（legacy 实测 true）与 `fake-methodology-repeat5`（legacy 实测 true）同判 FAILED——**7/7 C6 case 均不得 VERIFIED**（草案 §7.7 对照表） | 任何 C6 case 在新谓词下得到 VERIFIED；或把"重复回显"（repeat5）当作增量证据；或实现宣称 assetConsumed 缺陷已修（状态未变，修复属实现任务） | **已落笔（2026-09-13）**：Owner 指令——显式拒绝 copier-only 证据；C6 7 case 作为最小回归 fixture 集写入草案 §7.7。 |
| R3-11 | receipt 幂等（重复 append 不产生重复事件） | 对同一 `(subtaskId, assetId, transition)` 以相同 `idempotencyKey` 两次调用 `receipt.append`，事件字节等价（`recordedAt` 豁免） | 第二次返回既有 `receiptRef`，`artifacts/<subtaskId>/receipt.json` 事件数组不变（§7.6）；同键不同 payload ⇒ `RECEIPT_INVALID`；重试（真实新执行）携带新键、正常追加 | 重复事件落入文件；或同键冲突被静默接受；或幂等返回值与首次不一致 | **已落笔（2026-09-13）**：幂等规则为草案 §7.6 `[草案]` 设计，Owner 决断 9（验证内嵌）确立 receipt.append 为唯一写入面后该规则随之生效；本行随全清单复审。 |
| R3-12 | receipt 存储（per-artifact 布局 + 状态可重放） | `receipt.append` 写入后检查 `artifacts/<subtaskId>/receipt.json`；随后仅凭该文件重放推导生命周期状态 | 文件 = append-only 事件数组（§3.4/§7.6），经 `store.mjs` 增量层写入，不混入旧 plan 字段；重放结果 == `result` 缓存（不一致 ⇒ `RECEIPT_INVALID`）；`eventSeq` 连续；`vendor/` 零写入 | 事件写进 legacy plan 字段；或写入 `vendor/`；或重放与缓存不一致而校验通过 | **已落笔（2026-09-13）**：布局 = Owner 决断 8（per-artifact）；验证内嵌 = 决断 9；本行随全清单复审。 |

## 使用说明

1. R3-2/R3-5/R3-6 的现状行为与 R3-3 的 overfetch 是冻结快照实测/代码锚点；Owner 审查的是「冻结后的期望」而非现状描述本身。
2. C 组/D 组的期望列基于 C6 执行证据（`test-reports/C6-execution-20260913/REPORT.md`，verdict `REPRODUCED`、runStability `IDENTICAL`）与 Owner 十项决断（2026-09-13）预填；receipt 语义在配套契约 §7 已定稿并随 Owner 2026-09-13 决定冻结。
3. 「Owner 确认」列已按 2026-09-13 十项决断与 Owner 指令落笔（决断记录见草案 §10）；Owner 场景审查时对每行复认或改写，改写即构成对该条款的新决断记录。
4. 本清单与配套契约已由 Owner 决定冻结（`C-R3 = FROZEN`，2026-09-13）。R3 READY 公式：`R2.5 == DONE && R2 release-ready == ACCEPTED && C-R3 == FROZEN && C6 == RESOLVED`（R2-acceptance `:85`）；C6 项已满足、C-R3 已冻结，R3 达 execution-READY。
