#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createLogger } from './lib/logger.mjs';
import { buildManifest, loadManifest } from './lib/manifest.mjs';
import { loadAssets } from './lib/asset.mjs';
import { buildPlan, NoMatchError, isFrontendImplementation } from './lib/planner.mjs';
import { executePlan } from './lib/runtime.mjs';
import { createStore } from './lib/store.mjs';
import { writeReport } from './lib/report.mjs';
import { runValidate } from './lib/regression.mjs';
import { ContractViolationError } from './lib/gate.mjs';
import { EXIT } from './lib/errors.mjs';
import { runDeconstructFlow, normalizeDraft, validateDraft, formatErrors } from './lib/deconstruct.mjs';
import { approveDraft, printApprovalSummary, printDraft } from './lib/approve.mjs';
import { createTui } from './lib/tui.mjs';
import { readJourney, newJourney, ensureSteps, journeyPath, updateJourney, prereqCheck, withJourneyLock } from './tt-journey.mjs';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');
const VENDOR_DIR = path.join(SKILL_DIR, 'vendor');
const EXIT_APPROVAL_ABORTED = 6;
function parseArgs(args) {
  const out = { task: '', workspace: '.', dryRun: false, verbose: false, help: false, resume: false, validate: false, plan: false, draft: null, backend: 'auto', maxRetries: undefined, exec: null, execTimeoutMs: undefined, parallel: undefined, contract: null, contractDraft: null, tui: false, noTui: false, hosts: null, configHosts: null, argError: null, session: undefined };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--verbose') out.verbose = true;
    else if (arg === '--resume') out.resume = true;
    else if (arg === '--validate') out.validate = true;
    else if (arg === '--plan') out.plan = true;
    else if (arg === '--tui') out.tui = true;
    else if (arg === '--no-tui') out.noTui = true;
    else if (arg === '--draft') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.argError = '--draft 需要一个值 (拆解草案 JSON 文件路径)'; else { out.draft = v; i += 1; } }
    else if (arg === '--backend') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.argError = '--backend 需要一个值 (auto|prompt|cli)'; else { out.backend = v; i += 1; } }
    else if (arg === '--max-retries') { out.maxRetries = Number(args[i + 1]); i += 1; }
    else if (arg === '--exec-timeout') { out.execTimeoutMs = Number(args[i + 1]); i += 1; }
    else if (arg === '--parallel') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.parallel = Infinity; else { out.parallel = Number(v); i += 1; } }
    else if (arg === '--hosts') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.argError = '--hosts 需要一个值 (逗号分隔的备选宿主命令，如 "node host1.mjs,node host2.mjs --model gpt-5.6-luna")'; else { out.hosts = v; i += 1; } }
    else if (arg === '--contract') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.argError = '--contract 需要一个值 (OpenAPI JSON 文件路径)'; else { out.contract = v; i += 1; } }
    else if (arg === '--contract-draft') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.argError = '--contract-draft 需要一个值 (棕地契约草案 JSON 路径)'; else { out.contractDraft = v; i += 1; } }
    else if (arg === '--exec') { const collected = []; const KNOWN = new Set(['--task', '--workspace', '--backend', '--max-retries', '--exec-timeout', '--parallel', '--contract', '--contract-draft', '--hosts', '--dry-run', '--verbose', '--resume', '--validate', '--plan', '--draft', '--tui', '--no-tui', '--help', '-h']); while (i + 1 < args.length && !KNOWN.has(args[i + 1])) { collected.push(args[i + 1]); i += 1; } out.exec = collected.length ? collected : null; }
    else if (arg === '--task') { out.task = args[i + 1]; if (out.task === undefined) out.task = ''; i += 1; }
    else if (arg === '--workspace') { out.workspace = args[i + 1]; if (out.workspace === undefined) out.workspace = '.'; i += 1; }
    else if (arg === '--session') { const v = args[i + 1]; if (v === undefined || v.startsWith('--')) out.argError = '--session 需要一个值 (命名空间 id，仅 [A-Za-z0-9_-]+)'; else if (!/^[A-Za-z0-9_-]+$/.test(v)) out.argError = '--session 非法：仅允许 [A-Za-z0-9_-]+（防路径穿越）'; else { out.session = v; i += 1; } }
  }
  return out;
}
function usage() { console.log('Usage: node scripts/orchestrator.mjs --task TASK [--workspace PATH] [--backend auto|prompt|cli] [--exec PROG [ARGS...]] [--exec-timeout N] [--max-retries N] [--hosts "HOST1,HOST2..."] [--parallel [N]] [--contract OPENAPI.json] [--plan] [--draft DRAFT.json] [--tui] [--no-tui] [--dry-run] [--verbose] [--resume] [--validate]'); console.log('--plan: 自动拆解 + 逐 task 审批后冻结进编排（与 --resume 互斥；可组合 --exec 宿主拆解或 --draft 草案文件/手动粘贴）。--plan --dry-run 只打印草案与审批摘要，不写任何文件。'); console.log('--tui: 执行时叠加实时 DAG 视图（纯 ANSI 自绘，状态色 + 瓶颈反色；仅叠加渲染，不改变执行语义）。非 TTY 自动降级为一次性静态文本；TT_TUI=off 或 --no-tui 完全不渲染。独立复盘用 node scripts/tt-tui.mjs [--workspace PATH]。'); console.log('--exec 后的未知 --flag/值会原样透传给宿主（如 --model gpt-5.6-luna，供 exec-host-a6api.mjs 跨模型批判）；已知编排器参数（--task/--workspace 等）会结束透传段。'); console.log('--hosts: 逗号分隔的备选宿主命令（如 "node exec-host-openclaw.mjs,node exec-host-a6api.mjs --model gpt-5.6-luna"）；主宿主(--exec/config executor.command)失败时自动按序换宿主/换模型重试（失败自动恢复），全失败 → 诚实降级 degraded + warning。也可在 config.json 的 executor.hosts（数组，每项 command 数组）固化。'); }
async function readConfig() {
  try { return JSON.parse(await fs.readFile(path.join(SKILL_DIR, 'config.json'), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
/** 判定已解析 JSON 是否为可消费 OpenAPI 规范（v3 openapi / v2 swagger）。描述串/冻结文件不满足。 */
function isOpenApiSpec(doc) {
  return Boolean(doc) && typeof doc === 'object' && !Array.isArray(doc)
    && (typeof doc.openapi === 'string' || typeof doc.swagger === 'string');
}
/**
 * FR-3 前端按契约实现（契约硬前置）：对「调用后端接口的前端实现」子任务，
 * 开工前必须有真实冻结契约（--contract OpenAPI 或 contracts/<planId>.json 为 OpenAPI）。
 *  - 有真实契约 → 指向它（contractMode:'frozen'，文件存在 → runtime 正常派单）。
 *  - 无真实契约 → 指向不存在路径（contractMode:'frozen' → runtime CONTRACT_NOT_FROZEN skip + 计划 failed exit 5，
 *    提示先冻结契约/提供 --contract，不派前端实现）。
 * 返回受影响的子任务数。
 */
async function applyFrontendContractGate(plan, workspace, contractSource) {
  const candidates = plan.subtasks.filter(function(s) { return isFrontendImplementation(s, plan); });
  if (!candidates.length) return 0;
  let realContract = null;
  if (contractSource) {
    const abs = path.isAbsolute(contractSource) ? contractSource : path.join(workspace, contractSource);
    try { const doc = JSON.parse(await fs.readFile(abs, 'utf8')); if (isOpenApiSpec(doc)) realContract = contractSource; } catch (error) { /* 非可读 OpenAPI */ }
  }
  if (!realContract) {
    const frozenPath = path.join('contracts', plan.id + '.json');
    try { const doc = JSON.parse(await fs.readFile(path.join(workspace, frozenPath), 'utf8')); if (isOpenApiSpec(doc)) realContract = frozenPath; } catch (error) { /* 非可读 OpenAPI */ }
  }
  for (const s of candidates) {
    s.contractMode = 'frozen';
    s.contract = realContract || path.join('contracts', plan.id + '.frontend-missing.json');
  }
  return candidates.length;
}
/** 从上次 state.json 恢复 plan；done 保留、skipped/failed 重试。 */
async function resumePlan(store, logger) {
  const previous = await store.load();
  if (!previous) { logger.warn('no saved state to resume (run once without --resume first)'); return null; }
  if (!Array.isArray(previous.subtasks)) { logger.warn('saved state has no subtasks, cannot resume'); return null; }
  const remaining = previous.subtasks.filter(function(subtask) { return subtask.status !== 'done'; });
  if (!remaining.length) { logger.info('plan ' + previous.id + ' already complete: ' + previous.status + ' (no subtask to resume)'); return previous; }
  logger.info('resume plan ' + previous.id + ' status=' + previous.status + ' remaining=' + remaining.length + ' (skipped/failed retried, done skipped)');
  previous.status = 'executing';
  return previous;
}
/** 契约冻结：把 plan 的 contract 落为 contracts/<planId>.json，供 gate json 模式做真实 hash 比对。 */
async function freezeContract(plan, workspace, contractSource) {
  const dir = path.join(workspace, 'contracts');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, plan.id + '.json');
  const payload = { planId: plan.id, cluster: plan.cluster, contract: plan.contract, task: plan.task, frozenAt: new Date().toISOString() };
  if (contractSource) payload.contractSource = contractSource;
  await fs.writeFile(file, JSON.stringify(payload, null, 2));
  return path.join('contracts', plan.id + '.json');
}
// IMP-1 批判 backlog tracker 解析（与 critique-backlog-next.mjs 同源语义：列对齐 + 待落地判定），
// 内联副本以避免 import 脚本时顶层 main() 副作用；读不到 tracker 一律返回 null（不阻断）。
const BL_COLS = { '#': 'serial', '批判': 'title', '级别': 'level', '修复': 'fix', '落点': 'ctx', '验收': 'accept', '状态': 'status' };
const BL_PENDING_RE = /^[⬜◐]|(?:待落地|待复验|待[\u4e00-\u9fa5]*)/;
function parseBacklogRows(text) {
  const blocks = [];
  let block = null;
  const flush = function() { if (block) { blocks.push(block); block = null; } };
  for (const raw of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const t = raw.trim();
    if (/^\|\s*#/.test(t) && (t.includes('批判') || t.includes('落点'))) {
      flush();
      const cells = t.split('|').map(function(c) { return c.trim(); });
      const col = {};
      for (let i = 0; i < cells.length; i += 1) {
        for (const [name, key] of Object.entries(BL_COLS)) {
          if (cells[i] === name || (name !== '#' && name !== '状态' && cells[i].includes(name))) { if (!(key in col)) col[key] = i; }
          else if (cells[i].includes('状态')) col.status = i;
        }
      }
      block = { col, rows: [] };
      continue;
    }
    if (block && /^\|/.test(t) && !/^\|[\s:-]+\|$/.test(t)) {
      const cells = t.split('|').map(function(c) { return c.trim(); });
      const get = function(k) { return cells[block.col[k]]; };
      const serialRaw = get('serial') ?? cells[0];
      const m = String(serialRaw || '').match(/C-(\d+)/);
      if (m) block.rows.push({
        serial: 'C-' + String(parseInt(m[1], 10)).padStart(2, '0'),
        title: (get('title') ?? '').replace(/（来源：.+?）/, '').trim(),
        fix: (get('fix') ?? '').trim(),
        status: (get('status') ?? '').trim(),
        raw: t,
      });
      continue;
    }
    if (/^#/.test(t) && !/^\|/.test(t)) flush();
  }
  flush();
  const out = [];
  for (const b of blocks) out.push(...b.rows);
  return out;
}
function backlogIsPending(r) {
  if (!r.status) return BL_PENDING_RE.test(r.raw);
  if (/^✅/.test(r.status) || /^❌/.test(r.status)) return false;
  if (/^[⬜◐]/.test(r.status)) return true;
  return BL_PENDING_RE.test(r.status);
}
async function readCritiqueBacklog() {
  try {
    const text = await fs.readFile(path.join(SKILL_DIR, 'plans', 'critique-backlog-tracker.md'), 'utf8');
    const rows = parseBacklogRows(text);
    const pending = rows.filter(backlogIsPending);
    return { open: pending.length, nextItems: pending.map(function(r) { return r.serial + ' ' + String(r.fix || r.title || '').replace(/\s+/g, ' ').trim(); }) };
  } catch (error) { return null; }
}
/**
 * F1 journey 派生（task02）：与 state-summary 同源、单点写。成功/失败/resume 均经 writeStateSummary
 * 或 resume 短路分支调用；dry-run 不写盘。历史 gates/artifacts 只增不改。
 * 派生写入点唯一：本函数 + --update 手动标记（gate 级只增，两口径可交叉核对）。
 * sessionId 供 task12 --session 命名空间复用（缺省行为不变）。
 * C1（M1 批判）：写前跑 prereqCheck，失败仅 warning 不阻断——派生是事实记录非状态推进，
 * 失败路径派生若被误拦截会丢失败记录。step8 无 PREREQ_MAP 依赖（inProgressOk 已在 map），
 * 派生只动 plans[]/step7（map 无 7 项），warning 路径仅覆盖未来 map 扩展或极端脏数据。
 * C2：读-改-写整体经 withJourneyLock 包裹（与 --update 同一把锁）。
 */
async function syncJourney(workspace, result, sessionId) {
  const plan = result && result.plan;
  if (!plan) return;
  return withJourneyLock(workspace, sessionId, async function() {
    let journey = await readJourney(workspace, sessionId);
    if (!journey) journey = newJourney();
    journey.schema = 'yy/journey@1';
    journey.steps = ensureSteps(journey);
    const chk = prereqCheck(journey, 8);
    if (!chk.ok) console.error('WARN: journey 派生 prereq 校验未过（' + chk.reason + '）——事实记录不阻断，继续写入');
    const now = new Date().toISOString();
    journey.updated_at = now;
    const summaryPath = 'artifacts/' + plan.id + '/state-summary.json';
    const entry = {
      planId: plan.id,
      cluster: plan.cluster || null,
      status: plan.status || 'unknown',
      summaryPath,
      updatedAt: now,
    };
    const existing = journey.plans.findIndex(function(p) { return p.planId === plan.id && (p.summaryPath || '') === summaryPath; });
    if (existing >= 0) journey.plans[existing] = entry;
    else journey.plans.push(entry);
    const file = path.join(workspace, '.tt-state', sessionId ? sessionId : '', 'journey.json').replace(/\\/g, '/');
    await fs.mkdir(path.dirname(file), { recursive: true });
    // H7 修复：orchestrator 自动机验记录写入产物（非 agent 自填，不可伪造）
    const prereqResult = prereqCheck(journey, 8);
    const stageVerification = {
      verified: prereqResult.ok,
      reason: prereqResult.reason || 'prereq OK',
      timestamp: now,
      tool: 'tt-journey.mjs --prereq-check --step 8 (auto by orchestrator)',
    };
    const summaryFile = path.join(workspace, summaryPath.replace(/\//g, path.sep));
    try {
      await fs.mkdir(path.dirname(summaryFile), { recursive: true });
      const summaryJson = JSON.parse(await fs.readFile(summaryFile, 'utf8'));
      summaryJson.stageVerification = stageVerification;
      await fs.writeFile(summaryFile, JSON.stringify(summaryJson, null, 2));
    } catch (error) { /* state-summary 可能尚未写 */ }
    await fs.writeFile(file, JSON.stringify(journey, null, 2));
    return journey;
  });
}

/** IMP-1 机器可读 state 摘要：新会话程序化恢复断点用（不替代 memory-snapshot.md / execution-feedback.md）。
 * 所有文件字段为 workspace 相对路径（正斜杠），portable；失败路径也写（schema status='failed'）。 */async function writeStateSummary(result, workspace) {
  const plan = result.plan;
  const planId = plan.id;
  const subs = Array.isArray(plan.subtasks) ? plan.subtasks : [];
  const modes = plan.modes || {};
  const doneN = subs.filter(function(s) { return s.status === 'done'; }).length;
  const failedN = subs.filter(function(s) { return s.status === 'failed'; }).length;
  const skippedN = subs.filter(function(s) { return s.status === 'skipped'; }).length;
  const consumedN = subs.filter(function(s) { return s.assetConsumed === true; }).length;
  const callRate = subs.length > 0 ? (consumedN / subs.length * 100).toFixed(1) : '0.0';
  const briefOnlyN = subs.filter(function(s) { return s.mode === 'prompt' && s.assetConsumed !== true; }).length;
  const depPreconditionN = subs.filter(function(s) { return s.error === 'DEP_PRECONDITION'; }).length;
  // C-27 域声明机验（FR-5 GWT）：subtask 条目 domainDeclared===false 计为缺失；字段不存在（旧数据）不算缺失（N/A 不误伤）；true 正常。
  // 仅聚合落字段，不改退出行为（summary.total>0 且缺失>0 时同样只落字段）。
  const domainDeclaredMissingN = subs.filter(function(s) { return s.domainDeclared === false; }).length;
  const blocked = [];
  for (const s of subs) if (s.status === 'skipped' || s.status === 'failed') { if (!blocked.includes(s.asset)) blocked.push(s.asset); }
  const seen = new Set();
  const recovery = [];
  for (const s of subs) {
    const list = Array.isArray(s.recovery) ? s.recovery : [];
    for (const r of list) {
      const label = r.stage + ' ' + r.from + '→' + r.to;
      if (!seen.has(label)) { seen.add(label); recovery.push(label); }
    }
  }
  let contractFrozen = null;
  try { await fs.access(path.join(workspace, 'contracts', planId + '.json')); contractFrozen = 'contracts/' + planId + '.json'; } catch (error) { /* 未冻结 */ }
  const hasFile = async function(abs) { try { await fs.access(abs); return true; } catch (error) { return false; } };
  const artifactDir = path.join(workspace, 'artifacts', planId);
  const backlog = await readCritiqueBacklog();
  const summary = {
    schema: 'tt/state-summary@1',
    planId: plan.id,
    task: plan.task,
    cluster: plan.cluster,
    status: plan.status,
    degraded: plan.degraded === true,
    generatedAt: new Date().toISOString(),
    modes,
    summary: {
      total: subs.length,
      done: doneN,
      failed: failedN,
      skipped: skippedN,
      assetConsumed: consumedN,
      assetCallRate: callRate + '%',
      requireExecViolation: plan.requireExec === true ? briefOnlyN : 0,
      depPrecondition: depPreconditionN,
      domainDeclaredMissing: domainDeclaredMissingN,
      blockedSubtasks: blocked,
      contractFrozen,
      recovery,
    },
    critiqueBacklog: backlog,
    files: {
      state: '.tt-state/state.json',
      memorySnapshot: (await hasFile(path.join(artifactDir, 'memory-snapshot.md'))) ? 'artifacts/' + planId + '/memory-snapshot.md' : null,
      executionFeedback: (await hasFile(path.join(artifactDir, 'execution-feedback.md'))) ? 'artifacts/' + planId + '/execution-feedback.md' : null,
      report: (await hasFile(path.join(workspace, 'artifacts', 'report-' + planId + '.md'))) ? 'artifacts/report-' + planId + '.md' : null,
    },
  };
  if (backlog === null) summary.critiqueBacklogNote = 'critique backlog tracker 不可读（plans/critique-backlog-tracker.md 缺失），open/nextItems 置 null——不阻断后续动作';
  const dir = path.join(workspace, 'artifacts', planId);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, 'state-summary.json');
  await fs.writeFile(file, JSON.stringify(summary, null, 2));
  // F1 同源派生 journey（task02）：writeStateSummary 是唯一派生写入点（成功/失败路径共用）
  await syncJourney(workspace, result);
  return path.join('artifacts', planId, 'state-summary.json');
}
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { usage(); return EXIT.OK; }
  if (opts.argError) { console.error(opts.argError); return EXIT.ARGS; }
  if (opts.resume && opts.dryRun) { console.error('--resume 不能与 --dry-run 同时使用'); return EXIT.ARGS; }
  if (opts.plan && opts.resume) { console.error('--plan 不能与 --resume 同时使用'); return EXIT.ARGS; }
  if (!['auto', 'prompt', 'cli'].includes(opts.backend)) { console.error('--backend 仅支持 auto|prompt|cli'); return EXIT.ARGS; }
  if (opts.maxRetries !== undefined && (!Number.isInteger(opts.maxRetries) || opts.maxRetries < 0)) { console.error('--max-retries 必须是非负整数'); return EXIT.ARGS; }
  if (opts.execTimeoutMs !== undefined && (!Number.isInteger(opts.execTimeoutMs) || opts.execTimeoutMs < 1)) { console.error('--exec-timeout 必须是正整数（毫秒）'); return EXIT.ARGS; }
  if (opts.parallel !== undefined && opts.parallel !== Infinity && (!Number.isInteger(opts.parallel) || opts.parallel < 1)) { console.error('--parallel 必须是正整数（缺省 = 全部并行）'); return EXIT.ARGS; }
  if (!opts.task.trim() && !opts.resume) { console.error('任务不能为空（使用 --resume 恢复上次计划）'); return EXIT.ARGS; }
  const logger = createLogger(opts.verbose);
  // workspace 落产物/状态；默认取 config.json 的 projectRoot，未配置则当前目录。vendor 资产始终用随包副本。
  const cfg = await readConfig();
  if (!opts.exec && cfg && Array.isArray(cfg.executor && cfg.executor.command) && cfg.executor.command.length) opts.exec = cfg.executor.command;
  if (opts.execTimeoutMs === undefined && cfg && cfg.executor && Number.isInteger(cfg.executor.timeoutMs) && cfg.executor.timeoutMs > 0) opts.execTimeoutMs = cfg.executor.timeoutMs;
  // P1 失败自动恢复：config.json executor.hosts 为备选宿主来源（优先级低于命令行 --hosts，dispatch 内 resolveHosts 裁决）
  if (cfg && Array.isArray(cfg.executor && cfg.executor.hosts) && cfg.executor.hosts.length) opts.configHosts = cfg.executor.hosts;
  let workspaceArg = opts.workspace;
  if (workspaceArg === '.' && cfg && cfg.projectRoot && !String(cfg.projectRoot).includes('<')) workspaceArg = cfg.projectRoot;
  const workspace = path.resolve(workspaceArg);
  const store = createStore(workspace);
  logger.info('state: idle');
  // --contract（绿地 OpenAPI）与 --contract-draft（棕地草案）互斥
  if (opts.contract && opts.contractDraft) { console.error('--contract 与 --contract-draft 互斥：真 OpenAPI 走真校验，棕地草案走降级确认'); return EXIT.ARGS; }
  // --contract 用户提供的 OpenAPI 契约：文件必须存在（契约本体以该文件为准），缺失明确报错不静默降级
  if (opts.contract) {
    const contractAbs = path.isAbsolute(opts.contract) ? opts.contract : path.join(workspace, opts.contract);
    try { await fs.access(contractAbs); } catch (error) { console.error('--contract 文件不存在: ' + opts.contract + '（已解析为 ' + contractAbs + '）'); return EXIT.ARGS; }
  }
  // --contract-draft 棕地契约草案：文件必须存在；内容须为 draft JSON（含 draft:true 或非 OpenAPI）——存在即可读（缺失/坏 JSON 报错）
  if (opts.contractDraft) {
    const draftAbs = path.isAbsolute(opts.contractDraft) ? opts.contractDraft : path.join(workspace, opts.contractDraft);
    try {
      const doc = JSON.parse(await fs.readFile(draftAbs, 'utf8'));
      const isOpenApi = Boolean(doc && (typeof doc.openapi === 'string' || typeof doc.swagger === 'string'));
      const isDraft = Boolean(doc && doc.draft === true);
      if (isOpenApi && !isDraft) logger.warn('--contract-draft 指向的是已确认 OpenAPI（无 draft:true，应改用 --contract 走真校验）；仍按草案处理');
    } catch (error) { console.error('--contract-draft 文件不存在或非 JSON: ' + opts.contractDraft + '（' + error.message + '）'); return EXIT.ARGS; }
  }
  let plan = null;
  let manifest = null;
  if (opts.resume) {
    plan = await resumePlan(store, logger);
    // resume 复用旧契约：文件缺失会令 json gate 静默降级 describe，必须显式告警
    if (plan && plan.subtasks.length) {
      const c = plan.subtasks[0].contract;
      if (c && !path.isAbsolute(c)) {
        try { await fs.access(path.join(workspace, c)); } catch (error) { logger.warn('contract file missing: ' + c + ' — 冻结契约缺失，resume 时子任务将 CONTRACT_NOT_FROZEN skip，建议重新 --task 运行以重冻结'); }
      }
    }
    // 全部子任务已完成：不重跑，直接出报告退出
    if (plan && plan.subtasks.every(function(subtask) { return subtask.status === 'done'; })) {
      logger.info('state: done');
      const report = await writeReport({ plan, context: {} }, workspace);
      logger.info('report: ' + report.markdown);
      // F1 resume 全部完成短路分支也补一次 journey 同步（task02：不滞留旧位置）
      await syncJourney(workspace, { plan }, opts.session);
      return EXIT.OK;
    }
  }
  if (!plan) {
    if (opts.dryRun) manifest = await buildManifest({ vendorDir: VENDOR_DIR });
    else manifest = await loadManifest({ vendorDir: VENDOR_DIR, stateDir: path.join(workspace, '.tt-state'), refresh: false });
    logger.info('state: planning');
    if (opts.plan) {
      // M1 --plan 流程：拆解草案（宿主或手动）→ 逐 task 审批 → 归一化 plan → 冻结 → 既有执行路径。
      // dry-run + 宿主拆解写到临时 workspace，不污染真实 workspace（FR-3 GWT3：不写 state/contracts/产物）。
      let planWs = workspace;
      if (opts.dryRun && Array.isArray(opts.exec) && opts.exec.length) planWs = await fs.mkdtemp(path.join(os.tmpdir(), 'tt-plan-dry-'));
      const draftFlow = await runDeconstructFlow({ task: opts.task, manifest, exec: opts.exec, execTimeoutMs: opts.execTimeoutMs, workspace: planWs, draftFile: opts.draft });
      if (planWs !== workspace) { try { await fs.rm(planWs, { recursive: true, force: true }); } catch (error) { /* 临时目录清理失败不阻断 */ } }
      if (!draftFlow.ok) {
        console.error('[tt] ' + draftFlow.error);
        return EXIT_APPROVAL_ABORTED;
      }
      if (opts.dryRun) {
        console.log(printApprovalSummary(draftFlow.draft));
        console.log('--- 拆解草案（--plan --dry-run 不写任何文件，仅打印草案与审批摘要） ---');
        console.log(printDraft(draftFlow.draft));
        logger.info('state: done');
        return EXIT.OK;
      }
      const assetNames = (manifest.entries || []).map(function(e) { return e.name; });
      const approval = await approveDraft(draftFlow.draft, { logger, forceNonInteractive: draftFlow.fromStdin === true, assetNames });
      if (!approval.approved) {
        const why = approval.reason === 're-decompose' ? '已选择回拆解' : approval.reason === 'non-interactive' ? '非交互环境未执行逐 task 审批' : approval.reason === 'abort' ? '审批中断' : approval.reason === 'invalid' ? '审批后校验失败' : approval.reason;
        console.error('[tt] 审批中止（' + why + '）——未产生正式 plan、未写 contracts、未污染状态文件');
        return EXIT_APPROVAL_ABORTED;
      }
      const postV = validateDraft(approval.draft, manifest);
      if (!postV.ok) { console.error('[tt] ' + formatErrors(postV.errors)); return EXIT_APPROVAL_ABORTED; }
      plan = normalizeDraft(approval.draft, manifest);
      if (approval.draft.approvedAt) plan.approvedAt = approval.draft.approvedAt;
    } else {
      plan = buildPlan(opts.task, manifest);
    }
    for (const subtask of plan.subtasks) subtask.task = plan.task;
    // --contract 提供 OpenAPI 契约：be-validator 子任务契约指向该文件（portman 真校验路径），其他子任务保持 cluster 描述不变
    if (opts.contract) {
      const applied = [];
      for (const subtask of plan.subtasks) if (subtask.asset === 'be-validator') { subtask.contract = opts.contract; applied.push(subtask.id + ' -> ' + opts.contract); }
      if (applied.length) logger.info('contract override (--contract): ' + applied.join(' | '));
    }
    // --contract-draft 棕地草案：be-validator 契约指向草案但标记 brownfield（不跑真校验，待 --contract 升级）；前端子任务可凭草案开工
    if (opts.contractDraft) {
      plan.brownfield = true;
      plan.contractMode = 'brownfield-draft';
      plan.contractSource = opts.contractDraft;
      for (const subtask of plan.subtasks) {
        if (subtask.asset === 'be-validator') { subtask.contract = opts.contractDraft; subtask.brownfieldDraft = true; }
        else if (isFrontendImplementation(subtask, plan)) { subtask.contractMode = 'frozen'; subtask.contract = opts.contractDraft; subtask.brownfieldDraft = true; }
      }
      logger.info('contract brownfield (--contract-draft): ' + opts.contractDraft + ' — be-validator 不跑真校验，前端可凭草案开工（待后端确认后 --contract 升级）');
    }
    logger.info('plan ' + plan.id + ' cluster=' + plan.cluster + ' subtasks=' + plan.subtasks.length);
    // 契约冻结（BE-13）：落 contracts/<planId>.json，subtask.contract 指向文件，gate json 模式做真实比对
    if (!opts.dryRun) {
      const contractSource = opts.contract || opts.contractDraft || null;
      const contractPath = await freezeContract(plan, workspace, contractSource);
      for (const subtask of plan.subtasks) { subtask.contract = contractPath; subtask.contractMode = 'frozen'; }
      // 冻结后重写 be-validator 契约：契约本体以用户 OpenAPI 文件为准（冻结文件仍写入，含 contractSource 记录；gate hash 比对该 OpenAPI 本体，防执行期篡改）
      if (opts.contract) for (const subtask of plan.subtasks) if (subtask.asset === 'be-validator') subtask.contract = opts.contract;
      // 棕地草案：be-validator 与前端子任务契约指向草案文件（非真 OpenAPI，be-validator 将诚实降级不跑真校验；前端可凭草案开工）
      if (opts.contractDraft) for (const subtask of plan.subtasks) if (subtask.brownfieldDraft) subtask.contract = opts.contractDraft;
      // FR-3 前端按契约实现（契约硬前置）：绿地需真实冻结契约；棕地草案放行（brownfieldDraft 标记），缺失真实契约且非棕地 → CONTRACT_NOT_FROZEN skip。
      const feGated = await applyFrontendContractGate(plan, workspace, opts.contract || (opts.contractDraft ? opts.contractDraft : null));
      if (feGated) logger.info('FR-3 contract gate applied: ' + feGated + ' 个前端实现子任务按契约前置（' + (opts.contract ? '契约=' + opts.contract : opts.contractDraft ? '棕地草案=' + opts.contractDraft + '（可开工，待确认后升级）' : '无真实契约，缺契约将 CONTRACT_NOT_FROZEN skip，请提供 --contract') + '）');
    }
  } else {
    for (const subtask of plan.subtasks) if (!subtask.task) subtask.task = plan.task;
    if (!manifest) manifest = await loadManifest({ vendorDir: VENDOR_DIR, stateDir: path.join(workspace, '.tt-state'), refresh: false });
  }
  // 只加载本计划路由到的资产（懒加载），正文缓存仅在非 dry-run 下启用（BE-15）
  const assets = await loadAssets({ vendorDir: VENDOR_DIR, assetsRoot: SKILL_DIR, workspace, manifest, only: plan.subtasks.map(function(s) { return s.asset; }), useCache: !opts.dryRun });
  // M2-3 --tui：执行时叠加实时 DAG 渲染（不改变执行语义，只挂 onStatus 钩子）。逃生舱：TT_TUI=off 或 --no-tui 完全不渲染。
  const execOpts = { ...opts, workspace, logger, assets, assetsRoot: SKILL_DIR };
  let tui = null;
  if (opts.tui && !opts.noTui && process.env.TT_TUI !== 'off') {
    tui = createTui(plan, { stream: process.stdout });
    if (tui.live) execOpts.onStatus = function(subtask, info) { tui.update(subtask, info); };
    tui.start();
  }
  if (opts.dryRun) {
    let dryResult;
    try { dryResult = await executePlan(plan, execOpts); } catch (error) { if (tui) tui.reset(); throw error; }
    if (tui) tui.finish({ status: dryResult.plan.status || 'done' });
    logger.info('dry-run complete'); return EXIT.OK;
  }
  logger.info('state: executing');
  let result;
  try { result = await executePlan(plan, execOpts); } catch (error) { if (tui) tui.reset(); throw error; }
  await store.save(result.plan);
  logger.info('state: reviewing');
  const report = await writeReport(result, workspace);
  if (tui) tui.finish({ status: result.plan.status, reportPath: report.markdown });
  logger.info('report: ' + report.markdown);
  if (result.plan.degraded) {
    const allSkip = result.plan.subtasks.every(function(s) { return s.status === 'skipped'; });
    logger.warn('plan degraded: ' + (allSkip ? 'all subtasks skipped (external execution tools unavailable); only routing/state recorded' : 'requireExec 资产 brief-only 兜底或部分降级——需 --exec 宿主或装 CLI 工具'));
  }
  if (opts.validate) { const regression = await runValidate({ cwd: SKILL_DIR }); console.log(regression.raw.trim()); if (!regression.ok) { console.error('[tt] regression failed'); return EXIT.FAILED; } }
  if (result.plan.status === 'failed') {
    // IMP-1 失败也留机器可读断点（schema status='failed'），新会话可程序化核对卡点（md 摘要不生成时 files 标 null）
    logger.info('state-summary: ' + await writeStateSummary(result, workspace));
    return EXIT.FAILED;
  }
  // F3 自动经验摘要（MUSE MemoryManager 模式融合）：执行后自动写 memory-snapshot.md，提示编排者 memory_write
  // F2 执行反馈（MUSE SkillRefiner 模式）：写 execution-feedback.md（每子任务结果 + 改进建议）
  if (!opts.dryRun) {
    const modes = result.plan.modes || {};
    const warnings = result.plan.warnings || [];
    const subs = result.plan.subtasks || [];
    const consumed = subs.filter(function(s) { return s.assetConsumed === true; }).length;
    const callRate = subs.length > 0 ? (consumed / subs.length * 100).toFixed(1) : '0';
    const snapshotPath = path.join(workspace, 'artifacts', result.plan.id, 'memory-snapshot.md');
    const snapshot = [
      '# memory-snapshot ' + result.plan.id, '',
      '- task: ' + result.plan.task,
      '- cluster: ' + result.plan.cluster,
      '- status: ' + result.plan.status + ' degraded: ' + result.plan.degraded,
      '- modes: ' + JSON.stringify(modes),
      '- 资产消费率: ' + callRate + '% (' + consumed + '/' + subs.length + ')',
      '- warnings: ' + (warnings.length ? warnings.join(' | ') : '无'), '',
      '## 经验摘要（可 memory_write）',
      '- 调用率: ' + callRate + '%',
      '- 改进点: ' + (warnings.length ? warnings[0] : '无'),
      '- memory_write 提示: memory_write(project="tgent", content=<本摘要>, mode="append")',
    ].join('\n');
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.writeFile(snapshotPath, snapshot);
    // F2 执行反馈：每子任务结果 + 改进建议（SkillRefiner 模式）
    const fbPath = path.join(workspace, 'artifacts', result.plan.id, 'execution-feedback.md');
    const fbLines = ['# execution-feedback ' + result.plan.id, '', '## 逐子任务执行结果'];
    for (const s of subs) {
      const suggest = s.mode === 'prompt' ? '需 --exec 宿主真实执行（当前 brief-only 兜底）' : s.mode === 'planned-only' ? '需装 CLI 工具（当前 planned-only 降级）' : s.mode === 'skipped' ? '需装执行工具（当前 skipped）' : (s.assetConsumed === true ? '已真实执行' : '');
      const recoveryNote = Array.isArray(s.recovery) && s.recovery.length ? ' | recovery: ' + s.recovery.map(function(r) { return r.stage + ' ' + r.from + '→' + r.to + '(attempt ' + r.attempt + ')'; }).join('; ') : '';
      fbLines.push('### ' + s.asset, '- mode: ' + s.mode + ' | consumed: ' + (s.assetConsumed === true) + ' | adapter: ' + (s.adapter || '?') + (suggest ? ' | 建议: ' + suggest : '') + recoveryNote);
    }
    if (result.plan.requireExec) {
      const briefOnly = subs.filter(function(s) { return s.mode === 'prompt' && s.assetConsumed !== true; });
      if (briefOnly.length) { fbLines.push('', '## requireExec 违规', briefOnly.length + ' 个资产 brief-only 兜底（' + briefOnly.map(function(s) { return s.asset; }).join(', ') + '）——需 --exec 宿主或装 CLI'); }
    }
    fbLines.push('', '## 汇总', '- 真实执行: ' + consumed + '/' + subs.length + ' (' + callRate + '%)', '- 改进方向: ' + (warnings.length ? warnings.join('; ') : '无'));
    await fs.writeFile(fbPath, fbLines.join('\n'));
    // IMP-1 机器可读 state 摘要：与人类可读 md 并存，不互相替代
    const summaryRel = await writeStateSummary(result, workspace);
    logger.info('memory-snapshot: ' + snapshotPath + ' | execution-feedback: ' + fbPath + ' | state-summary: ' + summaryRel);  }
  logger.info('state: done');
  return EXIT.OK;
}
main().then(function(code) { process.exitCode = code; }).catch(function(error) {
  if (error instanceof NoMatchError) { console.error('[tt] no match: ' + error.message); process.exitCode = EXIT.FAILED; return; }
  if (error instanceof ContractViolationError) { console.error('[tt] contract violation: ' + error.diff); process.exitCode = EXIT.CONTRACT; return; }
  if (String(error.message).includes('NOT_IMPLEMENTED')) { console.error('[tt] module not implemented: ' + error.message); process.exitCode = EXIT.NOT_IMPL; return; }
  console.error('[tt] execution failed: ' + error.message);
  process.exitCode = EXIT.FAILED;
});
