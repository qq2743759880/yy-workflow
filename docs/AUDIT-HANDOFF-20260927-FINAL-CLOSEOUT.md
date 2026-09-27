# yy 最终收口独立审计交接（2026-09-27）

> 目标：**今天结束项目**。因此本文只保留会阻止“技术收口”或会让 closeout 事实失真的问题，不再扩大战线。
>
> 身份边界：本文是独立审计者的有限读面建议，不是 ground truth、Owner ruling 或冻结任务单。编排者必须在当前 revision 下独立核验，可 ACCEPT / MODIFY / REJECT。若当前仓库与本文冲突，以仓库事实为准。

## 0. 当前快照

本轮 local MCP 快速核验：

- project: `yy`
- branch: `main`
- HEAD: `34fab93`
- working tree: clean
- 最新提交已把 `applyCapabilityToPlan` 接到 `scripts/orchestrator.mjs` 的真实 buildPlan 主链。
- `scripts/regression-all.mjs` 的 S17 段真实在场。
- W2-0 Ingress Mini-Contract 在：
  `plans/W2-0-ground-truth-ingress-contract-20260927.md`

## 1. 已确认成立的部分

### 1.1 F-E2E-2 的代码修复真实存在

当前主链：

`buildPlan()`
→ `applyCapabilityToPlan(plan,{capability:opts.capability})`

已真实接线，不再是 lib 导出但 main 零调用。

因此“显式 --capability 被 parse 后完全静默丢弃”的原始缺陷，**代码层已修**。

### 1.2 S17 真实在场

W2-4 旧 RESULTS 中“O-E2E-1：W2-3 未执行”已经被当前仓库反证：

- S17 位于 `scripts/regression-all.mjs`
- 九场景与 counterexample 判定代码真实存在

所以 O-E2E-1 应视为**历史错误判断**，不要再次按它开整改。

## 2. 今天收口前仍需独立核验的三个最小问题

### BLOCKER-A — 修复后没有新的 E2E-v3 canonical result

当前 `test-reports/autopilot-work/E2E-v3/RESULTS.md` 仍然写：

- S2-2 FAIL → F-E2E-2
- S2-4 FAIL → F-E2E-2
- 结论“存在实锤断言失败”

而 HEAD 已在之后修了 F-E2E-2。

这意味着：

> production code truth 已变化，但 canonical E2E evidence 仍是修复前快照。

因此在宣布“capability ingress 全链已通”前，至少需要：

1. 基于当前 HEAD 重跑 W2-4 核心场景；
2. 新建 run-stamped 或 superseding result；
3. 不覆盖历史 FAIL；
4. 明确旧 RESULTS 被哪个新证据 supersede。

今天不需要重新跑所有历史任务，只需跑 closeout 必要场景。

### BLOCKER-B — F-E2E-3 当前源码仍可复现其根因

当前主链顺序：

1. `buildPlan`
2. `applyCapabilityToPlan` 只给 subtask 写 capability/source，**不改变 asset**
3. `--contract` 覆盖仅判断 `subtask.asset === 'be-validator'`
4. freeze 后再次用同样 asset 判定回写 OpenAPI contract
5. runtime 才按 capability 把 asset 重绑定为 selected asset

所以：

> planning 阶段不是 be-validator、runtime 才因 capability 变成 be-validator 的 subtask，可能拿不到用户传入的 OpenAPI contract。

W2-4 已把它登记为 F-E2E-3，当前没有发现后续 fix 或 superseding evidence。

编排者需要独立判断：

- 这是实际 blocker；
- 还是 Ingress Mini-Contract 本来就不承诺“capability 重绑定后 contract routing 跟随”；
- 若不修，closeout 文案必须明确边界；
- 若修，只做最小 contract-routing 修复，不扩架构。

### BLOCKER-C — W2-0 frozen D.5 与 W2-3 实际 PASS 规则冲突

W2-0 Mini-Contract D.5 明确冻结：

`capability + conflicting asset → CAPABILITY_ASSET_CONFLICT skip（不静默取一）`

但当前 runtime 实际行为：

- capability resolver 选新 asset；
- 覆盖旧 `subtask.asset`；
- 记录具名 logger / eligibility reason；
- **不 skip**。

S17-4 为了让现状通过，把判据放宽为：

> “具名 skip 或具名重绑定留痕，任一存在即 PASS”。

这不是单纯“实现偏差”，而是：

> regression acceptance 比 frozen mini-contract 更宽。

今天必须二选一，不能继续悬着：

**方案 1：遵守 frozen contract**  
实现 `CAPABILITY_ASSET_CONFLICT` skip，并让 S17 按原合同验。

**方案 2：正式 amendment mini-contract**  
如果编排者/Owner 判断 capability 优先 + 具名重绑定才是正确语义，则修改合同，明确 supersede D.5 原规则，再让 S17 与合同一致。

禁止保留“合同要求 skip、测试允许 rebind”双口径后宣布 close。

## 3. 非 blocker，但 closeout 要诚实登记

### 3.1 F-E2E-1

W2-4 派单字面 task：

`对 OpenAPI 契约做安全校验`

没有命中当前受控派生词表。

如果受控词表就是设计边界，这不一定是缺陷；但 closeout 必须说清：

- capability derivation 是受控关键词精确/确定性规则；
- 非登记自然语言不会被“猜”成 capability；
- 不要写成“任意自然语言都能 capability-native”。

如果希望该句也支持，应走词表变更纪律，不要临时 fuzzy match。

### 3.2 并行 staging 纪律又被违反

前一轮已经因共享 working tree 事故明确建议禁 `git add -A`。

本轮报告中的 W2-1、W2-3+W2-4 收口仍出现 `git add -A`。

当前工作树 clean，不代表纪律已落实。

今天可以不因此阻塞技术 close，但 closeout 必须登记：

- 这是 process deviation；
- 后续项目模板应改为精确 stage / worktree / 编排者统一 commit。

### 3.3 Owner pending 叙述需以 ledger 当前事实为准

报告前后同时出现：

- “你名下无待决”
- “只剩 E-4 / AS-2-review”

而历史 ledger 已有这些裁定落账。

最终 closeout 不要继续复制旧话术，应重新从当前 ledger/change record 生成 pending list；若为空就写空，若是 resource backlog 就明确 backlog，不称 Owner decision pending。

## 4. 今天的最小关闭标准

不再开新 Batch、不再重构、不再新增 feature。

只要求：

1. 裁决并处理 BLOCKER-C（contract 与 runtime/S17 同口径）。
2. 裁决 F-E2E-3；若属 contract 范围就最小修，若不属就明确边界。
3. 当前 HEAD 重跑最小 E2E-v3：
   - explicit capability
   - derived capability
   - unknown capability
   - legacy
   - contract-routing（若 F-E2E-3 被认定需要）
4. 生成 superseding closeout evidence。
5. 回归 / preflight / validate / audit-index selftest 最终一遍。
6. 写 FINAL CLOSEOUT，只声明实际证明到的边界。
7. working tree clean，停止继续派单。

## 5. 审计者建议的 STOP 线

今天目标是“结束项目”，不是“把所有潜在优化做完”。

以下全部建议转 backlog，不要继续施工：

- Multi-candidate ranking
- embedding / fuzzy capability resolver
- MG-1 无 key 的实现
- E-4-EXEC 无资源的行为验证
- UI 美化
- 依赖再瘦身
- capability taxonomy 扩写
- 新 Batch 4

除非其中某项被当前真实 close gate 明确要求。

## 6. 对编排者的要求

请不要因为“审计者列了三个 blocker”就机械修三个。

你必须先独立重读：

- W2-0 frozen contract
- runtime conflict semantics
- current orchestrator contract routing
- current E2E evidence

然后逐项给：

- ACCEPT
- MODIFY
- REJECT

目标是今天做**最小真实收口**，不是再启动一轮无限审计。
