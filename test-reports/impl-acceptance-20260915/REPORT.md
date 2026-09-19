# R5a / R7 / R8 Runtime Implementations — Combined Orchestrator Acceptance Report (2026-09-15)

acceptancePerformedBy: orchestrator (Owner-authorized division)
snapshot: 240f3fbdb4ee757dffc4d5ab80407d1b2c84863c

## Pre-flight (shared)

- HEAD = 240f3fbdb4ee757dffc4d5ab80407d1b2c84863c
- Frozen contracts unchanged: C-R5 48b7c379…, C-R7 ea84b4e5…, C-R8 d9d33d48…, C-R4 19055ff7…, C-R3 cfb07784…
- R3/R4 layer zero-touch (all 11 hashes match R4-acceptance baseline): activation 92339687…, receipt 9f3b5c46…, prompt 69d4dc8a…, asset e1fdf516…, phase 59b19bd2…, gate e63b97dc…, state 3da5734e…, store 94ce8d01…, runtime d3fbe5a6…, ci cc09f595…, orchestrator 071f10e2…
- No router/matcher/matrix/planner/catalog changes → route41Rerun.required=false (all three)

## R5a — verdict: ACCEPTED

- Implementation: scripts/lib/journey.mjs (new) = fe9bb851f8a363593a9a0fa882b98db398a4bfa203574cc7d873dd4d8c801076; scripts/tt-journey.mjs = 0d5a42c61940a362f36b970ecd76bc621921e39511ec7466e311c4dc41291ded
- Independent reruns: f-01…f-08 all exit 0 (projection truth, stale/partial/error, session selection, GWT1 9-node, GWT2 inferred, GWT3 namespace, byte roundtrip, CLI read-only)
- Contract conformance: four-source binding; observed/inferred/authorized field mapping; failed/skipped never rendered done (group worst-state); JOURNEY_NOT_FOUND data channel per C-R4 §6.3 decided precedent; PROJECTION_CONFLICT node-level dual evidence; evidence links shape + nextPrompt structured + snapshot hash echo; session namespaced read (D-1 fixed); read-only (no transitionPhase call)
- journey self-test GWT1-8 PASS (independent rerun)

## R7 — verdict: ACCEPTED

- Implementation: scripts/lib/change.mjs (new) = 3f37d9b5dedf7ce8a76b3a595a5184f923b2c8e1222decfc1206b7dcc537219a
- Independent reruns: 9 fixtures all exit 0 (gwt-r7-01…05, approval-sec, audit-precise, rollback-supersede, taskgraph-boundary)
- Contract conformance: input four-column fail-closed with class-differentiated codes; five impact classes (SECURITY cascades CONTRACT + security gate rerun list); idempotency canonical sha256 + DUPLICATE_REPLAY as warnings (not a code); same-key-different-evidence ⇒ CHANGE_SCOPE_UNCLEAR; R4 receipt consumed not redefined (scopeId carries :impactClass, cross-class reuse rejected); IMPLEMENTATION sequential version bump + newVersionRef + no-migration-without-backup; append-only storage contracts/discrepancies + plans/active/changes/index.jsonl; supersede-not-delete

## R8 — verdict: ACCEPTED

- Implementation: scripts/lib/remediation.mjs (new) = b65381d4f0eb2059c2ddc16a04a4cd0d3b705f9d7d163d4ab6d27fbe47e9227d
- Independent reruns: run-all 10/10 + 11 fixture files all exit 0 (GWT-R8-01…05, L1 C1–C7, missing element, duplicate/idempotent, map exact/ambiguous, create-draft PENDING, owner-only NO_ACTION, self-approve blocked)
- Contract conformance: evidence gate fail-closed (A anchor+sha256, B review-gate reuse, C optional receipt projection); idempotency key (critiqueFile.sha256, normalizedTitle) with DUPLICATE in data channel; same-key-different-content → new finding + duplicateOf; map-to-existing exact file:line only; draft stops at ownerReviewState=PENDING (no LLM self-approve); approval fields aligned to C-R4 §5.2 with approvedBy≠createdBy; NO_ACTION owner-only

## Cross-cutting verification

- regression-all: 12 PASS / 0 FAIL, exit 0 (independent rerun)
- real ci.mjs: exit 0, S6 asset-call-rate exit 1 correctly QUALITY_WARN, success literal only after mandatory segments all 0

## Non-blocking notes

- R8 residual [待补充] (approval↔execution hash reconciliation) remains assigned to later implementation phase, same form as C-R4 residual — consistent with frozen contract, not a defect.
- R8 criterion C optional (no receiptRef ⇒ no INVALID_EVIDENCE) matches contract §1.4 category C optional.
- R5a JOURNEY_NOT_FOUND channel decision consumed C-R4 §6.3 decided fork precedent — correct application of the frozen cross-contract convention.

## Verdicts

- R5a: ACCEPTED → register R5a = DONE
- R7: ACCEPTED → register R7 = DONE
- R8: ACCEPTED → register R8 = DONE

Consequence: R5b READY formula requires R5a DONE ✓ + UI-GA APPROVED (still NOT_APPROVED) → R5b remains blocked by Gate A. R10 READY formula requires R3,R4,R8 DONE ✓✓✓ + C-R10 FROZEN → next unlock = C-R10-evolution contract. R9 requires R2,R3,R4,R5b DONE + C-R9 + inherits C2 → blocked. R6 requires R5b,R7,R8,R9,R10 DONE + C-R6 → blocked.