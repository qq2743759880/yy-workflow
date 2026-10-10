/** Explicit optional provider; phase templates do not prove phase execution. */
import {runCommand,resolveCommandShim} from './util.mjs';
export const BMAD_PHASES=['plan','develop','review','summarize'];
export const name='sdlc';
export async function run(subtask,ctx,options={}) {
 if(options.provider!=='cline') return {ok:false,status:'NOT_EXECUTED',executed:false,error:'PROVIDER_OPT_IN_REQUIRED'};
 const injected=options.providerCommand;
 const resolved=injected?{command:injected[0],prefix:injected.slice(1)}:resolveCommandShim('cline');
 const result=await runCommand(resolved.command,resolved.prefix.concat([String(subtask.task||subtask.desc||subtask.contract)]),
   {workspace:options.workspace||'.',timeoutMs:options.timeoutMs,notAvailableCode:'SDLC_NOT_AVAILABLE',timeoutCode:'TIMEOUT',subtask});
 const consumed=result.ok===true&&!!result.stdout?.trim();
 return {...result,status:consumed?'EXECUTED':'NOT_EXECUTED',executed:consumed,assetConsumed:consumed,phase_execution:'UNVERIFIED'};
}
export default {name,run,BMAD_PHASES};
