import { spawn } from 'node:child_process'; 
export function runValidate(options = {}) { 
  let cwd = options.cwd; 
  if (!cwd) cwd = process.cwd(); 
  return new Promise(function(resolve) { 
    let out = ''; 
    const child = spawn(process.execPath, ['scripts/validate-structure.mjs'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] }); 
    child.stdout.on('data', function(chunk) { out += chunk.toString(); }); 
    child.stderr.on('data', function(chunk) { out += chunk.toString(); }); 
    child.on('close', function(code) { 
      const count = out.match(/vendor.*?(\d+)\/(\d+)/); 
      const actual = count ? Number(count[1]) : 0; 
      const expected = count ? Number(count[2]) : 16; 
      const warnings = code === 0 ? 0 : 1; 
      const drift = code === 0 ? 'ok' : 'unknown'; 
      const leak = code === 0 ? 'ok' : 'unknown'; 
      resolve({ ok: code === 0 && actual === expected, vendorCount: { actual, expected }, warnings, drift, leak, raw: out }); 
    }); 
  }); 
}
