# RG-1 派单 — 研究门（批 0）

你是 autopilot 管理 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §四 RG-1，严格按其执行。完成后交付证据，不自称 DONE。

## 任务 A：内核 = vendor 原仓库（禁止自研复刻）
`git clone --depth 1 https://github.com/dzhng/deep-research` → `vendor/deep-research/`，`VENDORED.md` 记录 commit hash/日期/license/星标。**只允许在 `scripts/research-gate.mjs` 写 ≤150 行胶水**（调其循环），禁止读 README 后重写实现。

## 任务 B：两 gate 文档模板 + 机验
新建 `scripts/research-gate.mjs`（白名单内），产出两份文档：
- `docs/prior-art.md`：`search_queries[]`≥5、`sources_used`≥2 类、候选表（repo_url/stars/last_commit/license/overlap 0-1/differentiation/verdict: adopt|adapt|reject）、`wheel_status: existing|partial|novel`——**novel 必须附"检索过什么、为何没找到"证据行，否则 gate FAIL（fail-closed）**。
- `docs/market.md`：`pain_evidence[]`≥3（url+quote+date）、`competitors[]`≥3（name/pricing/gap）、`verdict: build|pivot|drop` + confidence。
- 机验：字段用固定 JSON block，脚本校验枚举值、条数、URL 存在性；WebSearch 不可用时以 api.github.com search + registry.npmjs.org 作为兜底检索源（实测可达）。
- gate 挂点：`tt-journey --prereq-check --step 1.5`（新增阶段 1.5，前置=阶段 1 概念版已签收）。

## 任务 C：prereq-check 新阶段
改 `scripts/tt-journey.mjs`（白名单内）：新增 STEPS 条目 step 1.5 = 研究门，前置=step 1 done + gate concept-signed；产出 gate `research-done`。**不得破坏既有 STEPS 语义**（regression 13/13 必须复跑）。

## 约束
白名单：`scripts/research-gate.mjs`、`scripts/tt-journey.mjs`、`vendor/deep-research/`、`test-reports/autopilot-work/RG-1/`、docs/ 下两份 gate 文档。
不得改 SKILL.md/commands/webview/contracts/reference/plans/其他 scripts；禁 git。

## 自测（必须，证据落 RG-1 目录）
1. vendor：clone 成功 + VENDORED.md 字段齐 + `node vendor/deep-research/...` 自测其循环真跑（不是我们复述）；
2. 机验：合规 prior-art/market 样本 → gate PASS；缺 search_queries / wheel_status=novel 无证据行 / pain_evidence<3 → 各自 FAIL 且 detail 指名；
3. 新阶段：`--prereq-check --step 1.5` 在 step 1 done 后 exit 0，在 step 1 未 done 时 exit 1 并给原因；
4. 回归：`node scripts/regression-all.mjs` 13/13 + `node scripts/validate-structure.mjs` 0 警告。
5. RESULTS.md：逐项证据 + D-xxx 偏差（含网络不可用时的 SKIP 语义是否允许——须如实登记待 Owner 裁决）。

## 验收要点（编排者 L2 将复核）
vendor 原仓库在场且真跑；两 gate 文档机验 fail-closed；新阶段 prereq 语义正确；回归全绿。