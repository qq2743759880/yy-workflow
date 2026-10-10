"""The exact, read-only YY Web MCP tool surface.

Handlers delegate to the pinned legacy YY read implementation, with envelope schemas
and standard MCP error results. No generic Local workspace tools are imported.
"""
from __future__ import annotations

from typing import Annotated

from pydantic import Field
from fastmcp.tools import ToolResult
import auth
from bridge_client import LEGACY_AUTHORITY, call_readonly
from mcp_envelope import ENVELOPE_OUTPUT_SCHEMA, mcp_result


_READ_ONLY = {"readOnlyHint": True, "openWorldHint": False}
_LEGACY_DESCRIPTION = (
    "LEGACY_COMPATIBILITY read surface; canonical stage decisions come from Core/V2. "
)
# Keep the five existing required fields and add discoverable M1 metadata.
# This is a new schema object; the shared V2 envelope schema is not modified.
_M1_ENVELOPE_OUTPUT_SCHEMA = {
    **ENVELOPE_OUTPUT_SCHEMA,
    "properties": {
        **ENVELOPE_OUTPUT_SCHEMA["properties"],
        "authority": {
            "type": "object",
            "additionalProperties": False,
            "description": "M1 compatibility classification; not a verified Core/V2 decision identity.",
            "properties": {key: {"const": value} for key, value in LEGACY_AUTHORITY.items()},
            "required": list(LEGACY_AUTHORITY),
        },
    },
}


def register_tools(mcp) -> None:
    """Register exactly the six frozen YY semantic read tools."""

    @mcp.tool(
        name="yy_open_workflow",
        description=_LEGACY_DESCRIPTION + (
            "Read-only YY lookup by workflow_id. May establish an ephemeral read session only; "
            "never creates a task or execution job, advances a journey, reopens CLOSED, "
            "dispatches work, or writes workspace files."
        ),
        annotations=_READ_ONLY,
        output_schema=_M1_ENVELOPE_OUTPUT_SCHEMA,
    )
    def yy_open_workflow(workflow_id: Annotated[str, Field(min_length=1)]) -> dict | ToolResult:
        return mcp_result(call_readonly("open_workflow", caller_scope=auth.current_caller_scope(), workflow_id=workflow_id))

    @mcp.tool(
        name="yy_get_snapshot",
        description=_LEGACY_DESCRIPTION + (
            "Read-only retrieval of a YY workflow snapshot page. Calls do not mutate YY business "
            "state or write workspace files."
        ),
        annotations=_READ_ONLY,
        output_schema=_M1_ENVELOPE_OUTPUT_SCHEMA,
    )
    def yy_get_snapshot(
        workflow_id: Annotated[str, Field(min_length=1)],
        snapshot_id: str | None = None,
        cursor: str | None = None,
    ) -> dict | ToolResult:
        return mcp_result(call_readonly(
            "get_snapshot", caller_scope=auth.current_caller_scope(), workflow_id=workflow_id, snapshot_id=snapshot_id, cursor=cursor
        ))

    @mcp.tool(
        name="yy_get_stage",
        description=_LEGACY_DESCRIPTION + (
            "Read-only projection of stage facts from the pinned legacy YY revision. "
            "Calls do not advance a journey or mutate YY business state."
        ),
        annotations=_READ_ONLY,
        output_schema=_M1_ENVELOPE_OUTPUT_SCHEMA,
    )
    def yy_get_stage(
        workflow_id: Annotated[str, Field(min_length=1)],
        step: float | None = None,
    ) -> dict | ToolResult:
        return mcp_result(call_readonly("get_stage", caller_scope=auth.current_caller_scope(), workflow_id=workflow_id, step=step))

    @mcp.tool(
        name="yy_list_assets",
        description=_LEGACY_DESCRIPTION + (
            "Read-only paginated listing of assets visible to the bound YY workflow. "
            "Calls do not mutate YY business state or write workspace files."
        ),
        annotations=_READ_ONLY,
        output_schema=_M1_ENVELOPE_OUTPUT_SCHEMA,
    )
    def yy_list_assets(
        workflow_id: Annotated[str, Field(min_length=1)],
        cursor: str | None = None,
        page_size: Annotated[int, Field(ge=1, le=100)] = 20,
    ) -> dict | ToolResult:
        return mcp_result(call_readonly(
            "list_assets", caller_scope=auth.current_caller_scope(), workflow_id=workflow_id, cursor=cursor, page_size=page_size
        ))

    @mcp.tool(
        name="yy_read_asset",
        description=_LEGACY_DESCRIPTION + (
            "Read-only access to an asset section through the YY authority and trusted workflow "
            "binding. Calls do not mutate YY business state or write workspace files."
        ),
        annotations=_READ_ONLY,
        output_schema=_M1_ENVELOPE_OUTPUT_SCHEMA,
    )
    def yy_read_asset(
        workflow_id: Annotated[str, Field(min_length=1)],
        read_ref: Annotated[str, Field(pattern=r"^[A-Za-z0-9._-]{1,100}$")],
        section_id: str | None = None,
        cursor: str | None = None,
        max_bytes: Annotated[int, Field(ge=64, le=64000)] = 12000,
    ) -> dict | ToolResult:
        return mcp_result(call_readonly(
            "read_asset",
            caller_scope=auth.current_caller_scope(),
            workflow_id=workflow_id,
            read_ref=read_ref,
            section_id=section_id,
            cursor=cursor,
            max_bytes=max_bytes,
        ))

    @mcp.tool(
        name="yy_read_evidence",
        description=_LEGACY_DESCRIPTION + (
            "Read-only access to evidence bound to the specified YY workflow snapshot. "
            "Calls do not mutate YY business state or write workspace files."
        ),
        annotations=_READ_ONLY,
        output_schema=_M1_ENVELOPE_OUTPUT_SCHEMA,
    )
    def yy_read_evidence(
        workflow_id: Annotated[str, Field(min_length=1)],
        evidence_ref: Annotated[str, Field(min_length=1)],
        snapshot_id: Annotated[str, Field(min_length=1)],
        cursor: str | None = None,
        max_bytes: Annotated[int, Field(ge=64, le=64000)] = 12000,
    ) -> dict | ToolResult:
        return mcp_result(call_readonly(
            "read_evidence",
            caller_scope=auth.current_caller_scope(),
            workflow_id=workflow_id,
            evidence_ref=evidence_ref,
            snapshot_id=snapshot_id,
            cursor=cursor,
            max_bytes=max_bytes,
        ))
