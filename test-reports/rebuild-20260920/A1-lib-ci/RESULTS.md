# A1 自测报告 — lib/ci.mjs 纯函数抽取

## 运行环境

- 仓库: `D:\.ai-hub\skills\yy`
- 探针: `probe.mjs`（22 项断言）
- 日期: 2026-09-20

## 结果摘要

**22 PASS / 0 FAIL**（含 3 组必失败组）

## 差分覆盖（≥6 组输入）

| 组 | 输入 | 期望 | 结果 |
|---|---|---|---|
| 1 | GATE_TOPOLOGY 结构（5 项断言） | S1-S6, blocking 分类, S5 进程内门 | PASS |
| 2 | buildTempReportContent 模板 | 三视角 + confidence 9/10 | PASS |
| 3 | countOpenP0 空 tracker | 0 | PASS |
| 4 | countOpenP0 无 P0 | 0 | PASS |
| 5 | countOpenP0 2 条 P0 ⬜（必失败组） | 2 | PASS |
| 6 | countOpenP0 P0 ✅ + ◐ 混合 | 0（ci.mjs S5 只查 ⬜） | PASS |
| 7 | classifyFailure 全过 | pass=true | PASS |
| 8 | classifyFailure S1 阻断失败（必失败组） | pass=false | PASS |
| 9 | classifyFailure S6 非阻断退出 1 | pass=true | PASS |
| 10 | runGate mock spawn S1 | code=0, spawn 调用正确 | PASS |
| 11 | runGate S5 有 P0（必失败组） | code=1 | PASS |

## 偏差声明

1. **S1-S12 口径偏差**：规格文档提及"S1-S12 拓扑"，但 ci.mjs 顶层实际只有 S1-S4（子进程门）+ S5（P0 硬闸门）+ S6（asset-call-rate 信息段）。S1-S12 是 `regression-all.mjs` 内部的 12 段断言，ci.mjs 将其整体作为 S4 调用。本 lib 不抽取 regression-all.mjs 内部逻辑。

2. **S5 ◐ 不计为未闭环**：ci.mjs 的 S5 门仅检测 `⬜`，不检测 `◐`（进行中）。这与 orchestrator.mjs 的 `backlogIsPending` 函数（同时检测 `⬜◐`）不同。本 lib 忠实于 ci.mjs 源行为。

3. **未抽取的部分**（留在 lib 之外）：
   - `run()` spawn 封装（含 `stdio: inherit`、`shell: false` 等进程级配置）
   - `main()` 中的 `process.exit(1)` / `process.exit(0)` 调用
   - `cleanup()` 临时文件删除
   - 这些全局态由 B0 阶段切薄 CLI 壳时处理，当前 lib 仅提供纯逻辑。
