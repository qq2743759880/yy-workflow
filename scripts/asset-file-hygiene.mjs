#!/usr/bin/env node
/** Physical file lifecycle only. No asset selection or methodology acceptance. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYamlSubset} from './lib/contract-v3.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const STATES=new Set(['ACTIVE_ENTRY','ACTIVE_RESOURCE','EXECUTABLE','PROVENANCE']);
const excluded=new Set(['node_modules','.git','.venv','.mimosa']);
const safe=p=>typeof p==='string'&&p.length>0&&!p.includes('\\')&&!path.posix.isAbsolute(p)&&!p.split('/').some(s=>!s||s==='..'||s==='.')&&!/^[A-Za-z]:/.test(p);
const glob=p=>new RegExp('^'+p.split('/').map(s=>s==='**'?'.*':s.split('*').map(x=>x.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('[^/]*')).join('/')+'$');
const list=v=>Array.isArray(v)?v:(typeof v==='string'?[v]:[]);
export function checkAssetFiles(root=ROOT) {
  root=fs.realpathSync(root);
  const errors=[],files=[],assets=[],references=new Set();
  const fail=(code,p,reason)=>errors.push({code,path:p,reason});
  const walk=(dir)=>{
    const found=[];
    for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const p=path.join(dir,e.name);
      if(e.isSymbolicLink()) {fail('SOURCE_LINK_REFUSED',path.relative(root,p),'Vendor links are not distributable');continue;}
      if(e.isDirectory()) {if(!excluded.has(e.name)) found.push(...walk(p));}
      else if(e.isFile()) found.push(p);
    }
    return found;
  };
  let catalog;
  try {catalog=JSON.parse(fs.readFileSync(path.join(root,'contracts/asset-manifest-v2.json'),'utf8'));}
  catch(e) {fail('INVALID_FILE_MANIFEST','contracts/asset-manifest-v2.json',e.message);return {ok:false,errors,files,assets};}
  const required=new Set(catalog.map(a=>a.id));
  const vendor=path.join(root,'vendor');
  for(const id of required) if(!fs.existsSync(path.join(vendor,id))) fail('MISSING_ASSET_DIRECTORY','vendor/'+id,'Governance catalog asset missing');
  for(const dir of fs.readdirSync(vendor,{withFileTypes:true}).filter(d=>d.isDirectory())) {
    const id=dir.name,base=path.join(vendor,id),label='vendor/'+id;
    const manifestFile=path.join(base,'ASSET-FILES.yaml');
    if(!fs.existsSync(manifestFile)) {fail('MISSING_FILE_MANIFEST',label,'Every vendor asset/kernel needs a physical lifecycle declaration');continue;}
    let manifest;
    try {manifest=parseYamlSubset(fs.readFileSync(manifestFile,'utf8'),label+'/ASSET-FILES.yaml');
      if(manifest.schema!=='yy/asset-files@1'||manifest.asset!==id||!Array.isArray(manifest.files)||!Array.isArray(manifest.retired)) throw new Error('Invalid schema, asset or file lists');
      for(const row of manifest.files) if(!safe(row.match)||!STATES.has(row.state)||/\*\*[^/]|[^/]\*\*/.test(row.match)) throw new Error('Invalid match/state');
      for(const row of manifest.retired) if(!safe(row.path)||!row.reason||!row.archive_ref) throw new Error('Retirement requires scoped path, reason and recovery manifest');
    } catch(e) {fail('INVALID_FILE_MANIFEST',label,e.message);continue;}
    if(manifest.iteration_protocol) {
      if(!safe(manifest.iteration_protocol)||!fs.existsSync(path.join(root,manifest.iteration_protocol))) fail('BROKEN_RESOURCE_REFERENCE',label,'Missing iteration protocol');
      else references.add(manifest.iteration_protocol);
    }
    const physical=walk(base),selected=[],entries=physical.filter(p=>['SKILL.md',id+'.md'].includes(path.relative(base,p)));
    if(required.has(id)&&entries.length!==1) fail('DUAL_ENTRY',label,'Exactly one production body SKILL.md or <id>.md required');
    for(const row of manifest.retired) if(fs.existsSync(path.join(base,row.path))) fail('RETIRED_FILE_PRESENT',label+'/'+row.path,row.reason);
    for(const row of manifest.files) {
      const consumers=list(row.consumer);
      if(!consumers.length||(['ACTIVE_RESOURCE','EXECUTABLE'].includes(row.state)&&(typeof row.load!=='string'||!row.load.trim()))) fail('MISSING_CONSUMER',label+'/'+row.match,'Consumer and load policy required');
      for(const consumer of consumers) {
        if(['activation','distribution'].includes(consumer)) {
          if(consumer==='activation'&&row.state!=='ACTIVE_ENTRY'||consumer==='distribution'&&row.state!=='PROVENANCE') fail('MISSING_CONSUMER',label+'/'+row.match,'Reserved consumer inappropriate for state');
          continue;
        }
        if(!safe(consumer)||/^(docs\/history|test-reports|tasks)\//.test(consumer)||!fs.existsSync(path.join(root,consumer))||!fs.statSync(path.join(root,consumer)).isFile()) {fail('MISSING_CONSUMER',label+'/'+row.match,'Missing or historical consumer: '+consumer);continue;}
        // A Markdown consumer must directly reference the declared resource, rather
        // than merely exist. Directory prefixes are allowed for bounded globs.
        if(consumer.endsWith('.md')&&row.state!=='PROVENANCE') {
          const relative=path.relative(path.dirname(path.join(root,consumer)),path.join(base,row.match.replace(/\*.*$/,''))).replaceAll('\\','/');
          const text=fs.readFileSync(path.join(root,consumer),'utf8');
          if(!text.includes(relative)&&!text.includes(label+'/'+row.match.replace(/\*.*$/,''))) fail('MISSING_CONSUMER',label+'/'+row.match,'Consumer has no direct resource pointer: '+consumer);
        }
      }
      if(!physical.some(p=>glob(row.match).test(path.relative(base,p).replaceAll('\\','/')))) fail('BROKEN_RESOURCE_REFERENCE',label+'/'+row.match,'Declared active match has no physical file');
    }
    for(const p of physical) {
      const rel=path.relative(base,p).replaceAll('\\','/'),matches=manifest.files.filter(row=>glob(row.match).test(rel));
      if(matches.length!==1) {fail(matches.length?'AMBIGUOUS_FILE_STATE':'UNCLASSIFIED_FILE',label+'/'+rel,'Exactly one live state required');continue;}
      const row=matches[0];selected.push({path:label+'/'+rel,state:row.state});files.push(label+'/'+rel);
      if(row.state==='ACTIVE_ENTRY'&&!entries.includes(p)) fail('DUAL_ENTRY',label+'/'+rel,'Entry must be the root production body');
      if(/\.local\.json$|\.(pyc|log|err|pid)$|^\.env(?!\.example$)/.test(rel)) fail('NON_DISTRIBUTABLE_FILE',label+'/'+rel,'Instance/cache artifacts are not production files');
      if(row.state!=='PROVENANCE') {
        const text=fs.readFileSync(p,'utf8');
        if(/(?:D:[\\/]\.ai-hub[\\/]candidates|(?:^|[\s"'`(\\/])(?:staging|project-bath|audit-temp)[\\/])/im.test(text)) fail('CANDIDATE_ONLY_RUNTIME_REF',label+'/'+rel,'Runtime reference points outside distribution');
        if(/C:[\\/]Users[\\/]|D:[\\/]\.ai-hub[\\/]skills[\\/]yy|\.codex[\\/]worktrees|\.claude[\\/]/i.test(text)) fail('NON_PORTABLE_RUNTIME_REF',label+'/'+rel,'Machine/platform-specific runtime path');
        if(rel.endsWith('.md')) for(const m of text.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
          const link=m[1].replace(/^<|>$/g,'');
          if(/^(?:https?:|mailto:|#)/.test(link)) continue;
          const target=path.resolve(path.dirname(p),decodeURIComponent(link.split('#')[0]));
          if(!target.startsWith(root+path.sep)||!fs.existsSync(target)) fail('BROKEN_RESOURCE_REFERENCE',label+'/'+rel,'Unresolved local Markdown link: '+link);
          else references.add(path.relative(root,target).replaceAll('\\','/'));
        }
      }
    }
    const count=selected.filter(f=>f.state==='ACTIVE_ENTRY').length;
    if(required.has(id)&&count!==1||!required.has(id)&&count>1) fail('DUAL_ENTRY',label,'Invalid classified entry count');
    // Resource consumers must themselves be live classified vendor files.
    assets.push({asset:id,governance_asset:required.has(id),files:selected,manifest});
  }
  const live=new Map(assets.flatMap(a=>a.files.map(f=>[f.path,f.state])));
  for(const a of assets) for(const row of a.manifest.files) for(const c of list(row.consumer))
    if(c.startsWith('vendor/')&&row.state!=='PROVENANCE'&&(!live.has(c)||live.get(c)==='PROVENANCE')) fail('MISSING_CONSUMER','vendor/'+a.asset+'/'+row.match,'Consumer is not a live entry/resource/executable: '+c);
  // A self-contained reference cycle is not a production consumer chain.
  const reachable=new Set(assets.flatMap(a=>a.files.filter(f=>f.state==='ACTIVE_ENTRY'||f.state==='PROVENANCE').map(f=>f.path)));
  for(let pass=0;pass<=files.length;pass++) {
    let changed=false;
    for(const a of assets) for(const row of a.manifest.files) {
      if(!list(row.consumer).some(c=>c!=='activation'&&c!=='distribution'&&(!c.startsWith('vendor/')||reachable.has(c)))) continue;
      for(const f of a.files) if(glob(row.match).test(f.path.slice(('vendor/'+a.asset+'/').length))&&!reachable.has(f.path)) {reachable.add(f.path);changed=true;}
    }
    if(!changed) break;
  }
  for(const [p,state] of live) if(state!=='PROVENANCE'&&!reachable.has(p)) fail('MISSING_CONSUMER',p,'No reachable current entry/runtime consumer chain');
  return {ok:errors.length===0,errors,files:files.sort(),references:[...references].sort(),assets:assets.map(({manifest,...a})=>a),nine_assets_covered:catalog.length===9&&catalog.every(a=>assets.some(x=>x.asset===a.id))};
}
export function requireAssetFileHygiene(root=ROOT) {
  const result=checkAssetFiles(root);
  if(!result.ok) throw new Error('ASSET_FILE_HYGIENE_FAIL '+result.errors.map(e=>e.code+' '+e.path+': '+e.reason).join('\n'));
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {const result=requireAssetFileHygiene(process.argv[2]??ROOT);console.log(JSON.stringify(result,null,2));}
  catch(e) {console.error(e.message);process.exitCode=1;}
}
