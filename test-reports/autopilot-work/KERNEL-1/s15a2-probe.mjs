// S15-A2 等价探针（bootstrap-only 恢复副本）：三引擎各一次真扫
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveAdapter } from './scripts/lib/adapters/index.mjs';
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'kernel1-a2-'));
let ok = true; const d = [];
try {
  const spec = path.join(ws, 'bad-openapi.json');
  fs.writeFileSync(spec, JSON.stringify({ openapi:'3.0.0', info:{title:'p',version:'1.0.0'}, paths:{'/login':{post:{operationId:'login',summary:'login',requestBody:{content:{'application/json':{schema:{type:'object'}}}}}}} }, null, 2));
  const bv = resolveAdapter('be-validator','cli');
  const bvr = await bv.run({ id:'a2-bv', contract: spec }, null, { workspace: ws });
  const bvOk = Boolean(bvr && bvr.ok && bvr.contract && bvr.contract.tool==='spectral' && bvr.contract.mode==='exec' && bvr.contract.pass===false && bvr.contract.findings_total>=1);
  d.push('be-validator/spectral: ' + (bvOk ? `真扫 ${bvr.contract.findings_total} findings pass=false` : 'FAIL'));
  if (!bvOk) ok = false;
  const py = path.join(ws, 'vulnerable.py');
  fs.writeFileSync(py, 'import hashlib\n\ndef query(user):\n    password = "hunter2-plaintext"\n    sql = "SELECT * FROM users WHERE name = \'" + user + "\'"\n    return sql\n');
  const sec = resolveAdapter('security','cli');
  const secr = await sec.run({ id:'a2-sec' }, null, { workspace: ws, scanTarget: py });
  const secOk = Boolean(secr && secr.ok && secr.contract && secr.contract.tool==='semgrep' && secr.contract.mode==='exec' && secr.contract.pass===false && secr.contract.findings_total>=1);
  d.push('security/semgrep: ' + (secOk ? `真扫 ${secr.contract.findings_total} findings pass=false` : 'FAIL'));
  if (!secOk) ok = false;
  const sd = path.join(ws, 'benign-skill'); fs.mkdirSync(sd, { recursive: true });
  fs.writeFileSync(path.join(sd,'SKILL.md'), '# Benign Skill\n\nAdds two numbers and returns the sum.\n\n## Usage\n\nCall add(a, b) with two integers.\n');
  const sen = resolveAdapter('skill-sentinel','cli');
  const senr = await sen.run({ id:'a2-sen' }, null, { workspace: ws, scanTarget: sd });
  const senOk = Boolean(senr && senr.ok && senr.contract && senr.contract.tool==='skill-scanner' && senr.contract.mode==='exec' && senr.contract.pass===true && senr.contract.is_safe===true && senr.contract.threats===0);
  d.push('skill-sentinel/skill-scanner: ' + (senOk ? '真扫 is_safe=true threats=0' : 'FAIL'));
  if (!senOk) ok = false;
} catch (e) { ok=false; d.push('exception: '+e.message); }
finally { fs.rmSync(ws, { recursive:true, force:true }); }
console.log((ok ? 'PASS' : 'FAIL') + ' S15-A2 等价探针  ' + d.join(' | '));
process.exit(ok ? 0 : 1);
