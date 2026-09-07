# Feature: TT 编排内核「执行可信 + 规模化」阶段（execution-trust）

> 由 dev-planner 生成 · 版本 v0.1 · 更新日期 2026-08-29
> 前置状态：P0/P1/P2 修复 + P3 可移植性已验收（ACCEPTANCE-REPORT-P0-P3.md）；宿主执行（`--exec`）已落地且用假宿主实测通过。
> 本文档 = 任务总纲（对应 `templates/dev-plan.md`），供调度与验收。

## 目标

把编排内核从「诚实记录 + 可选宿主执行」推进到「**契约可机验 + 执行可信 + 一键回归**」：契约冻结从描述字符串升级为真实契约文件并由 gate 机验；宿主执行增加超时与产物校验；资产加载引入正文缓存支撑规模化；提供单一回归卡点命令。

## 现状基线（规划依据，全部已实测）

| 现状 | 缺口 | 本阶段落点 |
|---|---|---|
| `subtask.contract` 是描述字符串，gate 走 describe 存在性模式 | 契约冻结无真实内容比对 | BE-13：planner 产出契约文件，gate 走 json hash diff（`gate.mjs` 该路径已存在，仅缺接线） |
| `--exec` 默认超时 600s、无产物校验 | 宿主卡死/空输出时无保护 | BE-14：timeoutMs 可配 + result.txt 非空校验 + 空输出降级 |
| `loadAssets` 每次读全部路由资产正文 | 几百资产仓库 O(N) IO | BE-15：正文缓存（key=manifest 哈希） |
| validate / test-retry / e2e 分散，无统一卡点 | CI 无单命令验收 | BE-16：`regression-all.mjs` 一键回归 + 失败 exit≠0 |
| SKILL.md §5.4/§5.5、README 契约/执行/回归文档 | 契约文件化后文档过时 | FE-11：文档与模板同步 |

## 任务总纲

| task | 标题 | 依赖类型 | 依赖 | GWT 验收摘要 | agent/skill | 契约 |
|------|------|------|------|------|------|------|
| task01 | BE-13 契约文件工作流 | 完成 | 无 | 当 plan 带契约文件时，执行后 gate 前后 hash 比对；执行中篡改契约 → exit 4 | dev-planner / be-validator | contracts/<planId>.json |
| task02 | BE-14 宿主执行硬化 | 完成 | 无 | 当 `--exec` 配置 timeoutMs 时，宿主超时/空输出 → 诚实降级 brief-only，不挂起 | prompt 后端 | — |
| task03 | BE-15 资产正文缓存 | 完成 | 无 | 当 manifest 未变时，二次 loadAssets 命中缓存零重读 | asset.mjs | — |
| task04 | FE-11 文档与模板同步 | 完成 | task01, task02, task03 | 当文档更新后，validate-structure 0 错误、README 0 路径泄露 | dev-docs | — |
| task05 | BE-16 一键回归卡点 | 完成 | task01, task02, task03, task04 | 当干净树跑 regression-all 时 exit 0；注入破坏后 exit≠0 | test | — |

## 任务明细（GWT 验收全文）

### task01 · BE-13 契约文件工作流

**改动面**：`scripts/lib/planner.mjs`、`scripts/orchestrator.mjs`、`scripts/lib/gate.mjs`（复用）、`scripts/lib/adapters/portman.mjs`

- `buildPlan` 为每个计划生成 `contracts/<planId>.json`（内容 = cluster.contract 描述 + cluster 名 + planId），并把 `subtask.contract` 指向该文件路径（相对 workspace）。
- 契约文件在 `executePlan` 前写入、执行后不重写（防篡改检测基线）。
- `gate.before` 快照 + `gate.after` hash 比对：执行期间文件被改动 → `ContractViolationError` → orchestrator exit 4（现有路径，仅接线）。
- portman 适配器：契约文件存在时走真实读取（现逻辑已支持 `.json` 文件路径）。

**AC（GWT）**：
- Given 一个 T2 计划 with contract file；When 正常执行完毕；Then `contracts/<planId>.json` 存在、子任务 `contract` 为相对路径、exit 0。
- Given 执行中途把 `contracts/<planId>.json` 内容改动；When `gate.after` 运行；Then `ContractViolationError`、exit 4。
- Given `--dry-run`；Then 不写契约文件（零副作用）。

**验收命令**：
```bash
node scripts/orchestrator.mjs --task "backend login module"   # exit 0, contracts/<planId>.json 存在
# 手工改动契约文件后重跑 → exit 4
node scripts/orchestrator.mjs --task "backend login module" --dry-run  # 无 contracts/
```

### task02 · BE-14 宿主执行硬化

**改动面**：`scripts/lib/adapters/prompt.mjs`、`scripts/orchestrator.mjs`（timeoutMs 透传）、`config.example.json`

- `--exec` 宿主调用的 `timeoutMs` 可配置（CLI `--exec-timeout N` 或 `config.json executor.timeoutMs`），默认 600s；超时 → 失败对象 → brief-only 降级（不抛、不挂起，已具备）。
- `result.txt` 空内容（`completed` 占位或空串）视为宿主未产出 → `degraded: 'brief-only (executor empty output)'`，不回填假执行。
- `mode=exec` 仅在 result.txt 非空时授予。

**AC（GWT）**：
- Given `--exec "node -e \"console.log(1)\""`；When 执行；Then 子任务 `mode=exec`、`result.txt` 非空。
- Given `--exec "node -e \"\""`（空输出）；When 执行；Then 子任务 `mode=prompt`（brief-only 降级）、`degraded` 含 empty output。
- Given 宿主 sleep 超时（`--exec-timeout 300`）；When 执行；Then 不挂起、brief-only、exit 0。

**验收命令**：
```bash
node scripts/orchestrator.mjs --task "backend login module" --exec node -e "console.log(1)"
node scripts/orchestrator.mjs --task "backend login module" --exec node -e ""
node scripts/orchestrator.mjs --task "backend login module" --exec node -e "setTimeout(()=>{},5000)" --exec-timeout 300
```

### task03 · BE-15 资产正文缓存

**改动面**：`scripts/lib/asset.mjs`、`scripts/lib/manifest.mjs`（暴露哈希）

- 缓存文件 `workspace/.tt-state/assets-cache.json`，key = manifest 的 `generatedAt` + 各路由资产文件名 mtime 摘要。
- `loadAssets({ only, useCache: true })`：哈希未变 → 直接读缓存正文；变 → 重读并回写。
- orchestrator 非 dry-run 路径启用缓存，dry-run 不写缓存。

**AC（GWT）**：
- Given manifest 未变；When 连续两次 `loadAssets`；Then 第二次返回缓存正文、不触碰磁盘（可用 `fs.stat` 调用计数或注入探针验证）。
- Given vendor 某 SKILL.md 被改；When 再 load；Then 检测到哈希变化并重读。

**验收命令**：
```bash
# 增加一次 --verbose 断言输出 "assets cache hit"，或注入计数器
node scripts/orchestrator.mjs --task "backend login module"   # 第二次 run 时 cache hit
```

### task04 · FE-11 文档与模板同步

**改动面**：`SKILL.md`（§5.4/§5.5 契约冻结措辞）、`README.md`（--exec/--exec-timeout/契约文件/regression-all）、`config.example.json`（executor.timeoutMs）、`templates/dev-plan.md`（契约列注明文件路径）

**AC（GWT）**：
- Given 文档更新后；When `node scripts/validate-structure.mjs`；Then 0 项错误、0 路径泄露、0 U+FFFD。

**验收命令**：
```bash
node scripts/validate-structure.mjs   # [OK]
```

### task05 · BE-16 一键回归卡点

**改动面**：新增 `scripts/regression-all.mjs`

- 依次执行并断言：① `validate-structure` exit 0；② `test-retry` exit 0；③ 契约工作流 smoke（task01 场景）；④ 宿主执行 smoke（task02 场景，fake host）；⑤ 资产缓存 smoke（task03 场景）；⑥ 端口/路径泄露深扫（§2 扩展正则）。
- 任一失败 → 输出失败段 + `exit 1`。
- **已预埋**：S3「Phase 2 替换清单」占位卡点——校验 3 个高杠杆目标（implementation→opencode / sdlc→BMAD+cline / be-validator→portman）的 ① vendor 存在性 ② 专用适配器接线（`resolveAdapter(asset,'cli')` 非 null）③ 资产正文内核 marker（漂移门：替换内容未同步更新 PHASE2 表即 FAIL）。现状全绿，替换迭代启动即用。

**AC（GWT）**：
- Given 干净树；When `node scripts/regression-all.mjs`；Then 全 PASS、exit 0（当前基线：S1/S2/S3 PASS + S4/S5/S6 SKIP 待 task01/02/03 接线）。
- Given 注入一个契约篡改（改 contracts 文件后执行）；When 回归；Then 该段 FAIL、exit 1。
- Given Phase 2 替换某资产但未更新 PHASE2 表；When 回归；Then S3 FAIL、exit 1（漂移门生效）。

**验收命令**：
```bash
node scripts/regression-all.mjs   # ALL PASS, exit 0
```

## 执行顺序

```
task01 ──┐
task02 ──┼──→ task04 ──→ task05
task03 ──┘
```
- **可并行集 1**：{task01, task02, task03}（互不依赖，改动文件不重叠：planner/gate / prompt/orchestrator-timeout / asset+manifest）
- **task04**：依赖三者完成后同步文档（避免文档先行过时）
- **task05**：最后（依赖全部，作为总验收卡点）

## 契约冻结清单

- [ ] task01：`contracts/<planId>.json` 生成 + gate 前后比对 + exit 4 路径
- [ ] task02：exec timeoutMs 配置 + 空输出降级判定
- [ ] task03：assets-cache 哈希失效规则（manifest generatedAt + 文件 mtime）
- [ ] task05：regression-all 六段断言基线（作为后续每轮改动的回归基准）

## 风险清单

| 风险 | 影响 | 回滚/缓解 |
|------|------|----------|
| 开发机无真实宿主（opencode/cline 未装） | exec e2e 无法用真实宿主验证 | 全部 exec 场景用 `node -e` 假宿主（已建立模式）；真机验证列为验收后手动项 |
| 契约文件 hash 因序列化不稳定误报 | gate 误判 exit 4 | 复用 `gate.mjs stable()` 规范化（已存在，先跑通再加固） |
| 资产缓存失效粒度过粗/过细 | 误命中或失效不生效 | key 采用 manifest generatedAt + 路由资产 mtime 摘要；dry-run 不写缓存 |
| 契约文件随 workspace 遗留 | 污染/误恢复 | 契约文件落 `contracts/`（gitignore）+ `--resume` 复用同一 planId |
| regression-all 六段耦合运行环境 | CI 环境差异导致假失败 | 每段独立进程/独立断言，环境相关项（真实宿主）标 SKIP 不 FAIL |

## 验收总则

- 每 task 独立实证验收（命令重跑，不采信报告）。
- task05 通过即本阶段完成；未过项在 `plans/critique-backlog-tracker.md` 登记并指派修复。
- 本阶段完成后更新 `ACCEPTANCE-REPORT-P0-P3.md` 或新增本阶段验收报告，供规划 agent 复查。

## 执行记录（2026-08-29，并行开工 task01-03 + task05 接线）

| task | 状态 | 变更 | 验收证据 |
|---|---|---|---|
| task01 BE-13 | **DONE** | `planner.mjs` 记录 `plan.contract`；`orchestrator.mjs` 新增 `freezeContract()` 写 `contracts/<planId>.json` 并把 `subtask.contract` 指向它；`gate.mjs after()` 捕获"执行期契约被改/变非法"为 `ContractViolationError`（不再被 dispatch 吞掉）；`contracts/` 加入 `.gitignore`；旧 `contracts/demo.json`（空 `{}`，从未被消费）随 BE-13 移除 | 冻结文件生成 ✓；dry-run 零副作用 ✓；执行期篡改契约 → **exit 4** ✓ |
| task02 BE-14 | **DONE** | `orchestrator.mjs` 新增 `--exec-timeout N`（正整数校验 exit 2）+ `config executor.timeoutMs` 默认；`prompt.mjs` 空输出/`completed` 占位 → 诚实降级 brief-only（不授 mode=exec）；修正 timeout 接线（原读 `options.timeoutMs` 实为 `execTimeoutMs`） | 空输出 → `mode=prompt` ✓；真实输出 → `mode=exec` + result.txt ✓；宿主 sleep 3s + timeout 500ms → 589ms 完成并降级 ✓ |
| task03 BE-15 | **DONE** | `asset.mjs` 新增正文缓存 `workspace/.tt-state/assets-cache.json`（签名 = manifest + 路由资产 mtime/size sha1）；`useCache: !dryRun` | 缓存生成（8 路由资产）✓；二次运行复用 ✓；touch vendor mtime → 失效重读仍绿 ✓ |
| task05 BE-16 | **DONE** | `regression-all.mjs` 六段全接线（S1 validate / S2 retry / S3 Phase2 清单 / S4 契约 / S5 exec / S6 缓存），smoke 跑在临时 workspace 自动清理 | 6 PASS / 0 FAIL，exit 0；新鲜部署（拷贝后）同样 6 PASS |
| task04 FE-11 | **DONE** | `SKILL.md` §5.4 补「契约冻结机器校验（BE-13）+ 一键回归卡点（BE-16）」，§5.5 产物表补 `contracts/<planId>.json` 与 `artifacts/`；`templates/dev-plan.md` 契约列改 `contracts/<planId>.json`（机器冻结）+ handoffs（人工单）；`templates/orchestration-frontend-backend.md` 过时资产名（prd-writer/vibe-coding-prd/harden/audit/critique）改为现行簇名；`templates/task-agent-matrix.md` 补机器契约冻结与 `--exec` 说明；`README.md` 补契约冻结机器校验 + `regression-all.mjs` 一键回归 + `mode: exec` | validate-structure exit 0、0 泄露、0 U+FFFD；regression-all 6/6 PASS |
| task05 BE-16 基线 | **全绿** | `node scripts/regression-all.mjs` → 6 PASS / 0 FAIL | 后续每轮改动以此为准 |

**task04 已完成**：契约冻结的机器校验路径（BE-13）与一键回归（BE-16）已同步进 SKILL.md §5.4/§5.5、templates（dev-plan / orchestration-frontend-backend / task-agent-matrix）与 README；`mode: exec`、`--exec-timeout`、`contracts/<planId>.json`、`regression-all.mjs` 均已在文档落地。

## 宿主真机验证记录（2026-08-29）

**结论：TT `--exec` 宿主通道已用真实 LLM 端到端验证通过。**

- 本机宿主盘点：`claude 2.1.233`、`codex 0.147.0` 已装但**模型路由配置损坏**（claude 的 `ANTHROPIC_MODEL=DeepSeek-V4-Flash-0731` 不被 Claude Code 2.x 识别；codex 走本地 PROXY_MANAGED 代理 + 自定义模型 catalog），非交互执行均失败——属用户 cc-switch/代理体系配置，超出 TT 边界，未改动。
- 真机验证路径：用 a6api OpenAI 兼容端点（HTTP 200，`deepseek-v4-flash-0731`）作 `--exec` 宿主，node 读 brief → 调 LLM → 写 `plan.md` 到产物目录。
- 结果：T2 后端 5 个 prompt 兜底子任务全部 `mode=exec`（真实调用 ~6.7s），be-architect 产出 8269 字节真实交付物；stdout 型与写文件型宿主均正确判 `mode=exec`，空宿主正确降级 `mode=prompt`。
- **修复（宿主验证暴露的真 bug）**：prompt.mjs 的"真实执行"判定原只认 stdout 非空，但 claude/codex 类 agent 宿主写文件而非 stdout → 已改为「产物目录有非 brief/result 的文件」或「stdout 非空」任一即 exec；regression-all S5 增写文件型宿主断言。
- 参考宿主命令已记入 `config.example.json` executor.note（key 走环境变量，勿入库）。

## Phase 2 资产替换执行记录（2026-08-29）

**范围**（ITERATION_PLAN §四 已定的 3 个高杠杆）：`implementation→opencode`、`sdlc→BMAD+cline`、`be-validator→portman`。

| 资产 | 变更 | marker 校验 |
|---|---|---|
| `vendor/implementation/implementation.md` | 补 opencode 非交互执行契约（探测/`--exec` 宿主/brief 路径/真实执行判据/降级）；修正 `artifacts/^<subtaskId>` 瑕疵路径 | `opencode` ✓ |
| `vendor/sdlc/SKILL.md` (v2.0.0→2.1.0) + `reference/cline-exec.md` | 修掉 `待核实` 乱码残留；补 cline 执行契约（探测/四阶段 phase docs/planned-only 与 `--backend cli` skipped 之分）；BMAD 四阶段映射明确 | `cline`+`BMAD` ✓ |
| `vendor/be-validator/be-validator.md` | 补 portman/contracteer 契约测试执行契约（探测/OpenAPI JSON 读取/`contract-result.json`/descriptive 诚实 `pass:null`）；修正 `^<subtaskId>` 瑕疵 | `OpenAPI`+`contract` ✓ |

**验收**：`validate-structure` exit 0（16/16、0 漂移、0 泄露、0 U+FFFD）；`regression-all` **6/6 PASS**（S3 漂移门确认 3 目标 marker 保留、路由无孤儿）。竞品 flag 一律"以 `--help` 为准"诚实表述，未编造命令。

### Phase 2 追加替换（agent-research / skill-sentinel / security，2026-08-30）

- 3 个剩余高杠杆资产补 Execution kernel 段：`agent-research→gpt-researcher`、`skill-sentinel→NVIDIA/SkillSpector`、`security→semgrep+gitleaks`（原"descriptive reference not integrated"升级为执行内核声明）。
- S3 PHASE2 表扩至 6 项；新增 `dedicatedAdapter` 字段区分「需专用 CLI」与「prompt/auto 可达」（无专用 adapter 的 skill 型资产不再误判未接线）。
- `regression-all` 新增 **S7 review-gate self-test**（批判能力代码级闸门：有效批判≥3/URL+日期/tracker）。
- 回归 **7/7 PASS**。

### 资产消费证据硬约束 + 独立实测（2026-08-30）

- **机制**：prompt 后端 exec 产物须含**资产正文首标题锚点**（高熵指纹，防低熵资产名如 security/review 被正常措辞碰巧命中）→ `assetConsumed` 布尔落 state.json；缺失 → plan.warnings 提示。exec 前清空子任务目录旧产物（resume/retry 不继承陈旧证据）。
- **回归**：S8 资产消费证据（宿主提取 brief 方法论正文首标题写产物 → 全 exec 子任务 assetConsumed=true），8/8。
- **独立测试子 agent 实测**（真实数据，PASS_WITH_ISSUES → 已修）：核心承诺成立（正文进 brief/指纹/负例/降级全对）；发现 P1 常见词子串碰撞 + P2 retry 陈旧证据 + 弱语义——已修：锚点指纹、exec 前清产物、warning 措辞注明"宿主自声明可伪造，仅弱证据"。
- 复验：普通措辞 "backend security review notes" → 0/5 碰巧命中；锚点宿主 → 5/5 true；regression **8/8**。

### Phase 2 渐进替换（frontend-design / planning / review / be-architect / be-provider / be-resilience，2026-08-30）

- 6 个剩余资产按「调用逻辑硬约束」标准补 Execution kernel 段（内核声明 + probe + 降级，避免 describe 空话）：
  - `frontend-design→shadcn-ui/ui+bolt.new`、`planning→MetaGPT/crewAI`、`review→qodo-ai/pr-agent+continuedev/continue`（后两者由 "descriptive not integrated" 升级为内核声明）
  - `be-architect→system-design-template`、`be-provider→tsyringe/InversifyJS`、`be-resilience→cockatiel/Polly`（agent 型，补在 frontmatter 后）
- S3 PHASE2 表扩至 **12 项**（全部 dedicatedAdapter=false，prompt/auto 可达）；回归 **8/8**。
- 未替换保留：dev-planner（TT 自有核心规划）、frontend-visual-validation（内核=playwright 已述）、colorize、agent-vision-toolkit（无明确外部对标）。

### Phase 2 二轮独立实测修复（2026-08-30）

独立测试子 agent 验收（PASS_WITH_ISSUES → 已修）：替换真实落地、无假成功；发现并修复：
- **P1**：be-architect/be-provider/be-resilience 缺显式 probe → 补 `probe <内核> 可用性（npm ls ...）`。
- **P2**：review/security 的 LICENSES.md 残留 "descriptive references only" 矛盾 → 改为 "execution-kernel benchmarks (not bundled)"。
- **P2**：S3 漂移门可 stub 绕过 → 增强：要求 `## Execution kernel` 段标题 + probe 动作词（probe/probes/spawns/executes/invokes）；be-validator 段标题统一为 `## Execution kernel`。
- 回归 **8/8**、validate 0 错误。
**task05 基线已全绿**：后续每轮改动以 `node scripts/regression-all.mjs`（exit 0）为回归基准；Phase 2 资产替换迭代启动时 S3 为现成卡点。
**阶段收尾**：execution-trust 阶段 5 个 task 全部 DONE + 回归基线全绿。下一迭代候选见 §6（契约内容级校验、plan.warnings 细化、资产正文缓存的规模化扩展等已大部落地，剩余为宿主真机验证 + Phase 2 资产替换）。

## P1 并行 DAG 调度执行记录（2026-08-30）

**范围**（HANDOFF-P1-PARALLEL-DAG.md）：plan 从线性链升级为依赖 DAG，`--parallel [N]` 可选并行，默认串行向后兼容；L1 人工跨平台派单通道不动。

| 文件 | 改动 |
|---|---|
| `scripts/lib/matrix.mjs` | 5 个 CLUSTERS 各增 `phases` 二维数组（同 phase 内可并行、跨 phase 串行；每候选恰好出现一次，已脚本校验）；保留 `candidates` 向后兼容 |
| `scripts/lib/planner.mjs` | `buildPlan` 展开 phases → subtasks，每 subtask 增 `phase` + `dependsOn`（= 前一 phase 全部 id；首 phase 空数组）；**subtasks 数组顺序保持 candidates 原序**（G1 兼容）；未定义 phases 退化每候选独立 phase（完全串行） |
| `scripts/lib/runtime.mjs` | `executePlan` 改按 phase 0..n-1 推进，phase 内并发池执行（`opts.parallel` 上限，默认 1 串行）；失败即停（跨 phase）；ContractViolationError 上抛（exit 4）；resume 只重试非 done；**旧 state（无 phase 字段）归一化独立 phase 强制串行** |
| `scripts/orchestrator.mjs` | `--parallel [N]`：缺省 = Infinity（phase 内全部并行）；0/非正整数/NaN → exit 2；不传 = 串行；usage 更新 |
| `scripts/regression-all.mjs` | **未改动**（S4 tamper 依赖 T2 首资产 be-architect 为 prompt 兜底——phases 首 phase 即 `[be-architect]` 且 subtasks 顺序不变，天然兼容） |

**GWT 自测证据**（全部独立实测）：
- **G1 串行兼容**：不带 `--parallel` 跑 T2 → exit 0，state.json modes={prompt:5, skipped:2, planned-only:1} 与 e17233e 一致；仅新增 phase/dependsOn 字段，mode/adapter/artifactPath 不变；phase 0..3 依赖链正确（0→1 四资产→2 两资产→3 单资产）。
- **G2 并行生效**：`--parallel 2` + exec 宿主（sleep 250ms）→ verbose 日志 phase 1 中 start -1/-2 并行启动、-2(738ms)/-3(855ms)/-5(715ms) 时间重叠（并发 2）；phase 1 总耗时 ~855ms vs 串行需 ~2.8s；跨 phase 严格串行（phase 2 在 phase 1 全部 finish 后启动）；phase>0 全部完成。
- **G3 resume 并行语义**：混合 state（6 done + 2 skipped）`--resume --parallel 2` → remaining=2 只重试 skipped（attempts 1→2），done 全部 skip 且 attempts 保持 1，phase 调度正确，exit 0。
- **G4 契约 gate 不破**：`--parallel 2` + 执行期篡改契约 → `contract violation` 捕获，**exit 4**（gate 前后 hash 比对在并行下生效）。
- **G5 回归**：`node scripts/regression-all.mjs` → **6 PASS / 0 FAIL，exit 0**（无需适配）。
- **G6 参数面**：`--parallel 0` / `--parallel abc` / `--parallel -3` → 均 exit 2；`--parallel`（缺省）→ exit 0 全并行；`--parallel --dry-run` → exit 0 零副作用。

**阶段收尾**：并行 DAG 调度落地，回归基线全绿，L1 人工派单通道未动。后续可迭代：阶段间产物依赖的显式化（dependsOn 目前只到前一 phase，跨 phase 引用已由调度保证）、`--parallel` 与 `--exec` 组合的宿主级并发压测。
