# CR-1 执行结果 — 批判协议 v2（批 0）

执行：L1 独立 agent（第四次派发，全新上下文，2026-09-23）。派单：`handoffs/v3/CR-1-dispatch.md` + 编排者浓缩规格。
状态：**已执行完毕，待 L2 复核——不自称 DONE。**

## 一、改动点（白名单内）

### 1. `scripts/review-gate.mjs`（唯一脚本改动）
- 新增 `--critique-sources <path>[,<path>...]|none`：来源=ON-1 向导落盘的 `orchestrator.config.yaml` `critique.sources` 段。给路径 → 全局 knowledge-base 绑定；字面 `none` → 全局 source=none，每条批判强制含「本批判无外部源，仅基于项目内部资料」标注（缺标注判 INVALID，不静默）。
- 新增 `--rubric <rubric.json>`：批判评估口径，结构机验（criteria ≥1 / id name 非空 / weight 非负数且总和>0），非法 FAIL 具名。
- 三元绑定 `claim→evidence→source`（`checkCritiqueBinding`，fail-closed）：条目可用 `source:` 标签逐条声明（枚举 knowledge-base/search-tool/standard-doc/none，`knowledge-base:路径` 或裸路径归 knowledge-base）；无任何 source（条目未声明且无全局绑定）判 **INVALID**，detail 指名条目与原因；evidence=URL+日期（既有硬闸门）或显式 `evidence:` 声明。`--critique-sources`/`--rubric` 任一在场即启用，未过 exit 1（优先于 URL 真验）。
- 新增 `--convert-critique <批判文档> [--out <目录>]`：批判转 task，**内置七字段断言**（`assertTaskSevenFields`，口径对齐 `templates/task-v2.md`，不 import `scripts/validate-task.mjs`）：implementation_steps 1-7 步且 target 为工作区相对路径真实存在 / executor_acceptance verify_command 非空 + expected_exit 0-255 / trajectory_checkpoints 覆盖全部 steps / complexity_score= touched+dep×2 与 must_split 规则 / boundaries 1-3 条 + edge_matrix ≥1 行。缺 implementation_steps（条目无优化方案）→ **拒绝落盘 exit 1**（detail 指名条目）；任一断言失败全拒（原子）。
- 新增 `--tracker-stats <tracker路径>`：v2 看板机读统计（收录数/各状态计数/转化率/无 source 计数）+ CR1-STATS 块透传。
- 新增导出：`SOURCE_ENUM` / `NO_SOURCE_NOTE` / `parseSourceLabel` / `checkCritiqueBinding` / `checkRubric` / `parseTrackerStatsBlock` / `computeTrackerStats` / `assertTaskSevenFields` / `entryToTaskDoc` / `renderTaskDoc` / `convertCritique`。
- self-test 扩充 4 组断言（含 source 通过 / 缺 source INVALID 指名 / none 标注 / 非法枚举；rubric 三态；看板统计含历史行隔离；转化拒绝+合规+断言具名），S7 回归真跑绿。
- 既有行为零改动：不给新参数时全部走原路径（`parseCritiqueEntries` 仅追加 `text` 字段，纯增量）。

### 2. `plans/critique-backlog-tracker.md`（仅模板面）
- 末尾追加「批判协议 v2 三元绑定看板（CR-1）」节：v2 字段模板（claim/evidence/source/severity/status 五态/converted_task_id/实施方案引用）+ 占位示例行 + `<!-- CR1-STATS ... -->` 机读统计块。**既有 M1/M2/M2-R2 登记行一字未动**（追加式编辑；v2 统计只扫「批判协议 v2」节内行，历史 `| C-` 行不参与，validate H8 口径不变）。

### 3. `test-reports/autopilot-work/CR-1/`（证据目录）
- `rubric-sample.json`（4 criteria，Σweight=100）；样本：`sample-critique-with-source.md` / `sample-critique-missing-source.md` / `sample-critique-lack-steps.md` / `kanban-sample.md`；转化单产出 `converted-tasks/`（3 份）；测试输出 `test1~test4-*.txt`。

## 二、自测 4 项（证据均落本目录）

| # | 项 | 证据文件 | 结论 |
|---|----|---------|------|
| ① | 源绑定 | `test1-source-binding-pass.txt`（exit 0：3 条三元绑定逐条 PASS，rubric 4 条 PASS）/ `test1-source-binding-fail.txt`（exit 1：条目2「缺源批判」具名 INVALID——source=none 无标注不得静默；纯「缺 source」INVALID 指名路径在 self-test 断言内）/ `test1-rubric-invalid.txt`（exit 1：criteria[0] weight 非法具名） | PASS |
| ② | 看板统计 | `test2-kanban-stats.txt`：total=5 registered=1 accepted=1 converted=1 done=1 rejected=1 conversionRate=40% noSource=2（>0），CR1-STATS 块透传一致，exit 0；历史 `| C-` 行不混入 | PASS |
| ③ | 转化纪律 | `test3-convert-refused.txt`：缺 implementation_steps 条目具名 REFUSED、exit 1、输出目录 0 文件（未落盘）；`test3-convert-accepted.txt`：合规落盘 3 份、exit 0，`converted-tasks/critique-convert-01-task.md` 实查含七字段 + `verify_command: node scripts/review-gate.mjs --self-test` + `expected_exit: 0` | PASS |
| ④ | 回归 | `test4-regression-all.txt`：**13 PASS / 0 FAIL**，其中 S7 review-gate 真跑绿（`PASS S7 review-gate  self-test ✓ 填好plan→PASS ✓ 模板未填→拦截 ✓`）；`test4-validate-structure.txt`：**0 项警告**（exit 0，H8 批判落地率断言含新模板面后仍过） | PASS |

## 三、D-xxx 偏差

- **D-01**：CLI 层三元绑定校验仅在 `--critique-sources`/`--rubric` 显式在场时启用；完全不传参保持 legacy 行为（向后兼容既有工作区与 S7 回归）。纯「条目必须自带 source，缺失即 INVALID」语义由 `checkCritiqueBinding({critiqueSources:null})` 承担，已进 self-test 与导出面，供编排者直调。
- **D-02**：真实 tracker v2 段升级后尚无入库行，`--tracker-stats plans/critique-backlog-tracker.md` 返回 total=0 / exit 1（见 `test2-kanban-real-tracker.txt`）——属「模板面先行、待新批判入库」的预期态，非缺陷。
- **D-03**：转化单 implementation_steps.target 取原批判文件（工作区相对路径且真实存在，满足 task-v2 机验口径），条目「优化方案」文本作为 action；真实落点文件由执行者经 dev_record 回填。
- **D-04**：rubric 机验只强制 Σweight>0（不强制=100），样例文件取 Σ=100。

## 四、未覆盖 / 移交 L2

- `--verify-urls` 网络真验与 CR-1 校验的组合顺序（binding 优先 FAIL）已实现但未做联网实测（沙箱环境不依赖外网）。
- 真实 tracker 首批 v2 批判入库与 CR1-STATS 人工回填同步，属后续批判批次动作。
