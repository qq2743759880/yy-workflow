"""Measure serialized local MCP schemas and synthetic read-only response payloads."""

from __future__ import annotations

import argparse
import asyncio
import dataclasses
import importlib.util
import json
import os
import platform
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import fastmcp
from fastmcp import Client


ROOT = Path(__file__).resolve().parents[2]
SERVER = Path(__file__).with_name("server.py")
SPEC = importlib.util.spec_from_file_location("yy_readonly_server_for_measurement", SERVER)
assert SPEC and SPEC.loader
readonly = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(readonly)


def compact_bytes(value) -> int:
    return len(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))

def to_jsonable(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): to_jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_jsonable(item) for item in value]
    if hasattr(value, "model_dump"):
        return to_jsonable(value.model_dump(mode="json", by_alias=True, exclude_none=True))
    if dataclasses.is_dataclass(value):
        return to_jsonable(dataclasses.asdict(value))
    names = ("type", "text", "data", "mimeType", "annotations", "_meta")
    mapped = {name: getattr(value, name) for name in names if hasattr(value, name)}
    if mapped:
        return to_jsonable(mapped)
    raise TypeError(f"Cannot serialize MCP object type {type(value).__name__}")

def tool_result_object(result):
    return {
        key: to_jsonable(getattr(result, key))
        for key in ("content", "structuredContent", "isError", "_meta")
        if hasattr(result, key)
    }


def seed_workspace(root: Path) -> None:
    state = root / ".tt-state"
    state.mkdir(parents=True)
    (state / "state.json").write_text(
        json.dumps({"id": "measurement", "status": "planning", "subtasks": []}),
        encoding="utf-8",
    )
    steps = [
        {
            "step": index,
            "name": f"step-{index}",
            "status": "in_progress" if index == 0 else "pending",
            "gates_passed": [],
            "artifacts": [],
            "updated_at": None,
        }
        for index in range(9)
    ]
    (state / "journey.json").write_text(
        json.dumps({"schema": "yy/journey@1", "steps": steps, "plans": [], "updated_at": None}),
        encoding="utf-8",
    )


def decode_result(result):
    structured = getattr(result, "structuredContent", None)
    if isinstance(structured, dict):
        return structured
    for block in getattr(result, "content", []):
        text = getattr(block, "text", None)
        if text:
            try:
                parsed = json.loads(text)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass
    raise RuntimeError("MCP call did not return a JSON object")


async def measure() -> dict:
    prior_enabled = os.environ.get("YY_READONLY_ENABLED")
    prior_bindings = os.environ.get("YY_READONLY_BINDINGS")
    try:
        with tempfile.TemporaryDirectory(prefix="yy-m0-payload-") as tmp:
            base = Path(tmp)
            workspace = base / "workspace"
            workspace.mkdir()
            seed_workspace(workspace)
            registry = base / "bindings.json"
            registry.write_text(
                json.dumps(
                    {
                        "schema": "yy/read-bindings@1",
                        "workspaces": [
                            {
                                "workflow_id": "measurement",
                                "workspace_root": str(workspace),
                                "session": None,
                                "enabled": True,
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            os.environ["YY_READONLY_ENABLED"] = "true"
            os.environ["YY_READONLY_BINDINGS"] = str(registry)
            schemas = await readonly.mcp.list_tools()
            schema_values = [
                tool.to_mcp_tool().model_dump(mode="json", by_alias=True, exclude_none=True)
                for tool in schemas
            ]
            async with Client(readonly.mcp) as client:
                snapshot_result = await client.call_tool(
                    "yy_open_workflow", {"workflow_id": "measurement"}
                )
                catalog_result = await client.call_tool(
                    "yy_list_assets", {"workflow_id": "measurement", "page_size": 1}
                )
                catalog = decode_result(catalog_result)
                read_ref = catalog["data"]["assets"][0]["read_ref"]
                toc_result = await client.call_tool(
                    "yy_read_asset", {"workflow_id": "measurement", "read_ref": read_ref}
                )
            samples = {
                "snapshot_tool_result": tool_result_object(snapshot_result),
                "asset_catalog_page_tool_result": tool_result_object(catalog_result),
                "asset_toc_tool_result": tool_result_object(toc_result),
            }
            measurements = {
                name: {
                    "utf8_bytes": compact_bytes(value),
                    "token_count": None,
                    "tokenizer_status": "UNAVAILABLE",
                }
                for name, value in samples.items()
            }
            wrappers = {}
            for count in (1, 2, 4):
                items = [samples["snapshot_tool_result"] for _ in range(count)]
                wrappers[str(count)] = {
                    "utf8_bytes": compact_bytes({"mcp_results": items}),
                    "token_count": None,
                    "tokenizer_status": "UNAVAILABLE",
                }
            return {
                "schema": "yy/web-payload-measurement@1",
                "measured_at": datetime.now(timezone.utc).isoformat(),
                "fixture": "synthetic local workspace; no production data",
                "runtime": {
                    "python": platform.python_version(),
                    "fastmcp": fastmcp.__version__,
                    "node": subprocess.run(
                        ["node", "--version"],
                        capture_output=True,
                        text=True,
                        check=False,
                    ).stdout.strip(),
                },
                "tool_count": len(schema_values),
                "tool_names": [item["name"] for item in schema_values],
                "serialized_tool_definitions": {
                    "utf8_bytes": compact_bytes(schema_values),
                    "token_count": None,
                    "tokenizer_status": "UNAVAILABLE",
                },
                "serialized_samples": measurements,
                "repeated_snapshot_wrappers": wrappers,
                "accounting_note": (
                    "UTF-8 byte counts measure these local serialized objects only. "
                    "They do not measure ChatGPT hidden context, server wrappers, or target-model tokens."
                ),
            }
    finally:
        if prior_enabled is None:
            os.environ.pop("YY_READONLY_ENABLED", None)
        else:
            os.environ["YY_READONLY_ENABLED"] = prior_enabled
        if prior_bindings is None:
            os.environ.pop("YY_READONLY_BINDINGS", None)
        else:
            os.environ["YY_READONLY_BINDINGS"] = prior_bindings


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = await measure()
    serialized = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        target = args.output if args.output.is_absolute() else ROOT / args.output
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(serialized, encoding="utf-8")
    else:
        print(serialized, end="")


if __name__ == "__main__":
    asyncio.run(main())
