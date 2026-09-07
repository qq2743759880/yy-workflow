"""
Custom CrewAI tools for the Skill Scanner agents.

ReadFileTool - Read file contents with optional line ranges.
GrepTool     - Search for regex patterns across files/directories.

Based on the reference implementations from mcp_scanner_test.
"""

from crewai.tools import BaseTool
from typing import ClassVar, Set, Type, Optional
from pydantic import BaseModel, Field
import os
import re


# ---------------------------------------------------------------------------
# ReadFileTool
# ---------------------------------------------------------------------------

class ReadFileToolInput(BaseModel):
    """Input schema for ReadFileTool."""
    path: str = Field(..., description="Path to the file to read.")
    start_line: Optional[int] = Field(
        None,
        description="Starting line number (1-indexed, inclusive). "
                    "If provided with end_line, returns only lines in that range.",
    )
    end_line: Optional[int] = Field(
        None,
        description="Ending line number (1-indexed, inclusive). "
                    "If provided with start_line, returns only lines in that range.",
    )


class ReadFileTool(BaseTool):
    name: str = "ReadFile"
    description: str = (
        "Use this tool to read the contents of a file. "
        "You can optionally specify start_line and end_line to read only a specific range. "
        "Line numbers are 1-indexed and inclusive. "
        "Example: start_line=10, end_line=20 returns lines 10 through 20. "
        "If line numbers are not provided, returns the complete file content."
    )
    args_schema: Type[BaseModel] = ReadFileToolInput

    def _run(
        self,
        path: str,
        start_line: Optional[int] = None,
        end_line: Optional[int] = None,
    ) -> str:
        """Read and return the contents of the specified file or a line range."""
        try:
            if not os.path.exists(path):
                return f"Error: File '{path}' does not exist."

            if not os.path.isfile(path):
                return f"Error: '{path}' is not a file."

            # Validate line numbers
            if start_line is not None and start_line < 1:
                return f"Error: start_line must be >= 1, got {start_line}"

            if end_line is not None and end_line < 1:
                return f"Error: end_line must be >= 1, got {end_line}"

            if (
                start_line is not None
                and end_line is not None
                and start_line > end_line
            ):
                return (
                    f"Error: start_line ({start_line}) cannot be greater "
                    f"than end_line ({end_line})"
                )

            # Try multiple encodings
            encodings_to_try = ['utf-8', 'utf-8-sig', 'latin1', 'cp1252']

            content = None
            for encoding in encodings_to_try:
                try:
                    with open(path, 'r', encoding=encoding) as f:
                        lines = f.readlines()
                        total_lines = len(lines)

                        if start_line is not None and end_line is not None:
                            actual_end = min(end_line, total_lines)
                            if start_line > total_lines:
                                return (
                                    f"Error: start_line ({start_line}) is beyond "
                                    f"file length ({total_lines} lines)"
                                )
                            selected_lines = lines[start_line - 1:actual_end]
                            start_num = start_line
                        else:
                            selected_lines = lines
                            start_num = 1

                        numbered_lines = []
                        for i, line in enumerate(selected_lines, start=start_num):
                            numbered_lines.append(f"{i:4d}| {line.rstrip()}")

                        content = '\n'.join(numbered_lines)
                        break
                except UnicodeDecodeError:
                    continue

            if content is not None:
                return content

            # Fallback: read as binary with replacement chars
            try:
                with open(path, 'rb') as f:
                    raw_content = f.read()
                    decoded_content = raw_content.decode('utf-8', errors='replace')
                    lines = decoded_content.split('\n')
                    total_lines = len(lines)

                    if start_line is not None and end_line is not None:
                        actual_end = min(end_line, total_lines)
                        if start_line > total_lines:
                            return (
                                f"Error: start_line ({start_line}) is beyond "
                                f"file length ({total_lines} lines)"
                            )
                        selected_lines = lines[start_line - 1:actual_end]
                        start_num = start_line
                    else:
                        selected_lines = lines
                        start_num = 1

                    numbered_lines = []
                    for i, line in enumerate(selected_lines, start=start_num):
                        numbered_lines.append(f"{i:4d}| {line}")

                    return '\n'.join(numbered_lines)
            except Exception as e:
                return f"Error reading file as binary: {str(e)}"

        except PermissionError:
            return f"Error: Permission denied to read file '{path}'."
        except Exception as e:
            return f"Error reading file '{path}': {str(e)}"


# ---------------------------------------------------------------------------
# GrepTool
# ---------------------------------------------------------------------------

class GrepToolInput(BaseModel):
    """Input schema for GrepTool."""
    pattern: str = Field(
        ..., description="The pattern to search for (supports regex)."
    )
    path: str = Field(
        ..., description="Path to the directory or file to search in."
    )
    file_extension: Optional[str] = Field(
        None,
        description="Optional file extension to filter (e.g., '.py', '.js'). "
                    "If not provided, searches all code and documentation files.",
    )


class GrepTool(BaseTool):
    name: str = "GrepCode"
    description: str = (
        "Use this tool to search for patterns in the codebase. "
        "Supports regex patterns. Very useful for finding suspicious code patterns "
        "like 'requests.post', 'eval(', 'os.system', 'base64', 'AKIA', hardcoded secrets, etc. "
        "Returns file paths and line numbers where the pattern is found."
    )
    args_schema: Type[BaseModel] = GrepToolInput

    # File extensions to search (includes .md and .sh for skill packages)
    CODE_EXTENSIONS: ClassVar[Set[str]] = {
        '.py', '.js', '.ts', '.tsx', '.jsx', '.go', '.java', '.c', '.cpp', '.cc',
        '.cxx', '.h', '.hpp', '.cs', '.php', '.rb', '.rs', '.swift', '.kt', '.scala',
        '.sh', '.bash', '.md', '.markdown', '.yaml', '.yml', '.toml', '.json',
    }

    # Directories to ignore
    IGNORED_DIRS: ClassVar[Set[str]] = {
        '__pycache__', '.pytest_cache', '.mypy_cache', 'venv', '.venv', 'env', '.env',
        'site-packages', '.tox', 'node_modules', 'bower_components', '.npm', '.yarn',
        'build', 'dist', 'out', 'output', 'target', 'bin', 'obj', 'lib', 'libs',
        '.vscode', '.idea', '.eclipse', '.settings', '.git', '.svn', '.hg',
        'vendor', 'Godeps', '_deps', '_build', '.doctrees', 'htmlcov',
        'tmp', 'temp', '.tmp', '.cache', 'cache', 'coverage', 'logs', 'log',
    }

    def _search_in_file(self, file_path: str, pattern: str) -> list:
        """Search for pattern in a single file."""
        results = []
        encodings_to_try = ['utf-8', 'utf-8-sig', 'latin1', 'cp1252']

        for encoding in encodings_to_try:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    lines = f.readlines()
                    for line_num, line in enumerate(lines, start=1):
                        if re.search(pattern, line, re.IGNORECASE):
                            results.append({
                                'file': file_path,
                                'line_number': line_num,
                                'line_content': line.strip(),
                            })
                break
            except UnicodeDecodeError:
                continue
            except Exception:
                break  # Skip files that can't be read

        return results

    def _run(
        self,
        pattern: str,
        path: str,
        file_extension: Optional[str] = None,
    ) -> str:
        """Search for pattern in files."""
        try:
            if not os.path.exists(path):
                return f"Error: Path '{path}' does not exist."

            all_results = []

            if os.path.isfile(path):
                all_results = self._search_in_file(path, pattern)
            else:
                for root, dirs, files in os.walk(path):
                    # Skip ignored directories
                    dirs[:] = [
                        d for d in dirs
                        if not d.startswith('.') and d.lower() not in self.IGNORED_DIRS
                    ]

                    for filename in files:
                        if filename.startswith('.'):
                            continue

                        file_path = os.path.join(root, filename)

                        if file_extension:
                            if not filename.endswith(file_extension):
                                continue
                        else:
                            if not any(filename.endswith(ext) for ext in self.CODE_EXTENSIONS):
                                continue

                        results = self._search_in_file(file_path, pattern)
                        all_results.extend(results)

            if not all_results:
                return f"No matches found for pattern '{pattern}' in {path}"

            output_lines = [
                f"Found {len(all_results)} match(es) for pattern '{pattern}':\n"
            ]
            for result in all_results:
                output_lines.append(
                    f"File: {result['file']}\n"
                    f"Line {result['line_number']}: {result['line_content']}\n"
                )

            return '\n'.join(output_lines)

        except Exception as e:
            return f"Error during search: {str(e)}"
