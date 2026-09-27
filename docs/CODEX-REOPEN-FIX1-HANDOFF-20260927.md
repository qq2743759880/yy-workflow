# Codex Final Reopen Handoff — yy / REOPEN-FIX-1（2026-09-27）

> 目标：今天完成项目。
> 本文件来自独立审计者的有限读面，仅作为 Codex 编排者的开工建议，不是 ground truth 或 Owner ruling。
> Codex 必须基于当前 revision 独立核验，可 ACCEPT / MODIFY / REJECT；禁止机械执行。

## 0. 当前地面事实

通过 local MCP 重新确认：

- project: `yy`
- branch: `main`
- HEAD: `b53e920`
- tracked working tree: clean
- 当前只有此前两份 Codex takeover 文档 untracked
- formal closeout commit 在场
- D.5 amendment 已落地：capability 与 asset 冲突时 capability 优先重绑定 + 具名留痕

Codex takeover 独立复现了一个当前 production blocker：

`--capability openapi-validation + --contract <valid OpenAPI>`

可能最终 `done`，但真正被 capability 选中的 be-validator 没拿到用户 OpenAPI contract，因此 Spectral 未真校验。

## 1. 审计者独立复核结果

### 1.1 生产代码仍存在 F-E2E-3 根因

当前 `scripts/orchestrator.mjs` 顺序：

1. `buildPlan()`
2. `applyCapabilityToPlan()` 仅写 capability/source，不改 asset
3. `--contract` 只给此时 `subtask.asset === 'be-validator'` 的子任务赋真实 OpenAPI
4. `freezeContract()` 把所有 subtask.contract 重写成内部 freeze JSON
5. 冻结后仍只给此时 `asset === 'be-validator'` 的子任务恢复用户 OpenAPI
6. runtime dispatch 才根据 capability 将 asset 重绑定成 be-validator

因此 planning 阶段不是 be-validator、runtime 后才变成 be-validator 的子任务，会继续拿内部 freeze JSON。

### 1.2 Adapter 对此会诚实降级，但 plan 仍可能完成

`scripts/lib/adapters/portman.mjs`（当前 Spectral 主路径）明确：

- JSON 不是 OpenAPI → `pass:null`
- `degraded:true`
- “recorded but not validated”

这避免了假报 Spectral 验证成功，但没有阻止上层 plan 以 done 收口。

所以 Codex 的 finding “done 但没有完成合同验证”具有真实 production impact。

### 1.3 历史 E2E 已记录同一问题

`test-reports/autopilot-work/E2E-v3/RESULTS.md` 已登记 F-E2E-3。

但这只能作为历史线索；当前 reopen 依据应以 Codex 当前 HEAD 独立复现为主。

### 1.4 Formal closeout 后未发现覆盖该组合的 superseding evidence

本轮搜索未找到明确针对：

`capability-selected be-validator + --contract real OpenAPI`

的 post-closeout superseding result。

因此不应继续把该组合写成“全链 CONFIRMED”。

## 2. Reopen 范围

只允许：

`REOPEN-FIX-1 = capability-aware contract routing`

禁止重新打开：

- capability taxonomy
- D.5 precedence
- multi-candidate ranking
- migration
- governance
- asset replacement
- MG-1
- E-4
- dependency cleanup
- UI
- Batch 4

## 3. 修复目标（Invariant，不指定实现）

核心 invariant：

> 如果最终 routing 结果是 be-validator，并且用户提供了有效 `--contract` OpenAPI 文件，则实际执行的 be-validator 必须消费该 OpenAPI 文件，而不是内部 freeze JSON。

同时：

- legacy asset-only + `--contract` 行为不得回退；
- capability 不选择 be-validator 时不得误把 OpenAPI contract 注入其它 adapter；
- `--contract-draft` 既有 brownfield 语义不得被破坏；
- freezeContract 仍需保留其 contractSource / hash 作用；
- capability provenance / selectedAsset / journey 不退化。

## 4. Codex 必须先独立决定修复层位

可能方案示例仅供比较，不是指定答案：

### 方案 A：plan 后处理阶段提前解析最终 selected routing

在 freeze/contract routing 前得到最终 target asset，然后再做 contract assignment。

风险：可能复制 runtime resolver 语义，形成第二套 authority。

### 方案 B：把 contractSource 作为与 capability 独立的执行输入传到 runtime/adapter

让最终 selected adapter 在 dispatch 时决定是否消费 contractSource。

风险：改变 runtime/adapter 输入协议，影响面更大。

### 方案 C：最小 post-freeze capability-aware contract assignment

使用已有 `CAPABILITY_MAP` / production resolver 的单一 authority，在 freeze 后、execute 前，把真实 OpenAPI 只重新绑定给最终目标为 be-validator 的 subtask。

风险较小，但必须避免手写第二份 capability→asset 映射。

Codex 应自行选最小、单一 authority、可机验方案。

## 5. 必须新增的回归

不要只修 E2E。

至少加一个永久 regression，覆盖：

1. asset-only be-validator + valid `--contract` → Spectral 真校验
2. capability `openapi-validation` 将非 validator hint 重绑定到 be-validator + valid `--contract` → Spectral 真校验
3. capability 选 security + `--contract` → 不把 OpenAPI 错喂给 security
4. invalid/non-OpenAPI contract → 仍诚实 degraded / fail 按当前契约
5. `--contract-draft` → brownfield 语义不变

测试必须调用真实 production function/caller，禁止自造 contract-routing oracle。

## 6. Superseding E2E

修复后生成新的 run-stamped evidence，不覆盖：

`test-reports/autopilot-work/E2E-v3/RESULTS.md`

新结果至少证明：

- 当前 HEAD
- real CLI
- `--capability openapi-validation`
- valid OpenAPI `--contract`
- selectedAsset=be-validator
- actual Spectral mode=exec
- tool=spectral
- pass 为真实 boolean（不是 null）
- scope 指向用户 OpenAPI
- state/journey provenance 保留

并显式写：

`supersedes F-E2E-3 for current HEAD`

## 7. Final Gates

只跑：

- regression
- preflight
- validate
- audit-index selftest
- 与 contract routing 直接相关的 E2E

如果某个失败与本 finding 无关，登记 backlog，不扩修。

## 8. Git / scope 纪律

当前还有两份此前 Codex takeover 文档 untracked。

本轮禁止 `git add -A`。

只 stage：

- 本次 production fix
- 本次 regression
- 本次 run-stamped evidence
- 必要 ledger/closeout 更新
- 用户决定是否入库的交接文档

不允许把无关 untracked 文件扫进提交。

## 9. 重新 close 的条件

满足全部：

1. Codex 当前 finding 不再可复现
2. permanent regression 在场
3. superseding E2E 在场
4. final gates 全绿
5. ledger 把之前 formal closeout 的过度声明修正/补充
6. working tree clean（允许明确未纳入版本控制的交接文档先处理）
7. active locks/tasks = 0

然后输出：

`PROJECT CLOSED / STOP AUTO-DISPATCH`

此后禁止继续开任务。
