# yy 今日最终收口事项（2026-09-27）

> 目标：今天结束项目。  
> 这是一份候选 closeout runbook，不是强制任务单。编排者需先独立核验后执行。

## FC-0 — 5 分钟 Ground Truth Gate

只核：

- HEAD / clean
- W2-0 mini-contract D.5
- runtime capability conflict 行为
- orchestrator --contract 路由顺序
- E2E-v3 canonical RESULTS 是否仍为修复前
- 当前 Owner/resource pending list

输出一张 6 行裁定表，不做长报告。

---

## FC-1 — Contract / Runtime 一致性【必须先裁】

对象：

`capability + conflicting asset`

当前疑似：

- contract：必须 `CAPABILITY_ASSET_CONFLICT skip`
- runtime：capability 优先重绑定 asset + 具名留痕
- S17：两者任一都算 PASS

编排者只能选一个权威语义。

### Path A — skip

若冻结 contract 优先：

- runtime 实现具名 skip
- S17 去掉“具名重绑定也 PASS”的放宽
- 正反例复跑

### Path B — rebind

若 capability precedence 设计要求重绑定：

- 先做 contract amendment
- 明确 `capability > asset hint`
- 冲突必须有 provenance / warning
- S17 与 amendment 对齐

**禁止**只改测试。

---

## FC-2 — F-E2E-3 最小裁决

检查：

`--capability openapi-validation` / 等价受控 capability
+
`--contract <real OpenAPI>`

当 planning asset 原本不是 be-validator、runtime 后来重绑定成 be-validator 时：

- 是否拿到真实 OpenAPI contract？
- spectral 是否真实执行？
- contract 是否仍被 frozen plan JSON 覆盖？

如果答案是否：

### 若 Mini-Contract 期望 capability-selected adapter 能消费对应 CLI contract

做最小 routing fix。

推荐思路不是指定实现，只要求 invariant：

> contract routing 应基于最终 selected routing semantics，而不是 stale planning asset。

### 若此组合明确不属于当前 contract

不改代码，但必须在 closeout 和 CLI contract 中明确“不支持该组合”。

不能继续既注册 finding 又宣称全链完全完成。

---

## FC-3 — Superseding E2E-v3【必须】

F-E2E-2 修复后，不要沿用旧 RESULTS 的 FAIL。

新建例如：

`test-reports/autopilot-work/E2E-v3-closeout-<run>/`

至少重跑：

1. explicit known capability
2. derived capability
3. unknown capability
4. legacy asset-only
5. resume/provenance
6. contract-routing（若 FC-2 属支持范围）
7. conflict semantics（按 FC-1 最终合同）

要求：

- 从真实 CLI/task 入口
- 不手工 patch subtask
- evidence 指向当前 HEAD
- 原 E2E-v3 历史 FAIL 保留
- 新结果声明 supersedes 哪些旧 finding

---

## FC-4 — Final Gates

只跑最终必要门：

- regression
- preflight
- validate
- audit-index selftest
- manifest/hash consistency（若本轮触 manifest）

任何 FAIL：

今天不要再扩大修复范围。

只修与本轮 close blocker 直接相关的失败；其它登记 backlog。

---

## FC-5 — FINAL CLOSEOUT

最终报告建议只写四段：

### A. Proven Complete

只列有当前 HEAD evidence 的：

- Batch 1
- Batch 2 主体
- Batch 3 Wave 1
- capability ingress
- contract/runtime semantics
- final E2E
- gates

### B. Explicit Boundaries

例如：

- controlled capability vocabulary
- no fuzzy routing
- no multi-candidate ranking
- mech vs LLM behavior boundary
- MG-1/E-4 resource backlog

### C. Deferred Backlog

只登记，不施工。

### D. Repository State

- final HEAD
- working tree clean
- no running execution tasks
- no unresolved change lock
- evidence index current

然后：

**STOP PROJECT WORK。**

不要再自动派新 Batch。

---

## 今天禁止的新工作

- 不开 Batch 4
- 不重构 resolver
- 不做多候选
- 不新增 capability key
- 不扩 UI
- 不继续 dependency cleanup
- 不碰 MG-1/E-4 无资源项
- 不做“顺便优化”

今天只有：

`contract truth → minimal fix → superseding E2E → final gates → closeout → STOP`

---

## Git 收口纪律

本轮禁止：

`git add -A`

使用精确路径 stage，或者由编排者统一提交。

最后必须：

- working tree clean
- staged files 与 closeout write face 一致
- commit message 不承担文件归属 truth
