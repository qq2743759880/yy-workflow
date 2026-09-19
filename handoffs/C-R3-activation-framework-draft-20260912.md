# C-R3 Activation/Receipt Contract — Framework Draft Handoff

## Role

You are an independent design agent. Your task is to draft the **framework** of the C-R3 contract — its operations, schema skeleton, and non-receipt sections. You do NOT finalize the receipt design; that waits for the C6 verdict.

You do not repair C6. You do not change finding statuses. You do not modify any runtime source.

If you cannot complete the design because of conflicting information, STOP and report. Do not modify the design to fit the issue.

## Why this exists

R3 is YY's activation/receipt/behavior layer. It has four prerequisites:
1. R2.5 = DONE
2. R2 release readiness = ACCEPTED
3. C-R3 = FROZEN ← this draft
4. C6 = RESOLVED ← separate task, in flight

C6's verdict directly determines the receipt design. So the C-R3 draft must be split:
- **Now (this task)**: operations, schemas, non-receipt sections
- **After C6 verdict**: receipt state machine, verification rules

## Deliverable

`contracts/drafts/C-R3-activation.draft.md` — a partial draft with:
- All non-receipt sections complete
- Receipt section scaffolded with `[AWAITING C6 VERDICT]` markers

## Inputs (read before drafting)

```
test-reports/R1-baseline-20260911/
test-reports/R2.5-real-query-replay-20260912/
test-reports/R2.6-keyword-expansion-fixes-20260912/
contracts/drafts/C-R2-catalog.draft.md
plans/tasks/R2-acceptance-20260912.md
docs/yy-dev-plan-skill-loading-v3.md
```

## Required sections

1. **Scope and non-goals** — activation for R2's selected assets only; no new routing; no vector DB; no remote registry; additive fields only.

2. **Operations** — Read the dev plan. If it names operations, use those names. If it does not, mark each operation as `[待补充]` in the Open Questions section. Currently `activation.prepare` is confirmed at `docs/yy-dev-plan-skill-loading-v3.md:302`. Other operation names (e.g. `activation.deliver`, `activation.verify`) may not exist in the dev plan — verify before using.

3. **Schemas** — field-level definitions for activation records and delivery packages:
   - asset id, source hash, activation level (metadata / body / resource)
   - selected resources, delivered payload
   - token estimate per level
   - receipt reference (placeholder — finalized after C6)

4. **Activation levels** — define the three levels precisely:
   - metadata-only: name + description + phase eligibility, no body
   - body: metadata + `SKILL.md` content stripped of frontmatter
   - resource: body + explicitly requested resources from `reference/`

5. **Delivery package contract** — what replaces the current full-body brief in `prompt.mjs`:
   - which fields
   - token budget
   - truncation behavior
   - what's never included (all other assets' bodies, historical logs, full reports)

6. **Token estimate method** — use the R1 baseline CJK-weighted formula (CJK chars × 0.75 + other chars ÷ 4) as the estimation method, consistent with R1/R2 usage. If this method is not confirmed by the Owner, mark `[待补充 — Owner to confirm token estimation method]` and list it in Open Questions.

7. **Receipt contract** — `[AWAITING C6 VERDICT]` sections:
   - lifecycle states (placeholder)
   - verification rules (placeholder)
   - compatibility with `assetConsumed` boolean (placeholder)

8. **Compatibility and migration** — how R3 activates assets for existing R2-era projects; additive fields only. Legacy compatibility means: artifacts produced by a pre-R3 version of YY where `assetConsumed` was a plain boolean must be handled without breaking.

9. **Change control** — post-freeze change → discrepancy record + consumer re-acceptance.

10. **Open questions for Owner** — list every field where behavior is a judgement call. A field is a judgement call if:
    - it changes user-visible behavior
    - there is no obviously correct answer from R1/R2 baselines
    - reasonable engineers would disagree

    Technical implementation details constrained by the above should NOT be listed as judgement calls.

## Boundary

Allowed:
- write under `contracts/drafts/`
- read the inputs above
- read source read-only to ground the contract

Forbidden:
- modifying runtime source, vendor, prototype, SKILL.md, planning docs
- implementing activation
- inventing numbers (use `[待补充]` when unmeasured)
- finalizing the receipt section (that waits for C6)
- freezing or approving the draft

## Required second deliverable

`contracts/drafts/C-R3-review-checklist.md` — Owner scenario checklist with rows for:
- metadata-only activation (no body loaded)
- body activation (body stripped of frontmatter)
- resource activation (only requested resource)
- token budget exceeded (truncate or block?)
- missing body (blocked)
- invalid source hash (blocked)
- legacy `assetConsumed=true` artifact (pre-R3 artifact with plain boolean; the R3 layer must handle it without breaking)
- receipt-missing (subtask artifact exists but has no receipt field; the layer must degrade gracefully, not crash)

Each row: scenario, exact input, expected outcome, what would count as a defect.

## Completion report

```yaml
# C-R3 Framework Draft Report

snapshot: 240f3fb...
draftPath: contracts/drafts/C-R3-activation.draft.md
checklistPath: contracts/drafts/C-R3-review-checklist.md
draftSha256: ...
checklistSha256: ...
freezeState: DRAFT (partial, receipt pending C6)
runtimeFilesChanged: none
vendorAssetsChanged: none

deliverableHashes:
  C-R3-activation.draft.md: <sha256>
  C-R3-review-checklist.md: <sha256>

## Grounding check
| claim | grounded in | value |

## Receipt placeholders
- <list every [AWAITING C6 VERDICT] section>

## Owner decisions required
- <enumerated open questions>
```