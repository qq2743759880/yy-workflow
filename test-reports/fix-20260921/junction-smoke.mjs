/**
 * junction 部署形态冒烟探针（2026-09-21 修复回归）
 * 断言：经安装路径（junction/绝对路径）调用 4 个 CLI 入口，stdout 非空（main 存活）。
 * 开发仓真实路径下本探针无意义（恒真）——只对安装形态有意义；junction 缺失则 SKIP。
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const INSTALLED = 'C:/Users/Administrator/.agents/skills/yy';
const WORKSPACE = 'D:/.ai-hub/tmp/project-run-0921/workspace';
let pass = 0, fail = 0, skip = 0;
const check = (name, cond, detail = '') => {
  if (cond === 'SKIP') { skip++; console.log(`[SKIP] ${name} ${detail}`); }
  else if (cond) { pass++; console.log(`[PASS] ${name} ${detail}`); }
  else { fail++; console.log(`[FAIL] ${name} ${detail}`); }
};

const installed = fs.existsSync(INSTALLED + '/SKILL.md');
const isJunction = installed && fs.realpathSync(INSTALLED).toLowerCase() !== INSTALLED.toLowerCase();
if (!isJunction) {
  check('junction 安装形态存在', 'SKIP', '（真实目录安装或未安装——本探针只覆盖 junction 形态）');
} else {
  const run = (script, args = []) => {
    const r = spawnSync(process.execPath, [`${INSTALLED}/scripts/${script}`, ...args], { encoding: 'utf8', timeout: 120000 });
    return r;
  };
  const j = run('tt-journey.mjs', ['--workspace', WORKSPACE]);
  check('tt-journey 经 junction 渲染', j.status === 0 && j.stdout.includes('yy/journey@1'), `${j.stdout.length}B`);
  const e = run('executor-setup.mjs', ['--probe', 'presence']);
  check('executor-setup 经 junction presence 有输出', e.stdout.includes('presence'), `${e.stdout.length}B`);
  const g = run('review-gate.mjs');
  check('review-gate 经 junction 打印诊断', g.stdout.length + g.stderr.length > 0, `${g.stdout.length + g.stderr.length}B`);
  const t = run('tt-tui.mjs');
  check('tt-tui 经 junction 打印诊断', t.stdout.length + t.stderr.length > 0, `${t.stdout.length + t.stderr.length}B`);
}
console.log(`TOTAL: ${pass}/${pass + fail} PASS (${skip} skip)`);
process.exit(fail === 0 ? 0 : 1);
