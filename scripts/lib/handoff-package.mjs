/** Local portable handoff. No model calls; remote execution and usage remain unknown. */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {assertContract,canonicalJson} from './delegation-contract.mjs';
import {assertInputBudget} from './input-budget.mjs';
import {resolveMethodology,readMethodologySource} from './methodology.mjs';
import {transactionHandoff} from './handoff-state.mjs';
import {verifyHostDecision,createCoreTransport,safeHostFile} from './host-adapter.mjs';
import {withLock,createStore} from './store.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
function fail(code,message=code){throw Object.assign(new Error(code+': '+message),{code,retryable:false});}
const safe=p=>typeof p==='string'&&p&&!p.includes('\\')&&!/[\0-\x1f:]/.test(p)&&!path.posix.isAbsolute(p)&&!p.split('/').some(x=>!x||x==='.'||x==='..');
const sensitive=p=>p.split('/').some(x=>/^(?:\.env(?:\..*)?|\.ssh|\.git|\.tt-state|bindings(?:\..*)?|credentials(?:\..*)?|.*\.(?:pem|p12|pfx|key))$/i.test(x));
const secrets=text=>/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:api[_-]?key|access[_-]?token|password|secret)["']?\s*[:=]\s*["']?(?:sk-[A-Za-z0-9_-]{12,}|[A-Za-z0-9_+/-]{24,})/i.test(text);
export const handoffReadAllowed=(permissions,relative)=>safe(relative)&&permissions.read_paths.some(scope=>safe(scope)&&(relative===scope||relative.startsWith(scope+'/')));
function digest(pkg){const core={...pkg};delete core.package_digest;delete core.registered;return sha(canonicalJson(core));}
/** Single safe path rule for T09/T11. Opaque IDs are hashed, never decoded into paths. */
export function handoffPackageDirectory(workspace,pkg){
 const key=sha(canonicalJson({workflow_id:pkg.workflow_id,plan_id:pkg.plan_id,task_id:pkg.task_id,handoff_id:pkg.handoff_id,request_id:pkg.request_id,revision:pkg.revision}));
 return path.dirname(safeHostFile(workspace,'handoff-'+key));
}

/** PREVIEW reads approved material only; it never writes state/artifacts or invents registration. */
export async function buildHandoffPackage(original,{repoRoot=ROOT,projectRoot}={}){
 const input=structuredClone(original),{identity,host_input:hostInput,mode_context:mode,budget_policy:policy,permission_snapshot:permissions,checker_ref:checker}=input;
 assertContract('ModeContext',mode);assertContract('BudgetPolicy',policy);assertContract('PermissionSnapshot',permissions);assertContract('CheckerRef',checker);
 if(mode.delegation_mode!=='MANUAL_HANDOFF'||mode.automatic_dispatch_allowed!==false||mode.executed!==false)fail('MANUAL_EXECUTION_FORBIDDEN');
 if(!permissions.approved_checker_ids.includes(checker.checker_id))fail('CHECKER_NOT_APPROVED');
 if(typeof hostInput?.task!=='string'||!hostInput.task.trim()||!Array.isArray(hostInput.acceptance_criteria)||!hostInput.acceptance_criteria.length||hostInput.acceptance_criteria.some(x=>typeof x!=='string'))fail('INPUT_INVALID','task and explicit acceptance required');
 const asset=hostInput.methodology_payload?.asset;if(!asset)fail('INPUT_INVALID','methodology asset required');
 // A fresh receiver cannot inherit the producer host's native skills or token context.
 const methodContext={...input.methodology_context,execution_context_id:'handoff-context-'+sha(canonicalJson(identity)),host_capabilities:{native_skills:[]},delivery_access:'BUNDLE'};
 const method=await resolveMethodology(asset,methodContext,{repoRoot});
 if(method.bindings_sha256!==hostInput.methodology_payload.bindings_sha256)fail('SOURCE_CHANGED','methodology declaration changed');
 const files=[],inputs=[],sourceMap=[];let readBytes=0,readCalls=0;
 function bound(bytes){readBytes+=bytes;readCalls++;if(readBytes>policy.max_read_bytes||readCalls>policy.max_read_calls)fail('INPUT_BUDGET_BLOCKED','approved material bound exceeded');}
 function add(logical_name,relative_path,content,kind){const bytes=Buffer.from(content);inputs.push(assertContract('InputFile',{logical_name,relative_path,sha256:sha(bytes),bytes:bytes.length,kind}));files.push({relative_path,content:bytes});}
 for(const descriptor of method.delivery_plan.sources.filter(s=>method.delivery_plan.available_source_ids.includes(s.source_id)).sort((a,b)=>a.source_id.localeCompare(b.source_id))){
  bound(descriptor.bytes);
  const source=await readMethodologySource(asset,descriptor.source_id,{context:methodContext,expected_sha256:descriptor.raw_sha256,authorized_source_ids:method.delivery_plan.available_source_ids},{repoRoot});
  if(sha(Buffer.from(source.content,'utf8'))!==descriptor.raw_sha256)fail('SOURCE_CHANGED','source is not lossless UTF8');
  const original_path=method.sources.find(s=>s.source_id===descriptor.source_id)?.path;
  if(!safe(original_path))fail('SOURCE_NOT_AUTHORIZED','declared source path invalid');
  const relative_path='sources/'+original_path;add(descriptor.source_id,relative_path,source.content,descriptor.kind);
  sourceMap.push({source_id:descriptor.source_id,original_path,relative_path,raw_sha256:source.raw_sha256,bytes:source.bytes});
 }
 for(const selected of input.project_inputs||[]){
  if(!safe(selected.relative_path)||sensitive(selected.relative_path)||!handoffReadAllowed(permissions,selected.relative_path)||!input.authorized_project_paths?.includes(selected.relative_path)||!projectRoot)fail('SOURCE_NOT_AUTHORIZED','unapproved or sensitive project path');
  const base=fs.realpathSync(projectRoot),file=path.join(base,selected.relative_path),stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||fs.realpathSync(file)!==file)fail('SOURCE_NOT_AUTHORIZED','project input must be regular and nonlink');
  if(stat.size!==selected.bytes)fail('SOURCE_CHANGED','project size changed');bound(stat.size);
  const bytes=fs.readFileSync(file);if(sha(bytes)!==selected.sha256)fail('SOURCE_CHANGED','project hash changed');
  if(secrets(bytes.toString('utf8')))fail('SOURCE_NOT_AUTHORIZED','credential-like input');
  add(selected.logical_name,'project/'+selected.relative_path,bytes,'project');
 }
 inputs.sort((a,b)=>a.relative_path.localeCompare(b.relative_path));files.sort((a,b)=>a.relative_path.localeCompare(b.relative_path));
 if(new Set(inputs.map(i=>i.logical_name)).size!==inputs.length||new Set(inputs.map(i=>i.relative_path)).size!==inputs.length)fail('INPUT_INVALID','duplicate input identities');
 const values={identity:identity.handoff_id+' / '+identity.task_id+' / revision '+identity.revision,task:hostInput.task,parent:hostInput.parent_task===hostInput.task?'与执行任务一致，省略重复正文':hostInput.parent_task??'(none)',permissions:json(permissions),acceptance:json(hostInput.acceptance_criteria),checker:json(checker),contract:json(hostInput.contract??null),methodology:method.content,sources:sourceMap.map(s=>s.source_id+' -> '+s.relative_path+' | SHA256 '+s.raw_sha256).join('\n')+'\n'+inputs.filter(i=>i.kind==='project').map(i=>i.logical_name+' -> '+i.relative_path+' | SHA256 '+i.sha256).join('\n'),obligations:json(method.delivery_plan.mandatory_obligations),budget:json({policy_id:policy.policy_id,policy_digest:policy.policy_digest,observable_scope:policy.observable_scope,remote_process:'UNKNOWN',remote_usage:'UNKNOWN'})};
 const text=fs.readFileSync(path.join(ROOT,'templates/handoff-prompt.md'),'utf8').replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>{if(!Object.hasOwn(values,key))fail('INPUT_INVALID','unknown prompt field');return values[key];});
 const budgetEvidence=assertInputBudget(text,policy,{breakdown:Object.entries(values).map(([name,value])=>({name,input_bytes:Buffer.byteLength(value)}))});
 const core={schema:'yy/handoff-package@1',...identity,input_digest:sha(text),methodology_digest:method.delivery_plan.delivery_digest,permission_snapshot:permissions,checker_ref:checker,budget_ref:{policy_id:policy.policy_id,policy_digest:policy.policy_digest},inputs,delivery_ref:{asset_id:asset,bindings_digest:method.bindings_sha256,delivery_digest:method.delivery_plan.delivery_digest}};
 const pkg=assertContract('HandoffPackage',{...core,package_digest:sha(canonicalJson(core)),registered:false});
 const returned=JSON.parse(fs.readFileSync(path.join(ROOT,'templates/handoff-return.json'),'utf8'));
 for(const key of ['handoff_id','revision','package_digest','input_digest','contract_digest','methodology_digest'])returned[key]=pkg[key];
 assertContract('ReturnEnvelope',returned);
 return{package:pkg,text,budget_evidence:budgetEvidence,measurement:budgetEvidence.measurement,delivery_plan:method.delivery_plan,source_map:sourceMap,files,return_template:returned,mode_context:mode,remote_process:'UNKNOWN',remote_usage:'UNKNOWN',methodology_application:'UNVERIFIED'};
}

function validate(bundle){
 assertContract('HandoffPackage',bundle.package);assertContract('DeliveryPlan',bundle.delivery_plan);assertContract('ReturnEnvelope',bundle.return_template);
 if(digest(bundle.package)!==bundle.package.package_digest||sha(bundle.text)!==bundle.package.input_digest||bundle.files.length!==bundle.package.inputs.length)fail('SOURCE_CHANGED','bundle changed');
 for(const item of bundle.package.inputs){const file=bundle.files.find(f=>f.relative_path===item.relative_path);if(!file||!safe(item.relative_path)||file.content.length!==item.bytes||sha(file.content)!==item.sha256)fail('SOURCE_CHANGED','input bytes changed');}
 const delivery={...bundle.delivery_plan};delete delivery.delivery_digest;
 if(sha(canonicalJson(delivery))!==bundle.delivery_plan.delivery_digest||bundle.delivery_plan.delivery_digest!==bundle.package.methodology_digest||bundle.budget_evidence.measurement.input_bytes!==Buffer.byteLength(bundle.text)||bundle.budget_evidence.rendered_sha256!==bundle.package.input_digest)fail('SOURCE_CHANGED','delivery or measured input changed');
 const sourceInputs=bundle.package.inputs.filter(i=>i.kind!=='project');
 if(bundle.source_map.length!==sourceInputs.length)fail('SOURCE_CHANGED','source map changed');
 for(const source of bundle.source_map){const item=sourceInputs.find(i=>i.logical_name===source.source_id);if(!item||!safe(source.original_path)||source.relative_path!=='sources/'+source.original_path||item.relative_path!==source.relative_path||item.sha256!==source.raw_sha256||item.bytes!==source.bytes||!bundle.delivery_plan.available_source_ids.includes(source.source_id))fail('SOURCE_CHANGED','source map identity changed');}
 for(const key of ['handoff_id','revision','package_digest','input_digest','contract_digest','methodology_digest'])if(bundle.return_template[key]!==bundle.package[key])fail('SOURCE_CHANGED','return template identity changed');
}
async function atomic(file,bytes){const tmp=file+'.tmp-'+randomUUID();await fsp.writeFile(tmp,bytes,{flag:'wx'});await fsp.rename(tmp,file);}
async function put(directory,relative,bytes){
 if(!safe(relative))fail('SOURCE_NOT_AUTHORIZED');let current=directory;
 for(const part of relative.split('/').slice(0,-1)){current=path.join(current,part);try{const st=await fsp.lstat(current);if(st.isSymbolicLink()||!st.isDirectory())fail('SOURCE_NOT_AUTHORIZED');}catch(error){if(error.code!=='ENOENT')throw error;await fsp.mkdir(current);}}
 const file=path.join(directory,relative);try{const st=await fsp.lstat(file);if(st.isSymbolicLink()||!st.isFile()||sha(await fsp.readFile(file))!==sha(bytes))fail('SOURCE_CHANGED','existing package bytes drifted');}catch(error){if(error.code!=='ENOENT')throw error;await fsp.writeFile(file,bytes,{flag:'wx'});}
}
/** Materialize local candidate only. ORPHAN grants no remote execution or acceptance. */
export async function writeHandoffPackage(bundle,{workspace,outputRoot}={}){
 validate(bundle);const directory=handoffPackageDirectory(workspace,bundle.package);
 if(outputRoot&&path.resolve(outputRoot)!==directory)fail('SOURCE_NOT_AUTHORIZED');
 await fsp.mkdir(path.dirname(directory),{recursive:true});
 return withLock(directory,async()=>{
  handoffPackageDirectory(workspace,bundle.package);await fsp.mkdir(directory,{recursive:true});
  const markerFile=path.join(directory,'preparation.json');let marker;
  try{if((await fsp.lstat(markerFile)).isSymbolicLink())fail('SOURCE_NOT_AUTHORIZED');marker=JSON.parse(await fsp.readFile(markerFile,'utf8'));if(marker.package_digest!==bundle.package.package_digest||marker.request_id!==bundle.package.request_id)fail('RETURN_CONFLICT');}
  catch(error){if(error.code!=='ENOENT')throw error;marker={status:'ORPHAN_PREPARATION',acceptable:false,request_id:bundle.package.request_id,package_digest:bundle.package.package_digest};await atomic(markerFile,json(marker));}
  for(const file of bundle.files)await put(directory,file.relative_path,file.content);
  for(const [name,value] of [['prompt.md',bundle.text],['source-map.json',json(bundle.source_map)],['delivery-plan.json',json(bundle.delivery_plan)],['return-template.json',json(bundle.return_template)],['control.json',json({input_digest:bundle.package.input_digest,mode_context:bundle.mode_context,budget_evidence:bundle.budget_evidence,remote_process:'UNKNOWN',remote_usage:'UNKNOWN',methodology_application:'UNVERIFIED'})]])await put(directory,name,value);
  const manifest=path.join(directory,'package.json');try{if((await fsp.lstat(manifest)).isSymbolicLink())fail('SOURCE_NOT_AUTHORIZED');const prior=assertContract('HandoffPackage',JSON.parse(await fsp.readFile(manifest,'utf8')));if(digest(prior)!==bundle.package.package_digest)fail('SOURCE_CHANGED','manifest changed');}catch(error){if(error.code!=='ENOENT')throw error;await put(directory,'package.json',json(bundle.package));}
  return{directory,status:marker.status};
 });
}
/** C4 verify/present, directory materialization, then a separate short T03 registration transaction. */
export async function prepareHandoffPackage(original,options={}){
 const input=structuredClone(original),record=options.decisionRecord&&structuredClone(options.decisionRecord);
 if(!record||typeof options.present!=='function')fail('HOST_INTEGRATION_BYPASS');
 const prospective=handoffPackageDirectory(options.workspace,input.identity);
 if(options.outputRoot&&path.resolve(options.outputRoot)!==prospective)fail('SOURCE_NOT_AUTHORIZED');
 const fresh=await verifyHostDecision(record,record.input,{transport:options.transport||createCoreTransport({workspace:options.workspace})});
 if(!fresh.ok)fail(fresh.code||'HOST_INTEGRATION_BYPASS');
 const packet=fresh.data.decisions.find(p=>p.data.receipt_context?.subtask_id!==undefined),primary=packet?.data.routing?.primary_assets?.[0]||packet?.data.assets?.[0]?.id;
 if(!packet||packet.data.receipt_context.subtask_id!==input.identity.task_id||primary!==input.host_input.methodology_payload.asset||packet.data.authority.decision_authority_digest!==input.identity.authority_ref)fail('HOST_INTEGRATION_BYPASS','frozen task/asset/authority mismatch');
 if(Object.hasOwn(record.input,'plan_id')&&(typeof record.input.plan_id!=='string'||!record.input.plan_id.trim()||record.input.plan_id!==input.identity.plan_id))fail('HOST_INTEGRATION_BYPASS','invalid plan identity extension');
 if(Object.hasOwn(record.input,'execution_task')){
  const plan=await createStore(options.workspace).load(),task=plan?.subtasks?.find(t=>t.id===input.identity.task_id);
  if(typeof record.input.execution_task!=='string'||!record.input.execution_task.trim()||plan?.id!==input.identity.plan_id||plan?.id!==record.input.plan_id||plan?.task!==record.input.taskText||task?.asset!==primary||task?.desc!==record.input.execution_task||input.host_input.task!==record.input.execution_task)fail('HOST_INTEGRATION_BYPASS','support child differs from approved local plan');
 }else if(record.input.taskText!==input.host_input.task)fail('HOST_INTEGRATION_BYPASS','task differs from frozen C4 request');
 for(const decision of fresh.data.decisions)await options.present(structuredClone(decision));
 const bundle=await buildHandoffPackage(input,options),prepared=await writeHandoffPackage(bundle,options);
 for(const item of bundle.package.inputs){const file=path.join(prepared.directory,item.relative_path);if(fs.realpathSync(file)!==file||sha(await fsp.readFile(file))!==item.sha256)fail('SOURCE_CHANGED');}
 if(sha(await fsp.readFile(path.join(prepared.directory,'prompt.md')))!==bundle.package.input_digest)fail('SOURCE_CHANGED');
 const registered={...bundle.package,registered:true},transaction=await transactionHandoff(options.workspace,registered.task_id,options.expectedStateVersion,{type:'PREPARE',package:registered});
 if(!transaction.ok)fail(transaction.code,'package stays ORPHAN; no task acceptance');
 await atomic(path.join(prepared.directory,'package.json'),json(registered));await atomic(path.join(prepared.directory,'preparation.json'),json({status:'REGISTERED',acceptable:false,request_id:registered.request_id,package_digest:registered.package_digest}));
 return{...bundle,package:registered,directory:prepared.directory,idempotent:transaction.data.idempotent,handoff:transaction.data.handoff};
}
