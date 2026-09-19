# R5b Implementation — Pre-flight Ledger (orchestrator)

Date: 2026-09-17 19:25 CST. Status: awaiting Owner OQ rulings (P3-T5B-01).

## Owner decision request (blocking, verbatim question to Owner)

The frozen contract C-R5-ui v2 (` fe3a83e6… `, §8.4) leaves 4 webview-bridge OQs as [待补充].
Owner must pick one per item (or say "全 A/推荐") before the implementation agent is dispatched:

1. **OQ-U-17 注入机制** — how data enters the webview page:
   - (a) host-injected global (e.g. window.__YY_JOURNEY__ set before page scripts run)
   - (b) postMessage channel (page listens for message events)
   - (c) file-watch refresh (page polls a local JSON file the host writes)
2. **OQ-U-18 刷新/轮询策略** — when does the page get updated data:
   - (a) manual only (user clicks refresh)
   - (b) fixed interval poll (value [待定])
   - (c) host-push on change
3. **OQ-U-19 容器生命周期** — webview create/destroy/session-switch semantics:
   - (a) single persistent webview, reload on session switch
   - (b) new webview per session, old destroyed
   - (c) [待确认] defer to YY host defaults
4. **OQ-U-20 桥接缺席降级** — page opened without host bridge:
   - (a) full degraded state (Bridge disconnected overlay, no data, per C-R5-ui §6 D-06)
   - (b) attempt CLI stdout fallback (dev mode) with visible [DEV FALLBACK] badge