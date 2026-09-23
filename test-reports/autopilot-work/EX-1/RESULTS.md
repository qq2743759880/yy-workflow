# EX-1 RESULTS — executor.json v2 能力握手 + 措辞纪律（批 0）

- 日期：2026-09-23
- 执行：autopilot 管线 L1 独立执行 agent（全新上下文）
- 派单：`handoffs/v3/EX-1-dispatch.md`；上下文：`plans/execution-plan-v3-20260923.md` §一 EX-1
- 状态：**交付完成，待 L2 编排者复核**（不自称 DONE）

---

## 1. 改动文件清单

| 文件 | 改动性质 | 内容 |
|---|---|---|
| `scripts/orchestrator.mjs` | 能力握手主面 | ① 启动时读 executor.json 的 `capabilities` 块（Agent Card 式自描述），进 `opts.executorDefaults.capabilities` 传给 runtime；② 缺失/损坏 → null（dispatch 按旧行为，不臆造能力）；JSON 可读但无 capabilities 键 → 回落 `DEFAULT_CAPABILITIES`；③ `DEFAULT_CAPABILITIES`/能力枚举从 executor-setup.mjs 单点 import（动态 import + try/catch 回落，与既有 `EXECUTOR_KNOWN_CLIS` 同款）；④ `--hosts from executor.json` 日志附 capabilities 登记 |
| `scripts/lib/runtime.mjs` | 能力门控执行面 | ① 新增导出 `getRequiredCapabilities(asset)`：子任务资产 → 所需能力（能力名固定枚举）；专用 CLI adapter 资产（implementation/dev-backend/be-implementer/sdlc/be-validator/portman）→ `['write_files','run_cmd']`，其余 → `['write_files']`；② `dispatch()` 在 `gate.before` 之后、真实执行之前插能力门控：缺能力 → 诚实降级（write_files 在场 → mode=prompt brief-only 兜底；write_files 也缺 → mode=skipped），`error=CAPABILITY_MISSING`、`missingCaps` 留痕于 subtask，绝不静默改用弱能力跑宿主；③ `executePlan` 收尾汇总：`能力门控：N 个子任务因执行器能力缺失降级（asset:缺cap, ...）——mode=prompt/skipped 诚实降级，不静默用弱能力` 进 plan.warnings + degraded |
| `scripts/executor-setup.mjs` | Agent Card 落盘面（最小触碰） | ① 新增 `CAPABILITY_ENUM`（write_files/run_cmd/network/spawn_subagent/mcp_client，固定枚举冻结导出）、`DEFAULT_CAPABILITIES`（MCP 未探测 → false，不假报）、`EXECUTOR_VERSION='2.0.0'` 三导出；② `readExecutorConfig`：旧 schema 兼容（无 capabilities 块 → 补默认集 + detectedAt）；③ `saveExecutorConfig`：确保每份 executor.json 持久化 `capabilities` 五能力布尔 + `detectedAt`（ISO）+ schema/savedAt；④ B-cli 两处落盘（交互向导 + --non-interactive --save）带 `name:'executor'` + `version:'2.0.0'` → Agent Card 式 `{name, version, capabilities:{...}, detectedAt}` 完整在场 |
| `scripts/regression-all.mjs` | 措辞纪律（非白名单，见 D-EX1-1） | S3 输出措辞：`[adapter 已接线]` → `[能力探测验证: 专用 adapter 支持 write_files/run_cmd]`；`[adapter 未接线]` → `[无专用 adapter，prompt/auto 兜底]`；FAIL 汇总语 `未接线` → `缺专用 adapter` |
| `scripts/lib/adapters/index.mjs` | 措辞纪律（仅注释） | ① 注册表注释：adapter = "能力探测验证支持 write_files/run_cmd 的执行内核胶水"；② opencode adapter 降级声明：`opencode adapter 是回归渠道之一（非主路径唯一执行内核）：主路径 = prompt 后端 + --exec 宿主注入；专用 CLI adapter 仅在 presence 探测命中且能力握手通过时作为备选执行渠道`；③ resolveAdapter 注释同步（auto 模式措辞加能力探测前置） |
| `test-reports/autopilot-work/EX-1/` | 自测证据 | run-probes.mjs（8 探针）+ out-* 证据文件 + 本 RESULTS.md |

**白名单符合性**：orchestrator.mjs / executor-setup.mjs / adapters/index.mjs（仅注释）/ test-reports/autopilot-work/EX-1/ 之外，实改了 `scripts/regression-all.mjs` 一处（两行措辞常量）——该文件是"已接线"字面量在 scripts/ 面的唯一载体，不改则措辞清零物理不可能。登记 **D-EX1-1**（见 §6），请求 L2 追认白名单扩展（无行为语义变化，仅输出文案字符串）。

---

## 2. 能力门控自测（EX-1 探针 8/8 PASS）

`node test-reports/autopilot-work/EX-1/run-probes.mjs` → **8/8 PASS，exit 0**（全文见 `out-ex1-probes-final.txt`，机器可读见 `out-probe-results.json`）。

| 探针 | 断言 | 结果 |
|---|---|---|
| E1 | executor.json 带 capabilities → 启动读取不崩溃 + FIX-2 映射语义保持（`--exec from executor.json` 日志照旧） | PASS（exit=6 诚实中止路径，映射日志=有） |
| E2 | **缺 run_cmd 的执行器**（capabilities.run_cmd=false）+ 任务词 database module（T1 簇，requireExec=false 无前置干扰）→ 专用 CLI adapter 资产（implementation/be-validator/sdlc，需 run_cmd）全数 `error=CAPABILITY_MISSING`、mode=prompt（brief-only 兜底）、**不静默 exec**；仅需 write_files 的 be-architect/be-provider 正常 exec（按需精确命中，非全簇误伤）；stderr warning 留痕 + plan.warnings 汇总留痕 | PASS（cli资产=3 降级=3 warning=有 汇总留痕=有 无exec=true；state 证据见 out-e2-state.json / out-e2-stderr.txt） |
| E3 | 连 write_files 也缺（五能力全 false）→ mode=skipped（不假报 prompt 兜底可落盘），无任何 exec | PASS（skipped(CAPABILITY_MISSING)=1/8 首个资产即拦截，无 exec） |
| E4 | capabilities 全 true（Agent Card 完整块）→ exec 派单与基线一致（向后兼容，零误伤） | PASS（modes.exec=1，无 CAPABILITY_MISSING） |
| E5 | executor-setup --non-interactive --save → 落盘 Agent Card 式块：五能力布尔齐 + detectedAt=ISO + name=executor + version=2.0.0 | PASS（落盘样例见 out-e5-executor.json） |
| E6 | 措辞纪律：scripts/ 全目录 grep "已接线" → 0 命中 | PASS（零残留，见 §3） |
| E7 | opencode adapter 注释降为回归渠道之一（"回归渠道"措辞在场 + "非主路径/备选执行渠道"声明 + "能力探测验证"措辞） | PASS |
| E8 | 探测失败如实上报：corrupt executor.json → warning「不可解析」不崩溃不映射，不假报已用外部内核 | PASS |

**门控语义要点**（实测确认）：
- 无 capabilities 信息（文件缺失/损坏）→ 门控不启用（null 检查），行为与 FIX-2 基线逐字节一致（P4 探针复跑佐证）——不臆造能力，向后兼容硬约束保住。
- 门控位置在 `gate.before` 之后、adapter 真实执行（含 retryAcrossHosts 宿主链）之前——降级发生在任何外部调用之前，不烧配额、不产生假产物。
- 降级三态诚实：write_files 有 → prompt（指令包兜底，同既有 brief-only 语义）；write_files 无 → skipped；两种均 `error=CAPABILITY_MISSING` + `missingCaps` 字段级留痕 + plan.warnings 汇总 + degraded 标记。

---

## 3. 措辞清零证明

```
$ grep -rn "已接线" scripts/     → 0 命中（exit 1，无输出）
```

全仓活动面扫描（排除 vendor/test-reports/plans/handoffs/history 等存档面）唯一命中：

- `docs/history/tasks/reports/T7-report.md:119` —— **2026-09-01 历史报告存档**，记录的是当日回归实测输出原文。历史事实记录不改写（改写=篡改历史证据）；且该文件在派单禁改清单（docs 面不属白名单）。

例外面完整清单（全部为存档/派单原文，不属"代码注释/日志"改写面）：
- `docs/history/`：1 处（上述 T7-report）
- `test-reports/**`：历史各期回归输出存档（BFX-A/BFX-C/FIX-2/FIX-3/LEAK-1/rebuild-20260920 等，均为当时的实测输出快照）
- `plans/workflow-v3-upgrade-plan-20260923.md`、`handoffs/v3/EX-1-dispatch.md`：方案/派单原文引用（描述该词本身）
- FIX-2 探针基线快照 `test-reports/autopilot-work/FIX-2/baseline/regression-all.baseline.mjs`：编辑前基线副本，属探针对照面，等同 test-reports 存档

证据：`out-e6-grep.txt`（三段式扫描结论 + 例外清单）。

**opencode adapter 降为回归渠道**：`scripts/lib/adapters/index.mjs` 注释面完成（E7 探针机验：`回归渠道` 措辞 + `非主路径/备选执行渠道` 声明 + `能力探测验证` 措辞三项全命中）。

---

## 4. 回归硬门（全部实跑，证据落 EX-1 目录）

| 门 | 命令 | 结果 | 证据 |
|---|---|---|---|
| FIX-2 探针 | `node test-reports/autopilot-work/FIX-2/run-probes.mjs` | **12/12 PASS，exit 0** | `out-fix2-probes-after.txt` |
| regression-all | `node scripts/regression-all.mjs` | **13 PASS / 0 FAIL，exit 0** | `out-regression-all-after.txt` |
| validate-structure | `node scripts/validate-structure.mjs` | **[OK] 0 项警告，exit 0** | `out-validate-after.txt` |

- FIX-2 P4（无 executor.json → 与 `auto-fe-base` 基线归一化 diff 零差异）在能力接线改动后复跑仍 PASS——非门控路径零行为变化得到逐字节级证明。
- FIX-2 P5 三断言（映射日志 / opencode.cmd shim 形态 / isolate warning）全绿——既有 `--exec/--hosts` 注入语义与 isolate 透传语义未被能力握手破坏。
- regression S3 输出新措辞（`[能力探测验证: 专用 adapter 支持 write_files/run_cmd]`）且 14 资产全 ✓——断言逻辑未动，仅文案。
- 新能力探测零非确定性：门控输入只有 executor.json 静态 JSON（无 modes.exec 类运行时行为断言，FIX-3 教训未重蹈）；EX-1 全部 8 探针均为确定性断言。

---

## 5. 与 ON-1 的写面冲突处置

- 读取 executor-setup.mjs 时发现 ON-1 已写入 `--configure` 六字段向导段，但存在一处**既有结构破损**（`main()` 函数体中段出现游离的 `if (opts.configure...)` 块 + 重复 `const opts` 声明，`node --check` 直接 SyntaxError）——系两单并行写面交叠所致（非本单引入）。本单修复方式：把游离块归位进 `main()` 头部（`opts` 声明与 help 分支之后、probe 分支之前），恢复 `export async function main` 完整结构。这是"最小触碰"语义内的接线修复（不改编向导任何行为），修后 executor-setup 语法通过且 `--probe presence` / `--non-interactive` / `--save` / `--help` 全部实测正常。
- 除上述归位外未触碰 ON-1 的 CONFIG_FIELDS/向导/落盘逻辑——无真实冲突需收窄约束，未动 D-偏差降级路径。

---

## 6. D-偏差登记

| id | 级别 | 内容 | 处置 |
|---|---|---|---|
| D-EX1-1 | 白名单扩展，请求 L2 追认 | 实改 `scripts/regression-all.mjs` 两行（S3 输出文案字符串）。理由：该文件是"已接线"在 scripts/ 面的唯一物理载体，不改则派单任务 B「grep 全仓已接线→0 命中」不可达成；改动仅文案字符串、零断言逻辑变化，regression 13/13 复跑全绿佐证 | 已完成改写并留证；请 L2 复核时追认白名单含此文件（或回退该 2 行并重新裁定措辞清零口径） |
| D-EX1-2 | 修复项，如实登记 | executor-setup.mjs `main()` 结构破损修复（游离 if 块 + 重复 const opts 归位，见 §5）。系 ON-1 并行写入的结构性事故，非本单变更引入；不修则本单落盘路径（E5）与全部既有探测均无法运行 | 已修复并实测；建议 L2 向 ON-1 侧同步该事实 |
| D-EX1-3 | 范围注记 | 派单白名单原文未列 `scripts/regression-all.mjs`，但 EX-1 派单自测第 2 条明确要求"grep 全仓『已接线』→0 命中"；两条约束物理互斥，按派单验收要点（措辞零残留是硬门）取舍 | 同 D-EX1-1，交 L2 裁定 |
| D-EX1-4 | 设计注记 | `getRequiredCapabilities` 资产→能力映射当前为静态保守声明（CLI adapter 资产 → write_files+run_cmd，其余 → write_files）；network/spawn_subagent/mcp_client 三能力已进枚举与 Agent Card 面（executor.json 可声明、orchestrator 可读取、缺 mcp_client 默认 false 不假报），但暂无资产映射到它们——待批 1 新资产（semgrep/skill-scanner/MCP 视觉验证）引入时按需扩展映射，枚举面已就绪 | 留存设计，映射扩展点在 runtime.mjs 单函数 |

---

## 7. 证据文件清单（本目录）

| 文件 | 内容 |
|---|---|
| `run-probes.mjs` | EX-1 自测探针（8 探针，exit 0=全过） |
| `out-ex1-probes-final.txt` | EX-1 探针最终实跑输出（8/8 PASS） |
| `out-probe-results.json` | EX-1 探针机器可读结果 |
| `out-fix2-probes-after.txt` | FIX-2 探针 12/12 复跑输出（改动后） |
| `out-regression-all-after.txt` | regression-all 13 PASS / 0 FAIL 输出（改动后） |
| `out-validate-after.txt` | validate-structure [OK] 0 警告输出（改动后） |
| `out-e2-state.json` | E2 门控降级 state 证据（implementation/be-validator/sdlc CAPABILITY_MISSING，be-architect/be-provider 正常 exec） |
| `out-e2-stderr.txt` | E2 stderr 留痕（能力缺失 warning） |
| `out-e3-state.json` | E3 全能力缺失 → skipped 证据 |
| `out-e5-executor.json` | E5 Agent Card 式 executor.json 落盘样例 |
| `out-e6-grep.txt` | 措辞清零 grep 证据（含例外清单） |
| `RESULTS.md` | 本文件 |
