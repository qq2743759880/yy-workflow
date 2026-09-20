# P1-C IO 口径调用率基线报告（接线前）

- 日期：2026-09-20
- 任务：T5 P1-C 基线跑
- 沙箱项目：`test-reports/rebuild-20260920/io-baseline/sandbox-project/`
- 测试任务：TODO 工具后端 API（RESTful + JWT + SQLite，T2_BACKEND 簇）
- N = 3 轮/阶段，共 18 份 JSONL

## 协议执行说明（诚实声明）

### 实际怎么跑的

1. **沙箱项目**：在白名单目录下建了 `sandbox-project/`，写入 `task.md`（TODO 后端 API 需求）。
2. **环境注入**：每轮通过外层 PowerShell 设置 `NODE_OPTIONS=--import file:///<repo>/scripts/lib/io-audit-hook.mjs`，
   子进程 `execFileSync` 继承此变量；每轮 `YY_IO_AUDIT_DIR` 指向独立的 `runs/stageN-runK/io-audit.jsonl`。
3. **每轮执行的命令**（在 sandbox-project cwd 下）：
   - `node scripts/tt-journey.mjs --prereq-check --step <N>`（前置机验；因每轮重置 .tt-state，恒报"journey 未初始化" exit 1，不读 vendor 文件）
   - `node scripts/detect-platforms.mjs`（仅 stage0-run1/2/3；探测 home 目录平台，不读 vendor）
   - `node scripts/orchestrator.mjs --task "..." --workspace <sandbox> --dry-run --no-tui`（路由+资产加载，不派子代理）
4. **"本会话模拟而非真派单"的诚实声明**：
   - 本会话（Doubao）作为 agent 模拟执行 6 阶段指令，**未实际派发 claude/codex/openclaw 外部子代理**。
   - orchestrator 以 `--dry-run` 运行：它会 buildManifest + buildPlan + loadAssets + executePlan(dry)，但不真实调用外部 API。
   - 本会话自身的 Read 工具调用（读 vendor SKILL.md）**不经过 Node fs hook，不计入 JSONL**——这正是 P1 遗留 #1 描述的盲区。
   - 每轮开始前重置 sandbox-project/.tt-state（删目录重建），保证轮间独立。
5. **prereq-check 恒失败**：因为每轮重置 journey 状态，`--prereq-check` 报"journey 未初始化"。这不影响 vendor IO 测量（prereq-check 只读 .tt-state/journey.json，不读 vendor/）。

### 每轮 JSONL 记录数

| 阶段 | run1 | run2 | run3 | 中位数 |
|---|---|---|---|---|
| 0 | 36 | 36 | 36 | 36 |
| 1 | 36 | 36 | 36 | 36 |
| 2 | 36 | 36 | 36 | 36 |
| 3 | 36 | 36 | 36 | 36 |
| 4 | 36 | 36 | 36 | 36 |
| 5 | 36 | 36 | 36 | 36 |

## 阶段 × 资产 consumption 矩阵（18 轮中位数）

单元格 = consumption 中位数（routing 均为 0，见下节说明）。

| 阶段 | agent-research | agent-vision-toolkit | be-architect | be-provider | be-resilience | be-validator | colorize | dev-planner | frontend-design | frontend-visual-validation | implementation | planning | review | sdlc | security | skill-sentinel |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 1 | 1 | 4 | 4 | 4 | 4 | 1 | 2 | 1 | 1 | 4 | 1 | 2 | 2 | 2 | 1 |
| 1 | 1 | 1 | 4 | 4 | 4 | 4 | 1 | 2 | 1 | 1 | 4 | 1 | 2 | 2 | 2 | 1 |
| 2 | 1 | 1 | 4 | 4 | 4 | 4 | 1 | 2 | 1 | 1 | 4 | 1 | 2 | 2 | 2 | 1 |
| 3 | 1 | 1 | 4 | 4 | 4 | 4 | 1 | 2 | 1 | 1 | 4 | 1 | 2 | 2 | 2 | 1 |
| 4 | 1 | 1 | 4 | 4 | 4 | 4 | 1 | 2 | 1 | 1 | 4 | 1 | 2 | 2 | 2 | 1 |
| 5 | 1 | 1 | 4 | 4 | 4 | 4 | 1 | 2 | 1 | 1 | 4 | 1 | 2 | 2 | 2 | 1 |

## routing / consumption 比

- 跨 6 阶段 × 16 资产的中位数汇总：routing = 0，consumption = 210
- routing/consumption 比 = 0.0%

**为什么 routing 全为 0**：hook 的 caller 归类逻辑是"调用栈 basename 精确匹配 matrix.mjs / asset-call-rate.mjs / ci.mjs / io-audit-hook.mjs → routing"。
本次测量中，vendor 文件读取由 `orchestrator.mjs → lib/manifest.mjs`（buildManifest）和 `orchestrator.mjs → lib/asset.mjs`（loadAssets）发起，
栈帧 basename 是 `orchestrator.mjs` / `manifest.mjs` / `asset.mjs`，均不在 routing 集合中 → 全部标为 consumption。
这是 P1 遗留 #3 的直接实证：caller 归类启发式把"路由系统自身的资产加载"误判为 consumption。

## 16 资产零调用清单

全部 16 资产在 6 阶段 × 3 轮中均被读取过（consumption 中位数 > 0）。

**注意**：所有 16 资产都被 buildManifest() 全量扫描读取（readdir vendor/ + 读每个 SKILL.md），
因此没有零调用资产。但这不代表这些资产被"有效消费"——buildManifest 只是探测存在性，
loadAssets 进一步读取了 T2_BACKEND 簇路由到的 8 个资产（be-architect, be-provider, be-resilience, be-validator, implementation, sdlc, review, security）。

## 与"声明口径"并排对比表

声明口径 = `asset-call-rate.mjs --task "<阶段指令>"` 的路由模拟结果。

| 阶段 | 声明口径路由结果 | 实测 consumption 中位数（被 orchestrator 读取） |
|---|---|---|
| 0 "盘点资产与平台，只做需求澄清不写代码" | 0 资产（no cluster match） | 16 / 16 资产 |
| 1 "逐轮挖掘需求产出概念版" | 0 资产（no cluster match） | 16 / 16 资产 |
| 2 "前提挑战后拆任务" | 0 资产（no cluster match） | 16 / 16 资产 |
| 3 "规划并冻结契约" | 0 资产（no cluster match） | 16 / 16 资产 |
| 4 "派单执行并独立实证验收" | 0 资产（no cluster match） | 16 / 16 资产 |
| 5 "强制技术批判对标竞品" | 0 资产（no cluster match） | 16 / 16 资产 |

### 声明口径详情

全部 6 条阶段指令传入 `asset-call-rate.mjs --task` 后，orchestrator 均报 `[tt] no match: no matching asset`，
退出码 5。原因：6 条指令是阶段流程指令（如"盘点资产与平台"），不含任何簇关键词（backend/api/login/database/ai/frontend/ops 等），
keyword matcher 无法路由。这本身就是发现：**路由系统的 keyword 匹配对阶段级指令完全失效**。

### 实测 consumption 分布

虽然声明路由 0 资产，但 orchestrator 在 buildManifest 阶段全量读取了全部 16 资产的 SKILL.md（各 2 次：一次 existsSync 探测后的 readFile，一次 loadAssets），
其中 T2_BACKEND 路由到的 8 个资产被 loadAssets 额外加载正文（各 4-6 次）。

| 资产 | consumption 中位数（全部 6 阶段一致） | 说明 |
|---|---|---|
| agent-research | 1 | 非路由资产（仅 buildManifest 探测） |
| agent-vision-toolkit | 1 | 非路由资产（仅 buildManifest 探测） |
| be-architect | 4 | T2_BACKEND 路由资产（loadAssets 正文加载） |
| be-provider | 4 | T2_BACKEND 路由资产（loadAssets 正文加载） |
| be-resilience | 4 | T2_BACKEND 路由资产（loadAssets 正文加载） |
| be-validator | 4 | T2_BACKEND 路由资产（loadAssets 正文加载） |
| colorize | 1 | 非路由资产（仅 buildManifest 探测） |
| dev-planner | 2 | 非路由资产（仅 buildManifest 探测） |
| frontend-design | 1 | 非路由资产（仅 buildManifest 探测） |
| frontend-visual-validation | 1 | 非路由资产（仅 buildManifest 探测） |
| implementation | 4 | T2_BACKEND 路由资产（loadAssets 正文加载） |
| planning | 1 | 非路由资产（仅 buildManifest 探测） |
| review | 2 | T2_BACKEND 路由资产（loadAssets 正文加载） |
| sdlc | 2 | T2_BACKEND 路由资产（loadAssets 正文加载） |
| security | 2 | T2_BACKEND 路由资产（loadAssets 正文加载） |
| skill-sentinel | 1 | 非路由资产（仅 buildManifest 探测） |

## 局限申报

1. **agent Read 工具盲区**（P1 #1）：本会话 Doubao 的 Read 工具调用不经过 Node fs hook，不计入 JSONL。
   真实会话中 agent 阅读 vendor SKILL.md 的动作完全不可见，本报告测的是"Node 子进程侧"的 vendor 读取。
2. **caller 归类误判**（P1 #3）：orchestrator 的 manifest/asset 加载全部标为 consumption，无 routing 分类。
   真实 routing（matrix 扫描）与 consumption（面向使用的读取）在 hook 层面不可分。
3. **shell 绕过**（P1 #2）：`cat`/`type`/`dir` 等 shell 命令读 vendor 文件不经过 Node fs，未捕获。
4. **N=3 无功效分析**（P1 #9）：18 轮结果完全一致（确定性 orchestrator dry-run），无方差。
   真实 agent 执行有非确定性，本基线低估了方差。
5. **dry-run 不派子代理**：本跑未实际派发 claude/codex 子 agent，因此无法测量子 agent 的 vendor 读取。
   真实执行中子 agent 通过自己的工具读文件，同样不经过本 hook。
6. **prereq-check 恒失败**：每轮重置 journey 导致前置机验报错，但不影响 vendor IO 测量。
7. **所有阶段结果相同**：因为每轮都跑同一个 orchestrator dry-run，6 个阶段的 JSONL 完全一致（36 records/轮）。
   阶段间差异（如 stage 0 只盘点、stage 5 做批判）未体现在 Node fs 层面——这些差异体现在 agent 推理和 Read 工具调用中，而后者不可见。
8. **任务固定**：测试任务固定为 TODO 后端 API（T2_BACKEND），未跨簇测。前端/AI/运维簇的路由分布不同。

## 原始数据位置

- 每轮 JSONL：`runs/stage<N>-run<K>/io-audit.jsonl`（18 份）
- 每轮报告：`reports/stage<N>-run<K>/REPORT.md`（18 份，asset-io-report.mjs 产出）
- 声明口径输出：`declared/stage<N>.txt`（6 份）
- 执行脚本：`runs/run-baseline.mjs`、`runs/gen-reports.mjs`、`runs/run-declared.mjs`
