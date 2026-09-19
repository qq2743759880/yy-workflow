# C-R2 Catalog/Router Contract DRAFT Handoff

## Role

You are an independent Execution Agent. You may use your own internal subagents.

Produce a **draft** contract for `C-R2-catalog` so the Owner can review it with real business scenarios. You are not authorized to freeze it, implement it, or change any runtime code.

## Why this is the current critical-path step

R1 is accepted and its baseline is frozen. Every remaining R-task is gated either on a frozen contract or on an upstream DONE. `R2 READY := R1 == DONE && C-R2 == FROZEN`. `C-R2` does not exist as a frozen document yet, so the critical path runs through this draft plus Owner scenario review.

A DRAFT is not a freeze. `contracts/drafts/` never unlocks a task.

## Boundary

Allowed:
- write a new draft document under `contracts/drafts/`;
- read the frozen R1 baseline, the G2.2 graph, `PRD0-contract-revision-v3.md`, and `docs/yy-dev-plan-skill-loading-v3.md`;
- read source read-only to ground the contract.

Forbidden:
- modifying runtime source (`scripts/**`), vendor assets, the prototype, `SKILL.md`, or any planning document;
- implementing the router or catalog;
- inventing endpoint names, fields, error codes, or numbers that are not grounded in an existing document or a measured R1 value;
- marking the draft frozen, approved, or READY;
- resolving `C2` (it stays `UNRESOLVED`).

## Inputs

```text
test-reports/R1-baseline-20260911/           (frozen baseline, schema hash 8db3278d936ca68d6db8ec31425e642c9f00dee8800fb0eeb5caa18c144fa9c4)
plans/tasks/G2.2-task-graph-20260911.md      (sha256 1C575633379A76B4AC0FF5F056175B141BCE962E4214F60F6ACFA098B1E1DDF6)
plans/tasks/G2.2-owner-confirmation-20260911.md
plans/tasks/PRD0-contract-revision-v3.md     (sections 3, 6.2, 10, 11)
docs/yy-dev-plan-skill-loading-v3.md         (R2 section)
```

## R1 baseline facts the draft must consume (not re-derive)

- in-scope inventory is exactly 16 built-in assets: 10 `skill` + 6 `agent`; zero duplicates, zero parser warnings;
- the frozen route battery shows `campaign`, `email`, and `painting` all routing to `T3_AI_RAG_MCP`; two inputs correctly abstain with `NoMatchError`;
- 2 assets have a `description` that is a YAML block-scalar marker (`|` or `>-`) instead of prose;
- 6 of 16 assets declare no `version`;
- the observed ambiguity defect: a compound query (`database frontend`) silently resolves to a first-max winner; no `AMBIGUOUS` state exists in the current implementation, and keyword matching is substring-based (`data` matches inside `database`);
- `C2` remains `UNRESOLVED`, so parser-semantics acceptance is blocked; the draft must mark parser-dependent fields as `CONTRACT_DRAFT_REQUIRED` / blocked-evidence rather than asserting them.

Do not invent token or latency numbers. If a value is not measured in the R1 baseline, write `[待补充]`.

## Required draft content

Produce `contracts/drafts/C-R2-catalog.draft.md` with:

1. **Scope and non-goals** — 16 built-in assets and existing host adapters only; no whole-machine discovery; no vector DB; no remote registry; additive fields only.
2. **Operations** — `catalog.read` and `router.select` are the only draft operation names carried from the dev plan. Define for each: input, output, errors, and idempotency. Do not invent additional operation names.
3. **Schemas** — field-level definitions for catalog entries and route decisions: asset id, type (`skill`/`agent`), source path, manifest path, body path, source hash, metadata status, body size, resource size, trigger terms, keywords, description, version, cache identity.
4. **Route decision states** — the four states `MATCHED` / `NO_MATCH` / `AMBIGUOUS` / `INELIGIBLE`, with the exact condition that selects each, plus what margin/tie information is returned. The `AMBIGUOUS` state is required to be reachable; state the condition under which the current implementation would need to produce it.
5. **Metadata diagnostics** — one diagnostic code per failure class observed in R1 (block-scalar description, missing version, non-prose keywords, duplicate id, missing body, unrecognized asset). Give each an id, severity, and machine-checkable detection rule.
6. **Error codes and response shell** — a single response envelope for both operations, with named error codes for: invalid input, unsupported mode, asset not found, asset ineligible, ambiguous match, and internal parse failure. The shell must be identical across success and failure.
7. **Cache identity** — what is hashed, what invalidates the cache, and the cold/warm/changed-content behavior. Ground it in the R1 baseline's structural read-count observation (`manifest.mjs:36`, `:60`); do not claim measured latency that R1 did not measure.
8. **Compatibility and migration** — `YY_CATALOG_MODE=legacy|bounded|dual`; what each mode guarantees; which legacy fields remain readable; what is never deleted during R2.
9. **Frontmatter contract for the 16 assets** — the normalized required/optional field set, and the exact rule that prevents a block-scalar marker from being stored as a `description`.
10. **Change control** — a post-freeze change must produce a discrepancy record under `contracts/discrepancies/` and re-acceptance of consumers; drafts never unlock tasks.
11. **Open questions for the Owner** — list every field where the correct product behavior is a judgement call rather than a measurement, so the Owner can decide it during scenario review.

## Required second deliverable

Produce `contracts/drafts/C-R2-review-checklist.md`: a scenario table the Owner walks through item by item. Each row must have: scenario, exact input, expected route decision state, expected error code (if any), and what would count as a contract defect. Include at minimum:

- a plain positive query that should match exactly one asset;
- a query that legitimately matches two assets and must return `AMBIGUOUS`, not a silent winner;
- a near-miss/typo query that must return `NO_MATCH`;
- a query containing a keyword as a substring of a longer unrelated token (the `data`/`database` case) that must not produce a false positive;
- a query hitting an asset that is present but not eligible in the current phase;
- an asset whose manifest has a malformed `description`;
- a legacy-mode read of an existing manifest produced before this contract.

Do not fill in the Owner's decisions. Leave the expected column explicitly for Owner confirmation where the R1 baseline does not already determine it.

## Evidence and completion report

Return:

```text
# C-R2 Contract Draft Report

snapshot: 240f3fbdb4ee757dffc4d5ab80407d1b2c84863c
executionSessionId: ...
executionAgentIdentity: ...
model: ...
draftPath: contracts/drafts/C-R2-catalog.draft.md
checklistPath: contracts/drafts/C-R2-review-checklist.md
draftSha256: ...
checklistSha256: ...
freezeState: DRAFT (not frozen, not approved)
runtimeFilesChanged: none
vendorAssetsChanged: none
prototypeChanged: none
planningFilesChanged: none

## Grounding check
| claim in draft | grounded in | value |
|---|---|---|
| ... | R1 baseline / PRD0 / dev plan / source | ... |

## Unmeasured values
- list every `[待补充]` and every `CONTRACT_DRAFT_REQUIRED`

## Unresolved-finding handling
- C2: still UNRESOLVED; parser-dependent fields marked ...
- C5 / C6: untouched

## Owner decisions required
- enumerated open questions

## Raw evidence
- commands, exit codes, file hashes
```

The Owner reviews the checklist with real scenarios, then either freezes, narrows, or rejects. The orchestrator will verify the draft is grounded before presenting it. This task does not unlock R2; the Owner's freeze decision does.