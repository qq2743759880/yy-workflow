# R10 实现派单 — 逐字原文（verbatim）

> 来源：rollout-2026-09-19T00-06-24-01a0b544-dd62-7252-8f42-d4bc6e0445f1.jsonl line#2110（MSG，编排者产出、Owner 转发给实现者的派单原文）。
> 时间戳继承自原会话 2026-09-17（R10 派发时点）；本副本为逐字提取，未作任何改写。

**2. R10 实现派单**（并行，转发即可）：

```
任务：R10 — 资产自进化与独立上下文验收 runtime 实现（按冻结契约 C-R10-evolution）
仓库：D:/.ai-hub/skills/yy；快照 HEAD = 240f3fbdb4ee757dffc4d5ab80407d1b2c84863c（脏工作树为预期基座，不 commit）

冻结输入（读前逐一重算 sha256，任何 mismatch → STOP 并报告）：
- contracts/C-R10-evolution.md = 87301cec11c5146d7cde8591c3888017b4a401cd7916dc9b146ea41c20c2ec53
- contracts/C-R10-evolution-review-checklist.md = 31cd4e08a37d4cd809773672c6943a7b935b26acd8a034e736b6f07818692659
- plans/tasks/C-R10-freeze-20260916.md = aeabf6164cdaf83f6557d7d31053b46f33319acd15cda1ef9fac879c1990f749
- docs/tasks/yy-skill-loading-v3/R10-asset-evolution-acceptance.md = 9fefb972c0971351a8d08fb51bf9e73d3bb80a7a938f42f0ba5d7ce39ebc9617
- docs/yy-dev-plan-skill-loading-v3.md = d2e8e5b4…（以重算值为准，记录 tree 口径）
- plans/tasks/G2.2-task-graph-20260911.md = e2b63a2ba580c2731b6d438aab54adc143b02799380bb10f45aa1cc075294580
- plans/tasks/PRD0-contract-revision-v3.md = 14f4dfe84ea84c72b6d72064e09aca50b425ec04bf2365c737c9e3eb0c0d2556
- contracts/C-R3-activation.md = cfb077840fa83b6bf408441256d0bd7e25534b7f8b9b380dadb511d74455ceff
- contracts/C-R4-control.md = 19055ff7a5c881ef4daab4d323e8710467ae5f0ffd2a4db2d1ba21c34cb1a666
- contracts/C-R8-remediation.md = d9d33d488a0731edbe699c1fb68dc5d67151870c1a319ceb31473fe6ef4ef2c1

实现要求（全部锚定冻结契约，禁发明）：
1. 新增 scripts/lib/evolution.mjs：仅 evolution.propose / evolution.accept 两操作；错误码仅六码 CANDIDATE_INVALID / BASELINE_MISSING / ASSET_VERSION_CONFLICT / INDEPENDENT_VERIFICATION_REQUIRED / EVOLUTION_REGRESSION / PROMOTION_NOT_ALLOWED；统一响应壳 {ok,code,data,evidence,warnings}。
2. 候选 schema + sourceVersion + proposedBy（§2.1）；candidateId = cnd-<YYYYMMDDTHHMMSSZ>-<8位随机>；存储 evidence/evolution/<assetId>/<candidateId>/{candidate/,baseline/,promotion/} append-only（OQ-R10-1=A）。
3. Baseline-first：propose 前置 baseline 五键齐备判定（结构/manifest/receipt 终态/CI 段/rollback 目标），缺任一键 → BASELINE_MISSING，fail-closed，不臆断补全（OQ-R10-2=A）。
4. Promotion 三维判定结构（OQ-R10-3=A）：token 预算不增 + behavior（receipt 终态）不劣于 baseline + compatibility（结构/CI）全过。所有阈值数值保持 [待补充] 进实现——实现为显式参数；参数缺失时不得自动判升，按 PROMOTION_NOT_ALLOWED / UNRESOLVED fail-closed 收口并在报告中显式标注"等 Owner 给数"，禁止编造数值。
5. isolated-context profile = {sessionId, agentIdentity, contextSeed, limitations[], provisionalStatus}（OQ-R10-4=A）；本环境无平台原生独立子代理 ⇒ 走 GWT-R10-04 降级：独立会话/身份 + 记录 limitation + 候选保持 PROVISIONAL；禁止 producer 自验/自批，违反 → INDEPENDENT_VERIFICATION_REQUIRED。
6. 升格证据（OQ-R10-5=A）= 独立上下文验收 exit 0 + 无 EVOLUTION_REGRESSION + rollback 排练通过；任一回归 → 回退 catalog 到 last accepted + 失败候选证据轨迹保留；重复压测两次不一致 → UNRESOLVED/REJECTED，不得以一次通过晋升。
7. promotion/rollback receipt schema = {promotionId, candidateId, baselineRef, verdict, promotionDecision, rollbackTarget, executedAt, approvedBy, canonicalHash}；canonicalHash = sha256 同构 C-R4（OQ-R10-6=A）；catalog 只在 promotion receipt 完成后才更新。
8. 16 资产闭环：演化审查后每个资产显式状态 ∈ UNCHANGED | CANDIDATE | PROMOTED | REJECTED | UNRESOLVED；聚合百分比不得掩盖缺失行；缺行 = R6 阻塞信号（实现侧如实输出，不宣告 R6 状态）。
9. 消费不重定义：R3 receipt/behavior 证据类别与 P1-P5、R4 CI truth 分类、R8 finding schema/accepted finding 只读消费。
10. route41Rerun.required = false（零路由改动）。

允许写入：scripts/lib/evolution.mjs（新）；evidence/evolution/（实现期新建目录）；CHANGELOG.md（版本/index 记录，追加式）；test-reports/R10-implementation-20260917/（REPORT.md/REPORT.yaml + 全部 fixtures，文件化外置探针，禁 node -e 内联）。
禁止：修改任何冻结契约/plans/PRD0/G2.2/vendor 资产本体/scripts 下既有文件（catalog 更新只许经 promotion receipt 路径且须在报告中给出落点证据）；commit；新增操作名/错误码；自验 DONE/RESOLVED；登记状态台账（归编排者）。

STOP 条件：冻结输入哈希 mismatch；需要第七个错误码或第三个操作名；promotion 落地必须改 catalog 既有文件结构；需要 Owner 未给出的阈值数值（按要求 4 收口后继续，不算 STOP）；16 资产闭环所需基线数据在快照内不存在（如实登记为 UNRESOLVED 行）。

完成报告模板：snapshot；frozenInputs 重算结果表；changedFiles + before/after sha256；fixtures 清单（每项 exit code + 输出摘要）；GWT-R10-01…06/L1 逐条覆盖映射；降级声明（同会话/同模型限制，沿 C5 先例如实记录）；残余 [待补充] 清单；route41Rerun.required=false；acceptancePerformedByExecutor=false。
```

两份派单都可直接转发。返回后我做核验：C-R5-ui 修订核对修复台账 + 裁决逐字吸收 → 安排冻结；R10 实现复跑 fixtures + 契约逐条对审 → 登记 DONE。
