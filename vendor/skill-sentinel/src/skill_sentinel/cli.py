#!/usr/bin/env python
"""
CLI entry point for skill-sentinel.

Usage:
    skill-sentinel scan [<provider>] [OPTIONS]
    skill-sentinel scan --skill /path/to/skill [-o report.json]
    skill-sentinel scan --dir /path/to/parent [-o reports_dir] [--parallel]
"""

import argparse
import json
import os
import sys
import time
import warnings
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional, Tuple

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

# Provider keywords that trigger auto-discovery instead of path lookup
_PROVIDER_KEYWORDS = {"cursor", "claude", "codex", "openclaw"}

# Well-known skill directory locations per provider.
# Project-level paths are relative to cwd; user-level paths use ~.
_SKILL_SEARCH_PATHS = {
    "cursor": [
        os.path.join(".", ".cursor", "skills"),
        os.path.join("~", ".cursor", "skills"),
    ],
    "claude": [
        os.path.join(".", ".claude", "skills"),
        os.path.join("~", ".claude", "skills"),
    ],
    "codex": [
        os.path.join(".", ".codex", "skills"),
        os.path.join("~", ".codex", "skills"),
    ],
    "openclaw": [
        os.path.join(".", "skills"),
        os.path.join("~", ".openclaw", "skills"),
    ],
}

_DEFAULT_PARALLEL_WORKERS = 5


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


def _discover_skill_dirs(provider: Optional[str] = None) -> List[dict]:
    """
    Search well-known skill directories for skill packages containing SKILL.md.

    Args:
        provider: If set, only search that provider's paths.
                  If None, search all providers.

    Returns:
        List of dicts: {"provider": str, "skill_name": str, "path": str}
    """
    if provider:
        providers = {provider: _SKILL_SEARCH_PATHS[provider]}
    else:
        providers = _SKILL_SEARCH_PATHS

    results = []
    seen_paths = set()

    for prov, search_paths in providers.items():
        for base_path in search_paths:
            expanded = os.path.abspath(os.path.expanduser(base_path))
            if not os.path.isdir(expanded):
                continue

            try:
                entries = sorted(os.listdir(expanded))
            except PermissionError:
                continue

            for entry in entries:
                skill_dir = os.path.join(expanded, entry)
                if not os.path.isdir(skill_dir):
                    continue

                real = os.path.realpath(skill_dir)
                if real in seen_paths:
                    continue
                seen_paths.add(real)

                if not _has_skill_md(skill_dir):
                    continue

                results.append({
                    "provider": prov,
                    "skill_name": entry,
                    "path": skill_dir,
                })

    return results


def _discover_skills_in_dir(parent_dir: str) -> List[dict]:
    """
    List immediate subdirectories of *parent_dir* that contain a SKILL.md.

    Returns:
        List of dicts: {"provider": "custom", "skill_name": str, "path": str}
    """
    parent_dir = os.path.abspath(parent_dir)
    if not os.path.isdir(parent_dir):
        return []

    results = []
    try:
        entries = sorted(os.listdir(parent_dir))
    except PermissionError:
        return []

    for entry in entries:
        skill_dir = os.path.join(parent_dir, entry)
        if not os.path.isdir(skill_dir):
            continue
        if not _has_skill_md(skill_dir):
            continue
        results.append({
            "provider": "custom",
            "skill_name": entry,
            "path": skill_dir,
        })

    return results


def _has_skill_md(directory: str) -> bool:
    """Check if a directory contains a SKILL.md (case-insensitive)."""
    try:
        for f in os.listdir(directory):
            if f.upper() == "SKILL.MD":
                return True
    except PermissionError:
        pass
    return False


def _append_metadata(
    report_path: str,
    crew_instance,
    elapsed_seconds: float,
    skill_path: str,
) -> None:
    """Read the report JSON, inject skill_path, token usage, scan duration."""
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

        ordered = OrderedDict()
        ordered["skill_path"] = skill_path
        ordered.update(report_data)

        ordered["token_usage"] = json.loads(
            crew_instance.usage_metrics.model_dump_json()
        )

        mins, secs = divmod(int(elapsed_seconds), 60)
        ordered["scan_duration"] = {
            "seconds": round(elapsed_seconds, 1),
            "display": f"{mins}m {secs}s",
        }

        with open(report_path, "w") as f:
            json.dump(ordered, f, indent=2)

    except Exception as e:
        print(
            f"\n[Skill Sentinel] Warning: Could not append metadata to report: {e}"
        )


def _print_summary(report_path: str, elapsed_seconds: float) -> None:
    """Print the overall risk assessment from the report to the console."""
    mins, secs = divmod(int(elapsed_seconds), 60)
    duration_str = f"{mins}m {secs}s"

    try:
        with open(report_path, "r") as f:
            report = json.load(f)
    except Exception:
        print(f"\n[Skill Sentinel] Done ({duration_str}). Report written to {report_path}")
        return

    risk = report.get("overall_risk_assessment", {})
    verdict = risk.get("skill_verdict", "UNKNOWN")
    risk_level = risk.get("risk_level", "UNKNOWN")
    summary = risk.get("summary", "")
    top_priority = risk.get("top_priority", "")
    reasoning = risk.get("verdict_reasoning", "")

    findings = report.get("validated_findings", [])

    print("\n" + "=" * 60)
    print(f"  SCAN COMPLETE — Verdict: {verdict}")
    print("=" * 60)
    print(f"  Risk Level:    {risk_level}")
    print(f"  Findings:      {len(findings)} confirmed threat(s)")
    print(f"  Scan Time:     {duration_str}")
    if summary:
        print(f"  Summary:       {summary}")
    if top_priority:
        print(f"  Top Priority:  {top_priority}")
    if reasoning:
        print(f"  Reasoning:     {reasoning}")
    print("-" * 60)
    print(f"  Detailed report: {report_path}")
    print("=" * 60)


def _read_verdict(report_path: str) -> str:
    """Read the verdict from a report file, or return UNKNOWN."""
    try:
        with open(report_path, "r") as f:
            report = json.load(f)
        return report.get("overall_risk_assessment", {}).get(
            "skill_verdict", "UNKNOWN"
        )
    except Exception:
        return "UNKNOWN"


# ---------------------------------------------------------------------------
# Single-scan core logic
# ---------------------------------------------------------------------------


def _scan_single(
    skill_directory: str,
    output_path: str,
    SkillScanner,
    discover_skill_files,
    scan_binary_files_fn=None,
) -> bool:
    """
    Run the scanner against a single skill directory.

    Returns True if the scan completed successfully, False otherwise.
    """
    skill_directory = os.path.abspath(skill_directory)
    output_path = os.path.abspath(output_path)

    # CrewAI's Task.output_file joins the path with cwd, so pass relative.
    output_relpath = os.path.relpath(output_path)

    # 1. Static file discovery
    file_info = discover_skill_files(skill_directory)

    if file_info["skill_md_path"] is None:
        print(
            f"[Skill Sentinel] Warning: No SKILL.md found in '{skill_directory}' "
            "-- skipping.",
            file=sys.stderr,
        )
        return False

    # 2. Load bundled knowledge files
    knowledge = _load_knowledge()

    # 3. Determine whether file verification is needed
    has_other_files = bool(
        file_info["script_files"] or file_info["markdown_files"]
    )

    # 4. Run VirusTotal scans on binary files (if API key is available)
    binary_count = len(file_info.get("binary_files", []))
    vt_results = []
    if scan_binary_files_fn and binary_count > 0:
        vt_results = scan_binary_files_fn(file_info["file_tree"])

    if vt_results:
        vt_summary = json.dumps(vt_results, indent=2)
    elif binary_count > 0:
        vt_key_set = bool(os.environ.get("VIRUSTOTAL_API_KEY", ""))
        if not vt_key_set:
            vt_summary = (
                f"{binary_count} binary file(s) found but no VIRUSTOTAL_API_KEY "
                "is set — binary files could not be scanned for malware."
            )
        else:
            vt_summary = (
                f"{binary_count} binary file(s) found. "
                "VirusTotal scan returned no results."
            )
    else:
        vt_summary = "No binary files found in the skill package."

    # 5. Build crew inputs
    inputs = {
        "skill_directory": file_info["skill_directory"],
        "skill_md_path": file_info["skill_md_path"],
        "file_discovery_results": json.dumps(file_info, indent=2),
        "threat_categories": knowledge["threat_categories"],
        "report_schema": knowledge["report_schema"],
        "virustotal_results": vt_summary,
    }

    # 6. Print pre-scan info
    model = os.environ.get("OPENAI_MODEL_NAME", "gpt-5.4-mini")
    print(f"[Skill Sentinel] Model:          {model}")
    print(f"[Skill Sentinel] Scanning:       {inputs['skill_directory']}")
    print(f"[Skill Sentinel] SKILL.md:       {inputs['skill_md_path']}")
    print(
        f"[Skill Sentinel] Files found:    {len(file_info['all_files'])}"
    )
    print(f"[Skill Sentinel] Script files:   {len(file_info['script_files'])}")
    print(f"[Skill Sentinel] Binary files:   {binary_count}")
    if vt_results:
        malicious_count = sum(1 for r in vt_results if r.get("malicious", 0) > 0)
        print(f"[Skill Sentinel] VT scanned:     {len(vt_results)} file(s), {malicious_count} flagged")
    elif binary_count > 0 and not os.environ.get("VIRUSTOTAL_API_KEY", ""):
        print("[Skill Sentinel] VT scan:        skipped (no VIRUSTOTAL_API_KEY)")
    if not has_other_files:
        print(
            "[Skill Sentinel] No script/reference files -- "
            "skipping file verification"
        )
    print(f"[Skill Sentinel] Output:         {output_path}")
    print()

    # 6. Build crew and run
    scanner = SkillScanner()
    the_crew = scanner.build_crew(
        include_file_verification=has_other_files,
        output_file=output_relpath,
    )

    t_start = time.monotonic()
    the_crew.kickoff(inputs=inputs)
    elapsed = time.monotonic() - t_start

    # 7. Append metadata (skill_path, token usage, scan duration)
    _append_metadata(output_path, the_crew, elapsed, skill_directory)

    # 8. Print summary
    _print_summary(output_path, elapsed)

    return True


# ---------------------------------------------------------------------------
# Multi-scan orchestrator
# ---------------------------------------------------------------------------


def _run_multi_scan(
    skills: List[dict],
    output_dir: str,
    parallel: bool,
    SkillScanner,
    discover_skill_files,
    scan_binary_files_fn=None,
) -> List[Tuple[dict, str, bool]]:
    """
    Scan multiple skills, sequentially or in parallel.

    Args:
        skills: List of {"provider", "skill_name", "path"} dicts.
        output_dir: Directory to write per-skill reports.
        parallel: If True, scan up to 5 skills concurrently.
        SkillScanner: The crew class (passed to avoid import at module level).
        discover_skill_files: The file discovery function.
        scan_binary_files_fn: Optional binary file scanning function.

    Returns:
        List of (skill_info, report_path, success) tuples.
    """
    os.makedirs(output_dir, exist_ok=True)

    # Build (skill_info, report_path) pairs
    scan_jobs = []
    for skill_info in skills:
        report_name = f"{skill_info['provider']}__{skill_info['skill_name']}.json"
        report_path = os.path.join(output_dir, report_name)
        scan_jobs.append((skill_info, report_path))

    if not parallel:
        # Sequential execution
        results = []
        for skill_info, report_path in scan_jobs:
            print("\n" + "#" * 60)
            print(
                f"# Scanning: [{skill_info['provider']}] "
                f"{skill_info['skill_name']}"
            )
            print("#" * 60 + "\n")

            success = _scan_single(
                skill_info["path"],
                report_path,
                SkillScanner,
                discover_skill_files,
                scan_binary_files_fn,
            )
            results.append((skill_info, report_path, success))
        return results

    # Parallel execution
    print(
        f"[Skill Sentinel] Running {len(scan_jobs)} scan(s) in parallel "
        f"(max {_DEFAULT_PARALLEL_WORKERS} workers)\n"
    )

    results = []
    with ThreadPoolExecutor(max_workers=_DEFAULT_PARALLEL_WORKERS) as pool:
        future_to_job = {}
        for skill_info, report_path in scan_jobs:
            future = pool.submit(
                _scan_single,
                skill_info["path"],
                report_path,
                SkillScanner,
                discover_skill_files,
                scan_binary_files_fn,
            )
            future_to_job[future] = (skill_info, report_path)

        for future in as_completed(future_to_job):
            skill_info, report_path = future_to_job[future]
            try:
                success = future.result()
            except Exception as e:
                print(
                    f"[Skill Sentinel] Error scanning "
                    f"{skill_info['skill_name']}: {e}",
                    file=sys.stderr,
                )
                success = False
            results.append((skill_info, report_path, success))

    # Re-sort results to match original order
    order = {id(si): idx for idx, (si, _) in enumerate(scan_jobs)}
    results.sort(key=lambda r: order.get(id(r[0]), 0))

    return results


def _print_multi_summary(
    results: List[Tuple[dict, str, bool]],
    output_dir: str,
    total_elapsed: float,
) -> None:
    """Print the final summary table for a multi-scan run."""
    mins, secs = divmod(int(total_elapsed), 60)

    print("\n\n" + "=" * 70)
    print("  ALL SCANS COMPLETE")
    print("=" * 70)
    print(
        f"  {'Provider':<10} {'Skill':<25} {'Verdict':<12} Report"
    )
    print("-" * 70)
    for skill_info, report_path, success in results:
        if success:
            verdict = _read_verdict(report_path)
        else:
            verdict = "SKIPPED"
        print(
            f"  {skill_info['provider']:<10} "
            f"{skill_info['skill_name']:<25} "
            f"{verdict:<12} "
            f"{report_path}"
        )
    print("-" * 70)
    print(f"  Total time:   {mins}m {secs}s")
    print(f"  Reports:      {output_dir}")
    print("=" * 70)


# ---------------------------------------------------------------------------
# scan command
# ---------------------------------------------------------------------------


def cmd_scan(args: argparse.Namespace) -> None:
    """Execute the skill-scanner crew."""
    # ------------------------------------------------------------------
    # Load .env from the package repo root (won't override existing env vars)
    # ------------------------------------------------------------------
    from dotenv import load_dotenv

    _PACKAGE_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__)
    )))
    load_dotenv(os.path.join(_PACKAGE_ROOT, ".env"), override=False)

    # ------------------------------------------------------------------
    # Validate API key early, before heavy imports
    # ------------------------------------------------------------------
    api_key = args.api_key or os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        print(
            "Error: OpenAI API key not found.\n"
            "Set it via:  export OPENAI_API_KEY='sk-...'\n"
            "Or pass:     --api-key sk-...",
            file=sys.stderr,
        )
        sys.exit(1)

    os.environ["OPENAI_API_KEY"] = api_key

    # ------------------------------------------------------------------
    # Set model (env var is how CrewAI / litellm pick it up)
    # ------------------------------------------------------------------
    model = args.model or os.environ.get("OPENAI_MODEL_NAME", "gpt-5.4-mini")
    os.environ["OPENAI_MODEL_NAME"] = model

    # ------------------------------------------------------------------
    # Heavy imports after env is configured
    # ------------------------------------------------------------------
    from skill_sentinel.crew import SkillScanner  # noqa: E402
    from skill_sentinel.tools.file_discovery import discover_skill_files  # noqa: E402
    from skill_sentinel.tools.virustotal_tool import scan_binary_files  # noqa: E402

    # ------------------------------------------------------------------
    # Determine scan mode
    # ------------------------------------------------------------------
    explicit_skill = getattr(args, "skill", None)
    explicit_dir = getattr(args, "dir", None)
    positional = args.skill_directory
    parallel = getattr(args, "parallel", False)

    # Mode 1: --skill /path  (single scan)
    if explicit_skill:
        skill_directory = os.path.abspath(explicit_skill)
        if not os.path.isdir(skill_directory):
            print(
                f"Error: '{skill_directory}' is not a directory.",
                file=sys.stderr,
            )
            sys.exit(1)

        output_path = os.path.abspath(args.output)
        success = _scan_single(
            skill_directory, output_path, SkillScanner, discover_skill_files,
            scan_binary_files,
        )
        if not success:
            sys.exit(1)
        return

    # Mode 2: --dir /path  (multi-scan from parent directory)
    if explicit_dir:
        parent_dir = os.path.abspath(explicit_dir)
        if not os.path.isdir(parent_dir):
            print(
                f"Error: '{parent_dir}' is not a directory.",
                file=sys.stderr,
            )
            sys.exit(1)

        skills = _discover_skills_in_dir(parent_dir)
        if not skills:
            print(
                f"[Skill Sentinel] No skill directories (with SKILL.md) "
                f"found in '{parent_dir}'.",
                file=sys.stderr,
            )
            sys.exit(1)

        output_dir = os.path.abspath(args.output)

        print(f"[Skill Sentinel] Found {len(skills)} skill(s) in {parent_dir}:")
        for s in skills:
            print(f"  - {s['skill_name']}  ({s['path']})")
        if parallel:
            print(f"[Skill Sentinel] Parallel mode: up to {_DEFAULT_PARALLEL_WORKERS} concurrent scans")
        print()

        t_start = time.monotonic()
        results = _run_multi_scan(
            skills, output_dir, parallel, SkillScanner, discover_skill_files,
            scan_binary_files,
        )
        total_elapsed = time.monotonic() - t_start
        _print_multi_summary(results, output_dir, total_elapsed)
        return

    # Mode 3: positional arg is a provider keyword or None (auto-discover)
    if positional is None or positional.lower() in _PROVIDER_KEYWORDS:
        provider = positional.lower() if positional else None
        skills = _discover_skill_dirs(provider)

        if not skills:
            label = provider if provider else "any provider"
            print(
                f"[Skill Sentinel] No skill directories found for {label}.\n"
                f"[Skill Sentinel] Searched paths:",
                file=sys.stderr,
            )
            search = (
                _SKILL_SEARCH_PATHS[provider]
                if provider
                else [p for paths in _SKILL_SEARCH_PATHS.values() for p in paths]
            )
            for sp in search:
                expanded = os.path.abspath(os.path.expanduser(sp))
                print(f"  - {expanded}", file=sys.stderr)
            sys.exit(1)

        output_dir = os.path.abspath(args.output)

        print(f"[Skill Sentinel] Auto-discovered {len(skills)} skill(s):")
        for s in skills:
            print(f"  - [{s['provider']}] {s['skill_name']}  ({s['path']})")
        if parallel:
            print(f"[Skill Sentinel] Parallel mode: up to {_DEFAULT_PARALLEL_WORKERS} concurrent scans")
        print()

        t_start = time.monotonic()
        results = _run_multi_scan(
            skills, output_dir, parallel, SkillScanner, discover_skill_files,
            scan_binary_files,
        )
        total_elapsed = time.monotonic() - t_start
        _print_multi_summary(results, output_dir, total_elapsed)
        return

    # Mode 4: positional arg is an explicit path (single scan, backward compat)
    skill_directory = os.path.abspath(positional)
    if not os.path.isdir(skill_directory):
        print(
            f"Error: '{skill_directory}' is not a directory.",
            file=sys.stderr,
        )
        sys.exit(1)

    output_path = os.path.abspath(args.output)
    success = _scan_single(
        skill_directory, output_path, SkillScanner, discover_skill_files,
        scan_binary_files,
    )
    if not success:
        sys.exit(1)


# ---------------------------------------------------------------------------
# CLI parser
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="skill-sentinel",
        description="Scan an Agent Skill package for security threats.",
    )
    parser.add_argument(
        "-V",
        "--version",
        action="version",
        version=f"%(prog)s {_get_version()}",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # --- scan sub-command ---
    scan_parser = subparsers.add_parser(
        "scan",
        help="Run the security scanner on skill directories.",
    )

    # Positional: optional, for provider keywords or a direct skill path.
    # A path is always treated as a single skill directory by default.
    scan_parser.add_argument(
        "skill_directory",
        nargs="?",
        default=None,
        help=(
            "Path to a skill directory (treated as a single skill by default), "
            "or a provider keyword (cursor/claude/codex/openclaw) to auto-discover. "
            "Omit to auto-discover from all providers. "
            "Use --dir to scan a directory of multiple skills."
        ),
    )

    # Explicit path flags (mutually exclusive with each other)
    path_group = scan_parser.add_mutually_exclusive_group()
    path_group.add_argument(
        "--skill",
        metavar="PATH",
        default=None,
        help="Path to a single skill directory to scan.",
    )
    path_group.add_argument(
        "--dir",
        metavar="PATH",
        default=None,
        help=(
            "Path to a parent directory containing multiple skill "
            "subdirectories. Each subdirectory with a SKILL.md is scanned."
        ),
    )

    scan_parser.add_argument(
        "-o",
        "--output",
        default=None,
        help=(
            "For single scan: output report file (default: report.json). "
            "For multi-scan: output directory (default: ./skill_sentinel_reports)."
        ),
    )
    scan_parser.add_argument(
        "--parallel",
        action="store_true",
        default=False,
        help=(
            "Scan multiple skills in parallel (up to 5 concurrent scans). "
            "Only applies when scanning multiple skills (auto-discover or --dir)."
        ),
    )
    scan_parser.add_argument(
        "-m",
        "--model",
        default=None,
        help=(
            "OpenAI model to use (default: gpt-5.4-mini). "
            "Also settable via OPENAI_MODEL_NAME env var."
        ),
    )
    scan_parser.add_argument(
        "--api-key",
        default=None,
        help=(
            "OpenAI API key. Prefer using the OPENAI_API_KEY env var instead."
        ),
    )

    return parser


def _get_version() -> str:
    try:
        from skill_sentinel import __version__

        return __version__
    except Exception:
        return "unknown"


def _is_multi_scan_mode(args: argparse.Namespace) -> bool:
    """Determine if the scan will process multiple skills."""
    if getattr(args, "dir", None):
        return True
    if getattr(args, "skill", None):
        return False
    positional = args.skill_directory
    if positional is None or positional.lower() in _PROVIDER_KEYWORDS:
        return True
    return False


def main() -> None:
    # Disable CrewAI telemetry/tracing prompt by default
    os.environ.setdefault("CREWAI_TRACING_ENABLED", "false")
    
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "scan":
        # Set default for -o based on scan mode
        if args.output is None:
            if _is_multi_scan_mode(args):
                args.output = "skill_sentinel_reports"
            else:
                args.output = "report.json"

        cmd_scan(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
