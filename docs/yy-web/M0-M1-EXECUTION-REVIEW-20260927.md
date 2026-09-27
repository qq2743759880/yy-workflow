# YY Web/Codex M0–M1 execution review — 2026-09-27

## Decision

**M0/M1 engineering: CLOSED on the pushed source branch. Main integration: blocked because the current local main has unexplained dirty files whose writer cannot be identified. Web activation: `WEB_ACTIVATION_ENVIRONMENT_BLOCKED`. M2/M3: `DEFERRED_BY_PHASE`.**

The implementation commit `c75d9154c722e2f5394d7e6e701baaffcf468a35` and evidence follow-up `6a0581b2599880842cf987e89e9b54e405f89550` are pushed to origin, based on `f88a193299d6939850befda8a21c8248e6285627`. Integration was checked in a separate clean worktree fast-forwarded from `origin/main=f88a193` to release commit `9706e7a`; exact diff contains only release-owned paths. The original local main has modified `scripts/make-release.mjs` and untracked CODEX/MYY-X1/PRD documents; those remain untouched and excluded. Fifteen P1 tests plus the CLOSED workflow read smoke passed. A normal fast-forward push to remote main is ready, subject to one final unchanged-SHA check. No production Web caller identity, principal-to-workflow ACL, authorized W binding, or tunnel was established; therefore this is not `WEB READONLY ACTIVE`.

## Fast ground truth and local evidence

- Real implementation entrypoints: `integrations/yy-readonly-mcp/server.py` and `integrations/yy-readonly-mcp/bridge.mjs`.
- Allowlist: `yy_open_workflow`, `yy_get_snapshot`, `yy_get_stage`, `yy_list_assets`, `yy_read_asset`, `yy_read_evidence`.
- The 15-test local suite imports/calls the actual server and bridge. Workspaces and RF1 report files are synthetic fixtures; these tests do not establish production W authorization or ChatGPT Web execution.
- The tested read path applies bounded reads, fails closed on oversized protected content, reports incompleteness/cursors explicitly, and binds pagination cursors to source/version state. No contradictory `file.truncated=true` plus complete response was found. `INCOMPLETE`/`STALE_CURSOR` are not literal wire error codes; actual partial/stale behavior is explicit (`complete=false`/omissions and `STALE_VERSION`). This contract vocabulary mismatch is P2.
- RF1 Spectral was not rerun. A new local test reads copies of the historical and superseding report via `yy_open_workflow` and `yy_read_evidence`. It asserts F-E2E-3 is historical/superseded, current status is CLOSED, valid OpenAPI is `pass=true`/`degraded=false`, and non-OpenAPI plus contract-draft remain `pass=null`/`degraded=true`. Production W/Web interpretation remains NOT ESTABLISHED.
- Old YY compatibility smoke: in a temporary workspace, the legacy orchestrator accepted the known backend task example, generated `.tt-state/state.json` and `artifacts/<planId>/state-summary.json`, and legacy `summary-read --latest` returned the expected schema, plan ID, and status. The prompt backend was degraded (2 done, 3 skipped); this proves entry/summary compatibility only, not real subtask execution. Separately, with `YY_READONLY_ENABLED=false`, the new server refused startup (exit 2); full deployed stop/rollback/DR remains untested.
- Token count remains unavailable (`null`). Minimal local navigation smoke is recorded; full A/B/C/D paired evaluation is NOT ESTABLISHED and remains P2.
- M2/M3 writes, proposal persistence, reviews, jobs, workers, and state transitions remain disabled/deferred.

## Blockers and triage

| Finding | Severity/status | Evidence and action |
|---|---|---|
| No authenticated Web principal, caller-to-workflow ACL, authorized production W binding, or tunnel | P0 activation gate | Environment unavailable; classify `WEB_ACTIVATION_ENVIRONMENT_BLOCKED`. Do not claim active Web release. |
| Critical context truncation, cursor/version integrity | Engineering gate | Local implementation review plus 15 tests found fail-closed bounded behavior; production host remains unproven. |
| RF1 evidence semantics through new M1 | Local synthetic pass; production unestablished | Old and current report copies read via real local MCP path. No RF1 rerun. |
| Historical repository CI failures (S14b, S15-A2, S15-A5, S16-2, S18) | P2/P3 backlog | Kept as FAIL; triaged in the unified backlog. They do not exercise the isolated M1 read path based on reviewed evidence; repository CI is not declared green. |
| Repository security findings/count variance | P2/P3 backlog | No confirmed P0/P1 exploit or live credential in inspected evidence. Counts and scan coverage are not stable/complete; repository security is not declared clean. |
| Full paired evaluation, token accounting, full rollback/DR | P2/P3 backlog | Not required to keep the service disabled; no result is represented as PASS. |

All seven P2/P3 items are in [`P2-P3-BACKLOG-20260927.md`](P2-P3-BACKLOG-20260927.md), with evidence, non-blocking rationale, recommended fix, and affected component. No backlog tasks were auto-dispatched.

## Release disposition

- **M0/M1 engineering:** CLOSED for this isolated, pushed implementation and its stated scope.
- **Main integration:** clean integration worktree gates passed; normal fast-forward push is pending final remote-SHA check. Dirty local main remains untouched.
- **Web activation:** `WEB_ACTIVATION_ENVIRONMENT_BLOCKED`.
- **M2/M3:** `NOT STARTED` / `DEFERRED_BY_PHASE`.
- **P2/P3:** unified backlog recorded (7 items).
- **Auto-dispatch:** STOP.

The machine-readable evidence is [`RELEASE-EVIDENCE-20260927.json`](RELEASE-EVIDENCE-20260927.json). This disposition is not a production release approval and does not claim `WEB READONLY ACTIVE`.
