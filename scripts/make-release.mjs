#!/usr/bin/env node
/** Retired deployment entry. Historical callers receive a bounded migration hint. */
console.error('LEGACY_RELEASE_RETIRED: use node scripts/export-package.mjs --out <new directory> [--profile core|mcp]. Install the reviewed package explicitly.');
process.exitCode=2;
