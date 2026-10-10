# Host consumption receipt boundary — Option A

`scripts/host-consumption.mjs` is **LEGACY_V1_ONLY** (`yy/receipt@1`, version 1). Existing CLI arguments, response envelope, V1 append operations and legacy `execution_observed` / `behavior_verified` states remain compatible.

All success/failure responses declare `v2_receipt_written: false` and `c5_v2_complete: false`. V2 `APPLIED` and `VERIFIED` remain `DEFERRED_TO_C5`. This path has no asset-specific methodology verification satisfying `contracts/receipt-v2-contract.yaml`; it writes neither `methodology_applied` nor a V2 receipt.

## Execution and checker meaning

`execution_observation.state: EXECUTED` means the host exited successfully and produced a new or changed nonempty artifact whose source checks passed. It is auxiliary observation with `v2_receipt_state: false`, not a V2 T5 write. Earlier rejection, process failure, empty or unchanged output leaves it `UNOBSERVED`.

The separate checker supplies auxiliary `task_behavior` evidence. `PASSED` requires exit 0, a matching artifact hash, nonempty passing checks, and an unchanged artifact during checking. `FAILED` or `NOT_CHECKED` establishes no checker acceptance. The fields `auxiliary_only: true` and `v2_verification: false` remain explicit.

Legacy `behavior_verified` means V1 P1-P5 accepted that task behavior proof; it never means V2 T7 `VERIFIED`. A permissive checker can report `PASSED` while V1 anti-echo rejects copied or marker-only output. The response then fails with the original rejection code. Separate processes alone do not establish hidden evaluator filesystem isolation.

## Actual evidence boundary

The full mode/schema/version and non-V2 flags appear in response data, T5 execution evidence, and `host-verification.json`. The V1 writer normalizes terminal evidence; its retained `eventSeq: 5` proof reference carries those flags for both successful and anti-echo negative terminal events. Host-created events use session `host-consumption-cli:LEGACY_V1_ONLY`. Historical events and accepted receipt core semantics are not rewritten.

The unchanged `validateConsumption` reader rechecks legacy execution and task behavior as additive evidence. Its Decision Packet still reports T5/T6/T7 `DEFERRED_TO_C5`; a receipt label alone is not current artifact proof.

Explicitly non-V1 schema/version labels are rejected before host/checker execution with `HOST_RECEIPT_VERSION_UNSUPPORTED`. Historical unlabelled V1 receipts remain readable.

## Callable seam and regression

`runHostConsumption(argv)` and `HOST_RECEIPT_BOUNDARY` are exported. The function returns `{ok, code, data, evidence, warnings}`. Import has no CLI side effects; direct CLI, `--help` and failure exit status remain supported. The caller owns Decision presentation/admission; this module does not implement C4.

From the stage root:

```powershell
node --test scripts/test-host-consumption.mjs
```

Fresh result on 2026-10-04: **20 passed, 0 failed, 20.711 s** (Node v24.18.0). Tests use real local host/checker processes and verify positive/negative non-V2 boundaries, deferred Decision projection, tamper rejection and import behavior. No models or network calls. Full execution evidence and source hashes are kept in the consolidated reconciliation report.
