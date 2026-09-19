# C-R9-integration Owner 审查清单（DRAFT）

配套：`contracts/drafts/C-R9-integration.draft.md`。逐行审查用；Owner 确认列在 OQ 裁决时逐行填写。

| ID | GWT | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R9-01 | GWT-R9-01 scenario-reviewed contract | Journey/catalog/activation/receipt/phase 五操作契约 + 真实业务场景清单 | §2 响应壳/错误码/空态/STALE 态/失败行为均有 Owner 场景记录（⛔ Owner 裁决 OQ-R9-1…8 后补记） | 无场景记录即冻结 | |
| R9-02 | GWT-R9-02 contract-only consumption | C-R5-ui §3 M-01…M-26 + webview/journey 页面源码 | 每个显示值映射契约字段/evidence 引用；页面无内部 state 文件读取、无臆造字段（f-09 等探针佐证） | 前端读内部文件或发明字段 | |
| R9-03 | GWT-R9-03 discrepancy cascade | 模拟 backend schema/error/response change → C-R7 change.record | invalidatedNodes 覆盖受影响前端任务/fixtures/parity/READY；receipt 历史保留 | 静默改契约或全量回退 | |
| R9-04 | GWT-R9-04 full revalidation | 更新后的冻结契约 + CDC/E2E/parity 探针 | integration receipt 同时记录 frontendResult/backendResult/contractHash/evidence 路径（§5 字段） | receipt 缺任一要素 | |
| R9-05 | GWT-R9-05 brownfield draft mode | 仅 contract draft（未冻结）时前端开工 | 前端产物显式标 `contract-draft`；discrepancy 被捕获；不得表述为 frozen | draft 冒充 frozen | |
| R9-FO | Freeze order 六步（R9 doc） | §7 六步序 | contract-reverse draft → backend 确认（OQ-R9-8）→ Owner 场景审查 → frozen hash → consumer mapping+fixtures → CDC/E2E/parity 重验收 | 跳步或顺序颠倒 | |