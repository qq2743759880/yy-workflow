/**
 * TT 终端 TUI 实时 DAG 渲染器（M2-2，纯 ANSI 自绘，零依赖）。
 * 参考 vercel/turborepo crates/turborepo-ui 的「逐行 ANSI 手绘任务树」思路，
 * 不引 ink/blessed/dagre（批判 C2 回灌：TT 的 plan 已有 phase 分组 = 天然行结构）。
 *
 * 能力：
 *  - 每 phase 一行标题（▸），task 缩进树（├─/└─），dependsOn 行尾 → 箭头。
 *  - 状态色映射（turbo-ui）：待执行 dim/gray · 执行中 cyan+spinner · 完成 green
 *    · 失败 red · 跳过 yellow · 降级（planned-only/prompt 兜底）dim red + ⚠。
 *  - 瓶颈高亮：关键路径（当前最长未完成依赖链）与等待阻塞（依赖未完成导致排队）
 *    用 \x1b[1;7m 加粗反色 + 行尾 (BLOCKING)/(CRITICAL)。
 *  - 刷新：\x1b[H 光标归位 + 整帧覆写；非 TTY 降级为一次性静态文本。
 *  - 退出复位：\x1b[0m + 清屏归位 + 恢复光标，不残留终端转义脏状态。
 */

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  rev: '\x1b[7m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const DEFAULT_POLL_MS = 100;

export function stripAnsi(text) {
  return String(text).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
}

function truncate(text, max) {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** 降级判定（诚实性）：planned-only 或 prompt 兜底（未真实消费）均算 degraded。 */
export function isDegraded(s) {
  if (!s) return false;
  if (s.mode === 'planned-only') return true;
  if (s.mode === 'prompt' && s.assetConsumed !== true) return true;
  return false;
}

function statusStyle(s, spinner) {
  switch (s.status) {
    case 'running': return { color: C.cyan, sym: spinner || '⠋' };
    case 'done': return { color: C.green, sym: '✓' };
    case 'failed': return { color: C.red, sym: '✗' };
    case 'skipped': return { color: C.yellow, sym: '△' };
    default: return { color: C.dim + C.gray, sym: '○' };
  }
}

/**
 * 关键路径 / 等待阻塞计算（M2-4）。
 *  - 等待阻塞：状态 idle/pending 且 dependsOn 中有未完成 task。
 *  - 关键路径：当前最长未完成依赖链（沿 dependsOn 从已完成起点回溯，含中途未完成节点）。
 */
export function computeAnalysis(plan) {
  const subs = (plan && Array.isArray(plan.subtasks)) ? plan.subtasks : [];
  const byId = new Map(subs.map((s, i) => [s.id, { s, i }]));
  const done = new Set(subs.filter((s) => s.status === 'done').map((s) => s.id));
  // 等待阻塞
  const blocking = new Set();
  for (const s of subs) {
    if (s.status === 'idle' || s.status === 'pending') {
      const deps = Array.isArray(s.dependsOn) ? s.dependsOn : [];
      if (deps.some((d) => !done.has(d))) blocking.add(s.id);
    }
  }
  // 关键路径：chainLen = 未完成则 1 + max(子依赖 chainLen)，已完成记为 0（回溯起点）。
  const chainLen = new Map();
  const bestDep = new Map();
  function len(id) {
    if (chainLen.has(id)) return chainLen.get(id);
    const item = byId.get(id);
    if (!item) { chainLen.set(id, 0); return 0; }
    if (done.has(id)) { chainLen.set(id, 0); return 0; }
    const deps = Array.isArray(item.s.dependsOn) ? item.s.dependsOn : [];
    let best = 0;
    let bd = null;
    for (const d of deps) {
      if (!byId.has(d)) continue;
      const l = len(d);
      if (l > best) { best = l; bd = d; }
    }
    chainLen.set(id, best + 1);
    bestDep.set(id, bd);
    return best + 1;
  }
  let maxId = null;
  let maxLen = -1;
  // 关键路径锚定「当前执行中 task」（M2-4：从当前执行中 task 沿 dependsOn 回溯到已完成起点）；
  // 无 running 时关键路径为空（失败/跳过/等待不再因链长被误标反色）。
  const running = subs.filter((s) => s.status === 'running');
  if (running.length) {
    for (const s of running) {
      const l = len(s.id);
      if (l > maxLen) { maxLen = l; maxId = s.id; }
    }
  }
  const critical = new Set();
  if (maxId !== null) {
    let cur = maxId;
    while (cur) {
      if (!done.has(cur)) critical.add(cur);
      cur = bestDep.get(cur) || null;
    }
  }
  // 汇总
  const summary = { total: subs.length, done: 0, running: 0, failed: 0, skipped: 0, degraded: 0, blocked: 0 };
  for (const s of subs) {
    if (s.status === 'done') { summary.done += 1; if (isDegraded(s)) summary.degraded += 1; }
    else if (s.status === 'running') summary.running += 1;
    else if (s.status === 'failed') summary.failed += 1;
    else if (s.status === 'skipped') summary.skipped += 1;
    if (blocking.has(s.id)) summary.blocked += 1;
  }
  return { blocking, critical, summary };
}

/** 渲染一行：树符 + 状态色 + 任务 + dependsOn 箭头 + 瓶颈反色标注。 */
function renderTaskLine(s, idx, branch, indexById, spinner, blocking, critical) {
  const st = statusStyle(s, spinner);
  const desc = s.desc ? ' ' + truncate(s.desc, 28) : '';
  const est = s.estimate ? ' ' + s.estimate : '';
  const mode = s.mode ? ' [' + s.mode + ']' : '';
  const deg = (s.status === 'done' && isDegraded(s)) ? ' ⚠' : '';
  const deps = (Array.isArray(s.dependsOn) && s.dependsOn.length)
    ? ' → ' + s.dependsOn.slice(0, 5).map((d) => '#' + (indexById.has(d) ? indexById.get(d) : '?')).join(',')
    : '';
  let marker = '';
  let hl = false;
  if (blocking.has(s.id)) { marker = ' (BLOCKING)'; hl = true; }
  else if (critical.has(s.id)) { marker = ' (CRITICAL)'; hl = true; }
  let text = branch + '#' + idx + ' ' + s.asset + est + ' ' + st.sym + ' ' + desc + mode + deg + deps + marker;
  text = hl ? C.rev + text + C.reset : st.color + text + C.reset;
  return '  ' + text;
}

/** 构建帧内容（含 ANSI 色码，不含光标/清行控制符）。 */
export function buildLines(plan, opts = {}) {
  const subs = (plan && Array.isArray(plan.subtasks)) ? plan.subtasks : [];
  const spinner = opts.spinner || '';
  const { blocking, critical, summary } = computeAnalysis(plan);
  const indexById = new Map(subs.map((s, i) => [s.id, i]));
  const phases = new Map();
  for (const s of subs) {
    if (!phases.has(s.phase)) phases.set(s.phase, []);
    phases.get(s.phase).push(s);
  }
  const phaseIdx = [...phases.keys()].sort((a, b) => a - b);
  const lines = [];
  const title = 'TT plan ' + (plan.id || '?') + ' · ' + truncate(plan.task, 40) + ' · ' + (plan.status || '');
  lines.push(C.bold + title + C.reset);
  for (const p of phaseIdx) {
    const name = (Array.isArray(plan.phaseNames) && plan.phaseNames[p]) || ('phase-' + (p + 1));
    lines.push(C.bold + '▸ ' + name + C.reset);
    const group = phases.get(p);
    group.forEach((s, i) => {
      const isLast = i === group.length - 1;
      lines.push(renderTaskLine(s, indexById.get(s.id), isLast ? '└─ ' : '├─ ', indexById, spinner, blocking, critical));
    });
  }
  lines.push(C.dim + '─────' + C.reset);
  lines.push('done=' + summary.done + '/' + summary.total + ' running=' + summary.running
    + ' failed=' + summary.failed + ' skipped=' + summary.skipped + ' degraded=' + summary.degraded
    + ' blocked=' + summary.blocked);
  return lines;
}

/** 静态/单次渲染（含色码，无光标控制符）。 */
export function render(plan, opts = {}) {
  return buildLines(plan, opts).join('\n') + '\n';
}

/** 非 TTY 降级：一次性纯文本 DAG（剥离全部 ANSI）。 */
export function renderStatic(plan, opts = {}) {
  return stripAnsi(render(plan, opts));
}

/** 实时刷新帧：\x1b[H 光标归位 + 每行 \x1b[K 清尾 + 整帧覆写。 */
export function frame(plan, opts = {}) {
  const lines = buildLines(plan, opts);
  return '\x1b[H' + lines.map((l) => l + '\x1b[K').join('\n') + '\n';
}

/**
 * TUI 渲染器实例（工厂函数）。
 * options: { stream?, pollMs? }
 *  - stream: 输出流（默认 process.stdout）；isTTY=false 时自动降级为一次性静态输出。
 *  - live=false 时 start() 只输出一次静态帧；update() 被忽略；finish() 只输出汇总行。
 *  - 退出复位：\x1b[0m + 恢复光标；进程被中断时由 process 'exit' 兜底复位，不残留脏状态。
 */
export function createTui(plan, opts = {}) {
  const stream = opts.stream || process.stdout;
  const pollMs = opts.pollMs || DEFAULT_POLL_MS;
  const live = stream.isTTY === true;
  let tick = 0;
  let timer = null;
  let started = false;
  let finished = false;
  let lastPlan = plan;

  function write(text) { try { stream.write(text); } catch (error) { /* 输出失败不阻断 */ } }

  function draw() {
    write(frame(lastPlan, { spinner: SPINNER[tick % SPINNER.length] }));
  }

  function start() {
    if (started || finished) return;
    started = true;
    if (live) {
      write(HIDE_CURSOR);
      write('\x1b[2J\x1b[H');
      draw();
      timer = setInterval(function () {
        tick += 1;
        const hasRunning = Array.isArray(lastPlan.subtasks) && lastPlan.subtasks.some((s) => s.status === 'running');
        if (hasRunning) draw();
      }, pollMs);
      if (timer.unref) timer.unref();
    } else {
      write(renderStatic(lastPlan));
    }
  }

  /** 状态事件到达（M2-1 onStatus）：合并最新状态并立即重绘。 */
  function update(subtask, phaseInfo) {
    if (finished || !started || !live) return;
    if (subtask && Array.isArray(lastPlan.subtasks)) {
      const t = lastPlan.subtasks.find((s) => s.id === subtask.id);
      if (t) {
        t.status = subtask.status;
        if (subtask.mode) t.mode = subtask.mode;
        if (subtask.assetConsumed !== undefined) t.assetConsumed = subtask.assetConsumed;
        if (subtask.error) t.error = subtask.error;
      }
    }
    draw();
  }

  /** 整体替换快照（独立 watch 模式：轮询 state.json 换入新 plan）。 */
  function replace(nextPlan) {
    lastPlan = nextPlan;
    if (started && !finished && live) draw();
  }

  function reset() {
    if (finished) return;
    finished = true;
    if (timer) { clearInterval(timer); timer = null; }
    if (live) write(C.reset + SHOW_CURSOR);
  }

  /** 收尾：最终帧 + 汇总行 + 报告路径 + 退出复位。 */
  function finish(opts2 = {}) {
    if (finished) return;
    const status = opts2.status || lastPlan.status || 'done';
    const reportPath = opts2.reportPath || '';
    if (live) write(frame(lastPlan, { spinner: SPINNER[0] }));
    const summary = computeAnalysis(lastPlan).summary;
    let tail = 'final: ' + status + ' done=' + summary.done + '/' + summary.total
      + ' failed=' + summary.failed + ' skipped=' + summary.skipped + ' degraded=' + summary.degraded;
    if (reportPath) tail += ' | report: ' + reportPath;
    write(tail + '\n');
    reset();
  }

  // 中断兜底：任何退出路径都复位终端，不残留转义脏状态（批判 C5 回灌）。
  process.on('exit', function () {
    if (started && !finished) { try { stream.write(C.reset + SHOW_CURSOR); } catch (error) { /* ignore */ } }
  });

  return { live, start, update, replace, finish, reset, get plan() { return lastPlan; }, isFinished: () => finished };
}
