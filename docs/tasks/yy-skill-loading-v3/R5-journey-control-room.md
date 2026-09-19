# R5 — Journey Projection and One-Page HTML Control Room

Status: `BLOCKED until R4 and G2.1/G2.2`; owner confirmation required before execution.

## Boundary

R5a repairs Journey as a read-only projection of authoritative session state, receipts, gates, and logs. R5b improves exactly one frontend page: the existing HTML Journey Control Room. The page visualizes current phase, progress, asset activation/receipt status, blockers, and the next owner action. It does not authorize transitions.

Non-goals: React/Bridge implementation, a second page, Figma sync, redesigning the whole product, or replacing the CLI.

## Exact files

- `scripts/tt-journey.mjs`
- `docs/prototype/journey-widget.html`
- existing Journey fixtures and additive projection schema after owner review

## Dependencies

Contract dependency: R4 authoritative state and draft interfaces `journey.read` and `journey.project`. R5b may use a contract draft only under the discrepancy/change-order rule.

Completion dependency: R6 owns independent visual/behavioral acceptance. No framework work starts before the HTML Gate A owner decision is `APPROVED`.

## Freeze order

1. Freeze projection input sources and precedence.
2. Freeze Journey fields, stale/error/partial states, and evidence links.
3. Freeze `journey.read`/`journey.project` response shell and error codes.
4. Freeze one-page interaction states and accessibility expectations.
5. Gate A: static HTML prototype owner review. Gate B: runtime integration review. A discrepancy requires a change order and re-acceptance.

## GWT acceptance — R5a

### GWT-R5A-01 — projection truth

Given authoritative state, receipts, and logs, when Journey is generated, then it reports the authoritative phase and progress plus source evidence; it cannot manufacture a completion state from a log label alone.

### GWT-R5A-02 — stale and partial data

Given missing, stale, conflicting, or malformed sources, when projection runs, then it returns a visible `STALE`, `PARTIAL`, or `ERROR` state with a reason and never silently displays `SUCCESS`.

### GWT-R5A-03 — session selection

Given multiple sessions, when a session is selected, then the projection reads only that session and preserves the legacy default path when no session is supplied.

## GWT acceptance — R5b HTML Gate A/B

### GWT-R5B-01 — one-page states

Given the existing page, when rendered with loading, empty, error, success, partial, blocked, and owner-action fixtures, then the same page exposes each state without clipped text, overlap, or hidden blockers.

### GWT-R5B-02 — stage visibility

Given a current stage and the 16-asset matrix, when the page renders, then it shows stage, gate status, asset coverage, selected/activated/verified distinctions, and the next permitted action without implying that a button itself authorizes a transition.

### GWT-R5B-03 — HTML Gate A

Given the static prototype, when owner review runs at the agreed viewport cases, then the owner records `APPROVED` or a bounded change list; no React/Bridge task becomes READY before `APPROVED`.

### GWT-R5B-04 — runtime parity

Given approved fixtures, when runtime data is connected, then the displayed fields match the projection contract and every discrepancy becomes a change order rather than an undocumented frontend workaround.

## Selection basis

Extend the existing HTML prototype because it already provides the Journey interaction surface. Keep the page as a projection and owner decision aid, consistent with the knowledge-base distinction between evidence and authority. Framework adoption is explicitly out of scope for this task.

## Evidence and rollback

Required outputs: projection fixtures, screenshot/viewport checklist, accessibility checklist, Gate A decision, and Gate B parity report. Rollback restores the prior HTML file and keeps the projection API additive; no React scaffold is created in R5.

