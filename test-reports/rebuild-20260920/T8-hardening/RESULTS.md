# T8 测试资产加固批执行结果 — rebuild-20260920 / T8-hardening

> 派单：`handoffs/T8-test-hardening-20260920.md`。工作区：`D:\.ai-hub\skills\yy`。
> 基线快照 `7f1614f`（T7 ACCEPTED）。**未做任何 git 操作**（无 commit / 无 checkout / 无 reset / 无 push）。
> 本批为**测试资产加固批**：产品代码（含 `scripts/lib/journey.mjs`）**零改动**。

## 0. 施工项总览

| # | 施工项 | 状态 | 关键产物 | 前后对比 |
|---|---|---|---|---|
| ① | R5a p16 去时间戳加固 | ✅ | `R5a-journey/probes/_helper.mjs`（新）、`run-probes.mjs`、`p15`/`p16` | p16 判据失败率 **65% → 0%**（各 20 次样本，同机同 Node） |
| ② | io-audit p02 对齐 p07 basename 口径 | ✅ | `io-audit/probes/p02-routing-consumption.mjs` | p01-p06 **5/6 → 6/6**；p07/p08 保持 2/2 |
| ③ | runner cwd 统一 | ✅ | `T6-wiring-b4b8/run-probes.mjs` | T6 **仅能从仓库根跑 → 仓库根/自身目录/`C:\`/临时目录 四态 21/21** |
| ④ | b0-diff 崩溃栈结构归一（P1-2） | ✅ | `T4-wiring-b0b3/b0-diff.mjs` + `T8-hardening/b0-diff-heterogeneous.mjs` | b0-diff **8/9 → 9/9**；7 类异构变异下 G2/G3 仍 PASS（26/26 自测） |
| ⑤ | change record corrigendum 追加 | ✅ | `contracts/discrepancies/cr-20260920T112945Z-a6244b0c.json` | 追加 `corrigenda[0]`（`cor-20260920T165601Z-p1-2-b0-error-path`），既有字段零改动 |
| ⑥ | `.workbuddy/` 清理 | ✅ | 目录已删除（内容转存 `T8-hardening/quarantine-workbuddy-memory-2026-09-20.md`） | 仓库根不再有执行者平台日志 |

**白名单遵守**：写入仅落在 `test-reports/rebuild-20260920/{R5a-journey,io-audit,T6-wiring-b4b8,T4-wiring-b0b3,T8-hardening}/`
+ `contracts/discrepancies/cr-20260920T112945Z-a6244b0c.json`（仅追加）+ `.workbuddy/`（删除）。
**未触碰**：`scripts/**`（全部产品脚本，含 `lib/journey.mjs`）、`contracts/*.md`、`vendor/`、`docs/`、`plans/**`（只读参照）、
`test-reports/rebuild-20260920/{R3,R4,R7,R8,A0,A1,A2,io-baseline,T7-closeout}/`、`test-reports/acceptance-20260920/**`。

---

## 1. ① R5a p16 去时间戳加固

### 1.1 根因（承接 T7 D-4）

`computeStale()`（OQ-R5-2=A 相对判据）在 {journey, state, receipts} 三类中取「最新 vs 最老」比较，
最老者落后 ⇒ STALE；而 `journey.mjs` §4.3 规定「仅当展示态 ∈ {AUTHORIZED, OBSERVED} 才落盘 journey.json」。
p16 夹具**紧邻写入** `state.json` 与 `receipt.json`，只要两次写跨过文件系统时间戳刻度就一片红。

### 1.2 加固（沿 R3 模式）

1. **固定 mtime**：新建 `R5a-journey/probes/_helper.mjs`，导出 `FIXED_NOW_MS = 2026-09-20T00:00:00.000Z`
   与 `writeFixed/writeJsonFixed/setMtime`（写后 `fs.utimesSync` 固定 atime+mtime）。
   p15、p16 的夹具写入全部改用之 ⇒ 三类权威源 mtime 同刻 ⇒ 相对 STALE 不可能由夹具时序诱发。
   - **未**改 p04：该探针语义就是「故意错时」，其 `utimesSync` 显式错时保持原样（加固不抹平被测行为）。
   - **未**改其余 13 个探针：逐一核对，它们只写**单一**权威源（state 或 receipts 或仅 journey/state-summary），
     `computeStale` 的 `points.length < 2` 短路 ⇒ 结构上不受时间戳影响；p14 早已自行固定 mtime（`SRC_T`）。
2. **双层沙箱**：`run-probes.mjs` 升级为运行级 `.sandbox/run-<stamp>-<pid>/` + 探针级 `<pNN>/`，
   历史运行目录不再被触碰；加固前遗留的平铺 `pNN/` 目录一次性清理。
3. 追加 R3 同款三项防护：**rmRetry**（EBUSY/EPERM 6 次 + `Atomics.wait` 同步退避）、
   **瞬态 FS 错误重试**（仅 EPERM/EBUSY/EACCES/ENOTEMPTY/EMFILE/ENFILE/UNKNOWN，换新沙箱重跑 1 次，
   stdout `[RETRY]` + JSON `attempts/retried` 留痕；**断言失败绝不重试**）、
   **结果历史只追加**（`out-probe-history.jsonl`）。
4. **旧沙箱修剪**：仅保留最近 5 个 `run-*`。

### 1.3 前后对比（机验，`T8-hardening/r5a-p16-before-after.mjs`，各 20 次）

```
BEFORE（加固前写序）：mtime 同刻 7/20｜STALE 13/20｜journey.json 落盘 7/20｜判据通过 7/20  失败率 65%
AFTER （writeJsonFixed）：mtime 同刻 20/20｜STALE 0/20｜journey.json 落盘 20/20｜判据通过 20/20  失败率 0%
```
逐次样本（BEFORE 的 mtimeDiff 分布：0ms / 0.044 / 0.515 / 0.517 / 0.518 / 0.52 / 0.745 / 0.988 / 0.997 / 1.001 / 1.003 / 1.006 / 1.039ms）
原样留在 `evidence/` 里——同一台机器、同一 Node v22.22.2、同一产品代码，只有夹具写法不同。

### 1.4 修后连跑（`evidence/r5a-10x/run-1..10.log`）

```
RUN 1..10  EXIT=0  PASS=16  TOTAL: 16/16 PASS   （10/10 全 16/16，RETRY 计数均为 0）
```
机验：`out-probe-history.jsonl` 累计 **20 条连续 16/16**（含一次沙箱放行前被中断后整体重跑的批次，
全部 `allPass=true`、`retried=[]`）；最新运行根内探针级子目录 **16 个**，保留 `run-*` 数 = 5（双层隔离生效）。

---

## 2. ② io-audit p02 对齐 p07 basename 口径

**问题**：p02 以 `fake-matrix.mjs` 期望命中 `routing`，而 P2-1 确立的口径是 **basename 精确匹配**
（`ROUTING_BASENAMES` 里是 `matrix.mjs`，`fake-matrix.mjs` 的 basename 不在集合内）⇒ 长期 FAIL（T7 D-3 / 编排者 P2-2）。

**处置**：p02 期望矩阵改为 basename 边界口径（与 p07 同一权威口径）：

| 子脚本 | 期望 | 实测 |
|---|---|---|
| `matrix.mjs`（真路由 basename） | routing | **routing** |
| `fake-matrix.mjs`（仅含 `matrix.mjs` 子串） | consumption | **consumption** |
| `plain-reader.mjs`（普通读脚本） | consumption | **consumption** |

重跑：`run-probes.mjs`（p01-p06）**6/6 PASS EXIT=0**；`run-p07p08.mjs` **2/2 PASS**。
p01/p03/p04/p05/p06 输出一字未变（只动 p02 的期望口径，不碰 hook 实现）。

---

## 3. ③ runner cwd 统一

**改动**：`T6-wiring-b4b8/run-probes.mjs` 的 `REPO` 由 `process.cwd()` 改为
`path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..','..','..')`；
原先手写的 `new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')` 一并换成标准 `fileURLToPath`。

**四态实测（同一命令、只换 cwd）**：

| cwd | 结果 |
|---|---|
| 仓库根 `D:\.ai-hub\skills\yy` | `== T6 PROBES TOTAL: 21/21 PASS ==` |
| `T6-wiring-b4b8/` 自身目录（改动前必 `ERR_MODULE_NOT_FOUND`） | 21/21 PASS |
| `C:\` | 21/21 PASS |
| `mktemp -d`（临时目录） | 21/21 PASS（`evidence/gate/M-T6-wiring-b4b8-from-tmpdir.log`） |

**其余五个套件 runner 复核**（从 `/tmp` 跑）：R3 16/16、R4 12/12、R5a 16/16、R7 12/12、R8 12/12 —— 均 cwd 无关（与 T7 D-5 记载一致）。

---

## 4. ④ b0-diff 崩溃栈结构归一（P1-2 处置）

### 4.1 加固前本机实测：**8/9（G1 FAIL）**

```
FAIL G1 ... first mismatch @4431
    snapshot: "...- plan: plan-RAND · cluster: T2_BACKEND ..."
    actual:   "...- plan: plan-mua1gsj7 · cluster: T2_BACKEND ..."
```
根因**不是**崩溃栈，而是环境噪声正则 `/plan-mu9[a-z0-9]+/g` 过于具体：
`planId = 'plan-' + Date.now().toString(36)`（`scripts/lib/planner.mjs:38`、`deconstruct.mjs:199`），
前缀随 epoch 变化，今日实测已是 `plan-mua1gsj7` ⇒ 噪声逃逸。（详见 §7 D-1。）

### 4.2 归一化升级（`b0-diff.mjs`）

在**两侧同口径**施加：

| 层 | 规则 | 消除的噪声 |
|---|---|---|
| ⓪ `canonicalizeCrash()`（新增） | 崩溃栈段（从 `node:<mod>:<n>` 头行到 `Node.js v…` 尾行，遇 `[FAIL]/[PASS]` 行即止，绝不吞 CI 判定行）折叠为结构化标记 `<<NODE_CRASH err=<类> code=<码> syscall=<调用> target=<末段路径>>>` | **栈段有无、帧文本、内部帧条数、属性块** |
| ① plan id | `/plan-[0-9a-z]{8,12}\b/g → plan-RAND`（原 `/plan-mu9[a-z0-9]+/`） | 随机 plan id |
| ⑤ Node 内部帧 | `node:<mod>:<line>[:<col>] → node:<mod>:LINE[:COL]` | **行/列号随构建变化** |
| ⑥ Node 版本 | `Node.js v22.22.2 → Node.js vVERSION` | 版本串 |
| ⑦ errno | `errno: -4058 → errno: ERRNO` | 平台数值 |

判别力**刻意保留**在 6 项锚点：`err` / `code` / `syscall` / `target` / `[FAIL]` 判定行 / 退出码。

**DECLARED_DELTAS 保留并补记**：原 `S5-FAIL-STRICT`、`S5-PASS-STRICT` 原样保留；
新增第三项 `S1S3-CRASH-CLEAN-CAPTURE`（**条件生效**型）——当一侧有崩溃栈段、另一侧无
（lib runGate 干净捕获，P1-2 裁决批准的新声明行为）时抹平并**计数打印**，同构建下恒为 0 次，绝不静默。

### 4.3 机验

* **b0-diff 主测 9/9**（`evidence/gate/M-b0-diff.log`）：
  `已申报语义差异累计: {"S5-FAIL-STRICT":1,"S5-PASS-STRICT":1,"S1S3-CRASH-CLEAN-CAPTURE":0}`。
  G2 归一化后字节 759 → 147、G3 848 → 149（崩溃栈不再逐字节比对）。
* **异构构建模拟自测 26/26**（`T8-hardening/b0-diff-heterogeneous.mjs`）：
  本机只有一种 Node 构建无法真换构建，故用**变异注入**模拟——G2/G3 各跑 7 项正向变异 + 4 项反向变异：

  | 变异 | 内容 | 结果 |
  |---|---|---|
  | M1 | 所有 Node 内部帧行/列号整体偏移 | PASS |
  | M2 | Node 版本串 v22.22.2 → v20.11.1 | PASS |
  | M3 | errno -4058 → -2 | PASS |
  | M4 | 删除全部 Node 内部帧（只留用户帧） | PASS |
  | M5 | 追加 3 条 Node 内部帧 | PASS |
  | M6 | **整段崩溃栈消失**（模拟干净捕获） | PASS，且 `S1S3-CRASH-CLEAN-CAPTURE=1`（条件生效通道确证可用） |
  | M7 | 属性块 `{ errno…code…syscall… }` 整体删除 | PASS |
  | N1 | 错误类 Error → TypeError | **FAIL**（如预期，判别力在位） |
  | N2 | 错误码 ENOENT → EACCES | **FAIL**（G3 组无匹配目标，如实标注跳过） |
  | N3 | 判定行 退出码 1 → 2 | **FAIL** |
  | N4 | 删除 `[FAIL]` 判定行 | **FAIL** |

---

## 5. ⑤ change record corrigendum 追加

`contracts/discrepancies/cr-20260920T112945Z-a6244b0c.json` **仅追加**数组字段 `corrigenda`：

```json
"corrigenda": [
  {
    "corrigendumId": "cor-20260920T165601Z-p1-2-b0-error-path",
    "recordedAt": "2026-09-20T16:56:01.367Z",
    "recordedBy": "T8-test-hardening",
    "status": "active",
    "subject": "B0 翻默认后 S1/S3 子进程崩溃路径的错误输出形状差异（T7 独立验收 P1-2）",
    "finding": "...（legacy stdio inherit 透传原始 Node 栈 vs lib runGate 干净捕获；b0-diff G2/G3 依赖崩溃栈逐字节相等，执行者 9/9 属同构建数字巧合，编排者复跑 7/9 实证异构必挂）",
    "disposition": "裁决：lib 的干净错误路径优于 legacy，批准为新声明行为——不回滚、不改产品代码，处置限定在测试资产侧",
    "declaredBehavior": "崩溃栈段折叠为 <<NODE_CRASH err/code/syscall/target>>；行号/版本/errno/栈段有无一律归一；判别力保留在 6 项锚点；S1S3-CRASH-CLEAN-CAPTURE 条件生效并计数打印",
    "machineVerification": ["b0-diff.mjs#b56096b38ceecf5d 9/9", "b0-diff-heterogeneous.mjs#75a9c239c105fc79 26/26", "evidence/b0-diff-heterogeneous.log#4b8f441ed2a6689d"],
    "sourceEvidence": ["T7 REPORT.md#05d839302f79f365", "T7-closeout/RESULTS.md", "plans/ci-checkpoint-discipline-20260920.md#f781af036cec6335"],
    "scopeNote": "append-only：既有字段零改动、不新增 invalidatedNodes、产品代码零改动"
  }
]
```

机验（追加后解析）：`changeRecordId` / `basePlan` / `impactClass=CONTRACT` / `invalidatedNodes=["S5"]` /
`approvalId=apr-20260920T104626Z-b3dc0c82` / `idempotencyKey` / `status=active` / `recordedAt` / `touchedFiles`
**全部原值未变**，仅多出顶层键 `corrigenda`。

> 提示（非本批职责）：本仓 `.gitignore` 含 `contracts/`（既有配置），因此 `contracts/discrepancies/`
> 整体上不入库。change record 作为契约凭据是否需要入库/如何留存，请 Owner 定夺。

---

## 6. ⑥ `.workbuddy/` 清理

仓库根 `.workbuddy/`（执行者平台工作日志，白名单外、未申报，T7 P2-1）**已删除**。
删除前把内容原样转存到 `T8-hardening/quarantine-workbuddy-memory-2026-09-20.md`（不制造信息空洞）。
仓库根现在只有 `.git/.gitignore/.learnings/.memory/.mimosa` 等既有条目。

---

## 7. 偏差申报

**D-1（新发现，派单未列）：b0-diff 加固前本机已 8/9，G1 的失败根因是 plan id 噪声正则过窄。**
`planId = 'plan-' + Date.now().toString(36)` 的 base36 前缀随时代推进（`mu9…` → `mua1…`），
原正则 `/plan-mu9[a-z0-9]+/` 只匹配了当时那一种前缀 ⇒ 噪声逃逸。
已泛化为 `/plan-[0-9a-z]{8,12}\b/`（`plan-draft`/`plan-review` 等 5-7 字符的语义词不受影响，实测 G1 通过）。
**这说明 T7 报告的 b0-diff 9/9 与 p16 同源——都含"当时的数字巧合"，本批一并消除。**

**D-2（越界未修，登记）：另 4 处 cwd 依赖点在白名单外。**
扫描 `test-reports/**` 的 `process.cwd()` 命中 6 处，除 T6 外还有：
`test-reports/acceptance-20260920/T7/blind-probes.mjs:13`、
`test-reports/acceptance-20260920/T1T2/blind-probes.mjs:24`（这两处是**编排者自己的盲测探针**，更不应由执行者改）、
`test-reports/R6-migration-20260917/{e2e-bounded,compat-probe,asset-matrix}.mjs`。
派单白名单未含这些目录，**一律未动**；是否统一请 Owner 指派。

**D-3（保守选择）：io-audit 的 `run-probes.mjs` 仍只跑 p01-p06，未把 p07/p08 并入。**
派单写「全套 p01-p08 + run-p07p08 重跑全绿」，我按"两个 runner 都跑全绿"执行（6/6 + 2/2）。
未改 runner 组成是刻意保守：外部/验收脚本可能按 `TOTAL: 6/6` 匹配，改口径有破功风险。若 Owner 希望单命令覆盖，可再指派。

**D-4：b0-diff 归一化后 G2/G3 的可比对字节从 759/848 降到 147/149。**
这不是"断言变松"，而是**把 Node 自己的崩溃栈从逐字节断言里拿掉**——CI 判定的语义锚点
（错误类 / code / syscall / target / `[FAIL]` 行 / 退出码）一个没少，并由 N1-N4 反向变异证明
「归一化不会把真实差异也吞掉」。同一思路下，`S1S3-CRASH-CLEAN-CAPTURE` 只在**一侧有栈另一侧没有**时
才生效并计数打印，同构建恒 0。

**D-5（诚实申报，关于 P1-2 本机可复现性）：本机加固前 G2/G3 就已经 PASS，编排者观察到的 7/9 未能在本机复现。**
本机加固前的实测是 8/9（仅 G1 因 D-1 失败）。因此「有无栈段」这条是**按裁决预防性落地**，
并用 M6 变异**证明通道可用**（触发计数 1 且仍 PASS），**不宣称**已在本机实证修复了编排者那两处失败。
另注：现行 `scripts/ci.mjs` 的 `run()` 用的是 `stdio: ['ignore','inherit','inherit']`，
故本机两侧输出都带原始栈 —— 这解释了为何本机 G2/G3 本来就过得去。

**D-6：`.workbuddy/` 删除先转存、不裸删。** 见 §6。派单口径是"删除（平台如需留存自行移出仓库）"，
转存副本落在白名单内目录，既满足"不入库"也不丢信息。

**D-8（越界申报，总门运行的必然产物）：跑总门会让各套件 runner 回写自己的结果文件。**
越界机验（`find -newermt 2026-09-21`，排除白名单与 `.gitignore` 已忽略的 `test-reports/**/.sandbox/`）只剩 7 个文件，
全部是**跑门时 runner 自己写的既有输出路径**，非本批新增内容、非人工编辑：

```
test-reports/R10-rebuild-20260920/{RESULTS.md,out-fixture-results.json}   ← run-fixtures.mjs:56/63 必然重写（文件头带运行时间戳）
test-reports/rebuild-20260920/R3-activation-receipt/{out-probe-results.json,out-probe-history.jsonl}
test-reports/rebuild-20260920/R4-phase/out-probe-results.json
test-reports/rebuild-20260920/R7-change/out-probe-results.json
test-reports/rebuild-20260920/R8-remediation/out-probe-results.json
```
与 T7 报告的「2 个重跑噪声文件」同类；不跑总门就不会产生，跑总门则不可避免。产品代码 `scripts/**` 与
`vendor/`、`docs/`、`plans/`、`contracts/*.md` **零写入**（机验：上述扫描无一条命中）。

**D-7（诚实申报，不宣称波动已"确证消除"）：** R5a 加固后实测 **20 条连续 16/16**（10 次连跑日志 +
一次被沙箱中断后重跑的批次），且失败留痕通道已建（`out-probe-history.jsonl`，含 `failedSummaries`）。
沿用 T7 D-7 的口径：**不做"波动已彻底消除"的断言**，只宣称"加固后连续 N 次可复现全绿 + 失败不再被覆盖"。

---

## 8. STOP 条件复核（两项均未触发）

| STOP 条件 | 复核结论 |
|---|---|
| R5a p16 加固需要改 `journey.mjs` 产品代码 | **未触发**。修复完全落在夹具侧（固定 mtime）；`scripts/lib/journey.mjs` 零改动（mtime 仍为 2026-09-20 00:16，本批未触碰）。 |
| b0-diff 结构归一后仍无法在异构环境稳定 PASS | **未触发**。7 类异构变异（含行号/版本/errno/帧增删/栈段消失/属性块）下 G2/G3 全部仍 PASS，且 4 类反向变异仍 FAIL ⇒ 归一后既稳定又有判别力。 |

---

## 9. 总门结果（一次全量，**全绿**）

| 门 | 命令 | 结果 | 证据 |
|---|---|---|---|
| regression | `node scripts/regression-all.mjs` | **12 PASS / 0 FAIL** | `evidence/gate/G1-regression-all.log` |
| validate | `node scripts/validate-structure.mjs` | **0 项警告** | `evidence/gate/G2-validate-structure.log` |
| R10 契约夹具 | `node test-reports/R10-rebuild-20260920/run-fixtures.mjs` | **TOTAL: 12/12 PASS** | `evidence/gate/G3-R10-fixtures.log` |
| 六模块探针 · R3 | `R3-activation-receipt/run-probes.mjs` | **16/16 PASS** | `evidence/gate/M-R3-activation-receipt.log` |
| 六模块探针 · R4 | `R4-phase/run-probes.mjs` | **12/12 PASS** | `evidence/gate/M-R4-phase.log` |
| 六模块探针 · R5a | `R5a-journey/run-probes.mjs` ×10 | **16/16 ×10（EXIT=0）** | `evidence/r5a-10x/run-{1..10}.log` + `history.jsonl`（20 条连续全绿） |
| 六模块探针 · R7 | `R7-change/run-probes.mjs` | **12/12 PASS** | `evidence/gate/M-R7-change.log` |
| 六模块探针 · R8 | `R8-remediation/run-probes.mjs` | **12/12 PASS** | `evidence/gate/M-R8-remediation.log` |
| 六模块探针 · T6 | 从**临时目录**跑 `T6-wiring-b4b8/run-probes.mjs` | **21/21 PASS**（四态 cwd 一致） | `evidence/gate/M-T6-wiring-b4b8-from-tmpdir.log` |
| io-audit p01-p06 | `io-audit/run-probes.mjs` | **6/6 PASS（EXIT=0）** | `evidence/gate/M-io-audit-p01p06.log` |
| io-audit p07/p08 | `io-audit/run-p07p08.mjs` | **2/2 PASS** | `evidence/gate/M-io-audit-p07p08.log` |
| B0 翻默认等价 | `T4-wiring-b0b3/b0-diff.mjs` | **9/9 passed** | `evidence/gate/M-b0-diff.log` |
| ① 前后对照 | `T8-hardening/r5a-p16-before-after.mjs 20` | **BEFORE 65% 失败 → AFTER 0%** | `evidence/`（见 §1.3） |
| ④ 异构模拟自测 | `T8-hardening/b0-diff-heterogeneous.mjs` | **26/26 PASS** | `evidence/b0-diff-heterogeneous.log` |

加固前后 b0-diff 对照：`before-b0-diff.log`（8/9，G1 FAIL）→ `after-b0-diff.log`（9/9）。
加固前后 io-audit 对照：`before-io-audit-p01p06.log`（5/6，p02 FAIL）→ `after-io-audit-p01p06.log`（6/6）。

---

## 10. 取证物清单

```
test-reports/rebuild-20260920/T8-hardening/
├─ RESULTS.md                          ← 本文件
├─ r5a-p16-before-after.mjs            ① 前后对照复现器（BEFORE/AFTER 各 20 次）
├─ b0-diff-heterogeneous.mjs           ④ 异构构建模拟自测（G2/G3 × M1-M7 + N1-N4）
├─ quarantine-workbuddy-memory-2026-09-20.md   ⑥ 删除前的 .workbuddy 内容转存
└─ evidence/
   ├─ r5a-10x/run-{1..10}.log          ① 修后 10 连跑 16/16 + history.jsonl（20 条连续全绿）
   ├─ before-io-audit-p01p06.log / after-io-audit-p01p06.log   ② 前后对照（5/6 → 6/6）
   ├─ before-io-audit-p07p08.log / after-io-audit-p07p08.log   ② p07/p08 前后（2/2 → 2/2）
   ├─ before-b0-diff.log / after-b0-diff.log                   ④ 前后对照（8/9 → 9/9）
   ├─ b0-diff-heterogeneous.log        ④ 26/26 全量输出
   └─ gate/{G1-regression-all,G2-validate-structure,G3-R10-fixtures,
            M-R3-activation-receipt,M-R4-phase,M-R5a-journey,M-R7-change,
            M-R8-remediation,M-T6-wiring-b4b8-from-tmpdir,
            M-io-audit-p01p06,M-io-audit-p07p08,M-b0-diff}.log
```

改动文件指纹（sha256 前 16 位 / mtime）：

```
021e31bd913707a9  2026-09-21 00:56:21  contracts/discrepancies/cr-20260920T112945Z-a6244b0c.json（仅追加）
31c8307bd0aead9a  2026-09-21 00:39:49  test-reports/rebuild-20260920/R5a-journey/run-probes.mjs
d6b5eb7fa3a0c5ff  2026-09-21 00:38:44  test-reports/rebuild-20260920/R5a-journey/probes/_helper.mjs（新）
8c87d109263f073d  2026-09-21 00:39:12  test-reports/rebuild-20260920/R5a-journey/probes/p15-evidence-links-shape.mjs
cbedee87cdca825d  2026-09-21 00:38:59  test-reports/rebuild-20260920/R5a-journey/probes/p16-namespace-consistency.mjs
b32593479111fb03  2026-09-21 00:47:48  test-reports/rebuild-20260920/io-audit/probes/p02-routing-consumption.mjs
10f66055c334bce1  2026-09-21 00:48:42  test-reports/rebuild-20260920/T6-wiring-b4b8/run-probes.mjs
b56096b38ceecf5d  2026-09-21 00:54:28  test-reports/rebuild-20260920/T4-wiring-b0b3/b0-diff.mjs
```

---

## 11. 交 Owner 的决策项（本批不做）

1. **D-2**：白名单外 4 处 cwd 依赖（`acceptance-20260920/T7`、`T1T2` 盲测探针；`R6-migration-20260917` 三件）是否另派一批统一？（`acceptance-20260920/*` 属编排者自有探针，建议不改。）
2. **D-3**：io-audit 是否把 p07/p08 并入 `run-probes.mjs`（单命令 8/8），还是维持双 runner？
3. **D-1 同类排查**：本批暴露"环境噪声正则写得过窄 = 时间巧合"这一类脆弱性在 b0-diff 还有 2 处
   （`tt-ci-plan-review-\d+-\d+`、`yy-t7[a-z0-9]*-g\d+-[A-Za-z0-9]+`）——它们依赖具体前缀/命名约定，
   建议下批统一改为"形态级"（如 `tt-ci-plan-review-<rand>`、任意 tmp 下沙箱名），或接受现状。
4. **P1-2 后续**：`S1S3-CRASH-CLEAN-CAPTURE` 本机构建下恒 0（两侧都有栈）。若 Owner 期望"CI 错误路径统一为干净捕获"
   （即改 `scripts/ci.mjs` 的 `stdio: inherit` → 捕获后打印），那是**产品行为变更**，需另派单 + 新 change record。
