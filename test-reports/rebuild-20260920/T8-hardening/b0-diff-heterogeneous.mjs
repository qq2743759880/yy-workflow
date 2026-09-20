/**
 * b0-diff-heterogeneous.mjs — T8 加固批④「b0-diff 崩溃栈结构归一」异构构建模拟自测。
 *
 * 目的：P1-2 的实证是"G2/G3 差分依赖崩溃栈逐字节相等 ⇒ 异构环境必挂（编排者复跑 7/9）"。
 * 本机只有一种 Node 构建，无法真的换构建跑，故用**变异注入**模拟异构构建产生的差异：
 *
 *   正向（必须仍 PASS）：
 *     M1 所有 Node 内部帧行/列号整体偏移（另一构建的 line 号必然不同）
 *     M2 Node 版本串变化（v22.22.2 → v20.11.1）
 *     M3 errno 数值变化（-4058 → -2，跨平台 errno 不同）
 *     M4 删除全部 Node 内部帧（只留用户帧）——不同构建帧布局不同
 *     M5 增加 3 条 Node 内部帧
 *     M6 **整段崩溃栈消失**（模拟 lib runGate 干净捕获——P1-2 新声明行为）
 *     M7 崩溃栈属性块（`{ errno…code…syscall… }`）整体删除
 *
 *   反向（必须 FAIL，证明判别力未被归一抹平）：
 *     N1 错误类变化（Error → TypeError）
 *     N2 错误码变化（ENOENT → EACCES）
 *     N3 CI 判定行变化（退出码 1 → 退出码 2）
 *     N4 删除 CI 的 [FAIL] 判定行
 *
 * 运行：node test-reports/rebuild-20260920/T8-hardening/b0-diff-heterogeneous.mjs
 * 写入：仅 os.tmpdir() 下的临时沙箱（仓库零写入）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compareNormalized } from '../T4-wiring-b0b3/b0-diff.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const SNAP_DIR = path.join(REPO, 'test-reports', 'rebuild-20260920', 'T4-wiring-b0b3', 'snapshots');

let pass = 0;
let fail = 0;
const failed = [];
function check(name, ok, detail = '') {
  if (ok) { pass += 1; console.log('  [PASS] ' + name + (detail ? '  [' + detail + ']' : '')); }
  else { fail += 1; failed.push(name + (detail ? ' :: ' + detail : '')); console.log('  [FAIL] ' + name + (detail ? '  [' + detail + ']' : '')); }
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
  const sb = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-t8b0-' + tag + '-'));
  fs.cpSync(path.join(REPO, 'scripts'), path.join(sb, 'scripts'), { recursive: true });
  return sb;
}

// ---------------------------------------------------------------------------
// 变异器（全部作用于**快照原文**，模拟"另一台机器/另一 Node 构建捕获的快照"）
// ---------------------------------------------------------------------------

const MUTATIONS = [
  {
    id: 'M1-node-internal-line-numbers',
    note: 'Node 内部帧行/列号整体偏移（+7 行 / +3 列）',
    fn: (s) => s.replace(/\bnode:([A-Za-z_][\w./-]*):(\d+)(?::(\d+))?/g,
      (m, mod, line, col) => `node:${mod}:${Number(line) + 7}${col === undefined ? '' : ':' + (Number(col) + 3)}`),
  },
  {
    id: 'M2-node-version',
    note: 'Node 版本串变化 v22.22.2 → v20.11.1',
    fn: (s) => s.replace(/Node\.js v\d+\.\d+\.\d+/g, 'Node.js v20.11.1'),
  },
  {
    id: 'M3-errno-value',
    note: 'errno 数值变化 -4058 → -2（跨平台）',
    fn: (s) => s.replace(/errno: -?\d+/g, 'errno: -2'),
  },
  {
    id: 'M4-drop-internal-frames',
    note: '删除全部 Node 内部帧（只留用户帧）',
    fn: (s) => s.split('\n').filter((l) => !/^\s+at .*\(node:[^)]*\)\s*$/.test(l) && !/^\s+at node:[^\s]*$/.test(l)).join('\n'),
  },
  {
    id: 'M5-add-internal-frames',
    note: '在栈尾追加 3 条 Node 内部帧',
    fn: (s) => s.replace(/(\n)(\s*)at (?!.*node:)([^\n]*)\n(?=\s*\})/,
      (m, nl, indent, frame) => `${nl}${indent}at ${frame}${nl}${indent}at ModuleJob.run (node:internal/modules/esm/module_job:999:25)${nl}${indent}at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:111:26)${nl}${indent}at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:222:5)${nl}`),
  },
  {
    id: 'M6-no-stack-section',
    note: '整段崩溃栈消失（模拟 runGate 干净捕获，P1-2 新声明行为）',
    fn: (s) => {
      const lines = s.split('\n');
      const out = [];
      let skipping = false;
      for (const line of lines) {
        if (!skipping && /^node:[A-Za-z_][\w./-]*:\d+/.test(line)) { skipping = true; continue; }
        if (skipping) { if (/^Node\.js v\d+/.test(line)) skipping = false; continue; }
        out.push(line);
      }
      return out.join('\n');
    },
  },
  {
    id: 'M7-drop-props-block',
    note: '崩溃栈属性块 `{ errno…code…syscall… }` 整体删除',
    fn: (s) => s.replace(/\n\s*\{\n(?:\s{2}\w+:.*\n)+\s*\}\n/g, '\n'),
  },
];

const NEGATIVES = [
  {
    id: 'N1-error-class',
    note: '错误类变化 Error → TypeError（判别力：err 锚）',
    fn: (s) => s.replace(/^Error:/m, 'TypeError:'),
  },
  {
    id: 'N2-error-code',
    note: '错误码变化 ENOENT → EACCES（判别力：code 锚）',
    fn: (s) => s.replace(/code: 'ENOENT'/g, "code: 'EACCES'"),
  },
  {
    id: 'N3-exit-code-line',
    note: 'CI 判定行变化 退出码 1 → 退出码 2',
    fn: (s) => s.replace(/退出码 1/g, '退出码 2'),
  },
  {
    id: 'N4-drop-fail-line',
    note: '删除 CI 的 [FAIL] 判定行',
    fn: (s) => s.split('\n').filter((l) => !/^\[FAIL\]/.test(l)).join('\n'),
  },
];

async function main() {
  console.log('T8 加固④ — b0-diff 崩溃栈结构归一：异构构建模拟自测（Node ' + process.version + '）');

  // ── 组准备：G2（S1 失败：SKILL.md 缺 frontmatter）与 G3（删 validate-structure.mjs）──
  const groups = [];
  {
    const sb = makeSandbox('g2');
    fs.writeFileSync(path.join(sb, 'SKILL.md'), '# no frontmatter\n');
    const run = await runCi(sb);
    groups.push({ id: 'G2', snapshot: path.join(SNAP_DIR, 'g2-s1-fail.txt'), run });
    fs.rmSync(sb, { recursive: true, force: true });
  }
  {
    const sb = makeSandbox('g3');
    fs.writeFileSync(path.join(sb, 'SKILL.md'), '---\nname: x\nversion: 1\ndescription: x\n---\n# body\n');
    fs.rmSync(path.join(sb, 'scripts', 'validate-structure.mjs'), { force: true });
    const run = await runCi(sb);
    groups.push({ id: 'G3', snapshot: path.join(SNAP_DIR, 'g3-spawn-fail.txt'), run });
    fs.rmSync(sb, { recursive: true, force: true });
  }

  for (const g of groups) {
    const raw = fs.readFileSync(g.snapshot, 'utf8');
    console.log(`\n== ${g.id} 快照 vs 实跑（exit=${g.run.code}）==`);
    check(`${g.id} 实跑退出码 = 1`, g.run.code === 1, 'exit=' + g.run.code);
    const base = compareNormalized(raw, g.run.out);
    check(`${g.id} 基线（未变异）比对一致`, base.same, 'bytes=' + base.actual.length + ' 差异=' + JSON.stringify(base.counts));

    console.log(`  -- 正向变异（异构构建模拟，必须仍 PASS）--`);
    for (const m of MUTATIONS) {
      const mutated = m.fn(raw);
      const cmp = compareNormalized(mutated, g.run.out);
      check(`${g.id} ${m.id} ⇒ 仍一致`, cmp.same,
        cmp.same ? '差异计数=' + JSON.stringify(cmp.counts) : 'firstDiff@' + cmp.snap.length + '/' + cmp.actual.length);
    }

    console.log(`  -- 反向变异（判别力，必须 FAIL）--`);
    for (const n of NEGATIVES) {
      const mutated = n.fn(raw);
      if (mutated === raw) { check(`${g.id} ${n.id} ⇒ 变异未生效（本组无匹配目标，跳过）`, true, 'n/a'); continue; }
      const cmp = compareNormalized(mutated, g.run.out);
      check(`${g.id} ${n.id} ⇒ 必须不一致`, !cmp.same,
        cmp.same ? '归一过度：判别力丢失' : 'ok（如预期 FAIL）');
    }
  }

  console.log(`\nTOTAL: ${pass}/${pass + fail} PASS`);
  if (fail) console.log('FAILURES:\n - ' + failed.join('\n - '));
  process.exitCode = fail ? 1 : 0;
}

await main();
