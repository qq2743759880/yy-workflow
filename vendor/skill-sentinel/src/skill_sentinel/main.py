#!/usr/bin/env python
"""
Programmatic helpers for the SkillScanner CrewAI crew.

The primary user-facing entry point is ``skill_sentinel.cli:main``
(registered as the ``skill-sentinel`` console script).

This module provides a simple ``scan()`` function for use as a library.
"""

import hashlib
import json
import os
import re
import time
import warnings

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

from skill_sentinel.crew import SkillScanner
from skill_sentinel.tools.file_discovery import discover_skill_files
from skill_sentinel.tools.virustotal_tool import scan_binary_files

# The bundled data directory lives next to this file at install time.
_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def _load_knowledge() -> dict:
    """Load threat categories and report schema bundled with the package."""
    with open(os.path.join(_DATA_DIR, "threat_categories.md"), "r") as f:
        threat_categories = f.read()
    with open(os.path.join(_DATA_DIR, "report_schema.json"), "r") as f:
        report_schema = f.read()
    return {
        "threat_categories": threat_categories,
        "report_schema": report_schema,
    }


def _extract_skill_name(skill_md_path: str, skill_directory: str) -> str:
    """Skill name from the SKILL.md YAML frontmatter ``name:`` field, falling
    back to the skill directory's basename when absent."""
    fallback = os.path.basename(os.path.normpath(skill_directory))
    if not skill_md_path or not os.path.isfile(skill_md_path):
        return fallback
    try:
        with open(skill_md_path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except OSError:
        return fallback
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return fallback
    for line in lines[1:]:
        if line.strip() == "---":
            break
        m = re.match(r"\s*name\s*:\s*(.+?)\s*$", line)
        if m:
            return m.group(1).strip().strip("'\"") or fallback
    return fallback


def _compute_content_hash(skill_directory: str) -> str:
    """Deterministic sha256 over ALL files in the skill directory (SKILL.md plus
    every supporting script/reference/binary). Each file contributes its POSIX
    relative path and raw bytes, in sorted path order, so a change to any file
    changes the hash. Symlinks and the .git directory are skipped."""
    h = hashlib.sha256()
    root = os.path.abspath(skill_directory)
    entries = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d != ".git"]
        for name in filenames:
            full = os.path.join(dirpath, name)
            if os.path.islink(full):
                continue
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            entries.append((rel, full))
    for rel, full in sorted(entries):
        h.update(rel.encode("utf-8"))
        h.update(b"\0")
        try:
            with open(full, "rb") as f:
                for chunk in iter(lambda: f.read(65536), b""):
                    h.update(chunk)
        except OSError:
            continue
        h.update(b"\0")
    return h.hexdigest()


def _finalize_report(
    report_path: str,
    crew_instance,
    skill_directory: str,
    skill_md_path: str,
    elapsed_seconds: float,
) -> None:
    """Inject deterministic, code-computed fields into the report and write back:
    token usage, skill name, a full-directory content hash, and scan duration."""
    try:
        with open(report_path, "r") as f:
            raw = f.read().strip()

        try:
            report_data = json.loads(raw)
        except json.JSONDecodeError:
            last_brace = raw.rfind("}")
            if last_brace != -1:
                report_data = json.loads(raw[: last_brace + 1])
            else:
                raise

        report_data["token_usage"] = json.loads(
            crew_instance.usage_metrics.model_dump_json()
        )
        report_data["skill_name"] = _extract_skill_name(
            skill_md_path, skill_directory
        )
        report_data["content_hash"] = _compute_content_hash(skill_directory)
        minutes, seconds = divmod(int(elapsed_seconds), 60)
        report_data["scan_duration"] = {
            "seconds": round(elapsed_seconds, 1),
            "display": f"{minutes}m {seconds}s",
        }

        with open(report_path, "w") as f:
            json.dump(report_data, f, indent=2)
    except Exception as e:
        print(
            f"[Skill Sentinel] Warning: Could not finalize report: {e}"
        )


def scan(
    skill_directory: str,
    output_path: str = "report.json",
    model: str | None = None,
) -> dict:
    """
    Run the skill scanner programmatically.

    Args:
        skill_directory: Path to the Agent Skill directory.
        output_path: Where to write the JSON report.
        model: OpenAI model name (default: gpt-5.4-mini or OPENAI_MODEL_NAME env).

    Returns:
        The parsed report dict. Alongside the analysis fields it includes
        code-computed metadata: ``token_usage``, ``skill_name`` (from SKILL.md),
        ``content_hash`` (sha256 over every file in the skill dir), and
        ``scan_duration``.
    """
    # Disable CrewAI telemetry/tracing prompt by default
    os.environ.setdefault("CREWAI_TRACING_ENABLED", "false")
    
    if model:
        os.environ["OPENAI_MODEL_NAME"] = model
    else:
        # Default model when neither an explicit arg nor the env var is set.
        os.environ.setdefault("OPENAI_MODEL_NAME", "gpt-5.4-mini")

    skill_directory = os.path.abspath(skill_directory)
    output_path = os.path.abspath(output_path)

    # CrewAI's Task.output_file joins the path with cwd, so pass a
    # relative path to avoid nested directory creation.
    output_relpath = os.path.relpath(output_path)

    file_info = discover_skill_files(skill_directory)

    if file_info["skill_md_path"] is None:
        raise FileNotFoundError(
            f"No SKILL.md found in '{skill_directory}'. "
            "Are you sure this is an Agent Skill package?"
        )

    knowledge = _load_knowledge()

    has_other_files = bool(
        file_info["script_files"] or file_info["markdown_files"]
    )

    # Run VirusTotal scans on binary files (if API key is available)
    vt_results = scan_binary_files(file_info["file_tree"])
    if vt_results:
        vt_summary = json.dumps(vt_results, indent=2)
    else:
        binary_count = len(file_info.get("binary_files", []))
        if binary_count > 0:
            vt_summary = (
                f"{binary_count} binary file(s) found but no VIRUSTOTAL_API_KEY "
                "is set — binary files could not be scanned for malware."
            )
        else:
            vt_summary = "No binary files found in the skill package."

    inputs = {
        "skill_directory": file_info["skill_directory"],
        "skill_md_path": file_info["skill_md_path"],
        "file_discovery_results": json.dumps(file_info, indent=2),
        "threat_categories": knowledge["threat_categories"],
        "report_schema": knowledge["report_schema"],
        "virustotal_results": vt_summary,
    }

    scanner = SkillScanner()
    the_crew = scanner.build_crew(
        include_file_verification=has_other_files,
        output_file=output_relpath,
    )
    started_at = time.monotonic()
    the_crew.kickoff(inputs=inputs)
    elapsed_seconds = time.monotonic() - started_at

    _finalize_report(
        output_path,
        the_crew,
        file_info["skill_directory"],
        file_info["skill_md_path"],
        elapsed_seconds,
    )

    with open(output_path, "r") as f:
        return json.load(f)
