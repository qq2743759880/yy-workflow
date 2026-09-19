# R5a journey.mjs 重建结果 — test-reports/rebuild-20260920/R5a-journey/

- 日期：2026-09-19（重建执行）/ 目标命名 20260920（沿 R10-rebuild-20260920 先例）
- 重建对象：`scripts/lib/journey.mjs`（原文件丢失；原 sha256 前 16 位 `fe9bb851f8a36359`，见 `test-reports/impl-acceptance-20260915/REPORT.md` —— 本重建为**行为级**，非字节还原）
- 权威规格：`contracts/C-R5-journey.md`（FROZEN 2026-09-15）+ `contracts/C-R5-journey-review-checklist.md`（FROZEN）
- 幸存消费方对照（反推 API 面与响应形状）：
  - `webview/journey/render-core.mjs`（data.journey/projection 字段消费、NOT_FOUND data 通道、WORST_RANK、nextPromptView）
  - `webview/journey/host-bridge.mjs`（CLI 面 `--read/--project --workspace --mode --session`）
  - `test-reports/R6-migration-20260917/compat-probe.mjs`（`journey.read({workspace, sessionId})`、空目录 → `ok=false code=JOURNEY_NOT_FOUND`）
  - `test-reports/R6-migration-20260917/e2e-bounded.mjs`（namespaced state → `plans[].planId`、displayStatus 五值集）
  - `test-reports/R5b-implementation-20260917/REPORT.md`（f-07-not-found = JOURNEY_NOT_FOUND data channel）
- 自验：`node run-probes.mjs` → **TOTAL: 16/16 PASS; EXIT=0**（探针沙箱限制在本目录 `.sandbox/` 下，`.gitignore` 已有 `test-reports/**/.sandbox/` 通配）
- 回归：`node scripts/regression-all.mjs` → **12 PASS / 0 FAIL, exit 0**；`node scripts/validate-structure.mjs` → **0 项警告**（与基线一致，无新警告）
- 增量纪律：仅新增 `scripts/lib/journey.mjs` + 本目录；未修改任何既有文件（`scripts/tt-journey.mjs`、`scripts/lib/state.mjs`、`scripts/lib/store.mjs`、`contracts/`、`vendor/` 均零触碰；未 git commit）

## 1. 实现的操作面

仅两操作（dev-plan `:306-307` 逐字，不新增不改名）：

| 操作 | 输入 | 输出 `data` | 错误码 |
|---|---|---|---|
| `journey.read` | `workspace`、`session`\|`sessionId`（可选，缺省 legacy 根）、`mode`（`summary\|full`，缺省 `summary`，OQ-R5-4=A） | `journey`（投影体）+ `mode` + `session`；STALE 时附 `stale` | `JOURNEY_NOT_FOUND` / `JOURNEY_STALE` / `JOURNEY_INVALID` |
| `journey.project` | `workspace`、`session`\|`sessionId`、`state`/`receipts`/`logs`（四键逐字；缺席=从 session 命名空间读盘，给出=inline 权威源直注）、`mode`（host-bridge 亦传） | `projection`（投影体）+ `persistedTo`（仅落盘时） | `PROJECTION_SOURCE_INVALID` / `PROJECTION_CONFLICT`；session/输入形状违约 → `JOURNEY_INVALID`（契约 §3.3） |

- 统一响应壳 `{ok, code, data, evidence, warnings}`，键集成功/失败完全一致（§5）
- 附加导出：`journey`（`{read, project}`，compat-probe 消费形）、`run(op, input)`（evolution.mjs 同构分发）、`copyNextPrompt`（复制=快照引用不重算，OQ-R5-5=A）、常量 `JOURNEY_SCHEMA/GATE_VOCAB/STEPS/DISPLAY_STATES/NEGATIVE_STATES/ERROR_CODES/WORST_RANK/PROJECTION_MODES`
- 仅 node 内置依赖（`node:fs`/`node:path`/`node:crypto`），零 npm 依赖（PRD 约束）

## 2. 覆盖的契约小节清单

| 契约小节 | 内容 | 覆盖探针 |
|---|---|---|
| §0.1 前提 1/3/4 | 投影只读、四态词汇、只消费 R3/R4 | p02、p06、p12 |
| §2.1 四类绑定源 | state/receipts/logs/session | p02、p03、p09、p15、p16 |
| §2.2 分维权威归并 + 唯一 projection writer | OQ-R5-1 / OQ-R5-10 | p02、p14 |
| §2.3 B 面 gate 消费 | gates 置位原样展示 | p10、p14 |
| §3.1 展示态词汇与判据 | AUTHORIZED/OBSERVED/INFERRED/STALE/PARTIAL/ERROR | p03、p04、p05、p11、p15 |
| §3.2 诚实投影不变量 | failed/skipped/UNRESOLVED 不得显示 done；组级最坏态 | p06、p12 |
| §3.3 Session selection | 隔离、legacy 缺省、布局、非法 session | p07、p09、p16 |
| §4.1 Evidence links | OQ-R5-6 形状 + logs 必标 inferred | p02、p15 |
| §4.2 nextPrompt | OQ-R5-5 结构化 + 快照哈希回声 + 复制不重算 | p13 |
| §4.3 Read-only guarantee | 两操作只读、inferred 不落盘、落盘唯一 writer | p08、p11、p14 |
| §5.1 `journey.read` schema | 三错误码、mode 枚举/缺省 | p04、p07、p08、p10、p11 |
| §5.2 `journey.project` schema | 两错误码、节点级冲突 | p02、p05、p06、p12 |
| §5.3 错误码→场景映射 | 五码逐字、通道分叉 | p01、p05、p06、p07、p08 |
| §6 Migration/flags | `YY_JOURNEY_WRITER`、additive 兼容 | p14 |
| §7 Discrepancy D-1…D-7 | 现状缺陷修复对照 | D-1→p09/p16；D-2→p11/p12；D-3→p02/p03；D-4→p13；D-5→p01/p03；D-6→p01；D-7→p14 |
| §8 OQ-R5-1…10（全 DECIDED=A） | 已逐项落入实现与探针 | 见探针表依据列 |
| §8.1 非 OQ 残留 `[待补充]` | JOURNEY_NOT_FOUND 通道归属 | p08（见 §5 清单） |
| 清单 R5A-01…R5A-10 | Owner 场景审查行 | R5A-01→p02；R5A-02→p03/p04/p05/p06；R5A-03→p09/p16；R5A-04→p10；R5A-05→p11；R5A-06→p16；R5A-07→p13；R5A-08→p12；R5A-09→p14；R5A-10→p01 |
| dev-plan R5a GWT1-4（`:186-189`） | 9 节点/inferred/namespace/nextPrompt | GWT1→p10；GWT2→p11；GWT3→p16；GWT4→p13 |

## 3. 探针表（probe | 契约依据 | 结果）

| probe | 契约依据 | 结果 |
|---|---|---|
| p01-shell-uniformity | R5A-10 / §5 / dev-plan `:306-307`+`:314`（壳键集成败一致、五码逐字、未知操作不发明码、永不静默 SUCCESS 字面） | PASS |
| p02-projection-truth | R5A-01 / GWT-R5A-01 / OQ-R5-1 / OQ-R5-3（权威 phase/progress + source evidence；log 标签只双列旁证不制造/否决完成；分维 discrepancy warning） | PASS |
| p03-partial-missing-source | R5A-02(a) / OQ-R5-2=A / §3.1（任一绑定源缺失 ⇒ 可见 PARTIAL + 具名缺项说明；四源齐 → 离开 PARTIAL） | PASS |
| p04-stale-relative | R5A-02(b) / OQ-R5-2=A / §5.1（journey 落后权威源 ⇒ `JOURNEY_STALE` + data.journey/stale；journey 非落后方不占码；全对齐 → 无 STALE） | PASS |
| p05-source-invalid | R5A-02(d) / §5.3（project 源不可解析/schema 违约 ⇒ `PROJECTION_SOURCE_INVALID` fail-closed；read 无 PROJECTION 码 → 可见 PARTIAL 具名落地） | PASS |
| p06-conflict-node-level | R5A-02(c) / OQ-R5-7=A / §5.2（同 subtaskId 双 receipt 终态矛盾 ⇒ 节点级双方 evidence；词汇差异/跨维矛盾不算冲突，跨维 → discrepancy warning + 组级最坏态） | PASS |
| p07-invalid-input-failclosed | §5.1/§5.3/§3.3（journey JSON/形状畸形、session 非法白名单、mode 非枚举、workspace 缺失 ⇒ `JOURNEY_INVALID` fail-closed，无路径逃逸） | PASS |
| p08-not-found-data-channel | §8.1 / R5A 清单 / render-core 消费口径（空目录 ⇒ `JOURNEY_NOT_FOUND` data 通道 + §8.1 `[待补充]` warnings 标注；`isJourneyNotFound`/`deriveJourneyView` 逐字段兼容；R6 compat-probe 两场景回放） | PASS |
| p09-session-isolation | R5A-03 / GWT-R5A-03 / OQ-R5-9=A（A/B 只读各自 session、禁串读；无 session 保留 legacy 根） | PASS |
| p10-nine-node-display | R5A-04 / dev-plan GWT1 / OQ-R5-4=A / OQ-R5-6=A（9 节点 0-8 非旧 8 phase、当前/下一步、evidence refs、gates passed/pending、summary 缺省仍给 phase/progress/next） | PASS |
| p11-inferred-only | R5A-05 / dev-plan GWT2 / OQ-R5-3=A / §4.3（仅旁证 ⇒ INFERRED+source、不落盘、不授权；旁证全 done 仅 INFERRED 标注 done；failed 旁证组级不显示完成） | PASS |
| p12-honest-failed-skipped | R5A-08 / dev-plan `:307` 审查点 / OQ-R5-8=A / §3.2 / D-2（failed→FAILED、skipped→SKIPPED、UNRESOLVED→UNRESOLVED、组级取最坏、全 VERIFIED 才 done、无 SUCCESS 字面） | PASS |
| p13-nextprompt-derived | R5A-07 / dev-plan GWT4 / OQ-R5-5=A / D-4（结构化 `{actionHint,targetNode,requiredInputs[]}` + 64 位快照哈希回声、数据变→nextPrompt 变、无 SAMPLE、复制=快照引用 recompute=false） | PASS |
| p14-readonly-writer-modes | R5A-09 / §4.3 / OQ-R5-10=A / D-7（read/project 源文件字节零改动；projection 模式健康态落盘；legacy 模式不落盘；INFERRED 永不落盘；落盘文件经 `tt-journey.mjs` readJourney/ensureSteps/renderJourney 兼容读取，gates_passed/artifacts/`__manual__` 留痕保留） | PASS |
| p15-evidence-links-shape | OQ-R5-6=A / §4.1（数组元素恰为 `{sourceKind,path,sha256,updatedAt,sessionId}`（+logs `inferred`）；sha256 与文件字节一致；shell.evidence.sources 同构；summary 不带全量 evidence） | PASS |
| p16-namespace-consistency | dev-plan GWT3 / R5A-06 / D-1 / OQ-R5-9=A（namespaced 读源随 session 不读根、落点同 namespace、legacy 根照常可读） | PASS |

`out-probe-results.json` 为运行器生成的机器可读结果。复跑：`cd test-reports/rebuild-20260920/R5a-journey && node run-probes.mjs`。

## 4. 与契约的偏差 / 实现化判定说明（契约未定处，均不违反冻结语义）

1. **展示态总优先级**（§3.1 只给各态判据，未给全序）：实现归并序 = `ERROR > STALE > INFERRED（仅旁证整图降级） > PARTIAL > AUTHORIZED/OBSERVED`。GWT2 场景（仅 state-summary/log）必须落 INFERRED（dev-plan `:187` 原文期望），故 INFERRED 先于 PARTIAL；缺口仍写入 `displayReason` 与 `warnings`，不静默。
2. **`JOURNEY_STALE` 码的触发面**（§5.1 码义="journey 过期"，§3.1 判据="journey/某源落后"）：journey 记录本身为落后方 ⇒ `ok=false + JOURNEY_STALE`（data 仍携带投影体 + `data.stale`，render-core 消费口径）；上游权威源互相落后（journey 非落后方）⇒ 可见 STALE 展示态（ok=true，data 通道）+ reason，不误占 read 码。
3. **read 无 `PROJECTION_*` 码**（§1.2 不新增码）：read 遇绑定源畸形/不可读 → 按判据字面落 PARTIAL（"含不可读/不可解析"，OQ-R5-2=A）+ 具名 reason；read 遇节点级冲突 → ERROR 展示态 + reason（ok=true，data 通道），码面归 project。
4. **PARTIAL 严格字面 vs R6 时代观测**：`test-reports/R6-migration-20260917/REPORT.md` 曾记录 receipts/logs 缺失场景 display=AUTHORIZED；本实现按契约 §3.1/OQ-R5-2=A 字面（任一绑定源缺失 ⇒ PARTIAL）给 `PARTIAL`。**以契约为准**，此为对旧观测的行为偏差登记（该 e2e 断言集实际允许 PARTIAL，故不构成消费方破坏；compat-probe 两场景在本实现下回放通过，见 p08）。
5. **源状态→展示态映射表**（OQ-R5-3/OQ-R5-8 的实现化）：`done→AUTHORIZED`、`in_progress/planning/executing/frozen/reviewing→OBSERVED`（A 面 7 态，[R4冻结] §3.1）、`pending/idle→PARTIAL`、`failed→FAILED`、`skipped→SKIPPED`、其余/`unknown→UNRESOLVED`（未决不升格）；receipt `VERIFIED→AUTHORIZED`、`FAILED→FAILED`、`UNRESOLVED/未到终态→UNRESOLVED`。
6. **组级聚合投票成员**（OQ-R5-1"互不覆盖"的实现化）：权威成员（state 行 + 逐 subtask 与 receipt 最坏归并）投票；无权威成员时由 inferred 旁证成员推导（GWT2 整图降级）；logs 旁证**不否决**权威成员，矛盾 → discrepancy warning 双列（p02）。
7. **B 面记录与源聚合的合成**（§2.3 vs §3.2）：记录在场时 step 状态原样展示，但执行源存在负向时按 §3.2 不变量降格展示（原值保留在 `recordStatus` + warning）；记录在场时投影**不因源正面而升格** step（升格经 `tt-journey.mjs --update` / phase 面授权路径，投影不构成授权）。
8. **落盘纪律**（§4.3 + OQ-R5-10=A）：`YY_JOURNEY_WRITER=legacy` → 不落盘；`=projection` 或未设（MW0 双写窗口缺省）→ `journey.project` 为唯一 projection writer，且仅当展示态 ∈ {AUTHORIZED, OBSERVED} 才落盘（INFERRED/PARTIAL/STALE/ERROR 永不落盘）；落盘为 additive 合并（保留 gates_passed/artifacts/`__manual__` 留痕，不删旧字段），p14 已机验 `tt-journey.mjs` 兼容读取。
9. **输入键兼容**：`sessionId`（幸存 compat-probe 写法）与 `session`（dev-plan `:306-307` 输入列）双兼容；`mode` 双操作接受（host-bridge 对 `--project` 亦传 `--mode`）。
10. **shell.evidence 类型**：C-R5 §5 示例为 `"evidence": { }`（对象），与 evolution.mjs 的数组壳不同——本实现 shell.evidence=对象（`{op, session, generatedAt, sources[]}`），`data.journey.evidence`/`data.projection.evidence`=OQ-R5-6 数组（与 R8 sourceAnchor 同构）。以 C-R5 为准。
11. **inline 直注源**：`state/receipts/logs` 四键给出时作为 inline 权威源（键逐字沿用，探针/宿主直连用）；缺席时按 OQ-R5-9 布局从 session 命名空间读盘。形状违约同样 fail-closed（p05）。
12. **CLI 桥接不在本次范围**：host-bridge 消费的 `tt-journey.mjs --read/--project` CLI 面属实现接线（任务禁改 `tt-journey.mjs`）；本重建交付库面 `journey.read/journey.project`，CLI 桥接由后续接线任务消费本模块完成。

## 5. [待补充] 项清单（fail-closed，不编造）

| 项 | 出处 | 本实现处置 |
|---|---|---|
| `JOURNEY_NOT_FOUND` 的 data/error 通道归属 | C-R5 §5.3/§8.1（非 OQ 残留，归 R5a 实现阶段定） | 沿 R3 "正常决策进 data" 惯例 + 幸存消费面实测（render-core `isJourneyNotFound` 读 `ok=false+code`、诊断取 `data.journey`；R6 compat-probe 同口径）走 **data 通道**（`ok=false + code + data.journey 诊断`），并在该响应 `warnings` 中显式标注 `§8.1 [待补充]` 等 Owner 复核（p08 机验）。C-R4 §6.3 decided precedent 同向。 |

除上表外，C-R5-journey 契约内**无数值型 [待补充]**（OQ-R5-1…10 已全部 DECIDED=A，阈值/判据均在正文冻结）；本实现未引入任何新的待补充数值。

## 6. 验证汇总

| 检查 | 结果 |
|---|---|
| `node run-probes.mjs`（本目录） | 16/16 PASS, EXIT=0 |
| `node scripts/regression-all.mjs` | 12 PASS / 0 FAIL, exit 0 |
| `node scripts/validate-structure.mjs` | 0 项警告（与基线一致，无新警告） |
| 可移植性（validate-structure ⑤ 同口径自检） | journey.mjs 0 泄露 |
| 编码（U+FFFD 字节自检） | 无损坏 |
| git 增量 | 仅 `scripts/lib/journey.mjs` + `test-reports/rebuild-20260920/`（未 commit，待 Owner 审查） |
