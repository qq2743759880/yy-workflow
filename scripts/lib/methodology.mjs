/** One methodology declaration and invocation policy, independent of host/provider. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {assertContract,canonicalJson} from './delegation-contract.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sha=data=>createHash('sha256').update(data).digest('hex');
const safe=p=>typeof p==='string'&&p&&!p.includes('\\')&&!path.posix.isAbsolute(p)&&!/^\w:/.test(p)&&!p.split('/').some(s=>!s||s==='.'||s==='..');
const includes=(values,item)=>Array.isArray(values)&&values.includes(item);
const POLICIES=new Set(['USER_EXPLICIT','MODEL_ELIGIBLE','YY_ROUTED']);
export function resolveMethodologyPolicy(input) {
  const {asset,logical_skill,wrapper_policy,invocation_policy,decision_admission:admission,owner_intent:owner={},host_capabilities:host={}}=input;
  if(!POLICIES.has(wrapper_policy)||!POLICIES.has(invocation_policy)) return 'NOT_ALLOWED';
  if(!admission?.stage||!admission?.task||!(admission.asset===asset||includes(admission.assets,asset))) return 'NOT_ALLOWED';
  const explicitAsset=owner.explicit_asset_task===true||includes(owner.explicit_assets,asset);
  if(wrapper_policy==='USER_EXPLICIT'&&!explicitAsset) return 'NOT_ALLOWED';
  const explicitSkill=includes(owner.logical_skills,logical_skill);
  if(invocation_policy==='USER_EXPLICIT'&&!explicitSkill&&!explicitAsset) return 'NOT_ALLOWED';
  const native=includes(host.native_skills,logical_skill);
  return native&&(invocation_policy!=='USER_EXPLICIT'||explicitSkill)?'HOST_NATIVE_INVOCATION':'INLINE_METHODOLOGY';
}

export function profileAllowed(profile,owner={},context={}) {
  return !profile||Boolean(includes(owner.explicit_assets,profile.asset)&&typeof owner.authorization_ref==='string'&&owner.authorization_ref.trim()&&profile.scopes?.includes(context.governance_scope));
}

export function readMethodologyDeclaration(asset,{repoRoot=ROOT}={}) {
  if(!safe(asset)||asset.includes('/')) throw new Error('MISSING_METHOD: invalid asset');
  const root=fs.realpathSync(repoRoot),assetRoot=path.join(root,'vendor',asset),file=path.join(assetRoot,'METHODOLOGY.json');
  let raw;
  try {raw=fs.readFileSync(file);} catch(error) {throw new Error('MISSING_METHOD: '+asset+' / '+error.code);}
  const doc=JSON.parse(raw.toString('utf8'));
  if(doc.schema!=='yy/methodology-bindings@1'||doc.asset!==asset||!doc.skills?.[doc.primary]||!POLICIES.has(doc.wrapper_policy)||!doc.wrapper_source||!doc.licenses?.length) throw new Error('MISSING_METHOD: invalid declaration '+asset);
  return {asset,root,assetRoot,doc,bindings_sha256:sha(raw)};
}

function location(declaration,source) {
  if(!safe(source.path)||!['asset','package'].includes(source.scope||'asset')||!/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('METHODOLOGY_REFERENCE_INVALID');
  const base=source.scope==='package'?declaration.root:declaration.assetRoot;
  const file=path.join(base,source.path);
  const relative=path.relative(declaration.root,file).replaceAll('\\','/');
  if(!relative||relative.startsWith('../')) throw new Error('METHODOLOGY_REFERENCE_INVALID');
  return {file,path:relative,sha256:source.sha256};
}
function readPinned(declaration,source,kind='source') {
  const ref=location(declaration,source);let bytes;
  try {
    if(fs.realpathSync(ref.file)!==ref.file||!fs.statSync(ref.file).isFile()) throw new Error('METHODOLOGY_REFERENCE_INVALID');
    bytes=fs.readFileSync(ref.file);
  } catch(error) {throw new Error(kind==='license'?'METHODOLOGY_LICENSE_MISSING: '+ref.path:'MISSING_METHOD: '+ref.path);}
  if(sha(bytes)!==ref.sha256) throw new Error('METHODOLOGY_PIN_MISMATCH: '+ref.path);
  return {...ref,bytes:bytes.length,content:bytes.toString('utf8')};
}
function condition(when,context) {
  return !when||Object.entries(when).every(([key,wanted])=>{
    const values=Array.isArray(context[key])?context[key]:[context[key]],allowed=Array.isArray(wanted)?wanted:[wanted];
    return values.some(v=>allowed.includes(v));
  });
}
const strip=text=>text.replace(/\r\n/g,'\n').replace(/^---\n[\s\S]*?\n---\n?/,'');

export function describeMethodology(asset,options={}) {
  const declaration=readMethodologyDeclaration(asset,options),{doc}=declaration;
  const sources=[doc.wrapper_source,...Object.values(doc.skills).flatMap(s=>[s,...(s.resources||[])]),...doc.licenses];
  const refs=new Map();
  for(const source of sources) {const ref=location(declaration,source);if(!fs.existsSync(ref.file)) throw new Error('MISSING_METHOD: '+ref.path);refs.set(ref.path,{path:ref.path,sha256:ref.sha256});}
  return {schema:'yy/methodology-description@1',asset,methodology_type:doc.methodology_type,primary_methodology:doc.primary,
    wrapper_policy:doc.wrapper_policy,logical_skills:Object.keys(doc.skills),bindings_sha256:declaration.bindings_sha256,
    optional_profile:doc.optional_profile||null,sources:[...refs.values()]};
}

async function compileMethodology(asset,context={},options={},descriptorOnly=false) {
  const declaration=readMethodologyDeclaration(asset,options),{doc}=declaration;
  const choice=doc.mode_selector?(context.methodology?.[doc.mode_selector]||doc.default_mode):null;
  const selected=choice?doc.modes?.[choice]:null;
  if(choice&&!selected) throw new Error('MISSING_METHOD_CONTEXT: unknown mode '+choice);
  const facts={...(doc.context_defaults||{}),...(context.methodology||{})};
  for(const key of selected?.required_context||[]) if(facts[key]===undefined||facts[key]===null||typeof facts[key]==='string'&&!facts[key].trim()||Array.isArray(facts[key])&&!facts[key].length) throw new Error('MISSING_METHOD_CONTEXT: '+key);
  if(!profileAllowed(doc.optional_profile,context.owner_intent,facts)) throw new Error('METHODOLOGY_NOT_ALLOWED: optional profile requires owner authorization and governance scope');
  for(const [tag,limit] of Object.entries(doc.resource_limits||{})) {
    const matches=Object.values(doc.skills).flatMap(s=>s.resources||[]).filter(r=>r.tag===tag&&condition(r.when,facts));
    if(matches.length>limit) throw new Error('METHODOLOGY_RESOURCE_LIMIT: '+tag);
  }
  const primary=selected?.primary||doc.primary,visited=new Set(),active=new Set(),records=new Map(),bindings=[],obligations=new Set();
  const phase=context.phase||'implement',access=context.delivery_access||'BUNDLE';
  if(!['BUNDLE','SHARED_AUTHORIZED','MCP_SOURCE'].includes(access)) throw new Error('METHODOLOGY_REFERENCE_INVALID: access');
  const projection=whens=>{
    const clauses=whens.flatMap(when=>Object.entries(when).map(([field,values])=>({field,values:Array.isArray(values)?values:[values]})));
    return !clauses.length?null:clauses.length===1?clauses[0]:{all:clauses};
  };
  function add(source,heading,kind='source',whens=[],delivery=source.delivery||{},native=null) {
    const ref=location(declaration,source),source_id='source-'+sha(ref.path+'\0'+ref.sha256);
    const available=whens.every(when=>condition(when,facts));
    const exposure=delivery.exposure||(whens.length||kind==='license'?'CONDITIONAL_REFERENCE':'INITIAL_REQUIRED');
    const exposed=available&&(exposure==='INITIAL_REQUIRED'||exposure==='STAGE_REQUIRED'&&phase===delivery.phase||exposure==='CONDITIONAL_REFERENCE'&&(whens.length>0||includes(context.requested_source_ids,source_id)));
    // Inactive references only supply filesystem metadata; their body is never read or exposed.
    const pinned=available&&!descriptorOnly?readPinned(declaration,source,kind):null;
    if(!pinned&&(fs.realpathSync(ref.file)!==ref.file||!fs.statSync(ref.file).isFile())) throw new Error((kind==='license'?'METHODOLOGY_LICENSE_MISSING: ':'MISSING_METHOD: ')+ref.path);
    const descriptor={source_id,raw_sha256:ref.sha256,bytes:pinned?.bytes??fs.statSync(ref.file).size,kind,exposure,condition:projection(whens),access:native===ref.sha256?'NATIVE_VERIFIED':access,native_identity:native!==null?{expected_sha256:ref.sha256,observed_sha256:native}:null};
    assertContract('SourceDescriptor',descriptor);
    for(const obligation of delivery.obligations||[]) obligations.add(obligation);
    const previous=records.get(source_id),inline=!descriptorOnly&&exposed&&kind!=='license'&&native!==ref.sha256;
    if(!previous) records.set(source_id,{ref,descriptor,available,exposed,inline,content:pinned?.content,heading});
    else {
      previous.available ||= available;previous.exposed ||= exposed;
      if(exposed&&native===ref.sha256) {previous.inline=false;previous.descriptor.access='NATIVE_VERIFIED';previous.descriptor.native_identity=descriptor.native_identity;}
      if(inline&&!previous.inline) {previous.inline=true;previous.content=pinned.content;previous.heading=heading;previous.descriptor.access=access;}
      if(available&&!previous.descriptor.condition) return source_id;
      if(available) previous.descriptor.condition=descriptor.condition;
    }
    return source_id;
  }
  add(doc.wrapper_source,'YY asset wrapper');
  for(const license of doc.licenses) add(license,'License','license');
  async function visit(id,whens=[],inherited={}) {
    if(active.has(id)) throw new Error('METHODOLOGY_DEPENDENCY_CYCLE: '+id);
    const visitKey=id+'\0'+canonicalJson(whens);
    if(visited.has(visitKey)) return;
    const item=doc.skills[id];if(!item) throw new Error('METHODOLOGY_DEPENDENCY_MISSING: '+id);
    let resolution=resolveMethodologyPolicy({asset,logical_skill:id,wrapper_policy:doc.wrapper_policy,invocation_policy:item.invocation_policy,
      decision_admission:context.decision_admission,owner_intent:context.owner_intent,host_capabilities:context.host_capabilities});
    if(resolution==='NOT_ALLOWED'&&whens.every(when=>condition(when,facts))) throw new Error('METHODOLOGY_NOT_ALLOWED: '+id);
    const observed=context.host_capabilities?.native_skill_identities?.[id]??null;
    if(resolution==='HOST_NATIVE_INVOCATION'&&observed!==item.sha256) resolution='INLINE_METHODOLOGY';
    const delivery=item.delivery||inherited;
    active.add(id);
    for(const dependency of item.dependencies||[]) {
      const dep=typeof dependency==='string'?{id:dependency}:dependency;
      await visit(dep.id,dep.when?[...whens,dep.when]:whens,delivery);
    }
    const sourceId=add(item,'Logical methodology: '+id,'source',whens,delivery,resolution==='HOST_NATIVE_INVOCATION'?observed:null);
    for(const resource of item.resources||[]) add(resource,'Methodology resource: '+id,'source',resource.when?[...whens,resource.when]:whens,resource.delivery||delivery);
    if(records.get(sourceId).exposed&&!bindings.some(b=>b.logical_skill===id)) bindings.push({logical_skill:id,invocation_policy:item.invocation_policy,path:location(declaration,item).path,sha256:item.sha256,resolution});
    active.delete(id);visited.add(visitKey);
  }
  await visit(primary);
  for(const extra of doc.conditional_skills||[]) await visit(extra.id,extra.when?[extra.when]:[]);
  for(const id of context.requested_logical_skills||[]) await visit(id);
  for(const requested of context.requested_resources||[]) {
    const allowed=Object.values(doc.skills).flatMap(s=>s.resources||[]).find(r=>(r.scope||'asset')==='asset'&&r.path===requested);
    if(!allowed||!condition(allowed.when,facts)) throw new Error('MISSING_METHOD: undeclared requested resource '+requested);
    add(allowed,'Requested resource','source',[],{exposure:'INITIAL_REQUIRED'});
  }
  const entries=[...records.values()],sources=entries.map(({ref,descriptor})=>({path:ref.path,sha256:ref.sha256,kind:descriptor.kind,source_id:descriptor.source_id,bytes:descriptor.bytes}));
  const content=entries.filter(e=>e.inline).map(e=>'## '+e.heading+'\n\n'+strip(e.content)).join('\n\n');
  const core={schema:'yy/delivery-plan@1',asset_id:asset,bindings_digest:declaration.bindings_sha256,execution_context_id:context.execution_context_id||'local:untracked',phase,
    sources:entries.map(e=>e.descriptor),available_source_ids:entries.filter(e=>e.available).map(e=>e.descriptor.source_id),exposed_source_ids:entries.filter(e=>e.exposed).map(e=>e.descriptor.source_id),mandatory_obligations:[...obligations]};
  const delivery_plan=assertContract('DeliveryPlan',{...core,delivery_digest:sha(canonicalJson(core))});
  return {schema:'yy/resolved-methodology@1',asset,methodology_type:doc.methodology_type,primary_methodology:primary,
    mode:choice,dependencies:bindings.filter(b=>b.logical_skill!==primary).map(b=>b.logical_skill),
    bindings_sha256:declaration.bindings_sha256,wrapper_policy:doc.wrapper_policy,bindings,sources,content,payload_hash:sha(content),delivery_plan};
}

export async function resolveMethodology(asset,context={},options={}) {
  return compileMethodology(asset,context,options);
}

/** Local adapters provide approved IDs and trusted context; a remote request never chooses paths or authorization. */
export async function readMethodologySource(asset,sourceId,{context={},expected_sha256,authorized_source_ids}={},options={}) {
  if(typeof sourceId!=='string'||!/^source-[a-f0-9]{64}$/.test(sourceId)||!includes(authorized_source_ids,sourceId)) throw new Error('SOURCE_NOT_AUTHORIZED');
  const resolved=await compileMethodology(asset,context,options,true),descriptor=resolved.delivery_plan.sources.find(s=>s.source_id===sourceId);
  if(!descriptor||!resolved.delivery_plan.available_source_ids.includes(sourceId)) throw new Error('SOURCE_NOT_AUTHORIZED');
  if(expected_sha256!==descriptor.raw_sha256) throw new Error('SOURCE_CHANGED');
  const source=resolved.sources.find(s=>s.source_id===sourceId),declaration=readMethodologyDeclaration(asset,options);
  const ref=readPinned(declaration,{scope:'package',path:source.path,sha256:expected_sha256},descriptor.kind);
  return {descriptor,content:ref.content,raw_sha256:ref.sha256,bytes:ref.bytes};
}
