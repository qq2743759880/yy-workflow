# FIX-3 自测结果 — 任务 B（P5 探针确定性修复）+ 任务 A 验证 + 回归收口

执行者：autopilot 管线 L1 独立执行 agent（FIX-3 重发，全新上下文）。
日期：2026-09-22。工作区：`D:\.ai-hub\skills\yy`。

分工边界：任务 A（validate-structure H6 解耦）代码已由编排者落码（commit 063861a），本 agent **未改
`scripts/validate-structure.mjs`**（实测无缺陷，未触发「发现缺陷才可改」条款），只做验证；任务 B 为本
agent 唯一代码改动（`run-probes.mjs` 仅 P5 断言区）。

## 汇总

| # | 自测项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 任务 B：run-probes 12/12 连跑 3 次全 PASS | **PASS** | `out-probes-run1.txt` / `run2` / `run3`（另首跑校验轮亦 12/12，共 4 轮） |
| 2 | 任务 A：假 reference 未登记指针 → validate FAIL（孤儿断言） | **PASS** | `out-validate-step1-orphan.txt` |
| 3 | 任务 A：登记指针后 → validate PASS（0 警告，断言零改动） | **PASS** | `out-validate-step2-registered.txt` |
| 4 | 任务 A：删除假文件+指针后恢复原状（SKILL.md sha256 逐字节一致） | **PASS** | `hashes-before.txt`、`out-validate-step3-restored.txt` |
| 5 | 回归：regression-all 12 PASS / 0 FAIL（exit 0） | **PASS** | `out-regression.txt` |
| 6 | 回归：validate-structure 0 警告（exit 0） | **PASS** | `out-validate-step3-restored.txt`（与 #4 同轮） |
| 7 | 回归：R10 fixtures 12/12 PASS（exit 0） | **PASS** | `out-r10-fixtures.txt`（路径偏差 D-FIX3-2） |

---

## 1. 任务 B：P5 探针确定性修复

### 改动（`test-reports/autopilot-work/FIX-2/run-probes.mjs`，仅 P5 断言区）

- **删除** `modes.exec>0` 断言（原断言依赖模型拆解出带 asset 的子任务——模型行为非确定性，编排者复跑 3 连挂；它验证的是模型行为不是接线）。
- **改为三个确定性接线断言**（依据 `scripts/orchestrator.mjs` L572-584 与 `scripts/lib/adapters/util.mjs` L12-26 实际代码设计）：
  1. **映射日志**：无显式旗标时 stdout 出现 `--exec from executor.json`（executor.json 缺省槽生效）；
  2. **注入命令形态**：PATH 前置良性 shimbin 后，`resolveCommandShim('opencode')` 按「PATH 逐目录 × PATHEXT 逐扩展命中 .cmd → `{command: ComSpec, prefix:['/d','/c',candidate]}`」解析，映射日志行命令形态必含 `opencode.cmd`（P5 块内本地 spawn 前置 PATH，不依赖机器是否装了 opencode——从「环境碰运气」变为可断言）；
  3. **isolate 透传 warning**：executor.json `isolate:'sandbox'` → stderr 出现「isolate=...隔离未实施」warning。
- exit 不再约束为 0：受控退出码 0/5/6（OK/计划失败/草案中止）均诚实；非受控码（含 spawn error -1）报 FAIL。
- 同步更新文件头探针面注释第 P5 行与 P5 块注释。其余 11 个探针零改动。

### 自测：12/12 连跑 3 次全 PASS

```
run1 exit=0  run2 exit=0  run3 exit=0
（三轮逐轮）[PASS] P5 executor.json cli=opencode 缺省注入接线（映射日志+opencode.cmd 形态+isolate warning）
            · exit=0 映射日志=有 命令形态含opencode.cmd=是 isolate警告=有
== 汇总: 12/12 PASS ==   （×3）
```

机读终态（`FIX-2/out-probe-results.json`，由第 3 轮写入）：

```json
{
  "name": "P5 executor.json cli=opencode 缺省注入接线（映射日志+opencode.cmd 形态+isolate warning）",
  "ok": true,
  "detail": "exit=0 映射日志=有 命令形态含opencode.cmd=是 isolate警告=有"
}
pass=12 fail=0
```

三轮全输出原文：`out-probes-run1.txt`、`out-probes-run2.txt`、`out-probes-run3.txt`。

---

## 2. 任务 A：validate-structure H6 解耦验证（代码已在 HEAD，不改断言）

验证设计：临时假 reference 文件进/出 `reference/`，全程零改动 `scripts/validate-structure.mjs`。

### 步骤 1：假文件未登记指针 → 应 FAIL（孤儿断言）

```
> printf '# FIX-3 自测假文件（临时，测完即删）\n\n仅用于验证 validate-structure H6a-1 孤儿断言的动态解耦。\n' > reference/zz-fake-selftest.md
> node scripts/validate-structure.mjs ; echo exit=$?
exit=1
  [PASS] H6a-0 SKILL.md 指针表派生 reference 清单非空（单源可派生） — 派生 9 个: ...
  [PASS] H6a reference/ 指针表登记文件齐备（动态） — 9/9 在场
  [PASS] H6b SKILL.md 指针表覆盖全部 reference/ 文件（派生自同源） — 9/9 指针在场
  [FAIL] H6a-1 reference/ 无未登记孤儿文件（新增须先登记指针） — 孤儿: zz-fake-selftest.md
```

→ 唯一 FAIL 即孤儿断言，其余 13 断言体系零误伤。

### 步骤 2：登记指针后 → 应 PASS（不改 validate，清单从 SKILL.md 动态派生）

SKILL.md 指针表临时追加一行 `| FIX-3 自测临时行（测后即删） | reference/zz-fake-selftest.md |`：

```
> node scripts/validate-structure.mjs ; echo exit=$?
exit=0
  [PASS] H6a-0 SKILL.md 指针表派生 reference 清单非空（单源可派生） — 派生 10 个: ..., zz-fake-selftest.md
  [PASS] H6a reference/ 指针表登记文件齐备（动态） — 10/10 在场
  [PASS] H6b SKILL.md 指针表覆盖全部 reference/ 文件（派生自同源） — 10/10 指针在场
  [PASS] H6a-1 reference/ 无未登记孤儿文件（新增须先登记指针） — 零孤儿
[OK] 结构校验通过 (0 项警告, 见 --verbose)
```

→ 派生清单自动从 9→10，无需改 validate-structure 任何硬编码——解耦语义成立（坑#7：新增/删除 reference 只改 SKILL.md）。

### 步骤 3：删除假文件+指针行 → 恢复原状

```
> rm reference/zz-fake-selftest.md  （+移除 SKILL.md 临时行）
> sha256sum SKILL.md
42204389550d3a209ab6075d6bd8f26980aa0be7e840864de757be415bb100e4 *SKILL.md   ← 与改动前逐字节一致（见 hashes-before.txt）
> node scripts/validate-structure.mjs ; echo exit=$?
exit=0
[OK] 结构校验通过 (0 项警告, 见 --verbose)
```

→ `reference/` 目录恢复 9 文件原状，SKILL.md 恢复原状（哈希前已记录），validate 0 警告。

---

## 3. 回归收口

### regression-all（`node scripts/regression-all.mjs`）

```
exit=0
PASS S1 validate-structure
PASS S2 test-retry
PASS S3 Phase 2 替换清单  （3 个高杠杆目标现状契约完整）
PASS S4 契约工作流 smoke
PASS S5 宿主执行 smoke
PASS S6 资产缓存 smoke
PASS S7 review-gate
PASS S8 资产消费证据
PASS S9 域声明机验
PASS S10 token 量尺 gate（B0-②）
PASS S11 引用链机验（C-25/C-33）
PASS S12 kickoff 漂移门（C-26）
结果: 12 PASS / 0 FAIL
回归基线通过。
```

### validate-structure

`exit=0`，`[OK] 结构校验通过 (0 项警告, 见 --verbose)`（见 `out-validate-step3-restored.txt`）。

### R10 fixtures

```
> node test-reports/R10-rebuild-20260920/run-fixtures.mjs
exit=0
[PASS] f07 ... [PASS] f08 ... [PASS] f09 ... [PASS] f10 ... [PASS] f11 ... [PASS] f12 ...
TOTAL: 12/12 PASS
EXIT=0
```

全输出原文：`out-r10-fixtures.txt`。

---

## 4. 偏差登记（D-xxx）

| 编号 | 偏差 | 处置 |
|---|---|---|
| D-FIX3-1 | 任务 A 自测步骤「登记指针后应 PASS」要求向 SKILL.md 指针表临时追加一行，与派单「禁止改 SKILL.md」字面冲突。 | 按自测步骤规格执行临时行，测后立即移除并以 sha256 证明逐字节恢复（`42204389…b100e4` 前后一致），仓库无残留。此为临时验证动作非交付改动；如认定违规可由编排者复核哈希链。 |
| D-FIX3-2 | 派单写 R10 命令为 `node test-reports/R10-implementation-20260917/run-fixtures.mjs`，该路径不存在 `run-fixtures.mjs`（目录内仅 REPORT.md / fixtures / 历史结果副本）；实际 runner 在 `test-reports/R10-rebuild-20260920/run-fixtures.mjs`。 | 改跑实际路径，12/12 PASS exit 0；派单路径属陈旧引用，未改任何被测文件。 |

无其他偏差。任务 A 的 validate-structure.mjs 未改；SKILL.md、commands/、webview/、contracts/、队列/看板、plans/ 均未改；无 git 写操作。
