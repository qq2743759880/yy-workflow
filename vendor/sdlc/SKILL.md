---
name: sdlc
version: 3.2.0
description: LEGACY_HEAVY_PROFILE for explicit release, large-migration or multi-stage governance. Never part of default development execution; providers are optional.
---
# SDLC — LEGACY_HEAVY_PROFILE

Normal complex development uses Matt implement/tdd/code-review and the existing debugging discipline. This asset retains only the separate governance value: per-stage records and owner release/rollback decisions.
[METHODOLOGY.json](METHODOLOGY.json) is authoritative for enabling the profile: an explicit_assets=sdlc owner instruction with authorization_ref, plus governance_scope=release-governance, large-migration or multi-stage-governance. No generic invocation option or mere cluster presence enables it. Normal plans omit it; missing evidence returns NOT_ALLOWED.
The current host may execute the authorized scope natively. An external provider is an explicit opt-in; no CLI is required for the methodology. Read [legacy provider notes](reference/cline-exec.md) only when selecting that optional provider.
Use [stage records](reference/phase-templates.md) for stages actually entered and [BMAD input/output reference](reference/bmad-phases.md) where needed. Plan/develop/review/summarize are governance records, not a second YY DAG or journey authority.
Roles are on-demand instructions: plan [sprint](agents/sprint.md)/[control](agents/control.md), develop [developer](agents/developer.md), review [peer](agents/peer.md), summarize [summary](agents/summary.md)/[supervisor](agents/supervisor.md). Original plugin scheduling/model metadata is inactive; only duties and output criteria are consumed.
Role files and template documents are not processes or execution evidence. Independent-agent claims require actual separate records. Report only entered stages; methodology_application remains UNVERIFIED and C5 deferred.
