#!/usr/bin/env node
/**
 * TT skill — 多宿主统一只读探测（零依赖，node >= 18）。
 * 只读探测本机各 AI CLI 宿主是否可用：只跑 --version 类命令，不写任何配置文件、不改环境、不登录。
 *
 * 用法:
 *   node exec-host-probe.mjs                  # 探测全部目标（opencode/claude/codex/cursor/trae/openclaw/a6api）
 *   node exec-host-probe.mjs opencode codex    # 只探测指定目标（位置参数，可多个）
 *   node exec-host-probe.mjs --only claude,codex --json
 *
 * 选项:
 *   --only <a,b,c>   只探测指定目标（逗号分隔，等价位置参数）
 *   --json           仅输出 JSON（供编排器/脚本消费）；缺省输出可读表格 + JSON
 *   --timeout <ms>   单目标版本探测超时（默认 15000）
 *
 * 探测命令只从 env / PATH 读取（不硬编码任何本机绝对路径）：
 *   - 环境变量覆盖：TT_PROBE_<NAME> 指定显式命令（如 TT_PROBE_OPENCODE=opencode），
 *     缺省沿 PATH+PATHEXT 定位（Windows .cmd/.bat shim 经 ComSpec 启动）。
 *   - a6api 是 HTTP 参考宿主（非 CLI）：只读 GET 其 /v1/models 探端点可达性，不触发任何业务调用。
 *
 * 退出码恒为 0（部分不可用记录 available=false，不因探测失败崩溃）。
 */
import { spawn } from 'node:child_process';
import { resolveCommandShim } from './lib/adapters/util.mjs';

const ALL = ['opencode', 'claude', 'codex', 'cursor', 'trae', 'openclaw', 'a6api'];

// 各目标只读版本探测命令（args，均为无副作用只读命令）；a6api 无 CLI，走端点探测
const VERSION_ARGS = {
  opencode: ['--version'],
  claude: ['--version'],
  codex: ['--version'],
  cursor: ['--version'],
  trae: ['--version'],
  openclaw: ['--version'],
  a6api: null,
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { targets: [], json: false, timeoutMs: 15000 };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--json') opts.json = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else if (a === '--only') { opts.targets.push(...(args[i + 1] || '').split(',').map((s) => s.trim()).filter(Boolean)); i += 1; }
    else if (a === '--timeout') { const v = Number(args[i + 1]); if (!Number.isNaN(v) && v > 0) opts.timeoutMs = v; i += 1; }
    else if (!a.startsWith('--')) opts.targets.push(a);
  }
  opts.targets = [...new Set(opts.targets.length ? opts.targets : ALL)];
  return opts;
}

function printHelp() {
  console.log('用法: node exec-host-probe.mjs [--only <a,b,c>] [--json] [--timeout <ms>] [name...]');
}

// 沿 PATH+PATHEXT 定位命令，返回可执行形式（{command,prefix}）。读自 env，不硬编码路径。
function resolveCommand(name) {
  const explicit = process.env['TT_PROBE_' + name.toUpperCase()];
  if (explicit && explicit.trim()) return { command: explicit.trim(), prefix: [], source: 'env' };
  return Object.assign({ source: 'PATH' }, resolveCommandShim(name));
}

// 只读跑一次版本命令，返回 {available, version, raw}。stdin 用 ignore 防继承挂起（与既有宿主一致）。
function runVersion(entry) {
  return new Promise((resolve) => {
    const { command, prefix } = entry;
    const timer = setTimeout(() => { child.kill(); resolve({ available: false, version: '', raw: '', note: '版本探测超时（' + entry.timeout + 'ms）' }); }, entry.timeout);
    if (timer.unref) timer.unref();
    let stdout = '';
    let stderr = '';
    let done = false;
    const child = spawn(command, prefix.concat(entry.args), { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', (e) => { finish({ available: false, version: '', raw: '', note: e.code === 'ENOENT' ? '未在 PATH 找到命令' : String(e.message || e) }); });
    child.on('close', (code) => {
      const raw = (stdout.trim() + (stderr ? '\n' + stderr.trim() : '')).trim();
      const first = (stdout.trim().split('\n')[0] || stderr.trim().split('\n')[0] || '').trim();
      finish({ available: code === 0, version: first, raw, note: code === 0 ? '' : '版本命令退出码 ' + code });
    });
    function finish(r) { if (done) return; done = true; clearTimeout(timer); resolve(r); }
  });
}

// a6api 是 HTTP 参考宿主（非 CLI）：只读 GET /v1/models 探端点可达性（任意 HTTP 状态均视为可达端点）。
async function probeA6api(timeoutMs) {
  const base = process.env.A6API_BASE_URL ? process.env.A6API_BASE_URL.replace(/\/+$/, '') : 'http://127.0.0.1:15724';
  const url = base + '/v1/models';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
    return { available: true, version: '', raw: 'HTTP ' + res.status, note: 'HTTP 端点可达（非 CLI，参考宿主）' };
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    return { available: false, version: '', raw: '', note: 'HTTP 端点不可达: ' + msg.slice(0, 120) };
  }
}

async function main() {
  const opts = parseArgs();
  const results = [];
  for (const name of opts.targets) {
    const base = { name, command: '', version: '', available: false, note: '' };
    if (name === 'a6api') {
      const p = await probeA6api(opts.timeoutMs);
      base.command = 'HTTP:' + (process.env.A6API_BASE_URL ? 'env' : 'default-endpoint');
      base.available = p.available;
      base.note = p.note + (p.raw ? ' (' + p.raw + ')' : '');
      results.push(base);
      continue;
    }
    const entry = resolveCommand(name);
    entry.args = VERSION_ARGS[name] || [];
    entry.timeout = opts.timeoutMs;
    entry.command = entry.command;
    if (!entry.args.length) { base.note = '无只读版本命令（探测跳过）'; results.push(base); continue; }
    const v = await runVersion(entry);
    base.command = entry.command + (entry.prefix.length ? ' [' + entry.prefix.join(' ') + ']' : '') + ' (from ' + entry.source + ')';
    base.available = v.available;
    base.version = v.version;
    base.note = v.note || '';
    results.push(base);
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  } else {
    const pad = (s, n) => String(s).padEnd(n).slice(0, n);
    console.log('TT 多宿主只读探测（不写配置、不改环境、不登录）\n');
    console.log(pad('CLI', 10) + pad('available', 10) + pad('version', 22) + 'command / note');
    console.log('-'.repeat(100));
    for (const r of results) {
      console.log(pad(r.name, 10) + pad(r.available ? 'YES' : 'NO', 10) + pad(r.version || '-', 22) + (r.command || '-') + (r.note ? '  · ' + r.note : ''));
    }
    const yes = results.filter((r) => r.available).length;
    console.log('\n可用 ' + yes + '/' + results.length);
    console.log('\n-- JSON --');
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  }
}

main().catch((e) => { console.error('[exec-host-probe] 探测异常: ' + String(e && e.message || e)); process.exit(0); });