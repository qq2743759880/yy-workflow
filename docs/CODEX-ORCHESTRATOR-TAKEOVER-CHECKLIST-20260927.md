# Codex Orchestrator Takeover Checklist — yy（2026-09-27）

> 用途：Zcode → Codex 主编排者切换。
> 目标：快速完成接管，不重新启动已关闭项目。

## C0 — 只读接管核验

按顺序执行：

1. Git
   - HEAD
   - branch
   - working tree
   - 最近 5 个 commit

2. Closeout
   - ledger 最终 closeout
   - final E2E / final gates
   - D.5 amendment
   - capability ingress 最终主链

3. Active-state
   - 是否存在 task in flight
   - 是否存在 active change lock
   - 是否存在未提交生产改动

4. Backlog
   - Owner-resource
   - optional
   - future enhancement

要求把 backlog 与 blocker 分开。

## C1 — Codex 自身边界

Codex 是编排者时：

- 不需要为了“接管”运行 codex CLI roundtrip；
- 不修改用户 Codex 配置。

只有当项目需要将 Codex CLI 作为执行宿主时，才按：

`docs/executor-setup/codex.md`

执行：

- presence probe
- codex --version
- roundtrip probe

roundtrip 失败 ≠ 项目 reopen。

它只说明该宿主当前不可用。

## C2 — Takeover Verdict

只允许两个结果：

### KEEP_CLOSED

满足：

- closeout commit 在场
- working tree clean
- final gates/evidence 可解释
- 无当前技术 blocker
- 剩余项仅 backlog/resource

动作：

- 不派新任务
- 不开新 Batch
- 不改源码
- 向 Owner 报告接管完成
- STOP AUTO-DISPATCH

### REOPEN_REQUIRED

只有发现当前真实 blocker 才可进入。

必须先给 Owner：

- finding
- severity
- current evidence
- exact production impact
- minimal repair
- write face

没有这五项，不允许 reopen。

## C3 — 不得继承的 Zcode 行为

Codex 不应继承：

- “看到 backlog 就派单”
- “报告说 PASS 就不看代码”
- “并行 agent 共用 git add -A”
- “测试 oracle 替代 production authority”
- “旧 audit finding 自动复活”
- “为了今天完成而把 PARTIAL 写成 FULL”

## C4 — 应继承的方法论

Codex 应继承：

- Task Report is a claim
- Evidence Boundary
- production caller tracing
- write face declaration
- amendment before scope expansion
- fail-closed
- semantic freshness
- supersede-not-delete
- run-stamped evidence
- counterexample search
- L2 独立验收

## C5 — 今天的结束条件

接管确认后：

- 不再有在飞 agent
- 不再有自动队列
- 不再有生产写操作
- Git clean
- Owner 得到最终状态说明

然后：

`PROJECT CLOSED / STOP AUTO-DISPATCH`

除非 Owner 日后明确重新立项。

## REOPEN-FIX-1 Re-close Addendum（2026-09-27）

- takeover finding 在当前 production code 上可复现，定级 P1；修复仅限 capability-aware OpenAPI contract routing。
- 固定回归 S18 五类真实 CLI 场景通过；run-stamped superseding evidence：`test-reports/autopilot-work/E2E-v3-contract-route-20260927T171036/`。
- Regression 36/0、preflight 8/0、validate 0 warnings、audit-index selftest 68/0；active lock=0、active task=0。
- 交接发现的 3 份 Skill Vault `DESIGN_ONLY` 文档与该 P1 无关，保存在仓库外；未 stage。Backlog 保持原样。
- 复关闭账及最终 production HEAD 记录在 `plans/autopilot-ledger-20260921.md`。完成精确提交并推送后：`PROJECT CLOSED / STOP AUTO-DISPATCH`。
