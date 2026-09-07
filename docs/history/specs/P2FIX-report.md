# P2FIX 报告：review-gate `--auto-register` 门槛与登记解析双轨缺陷修复

- 修复子 agent：独立修复任务（TT 工作流派单）
- 日期：2026-09-02
- 涉及文件：`scripts/review-gate.mjs`（唯一改动文件，+`--self-test` 断言）
- 状态：全部验收项通过（见 §5）

## 1. 缺陷根因（诚实）

`review-gate.mjs` 内部存在**两套互不相同的批判解析器**，导致「门槛判定」与「登记解析」对同一份块式文档给出相反结论：

| 环节 | 解析器 | 支持格式 | 对块式的判定 |
|---|---|---|---|
| 门槛 `checkReview()`（L317） | `parseCritique()` → `extractRows()` | **仅表格**（`| 批判点 | 竞品对标 |` 行） | 块式无 `|` 行 → `total=0 valid=0` → **FAIL** |
| 登记 `registerFromFiles()`（L282） | `parseCritiqueEntries()` | 表格 + `## C{n}` 块式 + 数字列表 | 能正确解析出 3 条有效 → **可登记** |

因此 `--auto-register <dir>`（L455-475）先跑 `checkReview` 门槛：当批判文档是 `## C1/C2/C3` 块式格式时，门槛报 `FAIL 有效批判 0/0` → `exit 1`，登记代码永远走不到——即使同一个 `parseCritiqueEntries` 明明能把它解析成 3 条有效批判并登记成功。**auto-register 对块式文档形同虚设。**

实测复现（已核实，构造 `## C1/C2/C3` 块式批判 + 优化修改方案.md）：`--auto-register` 报 `FAIL 有效批判 0/0` 拒绝，exit 1。TT 现有批判文档（docs/history/specs、历史 task）为**表格 + 块式混合**，必须两种都过。

## 2. 修复 diff（最小修复，统一解析器）

只改 `checkReview()` 一处 + `selfTest()` 补断言。`parseCritique`/`extractRows` **保留**（`extractRows`/`isValidRow` 为既有导出，可能被其他调用方引用；本修复仅让 `checkReview` 不再依赖它们）。

```diff
  /** 校验一份批判交付。返回 { ok, checks: [{name, pass, detail}] }。 */
+ /** 统一走 parseCritiqueEntries（与 registerFromFiles 同一解析器）：兼容模板表格与 ## C{n}/数字列表块式，
+  *  避免「块式文档登记能解析但门槛 0/0 被拦」的双轨不一致。 */
  export function checkReview({ critiqueText, fixText, trackerText, id }) {
    const checks = [];
-   const { total, valid } = critiqueText ? parseCritique(critiqueText) : { total: 0, valid: 0 };
-   checks.push({ name: '批判文档存在', pass: !!critiqueText, detail: critiqueText ? `${total} 行` : '缺失' });
+   const entries = critiqueText ? parseCritiqueEntries(critiqueText) : [];
+   const total = entries.length;
+   const valid = entries.filter((e) => e.valid).length;
+   checks.push({ name: '批判文档存在', pass: !!critiqueText, detail: critiqueText ? `${total} 条` : '缺失' });
    checks.push({ name: '有效批判≥3（含URL+日期）', pass: valid >= 3, detail: `有效 ${valid}/${total}` });
    ... // 优化修改方案存在 / tracker 已登记：保持不变
  }
```

判定语义说明：

- `parseCritiqueEntries` 的 `valid` 定义：块式（`entryFromBlock` L191）要求正文含 `URL_RE` **且** `DATE_RE`；表格（`parseTableEntries` L147）要求 `url && date`。两种格式的判定与登记共用同一份字段，门槛与登记**保证一致**。
- `checkReview` 现用 `entries.filter(e => e.valid).length >= 3`，硬门槛 ≥3 **不变**。
- 其余检查（优化修改方案存在、tracker 已登记）逐字未动。

`selfTest()` 新增两块式断言（好/坏各一）：

```diff
   const badR = checkReview({ critiqueText: bad, fixText: null, trackerText: '', id: 'taskNN' });
   if (!goodR.ok) throw new Error('self-test FAIL: 好样例应通过');
   if (badR.ok) throw new Error('self-test FAIL: 坏样例应被拦截');
+  // 块式 ## C{n} 批判：3 条含 URL+日期 → 门槛通过；无 URL/日期 → 拦截（与登记解析器同一判定）
+  const blockGood = [ '# taskNN 技术批判', '', '## C1 ...', '## C2 ...', '## C3 ...' ].join('\n');
+  const blockBad = [ '## C1 无URL', '## C2 无URL', '## C3 无URL' ].join('\n');
+  const blockGoodR = checkReview({ critiqueText: blockGood, fixText: '# 方案', trackerText: '# taskNN', id: 'taskNN' });
+  const blockBadR = checkReview({ critiqueText: blockBad, fixText: '# 方案', trackerText: '# taskNN', id: 'taskNN' });
+  if (!blockGoodR.ok) throw new Error('self-test FAIL: 块式 ## C{n} 批判应通过门槛 ...');
+  if (blockBadR.ok) throw new Error('self-test FAIL: 块式无 URL/日期 批判应被拦截');
```

## 3. 双格式验证（端到端，隔离环境）

采用**隔离复刻法**验证真实 CLI：把 `scripts/review-gate.mjs` 复制到临时树的 `scripts/` 下（`ROOT` 由脚本位置推导 → 临时树的 `plans/` 与 `docs/history/tasks/` 被隔离），真实跑 `node scripts/review-gate.mjs --auto-register ...`，**不触碰仓库真实 tracker 与任务文档**。共 13 项断言全过：

| # | 断言 | 结果 |
|---|---|---|
| 1 | 块式 `## C1/C2/C3`（各含 URL+日期+优化方案+最小验证）+ 优化修改方案.md → `--auto-register` exit 0 | PASS |
| 2 | 登记 3 行，序号从 seed 最大 C-02 续接 C-03/C-04/C-05 | PASS |
| 3 | 首次运行无 SKIP | PASS |
| 4 | tracker 新增 3 行（含来源文件名） | PASS |
| 5 | tracker 旧行保留（C-01/C-02 未动） | PASS |
| 6 | 生成 3 份 `docs/history/tasks/critique-C-0{3,4,5}-task.md` | PASS |
| 7 | **重跑 exit 0（幂等）** | PASS |
| 8 | 重跑 0 新增、3 条 SKIP(幂等) | PASS |
| 9 | 重跑后 tracker 仍 3 行新登记（无重复） | PASS |
| 10 | 重跑后任务文档仍 3 份（不重复生成） | PASS |
| 11 | **表格格式**批判 → `--auto-register` 仍通过（不回归） | PASS |
| 12 | 有效 <3 的块式批判（缺 URL/日期）仍被拦截 exit 1 | PASS |
| 13 | 拦截时 tracker 零登记 | PASS |

清理：验证全程走临时目录（`os.tmpdir()`），结束后 `fs.rmSync` 递归删除；仓库真实 `plans/critique-backlog-tracker.md` 无 C-13+ 行、`docs/history/tasks/` 无新增 `critique-*` 文件（已复核 git status / 目录列出）。

## 4. 幂等

- 登记查重逻辑（`registerFromFiles`：按「来源文件名 + 批判标题前 40 字符」比对既有 tracker 行）**未改动**。
- 第 7-10 项断言证明：统一门槛后重跑 0 新增、3 跳过、任务文档不重复生成，幂等性无回归。
- 任务文档生成有 `if (!fs.existsSync(p))` 守卫，重跑不覆盖。

## 5. 回归

| 命令 | 结果 |
|---|---|
| `node scripts/review-gate.mjs --self-test` | **PASS**（含新增块式好/坏断言） |
| `node scripts/regression-all.mjs` | **8 PASS / 0 FAIL** |
| `node scripts/validate-structure.mjs` | **[OK] 结构校验通过，可移植性泄露 0，U+FFFD 0** |
| `node scripts/ci.mjs` | **CI PASS**（S1 validate / S2 review-gate self-test / S3 plan-review / S4 regression-all 全过；S5 资产质量评分为信息段，不阻断） |

## 6. 硬性约束履约

- 零外部依赖：仅用 `node:` 内建模块，未新增任何依赖。
- 不写本机绝对路径：改动仅落在 `scripts/review-gate.mjs`（不含绝对路径）；验证脚本置于仓库外临时目录。
- 只改 `review-gate.mjs`（及 `--self-test` 断言，属同一文件）；`git status` 中其余改动（README/config.example/orchestrator/tracker/asset-call-rate/P1-P3-report 等）为**先于本任务存在的并发改动**，本轮未触碰、未 revert。
- 未提交、未 push。

## 7. 诚实说明

- `parseCritique`/`extractRows`/`isValidRow` 保留未删（兼容其他潜在调用方），但 `checkReview` 已不再引用它们——若未来无调用方，可再清理，本轮不做（最小修复原则）。
- 若单份文档**同时**含批判表格与块式节，`parseCritiqueEntries` 按既有设计优先取表格（`hasCritTable` 短路），门槛与登记同为该行为，一致但块式节不计入——这属于解析器既有设计取舍，非本缺陷范围，本报告如实记录。
