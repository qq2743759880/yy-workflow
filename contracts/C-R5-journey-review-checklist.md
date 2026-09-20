# C-R5-journey — Owner 场景审查清单（FROZEN）

> 文档状态：`C-R5=FROZEN / OWNER-REVIEWED`（2026-09-15；Owner 冻结授权 OQ 全项 = A 即冻结确认，「Owner 确认」列保持留空，沿 C-R4 先例）。源件：`contracts/drafts/C-R5-journey-review-checklist.md`（OWNER-REVIEWED / FROZEN-SOURCE，保留不删）。配套契约：`contracts/C-R5-journey.md`（FROZEN）。
>
> 组织方式：按 R5 doc `GWT-R5A-01…03`（handoff 指定）+ dev-plan R5a GWT 1-4（G2.2 R5a 行登记）逐行展开。每行必含：exact input / expected outcome / defect if / Owner 确认（留空）。**期望列已按 Owner 2026-09-15 冻结裁决（OQ-R5-1…10 全项 A）更新**，正文契约 `contracts/C-R5-journey.md` §8 索引已 OPEN→DECIDED。
>
> 判定规则（沿 C-R3/C-R4 清单惯例）：**contract defect** = 冻结后的实现行为与本表「期望」列不符，或出现本表禁止的行为（日志标签伪造完成态、静默 SUCCESS、跨 session 串读、inferred 授权、failed/skipped 显示为 done、第二套 Journey writer、SAMPLE nextPrompt、blocking 后无条件成功等）。本清单本身在判定前不是验收标准。
>
> 「期望」列预填来源 = 冻结 GWT 原文（R5 doc `GWT-R5A-01…03`、dev-plan R5a GWT 1-4、操作表 `:306-307` 审查点）、`[草案]` 提案 与 Owner 2026-09-15 冻结裁决 `[Owner 决断 OQ-R5-x=A，2026-09-15]`（逐项标于括号）。R5b（`GWT-R5B-01…04`、Gate A/B、accessibility、design tokens）**不在本清单范围**，归 `C-R5-ui`。

## A. Projection truth（GWT-R5A-01）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R5A-01 | projection truth（权威 phase/progress + 证据；日志标签不伪造完成） | 给定 authoritative state、receipts、logs；调用 `journey.read` / `journey.project` 生成投影 | 报告权威 phase 与 progress + 各源 source evidence（GWT-R5A-01 原文 `[计划输入 R5 doc]`）；**不得仅凭一个日志标签制造完成态**（"cannot manufacture a completion state from a log label alone"）。authoritative 部分投影为 observed/authorized；仅旁证部分标 inferred + source（dev-plan `:51`）。分维归并 `[Owner 决断 OQ-R5-1=A]`：phase/progress 以 state 为权威、资产维以 receipts 为权威，两维各投影互不覆盖并产 discrepancy warning | 仅靠日志/label 把某 step/plan 显示为 done/SUCCESS；投影不带 source evidence；把 inferred 观察与 authorized 权威混为一谈；phase/progress 与资产维互相覆盖 | |

## B. Stale / partial / error（GWT-R5A-02）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R5A-02 | stale and partial data（缺失/陈旧/冲突/畸形源可见态，永不静默 SUCCESS） | 分别喂入：(a) 缺失某权威源；(b) 源时点陈旧；(c) 多权威源互相冲突；(d) journey/source JSON 畸形；运行 projection | 返回可见 `STALE`/`PARTIAL`/`ERROR` 之一并带 reason（GWT-R5A-02 原文 `[计划输入 R5 doc]`）；**绝不静默显示 SUCCESS**。判据 `[Owner 决断 OQ-R5-2=A]`：STALE=journey/源时点落后于其他权威源最新时点（相对判据，无墙钟数值）；PARTIAL=任一绑定源缺失。冲突/畸形 ⇒ `PROJECTION_CONFLICT`（节点级，OQ-R5-7）/`PROJECTION_SOURCE_INVALID`；陈旧 ⇒ `JOURNEY_STALE`；字段级映射 `[Owner 决断 OQ-R5-3=A]`：state/receipts/gates 置位→authorized、logs/state-summary→inferred（必附 source） | 任一坏源被默认渲染成成功/完成；坏源无 reason；冲突时静默选一边；畸形源崩溃或返回成功字面；把展示态词汇差异当冲突 | |

## C. Session selection（GWT-R5A-03）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R5A-03 | session selection（只读所选 session；无 session 保留 legacy 默认） | 存在 session A、B 两组 state/receipts/journey；分别以 `--session A`、`--session B` 调 read/render/project；再以无 session 调用 | 投影只读所选 session 的 state/receipts/logs/journey（GWT-R5A-03 原文 `[计划输入 R5 doc]`）；无 session 时保留 legacy 默认根路径（`.tt-state/` 根）。namespaced 下读源与落点同 namespace（修 D-1，§3.3）；目录布局 `[Owner 决断 OQ-R5-9=A]`：`.tt-state/<sessionId>/{state.json, journey.json, artifacts/<subtaskId>/receipt.json, overrides/}`，logs 随 artifacts 在 session 根下；legacy 无 session 保持现状根（修 D-1） | 选 A 却读到 B 的数据；跨 session 投影串读；无 session 时 legacy 路径不可读；namespaced 模式读源仍指向根（现状 D-1）；journey.json 落点不随 session | |

## D. 9-node display / evidence / nextPrompt（dev-plan R5a GWT 1-4）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R5A-04 | 9-node 0-8 display + 下一步 + evidence refs（dev-plan GWT1） | 给定 0-8 journey；调用 `journey.read`（`projection mode` 枚举 `summary\|full`，缺省 `summary`；`summary`=phase/progress/next，`full`=9 节点+资产+evidence 全量 `[Owner 决断 OQ-R5-4=A]`） | 显示 9 个节点（step 0-8）、当前状态、下一步和 evidence refs（dev-plan R5a GWT1 原文 `[计划输入 :186]`）；step 状态词表沿用 pending/in_progress/done + 投影层负向/展示态（§3.1）。evidence links 形状 `[Owner 决断 OQ-R5-6=A]`：数组每条 `{sourceKind: state\|receipts\|logs\|gates, path, sha256, updatedAt, sessionId}`（与 R8 sourceAnchor 同构） | 节点数不是 9；缺当前状态/下一步；无 evidence refs；把 0-8 误渲染成旧 8-phase（dev-plan:182 选型依据要求修正旧 8 phase 不一致）；summary 模式连 phase/progress/next 都不给 | |
| R5A-05 | inferred-only 标注（dev-plan GWT2） | 只有 state-summary/log、无权威 journey/state 时 render | 显示 `INFERRED`/stale/source（dev-plan R5a GWT2 原文 `[计划输入 :187]`）；**不写 Journey、不授权派单**（现状对照：推断不落盘 `tt-journey.mjs:375`）。字段级映射 `[Owner 决断 OQ-R5-3=A]`：logs/state-summary→inferred（必附 source） | inferred 结果被落盘为权威 journey；inferred 被用来授权/推进；未标注 source 与 INFERRED | |
| R5A-06 | session namespace 全程一致（dev-plan GWT3） | session A/B 各自执行 `--session` 的 read/render/update | 所有路径（state/receipts/logs/journey）属于同一 namespace（dev-plan R5a GWT3 原文 `[计划输入 :188]`）；与 GWT-R5A-03 互证；布局 per OQ-R5-9 | read/render 读根、update 写 namespaced（现状 D-1）；同次操作跨路径串写 | |
| R5A-07 | real nextPrompt（dev-plan GWT4） | 给定当前 projection 有 nextPrompt；触发 copy/read | 返回**当前数据派生**的 nextPrompt，不返回固定 SAMPLE（dev-plan R5a GWT4 原文 `[计划输入 :189]`）。形状 `[Owner 决断 OQ-R5-5=A]`：结构化对象 `{actionHint, targetNode, requiredInputs[]}` + 生成时 projection 快照哈希回声；**复制 = 快照引用，不重算** | 返回硬编码 SAMPLE；nextPrompt 与当前投影数据不一致；projection 变化后 copy 仍是旧值；复制触发重新投影/重算 | |

## E. Honest projection & shell conformance（dev-plan `:306-307` 审查点）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R5A-08 | failed/skipped 不得显示为 done（dev-plan `:307` 审查点） | 喂入某 plan/subtask 状态为 `failed` 或 `skipped`（或 receipts FAILED/UNRESOLVED）的源；调用 `journey.project` | 投影如实呈现 failed/skipped/负向收口 + reason + evidenceRef（§3.2 不变量 `[草案]`）；**不得**把它或其聚合 step 显示为 done/SUCCESS。归并映射 `[Owner 决断 OQ-R5-8=A]`：failed→FAILED、skipped→SKIPPED（附 reason source）、UNRESOLVED→UNRESOLVED；**组级聚合取最坏态**（组内任一 failed/skipped/UNRESOLVED ⇒ 组不得显示完成）。现状缺陷形态对照：`inferJourney` 有任一 source 即置 step7=done、不看 status（`tt-journey.mjs:229-233`，D-2） | 有任一 plan 源即把聚合 step 标 done；failed/skipped/unknown 被显示为 done；receipt FAILED/UNRESOLVED 被 telemetry 裸布尔升格为 verified/done；组内负向仍显示完成 | |
| R5A-09 | read-only / no second writer / no authorization（non-goals） | 连续调用 `journey.read`/`journey.project` 后检查 state/journey/receipt/override 文件与是否触发任何 transition | 两操作均只读，不写权威存储、不推进 step/gate、不派单（§4.3）；不新增第二套 Journey writer 或第二套 state truth（PRD0 §7）；inferred 永不授权。唯一 projection writer `[Owner 决断 OQ-R5-10=A]`：legacy=现状写路径；projection=`journey.project` 唯一 writer；MW0 双写并存对账、MW1 起 legacy 写停用（挂 PRD0 §9.1 MW 表） | 投影副作用改写权威文件；引入新的权威存储；读操作触发 phase 推进/派单；点击/复制被暗示为授权动作；MW1 后 legacy 仍写、或 MW0 双写未对账 | |
| R5A-10 | response shell & 五错误码形状（dev-plan `:306-307` + `:314`） | 对两操作分别走成功、各错误码分支；检查返回 JSON | 统一壳 `{ok, code, data, evidence, warnings}`（键集成功/失败一致）；错误码逐字 = `JOURNEY_NOT_FOUND`/`JOURNEY_STALE`/`JOURNEY_INVALID`（read）、`PROJECTION_SOURCE_INVALID`/`PROJECTION_CONFLICT`（project）；不出现发明的新码/改名（`:314` 冻结前禁改 schema/错误码/壳）。projection mode 枚举/缺省 per OQ-R5-4；PROJECTION_CONFLICT 节点级判定 per OQ-R5-7 | 壳键集随成败漂移；错误码改名/新造/拼写不一致；成功/失败形状不同；正常决策结果（如 INFERRED）被错置 error 通道（`JOURNEY_NOT_FOUND` 通道归属为 §8.1 非 OQ 残留，其余通道按已决语义） | |

## 使用说明

1. 「期望」列标 `[计划输入]` 的措辞来自冻结 GWT 原文（R5 doc `GWT-R5A-01…03`、dev-plan R5a GWT 1-4、操作表 `:306-307`）；标 `[草案]` 的为契约草案新提案；标 `[Owner 决断 OQ-R5-x=A，2026-09-15]` 的为 Owner 冻结裁决（全项 A），已逐字吸收进契约正文 `contracts/C-R5-journey.md` §2-§8，本清单「期望」列按此更新。
2. R5A-08 / D-2、R5A-03 / D-1 等"现状缺陷形态"为冻结快照工作树实测锚点，只作现状对照（契约 §7 discrepancy log）；审查对象是「冻结后的期望」，本清单不修复、不改 `scripts/`。
3. **Owner 确认列（末列）保持留空**：冻结确认 = Owner 冻结声明本身（2026-09-15，OQ 全项 A），沿 C-R4 先例，不在本清单逐行回填。OQ-R5-1…10 已全部 DECIDED（契约 §8 索引 OPEN→DECIDED）；非 OQ 残留 `[待补充]` 仅 `JOURNEY_NOT_FOUND` 通道归属（§8.1）。
4. 本文档为**规范冻结版本**（`contracts/C-R5-journey-review-checklist.md`，FROZEN，2026-09-15）；源件 `contracts/drafts/C-R5-journey-review-checklist.md` 保留不删。冻结记录 = `plans/tasks/C-R5-freeze-20260915.md`；本文与 `contracts/C-R5-journey.md` 的 sha256 见冻结记录。`route41Rerun.required=false`（零路由改动，与 R4 同判）；不登记状态台账。本清单不做验收：`acceptancePerformedByExecutor=false`。R5b 的 `GWT-R5B-01…04`/Gate A/B/accessibility 不在本行范围。