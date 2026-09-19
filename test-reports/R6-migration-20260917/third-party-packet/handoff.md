# R6 Third-Party Acceptance Packet — Independent Execution Handoff

Date: 2026-09-18. Prepared by: orchestrator. Frozen contract: contracts/C-R6-migration.md = a49b769cb9843da6512ea0f032f6113e9fb7179b6c426fe148ef8bf23b995dd1.

## Role

You are an independent third-party execution session. You have ZERO prior context on this project beyond this handoff. You do not repair anything. You follow only the source anchors, commands, and expected observations below. You record three-state verdicts per finding: REPRODUCED / COUNTEREVIDENCE_CONFIRMED / UNRESOLVED.

## Snapshot

Repository: D:/.ai-hub/skills/yy — commit 240f3fbdb4ee757dffc4d5ab80407d1b2c84863c (uncommitted dirty tree is the current authoritative state; vendor/ content restored to HEAD baseline 2026-09-17 21:02).

## Frozen C set — six findings

| finding | source anchor | expected observation | command |
|---|---|---|---|
| C1 | test-reports/R1-baseline-20260911/baseline/normalized-run1.json (probe C1) | frozen expected observation in normalized baseline | run the exact frozen command verbatim |
| C2 | **REPLACED**: escape-stable file probe at D:\.ai-hub\tmp\c2-repub-841a78\evidence\c2-probe.mjs (sha256 188356a8e69e0012497f85aa7c5dcde2a998e036d1a95ee1ce30123cb973c7f7); handoff handoffs/C2-republication-20260911.md | punctuationKeywordCount=16, entryCount=16, scalarMarkerCount=2, warnings=[] | SNAPSHOT_ROOT=<clean worktree at 240f3fbd>; run from that root: node c2-probe.mjs — two clean worktrees, results normalized-identical |
| C3 | test-reports/R1-baseline-20260911/baseline/normalized-run1.json (probe C3) | frozen expected observation | run the exact frozen command verbatim |
| C5 | test-reports/R4-acceptance-20260915/REPORT.md (post-fix original probe) | 修复后原始探针回归 PASS | rerun the R4-era original probe |
| C6 | test-reports/C6-exec-20260913/snap1|snap2 (external file-based probe) | three-case frozen rule matches, both runs identical | rerun the frozen file-based probe in two clean snapshots |
| C7 | test-reports/R1-baseline-20260911/baseline/normalized-run1.json (probe C7) | frozen expected observation | run the exact frozen command verbatim |

## Discipline

- Follow only the anchors/commands/expectations above — do NOT read orchestrator self-reports as verdicts.
- Record per finding: exit code, raw output (saved to evidence dir), three-state verdict.
- Do not repair; do not write into the repository; probe/evidence files live outside the repo.
- Any finding that does not reproduce the frozen expected observation => UNRESOLVED (blocking release).
- Zero aggregate substitution: each finding individually verdict-locked.

## Deliverable

third-party-verdicts.json: [{finding, exit, observed, verdict, evidencePath}] for C1/C2/C3/C5/C6/C7 — handed back to Owner for release decision review.