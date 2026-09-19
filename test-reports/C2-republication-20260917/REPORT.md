# C2 Republication Report — escape-stable file-based probe, two clean snapshots

Date: 2026-09-17 21:51 CST. Executor: orchestrator (direct, standing authorization). Handoff: handoffs/C2-republication-20260911.md (followed verbatim: probe outside repo, SNAPSHOT_ROOT resolution, two clean worktrees, byte comparison).

## What must be reported (handoff table, filled)

| item | value |
|---|---|
| probe sha256 | 188356a8e69e0012497f85aa7c5dcde2a998e036d1a95ee1ce30123cb973c7f7 |
| snapshot root (echoed repoRoot) | run1: D:\.ai-hub\tmp\c2-repub-841a78\snap1 / run2: same-parent snap2 (both detached HEAD 240f3fbd; vendor files confirmed present) |
| run1 exit / stdout | exit 0; stdout saved evidence/run1-stdout.txt (5604 bytes) |
| run2 exit / stdout | exit 0; stdout saved evidence/run2-stdout.txt (5604 bytes) |
| run1 == run2 | raw diff = exactly 2 lines (repoRoot echo pair, by-design per handoff: repoRoot echoed so evidence records which tree was measured); after snap1/snap2 substring normalization: **identical** (normalized copies saved) |
| entryCount | 16 |
| scalarMarkerCount | 2 (agent-research: pipe char, agent-vision-toolkit: >- marker) |
| scalarMarkerAssets | agent-research, agent-vision-toolkit |
| punctuationKeywordCount | **16** (matches frozen expected observation 16) |
| punctuationKeywordAssets | agent-research, agent-vision-toolkit, be-architect, be-provider, be-resilience, be-validator, colorize, dev-planner, frontend-design, frontend-visual-validation, implementation, planning, review, sdlc, security, skill-sentinel (all 16) |
| colorize.description | "The feature or component to colorize (optional)" (byte-matches frozen expectation) |
| warnings | [] (empty) |

## Interpretation (following C6 resolution precedent)

- Two clean snapshots at 240f3fbd; both runs exit 0; results identical after path normalization (the only raw difference is the by-design repoRoot echo).
- The escape-stable file-based probe observes punctuationKeywordCount=16 = the frozen expected observation. This confirms: (a) the vendor asset content satisfies the baseline expectation; (b) the ledger's 9 was a shell-escaping artifact of the inline node -e command form (backslash-u4e00 interpreted differently across command-interpretation contexts), exactly as R1 P4 divergence recorded (source hashes byte-verified identical on both sides).
- C2 status: **REPRODUCED to RESOLVED** (evidence blocker cleared — the unstable reproduction anchor is replaced by the escape-stable file probe; underlying asset content needs no repair).

## Evidence files

- probe: D:\.ai-hub\tmp\c2-repub-841a78\evidence\c2-probe.mjs (outside repo per handoff boundary)
- raw outputs: run1-stdout.txt / run2-stdout.txt; normalized: run1-normalized.txt / run2-normalized.txt