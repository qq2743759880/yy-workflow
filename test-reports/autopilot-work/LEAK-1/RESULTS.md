# LEAK-1 结果报告 — 发布面历史本机痕迹清零（D-H2-1）

- 执行：autopilot L1 独立执行 agent（全新上下文）
- 日期：2026-09-22
- 派单：`handoffs/hard/LEAK-1-dispatch.md`
- 结论：**31 文件 67 处审计命中全部 scrub 清零，GRANDFATHER_BASELINE 复位为空对象；验证链全绿；无冻结例外文件；无阻断性偏差。未自称 DONE，待 L2 复核。**

## 1. 前置核对（before）

用与 make-release.mjs STEP 3 完全相同口径的自测计数器（`count-leaks.mjs`，本目录）全仓扫描，
发布面（排除 .git/handoffs/plans/test-reports/contracts/recovery-20260919/.mimosa/.memory/CHANGELOG.md/node_modules）
命中恰好落在基线 31 文件、总数 67，与 `GRANDFATHER_BASELINE` 逐文件一致（全文见 `counts-before.txt`）：

| 发布面相对路径 | 基线值 | before 实测 | after 实测 | scrub 替换处数 |
|---|---|---|---|---|
| docs/DEPENDENCY-AUDIT.md | 3 | 3 | 0 | 3 |
| docs/history/COMPETITOR-DEPLOYMENT.md | 5 | 5 | 0 | 5 |
| docs/history/OPTIMIZATION.md | 4 | 4 | 0 | 5（见 §4 备注①） |
| docs/history/RELEASE.md | 1 | 1 | 0 | 2（见 §4 备注①） |
| docs/history/specs/HANDOFF-PROMPT.md | 1 | 1 | 0 | 1 |
| docs/history/specs/P1-report.md | 1 | 1 | 0 | 1 |
| docs/history/specs/T16-SKILLOPS-report.md | 1 | 1 | 0 | 1 |
| docs/history/specs/VERIFY-2.9.0-report.md | 2 | 2 | 0 | 2 |
| docs/history/specs/dev-planner-optimization-prd.md | 2 | 2 | 0 | 2 |
| docs/history/specs/muse-tt-fusion-plan.md | 2 | 2 | 0 | 2 |
| docs/history/specs/thirdparty-replacement-plan.md | 4 | 4 | 0 | 4 |
| docs/history/tasks/BE-12-regression-integration.md | 2 | 2 | 0 | 2 |
| docs/history/tasks/FE-06-manifest-and-validator-update.md | 1 | 1 | 0 | 1 |
| docs/history/tasks/reports/A1-report.md | 1 | 1 | 0 | 1 |
| docs/history/tasks/reports/A2-kickoff.md | 2 | 2 | 0 | 2 |
| docs/history/tasks/reports/A2-report.md | 4 | 4 | 0 | 4 |
| docs/history/tasks/reports/B1-report.md | 1 | 1 | 0 | 1 |
| docs/history/tasks/reports/B12-kickoff.md | 4 | 4 | 0 | 4 |
| docs/history/tasks/reports/B2-report.md | 1 | 1 | 0 | 1 |
| docs/history/tasks/reports/C08-kickoff.md | 2 | 2 | 0 | 2 |
| docs/history/tasks/reports/T1-report.md | 4 | 4 | 0 | 4 |
| docs/history/tasks/reports/T3-report.md | 3 | 3 | 0 | 3 |
| docs/history/tasks/reports/T5-report.md | 1 | 1 | 0 | 1 |
| docs/history/tasks/reports/T7-report.md | 4 | 4 | 0 | 4 |
| docs/history/tasks/reports/T8-report.md | 2 | 2 | 0 | 2 |
| docs/history/tasks/task-B1-gpt-researcher.md | 1 | 1 | 0 | 1 |
| docs/history/tasks/task-B2-metagpt.md | 1 | 1 | 0 | 1 |
| docs/history/tasks/task01-a6api-host.md | 2 | 2 | 0 | 2 |
| prototypes/yy-workflow-panel/index.html | 3 | 3 | 0 | 3 |
| vendor/.../data/stacks/avalonia.csv | 1 | 1 | 0 | 1 |
| vendor/.../scripts/validate_data.py | 1 | 1 | 0 | 1 |
| **合计** | **67** | **67** | **0** | **69** |

> 说明：替换处数 69 > 审计命中 67，因审计口径对行做 `toLowerCase()` 后才跑大小写敏感的
> `/Users/<name>/`、`/home/<name>/` 正则，故源码里的 `/Users/lingzhi/...` 字样不产生审计计数，
> 但按派单「机器绝对路径一律 scrub」仍被清为 `/Users/<user>/...`（OPTIMIZATION.md 1 处、
> RELEASE.md 1 处）。逐行命中定位存证：`hits-docs-part1.txt`、`hits-docs-part2.txt`、
> `hits-prototypes-vendor.txt`。

## 2. scrub 方法（最小 diff）

- 逐文件按定位行做**字面量 find/replace**（执行器 `apply-scrub.mjs`：两遍式——先全量校验字面量可命中，
  任一未命中则整体不写盘，杜绝部分写入与误替换；逐文件替换计数见 `apply-scrub-output.txt`）。
- 占位符选择（按上下文取不误导读者的写法）：
  - AI-Hub 根路径 `D:\.ai-hub\...` → `~/.ai-hub/...`（与 T5-report 既有语义 `AIHUB_ROOT` 默认 `~/.ai-hub` 一致）；
  - 用户主目录 `C:\Users\Administrator\...` → `~/...`；
  - 系统临时目录 `C:\Users\Administrator\AppData\Local\Temp\...` → `<TEMP>/...`；
  - 文档中作为「禁止出现」示例的模式字面量（`` `D:\` ``、`` `C:\Users\` ``、`Administrator`）→ 改述为
    「盘符绝对路径」「`C:` 盘 Users 目录」「本机用户名」，语义（可移植性禁令）保持；
  - prototypes 面板 demo 字符串 `--workspace D:\\\\...` → `--workspace <workspace>`；展示文本 → `~/.ai-hub/skills/yy`；
  - avalonia.csv（vendor 参考数据）示例 `C:\Users\data\config.json` → `C:\ProgramData\MyApp\config.json`
    （保持「硬编码 Windows 绝对路径」这一反例的教学语义，去除用户目录痕迹）；
  - validate_data.py:1081 `print(f"...found:\n")` → `print(f"...found:", end="\n\n")`（输出字节完全不变，
    仅消除源码行内的 `d:\` 误命中；单行最小 diff）。
- 不改任何标题/表格结构/代码语义；每文件仅改动命中行。

## 3. 冻结例外检查

对 31 文件全量 grep `FROZEN|契约冻结|contract freeze|冻结面|冻结`，仅 7 文件出现「冻结」字样
（OPTIMIZATION.md、HANDOFF-PROMPT.md、A2-report.md、T7-report.md、VERIFY-2.9.0-report.md、
prototypes/yy-workflow-panel/index.html、dev-planner-optimization-prd.md）。
逐条核对均为**领域工作流语义**（orchestrator 的「契约冻结」阶段、freezeContract/frozenAt 等机制描述），
**无任何声明本文件自身被冻结的显式冻结标记**。故冻结例外为 0，31 个基线条目全部删除。

## 4. 偏差登记（D-xxx）

- **D-LEAK-1-①（口径备注，非偏差阻断）**：OPTIMIZATION.md/RELEASE.md 各含 1 处 `/Users/lingzhi/...`
  引述，不产生审计计数（原因见 §1 说明），按派单「机器绝对路径 scrub」一并清为 `/Users/<user>/...`。
- **D-LEAK-1-②（口径备注）**：validate_data.py 属 vendor 参考脚本，其命中为 `found:\n` 字面量对
  `D:\` 正则的误命中；已用语义等价单行改写消除，文件其余部分未动。
- **D-LEAK-1-③（范围备注）**：全仓复扫发现 `test-reports/rebuild-20260920/.../.sandbox/` 下存在
  vendor 文件的历史快照副本含同类痕迹——test-reports 不在发布面（robocopy 排除清单），且不在本单
  白名单，未触碰。
- 无其他偏差。

## 5. GRANDFATHER_BASELINE 复位

`scripts/make-release.mjs`（仅基线常量区）：

```js
// 基线豁免（grandfather）：2026-09-22 首次全量审计曾冻结 31 文件 67 处历史遗留的
// 本机路径/用户名痕迹；同日 LEAK-1 开单已全部 scrub 清零，基线复位为空。
// 机制仍在生效：
//   - 基线内文件命中数 > 基线值 → 发布失败；
//   - 基线外任何文件命中 → 发布失败；
//   - 基线内文件修复后命中减少（含清零）→ 自然通过，基线不回调。
const GRANDFATHER_BASELINE = {};
```

## 6. 验证链输出原文

### 6.1 `node scripts/make-release.mjs --dry-run`（存证 dryrun-after-leak1.txt，EXIT=0）

```
== make-release --dry-run ==
STEP 0 安全阀校验（realpath 归一 + .git 哨兵）
  junction 归一: C:\Users\Administrator\.agents\skills\yy -> D:\.ai-hub\tmp\yy-release
STEP 1 purge：扫描目标中发布清单之外的条目
  PURGED: （空，目标与发布清单一致）
STEP 2 robocopy 刷新发布面
  [dry-run] 将执行: robocopy D:\.ai-hub\skills\yy D:\.ai-hub\tmp\yy-release /MIR ... /XF .memory CHANGELOG.md make-release.mjs *.log
STEP 3 泄露审计（对产物目录，零命中才通过）
  [dry-run] 将扫描 D:\.ai-hub\tmp\yy-release（模式 6 组 + U+FFFD 字节；grandfather 基线 0 文件）
STEP 4 --mklink（未启用，跳过）
RESULT: DRY-RUN 完成（零落盘） | PURGED=0(待删) | LEAK新增=? | LEAK基线豁免=0
```

grandfather 基线 0 文件 ✓、无新增 ✓。

### 6.2 真实 `node scripts/make-release.mjs` 第 1 轮（存证 release-run1.txt，EXIT=0）

```
STEP 1 purge：PURGED: （空，目标与发布清单一致）
STEP 2 robocopy exit=1（已刷新）
STEP 3 新增命中 0，审计通过
RESULT: 发布完成 | PURGED=0 | LEAK新增=0 | LEAK基线豁免=0
```

### 6.3 真实发布第 2 轮（幂等验证，存证 release-run2.txt，EXIT=0）

```
STEP 1 purge：PURGED: （空，目标与发布清单一致）
STEP 2 robocopy exit=0（无变化，幂等）
STEP 3 新增命中 0，审计通过
RESULT: 发布完成 | PURGED=0 | LEAK新增=0 | LEAK基线豁免=0
```

PURGED=0 + robocopy exit=0 ⇒ 发布幂等符合 HARD-2 语义 ✓；GRANDFATHERED=0 ✓；新增 0 ✓。

### 6.4 `node scripts/regression-all.mjs`（存证 regression-all.txt，EXIT=0）

```
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
PASS S13 junction 部署形态 smoke  4/4 内部探针 PASS

结果: 13 PASS / 0 FAIL
回归基线通过。
```

13/13 全绿 ✓。

### 6.5 `node scripts/validate-structure.mjs`（存证 validate-structure.txt，EXIT=0）

```
[YY] validate D:\.ai-hub\skills\yy\SKILL.md
  ...
  可移植性泄露: 无
  编码损坏(U+FFFD): 无
  ...
[OK] 结构校验通过 (0 项警告, 见 --verbose)
```

0 警告 ✓（含可移植性泄露「无」、U+FFFD「无」，即 scrub 未引入新泄露的独立复核）。

## 7. 白名单遵守声明

本任务仅改动：基线 31 个源文件（scrub）、`scripts/make-release.mjs`（仅 GRANDFATHER_BASELINE
常量区）、`test-reports/autopilot-work/LEAK-1/`（证据与自测脚本）。未执行 git 操作、未触碰
junction、未读取 test-reports/acceptance-*/。
