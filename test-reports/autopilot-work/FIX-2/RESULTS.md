# FIX-2 执行结果 — executor.json↔orchestrator 接线（写面区 B）

> 派单：`handoffs/fix/FIX-2-dispatch.md`。工作区：`D:\.ai-hub\skills\yy`（Windows，Node v24.18.0）。
> 基线：git tag `auto-fe-base`（`scripts/orchestrator.mjs` @ `5535cce84ed6419e`、`scripts/executor-setup.mjs` @ `eea8c5c9283a0e71`，开工时与 HEAD 同哈希——两文件均无未收口改动）。
> **未自称 DONE；未做任何 git 写操作（无 commit / 无 checkout / 无 reset / 无 push；仅 `git show`/`git status`/`git diff` 只读）。**

## 0. 交付清单（sha256 前 16 位）

| 文件 | 状态 | sha256（前 16 位） |
|---|---|---|
| `scripts/orchestrator.mjs` | 修改（+83/−4 行：读 executor.json 映射缺省） | `141427ff8702e541` |
| `scripts/executor-setup.mjs` | 修改（+10/−0 行：仅追加导出） | `8e78b9e0c6d47e6e` |
| `test-reports/autopilot-work/FIX-2/run-probes.mjs` | 新增（自测探针，12 探针） | `6571a2cc9ed7b4d6` |
| `test-reports/autopilot-work/FIX-2/out-probe-final-run.txt` | 新增（终轮探针原样输出） | `51e0270a58a12280` |
| `test-reports/autopilot-work/FIX-2/out-probe-results.json` | 新增（机读结果） | `3822aa283cd8f57a` |
| `test-reports/autopilot-work/FIX-2/out-p4-stdout-{baseline,current}.txt` | 新增（P4 零回归 diff 原样留证） | `bbf068b1e7506ba6` / `78426589f780d1a7` |
| `test-reports/autopilot-work/FIX-2/out-regression-{before,after}.txt` | 新增（regression 前后原样输出；sha16 同为 `96ac6fd8c820250e` → 逐字节一致） | `96ac6fd8c820250e` ×2 |
| `test-reports/autopilot-work/FIX-2/out-validate-{before,after}.txt` | 新增（validate 前后原样输出；sha16 同为 `2f1da5f8e4d54097` → 逐字节一致） | `2f1da5f8e4d54097` ×2 |
| `test-reports/autopilot-work/FIX-2/baseline/*` | 编辑前基线副本（5 件，pre-edit 实测快照） | 见 baseline/ |
| `test-reports/autopilot-work/FIX-2/RESULTS.md` | 新增（本文件） | （自引用不计） |

基线参照（编辑前实测，sha256 前 16 位）：`orchestrator.pre.mjs`=`5535cce84ed6419e`（= `git show auto-fe-base` 同哈希）、`executor-setup.pre.mjs`=`eea8c5c9283a0e71`。

**白名单遵守**：`git status --porcelain` = `M scripts/orchestrator.mjs` + `M scripts/executor-setup.mjs` + `?? test-reports/autopilot-work/FIX-2/`，与并行面（FIX-4 的 summary-read.mjs 已收口）零交叠。
**未触碰**：`commands/`、`SKILL.md`、`webview/`、`tt-journey`、`summary-read`（并行面）、`contracts/`、`README.md`、队列/看板（plans/）；未读 `test-reports/acceptance-*/`；零 git 写操作。

## 1. 修法说明

### 1.1 缺陷根因（派单背景）

T9 交付的 `executor-setup.mjs` 写 `<ws>/.tt-state/executor.json`（schema `tt/executor-config@1`，含 cli/model/isolate 字段），但 orchestrator 只读 `config.json` 的 `executor.command/hosts`（原 `scripts/orchestrator.mjs:511-514`）——向导输出从未被消费（编排者过度推论闭环）。

### 1.2 修法（两文件，优先级：显式命令行 > executor.json > config.json > 无）

**A. `scripts/orchestrator.mjs`（+83/−4）**：
1. 新增 `readExecutorDefaults(workspace)`：读 `<workspace>/.tt-state/executor.json`，解析 cli/model/isolate/mode。
2. `main()` 在 config.json 缺省逻辑之前接线（workspace 先按原逻辑解析——executor.json 是 workspace 级配置，须按最终 workspace 读取）：
   - `--exec` 缺省槽：`!opts.exec && ex.exec` → executor.json > config.json（显式命令行天然胜出）；
   - `--hosts` 缺省槽：`ex.exec && !opts.hosts` → 注入 `opts.configHosts`（数组形态，与 config.json executor.hosts 同层；显式 `--hosts` 不注入）；同一命令与主宿主在 `resolveHosts`/`retryAcrossHosts` 按 commandKey 去重，主宿主成功时备选链零额外行为；
   - 登记面：`opts.executorDefaults = {cli, model, isolate, mode, corrupt, source}`（透传登记，不改 spawn 行为）。
3. **约束 1（presence≠可用）**：cli 只映射命令名（`resolveCommandShim` 解析 Windows .cmd shim，与 exec-host/adapter 同一入口），不做可用性推断、不自动跑 roundtrip。映射形态 `[command, ...prefix]`（resolveCommandShim 语义 `spawn(command, prefix.concat(argv))` 与编排器 `--exec` 契约「exec[0]=程序名、其余固定前缀」对齐，不能倒置——首跑曾倒置为 `[prefix..., command]`，spawn `/d` ENOENT，P5 探针抓出后修正，见 D-FIX2-3）。
4. **约束 2（未知 cli fail-soft）**：cli 不在已知清单 → warning + 跳过映射，不崩溃不推断。
5. **约束 3（isolate 只透传）**：isolate 非 null → warning「隔离未实施」+ 仅落 `executorDefaults.isolate`，spawn 行为不变。
6. 附加 fail-soft：JSON 损坏 → warning「不可解析」不猜内容；mode=A-direct（编排者直执行）/C-handoff（手动交接）→ 不映射（向导选 A/C 的用户无宿主语义，映射反而改变行为）；mode=B-cli 但 cli 缺失 → 不映射不猜。

**B. `scripts/executor-setup.mjs`（+10/−0，纯追加）**：按派单白名单「如需补 schema 导出」追加 `export { EXECUTOR_SCHEMA }` + `export const KNOWN_CLIS = TARGETS.slice()`；orchestrator 以动态 `import('./executor-setup.mjs')` 引用（catch 回落内联清单，防向导文件损坏阻断编排器）。向导既有行为零改动（`--probe presence` 实测输出不变）。

### 1.3 老 config.json 路径零回归论证（派单约束 4）

- executor.json 缺失时 `readExecutorDefaults` 返回 `{exists:false}`，映射块全部短路——config.json 三行缺省逻辑（command/timeoutMs/hosts）原样保留、顺序不变；
- P4 归一化 diff：同一 task（`--backend prompt`，无 executor.json）在基线版（`git show auto-fe-base:scripts/orchestrator.mjs` 提取）与当前版各跑一次，workspace 11 个文件（state/contracts/artifacts/journey/assets-cache）键名与内容归一化后**逐字节相等**，stdout 归一化 diff 零差异，exit 0=0（原样留证 `out-p4-stdout-{baseline,current}.txt`）；
- regression-all 前后输出 sha16 相同（`96ac6fd8c820250e`）、validate-structure 前后输出 sha16 相同（`2f1da5f8e4d54097`）——既有门禁逐字节零漂移。

## 2. 自测输出原样

### 2.1 探针汇总（`node test-reports/autopilot-work/FIX-2/run-probes.mjs`，12/12 PASS，exit 0；终轮原样 `out-probe-final-run.txt`）

```
[PASS] P1 executor.json cli=claude → --plan --dry-run 派单缺省含 claude 命令形态  · exit=6 映射日志=有（宿主拆解诚实中止，映射即证据，不真调 CLI）
[PASS] P2 显式 --exec 覆盖 executor.json（exec=1，无映射日志）  · exit=0 modes.exec>0=true 显式优先
[PASS] P3 cli=unknown-cli → warning + 不崩溃（fail-soft）  · exit=0 warning=有 未映射=true
[PASS] P4 无 executor.json → 基线归一化 diff 零差异（含 stdout 归一 diff）  · exit 0=0，11 文件逐字节归一相等
[PASS] P5 executor.json cli=opencode（清单内）→ 缺省 --exec 真实派单 exec>0  · exit=0 modes.exec=1 映射日志=有
[PASS] P6 executor.json mode=A-direct → 不映射（向导 A/C 模式无宿主命令语义）  · exit=0 未映射=true 无 exec 模式=true
[PASS] P7 corrupt executor.json → warning + 不崩溃 + 不映射  · exit=0 warning=有
[PASS] P8 isolate=sandbox → warning「隔离未实施」+ spawn 行为不变（exec>0）  · exit=0 warning=有 exec=1
[PASS] P9 显式 --hosts 胜过 executor.json 注入  · exit=0 未注入=true
[PASS] P10 既有验证路径回归（互斥/非法值 → exit 2）  · resume+dry-run=2 backend=bogus=2
[PASS] P11 executor.json mode=C-handoff → 不映射  · exit=0
[PASS] P12 mode=B-cli 但 cli 缺失 → 不映射不崩溃（缺字段不猜）  · exit=0

== 汇总: 12/12 PASS ==
```

### 2.2 派单点名用例对应探针

| 派单自测项 | 探针 | 结果 |
|---|---|---|
| executor.json 存在且 cli=claude → `--plan --dry-run` 派单缺省含 claude 命令形态 | P1 | PASS（映射日志含 `claude`；宿主拆解尝试真实调用后诚实中止 exit 6 = 派单缺省生效的诚实证据；探针不烧配额，presence≠可用） |
| 显式 --exec 覆盖 executor.json（优先级实测） | P2 | PASS（exec=1 走显式宿主，无映射日志） |
| cli=unknown-cli → warning + 不崩溃 | P3 | PASS |
| 无 executor.json → 与现状逐字节一致（归一化 diff） | P4 | PASS（11 文件 + stdout 归一相等） |
| regression 12/12 + validate 0 | §2.3 | PASS |

### 2.3 门禁（改动后实跑）

```
node scripts/validate-structure.mjs   → exit 0（输出与改动前 sha16 同：2f1da5f8e4d54097，逐字节一致）
node scripts/regression-all.mjs       → exit 0，12 PASS / 0 FAIL（输出与改动前 sha16 同：96ac6fd8c820250e，逐字节一致）
node scripts/ci.mjs                   → exit 0，CI PASS
```

## 3. D-xxx 偏差

### D-FIX2-1（--hosts 缺省注入通道，超出派单字面最小范围，请 L2 确认口径）

派单只点名「cli/模型偏好映射为 `--exec`/`--hosts` 缺省」。本任务把 --hosts 缺省实现为：executor.json 的 cli 命令形态注入 `opts.configHosts`（与主宿主同命令，commandKey 相同）。设计依据：派单明确要求 --hosts 缺省槽存在，而 executor.json 只有一个 cli 字段，缺省链里唯一可注入的就是该命令自身（同键去重保证主宿主成功时零额外行为；主宿主失败时按同命令重试一次后仍走诚实降级）。风险面：P1 失败自动恢复链在「主宿主失败且 hosts 只含同键项」时多一次同命令重试（entryKey 去重在 retryAcrossHosts 内生效——primary 与 hosts 同键时 hosts 项被剔除，实际**不会**多试，已核对 `retryAcrossHosts` 的 entryKey 剔除逻辑）。请 L2 复核该口径是否符合「--hosts 缺省」的预期语义。

### D-FIX2-2（mode=A-direct/C-handoff 不映射，属派单未点名的解释性决定）

executor.json 的 mode 字段有三种值（B-cli/A-direct/C-handoff）。派单只说「cli/模型偏好映射为缺省」，未点名 mode 判定。本任务决定：仅 mode=B-cli（或 schema 旧数据无 mode 字段但 cli 存在）才映射；A-direct（编排者直执行，违反 C-01 仅限非验收任务）/C-handoff（手动交接）不映射——这两类用户没有宿主可派，映射了反而把「编排者直执行」的意图改写为「派宿主」。P6/P11 探针覆盖。若 L2 认为 A-direct 也应映射 cli 字段（该模式下 cli=null，实际不可映射），需明确。

### D-FIX2-3（自测首跑暴露的实现 bug，已被探针抓出并修复，非被测脚本遗留缺陷）

首版映射把 resolveCommandShim 结果倒置为 `[prefix..., command]`（`/d /c cmd.exe <shim>` 形态），`--exec[0]=/d` → spawn ENOENT，P5 端到端探针抓出（modes.exec=undefined）。修正为 `[command, ...prefix]`（与 exec-host-generic 的 `entry.command`/`entry.prefix` 用法同构）后 P5 PASS。另：探针自身的良性 shim 首版在 .cmd 内嵌 JS 使用字面反斜杠正则（`\s`），经 .cmd → cmd.exe → node -e 多层解析被吃成 `s`，正则静默失配（asset=?）——修正为 RegExp 构造器 + `String.fromCharCode(92)` 运行时拼接（文件内零字面反斜杠）。两处均在探针迭代中闭环，终轮 12/12 PASS；留痕防误读中间轮记录（中间轮沙箱已清理，只留终轮与 P4 原样输出）。

### D-FIX2-4（探针 P4 归一化口径，非被测脚本差异）

P4 的「逐字节一致」是**归一化后**一致：planId（时间戳 36 进制）、执行耗时 `(Nms)`、ISO 时间戳、绝对临时路径、assets-cache/manifest 的 signature/generatedAt（manifest.generatedAt 参与哈希，纯时间戳噪声）归一为占位符后逐字节相等。未归一字段（结构、字段序、语义值）零差异。若 L2 要求严格逐字节（含时间戳），该口径在运行环境下不可达（任何两次运行 planId/耗时必不同），请确认归一化口径可接受。

### D-FIX2-5（executor.json 语义位置：按最终 workspace 读取，非 SKILL_DIR）

executor.json 由向导写在 `<workspace>/.tt-state/`（workspace 级），而 config.json 固定读 SKILL_DIR。本任务接线时把 executor.json 读取放在 workspace 解析（含 cfg.projectRoot 回落）之后——同一 orchestrator 对不同 `--workspace` 可读到不同 executor.json。这是向导 schema 的自然语义（T9 就是按 workspace 写），与 config.json 的全局语义不同层，列出仅为说明两配置源的读取位置差异。

## 4. 请 L2 重点复核

1. D-FIX2-1 的 --hosts 缺省注入口径（同命令注入 configHosts、依赖 retryAcrossHosts 同键去重）是否符合预期。
2. D-FIX2-2 的 mode 判定边界（A-direct/C-handoff 不映射）是否成立。
3. D-FIX2-4 的归一化 diff 口径是否可接受为「行为与现状逐字节一致」的验收标准。
4. `git status` 仅 `M scripts/orchestrator.mjs` + `M scripts/executor-setup.mjs` + `?? test-reports/autopilot-work/FIX-2/`，与并行面（FIX-4 summary-read、FE 批）写入面零交叠。
