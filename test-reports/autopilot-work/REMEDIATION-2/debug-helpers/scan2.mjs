// scan2.mjs — string-aware brace scan of assembled regression file
import fs from 'node:fs';
const file = process.argv[2] || './s16-new-block.txt';
const lines = fs.readFileSync(file, 'utf8').split('\n');
let running = 0;
for (let i = 0; i < lines.length; i++) {
  let d = 0, inS = null;
  const L = lines[i];
  for (let j = 0; j < L.length; j++) {
    const ch = L[j];
    if (inS) {
      if (ch === inS && L[j - 1] !== '\\') inS = null;
      continue;
    }
    if (ch === "'" || ch === '"') { inS = ch; continue; }
    if (L[j] === '/' && L[j + 1] === '/') break; // comment rest of line
    if (ch === '{') d++;
    if (ch === '}') d--;
  }
  running += d;
  if (d !== 0 && running === 1 && i > 200) console.log('candidate open @', i + 1, '|', L.trim().slice(0, 100));
}
console.log('final depth (string+comment aware):', running);
