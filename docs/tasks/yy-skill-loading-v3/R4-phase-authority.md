# R4 — Phase Authority, Contract Gates, Session and CI Truthfulness

Status: `BLOCKED until R2, R3 and G2.1/G2.2`; owner confirmation required before execution.

## Boundary

Repair authoritative phase transitions, contract prerequisites, session isolation, lock behavior, override policy, and CI fail-closed reporting. Journey is not the authority; the runtime state and receipts are. Existing CLI, state, and adapters remain compatible through additive fields and a migration window.

Non-goals: frontend implementation, full-machine discovery, replacing the CLI, or accepting an override as normal flow.

## Exact files

- `scripts/lib/runtime.mjs`
- `scripts/lib/gate.mjs`
- `scripts/lib/store.mjs`
- `scripts/tt-journey.mjs` only for projection inputs and CLI compatibility
- `scripts/ci.mjs`
- additive state/contract docs after owner review

## Dependencies

Contract dependency: R2 route eligibility and R3 receipt validity. Draft interfaces are `phase.check` and `phase.transition`.

Completion dependency: R5a can only project authoritative state after R4; R6 verifies migration and rollback.

## Freeze order

1. Freeze session identity, state version, and lock ownership.
2. Freeze phase state machine and allowed transitions.
3. Freeze prerequisite predicates and evidence receipt requirements.
4. Freeze override policy, owner approval, and audit fields.
5. Freeze `phase.check`/`phase.transition` schemas, errors, and fail-closed CI behavior.

## GWT acceptance

### GWT-R4-01 — no unauthorized skip

Given a phase with an unmet prerequisite, when a normal transition is requested, then the transition is rejected with `PHASE_PREREQ_UNMET`; `--force` cannot create a completed state without an explicit approved override receipt.

### GWT-R4-02 — owner confirmation gate

Given a transition requiring owner approval, when no approval receipt exists, then the phase remains unchanged and the command reports the missing approval rather than silently advancing.

### GWT-R4-03 — session isolation

Given two session IDs, when each writes state and Journey summaries, then their state, receipts, locks, and projections do not cross-contaminate; legacy no-session paths remain readable during migration.

### GWT-R4-04 — lock failure

Given an active lock held by another session, when a write is attempted, then the operation fails or remains pending; it must not continue after exhausting retries without an explicit safe result.

### GWT-R4-05 — CI truthfulness

Given a mandatory asset-quality or contract check exits non-zero, when CI completes, then CI exits non-zero and does not print a misleading success status.

## Selection basis

Keep the existing state/gate/runtime modules as the repair seams. The knowledge-base and Superpowers evidence require explicit gates and verification before completion; that is stronger than relying on a prompt instruction or a projected Journey label.

## Evidence and rollback

Required outputs: transition table, session-isolation fixture, lock contention fixture, override receipt, and CI fail-closed run. Rollback uses state-version migration fallback and a feature flag for strict transitions; never rewrite old state in place without a backup.

