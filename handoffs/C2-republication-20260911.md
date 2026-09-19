# C2 Republication Probe Handoff (escape-stable)

## Role

You are an independent Execution Agent. This task is a narrow, evidence-only republication of G2.1 finding `C2`. You may use your own internal subagents.

You do not repair anything. You do not implement R2. You do not change finding statuses other than reporting what you observe.

## Why this task exists

The frozen C2 command was published as an inline `node -e "..."` one-liner containing `\\u4e00`. Its observed value is shell-dependent:

- executed via `bash <file>` -> `punctuationKeywordCount = 16`
- executed via a shell that preserves `\\` (PowerShell direct pass-through) -> `punctuationKeywordCount = 9`

Both were independently reproduced, from the same frozen text, at snapshot `240f3fb`. An inline command with a shell-escape variable is not a stable reproduction anchor, so C2 is currently `UNRESOLVED`. This task replaces the fragile inline form with a file-based probe that has zero shell escaping.

## Boundary

Allowed: create one new probe file outside the repo, create a new evidence directory, write raw outputs.

Forbidden: modifying any runtime source, vendor asset, prototype, planning document, or `SKILL.md`; repairing the manifest parser; changing any other G2.1 finding's status; copying the probe file into the repository.

## Snapshot

```text
Repository: D:/.ai-hub/skills/yy
Commit:     240f3fbdb4ee757dffc4d5ab80407d1b2c84863c
```

Create a clean detached worktree at that commit and set `core.autocrlf=false` **before** checkout, or the whole tree will appear modified and the CRLF variant will contaminate byte comparisons.

Record: `executionSessionId`, `executionAgentIdentity`, `model`, `cleanWorkspace`, node version.

## Known trap — read before writing the probe

A probe file that lives **outside** the repository cannot use a bare relative specifier:

```js
import { buildManifest } from './scripts/lib/manifest.mjs';   // WRONG when the probe is outside the repo
```

In ESM, a relative specifier resolves against the **probe file's own URL**, not the current working directory. The same applies to a relative `vendorDir`. The probe below resolves both against an explicit repository root, which is passed through `SNAPSHOT_ROOT`.

Do not "fix" this by copying the probe into the repository — the probe must stay outside so it never becomes part of the runtime tree.

## Probe (write this file verbatim, outside the repo)

Create `<EVIDENCE>/c2-probe.mjs`:

```js
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const repoRoot = process.env.SNAPSHOT_ROOT || process.cwd();

const manifestUrl = pathToFileURL(resolve(repoRoot, 'scripts/lib/manifest.mjs')).href;
const { buildManifest } = await import(manifestUrl);

const CJK_ONLY_PUNCT = /^[^a-z0-9\u4e00-\u9fff]+$/i;

const m = await buildManifest({ vendorDir: resolve(repoRoot, 'vendor') });

const scalarMarker = m.entries.filter((e) => e.description === '|' || e.description === '>-');
const punctuationKeywords = m.entries.filter(
  (e) => e.keywords.length > 0 && e.keywords.every((k) => CJK_ONLY_PUNCT.test(k)),
);

console.log(
  JSON.stringify(
    {
      repoRoot,
      entryCount: m.entries.length,
      warnings: m.warnings,
      scalarMarkerCount: scalarMarker.length,
      scalarMarkerAssets: scalarMarker.map((e) => ({ name: e.name, description: e.description })),
      punctuationKeywordCount: punctuationKeywords.length,
      punctuationKeywordAssets: punctuationKeywords.map((e) => e.name),
      perAsset: m.entries.map((e) => ({
        name: e.name,
        description: e.description,
        keywords: e.keywords,
      })),
    },
    null,
    2,
  ),
);
```

Notes:

- the regex uses a single backslash `\u4e00`; it lives in a file, so no shell layer interprets it;
- `vendorDir` is resolved to an absolute path, so the probe produces the same `path` field values (`vendor/<name>`) as the canonical `./vendor` form while no longer depending on the working directory;
- `repoRoot` is echoed in the output so the evidence records which tree was measured.

## Procedure

1. Freeze and hash the probe file before running it. Record the hash.
2. Resolve the clean snapshot root, then run from that root:

   ```powershell
   $env:SNAPSHOT_ROOT = "<clean worktree path>"
   cd $env:SNAPSHOT_ROOT
   node <EVIDENCE>/c2-probe.mjs
   ```

   Running from the snapshot root and setting `SNAPSHOT_ROOT` are both required; either alone is not sufficient evidence that the probe measured the intended tree.
3. Record exit code, stdout, stderr, and the probe hash. Confirm the echoed `repoRoot` equals the clean worktree path.
4. Run the same probe from a second clean worktree at the same commit and compare byte-for-byte.
5. If the probe exits non-zero, report the raw error and mark the run `UNRESOLVED`. Do not substitute an inline command as a fallback.
6. Report the observed values. Do not adjudicate C2 yourself and do not write a repair.

## What must be reported

| item | value |
|---|---|
| probe sha256 | |
| snapshot root (echoed repoRoot) | |
| run1 exit / stdout | |
| run2 exit / stdout | |
| run1 == run2 | |
| entryCount | |
| scalarMarkerCount | |
| scalarMarkerAssets | |
| punctuationKeywordCount | |
| punctuationKeywordAssets | |
| colorize.description | |
| warnings | |

Also answer explicitly:

- Is `punctuationKeywordCount` stable across both runs? `yes` / `no`
- Does the scalar-marker leakage (`description` equal to `|` or `>-`) reproduce? `yes` / `no`
- Does any asset have a declared `description` that is actually a YAML block-scalar marker rather than prose? `yes` / `no` + list

## Evidence layout

```text
test-reports/C2-republication-20260911/
  probe/c2-probe.mjs
  probe/c2-probe.sha256
  raw/run1.stdout.txt
  raw/run1.stderr.txt
  raw/run1.exit.txt
  raw/run2.stdout.txt
  raw/run2.stderr.txt
  raw/run2.exit.txt
  REPORT.md
```

If that directory already exists, stop and report instead of overwriting.

## Completion report

```text
# C2 Republication Report

snapshot: 240f3fbdb4ee757dffc4d5ab80407d1b2c84863c
executionSessionId: ...
executionAgentIdentity: ...
model: ...
cleanWorkspace: true|false
probeSha256: ...
snapshotRootEchoed: ...
runtimeFilesChanged: none
vendorAssetsChanged: none

## Observed
<paste the table above, filled in>

## Stability
- punctuationKeywordCount stable: yes|no
- scalar-marker leakage reproduced: yes|no

## Raw evidence
- ...

## Limitations
- ...
```

The orchestrator will re-run the probe independently. Your report alone does not change C2's status.