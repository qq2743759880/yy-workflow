---
name: dev-planner
description: Thin Decision asset bridge to pinned grilling, to-spec and to-tickets. Deliver specs and tracer-bullet tickets with declared blocking edges.
version: 3.2.0
---
# Dev Planner — admitted planning bridge

[METHODOLOGY.json](METHODOLOGY.json) is the binding truth: grilling for unresolved decisions; to-spec for a missing spec; to-tickets for the work breakdown and blocking edges. Their original methods are not restated here.
Receive the existing Decision-selected asset/task, upstream refs and owner context. Store spec output under artifacts/specs/ and one ticket per file under artifacts/tickets/. This configured local artifact sink replaces a platform-specific tracker path; remote publication requires separate authorization.
Preserve current manifest/capability ownership. Where required, run scripts/plan-review.mjs on the produced plan and retain its report; do not invent gate results.
Return artifact paths, independent acceptance and evidence. The fixed upstream methods are the sole decomposition methodology.
