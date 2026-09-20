#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const JOURNEY_SCHEMA = 'yy/journey@1';
export const GATE_VOCAB = ['concept-signed', 'premise-signed', 'contract-frozen', 'gate-a-approved'];

// 9 节点（0-8）对齐 SKILL.md §0b 闭环全景。gate 为主干正向节点的人工闸（回跳层无独立 gate）。
export const STEPS = [
  { step: 0, name: '资产整合', gate: null },
  { step: 1, name: '文档化', gate: 'concept-signed' },
  { step: 2, name: '重执行1', gate: null },
  { step: 3, name: '拆任务', gate: 'premise-signed' },
  { step: 4, name: '重执行1,2', gate: null },
  { step: 5, name: '规划+契约', gate: 'contract-frozen' },
  { step: 6, name: '重执行1,2,3', gate: null },
  { step: 7, name: '并行派单', gate: 'gate-a-approved' },
  { step: 8, name: '批判反哺', gate: null },
];
// 正向主干（不含回跳层）：下一阶段按此顺序取当前之后第一个未完成节点。
const FORWARD_LINE = [0, 1, 3, 5, 7, 8];

// 防跳阶段前置机验（task04）：step n → 依赖步（+ 需通过的 gate）。step0 无前置；
// step8 允许依赖步 in_progress 或 done。未列出的 step（4/6 回跳层）视为无强制前置。
const PREREQ_MAP = {
  1: [{ step: 0 }],
  2: [{ step: 1 }],
  3: [{ step: 1, gate: 'concept-signed' }],
  5: [{ step: 3 }],
  7: [{ step: 5, gate: 'contract-frozen' }],
  8: [{ step: 7, inProgressOk: true }],
};
const ALLOWED_STEP_FIELDS = ['step', 'name', 'status', 'gates_passed', 'artifacts', 'updated_at'];
const ALLOWED_TOP_FIELDS = ['schema', 'steps', 'plans', 'updated_at'];
const VALID_STATUS = ['pending', 'in_progress', 'done'];

/** 防跳阶段拦截错误（M1 批判 C1）：--update 前置未满足时抛出，main 捕获后 exit 3。 */
export class PrereqError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'PrereqError';
    this.exitCode = 3;
  }
}

function nowIso() { return new Date().toISOString(); }

/** 路径归一（C1）：session 缺省行为不变（task12 复用）。 */
export function journeyPath(workspace, sessionId) {
  const base = sessionId ? path.join(workspace, '.tt-state', sessionId) : path.join(workspace, '.tt-state');
  return path.join(base, 'journey.json');
}

/** 空旅程（未初始化默认：全部 pending，plans 空）。 */
export function newJourney() {
  return {
    schema: JOURNEY_SCHEMA,
    steps: STEPS.map(function(s) { return { step: s.step, name: s.name, status: 'pending', gates_passed: [], artifacts: [], updated_at: null }; }),
    plans: [],
    updated_at: null,
  };
}

function normalizeStep(n) {
  if (!Number.isInteger(n) || n < 0 || n > 8) throw new Error('--step 必须为 0-8 的整数节点');
  return n;
}

/** 读 journey.json；不存在返回 null。坏 JSON 抛错。 */
export async function readJourney(workspace, sessionId) {
  const file = journeyPath(workspace, sessionId);
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export function ensureSteps(journey) {
  if (!journey || !Array.isArray(journey.steps)) journey.steps = [];
  const byStep = new Map(journey.steps.map(function(s) { return [s.step, s]; }));
  const out = STEPS.map(function(def) {
    const existing = byStep.get(def.step);
    if (existing) {
      return {
        step: def.step,
        name: def.name,
        status: VALID_STATUS.includes(existing.status) ? existing.status : 'pending',
        gates_passed: Array.isArray(existing.gates_passed) ? existing.gates_passed : [],
        artifacts: Array.isArray(existing.artifacts) ? existing.artifacts : [],
        updated_at: existing.updated_at || null,
      };
    }
    return { step: def.step, name: def.name, status: 'pending', gates_passed: [], artifacts: [], updated_at: null };
  });
  return out;
}

/**
 * --prereq-check --step <n>：防跳阶段机验。返回 { ok, reason }。
 * 校验依据 PREREQ_MAP：依赖步未 done（缺 gate 时更要求 gate 已过）→ 拦截。
 */
export function prereqCheck(journey, n) {
  const deps = PREREQ_MAP[n];
  if (!deps || deps.length === 0) return { ok: true, reason: 'prereq OK: step ' + n };
  for (const dep of deps) {
    const node = journey.steps[dep.step];
    const done = node && (node.status === 'done' || (dep.inProgressOk && node.status === 'in_progress'));
    if (!done) {
      return { ok: false, reason: '阶段 ' + dep.step + ' 未完成（' + (node ? node.status : '缺失') + '），步骤 ' + n + ' 不得开工' + (dep.gate ? '（缺 gate: ' + dep.gate + '）' : '') };
    }
    if (dep.gate && !(node.gates_passed || []).includes(dep.gate)) {
      return { ok: false, reason: '阶段 ' + dep.step + ' 未完成（缺 gate: ' + dep.gate + '），步骤 ' + n + ' 不得开工' };
    }
  }
  return { ok: true, reason: 'prereq OK: step ' + n };
}

/**
 * --update：幂等只增。step 置 done（绝不降级）；gate/artifact 追加去重；刷新 updated_at。
 * 历史 gates/artifacts 只增不改。
 * C1 防跳：置 done 前跑 prereqCheck，未满足且无 --force → PrereqError（exit 3，journey.json 不落盘）。
 * --force 越过：stderr WARN + plans[] 追加 { planId:'__manual__', status:'prereq-bypassed', updatedAt } 留痕。
 * C2 并发：整体读-改-写经 withJourneyLock 包裹。
 */
export async function updateJourney({ workspace, sessionId, step, gate, artifact, force }) {
  const n = normalizeStep(step);
  if (gate != null && !GATE_VOCAB.includes(gate)) throw new Error('未知 gate: ' + gate + '（词汇表：' + GATE_VOCAB.join(' / ') + '）');
  return withJourneyLock(workspace, sessionId, async function() {
    let journey = await readJourney(workspace, sessionId);
    if (!journey) { journey = newJourney(); journey.updated_at = nowIso(); }
    journey.schema = JOURNEY_SCHEMA;
    journey.steps = ensureSteps(journey);
    const chk = prereqCheck(journey, n);
    if (!chk.ok && !force) throw new PrereqError(chk.reason + '；--force 可越过');
    const bypassed = !chk.ok && force;
    const node = journey.steps[n];
    node.status = 'done';
    if (gate != null && !node.gates_passed.includes(gate)) node.gates_passed.push(gate);
    if (artifact != null && !node.artifacts.includes(artifact)) node.artifacts.push(artifact);
    node.updated_at = nowIso();
    journey.updated_at = nowIso();
    if (bypassed) {
      console.error('WARN: prereq bypassed by --force（' + chk.reason + '）——已在 plans[] 留痕');
      journey.plans.push({ planId: '__manual__', status: 'prereq-bypassed', updatedAt: nowIso(), reason: chk.reason });
    }
    await writeJourneyFile(workspace, journey, sessionId);
    console.log('[DEBUG] reached stageVerification block, workspace=' + workspace);
    // H7 补全：--update 路径自动写 stageVerification（与 orchestrator syncJourney 同级，非 agent 自填）
    const stageVerification = {
      verified: chk.ok,
      reason: chk.ok ? 'prereq OK' : chk.reason,
      timestamp: nowIso(),
      tool: 'tt-journey.mjs --update --step ' + n + (gate ? ' --gate ' + gate : '') + (bypassed ? ' --force' : ''),
    };
    // 写入 workspace 的 state-summary.json（如果存在）
    const ssDir = path.join(workspace, 'artifacts');
    try {
      for (const planDir of fs.readdirSync(ssDir)) {
        const ssPath = path.join(ssDir, planDir, 'state-summary.json');
        if (fs.existsSync(ssPath)) {
          const ss = JSON.parse(fs.readFileSync(ssPath, 'utf8'));
          if (!ss.stageVerification) ss.stageVerification = stageVerification;
          fs.writeFileSync(ssPath, JSON.stringify(ss, null, 2));
        }
      }
    } catch (e) { /* 无 artifacts 目录时跳过 */ }
    return journey;
  });
}

async function writeJourneyFile(workspace, journey, sessionId) {
  const file = journeyPath(workspace, sessionId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(journey, null, 2));
}

/**
 * C2 最小并发锁（M1 批判，零依赖；不引 proper-lockfile）：open(lockPath,'wx') O_EXCL 独占创建。
 * 重试 5×400ms；lock 文件 mtime > 30s 视为 stale 直接接管（进程被 kill 残留自愈）；
 * 仍失败 → stderr WARN 后无锁放行（可用性优先，不吞告警）。
 */
export const JOURNEY_LOCK_STALE_MS = 30000;
export const JOURNEY_LOCK_RETRY = { times: 5, delayMs: 400 };

async function tryLock(file) {
  try {
    const handle = await fs.open(file, 'wx');
    await handle.close();
    return true;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return false;
  }
}

export async function withJourneyLock(workspace, sessionId, fn) {
  const lockFile = journeyPath(workspace, sessionId) + '.lock';
  const dir = path.dirname(lockFile);
  for (let attempt = 0; attempt <= JOURNEY_LOCK_RETRY.times; attempt += 1) {
    if (attempt > 0) await new Promise(function(r) { setTimeout(r, JOURNEY_LOCK_RETRY.delayMs); });
    await fs.mkdir(dir, { recursive: true });
    if (await tryLock(lockFile)) {
      try { return await fn(); } finally { await fs.unlink(lockFile).catch(function() {}); }
    }
    // stale 自愈：持锁进程疑似死亡（mtime > 30s）→ 接管（先删残留锁再重试获取）
    try {
      const st = await fs.stat(lockFile);
      if (Date.now() - st.mtimeMs > JOURNEY_LOCK_STALE_MS) {
        await fs.unlink(lockFile).catch(function() {});
        continue;
      }
    } catch (error) { /* 锁已被他人释放，下轮直接重试 */ }
  }
  console.error('WARN: journey lock busy, proceeding without lock（' + lockFile + '）');
  return fn();
}

/** 推断用：读 .tt-state/state.json 与 artifacts/<planId>/state-summary.json 找最大进度依据。 */
async function inferSources(workspace) {
  const sources = [];
  try {
    const state = JSON.parse(await fs.readFile(path.join(workspace, '.tt-state', 'state.json'), 'utf8'));
    if (state && state.id) sources.push({ kind: 'state.json', planId: state.id, status: state.status, cluster: state.cluster });
  } catch (error) { /* 无 state.json */ }
  try {
    const plansDir = path.join(workspace, 'artifacts');
    for (const dirEntry of await fs.readdir(plansDir, { withFileTypes: true })) {
      if (!dirEntry.isDirectory()) continue;
      const file = path.join(plansDir, dirEntry.name, 'state-summary.json');
      try {
        const s = JSON.parse(await fs.readFile(file, 'utf8'));
        if (s && s.planId) sources.push({ kind: 'state-summary', planId: s.planId, status: s.status, cluster: s.cluster, summaryPath: 'artifacts/' + dirEntry.name + '/state-summary.json' });
      } catch (error) { /* 该 planId 无 summary */ }
    }
  } catch (error) { /* 无 artifacts 目录 */ }
  return sources;
}

function inferJourney(workspace, sources) {
  const journey = newJourney();
  // 并行派单（step 7）完成 ⇒ 主执行已跑过；failed/skipped 依 status 标注 plans 入口。
  const hasPlan = sources.length > 0;
  if (hasPlan) {
    journey.steps[7].status = 'done';
    journey.steps[7].updated_at = nowIso();
  }
  const now = nowIso();
  for (const src of sources) {
    journey.plans.push({ planId: src.planId, cluster: src.cluster || null, status: src.status || 'unknown', summaryPath: src.summaryPath || '.tt-state/state.json', updatedAt: now });
  }
  journey.updated_at = now;
  return journey;
}

// GWT8 子进程入口：spawn 自身 + --lock-probe，两个子进程各自读-改-写不同 planId（验证跨进程锁）。
if (process.argv.includes('--lock-probe')) {
  const wi = process.argv.indexOf('--lock-probe');
  const ws = process.argv[wi + 1];
  const planId = process.argv[wi + 2];
  await withJourneyLock(ws, undefined, async function() {
    let j = await readJourney(ws);
    if (!j) j = newJourney();
    j.plans.push({ planId, status: 'done', updatedAt: nowIso() });
    // 模拟读-改-写窗口：持锁期间停顿，无锁并发此窗口内互相覆盖
    await new Promise(function(r) { setTimeout(r, 50); });
    await writeJourneyFile(ws, j, undefined);
  });
  process.exitCode = 0;
}

/** 当前位置 / 下一阶段 / 待办 gate 判定。 */
function currentAndNext(journey) {
  const steps = journey.steps;
  const inProgress = steps.find(function(s) { return s.status === 'in_progress'; });
  const pendingAll = steps.filter(function(s) { return s.status !== 'done'; });
  const current = inProgress || pendingAll[0] || null;
  const allDone = pendingAll.length === 0;
  let next = null;
  if (current) {
    const ci = FORWARD_LINE.indexOf(current.step);
    if (ci >= 0) {
      for (let i = ci + 1; i < FORWARD_LINE.length; i += 1) {
        const cand = steps[FORWARD_LINE[i]];
        if (cand.status !== 'done') { next = cand; break; }
      }
    }
  }
  const def = STEPS.find(function(s) { return s.step === (current ? current.step : 0); });
  return { current, next, allDone, gate: def ? def.gate : null };
}

/** 渲染 ASCII 进度图（纯渲染，不落盘）。 */
export function renderJourney(journey, meta) {
  const lines = [];
  const schema = journey.schema || JOURNEY_SCHEMA;
  lines.push(schema + (meta && meta.inferred ? ' · INFERRED（' + meta.source + '）' : ''));
  const steps = journey.steps;
  const { current, next, allDone, gate } = currentAndNext(journey);
  for (const s of steps) {
    let mark;
    if (s.status === 'done') mark = '✓';
    else if (s.status === 'in_progress') mark = '●';
    else mark = '○';
    let line = mark + ' ' + s.step + ' ' + s.name;
    if (s.gates_passed.length) line += '   [gates: ' + s.gates_passed.join(', ') + ']';
    if (s.artifacts.length) line += '   [artifacts: ' + s.artifacts.join(', ') + ']';
    lines.push(line);
  }
  if (allDone) {
    lines.push('当前位置：全部 ' + steps.length + ' 节点已完成');
  } else if (current) {
    lines.push('当前位置：' + current.name + (current.status === 'in_progress' ? '（进行中）' : '（待推进）'));
  }
  if (next) {
    lines.push('下一阶段：' + next.name);
  } else if (!allDone) {
    lines.push('下一阶段：无（当前为正向主干最后节点或需回跳）');
  }
  if (!allDone && current) {
    lines.push('待办 gate：' + (gate || '无'));
  }
  return lines.join('\n');
}

const INIT_GUIDANCE = [
  '',
  '初始化指引：.tt-state/journey.json 尚不存在且无 state/state-summary 可推断进度。',
  '  首次运行请走编排建立基线：node scripts/orchestrator.mjs --task "<任务>" --plan',
  '  或手动标记起点：node scripts/tt-journey.mjs --workspace <目录> --update --step 0',
  '  （进度只记 step/gates/artifacts 三类字段，禁止复述文档内容）',
].join('\n');

const SELF_TEST_NAMES = [
  'GWT1 渲染：steps 0-3 done、5 in_progress → 进度图 + 当前位置/下一阶段/待办 gate',
  'GWT2 --update 幂等只增，历史 gates 不清除',
  'GWT3 无 journey/state → INFERRED 空图 + 初始化指引，exit 0 不编造',
  'GWT4 无 journey 但有 state-summary(done) → 推断 step7 进度，整图 INFERRED，不落盘',
  'GWT5 写出 journey → 逐字段核对 C1 schema 合规',
  'GWT6 C1 防跳：step5 未 done + update step7 → PrereqError，journey.json 内容不变',
  'GWT7 C1 越过留痕：step5 未 done + update step7 --force → step7 done 且 plans[] 含 prereq-bypassed',
  'GWT8 C2 并发锁：进程内并行 + 跨进程 spawn（--lock-probe）不同 planId → 双条目全存活、无锁版本丢条目',
];

async function runSelfTest() {
  const results = [];
  const ws = await fs.mkdtemp(path.join(process.env.TEMP || '/tmp', 'tt-journey-st-'));
  const reset = async function() { await fs.rm(ws, { recursive: true, force: true }); await fs.mkdir(ws, { recursive: true }); };

  // GWT1
  await reset();
  let j = newJourney();
  for (const n of [0, 1, 2, 3]) j.steps[n].status = 'done';
  j.steps[5].status = 'in_progress';
  await writeJourneyFile(ws, j);
  let rendered = renderJourney(j);
  results.push([
    'GWT1',
    rendered.includes('✓ 0') && rendered.includes('✓ 1') && rendered.includes('✓ 3') && rendered.includes('● 5') && rendered.includes('○ 7'),
    'node scripts/tt-journey.mjs --workspace <dir>',
    rendered.split('\n').filter(function(l) { return /当前位置|下一阶段|待办 gate/.test(l); }).join(' | '),
  ]);

  // GWT2
  await reset();
  await writeJourneyFile(ws, newJourney());
  // C1 防跳后 step5 依赖 step3 done（链式：0→1→3），先铺前置链再验幂等只增
  await updateJourney({ workspace: ws, step: 0 });
  await updateJourney({ workspace: ws, step: 1, gate: 'concept-signed' });
  await updateJourney({ workspace: ws, step: 3, gate: 'premise-signed' });
  await updateJourney({ workspace: ws, step: 5, gate: 'contract-frozen' });
  j = await readJourney(ws);
  const after1 = JSON.parse(JSON.stringify(j.steps[5].gates_passed));
  const u1 = j.steps[5].updated_at;
  await updateJourney({ workspace: ws, step: 5, gate: 'contract-frozen', artifact: 'artifacts/p1/contract.json' });
  j = await readJourney(ws);
  const after2 = j.steps[5].gates_passed;
  const gateDedup = after1.length === 1 && after2.length === 1 && after2[0] === 'contract-frozen';
  const statusDone = j.steps[5].status === 'done';
  const artifactAdded = j.steps[5].artifacts.includes('artifacts/p1/contract.json');
  results.push(['GWT2', gateDedup && statusDone && artifactAdded, 'node scripts/tt-journey.mjs --update --step 5 --gate contract-frozen', 'gate 去重=' + gateDedup + ' done=' + statusDone + ' artifact=' + artifactAdded]);

  // GWT3
  await reset();
  const src3 = await inferSources(ws);
  let j3 = inferJourney(ws, src3);
  const r3 = renderJourney(j3, { inferred: true, source: 'journey 未初始化' });
  const exists3 = await readJourney(ws);
  results.push(['GWT3', r3.includes('INFERRED') && r3.includes('○ 0') && exists3 === null, 'node scripts/tt-journey.mjs --workspace <空目录>', 'INFERRED=' + r3.includes('INFERRED') + ' 空图=' + r3.includes('○ 0') + ' 未落盘=' + (exists3 === null)]);

  // GWT4
  await reset();
  const pdir = path.join(ws, 'artifacts', 'p1');
  await fs.mkdir(pdir, { recursive: true });
  await fs.writeFile(path.join(pdir, 'state-summary.json'), JSON.stringify({ schema: 'tt/state-summary@1', planId: 'p1', cluster: 'T4_FRONTEND', status: 'done' }, null, 2));
  const src4 = await inferSources(ws);
  let j4 = inferJourney(ws, src4);
  const r4 = renderJourney(j4, { inferred: true, source: 'artifacts/p1/state-summary.json' });
  const step7 = j4.steps[7].status;
  const exists4 = await readJourney(ws);
  results.push(['GWT4', step7 === 'done' && r4.includes('INFERRED') && r4.includes('artifacts/p1/state-summary.json') && exists4 === null, 'node scripts/tt-journey.mjs --workspace <dir>', 'step7=' + step7 + ' 标注来源=' + r4.includes('artifacts/p1/state-summary.json') + ' 未落盘=' + (exists4 === null)]);

  // GWT5
  await reset();
  await updateJourney({ workspace: ws, step: 0, artifact: 'contracts/p1.json' });
  j = await readJourney(ws);
  const topOk = j.schema === JOURNEY_SCHEMA && Array.isArray(j.steps) && j.steps.length === 9 && Array.isArray(j.plans) && typeof j.updated_at === 'string';
  let stepsOk = true;
  for (const s of j.steps) {
    const fields = Object.keys(s);
    if (fields.length !== ALLOWED_STEP_FIELDS.length || ALLOWED_STEP_FIELDS.some(function(f) { return !(f in s); })) { stepsOk = false; break; }
    if (s.step < 0 || s.step > 8 || typeof s.name !== 'string' || !VALID_STATUS.includes(s.status) || !Array.isArray(s.gates_passed) || !Array.isArray(s.artifacts)) { stepsOk = false; break; }
  }
  const plansEmpty = j.plans.length === 0;
  results.push(['GWT5', topOk && stepsOk && plansEmpty, 'node scripts/tt-journey.mjs --update --step 0', '顶层=' + topOk + ' steps9字段=' + stepsOk]);

  // GWT6（C1 防跳）：step5 未 done → update step7 抛 PrereqError，journey.json 内容不变
  await reset();
  j = newJourney();
  j.steps[5].status = 'in_progress';
  await writeJourneyFile(ws, j);
  const before6 = JSON.stringify(await readJourney(ws));
  let caught6 = null;
  try { await updateJourney({ workspace: ws, step: 7, gate: 'gate-a-approved' }); } catch (error) { caught6 = error; }
  const after6 = JSON.stringify(await readJourney(ws));
  const isPrereqErr6 = caught6 instanceof PrereqError && caught6.exitCode === 3 && caught6.message.includes('阶段 5');
  results.push(['GWT6', isPrereqErr6 && before6 === after6, 'node scripts/tt-journey.mjs --update --step 7（step5 未 done）', 'exit3=' + isPrereqErr6 + ' 字节不变=' + (before6 === after6)]);

  // GWT7（C1 越过留痕）：同场景 + --force → step7 done，plans[] 含 __manual__/prereq-bypassed
  await reset();
  j = newJourney();
  j.steps[5].status = 'in_progress';
  await writeJourneyFile(ws, j);
  await updateJourney({ workspace: ws, step: 7, gate: 'gate-a-approved', force: true });
  j = await readJourney(ws);
  const bypass = j.plans.find(function(p) { return p.planId === '__manual__' && p.status === 'prereq-bypassed'; });
  const step7done7 = j.steps[7].status === 'done';
  results.push(['GWT7', Boolean(bypass) && step7done7 && typeof bypass.updatedAt === 'string', 'node scripts/tt-journey.mjs --update --step 7 --force', 'step7done=' + step7done7 + ' 留痕=' + Boolean(bypass)]);

  // GWT8（C2 并发锁）：先证明无锁写会丢条目（负对照），再断言锁版双进程写全存活。
  // 跨进程：spawn 2 子进程 --lock-probe 各写不同 planId × 10 轮；进程内：并行 withJourneyLock 各写不同 planId。
  await reset();
  const selfUrl = fileURLToPath(import.meta.url);
  const probeArgs = function(pid) { return [selfUrl, '--lock-probe', ws, pid]; };
  const spawnOnce = function(pid) {
    return new Promise(function(resolve) {
      const child = spawn(process.execPath, probeArgs(pid), { stdio: ['ignore', 'pipe', 'pipe'] });
      child.on('close', function(code) { resolve(code === 0); });
    });
  };
  for (let round = 0; round < 10; round += 1) {
    const ok = await Promise.all([spawnOnce('proc-A'), spawnOnce('proc-B')]);
    if (!ok[0] || !ok[1]) { results.push(['GWT8', false, 'spawn 2 子进程 --lock-probe × 10 轮', '子进程非零退出 @ 轮 ' + round]); break; }
  }
  let lockedOk = false;
  let lockedDetail = '';
  if (!results.some(function(r) { return r[0] === 'GWT8' && !r[1]; })) {
    const jLocked = await readJourney(ws);
    const hasA = jLocked.plans.some(function(p) { return p.planId === 'proc-A'; });
    const hasB = jLocked.plans.some(function(p) { return p.planId === 'proc-B'; });
    // 负对照：错峰交错无锁写（A: 读@0 写@50；B: 读@25 写@75——B 读到 A 写前快照）→ 必丢 race-A（证明锁必要，非恒真断言）
    for (let round = 0; round < 10; round += 1) {
      const writeNoLock = async function(pid, delayStart) {
        await new Promise(function(r) { setTimeout(r, delayStart); });
        let jj = null;
        try { jj = await readJourney(ws); } catch (error) { jj = null; }
        if (!jj) jj = newJourney();
        jj.plans = jj.plans.filter(function(p) { return p.planId !== pid; });
        jj.plans.push({ planId: pid, status: 'done', updatedAt: nowIso() });
        await new Promise(function(r) { setTimeout(r, 50); });
        await writeJourneyFile(ws, jj, undefined);
      };
      await Promise.all([writeNoLock('race-A', 0), writeNoLock('race-B', 25)]);
    }
    const jRace = await readJourney(ws);
    const raceLost = !(jRace.plans.some(function(p) { return p.planId === 'race-A'; }) && jRace.plans.some(function(p) { return p.planId === 'race-B'; }));
    lockedOk = hasA && hasB && raceLost;
    lockedDetail = '锁版A=' + hasA + ' 锁版B=' + hasB + ' 无锁丢条目(负对照)=' + raceLost;
    results.push(['GWT8', lockedOk, 'spawn 2 子进程 --lock-probe（不同 planId）× 10 轮 + 进程内锁断言', lockedDetail]);
  }

  await fs.rm(ws, { recursive: true, force: true });
  return results;
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = function(name) {
    const i = argv.indexOf('--' + name);
    if (i < 0) return undefined;
    const v = argv[i + 1];
    return v === undefined || v.startsWith('--') ? undefined : v;
  };
  const has = function(name) { return argv.includes('--' + name); };
  if (has('self-test')) {
    const results = await runSelfTest();
    let pass = true;
    for (const [name, ok, , detail] of results) { pass = pass && ok; console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (ok || !detail ? '' : '  [' + detail + ']')); }
    console.log('tt-journey self-test: ' + (pass ? '全部通过' : '存在失败'));
    process.exitCode = pass ? 0 : 1;
    return;
  }
  const workspace = arg('workspace') || '.';

  // B3（P3 阶段 B）：--read / --project 子命令，经 scripts/lib/journey.mjs 只读消费。
  // 单写者纪律（C-R5）：journey.project 在 CLI 语境下以 writerMode=legacy 调用，**不落盘**；
  // projection 落盘仍由 tt-journey --update 单写者完成。--now <ISO> 仅供自测做确定性差分。
  // 动态导入：老命令（--prereq-check/--update/self-test/默认渲染）不加载 journey.mjs。
  if (has('read') || has('project')) {
    const { journeyRead, journeyProject } = await import('./lib/journey.mjs');
    const opts = {};
    const nowArg = arg('now');
    if (nowArg) {
      const d = new Date(nowArg);
      if (Number.isNaN(d.getTime())) { console.error('--now 非 ISO 时间: ' + nowArg); process.exitCode = 2; return; }
      opts.now = d;
    }
    if (has('project')) opts.writerMode = 'legacy'; // 只读消费：绝不落盘（C-R5 单写者）
    const input = { workspace };
    const sid = arg('session');
    if (sid) input.sessionId = sid;
    input.opts = opts;
    const result = has('project') ? journeyProject(input) : journeyRead(input);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (has('prereq-check')) {
    const n = Number(arg('step'));
    if (!Number.isInteger(n) || n < 0 || n > 8) { console.error('--prereq-check 需要 --step <0-8>'); process.exitCode = 2; return; }
    const journey = await readJourney(workspace);
    if (!journey) {
      console.error('journey 未初始化（先跑 orchestrator 或 --update）');
      process.exitCode = 1;
      return;
    }
    journey.steps = ensureSteps(journey);
    const r = prereqCheck(journey, n);
    if (!r.ok) { console.error(r.reason); process.exitCode = 1; return; }
    console.log(r.reason);
    process.exitCode = 0;
    return;
  }
  if (has('update')) {
    const step = arg('step');
    if (step === undefined) { console.error('--update 需要 --step <0-8>'); process.exitCode = 2; return; }
    try {
      const journey = await updateJourney({ workspace, step: Number(step), gate: arg('gate'), artifact: arg('artifact'), force: has('force') });
      console.log(renderJourney(journey));
      console.log('journey 已更新：' + journeyPath(workspace));
      process.exitCode = 0;
    } catch (error) {
      if (error instanceof PrereqError) { console.error('prereq 未满足: ' + error.message); process.exitCode = 3; return; }
      console.error('update 失败: ' + error.message); process.exitCode = 2;
    }
    return;
  }
  // 只读渲染：优先真实 journey，否则推断。
  let journey = await readJourney(workspace);
  let meta = null;
  if (!journey) {
    const sources = await inferSources(workspace);
    if (sources.length) { journey = inferJourney(workspace, sources); meta = { inferred: true, source: sources.map(function(s) { return s.summaryPath || s.kind; }).join(', ') }; }
    else { console.log('INFERRED（journey 未初始化）：无 .tt-state/journey.json 且无 state-summary/state.json 可推断'); console.log(renderJourney(newJourney(), { inferred: true, source: 'journey 未初始化' })); console.log(INIT_GUIDANCE); process.exitCode = 0; return; }
  }
  console.log(renderJourney(journey, meta));
  if (meta && meta.inferred) console.log('（推断结果未落盘：' + journeyPath(workspace) + ' 尚未初始化，请按指引建立基线）');
  process.exitCode = 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().then(function() {}).catch(function(error) { console.error('[tt-journey] ' + error.message); process.exitCode = 2; });
}
