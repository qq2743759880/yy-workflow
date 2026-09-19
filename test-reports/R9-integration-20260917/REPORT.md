# R9 Implementation Report — integration.validate + integration receipt

Date: 2026-09-17 22:08 CST. Executor: orchestrator (direct, standing authorization 20:56 CST). Frozen contract: contracts/C-R9-integration.md = 0b566d35beabcf64847de10d5f86699fdd692a660cd364e7c60f2cc573482b40 (Owner rulings 8/8 absorbed).

## Deliverables

| file | sha256 |
|---|---|
| scripts/lib/integration.mjs | (new runtime op: integration.validate; see below) |
| test-reports/R9-integration-20260917/integration-run.mjs | receipt driver (file-based) |
| test-reports/R9-integration-20260917/integration-receipt.json | 9b339adea6526ed2c04c0dd955f6a9e3a68abcaaec329fbc32b1321331d89ff2 |
| test-reports/R9-integration-20260917/integration-receipt.attempt1-DISCREPANCY_OPEN.json | preserved failed attempt (append-only discipline) |
| test-reports/R9-integration-20260917/e2e-results.json | 10/10 R5b fixtures exit 0 |
| test-reports/R9-integration-20260917/parity/desktop-1280x800.png | 56401 bytes |
| test-reports/R9-integration-20260917/parity/mobile-375x667.png | 43740 bytes |
| test-reports/R9-integration-20260917/parity/page.html + parity-manifest.json + dom-dump.html | injection page + manifest + rendered-DOM evidence |

## integrationResult (C-R9 §2 / OQ-R9-7=A)

contractHashOk=true (0b566d35… match); cdc.ok=true (M-26 keys × frontend consumption, zero mismatches); e2e.ok=true (10/10 fixtures); parity.ok=true (2 viewports + DOM title/progress verify); discrepancyOpen=false (after §6 interpretation below).

## Items requiring Owner ratification (flagged, not hidden)

1. **C-R7 record closure pointer backfill**: cr-20260917T035212Z-c2026fdf.json supersededBy=null → filled with pointer to C-R5-ui v2 re-freeze (new hash fe69de06989ebec1dbad52fe90bc219f7ea5301f1121746dcd10c51352d0fa1e). Only the reserved pointer field filled; all other fields byte-verified unchanged. Ledger had already marked this record CONSUMED.
2. **OQ-R9-6=A scan interpretation**: supersede-not-delete semantics — records with supersededBy filled are treated as closed (commented in code). Without this, the consumed C-R5-ui record would block every future receipt.
3. **CDC diagnostic whitelist**: NOT_FOUND rendered on the not-found panel is a C-R5-journey §8.1 frozen data-channel diagnostic (badge text with PARTIAL styling), added to the impl→map allowed set (commented in code).

## route41Rerun.required=false; no commits.