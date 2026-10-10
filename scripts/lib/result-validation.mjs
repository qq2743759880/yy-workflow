import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {assertContract,canonicalJson} from './delegation-contract.mjs';
import {digestBytes,intakeFailure,requireIntake,localReturnTask,readPlainFile,stagingDirectory,returnEnvelopeDigest,checkReturnPolicy} from './return-intake.mjs';
const same=(a,b)=>canonicalJson(a)===canonicalJson(b);
const respond=(ok,code,data=null,evidence={})=>({ok,code,data,evidence,warnings:[]});
export function checkerDefinitionDigest(checker) {const {definition_digest,...core}=checker;return digestBytes(canonicalJson(core));}
export async function verifyChecker(task) {
 const c=task.frozenChecker,p=task.handoff.package;
 requireIntake(c && c.checker_id===p.checker_ref.checker_id && c.definition_digest===p.checker_ref.definition_digest && checkerDefinitionDigest(c)===c.definition_digest && p.permission_snapshot.approved_checker_ids.includes(c.checker_id),'CHECKER_NOT_APPROVED');
 requireIntake(Array.isArray(c.command)&&c.command.length>0&&c.command.every(x=>typeof x==='string'&&x&&!x.includes('\0'))&&path.isAbsolute(c.command[0])&&Array.isArray(c.dependencies)&&c.dependencies.length>0&&Number.isSafeInteger(c.timeout_ms)&&c.timeout_ms>0&&Number.isSafeInteger(c.max_output_bytes)&&c.max_output_bytes>0,'CHECKER_NOT_APPROVED');
 requireIntake(c.dependencies.some(d=>d.path===c.command[0]),'CHECKER_NOT_APPROVED');
 for(const dependency of c.dependencies){requireIntake(path.isAbsolute(dependency.path)&&/^[0-9a-f]{64}$/.test(dependency.sha256),'CHECKER_NOT_APPROVED');const st=await fs.lstat(dependency.path);requireIntake(st.isFile()&&!st.isSymbolicLink()&&(await fs.realpath(dependency.path))===path.resolve(dependency.path),'CHECKER_NOT_APPROVED');requireIntake(digestBytes(await fs.readFile(dependency.path))===dependency.sha256,'CHECKER_NOT_APPROVED');}
 for(const argument of c.command.slice(1))if(path.isAbsolute(argument)&&(await fs.stat(argument).catch(()=>null))?.isFile())requireIntake(c.dependencies.some(d=>d.path===argument),'CHECKER_NOT_APPROVED');
 return c;
}
async function stageIdentity(workspace,taskId,intake,task) {
 const en=assertContract('ReturnEnvelope',intake.envelope);requireIntake(returnEnvelopeDigest(en)===en.return_digest,'RETURN_IDENTITY_MISMATCH');
 const p=task.handoff.package;requireIntake(['handoff_id','revision','package_digest','input_digest','contract_digest','methodology_digest'].every(k=>p[k]===en[k]),'RETURN_STALE');
 requireIntake(task.handoff.return_digest===null || task.handoff.return_digest===en.return_digest,'RETURN_CONFLICT');
 const policy=checkReturnPolicy(task,en);requireIntake(Buffer.byteLength(canonicalJson(en))+en.artifacts.reduce((total,a)=>total+a.bytes,0)<=policy.max_total_bytes,'INPUT_BUDGET_BLOCKED');
 const dir=await stagingDirectory(workspace,taskId,en);requireIntake(dir===intake.directory,'SOURCE_NOT_AUTHORIZED');
 const saved=JSON.parse((await readPlainFile(dir,'envelope.json',task.returnPolicy.max_total_bytes)).toString('utf8'));requireIntake(same(saved,en),'RETURN_IDENTITY_MISMATCH');
 for(const artifact of en.artifacts){requireIntake(task.returnPolicy.allowed_files.includes(artifact.relative_path),'SOURCE_NOT_AUTHORIZED');const bytes=await readPlainFile(path.join(dir,'files'),artifact.relative_path,task.returnPolicy.max_file_bytes);requireIntake(bytes.length===artifact.bytes && digestBytes(bytes)===artifact.sha256,'SOURCE_CHANGED');}
 const artifact_hashes=structuredClone(en.artifacts),current_snapshot=digestBytes(canonicalJson({source_snapshot:p.source_snapshot,return_digest:en.return_digest,artifact_hashes}));
 return {current_snapshot,artifact_hashes,checker_ref:structuredClone(p.checker_ref)};
}
/** Local final-accept consumer can recompute the same approved staged identity. */
export async function readStagedIdentity(workspace,taskId,intake) {const task=await localReturnTask(workspace,taskId);await verifyChecker(task);return stageIdentity(workspace,taskId,intake,task);}
function executeChecker(command,args,cwd,timeout,limit) {
 return new Promise(resolve=>{
  const child=spawn(command,args,{cwd,shell:false,stdio:['ignore','pipe','pipe']}),chunks=[],errors=[];let bytes=0,overflow=false,timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill();},timeout);
  const collect=target=>chunk=>{bytes+=chunk.length;if(bytes>limit){overflow=true;child.kill();return;}target.push(chunk);};
  child.stdout.on('data',collect(chunks));child.stderr.on('data',collect(errors));
  child.on('error',error=>{clearTimeout(timer);resolve({exit_code:null,stdout:Buffer.concat(chunks).toString('utf8'),stderr:String(error),overflow,timedOut});});
  child.on('close',code=>{clearTimeout(timer);resolve({exit_code:code,stdout:Buffer.concat(chunks).toString('utf8'),stderr:Buffer.concat(errors).toString('utf8'),overflow,timedOut});});
 });
}
/** No execution prerequisite: only a locally approved checker runs, outside state locks. */
export async function validateStagedReturn(workspace,taskId,intake,opts={}) {
 let temporary=null,processResult=null;
 try {
  requireIntake(intake?.status==='STAGED' && intake.task_id===taskId,'RETURN_STALE');
  const task=await localReturnTask(workspace,taskId),checker=await verifyChecker(task),before=await stageIdentity(workspace,taskId,intake,task);
  const project=opts.projectSnapshot;
  if(project){requireIntake(Array.isArray(project.inputs)&&project.inputs.length>0&&task.handoffIntegrationProof,'SOURCE_NOT_AUTHORIZED');for(const i of project.inputs){const bytes=await readPlainFile(project.root,i.relative_path,task.budgetPolicy.max_read_bytes);requireIntake(bytes.length===i.bytes&&digestBytes(bytes)===i.sha256,'SOURCE_CHANGED');}}
  temporary=await fs.mkdtemp(path.join(os.tmpdir(),'yy-return-check-'));const files=path.join(temporary,'files');await fs.mkdir(files);
  for(const artifact of intake.envelope.artifacts){const dest=path.join(files,artifact.relative_path);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,await readPlainFile(path.join(intake.directory,'files'),artifact.relative_path,task.returnPolicy.max_file_bytes),{flag:'wx'});}
  const merged=path.join(temporary,'merged-project');if(project){await fs.mkdir(merged);for(const i of project.inputs){const dest=path.join(merged,i.relative_path);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,await readPlainFile(project.root,i.relative_path,task.budgetPolicy.max_read_bytes),{flag:'wx'});}}
  const manifest=path.join(temporary,'checker-input.json');await fs.writeFile(manifest,canonicalJson({artifacts:intake.envelope.artifacts,files_dir:files,...(project?{merged_project_dir:merged,project_inputs:project.inputs}:{})}));
  const input=!project&&intake.envelope.artifacts.length===1?path.join(files,intake.envelope.artifacts[0].relative_path):manifest;
  processResult=await executeChecker(checker.command[0],[...checker.command.slice(1),input],temporary,checker.timeout_ms,checker.max_output_bytes);
  const raw=path.join(temporary,'checker-output.json'),stderr=path.join(temporary,'checker-stderr.txt');await fs.writeFile(raw,processResult.stdout);await fs.writeFile(stderr,processResult.stderr);
  requireIntake(!processResult.overflow && !processResult.timedOut,'VALIDATION_FAILED');
  for(const artifact of intake.envelope.artifacts){const bytes=await readPlainFile(files,artifact.relative_path,task.returnPolicy.max_file_bytes);requireIntake(bytes.length===artifact.bytes && digestBytes(bytes)===artifact.sha256,'SOURCE_CHANGED');}
  if(project)for(const i of project.inputs){for(const dir of [project.root,merged]){const bytes=await readPlainFile(dir,i.relative_path,task.budgetPolicy.max_read_bytes);requireIntake(bytes.length===i.bytes&&digestBytes(bytes)===i.sha256,'SOURCE_CHANGED');}}
  const afterTask=await localReturnTask(workspace,taskId);await verifyChecker(afterTask);requireIntake(same(checker,afterTask.frozenChecker)&&same(task.returnPolicy,afterTask.returnPolicy)&&same(before,await stageIdentity(workspace,taskId,intake,afterTask)),'SOURCE_CHANGED');
  let report;try{report=JSON.parse(processResult.stdout);}catch{intakeFailure('VALIDATION_FAILED');}
  requireIntake(report && report.pass===true && Array.isArray(report.checks)&&report.checks.length>0&&report.checks.every(c=>c&&typeof c.name==='string'&&c.name.trim()&&c.passed===true)&&processResult.exit_code===0,'VALIDATION_FAILED');
  if(intake.envelope.artifacts.length===1)requireIntake(report.artifact_sha256===intake.envelope.artifacts[0].sha256,'VALIDATION_FAILED');
  else requireIntake(same(report.artifact_hashes,before.artifact_hashes),'VALIDATION_FAILED');
  const requirement=[task.delegationContext?.independence_required,task.independenceRequired,task.independence_required];
  let independence_status=requirement.includes('required')?'REQUIRED_UNMET':requirement.includes('preferred')?'DEGRADED':'NOT_REQUIRED';
  const independentRefs=[];
  if(independence_status!=='NOT_REQUIRED'&&typeof opts.independenceVerifier==='function') {const proof=await opts.independenceVerifier(task,{checker_ref:before.checker_ref,return_digest:intake.envelope.return_digest,evaluated_snapshot:before.current_snapshot,exit_code:processResult.exit_code});if(proof?.verified===true&&Array.isArray(proof.evidence_refs)&&proof.evidence_refs.length>0&&proof.evidence_refs.every(r=>typeof r==='string'&&r)){independence_status='SATISFIED';independentRefs.push(...proof.evidence_refs);}}
  const validation=assertContract('ValidationResult',{schema:'yy/validation@1',handoff_id:intake.envelope.handoff_id,revision:intake.envelope.revision,status:'PASS',checker_id:checker.checker_id,checker_definition_digest:checker.definition_digest,evaluated_snapshot:before.current_snapshot,return_digest:intake.envelope.return_digest,exit_code:processResult.exit_code,checks:report.checks.map(c=>({name:c.name,passed:c.passed})),independence_status,unrun:[],methodology_application:'UNVERIFIED',artifact_hashes:before.artifact_hashes,evidence_refs:[raw,stderr,...independentRefs]});
  return respond(true,null,{validation,temporary,raw_output_sha256:digestBytes(processResult.stdout),raw_stderr_sha256:digestBytes(processResult.stderr),executed:false});
 } catch(error){return respond(false,error.code||'VALIDATION_FAILED',{temporary,exit_code:processResult?.exit_code??null,executed:false},temporary?{raw_output:path.join(temporary,'checker-output.json')}:{});}
}
