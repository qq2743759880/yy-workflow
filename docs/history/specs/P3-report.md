# P3 报告 · 监控驱动自动优化（asset-call-rate 阈值触发三级动作）

> 执行者：TT 工作流派出的独立实现子 agent（本块只改 `scripts/asset-call-rate.mjs` + README + 本报告）
> 日期：2026-09-02 · TT version 2.5.0

## 目标

F1 `asset-call-rate.mjs` 阈值触发不再只出报告，而是自动执行三级动作（MUSE 自进化 F1-F5 闭环：调用率监控 → 阈值触发 → 自动优化动作 → 反哺）：
低调用率自动标记 → 持续低调用率建议降级 → 自动登记 tracker。

## 阈值逻辑

- 触发条件与既有「需审查」一致：`消费证据`（`assetConsumed === true`）为 false 且 `mode !== 'skipped'` 的资产判定为消费率 < 50%（布尔消费证据 → 0% 或 100%）。
- 动作历史存储：每次运行（无论是否 `--apply`）把触发资产写入 `<workspace>/.tt-state/auto-actions.json`（`schema: asset-call-rate/auto-actions@1`），记录 `asset / consumptionRate / suggestion / lastTriggerDate / triggers / escalated / applied / registered`。
- 升级判断：按 auto-actions.json 历史**累计触发次数**（同一资产跨运行 `triggers ≥ 2`）→ `escalated: true`，动作升级为「建议降级为 optional」；首次触发为「建议重建（消费链审查）」。
  - **诚实说明（局限）**：auto-actions.json 只记录被触发的资产，无法感知「某次运行该资产达标（消费率正常）」；故升级用的是累计触发次数而非严格「连续」触发。若需严格连续语义，需在文件里额外记每运行达标信息，本轮未做。
- 不修改 `state.json`（只读）；不改 orchestrator/runtime 核心。

## 三级动作实现

| 级 | 动作 | 落点 | 实测 |
|---|---|---|---|
| ① | 低调用率自动标记 | 每次运行写 `.tt-state/auto-actions.json` + 报告末尾追加「自动动作清单」段（控制台 + `artifacts/asset-call-rate-report.md`） | ✅ |
| ② | 建议降级 | 历史累计触发 ≥2 次 → `suggestion = 建议降级为 optional`，写入 auto-actions.json 并打印；**不自动改 SKILL**，留人审 | ✅ |
| ③ | 自动登记 | `--apply` 时登记进 `plans/critique-backlog-tracker.md` 新段「asset-call-rate 监控登记（MUSE 自进化）」，新 C-xx 行、状态 ⬜、来源标注 `asset-call-rate`；与批判反哺共享同一 tracker | ✅ |

- `--apply` 语义：写回 auto-actions.json（`applied/registered=true`）+ 真正改写 tracker 文件。
- 缺省（dry-run）：auto-actions.json 照常生成（作为升级判断的跨运行历史），tracker 只打印待登记、不改文件。
- 幂等：tracker 按「资产名+触发日期」查重（marker = `asset-call-rate · <asset> · <date>`），重跑不重复登记；C 序号续接文件内最大 `C-xx`（现文件最大 C-12 → 新增从 C-13 起，与 review-gate `--auto-register` 共用序号空间）。
- 退出码保持：有需审查资产 exit 1（信息，不阻断 CI，与 ci.mjs S5 兼容）。

## 验收实测（合成低调用率 state，5 子任务）

构造 `state.json`：2 子任务 `exec`+consumed（消费率 100%）、2 子任务低调用率（`agent-research` planned-only、`skill-sentinel` prompt，brief 无方法论正文、consumed=false）、1 子任务 `skipped`（不触发）。

| 步骤 | 命令 | 结果 |
|---|---|---|
| 第 1 次运行 | `node scripts/asset-call-rate.mjs --state <ws>/.tt-state/state.json` | 报告含「自动动作清单」；`.tt-state/auto-actions.json` 生成（2 资产，`triggers:1`、`escalated:false`、`suggestion=建议重建（消费链审查）`）；tracker 未改动（dry-run）✅ |
| 第 2 次运行 | 同上 | 升级生效：2 资产 `triggers:2`、`escalated:true`、`suggestion=建议降级为 optional`；tracker 仍未改动 ✅ |
| `--apply` 第 1 次 | 同上 `--apply` | tracker 新增 C-13 / C-14 两行（新段，状态 ⬜）；auto-actions.json `applied/registered=true` ✅ |
| `--apply` 第 2 次 | 同上 `--apply` | 幂等：tracker 无重复行（C-13/C-14 唯一）；清单显示「✅ 已登记（历史行）」✅ |

## 回归结果

- `node scripts/validate-structure.mjs` → **[OK] 0 泄露**（可移植性扫描含全部 .mjs + README，无本机绝对路径）。
- `node scripts/regression-all.mjs` → **8 PASS / 0 FAIL**（S1-S8 全绿，本块未动 orchestrator/runtime 核心，回归面不受影响）。
- `node scripts/ci.mjs` → **CI PASS**（S1-S5，含 S5 对 `asset-call-rate --task` 的调用，退出码 1 按信息不阻断）。

## 改动清单

- `scripts/asset-call-rate.mjs`：新增阈值触发自动动作（auto-actions.json 读写、tracker 幂等登记、`--apply`、报告末尾「自动动作清单」段）。
- `README.md`：追加「监控驱动自动优化」用法说明段。
- `docs/history/specs/P3-report.md`：本报告。
- **未动**：`state.json` 本体、orchestrator/runtime/adapters 核心、vendor 资产。

## 诚实记录

1. 升级判定用「累计触发 ≥2 次」而非严格连续触发（见上「阈值逻辑」局限说明）。
2. 工作树存在**先于我改动**的未提交变更（`scripts/lib/resilience.mjs`、`scripts/lib/runtime.mjs`、`scripts/orchestrator.mjs`、`scripts/review-gate.mjs`、`config.example.json`、README、未跟踪的 `docs/history/specs/P2-report.md`）——疑为并行任务产物，本轮未触碰、未 revert；回归/CI 均在含这些变更的工作树上跑通，本块对其零依赖。
3. 测试用合成 state 与临时产物已清理；测试期间写入 tracker 的 C-13/C-14 行已通过 `git checkout` 还原，tracker 现为原始状态（本块未实际登记任何行，登记行为留给用户按需 `--apply`）。
4. 保留既有报告段（逐资产行含历史遗留的每资产 callRate 显示口径），未在其范围内改动既有语义。
