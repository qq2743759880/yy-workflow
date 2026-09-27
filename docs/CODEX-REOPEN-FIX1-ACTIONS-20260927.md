# Codex REOPEN-FIX-1 Action Plan — yy（2026-09-27）

> 单一目标：修复 capability-selected be-validator 未消费用户 --contract 的 P1。
> 今天必须重新 close。不要扩大战线。

## RF1-0 — Independent Reproduction

Codex 自己重跑最小 repro：

- T2/T1 中原始 asset 非 be-validator
- `--capability openapi-validation`
- `--contract <valid OpenAPI>`

确认：

- selectedAsset 最终是 be-validator
- 当前实际 contract 是否仍指向 freeze JSON
- Spectral 是否 degraded/pass:null
- plan 是否仍 done

若无法复现：STOP，说明为什么，并保持 CLOSED。

## RF1-1 — Choose Minimal Authority Point

只允许使用现有 authority：

- CAPABILITY_MAP / resolver
- current contractSource / freezeContract semantics

禁止：

- 复制 capability→asset 映射
- 新建第二套路由表
- fuzzy match
- 多候选

输出一段简短 decision：

- 修复层位
- 为什么最小
- 为什么不会和 runtime resolver 漂移
- write face

## RF1-2 — Production Fix

预期主写面：

- `scripts/orchestrator.mjs`

如需其它生产文件，先解释必要性。

Invariant：

最终 selected routing 为 be-validator + valid --contract
→ 实际 adapter 一定消费用户 OpenAPI。

## RF1-3 — Permanent Regression

建议在：

- `scripts/regression-all.mjs`

增加明确段落，例如 S18（命名由编排者决定）。

必须覆盖：

- legacy validator + contract
- capability rebound validator + contract
- non-validator capability + contract
- invalid contract
- contract-draft

判定必须读真实 adapter result，不只看日志。

## RF1-4 — Superseding E2E

新目录，例如：

`test-reports/autopilot-work/E2E-v3-contract-route-<run-stamp>/`

不要覆盖旧 E2E-v3。

必须留下：

- command
- exit code
- state
- journey projection
- contract-result
- assertions
- RESULTS

RESULTS 显式：

`F-E2E-3: CLOSED FOR CURRENT HEAD`

并引用旧 evidence 为 historical。

## RF1-5 — Final Gates

运行：

- regression
- preflight
- validate
- audit-index selftest

必要时 manifest/hash 只读确认；没有改 manifest 就不要重建。

## RF1-6 — Formal Re-close

更新 ledger：

- takeover reopen 原因
- P1 finding
- minimal fix
- superseding E2E
- gates
- final HEAD
- backlog 不变

然后：

- 精确 stage
- commit/push
- git clean
- active lock/task = 0
- STOP AUTO-DISPATCH

## 禁止

- Batch 4
- 新 capability key
- multi-candidate
- MG-1/E-4
- asset redesign
- dependency cleanup
- UI work
- 顺手重构

修完这一条就结束。

## REOPEN-FIX-1 执行结果（2026-09-27）

- RF1-0：独立复现成立；planning-time asset 路由遗漏 capability 最终选出的 validator，导致 `done` 计划中的 Spectral 结果为 `degraded=true/pass=null`。
- RF1-1/RF1-2：选择最小 post-freeze 层；生产代码复用 `CAPABILITY_MAP` 单一 authority，只将最终目标为 `be-validator` 的真实 `--contract` 路由回用户 OpenAPI。legacy、未知 capability fail-closed、`--contract-draft` 均保留。
- RF1-3：永久 S18 覆盖五类真实 CLI 与实际 Spectral/Semgrep adapter 结果，专项 14/14；全量 regression 36/0。
- RF1-4：superseding evidence 在 `test-reports/autopilot-work/E2E-v3-contract-route-20260927T171036/`，旧 E2E-v3 保留。
- RF1-5：preflight 8/0、validate 0 warnings、audit-index selftest 68/0；manifest 未重建、backlog 未改。
- RF1-6：ledger 记录 P1、production impact、Decision、fix、E2E、gates 与最终 production HEAD。精确 stage/push 后项目关闭：`PROJECT CLOSED / STOP AUTO-DISPATCH`。
