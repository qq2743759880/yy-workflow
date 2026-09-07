"""
VirusTotal scanning tool for binary files in skill packages.

Provides:
- ``VirusTotalTool`` — a CrewAI BaseTool that agents can invoke.
- ``scan_binary_files()`` — a standalone helper for pre-processing binary
  files *before* the agent pipeline starts.

Binary files (images, PDFs, executables, archives, etc.) are checked against
VirusTotal's database using SHA256 hash lookups.  Text/code files are
excluded automatically.
"""

import hashlib
import logging
import os
from pathlib import Path
from typing import ClassVar, Dict, List, Optional, Set, Type

import httpx
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────────
# Constants
# ────────────────────────────────────────────────────────────────────────────

# Binary file extensions worth scanning
BINARY_EXTENSIONS: Set[str] = {
    # Images
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".webp", ".tiff",
    # Documents
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    # Archives
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".tgz",
    # Executables / shared libraries
    ".exe", ".dll", ".so", ".dylib", ".bin", ".com", ".msi",
    # JVM / WASM
    ".wasm", ".class", ".jar", ".war",
}

# Text/code extensions to EXCLUDE (never upload to VT)
EXCLUDED_EXTENSIONS: Set[str] = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".c", ".cpp", ".h", ".hpp",
    ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".cs", ".vb",
    ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".ini", ".conf", ".cfg",
    ".xml", ".html", ".css", ".scss", ".sass", ".less",
    ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd",
    ".sql", ".graphql", ".proto", ".thrift", ".rst", ".org", ".adoc", ".tex",
}

VT_BASE_URL = "https://www.virustotal.com/api/v3"


# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────

def is_binary_file(file_path: str) -> bool:
    """Return True if *file_path* has a binary extension we should scan."""
    ext = Path(file_path).suffix.lower()
    if ext in EXCLUDED_EXTENSIONS:
        return False
    return ext in BINARY_EXTENSIONS


def _calculate_sha256(file_path: str) -> str:
    """Return the hex SHA-256 digest of *file_path*."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def _query_virustotal(file_hash: str, api_key: str) -> dict:
    """
    Query VirusTotal for a file hash.

    Returns a dict with keys:
        found (bool), malicious (int), suspicious (int), undetected (int),
        harmless (int), total_engines (int), permalink (str|None),
        scan_date (str|None), error (str|None).
    """
    headers = {"x-apikey": api_key, "Accept": "application/json"}

    try:
        resp = httpx.get(
            f"{VT_BASE_URL}/files/{file_hash}",
            headers=headers,
            timeout=15,
        )

        if resp.status_code == 404:
            return {"found": False, "error": None}

        if resp.status_code == 429:
            return {"found": False, "error": "VirusTotal rate limit exceeded"}

        if resp.status_code != 200:
            return {
                "found": False,
                "error": f"VirusTotal returned HTTP {resp.status_code}",
            }

        data = resp.json()
        stats = (
            data.get("data", {})
            .get("attributes", {})
            .get("last_analysis_stats", {})
        )
        scan_date = (
            data.get("data", {})
            .get("attributes", {})
            .get("last_analysis_date")
        )

        gui_url = f"https://www.virustotal.com/gui/file/{file_hash}"

        return {
            "found": True,
            "malicious": stats.get("malicious", 0),
            "suspicious": stats.get("suspicious", 0),
            "undetected": stats.get("undetected", 0),
            "harmless": stats.get("harmless", 0),
            "total_engines": sum(stats.values()),
            "scan_date": scan_date,
            "permalink": gui_url,
            "error": None,
        }

    except httpx.RequestError as exc:
        return {"found": False, "error": f"Request failed: {exc}"}


def _severity_from_ratio(malicious: int, total: int) -> str:
    """Determine severity string from detection ratio."""
    if total == 0:
        return "MEDIUM"
    ratio = malicious / total
    if ratio >= 0.3:
        return "CRITICAL"
    if ratio >= 0.1:
        return "HIGH"
    return "MEDIUM"


# ────────────────────────────────────────────────────────────────────────────
# CrewAI Tool
# ────────────────────────────────────────────────────────────────────────────

class VirusTotalToolInput(BaseModel):
    """Input schema for VirusTotalTool."""
    file_path: str = Field(
        ..., description="Absolute path to the binary file to scan."
    )


class VirusTotalTool(BaseTool):
    """
    Scan a binary file against VirusTotal using its SHA-256 hash.

    Requires the ``VIRUSTOTAL_API_KEY`` environment variable to be set.
    Returns a human-readable summary of the scan result.
    """

    name: str = "VirusTotalScan"
    description: str = (
        "Scan a binary file (image, PDF, archive, executable, etc.) against "
        "VirusTotal's malware database using its SHA-256 hash. "
        "Returns detection counts and a link to the full report. "
        "Requires the VIRUSTOTAL_API_KEY environment variable."
    )
    args_schema: Type[BaseModel] = VirusTotalToolInput

    # Class-level constants
    BINARY_EXTENSIONS: ClassVar[Set[str]] = BINARY_EXTENSIONS
    EXCLUDED_EXTENSIONS: ClassVar[Set[str]] = EXCLUDED_EXTENSIONS

    def _run(self, file_path: str) -> str:
        api_key = os.environ.get("VIRUSTOTAL_API_KEY", "")
        if not api_key:
            return (
                "Error: VIRUSTOTAL_API_KEY environment variable is not set. "
                "Cannot perform VirusTotal scan."
            )

        if not os.path.isfile(file_path):
            return f"Error: File '{file_path}' does not exist."

        ext = Path(file_path).suffix.lower()
        if ext in EXCLUDED_EXTENSIONS:
            return (
                f"Skipped: '{file_path}' is a text/code file "
                f"(extension {ext}), not a binary."
            )

        try:
            file_hash = _calculate_sha256(file_path)
        except Exception as exc:
            return f"Error computing SHA-256 for '{file_path}': {exc}"

        result = _query_virustotal(file_hash, api_key)

        if result.get("error"):
            return f"VirusTotal error for '{file_path}': {result['error']}"

        if not result.get("found"):
            return (
                f"File '{file_path}' (SHA256: {file_hash}) was NOT found in "
                "VirusTotal's database. It has never been scanned before."
            )

        malicious = result["malicious"]
        suspicious = result["suspicious"]
        total = result["total_engines"]
        permalink = result.get("permalink", "")

        if malicious > 0:
            severity = _severity_from_ratio(malicious, total)
            return (
                f"MALICIOUS — '{os.path.basename(file_path)}' flagged by "
                f"{malicious}/{total} engines "
                f"(suspicious: {suspicious}). "
                f"Severity: {severity}. "
                f"SHA256: {file_hash}. "
                f"Report: {permalink}"
            )

        if suspicious > 0:
            return (
                f"SUSPICIOUS — '{os.path.basename(file_path)}' flagged as "
                f"suspicious by {suspicious}/{total} engines "
                f"(malicious: 0). "
                f"SHA256: {file_hash}. "
                f"Report: {permalink}"
            )

        return (
            f"CLEAN — '{os.path.basename(file_path)}' scanned by "
            f"{total} engines with 0 detections. "
            f"SHA256: {file_hash}. "
            f"Report: {permalink}"
        )


# ────────────────────────────────────────────────────────────────────────────
# Standalone pre-processing helper
# ────────────────────────────────────────────────────────────────────────────

def scan_binary_files(
    file_tree: List[Dict],
    api_key: Optional[str] = None,
) -> List[Dict]:
    """
    Scan all binary files from the file discovery tree via VirusTotal.

    This is meant to be called **before** the agent pipeline starts so that
    the results can be injected into the agent context.

    Args:
        file_tree: The ``file_tree`` list returned by ``discover_skill_files()``.
        api_key: VirusTotal API key.  Falls back to ``VIRUSTOTAL_API_KEY`` env
                 var if not provided.

    Returns:
        A list of result dicts, one per binary file scanned::

            {
                "file_path": "...",
                "relative_path": "...",
                "sha256": "...",
                "found_in_vt": True/False,
                "malicious": 0,
                "suspicious": 0,
                "total_engines": 72,
                "severity": "CLEAN" | "NOT_SCANNED" | "MEDIUM" | "HIGH" | "CRITICAL",
                "permalink": "...",
                "error": null,
            }
    """
    api_key = api_key or os.environ.get("VIRUSTOTAL_API_KEY", "")
    if not api_key:
        return []

    results: List[Dict] = []

    for entry in file_tree:
        fpath = entry["path"]
        rel = entry.get("relative_path", os.path.basename(fpath))

        if not is_binary_file(fpath):
            continue

        try:
            file_hash = _calculate_sha256(fpath)
        except Exception as exc:
            results.append({
                "file_path": fpath,
                "relative_path": rel,
                "sha256": None,
                "found_in_vt": False,
                "malicious": 0,
                "suspicious": 0,
                "total_engines": 0,
                "severity": "NOT_SCANNED",
                "permalink": None,
                "error": str(exc),
            })
            continue

        vt = _query_virustotal(file_hash, api_key)

        if vt.get("error"):
            results.append({
                "file_path": fpath,
                "relative_path": rel,
                "sha256": file_hash,
                "found_in_vt": False,
                "malicious": 0,
                "suspicious": 0,
                "total_engines": 0,
                "severity": "NOT_SCANNED",
                "permalink": None,
                "error": vt["error"],
            })
            continue

        if not vt.get("found"):
            results.append({
                "file_path": fpath,
                "relative_path": rel,
                "sha256": file_hash,
                "found_in_vt": False,
                "malicious": 0,
                "suspicious": 0,
                "total_engines": 0,
                "severity": "NOT_SCANNED",
                "permalink": None,
                "error": None,
            })
            continue

        mal = vt["malicious"]
        sus = vt["suspicious"]
        total = vt["total_engines"]

        if mal > 0:
            sev = _severity_from_ratio(mal, total)
        elif sus > 0:
            sev = "MEDIUM"
        else:
            sev = "CLEAN"

        results.append({
            "file_path": fpath,
            "relative_path": rel,
            "sha256": file_hash,
            "found_in_vt": True,
            "malicious": mal,
            "suspicious": sus,
            "total_engines": total,
            "severity": sev,
            "permalink": vt.get("permalink"),
            "error": None,
        })

    return results
