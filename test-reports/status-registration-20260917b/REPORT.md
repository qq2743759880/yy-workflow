# Status Registration Report — 2026-09-17b (Owner 产品方向：16 资产修改空间预留)

task: status-only registration — Owner product direction (2026-09-17): 16 assets retain large optimization headroom; reserve the modification channel
snapshot: 240f3fbdb4ee757dffc4d5ab80407d1b2c84863c (HEAD unchanged)

## Owner direction (verbatim basis)

> 16资产仍然有极大优化空间,需要为后续大概这16个资产预留修改空间

## Reservation audit (where the channel already exists)

| surface | status |
|---|---|
| R10 evolution machinery (DONE 2026-09-17) | versioned candidates `evidence/evolution/<assetId>/<candidateId>/{candidate,baseline,promotion}` append-only; two ops / six codes; 12/12 fixtures |
| catalog repoint gating | catalog updates only after promotion receipt (C-R10 §6.2; implementation signs receipts, never writes catalog directly) |
| anti-direct-edit invariant | C-R10 §1.2 non-goal: no metric-threshold direct edits to the 16 asset bodies; producer self-acceptance forbidden |
| version/index records | `CHANGELOG.md` (R10 doc exact files) — already append-used by R10 implementation |
| optimization backlog sources | R1 measurements (overfetch 30, 5,772,608 B total), C7 critique, R8 accepted findings → candidate triggers (C-R10 §7 consumption) |
| fail-closed throttle | OQ-R10-3 threshold numbers `[待补充]` — no promotion can auto-pass until Owner supplies numbers |

## Registration (status-only, DOC_ONLY)

| file | before | after | edit |
|---|---|---|---|
| `plans/tasks/PRD0-contract-revision-v3.md` | `3c13ed0f…` | `24c82403f8740f5fdc02c2404aa0c84409394cefd833c939e80fe51fc4b974f5` | §1.2 block +1 line: Owner direction — sole sanctioned channel = R10 candidate → independent acceptance → promotion receipt → catalog update; direct vendor/ edits outside the channel forbidden; R6 migration must preserve the channel |
| `plans/tasks/G2.2-task-graph-20260911.md` | `240c9c04…` | `1845210ff3fd6c21c6fc2500e8eb4f1ddac0224570ce378e7445d8d93a28a2e7` | R10 node +1 line (channel is the sole sanctioned modification path); R6 node +1 line (MW0-MW4 must preserve the R10 channel; no new immutable asset form bypassing R10) |

## Classification rationale

DOC_ONLY: no READY formula, task definition, contract semantics, or frozen-file change; direction is additive and already embodied by the frozen C-R10 design. C-R7 change.record not required (no frozen-contract invalidation); recorded here and in PRD0 §1.2 instead, per Owner-direct-statement pattern.

## Open items carried

- OQ-R10-3 threshold numbers `[待补充]` — Owner supplies when the first optimization candidates are proposed.
- Optimization backlog concrete list (which of the 16 assets, what symptoms) — to be sourced from R1/C7/R8 evidence when Owner starts the optimization round.
- C-R5-ui freeze decision still pending Owner (revised draft `38fcbfa8…` verified 2026-09-17).