---
name: sdlc
description: BMAD-METHOD phase orchestration with cline plan and exec execution
version: 2.1.0
---

# SDLC BMAD plus cline
BMAD-METHOD is the methodology layer. cline is the execution layer.

PHASES = plan, develop, review, summarize.
plan: requirements to plan; develop: plan to code; review: artifacts to findings; summarize: findings to stage summary.
The four phases map to the four phase docs; the six existing agents remain: control, developer, peer, sprint, summary, supervisor.

## Execution kernel (cline)
Kernel: cline via scripts/lib/adapters/bmad-cline.mjs.

- **Invocation**: the adapter probes `cline --version`; when available it writes per-phase docs (phase-plan/develop/review/summarize.md) then spawns `cline <task>` directly, capturing output. Exact plan/exec flags follow installed `cline --help`. (The `--exec` host channel belongs to the prompt backend, not this adapter.)
- **Degradation**: cline unavailable → planned-only phase docs (mode `planned-only`, honest, not fake success); in `--backend cli` mode → skipped (`SDLC_NOT_AVAILABLE`). Timeout returns TIMEOUT.

See reference/bmad-phases.md and reference/cline-exec.md.

## Phase 2 baseline (per ITERATION_PLAN)
Execution kernel aligned to BMAD-METHOD (~49.5k★) + cline (~63.7k★). Regression gate: `scripts/regression-all.mjs` S3 keeps the `cline`/`BMAD` markers; update `PHASE2` there if the kernel changes.
