"""The exact, read-only YY Decision V2 MCP tool surface (C1 v1.0.1).

Exactly three tools; external signatures carry logical ids only — no session,
workspace, or filesystem path parameters ever (C1 MCP input security boundary).
All semantics live in the Decision Core; this registry only adapts shapes.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, Field, ConfigDict, create_model
from fastmcp.tools import ToolResult
import auth
from decision_bridge import call_decision
from mcp_envelope import ENVELOPE_OUTPUT_SCHEMA, mcp_result


_READ_ONLY = {"readOnlyHint": True, "openWorldHint": False}

# C1 v1.0.1 外层冻结值域：step 仅 STEP_IDS（含 1.5 研究门；任意 float 0..8 不得放行）
StepId = Literal[0, 1, 1.5, 2, 3, 4, 5, 6, 7, 8]


class BudgetLimit(BaseModel):
    """C1 v1.0.1 冻结形状：budget?: { limit }（不暴露裸整数；未知嵌套键拒绝）。"""

    model_config = {"extra": "forbid"}
    limit: Annotated[int, Field(ge=1)]


def _source_read_model():
    """Generate the flat transport model from T01's single field declaration."""
    root = Path(__file__).resolve().parents[2]
    schema = json.loads((root / "contracts/delegation.schema.json").read_text(encoding="utf-8"))["$defs"]["SourceReadRequest"]
    fields = {}
    for name, spec in schema["properties"].items():
        kind = spec["type"]
        annotation = str | None if isinstance(kind, list) else int if kind == "integer" else str
        constraints = {dest: spec[src] for src, dest in [("minLength", "min_length"), ("maxLength", "max_length"), ("pattern", "pattern"), ("minimum", "ge"), ("maximum", "le")] if src in spec}
        fields[name] = (annotation, Field(..., strict=True, **constraints))
    return create_model("SourceReadRequest", __config__=ConfigDict(extra="forbid"), **fields)


SourceReadRequest = _source_read_model()


def build_v2_server():
    """Build the FastMCP instance exposing exactly the three Decision tools."""
    from fastmcp import FastMCP

    product_version = json.loads((Path(__file__).resolve().parents[2] / "package.json").read_text(encoding="utf-8"))["version"]
    mcp = FastMCP(
        name="yy-decision-mcp",
        version=product_version,
        instructions=(
            "YY Decision V2 (read-only). Bind with workflow_id; the server resolves the trusted "
            "workspace/session binding. Tools never mutate YY state, never write files, and never "
            "execute code. Core/V2 is canonical stage authority; selection truth stays inside the Decision Core."
        ),
    )
    register_v2_tools(mcp)
    return mcp


def register_v2_tools(mcp) -> None:
    """Register exactly the three frozen YY Decision tools."""

    @mcp.tool(
        name="yy_stage_decision",
        description=(
            "Read-only journey admission decision (supports research gate step 1.5). Returns "
            "allowed/blockers/owner actions from canonical YY journey state; never advances a journey."
        ),
        annotations=_READ_ONLY,
        output_schema=ENVELOPE_OUTPUT_SCHEMA,
    )
    def yy_stage_decision(
        workflow_id: Annotated[str, Field(min_length=1)],
        step: StepId,
    ) -> dict | ToolResult:
        return mcp_result(call_decision("stage", caller_scope=auth.current_caller_scope(), workflow_id=workflow_id, step=step))

    @mcp.tool(
        name="yy_task_decision",
        description=(
            "Read-only task routing decision (mode=select: cluster/capability/asset buckets without "
            "loading methodology; mode=brief: additionally activates the primary asset methodology and "
            "returns the compiled brief with source/payload/brief hashes). Admitted brief with explicit step "
            "adds a logical source_catalog. Optional source_read returns one bounded raw UTF-8 source page; "
            "requires brief and explicit step, mutually exclusive with activation_level/requested_resources/budget. "
            "Every page rechecks the same workflow/stage/task/source identity. Never writes files."
        ),
        annotations=_READ_ONLY,
        output_schema=ENVELOPE_OUTPUT_SCHEMA,
    )
    def yy_task_decision(
        workflow_id: Annotated[str, Field(min_length=1)],
        task_text: Annotated[str, Field(min_length=1)],
        mode: Literal["select", "brief"],
        capability: Annotated[str | None, Field(pattern=r"^[a-z0-9][a-z0-9-]{0,63}$")] = None,
        step: StepId | None = None,
        subtask_id: Annotated[str | None, Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$")] = None,
        activation_level: Literal["metadata", "body", "resource"] | None = None,
        requested_resources: Annotated[list[str] | None, Field(max_length=20)] = None,
        budget: BudgetLimit | None = None,
        source_read: SourceReadRequest | None = None,
    ) -> dict | ToolResult:
        params: dict = {"task_text": task_text, "mode": mode}
        if capability is not None:
            params["capability"] = capability
        if step is not None:
            params["step"] = step
        if subtask_id is not None:
            params["subtask_id"] = subtask_id
        if activation_level is not None:
            params["activation_level"] = activation_level
        if requested_resources is not None:
            params["requested_resources"] = requested_resources
        if budget is not None:
            params["budget"] = {"limit": budget.limit}
        if source_read is not None:
            params["source_read"] = source_read.model_dump()
        return mcp_result(call_decision("task", caller_scope=auth.current_caller_scope(), workflow_id=workflow_id, **params))

    @mcp.tool(
        name="yy_validate_consumption",
        description=(
            "Read-only structural proof of T3 SELECTED / T4 LOADED from the receipt chain. "
            "Frozen T5/T6/T7 decision states remain deferred; additive host_consumption evidence "
            "rechecks real execution and independent task behavior without claiming methodology use. "
            "A missing chain reports HOST_INTEGRATION_BYPASS. "
            "Never inspects answer quality, never writes."
        ),
        annotations=_READ_ONLY,
        output_schema=ENVELOPE_OUTPUT_SCHEMA,
    )
    def yy_validate_consumption(
        workflow_id: Annotated[str, Field(min_length=1)],
        subtask_id: Annotated[str, Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$")],
        artifact_ref: Annotated[str | None, Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$")] = None,
        evidence_ref: Annotated[str | None, Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$")] = None,
    ) -> dict | ToolResult:
        params: dict = {"subtask_id": subtask_id}
        if artifact_ref is not None:
            params["artifact_ref"] = artifact_ref
        if evidence_ref is not None:
            params["evidence_ref"] = evidence_ref
        return mcp_result(call_decision("validate", caller_scope=auth.current_caller_scope(), workflow_id=workflow_id, **params))
