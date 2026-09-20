#!/usr/bin/env node
/**
 * B0 自测（T7 收尾批②口径：**输出快照对比**）— ci.mjs 翻默认后的行为等价证明。
 *
 * 背景：翻默认前本脚本口径是「default(legacy 内联) vs --lib 双跑逐字节一致」。
 * ② 翻默认后 legacy 内联路径**已删除**（本批选择"删除"而非保留 --legacy 逃生舱），
 * 故口径改为：**新默认（lib 驱动）输出 vs 翻默认前捕获的冻结快照**。
 *
 *   冻结快照：T4-wiring-b0b3/snapshots/{g1-real-repo,g2-s1-fail,g3-spawn-fail,g4-s5-p0-fail}.txt
 *             由 capture-preflip-b0.mjs 于翻默认前用当时的 default（legacy）跑出并归一化。
 *
 * 组：
 *   G1 成功组（真实仓库）：新默认 vs 快照，全部门过。
 *   G2 S1 失败组（沙箱）：SKILL.md 缺 frontmatter → S1 失败 exit1。
 *   G3 spawn 失败组（沙箱）：删 validate-structure.mjs → spawn error exit1。
 *   G4 S5 P0 失败组（沙箱）：S1-S4 桩 exit0 + tracker 含 P0 ⬜ → S5 失败 exit1。
 *   G5 兼容 no-op（沙箱）：默认 vs --lib 逐字节一致（--lib 翻默认后不再改变行为）。
 *
 * 两类差异**分开处理、禁止静默**：
 *   1) 环境噪声（随机 plan id / tmp 路径 / 临时报告名）→ normalize() 归一化；
 *   2) 已申报语义差异（S5 严格口径落地导致的 S5 判定文案——change record
 *      cr-20260920T112945Z-a6244b0c）→ DECLARED_DELTAS 逐条正向改写快照，并**计数打印**；
 *      改写后仍须逐字节一致，任何未申报差异即 FAIL 并打印首处分歧上下文。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const SNAP_DIR = path.join(HERE, 'snapshots');

const results = [];
function check(name, ok, detail = '') {
  results.push([name, ok, detail]);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : ''));
}

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

/** 环境噪声归一化（非语义差异）。 */
function normalize(s) {
  let out = s;
  out = out.replace(/plan-mu9[a-z0-9]+/g, 'plan-RAND');
  out = out.replace(/tt-ci-plan-review-\d+-\d+/g, 'tt-ci-plan-review-RAND');
  // 临时目录：报告/沙箱绝对路径在 stdout+stderr 中可能是反斜杠或正斜杠两种形态，都要归一化
  const tmpRaw = os.tmpdir();
  const tmpFwd = tmpRaw.replace(/\\/g, '/');
  out = out.split(tmpFwd).join('TMPDIR').split(tmpRaw).join('TMPDIR');
  // 沙箱目录名（yy-t7-gN-XXXX / yy-t7b0-gN-XXXX）：随机后缀与批次前缀都属环境噪声
  out = out.replace(/yy-t7[a-z0-9]*-g\d+-[A-Za-z0-9]+/g, 'yy-SANDBOX');
  out = out.replace(/[A-Za-z]:[\\/][^\s"]*?[\\/]tt-[a-z0-9]+-[a-z0-9]+/g, 'TMPDIR/tt-RAND');
  return out;
}

/**
 * 已申报语义差异（S5 严格口径，change record cr-20260920T112945Z-a6244b0c）。
 * 方向：把**翻默认前快照**里的旧文案正向改写为新文案；改写条数打印，禁止静默。
 */
const DECLARED_DELTAS = [
  {
    id: 'S5-FAIL-STRICT',
    note: 'S5 FAIL 文案：⬜-only → 严格口径 ⬜/◐',
    re: /P0 批判未清零（(\d+) 条 ⬜）/g,
    to: 'P0 批判未清零（$1 条未闭环 ⬜/◐）',
  },
  {
    id: 'S5-PASS-STRICT',
    note: 'S5 PASS 文案：⬜-only → 严格口径 ⬜/◐',
    re: /S5 P0 硬闸门（0 条 P0 ⬜）/g,
    to: 'S5 P0 硬闸门（0 条 P0 未闭环 ⬜/◐）',
  },
];

function applyDeclaredDeltas(snapshotText) {
  let out = snapshotText;
  const counts = {};
  for (const d of DECLARED_DELTAS) {
    const m = out.match(d.re);
    counts[d.id] = m ? m.length : 0;
    out = out.replace(d.re, d.to);
  }
  return { text: out, counts };
}

function firstDiff(a, b) {
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  const ctx = (s, p) => JSON.stringify(s.slice(Math.max(0, p - 60), p + 60));
  return 'first mismatch @' + i + '\n    snapshot: ' + ctx(a, i) + '\n    actual:   ' + ctx(b, i);
}

function makeSandbox(tag) {
  const sb = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-t7b0-' + tag + '-'));
  fs.cpSync(path.join(REPO, 'scripts'), path.join(sb, 'scripts'), { recursive: true });
  return sb;
}

const STUBS = ['validate-structure.mjs', 'review-gate.mjs', 'plan-review.mjs', 'regression-all.mjs', 'asset-call-rate.mjs'];
const declaredTotal = {};

/** 单组比对：跑 new default → 归一化 → 快照归一化 + 已申报差异改写 → 逐字节比。 */
async function compareGroup(id, cwd, snapshotFile, expectExit, extra = []) {
  const snapRaw = fs.readFileSync(snapshotFile, 'utf8');
  const { text: snap, counts } = applyDeclaredDeltas(normalize(snapRaw));
  for (const [k, v] of Object.entries(counts)) declaredTotal[k] = (declaredTotal[k] ?? 0) + v;
  const run = await runCi(cwd, extra);
  const actual = normalize(run.out);
  const same = snap === actual;
  check(`${id} 新默认 vs 冻结快照（去噪 + 已申报差异后逐字节一致）`, same,
    same
      ? `exit=${run.code} bytes=${actual.length} 已申报差异=${JSON.stringify(counts)}`
      : 'exit=' + run.code + ' bytes=' + actual.length + ' ' + firstDiff(snap, actual));
  check(`${id} 退出码 = ${expectExit}`, run.code === expectExit, 'exit=' + run.code);
  return run;
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-t7b0-'));
try {
  // ── G1 成功组（真实仓库，较慢：内含 regression-all）──
  console.log('G1 成功组：跑真实仓库 ci.mjs 新默认 vs 翻默认前快照（约 1 分钟）...');
  await compareGroup('G1', REPO, path.join(SNAP_DIR, 'g1-real-repo.txt'), 0);

  // ── G2 S1 失败：SKILL.md 缺 frontmatter ──
  const sb2 = makeSandbox('g2');
  fs.writeFileSync(path.join(sb2, 'SKILL.md'), '# no frontmatter\n');
  await compareGroup('G2', sb2, path.join(SNAP_DIR, 'g2-s1-fail.txt'), 1);
  fs.rmSync(sb2, { recursive: true, force: true });

  // ── G3 spawn 失败：删 validate-structure.mjs ──
  const sb3 = makeSandbox('g3');
  fs.writeFileSync(path.join(sb3, 'SKILL.md'), '---\nname: x\nversion: 1\ndescription: x\n---\n# body\n');
  fs.rmSync(path.join(sb3, 'scripts', 'validate-structure.mjs'), { force: true });
  await compareGroup('G3', sb3, path.join(SNAP_DIR, 'g3-spawn-fail.txt'), 1);
  fs.rmSync(sb3, { recursive: true, force: true });

  // ── G4 S5 P0 失败：S1-S4 桩 exit0 + tracker 含 P0 ⬜ ──
  const sb4 = makeSandbox('g4');
  for (const s of STUBS) {
    fs.writeFileSync(path.join(sb4, 'scripts', s), "#!/usr/bin/env node\nconsole.log('stub " + s.replace('.mjs', '') + " ok');\n");
  }
  fs.mkdirSync(path.join(sb4, 'plans'), { recursive: true });
  fs.writeFileSync(path.join(sb4, 'plans', 'critique-backlog-tracker.md'),
    '# tracker\n\n| ID | 级别 | 状态 |\n| C-1 | P0 | ⬜ open |\n');
  const g4Default = await compareGroup('G4', sb4, path.join(SNAP_DIR, 'g4-s5-p0-fail.txt'), 1);
  const g4Lib = await runCi(sb4, ['--lib']);
  check('G5 --lib 兼容 no-op：默认 vs --lib 逐字节一致',
    g4Default.out === g4Lib.out && g4Lib.code === 1,
    'defaultBytes=' + g4Default.out.length + ' libBytes=' + g4Lib.out.length
    + ' exit=' + g4Default.code + '/' + g4Lib.code
    + ' libFlagNotice=' + /--lib 已为默认路径/.test(g4Lib.out));
  fs.rmSync(sb4, { recursive: true, force: true });
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

console.log('\n已申报语义差异累计：' + JSON.stringify(declaredTotal));
for (const d of DECLARED_DELTAS) console.log('  ' + d.id + ' — ' + d.note);
const failed = results.filter(([, ok]) => !ok);
console.log('\nB0 self-test: ' + (results.length - failed.length) + '/' + results.length + ' passed');
process.exitCode = failed.length ? 1 : 0;
