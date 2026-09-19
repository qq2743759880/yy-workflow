# R2 Catalog/Router Implementation Handoff

## Role

You are the independent Execution Agent for YY task `R2`. You may use your own internal subagents.

R2 is the **first implementation task** in this repair cycle. You modify runtime code to bring the catalog ingestion, metadata normalization, and router into compliance with the frozen C-R2 contract.

## Hard boundary

Allowed:
- modify `scripts/lib/manifest.mjs`, `scripts/lib/planner.mjs`, `scripts/lib/matrix.mjs`;
- modify vendor asset frontmatter ONLY if the contract requires metadata normalization (see B2/B8 rulings);
- create new test fixtures and probes in a new evidence directory.

Forbidden:
- modifying `scripts/lib/asset.mjs`, `scripts/lib/runtime.mjs`, `scripts/lib/gate.mjs`, `scripts/lib/store.mjs`, `scripts/tt-journey.mjs`, `scripts/ci.mjs`, or `scripts/orchestrator.mjs` (those are R3/R4 scope);
- modifying any HTML prototype or frontend file;
- introducing a new dependency, framework, or package;
- whole-machine skill discovery (bounded to the 16 built-in assets only);
- vector DB, remote registry, fine-tuning, or new server runtime;
- deleting any existing field from the manifest or router output (additive only during R2);
- resolving C5 or C6.

## Frozen contract

Your acceptance baseline is:

```text
C-R2-catalog.draft.md sha256 = C1373728DCFE49244A4769F9DFF65E5CC126B03484FEAF6D57E912F0B66DB2D5
C-R2-review-checklist.md sha256 = F36405A357BFB7BBB2ED8EAD931FDBED9B38599CD78AE157B2482BF785E5D7F0
```

Read both before writing code. The checklist contains 23 Owner rulings; each ruling is a contract clause you must honor.

## Frozen runtime snapshot

```text
Repository: D:/.ai-hub/skills/yy
Commit:     240f3fbdb4ee757dffc4d5ab80407d1b2c84863c
```

Create a clean detached worktree at that commit (core.autocrlf=false before checkout). Record executionSessionId, executionAgentIdentity, model, cleanWorkspace, nodeVersion.

## Owner rulings you must implement

### Word-boundary matching (A6/A7)

Replace `planner.mjs:25` substring scoring (`text.includes(normalize(keyword))`) with word-boundary token matching. `data` must not match inside `database`. `ci` must not match inside `special`. `ai` must not match inside `campaign`/`email`/`painting`.

CJK keywords (Chinese text without whitespace delimiters) use longest-substring matching within CJK character sequences (OQ-12). Latin keywords use word-boundary.

### AMBIGUOUS state (A3)

`planner.mjs:26` currently uses `score > bestScore` (strict greater, first-max wins). Change to: collect all clusters with the highest score. If ≥2 clusters tie at a non-zero score, return state `AMBIGUOUS` with a list of tied cluster IDs and their asset candidates. Do not pick a winner silently.

Zero-score ties (all clusters score 0) remain `NO_MATCH` (A4/A5 ruling).

### Suggestion on NO_MATCH (A5)

When the result is `NO_MATCH` and any cluster keyword is a substring of the input (or vice versa, Levenshtein distance ≤ 2), include a `suggestions: string[]` field in the response shell with the closest matching keyword. Do not auto-route. This is informational only.

### Phase-constrained trigger terms (A8)

`review security findings` should route to `T5_OPS` (security asset) **only when** `phase` is in `['review', 'verification']`. In other phases, it remains `NO_MATCH`. Word-boundary must apply.

### Explicit assets override (A9)

`explicitAssets` bypasses keyword routing entirely. If an explicit asset ID exists in the catalog, return `MATCHED` with that asset. If the ID does not exist, return `ASSET_NOT_FOUND`. Explicit selection cannot be overridden by keyword scores.

### Description block-scalar prohibition (B2)

If a manifest's `description` value, after trimming, exactly equals one of `|`, `>-`, `>`, `|-`, `>-`, `|+`, `>+`, store `description = null` in the catalog entry, and emit diagnostic `META_DESCRIPTION_BLOCK_SCALAR` (severity: warning).

Assets with `description = null` can be explicitly selected via `explicitAssets` but are excluded from automatic keyword routing (their keywords array is empty or derived from `name` only, not from the null description).

### Version missing diagnostic (B3)

If a manifest does not declare `version`, emit `META_VERSION_MISSING` (severity: warning). One diagnostic per asset, no aggregation.

### Duplicate ID detection (B7)

If two or more vendor directories produce the same asset ID, emit `META_DUPLICATE_ID` (severity: blocking). Blocking-level diagnostics exclude the entry from the `selected` candidate set.

### Body missing vs unrecognized (B5/B6)

If a depth-1 directory has a `SKILL.md` (skill type) or `<name>.md` (agent type) but the file is unreadable, emit `ASSET_BODY_MISSING` (severity: blocking). If a directory has neither file, emit `ASSET_UNRECOGNIZED` (severity: blocking). These must be distinguishable.

### Unparsed frontmatter keys (B8)

The current line-based parser produces false keys when frontmatter has nested structures. Detect keys that are not in the allowed set (`name`, `version`, `description`, `triggers`) and emit `META_FRONTMATTER_UNPARSED` (severity: info) with the key names listed. Do NOT modify vendor frontmatter in R2; register this as a follow-up task in your completion report.

### Error codes (§6)

Implement the response shell from the contract:
- success: `ok: true, code: null, data: {...}, evidence: {...}, warnings: []`
- failure: `ok: false, code: <ERROR_CODE>, data: {}, evidence: {...}, warnings: [...]`

Error codes (grounded in dev-plan lines 300-301):
- `CATALOG_INVALID` — internal parse failure
- `ASSET_SCOPE_INVALID` — scope references unknown ID or invalid shape
- `ROUTE_AMBIGUOUS` — two or more clusters tie at non-zero score
- `ROUTE_NO_MATCH` — all clusters score 0
- `ASSET_NOT_ELIGIBLE` — asset matched but ineligible in current phase
- `INPUT_INVALID` — task empty/non-string/whitespace
- `CATALOG_MODE_UNSUPPORTED` — mode not in `legacy|bounded|dual`
- `ASSET_NOT_FOUND` — explicitAssets references a non-existent ID

### Cache identity (C4, OQ-5)

Implement cache invalidation:
- Cold start: full source-hash computation for all 16 entries.
- Warm start: `stat` (mtime + size) comparison first. If stat unchanged, serve from cache without hashing. If stat changed for any entry, re-hash that entry and rebuild.
- Cache identity = composite hash of all entry sourceHashes.
- Cache is stored in `.tt-state/manifest.json` (existing path, no change).

### Dual mode (C2r)

`YY_CATALOG_MODE=dual` runs both legacy and bounded paths. Output a machine-readable reconciliation file at `artifacts/<planId>/dual-catalog-report.json` with:

```json
{
  "legacy": { "route": "...", "cluster": "...", "candidates": [...] },
  "bounded": { "state": "...", "cluster": "...", "candidates": [...], "margin": {...} },
  "match": true|false,
  "drift": "description of any behavioral difference"
}
```

### Legacy mode (C1)

`YY_CATALOG_MODE=legacy` (default) preserves current behavior byte-for-byte. No new required fields. `NoMatchError` still throws. CLI exit codes unchanged.

## What you must NOT do

- Do not change the 16 vendor asset bodies or SKILL.md files (B8: no vendor fixes in R2).
- Do not change `asset.mjs`, `runtime.mjs`, `gate.mjs`, `store.mjs` — activation/receipts are R3.
- Do not change `tt-journey.mjs`, `ci.mjs`, `orchestrator.mjs` — phase gates and CI truth are R4.
- Do not change any HTML prototype.
- Do not introduce `triggers` frontmatter key (OQ-4: Owner has not decided yet).
- Do not change `YY_CATALOG_MODE` default (it stays `legacy`).

## Deliverables

1. Modified `scripts/lib/manifest.mjs` — metadata normalization + diagnostics.
2. Modified `scripts/lib/planner.mjs` — word-boundary matching + AMBIGUOUS + suggestion + phase-constrained + explicit override.
3. Modified `scripts/lib/matrix.mjs` — only if cluster keyword definitions need updating for word-boundary compliance.
4. New probes + evidence under `test-reports/R2-catalog-router-20260912/`.
5. A dual-mode reconciliation sample.

## Completion report format

```text
# R2 Catalog/Router Implementation Report

snapshot: 240f3fbdb4ee757dffc4d5ab80407d1b2c84863c
executionSessionId: ...
executionAgentIdentity: ...
model: ...
cleanWorkspace: true|false
runtimeFilesChanged: <list>
vendorAssetsChanged: none|<list>
prototypeChanged: none
planningFilesChanged: none

## Contract compliance check
| checklist row | contract clause | implementation | status |
|---|---|---|---|
| A1 | word-boundary T2 3/1 | ... | PASS/FAIL |
| A2 | word-boundary T4 2/0 | ... | PASS/FAIL |
| A3 | AMBIGUOUS reachable | ... | PASS/FAIL |
| A4 | NO_MATCH on unrelated | ... | PASS/FAIL |
| A5 | NO_MATCH + suggestion | ... | PASS/FAIL |
| A6 | substring prohibition | ... | PASS/FAIL |
| A7 | C3 no longer T3 | ... | PASS/FAIL |
| A8 | phase-constrained T5_OPS | ... | PASS/FAIL |
| A9 | explicit override | ... | PASS/FAIL |
| B1 | INELIGIBLE when no contract | ... | PASS/FAIL |
| B2 | block-scalar → null + warning | ... | PASS/FAIL |
| B3 | 6 missing version warnings | ... | PASS/FAIL |
| B4 | separate error codes | ... | PASS/FAIL |
| B5 | ASSET_BODY_MISSING | ... | PASS/FAIL |
| B6 | ASSET_UNRECOGNIZED | ... | PASS/FAIL |
| B7 | META_DUPLICATE_ID | ... | PASS/FAIL |
| B8 | unparsed keys diagnostic | ... | PASS/FAIL |
| C1 | legacy unchanged | ... | PASS/FAIL |
| C2r | dual reconciliation file | ... | PASS/FAIL |
| C3r | mode=strict → error | ... | PASS/FAIL |
| C4 | stat-then-hash cache | ... | PASS/FAIL |
| C5r | warm read 1 cache file | ... | PASS/FAIL |
| C6r | no invented numbers | ... | PASS/FAIL |

## Evidence
- commands, exit codes, raw outputs per scenario

## Legacy regression check
- node scripts/ci.mjs exit code + per-gate results
- all 16 entries still present

## Follow-up tasks registered
- B8: vendor frontmatter normalization (not in R2 scope)

## Limitations
- ...
```

The orchestrator will independently re-run the full 23-scenario checklist against your implementation. Your completion report alone does not unlock R3; independent acceptance does.