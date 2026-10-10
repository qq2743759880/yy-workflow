"""Bounded M1 adapter to a pinned legacy read implementation.

The pin verifies compatibility-source integrity, not current Core/V2 decision
semantics. M1 is never the canonical stage authority.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import threading
import time
from pathlib import Path
from typing import Any

from binding_boundary import SCOPE_LEVELS, resolve_binding


def _select_authority_root(package: Path) -> Path | None:
    """Trusted deployment location only; revision/tree/blob pins remain frozen."""
    configured = os.environ.get("YY_M1_AUTHORITY_ROOT")
    local = package / "runtime" / "m1-source.local.json"
    if configured is None:
        try:
            document = json.loads(local.read_text(encoding="utf-8"))
            if not isinstance(document, dict) or document.get("schema") != "yy/m1-source@1":
                return None
            configured = document.get("root")
            if not isinstance(configured, str) or not configured:
                return None
        except FileNotFoundError:
            return package.parent.parent / "compatibility" / "m1-source"
        except (OSError, ValueError):
            return None
    root = Path(configured)
    return root if root.is_absolute() else None


AUTHORITY_ROOT = _select_authority_root(Path(__file__).resolve().parent)
BRIDGE = AUTHORITY_ROOT / "integrations" / "yy-readonly-mcp" / "bridge.mjs" if AUTHORITY_ROOT else None
EXPECTED_HEAD = "8740a391bdc36b7822a6e8701b7d048837a20f1a"
EXPECTED_TREE = "5f18fb6c8fbbcb1aa0f983d8282f237eb75b55e2"
EXPECTED_MANIFEST_SHA256 = "4ffdb190da5043fa7360dd15e5282c84022f388a46a170f2047db64682f15a87"
PINNED_BLOBS = {
    "contracts/asset-manifest-v2.json": "99514e805b48c47e1f976c1d14eff101a248b639",
    "integrations/yy-readonly-mcp/bridge.mjs": "9c3b4e49139f6517e54c6db4cce5668fac791cb4",
    "integrations/yy-readonly-mcp/server.py": "7a68471f96d95c3bb52d19e614d22e5e87f56294",
    "scripts/lib/asset.mjs": "a001e8425c6b9f2af5e29c3acd665f113beee9b4",
    "scripts/lib/journey.mjs": "a9c504ffdb9c1a4e701d5195db3b8cd7d10195b9",
    "scripts/lib/manifest.mjs": "c279bef46e20bbe1230f32563a1f92b46365f172",
    "scripts/lib/phase.mjs": "65d9b14bd2ef6b999a502943c155cc517604e2e1",
    "SKILL.md": "42a3cc31861f2e14fb9170ecf75c57f98f05a707",
}
MAX_REQUEST_BYTES = 65_536
MAX_STDOUT_BYTES = 256_000
MAX_STDERR_BYTES = 65_536
TIMEOUT_SECONDS = 20
ALLOWED_CODES = {
    "ASSET_DISCOVERY_FAILED", "ASSET_MANIFEST_INVALID", "ASSET_NOT_FOUND",
    "AUTHORITY_REVISION_MISMATCH", "BRIDGE_DIAGNOSTIC_TOO_LARGE",
    "BRIDGE_INVALID_RESPONSE", "BRIDGE_OUTPUT_TOO_LARGE", "BRIDGE_TIMEOUT",
    "BRIDGE_UNAVAILABLE", "BUDGET_EXHAUSTED", "CONFIGURATION_ERROR",
    "CORE_CONTEXT_TOO_LARGE", "EVIDENCE_REF_INVALID", "FILE_NOT_FOUND",
    "FILE_NOT_VISIBLE", "INPUT_INVALID", "INPUT_TOO_LARGE", "INVALID_STEP",
    "MCP_DISABLED", "OPERATION_NOT_ALLOWED", "READ_FAILED", "RESOURCE_LIMIT",
    "SECTION_NOT_FOUND", "SNAPSHOT_INCONSISTENT", "SOURCE_CHANGED",
    "STAGE_UNKNOWN", "STALE_VERSION", "WORKFLOW_NOT_FOUND",
    "WORKSPACE_NOT_AUTHORIZED",
}
ALLOWED_OPERATIONS = {
    "open_workflow", "get_snapshot", "get_stage", "list_assets", "read_asset", "read_evidence"
}
LEGACY_AUTHORITY = {
    "classification": "LEGACY_COMPATIBILITY",
    "canonical_stage_authority": False,
    "stage_decision_authority": "Core/V2",
    "read_only": True,
}
_ABSOLUTE_PATH = re.compile(r"(?i)(?:[a-z]:\\|\\\\[^\\])")


def _error(code: str, message: str) -> dict[str, Any]:
    # Classification is transport metadata, never evidence of a successful pin.
    return {"ok": False, "code": code, "data": {}, "evidence": {}, "warnings": [message],
            "authority": dict(LEGACY_AUTHORITY)}


def _git(*args: str) -> str:
    result = subprocess.run(
        [os.environ.get("YY_READONLY_GIT", "git"), "-C", str(AUTHORITY_ROOT), *args],
        check=True,
        capture_output=True,
        text=True,
        timeout=5,
        stdin=subprocess.DEVNULL,
    )
    return result.stdout.strip()


def _verify_authority() -> dict[str, str] | None:
    if AUTHORITY_ROOT is None or BRIDGE is None:
        return None
    try:
        root = AUTHORITY_ROOT.resolve(strict=True)
        if os.path.normcase(str(root)) != os.path.normcase(str(AUTHORITY_ROOT)):
            return None
        identity = _git("rev-parse", "HEAD", "HEAD^{tree}").splitlines()
        if identity != [EXPECTED_HEAD, EXPECTED_TREE]:
            return None
        if _git("status", "--porcelain=v1", "--untracked-files=no", "--", *PINNED_BLOBS):
            return None
        tree_rows = _git("ls-tree", "-r", "--full-tree", "HEAD", "--", *PINNED_BLOBS).splitlines()
        actual_blobs = {}
        for row in tree_rows:
            metadata, relative = row.split("\t", 1)
            actual_blobs[relative] = metadata.split()[2]
        if actual_blobs != PINNED_BLOBS:
            return None
        rows: list[str] = []
        for relative, expected_oid in PINNED_BLOBS.items():
            rows.append(f"{relative}\t{actual_blobs[relative]}")
        manifest = hashlib.sha256("\n".join(rows).encode("utf-8")).hexdigest()
        if manifest != EXPECTED_MANIFEST_SHA256 or not BRIDGE.is_file():
            return None
        return {"git_commit": EXPECTED_HEAD, "git_tree": EXPECTED_TREE, "manifest_sha256": manifest}
    except (OSError, subprocess.SubprocessError, ValueError, IndexError):
        return None


def _valid_response(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    if not isinstance(value.get("ok"), bool):
        return False
    code = value.get("code")
    if code is not None and (not isinstance(code, str) or code not in ALLOWED_CODES):
        return False
    if not isinstance(value.get("data"), dict) or not isinstance(value.get("evidence"), dict):
        return False
    warnings = value.get("warnings")
    if not isinstance(warnings, list) or any(not isinstance(item, str) or len(item) > 4096 for item in warnings):
        return False
    if value["ok"] and value["code"] is not None:
        return False
    if not value["ok"] and value["code"] is None:
        return False
    if not value["ok"] and (value["data"] or value["evidence"]):
        return False
    # Failure warnings are replaced with a static safe message by the caller.
    # Success warnings are forwarded with the authority result and must be safe.
    return not value["ok"] or not any(_ABSOLUTE_PATH.search(item) for item in warnings)


def _read_capped(stream: Any, limit: int, captured: list[bytes], overflow: list[bool], failures: list[Exception]) -> None:
    """Drain a child pipe while retaining at most limit + 1 bytes."""
    data = bytearray()
    try:
        while True:
            chunk = stream.read(8192)
            if not chunk:
                break
            remaining = limit + 1 - len(data)
            if remaining > 0:
                data.extend(chunk[:remaining])
            if len(data) > limit:
                overflow[0] = True
    except Exception as exc:  # Keep subprocess details out of the Web response.
        failures.append(exc)
    finally:
        captured.append(bytes(data))


def _write_request(stream: Any, payload: bytes, failures: list[Exception]) -> None:
    try:
        stream.write(payload)
        stream.flush()
    except BrokenPipeError:
        pass
    except Exception as exc:  # Keep subprocess details out of the Web response.
        failures.append(exc)
    finally:
        try:
            stream.close()
        except Exception:
            pass


def _terminate(process: Any) -> None:
    try:
        process.kill()
    except (OSError, ProcessLookupError):
        pass
    try:
        process.wait(timeout=5)
    except (subprocess.TimeoutExpired, OSError):
        pass
    for stream in (getattr(process, "stdin", None), getattr(process, "stdout", None), getattr(process, "stderr", None)):
        if stream is not None:
            try:
                stream.close()
            except Exception:
                pass


def _run_bounded(process: Any, request: bytes) -> tuple[bytes, bytes, int, str | None]:
    """Run a bridge child with bounded retained output and a wall-clock limit."""
    stdout_data: list[bytes] = []
    stderr_data: list[bytes] = []
    stdout_overflow = [False]
    stderr_overflow = [False]
    failures: list[Exception] = []
    readers = [
        threading.Thread(
            target=_read_capped,
            args=(process.stdout, MAX_STDOUT_BYTES, stdout_data, stdout_overflow, failures),
            daemon=True,
        ),
        threading.Thread(
            target=_read_capped,
            args=(process.stderr, MAX_STDERR_BYTES, stderr_data, stderr_overflow, failures),
            daemon=True,
        ),
    ]
    writer = threading.Thread(target=_write_request, args=(process.stdin, request, failures), daemon=True)
    for thread in (*readers, writer):
        thread.start()

    deadline = time.monotonic() + TIMEOUT_SECONDS
    returncode: int | None = None
    failure_code: str | None = None
    while True:
        if stdout_overflow[0]:
            failure_code = "BRIDGE_OUTPUT_TOO_LARGE"
            break
        if stderr_overflow[0]:
            failure_code = "BRIDGE_DIAGNOSTIC_TOO_LARGE"
            break
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            failure_code = "BRIDGE_TIMEOUT"
            break
        try:
            returncode = process.wait(timeout=min(0.05, remaining))
            break
        except subprocess.TimeoutExpired:
            continue
        except (OSError, subprocess.SubprocessError):
            failure_code = "BRIDGE_UNAVAILABLE"
            break

    if failure_code is not None:
        _terminate(process)
    else:
        writer.join(timeout=1)
        for thread in readers:
            thread.join(timeout=1)
        if any(thread.is_alive() for thread in (*readers, writer)) or failures:
            _terminate(process)
            failure_code = "BRIDGE_UNAVAILABLE"
        elif stdout_overflow[0]:
            failure_code = "BRIDGE_OUTPUT_TOO_LARGE"
        elif stderr_overflow[0]:
            failure_code = "BRIDGE_DIAGNOSTIC_TOO_LARGE"
        else:
            for stream in (process.stdout, process.stderr):
                try:
                    stream.close()
                except Exception:
                    pass

    if failure_code is not None:
        for thread in (*readers, writer):
            thread.join(timeout=0.1)
    stdout = stdout_data[0] if stdout_data else b""
    stderr = stderr_data[0] if stderr_data else b""
    return stdout, stderr, returncode if returncode is not None else getattr(process, "returncode", -1), failure_code


def _extract_response(stdout: bytes) -> dict[str, Any] | None:
    """Find exactly one contract envelope amid line-oriented stdout diagnostics."""
    try:
        text = stdout.decode("utf-8")
    except UnicodeDecodeError:
        return None
    decoder = json.JSONDecoder()
    responses: list[dict[str, Any]] = []
    position = 0
    while position < len(text):
        start = text.find("{", position)
        if start < 0:
            break
        try:
            value, end = decoder.raw_decode(text, start)
        except json.JSONDecodeError:
            position = start + 1
            continue
        if _valid_response(value):
            responses.append(value)
            if len(responses) > 1:
                return None
        position = end
    return responses[0] if len(responses) == 1 else None


def call_readonly(operation: str, caller_scope: str = "synthetic", **arguments: Any) -> dict[str, Any]:
    """Call the pinned legacy read implementation; arguments contain no paths.

    ``caller_scope`` carries the authenticated session scope. Workspaces bound
    with a higher scope than the caller are refused before the authority is
    ever started, so production data cannot leak through error paths either.
    """
    if operation not in ALLOWED_OPERATIONS:
        return _error("OPERATION_NOT_ALLOWED", "Operation is not in the YY read-only allowlist.")
    if os.environ.get("YY_READONLY_ENABLED", "").lower() != "true":
        return _error("MCP_DISABLED", "YY read-only service is disabled.")
    bindings = os.environ.get("YY_READONLY_BINDINGS")
    if not bindings or not Path(bindings).is_file():
        return _error("CONFIGURATION_ERROR", "Trusted workflow binding registry is unavailable.")
    workflow_id = arguments.get("workflow_id")
    entry, binding_code, binding_reason = resolve_binding(bindings, workflow_id)
    if entry is None:
        return _error(binding_code, binding_reason)
    if SCOPE_LEVELS[entry["scope"]] > SCOPE_LEVELS.get(caller_scope, 0):
        return _error("WORKSPACE_NOT_AUTHORIZED", "Workspace access is not authorized for the current session scope.")

    revision = _verify_authority()
    if revision is None:
        return _error("AUTHORITY_REVISION_MISMATCH", "Pinned YY authority revision is unavailable or changed.")

    request = json.dumps(
        {"operation": operation, "arguments": arguments},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    if len(request) > MAX_REQUEST_BYTES:
        return _error("INPUT_TOO_LARGE", "Read-only request exceeds the configured input limit.")

    environment = {
        name: os.environ[name]
        for name in ("PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "YY_GATE_MODE", "TT_GATE_MODE", "YY_SESSION_MODE", "TT_SESSION_MODE")
        if name in os.environ
    }
    environment["YY_READONLY_ENABLED"] = "true"
    environment["YY_READONLY_BINDINGS"] = bindings
    if os.environ.get("YY_READONLY_DEBUG") == "true":
        environment["YY_READONLY_DEBUG"] = "true"

    node = os.environ.get("YY_READONLY_NODE", "node")
    try:
        process = subprocess.Popen(
            [node, str(BRIDGE)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=AUTHORITY_ROOT,
            env=environment,
            shell=False,
        )
    except OSError:
        return _error("BRIDGE_UNAVAILABLE", "YY read-only authority could not be started.")

    try:
        stdout, _stderr, returncode, failure_code = _run_bounded(process, request)
    except (OSError, ValueError, TypeError):
        _terminate(process)
        return _error("BRIDGE_UNAVAILABLE", "YY read-only authority could not complete the request.")
    if failure_code == "BRIDGE_TIMEOUT":
        return _error("BRIDGE_TIMEOUT", "YY read-only authority timed out.")
    if failure_code == "BRIDGE_OUTPUT_TOO_LARGE":
        return _error("BRIDGE_OUTPUT_TOO_LARGE", "YY read-only authority exceeded the response byte limit.")
    if failure_code == "BRIDGE_DIAGNOSTIC_TOO_LARGE":
        return _error("BRIDGE_DIAGNOSTIC_TOO_LARGE", "YY read-only authority exceeded the diagnostic byte limit.")
    if failure_code is not None:
        return _error("BRIDGE_UNAVAILABLE", "YY read-only authority exited unsuccessfully.")
    response = _extract_response(stdout)
    if response is None:
        if returncode != 0:
            return _error("BRIDGE_UNAVAILABLE", "YY read-only authority exited unsuccessfully.")
        return _error("BRIDGE_INVALID_RESPONSE", "YY read-only authority returned an invalid response.")
    if returncode != 0 and response["ok"]:
        return _error("BRIDGE_UNAVAILABLE", "YY read-only authority exited unsuccessfully.")

    if _verify_authority() != revision:
        return _error("AUTHORITY_REVISION_MISMATCH", "YY authority changed while the request was running.")
    if not response["ok"]:
        return _error(response["code"], "YY read-only authority reported a request failure.")

    existing_revision = response["evidence"].get("authority_revision")
    if existing_revision is not None and existing_revision != revision:
        return _error("AUTHORITY_REVISION_MISMATCH", "YY result came from an unexpected authority revision.")
    response["evidence"]["authority_revision"] = revision
    # The old process cannot promote its stage interpretation or self-reported
    # identity into the current decision authority. Keep its data as legacy facts.
    response["authority"] = dict(LEGACY_AUTHORITY)
    return response
