# M0 Host Compatibility Check — 2026-09-27

## Observed environment

| Surface | Result | Evidence |
|---|---|---|
| YY planning worktree | PASS | Branch `codex/yy-web-codex-planning`, HEAD/base `f88a193299d6939850befda8a21c8248e6285627` |
| PRD | PASS | Main/worktree SHA-256 identical: `C54F24888756691C1F1190DCFD75F4956A27B30CD3EEC017430BFAF7DB299C21` |
| Local MCP Python | PASS | Python 3.14.6; FastMCP 4.0.5 in the existing runtime |
| Existing local MCP | PARTIAL | Loopback server responds; generic server exposes read/write/LSP tools and no caller identity ACL |
| Existing public tunnel | FAIL for reuse | Live tunnel targets the generic server, not a dedicated authenticated six-tool service |
| Existing Codex local connector | BLOCKED | Explicit project-list call returned HTTP 404; discovery alone is not a successful call |
| Dedicated YY MCP / tool discovery | NOT ESTABLISHED | No dedicated service has been installed or connected to this account |
| ChatGPT Web invocation | NOT ESTABLISHED | No real six-tool call or two-workspace Web isolation run |
| Skill import/supporting files/cache refresh | NOT ESTABLISHED | Must be measured through the current account after an isolated server is connected |

## Current Web connection path

OpenAI's current docs say ChatGPT connects to remote MCP servers. For private or developer-machine MCP servers, Secure MCP Tunnel can forward either stdio or HTTP without opening an inbound public port. Setting it up requires a `tunnel_id`, a runtime API key for `tunnel-client`, `Tunnels Read + Use`, and association with the target ChatGPT workspace. ChatGPT developer mode and app access are separately controlled by plan/workspace settings. The supported documentation is [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) and [Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt).

On this machine at this run, `tunnel-client` is not available on `PATH`, and the process environment has no `OPENAI` or `TUNNEL` variable names. No tunnel-management credentials or tunnel ID were provided. The available browser inventory returned no browser surfaces, so ChatGPT plan/workspace permissions, app creation, tool scan, skill import, cache refresh, and a Web invocation could not be inspected here. This is an environment blocker, not a claim that the account lacks those features.

The new service is currently stdio-only and has a local OS process boundary plus a trusted binding registry; it does not authenticate a Web caller or map an authenticated principal to workflow IDs. Secure MCP Tunnel does not by itself supply this service-side workflow ACL. Do not associate this service with a Web tunnel until an Owner-only/app-access policy and principal-to-workflow authorization have been implemented and tested. OpenAI's guidance says private-data tools need server-enforced authorization; see [Authenticate users](https://developers.openai.com/plugins/build/auth).

## Release consequence

A local Python unit/integration probe cannot be represented as a Web compatibility pass. The connector 404 and old MCP tool surface prevent safely reusing that deployment. The new stdio service also lacks authenticated caller/workflow ACL. M1 remains un-released until a dedicated authorized six-tool connection is discoverable and callable, with two-workspace isolation demonstrated.
