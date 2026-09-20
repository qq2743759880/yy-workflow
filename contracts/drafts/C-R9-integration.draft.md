# C-R9-integration — 前后端联调与契约重验收契约

> 文档状态：`C-R9-integration = DRAFT`（2026-09-17 起草）。**不冻结**：本文件是 Owner 场景审查输入；`contracts/drafts/` 永不解锁任务（沿 C-R2/3/4/5 先例）。本草案不改 runtime（`scripts/`）、不改既有冻结件、不改 vendor（16 根只读）、不做验收（`acceptancePerformedByExecutor=false`）。

## §0 grounding（先哈希后读，全部实测 sha256）

| 输入 | sha256 | 用途 |
|---|---|---|
| docs/tasks/yy-skill-loading-v3/R9-frontend-backend-integration.md | 0e68d7e4a29c39579b3280a51841674cf696536768bd35d93697cc5d64f4e5fe | 任务书：boundary/non-goals/GWT/Freeze order 原文 |
| docs/yy-dev-plan-skill-loading-v3.md | d2e8e5b45466ca23c81420dd6b18a9384b648e7c23cb4dbcaba13a0b8168a8db | 操作契约 integration.validate（:310）+ 冻结顺序（:265）+ 任务行（:55） |
| plans/tasks/G2.2-task-graph-20260911.md | 007ee243a7f2744a04eff65c17858119a0e75b4d4340484bba3ef415d58364b9 | R9 节点（prereqs R2,R3,R4,R5b==DONE && C-R9==FROZEN；下游 R6） |
| plans/tasks/PRD0-contract-revision-v3.md | e2dc4af22aa1ae906049cc3c4cd11103f43131d311eb5ce938dde1cf3e71d68a | §5.5 READY 公式 + §9.1 MW |
| contracts/drafts/C-R2-catalog.draft.md | 871bc3b5f8639e762ee66c6d3929f61415b01fafa3be182eeeb1e0ed3f2475c1 | 消费：catalog/route 契约（冻结源链：freeze c1373728 → R2.6 授权 rework → 871bc3b5，handoff R2.6:19 登记） |
| contracts/drafts/C-R2-review-checklist.md | f36405a357bfb7bbb2ed8ead931fdbed9b38599cd78ae157b2482bf785e5d7f0 | C-R2 清单（冻结记录 F36405A3 逐字一致） |
| contracts/C-R3-activation.md | cfb077840fa83b6bf408441256d0bd7e25534b7f8b9b380dadb511d74455ceff | 消费：activation/receipt 契约 |
| contracts/C-R4-control.md | 19055ff7a5c881ef4daab4d323e8710467ae5f0ffd2a4db2d1ba21c34cb1a666 | 消费：phase/session + override receipt 形状 |
| contracts/C-R5-journey.md | 48b7c37982f71aea8e372e216a309798af724aa8cb08e2d26402ad76430d769a | 消费：journey.read/project 投影契约 |
| contracts/C-R5-ui.md | fe3a83e6296ee87c87312a509d3fabf3a04e69898d944f9d982f60c9b54ffafd | 消费：webview 页面契约（含 §3 M-01…M-26 接口映射） |
| scripts/contract-reverse.mjs | f6c417abd17693ce3406a85237590f84c4334e47f74a1e0a9151404e6125a970 | 工具锚点（Freeze order 第 1 步） |
| scripts/contract-discrepancy.mjs | 37806d9a12c78328dccf794ff3347e9b7b5ffb690037815dc735dc0bebd94287 | 工具锚点（discrepancy 通道） |
| scripts/lib/gate.mjs | e63b97dcb7c4ed539ee3034ca1d3c3144389ee798347038c31f318478fe735a2 | 工具锚点（gate 语义） |
| webview/journey/index.html | 3af780729834621a6c1cb5f6a04293e9fae12ed2233303452781ff64598bf3bd | R5b 交付（前端消费侧现状） |
| webview/journey/host-bridge.mjs | b02cfd6551529b840b355f2ebf711a33ba8381a95a6ed23c704a8f84f51b06c3 | R5b 交付（宿主桥现状） |
| test-reports/R5b-implementation-20260917/REPORT.md | 324304b7d46131e2b0d0e096cbfaff3adfc5e56df15dee4a57adc6342f1955b7 | R5b 闭环证据（含 REG-01 corrigendum） |

### §0.1 设计前提（五项）

1. **Owner 真实业务场景审查先行于冻结**（R9 doc Freeze order 第 3 步原文：Owner review using real business scenarios → 第 4 步 frozen hash）；无场景记录不得冻结。
2. **contract-only consumption**（GWT-R9-02）：前端只读冻结契约字段/evidence 引用；禁止读内部 state 文件、禁止臆造字段。R5b 页面已按此实现（webview/journey 仅消费 journey.read/project 壳）。
3. **discrepancy cascade fail-closed，复用 C-R7**（GWT-R9-03）：接口差异 → change.record（CONTRACT 类）→ invalidatedNodes 精确失效 → 受影响前端任务/fixtures/parity/READY 退出；本契约不重定义失效语义。
4. **integration receipt 不可抹除**（R9 doc Evidence and rollback 原文：rollback 恢复 consumer mapping 与契约版本，不擦除失败的 integration receipt）。
5. **MVP 复用既有工具**（R9 doc Selection basis 原文：reuse contract-reverse/discrepancy workflow + HTML-first Gate A；No new integration framework）。

## §1 scope / non-goals

- scope：integration.validate 操作契约；前后端同源 frozen contract 验证；consumer mapping；CDC/真实业务 fixtures/关键 E2E/视觉 parity 的重验收闭环；contract-draft 显式标记。
- non-goals（R9 doc 原文）：允许前端猜测后端字段；把 HTML 原型当作执行权威；在既有原型 gate 之前引入新框架。另：本契约不重定义 C-R7 失效语义、不重定义 C-R5-journey/ui 冻结 schema。

## §2 操作契约 integration.validate（dev-plan:310 逐字）

| 列 | 原文 |
|---|---|
| 输入 | contract hash、consumer map、fixtures、run refs |
| 响应壳 | `{ok, code, data: integrationResult, evidence, warnings}` |
| 错误码 | `CONTRACT_HASH_MISMATCH` / `CDC_FAILED` / `PARITY_FAILED` / `DISCREPANCY_OPEN` |
| 语义 | 前后端是否都基于同一 frozen contract |

- 错误码语义（本契约细化，不新增码面）：
  - `CONTRACT_HASH_MISMATCH`：输入 contract hash ≠ 当前冻结契约实际 sha256（fail-closed，不产 integrationResult）
  - `CDC_FAILED`：consumer mapping 与契约 schema 双向校验存在不匹配（OQ-R9-1 定执行方式）
  - `PARITY_FAILED`：视觉 parity 判定不过（OQ-R9-2 定方法）
  - `DISCREPANCY_OPEN`：存在未闭合 discrepancy（OQ-R9-6 定扫描规则）
- OQ-R9-7：`data.integrationResult` 内部结构（四项校验结果 + 各自 evidence refs）[待补充]。

## §3 consumer mapping（GWT-R9-02）

- 基线候选：C-R5-ui §3 已有 M-01…M-26（26 行接口映射，落在 journey.read/project 现有键上）；是否直接采纳为 consumer map 权威基线 → [OQ-R9-4]。
- 判据（R9 doc GWT-R9-02 原文）：every displayed value maps to a contract field/evidence reference；frontend does not read internal state files or invent fields。

## §4 discrepancy cascade（GWT-R9-03）

- 触发（R9 doc 原文）：backend schema/error/response change → discrepancy recorded → affected frontend tasks, fixtures, parity status, and READY entries invalidated。
- 执行通道：C-R7 change.record（impactClass 按 OQ-R7-4 机器判据；触及冻结契约规范性内容 ⇒ CONTRACT）；失效节点集由 change.mjs 依赖图计算。
- 级联后果：R9 自身退出完成态；integration receipt 保持历史（不删除），新 receipt 覆盖有效状态。

## §5 integration receipt（GWT-R9-04）

- 触发（R9 doc 原文）：Given an updated contract, when CDC, real-business fixtures, key E2E, and visual parity rerun, then the integration receipt records frontend result, backend result, contract hash, and evidence paths。
- receipt 最小字段（本契约命名，结构细则 OQ-R9-3）：`{contractHash, consumerMapRef, frontendResult, backendResult, cdcRef, e2eRef, parityRef, discrepancyStatus, recordedAt, evidence[]}`。
- 消费：R6（G2.2 边 20）只接受 receipt 通过项（dev-plan:263 原文：R6 只接受通过 CDC/真实场景联调/关键 E2E/视觉 parity 的 integration receipt）。

## §6 contract-draft mode（GWT-R9-05）

- 判据（R9 doc 原文）：Given only a contract draft, when the frontend starts, then it is explicitly marked `contract-draft`; discrepancies are captured and the draft cannot be represented as frozen。
- 标记机制细则 [OQ-R9-7]；不得把 draft 期间采集的任何 parity/联调结果表述为 frozen 契约下的证据。

## §7 Freeze order（R9 doc 六步，逐字序）

1. contract-reverse draft → 2. Backend schema, response shell, and error-code confirmation（确认载体 [OQ-R9-8]）→ 3. Owner review using real business scenarios（⛔ Owner）→ 4. Frozen contract hash → 5. Frontend consumer mapping and fixtures → 6. CDC, integration/E2E, visual parity, and discrepancy revalidation。

## §8 OQ 索引（8 项，全部 OPEN，未替决）

| OQ | 主题 | 状态 |
|---|---|---|
| OQ-R9-1 | CDC 执行方式（contract-reverse.mjs 能力边界 vs 新探针；MVP 复用） | [待补充] |
| OQ-R9-2 | visual parity 方法/视口/阈值/判定人 | [待补充] |
| OQ-R9-3 | integration receipt 存储路径/命名/保留 | [待补充] |
| OQ-R9-4 | consumer map 粒度与载体（M-01…M-26 采纳与否） | [待补充] |
| OQ-R9-5 | 关键 E2E 路径范围 | [待补充] |
| OQ-R9-6 | DISCREPANCY_OPEN 扫描规则 | [待补充] |
| OQ-R9-7 | integrationResult 内部结构 | [待补充] |
| OQ-R9-8 | backend confirmation 载体（freeze order 第 2 步记录形式） | [待补充] |

---
**drafts 不解锁任务**：R9 READY 公式不变（`R2,R3,R4,R5b == DONE && C-R9 == FROZEN`，且 C2 处置为验收前提）。`route41Rerun.required=false`（零路由改动）。`acceptancePerformedByExecutor=false`。