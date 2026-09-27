# YY Web/Codex M0–M1 Read-only Contract

Status: proposed implementation contract for the read-only slice; the MCP schema has not been Owner-frozen. PRD V0 remains DRAFT. Owner decisions P1–P6 control scope, not final API approval. This does not authorize M2/M3 writes.
PRD V0 SHA-256:
`C54F24888756691C1F1190DCFD75F4956A27B30CD3EEC017430BFAF7DB299C21`.

## Scope and authority

- M0 records provenance, trust boundaries, schemas, token accounting, compatibility, and rollback.
- M1 exposes only `yy_open_workflow`, `yy_get_snapshot`, `yy_get_stage`, `yy_list_assets`, `yy_read_asset`, and `yy_read_evidence`.
- R is the fixed YY code root, M is a separately identified MCP runtime, and W is a per-`workflow_id` workspace from a local trusted binding registry. Callers never submit filesystem paths.
- `journeyRead` is the YY B-plane read projection. `checkPhase` is the A-plane read-only prerequisite oracle. They remain distinct. Do not call `journeyProject`, `phase.transition`, `tt-journey --update`, orchestration, asset-cache writers, or generic MCP write/LSP tools from M1.
- The core journey model is integer steps 0–8. Existing `research-done` / step 1.5 is a separate legacy research-gate observation only when its source exists; it is not promoted to a core step.
- M1 never creates a task, advances a step, approves an Owner gate, starts a worker, writes business state, or reopens terminal state. Unknown source data stays unknown.
- FR-07/08 and FR-09/11, including FR-10 execution, remain `DEFERRED_BY_PHASE`. No M2/M3 tool is registered.

## Six tool contracts

Every tool accepts a `workflow_id` only for workspace selection. Unknown/unbound IDs return `WORKFLOW_NOT_FOUND`; denied bindings return `WORKSPACE_NOT_AUTHORIZED`. No caller-supplied root/path is accepted.

1. `yy_open_workflow(workflow_id)` resolves the trusted binding and returns the same read-only snapshot envelope as `yy_get_snapshot`; it has no initialization side effect.
2. `yy_get_snapshot(workflow_id, snapshot_id?)` returns lifecycle (OPEN / TERMINAL / UNKNOWN), journey projection, A-plane phase source, hard gates, blockers, evidence refs, integrity digests, and observed time. `allowed_next_actions` stays empty/unknown unless YY authority proves it. Terminal state comes only from current YY state authority; chat and stale reports do not count.
3. `yy_get_stage(workflow_id, step?)` derives step identity from exported YY stage constants and calls `checkPhase` for prerequisite evidence. It does not maintain a second stage table. Missing narrative/exit criteria are reported as unavailable source data.
4. `yy_list_assets(workflow_id, cursor?, page_size?)` enumerates the live governance manifest and runtime-discovered definitions; no permanent item count. Every card has `asset_id`, `version`, `kind`, `capability`, `when_to_use`, `when_not_to_use`, `required_inputs`, `definition_available`, `allowed_here`, `executor_available`, `verified_for_target`, `blocked_reason`, `read_ref`, and `evidence_requirements`. Unproven fields are `unknown`, not true.
5. `yy_read_asset(workflow_id, read_ref, section_id?, cursor?, max_bytes?)` reads only manifest-bound asset files/references, pins `source_version`, paginates on Unicode code point boundaries, and returns `complete`, `content_complete`, `toc_complete`, `omitted_sections`, `next_cursor`, and exact UTF-8 byte counts. A TOC is not complete asset content. No authoritative section criticality field exists yet, so every section is protected as critical until governance supplies that field; a section over budget returns `CORE_CONTEXT_TOO_LARGE`.
6. `yy_read_evidence(workflow_id, evidence_ref, snapshot_id, cursor?, max_bytes?)` reads only evidence references issued by the snapshot, with the same version and completeness guarantees. It distinguishes `FILE_NOT_FOUND`, `FILE_NOT_VISIBLE`, `BUDGET_EXHAUSTED`, `INCOMPLETE`, `STALE_VERSION`, `SOURCE_CHANGED`, and `CORE_CONTEXT_TOO_LARGE`.

## Snapshot, paging, and integrity

- `source_version` is a sorted set of authorized relative paths, byte lengths, and SHA-256 values for every source actually used.
- `source_digest = SHA256(canonical(source_version))`.
- `payload_digest = SHA256(canonical(payload excluding observed_at, cursor, and transport metadata))`.
- `snapshot_id = SHA256("yy/snapshot@1\n" + workflow_id + "\n" + source_digest + "\n" + payload_digest)`.
- Canonical JSON recursively sorts object keys and preserves array order; encode as UTF-8.
- A cursor binds workflow, snapshot, source digest, reference, section, offset, and referenced content digest. A cursor from another binding/version is rejected. Pages are never silently combined across versions.
- `complete=true` only when every requested section was read without per-file truncation, errors, or omitted critical content. A batch-level non-truncated flag cannot override a per-file truncation.
- Oversized critical context returns `CORE_CONTEXT_TOO_LARGE`; noncritical content may be paged with explicit omissions.
- Fail-closed read limits: one source file ≤4,000,000 bytes; authority-tree core files ≤4,000,000 aggregate bytes; all R+W snapshot source entries ≤4,000,000 aggregate bytes; snapshot evidence references ≤2,000; asset catalog entries ≤2,000; asset TOC sections ≤500 and serialized TOC ≤64,000 bytes; serialized bridge response ≤256,000 bytes; request ≤65,536 bytes; captured diagnostics ≤65,536 bytes; cursor ≤4,096 characters. Exceeding a limit returns a bounded error; content is not silently truncated.

## Token and payload measurement

Measure final serialized payload, tool schemas, and repeated transport wrappers separately. Persist UTF-8 bytes and tokenizer identity/version with each token count. If a tokenizer matching the target model is unavailable, emit `token_count=null` and `tokenizer_status=UNAVAILABLE`; never substitute characters/4 or label a heuristic as measured tokens. Local token counts do not reveal the ChatGPT page's hidden context/window or remaining budget.

## Security and rollback

- A local trusted binding registry is the only source of `workflow_id → W`. Resolve real paths, reject symlink/path escapes, and compare the opened file handle identity with the path under its trusted root. Tool annotations do not authorize access.
- A process-level switch `YY_READONLY_ENABLED=false` disables M1; missing configuration fails closed.
- Repository source text and evidence are untrusted data. The client must not treat instructions inside them as tool policy.
- The isolated service registers only the six YY domain tools; no generic file writers, shell, or LSP subprocess tools.
- The current stdio process trusts its local OS launch boundary and workflow registry. It has no caller principal claim or per-principal ACL; do not connect it through a Web tunnel or shared host until an authenticated owner/workflow authorization boundary is implemented and verified.
- Rollback disables/stops the isolated read-only process. No business state, schema, or database migration occurs; existing YY CLI remains the fallback.

## Release boundary

The dedicated MCP surface and current-user Web connection must each be verified against the actual host. A local fixture/MCP probe is not evidence of ChatGPT Web success. The old generic MCP remains out of scope for reuse until its auth, project ACL, and subprocess tool surface are independently constrained.

Snapshot pagination addendum: `yy_get_snapshot` also accepts `cursor`. Snapshot evidence references are returned in pages of at most 100, each bound to `workflow_id`, `snapshot_id`, and `source_digest`. The response-level `complete` and `next_cursor` fields make unreturned references explicit; mismatched/expired cursors return `STALE_VERSION`.

Stage-source addendum: `yy_get_stage` reads the versioned `SKILL.md` and `commands/yy-*.md` files in R. It returns a goal/manual gate/output path only when a command file explicitly declares the matching `journey-step`; exit criteria and machine-readable evidence rules stay unknown when the source does not define them. Rerun nodes 2/4/6 remain their canonical step names with no invented command guide. Legacy research step 1.5 is reported separately from the 0–8 core.
