#!/usr/bin/env node
/**
 * gen-reports.mjs — 为 18 轮 JSONL 各跑 asset-io-report.mjs。
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const REPO = 'D:/.ai-hub/skills/yy';
const BASE = path.join(REPO, 'test-reports/rebuild-20260920/io-baseline');
const RUNS_DIR = path.join(BASE, 'runs');
const REPORTS_DIR = path.join(BASE, 'reports');

for (let s = 0; s <= 5; s++) {
  for (let k = 1; k <= 3; k++) {
    const label = `baseline-stage${s}-run${k}`;
    const jsonl = path.join(RUNS_DIR, `stage${s}-run${k}`, 'io-audit.jsonl');
    const outDir = path.join(REPORTS_DIR, `stage${s}-run${k}`);
    if (!fs.existsSync(jsonl)) { console.error('MISSING: ' + jsonl); continue; }
    try {
      const r = execFileSync(process.execPath,
        [path.join(REPO, 'scripts/asset-io-report.mjs'),
         '--label', label,
         '--input', jsonl,
         '--workspace', path.join(BASE, 'sandbox-project'),
         '--out', outDir],
        { cwd: REPO, stdio: 'pipe', timeout: 30000 });
      console.log(`${label}: ok`);
    } catch (e) {
      console.error(`${label}: FAIL`, (e.stderr || e.message).toString().slice(0, 200));
    }
  }
}
