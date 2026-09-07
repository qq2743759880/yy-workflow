"""
Static file discovery utility for skill packages.

Recursively walks a skill directory, classifies files by type,
and returns structured data for the CrewAI pipeline.
This is NOT a CrewAI tool -- it runs before the crew kicks off.
"""

import os
import json
from typing import Dict, List, Any


# Directories to skip during traversal
IGNORED_DIRS = {
    '__pycache__', '.pytest_cache', '.mypy_cache', 'venv', '.venv', 'env',
    'site-packages', '.tox', 'node_modules', 'bower_components', '.npm', '.yarn',
    'build', 'dist', 'out', 'output', 'target', 'bin', 'obj', 'lib', 'libs',
    '.vscode', '.idea', '.eclipse', '.settings', '.git', '.svn', '.hg',
    'vendor', 'Godeps', '_deps', '_build', '.doctrees', 'htmlcov',
    'tmp', 'temp', '.tmp', '.cache', 'cache', 'coverage', 'logs', 'log',
}

# File type classification
SCRIPT_EXTENSIONS = {'.py', '.sh', '.bash'}
MARKDOWN_EXTENSIONS = {'.md', '.markdown'}
CONFIG_EXTENSIONS = {'.yaml', '.yml', '.toml', '.json', '.ini', '.cfg', '.conf'}
CODE_EXTENSIONS = {
    '.py', '.js', '.ts', '.tsx', '.jsx', '.go', '.java', '.c', '.cpp',
    '.h', '.hpp', '.cs', '.php', '.rb', '.rs', '.swift', '.kt', '.scala',
}
BINARY_EXTENSIONS = {
    # Images
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp', '.tiff',
    # Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    # Archives
    '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.tgz',
    # Executables / shared libraries
    '.exe', '.dll', '.so', '.dylib', '.bin', '.com', '.msi',
    # JVM / WASM
    '.wasm', '.class', '.jar', '.war',
}


def classify_file(filename: str) -> str:
    """Classify a file by its name/extension."""
    if filename.upper() == 'SKILL.MD':
        return 'skill_md'

    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    if ext in {'.py'}:
        return 'python_script'
    elif ext in {'.sh', '.bash'}:
        return 'bash_script'
    elif ext in MARKDOWN_EXTENSIONS:
        return 'markdown'
    elif ext in CONFIG_EXTENSIONS:
        return 'config'
    elif ext in CODE_EXTENSIONS:
        return 'code'
    elif ext in BINARY_EXTENSIONS:
        return 'binary'
    else:
        return 'other'


def discover_skill_files(skill_directory: str) -> Dict[str, Any]:
    """
    Recursively walk a skill directory and classify all files.

    Args:
        skill_directory: Absolute or relative path to the skill package root.

    Returns:
        A dict with:
            - skill_directory: The resolved absolute path
            - file_tree: List of dicts with 'path', 'relative_path', 'type', 'size_bytes'
            - skill_md_path: Path to SKILL.md (or None if not found)
            - script_files: List of paths to .py and .sh files
            - markdown_files: List of paths to .md files (excluding SKILL.md)
            - config_files: List of paths to config files
            - binary_files: List of paths to binary files (images, PDFs, executables, etc.)
            - all_files: Flat list of all file paths
    """
    skill_directory = os.path.abspath(skill_directory)

    if not os.path.isdir(skill_directory):
        raise FileNotFoundError(f"Skill directory not found: {skill_directory}")

    file_tree: List[Dict[str, Any]] = []
    skill_md_path: str | None = None
    script_files: List[str] = []
    markdown_files: List[str] = []
    config_files: List[str] = []
    binary_files: List[str] = []
    all_files: List[str] = []

    for root, dirs, files in os.walk(skill_directory):
        # Skip ignored directories (in-place modification)
        dirs[:] = [
            d for d in dirs
            if d.lower() not in IGNORED_DIRS and not d.startswith('.')
        ]

        for filename in sorted(files):
            # Skip hidden files
            if filename.startswith('.'):
                continue

            file_path = os.path.join(root, filename)
            relative_path = os.path.relpath(file_path, skill_directory)
            file_type = classify_file(filename)

            try:
                size_bytes = os.path.getsize(file_path)
            except OSError:
                size_bytes = 0

            entry = {
                'path': file_path,
                'relative_path': relative_path,
                'type': file_type,
                'size_bytes': size_bytes,
            }
            file_tree.append(entry)
            all_files.append(file_path)

            # Categorize
            if file_type == 'skill_md':
                skill_md_path = file_path
            elif file_type in ('python_script', 'bash_script'):
                script_files.append(file_path)
            elif file_type == 'markdown':
                markdown_files.append(file_path)
            elif file_type == 'config':
                config_files.append(file_path)
            elif file_type == 'binary':
                binary_files.append(file_path)

    return {
        'skill_directory': skill_directory,
        'file_tree': file_tree,
        'skill_md_path': skill_md_path,
        'script_files': script_files,
        'markdown_files': markdown_files,
        'config_files': config_files,
        'binary_files': binary_files,
        'all_files': all_files,
    }


if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python file_discovery.py <skill_directory>")
        sys.exit(1)
    result = discover_skill_files(sys.argv[1])
    print(json.dumps(result, indent=2))
