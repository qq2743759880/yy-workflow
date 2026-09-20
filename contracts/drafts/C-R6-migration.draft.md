# C-R6-migration — 迁移、兼容、回滚与独立验收契约

> 文档状态：`C-R6-migration = DRAFT`（2026-09-17 起草）。**不冻结**：本文件是 Owner 场景审查输入；`contracts/drafts/` 永不解锁任务（沿先例）。本草案不改 runtime、不改既有冻结件、不改 vendor（16 根只读）、不做验收（`acceptancePerformedByExecutor=false`）。

## §0 grounding（先哈希后读，2026-09-17 22:16 实测 sha256 前 16 位，全值见 REPORT）

| 输入 | sha256 | 用途 |
|---|---|---|
| docs/tasks/yy-skill-loading-v3/R6-migration-verification.md | 48aac34cf311d798 | 任务书：boundary/non-goals/freeze order 五步/GWT-R6-01…05/C 集规则 原文 |
| docs/yy-dev-plan-skill-loading-v3.md | d2e8e5b45466ca23 | 任务行（:55 R6）+ MW0–MW4 关联 |
| plans/tasks/G2.2-task-graph-20260911.md | 857945f3e2cad190 | R6 节点（prereqs R5b,R7,R8,R9,R10==DONE && C-R6==FROZEN）+ L1/L2 handoff |
| plans/tasks/PRD0-contract-revision-v3.md | 0cc3cae7373f351a | §9.1 MW0–MW4 + §5.5 READY 公式 |
| contracts/drafts/C-R2-catalog.draft.md | 871bc3b5f8639e76 | 消费（冻结源链 871bc3b5=R2.6 授权 rework 后值） |
| contracts/C-R3-activation.md … C-R10-evolution.md（8 份冻结件） | cfb07784 / 19055ff7 / 48b7c379 / fe3a83e6 / ea84b4e5 / d9d33d48 / 0b566d35 / 87301cec | 消费：全部前置契约（R6 doc：all approved contract records） |
| test-reports/R9-integration-20260917/integration-receipt.json | 9b339adea6526ed2 | 消费：R9 integration receipt（R6 doc completion dependency） |
| test-reports/third-party-acceptance-plan-20260915/REPORT.md | 8a9fce81abdf3a7e | 第三方复验包计划（Owner 2026-09-15 指示 R6 放行前执行） |
| test-reports/C2-republication-20260917/REPORT.md | 03f3c4f66a0e3bb6 | C2 RESOLVED 证据（冻结集成员现状） |
| test-reports/R5b-implementation-20260917/REPORT.md | 324304b7d46131e2 | R5b 闭环证据 |

### §0.1 设计前提（五项，R6 doc 原文纪律）

1. **不引入新产品范围、不静默修复上游失败任务**（Boundary 原文）；迁移是 additive 已批准项的集成验证。
2. **不可把 UNRESOLVED finding 转成 PASS**（Completion dependency / GWT-R6-L2 原文）；C 集三态判定 REPRODUCED / COUNTEREVIDENCE_CONFIRMED / UNRESOLVED。
3. **accepted findings 须有 remediation closure 或 Owner 批准 NO_ACTION**（Completion dependency 原文）；复用 C-R8 通道不重定义。
4. **缺任一强制产物 → R6 保持 NOT READY**（Evidence and rollback 原文）；fail-closed。
5. **R10 通道保留**（Owner 2026-09-17 方向）：迁移不得把 16 资产字节固化为绕过 R10 候选→promotion 通道的新不可变形态。

## §1 scope / non-goals

- scope：approved additive migration 集成验证（CLI/manifest/state/adapters）；rollback 演练；独立验收包（第三方冻结集复现）；16 资产证据矩阵；release decision。
- non-goals（R6 doc 原文）：改冻结契约；新增资产；HTML 页换框架；以自产报告宣布验收。

## §2 迁移版本与兼容窗口（freeze order 第 1 步）

- migration version 命名与兼容窗口数值 [OQ-R6-1]。
- 兼容性判据（GWT-R6-01 原文）：legacy CLI 调用/manifests/state files/adapter inputs 各自保持可读或产生显式文档化迁移错误；零静默数据丢失。
- 佐证现状：regression-all 12/0（vendor 恢复后 21:02 复跑）；validate-structure PASS。

## §3 rollback（freeze order 第 2 步，GWT-R6-02）

- 触发判据 / 备份位置 / 恢复命令 [OQ-R6-2 / OQ-R6-3]。
- 判据（GWT-R6-02 原文）：迁移失败或契约 discrepancy → 冻结回滚流程运行 → 先前兼容行为与状态恢复 → rollback receipt 记录被回退内容。
- 回滚不擦除失败的 integration receipt（R9 doc 原文沿承）。

## §4 最终验证矩阵与证据命名（freeze order 第 3 步）

| 验证项 | GWT | 判据 | 证据命名 |
|---|---|---|---|
| legacy compatibility | R6-01 | 4 类 legacy 输入可读/显式迁移错误，零静默丢失 | compat-matrix.json |
| rollback rehearsal | R6-02 | 冻结回滚流程演练成功 + rollback receipt | rollback-rehearsal.json |
| bounded E2E | R6-03 | 单 session/单 phase/单资产/单 adapter 全路径：catalog 选择→bounded activation→receipt 验证→权威 phase 态→Journey 投影→CI 证据一致 | e2e-bounded.json |
| 16 资产矩阵 | R6-04 | 每资产 5 列证据（catalog/routing/activation/receipt/behavior），无聚合百分比替代行 | asset-matrix.json |
| OBS-01/02 | L1 | 各有 explicit fixed/regressed 验证状态；缺失即阻塞 release | obs-status.json |

- 证据命名细则 [OQ-R6-4]。

## §5 独立验收包（freeze order 第 4 步，GWT-R6-05）

- 冻结集 C1/C2/C3/C5/C6/C7：独立执行会话仅跟随源锚点/命令/期望观察 → 逐项 REPRODUCED / COUNTEREVIDENCE_CONFIRMED / UNRESOLVED。
- C2 复现命令更新：内联 node -e 形态已被判 shell 转义伪影（9 vs 16，R1 P4），重新发布探针（188356a8…，两快照 16/16 匹配，test-reports/C2-republication-20260917/REPORT.md）为 canonical 复现锚点；第三方会话使用该文件化探针。
- 第三方复验包执行要求 [OQ-R6-5]；R8 closure/NO_ACTION 核对清单 [OQ-R6-8]。

## §6 release decision（freeze order 第 5 步）

- 仅在 Owner review + 第三方证据之后冻结 release decision（R6 doc 原文）；载体 [OQ-R6-7]。

## §7 Freeze order（R6 doc 五步，逐字序）

1. Freeze migration version and compatibility window → 2. Freeze rollback trigger, backup location, and recovery command → 3. Freeze final verification matrix and evidence naming → 4. Freeze independent acceptance packet → 5. Freeze release decision only after owner review and third-party evidence。

## §8 OQ 索引（8 项，全部 OPEN，未替决）

| OQ | 主题 | 状态 |
|---|---|---|
| OQ-R6-1 | migration version 命名与兼容窗口数值 | [待补充] |
| OQ-R6-2 | rollback 触发判据 | [待补充] |
| OQ-R6-3 | 备份位置与恢复命令 | [待补充] |
| OQ-R6-4 | 证据命名规范与落盘路径 | [待补充] |
| OQ-R6-5 | 第三方复验会话要求 | [待补充] |
| OQ-R6-6 | 16 资产矩阵行格式 | [待补充] |
| OQ-R6-7 | release decision 载体 | [待补充] |
| OQ-R6-8 | R8 closure/NO_ACTION 核对清单 | [待补充] |

---
**drafts 不解锁任务**：R6 READY 公式不变（`R5b,R7,R8,R9,R10 == DONE && C-R6 == FROZEN`）。`route41Rerun.required=false`（零路由改动）。`acceptancePerformedByExecutor=false`。