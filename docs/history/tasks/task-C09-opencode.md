# task C-09 · opencode.mjs 置 assetConsumed

> 执行者：子 agent B。验收者：独立测试 agent。承接批判 C-09。

## 目标
opencode 专用 adapter 成功路径置 `assetConsumed=true`（专用 CLI 真实执行可信），D-1 资产消费证据不再只覆盖 prompt adapter。

## 改动
`scripts/lib/adapters/opencode.mjs`：run 成功（result.ok && artifactPath）时返回 `assetConsumed: true`（专用 CLI 真实执行）；失败/超时保持无（诚实降级由 runtime 处理）。

## GWT
- Given opencode CLI 可用且执行成功；When adapter run；Then 子任务 `assetConsumed=true`
- Given opencode 不可用（OPENCODE_NOT_AVAILABLE）；Then skipped（不变，无 assetConsumed）
- Given `node scripts/regression-all.mjs`；Then 8/8 不破（S8 针对 prompt adapter，opencode 路径不影响）

## 纪律
- 只改 `scripts/lib/adapters/opencode.mjs`；自测 GWT（用 orchestrator --exec opencode 小任务验证 state.json assetConsumed）；不 commit。
