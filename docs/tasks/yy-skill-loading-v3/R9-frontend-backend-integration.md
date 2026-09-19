# R9 — Frontend/Backend Integration and Contract Revalidation

Status: `BLOCKED until R2/R3/R4/R5b and G2.1/G2.2`; owner confirmation required.

## Boundary

Create an explicit integration task after backend contract confirmation and frontend HTML Gate A. Validate the real data path, error states, contract hash, and visual parity. Any interface discrepancy invalidates affected downstream READY states and requires revalidation.

Non-goals: allowing frontend code to guess backend fields, making the HTML prototype an execution authority, or adding a new framework before the existing prototype gate.

## Exact files and artifacts

- `contracts/drafts/`, `contracts/frozen/`, `contracts/discrepancies/`
- `scripts/contract-reverse.mjs`, `scripts/contract-discrepancy.mjs`, `scripts/lib/gate.mjs`
- `prototypes/yy-workflow-panel/` and `docs/prototype/journey-widget.html`
- integration fixtures, CDC results, E2E results, and visual parity reports

## Dependencies

Contract dependency: R2 catalog/route, R3 activation/receipt, R4 phase/session, and R5a Journey projection drafts.

Completion dependency: R6 consumes the integration receipt; a discrepancy reopens R9 and affected downstream tasks.

## Freeze order

1. `contract-reverse` draft.
2. Backend schema, response shell, and error-code confirmation.
3. Owner review using real business scenarios.
4. Frozen contract hash.
5. Frontend consumer mapping and fixtures.
6. CDC, integration/E2E, visual parity, and discrepancy revalidation.

## GWT acceptance

### GWT-R9-01 — scenario-reviewed contract

Given Journey, catalog, activation, receipt, and phase operations, when the backend contract is reviewed, then inputs, response shell, errors, empty states, stale states, and failure behavior have an owner scenario record.

### GWT-R9-02 — frontend uses only contract data

Given a frozen contract, when the frontend consumes it, then it does not read internal state files or invent fields; every displayed value maps to a contract field/evidence reference.

### GWT-R9-03 — discrepancy cascade

Given a backend schema/error/response change, when a discrepancy is recorded, then affected frontend tasks, fixtures, parity status, and READY entries are invalidated.

### GWT-R9-04 — full revalidation

Given an updated contract, when CDC, real-business fixtures, key E2E, and visual parity rerun, then the integration receipt records frontend result, backend result, contract hash, and evidence paths.

### GWT-R9-05 — brownfield draft mode

Given only a contract draft, when the frontend starts, then it is explicitly marked `contract-draft`; discrepancies are captured and the draft cannot be represented as frozen.

## Selection basis

Reuse the existing contract-reverse/discrepancy workflow, current HTML-first Gate A, and installed frontend/backend validation assets. No new integration framework is required for MVP.

## Evidence and rollback

Required: scenario review, frozen hash, consumer mapping, CDC/E2E/parity reports, and discrepancy closure. Rollback restores the previous consumer mapping and contract version; it does not erase the failed integration receipt.

