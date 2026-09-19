# C6 Probe Design Handoff

## Role

You are an independent design agent. Your task is NOT to execute the C6 probe — it is to design it, and produce a file-based, escape-stable probe that a *separate* execution agent will later run.

You do not repair C6. You do not change finding statuses. You do not modify any runtime source.

If you cannot complete the design because of conflicting information, STOP and report. Do not modify the design to fit the issue.

## Pre-dispatch check (do this BEFORE designing)

Before you begin, verify all three:

1. This handoff's Section 1 does NOT assert fixed line numbers — it gives an 
   expected structure, and asks you to report what you actually find.
2. This handoff's Section 5 minimum-required table has FOUR rows, not three, 
   and its "proves what" column has NO single-value conclusion.
3. This handoff's Completion Report says the deliverableHashes are 
   self-attested, not verified.

If any of the above is false, STOP and report the mismatch. Do not proceed 
with a defective handoff.

## Why this exists

C6 (G2.1 Critical, currently UNRESOLVED) claims:

> the executor tells the model exactly which title/kernel tokens to repeat, 
> then the verifier treats their presence as consumption. A trivial copier 
> passes.

C6 is a release-blocking finding for R3. Until C6 has a stable reproduction, 
R3's activation/receipt design cannot be finalized.

A prior finding, C2, was UNRESOLVED because its frozen command was published 
as an inline `node -e "..."` one-liner with shell-escape-dependent behavior. 
C2 was eventually reproduced using a file-based probe with zero shell escaping.

C6 is NOT the same as C2. C2 required one function call. C6 requires:
- a simulated "trivial copier" process
- a specific artifact that echoes only asset title / kernel tokens
- passing that artifact through the prompt adapter's `assetConsumed` check
- observing whether the adapter marks the subtask `assetConsumed: true`

So C6 cannot be reproduced by simply "file-izing a command". It requires a 
design step first.

## Deliverable

Produce two files:

1. `test-reports/C6-design-<date>/DESIGN.md` — a design document specifying:
   - The exact definition of "trivial copier" (which tokens it echoes, in 
     what format, in what file)
   - The exact adapter path being probed (`scripts/lib/adapters/prompt.mjs` 
     and its `assetConsumed` computation)
   - The exact check that determines REPRODUCED vs NOT REPRODUCED
   - Boundary cases to cover
   - Determinism risks

2. `test-reports/C6-design-<date>/probe.mjs` — a fully implemented probe 
   script (no TODO stubs, no placeholders) that a *separate* execution agent 
   will run. It must NOT include a result or verdict field — the execution 
   agent produces the verdict, not you. Your output is the probe definition, 
   not the probe outcome.

## Boundary

Allowed:
- write files under `test-reports/C6-design-<date>/`
- read `scripts/lib/adapters/prompt.mjs`, `scripts/exec-host-generic.mjs`, 
  `scripts/regression-all.mjs` (S8 section)
- read the R1 baseline at `test-reports/R1-baseline-20260911/`
- read the C6 finding in `plans/tasks/PRD0-skill-loading-critique.md` 
  (search for `### C6 —`)

Forbidden:
- modifying any runtime source, vendor asset, or prototype
- changing C6's status
- running the probe yourself
- copying the probe into the repository

## Snapshot

Repository: D:/.ai-hub/skills/yy
Commit:     240f3fbdb4ee757dffc4d5ab80407d1b2c84863c

## Required design sections

### 1. Read the adapter source FIRST, then define the trivial copier

**Do NOT define the trivial copier before reading the source code.**

Read `scripts/lib/adapters/prompt.mjs` and identify the `assetConsumed` 
computation. Expected structure (line numbers approximate; report what you 
actually find):

- an anchor check: `lower.includes(anchorLower)`
- kernel token extraction from the `## Execution kernel` section's `Kernel:` 
  line (backtick or bare ASCII tokens, ≥3 chars, filtered stopwords)
- initialization of `assetConsumed` to `false`
- a conditional: if `hasKernelSection && kernelTokens.length > 0`, 
  `assetConsumed = anchor && kernel.some(...)`; else `assetConsumed = anchor`
- a `hasRealOutput` gate that may further restrict the final value

Report the exact line numbers you observe. If they differ from this 
expectation, note the difference but continue. If the LOGIC itself differs 
from C6's description, STOP and report the mismatch.

Then define the trivial copier based on what the adapter actually checks:

- A trivial copier artifact that echoes the asset name (`anchor`) AND at 
  least one kernel token will pass the kernel-path check
- A trivial copier artifact that echoes only the anchor (for assets without 
  a kernel section) will pass the non-kernel path check

### 2. The trivial copier

Define a minimal "fake" artifact that:
- contains only the asset name (anchor) and at least one kernel token, with 
  no methodological content
- would pass the adapter's `assetConsumed` check
- would fail any "structured behavior" check

Give the artifact's exact contents for each boundary case below.

### 3. The adapter path

Report the current logic from `scripts/lib/adapters/prompt.mjs` (do not 
change it). Include:
- the anchor check
- the kernel token extraction regex
- the `assetConsumed` computation (kernel path vs non-kernel path)
- the `hasRealOutput` gate

Quote the actual code, not a paraphrase.

### 4. The check

State the exact condition the probe evaluates:
- if `assetConsumed === true` for the fake artifact → REPRODUCED
- if `false` → NOT REPRODUCED

### 5. Boundary cases

Minimum required (all four must be designed):

| case | artifact content | expected adapter behavior | proves what |
|---|---|---|---|
| title only (asset WITH kernel section) | echoes asset name, no kernel token | `assetConsumed=false` | anchor alone is insufficient when a kernel section exists |
| title only (asset WITHOUT kernel section) | echoes asset name, no kernel token | `assetConsumed=true` | anchor alone is sufficient for non-kernel assets |
| title + kernel word | echoes asset name + ≥1 kernel token | `assetConsumed=true` | the C6 reproduction |
| unrelated prose | generic text, no title/kernel | `assetConsumed=false` | control group |

Nice-to-have (design if time allows):

| case | artifact content | expected adapter behavior |
|---|---|---|
| one kernel word only (no title) | kernel token but no asset name | `assetConsumed=false` (anchor check fails) |
| full fake "methodology" | repeats title+kernel 5×, padded with plausible text | `assetConsumed=true` (proves repetition doesn't help) |
| empty output | empty file or whitespace only | `assetConsumed=false` (hasRealOutput fails) |

### 6. Determinism risks

List everything that could make the probe non-deterministic across two runs. 
Specific examples:

- worktree path appearing in output
- timestamp fields in the adapter output
- manifest cache state (first run vs second run)
- filesystem iteration order
- Node version differences affecting regex behavior
- `generatedAt` field in manifest output

For each risk, state the mitigation (e.g. "strip timestamps from output 
before comparison"). Minimum: 6 risks, each with a mitigation.

### 7. Probe script contract

Specify:
- Input env vars: `SNAPSHOT_ROOT` (path to clean worktree)
- Output JSON schema: `{ results: [{case, input, adapterResponse, 
  expected}], timestamp }` — the execution agent fills `match`/verdict
- Exit code semantics: 0 = probe ran, 1 = probe error
- Files it reads: `scripts/lib/adapters/prompt.mjs` (imported), 
  `vendor/<asset>/SKILL.md` (kernel extraction source)
- Files it writes: temp workspace artifacts only

### 8. C6 finding reference

Read the C6 finding in `plans/tasks/PRD0-skill-loading-critique.md` 
(search for `### C6 —`). State in your own words what specific behavior 
would prove C6 REPRODUCED, and what would prove it NOT REPRODUCED.

## Completion report

```
# C6 Probe Design Report

snapshot: 240f3fb...
designPath: test-reports/C6-design-<date>/DESIGN.md
probePath: test-reports/C6-design-<date>/probe.mjs
runtimeFilesChanged: none
vendorAssetsChanged: none

deliverableHashes:
  DESIGN.md: <sha256>      # self-attested; orchestrator will re-hash
  probe.mjs: <sha256>      # self-attested; orchestrator will re-hash

## Design summary
<3-5 sentences>

## Boundary cases defined
<list all minimum-required + any nice-to-have>

## Determinism risks identified
<list of >=6 risks, each with mitigation>

## Handoff notes for execution agent
<what the execution agent must do, and what would invalidate the design>
```

## Execution note (not for you, but to include in your handoff)

The execution agent will be instructed to:
1. Hash `DESIGN.md` and `probe.mjs`; confirm they match this report.
2. If hashes mismatch → STOP, report to orchestrator; do not run.

The orchestrator will verify the design against the C6 Probe Design Review 
Protocol before dispatching execution. Your design does not unlock R3 by 
itself — the execution verdict does.