# C-R9-integration Revision Report

Date: 2026-09-17 21:24 CST. Executor: orchestrator (direct, standing authorization). Owner rulings: "按推荐" (21:22 CST) — 8/8 OQ absorbed verbatim with [Owner 决断 OQ-R9-x=A，2026-09-17] markers.

## Hash chain

| file | before | after |
|---|---|---|
| contracts/drafts/C-R9-integration.draft.md | b9cff0073728a876aa0185313eec2cdc6c6a9d34b1a6e1b8e97a7db54e7d5604 | 0bccdf4d1e0fca2125412619a1becdf65baf93c4e95b907db026b4733ce27a07 |
| contracts/drafts/C-R9-integration-review-checklist.md | 16ff9ea24c96fe6b72a6d77d27d707d5fe5183d7e9ad1930fea1878fa8fadd44 | unchanged (expectation rows already phrased for post-ruling scenario records) |

## Absorbed rulings (batch-1: 5 + batch-2: 4 + batch-3: 8 index rows)

- OQ-R9-1=A CDC: reuse scripts/contract-reverse.mjs; gaps => discrepancy; zero new tooling
- OQ-R9-2=A parity: Chrome headless screenshots (1280x800 + 375x667), human judgment, no hard threshold v1, evidence paths into receipt
- OQ-R9-3=A receipt storage: test-reports/R9-integration-<date>/integration-receipt.json, hash-pinned, append-only
- OQ-R9-4=A consumer map: adopt C-R5-ui §3 M-01…M-26 as authoritative baseline
- OQ-R9-5=A key E2E scope: Journey 7-state main chain + NOT_FOUND/STALE/CONFLICT failure paths
- OQ-R9-6=A DISCREPANCY_OPEN scan: contracts/discrepancies/*.json status=active
- OQ-R9-7=A integrationResult: {contractHashOk, cdc:{ok,mismatches[]}, parity:{ok,ref}, e2e:{ok,ref}, discrepancyOpen, warnings[]}
- OQ-R9-8=A backend confirmation carrier: embedded in freeze record (C-R5-ui precedent)
- Drafting-time numbering fix registered: §6 marker mechanism folded into the OQ-R9-8 carrier statement (was mis-numbered as OQ-R9-7 in v1 draft); OQ index remains 8 items.

## Verification

- table-check: draft 3 tables + checklist 1 table, mismatched_rows=0, exit 0
- [待补充] residue: 0 (asserted count==8 before batch-3 replacement)
- Frozen inputs: unchanged (no re-reads of frozen files during revision)

## Status

draft = OWNER-REVIEWED pending freeze approval (⛔ R9 doc Freeze order step 3-4: Owner real-scenario review => frozen hash). Next: Owner approves freeze => freeze execution => status registration => R9 implementation.