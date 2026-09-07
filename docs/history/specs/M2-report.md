# M2 里程碑实现报告 — 终端 TUI 实时 DAG 视图

- 版本：M2（FR-4 + FR-5）
- 日期：2026-09-02
- 执行方：TT 工作流独立实现子 agent
- 基线：TT 2.4.0（M1 已落地；回归 8/8，validate 0 警告 0 泄露）
- 硬约束执行：零外部依赖（仅 node 内置 fs/path/url/child_process，未引 ink/blessed/dagre）；未改 `scripts/lib/state.mjs` 状态机与 state.json 全量写语义（仅加 onStatus 钩子）；新增文件不含本机绝对路径（validate 0 泄露）；未提交、未 push。

---

## 1. 实现文件清单

| 文件 | 类型 | 职责 |
|---|---|---|
| `scripts/lib/tui.mjs` | 新增 | ANSI TUI 渲染器（M2-2 + M2-4）：`computeAnalysis`（关键路径/等待阻塞）、`buildLines`/`render`/`renderStatic`/`frame`（状态色 + 瓶颈反色 + 整帧覆写）、`createTui`（实时渲染实例：spinner 轮转、onStatus 订阅、非 TTY 降级、退出复位）。参考 turbo-ui「逐行 ANSI 手绘任务树」，零依赖 |
| `scripts/lib/runtime.mjs` | 修改 | M2-1 状态事件钩子：`emitStatus` 模块级辅助 + `runGroup.runOne`（running/done/skipped/failed + 耗时 + mode + degraded）与 `dispatch`（done/skipped 定型后即时上报）注入 `opts.onStatus(subtask, phaseInfo)`；dry-run 不上报、回调异常吞掉、`running` 为执行中瞬时态（state.json 收尾全量写不受影响） |
| `scripts/orchestrator.mjs` | 修改 | M2-3 触发：`parseArgs` 新增 `--tui`/`--no-tui`（并入 `--exec` 透传 KNOWN 集）；main 执行路径挂载 `createTui` + `execOpts.onStatus`（`--tui` 只叠加渲染不改变执行语义）；dry-run/真实执行/失败异常均正确收尾复位 |
| `scripts/tt-tui.mjs` | 新增 | 独立复盘（FR-5）：轮询 `.tt-state/state.json`（默认 500ms）渲染，与 `--tui` 共享 `lib/tui.mjs` 渲染器；无 state 文件报错 exit 1；非 TTY 静态输出 exit 0；已完成/失败渲染最终 DAG + 汇总；`TT_TUI=off`/`--no-tui` 完全不渲染 |
| `README.md` | 修改 | 编排器用法段补 `--tui` 用法、`tt-tui.mjs` 独立复盘、TUI 能力说明（状态色/瓶颈/非 TTY 降级/逃生舱/退出复位） |

> 未改动 `scripts/lib/state.mjs`（TRANSITIONS 原样）；`store.mjs` 未改（state.json 仍为收尾全量写——TUI 实时性靠 onStatus 事件流，standalone `tt-tui.mjs` 面向已完成 state 复盘）。

---

## 2. 模块级渲染测试（fake-TTY 双路径，37/37 PASS）

用合成 plan（3 phase、跨 phase dependsOn、running/idle/failed/skipped/降级混合）对渲染器直接验证：

| 用例 | 结果 |
|---|---|
| 静态渲染：3 个 `▸ phase-N` 标题、`├─/└─` 树符、`→ #n` 依赖箭头 | ✅ |
| 状态色：done=绿✓ / failed=红✗ / skipped=黄△ / idle=dim 灰○ / 降级=红弱化+⚠ | ✅ |
| 底部汇总 `failed=N skipped=N degraded=N` 计数正确 | ✅ |
| M2-4 关键路径：running task 沿 dependsOn 回溯标记 (CRITICAL)，反色 `\x1b[1;7m` | ✅ |
| M2-4 等待阻塞：idle/pending + 依赖未完成 → (BLOCKING) 反色高亮 | ✅ |
| `renderStatic` 剥离全部 ANSI（非 TTY 纯文本不残留转义） | ✅ |
| `frame` = `\x1b[H` + 每行 `\x1b[K` 整帧覆写 | ✅ |
| live 实例：隐藏光标 `\x1b[?25l`、清屏、onStatus 到达即重绘、spinner 轮转 | ✅ |
| live 实例收尾：最终帧 + `final:` 汇总 + 报告路径 + `\x1b[0m\x1b[?25h` 复位 | ✅ |
| 非 live 实例：一次性静态帧、update 忽略、finish 只出汇总行 | ✅ |
| 状态事件到达变红/黄：update(failed)→红✗、update(skipped)→黄△、update(done+prompt 未消费)→⚠+degraded 计数 | ✅ |

**实测发现（已修复）**：失败/跳过 task 若按「任意未完成链长」进关键路径会被误标反色遮掉红/黄。按 PRD M2-4 原文「关键路径 = 从**当前执行中 task** 沿 dependsOn 回溯到已完成起点」修正：关键路径锚定 running task，无 running 时为空——失败/跳过/等待保持其状态色，等待才标 (BLOCKING)。

---

## 3. FR-4 TUI 实时 DAG 视图 GWT 逐条

| GWT | 结果 | 证据 |
|---|---|---|
| Given ≥3 phase 的 plan 执行（含并行组）；When 打开 TUI；Then 每 phase/每 task 一屏可见、状态色与实际一致、刷新自动覆写 | ✅ | T2（4 phase/8 subtask）实跑 `--tui`：4 个 `▸ phase-N` + 8 task 缩进树一屏可见；done=绿✓、降级=⚠、blocked=(BLOCKING) 与 state.json 一致（见 §5 语义比对）；live 模式由 onStatus 事件驱动重绘 + spinner 定时器（fake-TTY 实测 `\x1b[H`+整帧覆写 37 项断言） |
| Given 某 task 依赖未完成且等待；When 渲染；Then 反色高亮 + `(BLOCKING)`，其依赖链为关键路径候选 | ✅ | 静态帧实测：`#1 implementation … → #0 (BLOCKING)` 反色 `\x1b[1;7m`（T2 实跑）；关键路径 running 锚定链标 (CRITICAL)（模块测试） |
| Given 某 task 失败或降级为 skipped/planned-only；When 状态事件到达；Then 立即变红/黄 + 底部汇总 | ✅ | live update 实测：failed→红✗、skipped→黄△、planned-only/prompt 未消费→红弱化+⚠；汇总 `failed=… skipped=… degraded=…`（livecolor 测试 5/5 + 真实 `--backend prompt` 跑 degrade 汇总 degraded=8） |
| Given 非 TTY 运行 `--tui`；When `isTTY=false`；Then 一次性静态 DAG 文本后退出，退出码 0 | ✅ | 管道实跑 `orchestrator --task … --tui`：输出静态 DAG（`TT plan …` + phase 树 + 汇总），退出码 0（执行成功场景）。**诚实说明**：非 TTY 下 `--tui` 不跳过执行（FR-5 回归面为零优先）——静态帧打印后继续正常执行，退出码跟随执行结果（成功=0）；纯查看器 `tt-tui.mjs` 非 TTY 则静态输出后 exit 0（FR-5 GWT 实证） |
| Given 执行结束（done/failed）；When TUI 收尾；Then 打印最终汇总与报告路径，无残留脏状态 | ✅ | 收尾输出 `final: done done=8/8 … | report: artifacts/report-<planId>.md`，末位 `\x1b[0m\x1b[?25h`（fake-TTY 断言 + watch 实跑 tail 字节核验）；`process 'exit'` 兜底复位保证中断也不残留 |

## 4. FR-5 TUI 触发 GWT 逐条

| GWT | 结果 | 证据 |
|---|---|---|
| Given `orchestrator --task … --tui`；Then 执行语义与不带 `--tui` 完全一致，仅叠加渲染 | ✅ | 同任务双跑（±`--tui`）比对：退出码 0/0、state.status、modes、逐 subtask status/mode/assetConsumed 逐字段 JSON 完全一致（semantics 测试 4/4）；回归 8/8 无 `--tui` 路径不受影响 |
| Given 已有完成/中断的 state.json；When `node scripts/tt-tui.mjs`；Then 渲染最终 DAG 与状态汇总并退出 | ✅ | 完成态 state 实跑：输出最终 DAG（done 全绿 + degraded ⚠）+ `final: done | report: artifacts/report-<planId>.md`，exit 0；无 state 文件 → `[tt-tui] 无法读取 … state.json` exit 1；执行中态（status=executing 且有 running）→ 500ms 轮询 → 检测到 done 后收尾 exit 0（watch 测试 3/3） |

---

## 5. 触发/逃生舱实测矩阵

| 场景 | 实测结果 |
|---|---|
| `--tui`（非 TTY 管道） | 静态 DAG 一次输出 + 正常执行 + `final:` 汇总，exit 0 |
| `--tui --backend prompt` | ✅ 同上；degraded=8 如实汇总 |
| `--tui --exec <宿主>` | ✅ 静态帧 + 8/8 mode=exec，exit 0 |
| `--tui --plan --draft <file>`（y/y/y 批准后） | ✅ 审批通过后 plan 执行叠加 TUI 静态帧，exit 0 |
| `--tui --resume`（有剩余任务） | ✅ done 跳过、剩余续跑，静态帧 + `final:`，exit 0 |
| `--tui --dry-run` | ✅ 静态帧 + `final: planning done=0/8`，exit 0，零文件写入 |
| `TT_TUI=off` + `--tui`（逃生舱） | ✅ 无任何 TUI 输出（`TT plan` 帧不存在），行为与无 `--tui` 一致 |
| `--tui --no-tui`（逃生舱） | ✅ 无任何 TUI 输出 |
| `tt-tui.mjs`（TT_TUI=off / --no-tui） | ✅ 零输出，exit 0 |
| 真实 TTY 分支（isTTY 覆写子进程） | ✅ 隐藏光标、整帧覆写、final 汇总、`\x1b[0m\x1b[?25h` 复位，exit 0 |

---

## 6. 回归与校验

- `node scripts/validate-structure.mjs`：**0 警告 0 泄露**（新增 `scripts/lib/tui.mjs`、`scripts/tt-tui.mjs` 与改动文件均不含本机绝对路径，可移植性扫描通过）。
- `node scripts/regression-all.mjs`：**8/8 PASS**（S1 结构 / S2 retry / S3 替换清单 / S4 契约冻结 / S5 宿主执行 / S6 资产缓存 / S7 review-gate / S8 资产消费证据）。无 `--tui` 路径行为与 2.4.0 完全一致（回归不含 TUI 分支，回归面为零）。
- `node scripts/ci.mjs`：**CI PASS**（S1–S4 全过 + S5 资产质量评分 INFO）。
- git 改动面：仅 `README.md`、`scripts/lib/runtime.mjs`、`scripts/orchestrator.mjs`（改）+ `scripts/lib/tui.mjs`、`scripts/tt-tui.mjs`（新增）。

---

## 7. 诚实声明 / 已知边界

1. **本环境无真实 TTY**：live 分支（spinner 轮转、光标隐藏/复位、onStatus 即时重绘）经两路验证——① fake-TTY 流（`{isTTY:true, write}` 捕获字节断言 37 项）；② isTTY 覆写的子进程真实跑通 `tt-tui.mjs` live 分支与 `orchestrator --tui` 挂载逻辑。真人终端与脚本共用同一 `createTui` 渲染代码路径，但与 M1 一致，未在真人终端逐键验证。
2. **live 模式日志交错**：执行期 runtime 的 `[tt] start/finish subtask` 等 logger 行会瞬时打印，被下一帧 `\x1b[H`+`\x1b[K` 整帧覆写覆盖；视觉偶有闪烁属可接受范围（turbo-ui 同款整帧覆写策略），已在文档标注。
3. **关键路径锚定 running task**（按 PRD M2-4 原文）：无 running 时不标 (CRITICAL)，等待阻塞标 (BLOCKING)；与「失败变红」不冲突。
4. **standalone `tt-tui.mjs` 面向已完成/中断的 state.json 复盘**：state.json 仍为收尾全量写（未改 store.mjs），执行中实时视图由 `orchestrator --tui` 的 onStatus 事件流提供；两入口共享渲染器。
5. **非 TTY 下 `orchestrator --tui` 不跳过执行**：FR-4「输出静态文本后退出 exit 0」与 FR-5「回归面为零」在编排器场景冲突时，以 FR-5 为准（静态帧打印后继续执行，退出码跟随执行结果，成功即 0）；纯查看器 `tt-tui.mjs` 非 TTY 严格「静态输出 + exit 0」。
6. **`dependsOn` 为元数据、执行按 phase 排序**（与既有 TT 语义一致）：TUI 的依赖箭头/关键路径基于 DAG 元数据展示，实际派单顺序仍由 runtime phase 分组控制。
7. 测试工作区（临时目录）均已清理，未向仓库写入任何状态/产物。
