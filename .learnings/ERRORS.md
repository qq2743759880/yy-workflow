# Errors

Command failures and integration errors.

---

## [ERR-20260908-001] PowerShell startup

**Logged**: 2026-09-08T00:00:00+08:00
**Priority**: medium
**Status**: pending
**Area**: infra

### Summary
PowerShell commands fail before execution because the host reports missing CET support.

### Error
`Fatal error. Your Windows doesn't fully support CET.`

### Context
- Read-only skill file access through the default PowerShell shell.
- Windows environment; switching `exec_command` to `cmd.exe` with `login:false` succeeds.

### Suggested Fix
Use `cmd.exe` for this workspace session; install available Windows updates before retrying PowerShell.

### Metadata
- Reproducible: yes
- Related Files: none
- Pattern-Key: shell.nonzero-exit
- Recurrence-Count: 1
- First-Seen: 2026-09-08
- Last-Seen: 2026-09-08

---

## [ERR-20260908-002] ByteRover CLI unavailable

**Logged**: 2026-09-08T00:00:00+08:00
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
The required `brv query` context lookup could not run because `brv` is not installed or not on PATH.

### Error
`'brv' is not recognized as an internal or external command.`

### Context
- Attempted project-context query before implementation.
- No `.brv/context-tree` exists in this project, so local project docs and git history were used as the honest fallback.

### Suggested Fix
Install `byterover-cli` or expose `brv` on PATH before the next project-memory lookup.

### Metadata
- Reproducible: yes
- Related Files: none
- Pattern-Key: shell.command-not-found
- Recurrence-Count: 1
- First-Seen: 2026-09-08
- Last-Seen: 2026-09-08

---

## [ERR-20260908-003] Figma OAuth not connected

**Logged**: 2026-09-08T00:00:00+08:00
**Priority**: high
**Status**: pending
**Area**: config

### Summary
Figma account inspection and file creation are blocked until the plugin is connected with OAuth.

### Error
`Connect this app with OAuth to use this action.`

### Context
- `figma_whoami` was called before creating the M3 prototype file.
- Local HTML prototype and screenshots were completed so no design work is lost.

### Suggested Fix
Connect the Figma plugin via OAuth, then create or target a design file and run the prepared incremental sync.

### Metadata
- Reproducible: yes
- Related Files: prototypes/yy-m3-control-room.html
- Pattern-Key: auth.missing-scope
- Recurrence-Count: 1
- First-Seen: 2026-09-08
- Last-Seen: 2026-09-08

---
