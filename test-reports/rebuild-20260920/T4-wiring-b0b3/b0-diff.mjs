#!/usr/bin/env node
/**
 * B0 自测：ci.mjs --lib 与默认（legacy）双跑逐字节一致。
 *
 * 组：
 *   G1 成功组（真实仓库）：默认 vs --lib，全部门过，stdout+stderr+exit 逐字节一致。
 *   G2 S1 失败组（沙箱）：SKILL.md 缺 frontmatter → S1 失败 exit1，两版一致。
 *   G3 spawn 失败组（沙箱）：删 validate-structure.mjs → spawn error exit1，两版一致。
 *   G4 S5 P0 失败组（沙箱）：S1-S4 桩 exit0 + tracker 含 P0 ⬜ → S5 失败 exit1，两版一致。
 *
 * 沙箱 = scripts/ 副本（ci.mjs ROOT 自动落到沙箱），不污染真实仓库。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const CI = path.join(REPO, 'scripts', 'ci.mjs');

const results = [];
function check(name, ok, detail = '') {
  results.push([name, ok, detail]);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : ''));
}

function runCi(cwd, useLib) {
  // 调用沙箱内自己的 ci.mjs（ROOT 取自 import.meta.url = 沙箱；cwd 不影响 ROOT）
  const ciPath = path.join(cwd, 'scripts', 'ci.mjs');
  return new Promise((resolve) => {
    const args = [ciPath];
    if (useLib) args.push('--lib');
    const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (c) => { out += c.toString(); });
    child.stderr.on('data', (c) => { out += c.toString(); });
    child.on('close', (code) => resolve({ code, out }));
  });
}

function makeSandbox() {
  const sb = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-t4-b0sb-'));
  fs.cpSync(path.join(REPO, 'scripts'), path.join(sb, 'scripts'), { recursive: true });
  return sb;
}

/**
 * 归一化运行间随机性（非 legacy/lib 接线差异）：
 *  - S9 test-domain-declared 生成的随机 plan id（plan-mu9<base36>）
 *  - os.tmpdir 绝对路径（regression-all 临时 workspace）
 * 归一化后再逐字节比较，剥离环境噪声，锁定接线等价。
 */
function normalize(s) {
  let out = s;
  out = out.replace(/plan-mu9[a-z0-9]+/g, 'plan-RAND');
  const tmp = os.tmpdir().replace(/\\/g, '/');
  out = out.split(tmp).join('TMPDIR');
  out = out.replace(/[A-Za-z]:[\\/][^\s"]*?[\\/]tt-[a-z0-9]+-[a-z0-9]+/g, 'TMPDIR/tt-RAND');
  return out;
}

const S1_S4_STUBS = ['validate-structure.mjs', 'review-gate.mjs', 'plan-review.mjs', 'regression-all.mjs', 'asset-call-rate.mjs'];

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-t4-b0-'));
try {
  // ── G1 成功组（真实仓库，较慢：内含 regression-all）──
  console.log('G1 成功组：跑真实仓库 ci.mjs 默认 vs --lib（约 1-2 分钟）...');
  const legacy = await runCi(REPO, false);
  const lib = await runCi(REPO, true);
  // 再跑一次 legacy 证明差异为环境性随机（legacy-run1 vs legacy-run2 raw 也会在随机 token 处不同）
  const legacy2 = await runCi(REPO, false);
  const g1Out = normalize(legacy.out) === normalize(lib.out);
  const g1EnvNonDet = legacy2.out !== legacy.out; // 预期 true：纯随机 plan id 噪声
  const g1Exit = legacy.code === lib.code;
  if (!g1Out) {
    const a = normalize(legacy.out), b = normalize(lib.out);
    let i = 0;
    while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
    const ctx = (s, p) => JSON.stringify(s.slice(Math.max(0, p - 40), p + 40));
    console.log('  [DIFF-after-normalize] first mismatch @' + i);
    console.log('    legacy: ' + ctx(a, i));
    console.log('    lib:    ' + ctx(b, i));
  }
  check('G1 成功组归一化后逐字节一致（剥离随机 plan id/tmp 路径）', g1Out,
    'legacy bytes=' + legacy.out.length + ' lib bytes=' + lib.out.length + '；环境随机噪声=' + g1EnvNonDet);
  check('G1 成功组退出码一致', g1Exit && legacy.code === 0, 'legacy exit=' + legacy.code + ' lib exit=' + lib.code);
  if (!g1Out) {
    fs.writeFileSync(path.join(tmpRoot, 'g1-legacy.txt'), legacy.out);
    fs.writeFileSync(path.join(tmpRoot, 'g1-lib.txt'), lib.out);
  }

  // ── G2 S1 失败：SKILL.md 缺 frontmatter ──
  const sb2 = makeSandbox();
  fs.writeFileSync(path.join(sb2, 'SKILL.md'), '# no frontmatter\n');
  const l2 = await runCi(sb2, false);
  const b2 = await runCi(sb2, true);
  check('G2 S1 缺 frontmatter 失败组逐字节一致(exit1)', l2.out === b2.out && l2.code === 1 && b2.code === 1,
    'exit=' + l2.code + '/' + b2.code);
  fs.rmSync(sb2, { recursive: true, force: true });

  // ── G3 spawn 失败：删 validate-structure.mjs ──
  const sb3 = makeSandbox();
  fs.writeFileSync(path.join(sb3, 'SKILL.md'), '---\nname: x\nversion: 1\ndescription: x\n---\n# body\n');
  fs.rmSync(path.join(sb3, 'scripts', 'validate-structure.mjs'), { force: true });
  const l3 = await runCi(sb3, false);
  const b3 = await runCi(sb3, true);
  check('G3 spawn 失败组逐字节一致(exit1 + [FAIL] S1 MODULE_NOT_FOUND)', l3.out === b3.out && l3.code === 1 && /\[FAIL\] S1/.test(l3.out),
    'exit=' + l3.code + '/' + b3.code);
  fs.rmSync(sb3, { recursive: true, force: true });

  // ── G4 S5 P0 失败：S1-S4 桩 exit0 + tracker 含 P0 ⬜ ──
  const sb4 = makeSandbox();
  for (const s of S1_S4_STUBS) {
    fs.writeFileSync(path.join(sb4, 'scripts', s), "#!/usr/bin/env node\nconsole.log('stub " + s.replace('.mjs', '') + " ok');\n");
  }
  fs.mkdirSync(path.join(sb4, 'plans'), { recursive: true });
  fs.writeFileSync(path.join(sb4, 'plans', 'critique-backlog-tracker.md'),
    '# tracker\n\n| ID | 级别 | 状态 |\n| C-1 | P0 | ⬜ open |\n');
  const l4 = await runCi(sb4, false);
  const b4 = await runCi(sb4, true);
  check('G4 S5 P0 失败组逐字节一致(exit1 + [FAIL] P0)', l4.out === b4.out && l4.code === 1 && /\[FAIL\] P0/.test(l4.out),
    'exit=' + l4.code + '/' + b4.code);
  fs.rmSync(sb4, { recursive: true, force: true });
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

const failed = results.filter(([, ok]) => !ok);
console.log('\nB0 self-test: ' + (results.length - failed.length) + '/' + results.length + ' passed');
process.exitCode = failed.length ? 1 : 0;
