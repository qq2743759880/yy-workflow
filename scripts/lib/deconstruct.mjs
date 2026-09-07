import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolveCommandShim } from './adapters/util.mjs';

export const ESTIMATES = ['S', 'M', 'L'];
export const MAX_LANES = 4;
export const MAX_TASKS_PER_LANE = 4;

/**
 * 自动拆解引擎（FR-1）：大任务 → 拆解候选 plan 草案 → schema 校验 + 资产白名单
 * + 依赖完整性（无环、dependsOn 引用存在）+ 并行判据 → 归一化为 plan 兼容对象。
 * 校验失败一律拒绝并报具体错误，绝不静默修正进入审批（批判 C4 回灌）。
 * 零依赖：仅 node 内置模块 + 复用 adapters/util.mjs 的命令 shim 解析。
 */

/**
 * 三层拆解 prompt（spec_driven_develop：intent 确认 → phase → task → lane，
 * 每个 task 带 S.U.P.E.R 标注 + estimate + lane 并行判据）。
 * 宿主 = dev-planner 拆解范式（见 vendor/dev-planner/dev-planner.md「自动拆解模式」）。
 */
export function buildDeconstructPrompt(task, assetNames) {
  const whitelist = (assetNames || []).slice().sort().join(', ');
  const schema = JSON.stringify(
    { task: '<任务原文>', draft: true, phases: [{ name: 'phase-1', tasks: [{ id: 't1', desc: '具体可开工的描述', asset: '<资产名>', estimate: 'S|M|L', lane: 'a', dependsOn: [] }] }] },
    null, 2
  );
  return [
    '# 自动任务拆解（TT --plan 草案生成）',
    '',
    '## 任务',
    String(task),
    '',
    '## 输出要求',
    '严格只输出一个 JSON 对象（可放在单个 ```json 代码块内），不得输出 JSON 之外的解释文本。schema：',
    '```json',
    schema,
    '```',
    '',
    '## 拆解方法论（spec_driven_develop 三层 + S.U.P.E.R，dev-planner 宿主范式）',
    '',
    '### 第 1 层 — intent 确认',
    '拆解前先用 1-3 句陈述你对任务的意图理解与范围边界（此陈述只用于指导拆解，不进入 JSON）。',
    '',
    '### 第 2 层 — phase（阶段）拆解',
    '- 把大任务按交付顺序切成 1-6 个阶段（phase），每个 phase 一个 name（如 phase-1/phase-2）。',
    '- 阶段 = 可交付里程碑；同 phase 内任务可并行，跨 phase 串行。',
    '',
    '### 第 3 层 — task + lane（任务与并行分组）',
    '- 每个 phase 下 1-8 个 task；每个 task 必须可独立实现、可独立验收。',
    '- 并行 lane：同一 phase 内可并行的任务归入同一 lane 值（a/b/c/d）。',
    '- 并行判据（spec_driven_develop 量化规则）：同 lane 任务文件集不相交 + 各 lane 工作量 ≤ L + 可独立验收 + 总 lane 数 ≤ ' + MAX_LANES + '；同 lane ≤ ' + MAX_TASKS_PER_LANE + ' 个 task。',
    '- 跨 lane 任务不得存在共享产物依赖（有依赖就拆成前后 phase 或并入同 lane）。',
    '',
    '## S.U.P.E.R 任务标注',
    '- Specific：desc 必须具体到可直接开工（含对象/动作/产物），禁止「优化系统」这类模糊描述。',
    '- estimate：S=半天内 / M=1-2 天 / L=3 天以上，按工作量诚实分级。',
    '- dependency：dependsOn 只引用前置 task 的 id（同 phase 或更早 phase）；无依赖给 []。',
    '- lane：并行分组标识；串行任务的 lane 可独立取值。',
    '',
    '## 资产白名单（task.asset 必须命中其一）',
    whitelist,
    '',
    '## 字段约束',
    '- phases 数组 ≥ 1 个，每个 phase 的 tasks 数组 ≥ 1 个。',
    '- 每个 task 必须含：id（草案例内唯一）、desc、asset、estimate（S/M/L）、lane、dependsOn（数组）。',
    '- dependsOn 引用的 id 必须真实存在且依赖图无环。',
    '',
  ].join('\n');
}

/** 从宿主输出文本中提取 JSON 草案（支持 ```json 代码块、纯 JSON、或正文中首个平衡 JSON 对象）。 */
export function extractDraft(text) {
  const raw = String(text || '');
  let candidate = raw.trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1].trim()) candidate = fence[1].trim();
  try { return JSON.parse(candidate); } catch (error) { /* fall through */ }
  const start = candidate.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i += 1) {
    const ch = candidate[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(candidate.slice(start, i + 1)); } catch (error) { return null; }
      }
    }
  }
  return null;
}

/**
 * schema + 白名单 + 依赖完整性 + 并行判据 硬门槛校验。
 * manifest: { entries: [{ name }] }（资产白名单来源）。
 * 返回 { ok, errors: string[] }。errors 为空 = 通过。
 */
export function validateDraft(draft, manifest) {
  const errors = [];
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return { ok: false, errors: ['草案不是 JSON 对象'] };
  if (typeof draft.task !== 'string' || !draft.task.trim()) errors.push('task 缺失或为空（必需，须为任务原文）');
  if (draft.draft !== true) errors.push('draft 必须为 true（草案标记，防误把正式 plan 当草案）');
  const whitelist = new Set((manifest && Array.isArray(manifest.entries) ? manifest.entries : []).map((e) => e.name));
  const allTasks = [];
  if (!Array.isArray(draft.phases) || draft.phases.length === 0) {
    errors.push('phases 必须为 ≥ 1 个 phase 的数组');
  } else {
    draft.phases.forEach((phase, p) => {
      const where = 'phases[' + p + ']';
      if (!phase || typeof phase !== 'object' || Array.isArray(phase)) { errors.push(where + ' 不是对象'); return; }
      if (typeof phase.name !== 'string' || !phase.name.trim()) errors.push(where + ' 缺少 name（必需）');
      if (!Array.isArray(phase.tasks) || phase.tasks.length === 0) errors.push(where + ' 的 tasks 必须为 ≥ 1 个 task 的数组');
      if (Array.isArray(phase.tasks)) {
        phase.tasks.forEach((task, j) => {
          const where2 = where + '.tasks[' + j + ']';
          if (!task || typeof task !== 'object' || Array.isArray(task)) { errors.push(where2 + ' 不是对象'); return; }
          if (typeof task.id !== 'string' || !task.id.trim()) errors.push(where2 + ' 缺少 id（必需，草案例内唯一）');
          else allTasks.push({ task, phase: p, where: where2 });
          if (typeof task.desc !== 'string' || !task.desc.trim()) errors.push(where2 + ' 缺少 desc（必需，须具体到可开工）');
          if (typeof task.asset !== 'string' || !task.asset.trim()) errors.push(where2 + ' 缺少 asset（必需）');
          if (typeof task.estimate !== 'string' || !ESTIMATES.includes(task.estimate.toUpperCase())) errors.push(where2 + ' estimate 非法: ' + String(task.estimate) + '（必须为 S/M/L）');
          if (typeof task.lane !== 'string' || !task.lane.trim()) errors.push(where2 + ' 缺少 lane（必需，并行分组标识）');
          if (task.dependsOn !== undefined && !Array.isArray(task.dependsOn)) errors.push(where2 + ' dependsOn 必须为数组');
        });
      }
    });
  }
  if (errors.length) return { ok: false, errors };
  // id 唯一
  const ids = new Map();
  for (const item of allTasks) {
    if (ids.has(item.task.id)) errors.push('task id 重复: ' + item.task.id);
    else ids.set(item.task.id, item.task);
  }
  // 资产白名单（批判 C4：必须命中 manifest 真实存在的资产名）
  for (const item of allTasks) {
    if (!whitelist.has(item.task.asset)) {
      errors.push(item.where + ' asset 不在白名单: "' + item.task.asset + '"（可用资产: ' + (whitelist.size ? [...whitelist].sort().join(', ') : '(空 manifest)') + '）');
    }
  }
  // dependsOn 引用存在 + 无自依赖
  for (const item of allTasks) {
    if (Array.isArray(item.task.dependsOn)) {
      for (const dep of item.task.dependsOn) {
        if (dep === item.task.id) errors.push(item.where + ' task ' + item.task.id + ' 依赖自身（自环）');
        else if (!ids.has(dep)) errors.push(item.where + ' task ' + item.task.id + ' 依赖不存在的 id: "' + dep + '"');
      }
    }
  }
  // 无环（Kahn 拓扑排序）
  const indeg = new Map();
  const adj = new Map();
  for (const id of ids.keys()) { indeg.set(id, 0); adj.set(id, []); }
  for (const item of allTasks) {
    for (const dep of (item.task.dependsOn || [])) {
      if (ids.has(dep) && dep !== item.task.id) { adj.get(dep).push(item.task.id); indeg.set(item.task.id, indeg.get(item.task.id) + 1); }
    }
  }
  const queue = [...ids.keys()].filter((id) => indeg.get(id) === 0);
  let visited = 0;
  while (queue.length) {
    const n = queue.shift();
    visited += 1;
    for (const m of adj.get(n)) { indeg.set(m, indeg.get(m) - 1); if (indeg.get(m) === 0) queue.push(m); }
  }
  if (visited !== ids.size) errors.push('依赖存在环（拓扑排序无法完成），请重新拆解依赖方向');
  // 并行判据：总 lane ≤4、同 lane ≤4 tasks、同 phase 跨 lane 无共享产物依赖
  const lanes = new Set(allTasks.map((i) => i.task.lane));
  if (lanes.size > MAX_LANES) errors.push('lane 数 ' + lanes.size + ' > ' + MAX_LANES + '（并行判据：≤ ' + MAX_LANES + ' lanes）');
  const perLane = new Map();
  for (const item of allTasks) perLane.set(item.task.lane, (perLane.get(item.task.lane) || 0) + 1);
  for (const [lane, count] of perLane) {
    if (count > MAX_TASKS_PER_LANE) errors.push('lane "' + lane + '" 有 ' + count + ' 个 task > ' + MAX_TASKS_PER_LANE + '（同 lane ≤ ' + MAX_TASKS_PER_LANE + '）');
  }
  const idPhase = new Map(allTasks.map((i) => [i.task.id, i.phase]));
  for (const item of allTasks) {
    for (const dep of (item.task.dependsOn || [])) {
      if (!ids.has(dep) || dep === item.task.id) continue;
      const depTask = ids.get(dep);
      if (idPhase.get(dep) === item.phase && depTask.lane !== item.task.lane) {
        errors.push(item.where + ' task ' + item.task.id + '（lane ' + item.task.lane + '）依赖同 phase 跨 lane 的 ' + dep + '（lane ' + depTask.lane + '）——跨 lane 任务不得有共享产物依赖');
      }
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [] };
}

/** 校验通过的草案 → 归一化为现有 plan 兼容对象（subtask id/phase/dependsOn 引用真实 subtask.id）。 */
export function normalizeDraft(draft, manifest) {
  const planId = 'plan-' + Date.now().toString(36);
  const subById = new Map();
  const subtasks = [];
  let idx = 0;
  draft.phases.forEach((phase, p) => {
    for (const t of phase.tasks) {
      const id = planId + '-' + idx;
      subById.set(t.id, id);
      subtasks.push({
        id,
        planId,
        asset: t.asset,
        contract: 'auto-decomposed (' + draft.task + ')',
        status: 'idle',
        artifactPath: null,
        attempts: 0,
        phase: p,
        dependsOn: [],
        desc: t.desc,
        estimate: String(t.estimate || '').toUpperCase(),
        lane: t.lane,
        approved: t.approved === true,
        note: t.note || undefined,
      });
      idx += 1;
    }
  });
  for (const phase of draft.phases) {
    for (const t of phase.tasks) {
      const sub = subtasks.find((s) => s.id === subById.get(t.id));
      if (sub) sub.dependsOn = (t.dependsOn || []).map((d) => subById.get(d)).filter(Boolean);
    }
  }
  return {
    id: planId,
    task: draft.task,
    cluster: 'deconstructed',
    contract: 'auto-decomposed plan contract (' + draft.phases.length + ' phases, ' + subtasks.length + ' tasks)',
    requireExec: false,
    phases: draft.phases.length,
    phaseNames: draft.phases.map((p) => p.name),
    subtasks,
    status: 'planning',
    createdAt: new Date().toISOString(),
    approvedAt: draft.approvedAt || undefined,
    deconstructed: true,
  };
}

function spawnHost(command, args, cwd, timeoutMs) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let done = false;
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { child.kill(); finish({ ok: false, error: 'EXEC_TIMEOUT' }); }, timeoutMs);
    if (timer.unref) timer.unref();
    function finish(result) { if (done) return; done = true; clearTimeout(timer); resolve(result); }
    child.stdout.on('data', (c) => { stdout += c.toString(); });
    child.stderr.on('data', (c) => { stderr += c.toString(); });
    child.on('error', (err) => finish({ ok: false, error: err.code === 'ENOENT' ? 'exec 命令不存在: ' + command : err.message }));
    child.on('close', (code) => {
      if (code !== 0) { const msg = (stdout || stderr || '').trim(); finish({ ok: false, error: msg || ('exit code ' + code) }); return; }
      finish({ ok: true, stdout, stderr });
    });
  });
}

async function runHostExec({ prompt, exec, workspace, execTimeoutMs }) {
  const dir = path.join(workspace, 'artifacts', 'plan-draft');
  await fs.mkdir(dir, { recursive: true });
  const briefPath = path.join(dir, 'brief.md');
  await fs.writeFile(briefPath, prompt, 'utf8');
  const timeoutMs = execTimeoutMs || 600000;
  const shim = resolveCommandShim(exec[0]);
  const result = await spawnHost(shim.command, shim.prefix.concat(exec.slice(1), [briefPath]), workspace, timeoutMs);
  if (!result.ok) return { ok: false, error: result.error };
  let text = result.stdout;
  try {
    const planMd = await fs.readFile(path.join(dir, 'plan.md'), 'utf8');
    if (planMd.trim()) text = planMd;
  } catch (error) { /* 宿主未写 plan.md，回落 stdout */ }
  if (!text || !text.trim()) return { ok: false, error: '宿主无输出（stdout 空且未写 plan.md）' };
  return { ok: true, text };
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.resume();
  });
}

/**
 * 拆解流程入口（orchestrator --plan 调用）：
 *  - 有 --exec 宿主 → 宿主模式（brief → 宿主消费 → 提取 JSON）
 *  - 无宿主 → 手动模式（打印拆解 prompt 模板；草案来自 --draft 文件或 stdin 粘贴）
 * 返回 { ok, mode, draft?, fromStdin?, error? }。draft 均已通过校验。
 */
export async function runDeconstructFlow(options) {
  const { task, manifest, exec, execTimeoutMs, workspace, draftFile } = options;
  const names = (manifest && Array.isArray(manifest.entries) ? manifest.entries : []).map((e) => e.name);
  const prompt = buildDeconstructPrompt(task, names);
  if (Array.isArray(exec) && exec.length) {
    const hostResult = await runHostExec({ prompt, exec, workspace, execTimeoutMs });
    if (!hostResult.ok) return { ok: false, mode: 'host', error: '宿主执行失败/无输出: ' + hostResult.error };
    const draft = extractDraft(hostResult.text);
    if (!draft) return { ok: false, mode: 'host', error: '宿主输出中未提取到合法 JSON 草案（请宿主严格按 schema 输出）' };
    const v = validateDraft(draft, manifest);
    if (!v.ok) return { ok: false, mode: 'host', error: formatErrors(v.errors) };
    return { ok: true, mode: 'host', draft };
  }
  let text = '';
  if (draftFile) {
    try {
      text = await fs.readFile(draftFile, 'utf8');
    } catch (error) {
      return { ok: false, mode: 'manual', error: '无法读取 --draft 文件: ' + draftFile + ' (' + error.message + ')' };
    }
  } else {
    console.log('===== 拆解 prompt 模板（--plan 手动模式，宿主 = dev-planner 自动拆解范式） =====');
    console.log(prompt);
    console.log('');
    console.log('===== 请按上述 schema 把 JSON 草案粘贴到下面，然后输入 EOF（Windows: Ctrl+Z+Enter / Unix: Ctrl+D）；');
    console.log('或退出后用 --draft <file> 传入草案文件，再在同一终端交互审批 =====');
    text = await readStdin();
  }
  const draft = extractDraft(text);
  if (!draft) return { ok: false, mode: 'manual', error: draftFile ? '--draft 文件内容不是合法 JSON 草案' : 'stdin 未输入合法 JSON 草案' };
  const v = validateDraft(draft, manifest);
  if (!v.ok) return { ok: false, mode: 'manual', error: formatErrors(v.errors) };
  return { ok: true, mode: draftFile ? 'manual-file' : 'manual-stdin', fromStdin: !draftFile, draft };
}

export function formatErrors(errors) {
  return '草案校验失败（校验为硬门槛，拒绝进入审批，请按下列错误重新拆解）:\n' + (errors || []).map((e) => '  - ' + e).join('\n');
}
