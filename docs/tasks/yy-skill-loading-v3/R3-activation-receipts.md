# R3 — Activation Budget, Asset Receipts and Behavioral Proof

Status: `BLOCKED until R2 and G2.1/G2.2`; owner confirmation required before execution.

## Boundary

Repair the path from selected asset to bounded activation, evidence receipt, and behavior verification for all 16 assets. The design must make asset use observable without placing all asset bodies into the prompt. Existing adapters remain available during migration.

Non-goals: rewriting the 16 knowledge assets, adding a general-purpose memory system, enabling unrestricted subagents, or changing frontend presentation.

## Exact files

- `scripts/lib/asset.mjs`
- `scripts/lib/adapters/*.mjs`
- `scripts/lib/runtime.mjs`
- existing 16 asset manifests/bodies only where metadata or an activation anchor is missing
- additive receipt schema under `docs/contracts/` after owner review

## Dependencies

Contract dependency: R2 selected asset identity; draft interfaces are `activation.prepare` and `receipt.append`.

Completion dependency: R4 uses receipt validity to gate phase transitions; R5a projects receipt state; R6 independently verifies no silent consumption.

## Freeze order

1. Freeze activation input and budget fields.
2. Freeze body selection rules: summary/sections/anchors before full body.
3. Freeze receipt fields, hash/source identity, and completeness rules.
4. Freeze failure codes and response shell after real-scenario review.
5. Freeze adapter evidence mapping and migration fallback.

## GWT acceptance

### GWT-R3-01 — bounded activation

Given a matched asset and a token budget, when activation runs, then it returns only the permitted summary/sections/anchors, records estimated and actual units, and fails closed when the budget is exceeded.

### GWT-R3-02 — real consumption receipt

Given each of the 16 assets, when its activation is used by an adapter, then a receipt contains asset ID, source identity, selected sections, activation time, budget result, adapter result, and verification status.

### GWT-R3-03 — no false positive

Given a route that selects an asset but never reaches adapter use, when verification runs, then the result is `SELECTED_NOT_CONSUMED`, not “consumed” or “PASS”.

### GWT-R3-04 — tamper and stale source

Given a changed body, missing section, invalid receipt, or hash mismatch, when receipt verification runs, then it returns a stable error code and does not mark the asset behavior as verified.

### GWT-R3-05 — all16 matrix

Given the 16-asset matrix, when the behavioral suite runs, then each asset has an explicit result: `VERIFIED`, `FAILED`, or `UNRESOLVED`, with no aggregate percentage hiding missing rows.

## Selection basis

Reuse `asset.mjs` and adapter seams. Prefer a manifest-driven section index and compact evidence over whole-body prompt embedding, because the observed failure is context growth plus unverifiable asset use. No new agent or subagent is selected here; execution remains bounded by the frozen activation contract.

## Evidence and rollback

Required outputs: per-asset receipt samples, token/byte budget table, adapter evidence map, failure fixture set, and before/after prompt-size measurements. Rollback disables bounded activation and restores the legacy adapter path while retaining receipts as additive diagnostics.

