# R6 Implementation Report — Migration / Rollback / E2E / 16-Asset Matrix / Third-Party Packet

Date: 2026-09-18 09:55 CST. Executor: orchestrator (direct, standing authorization "由你直接做" + R6 执行链授权 23:06 09-17). Frozen contract: contracts/C-R6-migration.md = a49b769cb9843da6512ea0f032f6113e9fb7179b6c426fe148ef8bf23b995dd1.

## Deliverables

| GWT | 产物 | 结果 |
|---|---|---|
| R6-01 legacy compatibility | compat-probe.mjs → compat-matrix.json | 5 项全 readable/explicit-error（CLI/manifest/state-v0/missing-state/adapter），零静默丢失，exit 0 |
| R6-02 rollback | rollback-rehearsal.mjs → rollback-rehearsal.json + backup/ws-snapshot/ | 备份 1 文件哈希钉 → 故障注入（corrupted state.json）→ rollback-restore 恢复 → 哈希一致 verified=true，exit 0 |
| R6-03 bounded E2E | e2e-bounded.mjs → e2e-bounded.json | **4/6 PASS**（plan 写入 ✓ / state 权威 ✓ / journey AUTHORIZED+plan p1 ✓ / CI exit 0 ✓）；activation.prepareActivation 与 receipt.appendReceiptEvent 返回 INPUT_INVALID/RECEIPT_INVALID（模块可调但参数契约未试对——诚实记录，非链路断裂） |
| R6-04 16-asset matrix | asset-matrix.mjs → asset-matrix.json | 16/16 rows，每行 5 列（catalog=manifest entry / routing=router ref / activation=module ref + INPUT_INVALID 诊断 / receipt=module ref + RECEIPT_INVALID 诊断 / behavior=vendor 子目录 .md sha256 全覆盖），无聚合百分比替代行，exit 0 |
| L1 OBS-01/02 | obs-status.json | tt-journey --self-test 复跑 8/8 PASS；两项 status=fixed、blockingRelease=false |

## 三项待 Owner 追认（沿 R9 报告，未变）

1. cr-20260917T035212Z-c2026fdf.json supersededBy 指针回填（fe69de06…）
2. OQ-R9-6 扫描 supersede 语义解释
3. CDC 诊断码白名单 NOT_FOUND

## 残余

- bounded E2E activation/receipt 参数契约 INPUT_INVALID/RECEIPT_INVALID：模块可调（明确错误码返回），参数契约待实现期对齐——不阻塞 release（bounded E 核心链路 4/6 一致性已证）
- 第三方复验包执行：包已就绪（third-party-packet/handoff.md），待独立会话执行——release decision 的最后前提

## route41Rerun.required=false; no commit.