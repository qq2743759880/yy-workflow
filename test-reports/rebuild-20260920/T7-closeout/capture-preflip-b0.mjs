#!/usr/bin/env node
/**
 * capture-preflip-b0.mjs — 翻默认前捕获 B0 差分基准快照（T7 收尾批 ②）。
 *
 * 背景：B0 翻默认（scripts/ci.mjs 默认走 lib/ci.mjs）后，原 b0-diff.mjs 的
 * "default(legacy) vs --lib" 双跑口径失效（legacy 内联路径删除）。派单允许二选一：
 * "新默认 vs --legacy（若保留）"或"输出快照对比"——本批选 **输出快照对比**：
 * 翻默认前用当时的 default（= legacy 内联路径）跑 G1-G4 四组，归一化后落
 * T4-wiring-b0b3/snapshots/*.txt 作为冻结基准；翻默认后由 b0-diff.mjs 拿新默认输出比对。
 *
 * 归一化（去环境噪声，非去语义差异）：
 *   - 随机 plan id：plan-mu9<base36> → plan-RAND
 *   - 临时目录绝对路径 → TMPDIR / TMPDIR/tt-RAND
 * 语义差异（S5 严格口径导致的失败文案）不在本脚本内消除——由 b0-diff.mjs 以
 * **已申报差异 allowlist** 显式剥离并计数，禁止静默。
 *
 * 沙箱：G2-G4 在 scripts/ 副本沙箱内跑（ci.mjs ROOT 取自自身位置，不碰真实仓库）；
 * G1 在真实仓库只读跑（ci.mjs 会写 os.tmpdir 的临时报告，清理后无残留）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const SNAP_DIR = path.join(REPO, 'test-reports', 'rebuild-20260920', 'T4-wiring-b0b3', 'snapshots');

function runCi(cwd, extraArgs = []) {
  const ciPath = path.join(cwd, 'scripts', 'ci.mjs');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [ciPath, ...extraArgs], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (c) => { out += c.toString(); });
    child.stderr.on('data', (c) => { out += c.toString(); });
    child.on('close', (code) => resolve({ code, out }));
  });
}

export function normalize(s) {
  let out = s;
  out = out.replace(/plan-mu9[a-z0-9]+/g, 'plan-RAND');
  const tmp = os.tmpdir().replace(/\\/g, '/');
  out = out.split(tmp).join('TMPDIR');
  out = out.replace(/[A-Za-z]:[\\/][^\s"]*?[\\/]tt-[a-z0-9]+-[a-z0-9]+/g, 'TMPDIR/tt-RAND');
  return out;
}

function makeSandbox(tag) {
  const sb = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-t7-' + tag + '-'));
  fs.cpSync(path.join(REPO, 'scripts'), path.join(sb, 'scripts'), { recursive: true });
  return sb;
}

const STUBS = ['validate-structure.mjs', 'review-gate.mjs', 'plan-review.mjs', 'regression-all.mjs', 'asset-call-rate.mjs'];

fs.mkdirSync(SNAP_DIR, { recursive: true });
const summary = [];

// ── G1 成功组（真实仓库，慢）──
const g1 = await runCi(REPO);
fs.writeFileSync(path.join(SNAP_DIR, 'g1-real-repo.txt'), normalize(g1.out), 'utf8');
summary.push('G1 exit=' + g1.code + ' rawBytes=' + g1.out.length + ' normBytes=' + normalize(g1.out).length);

// ── G2 S1 失败：SKILL.md 缺 frontmatter ──
const sb2 = makeSandbox('g2');
fs.writeFileSync(path.join(sb2, 'SKILL.md'), '# no frontmatter\n');
const g2 = await runCi(sb2);
fs.writeFileSync(path.join(SNAP_DIR, 'g2-s1-fail.txt'), normalize(g2.out), 'utf8');
summary.push('G2 exit=' + g2.code);
fs.rmSync(sb2, { recursive: true, force: true });

// ── G3 spawn 失败：删 validate-structure.mjs ──
const sb3 = makeSandbox('g3');
fs.writeFileSync(path.join(sb3, 'SKILL.md'), '---\nname: x\nversion: 1\ndescription: x\n---\n# body\n');
fs.rmSync(path.join(sb3, 'scripts', 'validate-structure.mjs'), { force: true });
const g3 = await runCi(sb3);
fs.writeFileSync(path.join(SNAP_DIR, 'g3-spawn-fail.txt'), normalize(g3.out), 'utf8');
summary.push('G3 exit=' + g3.code);
fs.rmSync(sb3, { recursive: true, force: true });

// ── G4 S5 P0 失败：S1-S4 桩 exit0 + tracker 含 P0 ⬜ ──
const sb4 = makeSandbox('g4');
for (const s of STUBS) {
  fs.writeFileSync(path.join(sb4, 'scripts', s), "#!/usr/bin/env node\nconsole.log('stub " + s.replace('.mjs', '') + " ok');\n");
}
fs.mkdirSync(path.join(sb4, 'plans'), { recursive: true });
fs.writeFileSync(path.join(sb4, 'plans', 'critique-backlog-tracker.md'),
  '# tracker\n\n| ID | 级别 | 状态 |\n| C-1 | P0 | ⬜ open |\n');
const g4 = await runCi(sb4);
fs.writeFileSync(path.join(SNAP_DIR, 'g4-s5-p0-fail.txt'), normalize(g4.out), 'utf8');
summary.push('G4 exit=' + g4.code);
fs.rmSync(sb4, { recursive: true, force: true });

console.log('PREFLIP SNAPSHOTS → ' + SNAP_DIR);
for (const s of summary) console.log('  ' + s);
