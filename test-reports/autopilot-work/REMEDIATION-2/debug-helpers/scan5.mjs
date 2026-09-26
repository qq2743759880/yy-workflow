// scan5.mjs — trace lines 134-152 of the block
import fs from 'node:fs';
const lines = fs.readFileSync('./s16-new-block.txt', 'utf8').split('\n');
let run = 0;
const out = [];
for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  let d = 0, inS = null;
  for (let j = 0; j < L.length; j++) {
    const ch = L[j];
    if (inS) { if (ch === inS && L[j - 1] !== '\\') inS = null; continue; }
    if (ch === "'" || ch === '"') { inS = ch; continue; }
    if (ch === '/' && L[j + 1] === '/') break;
    if (ch === '{') d++;
    if (ch === '}') d--;
  }
  run += d;
  if (i >= 133 && i <= 152) out.push((i + 1) + ' d=' + d + ' run=' + run + ' | ' + L.trim().slice(0, 70));
}
console.log(out.join('\n'));
