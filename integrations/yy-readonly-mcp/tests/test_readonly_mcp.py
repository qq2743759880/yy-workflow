from __future__ import annotations

import asyncio
import base64
import hashlib
import importlib.util
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

from fastmcp import Client
from fastmcp.client.transports import StdioTransport


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
SERVER_PATH = REPOSITORY_ROOT / "integrations" / "yy-readonly-mcp" / "server.py"
SPEC = importlib.util.spec_from_file_location("yy_readonly_server", SERVER_PATH)
assert SPEC and SPEC.loader
readonly = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(readonly)


def write_fixture(root: Path, workflow_id: str, glyph: str, in_progress: bool = True) -> None:
    state_dir = root / ".tt-state"
    state_dir.mkdir(parents=True, exist_ok=True)
    (state_dir / "state.json").write_text(
        json.dumps(
            {
                "id": workflow_id,
                "status": "planning",
                "subtasks": [],
                "fixture_text": glyph * 300,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    steps = [
        {
            "step": index,
            "name": f"fixture-{index}",
            "status": "in_progress" if in_progress and index == 0 else "pending",
            "gates_passed": [],
            "artifacts": [],
            "updated_at": "2026-09-27T00:00:00.000Z",
        }
        for index in range(9)
    ]
    steps.insert(
        2,
        {
            "step": 1.5,
            "name": "研究门",
            "status": "in_progress" if in_progress else "pending",
            "gates_passed": [],
            "artifacts": [],
            "updated_at": "2026-09-27T00:00:00.000Z",
        },
    )
    (state_dir / "journey.json").write_text(
        json.dumps(
            {
                "schema": "yy/journey@1",
                "steps": steps,
                "plans": [],
                "updated_at": "2026-09-27T00:00:00.000Z",
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


def response_data(result):
    structured = getattr(result, "structuredContent", None)
    if isinstance(structured, dict):
        return structured
    for block in getattr(result, "content", []):
        text = getattr(block, "text", None)
        if text:
            try:
                value = json.loads(text)
                if isinstance(value, dict):
                    return value
            except json.JSONDecodeError:
                continue
    raise AssertionError(f"Tool returned no JSON object: {result!r}")


def workspace_fingerprint(root: Path):
    items = []
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root).as_posix()
        stat = path.lstat()
        if path.is_dir():
            items.append((relative, "dir", stat.st_mtime_ns))
        elif path.is_file():
            items.append((relative, hashlib.sha256(path.read_bytes()).hexdigest(), stat.st_mtime_ns))
        else:
            items.append((relative, "other", stat.st_mtime_ns))
    return items


class ReadonlyMcpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix="yy-readonly-mcp-")
        cls.base = Path(cls.tmp.name)
        cls.workspace_a = cls.base / "workspace-a"
        cls.workspace_b = cls.base / "workspace-b"
        cls.workspace_many = cls.base / "workspace-many"
        cls.workspace_pending = cls.base / "workspace-pending"
        cls.workspace_rf1 = cls.base / "workspace-rf1-evidence-fixture"
        cls.workspace_a.mkdir()
        cls.workspace_b.mkdir()
        cls.workspace_many.mkdir()
        cls.workspace_pending.mkdir()
        cls.workspace_rf1.mkdir()
        write_fixture(cls.workspace_a, "workflow-a", "猫")
        write_fixture(cls.workspace_b, "workflow-b", "树")
        write_fixture(cls.workspace_many, "workflow-many", "竹")
        write_fixture(cls.workspace_pending, "workflow-pending", "石", in_progress=False)
        write_fixture(cls.workspace_rf1, "workflow-rf1-fixture", "證")
        old_rf1 = REPOSITORY_ROOT / "test-reports" / "autopilot-work" / "E2E-v3" / "RESULTS.md"
        new_rf1 = REPOSITORY_ROOT / "test-reports" / "autopilot-work" / "E2E-v3-contract-route-20260927T171036" / "RESULTS.md"
        for run_name, report in (("E2E-v3", old_rf1), ("E2E-v3-contract-route-20260927T171036", new_rf1)):
            artifact = cls.workspace_rf1 / "artifacts" / run_name
            artifact.mkdir(parents=True)
            (artifact / "result.txt").write_text(report.read_text(encoding="utf-8"), encoding="utf-8")
        for index in range(105):
            artifact = cls.workspace_many / "artifacts" / f"task-{index:03d}"
            artifact.mkdir(parents=True)
            (artifact / "receipt.json").write_text(
                json.dumps({"subtaskId": f"task-{index:03d}", "events": []}),
                encoding="utf-8",
            )
        cls.bindings = cls.base / "bindings.json"
        cls.bindings.write_text(
            json.dumps(
                {
                    "schema": "yy/read-bindings@1",
                    "workspaces": [
                        {"workflow_id": "workflow-a", "workspace_root": str(cls.workspace_a), "session": None, "enabled": True},
                        {"workflow_id": "workflow-b", "workspace_root": str(cls.workspace_b), "session": None, "enabled": True},
                        {"workflow_id": "workflow-many", "workspace_root": str(cls.workspace_many), "session": None, "enabled": True},
                        {"workflow_id": "workflow-pending", "workspace_root": str(cls.workspace_pending), "session": None, "enabled": True},
                        {"workflow_id": "workflow-rf1-fixture", "workspace_root": str(cls.workspace_rf1), "session": None, "enabled": True},
                    ],
                }
            ),
            encoding="utf-8",
        )
        os.environ["YY_READONLY_ENABLED"] = "true"
        os.environ["YY_READONLY_BINDINGS"] = str(cls.bindings)

    @classmethod
    def tearDownClass(cls):
        os.environ.pop("YY_READONLY_ENABLED", None)
        os.environ.pop("YY_READONLY_BINDINGS", None)
        cls.tmp.cleanup()

    def test_exactly_six_read_only_tools_are_registered(self):
        async def run():
            tools = await readonly.mcp.list_tools()
            return {tool.name for tool in tools}

        self.assertEqual(
            asyncio.run(run()),
            {
                "yy_open_workflow",
                "yy_get_snapshot",
                "yy_get_stage",
                "yy_list_assets",
                "yy_read_asset",
                "yy_read_evidence",
            },
        )

    def test_stdio_mcp_handshake_exposes_and_calls_only_yy_surface(self):
        async def run():
            transport = StdioTransport(
                command=sys.executable,
                args=[str(SERVER_PATH)],
                env=os.environ.copy(),
                cwd=str(REPOSITORY_ROOT),
            )
            async with Client(transport) as client:
                tools = await client.list_tools()
                names = {tool.name for tool in tools}
                result = response_data(
                    await client.call_tool(
                        "yy_open_workflow",
                        {"workflow_id": "workflow-a"},
                    )
                )
                return names, result

        names, result = asyncio.run(run())
        self.assertEqual(
            names,
            {
                "yy_open_workflow",
                "yy_get_snapshot",
                "yy_get_stage",
                "yy_list_assets",
                "yy_read_asset",
                "yy_read_evidence",
            },
        )
        self.assertTrue(result["ok"], result)

    def test_two_workflows_are_isolated_and_open_has_no_side_effect(self):
        before_a = hashlib.sha256((self.workspace_a / ".tt-state" / "state.json").read_bytes()).hexdigest()
        before_b = hashlib.sha256((self.workspace_b / ".tt-state" / "state.json").read_bytes()).hexdigest()

        async def run():
            async with Client(readonly.mcp) as client:
                result_a = response_data(await client.call_tool("yy_open_workflow", {"workflow_id": "workflow-a"}))
                result_b = response_data(await client.call_tool("yy_open_workflow", {"workflow_id": "workflow-b"}))
                return result_a, result_b

        a, b = asyncio.run(run())
        self.assertTrue(a["ok"], a)
        self.assertTrue(b["ok"], b)
        self.assertEqual(a["data"]["workflow_id"], "workflow-a")
        self.assertEqual(b["data"]["workflow_id"], "workflow-b")
        self.assertNotEqual(a["data"]["source_digest"], b["data"]["source_digest"])
        self.assertEqual(a["data"]["research_gate"]["status"], "in_progress")
        self.assertEqual(
            hashlib.sha256((self.workspace_a / ".tt-state" / "state.json").read_bytes()).hexdigest(),
            before_a,
        )
        self.assertEqual(
            hashlib.sha256((self.workspace_b / ".tt-state" / "state.json").read_bytes()).hexdigest(),
            before_b,
        )

    def test_all_six_tools_leave_the_bound_workspace_unchanged(self):
        before = workspace_fingerprint(self.workspace_a)

        async def run():
            async with Client(readonly.mcp) as client:
                opened = response_data(await client.call_tool("yy_open_workflow", {"workflow_id": "workflow-a"}))
                self.assertTrue(opened["ok"], opened)
                snapshot = response_data(await client.call_tool(
                    "yy_get_snapshot",
                    {"workflow_id": "workflow-a", "snapshot_id": opened["data"]["snapshot_id"]},
                ))
                self.assertTrue(snapshot["ok"], snapshot)
                stage = response_data(await client.call_tool("yy_get_stage", {"workflow_id": "workflow-a", "step": 0}))
                self.assertTrue(stage["ok"], stage)
                catalog = response_data(await client.call_tool("yy_list_assets", {"workflow_id": "workflow-a", "page_size": 1}))
                self.assertTrue(catalog["ok"], catalog)
                asset = response_data(await client.call_tool(
                    "yy_read_asset",
                    {"workflow_id": "workflow-a", "read_ref": catalog["data"]["assets"][0]["read_ref"]},
                ))
                self.assertTrue(asset["ok"], asset)
                ref = next(item for item in opened["data"]["evidence_refs"] if item["source_kind"] == "state")
                evidence = response_data(await client.call_tool(
                    "yy_read_evidence",
                    {
                        "workflow_id": "workflow-a",
                        "evidence_ref": ref["evidence_ref"],
                        "snapshot_id": opened["data"]["snapshot_id"],
                    },
                ))
                self.assertTrue(evidence["ok"], evidence)

        asyncio.run(run())
        self.assertEqual(workspace_fingerprint(self.workspace_a), before)

    def test_unknown_binding_does_not_disclose_workspace(self):
        async def run():
            async with Client(readonly.mcp) as client:
                return response_data(await client.call_tool("yy_open_workflow", {"workflow_id": "not-bound"}))

        result = asyncio.run(run())
        self.assertFalse(result["ok"])
        self.assertEqual(result["code"], "WORKFLOW_NOT_FOUND")
        self.assertNotIn(str(self.workspace_a), json.dumps(result))
        self.assertNotIn(str(self.workspace_b), json.dumps(result))

    def test_snapshot_evidence_refs_page_without_mixing_versions(self):
        async def run():
            async with Client(readonly.mcp) as client:
                first = response_data(
                    await client.call_tool("yy_open_workflow", {"workflow_id": "workflow-many"})
                )
                self.assertTrue(first["ok"], first)
                self.assertFalse(first["data"]["complete"])
                self.assertFalse(first["data"]["evidence_refs_complete"])
                self.assertEqual(len(first["data"]["evidence_refs"]), 100)
                second = response_data(
                    await client.call_tool(
                        "yy_get_snapshot",
                        {
                            "workflow_id": "workflow-many",
                            "snapshot_id": first["data"]["snapshot_id"],
                            "cursor": first["data"]["next_cursor"],
                        },
                    )
                )
                return first, second

        first, second = asyncio.run(run())
        self.assertTrue(second["ok"], second)
        self.assertTrue(second["data"]["complete"])
        self.assertTrue(second["data"]["evidence_refs_complete"])
        self.assertEqual(second["data"]["snapshot_id"], first["data"]["snapshot_id"])
        refs = first["data"]["evidence_refs"] + second["data"]["evidence_refs"]
        self.assertEqual(len(refs), len({item["evidence_ref"] for item in refs}))
        self.assertGreater(len(refs), 100)

    def test_core_stage_and_legacy_research_gate_stay_separate(self):
        async def run():
            async with Client(readonly.mcp) as client:
                legacy = response_data(
                    await client.call_tool(
                        "yy_get_stage",
                        {"workflow_id": "workflow-a", "step": 1.5},
                    )
                )
                core = response_data(
                    await client.call_tool(
                        "yy_get_stage",
                        {"workflow_id": "workflow-a", "step": 0},
                    )
                )
                return legacy, core

        legacy, core = asyncio.run(run())
        self.assertTrue(legacy["ok"], legacy)
        self.assertEqual(legacy["data"]["kind"], "legacy_research_gate")
        self.assertEqual(legacy["data"]["gate"], "research-done")
        self.assertTrue(core["ok"], core)
        self.assertEqual(core["data"]["step"], 0)
        self.assertNotEqual(core["data"].get("kind"), "legacy_research_gate")
        self.assertTrue(core["data"]["goal"])
        self.assertTrue(core["data"]["command_source"]["sha256"])
        self.assertIsNone(core["data"]["exit_conditions"])

    def test_stage_uses_authoritative_current_projection_when_no_step_is_in_progress(self):
        async def run():
            async with Client(readonly.mcp) as client:
                snapshot = response_data(await client.call_tool("yy_open_workflow", {"workflow_id": "workflow-pending"}))
                stage = response_data(await client.call_tool("yy_get_stage", {"workflow_id": "workflow-pending"}))
                return snapshot, stage

        snapshot, stage = asyncio.run(run())
        self.assertTrue(stage["ok"], {"journey": snapshot["data"]["journey"], "stage": stage})
        current = snapshot["data"]["journey"]["current"]["step"]
        self.assertEqual(stage["data"]["step"], current)

    def test_unissued_evidence_ref_and_too_small_budget_are_distinct(self):
        async def run():
            async with Client(readonly.mcp) as client:
                opened = response_data(await client.call_tool("yy_open_workflow", {"workflow_id": "workflow-a"}))
                hidden = response_data(
                    await client.call_tool(
                        "yy_read_evidence",
                        {
                            "workflow_id": "workflow-a",
                            "evidence_ref": "ev-not-issued",
                            "snapshot_id": opened["data"]["snapshot_id"],
                        },
                    )
                )
                ref = next(item for item in opened["data"]["evidence_refs"] if item["source_kind"] == "state")
                budget = response_data(
                    await client.call_tool(
                        "yy_read_evidence",
                        {
                            "workflow_id": "workflow-a",
                            "evidence_ref": ref["evidence_ref"],
                            "snapshot_id": opened["data"]["snapshot_id"],
                            "max_bytes": 1,
                        },
                    )
                )
                return hidden, budget

        hidden, budget = asyncio.run(run())
        self.assertFalse(hidden["ok"])
        self.assertEqual(hidden["code"], "FILE_NOT_VISIBLE")
        self.assertFalse(budget["ok"])
        self.assertEqual(budget["code"], "BUDGET_EXHAUSTED")

    def test_evidence_pages_are_unicode_safe_and_source_change_is_rejected(self):
        async def run():
            async with Client(readonly.mcp) as client:
                opened = response_data(await client.call_tool("yy_open_workflow", {"workflow_id": "workflow-a"}))
                refs = opened["data"]["evidence_refs"]
                self.assertTrue(refs, opened)
                ref = next(item for item in refs if item["source_kind"] == "state")
                page1 = response_data(
                    await client.call_tool(
                        "yy_read_evidence",
                        {
                            "workflow_id": "workflow-a",
                            "evidence_ref": ref["evidence_ref"],
                            "snapshot_id": opened["data"]["snapshot_id"],
                            "max_bytes": 64,
                        },
                    )
                )
                self.assertTrue(page1["ok"], page1)
                page = page1["data"]
                self.assertLessEqual(len(page["content"].encode("utf-8")), 64)
                self.assertFalse(page["complete"])
                page2 = response_data(
                    await client.call_tool(
                        "yy_read_evidence",
                        {
                            "workflow_id": "workflow-a",
                            "evidence_ref": ref["evidence_ref"],
                            "snapshot_id": opened["data"]["snapshot_id"],
                            "cursor": page["next_cursor"],
                            "max_bytes": 64,
                        },
                    )
                )
                self.assertTrue(page2["ok"], page2)
                self.assertNotEqual(page["content"], page2["data"]["content"])

                state_file = self.workspace_a / ".tt-state" / "state.json"
                state = json.loads(state_file.read_text(encoding="utf-8"))
                state["fixture_text"] += "变更"
                state_file.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
                stale = response_data(
                    await client.call_tool(
                        "yy_read_evidence",
                        {
                            "workflow_id": "workflow-a",
                            "evidence_ref": ref["evidence_ref"],
                            "snapshot_id": opened["data"]["snapshot_id"],
                            "cursor": page["next_cursor"],
                            "max_bytes": 64,
                        },
                    )
                )
                self.assertFalse(stale["ok"])
                self.assertEqual(stale["code"], "STALE_VERSION")

        asyncio.run(run())

    def test_m1_reader_surfaces_historical_and_superseding_rf1_evidence(self):
        async def run():
            async with Client(readonly.mcp) as client:
                opened = response_data(await client.call_tool(
                    "yy_open_workflow", {"workflow_id": "workflow-rf1-fixture"}
                ))
                refs = opened["data"]["evidence_refs"]
                old_ref = next(
                    item for item in refs
                    if item["path"].endswith("artifacts/E2E-v3/result.txt")
                )
                new_ref = next(
                    item for item in refs
                    if item["path"].endswith("artifacts/E2E-v3-contract-route-20260927T171036/result.txt")
                )
                old_result = response_data(await client.call_tool(
                    "yy_read_evidence",
                    {
                        "workflow_id": "workflow-rf1-fixture",
                        "evidence_ref": old_ref["evidence_ref"],
                        "snapshot_id": opened["data"]["snapshot_id"],
                        "max_bytes": 64_000,
                    },
                ))
                current_result = response_data(await client.call_tool(
                    "yy_read_evidence",
                    {
                        "workflow_id": "workflow-rf1-fixture",
                        "evidence_ref": new_ref["evidence_ref"],
                        "snapshot_id": opened["data"]["snapshot_id"],
                        "max_bytes": 64_000,
                    },
                ))
                return old_result, current_result

        historical, current = asyncio.run(run())
        self.assertTrue(historical["ok"], historical)
        self.assertTrue(current["ok"], current)
        self.assertTrue(historical["data"]["complete"])
        self.assertTrue(current["data"]["complete"])
        self.assertIn("F-E2E-3", historical["data"]["content"])
        content = current["data"]["content"]
        self.assertIn("F-E2E-3 = CLOSED FOR CURRENT HEAD", content)
        self.assertIn("supersedes historical F-E2E-3 evidence", content)
        self.assertIn("pass=true", content)
        self.assertIn("degraded=false", content)
        self.assertIn("pass=null", content)
        self.assertIn("degraded=true", content)
        self.assertIn("valid `--contract`", content)
        self.assertIn("Non-OpenAPI JSON + OpenAPI capability", content)
        self.assertIn("--contract-draft", content)
        self.assertIn("| `--contract-draft` | exit 0, `done`", content)

    def test_assets_are_dynamic_and_critical_sections_are_not_truncated(self):
        async def run():
            async with Client(readonly.mcp) as client:
                first = response_data(
                    await client.call_tool("yy_list_assets", {"workflow_id": "workflow-a", "page_size": 1})
                )
                self.assertTrue(first["ok"], first)
                self.assertEqual(len(first["data"]["assets"]), 1)
                self.assertIsNotNone(first["data"]["next_cursor"])
                second = response_data(
                    await client.call_tool(
                        "yy_list_assets",
                        {
                            "workflow_id": "workflow-a",
                            "page_size": 1,
                            "cursor": first["data"]["next_cursor"],
                        },
                    )
                )
                self.assertTrue(second["ok"], second)
                self.assertNotEqual(
                    first["data"]["assets"][0]["asset_id"],
                    second["data"]["assets"][0]["asset_id"],
                )
                card = first["data"]["assets"][0]
                toc = response_data(
                    await client.call_tool(
                        "yy_read_asset",
                        {"workflow_id": "workflow-a", "read_ref": card["read_ref"]},
                    )
                )
                self.assertTrue(toc["ok"], toc)
                self.assertFalse(toc["data"]["complete"])
                self.assertTrue(toc["data"]["toc_complete"])
                self.assertFalse(toc["data"]["content_complete"])
                self.assertTrue(all(section["critical"] for section in toc["data"]["sections"]))
                critical = next((s for s in toc["data"]["sections"] if s["critical"] and s["bytes"] > 64), None)
                if critical:
                    refused = response_data(
                        await client.call_tool(
                            "yy_read_asset",
                            {
                                "workflow_id": "workflow-a",
                                "read_ref": card["read_ref"],
                                "section_id": critical["section_id"],
                                "max_bytes": 64,
                            },
                        )
                    )
                    self.assertFalse(refused["ok"])
                    self.assertEqual(refused["code"], "CORE_CONTEXT_TOO_LARGE")

                forged = base64.urlsafe_b64encode(
                    json.dumps({
                        "workflow_id": "workflow-a",
                        "catalog_digest": first["data"]["catalog_digest"],
                        "offset": -1,
                    }).encode("utf-8")
                ).decode("ascii").rstrip("=")
                bad_cursor = response_data(await client.call_tool(
                    "yy_list_assets",
                    {"workflow_id": "workflow-a", "cursor": forged, "page_size": 1},
                ))
                self.assertFalse(bad_cursor["ok"])
                self.assertEqual(bad_cursor["code"], "STALE_VERSION")

                oversized_cursor = response_data(await client.call_tool(
                    "yy_list_assets",
                    {"workflow_id": "workflow-a", "cursor": "x" * 4097, "page_size": 1},
                ))
                self.assertFalse(oversized_cursor["ok"])
                self.assertEqual(oversized_cursor["code"], "STALE_VERSION")

                section = toc["data"]["sections"][0]
                forged_asset_cursor = base64.urlsafe_b64encode(
                    json.dumps({
                        "workflow_id": "workflow-a",
                        "asset_id": card["read_ref"],
                        "section_id": section["section_id"],
                        "sha256": toc["data"]["source_version"]["sha256"],
                        "offset": section["bytes"] + 1,
                    }).encode("utf-8")
                ).decode("ascii").rstrip("=")
                bad_asset_offset = response_data(await client.call_tool(
                    "yy_read_asset",
                    {
                        "workflow_id": "workflow-a",
                        "read_ref": card["read_ref"],
                        "section_id": section["section_id"],
                        "cursor": forged_asset_cursor,
                    },
                ))
                self.assertFalse(bad_asset_offset["ok"])
                self.assertEqual(bad_asset_offset["code"], "STALE_VERSION")

        asyncio.run(run())

    def test_oversized_authority_files_are_rejected_before_core_projection(self):
        state_file = self.workspace_a / ".tt-state" / "state.json"
        original = state_file.read_bytes()
        try:
            state_file.write_bytes(b"x" * 4_000_001)

            async def run():
                async with Client(readonly.mcp) as client:
                    return response_data(await client.call_tool("yy_open_workflow", {"workflow_id": "workflow-a"}))

            result = asyncio.run(run())
            self.assertFalse(result["ok"])
            self.assertEqual(result["code"], "RESOURCE_LIMIT")
        finally:
            state_file.write_bytes(original)

    def test_kill_switch_fails_closed(self):
        os.environ["YY_READONLY_ENABLED"] = "false"
        try:
            response = readonly._call("open_workflow", workflow_id="workflow-a")
            self.assertFalse(response["ok"])
            self.assertEqual(response["code"], "MCP_DISABLED")
        finally:
            os.environ["YY_READONLY_ENABLED"] = "true"

    def test_bridge_request_and_stdout_have_hard_byte_limits(self):
        too_large = readonly._call("open_workflow", workflow_id="workflow-a", payload="x" * 70_000)
        self.assertFalse(too_large["ok"])
        self.assertEqual(too_large["code"], "INPUT_TOO_LARGE")

        node = shutil.which("node")
        if not node:
            self.skipTest("Node.js is required for the bounded stdout check")
        fake_bridge = self.base / "oversized-output.mjs"
        fake_bridge.write_text("process.stdout.write('x'.repeat(300001));", encoding="utf-8")
        original_bridge = readonly.BRIDGE
        original_node = os.environ.get("YY_READONLY_NODE")
        try:
            readonly.BRIDGE = fake_bridge
            os.environ["YY_READONLY_NODE"] = node
            too_large_output = readonly._call("open_workflow", workflow_id="workflow-a")
            self.assertFalse(too_large_output["ok"])
            self.assertEqual(too_large_output["code"], "BRIDGE_OUTPUT_TOO_LARGE")
        finally:
            readonly.BRIDGE = original_bridge
            if original_node is None:
                os.environ.pop("YY_READONLY_NODE", None)
            else:
                os.environ["YY_READONLY_NODE"] = original_node


if __name__ == "__main__":
    unittest.main()
