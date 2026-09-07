import fs from 'node:fs/promises';
import path from 'node:path';
export function createReport(result) {
  const plan = result.plan;
  return { generatedAt: new Date().toISOString(), planId: plan.id, task: plan.task, cluster: plan.cluster, status: plan.status, degraded: plan.degraded === true, modes: plan.modes || {}, warnings: plan.warnings || [], subtasks: plan.subtasks, context: result.context };
}
export async function writeReport(result, workspace = '.') {
  const report = createReport(result);
  const dir = path.join(workspace, 'artifacts');
  await fs.mkdir(dir, { recursive: true });
  const stem = 'report-' + report.planId;
  await fs.writeFile(path.join(dir, stem + '.json'), JSON.stringify(report, null, 2));
  const lines = ['# TT Execution Report', '', '- plan: ' + report.planId, '- task: ' + report.task, '- cluster: ' + report.cluster, '- status: ' + report.status];
  if (report.degraded) lines.push('- degraded: true ⚠ 全部子任务 skipped（外部执行工具不可用，仅产出路由与状态记录）');
  const m = report.modes;
  lines.push('- 执行摘要: ' + (m.exec || 0) + ' exec(宿主执行) / ' + (m.cli || 0) + ' cli 执行 / ' + (m.prompt || 0) + ' prompt 兜底(指令包) / ' + (m['planned-only'] || 0) + ' planned-only 降级 / ' + (m.skipped || 0) + ' skipped');
  for (const w of report.warnings) lines.push('- ⚠ ' + w);
  if ((m.prompt || 0) > 0 || (m['planned-only'] || 0) > 0) {
    lines.push('- ⚠ 注意: 标有 prompt 兜底 / planned-only 的子任务仅产出「执行指令包/计划文档」，不代表已真实执行，需宿主平台消费产物后回填结果');
  }
  lines.push('', '## Subtasks');
  for (const item of report.subtasks) lines.push('- ' + item.id + ': ' + item.asset + ' [' + item.status + ']' + (item.mode ? ' (mode: ' + item.mode + ')' : ''));
  await fs.writeFile(path.join(dir, stem + '.md'), lines.join('\n'));
  return { json: path.join('artifacts', stem + '.json'), markdown: path.join('artifacts', stem + '.md') };
}
