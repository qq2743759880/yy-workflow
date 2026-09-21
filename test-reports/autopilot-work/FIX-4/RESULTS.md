# FIX-4 执行结果 — --validate-handoff 冒号列表加固（写面区 C）

> 派单：`handoffs/fix/FIX-4-dispatch.md`。工作区：`D:\.ai-hub\skills\yy`（Windows，Node v24.18.0，零 npm 依赖）。
> 基线：git tag `auto-fe-base`（`scripts/summary-read.mjs` @ `c2a7f1c80d05ed1b`，与 HEAD 同哈希——即本任务开工时该文件无未收口改动）。
> **未自称 DONE；未做任何 git 操作（无 commit / 无 checkout / 无 reset / 无 push）。**

## 0. 交付清单（sha256 前 16 位）

| 文件 | 状态 | sha256（前 16 位） |
|---|---|---|
| `scripts/summary-read.mjs` | 修改（+18/−5 行） | `4755764d8e125f8a` |
| `test-reports/autopilot-work/FIX-4/run-probes.mjs` | 新增（自测探针，9 探针） | `7d0b48636dcd568c` |
| `test-reports/autopilot-work/FIX-4/out-probe-results.json` | 新增（机读结果） | `561cec57ea1d552f` |
| `test-reports/autopilot-work/FIX-4/RESULTS.md` | 新增（本文件） | （自引用不计） |
| `.sandbox/run-*` | 探针沙箱原样留证 | — |

基线参照：`auto-fe-base:scripts/summary-read.mjs` = `c2a7f1c80d05ed1b`。

**白名单遵守**：`git status --porcelain` 仅 `M scripts/summary-read.mjs` + `?? test-reports/autopilot-work/FIX-4/`。
**未触碰**：`commands/`、`scripts/tt-journey.mjs`（FIX-1 并行面）、`webview/`、`journey/`、`README.md`（FE-4 并行面）、
`contracts/`、队列/看板（plans/）；未读 `test-reports/acceptance-*/`；零 git 写操作。

## 1. 修法说明

### 1.1 缺陷根因（两条，均在 `parseHandoffReport`）

**根因 A（派单点名的冒号列表误判）**：原解析对**任意** ASCII 键样行建字段并切换收集区。
正文冒号行（brief 骨架自带的 `- 说明: xxx`，或报告自由正文 `foo: bar`）一旦出现在必填键行之后，
就把 `collecting` 抢到白名单外键名上；随后真正的必填键行若与已有字段重名还会走「重复键追加」分支，
`说明:` 更会把收集区占位成白名单外字段。三必填判定路径被正文内容劫持——同一份报告的 PASS/FAIL
取决于正文措辞，违背「三必填齐→PASS、缺→FAIL」的确定性语义。

**根因 B（自测中新发现，同函数）**：多行收集对收集区内**任意非空行**盲目并入字段值。
`evidencePaths:` 空值开列表后，`## 标题` 行、正文句、后续冒号行全被并进 `evidencePaths` 值
（P4 基线实测：evidencePaths 被污染为 `"…,## 本子任务,说明: <占位…>,## 必读,…"）。
更隐蔽的是 ASCII 冒号行插在 `evidencePaths:` 与列表之间时（P9 夹具），基线把该行当 key
抢走收集 → evidencePaths 停留空值 → **一份字段齐全的合法报告被误 FAIL(1)**。
这正是派单「可能误判为 key」的完整危害面：不仅脏值，还会翻转判定结果。

### 1.2 修法（选派单许可的「字段白名单前缀」路线 + 收集区收紧，两处改动、+18/−5 行）

1. **键行白名单化**（修 A + P3）：键行匹配后先查 `HANDOFF_REQUIRED_FIELDS.includes(m[1])`，
   白名单外一律 `continue`——不建字段、不改 `collecting`、不进值。副作用：判定天然区分大小写
   （`taskid:` 不是 `taskId`，FAIL 不猜不纠正，符合 T9「缺字段不猜」纪律）。
2. **多行收集严格限列表项**（修 B + P9）：收集区内非空行必须匹配 `/^\s*(?:[-*]\s+)/`（列表项）才并入；
   空行维持原「不打断」语义；其余行（标题/正文/冒号行）**打断收集且绝不并入**。

### 1.3 行为语义零变化论证（派单硬约束）

- **三必填齐→PASS / 缺→FAIL(1) / 目录缺失→FAIL(1)**：`validateHandoffReport` / `runValidateHandoff`
  零改动（missing/empty/fatal 三通道原样）；白名单恰好等于三必填名集合，判定的输入域被收窄为
  「三字段是否存在且非空」，与加固前在合法输入上的行为逐夹具对齐（见 §2 基线对照表）。
- **既有模式回归**：`--validate-handoff` 分支仍在 `main` 最早返回；`--help` / 空 workspace / 列表 /
  `--latest` / 缺参回退 usage 的代码路径零触碰（P7 实测 exit 与输出形态不变）。
- **宽容语义保留**：白名单内重复键行追加（`,` 连接）仍按原样工作——executor-setup 骨架把三字段
  写成 `- taskId: xxx` 列表形式（P4 实测通过），不会因白名单过滤而误伤骨架回填。

## 2. 自测输出原样

### 2.1 探针汇总（`node test-reports/autopilot-work/FIX-4/run-probes.mjs`，9/9 PASS，exit 0）

```
[PASS] P1 正向：正文含「说明:/落点:」冒号列表 → PASS(0) 且三字段值不被污染  · exit=0
[PASS] P2 负向：正文含 foo: bar 但缺三必填 → FAIL(1) 且三条缺字段全列  · exit=1
[PASS] P3 负向：taskid 小写误拼 → FAIL(1) 缺 taskId（不猜不纠正）  · exit=1
[PASS] P4 回归：executor-setup 骨架同构（占位冒号列表密集）→ PASS(0) 值不污染  · exit=0
[PASS] P5 回归：目录缺失 / REPORT.md 缺失 → FAIL(1) 不猜  · missing-dir=1 no-report=1
[PASS] P6 回归：evidencePaths 空值 + "- 列表" 收集 → PASS(0) 列表项并入值、后续冒号行不入  · exit=0
[PASS] P7 回归：--help(0) / 空 workspace 列表(0) / --latest 空(1) 行为不变  · help=0 list=0 latest=1
[PASS] P8 负向：evidencePaths 存在但值为空 → FAIL(1)「字段存在但值为空」  · exit=1
[PASS] P9 加固核心：ASCII 冒号行插在 evidencePaths 与列表之间 → PASS(0) 列表完整收集  · exit=0

== 汇总: 9/9 PASS ==
```

### 2.2 派单点名用例的命令级原样输出

正向（正文含 `- 说明: 执行 FIX-4 加固并自测` 冒号列表 + 三必填）→ **PASS(0)**：

```
PASS 回填报告校验通过: D:\.ai-hub\skills\yy\test-reports\autopilot-work\FIX-4\.sandbox\run-20260921231429-37172\p01-good\REPORT.md
{
  "taskId": "T-01",
  "taskVerdict": "PASS",
  "evidencePaths": "test-reports/autopilot-work/FIX-4/RESULTS.md,scripts/summary-read.mjs"
}
```

负向 1（正文 `foo: bar` / `another: value` 但缺三必填）→ **FAIL(1)**：

```
FAIL 回填报告校验未通过: …\p02-missing\REPORT.md
  缺字段: taskId
  缺字段: taskVerdict
  缺字段: evidencePaths
  缺字段不猜——请按 executor-setup 交接 schema 补齐 taskId/taskVerdict/evidencePaths 后重跑。
```

负向 2（`taskid: T-01` 小写误拼 + taskVerdict/evidencePaths 齐）→ **FAIL(1)**：

```
FAIL 回填报告校验未通过: …\p03-wrongcase\REPORT.md
  缺字段: taskId
  缺字段不猜——请按 executor-setup 交接 schema 补齐 taskId/taskVerdict/evidencePaths 后重跑。
```

### 2.3 与基线（auto-fe-base 版脚本）的逐夹具对照——证明「语义零变化」边界

用 `git show auto-fe-base:scripts/summary-read.mjs` 提取基线脚本，对同一批夹具重放：

| 夹具 | 基线 exit | 加固后 exit | 判定语义 | 值污染 |
|---|---|---|---|---|
| p01-good（冒号列表正文 + 三必填） | 0 | 0 | 不变（PASS） | 基线此夹具未污染 |
| p02-missing（foo: bar 缺三必填） | 1 | 1 | 不变（FAIL） | — |
| p03-wrongcase（taskid 小写） | 1 | 1 | 不变（FAIL，基线即区分大小写） | — |
| p04-skeleton（骨架同构） | 0 | 0 | 不变（PASS） | **基线 evidencePaths 被污染**（并入 `## 本子任务`/`说明: <占位…>`/`状态: 未开始` 等 10 段），加固后干净 |
| p06-evidence-list（空值+列表+尾随冒号行） | 0 | 0 | 不变（PASS） | **基线并入 `备注: 正文冒号行在列表之后`**，加固后干净 |
| p08-empty-evidence（evidencePaths 空值） | 0 | **1** | **基线误 PASS → 加固后正确 FAIL** | 基线把 `说明: 证据忘了填` 错并进 evidencePaths 掩盖了空值；加固后按 T9 原语义「字段存在但值为空」FAIL |
| p09-note-between（ASCII 冒号行隔断列表） | 1 | **0** | **基线误 FAIL → 加固后正确 PASS** | 基线 evidencePaths 空值误 FAIL，加固后完整收集 `a.log,b.log` |

结论：基线在「三必填齐→PASS、缺→FAIL(1)、目录缺失→FAIL(1)」上本就有两处被正文冒号行**翻转判定**的
反例（p08/p09）——这正是派单要修的缺陷本体。加固后所有夹具的 PASS/FAIL 只由三必填决定，与正文内容解耦。

### 2.4 既有模式回归原样（P7 + 缺参回退）

```
node scripts/summary-read.mjs --help                → exit 0，5 行 usage（含 --validate-handoff 行）
node scripts/summary-read.mjs --workspace <空目录>   → exit 0，stdout「无 state-summary.json（workspace=…）」
node scripts/summary-read.mjs --workspace <空目录> --latest → exit 1，stderr「无 state-summary.json（…）——先跑 orchestrator…」
node scripts/summary-read.mjs --validate-handoff（缺参）     → exit 0，回退 usage（与 --workspace 缺参同态，未改动）
node scripts/summary-read.mjs --validate-handoff <不存在目录> → exit 1，「FAIL REPORT.md 不可读: …（ENOENT）（缺字段不猜：…）」
```

## 3. D-xxx 偏差

### D-FIX4-1（P2，判定翻转修复超出派单字面范围，需 L2 复核确认口径）

派单文字聚焦「误判为 key」，未点名多行收集的盲目并入（根因 B）。本任务把收集区收紧为「仅列表项可并入」，
由此产生两处**行为变化**（相对基线）：p08 类报告从基线误 PASS 变为 FAIL(1)、p09 类从基线误 FAIL 变为 PASS(0)。
本任务认定两者都是把行为**收敛回 T9 承诺的确定语义**（齐→PASS/缺→FAIL），而非语义变更；
但严格说「加固后 ≠ 基线在全部输入上的逐字节行为」，故按偏差如实列出，请 L2 裁定 p08 方向
（FAIL 更严）是否可接受。p09 方向（不再误杀合法报告）应无争议。

### D-FIX4-2（P3，大小写严格性在骨架字段名场景下的边界）

白名单 `includes` 是区分大小写匹配。基线对 `TaskId:`/`TASKID:` 同样不识别为必填（判定等价），
但基线会将其登记为白名单外字段并抢占收集区；加固后这类行被彻底忽略。若未来 schema 引入大小写
变体字段名（现 schema tt/handoff-brief@1 无此设计），需显式扩白名单，不会静默兼容。

### D-FIX4-3（P3，全角冒号与中文键的行为澄清，非缺陷）

`HANDOFF_KEY_RE` 只匹配 ASCII 首字符键（`[A-Za-z][A-Za-z0-9_-]*`），中文键样行（如 `状态：未开始`）
在任何版本都不建字段——加固前后一致。但**中文键 + 半角冒号**（`状态: 未开始`）会匹配键行正则，
基线将其登记并可能劫持收集；加固后一律忽略。此差异已并入根因 A 修复，无单独风险；
列出仅为说明「冒号行」的完整覆盖面（半/全角冒号 × ASCII/中文键四象限均验证或推演过）。

### D-FIX4-4（P3，自测探针首跑暴露的探针自身路径 bug，非被测脚本缺陷）

`run-probes.mjs` 首版 REPO 解析多写一级（`'..','..','..','..'`），导致首跑 0/8 全 FAIL
（子进程 spawn 到不存在的 `D:\.ai-hub\skills\scripts\summary-read.mjs`）。修正为三级后 9/9 PASS。
被测脚本全程无此问题（同期间直接 CLI 调用行为正确）。留痕于此防误读首跑记录；
`.sandbox/` 只保留修正后各轮沙箱，首跑无独立留证（其 FAIL 全部由路径不存在引起，夹具未参与）。

## 4. 请 L2 重点复核

1. D-FIX4-1 的两处判定翻转方向是否符合「语义零变化」的裁定口径（本任务立场：是——修复的是基线对
   承诺语义的两处背离）。
2. p08 方向（evidencePaths 有键无值且无列表 → FAIL(1)）是 T9 原语义的恢复而非新增强制。
3. `git status` 仅 `M scripts/summary-read.mjs` + `?? test-reports/autopilot-work/FIX-4/`，
   与并行批（FIX-1 / FE-4）写入面零交叠。
