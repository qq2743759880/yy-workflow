# Orchestrator Candidate Work Plan — yy / Post-Batch2（2026-09-26）

> **这是候选任务安排，不是强制任务单。**  
> 编排者必须先完成 T0 Ground Truth Reconciliation，再根据当前 repo truth 决定保留、拆分、改序或全部拒绝。  
> 任何任务一旦与当前冻结契约、write face、Owner ruling 冲突，必须停止，不得以“审计者建议”为理由越权。

## T0 — Ground Truth Reconciliation（必须先做，不编码）

目标：确认是否真的需要进入下一批，而不是沿用 closeout 叙述自动继续。

建议读取：

- `git_info / current HEAD / working tree`
- `plans/batch2-dispatch-plan-20260926.md`
- `plans/autopilot-ledger-20260921.md`
- PC-1 / CD-1-GV2 / FINAL-E2E / R-2 RESULTS
- planner / orchestrator / activation / runtime / prompt-composer
- manifest source + generated manifest
- package.json / lock / external tool bootstrap

输出：

`T0-ground-truth.md`（位置由编排者按项目现行纪律决定），至少包含：

- 当前 authoritative acceptance criteria；
- 已满足 / 未满足 / 被 amendment 的条目；
- Owner/resource pending；
- 下一批是否成立；
- 每个候选任务的 write face；
- 明确拒绝哪些审计者建议以及证据。

**Gate T0**：T0 未完成，不派架构级任务。

---

## T1 — Acceptance Reconciliation（优先，文档/治理面）

### 假设

原 Batch 2 计划要求 mech + llm 双模式；当前 closeout 只证明 mech，完整状态仍 PARTIALLY CONFIRMED。

### 编排者应裁定

- E-4-EXEC 是 Batch 2 hard close gate？
- 还是 Owner 明确 amendment 后转 Batch N？
- MG-1 是 optional backlog 还是 close gate？

### 建议产物

- 一个明确的 acceptance amendment / closeout boundary 文档；
- 不改历史证据；
- 明确 `CONFIRMED / PARTIALLY CONFIRMED` 的对象是什么。

### 写面

优先只写 plans/docs/治理记录。若触冻结契约，必须走 change mechanism。

---

## T2 — Security Manifest Semantic Freshness（建议高优先、小改动）

### 审计假设

`contracts/manifest-sources/security.yaml` 仍描述：

- “目录目标放行”
- “0 findings 属真实扫描结果”

而当前 `security-semgrep.mjs` 已实现：

- 纯非 Python 目录拒绝；
- 混合目录 `pass=false + UNCOVERED_LANGUAGES`。

### 开工前核验

1. adapter 当前行为；
2. sidecar 是否为生成 manifest 的 source-of-truth；
3. migration deviations / security RESULTS 是否已有更新口径；
4. manifest-build 是否唯一写方；
5. 修改 source 是否需要 receipt/change record。

### 若假设成立

只改权威 source，然后：

- manifest rebuild；
- hash 重新绑定/登记；
- resolver/Prompt Compiler 读取验证；
- regression/preflight/validate/audit-index；
- 对 security 的 `when_not_to_use` 做正/负 E2E。

### 禁止

- 直接手改 `asset-manifest-v2.json`；
- 只改文案不重建；
- adapter 与 manifest 两套能力口径长期并存。

---

## T3 — External Kernel Reproducibility / Spectral Dependency Policy（建议高优先）

### 背景

R-2 实证 `npm prune` 删除了 `--no-save` 安装的 spectral CLI；当前 package/lock 仍无 spectral 记录。

### 目标

定义“生产执行内核如何在干净环境可重建”。

### 编排者先比较方案

- package dependency / optionalDependency；
- bootstrap script + pinned version + checksum/provider identity；
- 独立 toolchain provision；
- vendor 方案。

不要默认其中任何一种。

### 验收建议

至少做一次接近干净环境的可重复性探针：

1. 不依赖当前 node_modules extraneous；
2. provision；
3. `spectral --version`；
4. be-validator PRIMARY adapter 真跑；
5. S15-A2 / S16 migration probe；
6. lock / manifest / license 归因。

### 关联小项

在同一轮独立核 `reflect-metadata` / `tslib` 是否真孤儿；若没有证据，不删。

---

## T4 — Capability Ingress Completion（架构候选，先决策后施工）

### 当前边界

runtime 已能：

`{capability} -> CAPABILITY_MAP -> asset -> eligibility -> adapter`

但 CD-1 自报 production planner/orchestrator 尚无 capability 字段入口。

### 只有在 T0 判定“目标是全链 capability-native”时才施工

建议先画真实 schema/call chain：

`user/task input -> buildPlan -> plan/subtask schema -> capability request -> resolver -> selected_asset -> runtime -> receipt`

然后明确：

- capability 是 planner 输出还是 task contract 输入；
- asset 是否还允许作为兼容输入；
- capability 与 asset 同传的 precedence；
- receipt/eligibility 如何记录 selection provenance；
- resume/replay 是否稳定。

### 写面风险

大概率涉及：

- `scripts/lib/planner.mjs`
- `scripts/orchestrator.mjs`
- `scripts/lib/activation.mjs`
- `scripts/lib/runtime.mjs`
- plan/task contract/tests

因此不要与同写面的 resolver/FINAL-E2E 改造并行。

---

## T5 — Multi-candidate Resolver（仅在 T4/Owner 明确需要时）

当前 CAPABILITY_MAP 是确定性的 1 key → 1 asset id，避免模糊匹配，这是可接受基线。

不要为了满足“多候选”字面要求直接引入 LLM/embedding 评分。

如果确实需要多候选，先冻结：

- candidate set 来源；
- eligibility 先于 ranking；
- when_to_use / when_not_to_use / constraints 的确定性匹配规则；
- score / reason schema；
- tie-break；
- zero-candidate / multi-equal fail-closed；
- selection receipt。

**Gate**：没有冻结 deterministic policy，不写 resolver。

---

## T6 — Runtime Boundary E2E v3（依赖 T2/T3/T4/T5 中实际被采纳的项）

验收必须覆盖“本轮真正改变的生产链”，不要复用旧 E2E 就宣称完成。

候选断言：

- capability 若已进入 planner，则必须从真实 planner 输入生成，禁止手工 subtask；
- selected_asset / reason / eligibility / adapter / receipt 全链可回查；
- security manifest 新语义与 adapter 一致；
- spectral 在干净 provision 条件可执行；
- unknown capability fail-closed；
- multi-candidate 若实现，正/负/tie 全覆盖；
- mech Runtime Boundary；
- LLM 行为面只有在 E-4-EXEC 真实资源可用时才判行为级结果。

---

## T7 — Optional Owner-resource Branches

### E-4-EXEC

需要真实 LLM host 时才执行。

禁止：

- mechanical host 替代后声称 LLM 行为通过；
- 为了让 LLM 过 kernel marker 强迫模型虚假声称使用了工具/方法。

重点应该审：

- “消费证据”能否从逐字 kernel token 升级为真实行为/receipt 证据；
- 诚实拒绝是否应当被误判为未消费。

### MG-1

只有 API key / provider identity /安全边界齐备时执行。

无 key：

- 保持 backlog；
- 不做假多-agent；
- 不影响不依赖该能力的工作。

---

## 推荐依赖图（仅建议）

```
T0 Ground Truth
   |
   +--> T1 Acceptance Reconciliation
   |
   +--> T2 Security Manifest Freshness -----+
   |                                        |
   +--> T3 Kernel Reproducibility ---------+--> T6 E2E v3
   |                                        |
   +--> T4 Capability Ingress --> T5? -----+
   |
   +--> T7 E-4/MG-1（资源可用时独立插入）
```

### 可并行建议

T2 与 T3 原则上可并行，前提是实际 write face 不交叉。  
T4 与 T5 不应并行。  
T6 永远在相关生产改动之后。  
T7 由资源驱动，不得倒逼其它任务修改验收语义。

## 每个执行单必须包含

- Evidence Boundary
- 当前 revision
- 任务目标与“不做什么”
- 允许写面
- 禁写面
- 依赖
- 真实 production function / caller
- 正向探针
- 负向探针
- counterexample
- failure semantics
- rollback/compat
- 回归命令
- evidence 落盘位置
- 偏差登记
- “不自称 DONE，交 L2/Owner 裁定”

## 编排者必须保留的批判权

你可以、也应该拒绝本文中的任何一项，只要你能用当前仓库证据说明：

- 问题已经不存在；
- 任务目标与 Owner 冻结目标不一致；
- 成本/风险大于收益；
- 应该延期到其他批次；
- 有更小、更可验证的替代方案。

但拒绝应留下简短理由，避免后续 agent 把同一个问题重新包装回来。
