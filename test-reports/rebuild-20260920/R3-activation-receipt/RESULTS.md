# R3 重建结果 — activation.mjs / receipt.mjs（rebuild-20260920）

- 任务：按冻结契约 `contracts/C-R3-activation.md`（FROZEN / OWNER-APPROVED，`C-R3=FROZEN` 2026-09-13）行为级重建 `scripts/lib/activation.mjs`（activation.prepare）与 `scripts/lib/receipt.mjs`（receipt.append / 终态证据）。
- 原文件状态：已丢失，无原始 sha256 可对照——本重建为行为级重建，非逐字节恢复。
- 结果：**探针 16/16 PASS（180 checks）/ regression-all 12/12 PASS / validate-structure 0 警告（基线 0，无新警告）**。
- 模块 sha256（重建版）：
  - `scripts/lib/activation.mjs` = `7279741e4f5baf5dc24e99cbeb23f4825e9d0577cd762ea8923694719773b092`
  - `scripts/lib/receipt.mjs` = `f274a0feacd85eb10be0ba26d9d347cce9277f2b8b7667cad9387ac075e411e6`
- 只做增量：`git status` 确认零已存在文件被修改；无 git commit（按纪律）。`scripts/lib/journey.mjs`、`scripts/lib/phase.mjs` 为并行重建方的新增文件，不属本任务交付。

## 1. 操作面（冻结契约 §2）

| 操作 | 模块 | 输入（要点） | 输出 `data` | 错误码（全集，稳定） |
|---|---|---|---|---|
| `activation.prepare` | activation.mjs | `plan`、`subtask`（资源请求来源 = subtask 字段，OQ-R3-5=A）、`asset`、`activationLevel`（缺省 body，hybrid OQ-R3-4=A）、`requestedResources`、`budget`（可选）、`mode` | `activationPackage = {record(§3.1), payload(§5.2), briefFrame(§5.2)}` | `ACTIVATION_BUDGET_EXCEEDED` / `ASSET_BODY_MISSING` / `RESOURCE_NOT_FOUND`（dev-plan:302 原码）；`ASSET_NOT_FOUND` / `INPUT_INVALID` / `ACTIVATION_MODE_UNSUPPORTED`（§2.1 草案码） |
| `receipt.append` | receipt.mjs | `event = {transition(§7.2 九值), subtaskId, assetId, sourceHash, session, idempotencyKey, evidence(§7.3)}`；`mode` | `receiptRef = {subtaskId, assetId, receiptPath, eventSeq, sourceHash}`（§2.2）+ `state/result/behaviorCheck` | `RECEIPT_INVALID` / `RECEIPT_HASH_MISMATCH` / `RECEIPT_INCOMPLETE`（dev-plan:303 原码）；mode 非法/legacy ⇒ `ACTIVATION_MODE_UNSUPPORTED` |

响应壳 `{ok, code, data, evidence, warnings}` 成功/失败键集一致（§2）；`evidence`（prepare）= `{snapshot, catalogCacheIdentity, sourceHashEcho, inputEcho}`（§2.1，catalogCacheIdentity 按 C-R2 §7.2 内容寻址 per-entry 投影）。

## 2. 覆盖契约小节 → 探针映射

| 契约小节 / 条款 | 探针 |
|---|---|
| §2.1 输入形状/幂等/只读/body 缺失/预算纪律 | p04、p05、p09、p15 |
| §2.2 幂等/存储位置/宿主失败-重试-缓存记录 | p08、p07 |
| §3.1 activation record 字段级 schema | p01、p02、p03、p07 |
| §3.3 behaviorCheck（result 枚举/reason 词汇/checkId） | p07、p11、p14、p16 |
| §3.4 receipt record（事件字段/重放防手改） | p07、p09 |
| §4.1 metadata 级（body read=0/resource read=0） | p01 |
| §4.2 body 级（stripFrontmatter 同构，C6 机制不改变） | p02 |
| §4.3 resource 级（显式请求/缺失 fail-closed/零 overfetch） | p03 |
| §5.2 投递包（briefFrame 逐字兼容/段标题锚/占位行/Never included） | p01、p02、p03 |
| §6 token 量尺（CJK×0.75+÷4 回归量尺、禁实测表述） | p02（token-audit.mjs:24-32 同口径） |
| §7.1 生命周期状态（重放派生视图） | p07 |
| §7.2 transitions T1-T6/N1-N3 + 禁止跃迁 | p07、p09、p10、p14 |
| §7.3 每 transition 必需 evidence + 机验谓词 | p08、p09（T4 (a)(b)、T5 白名单、T2 eligible:true） |
| §7.4 P1（完整性）/P2（hash）/P3（链）/P4（反回显）/P5（证据类别） | p09/p12、p10、p11、p11、p16 |
| §7.5 失败语义表（9 行逐行） | p04/p05/p06（block 行）、p10（hash→N2）、p11（P1/P3→N3、降级→DEGRADED_NO_EXECUTION）、p09（INVALID 拒绝追加）、p14（N1 进 data） |
| §7.6 幂等与存储（per-artifact/append-only/回放/eventSeq 并发） | p07、p08、p09 |
| §7.7 C6 7case 最小回归集（7/7 不得 VERIFIED） | p11（含 legacy 观测列重derive：3 缺陷 case 复现 true） |
| §7.8/§8.3 裸布尔 telemetry-only + receipt 缺失优雅降级 | p12 |
| §8.1 三模式（YY_RECEIPT_MODE 复用/非法 fail-closed/legacy 无事件写入） | p06 |
| 清单 R3-1…R3-12（12 场景逐行） | R3-1→p01、R3-2→p02、R3-3→p03、R3-4→p04、R3-5→p05、R3-6→p10、R3-7→p12、R3-8→p12、R3-9→p11、R3-10→p11、R3-11→p08、R3-12→p07 |
| GWT-R3-01（bounded+fail-closed）→p04；GWT-R3-02（receipt 字段面）→p07/p13；GWT-R3-03（no false positive）→p11/p14；GWT-R3-04（tamper/stable code）→p09/p10；GWT-R3-05（16 资产逐行显式结果）→p13 | |

## 3. 探针表（run-probes.mjs，2026-09-20 运行）

| probe | exit | ok | summary |
|---|---|---|---|
| p01-metadata-level  | 0 | true | p01 metadata 级激活：零正文零资源读取 + 占位行 + 壳/evidence 形状 —— 13 checks PASS |
| p02-body-level  | 0 | true | p02 body 级激活：stripFrontmatter 同构全文 + 回归量尺估算 + anchor/内核登记 —— 12 checks PASS |
| p03-resource-level  | 0 | true | p03 resource 级：显式请求投递 + resourceHashes + 缺失/逃逸 fail-closed —— 10 checks PASS |
| p04-budget  | 0 | true | p04 预算纪律：首轮无拦截只估算 + 显式超限 block fail-closed + 无 truncate —— 9 checks PASS |
| p05-body-missing  | 0 | true | p05 body 缺失：ASSET_BODY_MISSING fail-closed 不投递 + ASSET_NOT_FOUND 区分 —— 5 checks PASS |
| p06-mode  | 0 | true | p06 三模式：YY_RECEIPT_MODE 复用 + 非法 mode fail-closed + legacy 无事件写入 —— 7 checks PASS |
| p07-chain-terminal  | 0 | true | p07 全链 T1→T6：per-artifact 布局 + 重放=缓存 + canonicalHash 可复验 + vendor 零写入 —— 15 checks PASS |
| p08-idempotency  | 0 | true | p08 幂等：同键等价幂等返回 + 同键异 payload INVALID + 重试新键正常追加 —— 10 checks PASS |
| p09-invalid-events  | 0 | true | p09 事件违约面：枚举/跳步/证据/白名单/穿越/手改 receipt 全部拒收 —— 22 checks PASS |
| p10-hash-chain  | 0 | true | p10 hash 失效：追加/校验双通道 RECEIPT_HASH_MISMATCH + N2 FAILED + 历史不改写 —— 7 checks PASS |
| p11-c6-fixtures  | 0 | true | p11 C6 7case 回归：7/7 不 VERIFIED（5 FAILED/EVIDENCE_ECHO_ONLY + 2 UNRESOLVED）+ legacy 缺陷列重derive —— 29 checks PASS |
| p12-legacy-compat  | 0 | true | p12 legacy 裸布尔 telemetry-only + receipt 缺失/损坏优雅降级不崩溃 —— 12 checks PASS |
| p13-positive-matrix  | 0 | true | p13 16 资产矩阵：逐行显式 VERIFIED + P4 正向控制 + GWT-R3-02 字段面 —— 6 checks PASS |
| p14-selected-not-consumed  | 0 | true | p14 选中未消费：N1 not_consumed → UNRESOLVED/SELECTED_NOT_CONSUMED，非 consumed/PASS —— 6 checks PASS |
| p15-prepare-idempotency  | 0 | true | p15 prepare 幂等：豁免时间戳 + 缓存不改返回数据 + vendor/artifacts 零写入 —— 11 checks PASS |
| p16-p5-predicate  | 0 | true | p16 P5 证据类别：legacy 布尔/marker-presence 依据拒绝 + 悬空 refs + 干净链对照 —— 6 checks PASS |

**TOTAL: 16/16 PASS（180 checks）; EXIT=0**（明细见 `out-probe-results.json`；沙箱 `.sandbox/<pNN>/`，已被 .gitignore 覆盖；仓库真实 vendor 零写入由探针指纹断言）。

C6 7case 判定对照（§7.7）：`title-only-with-kernel`→FAILED/EVIDENCE_ECHO_ONLY、`title-only-without-kernel`→FAILED/EVIDENCE_ECHO_ONLY、`title-plus-kernel-word`→FAILED/EVIDENCE_ECHO_ONLY、`unrelated-prose`→UNRESOLVED/RECEIPT_INCOMPLETE、`kernel-word-only-no-title`→FAILED/EVIDENCE_ECHO_ONLY、`fake-methodology-repeat5`→FAILED/EVIDENCE_ECHO_ONLY、`empty-output`→UNRESOLVED/DEGRADED_NO_EXECUTION——**7/7 不得 VERIFIED 达成**。legacy 观测列：C6 执行报告未随快照幸存，探针按 `prompt.mjs:107-108` 同源布尔重derive，3 个缺陷 case（title-only-without-kernel / title-plus-kernel-word / fake-methodology-repeat5）复现 `assetConsumed=true`，与 §7.7 左列一致；该缺陷**未被修复**（本契约层只显式拒绝其作为验证证据，§0.1）。

## 4. 回归与结构校验

- `node scripts/regression-all.mjs` → **12 PASS / 0 FAIL**（S1-S12 全绿）。
- `node scripts/validate-structure.mjs` → `[OK] 结构校验通过 (0 项警告)`（重建前基线同为 0，**无新警告**）。
- 两模块仅 node 内置依赖（node:fs/path/crypto）+ 复用既有内核 `manifest.mjs`/`matrix.mjs`（R1/R2 机制，只读消费）；不 import evolution.mjs（依赖方向保持 evolution→R3 单向）。

## 5. 偏差与重建判定登记（契约无明文处的实现决定，全部 fail-closed 方向）

| # | 偏差/判定 | 依据与理由 |
|---|---|---|
| D1 | receipt.json 增设 additive 字段 `canonicalHash` = sha256({subtaskId, events[]（剔除幂等豁免 recordedAt）, result}) | §3.4 schema 未含该字段；按 evolution.mjs `RECEIPT_FIELDS` 注释（canonicalHash = sha256 同构 C-R4）在其上游 R3 补齐同构命名；作为 §3.4"重放不一致 ⇒ RECEIPT_INVALID（防手改）"的哈希化 complement。p09 (9a/9b) 机验防手改 |
| D2 | 并发串行化内聚于 receipt.mjs（进程级锁注册表，键 = receipt.json 绝对路径），非 store.mjs 增量层 | C-R4 §2.4/锚点表将 receiptStore 层锚在 store.mjs，但恢复后的 store.mjs 仅含 createStore（该层未幸存），且本任务禁止修改既有文件——语义对齐（进程级串行、不新增并发协议），物理位置偏差如实登记 |
| D3 | mode 缺省（input.mode 与 `YY_RECEIPT_MODE` 均未设）= `'dual'` + warnings 显式说明 | PRD0 §9.2（flag 清单）未随快照幸存，冻结契约未给缺省值；取 MW0 双读语义，绝不 silent fallback 到非法值。登记为重建判定，等 Owner 追认或改判 |
| D4 | 负向收口事件（N1/N2/N3）追加时豁免"事件 sourceHash == 当前资产字节"重算；正向 T1-T6 双重校验（链上一环 + 当前字节） | §7.5 hash 失效行的收口正是"记录失配的 N2"——若负向事件也做当前字节校验，失配终态将永远无法落盘（自举矛盾）；N1（subtask 关闭）同理与资产字节无关。链内 sourceHashEcho 连续性对全部事件仍强制 |
| D5 | P4 payload 逐字节片段移除的最小归一片段长 = 12（贪心最长匹配，上限 400） | 契约未给阈值；12 高于任意单个内核 token 常规长度、足以排除巧合短句；取更小值只会移除更多、更难通过（fail-closed 方向）。P4 先过 p11 全部 7 case 回归门后生效（§7.7 顺序要求） |
| D6 | T5 追加时产物证据无效（后缀/排除项/空文件/hash 不符/executed≠true）⇒ `RECEIPT_INCOMPLETE` | §2.2 对 RECEIPT_INCOMPLETE 的定义即"该 transition 的必需 evidence 缺失（§7.3）"——evidence 在场但无效按同码 fail-closed 收口；契约未单列第四码，不发明 |
| D7 | behavior_verified 不走 from-状态表，直接进入 §7.4 谓词组；P3 断裂 ⇒ N3 UNRESOLVED（而非 RECEIPT_INVALID 非法跃迁） | §7.2 T6 的触发门即"§7.4 P1-P5 全部满足"；§7.7 case 4（无 T4/T5 链）期望 UNRESOLVED 而非拒收错误——谓词组优先 |
| D8 | P4/P5 判定拒绝 ⇒ 追加 N2 事件且响应 `ok:true`（FAILED 结果进 data）；P2 ⇒ `ok:false` + RECEIPT_HASH_MISMATCH；P3 ⇒ `ok:false` + RECEIPT_INCOMPLETE | §7.5 表：P2/P3 行有明文稳定码；P4/P5 为验证**决策结果**，沿"降级（ok:true + degraded）"与"N1 进 data 不进 error"同款先例。核心不变量（不得 VERIFIED/consumed/PASS）在两种通道下均成立并机验 |
| D9 | phaseEligibility 在调用方未提供 R2/R4 投影时由本模块按 matrix.mjs CLUSTERS / planner.mjs phase 机制投影（可被 `input.phaseEligibility` 覆盖） | §3.1"只投影不重定义"；投影来源在 warnings 具名 |
| D10 | legacy 模式下 `receipt.append` ⇒ `ACTIVATION_MODE_UNSUPPORTED`（不写事件） | §8.1 legacy = 现状快照、不含 receipt 事件写入；错误码集中无专用码，取 mode 通道码并登记 |
| D11 | resource 请求路径逃逸资产根 ⇒ `RESOURCE_NOT_FOUND`；level=resource 但显式请求为空 ⇒ `INPUT_INVALID` | 前者防路径穿越（fail-closed 与"请求资源不存在"同码）；后者因 §4.3 resource 级仅在显式请求时启用 |
| D12 | activation record 增设 additive 字段 `anchor`/`kernelTokens`/`hasKernelSection`/`readCounts` | §7.4 P4 明文引用"激活记录的 anchor（prompt.mjs:79-82 同源）"；GWT-R3-02/§4.1 read count 机验口径需要载体。提取逻辑与 prompt.mjs:79-90 逐字同源，仅登记不判定 |
| D13 | T3 selected 的 router 输出集复算未实现（仅 evidence 形状校验） | R2 router 产物未随快照幸存（仅存 C-R2 catalog 草案）；复算依赖上游恢复，fail-closed 保留缺口登记 |
| D14 | brief「方法论正文」段界 = 段标题至帧尾 `\n---\n执行要求：`（不用裸 `---` 定界）；payload hash 对段内规范形（去首尾空行）计算 | 实测 colorize 正文自身含 `---` 水平线；prepare 侧与 brief 提取侧同形才满足 §7.3 T4 谓词 (b) 可复验 |

## 6. `[待补充]` 清单（保持待补充，未编造）

1. **budget.limit 硬预算数值**（OQ-R3-1=A）：首轮不设硬预算，`BUDGET_LIMIT = null` 显式保持；等 Owner 给数或授权实测后回填（§2.1/§3.1/§5.2/§10）。
2. **实测 token 数**：R1 无 tokenizer，字节代理为实测；CJK×0.75+÷4 仅作回归量尺（`TOKEN_METHOD.status = regression-ruler-only`），估算值禁止表述为实测（§6）。
3. **更强行为验证的充分性标准**（§7.4 诚实边界）：P1-P5 仅为必要条件地板，"方法论真实被应用"的结构对应性审查等 Owner/R4 在 receipt 消费侧决断，本实现不发明。
4. **mode 缺省值**（重建新增缺口，见 D3）：冻结契约/幸存输入均无明文，暂按 `'dual'` + warnings，等 Owner 追认。
5. **P4 片段最小长度阈值**（重建新增缺口，见 D5）：契约未给数值，暂取 12（fail-closed 方向），等 Owner 追认。

## 7. 新建文件列表（全部为新增，零既有文件修改）

```
scripts/lib/activation.mjs                                          # activation.prepare（R3）
scripts/lib/receipt.mjs                                             # receipt.append / 生命周期 / P1-P5（R3）
test-reports/rebuild-20260920/R3-activation-receipt/run-probes.mjs  # 探针运行器
test-reports/rebuild-20260920/R3-activation-receipt/probes/_helper.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p01-metadata-level.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p02-body-level.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p03-resource-level.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p04-budget.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p05-body-missing.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p06-mode.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p07-chain-terminal.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p08-idempotency.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p09-invalid-events.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p10-hash-chain.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p11-c6-fixtures.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p12-legacy-compat.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p13-positive-matrix.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p14-selected-not-consumed.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p15-prepare-idempotency.mjs
test-reports/rebuild-20260920/R3-activation-receipt/probes/p16-p5-predicate.mjs
test-reports/rebuild-20260920/R3-activation-receipt/out-probe-results.json          # 运行器产物
test-reports/rebuild-20260920/R3-activation-receipt/RESULTS.md                      # 本文件
```
