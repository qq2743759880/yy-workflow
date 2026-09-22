/** 自测辅助：对安装面（junction 归一后）做 (path,size,mtimeMs) 快照，用于 --dry-run 零落盘对比。 */
import fs from 'node:fs';
import path from 'node:path';

const INSTALL = 'C:/Users/Administrator/.agents/skills/yy';
const target = fs.realpathSync(INSTALL);
const out = [];
const walk = (rel) => {
  const dir = path.join(target, rel);
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = rel ? rel + '/' + e.name : e.name;
    const st = fs.lstatSync(path.join(target, child.replace(/\//g, path.sep)));
    out.push(`${child}\t${st.size}\t${st.mtimeMs.toFixed(3)}`);
    if (e.isDirectory() && !e.isSymbolicLink()) walk(child);
  }
};
walk('');
fs.writeFileSync(process.argv[2], out.sort().join('\n') + '\n', 'utf8');
console.log(`snapshot -> ${process.argv[2]} (${out.length} entries)`);
