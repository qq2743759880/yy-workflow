import path from 'node:path';
import { createStore, withLock } from './store.mjs';
import { assertContract, canonicalJson } from './delegation-contract.mjs';

const response = (ok, code, data=null) => ({ok,code,data,evidence:{},warnings:[]});
function fail(code, message=code) { const error=new Error(message);error.code=code;throw error; }
function requireThat(condition, code) { if (!condition) fail(code); }
const same = (a,b) => canonicalJson(a) === canonicalJson(b);
const identityFields = ['handoff_id','revision','package_digest','input_digest','contract_digest','methodology_digest'];
function initial() { return {schema:'yy/handoff-state@1',handoff_status:'PREVIEW',state_version:0,package:null,return_digest:null,validation:null,acceptance:null}; }
function acceptanceChecks(task, event) {
  const h=task.handoff, p=h.package, v=h.validation;
  requireThat(v?.status==='PASS' && v.exit_code===0 && v.checks.length>0 && v.checks.every(c=>c.passed) && v.unrun.length===0,'VALIDATION_FAILED');
  requireThat(h.return_digest===event.return_digest && v.return_digest===event.return_digest,'RETURN_CONFLICT');
  requireThat(v.handoff_id===p.handoff_id && v.revision===p.revision,'RETURN_STALE');
  requireThat(v.evaluated_snapshot===event.current_snapshot,'SOURCE_CHANGED');
  requireThat(same(p.checker_ref,event.checker_ref) && v.checker_id===p.checker_ref.checker_id && v.checker_definition_digest===p.checker_ref.definition_digest && p.permission_snapshot.approved_checker_ids.includes(v.checker_id),'CHECKER_NOT_APPROVED');
  const imported=(task.handoffReturns||[]).find(r=>r.return_digest===h.return_digest);
  requireThat(imported && same(imported.artifacts,v.artifact_hashes) && same(v.artifact_hashes,event.artifact_hashes),'SOURCE_CHANGED');
  if ([task.delegationContext?.independence_required,task.independenceRequired,task.independence_required].includes('required')) requireThat(v.independence_status==='SATISFIED','VALIDATION_FAILED');
}

/** Pure business reducer. PREPARED is internal preparation; published status waits for return. */
export function reduceHandoff(original, event) {
  requireThat(event && typeof event.type==='string','INPUT_INVALID');
  const task=structuredClone(original), h=task.handoff ||= initial();
  assertContract('HandoffState',h);
  let idempotent=false;
  switch(event.type) {
    case 'PREPARE': {
      const p=assertContract('HandoffPackage',event.package);
      requireThat(p.registered && p.task_id===task.id,'RETURN_IDENTITY_MISMATCH');
      const prior=(task.handoffRequests||[]).find(r=>r.request_id===p.request_id);
      if(prior) {requireThat(same(prior.package,p) && same(h.package,p),'RETURN_CONFLICT');idempotent=true;break;}
      requireThat(!h.package || ['REWORK_REQUIRED','SUPERSEDED'].includes(h.handoff_status),'RETURN_CONFLICT');
      if(h.package) requireThat(p.revision>h.package.revision,'RETURN_STALE');
      task.handoffRequests ||= [];task.handoffRequests.push({request_id:p.request_id,package:structuredClone(p)});
      if(h.acceptance) {task.handoffAccepted ||= [];task.handoffAccepted.push(structuredClone(h.acceptance));}
      Object.assign(h,{handoff_status:'AWAITING_RESULT',package:structuredClone(p),return_digest:null,validation:null,acceptance:null});
      break;
    }
    case 'IMPORT': {
      const envelope=assertContract('ReturnEnvelope',event.envelope);
      requireThat(h.package && identityFields.every(k=>envelope[k]===h.package[k]),'RETURN_IDENTITY_MISMATCH');
      const prior=(task.handoffReturns||[]).find(r=>r.return_digest===envelope.return_digest);
      if(prior) {requireThat(same(prior,envelope) && h.return_digest===envelope.return_digest,'RETURN_CONFLICT');idempotent=true;break;}
      requireThat(h.handoff_status==='AWAITING_RESULT','RETURN_CONFLICT');
      task.handoffReturns ||= [];task.handoffReturns.push(structuredClone(envelope));
      h.return_digest=envelope.return_digest;h.handoff_status='RESULT_RECEIVED';break;
    }
    case 'VALIDATE_BEGIN':
      requireThat(h.handoff_status==='RESULT_RECEIVED','ACCEPTANCE_STATE_CONFLICT');h.handoff_status='VALIDATING';break;
    case 'VALIDATE_RESULT': {
      requireThat(h.handoff_status==='VALIDATING','ACCEPTANCE_STATE_CONFLICT');
      const v=assertContract('ValidationResult',event.validation);
      requireThat(v.handoff_id===h.package.handoff_id && v.revision===h.package.revision && v.return_digest===h.return_digest,'RETURN_STALE');
      h.validation=structuredClone(v);h.handoff_status=v.status==='PASS'?'RESULT_RECEIVED':'REWORK_REQUIRED';break;
    }
    case 'ACCEPT':
      requireThat(h.package && ['RESULT_RECEIVED','ACCEPTED'].includes(h.handoff_status),'ACCEPTANCE_STATE_CONFLICT');
      acceptanceChecks(task,event);
      if(h.acceptance?.accepted) {requireThat(h.acceptance.accepted_return_digest===event.return_digest,'RETURN_CONFLICT');idempotent=true;break;}
      h.acceptance={accepted:true,accepted_return_digest:event.return_digest,expected_state_version:h.state_version,next_state_version:h.state_version+1,evaluated_snapshot:event.current_snapshot,decision_reason:'LOCAL_VALIDATION_AND_CAS'};
      h.handoff_status='ACCEPTED';break;
    case 'RESUME': idempotent=true;break;
    case 'REWORK': requireThat(h.package && h.handoff_status!=='ACCEPTED','ACCEPTANCE_STATE_CONFLICT');h.handoff_status='REWORK_REQUIRED';break;
    case 'SUPERSEDE': requireThat(h.package,'ACCEPTANCE_STATE_CONFLICT');h.handoff_status='SUPERSEDED';break;
    default: fail('INPUT_INVALID');
  }
  if(!idempotent) {
    requireThat(Number.isSafeInteger(h.state_version+1),'ACCEPTANCE_STATE_CONFLICT');h.state_version++;
    // Manual acceptance is local completion, never host execution evidence or Receipt v2.
    task.status=h.handoff_status==='ACCEPTED'?'done':'awaiting-host';task.executed=false;
  }
  assertContract('HandoffState',h);
  return {task,handoff:h,idempotent};
}

function findTask(plan,taskId) { return plan?.subtasks?.find(t=>t.id===taskId); }
export async function readHandoff(workspace,taskId) {
  try {
    const plan=await createStore(workspace).load(),task=findTask(plan,taskId);
    if(!task)return response(false,'INPUT_INVALID');
    if(task.handoff)assertContract('HandoffState',task.handoff);
    return response(true,null,{task,handoff:task.handoff||null,plan_status:plan.status,idempotent:false});
  } catch(error) {return response(false,error.code||'INPUT_INVALID');}
}

/** Short state transaction. Checker runs outside this API; final local identity re-read runs inside. */
export async function transactionHandoff(workspace,taskId,expectedStateVersion,event,opts={}) {
  try {
    requireThat(Number.isSafeInteger(expectedStateVersion) && expectedStateVersion>=0,'INPUT_INVALID');
    return await withLock(path.join(workspace,'.tt-state','state.json'),async()=>{
      const store=createStore(workspace),plan=await store.load(),task=findTask(plan,taskId);
      requireThat(task,'INPUT_INVALID');
      if(event?.type==='PREPARE') requireThat(event.package?.plan_id===plan.id,'RETURN_IDENTITY_MISMATCH');
      if(event?.type==='ACCEPT') {
        requireThat(typeof opts.readCurrentIdentity==='function','SOURCE_CHANGED');
        const current=await opts.readCurrentIdentity(workspace,structuredClone(task),structuredClone(task.handoff?.validation));
        requireThat(current && same(current,{current_snapshot:event.current_snapshot,artifact_hashes:event.artifact_hashes,checker_ref:event.checker_ref}),'SOURCE_CHANGED');
      }
      let reduced;
      try { reduced=reduceHandoff(task,event); }
      catch(error) { if((task.handoff?.state_version||0)!==expectedStateVersion)fail('ACCEPTANCE_STATE_CONFLICT');throw error; }
      // Retries may echo an old version only for an identical already committed operation.
      requireThat(reduced.idempotent || (task.handoff?.state_version||0)===expectedStateVersion,'ACCEPTANCE_STATE_CONFLICT');
      if(!reduced.idempotent) {
        Object.assign(task,reduced.task);
        plan.status=plan.subtasks.every(t=>t.status==='done')?'done':'awaiting-host';
        await store.save(plan);
      }
      return response(true,null,{task:reduced.task,handoff:reduced.handoff,plan_status:plan.status,idempotent:reduced.idempotent});
    },opts.lockOptions);
  } catch(error) {return response(false,error.code||'INPUT_INVALID');}
}
