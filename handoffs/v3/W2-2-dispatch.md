# W2-2 派单 — Runtime + State Provenance Integration（Batch 3 Wave 2 Step 2，依赖 W2-1 完成）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先完整读派单 `D:\.ai-hub\skills\yy\handoffs\v3\W2-2-dispatch.md`（如无则由编排者补发后你再执行）与 Ingress Mini-Contract `plans/W2-0-ground-truth-ingress-contract-20260927.md`。完成后交付证据，不自称 DONE。

## 防超时纪律
切 6 小步每步 ≤10 分钟落盘；探针输出存文件（W2-2 目录）。

## 任务
1. **subtask 字段透传**：planner 产出的 `capability`/`capabilitySource` 在 runtime.dispatch/资格门/adapter 全链透传（资格门已复用 resolver 链——你只需确认链路不丢字段并在 state.json/journey 投影落三字段）；
2. **journey 投影**：`scripts/lib/journey.mjs:665` subtask 投影追加 `capability`/`capabilitySource`/`selectedAsset` 三字段（null 也显式写）；
3. **state.json**：writeStateSummary 序列化含三字段（resume 老状态缺字段 → 原样容忍不崩溃）；
4. **receipt/state 留痕**：capability 模式 subtask 的 state 记录含 `capability`/`capabilitySource`/`selectedAsset`/`eligibilityReason`。

## 自测（证据落 `test-reports/autopilot-work/W2-2/`）
1. capability 子任务 state.json 三字段在场；
2. resume 老 state（无字段）不崩溃；
3. journey 投影三字段在场；
4. 向后兼容：无 capability 任务 state 零字段变化（字节级比对 state.json）；
5. 回归三件全绿。

## 白名单
scripts/lib/runtime.mjs（透传最小 diff）、scripts/lib/journey.mjs（投影三字段）、test-reports/autopilot-work/W2-2/。

## 禁止
改 contracts/、scripts/orchestrator.mjs、scripts/lib/planner.mjs、governance-skills/、webview/、SKILL.md、commands/、plans/、vendor/、其他 scripts/；禁 git。

## 验收要点
state/journey 三字段在场 + resume 兼容 + 向后兼容字节级 + 回归三件全绿。