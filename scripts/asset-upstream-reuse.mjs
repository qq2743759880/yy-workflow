/** Reuse and invocation closure gate. Fresh local bytes only; no upstream fetch. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parseYamlSubset} from './lib/contract-v3.mjs';
import {describeMethodology,readMethodologyDeclaration} from './lib/methodology.mjs';
import {resolveAdapter} from './lib/adapters/index.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const modes=['DIRECT_VENDOR','THIN_WRAPPER','COMPOSE','FORK_PATCH','CUSTOM'];
const bridges=new Set(['decision_bridge','activation_pointer','dependency_resolution','artifact_bridge','evidence_bridge','portable_execution','owner_governance']);
const safe=p=>typeof p==='string'&&!path.isAbsolute(p)&&!p.includes('\\')&&!/^\w:/.test(p)&&!p.split('/').some(x=>!x||x==='.'||x==='..');
export function checkMethodologyClosure(root=ROOT) {
 const errors=[],rows=[];const fail=(code,asset,reason)=>errors.push({code,asset,reason});
 const catalog=JSON.parse(fs.readFileSync(path.join(root,'contracts/asset-manifest-v2.json'),'utf8'));
 for(const row of catalog) {
  const asset=row.id;
  try {
   const {doc}=readMethodologyDeclaration(asset,{repoRoot:root});const method=describeMethodology(asset,{repoRoot:root});
   const reuse=parseYamlSubset(fs.readFileSync(path.join(root,'vendor',asset,'UPSTREAM-REUSE.yaml'),'utf8'));
   if(reuse.schema!=='yy/upstream-reuse@1'||reuse.asset!==asset||!modes.includes(reuse.decision)) throw Error('REUSE_DECLARATION_INVALID');
   if(!reuse.matt_checked?.commit?.match(/^[a-f0-9]{40}$/)||!reuse.matt_checked.evidence||!reuse.approved_mature_checked?.evidence) throw Error('UPSTREAM_FIRST_EVIDENCE_MISSING');
   for(const mode of modes.slice(0,modes.indexOf(reuse.decision))) if(!reuse.rejected_lower_modes?.[mode]) throw Error('LOWER_REUSE_MODE_NOT_REJECTED: '+mode);
   if(reuse.decision==='CUSTOM'&&(reuse.gap?.status!=='REAL_GAP'||!reuse.gap.evidence)) throw Error('CUSTOM_WITHOUT_REAL_GAP');
   if(reuse.no_runtime_auto_update!==true||!reuse.wrapper_responsibilities?.length||reuse.wrapper_responsibilities.some(b=>!bridges.has(b))) throw Error('WRAPPER_SCOPE_INVALID');
   if(!reuse.primary_upstream?.paths?.length||!reuse.primary_upstream.license) throw Error('UPSTREAM_SOURCE_MISSING');
   for(const ref of [...method.sources,...(reuse.source_refs||[])]) {
    if(!safe(ref.path)) throw Error('METHODOLOGY_REFERENCE_INVALID');
    const file=path.join(root,ref.path);if(fs.realpathSync(file)!==file||hash(fs.readFileSync(file))!==ref.sha256) throw Error('METHODOLOGY_PIN_MISMATCH: '+ref.path);
   }
   if(reuse.primary_upstream.kind==='MATT') {
    if(reuse.primary_upstream.commit!==reuse.matt_checked.commit) throw Error('UPSTREAM_PIN_SPLIT');
    for(const rel of reuse.primary_upstream.paths) {
     if(!safe(rel)||!method.sources.some(s=>s.path===rel)) throw Error('NO_CONSUMER: '+rel);
     const dir=path.dirname(path.join(root,rel));const pin=JSON.parse(fs.readFileSync(path.join(dir,'UPSTREAM.json'),'utf8'));
     if(pin.commit!==reuse.primary_upstream.commit||pin.repository!==reuse.primary_upstream.repository||pin.license!==reuse.primary_upstream.license) throw Error('UPSTREAM_PIN_SPLIT');
     for(const [source,sha] of Object.entries(pin.files||{})) {
      if(!safe(source)||hash(fs.readFileSync(path.join(dir,source)))!==sha) throw Error('ORIGINAL_BYTE_DRIFT: '+source);
     }
     if(!Object.keys(pin.files||{}).length||!fs.existsSync(path.resolve(dir,pin.license_ref))) throw Error('METHODOLOGY_LICENSE_MISSING');
    }
   } else if(reuse.primary_upstream.kind!=='APPROVED_MATURE'&&!(reuse.decision==='CUSTOM'&&reuse.primary_upstream.kind==='REAL_GAP'&&reuse.gap.status==='REAL_GAP')) throw Error('UPSTREAM_KIND_INVALID');
   const keys=Object.keys(doc.skills),visiting=new Set(),done=new Set();
   const walk=id=>{if(visiting.has(id))throw Error('METHODOLOGY_DEPENDENCY_CYCLE');if(done.has(id))return;
    const s=doc.skills[id];if(!s||!['USER_EXPLICIT','MODEL_ELIGIBLE','YY_ROUTED'].includes(s.invocation_policy))throw Error('MISSING_METHOD: '+id);
    visiting.add(id);for(const d of s.dependencies||[])walk(typeof d==='string'?d:d.id);visiting.delete(id);done.add(id);};
   for(const key of keys)walk(key);
   for(const extra of doc.conditional_skills||[]) if(!doc.skills[extra.id]) throw Error('MISSING_METHOD: '+extra.id);
   for(const mode of Object.values(doc.modes||{})) if(!doc.skills[mode.primary]) throw Error('MISSING_METHOD: mode');
   if(JSON.stringify(row.optional_profile||null)!==JSON.stringify(doc.optional_profile||null)) throw Error('DUAL_TRUTH: profile projection');
   const adapter=resolveAdapter(asset);if(!adapter) throw Error('NO_CONSUMER: execution adapter');
   if(adapter.name!=='prompt'&&!doc.tool_dependencies?.length) throw Error('PLATFORM_BOUND: non-portable default provider');
   if(doc.methodology_type==='TOOL_BACKED'&&(adapter.name==='prompt'||!doc.tool_dependencies?.length)) throw Error('DUAL_TRUTH: deterministic tool declaration and adapter disagree');
   const required=new Set(),conditional=[],used=new Set([doc.primary]);
   const dependencies=id=>{for(const dep of doc.skills[id].dependencies||[]) {const item=typeof dep==='string'?{id:dep}:dep;used.add(item.id);if(item.when)conditional.push(item);else required.add(item.id);dependencies(item.id);}};dependencies(doc.primary);
   for(const item of doc.conditional_skills||[]) {conditional.push(item);used.add(item.id);}
   rows.push({asset,selection_source:doc.optional_profile?'Decision eligibility + explicit Owner governance':'Decision capability/cluster + eligibility',
    methodology_type:doc.methodology_type,primary_methodology:doc.primary,
    dependencies:{required:[...required],conditional,requested_only:keys.filter(k=>!used.has(k)),modes:doc.modes||{}},activation_source:'METHODOLOGY.json via scripts/lib/methodology.mjs',
    execution_mode:adapter.name==='prompt'?'HOST_NATIVE (default); EXTERNAL_PROVIDER opt-in':'DETERMINISTIC_TOOL',
    external_tool:(doc.tool_dependencies||[]).map(t=>typeof t==='string'?t:t.tool||t.id||t.name),
    tool_required:!!doc.tool_dependencies?.length,fallback:doc.tool_dependencies?.length?'NOT_EXECUTED: specific capability unavailable':'INLINE_METHODOLOGY / BRIEF_ONLY',portable:true});
  } catch(e) {fail(e.message.split(':')[0],asset,e.message);}
 }
 return {ok:!errors.length,errors,rows};
}
export function requireMethodologyClosure(root=ROOT) {const r=checkMethodologyClosure(root);if(!r.ok)throw Error('METHODOLOGY_CLOSURE_FAIL '+JSON.stringify(r.errors));return r;}
export function matrixBytes(rows) {return JSON.stringify({schema:'yy/asset-invocation-matrix@1',rows},null,2)+'\n';}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {const result=requireMethodologyClosure();const file=path.join(ROOT,'contracts/generated/asset-invocation-matrix.json');const bytes=matrixBytes(result.rows);
  if(process.argv.includes('--write'))fs.writeFileSync(file,bytes);
  else if(fs.readFileSync(file,'utf8')!==bytes) throw Error('INVOCATION_MATRIX_DRIFT');
  console.log('METHODOLOGY_CLOSURE_OK assets='+result.rows.length);
 }catch(e){console.error(e.message);process.exitCode=1;}
}
