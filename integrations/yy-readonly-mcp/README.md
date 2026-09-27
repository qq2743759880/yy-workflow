# YY read-only MCP

This is a separate stdio process. It does not modify the existing generic local MCP or its tunnel.

## Tools

The server registers exactly six YY read-only tools. Workspace roots come from a local trusted binding registry; tool arguments never accept filesystem paths. Do not place production bindings or credentials in this repository.

## Local run

1. Create a private bindings JSON using `bindings.example.json` as a template. Bind only workspaces the local user is authorized to read.
2. Use a Python environment with the exact dependency in `requirements.txt` and Node 24 or compatible.
3. Set `YY_READONLY_ENABLED=true` and `YY_READONLY_BINDINGS=<private registry path>`, then run `python server.py`.
4. The service uses stdio only. A Secure MCP Tunnel can technically forward stdio, but this build has no caller principal/workflow ACL and is not approved for tunnel connection. A dedicated authenticated boundary and actual ChatGPT host test are still required.
5. Roll back by setting the switch to false or stopping the process. YY's existing CLI/state remain untouched.

See [ENTRY.md](ENTRY.md) for the minimal model-facing read sequence and [COMPATIBILITY-20260927.md](../../docs/yy-web/COMPATIBILITY-20260927.md) for the observed host limits.

The bridge calls YY's existing read-only `journeyRead` and `checkPhase` functions. The server does not register generic read/write, shell, or language-server tools.
