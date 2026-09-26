#!/usr/bin/env node
/**
 * bootstrap-kernels.mjs — 外部执行内核可复现安装通道（KERNEL-1）。
 *
 * 背景（T0-ground-truth-20260926.md §2 ACCEPT-4）：be-validator 的 PRIMARY 内核
 * Spectral（@stoplight/spectral-cli）历史上以 `npm install --no-save` 装入 node_modules，
 * 而 node_modules 被 .gitignore 忽略 → 干净环境**不能据仓库声明恢复该内核**（R-2 D-1 事故根因：
 * npm prune 将其当 extraneous 删除）。另两个已迁移内核 semgrep / skill-scanner 走 pip 通道，
 * **无法进 package.json**——须由本脚本 + 文档声明覆盖，不得伪装成"已锁"。
 *
 * 三条内核的安装通道不同（诚实声明，不伪装统一）：
 *   ① spectral      → npm 面，已正式进 package.json `dependencies`（版本精确锁定 6.16.3）
 *                     且 package-lock.json 完整锁定传递树 → `npm ci` 即可复现。
 *   ② semgrep       → pip 面（PyPI semgrep==1.175.0；npm `semgrep` 为 ISC 假包禁用）。
 *   ③ skill-scanner → pip 面（PyPI cisco-ai-skill-scanner==2.1.0；
 *                      PyPI `skill-scanner` 0.3.3 为同名撞车假目标禁装——AS-2-sentinel D-2）。
 *
 * 语义：fail-closed。任一内核安装/核验失败 → 具名列出（kernel / channel / 期望版本 / 实测）
 *       并以 exit≠0 退出；**禁静默降级为"跳过"**（跳过 = 干净环境静默失去 PRIMARY 执行内核）。
 *
 * 用法：
 *   node scripts/bootstrap-kernels.mjs            # 安装缺失内核并核验（幂等）
 *   node scripts/bootstrap-kernels.mjs --check    # 只探测不安装（干净副本负向探针用）
 *   node scripts/bootstrap-kernels.mjs --json     # 结构化输出
 *   node scripts/bootstrap-kernels.mjs --python <path>   # 指定 python 解释器
 * 退出码：0 = 三内核全部可用且版本符合；1 = 有内核缺失/版本不符/安装失败。
 *
 * 许可证：spectral Apache-2.0（npm）；semgrep LGPL-2.1-or-later（pip，CLI spawn 无链接）；
 *         cisco-ai-skill-scanner Apache-2.0（pip）。均为独立进程调用，不并入本仓分发物。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IS_WIN = process.platform === 'win32';

const argv = process.argv.slice(2);
const CHECK_ONLY = argv.includes('--check');
const JSON_OUT = argv.includes('--json');
const pyFlagIdx = argv.indexOf('--python');
const PYTHON_OVERRIDE = pyFlagIdx >= 0 ? argv[pyFlagIdx + 1] : null;

/** 内核声明表（单一事实源）。channel 决定安装命令；expect 为 runtime_test 期望版本前缀。 */
const KERNELS = [
  {
    name: 'spectral',
    adapter: 'be-validator (PRIMARY)',
    channel: 'npm',
    package: '@stoplight/spectral-cli',
    lockedRange: '6.16.3',
    expect: '6.16.3',
    license: 'Apache-2.0',
    officialSource: 'github:stoplightio/spectral',
    install: { cmd: 'npm', args: ['ci', '--no-audit', '--no-fund'] },
  },
  {
    name: 'semgrep',
    adapter: 'security (PRIMARY)',
    channel: 'pip',
    package: 'semgrep',
    lockedRange: '1.175.0',
    expect: '1.175.0',
    license: 'LGPL-2.1-or-later',
    officialSource: 'github:semgrep/semgrep',
    install: { cmd: 'python', args: ['-m', 'pip', 'install', 'semgrep==1.175.0'] },
  },
  {
    name: 'skill-scanner',
    adapter: 'skill-sentinel (PRIMARY)',
    channel: 'pip',
    package: 'cisco-ai-skill-scanner',
    lockedRange: '2.1.0',
    expect: '2.1.0',
    license: 'Apache-2.0',
    officialSource: 'github:cisco-ai-defense/skill-scanner',
    // 同名撞车防护（AS-2-sentinel D-2）：PyPI `skill-scanner`（0.3.3 MIT）≠ 官方包 → 必须用官方包名安装。
    install: { cmd: 'python', args: ['-m', 'pip', 'install', 'cisco-ai-skill-scanner==2.1.0'] },
  },
];

/** PATH+PATHEXT 定位 CLI（Windows .cmd/.bat shim 语义与 adapters/util.mjs 一致）。 */
function which(cmd) {
  const exts = IS_WIN ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';') : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const cand = path.join(dir, cmd + ext);
      if (fs.existsSync(cand)) return cand;
    }
  }
  return null;
}

/** spectral 额外回落后备：<repo>/node_modules/.bin（npm ci 产物，未进 PATH 时可达）。 */
function whichSpectral() {
  const p = which('spectral');
  if (p) return p;
  const local = path.join(ROOT, 'node_modules', '.bin', IS_WIN ? 'spectral.cmd' : 'spectral');
  return fs.existsSync(local) ? local : null;
}

/** 探测 python 解释器：优先 --python 覆盖，再 python / python3 / py -3（Windows 启动器）。 */
function resolvePython() {
  const candidates = PYTHON_OVERRIDE
    ? [{ cmd: PYTHON_OVERRIDE, prefix: [] }]
    : (IS_WIN
        ? [{ cmd: 'python', prefix: [] }, { cmd: 'python3', prefix: [] }, { cmd: 'py', prefix: ['-3'] }]
        : [{ cmd: 'python3', prefix: [] }, { cmd: 'python', prefix: [] }]);
  for (const c of candidates) {
    const r = spawnSync(c.cmd, c.prefix.concat(['--version']), { encoding: 'utf8', shell: IS_WIN ? false : false, timeout: 20000 });
    const out = ((r.stdout || '') + (r.stderr || '')).trim();
    if (!r.error && /Python\s+\d+\.\d+/.test(out)) return { ...c, version: out };
  }
  return null;
}

function runCli(cmdPath, args) {
  // Windows .cmd/.bat shim：libuv spawn 不按 PATHEXT 解析，须经 ComSpec /d /c（与 adapters/util.mjs 同语义）。
  const low = String(cmdPath).toLowerCase();
  const viaCmd = IS_WIN && (low.endsWith('.cmd') || low.endsWith('.bat'));
  const r = viaCmd
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', cmdPath].concat(args), { encoding: 'utf8', timeout: 60000 })
    : spawnSync(cmdPath, args, { encoding: 'utf8', timeout: 60000 });
  return { ok: !r.error && r.status === 0, out: ((r.stdout || '') + (r.stderr || '')).trim() };
}

/** 版本 token 提取：兼容 spectral "6.16.3" / semgrep 带升级提示多行 / skill-scanner "… skill-scanner 2.1.0"。 */
function extractVersion(raw) {
  const m = String(raw || '').match(/(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}

function probe(kernel, py) {
  if (kernel.channel === 'npm') {
    const p = whichSpectral();
    if (!p) return { present: false, version: null, detail: 'spectral 不在 PATH 且 <repo>/node_modules/.bin/spectral 缺席' };
    const r = runCli(p, ['--version']);
    const v = r.ok ? extractVersion(r.out) : null;
    return { present: r.ok, version: v, detail: r.ok ? `${p} → ${r.out.split('\n')[0]}` : `${p} --version 失败: ${r.out.slice(0, 160)}` };
  }
  // pip 通道：CLI 在 PATH；装后必核 --version（包名≠capability 教训沉淀）
  const p = which(kernel.name);
  if (!p) return { present: false, version: null, detail: `${kernel.name} 不在 PATH（pip 通道未安装 ${kernel.package}）` };
  const r = runCli(p, ['--version']);
  const v = r.ok ? extractVersion(r.out) : null;
  return { present: r.ok, version: v, detail: r.ok ? `${p} → ${r.out.split('\n')[0]}` : `${p} --version 失败: ${r.out.slice(0, 160)}` };
}

function install(kernel, py) {
  if (kernel.channel === 'npm') {
    const npmCmd = IS_WIN ? 'npm.cmd' : 'npm';
    const r = spawnSync(npmCmd, kernel.install.args, { cwd: ROOT, encoding: 'utf8', timeout: 600000, shell: IS_WIN });
    return { ok: !r.error && r.status === 0, detail: (r.error ? r.error.message : '').slice(0, 200) || ((r.stdout || '') + (r.stderr || '')).trim().slice(-300) };
  }
  if (!py) return { ok: false, detail: '未找到 python 解释器（--python <path> 可显式指定）' };
  const args = py.prefix.concat(kernel.install.args);
  const r = spawnSync(py.cmd, args, { encoding: 'utf8', timeout: 600000 });
  return { ok: !r.error && r.status === 0, detail: (r.error ? r.error.message : '').slice(0, 200) || ((r.stdout || '') + (r.stderr || '')).trim().slice(-300) };
}

function main() {
  const py = resolvePython();
  const results = [];
  let failed = 0;

  for (const kernel of KERNELS) {
    let st = probe(kernel, py);
    let versionOk = st.present && st.version && st.version.startsWith(kernel.expect);
    let installed = false;
    if (!versionOk && !CHECK_ONLY) {
      const inst = install(kernel, py);
      installed = inst.ok;
      st = probe(kernel, py);
      versionOk = st.present && st.version && st.version.startsWith(kernel.expect);
      st.installDetail = inst.detail;
    }
    const ok = Boolean(versionOk);
    if (!ok) failed += 1;
    results.push({
      name: kernel.name,
      adapter: kernel.adapter,
      channel: kernel.channel,
      package: kernel.package,
      expect: kernel.expect,
      measured: st.version,
      present: st.present,
      installedNow: installed,
      ok,
      license: kernel.license,
      officialSource: kernel.officialSource,
      detail: st.detail + (st.installDetail ? ` | install: ${st.installDetail}` : ''),
    });
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({
      mode: CHECK_ONLY ? 'check' : 'bootstrap',
      python: py ? `${py.cmd} ${py.prefix.join(' ')} (${py.version})` : null,
      kernels: results,
      ok: failed === 0,
    }, null, 2));
  } else {
    console.log(`# bootstrap-kernels (${CHECK_ONLY ? 'check-only' : 'install+verify'})  python: ${py ? py.version : 'NOT FOUND'}`);
    for (const r of results) {
      const mark = r.ok ? 'OK  ' : 'MISS';
      console.log(`  [${mark}] ${r.name.padEnd(14)} ${r.channel.padEnd(4)} ${String(r.package).padEnd(26)} expect=${r.expect} measured=${r.measured || '-'}${r.ok ? '' : '  ⇐ ' + r.detail}`);
    }
    if (failed) {
      const names = results.filter((r) => !r.ok).map((r) => `${r.name}(${r.channel}:${r.package}@${r.expect})`);
      console.log(`\nKERNEL_BOOTSTRAP_FAIL: ${failed} 个内核不可用——${names.join(', ')}`);
      console.log('  干净环境将失去对应 PRIMARY 执行内核；禁静默跳过（fail-closed）。');
    } else {
      console.log('\nKERNEL_BOOTSTRAP_OK: 3 内核全部可用且版本符合声明。');
    }
  }
  process.exit(failed ? 1 : 0);
}

main();
