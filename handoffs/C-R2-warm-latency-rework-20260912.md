# C-R2 Warm Latency Value Correction Handoff

## Role

You are an independent Execution Agent. Your sole task is a narrow, mechanical correction to two existing documents. You do not design, implement, or change any contract semantics.

## Problem statement

The C-R2 draft and checklist cite `warm median 0.662 ms` attributed to R1 run1. This value is wrong.

The authoritative source is `test-reports/R1-baseline-20260911/baseline/normalized-baseline.json`, `run1.probes.cost.warmCatalogLatencyMs`:

```json
{
  "runs": [0.759, 0.988, 0.693, 1.022, 0.927],
  "min": "0.693",
  "median": "0.927"
}
```

The value `0.662` comes from the CRLF-contaminated worktree (`raw/crlf-contaminated-crun1/`), which was invalidated by the P9 reproducibility check. R1 REPORT.md line 102 incorrectly attributed it to run1. The draft and checklist inherited this error from REPORT.md.

## Exact correction required

Change `0.662` to `0.927` in exactly these locations:

1. `contracts/drafts/C-R2-catalog.draft.md` — the line in the appendix section "附：R1 实测速查" that reads:

   ```
   | 延迟（不外推） | cold median 10.195 ms；warm median 0.662 ms | R1 cost group |
   ```

   Change to:

   ```
   | 延迟（不外推） | cold median 10.195 ms；warm median 0.927 ms | R1 cost group |
   ```

2. `contracts/drafts/C-R2-catalog.draft.md` — the line in §0 or the prose reference that says:

   ```
   cold median 10.195 ms、warm median 0.662 ms（run1，5 runs）
   ```

   Change `0.662` to `0.927`. Keep the rest of the sentence intact.

3. `contracts/drafts/C-R2-review-checklist.md` — the C6r row that references:

   ```
   cold 10.195 ms / warm 0.662 ms
   ```

   Change `0.662` to `0.927`.

4. In both files, after each correction, append or update a provenance note:

   ```
   <!-- 2026-09-12 rework: warm latency corrected from 0.662 (R1 REPORT.md:102 misattribution to run1; actual source = CRLF-contaminated worktree) to 0.927 (normalized-baseline.json run1.probes.cost.warmCatalogLatencyMs.median). -->
   ```

   Place this comment on the line immediately below each corrected line, or in a consolidated footnote at the bottom of the appendix if individual inline comments would break table rendering.

## Hard boundary

Allowed:
- edit exactly the two files listed above;
- change only the `0.662` → `0.927` value and the provenance note;
- re-hash both files after editing.

Forbidden:
- changing any other number, field, schema, state machine, error code, OQ content, or checklist scenario;
- changing R1 REPORT.md (that is a producer artifact, not in scope);
- changing any runtime source, vendor asset, prototype, planning document, or SKILL.md;
- freezing or approving the contract;
- resolving any G2.1 finding;
- adding, removing, or rewording any checklist scenario or OQ.

If you discover any other discrepancy while editing, stop, record it in your report, and do not fix it. Report it for separate dispatch.

## Procedure

1. Hash both files before editing; record the hashes.
2. Verify the authoritative value: read `test-reports/R1-baseline-20260911/baseline/normalized-baseline.json`, navigate to `run1.probes.cost.warmCatalogLatencyMs`, confirm `median = "0.927"`.
3. Perform the corrections above.
4. Grep both files for any remaining occurrence of `0.662`. There must be zero remaining instances in the two target files.
5. Hash both files after editing; record the new hashes.
6. Confirm `git status --porcelain` still shows zero tracked modifications.
7. Write a short report.

## Evidence

```text
test-reports/C-R2-warm-latency-rework-20260912/
  before/C-R2-catalog.draft.md.sha256
  before/C-R2-review-checklist.md.sha256
  after/C-R2-catalog.draft.md.sha256
  after/C-R2-review-checklist.md.sha256
  grep-after.txt
  REPORT.md
```

If that directory already exists, stop and report instead of overwriting.

## Completion report

```text
# C-R2 Warm Latency Rework Report

snapshot: 240f3fbdb4ee757dffc4d5ab80407d1b2c84863c
executionSessionId: ...
executionAgentIdentity: ...
model: ...
filesChanged: contracts/drafts/C-R2-catalog.draft.md, contracts/drafts/C-R2-review-checklist.md
runtimeFilesChanged: none
vendorAssetsChanged: none
prototypeChanged: none
planningFilesChanged: none

## Hashes
| file | before | after |
|---|---|---|
| C-R2-catalog.draft.md | ... | ... |
| C-R2-review-checklist.md | ... | ... |

## Corrections made
- draft appendix: 0.662 -> 0.927
- draft prose (§0 or equivalent): 0.662 -> 0.927
- checklist C6r: 0.662 -> 0.927
- provenance notes added: yes|no

## Grep after: remaining 0.662 in target files
- draft: 0
- checklist: 0

## Other discrepancies found (not fixed)
- ...

## git status
- tracked changes: 0
```

The orchestrator will independently verify the new hashes, re-read the corrected lines, and confirm the provenance note is present. Your report alone does not constitute freeze.