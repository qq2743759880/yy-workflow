# task D-1 · 资产消费证据强化（kernel 资产须锚点 + 内核词）

> 执行者：子 agent C。验收者：独立测试 agent。

## 目标
带 `## Execution kernel` 的资产（如 colorize/security/be-* 等），产物仅含标题锚点不足证消费——须同时含 ≥1 方法论内核词。

## 改动
1. `scripts/lib/adapters/prompt.mjs`：assetConsumed 判定改为——
   - 资产正文含 `## Execution kernel` 段：产物须含锚点 **且** ≥1 内核词（kernelTokens，从 `Kernel:` 行提取的首个词，如 culori/semgrep）
   - 资产无 kernel 段：产物含锚点即可（现行为）
2. `scripts/regression-all.mjs` S8：感知宿主更新为写"锚点 + 内核词"（从 brief 方法论正文提取锚点 + Kernel 词），否则 S8 会因 D-1 强化 FAIL

## GWT
- Given 带 kernel 资产的执行 + 宿主产物只写锚点（无内核词）；Then assetConsumed=false
- Given 宿主产物含锚点 + 内核词；Then assetConsumed=true
- Given 无 kernel 段资产；Then 锚点即可（不回归）
- Given `regression-all.mjs`；Then 8/8 不破（S8 更新后通过）

## 纪律
- 只改 `scripts/lib/adapters/prompt.mjs` + `scripts/regression-all.mjs`（S8）；不碰其它
- 自测 4 GWT（可用 node -e 临时宿主跑 orchestrator）
