"""Advertise the existing YY envelope and map its failures onto MCP errors."""
from __future__ import annotations

from typing import Any

from fastmcp.tools import ToolResult
from pydantic import BaseModel


class YYEnvelope(BaseModel):
    """Transport shape only; operation semantics and error codes stay in Core."""

    model_config = {"extra": "allow"}
    ok: bool
    code: str | None
    data: dict[str, Any]
    evidence: dict[str, Any]
    warnings: list[str]


ENVELOPE_OUTPUT_SCHEMA = YYEnvelope.model_json_schema()


def mcp_result(envelope: dict[str, Any]) -> dict[str, Any] | ToolResult:
    """Keep payloads unchanged and carry failure codes in structured content.

    FastMCP's public error result sets wire isError and its standard Client
    raises ToolError by default. Clients opting out retain the complete machine
    envelope, including Core error data/evidence, rather than parsing prose.
    """
    if envelope["ok"] is False:
        return ToolResult(structured_content=envelope, is_error=True)
    return envelope
