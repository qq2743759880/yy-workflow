"""YY Web MCP assembly for the frozen six-tool read-only surface.

The server requires an explicitly selected YY-owned port and binds only to a
loopback host. Runtime ownership, process supervision, and tunnel management
are handled by their separate YY deployment tasks. With --auth-mode oauth the
same ASGI app additionally serves the embedded OAuth 2.1 endpoints and marks
every request with the caller scope derived from its Bearer token.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from fastmcp import FastMCP
from starlette.applications import Starlette
from starlette.middleware import Middleware

import auth
import tools

_BIND_HOST = "127.0.0.1"
_MCP_PATH = "/mcp"


def build_server() -> FastMCP:
    """Build the YY MCP server and register only the frozen YY read tools."""
    product_version = json.loads((Path(__file__).resolve().parents[2] / "package.json").read_text(encoding="utf-8"))["version"]
    mcp = FastMCP(
        name="yy-web-mcp",
        version=product_version,
        instructions=(
            "YY M1 read-only MCP (LEGACY_COMPATIBILITY); its pinned legacy source is not canonical stage authority. "
            "Use Core/V2 via /mcp-v2 for stage decisions and admission. "
            "Use workflow_id to bind to a registered YY workflow. "
            "All tools are read-only and never create tasks, advance workflow state, or write files."
        ),
    )
    tools.register_tools(mcp)
    return mcp


def build_app(
    auth_mode: str = "none",
    auth_secret: str | None = None,
    auth_password_hash: str | None = None,
    auth_issuer: str | None = None,
    json_response: bool | None = None,
):
    """Assemble the dual-mount ASGI app; oauth mode mounts the SDK-built OAuth 2.1 stack.

    C3 dual-mount (same process, one YY-owned port):
      /mcp    -> M1 exact-six read surface (unchanged route objects)
      /mcp-v2 -> Decision V2 exact-three surface
    Composition proven by the C3.0 spike: merge both sub-apps' route tables and
    run their lifespans together (naive Mount-prefix composition 307-redirects
    POST /mcp and was rejected). The SAME middleware list is applied to both
    sub-apps so neither surface can bypass auth.
    """
    oauth_stack = None
    if auth_mode == "oauth":
        auth.configure_auth(secret=auth_secret, password_hash=auth_password_hash, issuer=auth_issuer)
        oauth_stack = auth.build_oauth_stack()
        middleware: list[Middleware] = oauth_stack.middleware
    elif auth_mode == "none":
        middleware = []
    else:
        raise ValueError("auth mode must be 'none' or 'oauth'")

    from contextlib import asynccontextmanager

    import tools_v2

    # 子应用不带 middleware：路由表合并进父应用后，子应用自身的 middleware 栈不会运行
    # （与 lifespan 同理）；auth 统一装在父 Starlette 上，保证两面同权无旁路。
    m1_app = build_server().http_app(path=_MCP_PATH, json_response=json_response)
    v2_app = tools_v2.build_v2_server().http_app(path="/mcp-v2", json_response=json_response)

    @asynccontextmanager
    async def _combined_lifespan(app):
        # sub-app session managers start only via their own lifespans; a parent
        # default lifespan would silently skip them (fastmcp runtime error)
        async with m1_app.router.lifespan_context(m1_app), v2_app.router.lifespan_context(v2_app):
            yield

    routes = [*m1_app.routes, *v2_app.routes]
    if oauth_stack is not None:
        routes.extend(oauth_stack.routes)
    app = Starlette(routes=routes, middleware=middleware, lifespan=_combined_lifespan)
    if oauth_stack is not None:
        app.state.yy_oauth = oauth_stack
    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="YY Web MCP server")
    parser.add_argument(
        "--port",
        type=int,
        required=True,
        help="explicit YY-owned free port selected by deployment configuration",
    )
    parser.add_argument(
        "--auth-mode",
        choices=("none", "oauth"),
        default=os.environ.get("YY_AUTH_MODE", "none"),
        help="oauth enables the embedded OAuth 2.1 production access boundary",
    )
    parser.add_argument("--auth-secret", default=os.environ.get("YY_AUTH_SECRET"), help=argparse.SUPPRESS)
    parser.add_argument("--auth-password-hash", default=os.environ.get("YY_AUTH_PASSWORD_HASH"), help=argparse.SUPPRESS)
    parser.add_argument("--auth-issuer", default=os.environ.get("YY_AUTH_ISSUER"), help=argparse.SUPPRESS)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    if args.port == 8168:
        parser.error("--port 8168 is reserved for the Local endpoint; YY must use its own port")

    try:
        app = build_app(
            auth_mode=args.auth_mode,
            auth_secret=args.auth_secret,
            auth_password_hash=args.auth_password_hash,
            auth_issuer=args.auth_issuer,
        )
    except ValueError as error:
        parser.error(str(error))

    import uvicorn

    uvicorn.run(app, host=_BIND_HOST, port=args.port)


if __name__ == "__main__":
    main()
