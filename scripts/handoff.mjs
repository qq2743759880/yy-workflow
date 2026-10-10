/** Local approved manual handoff entry. C4 admits; T07 builds; T03 registers. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const runFile=promisify(execFile);
import {createStore,withLock} from './lib/store.mjs';
import {assertContract,canonicalJson} from './lib/delegation-contract.mjs';
import {normalizeDelegation} from './lib/delegation-policy.mjs';
import {CAPABILITY_MAP} from './lib/activation.mjs';
import {createCoreTransport,prepareHostDecision,hostRecord,verifyHostDecision} from './lib/host-adapter.mjs';
import {prepareHostInput} from './lib/host-execution.mjs';
import {readMethodologyDeclaration} from './lib/methodology.mjs';
import {buildHandoffPackage,prepareHandoffPackage,handoffReadAllowed,handoffPackageDirectory} from './lib/handoff-package.mjs';
import {verifyChecker,validateStagedReturn,readStagedIdentity} from './lib/result-validation.mjs';
import {readPlainFile,checkReturnPolicy,intakeReturn,stagingDirectory} from './lib/return-intake.mjs';
import {transactionHandoff} from './lib/handoff-state.mjs';
import {computeDecisionAuthority} from './lib/decision-authority.mjs';
import {summarizeReturn} from './lib/input-budget.mjs';
import {safeHostFile} from './lib/host-adapter.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>canonicalJson(a)===canonicalJson(b);
function requireValue(value,code='INPUT_INVALID'){if(!value)throw Object.assign(new Error(code),{code,retryable:false});}
const tuple=(plan,task)=>({plan_id:plan.id,parent_task:plan.task,task_id:task.id,asset:task.asset,task:task.desc,contract:task.contract??plan.contract,contract_mode:task.contractMode??plan.contractMode??null,requested_resources:task.requestedResources??[],requested_logical_skills:task.logicalSkillDependencies??[],independence_required:task.independenceRequired??task.independence_required??'none'});
function argumentsOf(argv){
 const args=[...argv],operation=args.shift()?.replace(/^--/,'');requireValue(['preview','prepare','import','validate','accept','resume','supersede','rework','integrate'].includes(operation));const options={operation};
 while(args.length){const name=args.shift();requireValue(['--workspace','--plan-id','--task-id','--config','--return','--source-root','--expected-state-version','--patch-id'].includes(name)&&args.length&&!args[0].startsWith('--'));requireValue(!Object.hasOwn(options,name.slice(2)));options[name.slice(2)]=args.shift();}
 requireValue(options['plan-id']&&options['task-id']);if(['preview','prepare'].includes(operation))requireValue(options.config);return options;
}
async function approvedConfig(file){
 const absolute=path.resolve(file),bytes=await readPlainFile(path.dirname(absolute),path.basename(absolute),4*1024*1024),config=JSON.parse(bytes.toString('utf8'));
 const allowed=['workflow_id','budget_policy','permission_snapshot','checker_ref','frozen_checker','return_policy','project_root','project_inputs','authorized_project_paths','acceptance','methodology_context','request_id','revision'];
 requireValue(config&&typeof config==='object'&&!Array.isArray(config)&&Object.keys(config).every(k=>allowed.includes(k)));
 for(const [name,key] of [['BudgetPolicy','budget_policy'],['PermissionSnapshot','permission_snapshot'],['CheckerRef','checker_ref']])assertContract(name,config[key]);
 const {policy_digest,...policy}=config.budget_policy;requireValue(sha(canonicalJson(policy))===policy_digest,'INPUT_BUDGET_BLOCKED');
 requireValue(typeof config.workflow_id==='string'&&config.workflow_id.trim()&&typeof config.project_root==='string'&&Array.isArray(config.project_inputs)&&Array.isArray(config.authorized_project_paths));
 requireValue(Array.isArray(config.acceptance)&&config.acceptance.length&&config.acceptance.every(x=>typeof x==='string'&&x.trim()));
 requireValue(config.request_id===undefined||typeof config.request_id==='string'&&config.request_id.trim());requireValue(config.revision===undefined||Number.isSafeInteger(config.revision)&&config.revision>0);
 await verifyChecker({frozenChecker:config.frozen_checker,handoff:{package:{checker_ref:config.checker_ref,permission_snapshot:config.permission_snapshot}}});
 const first=config.return_policy?.allowed_files?.[0];requireValue(first);checkReturnPolicy({returnPolicy:config.return_policy},{artifacts:[{logical_id:'policy-check',relative_path:first,bytes:0}]});
 return{config,digest:sha(canonicalJson(config))};
}
/** Public embedded entry. A completed presenter is required even for a preview. */
export async function runHandoff(argv,{present,independenceVerifier}={}){
 try{
  const opts=argumentsOf(argv),workspace=path.resolve(opts.workspace||'.');
  if(!['preview','prepare'].includes(opts.operation))return await returnAction(opts,{independenceVerifier});
  requireValue(typeof present==='function','HOST_INTEGRATION_BYPASS');const store=createStore(workspace),{config,digest:configDigest}=await approvedConfig(opts.config);
  const plan=await store.load(),task=plan?.subtasks?.find(t=>t.id===opts['task-id']);requireValue(plan?.id===opts['plan-id']&&task&&typeof plan.task==='string'&&plan.task.trim()&&typeof task.desc==='string'&&task.desc.trim(),'HOST_INTEGRATION_BYPASS');
  const approvedTuple=tuple(plan,task),tupleDigest=sha(canonicalJson(approvedTuple));
  const contract=approvedTuple.contract;requireValue(contract!==undefined&&contract!==null,'INPUT_INVALID');
  const contractBytes=approvedTuple.contract_mode==='frozen'?await readPlainFile(workspace,contract,config.budget_policy.max_read_bytes):Buffer.from(typeof contract==='string'?contract:canonicalJson(contract));requireValue(contractBytes.length>0);const contractDigest=sha(contractBytes),projectRoot=path.resolve(config.project_root);
  async function physical(){
   if(approvedTuple.contract_mode==='frozen')requireValue(sha(await readPlainFile(workspace,contract,config.budget_policy.max_read_bytes))===contractDigest,'SOURCE_CHANGED');
   for(const selected of config.project_inputs){requireValue(config.authorized_project_paths.includes(selected.relative_path)&&handoffReadAllowed(config.permission_snapshot,selected.relative_path),'SOURCE_NOT_AUTHORIZED');const bytes=await readPlainFile(projectRoot,selected.relative_path,config.budget_policy.max_read_bytes);requireValue(bytes.length===selected.bytes&&sha(bytes)===selected.sha256,'SOURCE_CHANGED');}
  }
  async function current(){const p=await store.load(),t=p?.subtasks?.find(t=>t.id===task.id);requireValue(p?.id===plan.id&&t&&same(tuple(p,t),approvedTuple),'HOST_INTEGRATION_BYPASS');await physical();return{plan:p,task:t};}
  await physical();
  const presentCurrent=async packet=>{await present(structuredClone(packet));if(opts.operation==='prepare')await withLock(path.join(workspace,'.tt-state/state.json'),current);else await current();};
  const capability=Object.entries(CAPABILITY_MAP).find(([,asset])=>asset===task.asset)?.[0];requireValue(capability,'HOST_INTEGRATION_BYPASS');
  const transport=createCoreTransport({workspace,workflowId:config.workflow_id,repoRoot:ROOT}),request={intent:'/yy 4',taskText:plan.task,subtaskId:task.id,capability,plan_id:plan.id,execution_task:task.desc};
  async function decision(){const result=await prepareHostDecision(request,{transport,present:presentCurrent,root:ROOT});requireValue(result.ok&&result.data.execution_permitted,result.code||'HOST_INTEGRATION_BYPASS');return hostRecord(request,result);}
  let record=await decision(),packet=record.decision.data.decisions.find(p=>p.data?.assets?.length&&p.data?.brief);requireValue(packet?.data.assets[0].id===task.asset,'HOST_INTEGRATION_BYPASS');
  const phase=task.asset==='review'?'review':'implement',methodologyContext={decision_admission:{stage:true,task:true,asset:task.asset},owner_intent:{explicit_asset_task:true},methodology:config.methodology_context||{},requested_resources:approvedTuple.requested_resources,requested_logical_skills:approvedTuple.requested_logical_skills,phase};
  const declaration=readMethodologyDeclaration(task.asset,{repoRoot:ROOT}),body=await fs.readFile(path.join(declaration.assetRoot,declaration.doc.wrapper_source.path),'utf8');
  const hostInput=await prepareHostInput({...task,parentTask:plan.task,acceptanceCriteria:config.acceptance,contract:contractBytes.toString('utf8')},body,[],{assetsRoot:ROOT,assets:new Map([[task.asset,{meta:{path:'vendor/'+task.asset}}]]),methodologyAdmission:methodologyContext.decision_admission,ownerIntent:methodologyContext.owner_intent,methodologyContext:methodologyContext.methodology,methodologyPhase:phase});
  const snapshotCore={task:approvedTuple,contract_digest:contractDigest,bindings_digest:declaration.bindings_sha256,project_inputs:config.project_inputs,evidence:record.decision.data.decisions.map(p=>p.data.evidence?.refs||[]),authority_ref:packet.data.authority.decision_authority_digest};
  const sourceSnapshot={ref:'local-approved-source:'+tupleDigest,digest:sha(canonicalJson(snapshotCore))},key=sha(canonicalJson({task:approvedTuple,config_digest:configDigest,source_snapshot:sourceSnapshot.digest}));
  const identity={workflow_id:config.workflow_id,plan_id:plan.id,task_id:task.id,handoff_id:'handoff-'+key,request_id:config.request_id||'request-'+key,attempt_id:'manual-'+key,revision:config.revision||1,authority_ref:packet.data.authority.decision_authority_digest,source_snapshot:sourceSnapshot,contract_digest:contractDigest};
  const mode=normalizeDelegation({task:{delegation_mode:'MANUAL_HANDOFF',ref:'approved-cli:'+configDigest},operation:opts.operation==='preview'?'PREVIEW':'PREPARE_HANDOFF',independence_required:task.independenceRequired??task.independence_required??'none'});
  const input={identity,host_input:hostInput,mode_context:mode,methodology_context:methodologyContext,budget_policy:config.budget_policy,permission_snapshot:config.permission_snapshot,checker_ref:config.checker_ref,project_inputs:config.project_inputs,authorized_project_paths:config.authorized_project_paths},options={workspace,repoRoot:ROOT,projectRoot};
  let bundle=await buildHandoffPackage(input,options);await current();
  if(opts.operation==='prepare'){
   const verified=await verifyHostDecision(record,request,{transport});requireValue(verified.ok,verified.code||'HOST_DECISION_STALE');
   await withLock(path.join(workspace,'.tt-state/state.json'),async()=>{const saved=await current(),child=saved.task;
    if(child.handoff?.package?.registered&&!['SUPERSEDED','REWORK_REQUIRED'].includes(child.handoff.handoff_status))requireValue(child.handoffApproval?.config_digest===configDigest&&child.handoff.package.package_digest===bundle.package.package_digest,'RETURN_CONFLICT');
    const values={budgetPolicy:config.budget_policy,permissionSnapshot:config.permission_snapshot,frozenChecker:config.frozen_checker,returnPolicy:config.return_policy,acceptanceCriteria:config.acceptance,delegationContext:mode,methodologyContext:methodologyContext.methodology,ownerIntent:methodologyContext.owner_intent,handoffApproval:{config_digest:configDigest,config_ref:path.resolve(opts.config),task_tuple_digest:tupleDigest,source_snapshot:sourceSnapshot,source_snapshot_core:snapshotCore,project_root:projectRoot,contract_digest:contractDigest,request_id:identity.request_id}};
    if(Object.entries(values).some(([k,v])=>child[k]===undefined||!same(child[k],v))){Object.assign(child,values);await store.save(saved.plan);}
   });
   record=await decision();const saved=await current();
   bundle=await prepareHandoffPackage(input,{...options,decisionRecord:record,transport,present:presentCurrent,expectedStateVersion:saved.task.handoff?.state_version??0});
   await withLock(path.join(workspace,'.tt-state/state.json'),async()=>{const saved=await current();requireValue(saved.task.handoff?.package?.package_digest===bundle.package.package_digest,'RETURN_CONFLICT');const values={executionMode:'BRIEF_ONLY',executed:false,delegationContext:mode,handoffPreview:{text:bundle.text,digest:bundle.package.input_digest},inputBudget:bundle.budget_evidence};if(Object.entries(values).some(([k,v])=>saved.task[k]===undefined||!same(saved.task[k],v))){Object.assign(saved.task,values);await store.save(saved.plan);}});
  }
  return{ok:true,code:null,data:{operation:opts.operation,registered:bundle.package.registered,executed:false,package:bundle.package,preview_text:bundle.text,preview_digest:bundle.package.input_digest,measurement:bundle.measurement,...(bundle.directory?{directory:bundle.directory,idempotent:bundle.idempotent}:{})},evidence:{config_digest:configDigest,contract_digest:contractDigest,source_snapshot:sourceSnapshot,source_snapshot_core:snapshotCore},warnings:[]};
 }catch(error){return{ok:false,code:error.code||'INPUT_INVALID',data:{reason:error.message,executed:false},evidence:error.evidence||{},warnings:[]};}
}

async function localTask(workspace,planId,taskId){const plan=await createStore(workspace).load(),task=plan?.subtasks?.find(t=>t.id===taskId);requireValue(plan&&task&&(!planId||plan.id===planId),'RETURN_IDENTITY_MISMATCH');return{plan,task};}
async function currentApproval(workspace,task){
 const {plan}=await localTask(workspace,null,task.id),approval=task.handoffApproval,p=task.handoff?.package;
 requireValue(p?.registered&&p.plan_id===plan.id&&p.task_id===task.id&&approval?.config_ref,'RETURN_IDENTITY_MISMATCH');
 const {config,digest}=await approvedConfig(approval.config_ref);requireValue(digest===approval.config_digest,'SOURCE_CHANGED');
 const core=approval.source_snapshot_core;requireValue(core&&sha(canonicalJson(core))===p.source_snapshot.digest&&same(tuple(plan,task),core.task),'SOURCE_CHANGED');
 const expected={budgetPolicy:config.budget_policy,permissionSnapshot:config.permission_snapshot,frozenChecker:config.frozen_checker,returnPolicy:config.return_policy,acceptanceCriteria:config.acceptance,methodologyContext:config.methodology_context||{},ownerIntent:{explicit_asset_task:true}};
 requireValue(Object.entries(expected).every(([key,value])=>same(task[key],value)),'SOURCE_CHANGED');
 const mode=normalizeDelegation({task:{delegation_mode:'MANUAL_HANDOFF',ref:'approved-cli:'+digest},operation:'PREPARE_HANDOFF',independence_required:core.task.independence_required});requireValue(same(task.delegationContext,mode),'SOURCE_CHANGED');
 requireValue(computeDecisionAuthority(ROOT).digest===p.authority_ref,'SOURCE_CHANGED');
 if(core.task.contract_mode==='frozen')requireValue(sha(await readPlainFile(workspace,core.task.contract,config.budget_policy.max_read_bytes))===core.contract_digest,'SOURCE_CHANGED');
 const projectRoot=approval.project_root;requireValue(projectRoot===path.resolve(config.project_root),'SOURCE_CHANGED');
 const projection=task.handoffIntegrationProof;let selectedInputs=core.project_inputs;
 if(projection){requireValue(projection.return_digest===task.handoff.return_digest&&projection.base_source_snapshot===p.source_snapshot.digest,'SOURCE_CHANGED');const bytes=await readPlainFile(workspace,projection.proof_ref,config.budget_policy.max_read_bytes);requireValue(sha(bytes)===projection.proof_sha256&&same(JSON.parse(bytes),projection.record),'SOURCE_CHANGED');selectedInputs=projection.record.project_inputs;requireValue(selectedInputs.length===core.project_inputs.length&&selectedInputs.every((i,n)=>i.logical_name===core.project_inputs[n].logical_name&&i.relative_path===core.project_inputs[n].relative_path),'SOURCE_CHANGED');}
 for(const selected of selectedInputs){requireValue(handoffReadAllowed(p.permission_snapshot,selected.relative_path)&&config.authorized_project_paths.includes(selected.relative_path),'SOURCE_NOT_AUTHORIZED');const bytes=await readPlainFile(projectRoot,selected.relative_path,config.budget_policy.max_read_bytes);requireValue(bytes.length===selected.bytes&&sha(bytes)===selected.sha256,'SOURCE_CHANGED');}
 const directory=handoffPackageDirectory(workspace,p),readJSON=async name=>JSON.parse((await readPlainFile(directory,name,config.budget_policy.max_input_bytes+config.budget_policy.max_read_bytes)).toString('utf8'));
 requireValue(same(await readJSON('package.json'),p),'SOURCE_CHANGED');requireValue(sha(await readPlainFile(directory,'prompt.md',config.budget_policy.max_input_bytes))===p.input_digest,'SOURCE_CHANGED');
 const map=await readJSON('source-map.json'),sources=p.inputs.filter(i=>i.kind!=='project');requireValue(map.length===sources.length,'SOURCE_CHANGED');
 for(const source of map){const input=sources.find(i=>i.logical_name===source.source_id);requireValue(input&&input.relative_path==='sources/'+source.original_path&&input.sha256===source.raw_sha256,'SOURCE_CHANGED');requireValue(sha(await readPlainFile(ROOT,source.original_path,config.budget_policy.max_read_bytes))===input.sha256,'SOURCE_CHANGED');}
 for(const refs of core.evidence)for(const ref of refs)requireValue(sha(await readPlainFile(ref.path.startsWith('.tt-state/')||ref.path.startsWith('artifacts/')?workspace:ROOT,ref.path,config.budget_policy.max_read_bytes))===ref.sha256,'SOURCE_CHANGED');
 return {config,project_inputs:selectedInputs,source_snapshot:projection?{ref:p.source_snapshot.ref,digest:sha(canonicalJson({base:p.source_snapshot,project_inputs:selectedInputs,integration_proof:projection.proof_sha256}))}:p.source_snapshot};
}
async function staged(workspace,task){const envelope=task.handoffReturns?.find(r=>r.return_digest===task.handoff?.return_digest);requireValue(envelope,'RETURN_IDENTITY_MISMATCH');const checked=await intakeReturn(workspace,task.id,envelope);requireValue(checked.ok&&checked.data.status==='STAGED',checked.code||'RETURN_STALE');return checked.data;}
async function identityNow(workspace,task,intake){
 const approved=await currentApproval(workspace,task),identity=await readStagedIdentity(workspace,task.id,intake);
 for(const proof of task.handoffCheckerEvidence||[])requireValue(sha(await readPlainFile(workspace,proof.path,task.frozenChecker.max_output_bytes))===proof.sha256,'SOURCE_CHANGED');
 return {...identity,current_snapshot:sha(canonicalJson({staged_snapshot:identity.current_snapshot,source_snapshot:approved.source_snapshot,config_digest:task.handoffApproval.config_digest}))};
}
async function writeEvidence(workspace,taskId,relative,bytes){
 const base=path.dirname(safeHostFile(workspace,taskId)),file=path.join(base,relative);requireValue(!path.isAbsolute(relative)&&!relative.split('/').some(s=>!s||s==='.'||s==='..'),'SOURCE_NOT_AUTHORIZED');
 await fs.mkdir(base,{recursive:true});let dir=base;for(const part of relative.split('/').slice(0,-1)){dir=path.join(dir,part);await fs.mkdir(dir,{recursive:true});requireValue((await fs.realpath(dir))===dir&&!(await fs.lstat(dir)).isSymbolicLink(),'SOURCE_NOT_AUTHORIZED');}
 try{const old=await readPlainFile(base,relative,bytes.length);requireValue(sha(old)===sha(bytes),'SOURCE_CHANGED');}catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(file,bytes,{flag:'wx'});}
 return path.relative(workspace,file).split(path.sep).join('/');
}
async function captureChecker(workspace,task,checked){
 const proofs=[];if(!checked.data?.temporary)return proofs;
 for(const name of ['checker-output.json','checker-stderr.txt']){const bytes=await readPlainFile(checked.data.temporary,name,task.frozenChecker.max_output_bytes).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(bytes!==null){const relative='check-'+task.handoff.return_digest+'-v'+task.handoff.state_version+'/'+name;proofs.push({path:await writeEvidence(workspace,task.id,relative,bytes),sha256:sha(bytes)});}}
 return proofs;
}
async function acceptedFiles(workspace,task,intake,{publish=false}={}){
 const refs=[];for(const artifact of intake.envelope.artifacts){const relative='accepted-'+intake.envelope.return_digest+'/'+artifact.relative_path,bytes=await readPlainFile(path.join(intake.directory,'files'),artifact.relative_path,task.returnPolicy.max_file_bytes);requireValue(sha(bytes)===artifact.sha256,'SOURCE_CHANGED');
  const reference='artifacts/'+task.id+'/'+relative;if(publish)await writeEvidence(workspace,task.id,relative,bytes);else requireValue(sha(await readPlainFile(workspace,reference,task.returnPolicy.max_file_bytes))===artifact.sha256,'SOURCE_CHANGED');refs.push({path:reference,sha256:artifact.sha256,bytes:artifact.bytes});
 }
 const full=canonicalJson({task_id:task.id,accepted:true,return_digest:intake.envelope.return_digest,artifact_refs:refs,remote_process:'UNKNOWN',methodology_application:'UNVERIFIED'}),relative='accepted-'+intake.envelope.return_digest+'.parent.json',reference='artifacts/'+task.id+'/'+relative;
 if(publish)await writeEvidence(workspace,task.id,relative,Buffer.from(full));else requireValue(sha(await readPlainFile(workspace,reference,task.returnPolicy.max_total_bytes))===sha(full),'SOURCE_CHANGED');
 return {artifact_refs:refs,parent_summary:summarizeReturn(full,task.budgetPolicy,{artifact_ref:reference,raw_sha256:sha(full)})};
}
/** Read-only trusted resume seam. A caller's ACCEPTED label cannot replace local evidence. */
export async function verifyAcceptedHandoff(workspace,original){
 const {task}=await localTask(workspace,null,original.id);requireValue(task.status==='done'&&task.handoff?.handoff_status==='ACCEPTED'&&task.handoff.acceptance?.accepted&&task.handoff.validation?.status==='PASS','VALIDATION_FAILED');
 requireValue(same(task.handoff,original.handoff),'ACCEPTANCE_STATE_CONFLICT');const intake=await staged(workspace,task),current=await identityNow(workspace,task,intake);requireValue(current.current_snapshot===task.handoff.validation.evaluated_snapshot&&current.current_snapshot===task.handoff.acceptance.evaluated_snapshot,'SOURCE_CHANGED');
 if([task.independenceRequired,task.independence_required,task.delegationContext.independence_required].includes('required'))requireValue(task.handoff.validation.independence_status==='SATISFIED','VALIDATION_FAILED');
 return acceptedFiles(workspace,task,intake);
}

/** Local integrator only. ponytail: one existing text file; broad migrations remain explicit local integration. */
async function integratePatch(workspace,task,intake,expected,patchId){
 const p=task.handoff.package,permission=p.permission_snapshot;
 requireValue(permission.git_write===true&&task.handoff.handoff_status==='RESULT_RECEIVED'&&!task.handoff.validation,'PATCH_INTEGRATION_REQUIRED');
 requireValue(!task.handoffIntegrationProof,'RETURN_CONFLICT');const patch=intake.envelope.artifacts.find(a=>a.kind==='PATCH_FOR_REVIEW'&&a.logical_id===patchId);requireValue(patch,'INPUT_INVALID');
 const approved=await currentApproval(workspace,task),patchBytes=await readPlainFile(path.join(intake.directory,'files'),patch.relative_path,task.returnPolicy.max_file_bytes);requireValue(sha(patchBytes)===patch.sha256,'SOURCE_CHANGED');
 requireValue(!/^(?:new file mode|deleted file mode|old mode|new mode|rename |copy |GIT binary patch|Binary files)/m.test(patchBytes.toString('utf8')),'PATCH_SCOPE_NOT_SUPPORTED');
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'yy local patch '));
 try{
  for(const input of approved.project_inputs){const bytes=await readPlainFile(task.handoffApproval.project_root,input.relative_path,task.budgetPolicy.max_read_bytes);const dest=path.join(temp,input.relative_path);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,bytes,{flag:'wx'});}
  const patchFile=path.join(temp,'approved-return.patch');await fs.writeFile(patchFile,patchBytes,{flag:'wx'});
  const git=async args=>runFile('git',['apply',...args,patchFile],{cwd:temp,timeout:5000,maxBuffer:Math.min(task.budgetPolicy.max_read_bytes,1024*1024),windowsHide:true});
  const {stdout}=await git(['--numstat','-z']);const rows=stdout.split('\0').filter(Boolean);requireValue(rows.length===1,'PATCH_SCOPE_NOT_SUPPORTED');const match=rows[0].match(/^\d+\t\d+\t([^\t\r\n]+)$/);requireValue(match,'PATCH_SCOPE_NOT_SUPPORTED');const relative=match[1],selected=approved.project_inputs.find(i=>i.relative_path===relative);
  requireValue(selected&&permission.write_paths.some(scope=>relative===scope||relative.startsWith(scope.replace(/\/$/,'')+'/'))&&!relative.split('/').some(s=>s.startsWith('.')||/^(?:config|bindings|credentials)/i.test(s)),'SOURCE_NOT_AUTHORIZED');
  await git(['--check']);await git([]);const changed=await readPlainFile(temp,relative,task.budgetPolicy.max_read_bytes);requireValue(sha(changed)!==selected.sha256,'PATCH_SCOPE_NOT_SUPPORTED');requireValue(approved.project_inputs.reduce((n,i)=>n+(i.relative_path===relative?changed.length:i.bytes),0)<=task.budgetPolicy.max_read_bytes,'INPUT_BUDGET_BLOCKED');
  const inputs=approved.project_inputs.map(i=>i.relative_path===relative?{...i,sha256:sha(changed),bytes:changed.length}:i),record={return_digest:intake.envelope.return_digest,base_source_snapshot:p.source_snapshot.digest,patch_sha256:patch.sha256,project_inputs:inputs};
  const proofBytes=Buffer.from(canonicalJson(record)),proofRef=await writeEvidence(workspace,task.id,'integration-'+intake.envelope.return_digest+'.json',proofBytes);
  const old=await readPlainFile(task.handoffApproval.project_root,relative,task.budgetPolicy.max_read_bytes);await writeEvidence(workspace,task.id,'integration-backup-'+intake.envelope.return_digest+'/'+relative,old);
  await withLock(path.join(workspace,'.tt-state/state.json'),async()=>{
   const {plan,task:current}=await localTask(workspace,p.plan_id,task.id);requireValue(current.handoff.state_version===expected&&same(current.handoff,task.handoff)&&!current.handoffIntegrationProof,'ACCEPTANCE_STATE_CONFLICT');await currentApproval(workspace,current);await readStagedIdentity(workspace,task.id,intake);
   const target=path.join(task.handoffApproval.project_root,relative),now=await readPlainFile(task.handoffApproval.project_root,relative,task.budgetPolicy.max_read_bytes);requireValue(sha(now)===selected.sha256,'SOURCE_CHANGED');const identity=await fs.lstat(target);
   // The external backup precedes the single-file rename. A crash before state save fails closed, never accepts old PASS.
   const pending=target+'.yy-integration-'+sha(intake.envelope.return_digest).slice(0,16);await fs.writeFile(pending,changed,{flag:'wx',mode:identity.mode});
   try{const finalBytes=await readPlainFile(task.handoffApproval.project_root,relative,task.budgetPolicy.max_read_bytes),final=await fs.lstat(target);requireValue(sha(finalBytes)===selected.sha256&&final.dev===identity.dev&&final.ino===identity.ino&&final.mtimeMs===identity.mtimeMs&&final.mode===identity.mode,'SOURCE_CHANGED');await fs.rename(pending,target);}
   catch(error){const owned=await readPlainFile(task.handoffApproval.project_root,path.relative(task.handoffApproval.project_root,pending).split(path.sep).join('/'),task.budgetPolicy.max_read_bytes).catch(()=>null);if(owned&&sha(owned)===sha(changed))await fs.unlink(pending);throw error;}
   current.handoffIntegrationProof={return_digest:intake.envelope.return_digest,base_source_snapshot:p.source_snapshot.digest,proof_ref:proofRef,proof_sha256:sha(proofBytes),record};await createStore(workspace).save(plan);
  });
  return {ok:true,code:null,data:{integrated:true,task_id:task.id,changed_paths:[relative],project_inputs:inputs,validation_required:true,executed:false},evidence:{proof_ref:proofRef,proof_sha256:sha(proofBytes)},warnings:[]};
 }finally{await fs.rm(temp,{recursive:true,force:true});}
}

async function returnAction(opts,{independenceVerifier}={}){
 const workspace=path.resolve(opts.workspace||'.'),store=createStore(workspace);let {task}=await localTask(workspace,opts['plan-id'],opts['task-id']);
 const expected=opts['expected-state-version']===undefined?task.handoff?.state_version??0:Number(opts['expected-state-version']);requireValue(Number.isSafeInteger(expected)&&expected>=0,'INPUT_INVALID');
 if(['supersede','rework','resume'].includes(opts.operation)){
  if(opts.operation==='resume'&&task.handoff?.handoff_status==='ACCEPTED')await verifyAcceptedHandoff(workspace,task);
  return transactionHandoff(workspace,task.id,expected,{type:opts.operation.toUpperCase()});
 }
 if(opts.operation==='import'){
  requireValue(opts.return,'INPUT_INVALID');const file=path.resolve(opts.return),envelope=JSON.parse((await readPlainFile(path.dirname(file),path.basename(file),task.returnPolicy.max_total_bytes)).toString('utf8'));
  const result=await intakeReturn(workspace,task.id,envelope,{sourceRoot:opts['source-root']?path.resolve(opts['source-root']):undefined});if(!result.ok||result.data.status==='LEGACY_REPORT_PARSED')return result;
  const transaction=await transactionHandoff(workspace,task.id,expected,{type:'IMPORT',envelope:result.data.envelope});if(!transaction.ok)return transaction;return {...transaction,data:{...transaction.data,staging_ref:result.data.directory}};
 }
 const intake=await staged(workspace,task);
 if(opts.operation==='integrate')return integratePatch(workspace,task,intake,expected,opts['patch-id']);
 if(opts.operation==='validate'){
  if(task.handoff.handoff_status==='RESULT_RECEIVED'&&task.handoff.validation?.status==='PASS'){const current=await identityNow(workspace,task,intake);requireValue(current.current_snapshot===task.handoff.validation.evaluated_snapshot,'SOURCE_CHANGED');return {ok:true,code:null,data:{validation:task.handoff.validation,idempotent:true,executed:false},evidence:{},warnings:[]};}
  const begun=await transactionHandoff(workspace,task.id,expected,{type:'VALIDATE_BEGIN'});if(!begun.ok)return begun;task=begun.data.task;
  let checked,validation,proofs=[];
  try{const before=await identityNow(workspace,task,intake);requireValue(!intake.envelope.artifacts.some(a=>a.kind==='PATCH_FOR_REVIEW')||task.handoffIntegrationProof,'PATCH_INTEGRATION_REQUIRED');const approved=await currentApproval(workspace,task);checked=await validateStagedReturn(workspace,task.id,intake,{independenceVerifier,...(task.handoffIntegrationProof?{projectSnapshot:{root:task.handoffApproval.project_root,inputs:approved.project_inputs}}:{})});proofs=await captureChecker(workspace,task,checked);requireValue(checked.ok,checked.code||'VALIDATION_FAILED');const after=await identityNow(workspace,task,intake);requireValue(same(before,after),'SOURCE_CHANGED');validation={...checked.data.validation,evaluated_snapshot:after.current_snapshot,evidence_refs:[...proofs.map(p=>p.path),...checked.data.validation.evidence_refs.filter(r=>!r.startsWith(checked.data.temporary))]};
  }catch(error){validation={schema:'yy/validation@1',handoff_id:task.handoff.package.handoff_id,revision:task.handoff.package.revision,status:checked?.code==='VALIDATION_FAILED'?'FAIL':'NOT_EVALUABLE',checker_id:task.handoff.package.checker_ref.checker_id,checker_definition_digest:task.handoff.package.checker_ref.definition_digest,evaluated_snapshot:task.handoff.package.source_snapshot.digest,return_digest:task.handoff.return_digest,exit_code:checked?.data?.exit_code??null,checks:[],independence_status:'UNKNOWN',unrun:[error.code||'VALIDATION_FAILED'],methodology_application:'UNVERIFIED',artifact_hashes:[],evidence_refs:proofs.map(p=>p.path)};}
  assertContract('ValidationResult',validation);
  await withLock(path.join(workspace,'.tt-state/state.json'),async()=>{const p=await store.load(),t=p?.subtasks.find(t=>t.id===task.id);requireValue(t?.handoff.state_version===task.handoff.state_version&&t.handoff.return_digest===task.handoff.return_digest,'ACCEPTANCE_STATE_CONFLICT');t.handoffCheckerEvidence=proofs;await store.save(p);});
  const result=await transactionHandoff(workspace,task.id,task.handoff.state_version,{type:'VALIDATE_RESULT',validation});if(!result.ok)return result;return {ok:validation.status==='PASS',code:validation.status==='PASS'?null:'VALIDATION_FAILED',data:{validation,executed:false},evidence:{checker:proofs},warnings:[]};
 }
 requireValue(opts.operation==='accept','INPUT_INVALID');requireValue(task.handoff.validation?.status==='PASS','VALIDATION_FAILED');requireValue(!intake.envelope.artifacts.some(a=>a.kind==='PATCH_FOR_REVIEW')||task.handoffIntegrationProof,'PATCH_INTEGRATION_REQUIRED');
 const current=await identityNow(workspace,task,intake);requireValue(current.current_snapshot===task.handoff.validation.evaluated_snapshot,'SOURCE_CHANGED');
 if([task.independenceRequired,task.independence_required,task.delegationContext.independence_required].includes('required'))requireValue(task.handoff.validation.independence_status==='SATISFIED','VALIDATION_FAILED');
 const published=await acceptedFiles(workspace,task,intake,{publish:true});
 const accepted=await transactionHandoff(workspace,task.id,expected,{type:'ACCEPT',return_digest:task.handoff.return_digest,...current},{readCurrentIdentity:async(w,t)=>{const final=await identityNow(w,t,intake);await acceptedFiles(w,t,intake);return final;}});
 if(!accepted.ok)return accepted;
 await withLock(path.join(workspace,'.tt-state/state.json'),async()=>{const p=await store.load(),t=p.subtasks.find(t=>t.id===task.id);requireValue(t.handoff.acceptance?.accepted_return_digest===intake.envelope.return_digest,'ACCEPTANCE_STATE_CONFLICT');t.artifactPath=published.artifact_refs[0]?.path??null;await store.save(p);});
 return {...accepted,data:{...accepted.data,...published,executed:false,methodology_application:'UNVERIFIED'}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await runHandoff(process.argv.slice(2),{present:async packet=>{process.stdout.write(JSON.stringify(packet)+'\n');}});process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=result.ok?0:1;
}
