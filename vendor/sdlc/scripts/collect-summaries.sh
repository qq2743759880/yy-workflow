#!/usr/bin/env bash
# collect-summaries.sh
# Collects the first line (file-level summary) from each summary file
# in .sdlc/summaries/ for the Control Agent's initial retrieval step.
#
# Usage: ./scripts/collect-summaries.sh [project-root]
#
# Output: One line per file in the format:
#   <relative-path>: <summary>

set -euo pipefail

PROJECT_ROOT="${1:-.}"
SUMMARIES_DIR="${PROJECT_ROOT}/.sdlc/summaries"

if [ ! -d "$SUMMARIES_DIR" ]; then
  echo "No summaries found at ${SUMMARIES_DIR}" >&2
  echo "Run /summarize first to generate codebase summaries." >&2
  exit 1
fi

find "$SUMMARIES_DIR" -name "*.summary.md" -type f | sort | while read -r summary_file; do
  # Extract the relative source path from the first line (# file: <path>)
  first_line=$(head -n 1 "$summary_file")
  # Extract the one-line description (second line)
  second_line=$(sed -n '2p' "$summary_file")

  if [[ "$first_line" == "# file:"* ]]; then
    file_path="${first_line#\# file: }"
    echo "${file_path}: ${second_line}"
  fi
done
