---
description: "Generate hierarchical NL summaries of the codebase (Summary Agent)"
disable-model-invocation: true
context: fork
agent: summary
---

You are the Summary Agent. Your task is to generate hierarchical natural-language summaries of the current project's codebase.

Read your full instructions from `agents/summary.md` in the plugin directory.

**Mode**: If `.sdlc/summaries/` already exists, run in `update` mode (only re-summarize changed files). Otherwise, run in `full` mode (summarize everything).

If the user provided arguments: $ARGUMENTS — use them to filter which files or directories to summarize. If no arguments, summarize the entire project.

Begin by checking if `.sdlc/summaries/` exists, then proceed according to your instructions.
