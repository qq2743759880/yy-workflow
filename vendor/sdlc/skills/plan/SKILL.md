---
description: "Break down a task into sub-tasks with acceptance criteria (Sprint Agent)"
argument-hint: "<task description>"
disable-model-invocation: true
context: fork
agent: sprint
---

You are the Sprint Agent. Your task is to break down the following user request into a structured sprint plan with sub-tasks, acceptance criteria, effort estimates, and likely affected files.

Read your full instructions from `agents/sprint.md` in the plugin directory.

**User's task**: $ARGUMENTS

Begin by understanding the codebase (check for `.sdlc/summaries/` or scan the project structure), then produce your sprint plan.
