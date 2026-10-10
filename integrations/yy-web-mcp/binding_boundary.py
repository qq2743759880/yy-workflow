"""Trusted registry resolution and bounded workspace read confinement.

Both MCP surfaces use the existing yy/read-bindings@1 scope lattice. Protected
read trees follow M1's no-link, realpath containment and bounded inspection
policy. This is an application boundary, not an operating-system sandbox.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import stat
from typing import Any

BINDING_SCHEMA = "yy/read-bindings@1"
SCOPE_LEVELS = {"synthetic": 0, "production": 1}
WORKFLOW_GRAMMAR = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
SESSION_GRAMMAR = re.compile(r"^[A-Za-z0-9_-]+$")
SUBTASK_GRAMMAR = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
MAX_REGISTRY_BYTES = 256_000
MAX_TREE_ENTRIES = 20_000
MAX_SOURCE_FILE_BYTES = 4_000_000
MAX_AUTHORITY_READ_BYTES = 4_000_000


def _state_references_within_root(state_file: Path, root: Path) -> bool:
    """Confine persisted references used by phase.check to their bound workspace.

    Invalid JSON remains the Core's responsibility. This only checks references
    that may become filesystem paths; it does not decide phase or task semantics.
    """
    try:
        document = json.loads(state_file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return True
    if not isinstance(document, dict):
        return True
    subtasks = document.get("subtasks", [])
    if not isinstance(subtasks, list):
        return True
    for subtask in subtasks:
        if not isinstance(subtask, dict):
            continue
        identifier = subtask.get("id")
        if not isinstance(identifier, str) or not SUBTASK_GRAMMAR.fullmatch(identifier) or ".." in identifier:
            return False
        dependencies = subtask.get("dependsOn", [])
        if isinstance(dependencies, list) and any(
            not isinstance(value, str) or not SUBTASK_GRAMMAR.fullmatch(value) or ".." in value
            for value in dependencies
        ):
            return False
    for item in [document, *subtasks]:
        if not isinstance(item, dict) or item.get("contractMode") != "frozen" or not item.get("contract"):
            continue
        contract = item["contract"]
        if not isinstance(contract, str):
            return False
        candidate = Path(contract)
        try:
            resolved = (candidate if candidate.is_absolute() else root / candidate).resolve()
            if os.path.commonpath([os.path.normcase(str(root)), os.path.normcase(str(resolved))]) != os.path.normcase(str(root)):
                return False
        except (OSError, ValueError, RuntimeError):
            return False
    return True


def resolve_binding(bindings_path: str, workflow_id: Any) -> tuple[dict[str, Any] | None, str | None, str | None]:
    """Resolve exactly one explicitly scoped, enabled, canonical binding."""
    if not isinstance(workflow_id, str) or not WORKFLOW_GRAMMAR.fullmatch(workflow_id):
        return None, "WORKFLOW_NOT_FOUND", "workflow_id is not registered in the trusted binding registry."
    try:
        with Path(bindings_path).open("rb") as stream:
            raw = stream.read(MAX_REGISTRY_BYTES + 1)
        if len(raw) > MAX_REGISTRY_BYTES:
            return None, "CONFIGURATION_ERROR", "binding registry exceeds its configured byte limit."
        document = json.loads(raw.decode("utf-8"))
    except (OSError, ValueError):
        return None, "CONFIGURATION_ERROR", "binding registry is unavailable or malformed."
    if not isinstance(document, dict) or document.get("schema") != BINDING_SCHEMA:
        return None, "CONFIGURATION_ERROR", "binding registry schema mismatch (expected yy/read-bindings@1)."
    workspaces = document.get("workspaces")
    if not isinstance(workspaces, list):
        return None, "CONFIGURATION_ERROR", "binding registry workspaces must be a list."
    matches = [entry for entry in workspaces if isinstance(entry, dict) and entry.get("workflow_id") == workflow_id]
    if not matches:
        return None, "WORKFLOW_NOT_FOUND", "workflow_id is not registered in the trusted binding registry."
    if len(matches) != 1:
        return None, "CONFIGURATION_ERROR", "duplicate binding entries for workflow_id (fail closed)."
    entry = matches[0]
    if entry.get("enabled") is not True:
        return None, "WORKSPACE_NOT_AUTHORIZED", "registered binding is disabled (enabled != true)."
    scope = entry.get("scope")
    if not isinstance(scope, str) or scope not in SCOPE_LEVELS:
        return None, "CONFIGURATION_ERROR", "binding scope must be explicitly synthetic or production."
    session = entry.get("session")
    if session is not None and (not isinstance(session, str) or not SESSION_GRAMMAR.fullmatch(session)):
        return None, "CONFIGURATION_ERROR", "registered session violates the YY session grammar."
    workspace = entry.get("workspace_root")
    if not isinstance(workspace, str) or not workspace:
        return None, "CONFIGURATION_ERROR", "registered workspace_root is not a directory."
    try:
        root = Path(workspace).resolve(strict=True)
        if not root.is_dir():
            return None, "CONFIGURATION_ERROR", "registered workspace_root is not a directory."
    except (OSError, ValueError, RuntimeError):
        return None, "CONFIGURATION_ERROR", "registered workspace_root is not a directory."
    return {**entry, "workspace_root": str(root), "session": session}, None, None


def check_read_boundary(workspace_root: str, operation: str) -> tuple[str, str] | None:
    """Inspect the Core's workspace read trees before and after invocation.

    Stage consults .tt-state and execution-phase receipts in artifacts; task
    consults .tt-state; validation consults artifacts, including receipts, briefs
    and optional evidence files. Session directories are inspected recursively.
    Root aliases are canonicalized by resolve_binding, but links inside these
    protected trees are rejected, including Windows directory junctions.
    """
    root = Path(workspace_root)
    protected = [".tt-state", "artifacts"] if operation == "stage" else [".tt-state"] if operation == "task" else ["artifacts"]
    protected_roots = [root / directory for directory in protected]
    pending = list(protected_roots)
    visited = 0
    source_bytes = 0
    normalized_root = os.path.normcase(str(root))
    while pending:
        current = pending.pop()
        try:
            info = current.lstat()
        except FileNotFoundError:
            if current in protected_roots:
                continue
            return "FILE_NOT_VISIBLE", "A protected YY entry changed during inspection."
        except OSError:
            return "FILE_NOT_VISIBLE", "A protected YY entry is not readable."
        visited += 1
        if visited > MAX_TREE_ENTRIES:
            return "RESOURCE_LIMIT", "YY authority tree exceeds the safe read limit."
        if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0):
            return "WORKSPACE_NOT_AUTHORIZED", "YY authority tree contains a filesystem link."
        try:
            real = current.resolve(strict=True)
            if os.path.commonpath([normalized_root, os.path.normcase(str(real))]) != normalized_root:
                return "WORKSPACE_NOT_AUTHORIZED", "YY authority entry escapes its workspace."
            if stat.S_ISDIR(info.st_mode):
                with os.scandir(current) as entries:
                    for entry in entries:
                        if visited + len(pending) >= MAX_TREE_ENTRIES:
                            return "RESOURCE_LIMIT", "YY authority tree exceeds the safe read limit."
                        pending.append(Path(entry.path))
            elif stat.S_ISREG(info.st_mode):
                if info.st_size > MAX_SOURCE_FILE_BYTES:
                    return "RESOURCE_LIMIT", "A YY authority source exceeds the per-file read limit."
                source_bytes += info.st_size
                if source_bytes > MAX_AUTHORITY_READ_BYTES:
                    return "RESOURCE_LIMIT", "YY authority sources exceed the aggregate read limit."
                if current.name == "state.json" and current.is_relative_to(root / ".tt-state") and not _state_references_within_root(current, root):
                    return "WORKSPACE_NOT_AUTHORIZED", "Persisted YY references must stay within the bound workspace."
            else:
                return "FILE_NOT_VISIBLE", "A protected YY entry is not a regular file or directory."
        except (OSError, ValueError, RuntimeError):
            return "FILE_NOT_VISIBLE", "A protected YY entry changed or is not visible."
    return None
