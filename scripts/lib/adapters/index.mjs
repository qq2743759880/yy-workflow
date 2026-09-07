import bmad from './bmad-cline.mjs'; 
import opencode from './opencode.mjs'; 
import portman from './portman.mjs'; 
import prompt from './prompt.mjs'; 
export const ADAPTERS = new Map(); 
ADAPTERS.set('implementation', opencode); 
ADAPTERS.set('dev-backend', opencode); 
ADAPTERS.set('be-implementer', opencode); 
ADAPTERS.set('sdlc', bmad); 
ADAPTERS.set('be-validator', portman); 
ADAPTERS.set('portman', portman); 
/** 内置 Prompt 执行后端：不依赖外部 CLI，资产正文进上下文。 */ 
export const PROMPT_ADAPTER = prompt; 
/** 
 * 解析子任务资产对应的执行后端。 
 * backend 模式： 
 *   auto（默认）——有专用 CLI adapter 用专用；否则回落内置 prompt 后端（16 资产全部可达）。 
 *   prompt——一律用内置 prompt 后端（纯本地，零外部依赖）。 
 *   cli——只用专用 CLI adapter；无专用 adapter 的资产返回 null（保持旧行为：skipped）。 
 */ 
export function resolveAdapter(name, backend = 'auto') { 
  const adapter = ADAPTERS.get(name); 
  if (backend === 'prompt') return PROMPT_ADAPTER; 
  if (backend === 'cli') return adapter || null; 
  return adapter || PROMPT_ADAPTER; 
}
