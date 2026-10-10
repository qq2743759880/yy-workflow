import bmad from './bmad-cline.mjs';
import opencode from './opencode.mjs';
import portman from './portman.mjs';
import prompt from './prompt.mjs';
import securitySemgrep from './security-semgrep.mjs';
import skillScanner from './skill-scanner.mjs';
export const ADAPTERS = new Map(); 
// Deterministic capability adapters remain separate from optional execution providers.
// Implementation methodology is portable. External providers are opt-in.
export const EXTERNAL_PROVIDERS = new Map([
  ['cline', {provider_id:'cline',class:'OPTIONAL_EXTERNAL_PROVIDER',adapter:bmad}],
  ['opencode', {provider_id:'opencode', class:'OPTIONAL_EXTERNAL_PROVIDER', adapter:opencode}],
]);

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
 *   auto（默认）——implementation 用 portable prompt/host 路径；具体工具 capability 保留既有 adapter。安装存在性不选择外部 provider。 
 *   prompt——一律用内置 prompt 后端（纯本地，零外部依赖）。 
 *   cli——只用专用 CLI adapter；无专用 adapter 的资产返回 null（保持旧行为：skipped）。 
 */ 
export function resolveAdapter(name, backend = 'auto', options = {}) { 
  if (ADAPTERS.has(name) && options.executionMode!=='BRIEF_ONLY') return ADAPTERS.get(name);
  if (options.provider) return (options.providers || EXTERNAL_PROVIDERS).has(options.provider)?PROMPT_ADAPTER:null;
  if (options.executionMode === 'HOST_NATIVE' || options.executionMode === 'BRIEF_ONLY') return PROMPT_ADAPTER;
  const adapter = ADAPTERS.get(name); 
  if (backend === 'prompt') return PROMPT_ADAPTER; 
  if (backend === 'cli') return adapter || null; 
  return adapter || PROMPT_ADAPTER; 
}
