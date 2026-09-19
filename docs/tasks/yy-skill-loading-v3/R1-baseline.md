# R1 — Baseline and Evidence Harness

Status: `BLOCKED until G2.1`; owner confirmation required before execution.

## Boundary

R1 establishes a repeatable brownfield baseline for all 16 built-in assets, the current CLI, manifest, state, adapters, Journey projection, and CI. The execution agent may add probes or test fixtures only after the task is READY. It must not repair runtime behavior in R1.

Non-goals: changing routing, changing asset bodies, changing the HTML prototype, introducing a new dependency, or treating existing PASS reports as proof.

## Exact evidence surface

- `D:/\.ai-hub/skills/yy/scripts/lib/manifest.mjs`
- `D:/\.ai-hub/skills/yy/scripts/lib/planner.mjs`
- `D:/\.ai-hub/skills/yy/scripts/lib/asset.mjs`
- `D:/\.ai-hub/skills/yy/scripts/lib/runtime.mjs`
- `D:/\.ai-hub/skills/yy/scripts/lib/gate.mjs`
- `D:/\.ai-hub/skills/yy/scripts/lib/store.mjs`
- `D:/\.ai-hub/skills/yy/scripts/tt-journey.mjs`
- `D:/\.ai-hub/skills/yy/scripts/ci.mjs`
- all 16 built-in asset manifests and bodies

## Dependencies

Contract dependency: G2.1 frozen finding set and G2.2 regenerated task graph.

Completion dependency: R1 evidence package is required by R2, R3, R4, R5a, and R6. R1 does not freeze a runtime API.

## Freeze order

1. Freeze snapshot commit/hash and workspace isolation procedure.
2. Freeze asset inventory and the fields counted as metadata, trigger, activation, receipt, and behavior.
3. Freeze probe commands and machine-checkable expected observations.
4. Freeze baseline report schema.
5. No implementation contract is frozen by R1.

## GWT acceptance

### GWT-R1-01 — clean baseline

Given a clean copy at the frozen snapshot, when the baseline commands run, then every command, exit code, and relevant output token is recorded; no “CI PASS” claim is accepted without checking all mandatory gates.

### GWT-R1-02 — 16-asset inventory

Given the built-in asset root, when inventory is generated, then exactly the 16 in-scope asset IDs are listed with source path, manifest path, body path, and current load/route status; missing or duplicate IDs fail the probe.

### GWT-R1-03 — negative behavior probes

Given an unknown trigger, an ambiguous trigger, a missing body, and a stale Journey state, when each probe runs, then the result is classified as pass/fail with exit code and evidence fields; “looks correct” is insufficient.

### GWT-R1-04 — reproducibility

Given a second clean workspace, when the same probes run, then the classification and machine-checkable observations match the first run, or the report marks the probe `UNRESOLVED`.

## Selection basis

Agent/skill selection is deferred to the execution agent’s bounded implementation choice. The task requires only the existing YY verification scripts and the minimum standard-library probe surface. This preserves the brownfield boundary and prevents a new test framework from hiding the current failure modes.

## Evidence and rollback

Required outputs: snapshot hash, command manifest, raw result files, normalized baseline, and a list of unresolved probes. Store outputs under the task evidence directory; do not overwrite existing reports. Rollback means deleting only newly generated probe artifacts after owner approval; source behavior must remain unchanged.

