#!/usr/bin/env node
/** Explicit, non-destructive distribution boundary. No installation or semantic decisions. */
import fs from 'node:fs';
import {describeMethodology} from './lib/methodology.mjs';
import {requireMethodologyClosure,matrixBytes} from './asset-upstream-reuse.mjs';
import {requireAssetFileHygiene} from './asset-file-hygiene.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const inside=(base,target)=>{const rel=path.relative(base,target);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
const skipDirs=new Set(['node_modules','.git','.venv','__pycache__','.pytest_cache','.mimosa','.agent-archive','.tt-state','.sandbox']);
const privateFile=name=>name.endsWith('.local.json')||/\.(log|err|pid|pyc)$/.test(name)||(/^(\.env)(\.|$)/.test(name)&&name!=='.env.example');
const coreFiles=['SKILL.md','README.md','ONBOARDING.md','LICENSE','package.json','package-lock.json','config.example.json',
  'plans/project-handoff.md','docs/directory-map.md'];
const mcpFiles=['auth.py','binding_boundary.py','bridge_client.py','decision_bridge.py','mcp_envelope.py','server.py','tools.py','tools_v2.py',
  'requirements.txt','README.md','start-yy-mcp.ps1','watchdog-tunnels.ps1',
  'runtime/yy-lifecycle.psm1','runtime/runtime-config.schema.json','runtime/ownership-contract.md'];

function inventory(profile) {
  const hygiene=requireAssetFileHygiene(root);
  const closure=requireMethodologyClosure(root);
  if(fs.readFileSync(path.join(root,'contracts/generated/asset-invocation-matrix.json'),'utf8')!==matrixBytes(closure.rows)) throw Error('INVOCATION_MATRIX_DRIFT');
  const files=new Set([...coreFiles,...hygiene.files]);
  function walk(rel) {
    const full=path.join(root,rel),stat=fs.lstatSync(full);
    if(stat.isSymbolicLink()) throw new Error('SOURCE_LINK_REFUSED: '+rel);
    if(stat.isDirectory()) {
      for(const entry of fs.readdirSync(full).sort()) {
        if(skipDirs.has(entry)||privateFile(entry)) continue;
        const child=rel+'/'+entry;
        if(rel==='contracts'&&['candidates','drafts','discrepancies'].includes(entry)) continue;
        if(rel==='scripts'&&(entry.startsWith('test-')||['regression-all.mjs','ci.mjs','visual-regression.mjs','preflight.mjs'].includes(entry))) continue;
        walk(child);
      }
    } else if(stat.isFile()&&!privateFile(path.basename(rel))) files.add(rel);
    else throw new Error('UNSUPPORTED_SOURCE_ENTRY: '+rel);
  }
  for(const dir of ['commands','reference','scripts','contracts','governance-skills','templates','webview']) walk(dir);
  if(profile==='mcp') for(const file of mcpFiles) files.add('integrations/yy-web-mcp/'+file);
  const payload=[...files].sort().map(rel=>{
    const full=path.join(root,rel);
    const actual=fs.realpathSync(full);
    const normalized=p=>process.platform==='win32'?p.toLowerCase():p;
    if(fs.lstatSync(full).isSymbolicLink()||normalized(actual)!==normalized(full)) throw new Error('SOURCE_LINK_REFUSED: '+rel);
    const data=fs.readFileSync(full);return {path:rel,data,sha256:hash(data)};
  });
  const byPath=new Map(payload.map(f=>[f.path,f]));
  for(const row of closure.rows) for(const ref of describeMethodology(row.asset,{repoRoot:root}).sources) {
    const selected=byPath.get(ref.path);
    if(!selected||selected.sha256!==ref.sha256) throw Error('DISTRIBUTION_METHOD_MISSING: '+row.asset+' / '+ref.path);
  }
  const identities={};
  for(const [name,file] of [['decision_authority','decision-authority-components.json'],['transport','decision-transport-manifest.json']]) {
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'contracts/generated',file),'utf8'));
    identities[name]={digest:manifest.digest,components:manifest.components.length};
    // Core-only carries transport provenance but does not include MCP runtime.
    if(name==='transport'&&profile==='core') continue;
    for(const component of manifest.components) {
      const selected=byPath.get(component.path);
      if(!selected||selected.sha256!==component.sha256) throw new Error('DISTRIBUTION_AUTHORITY_MISMATCH: '+component.path);
    }
  }
  return {payload,identities};
}

function main(argv) {
  const args={profile:'core'};
  for(let i=0;i<argv.length;i++) {
    const key=argv[i];
    if(!['--out','--profile'].includes(key)||args[key.slice(2)+'Seen']) throw new Error('Use --out <new directory> [--profile core|mcp]');
    const value=argv[++i];if(!value||value.startsWith('--')) throw new Error('Missing value: '+key);
    args[key.slice(2)]=value;args[key.slice(2)+'Seen']=true;
  }
  if(!args.out||!['core','mcp'].includes(args.profile)) throw new Error('Use --out <new directory> [--profile core|mcp]');
  const target=path.resolve(args.out);
  if(fs.existsSync(target)) throw new Error('TARGET_EXISTS: no overwrite or purge is permitted');
  // Resolve the nearest existing ancestor before checking source/target overlap.
  let ancestor=path.dirname(target),tail=path.basename(target);
  while(!fs.existsSync(ancestor)) {tail=path.join(path.basename(ancestor),tail);ancestor=path.dirname(ancestor);}
  const physical=path.join(fs.realpathSync(ancestor),tail);
  if(inside(root,physical)||inside(physical,root)) throw new Error('TARGET_OVERLAPS_SOURCE');
  const {payload,identities}=inventory(args.profile);
  const manifest={schema:'yy/distribution@1',version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,
    profile:args.profile,identities,files:payload.map(({path,sha256,data})=>({path,sha256,bytes:data.length}))};
  fs.mkdirSync(path.dirname(target),{recursive:true});
  // Exclusive directory creation also rejects a target that appears after validation.
  // On failure keep the new partial package for inspection; never purge a target.
  fs.mkdirSync(target);
  for(const file of payload) {
    const out=path.join(target,file.path);fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,file.data,{flag:'wx'});
    if(hash(fs.readFileSync(out))!==file.sha256) throw new Error('COPY_HASH_MISMATCH: '+file.path);
  }
  fs.writeFileSync(path.join(target,'distribution-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({ok:true,output:target,profile:args.profile,files:payload.length,identities}));
}
try {main(process.argv.slice(2));} catch(error) {console.error(error.message);process.exitCode=1;}
