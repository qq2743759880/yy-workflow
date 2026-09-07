# 开工交接 Prompt（给执行 Agent）

> 使用方式：把下面「=== PROMPT START ===」到「=== PROMPT END ===」之间的内容整段复制，粘贴给编码 Agent（Claude Code / Codex / WorkBuddy 等）即可开工。

---

=== PROMPT START ===

你是一名执行 Agent，负责完成 **tt-together-agent（TT）优化迭代 MVP**。请严格按下面的上下文、顺序与约束执行，不要自行扩大范围。

## 0. 项目是什么

TT（Together Agent）是一个「多 Agent 编排方法论 + 26 个随包资产」的 skill 包。它现在的**问题**是：只有方法论（SKILL.md、模板、prompt 资产），**没有可运行的骨架**——脱离宿主无法自主跑编排。

**本次目标**：把它升级为「可运行的指挥系统」。MVP = **Phase 0 编排骨架 + Phase 1 资产簇化(26→16) + Phase 2 三个高杠杆资产替换**。

- 编排骨架：`node scripts/orchestrator.mjs --task "..."` 能完成 `路由 → 派单 → 契约冻结 → 验收` 闭环并产出报告。
- 簇化：26 个 vendor 资产合并为 16 个顶层簇。
- 三个替换：实现簇→opencode、sdlc→BMAD+cline、be-validator→portman/contracteer。

## 1. 仓库与环境

```
仓库根：D:/.ai-hub/skills/tt
远程：  https://github.com/qq2743759880/tt-together-agent.git （private，分支 main）
运行：  Node.js >= 18
语言：  ESM JavaScript（.mjs）+ JSDoc 类型注解 —— 零第三方依赖、零构建、离线可运行
```

**注意**：本环境的 git 无法 push 到 github.com（网络限制），你只需要在本地提交；推送由人另行处理。

## 2. 开工前先跑这 5 条命令（熟悉现状，不要跳过）

```bash
cd D:/.ai-hub/skills/tt
git status                              # 确认工作区状态
ls vendor | wc -l                       # 当前应为 26
node scripts/validate-structure.mjs     # 当前应输出 26/26、0 警告、0 漂移、0 泄露
ls .claude/specs/tasks                  # 22 个任务文件
node scripts/validate-structure.mjs --help 2>/dev/null; ls scripts
```

## 3. 必读文档（按顺序读，读完再动手）

| 顺序 | 文件 | 作用 |
|---|---|---|
| 1 | `.claude/specs/dev-tt-optimization.md` | **主索引**：22 任务表、簇化映射、执行顺序、全局风险 |
| 2 | `tt-together-agent-vibe-coding-prd.md` | PRD：需求、MVP 范围、技术方案、验收标准 |
| 3 | `ITERATION_PLAN.md` | 四期路线与「方法论有余、骨架不足」的诊断 |
| 4 | `COMPETITORS.md` | 竞品替换依据（每个资产的对标与理由） |
| 5 | `.claude/specs/tasks/<每个任务>.md` | **逐个任务的完整实现 spec** |

每个任务文件都含：概述 / 依赖 / 目标与非目标 / 前置条件 / 要建改的文件表 / 分步实现 / 数据结构契约 / Given-When-Then 验收 / 验证命令 / 回滚 / 风险 / 检查清单。**执行某个任务时才精读对应文件。**

## 4. 执行顺序（严格遵守，不要跳序）

```
阶段一（可并行，资产重组，先不提交）
  FE-01 ∥ FE-02 ∥ FE-03 ∥ FE-04 ∥ FE-05 ∥ FE-08 ∥ FE-09
                    ↓
阶段二（簇化唯一收口点）
  FE-06  ← 用 ls vendor 核对实际数量，更新 SKILL.md §1c 与
           scripts/validate-structure.mjs 的 SKILL_ENTRIES(10)/AGENT_ENTRIES(6)
           ★ 到这里才第一次 git commit
                    ↓
阶段三（编排骨架，串行）
  BE-01 → BE-02 → BE-03 → BE-04 → BE-05 → BE-06
                    ↓
阶段四（替换接入，可并行）
  BE-07(opencode) ∥ BE-08(BMAD+cline) ∥ BE-09(portman)
                    ↓
阶段五（健壮性，串行）
  BE-10（失败重试降级） → BE-11（报告日志） → BE-12（回归集成）
                    ↓
阶段六（收尾）
  FE-10（README/索引文档同步 + 最终自检 + 提交）
```

**硬性顺序约束**
- **FE-04 必须早于 BE-07**：opencode 适配器挂在 `implementation` 簇上。
- **FE-06 是簇化唯一收口点**：FE-01~05 全部完成前**不要提交**，保证中间态可 `git checkout -- vendor/` 整体回滚。
- **BE-07/08/09 与其文档任务 FE-07/08/09 双向对齐**：降级码、phase 序列、结果格式必须一致。

## 5. 全局硬约束（违反即返工）

1. **零第三方依赖**：不引入 npm 包；不用 `yargs`/`commander`；参数解析手写。
2. **路径必须相对化**：任何产物、报告、日志路径都不得出现 `D:\`、`C:\Users\` 等本机绝对路径（TT 对可移植性有硬要求，校验器会检查）。
3. **类型判定不能错**：
   - skill 型 = 目录内含 `SKILL.md`（需 name/description/version frontmatter）
   - agent 型 = 目录内含 `<name>.md`，**且不能有 `SKILL.md`**
   - `implementation`、`be-validator` 必须是 **agent 型**；`be-security`、`be-tester` 簇化后降为嵌套 agent，要从 `AGENT_ENTRIES` 移除。
4. **禁止臆造 CLI 参数**：opencode / cline / portman / contracteer 的用法必须先执行 `--help` 或 `--version` 核实；不确定的一律在文档标注「待核实」，不要写假命令。
5. **不复制竞品源码**：只调用 CLI 或引用方法论，opencode/BMAD/cline/portman 的源码不得 vendored 进仓库（许可风险）。
6. **子进程调用用 `spawn` + 参数数组**，禁止拼接 shell 字符串（防注入），必须带超时。
7. **退出码约定**：0 成功 / 2 参数错误 / 3 模块未实现 / 4 契约违约 / 5 执行失败（含超时与适配器硬失败）。
8. **dry-run 必须零副作用**：`--dry-run` 只打印，不写文件、不起子进程。
9. **簇化不丢能力**：每个簇化任务前先列「独有内容清单」，合并后逐条核对（尤其 polish 的 YAGNI 原则、vibe-coding-prd 的四关卡规则）。
10. **不要扩大范围**：只做 22 个任务里写的事；Next/Later 阶段的资产替换（gpt-researcher、shadcn、semgrep 等）本次不做。

## 6. 每个任务的执行方式（逐个循环）

对当前任务，重复这个循环：

1. **精读** `.claude/specs/tasks/<任务>.md`。
2. **按「实现步骤」** 动手（严格参照「需要创建/修改的文件」表，不要多改文件）。
3. **跑该文件的「验证命令」**，逐条比对输出。
4. **逐条核对「验收标准（Given/When/Then）」**，全部满足才算完成。
5. **勾选「交付物检查清单」**，然后在回报中标注该任务完成。
6. 若某条验收过不了，**不要绕过**，先读「失败与回滚」修正；仍不行则停下并说明卡点与已尝试的方案。

## 7. 簇化目标（FE-06 用，执行时以 `ls vendor` 实际结果为准）

**5 个新簇**
| 新簇 | 类型 | 来源 |
|---|---|---|
| `frontend-design` | skill | frontend-design + taste-skill + ui-ux-pro-max + pick-ui-library + prototype |
| `planning` | skill | prd-writer + vibe-coding-prd（`dev-planner` **不并入**） |
| `security` | skill | audit + harden（+ 嵌套 `agents/be-security.md`） |
| `implementation` | **agent** | dev-backend + be-implementer |
| `review` | skill | critique + polish（+ 嵌套 `agents/be-tester.md`） |

**保留独立 11 个**：agent-research、agent-vision-toolkit、colorize、frontend-visual-validation、sdlc、skill-sentinel（skill）；be-architect、be-provider、be-resilience、be-validator、dev-planner（agent）。

**最终应为 16 个顶层资产 = 10 skill + 6 agent。**

## 8. 最终验收（FE-10 必须全部通过才算完工）

```bash
cd D:/.ai-hub/skills/tt
# 1) 资产与校验
ls vendor | wc -l                        # 期望 16
node scripts/validate-structure.mjs      # 期望 16/16 vendor、0 警告、接口漂移 无、可移植性泄露 无

# 2) CLI 可用
node scripts/orchestrator.mjs --help                                  # 期望用法输出，exit 0
node scripts/orchestrator.mjs                                         # 期望「任务描述不能为空」，exit 2
node scripts/orchestrator.mjs --task "实现后端登录模块" --dry-run --verbose  # 期望打印计划，零副作用

# 3) 端到端 + 回归
node scripts/orchestrator.mjs --task "实现后端登录模块" --validate     # 期望跑通并产出报告

# 4) 文档口径一致
grep -rn "26 个" --include="*.md" . | grep -v CHANGELOG || echo "无残留"

# 5) 产物与报告
ls artifacts                             # 期望有 report-*.md 与 report-*.json
```

**完工定义**：上述命令全部符合期望；`路由 → 派单 → 契约冻结 → 验收` 闭环跑通；三个适配器（opencode / bmad-cline / portman）均已注册且可被调用或**明确降级**；关键失败路径（空任务 / 无匹配 / 契约违约 / 适配器不可用 / 超时）都有明确提示与退出码。

## 9. 进度回报格式（每完成一个任务回报一次，不要攒着）

```
[任务] BE-01 编排内核脚手架与 CLI 入口 — 完成
[做了什么] 创建 scripts/orchestrator.mjs 与 lib/ 8 个模块（含 5 个占位）...
[验收结果] --help exit 0 ✓；空任务 exit 2 ✓；--verbose 输出 debug ✓
[验证命令输出摘要] ...
[遇到的偏差] 无 / （如有：说明与 spec 的差异及原因）
[下一步] BE-02 状态模型与状态机
```

如果卡住，回报：
```
[任务] BE-07 — 阻塞
[卡点] opencode CLI 未安装，且 --help 不可用
[已尝试] ...
[需要] 安装 opencode 或确认降级路径
```

## 10. 常见坑（前人踩过，务必避开）

- **R1 许可**：竞品只调用/引用，不复制源码。
- **R2 gate 误报**：契约 gate 首版用 `TT_GATE_MODE=warn`，稳定后再切 `block`。
- **R3 合并丢能力**：簇化前列清单、后核对；polish 的 YAGNI 与 vibe-prd 的四关卡最易丢。
- **R4 宿主耦合**：orchestrator 只定义契约，模型与执行由宿主提供。
- **R5 类型漂移**：`implementation`/`be-validator` 保持 agent 型（无 SKILL.md）。
- **R6 CLI 参数臆造**：一律 `--help` 核实后再写。
- **R7 路径泄露**：产物/报告全部相对路径，否则校验器会报「可移植性泄露」。
- **R8 数量口径**：PRD/ITERATION_PLAN 写的是 16，但 FE-06 必须以 `ls vendor` 实际结果为准；若不是 16，同步修正文档（FE-10 负责）。
- **R9 提前提交**：FE-01~05 在 FE-06 之前不要提交。

## 11. 一句话原则

**先补骨架，再簇化，再替换，最后收文档。** 顺序错了（比如先狂换资产）只会得到一个「更厚但不会动的手册」。

=== PROMPT END ===
