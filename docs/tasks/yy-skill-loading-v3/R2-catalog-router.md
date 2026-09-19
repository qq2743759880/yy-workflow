# R2 — 16-Asset Catalog, Trigger and Router

Status: `BLOCKED until R1 and G2.1/G2.2`; owner confirmation required before execution.

## Boundary

Repair discovery, metadata normalization, trigger matching, ambiguity handling, and route evidence for the 16 built-in assets. Keep the existing CLI and manifest shape readable during the migration window. Additive fields are allowed; destructive manifest changes are not.

Non-goals: loading every asset body at startup, full-machine skill discovery, changing phase authority, redesigning Journey, or implementing the HTML page.

## Exact files

- `scripts/lib/manifest.mjs`
- `scripts/lib/planner.mjs`
- `scripts/lib/asset.mjs` only if a catalog read boundary is required
- the 16 built-in asset manifests
- additive schema/migration notes under `docs/contracts/` after owner approval

## Dependencies

Contract dependency: R1 inventory and probe schema. The draft interfaces are `catalog.read` and `router.select` from the parent plan; they are not frozen until owner review.

Completion dependency: R3 consumes the selected asset identity and route evidence. R4 consumes eligibility and phase metadata. R2 cannot claim success if only one or two assets work.

## Freeze order

1. Freeze catalog record fields and compatibility defaults.
2. Freeze trigger normalization and token-boundary rules.
3. Freeze route result states: `MATCHED`, `NO_MATCH`, `AMBIGUOUS`, `INELIGIBLE`.
4. Freeze `catalog.read` and `router.select` schemas, error codes, and response shell after real-scenario review.
5. Freeze migration and fallback behavior.

## GWT acceptance

### GWT-R2-01 — complete catalog

Given the 16 built-in assets, when `catalog.read` runs, then all 16 have valid IDs, version/source metadata, trigger metadata, activation metadata, and compatibility defaults without reading full bodies.

### GWT-R2-02 — deterministic matching

Given exact, case-varied, punctuation-adjacent, negated, unknown, and overlapping triggers, when `router.select` runs, then it returns the same result for repeated runs and never silently chooses an ambiguous candidate.

### GWT-R2-03 — bounded startup

Given a cold start, when the catalog is loaded, then startup reads the catalog metadata only; body reads are absent from the startup trace and are deferred to activation.

### GWT-R2-04 — compatibility

Given a legacy manifest and legacy CLI invocation, when routing runs, then the old invocation remains valid and produces a compatibility-mapped result; malformed new fields fail closed with an actionable code.

## Selection basis

Use the existing manifest/planner modules and standard-library parsing unless the frozen contract proves that a dependency is necessary. The design follows the knowledge-base distinction between workflow control and agent choice: routing returns bounded evidence, not an opaque “best skill” assertion.

## Evidence and rollback

Required outputs: catalog snapshot, route decision table for all 16 assets, trigger collision report, cold-start read trace, and legacy compatibility run. Rollback is a feature-flag or migration-window fallback to the legacy parser/router; do not delete legacy fields during R2.

