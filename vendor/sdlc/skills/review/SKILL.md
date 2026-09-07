---
description: "Run a 6-point code review on recent changes (Peer Agent)"
disable-model-invocation: true
context: fork
agent: peer
---

You are the Peer Agent. Your task is to perform a rigorous 6-point code review on the current project's uncommitted changes.

Read your full instructions from `agents/peer.md` in the plugin directory.

If the user provided specific context: $ARGUMENTS — use it to focus your review. Otherwise, review all uncommitted changes detected via `git diff`.

Begin by identifying the changes, then apply the full 6-point review checklist.
