# R8 — Critique-to-Remediation Dynamic Orchestration

Status: `BLOCKED until G2.1/G2.2 and R4`; owner confirmation required.

## Boundary

Make each accepted critique finding actionable. Register stable findings, connect them to an existing task or create a remediation draft, inject GWT/dependencies/evidence requirements, and prevent duplicate or self-approved remediation.

Non-goals: allowing an LLM to invent an implementation task without review, treating an unverified claim as accepted, or auto-editing source files.

## Exact files and artifacts

- `reference/critique-protocol.md`
- `reference/dispatch-and-acceptance.md`
- `plans/critique-backlog-tracker.md`
- `scripts/review-gate.mjs`
- `scripts/critique-backlog-next.mjs`
- `plans/active/remediation/` and `evidence/critique/` indexes

## Dependencies

Contract dependency: R4 task state and dependency graph; G2.1 verdict states.

Completion dependency: R6 closes accepted findings; R10 consumes asset-related findings for evolution candidates.

## Freeze order

1. Finding schema and evidence classes.
2. Mapping rules to existing tasks.
3. Remediation-draft schema for new tasks.
4. Dependency/GWT enrichment rules.
5. Owner override and `NO_ACTION` rules.

## GWT acceptance

### GWT-R8-01 — evidence-qualified finding

Given a finding with source anchor, reproducible command/observation, competitor or authoritative source, impact, and proposed verification, when registered, then it receives a stable ID and explicit status.

### GWT-R8-02 — existing-task mapping

Given a finding that matches an existing R-task, when mapped, then the task receives a critique-consumption entry, additional GWT/evidence requirements, and no duplicate task.

### GWT-R8-03 — new remediation draft

Given a valid finding with no matching task, when mapped, then a `remediation-draft` is generated with scope, non-goals, dependencies, GWT, contract impact, and owner review state; it is not implementation READY.

### GWT-R8-04 — idempotency

Given the same critique file and finding title are registered twice, when the gate runs, then tracker and task draft counts remain unchanged and the original ID is returned.

### GWT-R8-05 — evidence gate

Given a finding without competitor/authoritative evidence or a reproducible anchor, when registration is attempted, then it becomes `INVALID_EVIDENCE` and cannot unlock remediation.

## Selection basis

Reuse the existing `review-gate --auto-register`, critique tracker, and completion-report fields. Apply Superpowers-style pressure testing to the resulting remediation task, but keep task creation deterministic and reviewable.

## Evidence and rollback

Required: finding ledger, mapping decision, generated/linked task, idempotency run, and independent evidence status. Rollback removes only the new mapping/draft by superseding its record; original critique evidence stays immutable.

