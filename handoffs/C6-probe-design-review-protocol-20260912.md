# C6 Probe Design — Orchestrator Review Protocol

## Your Role

You are the orchestrator. This task is NOT to design the probe and NOT to 
execute it. Your job is to:

1. Review the design agent's deliverables against the handoff requirements.
2. Check internal consistency (DESIGN.md ↔ probe.mjs).
3. Verify that mechanically checkable claims are actually checkable.
4. Decide PASS or FAIL.
5. If PASS: generate an execution handoff for a separate execution agent.
6. If FAIL: generate a specific return-to-design report.

You must NOT design the probe, modify it, or run it. If you find yourself 
wanting to "fix" the design, that means the design FAILED and needs to go back.

## Inputs

- Handoff prompt that was given to the design agent (the C6 Probe Design Handoff).
- `test-reports/C6-design-<date>/DESIGN.md`
- `test-reports/C6-design-<date>/probe.mjs`
- The C6 finding text in `plans/tasks/PRD0-skill-loading-critique.md` 
  (search for `### C6 —`)
- `scripts/lib/adapters/prompt.mjs` (source, for line-number verification only — do NOT modify)

## Review Checklist

For each item, produce one of: PASS / FAIL / UNVERIFIABLE.
If UNVERIFIABLE, state why (missing input, ambiguous claim, etc.).

### A. Handoff Compliance (structural)

- A1. `DESIGN.md` exists at the expected path.
- A2. `probe.mjs` exists at the expected path.
- A3. `DESIGN.md` reports `runtimeFilesChanged: none` and it is true 
       (verify with `git diff HEAD -- scripts/` → empty).
- A4. `DESIGN.md` reports `vendorAssetsChanged: none` and it is true 
       (verify with `git diff HEAD -- vendor/` → empty).
- A5. Both files have SHA256 hashes reported in the completion report.
- A6. `probe.mjs` lives OUTSIDE the repository 
       (verify path; must not be under the git worktree).

### B. DESIGN.md Content

- B1. §1 states in the design agent's own words what behavior would 
       prove C6 REPRODUCED and what would prove NOT REPRODUCED.
- B2. §1 reports that the design agent read `prompt.mjs` FIRST, then 
       defined the copier (not the reverse order).
- B3. §1 reports the exact line numbers of the `assetConsumed` 
       computation. Cross-check: those line numbers exist in `prompt.mjs` 
       and contain the described logic.
- B4. §2 defines the trivial copier with exact artifact contents, not 
       vague descriptions like "some tokens".
- B5. §3 quotes the adapter logic verbatim (not paraphrased). 
       Verify by comparing to actual source.
- B6. §4 states the exact check: `assetConsumed === true` → REPRODUCED, 
       `false` → NOT REPRODUCED.
- B7. §5 covers at minimum:
       - title-only case split by asset type (WITH kernel section vs WITHOUT), OR
       - a single title-only case marked as "partial evidence"
- B8. §5 explicitly names which case is "the C6 reproduction" 
       (should be "title + kernel word").
- B9. §6 lists at least 6 determinism risks, each with a mitigation.
       Missing mitigations → FAIL this item.
- B10. §7 specifies: input env vars, output JSON schema, exit code 
        semantics, files read, files written.
- B11. §8 reads the C6 finding and states the design agent's own 
        interpretation, including any mismatch with source code 
        (which should trigger "STOP and report" if present).

### C. probe.mjs Content

- C1. Uses `SNAPSHOT_ROOT` env var (verify by grep).
- C2. No shell escaping required (no inline regex with `\\`, no `node -e`).
- C3. Fully implemented — grep for `TODO`, `FIXME`, `XXX`, `stub`, 
       `throw new Error("not implemented")`. Any hits → FAIL.
- C4. Does NOT contain a `verdict` field, `result` field, or any 
       boolean like `reproduced: true/false`. Grep for `verdict`, 
       `reproduced`, `PASS`, `FAIL` in output-producing code.
       Presence → FAIL (this is the boundary).
- C5. Handles all §5 boundary cases (verify case list matches).
- C6. Output JSON schema matches §7.

### D. Consistency

- D1. Every case in DESIGN.md §5 has a corresponding code path in 
       `probe.mjs`.
- D2. No contradictions between DESIGN.md and probe.mjs 
       (e.g. different artifact paths, different env var names).
- D3. If DESIGN.md reports a "STOP and report" trigger, probe.mjs 
       reflects it (either by raising or by explicit TODO marker 
       — but NOT by silently continuing).

### E. Failure Modes

- E1. Did the design agent report a mismatch between C6's description 
       and actual source code? If yes, was it flagged (not glossed over)?
- E2. Does probe.mjs have any undeclared dependency 
       (network, external CLI, package not in `package.json`)?
       Any such dependency → FAIL.

## Decision Rule

**PASS** requires:
- All A-items PASS
- All B-items PASS (B9 has a hard minimum of 6 risks with mitigations)
- All C-items PASS (C3 and C4 are hard gates)
- All D-items PASS
- E1 and E2 report no unresolved conflicts

**FAIL** if any of the above fails. Partial PASS is not allowed — 
C6's correctness depends on all boundary cases being covered.

**UNVERIFIABLE** items must be resolved before PASS — either by 
requesting a clarification from the design agent or by running a 
local check (e.g. re-reading `prompt.mjs` to confirm line numbers).

## Output — If PASS

Produce an execution handoff file:

```
test-reports/C6-execution-<date>/HANDOFF.md
```

Containing:
- Path to DESIGN.md and probe.mjs
- Expected SHA256 of each (from the design agent's completion report)
- Execution protocol:
  1. Hash both files; confirm match.
  2. Set `SNAPSHOT_ROOT` to a clean detached worktree at the frozen commit.
  3. Run `node <probe-path>`. Record exit code + stdout + stderr.
  4. Run the same probe from a SECOND clean worktree.
  5. Compare byte-for-byte; if not identical → UNRESOLVED.
  6. Write raw output under `test-reports/C6-execution-<date>/raw/`.
  7. Produce a verdict table (per boundary case: input / observed 
     assetConsumed / REPRODUCED-or-NOT).
- Boundary: no runtime modification, no vendor modification, do not 
  edit probe.mjs.

## Output — If FAIL

Produce a return-to-design report:

```
test-reports/C6-design-<date>/RETURN-<date>.md
```

Containing:
- List of FAIL items with exact evidence (which line in DESIGN.md or probe.mjs)
- For each FAIL: what the design agent needs to change
- Whether a full re-design is required or a targeted patch suffices
- Do NOT redesign the probe yourself. Only specify what is missing 
  or contradictory.

## Orchestrator Report

Also produce a one-page summary for the Owner:

```
test-reports/C6-design-<date>/ORCHESTRATOR-REVIEW.md
```

Containing:
- Decision: PASS / FAIL
- Per-section verdict (A/B/C/D/E): counts of PASS/FAIL/UNVERIFIABLE
- Top 3 concerns (if any)
- Next action: "dispatch execution" or "return to design agent"

## Snapshot

Repository: D:/.ai-hub/skills/yy
Commit:     240f3fbdb4ee757dffc4d5ab80407d1b2c84863c

Do not modify any runtime source. Do not modify the design or probe. 
Your output is the review + the next handoff (or the return report).