# HANDOFF-P1：多平台并行 DAG 调度 + 契约先行流水线

> 转交：执行 agent（opencode / Claude Code / Codex 任一）
> 交付：本文件 + 仓库现状（commit `e17233e`）
> 目标：把 orchestrator 的 plan 从线性链升级为依赖 DAG，支持**可选并行**执行独立子任务；契约先行流水线落地为代码。
> 红线：**不破坏三轮独立验收确立的诚实性保证**（mode 标注、契约 gate、resume、报告、regression-all 6/6）。

---

## 0. 你的角色与纪律

你是执行 agent，负责实现 P1。规则：
- **只读了解**，改动仅限本文件「改动范围」列出的文件；不要动 vendor/ 资产、不要动三轮验收文档。
- 每步改完**必须跑** `node scripts/regression-all.mjs`，保持 6/6 PASS（这是卡点，坏了先修）。
- 不新增 npm 依赖（纯 Node 零依赖）。
- 完成后更新 `.claude/specs/dev-tt-execution-trust.md` 的执行记录。

## 1. 背景与目标

现状（commit `e17233e`）：
- `planner.mjs buildPlan` 把 cluster 的 `candidates` 顺序展开为 `plan.subtasks`（线性链）。
- `runtime.mjs executePlan` 用串行 for 循环依次执行；`dispatch` 负责 adapter 解析、契约 gate、mode 标注。
- 已具备：契约机器冻结（`contracts/<planId>.json` + hash 比对 + 篡改 exit 4）、`--exec` 宿主通道（brief→宿主 CLI→产物）、resume、报告。

目标（L3 可选并行）：
1. plan 结构支持**依赖 DAG**：每个 subtask 带 `dependsOn: [subtaskId...]` 与 `phase` 编号；同 phase 内无相互依赖 = 可并行，跨 phase 串行。
2. `executePlan` 按依赖调度：每轮取「依赖已全部完成」的子任务**并行**执行（Promise.all，受并发上限约束）；串行执行是 `--parallel` 未开启时的默认（完全向后兼容）。
3. **契约先行流水线代码化**：依赖关系的「契约已验收」解锁在 DAG 调度里自然表达（依赖子任务 done 即解锁，与契约 gate 一致）。
4. 可选模式：`--parallel [N]`（N=并发上限，默认 phase 内全部）；不传 = 串行（现状行为）。L1 人工跨平台派单通道保持不变（本任务不做远程派单）。

## 2. 必读文件（先读全再动手）

- `scripts/lib/planner.mjs`（30 行）——buildPlan 生成 subtasks
- `scripts/lib/matrix.mjs`——CLUSTERS 定义（candidates 顺序）
- `scripts/lib/runtime.mjs`（70 行）——executePlan / dispatch（mode 标注、gate、ctx）
- `scripts/lib/report.mjs`——报告（modes 摘要）
- `scripts/orchestrator.mjs`——CLI 参数、freezeContract、resume
- `scripts/regression-all.mjs`——回归卡点（S3/S4/S5/S6 断言依赖现有行为）
- `scripts/lib/gate.mjs`——契约 gate（before/after 已按 workspace 解析，勿改）

## 3. 设计要求

### 3.1 DAG 结构（planner.mjs + matrix.mjs）
- `matrix.mjs` 的 CLUSTERS：给每个 cluster 增加 `phases`（二维数组：阶段 → 该阶段可并行的 candidates），或保留 `candidates` + 新增 `phaseOf` 映射。**二选一，选改动最小的**。默认若未定义 phases，退化为「每个 subtask 独立 phase」= 完全串行（与现状一致）。
- 建议初始 phase 划分（可调整，须保留每个候选只出现一次）：
  - T1_DATABASE: `[['be-architect'], ['implementation','be-provider'], ['be-validator','sdlc']]`
  - T2_BACKEND: `[['be-architect'], ['implementation','be-provider','be-resilience','security'], ['sdlc','review'], ['be-validator']]`
  - T3_AI_RAG_MCP: `[['be-provider'], ['implementation','agent-research'], ['be-validator','dev-planner']]`
  - T4_FRONTEND: `[['frontend-design'], ['frontend-visual-validation','colorize','planning'], ['review','security','agent-vision-toolkit']]`
  - T5_OPS: `[['be-resilience','security','skill-sentinel'], ['be-validator','review']]`
- `buildPlan` 展开 phases → subtasks，每个带：
  - `phase: 0..n-1`
  - `dependsOn: [前一个 phase 的所有 subtask.id]`（第一 phase 为空数组 = 可并行）
  - 其余字段不变（id/planId/asset/contract/status/mode/attempts/adapter）
- **向后兼容**：不传 `--parallel` 时 executePlan 必须与现状输出完全一致（顺序、mode、报告、resume）。

### 3.2 并行执行（runtime.mjs）
- 新增 `executePlan` 的调度循环：按 phase 从 0..n-1 推进；每 phase 内取「status!=='done'」的子任务，受并发上限（`--parallel N`，默认不传=1 即串行）约束并行 `dispatch`。
- 并行安全：
  - `ctx`（context bus）跨子任务写入 `artifact:<id>`——Map.set 在单进程事件循环下无竞态，**不要加锁**。
  - 契约 gate：`gate.before` 在 dispatch 内执行，并行子任务共享同一契约文件只读，无冲突。
  - 日志：并发时 logger 输出会交错——可接受，不改 logger。
  - 上游产物引用：跨 phase 才有，phase 内互不依赖，`ctx.dump()` 在并行时读到的是「到当前时刻已 set 的产物」——phase 内无上游引用，安全。
- 失败语义保持：某子任务 failed → 整个 plan 停（现状行为）；某子任务 skipped → 继续。
- resume 保持：`--resume` 只重试非 done；done 的 subtask 无论并行与否都跳过。

### 3.3 CLI（orchestrator.mjs）
- 新增 `--parallel [N]`：`N` 缺省=全部并行（phase 内无上限）；`N` 为 0/非法 → exit 2；不传 = 串行（默认）。
- `usage()` 更新。
- dry-run 行为不变（不写文件、不执行宿主）。

### 3.4 报告（report.mjs）
- 无需改结构（modes 已按 subtask.mode 聚合）。确认并行执行后 modes 统计正确即可。

## 4. 验收标准（GWT，执行 agent 自测）

- **G1 串行兼容**：Given 不带 `--parallel`；When `node scripts/orchestrator.mjs --task "backend login module"`；Then 行为与现状一致（顺序执行、modes={prompt:5,skipped:2,planned-only:1}、exit 0）。对比 commit `e17233e` 的 state.json 字段差异（仅新增 phase/dependsOn，mode/adapter/artifactPath 不变）。
- **G2 并行生效**：Given `--parallel`；When 同任务；Then state.json 中 phase>0 的子任务全部完成，且 phase 内并行（可用 `--verbose` 观察 start 时间戳重叠 或注入并发计数探针）；跨 phase 严格串行。
- **G3 resume 并行语义**：Given 一个混合状态 plan（部分 done 部分 skipped）；When `--resume --parallel`；Then 只重试非 done，done 不重跑，phase 调度正确。
- **G4 契约 gate 不破**：并行下执行期篡改契约 → exit 4（复用 regression S4 的 tamper 命令）；契约不变 → exit 0。
- **G5 回归**：`node scripts/regression-all.mjs` **6/6 PASS**（若 S3/S4 依赖 phase 顺序，需同步适配——S4 的 tamper 推导 planId 依赖「簇内首个资产为 prompt 兜底」，T2 第一 phase 是 `be-architect`（prompt 兜底），兼容）。
- **G6 参数面**：`--parallel 0`/`--parallel abc` → exit 2；`--parallel`（缺省）→ 正常运行。

## 5. 改动范围（仅限）

- `scripts/lib/planner.mjs`
- `scripts/lib/matrix.mjs`
- `scripts/lib/runtime.mjs`
- `scripts/orchestrator.mjs`
- （可选）`scripts/regression-all.mjs`（仅当 S3/S4 需适配；若适配，不得削弱原有断言）
- `.claude/specs/dev-tt-execution-trust.md`（记录执行）

**禁止**：改 `gate.mjs` 的契约语义、改 vendor/ 资产、改报告诚实性（mode 五态/警告）、加依赖。

## 6. 交付物

1. 代码改动（满足 §4 全部 GWT）。
2. 执行记录：`.claude/specs/dev-tt-execution-trust.md` 追加 P1 小节（改动文件 + GWT 自测证据命令输出）。
3. 若改动了 regression-all 适配，说明理由。
