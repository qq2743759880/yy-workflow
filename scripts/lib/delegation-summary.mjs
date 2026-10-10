/** Pure projection from the existing trusted task, never a state transition or success inference. */
import {assertContract} from './delegation-contract.mjs';
const descriptions={
 PREVIEW:['这是预览，尚未登记人工任务；本地没有执行。','PREPARE_LOCALLY'],
 AWAITING_RESULT:['人工交接已准备，等待接手者返回成果；本地没有自动执行。','FORWARD_MANUALLY'],
 RESULT_RECEIVED:['已收到成果，尚待本地验收；返回者自述不代表通过。','WAIT_VALIDATION'],
 VALIDATING:['本地验收正在进行，尚未接受原任务。','WAIT_VALIDATION'],
 ACCEPTED:['本地验收通过，原任务已接受；未认证远端过程或方法遵循。','NONE'],
 REWORK_REQUIRED:['本地验收未通过，需要修正成果后重新提交。','FIX_RESULT'],
 SUPERSEDED:['这份交接已被新版本替代，旧返回不能推进当前任务。','PREPARE_LOCALLY'],
 BLOCKED:['当前交接被阻断，请核对原因后在本地处理。','REVIEW_CONFLICT'],
};
export function projectDelegation(task,{observedAt,identityRef,stale=false}={}) {
 if(!task.handoff&&!task.handoffPreview)return null;
 const mode=assertContract('ModeContext',task.delegationContext);
 const state=task.handoff?assertContract('HandoffState',task.handoff):null;
 const status=state?.handoff_status||'PREVIEW';
 if((mode.delegation_mode==='MANUAL_HANDOFF'&&(task.executed===true||task.executionMode&&task.executionMode!=='BRIEF_ONLY'))||status==='PREVIEW'&&task.executed===true)
  throw Object.assign(new Error('PROJECTION_STATE_INVALID: execution contradicts handoff state'),{code:'INPUT_INVALID'});
 const validation=state?.validation;
 if(status==='ACCEPTED'&&(state?.acceptance?.accepted!==true||validation?.status!=='PASS'||state?.package?.registered!==true))
  throw Object.assign(new Error('PROJECTION_STATE_INVALID: accepted evidence missing'),{code:'INPUT_INVALID'});
 const measurement=task.inputBudget?.measurement;
 if(!measurement||!Number.isSafeInteger(measurement.input_bytes)||measurement.input_bytes<0)
  throw Object.assign(new Error('PROJECTION_STATE_INVALID: measured input unavailable'),{code:'INPUT_INVALID'});
 const preview=task.handoffPreview;
 if(task.usageObservation)assertContract('UsageObservation',task.usageObservation);
 const [owner_summary,next_action]=descriptions[status];
 const view={schema:'yy/task-view-delegation@1',task_id:task.id,revision:state?.package?.revision||1,
  state_version:state?.state_version||0,delegation_mode:mode.delegation_mode,
  execution_mode:task.executionMode??mode.execution_mode,executed:task.executed===true,
  handoff_status:status,validation_status:status==='VALIDATING'?'RUNNING':validation?.status||'NOT_RUN',
  independence_status:validation?.independence_status||'UNKNOWN',input_bytes:measurement?.input_bytes??0,
  token_count:measurement?.token_count??null,usage_status:task.usageObservation?.status||'UNKNOWN',
  owner_summary,next_action,reason_codes:[...mode.reason_codes],preview_text:preview?.text??null,
  preview_digest:preview?.digest??null,registered:state?.package?.registered===true,
  observed_at:observedAt,identity_ref:identityRef,stale};
 assertContract('TaskView',view);return view;
}
/** Each stored task appears once; role reports, retry events and Promise concurrency are not children. */
export function projectDelegationViews(plan,options={}) {
 return (plan?.subtasks||[]).map(task=>projectDelegation(task,options)).filter(view=>view!==null);
}
