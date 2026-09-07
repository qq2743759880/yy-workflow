#!/usr/bin/env node
/**
 * YY — 依赖可用性盘点（audit-deps）。
 * 对 docs/DEPENDENCY-AUDIT.md 的机器可执行版：逐条 probe npm 包 / 系统 CLI / Python venv / AIHUB thirdparty，
 * 输出真实可用性（版本号实测），不安装任何东西。零外部依赖（node: 内建）。
 * 用法: node scripts/audit-deps.mjs [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire as mkRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function npmDeps() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    return { deps: pkg.dependencies || {}, optional: pkg.optionalDependencies || {} };
  } catch (e) { return { deps: {}, optional: {}, error: e.message }; }
}

/** npm 包解析：优先 yy 包内 node_modules，回落 AIHUB thirdparty。 */
function resolveNpm(name) {
  const aihub = path.join(process.env.AIHUB_ROOT || path.join(os.homedir(), '.ai-hub'), 'thirdparty');
  const bases = [ROOT, aihub, path.join(aihub, 'node_modules')];
  for (const base of bases) {
    // 直接探测 <base>/<name>/package.json（createRequire 的 resolve 需要 base 下有真实 cjs 锚点，thirdparty 根目录没有）
    const direct = path.join(base, name, 'package.json');
    if (fs.existsSync(direct)) {
      try { return { ok: true, version: JSON.parse(fs.readFileSync(direct, 'utf8')).version, from: base === ROOT ? 'yy/node_modules' : 'AIHUB thirdparty' }; }
      catch (e) { /* fallthrough */ }
    }
    // node_modules 布局：嵌套依赖可能在 <base>/node_modules/<name>
    const nested = path.join(base, 'node_modules', name, 'package.json');
    if (fs.existsSync(nested)) {
      try { return { ok: true, version: JSON.parse(fs.readFileSync(nested, 'utf8')).version, from: base === ROOT ? 'yy/node_modules' : 'AIHUB thirdparty' }; }
      catch (e) { /* fallthrough */ }
    }
    try {
      const req = mkRequire(path.join(base, 'noop.cjs'));
      const pj = req.resolve(name + '/package.json');
      const ver = JSON.parse(fs.readFileSync(pj, 'utf8')).version;
      return { ok: true, version: ver, from: base === ROOT ? 'yy/node_modules' : 'AIHUB thirdparty' };
    } catch (e) { /* try next */ }
  }
  return { ok: false };
}

/** PATH CLI 探测（Windows PATHEXT shim）。 */
function which(cli) {
  const dirs = (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':').filter(Boolean);
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';') : [''];
  for (const d of dirs) for (const ext of exts) {
    const p = path.join(d, cli + ext);
    if (fs.existsSync(p)) return { ok: true, path: p };
  }
  return { ok: false };
}

function cliVersion(cli, args) {
  const r = spawnSync(cli + ' ' + (args || ['--version']).join(' '), { encoding: 'utf8', timeout: 20000, shell: process.platform === 'win32' });
  if (r.error) return null;
  const line = ((r.stdout || '') + (r.stderr || '')).trim().split('\n')[0];
  return line || null;
}

function venvPkg(venv, pkgName) {
  const aihub = process.env.AIHUB_ROOT || path.join(os.homedir(), '.ai-hub');
  const sitePkgs = [path.join(aihub, 'thirdparty', venv, 'Lib', 'site-packages'), path.join(aihub, 'thirdparty', venv, 'lib', 'site-packages')];
  const base = sitePkgs.find((p) => fs.existsSync(p));
  if (!base) return { ok: false, note: 'venv 不存在: ' + venv };
  const hit = fs.readdirSync(base).find((n) => n.toLowerCase().startsWith(pkgName.toLowerCase()));
  return hit ? { ok: true, version: (hit.match(/[\d.]+/) || [null])[0], from: venv } : { ok: false, note: venv + ' 无 ' + pkgName };
}

const rows = [];
function row(kind, name, expect, got) { rows.push({ kind, name, expect, ...got }); }

// ① yy/package.json 声明的 npm 依赖
const { deps, optional, error } = npmDeps();
if (error) rows.push({ kind: 'package.json', name: '-', expect: '-', ok: false, note: error });
for (const [name, range] of Object.entries(deps)) row('npm:dep', name, range, resolveNpm(name));
for (const [name, range] of Object.entries(optional)) row('npm:optional', name, range, resolveNpm(name));

// ② 系统 CLI（DEPENDENCY-AUDIT §1/§2）
const CLIS = [
  ['semgrep', ['--version']], ['gitleaks', ['version']], ['portman', ['--version']],
  ['opencode', ['--version']], ['claude', ['--version']], ['codex', ['--version']],
  ['shadcn', ['--version']], ['newman', ['--version']], ['mmdc', ['--version']],
];
for (const [cli, args] of CLIS) {
  const w = which(cli);
  row('cli', cli, w.ok ? '在 PATH' : '不在 PATH', w.ok ? { ok: true, version: cliVersion(cli, args), from: w.path } : { ok: false, note: '未装（诚实降级路径见 DEPENDENCY-AUDIT）' });
}

// ③ Python venv 内核
for (const [venv, pkg] of [['venv-gpt-researcher', 'gpt_researcher'], ['venv-crewai-py311', 'crewai'], ['venv-metagpt', 'metagpt']]) {
  row('venv', pkg, 'venv ' + venv, venvPkg(venv, pkg));
}

// ④ 浏览器（playwright 全功能前置）
const pwDir = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
const hasBrowsers = fs.existsSync(pwDir) && fs.readdirSync(pwDir).some((n) => n.startsWith('chromium-'));
row('browser', 'playwright chromium', hasBrowsers ? 'ms-playwright 有构建' : 'ms-playwright 空', hasBrowsers ? { ok: true, from: pwDir } : { ok: false, note: '无浏览器构建 → 截图走 executablePath(系统 Chrome) 或 npx playwright install chromium' });

// 输出
console.log('# YY dependency audit (audit-deps.mjs)');
let pass = 0, fail = 0, warn = 0;
for (const r of rows) {
  const ok = r.kind === 'cli' && r.expect === '在 PATH' ? true : r.ok;
  const soft = !ok && (r.kind === 'npm:optional' || r.kind === 'cli' || r.kind === 'venv' || r.kind === 'browser');
  const mark = ok ? 'OK  ' : (soft ? 'WARN' : 'MISS');
  if (ok) pass += 1; else if (soft) warn += 1; else fail += 1;
  console.log('  [' + mark + '] ' + r.kind.padEnd(13) + r.name.padEnd(20) + (r.expect || '') + (r.version ? '  v' + r.version : '') + (r.from ? '  (' + r.from + ')' : '') + (r.note ? '  · ' + r.note : ''));
}
console.log('\n结果: ' + pass + ' OK / ' + warn + ' WARN(可选,降级合规) / ' + fail + ' MISS(包内声明缺失)');
if (fail > 0) process.exitCode = 1;
console.log('依据: yy/docs/DEPENDENCY-AUDIT.md（每条含 URL/版本，2026-09-07 盘点）');