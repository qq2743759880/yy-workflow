// scan-block.mjs — one-off helper: find unbalanced line in s16-new-block.txt (string-literal aware)
import fs from 'node:fs';
const block = fs.readFileSync(new URL('./s16-new-block.txt', import.meta.url), 'utf8');
const lines = block.split('\n');
function cleanLine(l) {
  return l
    .replace(/\/\/.*$/, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}
let parens = 0, braces = 0, brackets = 0;
for (let i = 0; i < lines.length; i++) {
  const c = cleanLine(lines[i]);
  for (const ch of c) {
    if (ch === '(') parens++;
    else if (ch === ')') parens--;
    else if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
  }
  console.log((i + 1), 'p' + parens, 'b' + braces, 'k' + brackets, '|', lines[i].slice(0, 90));
}
