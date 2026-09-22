# HARD-1 自测证据 — junction-smoke 并入 regression-all（S13 SKIP 语义）

执行 agent：autopilot L1（独立上下文）。日期：2026-09-22。
白名单改动：`scripts/regression-all.mjs`、`test-reports/fix-20260921/junction-smoke.mjs`（复用化改造，派单明确允许）。

## 0. 前置事实核查

本机 junction 现状（动手前实测，未做任何删改）：

```
$ cmd //c "dir C:\Users\Administrator\.agents\skills"
2026/09/02  21:19    <JUNCTION>     planning [\??\D:\.ai-hub\skills\tt\vendor\planning]
2026/09/02  21:19    <JUNCTION>     security [\??\D:\.ai-hub\skills\tt\vendor\security]
2026/09/22  02:17    <JUNCTION>     taste-skill [D:\.ai-hub\skills\taste-skill]
2026/09/22  02:17    <JUNCTION>     ui-ux-pro-max [D:\.ai-hub\skills\ui-ux-pro-max]
2026/09/21  10:46    <JUNCTION>     yy [D:\.ai-hub\tmp\yy-release]
```

结论：`yy` junction **在场**，指向 `D:\.ai-hub\tmp\yy-release`（目标含 SKILL.md + scripts/，有效）；
smoke 依赖的 workspace `D:/.ai-hub/tmp/project-run-0921/workspace` 存在。
全流程**未真删用户 junction**，删后模拟一律用环境变量注入（见 D-03）。

## 1. 逐项自测结果

| # | 场景 | 命令 | 期望 | 实际 | 判定 |
|---|------|------|------|------|------|
| 1 | junction 在场（独立 smoke） | `node test-reports/fix-20260921/junction-smoke.mjs` | 4/4 PASS, exit 0 | 4/4 PASS, exit 0 | PASS |
| 2 | 假路径（独立 smoke） | `TT_JUNCTION_PROBE_PATH=D:/nonexistent-junction-probe/yy node .../junction-smoke.mjs` | SKIP, exit 0 | `[SKIP]` ×1, `TOTAL: 0/0 PASS (1 skip)`, exit 0 | PASS |
| 3 | 真实目录注入（独立 smoke） | `TT_JUNCTION_PROBE_PATH=D:/.ai-hub/skills/yy node .../junction-smoke.mjs` | SKIP, exit 0 | 同上 | PASS |
| 4 | 改前基线整套回归 | `node scripts/regression-all.mjs`（改 S13 前） | S1-S12 全绿 exit 0 | `12 PASS / 0 FAIL`，exit 0 | PASS |
| 5 | 改后整套回归（junction 在场） | `node scripts/regression-all.mjs` | S1-S13 全绿，S13 真实执行，exit 0 | `13 PASS / 0 FAIL`，S13 4/4 内部探针 PASS，exit 0 | PASS |
| 6 | 改后整套回归（模拟无 junction） | `TT_JUNCTION_PROBE_PATH=D:/nonexistent-junction-probe/yy node scripts/regression-all.mjs` | `12/12 + 1 skip`，exit 0 | `12 PASS / 0 FAIL / 1 SKIP`，exit 0 | PASS |
| 7 | 改后整套回归（真实目录模拟） | `TT_JUNCTION_PROBE_PATH=D:/.ai-hub/skills/yy node scripts/regression-all.mjs` | 同上 | 同上 | PASS |
| 8 | S1-S12 零回归比对 | 场景 4 vs 5/6/7 输出逐行比对 | S1-S12 各行输出一致 | 一致（含 S3 明细 14 行、S8 计数 exec=8） | PASS |

## 2. 命令输出原文

### 2.1 改前基线（S1-S12，改动前取证）

```
$ node scripts/regression-all.mjs   # S13 并入前
PASS S1 validate-structure
PASS S2 test-retry
PASS S3 Phase 2 替换清单  （3 个高杠杆目标现状契约完整）
PASS S4 契约工作流 smoke  contracts/<planId>.json 冻结 ✓ resume 复用 ✓ 篡改→exit4 ✓
PASS S5 宿主执行 smoke  stdout → exec ✓；写文件(无 stdout) → exec ✓；空输出 → prompt 降级 ✓
PASS S6 资产缓存 smoke  assets-cache.json 生成 ✓ 二次运行复用 ✓
PASS S7 review-gate  self-test ✓ 填好plan→PASS ✓ 模板未填→拦截 ✓
PASS S8 资产消费证据  exec=8 false(正)=0 false(负)=>1（kernel 资产仅锚点 → false，强化生效）
PASS S9 域声明机验  missing→DOMAIN_DECL_MISSING ✓ true→ok ✓ 旧数据→N/A ✓
PASS S10 token 量尺 gate（B0-②）  快照对比 PASS ✓
PASS S11 引用链机验（C-25/C-33）  悬空引用 0 / tab 损坏 0 ✓
PASS S12 kickoff 漂移门（C-26）  五簇资产双向一致 ✓

结果: 12 PASS / 0 FAIL
回归基线通过。
EXIT=0
```

### 2.2 场景 5：改后整套回归，junction 在场（真实执行）

```
$ node scripts/regression-all.mjs
PASS S1 validate-structure
...（S1-S12 与 2.1 逐行一致，略——全文见 2.4 比对说明）...
PASS S12 kickoff 漂移门（C-26）  五簇资产双向一致 ✓
[PASS] tt-journey 经 junction 渲染 145B
[PASS] executor-setup 经 junction presence 有输出 896B
[PASS] review-gate 经 junction 打印诊断 41B
[PASS] tt-tui 经 junction 打印诊断 159B
PASS S13 junction 部署形态 smoke  4/4 内部探针 PASS

结果: 13 PASS / 0 FAIL
回归基线通过。
EXIT=0
```

### 2.3 场景 6/7：模拟无 junction（环境变量注入，整套仍全绿 + 1 SKIP）

```
$ TT_JUNCTION_PROBE_PATH='D:/nonexistent-junction-probe/yy' node scripts/regression-all.mjs
PASS S1 validate-structure
...（S1-S12 与 2.1 逐行一致，略）...
PASS S12 kickoff 漂移门（C-26）  五簇资产双向一致 ✓
[SKIP] junction 安装形态存在 （真实目录安装或未安装——本探针只覆盖 junction 形态）
SKIP S13 junction 部署形态 smoke  （junction 缺失/真实目录安装——本探针只覆盖 junction 形态，不计 PASS/FAIL）

结果: 12 PASS / 0 FAIL / 1 SKIP
回归基线通过。
EXIT=0
```

（`TT_JUNCTION_PROBE_PATH='D:/.ai-hub/skills/yy'` 注入真实目录场景输出与上完全一致，EXIT=0。）

### 2.4 独立 smoke 两态

```
$ node test-reports/fix-20260921/junction-smoke.mjs
[PASS] tt-journey 经 junction 渲染 145B
[PASS] executor-setup 经 junction presence 有输出 896B
[PASS] review-gate 经 junction 打印诊断 41B
[PASS] tt-tui 经 junction 打印诊断 159B
TOTAL: 4/4 PASS (0 skip)
EXIT=0

$ TT_JUNCTION_PROBE_PATH='D:/nonexistent-junction-probe/yy' node test-reports/fix-20260921/junction-smoke.mjs
[SKIP] junction 安装形态存在 （真实目录安装或未安装——本探针只覆盖 junction 形态）
TOTAL: 0/0 PASS (1 skip)
EXIT=0
```

## 3. 实现说明（供 L2 复核）

- `junction-smoke.mjs` 复用化：导出 `runJunctionSmoke(opts) → { skipped, pass, fail, lines }`；
  保留 `node junction-smoke.mjs` 独立运行入口（`import.meta.url` 判定，输出格式与改前一致）。
- `regression-all.mjs`：新增 S13 段 + `skip` 计数；结果行扩展为 `X PASS / Y FAIL (Z SKIP)`（无 skip 时保持原格式）。
  S13 内部 4/4 探针 PASS 且无 FAIL 才计段 PASS；skipped 时打印显式 SKIP 行，不进 PASS/FAIL，不影响 exit 码。
- S13 真实执行时经 junction 路径调用 4 个 CLI 入口（tt-journey / executor-setup / review-gate / tt-tui），
  跑的是安装位 `D:\.ai-hub\tmp\yy-release` 下的发布副本，与开发仓代码隔离——这是探针本意。

## 4. D-偏差登记

- **D-01 探测算法修正**：原 `junction-smoke.mjs` 的 junction 判定是
  `realpathSync(INSTALLED) !== INSTALLED（字面量）`——Windows 下 realpath 返回反斜杠而字面量是正斜杠，
  导致**真实目录也会被误判为 junction**（旧逻辑恒真缺陷）。改为 `realpath(child) ≠ realpath(parent)/basename`
  （真实目录两者相等，junction/symlink 不等）。这是对 SKIP 语义正确性的必要修正，非语义放宽；
  本机 junction 在场场景下新旧判定结论相同（均判为 junction，见 2.2/2.4 输出一致）。
- **D-02 复用化幅度**：`junction-smoke.mjs` 除派单说的"小改"外，还做了 export 化 + isMain 守卫 +
  D-01 判定修正；独立运行时的输出格式与 exit 码语义与改前完全一致（对比 2.4 与编排者实测记录）。
- **D-03 模拟手段登记**：删后模拟**未真删用户 junction**。手段：环境变量
  `TT_JUNCTION_PROBE_PATH` 覆盖探测路径（`junction-smoke.mjs` 读取优先级：opts > env > 默认值）。
  注入了两种形态各测一次：① 不存在的假路径；② 存在但非 junction 的真实目录 `D:/.ai-hub/skills/yy`。
  两者均得 `12/12 + 1 SKIP`，exit 0。该变量生产环境不应设置（已在 regression-all 头注释登记）。
- **D-04 smoke workspace 依赖**：探针沿用原硬编码 workspace `D:/.ai-hub/tmp/project-run-0921/workspace`
  （已确认存在）。若未来该临时目录被清理，junction 在场场景 S13 会 FAIL——属探针原有设计，未改。

## 5. 禁区确认

未改动 SKILL.md、commands/、webview/、contracts/、plans/、队列/看板、其他 scripts/；
未读 test-reports/acceptance-*/；未执行任何 git 操作。实际改动仅：
`scripts/regression-all.mjs`、`test-reports/fix-20260921/junction-smoke.mjs`、本目录（证据）。
