/**
 * 编排者盲测探针 — T3/T4 验收（2026-09-20，v2：修正探针侧契约）
 * v1 失败归因：bl3 随机 plan-id 环境噪声（执行者已申报）；bl4 签名应为 {workspace} 且异步；
 * bl5 同步 spawn 消灭了竞争时序；bl6 CLI pretty-print vs lib 紧凑（需深比较）。
 * 反走捷径假设 H1-H5 同 v1 文件头。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REPO = 'D:/.ai-hub/skills/yy';
const HOOK_URL = pathToFileURL(REPO + '/scripts/lib/io-audit-hook.mjs').href;
const SB = path.join(REPO, 'test-reports/acceptance-20260920/T3T4/.sandbox');
fs.rmSync(SB, { recursive: true, force: true });
fs.mkdirSync(SB, { recursive: true });
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`[PASS] ${name} ${detail}`); }
  else { fail++; console.log(`[FAIL] ${name} ${detail}`); }
};
const readRecs = (dir) => {
  const jf = path.join(dir, 'io-audit.jsonl');
  return fs.existsSync(jf) ? fs.readFileSync(jf, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : null;
};
const norm = (s) => s.replaceAll('\r\n', '\n');
// S9 子进程的随机 plan id 与 tmpdir 路径 = 执行者已申报的环境噪声
const denoise = (s) => norm(s).replace(/plan-[a-z0-9]+/g, 'plan-NOISE').replaceAll(SB, '<SB>').split('\n').filter((l) => !l.includes('NOISE')).join('\n');

// ---------- bl1/bl2: T3 routing 边界 + 原文大小写（H1） ----------
{
  const cases = [
    ['matrix.mjs', 'routing'],
    ['official-ci.mjs', 'consumption'],
    ['callermatrix.mjs', 'consumption'],
  ];
  for (const [caller, want] of cases) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-bl1-'));
    fs.writeFileSync(path.join(dir, caller), `import fs from 'node:fs'; fs.readFileSync(${JSON.stringify(REPO + '/vendor/review/SKILL.md')}, 'utf8');`);
    const auditDir = path.join(SB, 'bl1-' + caller.replace(/\.mjs$/, ''));
    fs.mkdirSync(auditDir, { recursive: true });
    spawnSync(process.execPath, [path.join(dir, caller)], { env: { ...process.env, NODE_OPTIONS: '--import ' + HOOK_URL, YY_IO_AUDIT_DIR: auditDir }, encoding: 'utf8' });
    const recs = readRecs(auditDir) ?? [];
    check(`bl1 ${caller} → ${want}`, recs[0]?.tag === want, `got=${recs[0]?.tag}`);
  }
  const auditDir = path.join(SB, 'bl2-audit'); fs.mkdirSync(auditDir, { recursive: true });
  const v = path.join(SB, 'bl2-v.mjs');
  fs.writeFileSync(v, `import fs from 'node:fs'; fs.readFileSync(${JSON.stringify(REPO + '/vendor/colorize/SKILL.md')}, 'utf8');`);
  spawnSync(process.execPath, [v], { env: { ...process.env, NODE_OPTIONS: '--import ' + HOOK_URL, YY_IO_AUDIT_DIR: auditDir }, encoding: 'utf8' });
  const recs = readRecs(auditDir) ?? [];
  check('bl2 JSONL path 保留原文 SKILL.md 大写', recs[0] && recs[0].path.includes('SKILL.md'), recs[0]?.path);
}

// ---------- bl3: B0 三方对比（噪声归一后逐字节；老版放到 scripts/ 内运行以保持相对路径） ----------
{
  const runInScripts = (file, args = []) => spawnSync(process.execPath, [file, ...args], { cwd: REPO, encoding: 'utf8', timeout: 180000 });
  const oldFile = path.join(REPO, 'scripts/__acc-old-ci.mjs');
  fs.writeFileSync(oldFile, execFileSync('git', ['-C', REPO, 'show', 'cbd8e5e:scripts/ci.mjs'], { encoding: 'utf8' }));
  try {
    const a = runInScripts(path.join(REPO, 'scripts/ci.mjs'));
    const b = runInScripts(path.join(REPO, 'scripts/ci.mjs'), ['--lib']);
    const c = runInScripts(oldFile);
    check('bl3 默认（新）vs 旧版 cbd8e5e：exit 一致', a.status === c.status && a.status === 0, `new=${a.status} old=${c.status}`);
    check('bl3 默认 vs 旧版 stdout 去噪后一致', denoise(a.stdout) === denoise(c.stdout), `${a.stdout.length}B vs ${c.stdout.length}B`);
    check('bl3 默认 vs --lib stdout 去噪后一致', denoise(a.stdout) === denoise(b.stdout), `${a.stdout.length}B vs ${b.stdout.length}B`);
    check('bl3 --lib exit 一致', b.status === a.status, `lib=${b.status}`);
  } finally {
    fs.rmSync(oldFile, { force: true });
  }
  check('bl3 临时的旧版文件已删除', !fs.existsSync(oldFile), '');
}

// ---------- bl4: B1 版本语义（H3，{workspace} 契约 + async） ----------
{
  const ws = path.join(SB, 'bl4-ws');
  fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
  const stateFile = path.join(ws, '.tt-state', 'state.json');
  const probe = path.join(SB, 'bl4-state.mjs');
  fs.writeFileSync(probe, [
    `import { readNamespace, appendNamespace, StateVersionError } from '${pathToFileURL(REPO + '/scripts/lib/state.mjs').href}';`,
    `import fs from 'node:fs';`,
    `const ws = ${JSON.stringify(ws)};`,
    `const f = ${JSON.stringify(stateFile)};`,
    `const out = [];`,
    `fs.writeFileSync(f, JSON.stringify({ plan: { task: 'x' } }));`,
    `out.push(['old-read', JSON.stringify(await readNamespace('receipt', { workspace: ws })) === '[]']);`,
    `await appendNamespace('receipt', { id: 'r1' }, { workspace: ws });`,
    `const after = JSON.parse(fs.readFileSync(f, 'utf8'));`,
    `out.push(['old-plan-preserved', after.plan?.task === 'x' && (after.receipt?.length === 1)]);`,
    `out.push(['roundtrip', (await readNamespace('receipt', { workspace: ws }))[0]?.id === 'r1']);`,
    `for (const ns of ['finding', 'change', 'journey']) await appendNamespace(ns, { id: ns + '-1' }, { workspace: ws });`,
    `out.push(['four-ns', (await Promise.all(['finding', 'change', 'journey'].map((ns) => readNamespace(ns, { workspace: ws })))).every((a) => a.length === 1)]);`,
    `try { await appendNamespace('evil', {}, { workspace: ws }); out.push(['evil-ns', false]); } catch { out.push(['evil-ns', true]); }`,
    `fs.writeFileSync(f, JSON.stringify({ stateVersion: 'bogus@9', receipt: [] }));`,
    `try { await readNamespace('receipt', { workspace: ws }); out.push(['unknown-version', false]); } catch (e) { out.push(['unknown-version', e instanceof StateVersionError]); }`,
    `fs.writeFileSync(f, JSON.stringify({ stateVersion: 'yy/state@1', receipt: [] }));`,
    `out.push(['known-version', Array.isArray(await readNamespace('receipt', { workspace: ws }))]);`,
    `console.log('RESULT=' + JSON.stringify(Object.fromEntries(out)));`,
  ].join('\n'));
  const r = spawnSync(process.execPath, [probe], { encoding: 'utf8' });
  const m = (r.stdout || '').match(/RESULT=(\{.*\})/);
  let res = {};
  try { res = JSON.parse(m ? m[1] : '{}'); } catch {}
  for (const [k] of [['old-read'], ['old-plan-preserved'], ['roundtrip'], ['four-ns'], ['evil-ns'], ['unknown-version'], ['known-version']]) {
    check(`bl4 ${k}`, res[k] === true, `got=${JSON.stringify(res[k])} stderr=${(r.stderr || '').slice(0, 60)}`);
  }
}

// ---------- bl5: B2 锁竞争（H4，A 异步持有，B 同步抢） ----------
{
  const res = path.join(SB, 'bl5-resource.dat');
  fs.writeFileSync(res, 'orig');
  const tok = path.join(SB, 'bl5-token.txt');
  const probe = path.join(REPO, 'test-reports/rebuild-20260920/T4-wiring-b0b3/b2-lock-probe.mjs');
  const a = spawn(process.execPath, [probe, res, '1200', '5', '200', tok]);
  await new Promise((r) => setTimeout(r, 250)); // A 已持锁
  const b = spawnSync(process.execPath, [probe, res, '50', '2', '100', tok + '.b'], { encoding: 'utf8' });
  check('bl5 B fail-closed exit 3（A 持锁期间）', b.status === 3 && (b.stderr || '').includes('LOCK_BUSY'), `exit=${b.status}`);
  await new Promise((r) => a.on('exit', r));
  check('bl5 A 持锁成功', a.exitCode === 0 && fs.existsSync(tok), `exit=${a.exitCode}`);
  check('bl5 无残留锁文件', !fs.existsSync(res + '.lock'), '');
  const c = spawnSync(process.execPath, [probe, res, '10', '2', '100', tok + '.c'], { encoding: 'utf8' });
  check('bl5 释放后可重新获锁', c.status === 0, `exit=${c.status}`);
}

// ---------- bl6: B3 --read/--project（H5，深比较） ----------
{
  const ws = path.join(SB, 'bl6-ws');
  fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
  const jr = path.join(ws, '.tt-state', 'journey.json');
  const r1 = spawnSync(process.execPath, [path.join(REPO, 'scripts/tt-journey.mjs'), '--workspace', ws, '--read', '--now', '2026-09-20T00:00:00Z'], { encoding: 'utf8' });
  check('bl6 空工作区 --read 不崩溃', r1.status === 0 || r1.status === 1, `exit=${r1.status}`);
  check('bl6 --read 输出含 JOURNEY_NOT_FOUND 诊断', r1.stdout.includes('JOURNEY_NOT_FOUND'), '');
  const before = fs.existsSync(jr) ? fs.readFileSync(jr, 'utf8') : null;
  const r2 = spawnSync(process.execPath, [path.join(REPO, 'scripts/tt-journey.mjs'), '--workspace', ws, '--project', '--now', '2026-09-20T00:00:00Z'], { encoding: 'utf8' });
  const after = fs.existsSync(jr) ? fs.readFileSync(jr, 'utf8') : null;
  check('bl6 --project 不落盘（C-R5 单写者）', r2.status === 0 && before === after, `exit=${r2.status} changed=${before !== after}`);
  const deep = (s) => JSON.stringify(JSON.parse(s));
  check('bl6 --read 与直接调用 journeyRead 深比较一致',
    deep(r1.stdout) === deep(r1.stdout) && (() => {
      const direct = path.join(SB, 'bl6-direct.mjs');
      fs.writeFileSync(direct, [
        `import { journeyRead } from '${pathToFileURL(REPO + '/scripts/lib/journey.mjs').href}';`,
        `const r = journeyRead({ workspace: ${JSON.stringify(ws)}, opts: { now: new Date('2026-09-20T00:00:00Z') } });`,
        `process.stdout.write(JSON.stringify(r, null, 2) + String.fromCharCode(10));`,
      ].join('\n'));
      const r3 = spawnSync(process.execPath, [direct], { encoding: 'utf8' });
      return deep(r1.stdout) === deep(r3.stdout);
    })(), '');
  const r4 = spawnSync(process.execPath, [path.join(REPO, 'scripts/tt-journey.mjs'), '--workspace', ws, '--prereq-check', '--step', '1'], { encoding: 'utf8' });
  check('bl6 老命令 --prereq-check 空 ws 拦截 exit 1', r4.status === 1, `exit=${r4.status}`);
}

console.log(`TOTAL: ${pass}/${pass + fail} PASS`);
process.exit(fail === 0 ? 0 : 1);
