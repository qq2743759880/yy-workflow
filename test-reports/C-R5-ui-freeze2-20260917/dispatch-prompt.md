# Dispatch: C-R5-ui Re-Freeze Agent (v2 → FROZEN, superseding 421ecfc4…)

You are the C-R5-ui re-freeze agent. Workspace: D:\.ai-hub\skills\yy. 中文报告.

## 1. Authority

- Owner approval (2026-09-17 12:51 CST, verbatim): "批准,派本会话的独立冻结 agent 重冻结". Materialize this instruction into test-reports/C-R5-ui-freeze2-20260917/owner-approval.md and hash-pin it in your report.
- Change record: cr-20260917T035212Z-c2026fdf (CONTRACT, active) = contracts/discrepancies/cr-20260917T035212Z-c2026fdf.json, sha256 9fecdfcf7dc84ef91b527134ef247c59493c0c7af9fc78f6b1a70639a3968bba (note: orchestrator's earlier report had a typo 9fcedfcf…, corrected via corrigendum; trust only your own Get-FileHash).
- Orchestrator review: test-reports/C-R5-ui-revision2-review-20260917/REPORT.md = 036d51303c384b8d4e87641c232c1ab361dd7d6305ce91944140cfbb86e5585c (verdict VERIFIED).

## 2. Inputs (hash BEFORE reading; STOP on mismatch)

Recompute all yourself. Reference values (2026-09-17 12:52 CST):
- contracts/drafts/C-R5-ui.draft.md (v2) = 5520768ffff58281a55e970f443034e7dd385d599a505acd7dd2e227d7371ae3 — your freeze source
- contracts/drafts/C-R5-ui-review-checklist.md (v2) = ebc286fe6e199afb9f2c99d2a578c77986c1d29473c4d9136d99812e73ecc7bc — your freeze source
- contracts/C-R5-ui.md (current frozen, superseded-pending-revision) = 421ecfc4bfc2861d4187be76ecd67ec184f55d9aa1d239cdb04acb8e82dafa1a — will be replaced
- contracts/C-R5-ui-review-checklist.md (current frozen) = 5ddc4cde5a26483100b3e223e86378e1720d58585ac3d580394b58d78821d831 — will be replaced
- plans/tasks/C-R5-ui-freeze-20260917.md (prior freeze record, read-only reference) — recompute and record

## 3. Task

Freeze draft v2 into contracts/, following the project's established byte-migration convention (same as prior freezes):
1. contracts/C-R5-ui.md := draft v2 content with ONLY minimal status/path adjustments (DRAFT → FROZEN status line; drafts/ path references → contracts/ where the prior freeze made such adjustments; keep everything else byte-identical). Use a file-based edit script with exact-count anchor assertions (count==1 per substitution) and diff review proving only intended lines changed.
2. contracts/C-R5-ui-review-checklist.md := checklist v2 with the same minimal status/path adjustments; Owner 确认 column stays empty.
3. The frozen contract must state: FROZEN 2026-09-17; supersedes 421ecfc4bfc2861d4187be76ecd67ec184f55d9aa1d239cdb04acb8e82dafa1a; freeze authority = Owner approval 2026-09-17 + cr-20260917T035212Z-c2026fdf.
4. Drafts remain in place (contracts/drafts/*, marked FROZEN-SOURCE per precedent if the draft header already carries such wording — do not invent new draft edits beyond what prior freeze precedent did).
5. Write freeze record plans/tasks/C-R5-ui-freeze2-20260917.md: before/after sha256 of all four contract files, supersession declaration, change-record reference, owner-approval reference, migration diff summary (which lines changed and why), statement that runtime/scripts/vendor/G2.2/PRD0 were NOT touched, route41Rerun.required=false, acceptancePerformedByExecutor=false.
6. Write test-reports/C-R5-ui-freeze2-20260917/REPORT.md with the same content + your reportSha256 (declare the convention you use).

## 4. Bans / STOP

STOP and report if any input hash mismatches, or the migration diff shows anything beyond minimal status/path lines.
Bans: no edits to scripts/, vendor/, prototypes/, plans/tasks/G2.2*, plans/tasks/PRD0*, other contracts, or the change-record JSON; no commits; no new operation names/error codes; no emoji; table cells escape pipes; repo-relative paths only in docs.

## 5. Verification before reporting done

- Recompute sha256 of all written files AFTER writing; list before→after pairs.
- Run a table-check (pipe-aware row consistency) on both frozen files: mismatched_rows must be 0. You may reuse test-reports/C-R5-ui-revision2-review-20260917/table-check.mjs (file-based probe).
- Confirm drafts + frozen inputs (other than the two replaced files) unchanged by re-hashing.