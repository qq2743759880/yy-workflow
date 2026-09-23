# TK-1 RESULTS.md — task 模板 v2 七字段 + 机验（批 0）执行证据

执行 agent：TK-1 L1（独立上下文，重派）；日期：2026-09-23。
派单：handoffs/v3/TK-1-dispatch.md + 编排者重派指令（聚焦版）；上下文：plans/execution-plan-v3-20260923.md §五 TK-1。
**状态：模板/机验器/7 样本/回归全部完成、证据落盘——等待编排者 L2 复核，不自称 DONE。**

---

## A. 交付物清单（白名单内，零越界）

| 文件 | 性质 | 内容 |
|---|---|---|
| `templates/task-v2.md` | 新建 | task 模板 v2：七字段定义表 + 机读格式约定 + 空白骨架 + 冻结/追加纪律 |
| `scripts/validate-task.mjs` | 新建 | 独立机验器（零依赖、只读），七字段逐项断言，exit 0/1/2 |
| `test-reports/autopilot-work/TK-1/` | 新建目录 | 合规样本 fx-01 + 违规样本 fx-02..fx-07 + 实跑日志 |

白名单外改动：无（SKILL.md / commands/ / webview/ / contracts/ / reference/ / plans/ / 其他 scripts / validate-structure.mjs 均未触碰；无 git 操作；未跑任何 BFX/FE 回归目录或探针）。

## B. 模板七字段定义摘要（详见 templates/task-v2.md §一）

| # | 字段 | 摘要 | 机验断言 |
|---|------|------|---------|
| 1 | `implementation_steps[]` | 1-7 步，每步 `{target, action, rationale}`（BMAD 文件-动作-理由） | 步数 ∈[1,7]；三键非空；target 工作区相对路径且真实存在 |
| 2 | `executor_acceptance[]` | ≥1 条 AC，每条附 `verify_command`（CLI+期望退出码） | ac/verify_command 非空；expected_exit 为 0-255 整数 |
| 3 | `trajectory_checkpoints[]` | 每步一个可观测中间产物 `{step, artifact, evidence}` | step 覆盖 1..N 全部 steps（缺/越界/重复均 FAIL） |
| 4 | `complexity_score` + `must_split` | 确定性口径：score = touched_files + dep_depth×2；must_split = (score>12 或 touched_files>5) | 四键必填且必须等于公式，**reject 逐任务 LLM 评分** |
| 5 | `boundaries` | Always/Never 各 ≤3 条 + edge_matrix ≥1 行 `{input, expected}` | 1-3 条断言 + 矩阵行完整性；批准后冻结只许追加（append-only） |
| 6 | `dev_record` | 执行者回填：changed_files + notes + deviations | status=completed 时强制：≥1 个改动文件且逐个存在，notes/deviations 非空 |
| 7 | `spec_budget` | 正文 token 上限（缺省 1200，CJK 加权量尺同 validate-structure H1） | 实测 token ≤ 上限；上限声明 >1200 即 FAIL；dev_record 回填不计入预算 |

机读格式：标量在 YAML frontmatter；五个结构化字段各为 ` ```json <字段名> ` 围栏块（合法 JSON，同名字段取首个）。

## C. 机验器 CLI 用法

```
node scripts/validate-task.mjs <task文档路径>
```

退出码：**0** = 七字段全部合规；**1** = FAIL（逐项断言输出，detail 指名字段）；**2** = 用法错误/文件不存在（实测两种情况 exit 均为 2）。`--verbose` 为预留开关（当前输出已逐项展开）。

设计取舍：独立脚本而非并入 validate-structure.mjs——前者面向单份 task 文档（阶段 5 派单即用、逐份调用），后者面向仓库结构一次性全检；职责分离避免全检脚本随 task 数量线性变慢。派单原文"validate-structure.mjs 增加断言"被重派指令"独立机验器"取代，以重派指令为准。

## D. 7 样本逐条实跑输出（完整日志：validate-task-fx-run.txt）

### fx-01-valid（合规样本，自指 TK-1 本单）

```
  [PASS] implementation_steps — 2 步，target 全部存在
  [PASS] executor_acceptance — 2 条，verify_command 齐备
  [PASS] trajectory_checkpoints — 2/2 步全覆盖
  [PASS] complexity_score+must_split — touched=2 depth=1 score=4 must_split=false（口径公式相符）
  [PASS] boundaries — always 3 / never 3 / edge_matrix 2 行（≤3 纪律相符）
  [PASS] dev_record — 2 个改动文件全部存在，notes/deviations 非空
  [PASS] spec_budget — 正文 893 tok ≤ 上限 1200
[OK] task 文档七字段机验通过      EXIT=0
```

### 六个违规样本（每份只植入一处缺陷，全部被抓且 detail 指名字段）

| 样本 | 植入缺陷 | 实跑 FAIL 输出 | EXIT |
|---|---|---|---|
| fx-02-missing-steps | 缺 implementation_steps 字段块 | `[FAIL] implementation_steps — 字段块缺失（须为 \`\`\`json implementation_steps 围栏块）`；连带 `trajectory_checkpoints — 覆盖核对不成立`（级联，如实登记） | 1 |
| fx-03-empty-verify-command | verify_command 空串 | `[FAIL] executor_acceptance — 条目1.verify_command 空; 条目2.expected_exit 须为 0-255 整数，实得 "zero"` | 1 |
| fx-04-checkpoint-gap | 2 步只有 1 个 checkpoint | `[FAIL] trajectory_checkpoints — 未覆盖 steps: 2（checkpoint 须覆盖全部 2 步）` | 1 |
| fx-05-complexity-missing | frontmatter 缺 complexity 四键 | `[FAIL] complexity_score+must_split — frontmatter 缺 complexity_touched_files, complexity_dep_depth, complexity_score, must_split` | 1 |
| fx-06-boundaries-over | never 4 条 | `[FAIL] boundaries — never 4 条超上限（≤3）` | 1 |
| fx-07-spec-budget-over | 正文 5569 tok | `[FAIL] spec_budget — 正文 5569 tok > 上限 1200（超限即拆 subtasks）` | 1 |

边界行为补充实测：无参数 → 用法行 + exit 2；文件不存在 → `文件不存在` + exit 2；模板自身（骨架含占位路径）→ 实得 FAIL exit 1（预期，骨架非合规文档，模板 §四已注明合规实例为 fx-01）。

## E. 回归结果（只跑一轮正式记录 + 一轮预检）

| 检查 | 结果 | 日志 |
|---|---|---|
| `node scripts/regression-all.mjs` | **13 PASS / 0 FAIL，exit 0**（S1..S13 全绿，含 S1 结构校验、S10 token gate、S11 引用链、S12 kickoff 漂移门） | regression.txt |
| `node scripts/validate-structure.mjs` | **[OK] 结构校验通过（0 项警告）**，exit 0；硬性断言含 H6a-1 reference 孤儿断言 0 孤儿 | validate-structure.txt |
| `node scripts/token-audit.mjs --gate` | PASS（12 文件 token 回退 <10%，快照对比不受新文件影响） | token-audit.txt |

新文件不触发既有门的验证：`templates/task-v2.md` 未进 token-audit 扫描清单（只扫 SKILL/commands/owner-review），validate-structure 的 templates 扫描为可移植性/悬空引用只读扫描（本模板无 owner-review 引用、无绝对路径、无 tab 损坏模式），regression 13 段无一段按 templates 文件计数。实测三脚本均 exit 0，确认零扰动。

## F. D-偏差登记

| # | 偏差 | 理由与处置 |
|---|---|---|
| D-TK1-1 | **模板落点 = `templates/task-v2.md`，未落 `reference/task-v2-template.md`，也未改 SKILL.md 指针表** | 派单担心 validate H6a-1 会把 templates 新文件当孤儿 FAIL——实测不成立：H6a-1 只断言 `reference/` 目录，templates 面不受管；重派指令亦明确禁改 SKILL.md 并指定落 `templates/`。模板已被 regression S1（可移植性/引用扫描）覆盖且全绿，SKILL.md 指针登记留给编排者后续按渐进披露纪律补（非本单白名单） |
| D-TK1-2 | 机验器为独立 `scripts/validate-task.mjs`，未在 validate-structure.mjs 内加断言 | 重派指令白名单明确"新建独立机验器"且禁改 validate-structure.mjs；取舍见 §C |
| D-TK1-3 | complexity 阈值定 **score>12 或 touched_files>5** | 派单只给口径（文件数+依赖深度）未给阈值；按"文件数是拆分主因、依赖深度加权 ×2"设定，写成机验器常量可断言；具体数值交 Owner 裁决 |
| D-TK1-4 | spec_budget 计量排除 dev_record 回填块；上限声明 >1200 也判 FAIL | dev_record 是执行后回填，计入会惩罚完工文档；"声明值超 1200"若放行会架空 v2 定额 |
| D-TK1-5 | boundaries "批准后 diff 只许追加"在文件级机验器中不做历史 diff | 单文件校验器无前版本可比对；append-only 由编排者提交时 diff 核对 + L2 复核承担，模板 §五已写明责任边界；机验器覆盖其可静态断言部分（≤3 条 + 矩阵完整） |
| D-TK1-6 | 沿用重派指令的 6 类违规样本（缺 steps / verify_command 空 / checkpoints 不覆盖 / complexity 未填 / boundaries 超 3 / spec_budget 超限），未复刻派单原第 6 类"dev_record 缺" | 重派指令为准；dev_record 缺失路径仍有机验覆盖（status=completed 时 FAIL），fx-01 合规样本含完整 dev_record 反向证明该分支可达 |
