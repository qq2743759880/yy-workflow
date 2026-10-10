# YY Web MCP

Two read-only MCP surfaces share one loopback server, OAuth boundary and trusted
workflow binding registry. `/mcp` exposes the six compatibility read tools in
`tools.py`; `/mcp-v2` exposes the three Decision tools in `tools_v2.py`. These tools
read state, select assets, compile a brief and validate receipt consumption. They
do not create tasks, advance workflow state or execute code.

| Mount | Tools |
|---|---|
| `/mcp` | `yy_open_workflow`, `yy_get_snapshot`, `yy_get_stage`, `yy_list_assets`, `yy_read_asset`, `yy_read_evidence` |
| `/mcp-v2` | `yy_stage_decision`, `yy_task_decision`, `yy_validate_consumption` |

The server binds `127.0.0.1` and refuses port 8168, which is reserved for the Local
endpoint. Runtime ownership is implemented in `runtime/yy-lifecycle.psm1`.

## Run

```powershell
.\start-yy-mcp.ps1 start   # reuse the selected port and ngrok endpoint in runtime/config.json
.\start-yy-mcp.ps1 status
.\start-yy-mcp.ps1 stop
# First local-only startup when no runtime config exists:
.\start-yy-mcp.ps1 start -Port <yy-owned-free-port> -NoTunnel
```

For a selected ngrok tunnel, pass `-NgrokAuthtokenFile <private-token-file>`
to the same startup command, or create `runtime/credentials.local.json` with
`{"ngrokAuthtokenFile":"<private-token-file>"}`. Relative credential paths resolve
from the runtime directory; the explicit command argument takes precedence.
Keep the token outside the source tree. The local configuration is excluded
from Git and both release profiles. Missing credentials fail closed.

The public deploy.ps1/deploy.bat and deprecated start-zcode-mcp.bat delegate to
this same lifecycle. Startup is idempotent for an owned healthy instance, leaves
other listeners untouched, launches hidden windows and inherits credentials
through the environment. It does not install dependencies or choose a new
ngrok endpoint. The default is anonymous synthetic access; existing environment
settings are preserved. Production access requires explicit OAuth credentials
and production bindings.

`Start-YyServer` (runtime module) performs the same launch under lifecycle
supervision and forwards `YY_AUTH_*` environment variables to the server child.
See [runtime ownership](runtime/ownership-contract.md) for managed server and
tunnel lifecycle. Each MCP surface additionally requires its enable flag
(`YY_READONLY_ENABLED=true` or `YY_DECISION_ENABLED=true`) and a trusted registry
selected by `YY_READONLY_BINDINGS` (V2 also accepts `YY_DECISION_BINDINGS`).

## Envelope and MCP errors

All nine tools advertise an explicit output schema with five required fields:

```json
{"ok": true, "code": null, "data": {}, "evidence": {}, "warnings": []}
```

Successful payloads retain their existing operation-specific data and evidence.
A domain failure keeps the same envelope, sets `ok=false`, carries the machine
error code and uses the standard MCP `isError=true` result. Both text content and
`structuredContent` contain the complete envelope. FastMCP's normal
`Client.call_tool()` raises `ToolError` by default; clients that pass
`raise_on_error=False` can read the original structured `code`, `data` and
`evidence`. Input-schema failures are reported by the SDK before Core invocation.

## Authority identity

Both mounts advertise the YY distribution version from `package.json` in MCP
`initialize.serverInfo.version`, rather than the installed FastMCP library
version. This display metadata is not a semantic authority digest or an M1 pin.
Clients must still inspect the authority evidence described below.

The two mounts deliberately report different authority identities:

- M1 `/mcp` is the compatibility read surface over the development worktree pinned
  by `AUTHORITY_ROOT`, commit, tree and blob manifest in `bridge_client.py`. The
  pin is checked before and after invocation and attached as
  `evidence.authority_revision`. Updating the installed Skill does not silently
  update this pin; the compatibility source must be repinned explicitly.
  Every M1 success and failure envelope reports `authority.classification =
  LEGACY_COMPATIBILITY`, `canonical_stage_authority = false` and
  `stage_decision_authority = Core/V2`. Its pin proves legacy source integrity;
  stage labels, phase checks and command guidance in the legacy payload cannot
  authorize C4/Skill stage decisions. Use Core/V2 for those decisions. See
  [M1 authority boundary](../../reference/m1-authority-boundary.md).
- V2 `/mcp-v2` reads the selected `YY_DECISION_ROOT` source candidate. Its semantic
  identity comes from `contracts/generated/decision-authority-components.json`;
  its transport identity comes from
  `contracts/generated/decision-transport-manifest.json`. The bridge compares the
  Core's verified semantic digest with the selected manifest and rejects
  transport drift before invoking Node. These digests are not an M1 commit pin
  or a released build identity.

`AUTHORITY_REVISION_MISMATCH` denotes a failed identity check. Source digests,
payload digests, snapshot IDs and pagination cursors are separate content-version
identities; they do not replace either authority identity. Source manifests
detect drift under the local source trust boundary and are not signatures against
an actor who can rewrite both code and manifests.

## Host consumption observations

MCP stays read-only. The local `scripts/host-consumption.mjs` CLI consumes an
already recorded brief with a real execution process and a separate task checker.
`yy_validate_consumption` preserves the frozen T3/T4 decision model and adds
`evidence.host_consumption`: current artifact/source hashes establish `executed`,
and a current hashed checker report establishes `task_behavior_verified`.
Changing the artifact, proof or checker report revokes the corresponding
observation. `verification_scope` is `task_behavior`; `methodology_application`
remains `UNVERIFIED`. Generic receipt checks and task acceptance do not certify
asset-specific methodology application.

## Authentication (task26v2 - OAuth 2.1 Production Access Boundary)

`--auth-mode oauth` mounts an OAuth 2.1 Authorization Code + PKCE (S256) boundary in
the same ASGI app, built entirely from MCP/FastMCP SDK primitives (`auth.py`):
`mcp.server.auth.routes.create_auth_routes` serves discovery + `/authorize` + `/token`,
DCR lives at `/register`, client identities resolve through CIMD
(`fastmcp.server.auth.cimd`), redirect URIs are checked against the CIMD document's
exact allowlist (`fastmcp.server.auth.redirect_validation`), tokens are HS256 JWTs
minted by `fastmcp.server.auth.jwt_issuer.JWTIssuer` and verified by
`fastmcp.server.auth.providers.jwt.JWTVerifier`, and RFC 9728 protected-resource
metadata comes from `fastmcp.server.auth.RemoteAuthProvider`. The YY-specific glue is
the owner login page, the single-use code store, the RFC 8707 `resource` binding, and
the fail-closed bearer middleware. Without oauth (`none`, the default) behavior is
unchanged: every caller is treated as `synthetic`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/.well-known/oauth-protected-resource` | GET | RFC 9728 protected-resource metadata (`resource`, `authorization_servers`, `scopes_supported`) |
| `/.well-known/oauth-authorization-server` | GET | RFC 8414 authorization-server metadata |
| `/authorize` | GET | ChatGPT/client authorization request (validates CIMD client + redirect allowlist, 302 to the login form) |
| `/login` | GET / POST | Owner password form; 302 with `code` on success |
| `/token` | POST | `code` + `code_verifier` (+ matching `resource`) -> Bearer JWT (1 h) |
| `/register` | POST | RFC 7591 dynamic client registration |

| Variable | Required (oauth) | Meaning |
|---|---|---|
| `YY_AUTH_MODE` | - | `oauth` / `none` (default `none`) |
| `YY_AUTH_SECRET` | yes | JWT signing key material, >= 32 chars |
| `YY_AUTH_PASSWORD_HASH` | yes | `auth.hash_password(password)` encoding (PBKDF2-HMAC-SHA256, 600k iterations) |
| `YY_AUTH_ISSUER` | yes (production) | Canonical public origin, e.g. `https://<ngrok-domain>`; the token `aud` and protected-resource `resource` are bound to it |

Credentials come only from the environment; no secret material exists in source,
tests, or the runtime config file. Generate the password hash without exposing the
password in shell history:

```powershell
$env:YY_AUTH_PASSWORD_HASH = .venv\Scripts\python.exe -c "import sys; sys.path.insert(0,'.'); import auth; print(auth.hash_password(input()))"
```

### Boundary behavior (fail closed)

- No `Authorization` header -> anonymous `synthetic` scope: `tools/list` works and
  synthetic workflows stay readable.
- On `/mcp` and `/mcp-v2`, any `Authorization: Bearer <token>` must verify (HS256 signature,
  `iss`, `aud == canonical resource`, `exp`, supported scopes) or the request is
  rejected **401** with a `WWW-Authenticate` challenge pointing at
  `/.well-known/oauth-protected-resource`. There is no synthetic downgrade for
  invalid tokens.
- `caller_scope` is resolved per request from the ASGI/MCP request context only
  (no shared global state), so concurrent requests cannot observe each other's
  authorization.
- OAuth endpoints retain SDK-owned client authentication: `/token` accepts
  `client_secret_basic` without passing through the MCP Bearer-only middleware.
  Supported space-delimited scope sets containing `production` grant production
  access; unknown token scopes are rejected.

### Scope model

Workspace bindings (`bindings-synthetic.json`, template `bindings-production.json`)
must declare an explicit `scope`, exactly `synthetic` or `production`. Missing,
unknown, malformed or misspelled scopes return `CONFIGURATION_ERROR`; there is no
implicit conversion of an unscoped workspace to publicly readable synthetic
data. This is a deliberate configuration compatibility change: older unscoped
registries must add their intended scope explicitly.

Both surfaces share `binding_boundary.resolve_binding`: schema and registry size
are checked, the requested workflow must have exactly one binding, `enabled`
must be exactly `true`, session names must follow the existing YY grammar, and
the workspace root is resolved to its canonical directory. A synthetic caller
cannot access a production binding; a production caller may read either scope.
Scope denial returns `WORKSPACE_NOT_AUTHORIZED` before an authority process starts.

V2 checks the Core's protected workspace read trees before invocation and again
before exposing its result. Stage queries inspect `.tt-state` and `artifacts`
(including execution-phase receipts); task queries inspect `.tt-state`;
consumption validation inspects `artifacts`. Inspection rejects links, Windows
junctions/reparse entries and paths outside the canonical workspace. It includes
session subdirectories and enforces a 20,000-entry, 4,000,000-byte per-file and
4,000,000-byte aggregate inspection budget. This is an application-level read
boundary, not an operating-system sandbox.

Persisted subtask IDs, dependencies and frozen contract paths in `state.json`
are also checked before Core invocation, so state data cannot redirect phase
receipt or contract reads outside the bound workspace. Invalid JSON is still
reported by Core; the transport does not redefine phase or task semantics.

## Independent deployment

Export the `mcp` profile with `scripts/export-package.mjs --out <new directory> --profile mcp` from the workflow root. The package excludes this machine's virtualenv, bindings, runtime config, PIDs, logs, tunnel YAML and credentials. Create a target Python environment from requirements.txt and provide target bindings and auth explicitly to the existing startup entrypoint. V2 defaults to the containing release; an explicit trusted YY_DECISION_ROOT override remains supported.

M1 location is selected from YY_M1_AUTHORITY_ROOT, runtime/m1-source.local.json, or the release's compatibility/m1-source directory. The original commit/tree/blob pins remain unchanged; a missing or drifting legacy source fails closed. The local source config is private deployment state and is not exported. See ../../docs/directory-map.md and ../../reference/variables-and-config.md for migration and directory roles. The unused copied Local service modules have been cold-archived outside the source tree; the current YY server and tests do not import them. Historical source fingerprints remain dated evidence. stop-all.bat now forwards to the existing YY-owned stop lifecycle.
