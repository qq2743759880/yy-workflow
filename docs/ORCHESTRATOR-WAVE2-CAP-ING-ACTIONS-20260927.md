# yy 交接事项安排 — Wave 2 / CAP-ING-1 候选执行计划（2026-09-27）

> 本文不是冻结任务单。  
> 编排者必须先完成 W2-0 Ground Truth + Ingress Contract，再决定是否派实现。  
> 审计者只提供候选拆分，编排者可重排、合并、拒绝。

## W2-0 — Ground Truth + Ingress Contract Freeze【必须先做】

### 目标

回答一个问题：

> production capability 到底由谁产生、以什么 schema 进入 planner/runtime？

### 建议读取

最小必要工作集：

- `scripts/lib/planner.mjs`
- `scripts/orchestrator.mjs`
- `scripts/lib/activation.mjs`
- `scripts/lib/runtime.mjs`
- `scripts/lib/matrix.mjs`
- `scripts/lib/prompt-composer.mjs`
- `scripts/lib/phase.mjs`
- state/store/summary 中 subtask 序列化相关代码
- 当前 plan/task contract
- CD-1-GV2 probes
- T0 + ACC-1

### 必须产出

一个 mini-contract，至少冻结：

- capability source
- capability vocabulary authority
- precedence
- planner/subtask schema
- capability/asset compatibility
- fail-closed behavior
- provenance
- state/replay compatibility
- receipt/evidence shape

### 必须做的反例搜索

- capability 零命中
- capability 与 asset 冲突
- capability 指向 ineligible asset
- capability 指向 drop asset
- legacy asset-only plan
- resumed old plan
- planner 不知道 capability 但 runtime 支持 capability 的半链状态

### Gate

没有 contract，不进入 W2-1。

---

## W2-1 — Planner Capability Production【依赖 W2-0】

### 目标

让 capability 在 production planner/orchestrator 链真实产生。

### 核心纪律

最终验收不得使用：

```js
subtask.capability = '...'
```

这种测试注入作为主证明。

必须从真实入口：

`task -> buildPlan -> subtask.capability`

出现。

### 实现策略

由编排者根据 W2-0 决定，不在本交接里预选：

- explicit input
- deterministic task-token mapping
- cluster-derived mapping
- mixed mode

### 非目标

- 多候选 ranking
- LLM fuzzy routing
- embedding
- capability taxonomy 大重构

### 建议 write face

预期但不保证：

- `scripts/lib/planner.mjs`
- `scripts/orchestrator.mjs`
- 必要的 contract/schema
- tests/evidence

如果发现需要改 runtime/activation，先重新核 write face；不要默认扩权。

---

## W2-2 — Runtime + State Provenance Integration【依赖 W2-1】

### 目标

保证 capability 不是 planner 的装饰字段，而是真正成为 runtime routing 输入。

需要证明：

`requested capability`
→ `resolver`
→ `selected_asset`
→ `eligibility`
→ `adapter`

### 建议核验面

- runtime dispatch 是否真的消费 planner 产生的 capability
- selected asset 是否覆盖/回填一致
- capability 与 asset mismatch 行为
- state 是否保存 requested capability
- resume/replay 是否保持 selection
- failure memory 是否记录 capability
- receipt/report 是否保留 routing provenance
- Prompt Composer/governance 仍拿到正确 selected asset

### Gate

如果 state 只能保存 asset，而 capability 在 dispatch 后完全丢失：

**不能宣称 capability-native 主链闭环。**

---

## W2-3 — Compatibility + Negative Matrix【可与 W2-2 后半串行，不建议独立并行修改同写面】

至少覆盖：

1. capability-only
2. asset-only legacy
3. capability + matching asset
4. capability + conflicting asset
5. unknown capability
6. ineligible selected asset
7. dropped asset
8. old persisted plan
9. capability registry / manifest mismatch
10. resolver exception

每个 case 必须冻结 expected:

- status
- error code
- selected asset
- receipt/evidence
- state mutation
- adapter reachability

未知/冲突不允许 silent fallback。

---

## W2-4 — E2E-v3【Wave 2 实现完成后】

### 真正的主验收

从用户 task 入口起跑：

`task`
→ planner
→ capability
→ orchestrator
→ resolver
→ selected asset
→ adapter
→ receipt/state

### 主断言

- capability 由 planner/入口产生，不是 probe 注入
- selection provenance 在场
- selected asset 与 adapter 一致
- unknown capability fail-closed
- legacy asset-only compatibility 与 contract 一致
- manifest hash / Gate-2 不退化
- PC-1 composer / GV-2 governance 不退化
- regression/preflight/validate/audit-index 持续绿

### llm 行为面

继续遵循 ACC-1：

- mech Runtime Boundary 可以独立验证机制
- E-4-EXEC 没有 Owner 资源时，不得把 mech 结果写成 LLM 行为级通过

---

## Wave 2 并行策略

本 Wave 的 planner/orchestrator/runtime/activation 高度耦合。

建议：

- W2-0 独立先做
- W2-1 → W2-2 → W2-3 主链串行
- W2-4 最后
- 不要为了“并行优先”强拆同写面任务

可以并行的只有：

- 纯 evidence audit
- 不触生产写面的历史索引核验
- Owner-resource gated 的独立准备工作

**并行原则是“无依赖 + 无写面交叉才并行”，不是“任务数量越多越好”。**

---

## Git / staging 新纪律【必须吸收 Wave 1 事故】

Wave 1 已出现：

SECMAN-1 commit 把 KERNEL-1 在途文件一起 stage。

后续明确禁止：

`git add -A`

用于并行 agent 收口。

候选规则：

- agent 不 commit，由编排者统一收口；或
- 每单独立 worktree；或
- 只 stage 白名单精确路径。

L2 必须检查：

- staged paths
- changed files ownership
- cross-task files
- commit message 与实际文件归属

发现污染立即 STOP。

---

## 当前不建议立即派的任务

### Multi-candidate Resolver

ACC-1 已确认原口径未闭环，但当前没有充分真实需求。

不要混入 CAP-ING-1。

### MG-1

需要 Owner API key，资源不到位保持 backlog。

### E-4-EXEC

需要真实 LLM host / Owner 执行时机，保持 gated。

### reflect-metadata / tslib 再清理

与 capability ingress 无直接依赖，不要顺手扩大范围。

---

## 编排者下一步应先报告什么

不要直接回复“CAP-ING-1 已派”。

先给 Owner 一个短报告：

### A. Ground Truth

当前 HEAD / clean / Wave 1 facts。

### B. Ingress Options

A/B/C 或其它方案，各自：

- authority
- determinism
- compatibility
- risk

### C. Decision

说明最终选择与拒绝理由。

### D. Contract

给出 mini-contract。

### E. Dispatch DAG

只在 contract freeze 后列实际执行单。

### F. Stop Conditions

列出哪些情况会暂停，而不是硬推。

---

## Completion Definition

Wave 2 完成不能只说：

“runtime 能接受 capability”。

至少应满足：

- production producer 存在
- production consumer 存在
- deterministic authority 清楚
- state/evidence 不丢 provenance
- negative fail-closed
- legacy compatibility 有界
- E2E 从真实入口证明

否则只能叫：

`capability ingress partial`

不能叫：

`capability-native production chain complete`
