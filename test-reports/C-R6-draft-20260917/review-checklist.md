# C-R6-migration Owner 审查清单（DRAFT）

配套：`contracts/drafts/C-R6-migration.draft.md`。逐行审查用；Owner 确认列在 OQ 裁决与场景审查时逐行填写。

| ID | GWT | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R6-01 | GWT-R6-01 legacy compatibility | legacy CLI 调用 / manifests / state files / adapter inputs 四类 | 各自可读或显式文档化迁移错误；零静默数据丢失（compat-matrix.json） | 静默丢数据或未文档化的迁移错误 | |
| R6-02 | GWT-R6-02 rollback | 迁移失败或契约 discrepancy + 冻结回滚流程 | 先前兼容行为与状态恢复；rollback receipt 记录被回退内容 | 回滚不完整或 receipt 缺失 | |
| R6-03 | GWT-R6-03 bounded E2E | 单 session / 单 phase / 单资产 / 单 adapter | catalog 选择→bounded activation→receipt 验证→权威 phase 态→Journey 投影→CI 证据全链一致 | 任一环节不一致 | |
| R6-04 | GWT-R6-04 16-asset closure | 16 资产最终矩阵 | 每资产 5 列证据（catalog/routing/activation/receipt/behavior）齐备；无聚合百分比替代行 | 行缺失或以聚合冒充 | |
| R6-05 | GWT-R6-05 independent packet | 冻结集 C1/C2/C3/C5/C6/C7 + 独立执行会话 | 每项 REPRODUCED / COUNTEREVIDENCE_CONFIRMED / UNRESOLVED 三态之一；C2 用 escape-stable 探针（188356a8…） | 会话自产验收或三态缺失 | |
| R6-L1 | OBS-01/02 carried | G2.2 handoff 两条观察 | 各有 explicit fixed/regressed 状态；缺失阻塞 release | 状态缺失 | |
| R6-L2 | G2.1 rule | 冻结 C 集 | 第三方包保留 UNRESOLVED 为 blocking；R6 不得把 unresolved 转为 pass | unresolved 被转 pass | |