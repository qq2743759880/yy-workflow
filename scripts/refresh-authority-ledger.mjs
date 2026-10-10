#!/usr/bin/env node
/** Project the committed manifests into one bounded handoff block; never grant acceptance. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BEGIN = '<!-- YY_AUTHORITY_LEDGER_CURRENT:BEGIN -->';
export const END = '<!-- YY_AUTHORITY_LEDGER_CURRENT:END -->';
export const MANIFESTS = [
  { name: 'decision_authority', schema: 'yy/decision-authority@1', file: 'contracts/generated/decision-authority-components.json' },
  { name: 'transport', schema: 'yy/decision-transport@1', file: 'contracts/generated/decision-transport-manifest.json' },
];

export function validateManifest(manifest, schema) {
  const hex = /^[0-9a-f]{64}$/;
  if (manifest?.schema !== schema || !hex.test(manifest?.digest ?? '') ||
      !Array.isArray(manifest?.components) || manifest.components.length === 0) {
    throw new Error(`Invalid authority ledger manifest: ${schema}`);
  }
  const paths = new Set();
  for (const component of manifest.components) {
    const relative = component?.path;
    if (typeof relative !== 'string' || !relative || relative.includes('\\') ||
        relative.includes('\n') || relative.includes('\r') || path.posix.isAbsolute(relative) ||
        /^[A-Za-z]:/.test(relative) || relative.split('/').some((part) => !part || part === '.' || part === '..') ||
        paths.has(relative) || !hex.test(component?.sha256 ?? '')) {
      throw new Error(`Invalid or duplicate authority ledger component: ${relative}`);
    }
    paths.add(relative);
  }
  const lines = manifest.components.map(({ path: relative, sha256 }) => `${relative} ${sha256}`).sort();
  const digest = createHash('sha256').update(lines.join('\n')).digest('hex');
  if (digest !== manifest.digest) throw new Error(`Manifest aggregate mismatch: ${schema}`);
  return manifest;
}

export function readLedgerManifests(root = ROOT) {
  return MANIFESTS.map((entry) => ({ ...entry,
    manifest: validateManifest(JSON.parse(fs.readFileSync(path.join(root, entry.file), 'utf8')), entry.schema),
  }));
}

export function renderCurrentBlock(entries) {
  const rows = entries.map(({ name, schema, file, manifest }) =>
    `| ${name} | \`${schema}\` | \`${manifest.digest}\` | ${manifest.components.length} | \`${file}\` |`);
  return [BEGIN,
    '### CURRENT canonical manifest identity',
    '',
    'These values are projected from the committed manifests in this checkout. They identify current bytes; historical acceptance and fresh runtime acceptance are recorded separately.',
    '',
    '| Identity | Schema | Digest | Components | Source of truth |',
    '|---|---|---|---:|---|',
    ...rows,
    '',
    'Refresh with `node scripts/refresh-authority-ledger.mjs` after the owner regenerates the manifests. This block does not close a work item or prove a live deployment.',
    END,
  ].join('\n');
}

export function replaceCurrentBlock(text, currentBlock) {
  const begin = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (begin < 0 || end < begin || text.indexOf(BEGIN, begin + BEGIN.length) !== -1 ||
      text.indexOf(END, end + END.length) !== -1) {
    throw new Error('Authority ledger requires exactly one ordered BEGIN/END marker pair');
  }
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  return text.slice(0, begin) + currentBlock.replace(/\r?\n/g, newline) + text.slice(end + END.length);
}

export function checkLedger(text, entries) {
  return replaceCurrentBlock(text, renderCurrentBlock(entries)) === text;
}

function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check')) throw new Error('Usage: node scripts/refresh-authority-ledger.mjs [--check]');
  const handoff = path.join(ROOT, 'plans/project-handoff.md');
  const previous = fs.readFileSync(handoff, 'utf8');
  const entries = readLedgerManifests();
  const next = replaceCurrentBlock(previous, renderCurrentBlock(entries));
  if (args.includes('--check')) {
    if (next !== previous) throw new Error('AUTHORITY_LEDGER_DRIFT: refresh the bounded CURRENT block');
    console.log(`AUTHORITY_LEDGER_OK ${entries.map(({ name, manifest }) => `${name}=${manifest.digest} components=${manifest.components.length}`).join(' ')}`);
  } else {
    if (next !== previous) fs.writeFileSync(handoff, next, 'utf8');
    console.log(next === previous ? 'AUTHORITY_LEDGER_UNCHANGED' : 'AUTHORITY_LEDGER_REFRESHED');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 3; }
}
