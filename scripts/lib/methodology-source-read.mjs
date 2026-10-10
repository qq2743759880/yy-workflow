/** C04 thin read boundary. T06 owns dependency resolution, conditions and pinned bytes. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {resolveMethodology,readMethodologySource} from './methodology.mjs';
import {assertContract,canonicalJson} from './delegation-contract.mjs';
import {executionPhaseAllows} from './decision-core.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const required=(test,code)=>{if(!test)fail(code);};
export function verifySourceTransport(trusted) {
 required(trusted && Object.keys(trusted).sort().join(',')==='binding_digest,cursor_key,max_page_bytes,workflow_id' && /^[A-Za-z0-9_-]{1,80}$/.test(trusted.workflow_id) && /^[a-f0-9]{64}$/.test(trusted.binding_digest) && /^[a-f0-9]{64}$/.test(trusted.cursor_key) && Number.isSafeInteger(trusted.max_page_bytes)&&trusted.max_page_bytes>0&&trusted.max_page_bytes<=4096,'INPUT_INVALID');
}
function localContext(input,asset) {
 const file=path.join(input.workspace,'.tt-state',input.session||'','state.json');let raw=null,task=null;
 try {raw=fs.readFileSync(file);const plan=JSON.parse(raw.toString('utf8'));task=plan.subtasks?.find(t=>t.id===input.subtaskId && t.asset===asset && [t.task,t.desc,t.parentTask,plan.task].includes(input.taskText));}
 catch(error){if(error.code!=='ENOENT')fail('INPUT_INVALID');}
 // Only an exact currently registered local task may contribute condition facts.
 return {state_digest:raw?sha(raw):null,methodology:task?.methodologyContext||{}};
}
function signCursor(payload,key) {const body=Buffer.from(canonicalJson(payload)).toString('base64url');return body+'.'+createHmac('sha256',Buffer.from(key,'hex')).update(body).digest('base64url');}
function readCursor(cursor,key,identity,bytes) {
 required(typeof cursor==='string'&&cursor.length<=4096,'INPUT_INVALID');const parts=cursor.split('.');required(parts.length===2&&parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p)),'INPUT_INVALID');
 const expected=createHmac('sha256',Buffer.from(key,'hex')).update(parts[0]).digest(),actual=Buffer.from(parts[1],'base64url');required(actual.length===expected.length&&timingSafeEqual(actual,expected),'INPUT_INVALID');
 let payload;try{payload=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));}catch{fail('INPUT_INVALID');}
 required(payload&&Object.keys(payload).sort().join(',')==='identity,offset'&&payload.identity===identity&&Number.isSafeInteger(payload.offset)&&payload.offset>=0&&payload.offset<=bytes.length,'SOURCE_CHANGED');
 required(payload.offset===bytes.length||(bytes[payload.offset]&0xc0)!==0x80,'INPUT_INVALID');return payload.offset;
}

/** Adds admitted catalog or one raw UTF-8 page to the existing Decision packet. Never writes. */
export async function attachMethodologySource(result,input,params,trusted,stage) {
 verifySourceTransport(trusted);
 const request=params.source_read;
 if(request)assertContract('SourceReadRequest',request);
 required(stage?.ok===true&&stage.data.stage?.allowed===true&&executionPhaseAllows(stage.data.stage),'FILE_NOT_VISIBLE');
 required(result?.ok===true&&result.data.routing?.primary_assets?.length===1&&result.data.assets?.[0]?.id===result.data.routing.primary_assets[0],'FILE_NOT_VISIBLE');
 const asset=result.data.routing.primary_assets[0],local=localContext(input,asset);
 const context={decision_admission:{stage:true,task:true,asset},owner_intent:{explicit_asset_task:result.data.routing.capability_source==='explicit'&&result.data.routing.capability_owner===asset},methodology:local.methodology,execution_context_id:'web:'+trusted.binding_digest,delivery_access:'MCP_SOURCE'};
 const resolved=await resolveMethodology(asset,context,{repoRoot:input.repoRoot}),plan=resolved.delivery_plan;
 const snapshot_ref='snapshot-'+sha(canonicalJson({binding:trusted.binding_digest,workflow:trusted.workflow_id,task_text:input.taskText,capability:input.capability??null,step:String(input.step),subtask_id:input.subtaskId??null,asset,authority:result.data.authority.decision_authority_digest,journey:stage.data.workflow.journey_state_digest,state:local.state_digest,bindings:plan.bindings_digest,delivery:plan.delivery_digest}));
 const catalog={asset_id:asset,bindings_digest:plan.bindings_digest,snapshot_ref,sources:plan.sources,source_aliases:resolved.sources.map(s=>({source_id:s.source_id,package_relative_path:s.path,raw_sha256:s.sha256})),available_source_ids:plan.available_source_ids,observable_scope:'WEB_REQUEST',max_page_bytes:trusted.max_page_bytes};
 if(!request){result.data.source_catalog=catalog;return result;}
 required(request.workflow_id===trusted.workflow_id&&request.asset_id===asset,'INPUT_INVALID');
 required(request.snapshot_ref===snapshot_ref,'SOURCE_CHANGED');
 required(request.max_bytes<=trusted.max_page_bytes,'RESOURCE_LIMIT');
 const descriptor=plan.sources.find(s=>s.source_id===request.source_id);required(descriptor&&plan.available_source_ids.includes(request.source_id),'FILE_NOT_VISIBLE');
 required(descriptor.bytes<=4000000,'RESOURCE_LIMIT');required(descriptor.raw_sha256===request.expected_source_sha256,'SOURCE_CHANGED');
 const source=await readMethodologySource(asset,request.source_id,{context,expected_sha256:request.expected_source_sha256,authorized_source_ids:plan.available_source_ids},{repoRoot:input.repoRoot});
 const bytes=Buffer.from(source.content,'utf8');required(bytes.length===source.bytes&&sha(bytes)===source.raw_sha256,'SOURCE_CHANGED');
 const identity=sha(canonicalJson({workflow:trusted.workflow_id,binding:trusted.binding_digest,asset,source:request.source_id,hash:source.raw_sha256,snapshot:snapshot_ref}));
 const offset=request.cursor===null?0:readCursor(request.cursor,trusted.cursor_key,identity,bytes);let end=Math.min(bytes.length,offset+request.max_bytes);
 while(end>offset&&end<bytes.length&&(bytes[end]&0xc0)===0x80)end--;required(end>offset||offset===bytes.length,'RESOURCE_LIMIT');
 const chunk=bytes.subarray(offset,end),complete=end===bytes.length;
 const page=assertContract('SourceReadData',{source_id:request.source_id,source_sha256:source.raw_sha256,content:chunk.toString('utf8'),encoding:'utf-8',chunk_sha256:sha(chunk),content_bytes:chunk.length,offset,next_cursor:complete?null:signCursor({identity,offset:end},trusted.cursor_key),complete,identity_ref:snapshot_ref});
 // Compiled brief is not repeated on every raw page, keeping each response bounded.
 result.data.source_read=page;delete result.data.brief;return result;
}
export function sourceReadError(error) {
 const message=String(error?.message||'');const code=['INPUT_INVALID','FILE_NOT_VISIBLE','RESOURCE_LIMIT','SOURCE_CHANGED'].includes(error.code)?error.code:/PIN_MISMATCH|SOURCE_CHANGED/.test(message)?'SOURCE_CHANGED':/RESOURCE_LIMIT/.test(message)?'RESOURCE_LIMIT':'FILE_NOT_VISIBLE';
 return {ok:false,code,data:{reason:'Methodology source request refused; reread the current admitted catalog.'},evidence:{},warnings:[]};
}
