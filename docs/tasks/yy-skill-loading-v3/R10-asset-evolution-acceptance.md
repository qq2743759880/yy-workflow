# R10 — Skill Asset Evolution and Independent-Context Acceptance

Status: `BLOCKED until R3/R4/R8 and G2.1/G2.2`; owner confirmation required.

## Boundary

Convert asset consumption, routing, token, behavior, and critique evidence into versioned candidates. Test candidates with baseline-first pressure scenarios in a fresh isolated context, then promote or reject with a reversible receipt.

The default acceptance mechanism is a platform-native independent context/subagent when available. If unavailable, use a separate execution session and identity, record the limitation, and keep the candidate provisional.

Non-goals: changing the 16 assets directly from a metric threshold, allowing the producer to accept its own candidate, or adding a remote model/evaluation platform for MVP.

## Exact files and artifacts

- all 16 built-in asset roots under `vendor/`
- `reference/memory-and-sync.md`
- `reference/planning.md`, `reference/dispatch-and-acceptance.md`
- `scripts/asset-call-rate.mjs`, `scripts/review-gate.mjs`, `scripts/validate-structure.mjs`
- `evidence/evolution/`, version/index records, and `CHANGELOG.md`

## Dependencies

Contract dependency: R3 activation/receipt/behavior evidence; R4 session and receipt authority; R8 accepted finding/remediation mapping.

Completion dependency: R6 migration/release verification.

## Freeze order

1. Candidate schema and source version.
2. Evidence threshold and regression dimensions.
3. Fresh isolated-context profile and evidence-only brief.
4. Pressure scenarios and baseline protocol.
5. Independent verdict and promotion/rollback policy.

## GWT acceptance

### GWT-R10-01 — candidate traceability

Given asset consumption, behavior, token, or critique evidence, when a candidate is created, then it records source version/hash, trigger, target symptom, expected benefit, risks, and rollback reference.

### GWT-R10-02 — baseline before intervention

Given positive, near-miss negative, mixed-intent, and typo scenarios, when evaluation begins, then the baseline runs without the candidate and records route, activation, token, receipt, and behavior results first.

### GWT-R10-03 — isolated acceptance

Given a candidate, when a fresh independent context runs repeated pressure tests, then the verifier receives only the task brief, source anchor, commands, inputs, and expected observations—not the producer’s conclusion—and records session/agent identity.

### GWT-R10-04 — platform fallback honesty

Given no platform-native independent context is available, when fallback is used, then the report names the limitation, uses a separate execution session/identity, and candidate status remains `PROVISIONAL` until accepted.

### GWT-R10-05 — promotion and rollback

Given a candidate regression or failed verification, when promotion is attempted, then promotion is denied or rolled back, the last accepted asset remains active, and evidence is retained.

### GWT-R10-06 — 16-asset closure

Given the full asset matrix, when evolution review completes, then every asset has an explicit `UNCHANGED`, `CANDIDATE`, `PROMOTED`, `REJECTED`, or `UNRESOLVED` state; aggregate percentages cannot hide missing rows.

## Selection basis

Reuse the existing assets, receipts, tracker, and CHANGELOG. Apply F-C10 Superpowers `writing-skills` RED/GREEN/REFACTOR and fresh-context pressure testing. Prefer standard-library version records and existing host adapters over a new evaluator service.

## Evidence and rollback

Required: candidate record, baseline results, isolated-context transcript/evidence refs, verdict, promotion receipt, and rollback rehearsal. A candidate without independent evidence cannot update the catalog or become the active asset.

