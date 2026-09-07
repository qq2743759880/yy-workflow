import { runCommand, resolveCommandShim } from './util.mjs'; 
import fs from 'node:fs/promises'; 
import path from 'node:path'; 
export const BMAD_PHASES = ['plan', 'develop', 'review', 'summarize']; 
export const name = 'sdlc'; 
/** 每个 BMAD 阶段写一份阶段记录（输入/输出/验收证据占位），使阶段循环真实可观测。 */ 
async function writePhaseDocs(subtask, workspace) { 
  const dir = path.join(workspace, 'artifacts', subtask.id); 
  await fs.mkdir(dir, { recursive: true }); 
  const inputs = { plan: 'requirements', develop: 'plan output', review: 'artifacts to findings', summarize: 'findings to stage summary' }; 
  for (const phase of BMAD_PHASES) { 
    const doc = [ 
      '# BMAD phase: ' + phase, 
      '', 
      '- subtask: ' + subtask.id, 
      '- task: ' + (subtask.task || subtask.contract), 
      '- phase input: ' + inputs[phase], 
      '- phase output: recorded in this file', 
      '- acceptance evidence: ' + (phase === 'summarize' ? 'stage summary for handoff' : 'verified after cline execution (or planned-only when cline unavailable)'), 
      '- failure handling: retryable errors retried by withRetry; timeout returns TIMEOUT', 
    ].join('\n'); 
    await fs.writeFile(path.join(dir, 'phase-' + phase + '.md'), doc); 
  } 
  return path.join('artifacts', subtask.id, 'phase-summarize.md'); 
} 
export async function run(subtask, ctx, options = {}) { 
  let workspace = options.workspace; 
  if (!workspace) workspace = '.'; 
  let input = subtask.task; 
  if (!input) input = subtask.contract; 
  // cline 可用 → 真实执行（spawn 参数数组，防 shell 注入）
  const clineCmd = resolveCommandShim('cline');
  const probe = await runCommand(clineCmd.command, clineCmd.prefix.concat(['--version']), { workspace, timeoutMs: 30000, timeoutCode: 'TIMEOUT', notAvailableCode: 'SDLC_NOT_AVAILABLE', subtask }); 
  if (probe.ok) { 
    await writePhaseDocs(subtask, workspace); 
    const result = await runCommand(clineCmd.command, clineCmd.prefix.concat([String(input)]), { workspace, timeoutMs: options.timeoutMs, timeoutCode: 'TIMEOUT', notAvailableCode: 'SDLC_NOT_AVAILABLE', throwOnTimeout: true, subtask }); 
    return result; 
  } 
  // cline 不可用 → 默认 planned-only 降级：四阶段计划文档即为产物（明确标注，不算假成功）。
  // cli 模式必须诚实 skipped：降级只属于 auto 模式。
  if (options.backend === 'cli') return probe;
  const artifactPath = await writePhaseDocs(subtask, workspace);
  return { ok: true, artifactPath, degraded: 'planned-only (cline unavailable, BMAD phase plan recorded)', error: null };
} 
export default { name, run, BMAD_PHASES }; 
