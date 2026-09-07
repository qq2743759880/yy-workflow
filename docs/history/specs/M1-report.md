# M1 里程碑实现报告 — 自动任务拆解（辅助建议模式）+ 终端交互审批

- 版本：M1（FR-1 + FR-2 + FR-3）
- 日期：2026-09-02
- 执行方：TT 工作流独立实现子 agent
- 基线：TT 2.3.0（回归 8/8，validate 0 警告 0 泄露）
- 硬约束执行：零外部依赖（仅 node 内置 fs/path/os/readline/child_process）；未改 `scripts/lib/state.mjs` 状态机（用 `approvedAt` + 逐 task `approved` 字段表达审批，不动 TRANSITIONS）；未提交、未 push。

---

## 1. 实现文件清单

| 文件 | 类型 | 职责 |
|---|---|---|
| `scripts/lib/deconstruct.mjs` | 新增 | 自动拆解引擎（FR-1）：三层拆解 prompt 生成、草案提取、schema + 资产白名单 + 依赖完整性 + 并行判据硬门槛校验、草案归一化为 plan 兼容对象、拆解流程入口（宿主 / 手动两种模式） |
| `scripts/lib/approve.mjs` | 新增 | 终端逐 task 审批（FR-2）：首屏结构摘要（phase/task/lane/估算汇总）、y/n/e/a 交互、n 的三选一处置、e 编辑、非 TTY 降级。原生 `node:readline`，行缓冲队列防批量输入丢行 |
| `scripts/orchestrator.mjs` | 修改 | parseArgs 新增 `--plan`/`--draft`；`--plan` 与 `--resume` 互斥约束；`--plan` 流程接入 main（拆解→审批→归一化→freezeContract→既有执行路径）；`--plan --dry-run` 只打印不写文件；本地常量 `EXIT_APPROVAL_ABORTED=6` |
| `scripts/lib/planner.mjs` | 修改 | `buildPlan` 产物新增可空字段 `desc/estimate/lane/approved`（默认 undefined，无新字段行为与 2.3.0 一致，向后兼容） |
| `vendor/dev-planner/dev-planner.md` | 修改 | 新增「自动拆解模式（Auto-Decompose Mode）」章节：三层（intent→phase→task/lane）+ S.U.P.E.R + 并行判据 + S/M/L 估算 + 严格 JSON 输出契约。frontmatter/version 未动（S3 漂移门不破） |

> 未改动 `scripts/lib/state.mjs`（TRANSITIONS 原样）；`errors.mjs` 未改（审批中止码以 orchestrator 本地常量表达）。

---

## 2. 校验三态实测（FR-1 GWT，模块级单测 23/23 PASS）

用最小草案 JSON 逐项构造，`validateDraft` 实测：

| 用例 | 期望 | 实测 |
|---|---|---|
| 合法草案（2 phase/3 task，含 dependsOn） | 通过 | ✅ 返回 `{ok:true}` |
| 缺 `desc` | 拒绝并报具体项 | ✅ `phases[0].tasks[0] 缺少 desc（必需，须具体到可开工）` |
| 空 phase（tasks=[]） | 拒绝 | ✅ `phases[1] 的 tasks 必须为 ≥ 1 个 task 的数组` |
| 依赖引用不存在的 id（`t99`） | 拒绝 | ✅ `task t2 依赖不存在的 id: "t99"` |
| 依赖环（t1↔t2） | 拒绝 | ✅ `依赖存在环（拓扑排序无法完成）` |
| asset 不在白名单（`be-hacker`） | 拒绝并列出可用资产 | ✅ `asset 不在白名单: "be-hacker"（可用资产: …16 项）` |
| 同 lane >4 tasks | 拒绝 | ✅ `lane "a" 有 5 个 task > 4` |
| 总 lane >4 | 拒绝 | ✅ `lane 数 5 > 4` |
| 同 phase 跨 lane 依赖 | 拒绝 | ✅ `task t2（lane b）依赖同 phase 跨 lane 的 t1（lane a）` |
| `draft != true` | 拒绝 | ✅ `draft 必须为 true` |
| estimate 小写 `s` | 通过并归一化大写 | ✅ 校验通过，normalize 后 `estimate:'S'` |

归一化实测：`normalizeDraft` 产出 `{id, task, cluster:'deconstructed', contract, requireExec:false, phases, phaseNames, subtasks, status:'planning', createdAt, approvedAt, deconstructed:true}`；subtask 含 `id/planId/asset/contract/status/artifactPath/attempts/phase/dependsOn/desc/estimate/lane/approved/note`；`dependsOn` 引用真实 subtask.id（`plan-xxx-0`），phase 索引正确。`extractDraft` 支持 ```json 代码块 / 纯 JSON / 正文中平衡 JSON 提取。

**校验失败处理**：校验不过一律整份拒绝并输出具体错误项，绝不静默修正进入审批（批判 C4 回灌，FR-1 行为）。

---

## 3. 审批交互实测（FR-2 GWT，TT_APPROVE_FORCE_TTY 脚本化 stdin）

逐条用真实 `orchestrator --plan --draft <file>` + 管道 stdin 实测：

| 场景 | stdin | 结果 |
|---|---|---|
| 逐 task 全 y | `y y y` | ✅ 生成正式 plan，3 个 subtask 全 `approved:true`，`contractMode:'frozen'`，`contracts/<planId>.json` 生成，进入执行，exit 0 |
| 剩余全批准 | `a` | ✅ `剩余全部批准（3/3）`，全部冻结并执行 |
| 编辑 e | `e` + 改 desc/estimate | ✅ t1 `desc=edited-desc-123`、`estimate=M→L`，其余 task 不受影响，冻结执行 |
| 拒绝 n → 回拆解 | `n` + 空原因 + `1` | ✅ `审批中止（已选择回拆解）`，退出码 6，无 state.json、无 contracts |
| 拒绝 n → 保持现状 | `n` + `2` | ✅ t1 `note=rejected` 但 `approved:true`，plan 照常冻结（拒绝原因保留） |
| 非 TTY 降级 | stdin 非 TTY（无强制开关） | ✅ 打印草案 + 审批摘要 + 提示，不崩溃，exit 6，无文件写入 |

**readline 竞态修复（实测发现）**：批量到达 stdin 时，`rl.question` 在无挂起 question 期间到达的行会被 readline 以 `'line'` 事件丢给零监听者而丢失（首次 y/y/y 只消费了 2 行即卡死）。改为自维护行缓冲队列（`line` 事件一律入队或喂给挂起等待者），y/y/y 全链路跑通。

**真实终端说明（诚实标注）**：本环境为非 TTY 管道，无法在真人终端逐键验证；交互逻辑通过脚本化 stdin（`TT_APPROVE_FORCE_TTY=1`）覆盖 y/n/e/a 全分支 + 非 TTY 降级路径验证。真人终端行为与脚本输入走同一 `readline` 代码路径。

---

## 4. 回归结果（FR-3 GWT）

- `node scripts/validate-structure.mjs`：**0 警告 0 泄露**（新增文件不含本机绝对路径，可移植性扫描通过）。
- `node scripts/regression-all.mjs`：**8/8 PASS**（S1 结构 / S2 retry / S3 替换清单 / S4 契约冻结 / S5 宿主执行 / S6 资产缓存 / S7 review-gate / S8 资产消费证据）。
- `node scripts/ci.mjs`：**CI PASS**（S1–S4 全过）。
- 无 `--plan` 时行为与 2.3.0 一致（回归 S4/S5/S8 均含既有 `buildPlan` 路径，全绿）。
- `--resume` 恢复审批生成的 plan：已完成 subtask 跳过（`already done`）、未完成 subtask 按 phase 续跑（把 phase-2 子任务置 idle 后 resume，仅其重跑，exit 0）。
- `--plan --dry-run`：只打印草案与审批摘要，workspace 零文件写入；`--plan --dry-run --exec`（宿主拆解）写入 OS 临时目录并清理，真实 workspace 零污染。

---

## 5. 与 PRD FR-1～FR-3 GWT 对照

### FR-1 自动拆解引擎

| GWT | 结果 | 证据 |
|---|---|---|
| Given 大任务；When 拆解引擎；Then 产 ≥1 phase、每 phase ≥1 task、task 均带 phase/dependsOn/estimate/desc，依赖图无环、dependsOn 引用均存在 | ✅ | 模块级 23/23 PASS（合法草案 2 phase/3 task + 无环 + 引用存在）；host/手动两模式端到端跑通 |
| Given 同一并行组 ≥2 task；When 校验并行判据；Then lane 标注一致且 ≤4 lanes，跨 lane 任务无共享产物依赖 | ✅ | `≤4 lanes`、`同 lane ≤4`、`同 phase 跨 lane 依赖` 三项校验实测通过 |
| Given 草案缺失必需字段或依赖引用不存在 id；When schema/完整性校验；Then 拒绝并输出具体错误，不进入审批 | ✅ | 缺 desc/缺 asset/draft!=true/引用 t99/依赖环 均拒绝且报具体项；exit 6、无文件 |

### FR-2 终端交互审批

| GWT | 结果 | 证据 |
|---|---|---|
| Given N 个 task；When 逐 task y 至最后；Then 生成正式 plan、逐 task approved:true、contractMode:'frozen'、contracts/<planId>.json、进入执行 | ✅ | `y y y` 实测：approved 全 true、contracts/plan-mtiwqc0u.json 生成、执行 done、exit 0 |
| Given 审批中某 task 输入 e；When 编辑 estimate 与 desc 保存；Then 该 task 以编辑后内容冻结，其余不受影响 | ✅ | `e` 实测：t1 desc=edited-desc-123、est=L，t2/t3 原样，冻结执行 |
| Given 审批中某 task 输入 n；When 选择回拆解；Then 不产生正式 plan、不写 contracts、退出码审批中止语义 | ✅ | `n`+`1` 实测：exit 6，无 state.json、无 contracts |
| Given 大 plan（>20 task）；When 输入 a；Then 余下未审 task 全部批准并冻结 | ✅ | `a` 实测：`剩余全部批准（3/3）` 冻结执行（快捷逻辑与 task 数无关，>20 同理） |

### FR-3 plan 兼容（不破回归）

| GWT | 结果 | 证据 |
|---|---|---|
| Given 含新字段的审批后 plan；When regression-all；Then S1–S8 全 PASS（含 S4 契约冻结、S5 宿主执行、S8 资产消费证据） | ✅ | regression-all 8/8 PASS，S4/S5/S8 明细见 §4 |
| Given 审批后 plan 已冻结并中断执行；When --resume 恢复；Then 已完成 task 跳过、未完成按 phase/dependsOn 续跑，状态语义一致 | ✅ | 将 phase-2 subtask 置 idle 后 resume：done 跳过、pending 续跑，exit 0 |
| Given --plan 流程；When 组合 --dry-run；Then 不写 state.json/contracts/产物，仅打印草案与审批摘要 | ✅ | `--plan --dry-run` workspace 零文件；`--plan --dry-run --exec` 走临时目录并清理 |

---

## 6. 诚实声明 / 已知边界

1. **真实终端交互未在真人终端验证**：本环境非 TTY。y/n/e/a 全分支经脚本化 stdin 验证，非 TTY 降级路径单独验证；真人终端与脚本共用同一 readline 路径。
2. **`dependsOn` 为元数据、执行按 phase 排序**：与既有 TT 语义一致（runtime 按 phase 分组执行，dependsOn 供 DAG/报告展示）。审批中编辑 phase 会把 task 移动到对应执行组。
3. **审批中止码 `6` 为 orchestrator 本地常量**（`EXIT_APPROVAL_ABORTED`），未改动 `errors.mjs`（符合文件改动约束）。
4. **`n → 保持现状`**：记录拒绝原因（`subtask.note`）但仍标 approved 继续——语义是"用户反对但接受现状继续"，报告如实保留 note。
5. **手动模式 stdin 粘贴路径**：JSON 从 stdin 读入后 stdin 已 EOF，审批自动降级为非交互（打印草案+摘要、exit 6）——需在同一终端用 `--plan --draft <file>` 完成交互审批（这是文档推荐路径）。脚本/CI 可用 `--draft <file>` + `TT_APPROVE_FORCE_TTY=1` 管道 stdin。
6. **`--plan --dry-run --exec`** 会在 OS 临时目录短暂写 brief 并立即清理，真实 workspace 零写入（满足"不写 state/contracts/产物"GWT）。
7. 仓库根出现 `.yy-project/` 未跟踪目录（含用户 Snipaste 截图，2026-09-02 0:59 创建，会话期间并发产生），与 M1 无关、非本实现创建、未触碰；本实现未向仓库根写入任何状态/产物。
