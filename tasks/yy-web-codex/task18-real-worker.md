# task18｜受控 Worker→真实 YY adapter→回执（M3）

状态：后续分门，未获实施授权。依据：PRD FR-10、RF1 延续；AT-30–35。

## 交付与关联

- 交付已授权 job 到真实 YY 执行器的薄连接、原始运行证据与结构化回执；分列 execution_status、verification_status、coverage、evidence_refs 与 closeability。
- 前置：task17 ledger/lease 有效、task16 精确审批、M3 C5 映射合同冻结；后置：task19/20。选型：调用现有 adapter，不重新实现 Spectral/security/phase 引擎。
- 候选 seam：现有 adapter 与 Spectral exec、YY Core 状态写入，生产 M 仅转发和记录；实际文件/命令由阶段 5 核验。

## GWT 验收

1. Given 有效 capability 和用户 OpenAPI 合同，When 真执行，Then实际 Spectral exec 消费该合同，scope 和 boolean pass 可在原始证据中核对。
2. Given legacy OpenAPI、security+OpenAPI、非 OpenAPI/draft，When 分别执行，Then RF1 旧语义不回归，用户合同不被错路由，降级不被展示为验证通过。
3. Given adapter 输出缺失/伪造或摘要称 passed 而原始证据 failed，When 归档回执，Then标证据不完整或失败，不允许验收 PASS/关闭。

停止条件：原始 adapter 输出不可追溯或 RF1 回归时，不开放真实执行。
