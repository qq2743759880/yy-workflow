/** Gates exact YY-visible UTF-8 delivery; no tokenizer guesses become hard token limits. */
import {createHash} from 'node:crypto';
import {estimateTokens} from './activation.mjs';
import {assertContract} from './delegation-contract.mjs';
const hash=text=>createHash('sha256').update(text,'utf8').digest('hex');
const size=text=>Buffer.byteLength(text,'utf8');
function blocked(code,reason,evidence={}) {
 const error=new Error(code+': '+reason);error.code=code;error.retryable=false;error.evidence=evidence;throw error;
}
function approved(policy,code) {
 try {assertContract('BudgetPolicy',policy);} catch {blocked(code,'approved byte policy is missing or invalid');}
 return policy;
}
export function assertInputBudget(text,policy,{tokenizer,breakdown=[]}={}) {
 approved(policy,'INPUT_BUDGET_BLOCKED');
 if(typeof text!=='string') blocked('INPUT_BUDGET_BLOCKED','final text must be rendered before the gate');
 const measurement={measurement_kind:'HEURISTIC',input_bytes:size(text),token_count:null,
  estimated_tokens:estimateTokens(text).tokens,observable_scope:policy.observable_scope,
  unobservable:['host_system_prompt','external_model_internal_loops','billed_cost']};
 if(tokenizer) {
  if(!policy.tokenizer_id||tokenizer.id!==policy.tokenizer_id||tokenizer.version!==policy.tokenizer_version||typeof tokenizer.count!=='function')
   blocked('INPUT_BUDGET_BLOCKED','tokenizer identity does not match approved policy');
  let count;try {count=tokenizer.count(text);} catch {blocked('INPUT_BUDGET_BLOCKED','tokenizer failed');}
  if(!Number.isSafeInteger(count)||count<0) blocked('INPUT_BUDGET_BLOCKED','tokenizer returned invalid count');
  measurement.token_count=count;measurement.estimated_tokens=null;measurement.measurement_kind='TOKENIZER';
 }
 assertContract('InputMeasurement',measurement);
 const evidence={measurement,breakdown,rendered_sha256:hash(text),policy_ref:{policy_id:policy.policy_id,policy_digest:policy.policy_digest}};
 if(measurement.input_bytes>policy.max_input_bytes) blocked('INPUT_BUDGET_BLOCKED','final UTF-8 input exceeds byte limit',evidence);
 if(policy.max_model_input_tokens!==null&&(measurement.token_count===null||measurement.token_count>policy.max_model_input_tokens))
  blocked('INPUT_BUDGET_BLOCKED','approved token limit cannot be satisfied',evidence);
 return evidence;
}
/** Bound the whole JSON sent to a parent; the full approved attachment remains outside context. */
export function summarizeReturn(text,policy,{artifact_ref,raw_sha256}={}) {
 approved(policy,'OUTPUT_BUDGET_BLOCKED');
 if(typeof text!=='string'||typeof artifact_ref!=='string'||!artifact_ref||hash(text)!==raw_sha256)
  blocked('OUTPUT_BUDGET_BLOCKED','full artifact reference and matching digest required');
 const original_bytes=size(text),record=(content,complete)=>({text:content,complete,artifact_ref,raw_sha256,original_bytes,shown_bytes:size(content)});
 const fits=value=>size(JSON.stringify(value))<=policy.max_output_bytes;
 const full=record(text,true);if(fits(full)) return full;
 if(!fits(record('',false))) blocked('OUTPUT_BUDGET_BLOCKED','mandatory return identity exceeds output limit');
 // ponytail: linear Unicode copy plus binary search; intake bounds attachment size separately.
 const chars=[...text];let low=0,high=chars.length;
 while(low<high) {const middle=Math.ceil((low+high)/2);if(fits(record(chars.slice(0,middle).join(''),false)))low=middle;else high=middle-1;}
 return record(chars.slice(0,low).join(''),false);
}
