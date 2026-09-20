import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sandboxBase = path.join(here, '.sandbox');

const probes = ['p07-basename-boundary.mjs', 'p08-path-original-case.mjs'];
let pass = 0, fail = 0;

for (const file of probes) {
  const probeName = file.slice(0, 3);
  const sandbox = path.join(sandboxBase, probeName);
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.mkdirSync(sandbox, { recursive: true });
  const mod = await import(pathToFileURL(path.join(here, 'probes', file)).href);
  try {
    const r = await mod.run({ sandbox, here });
    if (r.ok) { pass++; console.log('[PASS] ' + probeName + ' | ' + r.summary); }
    else { fail++; console.log('[FAIL] ' + probeName + ' | ' + r.summary); }
  } catch (e) {
    fail++;
    console.log('[FAIL] ' + probeName + ' | threw: ' + e.message);
  }
}
console.log('TOTAL: ' + pass + '/' + (pass + fail) + ' PASS');
process.exit(fail === 0 ? 0 : 1);
