// table-check: pipe-aware markdown table row consistency probe (file-based, no node -e).
// Counts unescaped | per table row; every row in a table block must have equal count.
import fs from 'node:fs';

let fail = 0;
for (const file of process.argv.slice(2)) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let expected = null, tableStart = 0, mismatches = 0, tables = 0;
  const flush = (endIdx) => { if (expected !== null) tables++; expected = null; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const isRow = l.trimStart().startsWith('|');
    if (!isRow) { flush(i); continue; }
    if (expected === null) tableStart = i;
    // count unescaped pipes
    let n = 0;
    for (let j = 0; j < l.length; j++) {
      if (l[j] === '|' && l[j - 1] !== '\\') n++;
    }
    if (expected === null) { expected = n; continue; }
    if (n !== expected) {
      mismatches++;
      console.log('MISMATCH ' + file + ':' + (i + 1) + ' pipes=' + n + ' expected=' + expected + ' :: ' + l.slice(0, 80));
    }
  }
  flush(lines.length);
  console.log(JSON.stringify({ file, tables, mismatched_rows: mismatches }));
  if (mismatches > 0) fail = 1;
}
process.exitCode = fail;