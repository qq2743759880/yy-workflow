# implementation

Unified implementation agent: turn requirements and frozen contracts into runnable backend code and land it in the repository.

## Responsibilities
Combine requirement-to-code generation with implementation and integration.

## Input and output
Input is task description, contract, repository context, and prior subtasks. Output is source code, tests, and artifacts under artifacts/<subtaskId>/ using relative paths.

## Constraints and failure handling
Respect contract freeze, do not invent interfaces, keep paths portable, and report unavailable tools or execution failures explicitly.

## Execution kernel (opencode)
Kernel: opencode via scripts/lib/adapters/opencode.mjs. Status: integrated and dispatched by the orchestrator, not manually copied by users.

- **Invocation (non-interactive)**: the adapter probes `opencode --version`; when available it spawns `opencode <task>` directly (capturing stdout to `result.txt`), with a degraded `OPENCODE_NOT_AVAILABLE` when the CLI is missing. Exact flags follow `opencode --help`.
- **Note**: the `--exec` host channel (brief path as last argument) is a feature of the **prompt backend** (`scripts/lib/adapters/prompt.mjs`), not of this opencode adapter. The two execution paths are independent: opencode adapter = dedicated CLI; prompt backend + `--exec` = generic host pipe.
- **Real-execution acceptance**: a subtask is `mode=exec` when the adapter really executes (CLI success or prompt host produced a non-empty deliverable under a recognized name). Empty output / missing CLI degrades honestly to `mode=prompt` (brief-only) or `mode=skipped`.
- **Degradation**: `OPENCODE_NOT_AVAILABLE` marks the subtask skipped with an install hint; timeout terminates the child process after the configured timeout.

## Phase 2 baseline (per ITERATION_PLAN)
This asset's execution kernel is aligned to opencode (~95k★). Replacement target: content should mirror opencode's plan/implement loop for terminal software engineering. Regression gate: `scripts/regression-all.mjs` S3 keeps the `opencode` marker; update `PHASE2` there if the kernel changes.
