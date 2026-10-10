# YY Runtime Ownership Contract — W3-01

**Status:** Runtime/configuration ownership model with implemented lifecycle support. Local regression tests cover the process boundary; current service and public endpoint health require live evidence.  
**Contract:** `contracts/yy-web-mcp-ngrok-20260928.json` — SHA-256 `ba519ee0a0ce73f7e9fe3859d7bdb06bdfa69e0c8c00717ba73d912dff8e2bae` (current distributed file; historical machine-specific source reference normalized).  
**Historical W1 baseline:** `baseline/source-manifest.json` and `baseline/formal-clone-reconciliation.json` record the earlier clone acceptance. They do not establish the identity or health of a running process today.

## Scope and current decision

This model defines identity and ownership boundaries for the YY server and optional tunnel. `yy-lifecycle.psm1` implements the ownership checks. `../start-yy-mcp.ps1` is the public startup/status/stop/restart entry; the legacy launch names forward to it. Startup uses the existing runtime configuration and installed executables, without downloading dependencies or choosing another public endpoint.

Earlier W2 records describe a public endpoint collision and rollback. Treat them as historical evidence. Current tunnel selection comes from `config.json`; a selected provider/endpoint still needs current process ownership and public MCP health checks. Neither an old PASS report nor a configuration selection alone proves a live service is ready.

## YY-only runtime layout

All paths below are relative to the formal YY clone root and are resolved/canonicalized beneath that root. Runtime state is never shared with Local.

| Purpose | YY-owned path |
|---|---|
| Runtime configuration | `integrations/yy-web-mcp/runtime/config.json` |
| Server identity record | `integrations/yy-web-mcp/runtime/server.pid` |
| Optional tunnel identity record | `integrations/yy-web-mcp/runtime/tunnel.pid` |
| Server diagnostics | `integrations/yy-web-mcp/runtime/logs/server.log` |
| Optional tunnel diagnostics | `integrations/yy-web-mcp/runtime/logs/tunnel.log` |

The `.pid` files contain JSON process identity records, not a bare PID. The records and logs are YY-only operational state; log output must not contain secrets, authentication tokens, private workspace contents, or unredacted command arguments. Writes to identity records must be atomic so an interrupted start cannot leave a plausible partial owner record.

## Server binding, port, and health

- The MCP server binds only to `127.0.0.1`; wildcard, LAN, and public binds are prohibited.
- Reuse the configured YY port, or require an explicit port on the first startup. `8168` is permanently reserved to Local. Startup does not drift to another port when a configured endpoint is already frozen.
- A port conflict fails closed before launch. Report the conflict and leave the process holding that port untouched.
- The internal health probe is a loopback TCP connect to the configured YY port. It proves only that a listener is present; it does not prove MCP readiness, route correctness, authorization, or public health. Those require their later task-specific evidence.
- Any tunnel, once separately selected after W2 is resolved, may target only `127.0.0.1` and the verified YY port. It must never target `8168`.

## Process identity and lifecycle rules

Each YY server/tunnel process has a distinct role-specific record. The minimum identity tuple is:

```text
role + PID + canonical executable path + canonical working directory
+ command-line SHA-256 + YY instance ID + OS process creation time
```

The record also binds the process to the relevant configuration SHA-256 and, for the server, the loopback bind address and selected port. Store a command-line digest and the required non-secret identity markers, not raw arguments that might contain secrets. The server command identity must point into the YY clone/runtime configuration and include its unique instance marker. Once a tunnel is selected, its record must additionally bind the provider and provider endpoint ID.

Before stop, restart, watchdog action, or cleanup, resolve the recorded PID and recheck the full tuple immediately before acting. A process name such as `ngrok.exe`, `cloudflared.exe`, or `python.exe` is never an ownership signal. Global process-name scans may not be used to stop or reject YY startup because another unrelated tunnel may exist.

| Observation | Required behavior |
|---|---|
| No PID record | Treat as not owned/running; proceed only after normal port and identity checks. |
| Recorded PID is absent | Remove only that stale YY record atomically; startup may continue. Stop is an idempotent no-op. |
| PID exists and the full identity tuple matches | It is the recorded YY process; a lifecycle action may address only that PID after revalidation. |
| PID exists but executable, command digest, working directory, instance ID, or creation time differs | Treat as PID reuse/foreign owner; report `PID_OWNER_MISMATCH`, do not signal, kill, overwrite, or adopt it. Require operator resolution. |
| Port is occupied by a process not matching the YY identity record | Fail closed with a port conflict; never kill it or infer ownership from its name. |

Repeated startup reuses a verified server whose configured launcher and port match the request and whose actual PID owns the listener. A venv launcher may create a child using a different real interpreter executable: the process record verifies that child, while `config.json` retains the requested launcher. Startup preserves an existing selected tunnel configuration before generating the server's launch marker and config digest.

The watchdog and stop/restart entry points are restricted to these verified YY records. They do not enumerate or terminate all processes by executable name, and do not manage Local or an unrelated process listening on another port. Restart validates the launch inputs before signaling an owned process. OAuth settings and other credentials reach the child through its inherited environment; they must never be copied or base64-encoded into the command line.

## Tunnel-neutral configuration

The schema supports both `UNSELECTED_W2_P1` and `SELECTED_AFTER_W2_PASS`. An unselected tunnel has null provider/endpoint/port fields. A selected tunnel retains its provider, executable, endpoint identity, and loopback target across server restart. The current startup entry supports the configured ngrok lifecycle; other allowed provider families need their own implemented lifecycle before use.

## W3-01 acceptance boundary

The accompanying `runtime-config.schema.json` formalizes the path map, loopback-only server, non-8168 port constraint, health probe, process identity records, and tunnel selection states. `../tests/test_runtime_lifecycle.py` exercises synthetic identity/port providers; `../tests/test_startup_entrypoints.py` exercises the native process launch boundary without starting services. These tests support local lifecycle behavior, including hidden windows, command-line credential exclusion, frozen tunnel preservation, and venv child reuse. Real process startup, MCP handshake/tool calls, and public endpoint readiness require separate live checks.
