"""Bounded V2 adapter: MCP Decision tools -> Node decision-bridge -> Decision Core.

C3 transport contract (contracts/decision-contract-v1.yaml v1.0.1):
  one call -> one Decision Core operation -> one yy/decision@1 packet.

This module may ONLY: validate external schema shapes, resolve the trusted
workflow binding, invoke the Node transport bridge, validate the envelope,
enforce bounds, and return the result. It must never reconstruct routing,
primary/supporting selection, owner wording, or stage blockers in Python.

Security invariant (C3-R2-1): the workspace/session leakage scrub applies to
ALL outbound envelopes — success AND Core error. Core error envelopes are
preserved exactly (code/data/reason/warnings/evidence untouched) except for
bounded additive transport evidence on keys the Core did not set.

Identity (C3.4/C3-R1-2), kept distinguishable:
  - decision semantic identity: consumed from the generated manifest
    contracts/generated/decision-authority-components.json;
  - transport identity: contracts/generated/decision-transport-manifest.json —
    a canonical deterministic transport drift/integrity manifest under the
    SOURCE_CANONICAL trust boundary. It detects drift/tampering relative to the
    committed manifest; it is NOT cryptographic protection against an actor who
    can rewrite both the source files and the manifest itself.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import secrets
from pathlib import Path
from typing import Any

import auth
from binding_boundary import SCOPE_LEVELS, check_read_boundary, resolve_binding

# --- configuration -----------------------------------------------------------

DEFAULT_DECISION_ROOT = str(Path(__file__).resolve().parents[2])
DECISION_BRIDGE_REL = "scripts/decision-bridge.mjs"
DECISION_MANIFEST_REL = "contracts/generated/decision-authority-components.json"
TRANSPORT_MANIFEST_REL = "contracts/generated/decision-transport-manifest.json"

MAX_REQUEST_BYTES = 65_536
MAX_STDOUT_BYTES = 2_000_000  # brief packets carry methodology text; frozen transport bound
MAX_STDERR_BYTES = 65_536
TIMEOUT_SECONDS = 30
MAX_SOURCE_PAGE_BYTES = 4096
# Server-process secret only: restarts intentionally invalidate cursors.
_SOURCE_CURSOR_KEY = secrets.token_hex(32)

_ALLOWED_OPS = {"stage", "task", "validate"}

# C1 v1.0.1 error vocabulary: M1 shared allowlist + the 14 V2 additions
# (13 reused existing codes + ROUTING_NO_MATCH as the only new code).
V2_CODE_ALLOWLIST = frozenset({
    # shared with M1 bridge allowlist
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
    # V2 additions (13 reused + 1 new)
    "ASSET_BODY_MISSING", "RESOURCE_NOT_FOUND", "ACTIVATION_BUDGET_EXCEEDED",
    "ACTIVATION_MODE_UNSUPPORTED", "CAPABILITY_UNKNOWN",
    "CAPABILITY_CLUSTER_MISMATCH", "JOURNEY_NOT_FOUND", "JOURNEY_STALE",
    "JOURNEY_INVALID", "PROJECTION_SOURCE_INVALID", "PROJECTION_CONFLICT",
    "RECEIPT_INVALID", "RECEIPT_HASH_MISMATCH",
    "ROUTING_NO_MATCH",  # the single new Decision-layer code
})


def _error(code: str, message: str) -> dict[str, Any]:
    return {"ok": False, "code": code, "data": {"reason": message}, "evidence": {}, "warnings": [message]}


def _expected_semantic_digest(root: Path) -> str | None:
    """Consume the generated authority manifest (never a copied hash list)."""
    try:
        document = json.loads((root / DECISION_MANIFEST_REL).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if document.get("schema") != "yy/decision-authority@1":
        return None
    digest = document.get("digest")
    return digest if isinstance(digest, str) and len(digest) == 64 else None


def _verified_transport_digest(root: Path) -> tuple[str | None, str | None]:
    """V2 transport identity gate (C3-R1-2), separate from decision semantics.

    Expected digest comes from the committed manifest file; the live digest is
    recomputed over the manifest-declared transport components. Any transport
    byte drift (including edits to this very verifier) fails closed before the
    bridge is invoked — a changed verifier cannot silently redefine the pin,
    because the expectation lives in the committed manifest, not in code.
    """
    try:
        manifest = json.loads((root / TRANSPORT_MANIFEST_REL).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None, "decision transport manifest is unavailable or malformed"
    if not isinstance(manifest, dict) or manifest.get("schema") != "yy/decision-transport@1":
        return None, "decision transport manifest schema mismatch"
    expected = manifest.get("digest")
    components = manifest.get("components")
    if not isinstance(expected, str) or len(expected) != 64 or not isinstance(components, list) or not components:
        return None, "decision transport manifest is malformed"
    lines: list[str] = []
    for component in components:
        rel = component.get("path") if isinstance(component, dict) else None
        if not isinstance(rel, str) or rel.startswith(("..", "/")) or "\\" in rel:
            return None, f"transport manifest path is invalid: {rel!r}"
        try:
            digest = hashlib.sha256((root / rel).read_bytes()).hexdigest()
        except OSError:
            return None, f"transport component is unreadable: {rel}"
        lines.append(f"{rel} {digest}")
    live = hashlib.sha256("\n".join(sorted(lines)).encode("utf-8")).hexdigest()
    if live != expected:
        return None, f"V2 transport identity mismatch (transport manifest drift): live {live[:12]}… ≠ committed {expected[:12]}…"
    return live, None


def _verify_transport(root: Path) -> str | None:
    """Keep the existing error-only verifier interface."""
    return _verified_transport_digest(root)[1]


def _resolve_binding(bindings_path: str, workflow_id: str) -> tuple[dict[str, Any] | None, str | None, str | None]:
    """Shared strict registry resolution; no independent permission taxonomy."""
    return resolve_binding(bindings_path, workflow_id)


def _valid_envelope(value: Any) -> bool:
    if not isinstance(value, dict) or not isinstance(value.get("ok"), bool):
        return False
    code = value.get("code")
    if code is not None and (not isinstance(code, str) or code not in V2_CODE_ALLOWLIST):
        return False
    if not isinstance(value.get("data"), dict) or not isinstance(value.get("evidence"), dict):
        return False
    warnings = value.get("warnings")
    if not isinstance(warnings, list) or any(not isinstance(item, str) for item in warnings):
        return False
    if value["ok"] and code is not None:
        return False
    if not value["ok"] and code is None:
        return False
    return True


def _run_bounded(argv: list[str], request: bytes, cwd: Path) -> tuple[bytes, int | None, str | None]:
    """Spawn the Node bridge with capped IO and a wall-clock limit (M1 patterns)."""
    from bridge_client import _read_capped, _terminate, _write_request  # bounded-IO helpers, reused not duplicated

    process = subprocess.Popen(
        argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        cwd=cwd, shell=False,
    )
    import threading
    import time

    stdout_data: list[bytes] = []
    stderr_data: list[bytes] = []
    stdout_overflow = [False]
    stderr_overflow = [False]
    failures: list[Exception] = []
    readers = [
        threading.Thread(target=_read_capped, args=(process.stdout, MAX_STDOUT_BYTES, stdout_data, stdout_overflow, failures), daemon=True),
        threading.Thread(target=_read_capped, args=(process.stderr, MAX_STDERR_BYTES, stderr_data, stderr_overflow, failures), daemon=True),
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

    for stream in (process.stdin, process.stdout, process.stderr):
        if stream is not None:
            stream.close()
    return (stdout_data[0] if stdout_data else b""), returncode, failure_code


def _scrub_secrets(value: Any, secrets: list[str]) -> Any:
    """Fail closed if a resolved workspace/session appears in any string leaf.

    解析层叶子扫描（非序列化文本子串）：路径中的反斜杠经 JSON 转义后会
    令纯文本子串匹配失效（C3-R2 crafted fixture 实证），叶子扫描与转义无关。
    """
    if not secrets:
        return value

    def contains_secret(node: Any) -> bool:
        if isinstance(node, str):
            return any(secret and secret in node for secret in secrets)
        if isinstance(node, dict):
            return any(contains_secret(item) for item in node.values())
        if isinstance(node, (list, tuple)):
            return any(contains_secret(item) for item in node)
        return False

    return None if contains_secret(value) else value


def call_decision(operation: str, workflow_id: Any, caller_scope: str = "synthetic", **external_params: Any) -> dict[str, Any]:
    """External MCP entry: schema shape -> binding -> transport -> envelope -> bounds."""
    if operation not in _ALLOWED_OPS:
        return _error("OPERATION_NOT_ALLOWED", "Decision operation is not in the V2 allowlist.")
    if os.environ.get("YY_DECISION_ENABLED", "").lower() != "true":
        return _error("MCP_DISABLED", "YY decision V2 surface is disabled.")
    root = Path(os.environ.get("YY_DECISION_ROOT", DEFAULT_DECISION_ROOT))
    if not root.is_dir():
        return _error("CONFIGURATION_ERROR", "YY decision root is unavailable.")

    bindings = os.environ.get("YY_READONLY_BINDINGS") or os.environ.get("YY_DECISION_BINDINGS")
    if not bindings or not Path(bindings).is_file():
        return _error("CONFIGURATION_ERROR", "Trusted workflow binding registry is unavailable.")
    if not isinstance(workflow_id, str) or not workflow_id:
        return _error("INPUT_INVALID", "workflow_id must be a non-empty string.")
    entry, binding_code, binding_reason = _resolve_binding(bindings, workflow_id)
    if entry is None:
        return _error(binding_code, binding_reason)
    if SCOPE_LEVELS[entry["scope"]] > SCOPE_LEVELS.get(caller_scope, 0):
        return _error("WORKSPACE_NOT_AUTHORIZED", "Workspace access is not authorized for the current session scope.")

    workspace_root = entry["workspace_root"]
    session = entry["session"]

    # Admitted source/catalog requests also invoke Core stageDecision, which
    # consults artifacts receipts. Reuse the existing joint stage confinement.
    read_operation = "stage" if operation == "task" and external_params.get("mode") == "brief" and external_params.get("step") is not None else operation
    boundary_error = check_read_boundary(workspace_root, read_operation)
    if boundary_error is not None:
        return _error(*boundary_error)

    if "source_read" in external_params:
        if operation != "task" or external_params.get("mode") != "brief" or external_params.get("step") is None or any(key in external_params for key in ("activation_level", "requested_resources", "budget")):
            return _error("INPUT_INVALID", "source_read requires brief and explicit stage, without activation/resources/budget overrides.")
        try:
            from jsonschema import Draft202012Validator
            schema = json.loads((root / "contracts/delegation.schema.json").read_text(encoding="utf-8"))["$defs"]["SourceReadRequest"]
            Draft202012Validator(schema).validate(external_params["source_read"])
            if external_params["source_read"]["workflow_id"] != workflow_id:
                return _error("INPUT_INVALID", "source_read workflow does not match its trusted binding.")
        except Exception:
            return _error("INPUT_INVALID", "source_read violates the shared closed request schema.")

    expected_digest = _expected_semantic_digest(root)
    if expected_digest is None:
        return _error("AUTHORITY_REVISION_MISMATCH", "Decision authority manifest is unavailable or malformed.")
    transport_digest, transport_error = _verified_transport_digest(root)
    if transport_error is not None:
        return _error("AUTHORITY_REVISION_MISMATCH", transport_error)
    inner_request = {"op": operation, "workspace": workspace_root, "session": session, "params": external_params}
    if operation == "task":
        binding_digest = hashlib.sha256(json.dumps({"workflow_id": workflow_id, "workspace": workspace_root, "session": session, "scope": entry["scope"], "caller_scope": caller_scope}, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
        inner_request["trustedSourceRead"] = {"workflow_id": workflow_id, "binding_digest": binding_digest, "cursor_key": _SOURCE_CURSOR_KEY, "max_page_bytes": MAX_SOURCE_PAGE_BYTES}
    request = json.dumps(
        inner_request,
        ensure_ascii=False, separators=(",", ":"),
    ).encode("utf-8")
    if len(request) > MAX_REQUEST_BYTES:
        return _error("INPUT_TOO_LARGE", "Decision request exceeds the configured input limit.")

    node = os.environ.get("YY_DECISION_NODE", os.environ.get("YY_READONLY_NODE", "node"))
    bridge = root / DECISION_BRIDGE_REL
    try:
        stdout, returncode, failure_code = _run_bounded([node, str(bridge)], request, root)
    except (OSError, ValueError, TypeError):
        return _error("BRIDGE_UNAVAILABLE", "YY decision bridge could not be started.")

    if failure_code == "BRIDGE_TIMEOUT":
        return _error("BRIDGE_TIMEOUT", "YY decision bridge timed out.")
    if failure_code in ("BRIDGE_OUTPUT_TOO_LARGE", "BRIDGE_DIAGNOSTIC_TOO_LARGE"):
        return _error(failure_code, "YY decision bridge exceeded the frozen transport bound (no silent truncation).")
    if failure_code is not None:
        return _error("BRIDGE_UNAVAILABLE", "YY decision bridge exited unsuccessfully.")

    boundary_error = check_read_boundary(workspace_root, read_operation)
    if boundary_error is not None:
        return _error(*boundary_error)

    try:
        response = json.loads(stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return _error("BRIDGE_INVALID_RESPONSE", "YY decision bridge returned a non-JSON response.")
    if not _valid_envelope(response):
        return _error("BRIDGE_INVALID_RESPONSE", "YY decision bridge returned an invalid or unknown-code response.")
    if returncode not in (0, None) and response.get("ok"):
        return _error("BRIDGE_UNAVAILABLE", "YY decision bridge exited unsuccessfully.")

    # C3-R2-1：泄露擦洗对**所有**出站 envelope 生效（成功与 Core 错误同权）——
    # 顺序冻结：parse → allowlist 校验 → 擦洗 →（泄漏 ⇒ BRIDGE_INVALID_RESPONSE）→
    # Core envelope 原样保全 → 仅追加有界传输证据。
    scrubbed = _scrub_secrets(response, [workspace_root, str(root), root.as_posix(), _SOURCE_CURSOR_KEY] + ([session] if session else []))
    if scrubbed is None:
        return _error("BRIDGE_INVALID_RESPONSE", "Resolved workspace/session leaked into the decision response.")

    if not scrubbed.get("ok"):
        # C3-R1-4：Core 错误 envelope 原样透传（code/data/reason/warnings/Decision evidence 零改写）
        _merge_transport_evidence(scrubbed, expected_digest, transport_digest)
        return scrubbed

    packet = scrubbed.get("data", {})
    authority = packet.get("authority") if isinstance(packet, dict) else None
    if not isinstance(authority, dict) or authority.get("identity_verified") is not True:
        return _error("AUTHORITY_REVISION_MISMATCH", "Decision identity_verified is not true; external V2 fails closed.")
    if authority.get("decision_authority_digest") != expected_digest:
        return _error("AUTHORITY_REVISION_MISMATCH", "Decision packet digest does not match the generated authority manifest.")
    _merge_transport_evidence(scrubbed, expected_digest, transport_digest)
    return scrubbed


def _merge_transport_evidence(envelope: dict, expected_digest: str, transport_digest: str) -> None:
    """追加有界传输证据（仅缺省键，绝不覆盖 Core 已有 evidence）。"""
    evidence = envelope.setdefault("evidence", {})
    if isinstance(evidence, dict):
        evidence.setdefault("decision_authority_digest", expected_digest)
        evidence.setdefault("transport_digest", transport_digest)
