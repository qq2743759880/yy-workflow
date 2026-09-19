# R7 — Requirements Change Loop and PRD Re-entry

Status: `BLOCKED until G2.1/G2.2 and R4`; owner confirmation required.

## Boundary

Turn a new requirement or scope change into an auditable change record. Classify its impact, invalidate only affected plans/contracts/tasks/READY states, return to the correct PRD gate, and recompute READY. Preserve completed evidence and compatibility artifacts.

Non-goals: silently rewriting old PRDs, automatically implementing the new requirement, or globally resetting every task.

## Exact files and artifacts

- `reference/documentation.md`
- `commands/yy-1-requirements.md`, `commands/yy-2-planning.md`, `commands/yy-3-contract.md` as applicable
- `plans/active/changes/` (additive namespace/index)
- `contracts/discrepancies/` (change records)
- canonical state/READY logic from R4

## Dependencies

Contract dependency: R4 canonical state and transition semantics.

Completion dependency: R8, R9, and R10 must consume change-record invalidation; R6 must verify old-version preservation and rollback.

## Freeze order

1. Change-record schema and identity.
2. Impact classes: `DOC_ONLY`, `TASK_GRAPH`, `CONTRACT`, `IMPLEMENTATION`, `SECURITY`.
3. Invalidation and rewind targets.
4. Owner approval and version bump rules.
5. READY recomputation and idempotency.

## GWT acceptance

### GWT-R7-01 — document-only change

Given a requirement that changes only wording or acceptance detail, when classified, then only the affected PRD/design/task draft is invalidated; completed code and frozen contracts remain valid.

### GWT-R7-02 — contract-impacting change

Given a requirement that changes an interface or state field, when classified, then the contract and all dependent frontend/backend tasks leave READY and return to contract-reverse/owner review.

### GWT-R7-03 — implementation-impacting change

Given a requirement that changes runtime behavior, when re-entered, then a new PRD/plan version references the old version, reason, source evidence, and affected tasks; old reports remain read-only.

### GWT-R7-04 — invalid record fails closed

Given missing impact, owner, reason, or source, when READY is recomputed, then it returns `CHANGE_RECORD_INVALID` and unlocks nothing.

### GWT-R7-05 — idempotent replay

Given the same change record is applied twice, when replayed, then no duplicate task, contract, tracker, or invalidation event is created.

## Selection basis

Reuse the existing documentation back-jump rule, R4 state authority, JSON/file storage, and standard-library hashing. Do not add a workflow engine or database for this MVP.

## Evidence and rollback

Required: change record, impact report, invalidated-node list, new version link, READY recomputation, and replay test. Rollback means marking the change record superseded and restoring the previous plan version; never delete the old evidence.

