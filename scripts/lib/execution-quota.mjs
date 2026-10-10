/** One plan ledger in the existing store. Reservations never refund an uncertain physical call. */
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createStore,withLock} from './store.mjs';
import {assertContract,canonicalJson} from './delegation-contract.mjs';
const same=(a,b)=>canonicalJson(a)===canonicalJson(b);
function reject(code,reason){throw Object.assign(new Error(code+': '+reason),{code,retryable:false});}
function policyIdentity(policy){const {policy_digest,...core}=policy;return createHash('sha256').update(canonicalJson(core)).digest('hex');}
async function transaction(workspace,planId,fn,options) {
 return withLock(path.join(workspace,'.tt-state','state.json'),async()=>{
  const store=createStore(workspace),plan=await store.load();
  if(!plan||plan.id!==planId)reject('INPUT_INVALID','trusted local plan not found');
  const result=fn(plan);if(!result.idempotent)await store.save(plan);return result;
 },options?.lockOptions);
}
export async function reserveCallAttempt(workspace,planId,policy,reservation,{depth=1,lockOptions}={}) {
 assertContract('BudgetPolicy',policy);assertContract('QuotaReservation',reservation);
 if(reservation.reservation_state!=='RESERVED'||policyIdentity(policy)!==policy.policy_digest)reject('INPUT_INVALID','invalid policy identity or initial reservation');
 return transaction(workspace,planId,plan=>{
  if(!plan.budgetPolicy||!same(plan.budgetPolicy,policy)||!plan.subtasks.some(t=>t.id===reservation.task_id))reject('INPUT_INVALID','budget or task differs from approved local plan');
  const ledger=plan.executionQuota ||= {policy_digest:policy.policy_digest,attempts:[]};
  if(ledger.policy_digest!==policy.policy_digest)reject('INPUT_INVALID','quota policy changed');
  const existing=ledger.attempts.find(a=>a.call_attempt_id===reservation.call_attempt_id);
  if(existing){if(existing.request_id!==reservation.request_id||existing.task_id!==reservation.task_id)reject('INPUT_INVALID','attempt identity collision');return {reservation:structuredClone(existing),idempotent:true};}
  if(ledger.attempts.some(a=>a.request_id===reservation.request_id))reject('INPUT_INVALID','request already belongs to another call attempt');
  const taskCount=ledger.attempts.filter(a=>a.task_id===reservation.task_id).length;
  const occupied=ledger.attempts.filter(a=>a.reservation_state!=='SETTLED').length;
  if(!Number.isSafeInteger(depth)||depth<1||depth>policy.max_depth||ledger.attempts.length>=policy.max_call_attempts||taskCount>=1+policy.max_retry_per_task||occupied>=policy.max_concurrent)
   reject('QUOTA_EXHAUSTED','plan attempts, task retries, concurrency or depth exhausted');
  const saved=structuredClone(reservation);ledger.attempts.push(saved);return {reservation:saved,idempotent:false};
 },{lockOptions});
}
export async function transitionCallAttempt(workspace,planId,attemptId,nextState,options={}) {
 return transaction(workspace,planId,plan=>{
  const reservation=plan.executionQuota?.attempts.find(a=>a.call_attempt_id===attemptId);
  if(!reservation)reject('INPUT_INVALID','call attempt not found');
  if(reservation.reservation_state===nextState)return {reservation:structuredClone(reservation),idempotent:true};
  const allowed={RESERVED:['STARTED','UNCERTAIN'],STARTED:['SETTLED','UNCERTAIN'],SETTLED:[],UNCERTAIN:[]};
  if(!allowed[reservation.reservation_state]?.includes(nextState))reject('INPUT_INVALID','call transition cannot refund or restart');
  reservation.reservation_state=nextState;assertContract('QuotaReservation',reservation);return {reservation:structuredClone(reservation),idempotent:false};
 },options);
}
