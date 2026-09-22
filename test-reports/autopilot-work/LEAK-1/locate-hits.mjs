/** LEAK-1 定位辅助：按 make-release.mjs STEP 3 口径打印 31 基线文件的具体命中行。 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const target = fs.realpathSync('D:/.ai-hub/skills/yy');
const USER_NAME = ['Admin', 'istrator'].join('');
const BS = String.fromCharCode(92);
const HOST = os.hostname().toLowerCase();
const RES = [
  ['C:\\Users', new RegExp('C:' + BS + BS + 'Users', 'i')],
  ['D:\\', new RegExp('D:' + BS + BS, 'i')],
  ['/Users/', new RegExp('/Users/[A-Za-z0-9_.-]+')],
  ['/home/', new RegExp('/home/[A-Za-z0-9_.-]+')],
  ['username', new RegExp(USER_NAME, 'i')],
  ['hostname', new RegExp(HOST.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')],
];
const files = process.argv.slice(2);
for (const f of files) {
  const full = path.join(target, f);
  if (!fs.existsSync(full)) { console.log(`MISSING ${f}`); continue; }
  const lines = fs.readFileSync(full).toString('utf8').split('\n');
  lines.forEach((ln, i) => {
    for (const [tag, re] of RES) {
      if (re.test(ln)) {
        console.log(`${f}:${i + 1} [${tag}] ${JSON.stringify(ln.trim().slice(0, 300))}`);
        break;
      }
    }
  });
}
