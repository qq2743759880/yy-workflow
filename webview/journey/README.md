# webview/journey — Journey Control Room (YY host webview plugin page)

R5b implementation per frozen contract `contracts/C-R5-ui.md` v2 (fe3a83e6…) + Owner OQ rulings 2026-09-17 (test-reports/R5b-implementation-20260917/owner-oq-rulings.md = 1085de55…).

## Files

| file | role |
|---|---|
| index.html | the page (5 views: 进度/规划/执行/证据/更多; degraded overlay; manual refresh) |
| styles.css | frozen tokens: 10px radius, pill 999px, 44px min controls, light/dark system scheme, accent running green (blue=info, amber=pending, red=fail); every state has text+color |
| render-core.mjs | pure view-model functions (Node-testable): bridge detection, 7-state mapping, worst-state rollup, nextPrompt snapshot echo, conflict view, NOT_FOUND data channel |
| host-bridge.mjs | host-side injector: runs existing CLI (scripts/tt-journey.mjs --read/--project), builds window.__YY_JOURNEY__ payload, injects BEFORE first script tag; optional dev static server |

## Decisions implemented (Owner rulings 2026-09-17)

- OQ-U-17=a: host-injected global `window.__YY_JOURNEY__` = {read, project, injectedAt, sessionId}
- OQ-U-18=a+c: manual refresh button (host hook first, else reload) + host push full replace; NO polling
- OQ-U-19=a: single persistent webview; session switch = host reloads with fresh payload
- OQ-U-20=a: bridge absent/malformed => Bridge disconnected overlay (frozen D-06), never fake data, no CLI fallback in production page

## Discipline

- Read-only projection page: consumes journey.read / journey.project shells only; never writes state/receipts/disk; never calls phase.transition.
- FAILED/SKIPPED/UNRESOLVED never rendered as success; group worst-state rollup; success badge = projection health; completion = separate text.
- JOURNEY_NOT_FOUND via data channel (§8.1); PROJECTION_CONFLICT node-level both-evidence; nextPrompt copy = snapshot reference (recompute=false).
- Zero changes to scripts/, contracts/, plans/, vendor/, prototypes/.