#!/usr/bin/env node
/** C4 local entry: the host consumes Decision packets before any execution. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { HOST_ROOT, createCoreTransport, prepareHostDecision, verifyHostDecision,
  hostRecord, safeHostFile } from './lib/host-adapter.mjs';
import { runHostConsumption, HOST_RECEIPT_BOUNDARY } from './host-consumption.mjs';

const fail=(code,reason)=>({ok:false,code,data:{reason,...HOST_RECEIPT_BOUNDARY},evidence:{},warnings:[]});
function parse(argv) {
  const args={command:argv[0]};
  const allowed=new Set(['workspace','session','intent','task-text','capability','subtask-id','activation-level',
    'requested-resources','budget','save','exec','artifact','checker','timeout-ms']);
  for(let i=1;i<argv.length;i++) {
    const key=argv[i].startsWith('--')?argv[i].slice(2):null;
    if(!allowed.has(key)||key in args) throw new Error('Unknown or duplicate option: '+argv[i]);
    if(key==='save') {args[key]=true;continue;}
    const value=argv[++i];
    if(!value||value.startsWith('--')) throw new Error('Missing value: --'+key);
    args[key]=value;
  }
  if(!['prepare','check','execute'].includes(args.command)||!args.workspace) throw new Error('Use prepare|check|execute --workspace <project>');
  if(args.session!==undefined&&(!/^[a-z0-9][a-z0-9_.-]*$/i.test(args.session)||args.session.includes('..')))
    throw new Error('session must be one safe namespace');
  const legal=args.command==='prepare'?new Set(['command','workspace','session','intent','task-text','capability','subtask-id','activation-level','requested-resources','budget','save']):
    args.command==='check'?new Set(['command','workspace','session','subtask-id']):new Set(['command','workspace','session','subtask-id','exec','artifact','checker','timeout-ms']);
  if(Object.keys(args).some(key=>!legal.has(key))) throw new Error('Option does not apply to '+args.command);
  return args;
}
function inputFrom(args) {
  if(!args.intent) throw new Error('prepare requires --intent');
  const input={intent:args.intent};
  for(const [key,field] of Object.entries({'task-text':'taskText',capability:'capability','subtask-id':'subtaskId','activation-level':'activationLevel'}))
    if(args[key]!==undefined) input[field]=args[key];
  if(args['requested-resources']) input.requestedResources=args['requested-resources'].split(',').map(s=>s.trim()).filter(Boolean);
  if(args.budget!==undefined) {
    const limit=Number(args.budget);
    if(!Number.isSafeInteger(limit)||limit<=0) throw new Error('budget must be a positive integer');
    input.budget={limit};
  }
  return input;
}

export async function runHostAdapter(argv,{present=packet=>new Promise((resolve,reject)=>{
  process.stdout.write(JSON.stringify(packet)+'\n',error=>error?reject(error):resolve());
})}={}) {
  try {
    const args=parse(argv),workspace=fs.realpathSync(args.workspace),session=args.session??null;
    const transport=createCoreTransport({workspace,session});
    if(args.command==='prepare') {
      const input=inputFrom(args);
      // The awaited presenter receives unmodified envelopes, including blockers,
      // asset bodies, owner projection and evidence references.
      const decision=await prepareHostDecision(input,{transport,present});
      if(args.save&&decision.ok&&decision.data.execution_permitted) {
        const file=safeHostFile(workspace,input.subtaskId);
        const record=hostRecord(input,decision);
        record.host_binding={transport:'core',workspace,session};
        fs.mkdirSync(path.dirname(file),{recursive:true});
        fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');
        decision.evidence.host_decision_ref=path.relative(workspace,file).split(path.sep).join('/');
      }
      return decision;
    }
    const file=safeHostFile(workspace,args['subtask-id']);
    if(!fs.existsSync(file)) return fail('HOST_INTEGRATION_BYPASS','No presented Decision Packet. Direct /yy execution fails acceptance.');
    const record=JSON.parse(fs.readFileSync(file,'utf8'));
    if(record.host_binding?.transport!=='core'||record.host_binding.workspace!==workspace||record.host_binding.session!==session||record.input?.subtaskId!==args['subtask-id'])
      return fail('HOST_INTEGRATION_BYPASS','Decision Packet belongs to a different host workspace, session or task.');
    const fresh=await verifyHostDecision(record,record.input,{transport});
    if(!fresh.ok) return fresh;
    for(const packet of fresh.data.decisions) await present(packet);
    if(args.command==='check') return fresh;
    if(!args.exec||!args.artifact) throw new Error('execute requires --exec JSON argv and --artifact');
    const intent=fresh.data.intent,input=record.input;
    if(!intent.follow_up) return fail('HOST_TASK_INPUT_REQUIRED','This stage has no asset brief. Use check before native stage work; no legacy task receipt is synthesized.');
    // Reuse the existing CLI writer. No admission, selector or receipt semantics
    // are duplicated in this host adapter.
    const childArgs=[path.join(HOST_ROOT,'scripts/decision.mjs'),'task','--workspace',workspace,
      '--task-text',input.taskText,'--step',String(intent.step),'--mode',intent.follow_up.mode,
      '--subtask-id',input.subtaskId,'--emit-brief','--record'];
    const capability=intent.follow_up.capability_hint??input.capability;
    if(capability) childArgs.push('--capability',capability);
    if(session!==null) childArgs.push('--session',session);
    if(input.activationLevel) childArgs.push('--activation-level',input.activationLevel);
    if(input.requestedResources) childArgs.push('--requested-resources',input.requestedResources.join(','));
    if(input.budget) childArgs.push('--budget',String(input.budget.limit));
    const child=spawnSync(process.execPath,childArgs,{cwd:workspace,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024,windowsHide:true});
    let packet;try{packet=JSON.parse(child.stdout);}catch{return fail('HOST_DECISION_NOT_READY','Decision CLI did not deliver a receipt-backed brief.');}
    await present(packet);
    if(child.status!==0||!packet.ok) return packet;
    // Recheck the original packet after opt-in brief delivery as well. A write
    // cannot authorize a different journey, asset or semantic generation.
    const checked=await verifyHostDecision(record,input,{transport});
    if(!checked.ok) return checked;
    const consume=['--workspace',workspace,'--subtask-id',input.subtaskId,'--artifact',args.artifact,'--exec',args.exec];
    for(const key of ['checker','timeout-ms']) if(args[key]) consume.push('--'+key,args[key]);
    const execution=await runHostConsumption(consume,{present});
    execution.data.host_decision_ref=path.relative(workspace,file).split(path.sep).join('/');
    execution.data.host_integration={status:'PACKET_GATED',intent_map_sha256:intent.map_sha256};
    return execution;
  } catch(error) {return fail('HOST_INPUT_INVALID',error.message);}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const result=await runHostAdapter(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result)+'\n');
  process.exitCode=result.ok?0:1;
}
