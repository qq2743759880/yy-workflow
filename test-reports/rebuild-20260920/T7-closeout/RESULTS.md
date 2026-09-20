# T7 收尾批执行结果 — rebuild-20260920 / T7-closeout

> 派单：`handoffs/T7-closeout-20260920.md`。工作区：`D:\.ai-hub\skills\yy`。
> 权威判据（不重开裁决）：`plans/decision-s5-p0-semantics-20260920.md`（Owner 2026-09-20 授权编排者裁决，选择 2 = 统一严格口径 ⬜+◐ + 五道防护）。
> 本批为**收尾批**：语义变更（S5）由 Owner 已裁决，执行者只落地与取证，不做新裁决。
> **未做任何 git 操作**（无 commit / 无 checkout / 无 reset / 无 push）。

## 0. 施工项总览

| # | 施工项 | 状态 | 关键产物 |
|---|---|---|---|
| ① | S5 严格口径单点落地 + 变更登记 | ✅ | `scripts/lib/ci.mjs`（`OPEN_P0_PATTERN` 单点）、`scripts/ci.mjs`、`scripts/lib/orchestrator.mjs`、`contracts/discrepancies/cr-20260920T112945Z-a6244b0c.json` |
| ② | B0 翻默认（默认走 `lib/ci.mjs`，薄壳） | ✅ | `scripts/ci.mjs`（删除 legacy 内联）、`test-reports/rebuild-20260920/T4-wiring-b0b3/b0-diff.mjs` 重写 + `snapshots/*` |
| ③ | `--evolve` 死路径修复（P1-1） | ✅ | `scripts/orchestrator.mjs`（五键实测 + 候选从实际产物构造）、`T7-closeout/evolve-sandbox-proof.mjs` |
| ④ | hook 第三分类 `system-load`（P2-1） | ✅ | `scripts/lib/io-audit-hook.mjs`、`scripts/asset-io-report.mjs`（routing/system-load/consumption 三列） |
| ⑤ | R3 探针加固（去时钟依赖 + 双层沙箱） | ✅ | `R3-activation-receipt/run-probes.mjs`、`probes/_helper.mjs`、5 连跑 16/16 取证 |

**白名单遵守**：写入仅落在 `scripts/lib/ci.mjs`、`scripts/ci.mjs`、`scripts/lib/orchestrator.mjs`、`scripts/orchestrator.mjs`、`scripts/lib/io-audit-hook.mjs`、`scripts/asset-io-report.mjs`、`contracts/discrepancies/`、`plans/active/changes/`、`test-reports/rebuild-20260920/{T4-wiring-b0b3,A1-lib-ci,R3-activation-receipt}/`、`test-reports/rebuild-20260920/T7-closeout/`。时间戳机验：上述 6 个产品脚本 mtime 均落在本批窗口（19:28–19:36）。
**未触碰**：`contracts/*.md`（冻结契约本体）、`vendor/`、`plans/critique-backlog-tracker.md`、`scripts/lib/{evolution,change,journey,phase,remediation,gate,runtime,activation,receipt}.mjs`、`io-audit/`（越界，见偏差 D-3）。

---

## 1. ① S5 严格口径落地

### 1.1 单点定义（消除第三次分叉）

`scripts/lib/ci.mjs` 新增并导出（**唯一事实源**）：

```js
export const OPEN_P0_MARKERS = Object.freeze(['⬜', '◐']);
export const OPEN_P0_MARKER_RE = new RegExp('^(?:' + OPEN_P0_MARKERS.join('|') + ')');
export const OPEN_P0_PATTERN = new RegExp('^\\|\\s*C-.*\\|\\s*P0\\s*\\|.*[' + OPEN_P0_MARKERS.join('') + ']');
export function classifyOpenP0(trackerText) { /* → {openP0, pending, inProgress, unbacked, warnings} */ }
export function countOpenP0(trackerText) { return classifyOpenP0(trackerText).openP0; }
```

- `scripts/ci.mjs`：legacy 内联计数**删除**，改走 `classifyOpenP0`（见 §2）。
- `scripts/lib/orchestrator.mjs`：`BL_PENDING_RE` 由 `OPEN_P0_MARKERS` 派生，`backlogIsPending` 用 `OPEN_P0_MARKER_RE.test(r.status)` 取代原自持字面量 `/^[⬜◐]/` —— **行为零变化**（自测 H：30 例逐例等价）。

### 1.2 防护 3：◐ 证据卫生规则

`classifyOpenP0` 对每条 `| P0 |` 命中行分类：

| 行状态 | 是否携带落点/收据引用 | 归类 | 计数 | warnings 文案 |
|---|---|---|---|---|
| ⬜ | — | `pending` | 计入未清零 | — |
| ◐ | 无 | `unbacked`（**无证据 ⬜**） | **计入未清零（计数不变）** | `…⇒ 归类为无证据 ⬜（按 ⬜ 处理，计数不变；防护 3）` |
| ◐ | 有 | `inProgress` | **计入未清零** | `…⇒ 分类 in-progress（进行中，仍计未清零；防护 3）` |
| ✅ | — | 不计入 | 0 | — |

引用识别 `EVIDENCE_REF_PATTERN` 刻意**只认具体引用**（任务/节点 id 如 `T7`/`C-31`/`R5A-06`、receipt id 如 `cr-…`/`apr-…`、仓库路径 `test-reports/…`），**不把表头列名「落点」当引用**——否则规则永不触发（该收紧是本批修复的一个自测暴露的真实缺陷，见 §9 D-9 前身）。

### 1.3 变更登记（C-R7 change.record，含 grandfathering）

实物：`contracts/discrepancies/cr-20260920T112945Z-a6244b0c.json`（+ `plans/active/changes/index.jsonl`、`.approvals-registry.json`）。

| 字段 | 值 |
|---|---|
| `changeRecordId` | `cr-20260920T112945Z-a6244b0c` |
| `basePlan` / `baseVersion` | `contracts/C-R4-control.md` / `19055ff7a5c881ef…` |
| `impactClass` | `CONTRACT` |
| `invalidatedNodes` | `["S5"]` |
| `owner` / `approvalId` | `Owner` / `apr-20260920T104626Z-b3dc0c82` |
| `sourceEvidence` | 裁决文档 `#f02e0dc7…` + `C-R4-control.md#19055ff7…` + tracker `#dea1f24b…` |
| `status` / `recordedBy` | `active` / `T7-closeout` |

`reason` 正文含：动机（S5 与 `orchestrator.backlogIsPending` 双口径裂缝 + ◐ 使"修一半"与"修完"不可区分）、落地方式、**grandfathering 声明**（历史 ACCEPTED 报告 M1-M3 / R6 / 12-12 PASS 按取得时口径 ⬜-only 有效，不追溯作废）、以及「CI 在验收/发布检查点运行，非持续灯」的检查点纪律。

### 1.4 自测（`T7-closeout/s5-semantics.test.mjs`）

```
TOTAL: 19/19 PASS   EXIT=0
```

逐条（原样摘要）：`A ⬜ 行 → FAIL(code=1)`｜`B ◐ 无引用 → FAIL(code=1)` + `warnings 含卫生分类（归类「无证据 ⬜」）` + `classification.unbacked 具名`｜`C ◐ 带证据引用 → FAIL(code=1)` + `warnings 含 in-progress 分类` + `classification.inProgress 具名` + `计数与卫生分类解耦（仍计未清零）`｜`D ✅ 行 → PASS(code=0)`｜`E lib/ci.mjs 定义 OPEN_P0_PATTERN` / `lib/orchestrator.mjs 引用 OPEN_P0_MARKER_RE（不自持 [⬜◐] 字面量）` / `ci.mjs 走 lib（无 legacy 内联计数）` / `OPEN_P0_MARKERS = [⬜, ◐]` / `OPEN_P0_MARKER_RE 由标记集派生`｜`F 真实 tracker：严格口径计数 ≥ 旧 ⬜-only 计数  [strict=0 legacy_only=0 pending=[] inProgress=[] unbacked=[]]`（即当前 tracker 严格口径下 P0 已清零，且两类口径同为 0）｜`G 仅 ⬜ 输入下计数与旧口径逐例一致（行为零变化面）` / `backlogIsPending：✅/❌ 非 pending，⬜/◐ pending` / `hasEvidenceRef：路径/任务 id/receipt id 命中，纯中文描述不命中`｜`H backlogIsPending 改写前后逐例等价（30 例，含真实 tracker 20 行）`。

连带同源探针 `A1-lib-ci/probe.mjs`（期望随新语义同步更新：`◐` 计入 → 组6 期望由 0 改 1，新增组6b）：

```
合计: 26 PASS / 0 FAIL
```

---

## 2. ② B0 翻默认

**做法（偏差 D-1）**：`scripts/ci.mjs` 重写为薄壳，**删除** legacy 内联路径（未保留 `--legacy`）。理由：内联与 lib 两套口径并存正是本批要消灭的分叉源；保留 `--legacy` 等于把「双口径」制度化。`--lib` 保留为**静默兼容 no-op**（原实现会打印一行 INFO，会破坏 G5 的逐字节一致断言，已去掉打印）。
S6 段标签保留历史字符串 `=== S5 资产质量评分（asset-call-rate）===`（外部脚本按行匹配，逐字兼容）；FAIL/PASS 文案改为「N 条未闭环 ⬜/◐」/「0 条 P0 未闭环 ⬜/◐」。

**可验证性方案**：因 legacy 内联已删除，"新旧双跑对比"不可为，改用**翻默认前冻结快照 + 已申报差异 allowlist**：
`T7-closeout/capture-preflip-b0.mjs` 先落 `T4-wiring-b0b3/snapshots/{g1-real-repo,g2-s1-fail,g3-spawn-fail,g4-s5-p0-fail}.txt`，`b0-diff.mjs` 再以新默认重跑同四组逐字节比对。

```
PASS G1 新默认 vs 冻结快照（去噪 + 已申报差异后逐字节一致）  [exit=0 bytes=5449 已申报差异={"S5-FAIL-STRICT":0,"S5-PASS-STRICT":1}]
PASS G1 退出码 = 0  [exit=0]
PASS G2 新默认 vs 冻结快照（去噪 + 已申报差异后逐字节一致）  [exit=1 bytes=759 已申报差异={"S5-FAIL-STRICT":0,"S5-PASS-STRICT":0}]
PASS G2 退出码 = 1  [exit=1]
PASS G3 新默认 vs 冻结快照（去噪 + 已申报差异后逐字节一致）  [exit=1 bytes=848 已申报差异={"S5-FAIL-STRICT":0,"S5-PASS-STRICT":0}]
PASS G3 退出码 = 1  [exit=1]
PASS G4 新默认 vs 冻结快照（去噪 + 已申报差异后逐字节一致）  [exit=1 bytes=406 已申报差异={"S5-FAIL-STRICT":1,"S5-PASS-STRICT":0}]
PASS G4 退出码 = 1  [exit=1]
PASS G5 --lib 兼容 no-op：默认 vs --lib 逐字节一致  [defaultBytes=406 libBytes=406 exit=1/1 libFlagNotice=false]
已申报语义差异累计：{"S5-FAIL-STRICT":1,"S5-PASS-STRICT":1}
B0 self-test: 9/9 passed
```

即：**除 2 处已申报的 S5 语义文案外，翻默认后的输出与翻默认前逐字节一致**；`--lib` 与默认输出逐字节一致且无任何提示行。差异计数强制打印（不静默），`firstDiff()` 会打出首处分歧。

---

## 3. ③ `--evolve` 死路径修复（T5T6 P1-1）

**修复**：`maybeRunB7Hooks` 的 evolve 段改为「候选从编排运行的实际产物构造 + baseline 五键运行实测」，任一键无实测值 ⇒ 该候选如实 `ok:false` + reason 指名缺什么（**fail-closed，不编造**）。

baseline 五键的实测来源（全部真跑，无占位）：

| 键 | 实测方式 |
|---|---|
| `structure` | 实跑 `validate-structure.mjs`（退出码+ok+at） |
| `manifest` | `buildManifest({vendorDir})` → entries 数 + 整对象 sha256 |
| `receiptTerminal` | 遍历 `artifacts/<subtaskId>/receipt.json` 的链终态；无链 ⇒ `'[待补充]'` 并计入 missing |
| `ciSection` | 实跑 `review-gate.mjs --self-test` + S5 `classifyOpenP0`（openP0/unbacked/inProgress）；S4 如实标「未跑」 |
| `rollbackTarget` | 只读解析 `.git/HEAD`→`refs/heads/main`（**不执行 git 命令**） |

**证明（偏差 D-6：`--evolve` 在 `--dry-run` 下不可达——`orchestrator.mjs:640-644` 在 B7 钩子之前 early-return，故必须以真实 resume 编排取证）**：

`T7-closeout/evolve-sandbox-proof.mjs` → **`TOTAL: 19/19 PASS  EXIT=0`**

- P1 正向（常见路径必须产出 `ok:true`）：
  `[B7] --evolve: proposed 2/2 candidates`，`planning: ok:true cnd-20260920T140127Z-3f63491d`、`review: ok:true …`；
  物理落盘：`.tt-state/evolution/planning/<cnd>/candidate/candidate.json` + `baseline/baseline.json`（沙箱内，见下）；
  落盘记录为 R10 包装形状 `{candidateId, assetId, sourceVersion, proposedBy, idempotencyKey, status, candidate, createdAt}`，十项不变量齐备、`status=CANDIDATE`（未越权升格）；
  baseline 实测值例：`structure={validator:'validate-structure.mjs',exitCode:0}`、`manifest={entries:16,sha256:ce715b87…}`、`receiptTerminal={chains:1,terminals:{'t7-ev-01':{events:3,terminal:'execution_observed'}}}`、`ciSection.sections=[S1:0,S2:0,S5:openP0=0]`、`rollbackTarget={ref:'refs/heads/main',sha:'52ed690c…'}`；
  `changeset=[.tt-state/state.json, artifacts/t7-ev-01/output.md, artifacts/t7-ev-01/receipt.json]`、`evidenceRefs` 含 2 个 `path#sha256` —— 全为沙箱相对路径，无仓库绝对路径泄漏。
- P2 反向（fail-closed）：抹掉 receipt 链后重跑 ⇒ `proposed 0/2`，`planning: ok:false BASELINE_MISSING 缺 receiptTerminal（…）`，**一个候选都不落盘**（`find` 结果为空数组）。

沙箱（本次运行根，物理证据）：`test-reports/rebuild-20260920/T7-closeout/.sandbox/evolve/run-20260920140125-14440/`。

---

## 4. ④ hook 第三分类 `system-load`（T5T6 P2-1）

**破坏性变更声明**：`io-audit-hook.mjs` 的 tag 取值集由 `{routing, consumption}` 变为 **`{routing, system-load, consumption}`**；文件头注释与 `scripts/asset-io-report.mjs` 同步。

- `ROUTING_BASENAMES`（4 项）/ `SYSTEM_LOAD_BASENAMES`（2 项：`manifest.mjs`、`asset.mjs`）改为 `export const`；`classifyTag` 两遍扫描（先 routing 保持优先级，再 system-load，都未命中 → consumption），**自帧（io-audit-hook.mjs）剔除保留**。
- 匹配为 **basename 精确匹配**（P2-1 原设计），故 `callermanifest`/`callermatrix`/`official-ci` 等子串形态不误命中。
- `asset-io-report.mjs`：`tagKey()` 把 `system-load`→`systemLoad`、未知 tag→`consumption`（**旧数据口径不破坏**）；每资产计数表扩为 `| 资产 | routing | system-load | consumption | 合计 |`，阶段矩阵单元格 `routing/system-load/consumption`，空格子 `0/0/0`。

**自测（`T7-closeout/io-three-tag.test.mjs`）→ `TOTAL: 22/22 PASS  EXIT=0`**，含端到端：

```
PASS T4 端到端 buildManifest（lib/manifest.mjs 装载栈）→ system-load
PASS T4 端到端 loadAssets（lib/asset.mjs 装载栈）→ system-load
PASS T4 端到端 路由脚本 basename（matrix.mjs fixture）→ routing
PASS T4 端到端 普通读脚本 → consumption
PASS T5 同一资产三类计数互不污染（implementation 1/1/1）
PASS T5 未知 tag 归 consumption（旧口径不破坏）
PASS T5 渲染含 system-load 列（每资产计数表）
PASS T5 渲染阶段矩阵单元格 = routing/system-load/consumption
PASS T6 特征集声明：routing 4 项 / system-load 2 项
PASS T6 hook 文件头声明三分类取值集
```

即真实装载栈（`buildManifest`/`loadAssets`）的读调用被正确剥离为 `system-load`，机器层无差别全量装载不再污染 `routing` 口径。

---

## 5. ⑤ R3 探针加固（T5T6 P2-3）

加固四项（`R3-activation-receipt/run-probes.mjs` + `probes/_helper.mjs`）：

1. **双层沙箱**：运行级 `.sandbox/run-<stamp>-<pid>/`（历史运行目录不再被触碰）+ 探针级 `<runRoot>/<pNN>/`；
2. **去时钟依赖**：`_helper.mjs` 导出 `FIXED_NOW = 2026-09-20T00:00:00.000Z`，`prepare()`/`append()` 在 `opts.now === undefined` 时注入；显式传值的探针（p15）保持自身注入值；
3. **Windows 删目录重试**：`rmRetry()`（EBUSY/EPERM 6 次 + `Atomics.wait` 同步退避）；
4. **本批追加**：**结果历史只追加**（`out-probe-history.jsonl`，不再被下一次运行覆盖——此前正是"失败后被成功运行覆盖"导致失败探针名丢失，见 §9 D-7）、**旧沙箱修剪**（保留最近 5 个 run-*）、**瞬态文件系统错误重试**（仅对 `EPERM/EBUSY/EACCES/ENOTEMPTY/EMFILE/ENFILE/UNKNOWN` 错误码换新沙箱重跑一次；**断言失败绝不重试**，且 stdout `[RETRY]` + JSON `attempts/retried` 全程留痕，绝不静默通过）。

**5 连跑取证（`evidence/r3-5x/run-{1..5}.log`，全量输出原样）**：

```
RUN 1 EXIT=0 PASS=16 FAIL=0 RETRY=0 | TOTAL: 16/16 PASS
RUN 2 EXIT=0 PASS=16 FAIL=0 RETRY=0 | TOTAL: 16/16 PASS
RUN 3 EXIT=0 PASS=16 FAIL=0 RETRY=0 | TOTAL: 16/16 PASS
RUN 4 EXIT=0 PASS=16 FAIL=0 RETRY=0 | TOTAL: 16/16 PASS
RUN 5 EXIT=0 PASS=16 FAIL=0 RETRY=0 | TOTAL: 16/16 PASS
```

双层隔离机验：最新运行根内探针级子目录 **16 个**（`p01-metadata-level` … `p16-p5-predicate`），保留 run-* 数 = 5。

**诚实申报（§9 D-7）**：加固过程中一度观察到 `TOTAL: 15/16 PASS EXIT=1` 连出现象；处置后累计 **15 次连续 16/16（0 次重试）**。当时的失败探针名因取证方式（`tail` 截断 + `out-probe-results.json` 被后一次成功运行覆盖）未能留存，故**不宣称**该现象已被确证消除，只宣称：加固后 15 连跑可复现 16/16，且失败留痕通道已建立。

---

## 6. 总门结果

| 门 | 命令 | 结果 | 证据 |
|---|---|---|---|
| regression | `node scripts/regression-all.mjs` | **12 PASS / 0 FAIL** | `evidence/gate/G1-regression-all.log` |
| validate | `node scripts/validate-structure.mjs` | **0 项警告** | `evidence/gate/G2-validate-structure.log` |
| R10 契约夹具 | `node test-reports/R10-rebuild-20260920/run-fixtures.mjs` | **TOTAL: 12/12 PASS** | `evidence/gate/G3-R10-fixtures.log` |
| 六模块探针 · R3 | `R3-activation-receipt/run-probes.mjs` ×5 | **16/16 ×5（EXIT=0）** | `evidence/r3-5x/run-{1..5}.log` |
| 六模块探针 · R4 | `R4-phase/run-probes.mjs` | **TOTAL: 12/12 PASS** | `evidence/gate/M-R4-phase.log` |
| 六模块探针 · R5a | `R5a-journey/run-probes.mjs` | **15/16 或 16/16（p16 时间戳脆弱，见 D-4）** | `evidence/gate/M-R5a-journey.{PASS,FAIL}.log` |
| 六模块探针 · R7 | `R7-change/run-probes.mjs` | **TOTAL: 12/12 PASS** | `evidence/gate/M-R7-change.log` |
| 六模块探针 · R8 | `R8-remediation/run-probes.mjs` | **TOTAL: 12/12 PASS** | `evidence/gate/M-R8-remediation.log` |
| 六模块探针 · T6 | 从**仓库根**跑 `T6-wiring-b4b8/run-probes.mjs` | **T6 PROBES TOTAL: 21/21 PASS** | `evidence/gate/M-T6-wiring-b4b8.log` |
| ① S5 新语义自测 | `T7-closeout/s5-semantics.test.mjs` | **19/19 PASS** | `evidence/self-tests/01-s5-semantics.log` |
| ① 同源探针 A1 | `A1-lib-ci/probe.mjs` | **26 PASS / 0 FAIL** | `evidence/self-tests/04-A1-lib-ci.log` |
| ② B0 翻默认等价 | `T4-wiring-b0b3/b0-diff.mjs` | **9/9 passed**（2 处已申报差异） | `evidence/self-tests/03-b0-diff.log` |
| ③ `--evolve` 落盘证明 | `T7-closeout/evolve-sandbox-proof.mjs` | **19/19 PASS** | `evidence/self-tests/05-evolve-proof.log`、`evidence/evolve/out-evolve-proof.json` |
| ④ IO 三分类自测 | `T7-closeout/io-three-tag.test.mjs` | **22/22 PASS** | `evidence/self-tests/02-io-three-tag.log` |

---

## 7. 偏差申报

**D-1 ② 选择"删除 legacy 内联"而非保留 `--legacy`。** 派单给了二选一，已在 REPORT 语境下申报：保留 `--legacy` 会把「双口径」制度化，与 ① 的单一事实源目标冲突。等价性因此改用"翻默认前冻结快照 + 已申报差异 allowlist"证明（§2），差异**仅 2 处已申报 S5 文案**，且差异计数强制打印。

**D-2 S5 change.record 的 receipt 属机械物化，非真实人工签署流程。** 裁决已由 Owner 作出，但 `validateOwnerApprovalReceipt` 要求八字段 receipt；本批按裁决文档 mtime 物化 `approvedAt`、以裁决文档 sha256 作 `approvalEvidence`、`approvedBy='owner'`、`expiresAt=null`、`scopeId='C-R4-control.md@<sha>:CONTRACT'`。**这是把既成裁决登记为可机验凭据，不等于新增一次 Owner 审批**——Owner 复核时请按此口径理解。

**D-3 `io-audit/` 内 p02 探针与 P2-1 设计自相矛盾（预存越界缺陷，本批不修）。** `[FAIL] p02 | routing 子(1 条 tag=consumption)`：p02 以 `fake-matrix.mjs` 期望命中 `routing`，而 P2-1 明确定为 **basename 精确匹配**（`matrix.mjs` 命中、`fake-matrix.mjs` 不命中），p07 才是符合 P2-1 的版本。`test-reports/rebuild-20260920/io-audit/` **不在本批白名单**，故不改、不重跑（避免白名单外写入），仅在此登记，建议由 Owner 指派下一批修 p02 期望或统一到 p07 口径。本批对 P2-1 的验证由白名单内自测承担（`io-three-tag.test.mjs` 22/22）。

**D-4 R5a p16 间歇失败＝探针夹具时间戳脆弱性（越界，根因已机验）。** 现象：`[FAIL] p16 | namespace一致: … 健康=STALE 落点同ns=false …`，同一 cwd 连跑时**时过时不过**。根因链（`evidence/r5a-p16-flake/repro.mjs`，20 次样本）：

```
mtime同   | displayStatus=AUTHORIZED | persistedTo=.tt-state/alpha/journey.json | journey.json存在=true   (12/20)
mtime差 1.0ms | displayStatus=STALE | persistedTo=null | journey.json存在=false                        (8/20)
样本 20 次：mtime 相同 12 / 不同 8；STALE 8 次；persistedTo=null 8 次
失败率 ≈ 40%（= 两次相邻写入跨越文件时间戳刻度的比例）
```

即 p16 夹具**紧邻写入** `state.json` 与 `artifacts/as1/receipt.json` 两个 authoritative 源；`journey.mjs:512 computeStale()`（OQ-R5-2=A 相对判据）取「最新 vs 最老」比较，只要两次写落在不同时间戳刻度上 receipt 即更新 ⇒ STALE；而 `journey.mjs:44` 规定「仅当展示态 ∈ {AUTHORIZED, OBSERVED} 才落盘 journey.json」⇒ STALE 运行必然 `landedNs=false`——**一个根因，两处断言同时失败**。**非产品实现缺陷**（`journey.mjs` mtime 2026-09-20 00:16、sha256 `eaf668085c4399156f1103c1b15bd7c3605991c461c87cbc1e83267a4b9edad7`，本批未触碰）；修复需改 R5a 探针夹具（越界不可写）。属与 ⑤ **同源**的问题（时间/时间戳依赖），建议纳入下一批统一加固。

**D-5 各套件 runner 的 cwd 依赖不一致。** `T6-wiring-b4b8/run-probes.mjs` 从自身目录启动会 `ERR_MODULE_NOT_FOUND: …T6-wiring-b4b8\scripts\lib\gate.mjs`，**必须从仓库根启动**；R3/R4/R5a/R7/R8 的 runner 均以模块 URL 定位，cwd 无关（已实测 CWD=仓库根/`C:\`/临时目录 三态一致）。本批未改这些 runner（越界），仅登记并在总门表中标注正确启动方式。

**D-6 `--evolve` 在 `--dry-run` 下不可达。** `orchestrator.mjs` 的 dry-run 分支在 B7 钩子之前 `return`，故一切"dry-run + --evolve"的设想都触达不到该路径（这也解释了 P1-1 为何长期是死路径却无人发现）。本批证明改用**真实 resume 编排**（沙箱 workspace + 注入的 done 子任务与 receipt 链），见 §3。

**D-7 R3 加固追加了三项派单未明列的防护，并据实申报取证缺口。** 追加项：历史只追加（`out-probe-history.jsonl`）、旧沙箱修剪（保留 5）、瞬态 FS 错误重试（仅瞬态、全留痕）。取证缺口：加固过程中观察到的 `15/16` 现象**未留下失败探针名**（原因是取证方式 `tail` 截断 + JSON 被后一次成功运行覆盖），故按"未确证消除、只确证 15 连跑可复现 16/16"口径申报，不做消除性断言。

**D-8 自测沙箱统一落到 `.sandbox/` 下。** 仓库 `.gitignore` 仅忽略 `test-reports/**/.sandbox/`；本批原先使用的 `.sandbox-three-tag/`、`.sandbox-evolve/` 不被忽略，已改为 `T7-closeout/.sandbox/{three-tag,evolve}/` 并**重跑取证**（19/19、22/22 复现一致），旧目录已删除，不留未忽略产物。

**D-9 `A1-lib-ci/probe.mjs` 期望随 ① 语义同步更新。** 组6 期望由「`◐` 不计入」改为「`◐` 计入 → 1」，并新增组6b（◐ 带引用仍计 1、`unbacked`/`inProgress` 归类、`OPEN_P0_MARKERS` 字符集）。这是**期望随裁决更新**，不是探针被削弱——同批新增的 `s5-semantics.test.mjs` 组 G/H 专门锁"行为零变化面"（30 例等价）。

**D-10 `--evolve` 在 sandbox 会向 workspace 写 change.record。** `maybeRunB7Hooks` 的 (b) 段在 `--evolve` 时必然记录一条 `DOC_ONLY` 变更；沙箱 workspace 下该记录落在沙箱内（`change.mjs` 以 `opts.workspace` 为根），真实 `contracts/discrepancies/` 未被污染——已机验（真实目录仅含 ① 的 `cr-20260920T112945Z-a6244b0c.json`）。

---

## 8. STOP 条件复核（三项均未触发）

| STOP 条件 | 复核结论 |
|---|---|
| S5 严格化需改 tracker 行 schema | **未触发**。新口径只读既有 `| C-xx | P0 | ⬜/◐/✅ |` 行，未新增/变更列。真实 tracker 新旧口径对照：严格计数 ≥ 旧计数，且当前 `openP0 = 0`（严格与 legacy 皆 0）。 |
| `--evolve` 合规候选必须修改 `lib/evolution.mjs` 才能达成 | **未触发**。`lib/evolution.mjs` 零改动（CANDIDATE_INVARIANT_FIELDS / BASELINE_REQUIRED_KEYS 原样消费），`ok:true` 由调用侧提供实测值达成。 |
| B0 翻默认后发现 lib 版与旧内联存在不可消除差异 | **未触发**。差异仅 2 处**已申报**的 S5 文案，余下逐字节一致（含 G5 `--lib` 逐字节一致、无提示行）。 |

---

## 9. 取证物清单

```
test-reports/rebuild-20260920/T7-closeout/
├─ RESULTS.md                     ← 本文件
├─ capture-preflip-b0.mjs         ② 翻默认前冻结快照
├─ record-s5-change.mjs           ① change.record 驱动（cr-20260920T112945Z-a6244b0c）
├─ s5-semantics.test.mjs          ① S5 新语义自测（19/19）
├─ io-three-tag.test.mjs          ④ IO 三分类自测（22/22）
├─ evolve-sandbox-proof.mjs       ③ --evolve 沙箱落盘证明（19/19）
├─ .sandbox/                      自测沙箱（.gitignore: test-reports/**/.sandbox/）
│  ├─ three-tag/                  ④ 端到端夹具
│  └─ evolve/run-<stamp>/         ③ P1 落盘物理证据（ws-happy / ws-noreceipt）
└─ evidence/
   ├─ self-tests/{01-s5-semantics,02-io-three-tag,03-b0-diff,04-A1-lib-ci,05-evolve-proof}.log
   ├─ gate/{G1-regression-all,G2-validate-structure,G3-R10-fixtures,M-R4-phase,
   │        M-R5a-journey.PASS,M-R5a-journey.FAIL,M-R7-change,M-R8-remediation,
   │        M-T6-wiring-b4b8}.log
   ├─ r3-5x/run-{1..5}.log         ⑤ 5 连跑 16/16
   ├─ r5a-p16-flake/repro.mjs + repro-20x.log   D-4 根因复现
   └─ evolve/{P1-happy.stdout,P2-fail-closed.stdout}.log + out-evolve-proof.json
```

---

## 10. 交 Owner 的决策项（本批不做，仅提出）

1. **D-3**：`io-audit/p02` 期望与 P2-1 精确匹配口径冲突 —— 修 p02 期望，还是统一到 p07 口径？
2. **D-4/D-7**：R5a p16（时间戳脆弱）与 R3 时间依赖属同源问题，是否指派一批做"探针去时间戳依赖"统一加固（改 R5a 夹具需授权越界写入）？
3. **D-5**：套件 runner 的 cwd 依赖是否统一为模块 URL 定位（消灭"必须从仓库根跑"的隐性前置）？
4. ① 的 CI 检查点纪律（严格口径下进行中 P0 会让 S5 常红）已写入 change record 正文，是否同步进 `plans/` 正式纪律文档？
