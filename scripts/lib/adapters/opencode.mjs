import { runCommand, resolveCommandShim } from './util.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
export const name = 'opencode';
export async function run(subtask, ctx, options = {}) {
  let workspace = options.workspace;
  if (!workspace) workspace = '.';
  let input = subtask.task;
  if (!input) input = subtask.contract;
  const opencodeCmd = resolveCommandShim('opencode');
  // 先探测工具存在（不臆造版本行为，仅探可用性）——与 bmad-cline / portman 一致
  const probe = await runCommand(opencodeCmd.command, opencodeCmd.prefix.concat(['--version']), { workspace, timeoutMs: 30000, timeoutCode: 'TIMEOUT', notAvailableCode: 'OPENCODE_NOT_AVAILABLE', subtask });
  if (!probe.ok) return probe;
  // 非交互执行：裸 `opencode <msg>` 会进入 TUI 挂起，必须走 `opencode run <msg>`
  const args = opencodeCmd.prefix.concat(['run']);
  const model = (subtask && subtask.model) || options.model;
  if (model) args.push('--model', String(model));
  args.push(String(input));
  const result = await runCommand(opencodeCmd.command, args, { workspace, timeoutMs: options.timeoutMs || 180000, timeoutCode: 'TIMEOUT', notAvailableCode: 'OPENCODE_NOT_AVAILABLE', throwOnTimeout: true, subtask });
  // 成功路径置 assetConsumed=true（专用 CLI 真实执行可信）；失败/超时保持无（runtime 处理降级）
  // P1 修复：空输出（result.txt='completed' 占位）不记 consumed——对齐 prompt adapter D-1 口径
  if (result.ok && result.artifactPath) {
    let outputText = '';
    try { outputText = await fs.readFile(path.join(workspace, result.artifactPath), 'utf8'); } catch (e) { /* 读不到视为空 */ }
    const trimmed = String(outputText).trim();
    result.assetConsumed = trimmed && trimmed !== 'completed';
  }
  return result;
}
export default { name, run };
