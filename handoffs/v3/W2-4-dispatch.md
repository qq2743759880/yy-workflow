# W2-4 派单 — E2E-v3（Batch 3 Wave 2 Step 4，最后，依赖 W2-1/2/3 全收）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先完整读派单 `D:\.ai-hub\skills\yy\handoffs\v3\W2-4-dispatch.md`（如无则由编排者补发后你再执行）与 Ingress Mini-Contract `plans/W2-0-ground-truth-ingress-contract-20260927.md`。完成后交付证据，不自称 DONE。

## 任务：从真实 task 入口跑完整链（Production Ingress 完整验收——第十三审计 F-025 纪律：禁 probe 直调 dispatch）
1. **正向**：`node scripts/orchestrator.mjs --task "对 OpenAPI 契约做安全校验" --workspace <tmpws>` → 断言链：planner 派生 capability（security-audit 或 be-validator 对应键）→ orchestrator 透传 → runtime capability 模式 → resolver → be-validator → adapter（spectral/semgrep 真扫）→ state.json 三字段（capability/capabilitySource/selectedAsset）→ journey 投影；
2. **反向**：`--capability unknown-key` → 具名失败；
3. **legacy 对照**：无 capability 任务 → plan/subtask 零字段变化（字节级）；
4. **resume**：capability 任务中断 → `--resume` → 字段保留；
5. 全部证据落 `test-reports/autopilot-work/E2E-v3/`。

## 白名单
test-reports/autopilot-work/E2E-v3/（只读生产代码+写证据）。

## 禁止
改生产代码（只读验收）；禁 git。

## 自测
正向/反向/legacy/resume 四场景证据齐 + RESULTS.md。