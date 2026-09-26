# W2-3 派单 — Compatibility + Negative Matrix（Batch 3 Wave 2 Step 3，依赖 W2-1+W2-2）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先完整读派单 `D:\.ai-hub\skills\yy\handoffs\v3\W2-3-dispatch.md`（如无则由编排者补发后你再执行）与 Ingress Mini-Contract `plans/W2-0-ground-truth-ingress-contract-20260927.md` §D.5 冲突语义九场景。完成后交付证据，不自称 DONE。

## 任务：九场景负向矩阵 + S17 段（regression-all.mjs 新增）
九场景逐一机验（全部走生产函数，禁自造 oracle——F-036 教训）：
1. capability only（合法）→ 解析+执行；
2. asset only（legacy）→ 现行为零改动；
3. capability + matching asset → 允许双写；
4. capability + conflicting asset → `CAPABILITY_ASSET_CONFLICT` skip；
5. unknown capability → `INELIGIBLE_CAPABILITY_UNKNOWN` skip；
6. ineligible selected asset → 既有资格门 `INELIGIBLE_*` skip；
7. dropped selected asset → drop 检查 skip；
8. old persisted plan（无 capability 字段）→ legacy 路径零改写；
9. cluster 与 capability 解析的 asset 不在同簇 → `CAPABILITY_CLUSTER_MISMATCH` skip。
全部失败场景 → 具名 skip（不静默 done）。

## 白名单
scripts/regression-all.mjs（S17 段，继 S16）、test-reports/autopilot-work/W2-3/。

## 禁止
改其他任何文件；禁 git。

## 自测
1. 九场景逐一 PASS + 注入反例（如场景 4 静默取一 → FAIL 具名）；
2. 回归三件全绿（计数如实登记）。

## 验收要点
九场景矩阵齐 + 注入反例全抓 + 回归全绿。