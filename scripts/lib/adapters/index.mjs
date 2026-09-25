import bmad from './bmad-cline.mjs';
import opencode from './opencode.mjs';
import portman from './portman.mjs';
import prompt from './prompt.mjs';
import securitySemgrep from './security-semgrep.mjs';
import skillScanner from './skill-scanner.mjs';
export const ADAPTERS = new Map(); 
// 专用 adapter 注册表：每个 adapter 是「能力探测验证支持 write_files/run_cmd 的执行内核胶水」。
// opencode adapter 是回归渠道之一（非主路径唯一执行内核）：主路径 = prompt 后端 + --exec 宿主注入；
// 专用 CLI adapter 仅在 presence 探测命中且能力握手通过时作为备选执行渠道。
ADAPTERS.set('implementation', opencode); 
ADAPTERS.set('dev-backend', opencode); 
ADAPTERS.set('be-implementer', opencode); 
ADAPTERS.set('sdlc', bmad); 
ADAPTERS.set('be-validator', portman);
ADAPTERS.set('portman', portman);
// AS-2-security 迁移（contracts/asset-migration.md）：security 专用 adapter = semgrep 驱动
// （旧 prompt-backend 路径保留在 EXPLICIT_COMPAT_MODE 显式旗标后，Gate-1 禁静默并存）。
ADAPTERS.set('security', securitySemgrep);
// AS-2-sentinel 迁移（contracts/asset-migration.md；cr-20260925T150000Z SIGNED）：skill-sentinel 专用 adapter =
// cisco-ai-skill-scanner 2.1.0 驱动（旧 prompt-backend 路径保留在 EXPLICIT_COMPAT_MODE 显式旗标后，Gate-1 禁静默并存）。
ADAPTERS.set('skill-sentinel', skillScanner);
/** 内置 Prompt 执行后端：不依赖外部 CLI，资产正文进上下文。 */ 
export const PROMPT_ADAPTER = prompt; 
/** 
 * 解析子任务资产对应的执行后端。 
 * backend 模式： 
 *   auto（默认）——有专用 CLI adapter 用专用（能力探测验证其支持 write_files/run_cmd 后）；否则回落内置 prompt 后端（16 资产全部可达）。 
 *   prompt——一律用内置 prompt 后端（纯本地，零外部依赖）。 
 *   cli——只用专用 CLI adapter；无专用 adapter 的资产返回 null（保持旧行为：skipped）。 
 */ 
export function resolveAdapter(name, backend = 'auto') { 
  const adapter = ADAPTERS.get(name); 
  if (backend === 'prompt') return PROMPT_ADAPTER; 
  if (backend === 'cli') return adapter || null; 
  return adapter || PROMPT_ADAPTER; 
}
