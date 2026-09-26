// scan-head.mjs — check brace depth at line 492 of regression-all.mjs (before S16)
import fs from 'node:fs';
const src = fs.readFileSync('D:/ai-hub/skills/yy/scripts/regression-all.mjs'.replace('D:/ai-hub', 'D:/.ai-hub'), 'utf8');
const Ls = src.split('\n').slice(0, 492);
let running = 0, inS = null;
for (const L of Ls) {
  for (let j = 0; j < L.length; j++) {
    const ch = L[j];
    if (inS) { if (ch === inS && L[j - 1] !== '\\') inS = null; continue; }
    if (ch === "'" || ch === '"') { inS = ch; continue; }
    if (ch === '/' && L[j + 1] === '/') break;
    if (ch === '{') running++;
    if (ch === '}') running--;
  }
}
console.log('depth at line 492:', running);
