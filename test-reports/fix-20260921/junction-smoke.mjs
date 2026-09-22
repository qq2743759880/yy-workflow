/**
 * junction 部署形态冒烟探针（2026-09-21 修复回归；HARD-1 起可被 regression-all S13 复用）。
 * 断言：经安装路径（junction/绝对路径）调用 4 个 CLI 入口，stdout 非空（main 存活）。
 * 开发仓真实路径下本探针无意义（恒真）——只对安装形态有意义；junction 缺失则 SKIP。
 *
 * 复用形态（HARD-1）：
 *   export runJunctionSmoke(opts) → { skipped, pass, fail, lines }
 *   - junction 形态存在：真实执行 4 项探针，skipped=false，pass/fail 计数。
 *   - junction 形态不存在（真实目录安装或未安装）：skipped=true，不进 PASS/FAIL 计数。
 *   - opts.installed / opts.workspace 可注入；默认探测路径可用环境变量
 *     TT_JUNCTION_PROBE_PATH 覆盖（HARD-1 无 junction 模拟手段，生产勿设）。
 * 直接 `node junction-smoke.mjs` 仍按原有独立脚本输出运行。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_INSTALLED = 'C:/Users/Administrator/.agents/skills/yy';
const DEFAULT_WORKSPACE = 'D:/.ai-hub/tmp/project-run-0921/workspace';

/**
 * junction 探测：realpath(child) ≠ realpath(parent)/basename ⇒ 安装位是链接（junction/symlink）。
 * 对真实目录两者相等（不含旧版「与字面量串比较」把正反斜杠差异误判为 junction 的问题）。
 */
function isJunctionInstall(installed) {
  const abs = path.resolve(installed);
  if (!fs.existsSync(path.join(abs, 'SKILL.md'))) return false;
  try {
    const real = fs.realpathSync(abs);
    const viaParent = path.join(fs.realpathSync(path.dirname(abs)), path.basename(abs));
    return real.toLowerCase() !== viaParent.toLowerCase();
  } catch {
    return false;
  }
}

export function runJunctionSmoke(opts = {}) {
  const installed = opts.installed || process.env.TT_JUNCTION_PROBE_PATH || DEFAULT_INSTALLED;
  const workspace = opts.workspace || DEFAULT_WORKSPACE;
  const lines = [];
  const emit = function (s) { lines.push(s); if (opts.log) opts.log(s); };
  let pass = 0, fail = 0;

  if (!isJunctionInstall(installed)) {
    emit('[SKIP] junction 安装形态存在 （真实目录安装或未安装——本探针只覆盖 junction 形态）');
    return { skipped: true, pass: 0, fail: 0, lines };
  }

  const run = function (script, args = []) {
    return spawnSync(process.execPath, [path.join(installed, 'scripts', script), ...args], { encoding: 'utf8', timeout: 120000 });
  };
  const check = function (name, cond, detail = '') {
    if (cond) { pass++; emit(`[PASS] ${name} ${detail}`); }
    else { fail++; emit(`[FAIL] ${name} ${detail}`); }
  };
  const j = run('tt-journey.mjs', ['--workspace', workspace]);
  check('tt-journey 经 junction 渲染', j.status === 0 && j.stdout.includes('yy/journey@1'), `${j.stdout.length}B`);
  const e = run('executor-setup.mjs', ['--probe', 'presence']);
  check('executor-setup 经 junction presence 有输出', e.stdout.includes('presence'), `${e.stdout.length}B`);
  const g = run('review-gate.mjs');
  check('review-gate 经 junction 打印诊断', g.stdout.length + g.stderr.length > 0, `${g.stdout.length + g.stderr.length}B`);
  const t = run('tt-tui.mjs');
  check('tt-tui 经 junction 打印诊断', t.stdout.length + t.stderr.length > 0, `${t.stdout.length + t.stderr.length}B`);
  return { skipped: false, pass, fail, lines };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const r = runJunctionSmoke({ log: console.log });
  console.log(`TOTAL: ${r.pass}/${r.pass + r.fail} PASS (${r.skipped ? 1 : 0} skip)`);
  process.exit(r.fail === 0 ? 0 : 1);
}
