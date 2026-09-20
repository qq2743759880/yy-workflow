#!/usr/bin/env node
/**
 * B2 锁探针（被 b2-lock-test.mjs spawn）：
 *   node b2-lock-probe.mjs <resourcePath> <holdMs> <retries> <delayMs> <tokenFile>
 * 在 withLock 保护下持锁 holdMs 后写 tokenFile；拿不到锁（LockBusyError）→ exit 3。
 */
import fs from 'node:fs';
import { withLock } from '../../../scripts/lib/store.mjs';

const [resourcePath, holdMs, retries, delayMs, tokenFile] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await withLock(resourcePath, async () => {
    await sleep(Number(holdMs));
    fs.writeFileSync(tokenFile, 'held-by=' + process.pid + '\n');
  }, { retries: Number(retries), delayMs: Number(delayMs) });
  process.exit(0);
} catch (error) {
  if (error && error.code === 'LOCK_BUSY_FAIL_CLOSED') {
    process.stderr.write('LOCK_BUSY: ' + error.message + '\n');
    process.exit(3);
  }
  process.stderr.write('PROBE_ERROR: ' + (error && error.message) + '\n');
  process.exit(2);
}
