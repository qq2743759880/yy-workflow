/** C4 host plumbing. Intent data selects calls; only Decision Core decides. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { stageDecision, taskDecision, validateConsumption, executionPhaseAllows } from './decision-core.mjs';

export const HOST_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const INTENT_MAP_REL = 'contracts/generated/decision-intent-map.json';
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const error = (code, reason) => ({ok:false,code,data:{reason},evidence:{},warnings:[]});
function researchMetadata(root) {
  const text=fs.readFileSync(path.join(root,'commands/yy-research.md'),'utf8');
  const frontmatter=(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)||[])[1]??'';
  const step=Number((/^journey-step:\s*(\S+)/m.exec(frontmatter)||[])[1]);
  if(!Number.isFinite(step)) throw new Error('Research command journey-step missing');
  const description=(/^description:\s*(.*)/m.exec(frontmatter)||[])[1]??'';
  return {step,phrases:[...description.matchAll(/「([^」]+)」/g)].map(match=>match[1].toLowerCase())};
}

export function resolveHostIntent(text, {root=HOST_ROOT}={}) {
  const bytes=fs.readFileSync(path.join(root,INTENT_MAP_REL));
  const map=JSON.parse(bytes.toString('utf8'));
  if(map.schema!=='yy/decision-intent-map@1') throw new Error('Invalid frozen intent map');
  const normalized=String(text??'').trim().toLowerCase();
  const slash=/^\/yy\s+(research|\d+)(?:\s|$)/.exec(normalized);
  let step=null, queryOnly=false, source='frozen-trigger', warning=null;
  if(slash) {
    const command='/yy '+slash[1];
    if(Object.hasOwn(map.command_to_step,command)) {step=map.command_to_step[command];source='command_to_step';}
    else if(command==='/yy research') {
      // C4.1 map is frozen and predates this existing command. Read its metadata;
      // research admission is still decided by Core, never by this adapter.
      step=researchMetadata(root).step;
      source='research-command-frontmatter';
    } else {queryOnly=true;source='unmatched-current';warning='Use a frozen /yy command; no execution authorized.';}
  } else {
    const hits=map.triggers.filter(t=>t.phrases.some(p=>normalized.includes(p.toLowerCase())));
    const targets=[...new Set(hits.map(t=>JSON.stringify([t.step,t.mode??null])))];
    if(targets.length>1) return error('HOST_INTENT_AMBIGUOUS','Multiple frozen stage triggers; use /yy N.');
    if(hits.length) {step=hits[0].step;queryOnly=step===null;}
    else {
      const research=researchMetadata(root);
      if(research.phrases.some(phrase=>normalized.includes(phrase))) {step=research.step;source='research-command-frontmatter';}
      else {queryOnly=true;source='unmatched-current';warning='No frozen trigger; present current stage only, use /yy N.';}
    }
  }
  return {ok:true,step,query_only:queryOnly,source,warning,map_sha256:hash(bytes),
    follow_up:queryOnly?null:(map.stage_entry_defaults[String(step)]?.follow_up??null)};
}

export function createCoreTransport({workspace,session,workflowId,now,repoRoot}={}) {
  return (operation,input)=>({stage:stageDecision,task:taskDecision,validate:validateConsumption}[operation])({
    ...input,workspace,session,workflowId,now:now?new Date(now):undefined,repoRoot});
}

export function createV2Transport({workflowId,callTool}={}) {
  if(!workflowId||typeof callTool!=='function') throw new Error('V2 requires workflowId and host callTool');
  const names={stage:'yy_stage_decision',task:'yy_task_decision',validate:'yy_validate_consumption'};
  const fields={taskText:'task_text',subtaskId:'subtask_id',activationLevel:'activation_level',requestedResources:'requested_resources',artifactRef:'artifact_ref',evidenceRef:'evidence_ref'};
  return async (op,input)=>{
    if(['workspace','session','workflow_id','workflowId'].some(key=>Object.hasOwn(input,key)))
      throw new Error('Host operation cannot override the trusted V2 workflow binding');
    const args={workflow_id:workflowId};
    for(const [key,value] of Object.entries(input)) if(value!==undefined) args[fields[key]??key]=value;
    const result=await callTool(names[op],args);
    const text=result?.content?.find(c=>c.type==='text')?.text;
    const packet=result?.ok!==undefined?result:result?.structuredContent?.ok!==undefined?result.structuredContent:text?JSON.parse(text):null;
    if(!packet) throw new Error('Host MCP caller did not return a Decision envelope');
    // Existing V2 resolves the logical id to trusted workspace/session, and
    // Core returns workflow_id=null. Preserve that frozen projection. If a
    // host supplies an echoed id, it must correlate with this bound request.
    if(packet.ok&&packet.data?.workflow?.workflow_id!=null&&packet.data.workflow.workflow_id!==workflowId)
      throw new Error('V2 Decision Packet belongs to a different workflow');
    return packet;
  };
}

function usable(packet) {
  return packet?.ok===true && packet.data?.schema==='yy/decision@1' && packet.data.authority?.identity_verified===true;
}

/** present must complete before a positive host permission is returned. */
export async function prepareHostDecision(input, {transport,present,root=HOST_ROOT}={}) {
  if(typeof transport!=='function'||typeof present!=='function') return error('HOST_INTEGRATION_BYPASS','A Decision caller and actual packet presenter are required.');
  input=clone(input);
  const intent=resolveHostIntent(input.intent,{root});
  if(!intent.ok) return intent;
  // Core has no stage/current operation. stage(0) exposes current_step unchanged;
  // this informational projection never supplies an execution permission.
  const requestedStep=intent.query_only?0:intent.step;
  const stage=await transport('stage',{step:requestedStep});
  // Presentation cannot mutate the authority result used for admission.
  await present(clone(stage));
  const decisions=[stage];
  if(!usable(stage)) return {ok:false,code:stage.code??'AUTHORITY_REVISION_MISMATCH',data:{intent,decisions,execution_permitted:false},evidence:{},warnings:stage.warnings??[]};
  if(stage.data.stage?.requested_step!==requestedStep) return error('HOST_DECISION_NOT_READY','Stage packet does not correlate with the requested intent.');
  if(intent.query_only) return {ok:true,code:null,data:{intent,decisions,execution_permitted:false,presented:true},evidence:{},warnings:intent.warning?[intent.warning]:[]};
  if(stage.data.stage?.allowed!==true||!executionPhaseAllows(stage.data.stage)) return {ok:false,code:'PHASE_PREREQ_UNMET',data:{intent,decisions,execution_permitted:false,presented:true},evidence:{},warnings:stage.warnings};
  let task=null;
  if(intent.follow_up) {
    if(typeof input.taskText!=='string'||!input.taskText.trim()) return {ok:false,code:'HOST_TASK_INPUT_REQUIRED',data:{intent,decisions,execution_permitted:false},evidence:{},warnings:['Supply bounded task text; no placeholder task is invented.']};
    task=await transport('task',{taskText:input.taskText,step:intent.step,mode:intent.follow_up.mode,
      capability:intent.follow_up.capability_hint??input.capability,subtaskId:input.subtaskId,
      activationLevel:input.activationLevel,requestedResources:input.requestedResources,budget:input.budget});
    await present(clone(task));decisions.push(task);
    const a=stage.data.authority.decision_authority_digest;
    if(!usable(task)||task.data.authority.decision_authority_digest!==a||!task.data.brief||!task.data.assets?.length||
       task.data.workflow?.workflow_id!==stage.data.workflow?.workflow_id||
       (input.subtaskId!==undefined&&task.data.receipt_context?.subtask_id!==input.subtaskId))
      return {ok:false,code:task.code??'HOST_DECISION_NOT_READY',data:{intent,decisions,execution_permitted:false,presented:true},evidence:{},warnings:task.warnings??[]};
  }
  return {ok:true,code:null,data:{intent,decisions,execution_permitted:true,presented:true},evidence:{},warnings:[]};
}

function stableDecisions(decisions) {
  // Retain every semantic field and evidence ref. Transport-only additive fields
  // and observation clocks cannot change Core/V2 admission or ownership.
  return decisions.map(envelope=>{
    const copy=clone(envelope);
    delete copy.data?.evidence?.observed_at;delete copy.data?.evidence?.freshness;
    for(const asset of copy.data?.assets??[]) delete asset.token_estimate?.estimatedAt;
    return copy.data;
  });
}

export async function verifyHostDecision(record,input,options) {
  if(record?.schema!=='yy/host-decision@1'||record.presented!==true||!record.decision?.data?.execution_permitted)
    return error('HOST_INTEGRATION_BYPASS','No presented, permitted Decision Packet; direct /yy execution is invalid.');
  if(JSON.stringify(record.input)!==JSON.stringify(input)) return error('HOST_INTEGRATION_BYPASS','Host input differs from the presented Decision request.');
  const fresh=await prepareHostDecision(input,{...options,present:async()=>{}});
  if(!fresh.ok||!fresh.data.execution_permitted) return error('HOST_DECISION_STALE','Current Decision no longer permits this host operation.');
  if(record.decision.data.intent.map_sha256!==fresh.data.intent.map_sha256||
      JSON.stringify(stableDecisions(record.decision.data.decisions))!==JSON.stringify(stableDecisions(fresh.data.decisions)))
    return error('HOST_DECISION_STALE','Decision semantics, journey, asset or evidence identity changed.');
  return fresh;
}

export function hostRecord(input,decision) {
  if(!decision.ok||!decision.data.execution_permitted||decision.data.presented!==true) throw new Error('Host permission was not presented');
  return {schema:'yy/host-decision@1',presented:true,input:clone(input),decision:clone(decision),
    receipt_mode:'LEGACY_V1_ONLY',c5_v2_complete:false};
}

export function safeHostFile(workspace,subtaskId) {
  if(typeof subtaskId!=='string'||!/^[a-z0-9][a-z0-9_.-]*$/i.test(subtaskId)||subtaskId.includes('..')) throw new Error('Unsafe subtask id');
  const base=fs.realpathSync(workspace),file=path.join(base,'artifacts',subtaskId,'host-decision.json');
  // existsSync follows links and therefore misses dangling links. Inspect each
  // control-path component itself before any opt-in host write.
  for(const component of [path.join(base,'artifacts'),path.dirname(file),file]) {
    try {if(fs.lstatSync(component).isSymbolicLink()) throw new Error('Host decision control path is redirected');}
    catch(error) {if(error.code!=='ENOENT') throw error;}
  }
  let existing=path.dirname(file);
  while(!fs.existsSync(existing)) existing=path.dirname(existing);
  const real=fs.realpathSync(existing);
  if(real!==base&&!real.startsWith(base+path.sep)) throw new Error('Host decision path escapes workspace');
  if(fs.existsSync(file)&&fs.realpathSync(file)!==file) throw new Error('Host decision file is redirected');
  return file;
}
