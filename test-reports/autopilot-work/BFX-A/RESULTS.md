# BFX-A RESULTS — tt-journey.mjs 动态修复槽（BFX-2 会话隔离 + BFX-4 首跑自动初始化）

- 执行槽: autopilot L1 BFX-A（独立上下文）
- 日期: 2026-09-22
- 状态: **代码修复与自测全部完成；最终 DONE 判定留给编排者 L2 复核**（本报告不自称 DONE）
- 白名单遵守: 仅改 `scripts/tt-journey.mjs` + 本证据目录 `test-reports/autopilot-work/BFX-A/`；未触碰 SKILL.md / commands / reference / contracts / webview / 其他 scripts；无 git 写操作；未跑 make-release。

## 1. 修复内容（正源 scripts/tt-journey.mjs）

修复后 sha256: `20a5d38a00577b1169e816c527adb8b9dbde9d389f2dca71bfa7ee24ce532100`

### BFX-2（P0 多分支会话隔离）
`main()` 的 `--update` 与 `--prereq-check` 两分支原先调用 `updateJourney({workspace,...})` / `readJourney(workspace)` 时不带 sessionId，导致多会话场景更新与检查全部落到共享 `.tt-state/journey.json`。修复：

- `--update` 分支：`const sid = arg('session')` → 传入 `updateJourney({ workspace, sessionId: sid, ... })`，回显路径 `journeyPath(workspace, sid)`。
- `--prereq-check` 分支：`const sid = arg('session')` → `readJourney(workspace, sid)`。
- `--session` 语义与既有 `--read`/`--project` 分支完全一致（`.tt-state/<sessionId>/journey.json`）；未引入新 CLI 参数；不带 `--session` 的行为零变化（仍写共享 `.tt-state/journey.json`）。

### BFX-4（P1 首跑 prereq-check 死锁 → 自动初始化）
原 `--prereq-check` 在 journey.json 不存在时直接 stderr「journey 未初始化」+ exit 1，与 SKILL 索引引导新手第一步即 prereq-check 形成死锁。修复（取派单指定修法：自动初始化）：

- 新增 `autoInitBaseline(workspace, sessionId)`：经 `withJourneyLock`（C2 并发纪律不降级）内二次确认文件仍不存在后，写入等价于 `--update --step 0` 的基线（step0=done、其余 8 节点 pending、gates/artifacts 空、plans 空、updated_at 刷新），落盘到 session 对应路径。
- 触发条件严格限定：**journey 文件不存在 且 请求的是 --prereq-check**；显式 `--update` 路径不经过此函数，行为零变化。
- AUTO-INIT 提示打一行到 **stdout**：`AUTO-INIT: journey 未初始化，已自动创建基线（等价 --update --step 0）→ <路径>`。
- exit 语义正确：AUTO-INIT 后 `ensureSteps` + `prereqCheck` 照常执行——step0 → `prereq OK` exit 0；更高 step 依赖未满足 → 照常 stderr 拦截 exit 1（P7 验证）。
- 幂等：文件一旦存在（含并发下他人先建）直接复用，不重写、不重复打 AUTO-INIT（P4 验证字节不变）。

### 实现的最终行为（供文档 agent 对齐 SKILL.md / reference）
- 首跑（工作区无 journey.json）直接跑 `--prereq-check --step <0-8>`：脚本自动创建基线（等价 `--update --step 0`），stdout 打一行 `AUTO-INIT: ...`，随后照常执行本次检查并按结果给 exit 0/1。新手不再死锁。
- `--session <id>` 现在在 `--read` / `--project` / `--update` / `--prereq-check` 四个分支全部生效，读写均定位 `.tt-state/<id>/journey.json`；缺省仍用共享 `.tt-state/journey.json`。
- 注意：默认渲染分支（无子命令）仍只读共享 journey.json（未接 --session，维持派单最小补丁范围，见 D-2）。

## 2. 自测证据（逐项）

探针脚本: `test-reports/autopilot-work/BFX-A/run-probes.mjs`（sha256 `0698380c9315f89d6a2d047ce42289838ddfbf1669117998f8a20ff0bfd1b137`），原文输出存 `out-probes-run.txt`，机器可读 `out-probe-results.json`。**8/8 PASS**：

```
[PASS] P1 会话隔离：--session a/b 各自 --update --step 0 落各自文件，共享 journey.json 不建  · exitA=0 exitB=0 a.step0=done b.step0=done 共享文件存在=false
[PASS] P2 不带 --session 的 --update 仍写共享 .tt-state/journey.json（零变化）  · exit=0 共享 step0=done
[PASS] P3 空工作区首跑 --prereq-check --step 0 → AUTO-INIT + 基线（等价 --update --step 0）+ exit 0 不死锁  · exit=0 AUTO-INIT=true 基线step0done=true
[PASS] P4 第二次 --prereq-check --step 0 幂等（无重复 AUTO-INIT，文件字节不变）  · exit=0 AUTO-INIT次数=0 字节不变=true
[PASS] P5 会话首跑：--session s1 --prereq-check --step 0 → 基线落 .tt-state/s1/journey.json，共享不建  · exit=0 AUTO-INIT=true s1.step0=done 共享存在=false
[PASS] P6 --session b --prereq-check --step 1 读 b 的 journey（step0 done → OK），a 文件不串写，共享不建  · exit=0 无AUTO-INIT=true a字节不变=true 共享存在=false
[PASS] P7 空工作区 --prereq-check --step 3 → AUTO-INIT 建基线后照常拦截（exit 1）  · exit=1 AUTO-INIT=true stderr拦截=true
[PASS] P8 --session b --update --step 1 --gate concept-signed → 写 b（前置链成立），a step1 仍 pending，共享不建  · exit=0 b.step1=done/concept-signed a.step1=pending 共享存在=false
```

对应派单自测项：
1. **会话隔离** → P1（a/b 独立、共享文件不再被写）+ P2（无 --session 向后兼容）+ P8（跨会话不串写、b 前置链走 b 自己的 step0）。
2. **首跑** → P3（自动初始化 + exit 0 不死锁）+ P4（二次幂等无副作用）+ P7（AUTO-INIT 后检查照常、exit 语义保留）。

## 3. 回归证据

- **regression-all: 13/13 PASS**（`out-regression-all-rerun.txt`，末行 `结果: 13 PASS / 0 FAIL / 回归基线通过。`）。其中 tt-journey 相关硬断言 H3b/H3c 与 junction 部署 smoke（tt-journey 经 junction 渲染）全 PASS。
- **validate-structure: 0 警告**（`out-validate-structure-final.txt`，末行 `[OK] 结构校验通过 (0 项警告, 见 --verbose)`，exit 0）。
- **FIX-2 探针: 12/12 PASS**（`out-fix2-probes.txt`，`== 汇总: 12/12 PASS ==`，exit 0）。
- **tt-journey 自身 self-test: 8/8 PASS**（`out-tt-journey-selftest.txt`，GWT1–GWT8 全 PASS，含 C1 防跳 / C2 并发锁负对照，修补未破坏既有语义）。

## 4. 偏差记录（D-xxx）

- **D-1 首轮 regression-all 11/13（瞬时，非本槽引入）**：首轮 `out-regression-all.txt` 曾报 `FAIL S1 validate-structure`（H6c: reference/dispatch-and-acceptance.md=2037tok 超限）与 `FAIL S7 review-gate`（self-test `URL_RE is not defined`）。取证：`scripts/review-gate.mjs` mtime 2026-09-22 20:42:35、`reference/dispatch-and-acceptance.md` mtime 20:42:49，均晚于本槽对 tt-journey.mjs 的编辑（20:40:20），且两文件都在本槽白名单之外（并行 lane 正在改）。二轮复跑 13/13 全绿（见第 3 节），确认为并行写入窗口的瞬态，与 BFX 修补无关。
- **D-2 默认渲染分支未接 --session**：无子命令的只读渲染仍只读共享 journey.json。派单坑单只点名 `--update`/`--prereq-check` 两分支，本槽按最小补丁执行未扩大范围；多会话下查看单会话进度可走已接线的 `--read --session`（journeyRead）。
- **D-3 既有杂音未清理**：`updateJourney` 内遗留 `console.log('[DEBUG] reached stageVerification block, ...')`（stdout 噪声，修补前即存在，GWT 基线同样出现）。不在两坑范围内，未动，留编排者决断是否另开槽清理。
- **D-4 AUTO-INIT 基线不含 plans 留痕**：基线「等价 --update --step 0」按字面实现（step0 done，plans 空）；`--update --step 0` 附带的 stageVerification 写 state-summary 副作用未复制（那是 update 命令面行为，非基线状态的一部分），prereq-check 保持只建状态不做副作用扩散。

## 5. 证据文件清单（本目录）

| 文件 | 内容 |
| --- | --- |
| `run-probes.mjs` | BFX-A 自测探针（8 探针，独立沙箱，退出码语义 0/1） |
| `out-probes-run.txt` | 探针 stdout 原文（8/8 PASS） |
| `out-probe-results.json` | 机器可读探针结果 + 修补后 sha256 |
| `out-regression-all.txt` | 首轮 regression-all（11/13，D-1 瞬态取证） |
| `out-regression-all-rerun.txt` | 二轮 regression-all（13/13 PASS） |
| `out-validate-structure.txt` | 首轮 validate-structure（H6c 瞬态取证） |
| `out-validate-structure-final.txt` | 二轮 validate-structure（0 警告，exit 0） |
| `out-fix2-probes.txt` | FIX-2 探针 12/12 PASS 原文 |
| `out-tt-journey-selftest.txt` | 修补后 tt-journey --self-test 8/8 PASS 原文 |
