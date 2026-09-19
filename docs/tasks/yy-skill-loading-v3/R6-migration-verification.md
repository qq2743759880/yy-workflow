# R6 — Migration, Compatibility, Rollback and Independent Acceptance

Status: `BLOCKED until R5b/R7/R8/R9/R10 and G2.1/G2.2`; owner confirmation required before execution.

## Boundary

R6 integrates the approved additive migration, verifies CLI/manifest/state/adapters, exercises rollback, and prepares the independent acceptance package. It does not introduce new product scope or silently repair a failed upstream task.

Non-goals: changing the frozen contracts, adding new assets, replacing the HTML page with a framework, or declaring acceptance from self-authored reports.

## Exact files

- migration/version helpers introduced by R2–R4
- `scripts/ci.mjs`
- `scripts/validate-structure.mjs`
- `scripts/regression-all.mjs`
- `scripts/tt-journey.mjs`
- approved HTML prototype and projection fixtures
- `docs/contracts/` and evidence outputs

## Dependencies

Contract dependency: all approved contract records, owner-reviewed discrepancy/change orders, R7 invalidation rules, R8 remediation closure, R9 integration receipt, and R10 independent acceptance policy.

Completion dependency: independent third-party reproduction of at least three frozen Critical findings, with all six classified as required by G2.1; R6 also requires accepted findings to have remediation closure or an owner-approved `NO_ACTION`. R6 cannot convert an unresolved finding into a pass.

## Freeze order

1. Freeze migration version and compatibility window.
2. Freeze rollback trigger, backup location, and recovery command.
3. Freeze final verification matrix and evidence naming.
4. Freeze independent acceptance packet.
5. Freeze release decision only after owner review and third-party evidence.

## GWT acceptance

### GWT-R6-01 — legacy compatibility

Given legacy CLI invocations, manifests, state files, and adapter inputs, when the migrated system runs, then each remains readable or produces an explicitly documented migration error; no silent data loss occurs.

### GWT-R6-02 — rollback

Given a migration failure or contract discrepancy, when the frozen rollback procedure runs, then the prior compatible behavior and state are restored, and the rollback receipt identifies what was reverted.

### GWT-R6-03 — end-to-end bounded path

Given one session, one phase, one selected asset, and one adapter, when the full path runs, then catalog selection, bounded activation, receipt verification, authoritative phase state, Journey projection, and CI evidence agree.

### GWT-R6-04 — 16-asset closure

Given the final 16-asset matrix, when verification completes, then every asset has catalog, routing, activation, receipt, and behavior evidence; no aggregate percentage substitutes for a row.

### GWT-R6-05 — independent acceptance packet

Given the frozen C1/C2/C3/C5/C6/C7 set, when a separate execution session follows only the source anchors, commands, and expected observations, then each finding is marked `REPRODUCED`, `COUNTEREVIDENCE_CONFIRMED`, or `UNRESOLVED`.

## Selection basis

Reuse existing validation and regression entry points, adding only the missing fail-closed checks. This is the shortest safe brownfield path: prove compatibility and reversibility before claiming the workflow is repaired.

## Evidence and rollback

Required outputs: migration report, compatibility matrix, rollback rehearsal, full test output, 16-asset evidence matrix, discrepancy log, and third-party acceptance packet. If any mandatory item is absent, R6 remains `NOT READY`.
