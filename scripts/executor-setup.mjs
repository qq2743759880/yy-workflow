#!/usr/bin/env node
/**
 * executor-setup.mjs — T9 执行器选择/配置/交接向导（P2 重设计施工）。
 *
 * 吸收 wiring-and-audit-plan-20260920.md P2 节 10 条批判，对应 next-phase-plan-20260920.md T9 节
 * 10 条设计决定。核心纪律：
 *   - 存在性 ≠ 可用性：presence 与 roundtrip 两档分别标注，绝不把"在 PATH 里"说成"可用"；
 *   - fail-closed：--non-interactive 缺信息 exit 2 + 指引，不猜；
 *   - 绝不读取/写入任何凭据文件，绝不写宿主配置文件（mimosa 红线）；
 *   - roundtrip 探测只喂良性"回复 OK"brief，沙箱 cwd（os.tmpdir），不执行任何仓库代码；
 *   - executor.json 持久化走 lib/store.mjs withLock（fail-closed 锁，双会话不互踩）。
 *
 * 用法：
 *   node scripts/executor-setup.mjs --probe presence [--only <a,b,c>] [--json] [--timeout <ms>]
 *   node scripts/executor-setup.mjs --probe roundtrip --cli <name> [--timeout <ms>] [--json]
 *       （roundtrip 默认无目标即 exit 2——真实调用消耗 API 配额，必须显式指名，防误烧配额）
 *   node scripts/executor-setup.mjs --non-interactive [--executor <cli>] [--model <id>]
 *       [--isolate <v>] [--workspace <dir>] [--save]
 *       读取顺序：--executor 显式 > <workspace>/.tt-state/executor.json > exit 2（缺信息不猜）
 *   node scripts/executor-setup.mjs --handoff --plan-id <id> --task-id <id> [--task-desc <t>]
 *       [--workspace <dir>] [--force]      交接模式：生成 brief 骨架（schema tt/handoff-brief@1）
 *   node scripts/executor-setup.mjs --configure [--apply | --dry-run] [--workspace <dir>]
 *       [--subagentSource <v>] [--delegationMode <v>] [--critiqueSources <v>]
 *       [--reportStyle <v>] [--blindwalk <true|false>] [--mcpTools <a,b>]
 *       ON-1 六字段编排配置向导 → orchestrator.config.yaml：每项默认值+理由+可后改注释；
 *       既有字段只补缺不覆盖；CLI flag 覆盖 > 向导回答 > 默认；--dry-run 零落盘；幂等可重跑
 *   node scripts/executor-setup.mjs        交互模式（非 TTY 环境 exit 2，转 --non-interactive）
 *
 * 环境变量：TT_EXECSETUP_<NAME> 显式指定某 CLI 命令（首个空白前为命令、其余为固定前缀参数），
 * 供本机特殊安装/测试 mock 注入；未设时沿 PATH 探测（Windows 用 where）。
 *
 * 退出码：0 成功；1 探测/运行失败；2 fail-closed（缺信息 / 非 TTY 交互 / roundtrip 未指名目标）。
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolveCommandShim } from './lib/adapters/util.mjs';
import { withLock, LockBusyError } from './lib/store.mjs';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 六个本机 CLI 目标（T9 规格；a6api 是 HTTP 参考宿主非 CLI，不在向导面内）。 */
const TARGETS = Object.freeze(['opencode', 'claude', 'codex', 'cursor', 'trae', 'openclaw']);

/**
 * 非交互形态表——只登记仓库已有宿主脚本编码过的形态（实测编码来源注明），不编造。
 * exec-host-generic.mjs：claude `-p`（stdin）/ codex `exec -`（stdin）/ cursor+trae = no-noninteractive-cli。
 * exec-host-openclaw.mjs：openclaw `agent --agent main --message-file <file> --json --timeout `。
 * opencode：仓库未编码非交互形态，如实标 unknown，不强接。
 * 能力默认集：write_files, run_cmd, network, spawn_subagent, mcp_client。
 * 实际能力由 runtime 检测后注入到 executor.json capabilities 段。
 */
const NONINTERACTIVE_FORMS = Object.freeze({
  claude: { kind: 'stdin', args: ['-p'], source: 'scripts/exec-host-generic.mjs 编码' },
  codex: { kind: 'stdin', args: ['exec', '-', '--color', 'never', '--skip-git-repo-check'], source: 'scripts/exec-host-generic.mjs 编码' },
  openclaw: { kind: 'message-file', source: 'scripts/exec-host-openclaw.mjs 编码' },
  cursor: { kind: 'none', note: '无干净非交互模式（no-noninteractive-cli），不强接', source: 'scripts/exec-host-generic.mjs 编码' },
  trae: { kind: 'none', note: '无干净非交互模式（no-noninteractive-cli），不强接', source: 'scripts/exec-host-generic.mjs 编码' },
  opencode: { kind: 'unknown', note: '仓库未编码非交互形态，不编造；仅 presence 档参考', source: '无（仓库无 exec-host 编码）' },
});

/** 能力枚举（固定，不可随平台命名）：
 *  - write_files：可写入文件
 *  - run_cmd：可运行命令
 *  - network：可网络访问
 *  - spawn_subagent：可派生子代理
 *  - mcp_client：可使用MCP客户端 */
const CAPABILITY_ENUM = Object.freeze(['write_files', 'run_cmd', 'network', 'spawn_subagent', 'mcp_client']);

/** executor.json v2 Agent Card 式自描述的默认能力集（探测缺位时的保守缺省：MCP 未探测 → false，不假报）。 */
const DEFAULT_CAPABILITIES = Object.freeze({
  write_files: true,
  run_cmd: true,
  network: true,
  spawn_subagent: true,
  mcp_client: false,
});

/** executor.json v2 Agent Card 版本（capabilities 握手语义版本；schema 名仍由 EXECUTOR_SCHEMA 承载）。 */
const EXECUTOR_VERSION = '2.0.0';

/** roundtrip 默认超时（T9 规格 60s；--timeout 可覆盖；遗留⑥：60s 值未标定，可能误杀慢 CLI）。 */
const ROUNDTRIP_DEFAULT_TIMEOUT = 60000;

/** executor.json schema 名（版本化，schema 漂移显式可见）。 */
const EXECUTOR_SCHEMA = 'tt/executor-config@1';

/**
 * FIX-2（executor.json↔orchestrator 接线）：schema 名与已知 CLI 清单单点导出。
 * orchestrator.mjs 启动时读 <workspace>/.tt-state/executor.json 把 cli 映射为 --exec 缺省，
 * 引用本导出而非各自维护字面量——schema 漂移 / 清单变更只有这一处。
 * 只导出常量，不改本向导任何既有行为（CLI > config.json 缺省映射在 orchestrator 侧实现）。
 */
export { EXECUTOR_SCHEMA };
/** 已知 CLI 清单（= TARGETS；presence≠可用，orchestrator 只映射命令名不做可用性推断）。 */
export const KNOWN_CLIS = TARGETS.slice();
/** EX-1 能力枚举 + Agent Card 版本（单点导出：能力名固定枚举不随平台命名，orchestrator 侧引用）。 */
export { CAPABILITY_ENUM, DEFAULT_CAPABILITIES, EXECUTOR_VERSION };

/** roundtrip brief 内容：良性"回复 OK"，显式禁工具禁文件（纪律：探测不执行任何仓库代码）。 */
const ROUNDTRIP_BRIEF = '这是一次连通性自检（连通性探测 brief）。请忽略任务语义，不要使用任何工具，不要读写任何文件，只回复两个字符：OK';

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

function fail(exitCode, msg) {
  process.stderr.write('[executor-setup] ' + msg + '\n');
  process.exit(exitCode);
}

function envOverride(name) {
  const raw = process.env['TT_EXECSETUP_' + name.toUpperCase()];
  if (!raw || !raw.trim()) return null;
  const tokens = raw.trim().split(/\s+/);
  return { command: tokens[0], prefix: tokens.slice(1), source: 'env-override' };
}

/** presence 探测：Windows 用 where，POSIX 用 which；输出首个命中行或 null。只读 PATH，无特权操作。 */
function locateOnPath(name) {
  const tool = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(tool, [name], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
  if (r.status !== 0 || !r.stdout || !String(r.stdout).trim()) return null;
  return String(r.stdout).trim().split(/\r?\n/)[0].trim() || null;
}

// ---------------------------------------------------------------------------
// --probe presence
// ---------------------------------------------------------------------------

function probePresence(opts) {
  const rows = [];
  for (const name of opts.only.length ? opts.only : TARGETS) {
    if (!TARGETS.includes(name)) fail(2, '未知目标 ' + name + '（支持 ' + TARGETS.join('/') + '）');
    const ov = envOverride(name);
    const form = NONINTERACTIVE_FORMS[name];
    let row = { name, presenceTier: 'PRESENCE_NO', located: null, source: 'PATH', nonInteractive: { kind: form.kind, args: form.args || null, note: form.note || null, source: form.source } };
    if (ov) {
      // env 显式指定：仍需可定位才算存在（诚实性——显式指定 ≠ 存在性结论）
      const loc = locateOnPath(ov.command) || (fs.existsSync(ov.command) ? ov.command : null);
      if (loc) {
        row.presenceTier = 'PRESENCE_YES';
        row.located = loc + (ov.prefix.length ? '（显式参数: ' + ov.prefix.join(' ') + '）' : '');
        row.source = ov.source;
      } else {
        row.presenceTier = 'PRESENCE_NO';
        row.source = ov.source;
        row.nonInteractive.note = 'env 显式指定命令不可定位（' + ov.command + '），如实判不存在';
      }
    } else {
      const where = locateOnPath(name);
      if (where) { row.presenceTier = 'PRESENCE_YES'; row.located = where; }
    }
    rows.push(row);
  }
  return rows;
}

function printPresence(rows, json) {
  if (json) { process.stdout.write(JSON.stringify(rows, null, 2) + '\n'); return; }
  console.log('presence 档（仅存在性 + 非交互形态登记；存在 ≠ 可用，可用性看 --probe roundtrip）\n');
  for (const r of rows) {
    const ni = r.nonInteractive;
    const niText = ni.kind === 'stdin' ? 'stdin 形态 ' + JSON.stringify(ni.args) : ni.kind === 'message-file' ? 'message-file 形态' : ni.kind;
    console.log(r.name.padEnd(10) + r.presenceTier.padEnd(14) + niText + (ni.note ? '（' + ni.note + '）' : ''));
    console.log(''.padEnd(10) + 'located: ' + (r.located || '未在 PATH 找到') + '  [' + r.source + ']');
  }
  console.log('\n注意：本档结论只回答"在不在/有没有非交互形态"，不回答"认证/配额/模型是否可用"。');
}

// ---------------------------------------------------------------------------
// --probe roundtrip（真实喂"回复 OK"brief；沙箱 cwd；绝不写宿主配置/读凭据）
// ---------------------------------------------------------------------------

async function makeSandboxDir() {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'yy-roundtrip-'));
}

/** roundtrip 探测单个 CLI。返回 {cli, presenceTier, roundtripTier, ok, exitCode, stdoutExcerpt, stderrExcerpt, durationMs, sandbox, timeoutMs} */
async function probeRoundtrip(name, opts) {
  if (!TARGETS.includes(name)) fail(2, '未知目标 ' + name + '（支持 ' + TARGETS.join('/') + '）');
  const presenceRows = probePresence({ only: [name] });
  const p = presenceRows[0];
  const base = { cli: name, presenceTier: p.presenceTier, roundtripTier: 'SKIP', ok: false, exitCode: null, stdoutExcerpt: '', stderrExcerpt: '', durationMs: 0, sandbox: null, timeoutMs: opts.timeoutMs };
  if (p.presenceTier !== 'PRESENCE_YES') { base.skipReason = 'presence=PRESENCE_NO（未在 PATH 找到，roundtrip 不跑）'; return base; }
  const form = NONINTERACTIVE_FORMS[name];
  if (form.kind === 'none') { base.skipReason = 'no-noninteractive-cli（无干净非交互模式，不强接）'; return base; }
  if (form.kind === 'unknown') { base.skipReason = '仓库未编码非交互形态，roundtrip 形态不编造（STOP-adjacent：强接=编造探测结论）'; return base; }

  const sandbox = await makeSandboxDir();
  base.sandbox = sandbox;
  const ov = envOverride(name);
  const entry = ov ? { command: ov.command, prefix: ov.prefix } : resolveCommandShim(name);

  return await new Promise((resolve) => {
    let argv;
    if (form.kind === 'stdin') {
      argv = entry.prefix.concat(form.args);
    } else {
      // message-file 形态（openclaw）：brief 落沙箱内 message 文件（非宿主配置文件，红线安全）
      const msgFile = path.join(sandbox, 'roundtrip-message.txt');
      fs.writeFileSync(msgFile, ROUNDTRIP_BRIEF, 'utf8');
      argv = entry.prefix.concat(['agent', '--agent', 'main', '--message-file', msgFile, '--json', '--timeout', String(Math.ceil(opts.timeoutMs / 1000))]);
    }
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let done = false;
    const child = spawn(entry.command, argv, { cwd: sandbox, stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
    const timer = setTimeout(() => { try { child.kill(); } catch (e) { /* 已退出 */ } finish({ roundtripTier: 'ROUNDTRIP_TIMEOUT', note: 'roundtrip 超时（' + opts.timeoutMs + 'ms）' }); }, opts.timeoutMs);
    if (timer.unref) timer.unref();
    child.stdin.on('error', () => {});
    if (form.kind === 'stdin') child.stdin.write(ROUNDTRIP_BRIEF, () => { try { child.stdin.end(); } catch (e) { /* stdin 已关 */ } });
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', (e) => {
      finish({ roundtripTier: 'ROUNDTRIP_FAIL', note: e.code === 'ENOENT' ? 'spawn ENOENT（presence 与 spawn 形态不一致，如实上报）' : String(e.message || e) });
    });
    child.on('close', (code) => {
      const ok = code === 0 && stdout.includes('OK');
      finish({ roundtripTier: ok ? 'ROUNDTRIP_OK' : 'ROUNDTRIP_FAIL', note: ok ? '' : 'exit=' + code + (stdout.includes('OK') ? '' : '；stdout 未含预期回执 OK') });
    });
    function finish(r) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      base.roundtripTier = r.roundtripTier;
      base.ok = r.roundtripTier === 'ROUNDTRIP_OK';
      base.exitCode = base.ok ? 0 : base.exitCode;
      base.note = r.note || '';
      base.stdoutExcerpt = stdout.trim().slice(0, 200);
      base.stderrExcerpt = stderr.trim().slice(0, 200);
      base.durationMs = Date.now() - started;
      fsp.rm(sandbox, { recursive: true, force: true }).catch(() => {}); // 沙箱清理尽力而为
      resolve(base);
    }
  });
}

function printRoundtrip(rows, json) {
  if (json) { process.stdout.write(JSON.stringify(rows, null, 2) + '\n'); return; }
  console.log('roundtrip 档（真实喂"回复 OK"brief；沙箱 cwd；与 presence 分档呈现，禁止互相替代）\n');
  for (const r of rows) {
    console.log(r.cli.padEnd(10) + 'presence=' + r.presenceTier.padEnd(14) + 'roundtrip=' + r.roundtripTier + (r.note ? '  · ' + r.note : ''));
    if (r.skipReason) console.log(''.padEnd(10) + 'skip: ' + r.skipReason);
    if (r.stdoutExcerpt) console.log(''.padEnd(10) + 'stdout: ' + r.stdoutExcerpt.replace(/\n/g, ' | '));
    if (r.stderrExcerpt) console.log(''.padEnd(10) + 'stderr: ' + r.stderrExcerpt.replace(/\n/g, ' | '));
    if (r.durationMs) console.log(''.padEnd(10) + '耗时 ' + r.durationMs + 'ms / 超时 ' + r.timeoutMs + 'ms');
  }
  console.log('\n注意：ROUNDTRIP_OK 只证明"该 CLI 能非交互完成一次良性往返"，不证明认证状态/配额余量/模型质量。');
}

// ---------------------------------------------------------------------------
// executor.json（<workspace>/.tt-state/executor.json；withLock 写）
// ---------------------------------------------------------------------------

function executorConfigPath(workspace) {
  return path.join(path.resolve(workspace), '.tt-state', 'executor.json');
}

function readExecutorConfig(workspace) {
  try {
    const raw = fs.readFileSync(executorConfigPath(workspace), 'utf8');
    const parsed = JSON.parse(raw);
    // 兼容旧 schema：若无 capabilities 块则补全默认能力集
    if (!parsed.capabilities || typeof parsed.capabilities !== 'object') {
      parsed.capabilities = {
        write_files: true,
        run_cmd: true,
        network: true,
        spawn_subagent: true,
        mcp_client: false
      };
      parsed.detectedAt = new Date().toISOString();
    }
    return { config: parsed, exists: true };
  } catch (e) {
    if (e.code === 'ENOENT') return { config: null, exists: false };
    if (e instanceof SyntaxError) return { config: null, exists: true, corrupt: true };
    throw e;
  }
}

/** withLock 写入（T9 设计决定 9：双会话首跑不互踩；锁 fail-closed，LockBusyError 上抛 = 显式失败）。 */
async function saveExecutorConfig(workspace, patch) {
  const file = executorConfigPath(workspace);
  return withLock(file, async () => {
    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* 首写或损坏：以 patch 为准重建 */ }
    const next = Object.assign({}, existing, patch);
    // 确保 capabilities 块存在
    if (!next.capabilities || typeof next.capabilities !== 'object') {
      next.capabilities = {
        write_files: true,
        run_cmd: true,
        network: true,
        spawn_subagent: true,
        mcp_client: false
      };
    }
    // 确保 detectedAt 存在
    if (!next.detectedAt) {
      next.detectedAt = new Date().toISOString();
    }
    // 添加 schema
    next.schema = EXECUTOR_SCHEMA;
    next.savedAt = new Date().toISOString();
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, JSON.stringify(next, null, 2) + '\n', 'utf8');
    return next;
  });
}

// ---------------------------------------------------------------------------
// --non-interactive（读取顺序：--executor 显式 > executor.json > exit 2 缺信息不猜）
// ---------------------------------------------------------------------------

function resolveNonInteractive(opts) {
  if (opts.executor) {
    if (!TARGETS.includes(opts.executor)) {
      fail(2, '--executor ' + opts.executor + ' 不在已知目标内（' + TARGETS.join('/') + '）——fail-closed 不猜');
    }
    return { mode: 'B-cli', cli: opts.executor, source: 'flag-explicit' };
  }
  const stored = readExecutorConfig(opts.workspace);
  if (stored.corrupt) {
    fail(2, 'executor.json 解析失败（损坏）——' + executorConfigPath(opts.workspace) + '\n  指引：修复或删除该文件后重跑；--non-interactive 不猜损坏文件的内容');
  }
  if (stored.config && stored.config.cli && stored.config.mode === 'B-cli') {
    if (!TARGETS.includes(stored.config.cli)) {
      fail(2, 'executor.json 的 cli=' + stored.config.cli + ' 不在已知目标内（' + TARGETS.join('/') + '）——fail-closed 不猜');
    }
    return { mode: 'B-cli', cli: stored.config.cli, source: 'executor.json', stored };
  }
  if (stored.config && (stored.config.mode === 'A-direct' || stored.config.mode === 'C-handoff')) {
    return { mode: stored.config.mode, cli: null, source: 'executor.json', stored };
  }
  const file = executorConfigPath(opts.workspace);
  fail(2,
    '缺信息，fail-closed 不猜。\n' +
    '  缺：执行器选择（既无 --executor 显式旗标，也无有效的 ' + file + '）。\n' +
    '  指引（三选一）：\n' +
    '    1. 显式旗标：node scripts/executor-setup.mjs --non-interactive --executor <' + TARGETS.join('|') + '> [--model <id>] [--save]\n' +
    '    2. 先在 TTY 会话跑交互模式完成一次选择（会落 executor.json）\n' +
    '    3. 交接任务用 --handoff --plan-id <id> --task-id <id>');
}

// ---------------------------------------------------------------------------
// 交接模式（schema tt/handoff-brief@1）：brief 骨架 + 回填报告约定
// ---------------------------------------------------------------------------

function handoffBriefText(planId, taskId, taskDesc) {
  return [
    '# 交接 brief — ' + taskId + '（plan ' + planId + '）',
    '',
    '> 由 `scripts/executor-setup.mjs` 交接模式生成（schema ' + 'tt/handoff-brief@1' + '）。',
    '> 回填报告约定路径：`artifacts/' + planId + '/reports/' + taskId + '/REPORT.md`。',
    '',
    '## 回填报告必填字段（机器校验：`node scripts/summary-read.mjs --validate-handoff artifacts/' + planId + '/reports/' + taskId + '`）',
    '',
    '缺任一字段校验 FAIL（缺字段不猜，不推断不补全）：',
    '',
    '- taskId: ' + taskId,
    '- taskVerdict: <执行者自评结论，如 PASS / FAIL / PARTIAL；以项目维护者的复核为准>',
    '- evidencePaths: <证据路径，逗号分隔一行，或空值后跟 - 列表逐条>',
    '',
    '## 本子任务',
    '',
    '- 说明: ' + (taskDesc || '<占位：任务说明，派单时补齐>'),
    '',
    '## 必读',
    '',
    '- <占位：必读材料清单，派单时补齐>',
    '',
    '## 交付物',
    '',
    '- <占位：交付物清单，派单时补齐>',
    '',
    '## 允许写入（白名单）',
    '',
    '- <占位：写入白名单；白名单外一律禁止>',
    '',
    '## 纪律',
    '',
    '- 零 npm；ESM；中文注释；fail-closed；不编造结论（实测/模拟/推断标注）。',
    '- 禁止 git 操作；禁止读取/写入凭据文件。',
  ].join('\n') + '\n';
}

async function runHandoff(opts) {
  if (!opts.planId || !opts.taskId) {
    fail(2, '交接模式缺信息：--plan-id 与 --task-id 必填（fail-closed 不猜）。\n  指引：node scripts/executor-setup.mjs --handoff --plan-id <planId> --task-id <taskId> [--task-desc <说明>]');
  }
  if (/[\\/]|\.\./.test(opts.planId) || /[\\/]|\.\./.test(opts.taskId)) {
    fail(2, '--plan-id / --task-id 含路径分隔符或 ".."——拒绝（防目录穿越）');
  }
  const workspace = path.resolve(opts.workspace);
  const briefPath = path.join(workspace, 'artifacts', opts.planId, 'briefs', opts.taskId + '.md');
  if (fs.existsSync(briefPath) && !opts.force) {
    fail(2, 'brief 已存在：' + briefPath + '\n  指引：不覆盖既有 brief；确认要重建时加 --force（fail-closed）');
  }
  await fsp.mkdir(path.dirname(briefPath), { recursive: true });
  await fsp.writeFile(briefPath, handoffBriefText(opts.planId, opts.taskId, opts.taskDesc), 'utf8');
  const reportDir = path.join('artifacts', opts.planId, 'reports', opts.taskId);
  console.log('brief 骨架已生成: ' + briefPath);
  console.log('回填报告约定路径: ' + path.join(workspace, reportDir, 'REPORT.md'));
  console.log('回填后机验: node scripts/summary-read.mjs --validate-handoff ' + reportDir.replace(/\\/g, '/'));
  return 0;
}

// ---------------------------------------------------------------------------
// 交互模式（非 TTY exit 2；B 默认高亮；A 显式警示 C-01）
// ---------------------------------------------------------------------------

async function runInteractive(opts) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail(2, '当前不是 TTY 环境，交互向导无法进行（遗留④：非 TTY 交互降级 UX 未设计，fail-closed 不猜）。\n' +
      '  指引：改用 --non-interactive（flags 或 executor.json 供选择）或 --handoff 交接模式。');
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const workspace = path.resolve(opts.workspace);

  const stored = readExecutorConfig(workspace);
  if (stored.exists) {
    console.log('已有 executor.json（' + executorConfigPath(workspace) + '）：');
    console.log(stored.config ? JSON.stringify(stored.config, null, 2) : '  <文件损坏，不可解析>');
  }

  console.log('\npresence 快速探测（存在 ≠ 可用）：');
  const rows = probePresence({ only: [] });
  for (const r of rows) {
    console.log('  ' + r.name.padEnd(10) + r.presenceTier + (r.nonInteractive.kind === 'none' ? '（无非交互形态）' : r.nonInteractive.kind === 'unknown' ? '（非交互形态未编码）' : ''));
  }

  console.log('\n选择执行方式：');
  console.log('  [B] 本机 CLI 子代理（默认高亮，回车即 B）');
  console.log('  [A] 编排者直执行 ⚠ 违反 C-01 独立验收纪律，仅限非验收类任务');
  console.log('  [C] 手动交接（schema 化 brief 骨架 + 回填报告约定）');
  const choice = ((await rl.question('B/A/C [B]: ')).trim() || 'B').toUpperCase();
  try {
    if (choice === 'A') {
      console.log('\n⚠ 再次确认：编排者直执行违反 C-01（独立子 agent、不得自写自验），仅限非验收类任务。');
      const sure = (await rl.question('仍要选择 A？输入 YES 确认: ')).trim();
      if (sure !== 'YES') { console.log('已取消，未落盘。'); return 2; }
      await saveExecutorConfig(workspace, { mode: 'A-direct', cli: null, model: null, isolate: null, note: '违反 C-01 独立验收纪律，仅限非验收类任务' });
      console.log('已落盘 executor.json（mode=A-direct）。');
      return 0;
    }
    if (choice === 'C') {
      const planId = (await rl.question('planId: ')).trim();
      const taskId = (await rl.question('taskId: ')).trim();
      await saveExecutorConfig(workspace, { mode: 'C-handoff', cli: null, model: null, isolate: null });
      console.log('已落盘 executor.json（mode=C-handoff）。\n');
      return runHandoff(Object.assign({}, opts, { planId, taskId }));
    }
    // B（默认）
    const candidates = rows.filter((r) => r.presenceTier === 'PRESENCE_YES' && ['stdin', 'message-file'].includes(r.nonInteractive.kind));
    const pool = candidates.length ? candidates : rows; // 无理想候选时仍允许显式选（如实标注形态）
    console.log('\n可选 CLI（presence 档；roundtrip 请后续用 --probe roundtrip --cli <name> 自检）:');
    pool.forEach((r, i) => console.log('  ' + (i + 1) + '. ' + r.name + '  ' + r.presenceTier + '  非交互: ' + r.nonInteractive.kind));
    const pickRaw = (await rl.question('选择序号/名称' + (candidates.length ? ' [' + candidates[0].name + ']: ' : ': '))).trim();
    let cli = pickRaw ? (/^\d+$/.test(pickRaw) ? (pool[parseInt(pickRaw, 10) - 1] || {}).name : pool.some((r) => r.name === pickRaw) ? pickRaw : null) : (candidates[0] || {}).name;
    if (!cli) { console.log('未识别的选择，未落盘。'); return 2; }
    const model = (await rl.question('模型偏好（可空）: ')).trim() || null;
    await saveExecutorConfig(workspace, { name: 'executor', version: EXECUTOR_VERSION, mode: 'B-cli', cli, model, isolate: null });
    console.log('\n已落盘 executor.json（mode=B-cli, cli=' + cli + (model ? ', model=' + model : '') + '）。');
    const docName = fs.existsSync(path.join(__dirname, '..', 'docs', 'executor-setup', cli + '.md')) ? cli + '.md' : '通用.md';
    console.log('\n配置方法论指引: docs/executor-setup/' + docName + '（只给步骤与自检命令；本向导绝不代读/代写凭据）');
    console.log('自检命令：');
    console.log('  node scripts/executor-setup.mjs --probe presence --only ' + cli);
    console.log('  node scripts/executor-setup.mjs --probe roundtrip --cli ' + cli + '    # 真实往返，消耗一次 API 配额');
    return 0;
  } finally {
    rl.close();
  }
}

// ---------------------------------------------------------------------------
// argv 解析与 main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const o = {
    probe: null, only: [], json: false, timeoutMs: 0,
    nonInteractive: false, executor: null, model: null, isolate: null, workspace: '.', save: false,
    handoff: false, planId: null, taskId: null, taskDesc: null, force: false, help: false,
    // ON-1：--configure 六字段编排配置向导（布尔模式旗标，不取值）；六组 CLI flag 可显式覆盖单字段
    configure: false, apply: false, dryRun: false,
    subagentSource: null, delegationMode: null, critiqueSources: null,
    reportStyle: null, blindwalk: null, mcpTools: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const val = () => { const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) fail(2, a + ' 需要值'); i += 1; return v; };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--probe') o.probe = val();
    else if (a === '--cli') o.executor = val(); // roundtrip 的目标指名（--cli <name> 与 --executor 同义）
    else if (a === '--only') o.only.push(...val().split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--json') o.json = true;
    else if (a === '--timeout') { const v = Number(val()); if (Number.isNaN(v) || v <= 0) fail(2, '--timeout 需正整数 ms'); o.timeoutMs = v; }
    else if (a === '--non-interactive') o.nonInteractive = true;
    else if (a === '--executor') o.executor = val();
    else if (a === '--model') o.model = val();
    else if (a === '--isolate') o.isolate = val();
    else if (a === '--workspace') o.workspace = val();
    else if (a === '--save') o.save = true;
    else if (a === '--handoff') o.handoff = true;
    else if (a === '--plan-id') o.planId = val();
    else if (a === '--task-id') o.taskId = val();
    else if (a === '--task-desc') o.taskDesc = val();
    else if (a === '--force') o.force = true;
    else if (a === '--configure') o.configure = true;
    else if (a === '--apply') o.apply = true;
    else if (a === '--dry-run') o.dryRun = true;
    // ON-1 六字段 CLI 覆盖 flag（优先级：CLI flag > 交互回答 > 默认值）
    else if (a === '--subagentSource' || a === '--subagent-source') o.subagentSource = val();
    else if (a === '--delegationMode' || a === '--delegation-mode') o.delegationMode = val();
    else if (a === '--critiqueSources' || a === '--critique-sources') o.critiqueSources = val();
    else if (a === '--reportStyle' || a === '--report-style') o.reportStyle = val();
    else if (a === '--blindwalk' || a === '--blindwalk-enabled') o.blindwalk = val();
    else if (a === '--mcpTools' || a === '--mcp-tools') o.mcpTools = val();
    else fail(2, '未知参数 ' + a + '（--help 看用法）');
  }
  return o;
}

function printHelp() {
  console.log([
    '用法: node scripts/executor-setup.mjs <模式>',
    '',
    '  --probe presence [--only a,b,c] [--json] [--timeout <ms>]      存在性 + 非交互形态档',
    '  --probe roundtrip --cli <name> [--timeout <ms>] [--json]       真实"回复 OK"往返档（默认必须显式指名）',
    '  --non-interactive [--executor <cli>] [--model <id>] [--isolate <v>] [--workspace <dir>] [--save]',
    '  --handoff --plan-id <id> --task-id <id> [--task-desc <t>] [--workspace <dir>] [--force]',
    '  --configure [--apply | --dry-run] [--workspace <dir>]   ON-1 六字段编排配置向导 → orchestrator.config.yaml',
    '      可选覆盖 flag: --subagentSource <session|claude-cli|codex-cli>',
    '                     --delegationMode <self-dispatch|handoff-prompt>',
    '                     --critiqueSources <知识库路径|搜索工具|标准文档|none>',
    '                     --reportStyle <plain|technical|both>',
    '                     --blindwalk <true|false>',
    '                     --mcpTools <名称1,名称2>',
    '      （既有字段只补缺不覆盖；--dry-run 只打印预览零落盘；--apply 才写入）',
    '  （无模式参数 = 交互向导；非 TTY 环境 exit 2）',
    '',
    '退出码: 0 成功 / 1 探测或运行失败 / 2 fail-closed（缺信息不猜）',
  ].join('\n'));
}

/**
 * 六字段编排配置（T9 向导底座扩展；落盘 target：orchestrator.config.yaml）。
 * 字段口径一一对应派单 ON-1 六字段：
 *   orchestrator.subagentSource  / orchestrator.delegationMode  / critique.sources
 *   / report.style  / blindwalk.enabled  / mcp.tools
 * 每个字段含默认值+理由+可后改说明，向导逐项交互确认；--dry-run 不落盘，
 * --apply 才写入 target 文件。幂等：再次运行以最新用户回答覆盖，无残留旧字段。
 */

/** 字段元数据（默认值、选项、理由、可后改），驱动向导 + 预览 + 校验。 */
const CONFIG_FIELDS = Object.freeze([
  {
    key: 'orchestrator.subagentSource',
    section: 'orchestrator',
    options: [['session', 'claude-cli', 'codex-cli']],
    default: 'session',
    defaultReason: '子 agent 由本编排会话内建调度，无需额外 CLI（零依赖、最低门槛）。',
    editable: true,
    note: '后续可在 orchestrator.config.yaml 直接改写；改后无需重装。',
  },
  {
    key: 'orchestrator.delegationMode',
    section: 'orchestrator',
    options: [['self-dispatch', 'handoff-prompt']],
    default: 'self-dispatch',
    defaultReason: '编排者自己派单给子 agent，简单场景不经过用户交接；复杂决策再切 handoff-prompt。',
    editable: true,
    note: '切 handoff-prompt 后派单会变成“给用户一段交接 Prompt”，可后改。',
  },
  {
    key: 'critique.sources',
    section: 'critique',
    options: [['知识库路径', '搜索工具', '标准文档', 'none']],
    default: 'none',
    defaultReason: '批判源清单尚无既有清单（CR-1 未落），先空（none）；确认后再逐项填知识库/搜索/标准文档路径。',
    editable: true,
    note: '可追加多项；none 表示不依赖外部批判源。',
  },
  {
    key: 'report.style',
    section: 'report',
    options: [['plain', 'technical', 'both']],
    default: 'plain',
    defaultReason: '验收报告先按大白话（plain）交付，后续按需切 technical 或两者并存。',
    editable: true,
    note: '风格只影响输出措辞，不影响事实结论。',
  },
  {
    key: 'blindwalk.enabled',
    section: 'blindwalk',
    options: [['true', 'false']],
    default: 'true',
    coerce: 'bool', // 落盘为布尔（true/false），字符串回答先归一
    defaultReason: '阶段盲测是终验纪律（SB-1），默认开启防学习效应；验收通过可关。',
    editable: true,
    note: '关闭 = 取消盲测开关，终验纪律降级，需 Owner 确认。',
  },
  {
    key: 'mcp.tools',
    section: 'mcp',
    options: [['工具列表（空=不接 MCP）']],
    default: [],
    defaultReason: 'MCP server（chrome-devtools-mcp 等）按需接入，默认不接（零依赖）。',
    editable: true,
    note: '填“工具名1,工具名2”后逐项作为列表落盘；可后续增删。',
  },
]);

const CONFIG_TARGET = 'orchestrator.config.yaml';

/** 把配置字段值集合序列化为 YAML（零依赖子集；值仅字符串/数组/布尔/空）。
 *  数组：空 → 流式 []；非空 → 标准块序列（key: 换行 "  - item"），经 PyYAML 实测可解析
 *  （ON-1 自测纠错：初版 "[\n  - x\n]" 流式开头+块式条目是非法 YAML 混用，已改）。 */
function toYamlValue(v) {
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return '\n' + v.map((x) => '  - ' + JSON.stringify(x)).join('\n');
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return JSON.stringify(v);
  return String(v);
}

/** 序列化六字段配置对象为 orchestrator.config.yaml 文本（确定性键序）。 */
function serializeConfig(cfg) {
  const lines = ['# orchestrator.config.yaml — 六字段编排配置', '# 来源：scripts/executor-setup.mjs 向导（--configure）；可后改。', ''];
  const sections = new Map();
  for (const f of CONFIG_FIELDS) {
    const sec = f.section;
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec).push(f);
  }
  for (const [sec, fields] of sections) {
    lines.push('#' + sec);
    for (const f of fields) {
      const v = cfg[f.key];
      const comment = `  # 默认 ${JSON.stringify(f.default)} · ${f.defaultReason}`;
      if (Array.isArray(v) && v.length) {
        lines.push(`${f.key}:${comment}`); // 块序列：注释挂键行，条目行跟随
        for (const x of v) lines.push('  - ' + JSON.stringify(x));
      } else {
        lines.push(`${f.key}: ${toYamlValue(v)}${comment}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** 解析用户在向导里对“mcp.tools”列表的回答为数组。 */
function parseMcpList(raw) {
  if (!raw || !raw.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** 从回答映射组装六字段配置（含默认值兜底；blindwalk.enabled 回答归一为布尔）。 */
function buildConfigFromAnswers(answers) {
  const cfg = {};
  for (const f of CONFIG_FIELDS) {
    const a = answers.get(f.key);
    if (a === undefined || a === null || (typeof a === 'string' && a.trim() === '')) {
      cfg[f.key] = f.default;
    } else if (f.key === 'mcp.tools') {
      cfg[f.key] = parseMcpList(String(a));
    } else if (f.coerce === 'bool') {
      cfg[f.key] = String(a).toLowerCase() === 'true';
    } else {
      cfg[f.key] = a;
    }
  }
  return cfg;
}

/** 把字面选项归一为字段值（mcp.tools 除外，其余取第一个匹配）；不匹配 → null（交由默认/CLI flag 决定，不静默吞）。 */
function normalizeAnswer(field, raw) {
  if (field.key === 'mcp.tools') return String(raw || '');
  const opts = field.options[0];
  const norm = String(raw || '').toLowerCase().replace(/[_\s-]/g, '-');
  if (opts.some((o) => o.toLowerCase() === norm)) return norm;
  return null;
}

// ---------------------------------------------------------------------------
// ON-1 CLI flag 覆盖 + 值校验（fail-closed：非法值 exit 2 指引，不猜不静默回落）
// ---------------------------------------------------------------------------

/** 六字段 CLI flag 名（--help 展示与 fail-closed 指引用）。 */
const CONFIG_FLAGS = Object.freeze({
  'orchestrator.subagentSource': '--subagentSource',
  'orchestrator.delegationMode': '--delegationMode',
  'critique.sources': '--critiqueSources',
  'report.style': '--reportStyle',
  'blindwalk.enabled': '--blindwalk',
  'mcp.tools': '--mcpTools',
});

/** 校验 + 归一单个字段值；非法值 fail-closed exit 2（枚举外不猜，指引用户改 flag）。 */
function coerceFieldValue(field, raw, flagName) {
  if (field.key === 'mcp.tools') return parseMcpList(String(raw || ''));
  const norm = String(raw).toLowerCase().replace(/[_\s-]/g, '-');
  if (norm === 'true' || norm === 'false') {
    if (field.options[0].includes(norm)) return norm === 'true';
  } else if (field.options[0].some((o) => o.toLowerCase() === norm)) {
    return norm;
  }
  fail(2, flagName + ' ' + raw + ' 不是合法值（合法：' + field.options[0].join(' / ') + '）——fail-closed 不猜，请改用合法值重跑');
}

/** 应用 CLI flag 覆盖（优先级最高）：flag 显式给出 → 校验后写入，未给出的字段保持向导/默认值。 */
function applyFlagOverrides(cfg, opts) {
  const flagMap = [
    ['orchestrator.subagentSource', opts.subagentSource],
    ['orchestrator.delegationMode', opts.delegationMode],
    ['critique.sources', opts.critiqueSources],
    ['report.style', opts.reportStyle],
    ['blindwalk.enabled', opts.blindwalk],
    ['mcp.tools', opts.mcpTools],
  ];
  for (const [key, raw] of flagMap) {
    if (raw === null || raw === undefined) continue;
    const f = CONFIG_FIELDS.find((x) => x.key === key);
    cfg[key] = coerceFieldValue(f, raw, CONFIG_FLAGS[key]);
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// orchestrator.config.yaml 既有文件读取 + 合并补缺（不覆盖既有字段）
// ---------------------------------------------------------------------------

/** 极简 YAML 六字段读取器（只认本向导自身序列化形态：key: value 行，# 注释忽略；零依赖）。
 *  返回 { values: Map<string, string>, known: string[], unknown: string[], rawText: string|null }。
 *  unknown = 文件里本向导不认识的顶层键：合并落盘时 **原样保留**（未知键不解析不重排，插在文件头注释之后）。 */
function readExistingConfigYaml(workspace) {
  const file = path.join(path.resolve(workspace), CONFIG_TARGET);
  const out = { values: new Map(), known: [], unknown: [], rawText: null, unknownLines: [] };
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return out; }
  out.rawText = text;
  const knownKeys = new Set(CONFIG_FIELDS.map((f) => f.key));
  const seenKeys = new Set();
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9_.]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    const hashIdx = val.indexOf('  #');
    if (hashIdx >= 0) val = val.slice(0, hashIdx).trim();
    if (val === '[') continue; // 块序列首行：条目由 "- item" 行携带，键存在即视为已知
    if (knownKeys.has(key)) { if (!seenKeys.has(key)) { out.known.push(key); seenKeys.add(key); } out.values.set(key, val); }
    else if (!seenKeys.has(key)) { out.unknown.push(key); seenKeys.add(key); out.unknownLines.push(lineRaw); }
  }
  // 块序列条目行（" - x"，键行不在 known 时归附该键）
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^([A-Za-z0-9_.]+):\s*\[\s*(#.*)?$/);
    if (!m) continue;
    const key = m[1];
    const items = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const it = lines[j].match(/^\s+-\s*(.+)$/);
      if (!it) break;
      const s = it[1].trim();
      try { items.push(JSON.parse(s)); } catch (e) { items.push(s.replace(/^"|"$/g, '')); }
    }
    if (knownKeys.has(key)) out.values.set(key, items);
  }
  return out;
}

/** 行内值反序列化（与 toYamlValue 对偶）：[] / 多行列表 / JSON 字符串 / true|false。 */
function parseYamlScalar(raw, existing) {
  const v = String(raw).trim();
  if (v === '[]') return [];
  if (Array.isArray(existing)) {
    const m = v.match(/^-\s*(.*)$/);
    if (m) { const s = m[1].trim(); try { existing.push(JSON.parse(s)); } catch (e) { existing.push(s); } }
    return existing;
  }
  if (v === 'true' || v === 'false') return v === 'true';
  try { return JSON.parse(v); } catch (e) { return v.replace(/^"|"$/g, ''); }
}

// ---------------------------------------------------------------------------
// --configure 交互向导 + --dry-run / --apply
// ---------------------------------------------------------------------------

/** 向导逐项提问；返回 answers Map；干跑（无 TTY）按默认全填。
 *  ON-1：CLI flag 显式给出的字段跳过提问（flag 优先级最高）；既有 config.yaml 值作为提问缺省展示。 */
async function runConfigWizard(opts, existingValues) {
  const answers = new Map();
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    // 非交互 = 默认全选（可后改；落盘预览仍可核对）
    for (const f of CONFIG_FIELDS) answers.set(f.key, f.default);
    console.log('[executor-setup] 非 TTY 环境，各字段按默认值填写（可后改；--apply 实际写入）。');
    return answers;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n[executor-setup] 六字段编排配置向导（每项带默认，按回车采纳）：');
  try {
    for (const f of CONFIG_FIELDS) {
      const optsStr = f.options[0].length ? '（' + f.options[0].join('/') + '）' : '';
      const cur = existingValues.has(f.key) ? '（当前文件值: ' + JSON.stringify(existingValues.get(f.key)) + '）' : '';
      const prompt = `  ${f.key}${cur}\n    默认 ${f.default} · ${f.defaultReason}${optsStr}\n    你的回答 [直接回车=默认]: `;
      let raw = (await rl.question(prompt)).trim();
      if (raw === '') raw = String(f.default);
      answers.set(f.key, normalizeAnswer(f, raw));
    }
  } finally {
    rl.close();
  }
  return answers;
}

/** 打印"大白话"预览：你要把这些字段写到哪、各自是多少（来源标注：既有保留 / 默认 / CLI flag / 向导回答）。 */
function printPreview(cfg, existingValues) {
  const ex = existingValues || new Map();
  console.log('\n你将写入这些字段（落到 ' + CONFIG_TARGET + '；可后改，--apply 才真写）：');
  for (const f of CONFIG_FIELDS) {
    const src = ex.has(f.key) ? '既有值保留（不覆盖）' : '本次新填';
    console.log(`  ${f.key} = ${JSON.stringify(cfg[f.key])}（${src}）`);
    console.log(`      默认 ${f.default} · ${f.defaultReason}${f.note ? ' · ' + f.note : ''}`);
  }
  console.log('');
}

/** 落盘 CONFIG_TARGET（ON-1 幂等合并语义；未知键原样保留在文件头之后）。 */
async function writeConfig(cfg, workspace, unknownLines) {
  const target = path.join(path.resolve(workspace), CONFIG_TARGET);
  const text = serializeConfig(cfg);
  const extra = (unknownLines && unknownLines.length) ? unknownLines.join('\n') + '\n\n' : '';
  const head = '# orchestrator.config.yaml — 六字段编排配置\n# 来源：scripts/executor-setup.mjs 向导（--configure）；可后改。\n\n';
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, extra ? head + extra + text.split('\n').slice(2).join('\n') : text, 'utf8');
  return target;
}

/**
 * --configure 六字段编排配置主流程（ON-1 语义）：
 *   1. 读既有 orchestrator.config.yaml（如有）；
 *   2. 向导逐项问（每项带默认+理由+可后改注释）；CLI flag 显式给出的字段跳过提问；
 *   3. 合并：既有文件已知的六字段值 **不覆盖**（只补缺），新值只落空缺字段；
 *      CLI flag > 向导回答 > 既有文件值 > 默认值，但 flag 只在"该字段本就空缺/被确认"时落——
 *      简化口径（派单硬约束"不覆盖既有字段"优先）：既有文件已有值且无 --apply flag 强改 → 保留原值；
 *      字段空缺 → flag > 默认。
 *   4. --dry-run（或缺 --apply）：只打印大白话预览 + 拟落盘全文，零落盘；
 *      --apply：先打印预览再落盘；幂等（同一输入重跑逐字节一致）。
 */
async function runConfigure(opts) {
  const workspace = path.resolve(opts.workspace);
  const existing = readExistingConfigYaml(workspace);
  const existingValues = new Map();
  for (const [key, raw] of existing.values) {
    const f = CONFIG_FIELDS.find((x) => x.key === key);
    if (!f) continue;
    const v = parseYamlScalar(raw, Array.isArray(f.default) ? existing.values.get(key) : undefined);
    existingValues.set(key, f.coerce === 'bool' && typeof v === 'string' ? v.toLowerCase() === 'true' : v);
  }
  if (existing.known.length) {
    console.log('[executor-setup] 发现既有 ' + CONFIG_TARGET + '（已知字段 ' + existing.known.length + '/6）：只补缺项，不覆盖既有值。');
  }
  if (existing.unknown.length) {
    console.log('[executor-setup] 注意：既有文件含本向导不认识的键 ' + existing.unknown.join(', ') + '（原样保留语义，不解析不改写）。');
  }

  // 有 CLI flag 时跳过交互向导（flag 全覆盖场景，脚本化零提问）；否则进向导（非 TTY 默认全填）
  const hasFlags = [opts.subagentSource, opts.delegationMode, opts.critiqueSources, opts.reportStyle, opts.blindwalk, opts.mcpTools].some((v) => v !== null && v !== undefined);
  const answers = hasFlags && !process.stdin.isTTY
    ? new Map(CONFIG_FIELDS.map((f) => [f.key, f.default]))
    : await runConfigWizard(opts, existingValues);
  const answered = buildConfigFromAnswers(answers);

  // 合并优先级：CLI flag（校验后）> 向导回答 > 既有文件值 > 默认值；
  // 但"不覆盖既有字段"硬约束：字段在既有文件已有值时，flag/向导值不落——除非该字段本就缺。
  let cfg = {};
  for (const f of CONFIG_FIELDS) {
    if (existingValues.has(f.key)) {
      cfg[f.key] = existingValues.get(f.key); // 既有值保留（补缺模式）
    } else {
      cfg[f.key] = answered[f.key];
    }
  }
  cfg = applyFlagOverrides(cfg, opts);

  if (opts.dryRun || !opts.apply) {
    printPreview(cfg, existingValues);
    console.log('[executor-setup] --dry-run：未写入文件。以下为拟落盘全文：');
    console.log('--- ' + CONFIG_TARGET + ' ---');
    console.log(serializeConfig(cfg));
    console.log('--- end ---');
    return 0;
  }
  const target = await writeConfig(cfg, workspace, existing.unknownLines);
  printPreview(cfg, existingValues);
  console.log('[executor-setup] 已落盘 ' + target + '（幂等；重跑同输入逐字节一致，既有字段只补缺不覆盖）。');
  return 0;
}

export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (opts.help) { printHelp(); return 0; }

  if (opts.configure) {
    return runConfigure(opts);
  }

  if (opts.probe === 'presence') {
    const rows = probePresence(opts);
    printPresence(rows, opts.json);
    return 0;
  }
  if (opts.probe === 'roundtrip') {
    const targets = opts.executor ? [opts.executor] : (opts.only.length ? opts.only : []);
    if (!targets.length) {
      fail(2, 'roundtrip 探测必须显式指名目标（--cli <name> 或 --only <a,b,c>）——真实调用消耗 API 配额，不猜不默认（遗留①）');
    }
    const rows = [];
    for (const t of targets) rows.push(await probeRoundtrip(t, { timeoutMs: opts.timeoutMs || ROUNDTRIP_DEFAULT_TIMEOUT }));
    printRoundtrip(rows, opts.json);
    const anyOk = rows.some((r) => r.ok);
    return anyOk ? 0 : 1;
  }
  if (opts.probe) fail(2, '--probe 只接受 presence | roundtrip，收到 ' + opts.probe);

  if (opts.handoff) return runHandoff(opts);

  if (opts.nonInteractive) {
    const resolved = resolveNonInteractive(opts);
    if (opts.save) {
      if (!resolved.cli) fail(2, '--save 需要具体 cli（mode=' + resolved.mode + ' 无 CLI 可持久化）');
      const saved = await saveExecutorConfig(opts.workspace, {
        name: 'executor', version: EXECUTOR_VERSION,
        mode: 'B-cli', cli: resolved.cli,
        model: opts.model !== null ? opts.model : (resolved.stored ? resolved.stored.model ?? null : null),
        isolate: opts.isolate !== null ? opts.isolate : (resolved.stored ? resolved.stored.isolate ?? null : null),
      });
      console.log('已落盘 executor.json: ' + executorConfigPath(opts.workspace));
      console.log(JSON.stringify(saved, null, 2));
      return 0;
    }
    console.log('执行器解析结果（读取顺序：--executor 显式 > executor.json > 缺信息 exit 2）：');
    console.log(JSON.stringify({ mode: resolved.mode, cli: resolved.cli ?? null, model: resolved.stored ? resolved.stored.model ?? null : null, isolate: resolved.stored ? resolved.stored.isolate ?? null : null, source: resolved.source }, null, 2));
    return 0;
  }

  return runInteractive(opts);
}

// 直接执行时入口（被探针 import 时静默）
/* realpath 归一的主模块判定（junction/安装形态安全，2026-09-21 盲测修复同款） */
function isMainFileMatch() {
  try {
    const self = fs.realpathSync(fileURLToPath(import.meta.url));
    let entry = process.argv[1];
    if (!entry) return false;
    try { entry = fs.realpathSync(path.resolve(entry)); } catch { entry = path.resolve(entry); }
    return self === entry;
  } catch { return false; }
}
if (process.argv[1] && isMainFileMatch()) {
  main().then((code) => { process.exitCode = code; }).catch((e) => {
    if (e instanceof LockBusyError) fail(1, 'executor.json 写锁忙（fail-closed）: ' + e.message);
    fail(1, '运行异常: ' + String(e && e.stack || e));
  });
}
