/** Local execution plumbing. Decision semantics and receipt writing remain in their existing owners. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {normalizeDelegation} from './delegation-policy.mjs';
import {assertInputBudget} from './input-budget.mjs';
import {reserveCallAttempt,transitionCallAttempt} from './execution-quota.mjs';
import {createStore,withLock} from './store.mjs';
import {TimeoutError} from './errors.mjs';
import {stripFrontmatter} from './activation.mjs';
import {resolveMethodology,readMethodologySource} from './methodology.mjs';
export {resolveMethodologyPolicy} from './methodology.mjs';
const hash=data=>createHash('sha256').update(data).digest('hex');
const safe=p=>typeof p==='string'&&p.length>0&&!path.isAbsolute(p)&&!p.includes('\\')&&!/^[A-Za-z]:/.test(p)&&!p.split('/').some(s=>!s||s==='.'||s==='..');
const failure=(error,provider=null)=>({ok:false,status:'FAILED',executionMode:'HOST_NATIVE',executed:false,provider,artifacts:[],evidence:{},error});
const EXECUTION_CONTROL_FILES=new Set(['brief.md','execution-package.json','host-decision.json','receipt.json','result.txt','host-verification.json','checker-output.json']);
export const isExecutionControlFile=name=>EXECUTION_CONTROL_FILES.has(name);
export async function snapshotExecutionFiles(directory){
 directory=path.resolve(directory);if(await fs.realpath(directory)!==directory)deny('EXECUTION_ARTIFACT_INVALID');
 const files=new Map();
 async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){
   if(e.isSymbolicLink())deny('EXECUTION_ARTIFACT_INVALID');
   if(e.name==='sources'||EXECUTION_CONTROL_FILES.has(e.name))continue;
   const file=path.join(dir,e.name);if((await fs.realpath(file))!==file)deny('EXECUTION_ARTIFACT_INVALID');
   if(e.isDirectory())await walk(file);else if(e.isFile())files.set(file,hash(await fs.readFile(file)));
 }}
 await walk(directory);return files;
}

function deny(code){throw Object.assign(new Error(code),{code,retryable:false});}
/** Trusted capabilities are actual bindings. Installed commands do not imply approval. */
export function executionPolicy(options={}) {
  return normalizeDelegation({...options.delegationInput,
    execution_mode:options.delegationInput?.execution_mode??options.executionMode??(options.exec?.length||options.provider?'EXTERNAL_PROVIDER':'HOST_NATIVE'),
    capabilities:{host_native:typeof options.host?.execute==='function',native_subagent:typeof options.nativeSubagent?.execute==='function'},
    ...(options.externalApproval?.approved===true?{external:options.externalApproval}:{})});
}

/** Preserve state owned by handoff/quota transactions when runtime checkpoints a stale plan. */
export async function checkpointExecution(workspace,snapshot,checkpoint,{replacementDigest=null}={}) {
  return withLock(path.join(workspace,'.tt-state/state.json'),async()=>{
    const store=createStore(workspace),disk=await store.load(),next=structuredClone(snapshot);
    if(disk&&disk.id!==next.id&&hash(JSON.stringify(disk))!==replacementDigest)deny('ACCEPTANCE_STATE_CONFLICT');
    if(disk&&disk.id===next.id){
      if(disk.executionQuota)next.executionQuota=disk.executionQuota;
      if(disk.budgetPolicy)next.budgetPolicy=disk.budgetPolicy;
      for(const task of next.subtasks){const saved=disk.subtasks.find(s=>s.id===task.id);if(!saved)continue;
        for(const key of ['handoff','handoffRequests','handoffReturns','delegationContext','inputBudget','handoffPreview','returnPolicy','frozenChecker','usageObservation','budgetPolicy','permissionSnapshot','handoffApproval','handoffCheckerEvidence','handoffIntegrationProof','acceptanceCriteria','methodologyContext','ownerIntent'])if(saved[key]!==undefined)task[key]=saved[key];
        if(saved.handoff?.acceptance?.accepted===true){task.status=saved.status;task.executed=false;task.executionMode='BRIEF_ONLY';if(saved.artifactPath)task.artifactPath=saved.artifactPath;}
      }
    }
    await store.save(next);
    // Existing checkpoint callbacks see the merged snapshot while its lock is held.
    // They must not reacquire this resource lock or perform host execution.
    if(typeof checkpoint==='function')await checkpoint(structuredClone(next));
    return next;
  });
}

/** One physical YY-controlled call. Deterministic checkers never enter this seam. */
export async function invokeAuthorizedHost(subtask,finalText,options,invoke) {
  const mode=executionPolicy(options);if(!mode.automatic_dispatch_allowed)deny(mode.reason_codes[0]||'EXECUTION_NOT_APPROVED');
  const {verifyHostDecision,safeHostFile,createCoreTransport,prepareHostDecision,hostRecord}=await import('./host-adapter.mjs');
  let record=options.decisionRecord,didPresent=false;
  if(record===undefined){try{record=JSON.parse(await fs.readFile(safeHostFile(options.workspace,subtask.id),'utf8'));}catch{deny('HOST_INTEGRATION_BYPASS');}}
  const transport=options.transport||createCoreTransport({workspace:options.workspace,session:record?.host_binding?.session,repoRoot:options.assetsRoot});
  if(typeof options.present!=='function')deny('HOST_INTEGRATION_BYPASS');
  if(options.renewPlanDecision&&record?.schema==='yy/host-decision@1'&&record.presented===true){
    const current=await prepareHostDecision(record.input,{transport,present:options.present});if(!current.ok||!current.data.execution_permitted)deny(current.code||'HOST_DECISION_STALE');record=hostRecord(record.input,current);didPresent=true;
  }
  const fresh=await verifyHostDecision(record,record?.input,{transport});if(!fresh.ok)deny(fresh.code);
  const packet=fresh.data.decisions.find(p=>p.data?.brief&&p.data?.assets?.length);
  if(packet?.data.receipt_context?.subtask_id!==subtask.id||packet.data.assets[0].id!==subtask.asset)deny('HOST_INTEGRATION_BYPASS');
  const store=createStore(options.workspace),plan=await store.load(),task=plan?.subtasks?.find(t=>t.id===subtask.id);
  if(!plan||plan.id!==(options.planId??record.input.plan_id)||task?.asset!==subtask.asset||task?.desc!==subtask.desc)deny('HOST_INTEGRATION_BYPASS');
  if(record.input.execution_task!==undefined){if(record.input.plan_id!==plan.id||record.input.taskText!==plan.task||record.input.execution_task!==task.desc)deny('HOST_INTEGRATION_BYPASS');}
  else if(record.input.taskText!==task.desc)deny('HOST_INTEGRATION_BYPASS');
  if(task.handoff?.package?.registered===true)deny('MANUAL_EXECUTION_FORBIDDEN');
  if(!didPresent)for(const decision of fresh.data.decisions)await options.present(structuredClone(decision));
  const presented=await verifyHostDecision(record,record.input,{transport});if(!presented.ok)deny(presented.code);
  const policy=options.budgetPolicy??plan.budgetPolicy,measurement=assertInputBudget(finalText,policy,{tokenizer:options.tokenizer});
  const id=options.callAttemptId??randomUUID(),reservation={call_attempt_id:id,request_id:options.callRequestId??id,task_id:subtask.id,reservation_state:'RESERVED'};
  const reserved=await reserveCallAttempt(options.workspace,plan.id,policy,reservation,{depth:options.callDepth??1});if(reserved.idempotent)deny('CALL_ATTEMPT_ALREADY_RESERVED');
  await withLock(path.join(options.workspace,'.tt-state/state.json'),async()=>{const current=await store.load(),child=current?.subtasks?.find(t=>t.id===subtask.id);if(!child||current.id!==plan.id||child.asset!==task.asset||child.desc!==task.desc||current.task!==plan.task||child.handoff?.package?.registered===true)deny('HOST_INTEGRATION_BYPASS');child.inputBudget=measurement;child.delegationContext=mode;await store.save(current);});
  await transitionCallAttempt(options.workspace,plan.id,id,'STARTED');
  let result;
  try{result=await invoke();}
  catch(error){await transitionCallAttempt(options.workspace,plan.id,id,error instanceof TimeoutError||/TIMEOUT|UNCERTAIN/.test(error.code||'')?'UNCERTAIN':'SETTLED');throw error;}
  await transitionCallAttempt(options.workspace,plan.id,id,result?.error&&/TIMEOUT|UNCERTAIN/.test(result.error)?'UNCERTAIN':'SETTLED');
  return result;
}

export async function readResource(root,relative) {
  if(!safe(relative)) throw new Error('EXECUTION_REFERENCE_INVALID');
  const base=await fs.realpath(root),file=path.join(base,relative);
  const real=await fs.realpath(file);
  if(real!==file||!real.startsWith(base+path.sep)) throw new Error('EXECUTION_REFERENCE_INVALID');
  const bytes=await fs.readFile(file);
  return {path:relative,sha256:hash(bytes),content:bytes.toString('utf8')};
}

export async function prepareHostInput(subtask,body,upstream,options={}) {
  const requested=[...(subtask.requestedResources||[])];
  const asset=options.assets?.get(subtask.asset);
  const root=asset?.meta?.path&&options.assetsRoot?path.resolve(options.assetsRoot,asset.meta.path):null;
  let methodology={asset:subtask.asset,content:body,sha256:hash(body),references:[],bindings:[]};
  if(root) {
    const resolved=await resolveMethodology(subtask.asset,{
      decision_admission:options.methodologyAdmission,
      owner_intent:options.ownerIntent||{},
      host_capabilities:{native_skills:typeof options.host?.invokeSkill==='function'?options.host.skills||[]:[],native_skill_identities:typeof options.host?.invokeSkill==='function'?options.host.skillIdentities||{}:{}},
      methodology:options.methodologyContext||{},requested_resources:requested,
      execution_context_id:options.executionContextId||'host:'+subtask.id,phase:options.methodologyPhase||'implement',delivery_access:'SHARED_AUTHORIZED',
      requested_logical_skills:[...new Set([...(subtask.logicalSkillDependencies||[]),...(options.ownerIntent?.logical_skills||[])])]
    },{repoRoot:options.assetsRoot});
    methodology={...resolved,sha256:resolved.payload_hash,references:resolved.sources};
  } else if(requested.length) throw new Error('EXECUTION_RESOURCE_ROOT_MISSING');
  const task=subtask.desc||subtask.task||subtask.contract||'';
  return {task,parent_task:subtask.parentTask===task?null:subtask.parentTask||null,
    methodology_payload:methodology,requested_resources:requested,acceptance_criteria:subtask.acceptanceCriteria||[],
    contract:subtask.contract||null,upstream_artifacts:upstream};
}

export function dependencyPlan(input) {
  return (input.methodology_payload.bindings||[]).map(binding=>({...binding}));
}
export function methodologyDelivery(input,delivered=false) {
 const method=input.methodology_payload;
 return {methodology_selected:!!method.primary_methodology,methodology_payload_hash:method.sha256,
   logical_skills:(method.bindings||[]).map(b=>b.logical_skill),resolution:(method.bindings||[]).map(b=>({logical_skill:b.logical_skill,resolution:b.resolution})),
   delivered,methodology_application:'UNVERIFIED'};
}

/** Materialized originals keep reference access local, pinned and portable. */
export async function materializeHostSources(subtask,input,options) {
 const method=input.methodology_payload,delivery=method.delivery_plan;if(!delivery)return [];
 const policy=options.budgetPolicy??(await createStore(options.workspace).load())?.budgetPolicy;
 assertInputBudget(JSON.stringify(input),policy,{tokenizer:options.tokenizer});
 const sources=delivery.sources.filter(s=>delivery.available_source_ids.includes(s.source_id));
 if(sources.length>policy.max_read_calls||sources.reduce((n,s)=>n+s.bytes,0)>policy.max_read_bytes)deny('INPUT_BUDGET_BLOCKED');
 const context={decision_admission:options.methodologyAdmission,owner_intent:options.ownerIntent||{},methodology:options.methodologyContext||{},execution_context_id:delivery.execution_context_id,phase:options.methodologyPhase||'implement',delivery_access:'SHARED_AUTHORIZED',requested_resources:subtask.requestedResources||[],requested_logical_skills:subtask.logicalSkillDependencies||[]};
 const refs=[];
 for(const descriptor of sources){
  const source=method.sources.find(s=>s.source_id===descriptor.source_id);if(!source||!safe(source.path))deny('SOURCE_NOT_AUTHORIZED');
  const value=await readMethodologySource(subtask.asset,descriptor.source_id,{context,expected_sha256:descriptor.raw_sha256,authorized_source_ids:delivery.available_source_ids},{repoRoot:options.assetsRoot});
  if(Buffer.byteLength(value.content)!==value.bytes||hash(value.content)!==value.raw_sha256)deny('SOURCE_CHANGED');
  const relative='artifacts/'+subtask.id+'/sources/'+source.path,file=path.join(options.workspace,relative);let parent=options.workspace;
  for(const component of relative.split('/').slice(0,-1)){parent=path.join(parent,component);await fs.mkdir(parent,{recursive:true});if((await fs.lstat(parent)).isSymbolicLink()||(await fs.realpath(parent))!==path.resolve(parent))deny('SOURCE_NOT_AUTHORIZED');}
  try{const existing=await readResource(options.workspace,relative);if(existing.sha256!==value.raw_sha256)deny('SOURCE_CHANGED');}catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(file,value.content,{flag:'wx'});}
  refs.push({source_id:descriptor.source_id,relative_path:relative,raw_sha256:value.raw_sha256,bytes:value.bytes});
 }
 return refs;
}

export function briefOnly(artifactPath,reason='No executable host capability') {
  return {ok:true,status:'BRIEF_ONLY',executionMode:'BRIEF_ONLY',executed:false,provider:null,
    artifactPath,artifacts:[artifactPath],evidence:{},degraded:'brief-only ('+reason+')',methodology_application:'UNVERIFIED'};
}

export async function executeEmbedded(input,options) {
  const {workspace,subtaskId,host}=options;
  const dependencies=dependencyPlan(input),invocations=[];
  const dir=path.join(workspace,'artifacts',subtaskId),before=await snapshotExecutionFiles(dir);
  const copy=structuredClone(input),inputHash=hash(JSON.stringify(input));
  let returned;
  try {returned=await host.execute(copy,{workspace,subtask_id:subtaskId,artifacts_dir:dir,dependencies,
    invoke_skill:async(id,...args)=>{
      if(!dependencies.some(d=>d.logical_skill===id&&d.resolution==='HOST_NATIVE_INVOCATION')) throw new Error('LOGICAL_INVOCATION_UNAVAILABLE: '+id);
      const result=await invokeAuthorizedHost(options.subtask,JSON.stringify({logical_skill:id,arguments:args}),{...options,callAttemptId:undefined,callRequestId:undefined},()=>host.invokeSkill(id,...args));invocations.push(id);return result;
    }});}
  catch(error) {throw error;}
  if(hash(JSON.stringify(copy))!==inputHash) return failure('EXECUTION_INPUT_MUTATED',host.id||'host-native');
  if(returned?.status==='BRIEF_ONLY'&&returned?.executed!==true) return briefOnly('artifacts/'+subtaskId+'/brief.md','Host declined automatic execution');
  if(returned?.executed!==true||returned?.status!=='EXECUTED') return failure('HOST_EXECUTION_UNCONFIRMED',host.id||'host-native');
  const artifacts=[],proof=[];
  for(const relative of returned.artifacts||[]) {
    if(!safe(relative)||!relative.startsWith('artifacts/'+subtaskId+'/')||relative.startsWith('artifacts/'+subtaskId+'/sources/')||EXECUTION_CONTROL_FILES.has(path.basename(relative)))
      return failure('EXECUTION_ARTIFACT_INVALID',host.id||'host-native');
    try {
      const resource=await readResource(workspace,relative);
      if(!resource.content.trim()||before.get(path.resolve(workspace,relative))===resource.sha256) continue;
      artifacts.push(relative);proof.push({path:relative,sha256:resource.sha256});
    } catch {return failure('EXECUTION_ARTIFACT_INVALID',host.id||'host-native');}
  }
  if(!artifacts.length) return failure('HOST_ARTIFACT_MISSING',host.id||'host-native');
  return {ok:true,status:'EXECUTED',executionMode:'HOST_NATIVE',executed:true,provider:host.id||'host-native',
    artifactPath:artifacts[0],artifacts,evidence:{input_sha256:inputHash,artifacts:proof,host_evidence:returned.evidence||{},methodology_delivery:methodologyDelivery(input,true),native_invocations:invocations},
    assetConsumed:returned.evidence?.input_sha256===inputHash,methodology_application:'UNVERIFIED'};
}

/** Embedded execution reuses C4 admission; it does not implement Decision semantics. */
export async function executePreparedHost(record,options={}) {
  const {verifyHostDecision,safeHostFile,HOST_ROOT}=await import('./host-adapter.mjs');
  if(typeof options.present!=='function') return {...failure('HOST_INTEGRATION_BYPASS'),code:'HOST_INTEGRATION_BYPASS'};
  const fresh=await verifyHostDecision(record,record?.input,{transport:options.transport});
  if(!fresh.ok) return {...failure(fresh.code),...fresh,status:'FAILED',executed:false};
  for(const packet of fresh.data.decisions) await options.present(structuredClone(packet));
  const decision=fresh.data.decisions.find(p=>p.data?.assets?.length&&p.data?.brief);
  if(!decision) return {...failure('HOST_TASK_INPUT_REQUIRED'),code:'HOST_TASK_INPUT_REQUIRED'};
  try {
    const workspace=await fs.realpath(options.workspace),root=options.repoRoot||HOST_ROOT;
    const id=decision.data.receipt_context.subtask_id,selected=decision.data.assets[0];
    safeHostFile(workspace,id);
    const source=decision.data.evidence.refs.find(r=>r.path.startsWith('vendor/'+selected.id+'/'));
    const raw=await readResource(root,source.path);
    if(raw.sha256!==selected.source_hash) throw new Error('HOST_DECISION_STALE');
    const checked=await verifyHostDecision(record,record.input,{transport:options.transport});
    if(!checked.ok) return {...failure(checked.code),...checked,status:'FAILED',executed:false};
    const {dispatch,createContextBus}=await import('./runtime.mjs');
    const context=options.executionContext||{};
    const subtask={id,asset:selected.id,role:'primary',desc:record.input.execution_task??record.input.taskText,
      parentTask:context.parent_task||null,contract:context.contract,contractMode:'frozen',
      acceptanceCriteria:context.acceptance_criteria||[],upstreamRefs:context.upstream_artifacts||[],
      requestedResources:record.input.requestedResources||[],attempts:0,status:'idle'};
    const result=await dispatch(subtask,createContextBus(),{...options,decisionRecord:record,planId:record.input.plan_id??options.planId,workspace,assetsRoot:root,skipEligibilityGate:false,
      executionMode:options.executionMode||(options.exec?.length||options.provider?'EXTERNAL_PROVIDER':'HOST_NATIVE'),
      assets:new Map([[selected.id,{body:stripFrontmatter(raw.content),meta:{path:'vendor/'+selected.id}}]]),
      methodologyAdmission:{stage:true,task:true,asset:selected.id},
      ownerIntent:{...context.owner_intent,explicit_asset_task:true},methodologyContext:context.methodology_context||{},
      eligibilityConstraints:{owner_intent:context.owner_intent||{},methodology:context.methodology_context||{}},
      decisionPacket:decision,decisionAuthorityDigest:decision.data.authority.decision_authority_digest});
    if(!result.status) return {...failure(result.error||'HOST_EXECUTION_UNCONFIRMED',options.provider||null),code:result.error||'HOST_EXECUTION_UNCONFIRMED'};
    return result;
  } catch(error) {return {...failure(error.message),code:error.message};}
}
