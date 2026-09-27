# REOPEN-FIX-1 — capability-aware OpenAPI contract routing

Run stamp: `20260927T171036` (Asia/Shanghai)
Base revision: `b53e9208cb7dc3639e654b90ac287da65946ea8b`
Production route fix and regression are included in the tested working tree; the final closeout commit records this same tree.

## Command and result

```powershell
node scripts/test-contract-routing.mjs --evidence-dir test-reports/autopilot-work/E2E-v3-contract-route-20260927T171036
```

Exit code: **0**. All five real CLI cases passed. The runner records each exact argv array and exit code in `assertions.json`, writes each CLI log as `<case>-cli.log`, and keeps the production workspace, `.tt-state/state.json`, adapter artifacts, and journey projections under this run directory.

On Windows, the regression child process sets `PYTHONUTF8=1` so the installed Semgrep can read its UTF-8 ruleset under the host's GBK Python locale. The real Semgrep 1.175.0 adapter still ran and its result artifact was read.

## Case results

| Case | State | Actual adapter result | Assertions |
|---|---|---|---|
| Legacy planned `be-validator` + valid `--contract` | exit 0, `done`; no capability override | Spectral 6.16.3, `mode=exec`, `pass=true`, `degraded=false`; scope names the supplied OpenAPI fixture | 3/3 passed |
| Non-validator T2 plan + `--capability openapi-validation` + valid `--contract` | exit 0, `done`; final selected asset is `be-validator` | Two real Spectral results, both `mode=exec`, `pass=true`, `degraded=false`; both scopes name the supplied OpenAPI fixture | 3/3 passed |
| T5 `security-audit` + valid OpenAPI `--contract` | exit 0, `done`; all four tasks ran as security | Four real Semgrep 1.175.0 results, `mode=exec`, `pass=true`, `degraded=false`; scope is the isolated workspace. The OpenAPI file is absent from security task contract paths and Semgrep results. | 3/3 passed |
| Non-OpenAPI JSON + OpenAPI capability | exit 0, `done` | Two real Spectral adapter results preserve `pass=null`, `degraded=true`, with no execution mode or real-scan scope | 2/2 passed |
| `--contract-draft` | exit 0, `done`; `brownfieldDraft=true`, contract path preserved | Spectral adapter preserves draft behavior: `draft=true`, `pass=null`, `degraded=true`, without real validation | 3/3 passed |

Total: **14/14 assertions passed**. Each case's complete state summary, journey projection, adapter result fields (`tool`, `mode`, `pass`, `degraded`, `scope` where applicable), and assertion detail is in its `<case>-evidence.json`; standalone journey projections are also saved as `<case>-journey-projection.json`. Actual state and adapter artifacts remain in `workspaces/<case>/`.

## Final gates

| Gate | Command | Result |
|---|---|---|
| Regression | `node scripts/regression-all.mjs` (Git Bash first in `PATH`; `PYTHONUTF8=1` for local Windows Semgrep) | exit 0 — 36 PASS / 0 FAIL |
| Preflight | `node scripts/preflight.mjs --owner reopen-fix1` | exit 0 — 8 PASS / 0 FAIL |
| Structure validation | `node scripts/validate-structure.mjs` | exit 0 — 0 warnings |
| Audit-index self-test | `node plans/audit-index-selftest.mjs` (Git Bash first in `PATH`) | exit 0 — 68 PASS / 0 FAIL |

The existing regression S15-A3 performed its manifest consistency probe; the tracked manifest hash remained `b02687984d6b0d0e95b2b5a4d9e4397a6eccd9fe66ce41da991fb6e261d93c11`. No standalone manifest rebuild was run.

## Disposition

**F-E2E-3 = CLOSED FOR CURRENT HEAD.** This run-stamped report **supersedes historical F-E2E-3 evidence** in `test-reports/autopilot-work/E2E-v3/RESULTS.md`; the historical report is preserved unchanged.

The verified production change uses `CAPABILITY_MAP` as the existing capability-to-asset authority after contract freeze. Legacy tasks still route by their planned asset; non-validator capabilities do not receive an OpenAPI contract; `--contract-draft` behavior remains unchanged. No manifest was changed or rebuilt.
