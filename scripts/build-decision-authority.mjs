#!/usr/bin/env node
/**
 * build-decision-authority.mjs — C2.0 落档生成器（thin，语义单点在 lib/decision-authority.mjs）
 *
 * 用法：
 *   node scripts/build-decision-authority.mjs            # 写 contracts/generated/decision-authority-components.json
 *   node scripts/build-decision-authority.mjs --check    # 只比对，不写；drift ⇒ exit 3（同 generate-projections 惯例）
 *
 * 确定性：产物无时间戳；同树 ⇒ 字节等价产物。
 */
import fs from 'node:fs';
import path from 'node:path';
import { computeDecisionAuthority, readCommittedManifest, DECISION_REPO_ROOT, COMMITTED_MANIFEST_REL } from './lib/decision-authority.mjs';

const check = process.argv.includes('--check');
const live = computeDecisionAuthority(DECISION_REPO_ROOT);

if (check) {
  const committed = readCommittedManifest(DECISION_REPO_ROOT);
  if (!committed) { console.error('DECISION_AUTHORITY_MANIFEST_MISSING: ' + COMMITTED_MANIFEST_REL); process.exit(3); }
  if (committed.digest !== live.digest) {
    console.error(`DECISION_AUTHORITY_DRIFT: committed ${committed.digest.slice(0, 12)}… ≠ live ${live.digest.slice(0, 12)}…`);
    process.exit(3);
  }
  console.log('DECISION_AUTHORITY_OK ' + live.digest + ' components=' + live.components.length);
  process.exit(0);
}

const file = path.join(DECISION_REPO_ROOT, COMMITTED_MANIFEST_REL);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(live, null, 2) + '\n', 'utf8');
console.log('WROTE ' + COMMITTED_MANIFEST_REL + ' digest=' + live.digest + ' components=' + live.components.length);
