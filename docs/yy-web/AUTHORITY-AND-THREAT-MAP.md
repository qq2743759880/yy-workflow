# M0 Authority and Threat Map

Baseline: YY core `f88a193299d6939850befda8a21c8248e6285627`; PRD V0 SHA-256 `C54F24888756691C1F1190DCFD75F4956A27B30CD3EEC017430BFAF7DB299C21`.

## YY writer/read seams

| Surface | Classification | M1 treatment |
|---|---|---|
| `scripts/lib/store.mjs:createStore().save` | Existing state writer; direct overwrite | Not called |
| `scripts/lib/state.mjs:appendNamespace` | Additive namespace writer | Not called |
| `scripts/lib/phase.mjs:checkPhase` | Read-only A-plane prerequisite authority | Reused |
| `scripts/lib/phase.mjs:transitionPhase` | A-plane state writer | Not called |
| `scripts/lib/journey.mjs:journeyRead` | Read-only B-plane projection | Reused |
| `scripts/lib/journey.mjs:journeyProject` | Projection writer in configured modes | Not called |
| `scripts/tt-journey.mjs --update` | Legacy/compatibility journey writer; includes research gate 1.5 | Not called |
| `scripts/lib/receipt.mjs:receiptAppend` | Receipt writer | Not called |
| `scripts/lib/change.mjs` | Change proposal/record writer | Not called |
| `scripts/lib/asset.mjs:readManifest` | Governance manifest reader/validator | Reused read-only |
| `scripts/lib/asset.mjs:loadAssets` | May write `.tt-state/assets-cache.json` | Not called with cache enabled |
| `scripts/lib/manifest.mjs:buildManifest` | Runtime discovery; reads definitions | Reused read-only |
| `scripts/lib/manifest.mjs:loadManifest` | Discovery cache writer | Not called |
| Generic MCP `write_file`, `apply_workspace_edit` | General write surface | Not registered/exposed |
| Generic MCP LSP tools | May spawn configured language servers | Not registered/exposed |

There is no single business writer today: `store.save` and `appendNamespace` are distinct paths. That remains an M2/M3 gate; M1 does not migrate or unify them.

## Threats and controls

| Threat | Control / required evidence |
|---|---|
| Cross-workspace contamination | Fixed server-side workflow binding; two isolated fixtures; unbound ID rejects without path disclosure |
| Caller-supplied path traversal | No path parameter; resolve configured realpath; reject references outside bound W/R roots |
| Sensitive-file exposure | Allowlisted evidence refs; hidden-file rules applied before ref issuance; no arbitrary filename read |
| Stale snapshot/page mixing | Snapshot/source digest bound cursor; source version pinned; stale cursor rejected |
| Prompt injection from repository/evidence | Returned content tagged as untrusted source data; policy remains server-side |
| Unauthorized project ID | Binding registry and process principal; no caller-controlled workspace |
| Hidden tool escalation | Dedicated tool registration allowlist; no writers, shell, or LSP subprocesses |
| Oversized context/critical truncation | Per-file and total limits, Unicode boundary, explicit omissions, critical refusal |
| Outdated Skill/tool schema | Compatibility report pins Skill/schema version and host discovery/call evidence |
| Cache-induced writes | Direct read APIs/buildManifest only; cache writers forbidden |

## Known residual boundary

The current generic local MCP is a separate unversioned deployment with broader project access, generic write tools, and configured LSP launches. It is not a safe transport for M1. Its code identity is a per-file SHA manifest; no Git revision is claimed.
