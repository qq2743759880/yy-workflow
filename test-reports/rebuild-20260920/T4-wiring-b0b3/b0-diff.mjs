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
 *   1) 环境噪声（随机 plan id / tmp 路径 / 临时报告名 / **Node 内部帧行号 / Node 版本 /
 *      errno 数值**）→ normalize() 归一化；
 *   2) 已申报语义差异（S5 严格口径落地导致的 S5 判定文案——change record
 *      cr-20260920T112945Z-a6244b0c；以及 P1-2 裁决批准的 S1/S3 崩溃路径干净捕获）
 *      → DECLARED_DELTAS 逐条正向改写快照，并**计数打印**；
 *      改写后仍须逐字节一致，任何未申报差异即 FAIL 并打印首处分歧上下文。
 *
 * T8 加固批④（编排者 P1-2 处置）——**崩溃栈结构归一**：
 *   P1-2 事实：G2/G3 的差分此前依赖崩溃栈逐字节相等，而栈里的
 *     - Node 内部帧（`node:fs:1590:26`、`node:internal/modules/cjs/loader:1383:15` …）行/列号，
 *     - `Node.js v22.22.2` 版本串、
 *     - `errno: -4058` 平台数值、
 *     - 以及**栈段本身是否出现**（legacy stdio inherit 透传原始栈 vs runGate 干净捕获）
 *   全部随 Node 构建/平台而变 ⇒ 异构环境必挂（编排者复跑 7/9 实证）。
 *   处置（两步，均在两侧同口径施加）：
 *     a. `canonicalizeCrash()`：把整个崩溃栈段（从 `node:` 头到 `Node.js v` 尾）折叠为
 *        **结构化标记** `<<NODE_CRASH err=<类> code=<码> syscall=<调用> target=<末段路径>>>`
 *        ——只保留与实现相关的语义锚（错误类/错误码/系统调用），行号、帧文本、属性块、
 *        **有无栈段**全部归一（这正是"崩溃栈形状归一"）。
 *     b. `reconcileCrashDelta()`：当一侧有崩溃栈段而另一侧没有（干净捕获）时，按
 *        DECLARED_DELTAS 的 `S1S3-CRASH-CLEAN-CAPTURE` 抹平并**计数打印**，绝不静默。
 *   保留的判别力：错误类 / code / syscall / target 变了仍会 FAIL；`[FAIL]` 行与退出码仍在比对。
 *
 * 可直接 import（供 T8-hardening 异构构建模拟自测复用 normalize/canonicalizeCrash/…）：
 *   直接作为脚本运行时才执行 main()。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const SNAP_DIR = path.join(HERE, 'snapshots');

// ---------------------------------------------------------------------------
// 归一化（环境噪声 —— 与实现正确性无关，两侧同口径施加）
// ---------------------------------------------------------------------------

/** Node 内部模块帧的 line[:col]（随 Node 构建而变）。 */
export const NODE_INTERNAL_FRAME_RE = /\bnode:([A-Za-z_][\w./-]*):(\d+)(?::(\d+))?/g;

/** 崩溃栈段头（形如 `node:fs:1590` / `node:internal/modules/cjs/loader:1386`）。 */
const CRASH_HEADER_RE = /^node:[A-Za-z_][\w./-]*:\d+/;

/** 崩溃栈段尾（形如 `Node.js v22.22.2`）。 */
const CRASH_TAIL_RE = /^Node\.js v\d+/;

/**
 * 崩溃栈结构归一（T8 ④-a）：把崩溃栈段折叠为结构化标记。
 *
 * 输入应为**未经 normalize 的原始文本**（行号尚未被抹平，便于提取区段）。
 * 区段界定：从 `node:<mod>:<n>` 头行起，到 `Node.js v…` 尾行止（含）；
 * 若缺少尾行，则在遇到 `[FAIL]`/`[PASS]` 行或 EOF 时止（绝不吞掉 CI 自己的判定行）。
 */
export function canonicalizeCrash(s) {
  const lines = String(s).split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (!CRASH_HEADER_RE.test(lines[i])) { out.push(lines[i]); i += 1; continue; }
    let end = i;
    let consumedTail = false;
    for (let j = i; j < lines.length; j += 1) {
      if (/^\[(FAIL|PASS)\]/.test(lines[j])) { end = j - 1; break; }
      end = j;
      if (CRASH_TAIL_RE.test(lines[j])) { consumedTail = true; break; }
    }
    const block = lines.slice(i, end + 1).join('\n');
    const errClass = (block.match(/^([A-Za-z_$][\w$.]*Error):/m) ?? [null, 'Error'])[1];
    const code = (block.match(/\bcode:\s*'([^'\n]+)'/) ?? [null, 'none'])[1];
    const syscall = (block.match(/\bsyscall:\s*'([^'\n]+)'/) ?? [null, 'none'])[1];
    // target：优先取属性块里的 path 字段，否则取错误行里首个引号内字符串（两者都限制为单行，
    // 防止 `[^']*` 跨行吞掉后续帧文本）；末段 basename 与 Node 构建无关，保留作判别锚。
    const errLine = (block.match(/^[A-Za-z_$][\w$.]*Error:[^\n]*/m) ?? [''])[0];
    const pathHit = block.match(/\bpath:\s*'([^'\n]+)'/) ?? errLine.match(/'([^'\n]*)'/);
    const target = pathHit ? String(pathHit[1]).replace(/\\/g, '/').split('/').filter(Boolean).pop() : 'none';
    out.push(`<<NODE_CRASH err=${errClass} code=${code} syscall=${syscall} target=${target}${consumedTail ? '' : ' truncated=1'}>>`);
    i = end + 1;
  }
  return out.join('\n');
}

/** 环境噪声归一化（含 T8 ④ 的 Node 内部帧 / 版本 / errno）。 */
export function normalize(s) {
  // ⓪ 崩溃栈结构归一（必须在行号抹平之前，区段界定依赖原始行号形态）
  let out = canonicalizeCrash(s);
  // ① 随机 plan id：'plan-' + Date.now().toString(36)（8-12 位 base36，逐次运行必然不同）
  out = out.replace(/plan-[0-9a-z]{8,12}\b/g, 'plan-RAND');
  // ② 临时报告名
  out = out.replace(/tt-ci-plan-review-\d+-\d+/g, 'tt-ci-plan-review-RAND');
  // ③ 临时目录：报告/沙箱绝对路径在 stdout+stderr 中可能是反斜杠或正斜杠两种形态，都要归一化
  const tmpRaw = os.tmpdir();
  const tmpFwd = tmpRaw.replace(/\\/g, '/');
  out = out.split(tmpFwd).join('TMPDIR').split(tmpRaw).join('TMPDIR');
  // ④ 沙箱目录名（yy-t7-gN-XXXX / yy-t7b0-gN-XXXX）：随机后缀与批次前缀都属环境噪声
  out = out.replace(/yy-t7[a-z0-9]*-g\d+-[A-Za-z0-9]+/g, 'yy-SANDBOX');
  out = out.replace(/[A-Za-z]:[\\/][^\s"]*?[\\/]tt-[a-z0-9]+-[a-z0-9]+/g, 'TMPDIR/tt-RAND');
  // ⑤ Node 内部帧行/列号（随 Node 构建而变；file:// 用户帧不动）
  out = out.replace(NODE_INTERNAL_FRAME_RE, (m, mod, line, col) => `node:${mod}:LINE${col === undefined ? '' : ':COL'}`);
  // ⑥ Node 版本串
  out = out.replace(/Node\.js v\d+\.\d+\.\d+[^\s]*/g, 'Node.js vVERSION');
  // ⑦ errno 平台数值
  out = out.replace(/errno:\s*-?\d+/g, 'errno: ERRNO');
  return out;
}

// ---------------------------------------------------------------------------
// 已申报语义差异
// ---------------------------------------------------------------------------

/**
 * 已申报语义差异（S5 严格口径，change record cr-20260920T112945Z-a6244b0c；
 * 以及 P1-2 裁决的 S1/S3 崩溃路径干净捕获）。
 * 方向：把**翻默认前快照**里的旧文案正向改写为新文案；改写条数打印，禁止静默。
 *
 * 第三项 `S1S3-CRASH-CLEAN-CAPTURE` 是**条件生效**型（optional）：它的 re 匹配的是
 * canonicalizeCrash() 产出的结构化标记，只有当"一侧有崩溃栈段、另一侧没有"时才由
 * reconcileCrashDelta() 施加——同构建下恒为 0 次（两侧都有栈段），异构/干净捕获下才计数。
 */
export const DECLARED_DELTAS = [
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
  {
    id: 'S1S3-CRASH-CLEAN-CAPTURE',
    optional: true,
    note: 'S1/S3 子进程崩溃路径：legacy（stdio inherit）透传原始 Node 崩溃栈，lib runGate 干净捕获只输出 [FAIL]。P1-2 裁决：干净捕获**优于** legacy，批准为新声明行为 ⇒ 一侧无崩溃栈段时按本条抹平（计数打印）',
    re: /<<NODE_CRASH[^>]*>>\n?/g,
    to: '',
  },
];

export function applyDeclaredDeltas(text, onlyIds) {
  let out = text;
  const counts = {};
  for (const d of DECLARED_DELTAS) {
    if (d.optional) continue; // 条件生效项由 reconcileCrashDelta 施加
    if (onlyIds && !onlyIds.includes(d.id)) continue;
    const m = out.match(d.re);
    counts[d.id] = m ? m.length : 0;
    out = out.replace(d.re, d.to);
  }
  return { text: out, counts };
}

/**
 * 崩溃栈"有无栈段"对齐（T8 ④-b）：仅当一侧有 `<<NODE_CRASH …>>`、另一侧没有时，
 * 按新声明行为（P1-2）抹平差异并计数。两侧都有栈段时**不做任何抹平**（判别力保留）。
 */
export function reconcileCrashDelta(snapText, actualText) {
  const CRASH_MARKER_RE = /<<NODE_CRASH[^>]*>>/g;
  const snapN = (snapText.match(CRASH_MARKER_RE) ?? []).length;
  const actualN = (actualText.match(CRASH_MARKER_RE) ?? []).length;
  const clean = DECLARED_DELTAS.find((d) => d.id === 'S1S3-CRASH-CLEAN-CAPTURE');
  if (snapN === actualN) return { snap: snapText, actual: actualText, count: 0 };
  const n = Math.abs(snapN - actualN);
  const strip = (t) => t.replace(clean.re, clean.to);
  return {
    snap: snapN > 0 ? strip(snapText) : snapText,
    actual: actualN > 0 ? strip(actualText) : actualText,
    count: n,
  };
}

/** 完整比对管线（供外部自测复用）：快照原文 + 实际原文 → { same, snap, actual, counts }。 */
export function compareNormalized(snapRaw, actualRaw) {
  const { text: snapDeltas, counts } = applyDeclaredDeltas(normalize(snapRaw));
  const actual = normalize(actualRaw);
  const rec = reconcileCrashDelta(snapDeltas, actual);
  counts['S1S3-CRASH-CLEAN-CAPTURE'] = rec.count;
  return { same: rec.snap === rec.actual, snap: rec.snap, actual: rec.actual, counts };
}

export function firstDiff(a, b) {
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  const ctx = (s, p) => JSON.stringify(s.slice(Math.max(0, p - 60), p + 60));
  return 'first mismatch @' + i + '\n    snapshot: ' + ctx(a, i) + '\n    actual:   ' + ctx(b, i);
}

// ---------------------------------------------------------------------------
// 运行器
// ---------------------------------------------------------------------------

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
  const run = await runCi(cwd, extra);
  const cmp = compareNormalized(snapRaw, run.out);
  for (const [k, v] of Object.entries(cmp.counts)) declaredTotal[k] = (declaredTotal[k] ?? 0) + v;
  check(`${id} 新默认 vs 冻结快照（去噪 + 已申报差异后逐字节一致）`, cmp.same,
    cmp.same
      ? `exit=${run.code} bytes=${cmp.actual.length} 已申报差异=${JSON.stringify(cmp.counts)}`
      : 'exit=' + run.code + ' bytes=' + cmp.actual.length + ' ' + firstDiff(cmp.snap, cmp.actual));
  check(`${id} 退出码 = ${expectExit}`, run.code === expectExit, 'exit=' + run.code);
  return run;
}

async function main() {
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
  for (const d of DECLARED_DELTAS) console.log('  ' + d.id + (d.optional ? '（条件生效）' : '') + ' — ' + d.note);
  const failed = results.filter(([, ok]) => !ok);
  console.log('\nB0 self-test: ' + (results.length - failed.length) + '/' + results.length + ' passed');
  process.exitCode = failed.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
