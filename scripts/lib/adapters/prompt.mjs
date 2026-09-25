import fs from 'node:fs/promises';
import path from 'node:path';
import { runCommand } from './util.mjs';
import { renderBrief } from '../activation.mjs';
export const name = 'prompt';
/**
 * 内置 Prompt 执行后端（P1-1 根治核心）。
 * 默认：把「资产方法论正文 + 父任务 + 本子任务说明 + contract + 上游产物引用」
 * 组装为可独立消费的子任务执行指令包 brief.md，写入 artifacts/<subtaskId>/。
 * 可选宿主执行（消费链闭环）：配置 options.exec（命令数组）时，将 brief 路径作为最后一个
 * 参数投喂给宿主 CLI（opencode / claude / codex 等），stdout 写 result.txt；
 * 宿主缺失或失败 → 诚实回落 brief-only（degraded），绝不假报执行成功。
 */
export async function run(subtask, ctx, options = {}) {
  const workspace = options.workspace || '.';
  const assets = options.assets;
  const asset = assets ? assets.get(subtask.asset) : null;
  const body = asset && asset.body ? asset.body : '(资产正文缺失：该资产没有可加载的 SKILL.md / agent 正文)';
  const prior = [];
  if (ctx && typeof ctx.dump === 'function') {
    const dump = ctx.dump();
    for (const key of Object.keys(dump)) {
      if (key.startsWith('artifact:')) prior.push('- ' + key.slice('artifact:'.length) + ' → ' + dump[key]);
    }
  }
  // 资产根目录：供消费者解析正文中的相对引用（reference/*.md 等），避免悬空路径
  const assetRoot = (asset && asset.meta && asset.meta.path && options.assetsRoot)
    ? path.resolve(options.assetsRoot, asset.meta.path)
    : '(未知，见方法论正文的相对引用)';
  // 前置条件（T2 硬约束）：cluster 级结构化前置条件由 planner 写入 subtask.preconditions，
  // 派单前必须逐条满足（含资产消费证据）；空/旧 state 无该字段 → 不渲染该段（向后兼容）。
  const preconditions = Array.isArray(subtask.preconditions) && subtask.preconditions.length
    ? subtask.preconditions
    : (Array.isArray(options.preconditions) && options.preconditions.length ? options.preconditions : []);
  // B6：activation 产物组装路径（YY_ACTIVATION=lib 时由 runtime 注入 options.activationPackage）。
  // legacy（无 activationPackage）保持逐字旧 brief；新路径用 activation.renderBrief 帧渲染，
  // 并用运行期动态值（上游引用/前置/正文/资产根）覆盖静态帧，保证字段一一对应。
  const useActivation = Boolean(options.activationPackage && options.activationPackage.briefFrame);
  let brief;
  if (useActivation) {
    const frame = Object.assign({}, options.activationPackage.briefFrame);
    frame.subtaskId = subtask.id;
    frame.task = subtask.task || '(无)';
    frame.asset = subtask.asset;
    frame.assetRoot = assetRoot;
    frame.description = subtask.task || subtask.contract || '(无)';
    frame.contract = subtask.contract || '(无)';
    frame.upstreamRefs = prior.map(function(p) { return p.replace(/^- /, ''); });
    frame.preconditions = preconditions;
    frame.bodyContent = body;
    brief = renderBrief(frame);
    // B6：journey copyNextPrompt 快照引用注入（仅在调用方显式提供 options.nextPrompt 时追加；
    // 复制 = 快照引用不重算，recompute 恒 false——journey.copyNextPrompt 语义）。
    if (options.nextPrompt && typeof options.nextPrompt === 'object') {
      const np = options.nextPrompt;
      const lines = ['', '---', '', '## 下一步提示（journey 快照引用，不重算）'];
      if (np.actionHint) lines.push('- actionHint: ' + np.actionHint);
      if (np.targetNode) lines.push('- targetNode: step ' + (np.targetNode.step === undefined ? '?' : np.targetNode.step) + ' ' + (np.targetNode.name || ''));
      if (Array.isArray(np.requiredInputs) && np.requiredInputs.length) lines.push('- requiredInputs: ' + np.requiredInputs.join('; '));
      if (np.snapshotRef) lines.push('- snapshotRef: ' + JSON.stringify(np.snapshotRef));
      brief += '\n' + lines.join('\n');
    }
  } else {
    brief = [
      '# 子任务执行指令包 ' + subtask.id,
      '',
      '## 任务（父任务）',
      subtask.task || '(无)',
      '',
      '## 本子任务',
      '- asset: ' + subtask.asset,
      '- 资产根目录: ' + assetRoot,
      '- 说明: ' + (subtask.task || subtask.contract || '(无)'),
      '- contract: ' + (subtask.contract || '(无)'),
      '',
      '## 上游产物引用',
      prior.length ? prior.join('\n') : '(无上游产物)',
      '',
      '## 前置条件（硬约束）',
      preconditions.length ? preconditions.map(function(p) { return '- ' + p; }).join('\n') : '(本子任务无显式前置条件；仍须产出资产消费证据，见「执行要求」)',
      '',
      '## 方法论正文（资产全文）',
      '',
      body,
      '',
      '---',
      '执行要求：以「方法论正文」为指导，针对本子任务产出可直接执行的方案或文档（如设计说明、任务清单、验收要点）。',
      '产出请写入本目录下的其他文件（如 plan.md / checklist.md / acceptance.md），并在最终产物中标明你消费了哪个资产的方法论。',
    ].join('\n');
  }
  const dir = path.join(workspace, 'artifacts', subtask.id);
  const briefPath = path.join(dir, 'brief.md');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(briefPath, brief);
  const briefArtifact = path.join('artifacts', subtask.id, 'brief.md');
  // 可选宿主执行：options.exec = [program, ...args]，brief 绝对路径作为最后一个参数追加
  const execArgs = options.exec;
  if (Array.isArray(execArgs) && execArgs.length) {
    // P2 修复：清空上次 attempt 遗留的宿主产物（resume/retry 不得继承陈旧证据）
    try {
      for (const f of await fs.readdir(dir)) { if (f !== 'brief.md') await fs.rm(path.join(dir, f), { force: true }); }
    } catch (error) { /* 目录清理失败不阻断 */ }
    const execResult = await runCommand(execArgs[0], execArgs.slice(1).concat([briefPath]), {
      workspace, timeoutMs: options.execTimeoutMs, timeoutCode: 'EXEC_TIMEOUT', notAvailableCode: 'EXEC_NOT_AVAILABLE', subtask,
    });
    if (execResult.ok) {
      // 执行真实性校验（BE-14）：真实 agent 宿主把结果写入 subtask 产物目录（文件）而非 stdout。
      // 资产消费证据（硬约束，P1 修复）：指纹用资产正文首标题锚点（高熵，防 security/review 等
      // 低熵资产名被正常措辞碰巧命中）；产物须含锚点才记 assetConsumed=true。
      const anchor = (asset && asset.body && (asset.body.match(/^#{1,6}\s+(.+)$/m) || [])[1])
        ? asset.body.match(/^#{1,6}\s+(.+)$/m)[1].trim()
        : String(subtask.asset);
      const anchorLower = String(anchor).toLowerCase();
      // kernel 词（D-1 强化，P1 修复）：资产有 Execution kernel 段时，产物须含锚点 且 ≥1 内核词。
      // 提取规则：Kernel: 行内 ASCII 工具 token（反引号或含 ./_- 的 ≥3 字符 token），过滤虚词；
      // 兼容中文开头 Kernel 行（be-validator/skill-sentinel 等在役资产），不再静默回落锚点即可。
      const hasKernelSection = Boolean(asset && asset.body && /^#{1,6}\s+Execution kernel/im.test(asset.body));
      const VIRTUAL = /^(via|the|and|for|of|to|in|is|or|not|with|as|at|by|hub|uses|layer)$/i;
      const kernelLine = asset && asset.body ? ((asset.body.match(/## Execution kernel[\s\S]*?Kernel:\s*([^\n]+)/) || [])[1] || '') : '';
      const kernelTokens = [...new Set((kernelLine.match(/`([A-Za-z][A-Za-z0-9._/-]{2,})`|([A-Za-z][A-Za-z0-9._/-]{2,})/g) || [])
        .map((t) => t.replace(/`/g, '').toLowerCase())
        .filter((t) => t.length >= 3 && !VIRTUAL.test(t)))];
      let hasRealOutput = false;
      let assetConsumed = false;
      try {
        const files = await fs.readdir(dir);
        for (const f of files) {
          if (f === 'brief.md' || f === 'result.txt') continue;
          // 交付物命名白名单：防无关文件（junk.tmp 等）伪造 exec；且要求内容 trim 后非空（纯空白不算产出）。
          if (!/\.(md|json|yaml|yml)$/.test(f)) continue;
          try {
            const txt = (await fs.readFile(path.join(dir, f), 'utf8'));
            if (txt.trim()) {
              hasRealOutput = true;
              const lower = txt.toLowerCase();
              // D-1：kernel 资产须锚点 AND ≥1 内核词；kernel 段存在但无可提取内核词（如 Kernel 行以中文起始）
              // → 回落锚点即可（不卡死合法消费，也不放松有内核词的资产）
              if (hasKernelSection && kernelTokens.length) assetConsumed = lower.includes(anchorLower) && kernelTokens.some((k) => lower.includes(k));
              else assetConsumed = lower.includes(anchorLower);
            }
            if (hasRealOutput && assetConsumed) break;
          } catch (error) { /* 读不到跳过 */ }
        }
      } catch (error) { /* 目录读取失败视为无产物 */ }
      if (!hasRealOutput && execResult.artifactPath) {
        try { const rt = (await fs.readFile(path.join(workspace, execResult.artifactPath), 'utf8')).trim(); if (rt && rt !== 'completed') hasRealOutput = true; } catch (error) { /* stdout 读不到 */ }
      }
      if (hasRealOutput) return { ok: true, artifactPath: execResult.artifactPath, executed: true, assetConsumed };
      return { ok: true, artifactPath: briefArtifact, degraded: 'brief-only (executor empty output: no real artifact produced)', error: null };
    }
    return { ok: true, artifactPath: briefArtifact, degraded: 'brief-only (executor unavailable/failed: ' + (execResult.error || 'unknown') + ')', error: null };
  }
  return { ok: true, artifactPath: briefArtifact };
}
export default { name, run };
