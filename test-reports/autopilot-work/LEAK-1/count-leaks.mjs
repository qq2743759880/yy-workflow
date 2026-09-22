/** LEAK-1 自测辅助：按 make-release.mjs STEP 3 完全相同的行级口径统计逐文件命中数。
 * 用法：node count-leaks.mjs <rootDir> — 输出逐文件命中与总数，用于 scrub 前→后对比。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const target = fs.realpathSync(process.argv[2]);
const USER_NAME = ['Admin', 'istrator'].join('');
const BS = String.fromCharCode(92);
const RES = [
  new RegExp('C:' + BS + BS + 'Users', 'i'),
  new RegExp('D:' + BS + BS, 'i'),
  new RegExp('/Users/[A-Za-z0-9_.-]+'),
  new RegExp('/home/[A-Za-z0-9_.-]+'),
  new RegExp(USER_NAME, 'i'),
  new RegExp(os.hostname().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
];
const isPatternDefLine = (ln) => ln.includes('portability_re');
const counts = {};
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { walk(full); continue; }
    if (!e.isFile()) continue;
    const buf = fs.readFileSync(full);
    const rel = path.relative(target, full).replace(/\\/g, '/');
    let n = 0;
    for (let i = 0; i <= buf.length - 3; i++) {
      if (buf[i] === 0xEF && buf[i + 1] === 0xBF && buf[i + 2] === 0xBD) { n++; break; }
    }
    let binary = false;
    for (let i = 0; i < Math.min(buf.length, 8000); i++) if (buf[i] === 0) { binary = true; break; }
    if (!binary) {
      const lines = buf.toString('utf8').toLowerCase().split('\n');
      for (const ln of lines) {
        if (isPatternDefLine(ln)) continue;
        for (const re of RES) { if (re.test(ln)) { n++; break; } }
      }
    }
    if (n > 0) counts[rel] = n;
  }
};
walk(target);
const entries = Object.entries(counts).sort();
for (const [k, v] of entries) console.log(`  '${k}': ${v},`);
console.log(`TOTAL files=${entries.length} entries=${entries.reduce((a, [, v]) => a + v, 0)}`);
