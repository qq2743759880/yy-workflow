import { runCommand } from './util.mjs'; 
export const name = 'sdlc'; 
export async function run(subtask, ctx, options = {}) { 
  let input = subtask.task; 
  if (!input) input = subtask.contract; 
  return runCommand('cline', [String(input)], { workspace: options.workspace, timeoutMs: options.timeoutMs, timeoutCode: 'TIMEOUT', notAvailableCode: 'SDLC_NOT_AVAILABLE', subtask }); 
} 
export default { name, run };
