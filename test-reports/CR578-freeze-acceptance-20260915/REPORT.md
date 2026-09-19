# C-R5-journey / C-R7-change-loop / C-R8-remediation — Freeze Acceptance Report (2026-09-15)

acceptancePerformedBy: orchestrator (Owner-authorized division)
snapshot: 240f3fbdb4ee757dffc4d5ab80407d1b2c84863c
ownerAuthority: 2026-09-15, OQ all = A (R5-1…10, R7-1…7, R8-1…7), freeze authorization explicit.

## Hashes (orchestrator-recomputed, raw disk)

Frozen contracts:
- contracts/C-R5-journey.md = 48b7c37982f71aea8e372e216a309798af724aa8cb08e2d26402ad76430d769a
- contracts/C-R5-journey-review-checklist.md = df6005a445ffe9a88fbe40d242e9744e4e726cb77a29a1854ba01323fd0c112e
- contracts/C-R7-change-loop.md = ea84b4e5358a2458fec0b95b43517c949a070e726be0f81a86d4eaa32c0752cf
- contracts/C-R7-change-loop-review-checklist.md = 35d197f029636fb9a62ce29f2e5dd67fcbb973784b99950d0dcb1ca2dec22e9c
- contracts/C-R8-remediation.md = d9d33d488a0731edbe699c1fb68dc5d67151870c1a319ceb31473fe6ef4ef2c1
- contracts/C-R8-review-checklist.md = a8cb1be1d6996cb7bd4650d9d185718cd51eb631e512186eeead35e9111e06e9

Freeze records:
- plans/tasks/C-R5-freeze-20260915.md = 875b12882f4ef40143480b5f8932ebb5b0fd0d5dfa2afe5624f7a977b7417b44
- plans/tasks/C-R7-freeze-20260915.md = d81f5377e7a5adaf4da96c36ba188fbc8662aba31f8eb4c8836f85302ef268c9
- plans/tasks/C-R8-freeze-20260915.md = 483296bc719c24aef520885817578e7337fd6e23f41cc231a03ffe0ed108c266

Revised drafts (FROZEN-SOURCE retained): R5 74368bea…/65d525f3…; R7 4a618704…/00aaa9ca…; R8 3ba69d49…/5a392985… — all match agent reports.

## Checks

1. Frozen inputs unchanged: C-R4-control 19055ff7…, C-R3-activation cfb07784…, G2.2 d48f1fba…, PRD0 a7cbc5df…, HEAD 240f3fbd ✅
2. Rulings absorbed into normative body, not appendix-only: [Owner 决断 OQ-…=A，2026-09-15] markers present; OQ indexes OPEN→DECIDED (10/7/7) ✅
3. No invented operations/codes: R5 journey.read/project + 5 codes; R7 change.record + 3 codes (DUPLICATE_REPLAY explicitly a warnings item, not a code); R8 remediation.register + 3 codes ✅
4. Residual [待补充]: only the legend definition text plus R5's one declared non-OQ residual (JOURNEY_NOT_FOUND data/error channel, explicitly assigned to R5a implementation per C-R4 precedent) — no unresolved ruling value ✅
5. R8 §4.2 C1–C7 mapping: C5 row honestly marks "post-fix original-probe regression [待确认/未执行], must not be written as closed"; C2 retained UNRESOLVED ✅
6. Checklist Owner columns blank: R8 actual file contracts/C-R8-review-checklist.md — 6 rows, 0 non-blank owner cells; R5/R7 same discipline ✅
7. Self-claims: no runtime-fixed assertions; drafts-never-unlock retained on frozen headers ✅

## Naming deviation (non-blocking, requires Owner disposition)

C-R8 frozen checklist path is contracts/C-R8-review-checklist.md, while R5/R7 use the full suffix pattern contracts/C-R<name>-review-checklist.md. The frozen contract body and freeze record both reference the actual R8 path consistently and the hash matches, so the artifact is internally coherent. The deviation is a naming-convention inconsistency only. Options: (a) accept as-is (R8 canonical name); (b) rename to contracts/C-R8-remediation-review-checklist.md with a discrepancy note and re-hash. Recommendation: (a) accept — renaming a frozen artifact introduces more audit churn than the cosmetic mismatch warrants; record the convention exception here.

## Verdicts

- C-R5-journey: FROZEN accepted
- C-R7-change-loop: FROZEN accepted
- C-R8-remediation: FROZEN accepted (subject to Owner disposition of naming option a/b)

READY consequence (PRD0 §5.5, unchanged formulas): R5a READY := R4 DONE ✓ + C-R5-journey FROZEN ✓ → READY; R7 READY := R4 DONE ✓ + C-R7 FROZEN ✓ → READY; R8 READY := R4 DONE ✓ + C-R8 FROZEN ✓ → READY.