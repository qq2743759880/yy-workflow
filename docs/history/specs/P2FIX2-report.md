# P2FIX2 报告：review-gate `fieldOf` 把 markdown 标题行 `### 优化方案` 误提取为 `###`

- 修复子 agent：独立修复任务（TT 工作流派单）
- 日期：2026-09-02
- 涉及文件：`scripts/review-gate.mjs`（唯一改动文件）
- 状态：全部验收项通过（见 §5）

## 1. 缺陷根因（诚实）

`fieldOf`（原 L154-165）遍历块内每一行，用标签正则（如 `/优化方案/`）命中后执行 `t.replace(re, '')` 去前缀取内容。当块式批判文档用 **markdown 标题行** 声明字段时——

```
### 优化方案
加 schema 校验。
```

`### 优化方案` 命中 `/优化方案/` → replace 后剩 `### ` → 再 strip `[:：\s-]+` 得到 `###`（非空）→ 被当作「内容」返回。结果：

- `parseCritiqueEntries` 的 `e.plan = '###'`；
- `buildTrackerRow` 登记行「修复措施」列 = `###`；
- `buildTaskDoc` 任务文档「修复措施」 = `###`。

根因是 `fieldOf` 把「标签声明行」与「内容行」混为一谈：标题行的 `#` 是 markdown 标记，不是内容。表格格式不受影响（`parseTableEntries` 直接取 cell，不经 `fieldOf`）。

顺带发现同类隐患：若批判标题本身含标签词（如 `## C1 优化方案不可落地`），原实现会把标题残余（`## C1 不可落地`）当成 plan 内容——修复后该类标题行同样被正确跳过。

## 2. fieldOf 修复逻辑（最小修复）

改动 3 处，全部在 `scripts/review-gate.mjs` 内：

### 2.1 `fieldOf`：标题行（`#` 开头）跳过，改走 `contentAfterHeading`

```js
function fieldOf(lines, labels) {
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trim();
    for (const re of labels) {
      if (re.test(t)) {
        // 标题行：标题只是标签声明，内容在后续行，跳过本行
        if (t.startsWith('#')) return contentAfterHeading(lines, i + 1, labels);
        const content = t.replace(re, '').replace(/^[:：\s-]+/, '').trim();
        if (content) return content;
      }
    }
  }
  return '';
}
```

语义：**任何以 `#` 开头且命中标签的行**（`### 优化方案`，或标题恰含标签词如 `## C1 优化方案不可落地`）都视为标签声明而非内容，交给 `contentAfterHeading` 向后找内容；非标题行保持原行为（`优化方案：xxx` / `优化方案 - xxx` 直接取标签后内容）。

### 2.2 `contentAfterHeading`（新增）：标题被跳过后向后查找

```js
/** 块式批判文档中「其他字段」的标签前缀（标题行被跳过后，避免把别的字段行误当本字段内容）。 */
const OTHER_LABEL_RE = /^(?:\s*[-*#]+\s*|\d+[.、)]\s*)?(?:问题|批判点|差距|竞品对标|级别|收益|成本|状态|结论|最小验证|验收指标)\s*[:：]/;

function contentAfterHeading(lines, from, labels) {
  for (let j = from; j < lines.length; j += 1) {
    const t = lines[j].trim();
    if (!t || t.startsWith('#')) continue;            // 空行 / 下一标题行：继续找
    let matched = false;
    for (const re of labels) {
      if (re.test(t)) {
        matched = true;
        const content = t.replace(re, '').replace(/^[:：\s-]+/, '').trim();
        if (content) return content;                 // 仍带标签行（如 `- 优化方案：xxx`）→ 提取标签后内容
      }
    }
    if (matched) continue;                            // 带本字段标签但内容为空：继续找
    if (OTHER_LABEL_RE.test(t)) continue;             // 其他字段标签行（如 `- 最小验证：…`）：不属于本字段，跳过
    return t.replace(/^[:：\s-]+/, '').replace(/^\d+[.、)]\s+/, '').trim(); // 普通内容行
  }
  return '';
}
```

行为对照（需求逐条）：

| 场景 | 结果 |
|---|---|
| `### 优化方案` + `加 schema 校验。` | `加 schema 校验。`（**本次 bug 主场景**） |
| `### 优化方案` 后接空行 / 另一 `###` 标题 | 继续向后找首个带内容行或带标签行（需求 2） |
| `### 优化方案` 后接 `- 优化方案：xxx` | `xxx`（标题声明 + 行内冗余标签双写兼容） |
| 标题后是其他字段标签行（`- 最小验证：…` / `- 级别：…`） | 跳过，不误当本字段内容（`OTHER_LABEL_RE` 兜底） |
| 标题后无任何内容 | `''`（需求 2：找不到返回空） |
| `优化方案：xxx` / `优化方案 - xxx`（行内） | `xxx`（既有行为不破） |
| 表格格式 | 不经此函数，`parseTableEntries` 直接取 cell（不受影响） |

### 2.3 `--self-test` 补断言

- `selfTest()`：新增 `### 优化方案` / `### 最小验证` 标题行块式样例，断言 `e.plan === '加 schema 校验。'`、`e.minVerify === 'node scripts/validate-structure.mjs'`，且任何条目 `plan !== '###'`；另含标题含标签词（`## C2 优化方案不可落地`）用例，断言标题残余不入 plan。
- `selfTestAutoRegister()`：新增 3 条 `### 优化方案` 标题行块式批判端到端（注入临时 tracker/tasksDir），断言登记 3 条、tracker 行「修复措施」列 = 方案内容（非 `###`）、3 份任务文档「修复措施」段 = 方案内容；全程临时目录 `fs.rmSync` 清理。

## 3. 双格式验证（端到端，隔离环境）

采用与 P2FIX 相同的**隔离复刻法**：把修复后的 `review-gate.mjs` 复制到临时树 `scripts/` 下（`ROOT` 由脚本位置推导 → 临时树的 `plans/` 与 `docs/history/tasks/` 被隔离），真实跑 `node scripts/review-gate.mjs --auto-register <dir>`，**不触碰仓库真实 tracker 与任务文档**。

### 3.1 块式 e2e（P2FIX2 主场景，`### 优化方案` 标题行）

3 条块式批判（C1 schema 校验 / C2 日志脱敏 / C3 幂等），每条含 `问题/级别/竞品对标(URL+日期)/### 优化方案/内容`：

| # | 断言 | 结果 |
|---|---|---|
| 1 | `--auto-register` 门槛通过 exit 0（有效批判 3/3） | PASS |
| 2 | 登记 3 行（C-01/C-02/C-03），无 SKIP | PASS |
| 3 | tracker 行「修复措施」列 = `加 schema 校验。` / `日志字段脱敏。` / `按来源加标题查重。`（程序化核对 `split('|')[4]`，**非 `###`**） | PASS |
| 4 | tracker 全文不含 `| ### |` | PASS |
| 5 | 3 份任务文档「## 修复措施」段 = 对应方案内容 | PASS |
| 6 | 重跑幂等：0 新增、3 SKIP(幂等)，exit 0 | PASS |

### 3.2 表格 e2e（不回归）

同一隔离树，`taskTT` 用标准模板表格（3 条）：

| # | 断言 | 结果 |
|---|---|---|
| 7 | `--auto-register` 通过，登记 C-04/C-05/C-06 | PASS |
| 8 | 登记行「修复措施」列 = cell 值（`改modules/a` / `改modules/b` / `改modules/c`） | PASS |

## 4. 清理确认

- 验证全程在 `%TEMP%\opencode\p2fix2-e2e\` 临时树进行，结束已 `Remove-Item -Recurse -Force` 删除。
- 复核仓库：真实 `plans/critique-backlog-tracker.md` **无 C-1x 新增行**（grep `C-1[3-9]` = False）；`docs/history/tasks/` **无 `critique-*` 文件**（0 个）。测试登记零污染。
- 未提交、未 push；`git status` 其余改动（README/config.example/orchestrator/tracker/asset-call-rate/P1-P3-report 等）为先于本任务存在的并发改动，本轮未触碰、未 revert。

## 5. 回归

| 命令 | 结果 |
|---|---|
| `node scripts/review-gate.mjs --self-test` | **PASS**（含新增块式标题行断言） |
| 块式直接断言：`### 优化方案\n加 schema 校验。` → `e.plan = '加 schema 校验。'` | PASS |
| 兼容断言：`优化方案：加 schema 校验` / `优化方案 - 加 schema 校验` → `加 schema 校验` | PASS |
| 需求 2 断言：`### 优化方案` 后空行/`###` → 继续找后续带内容行；找不到返回 `''` | PASS（6/6 用例） |
| `node scripts/validate-structure.mjs` | **[OK] 结构校验通过；可移植性泄露 0；编码损坏(U+FFFD) 0** |
| `node scripts/regression-all.mjs` | **8 PASS / 0 FAIL** |
| `node scripts/ci.mjs` | **CI PASS**（S1 validate / S2 review-gate / S3 plan-review / S4 regression-all 全过） |

## 6. 硬性约束履约

- 零外部依赖：仅 `node:` 内建模块，未新增依赖。
- 不写本机绝对路径：改动仅落 `scripts/review-gate.mjs`（`git diff` 含路径模式扫描 0 命中）；验证样例置于仓库外临时目录，未入库。
- 只改 `review-gate.mjs`（含其 `--self-test` 断言，同文件）。
- 未提交、未 push。

## 7. 诚实说明

- `contentAfterHeading` 的「首个普通内容行即结果」语义意味着：若 `### 优化方案` 节内无方案内容、其后紧跟 `### 最小验证\nnode test`，plan 会取到 `node test`（需求 2 明文「继续找后续带内容行或带标签行」的预期行为，但跨字段语义模糊）。已用 `OTHER_LABEL_RE` 挡掉 `- 最小验证：…` 这类**行内**其他字段标签，但**标题型**下一节无法区分归属——这是需求 2 的设计取舍，非回归；规范写法（`### 优化方案` 后直接给内容）不受影响。
- 模块顶层 `process.exitCode = main()` 在 import 时顺带执行是既有设计，非本任务引入；验证脚本已避开。
