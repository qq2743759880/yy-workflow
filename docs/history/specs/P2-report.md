# P2 报告：批判反哺自动化（review-gate --auto-register）

> 实现方：TT 工作流派出的独立实现子 agent · 2026-09-02 · TT v2.5.0 之上
> 目标：批判结论从「人工回写 tracker + 手动建优化任务」变为「自动登记 + 自动生成任务文档」。

## 1. 背景与验收结论

- 现有批判机制：`scripts/review-gate.mjs`（机械校验 `task{id}-技术批判.md` ≥3 条含 URL+日期、`task{id}-优化修改方案.md` 存在、`plans/critique-backlog-tracker.md` 已登记该 id）；tracker 表格列为 `| # | 批判（来源） | 级别 | 修复措施 | 落点任务 | 验收指标 | 状态 |`。
- 本轮改动全部并入 `scripts/review-gate.mjs`（未新增独立文件，符合「推荐并入」），补 README 用法说明。
- **验收全部通过**：最小样例 `--auto-register` → tracker 新增行 + 生成 `critique-<序号>-task.md`；重跑幂等 0 新增；`--self-test`/`--dir`/`--id`（不带 `--auto-register`）行为不变；回归 8/8；validate 0 泄露；`node scripts/ci.mjs` PASS。

## 2. 解析规则（parseCritiqueEntries）

对 `task{id}-技术批判.md` 按两条路解析，兼容三种写法：

| 写法 | 判定 | 提取 |
|---|---|---|
| 模板表格 `| # | 批判点 | 竞品对标(URL+日期+结论) | 差距 | 优化方案 | 最小验证 | 收益/成本 | 级别 |` | 检测到 ≥2 数据行且含「竞品对标」+「批判点」 | 批判点(c2)、竞品 URL/日期(c3)、优化方案(c5)、最小验证(c6)、级别(c8) |
| `## C1 标题` / `### C1 标题` 分节 | 行首 `^#{2,4}\s+C\d+` | 标题取节名；正文内正则提取 级别 P0/P1/P2、URL、日期、`优化方案/修复措施/方案：` 标签行、`最小验证/验收指标/验证：` 标签行 |
| 数字列表 `1. …` / `1、…` | 行首 `^\s*\d+[.、)]\s+\S` | 同分节规则；标题取列表项文本，缺失时回退「问题/批判点：」标签行或首个非空行 |

- 硬闸门语义对齐：**无 URL 或无日期 = 无效批判**，跳过登记（与 `isValidRow` 一致）。
- 标题归一化 `normalizeText`：折叠空白 + 剔除 `|`/换行，防污染 markdown 表格。
- 表格写法若同时存在 `## C1` 等节标题，优先按表格解析（模板为仓库规范格式）。

## 3. 登记格式（对齐现有表头）

追加到 tracker 主表（表头含 `| # | 批判（来源）`，表内已有 C-01…C-07）末尾，`appendTrackerRows` 定位表头→末数据行后插入，不动其他分表：

```
| C-15 | 批判结论靠人工回写 tracker，未自动沉淀（来源：taskZZ-技术批判.md，2026-09-01） | P1 | 接入 review-gate --auto-register | docs/history/tasks/critique-C-15-task.md | node scripts/review-gate.mjs --self-test | ⬜ 待落地 |
```

- 序号 `nextTrackerSerial`：取 tracker 内现有 `C-(\d+)` 最大值 +1（写入时 padStart 两位），实测当前仓库已有并发登记的 C-13/C-14，故新行从 C-15 起。
- 级别缺失默认 `P2`；优化方案/验收指标缺失有诚实占位。
- 写入保持 **UTF-8 无 BOM + LF**（node `fs.writeFileSync(…, { encoding: 'utf8' })`，内部以 `\n` 拼接；读取先归一化 `\r\n`）。

## 4. 幂等实现

- 查重键 = `来源文件名（task{id}-技术批判.md）+ 归一化批判标题前 40 字符`，与登记行内「问题摘要 + （来源：…）」可双向匹配。
- `registerFromFiles` 每次运行时从磁盘重读 tracker 现有行做 `includes(来源) && includes(标题摘要)` 判定；命中则 `skipped`，不追加行、不生成文档、不占用序号。
- 实测重跑：`自动登记 0 条 / 生成任务文档 0 份 / 跳过重复 3 条`。

## 5. 接入 review-gate

- `--auto-register <dir> [--id taskNN]`（也兼容 `--auto-register --dir <dir>`）：先跑既有 `checkReview` 全闸门，**通过才登记**，然后 exit 0；未过 → exit 1 且不登记（实测无效样例：`有效 0/2` + 缺优化方案 → FAIL exit 1，`taskYY` 零行残留）。
- `--self-test` 扩展：新增自动登记幂等自测（临时目录全隔离，不写仓库），覆盖 表格解析 3 条→3 行→3 文档→重跑 3 跳过、`## C{n}` 字段提取、序号 C-01 起始。
- 既有 `--dir/--id`（不带 `--auto-register`）路径逻辑未改，实测行为与原来一致（仅机验，不登记）。

## 6. 最小样例实测（验收标准逐条）

样例文件（置于临时目录，未入库；`taskZZ-技术批判.md` 3 条有效批判：问题/级别/竞品 URL/优化方案 + 优化修改方案）：

```markdown
| # | 批判点 | 竞品对标(URL+日期+结论) | 差距 | 优化方案 | 最小验证 | 收益/成本 | 级别 |
|---|--------|------------------------|------|---------|---------|----------|------|
| 1 | 批判结论靠人工回写 tracker，未自动沉淀 | https://github.com/turbo 2026-09-01 结论A | 无自动登记 | 接入 review-gate --auto-register | node scripts/review-gate.mjs --self-test | 1/2 | P1 |
| 2 | 优化任务文档需手建，无 task 草案 | https://docs.linear.app 2026/09/01 结论B | 无派单输入 | 自动生成 critique-<id>-task.md | 检查 docs/history/tasks/ 文件存在 | 1/3 | P2 |
| 3 | 重复跑会重复登记，无幂等 | https://example.com 2026-09-02 结论C | 重复行污染 | 按「来源文件名+批判标题」查重 | 重跑不新增行 | 2/4 | P2 |
```

- 第 1 次运行：`PASS 有效批判≥3（含URL+日期） 有效 3/3` → `REGISTER C-15/16/17` → `自动登记 3 条 / 生成任务文档 3 份`，exit 0。tracker 新增 3 行（来源=文件名+日期，状态 ⬜ 待落地），生成 `docs/history/tasks/critique-C-15-task.md`（含 修复措施 / 落点 / 验收指标 / 竞品对标 URL / 引用原文件）。
- 第 2 次运行（幂等）：`自动登记 0 条 / 生成任务文档 0 份 / 跳过重复 3 条`，exit 0。
- 单条批判单元级：`## C1` 单条目 → 1 行 + 1 文档（C-01），重跑 0 新增（对应「含 1 条批判 → 新增一行」验收语义；受「有效批判≥3 才过闸门」约束，端到端样例必须 3 条，1 条场景在模块级验证）。
- 实测后已清理 `taskZZ` 测试行与临时生成的 `critique-C-*` 文档，仓库不留假数据。

## 7. 回归结果

| 项目 | 结果 |
|---|---|
| `node scripts/regression-all.mjs` | **8 PASS / 0 FAIL**（S7 review-gate 含新增幂等自测） |
| `node scripts/validate-structure.mjs` | OK，可移植性泄露 **0**，U+FFFD 0 |
| `node scripts/ci.mjs` | **CI PASS**（S2 review-gate --self-test 通过） |
| `--self-test` / `--dir`/`--id`（无 `--auto-register`） | 行为不变，实测通过 |
| 文件改动 | 仅 `scripts/review-gate.mjs`、`README.md`、本报告 |

## 8. 诚实记录

- 环境存在并发进程对仓库的写操作（`asset-call-rate` 向 tracker 追加了 C-13/C-14 及多个脚本改动，非本任务产物）。自测初期一度写入真实 tracker，已被改为**临时目录全隔离**，不依赖、不污染并发写入。测试过程中发现一个由并发自测产生的残留 `critique-C-18-task.md`，已清除。
- `--auto-register` 的 tracker「已登记」闸门走 `plans/critique-backlog-tracker.md` 的 ROOT 路径读取（既有 `--dir/--id` 分支保持 dir 相对读取不变），避免产物目录与 tracker 分离时误拦。
- 文件式 append 在「两进程同时登记」时无行级锁，可能序号竞争——本任务范围外（幂等按内容去重已覆盖重复场景）。
