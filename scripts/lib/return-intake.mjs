import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createStore,withLock} from './store.mjs';
import {assertContract,canonicalJson} from './delegation-contract.mjs';
export const digestBytes=bytes=>createHash('sha256').update(bytes).digest('hex');
const respond=(ok,code,data=null)=>({ok,code,data,evidence:{},warnings:[]});
export function intakeFailure(code) {throw Object.assign(new Error(code),{code});}
export const requireIntake=(value,code)=>{if(!value)intakeFailure(code);};
export function returnEnvelopeDigest(envelope) {const {return_digest,...core}=envelope;return digestBytes(canonicalJson(core));}
const same=(a,b)=>canonicalJson(a)===canonicalJson(b);
const identityKeys=['handoff_id','revision','package_digest','input_digest','contract_digest','methodology_digest'];
const positive=v=>Number.isSafeInteger(v)&&v>0;
const safeRelative=p=>typeof p==='string' && p.length>0 && !/[\\:\0\r\n]/.test(p) && !path.isAbsolute(p) && !p.split('/').some(part=>!part||part==='.'||part==='..');
export async function localReturnTask(workspace,taskId) {
 const plan=await createStore(workspace).load(),task=plan?.subtasks?.find(t=>t.id===taskId);
 requireIntake(task?.handoff?.package,'RETURN_IDENTITY_MISMATCH');assertContract('HandoffState',task.handoff);requireIntake(task.handoff.package.registered && task.handoff.package.task_id===task.id && task.handoff.package.plan_id===plan.id,'RETURN_IDENTITY_MISMATCH');return task;
}
/** Every component below the declared root must be ordinary, never a link/junction. */
export async function readPlainFile(root,relative,maxBytes) {
 requireIntake(safeRelative(relative),'SOURCE_NOT_AUTHORIZED');
 const base=path.resolve(root),realBase=await fs.realpath(base);requireIntake(realBase===base && !(await fs.lstat(base)).isSymbolicLink(),'SOURCE_NOT_AUTHORIZED');
 let current=base;const parts=relative.split('/');
 for(let i=0;i<parts.length;i++){current=path.join(current,parts[i]);const st=await fs.lstat(current);requireIntake(!st.isSymbolicLink() && (i===parts.length-1?st.isFile():st.isDirectory()),'SOURCE_NOT_AUTHORIZED');if(i===parts.length-1)requireIntake(st.size<=maxBytes,'INPUT_BUDGET_BLOCKED');}
 const before=await fs.lstat(current),handle=await fs.open(current,'r');let bytes;
 try {const st=await handle.stat();requireIntake(st.isFile() && st.size<=maxBytes && st.dev===before.dev && st.ino===before.ino,'SOURCE_CHANGED');const chunks=[];let total=0;for(;;){const buffer=Buffer.alloc(Math.min(65536,maxBytes+1-total)),read=await handle.read(buffer,0,buffer.length,null);if(!read.bytesRead)break;total+=read.bytesRead;requireIntake(total<=maxBytes,'INPUT_BUDGET_BLOCKED');chunks.push(buffer.subarray(0,read.bytesRead));}bytes=Buffer.concat(chunks,total);}
 finally{await handle.close();}
 const final=await fs.lstat(current);requireIntake((await fs.realpath(current))===current && final.isFile() && !final.isSymbolicLink() && final.dev===before.dev && final.ino===before.ino && final.size===bytes.length && final.mtimeMs===before.mtimeMs,'SOURCE_CHANGED');return bytes;
}
export function checkReturnPolicy(task,envelope) {
 const p=task.returnPolicy;requireIntake(p && Array.isArray(p.allowed_files) && p.allowed_files.every(safeRelative) && positive(p.max_file_bytes) && positive(p.max_total_bytes) && positive(p.max_artifacts),'SOURCE_NOT_AUTHORIZED');
 requireIntake(envelope.artifacts.length>0 && envelope.artifacts.length<=p.max_artifacts,'INPUT_BUDGET_BLOCKED');
 requireIntake(Buffer.byteLength(canonicalJson(envelope))+envelope.artifacts.reduce((total,a)=>total+a.bytes,0)<=p.max_total_bytes,'INPUT_BUDGET_BLOCKED');
 const names=new Set(),ids=new Set();for(const artifact of envelope.artifacts){const name=artifact.relative_path.toLowerCase();requireIntake(p.allowed_files.includes(artifact.relative_path) && !names.has(name) && !ids.has(artifact.logical_id) && !/\.(?:zip|tar|tgz|gz|7z|rar)$/i.test(artifact.relative_path),'SOURCE_NOT_AUTHORIZED');requireIntake(artifact.bytes<=p.max_file_bytes,'INPUT_BUDGET_BLOCKED');names.add(name);ids.add(artifact.logical_id);}return p;
}
export function stagingKey(taskId,envelope) {return digestBytes(canonicalJson({task_id:taskId,handoff_id:envelope.handoff_id,revision:envelope.revision,return_digest:envelope.return_digest}));}
export async function stagingDirectory(workspace,taskId,envelope) {
 const root=path.resolve(workspace),real=await fs.realpath(root);requireIntake(root===real,'SOURCE_NOT_AUTHORIZED');
 for(const segment of ['.tt-state','.tt-state/handoff-returns']){const target=path.join(root,segment);const st=await fs.lstat(target).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(st)requireIntake(st.isDirectory()&&!st.isSymbolicLink()&&(await fs.realpath(target))===target,'SOURCE_NOT_AUTHORIZED');}
 return path.join(root,'.tt-state','handoff-returns',stagingKey(taskId,envelope));
}
async function verifyExistingStaging(directory,envelope,policy) {
 const existing=await fs.lstat(directory).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(!existing)return false;
 requireIntake(existing.isDirectory()&&!existing.isSymbolicLink(),'SOURCE_NOT_AUTHORIZED');
 const saved=JSON.parse((await readPlainFile(directory,'envelope.json',policy.max_total_bytes)).toString('utf8'));requireIntake(same(saved,envelope),'RETURN_CONFLICT');
 for(const artifact of envelope.artifacts){const bytes=await readPlainFile(path.join(directory,'files'),artifact.relative_path,policy.max_file_bytes);requireIntake(bytes.length===artifact.bytes && digestBytes(bytes)===artifact.sha256,'SOURCE_CHANGED');}
 return true;
}
/** Intake writes byte evidence only; no task transition, acceptance, receipt or model execution. */
export async function intakeReturn(workspace,taskId,envelope,{sourceRoot}={}) {
 try {
  if(envelope && !envelope.schema && Object.keys(envelope).length===3 && Object.hasOwn(envelope,'taskId') && Object.hasOwn(envelope,'taskVerdict') && Object.hasOwn(envelope,'evidencePaths')) {
   requireIntake(envelope.taskId===taskId && typeof envelope.taskVerdict==='string' && Array.isArray(envelope.evidencePaths),'INPUT_INVALID');
   return respond(true,null,{status:'LEGACY_REPORT_PARSED',report:structuredClone(envelope),executed:false});
  }
  assertContract('ReturnEnvelope',envelope);requireIntake(returnEnvelopeDigest(envelope)===envelope.return_digest,'RETURN_IDENTITY_MISMATCH');
  const task=await localReturnTask(workspace,taskId),current=task.handoff.package;
  const approved=[current,...(task.handoffRequests||[]).map(r=>r.package)].find(p=>identityKeys.every(k=>p[k]===envelope[k]));
  requireIntake(approved,'RETURN_IDENTITY_MISMATCH');const policy=checkReturnPolicy(task,envelope);
  const directory=await stagingDirectory(workspace,taskId,envelope),parent=path.dirname(directory);
  let idempotent=await verifyExistingStaging(directory,envelope,policy);
  if(!idempotent) {
   const buffers=[];let total=Buffer.byteLength(canonicalJson(envelope));
   for(const artifact of envelope.artifacts){const bytes=await readPlainFile(sourceRoot,artifact.relative_path,policy.max_file_bytes);requireIntake(bytes.length===artifact.bytes && digestBytes(bytes)===artifact.sha256,'SOURCE_CHANGED');total+=bytes.length;requireIntake(total<=policy.max_total_bytes,'INPUT_BUDGET_BLOCKED');buffers.push(bytes);}
   idempotent=await withLock(path.join(parent,'intake'),async()=>{
   if(await verifyExistingStaging(directory,envelope,policy))return true;
   const temporary=path.join(parent,'preparation-'+randomUUID());await fs.mkdir(temporary);try {
    for(let i=0;i<envelope.artifacts.length;i++){const file=path.join(temporary,'files',envelope.artifacts[i].relative_path);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,buffers[i],{flag:'wx'});}
    await fs.writeFile(path.join(temporary,'envelope.json'),canonicalJson(envelope),{flag:'wx'});await fs.rename(temporary,directory);
   } catch(error){await fs.rm(temporary,{recursive:true,force:true});throw error;}return false;
   });
  }
  const latest=await localReturnTask(workspace,taskId),latestPackage=latest.handoff.package;
  checkReturnPolicy(latest,envelope);
  const stale=latestPackage.revision!==envelope.revision || latestPackage.handoff_id!==envelope.handoff_id || !identityKeys.every(k=>latestPackage[k]===envelope[k]);
  const conflict=!stale && latest.handoff.return_digest!==null && latest.handoff.return_digest!==envelope.return_digest;
  return respond(!stale&&!conflict,stale?'RETURN_STALE':conflict?'RETURN_CONFLICT':null,{status:stale?'QUARANTINED_STALE':conflict?'QUARANTINED_CONFLICT':'STAGED',task_id:taskId,directory,envelope:structuredClone(envelope),idempotent,executed:false});
 } catch(error){return respond(false,error.code||'INPUT_INVALID');}
}
