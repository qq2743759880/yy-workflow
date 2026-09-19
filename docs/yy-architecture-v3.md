# YY Architecture v3 — Brownfield Logical Reorganization

Status: `PROPOSED / G2.1-BLOCKED / implementation READY = {}`

This document is an architecture addendum for `PRD0-contract-revision-v3.md` and `yy-dev-plan-skill-loading-v3.md`. It defines the target boundaries and migration order; it does not authorize runtime implementation.

## 1. Architecture verdict

YY is not missing a single feature. It has six overlapping control surfaces:

1. `SKILL.md` and `README.md` are public entry points.
2. `commands/` and `reference/` describe phase rules and policies.
3. `scripts/` contains orchestration, routing, gates, state, adapters, CI, and Journey code in one operational tree.
4. `vendor/` contains the 16 assets, while metadata and execution assumptions are also repeated in README, matrix, prompts, and reports.
5. `plans/`, `docs/`, `docs/history/`, `.learnings/`, and `test-reports/` mix active contracts, historical evidence, task proposals, and completion claims.
6. `journey.json`, `state.json`, summaries, receipts, and logs are all treated as progress evidence by different paths, but they do not have one explicit authority boundary.

The immediate problem is therefore not “move every file”. It is the absence of one source-of-truth map and explicit ownership for each artifact. A physical tree rewrite now would increase path breakage and token cost. The first change is logical separation with indexes, schemas, and compatibility façades; physical moves happen only after behavior and path regression pass.

## 2. Evidence and design basis

### Local architecture evidence

- `scripts/lib/manifest.mjs` and `scripts/lib/planner.mjs` currently combine discovery, parsing, and routing concerns.
- `scripts/lib/asset.mjs` and `scripts/lib/adapters/prompt.mjs` combine activation, prompt assembly, and consumption evidence.
- `scripts/lib/runtime.mjs`, `gate.mjs`, `store.mjs`, and `tt-journey.mjs` overlap phase, state, lock, and projection responsibilities.
- `plans/tasks/` contains historical and candidate PRDs with incompatible READY assumptions; the current v3 contract explicitly demotes older files to historical input.
- `reference/` already contains useful policies for requirement back-jump, critique backlog, contract freeze, memory sync, and independent acceptance, but those policies were not wired into the current R-task graph.

### Knowledge-base and external basis

- F-C10 Superpowers shows a useful split between human-readable skill bodies, platform adapters, bootstrap/runtime hooks, and pressure-tested skill behavior. YY should copy the separation and testing discipline, not copy runtime code.
- P-001 supports deterministic workflow control for fixed phase transitions; model choice remains bounded inside the task.
- P-002 supports progressive disclosure, externalized state, fresh context, and small focused tasks.
- P-003 treats tool/asset contracts as ACI: explicit inputs, outputs, errors, examples, and misuse tests.
- The Agent Skills specification separates startup discovery metadata from the full skill body and recommends progressive loading; this supports a metadata catalog plus activation broker rather than startup body injection.
- Anthropic’s workflow guidance supports deterministic workflows for predictable paths and evaluator/optimizer loops only where evaluation criteria are explicit. YY should keep phase authority deterministic and make evolution evidence-driven.
- Superpowers’ `writing-skills` pressure-testing method requires a baseline failure, a skill intervention, and repeated fresh-context checks. This becomes the basis of R10.

## 3. Target logical architecture

```text
                ┌────────────────────────────┐
                │ Public entrypoints         │
                │ SKILL.md / README / commands│
                └─────────────┬──────────────┘
                              │
                ┌─────────────▼──────────────┐
                │ Control plane               │
                │ PRD / change / task graph  │
                │ contract / READY / approval│
                └──────┬───────────┬─────────┘
                       │           │
          ┌────────────▼───┐   ┌──▼──────────────┐
          │ Asset plane     │   │ Execution plane │
          │ catalog/router  │   │ phase/gate      │
          │ activation      │   │ session/receipt │
          └────────────┬────┘   └──┬──────────────┘
                       │           │
                       └─────┬─────┘
                             ▼
                    ┌──────────────────┐
                    │ Evidence plane   │
                    │ verify/critique  │
                    │ backlog/evolution│
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ Projection plane │
                    │ Journey/HTML UI  │
                    │ read-only         │
                    └──────────────────┘

                    Compatibility plane
              legacy CLI/state/manifest/adapters
              wraps every migration boundary
```

### Ownership rules

| Plane | Single authority | Reads | Must not do |
|---|---|---|---|
| Control | PRD version, change record, task graph, frozen contract | evidence and owner decisions | execute code or infer completion |
| Asset | catalog + activation receipt | built-in 16 assets and route input | authorize phase transition |
| Execution | canonical state/transition/receipt | frozen contract and activation result | let Journey or LLM write `done` |
| Evidence | machine observations, critique findings, verification verdicts | artifacts, commands, source hashes | convert a claim into proof without rerun |
| Projection | Journey read model and HTML page | state, receipts, logs with provenance | write canonical state or execute hidden actions |
| Compatibility | legacy readers, migration flags, rollback snapshots | old/new formats | delete old fields during MVP |

## 4. Directory strategy

### Current tree classification

| Current location | New logical role | Immediate action |
|---|---|---|
| `SKILL.md`, `README.md` | public entrypoints | keep stable; point to canonical indexes |
| `commands/` | phase command entrypoints | keep; each command names its source policy |
| `reference/` | stable policy and protocol definitions | keep; add index and deprecate duplicates |
| `scripts/lib/manifest.mjs`, `planner.mjs` | asset catalog/router façade | keep import paths; move internals only behind façade later |
| `scripts/lib/asset.mjs`, `adapters/` | activation/host boundary | keep adapter names; add activation package/receipt boundary |
| `runtime.mjs`, `gate.mjs`, `store.mjs` | execution authority | keep as compatibility façades; one canonical transition/store implementation |
| `tt-journey.mjs`, `summary-read.mjs` | projection/read model | no second writer; read canonical state and receipts |
| `vendor/` | immutable built-in asset payloads | add generated catalog/index; do not duplicate bodies |
| `plans/tasks/` | active PRD and task contracts | add `active/` and `archive/` index before moving files |
| `docs/tasks/` | detailed task handoffs | keep active R task docs together; no duplicate task IDs elsewhere |
| `docs/history/`, `.learnings/`, `test-reports/` | evidence/history | classify as evidence; never produce READY directly |

### Target namespaces (additive, not an immediate move)

```text
contracts/
  drafts/       # contract-reverse output, not executable freeze
  frozen/       # hash-locked contracts consumed by runtime
  discrepancies/# change records and revalidation links
plans/
  active/       # one current PRD/task graph source
  archive/      # historical plans, read-only evidence
tasks/
  active/       # R1-R10 detailed task docs
evidence/
  baseline/     # R1 measurements
  verification/ # independent reproductions and acceptance
  critique/     # findings and remediation links
  evolution/    # candidate skill versions and pressure-test results
```

For the MVP, these namespaces can be introduced as indexes and path aliases. Do not physically move existing files until R6 compatibility tests prove all current CLI, manifest, state, and report paths remain readable.

## 5. Canonical data flow

```text
PRD/change request
  → impact classification
  → invalidated task/contract set
  → contract-reverse draft
  → owner scenario review
  → frozen contract hash
  → READY recomputation
  → bounded asset route/activation
  → canonical execution state + receipt
  → independent verification / critique
  → remediation task or evolution candidate
  → Journey read-only projection
```

Key invariant: `Journey`, logs, completion reports, and LLM statements are projections or claims. Only canonical state transitions backed by frozen contracts and receipts can unlock a task.

## 6. Migration sequence

1. **R1 inventory**: produce a file ownership map, duplicate-fact report, path compatibility list, and 16-asset evidence matrix.
2. **R2/R3**: create the catalog and activation façades without moving asset bodies; add source hashes and receipts.
3. **R4**: make one phase/state/receipt authority and namespace sessions; retain old readers.
4. **R7**: add change records and PRD back-jump invalidation before allowing future requirement edits.
5. **R8**: connect critique findings to idempotent remediation task generation; no direct auto-edit.
6. **R5/R9**: freeze draft contract, owner-review business scenarios, then run explicit frontend/backend integration task and discrepancy loop.
7. **R10**: add candidate asset versioning, pressure tests, and isolated acceptance policy.
8. **R6**: run dual-read/single-write, rollback rehearsal, path regression, and independent release acceptance; only then consider physical directory cleanup as a separate change order.

## 7. Non-negotiable invariants

- One task namespace: `G2.1/G2.2/R1-R10`; old `SL*` and `E*` identifiers remain historical only.
- One canonical phase/state writer; Journey is read-only.
- One active PRD and one frozen contract per plan; drafts cannot unlock tasks.
- One asset catalog; README, kickoff prompts, and UI consume generated views rather than hand-copied lists.
- Every critique finding has a stable ID, source evidence, remediation link, status, and re-verification result.
- Every contract discrepancy invalidates affected downstream READY states.
- Every asset evolution candidate is tested in an isolated context before promotion.
- No “PASS” without machine evidence; no evidence without source snapshot and command.

## 8. Architecture acceptance

This architecture is accepted only when R1 can enumerate the current tree and duplicate facts, R4 proves one authority, R7/R8/R9/R10 pass their contracts, and R6 proves legacy path compatibility. Until then this document is a design constraint, not an implementation claim.

