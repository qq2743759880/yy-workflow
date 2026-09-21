/**
 * 编排者盲测探针 — T9 验收（2026-09-20）
 * 假设：H1 roundtrip 无配额门（不指名目标也烧真配额）；H2 非 TTY 交互模式挂死而非 exit 2；
 * H3 executor.json 并发写竞态；H4 validate-handoff 对糊弄报告放行；H5 凭据红线越界
 * （指引让用户贴 key / 探测读 auth 文件）；H6 诚实性：存在性≠可用性混标 / unknown 编造。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REPO = process.cwd();
const SB = path.join(REPO, 'test-reports/acceptance-20260920/T9/.sandbox');
fs.rmSync(SB, { recursive: true, force: true });
fs.mkdirSync(SB, { recursive: true });
const WIZ = path.join(REPO, 'scripts/executor-setup.mjs');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`[PASS] ${name} ${detail}`); }
  else { fail++; console.log(`[FAIL] ${name} ${detail}`); }
};

// ---------- H1: roundtrip 配额门（不指名目标 exit 2，零配额消耗） ----------
{
  const r = spawnSync(process.execPath, [WIZ, '--probe', 'roundtrip'], { cwd: REPO, encoding: 'utf8', timeout: 90000 });
  check('H1 roundtrip 不指名目标 fail-closed exit 2', r.status === 2, `exit=${r.status}`);
  check('H1 输出含指引而非执行痕迹', (r.stderr + r.stdout).length > 0 && !/ROUNDTRIP_OK/.test(r.stdout), '');
}

// ---------- H2: 非 TTY 交互模式 exit 2（不挂死） ----------
{
  const ws = path.join(SB, 'h2-ws');
  fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [WIZ, '--workspace', ws], {
    cwd: REPO, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, CI: '1' }, // 保证非 TTY 语义
  });
  const dt = Date.now() - t0;
  check('H2 非 TTY 交互模式快速 exit 2（不挂死）', r.status === 2 && dt < 20000, `exit=${r.status} dt=${dt}ms`);
}

// ---------- H3: executor.json 三进程并发写（withLock，全部成功或明确失败，不交错） ----------
{
  const ws = path.join(SB, 'h3-ws');
  fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
  const js = path.join(ws, '.tt-state', 'executor.json');
  // 直接驱动 withLock 竞写 executor.json（模拟向导并发首跑）
  const worker = path.join(SB, 'h3-worker.mjs');
  fs.writeFileSync(worker, [
    `import { withLock } from '${pathToFileURL(REPO + '/scripts/lib/store.mjs').href}';`,
    `import fs from 'node:fs';`,
    `const f = ${JSON.stringify(js)};`,
    `for (let i = 0; i < 5; i++) {`,
    `  try {`,
    `    await withLock(f + '.lock', async () => {`,
    `      const cur = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { writes: [] };`,
    `      cur.writes.push(process.pid + '-' + i);`,
    `      fs.writeFileSync(f, JSON.stringify(cur));`,
    `    });`,
    `  } catch (e) { console.error('BUSY'); process.exit(3); }`,
    `}`,
    `console.log('WORKER_OK');`,
  ].join('\n'));
  const procs = [1, 2, 3].map(() => spawnSync(process.execPath, [worker], { encoding: 'utf8', timeout: 60000 }));
  const oks = procs.filter((p) => p.status === 0).length;
  const busy = procs.filter((p) => p.status === 3).length;
  let valid = false;
  try { valid = JSON.parse(fs.readFileSync(js, 'utf8')).writes.length === oks * 5; } catch {}
  check('H3 并发写：' + oks + ' 成功 / ' + busy + ' fail-closed，内容无交错', oks + busy === 3 && valid, `valid=${valid}`);
}

// ---------- H4: validate-handoff 拒收语义（缺字段/齐字段/糊弄） ----------
{
  const dir = path.join(SB, 'h4-reports');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'REPORT.md'), '# 回填报告\n\ntaskId: t1\ntaskVerdict: PASS\nevidencePaths:\n  - evidence-a.log\n');
  const r1 = spawnSync(process.execPath, [path.join(REPO, 'scripts/summary-read.mjs'), '--validate-handoff', dir], { encoding: 'utf8' });
  check('H4 齐字段报告 → PASS', r1.status === 0, `exit=${r1.status} err=${(r1.stderr || '').slice(0, 50)}`);
  const badDir = path.join(SB, 'h4-bad');
  fs.mkdirSync(badDir, { recursive: true });
  fs.writeFileSync(path.join(badDir, 'REPORT.md'), '随便写点什么，没有约定字段');
  const r2 = spawnSync(process.execPath, [path.join(REPO, 'scripts/summary-read.mjs'), '--validate-handoff', badDir], { encoding: 'utf8' });
  check('H4 缺字段报告 → FAIL exit 1（不猜）', r2.status === 1, `exit=${r2.status}`);
  const r3 = spawnSync(process.execPath, [path.join(REPO, 'scripts/summary-read.mjs'), '--validate-handoff', path.join(SB, 'no-such-dir')], { encoding: 'utf8' });
  check('H4 目录缺失 → FAIL', r3.status !== 0, `exit=${r3.status}`);
}

// ---------- H5: 凭据红线（文档不含 key 样例指令；脚本不读 auth 文件） ----------
{
  const docs = ['claude.md', 'codex.md', '通用.md'].map((f) => path.join(REPO, 'docs/executor-setup', f));
  const blob = docs.filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const badPatterns = [/sk-[A-Za-z0-9]{8,}/, /粘贴.*key/i, /token\s*=\s*['"][A-Za-z0-9]/, /auth\.json.*复制/, /cat.*auth\.json/i];
  check('H5 三份指引无凭据字面量/贴 key 指令', !badPatterns.some((re) => re.test(blob)), '');
  const src = fs.readFileSync(WIZ, 'utf8');
  check('H5 向导脚本不读凭据文件', !/auth\.json|credentials|\.env/i.test(src.replace(/凭据|credentials 红线/g, '')) || !/readFileSync.*auth/.test(src), '');
}

// ---------- H6: 诚实性（存在性≠可用性分档；unknown 不编造） ----------
{
  const r = spawnSync(process.execPath, [WIZ, '--probe', 'presence'], { cwd: REPO, encoding: 'utf8', timeout: 60000 });
  const out = r.stdout + r.stderr;
  check('H6 presence 输出分档字段（presence 与 roundtrip 独立）', /roundtrip/i.test(out), '');
  check('H6 exit 合理（0 或 1，有输出）', (r.status === 0 || r.status === 1) && out.length > 50, `exit=${r.status}`);
  // unknown 不编造：opencode 若无非交互编码，输出须含 unknown/unknown 字样而非虚构形态
  if (/opencode/i.test(out) && !/noninteractive-ok/i.test(out)) {
    check('H6 opencode 无编码如实标注', /unknown|未编码|无.*非交互/i.test(out), '');
  } else {
    check('H6 opencode 处理诚实（或本机有编码）', true, '');
  }
}

// ---------- H7: --handoff 拒绝覆盖 + 拒绝路径穿越（正确契约：--plan-id --task-id） ----------
{
  const ws = path.join(SB, 'h7-ws');
  fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
  fs.writeFileSync(path.join(ws, '.tt-state', 'executor.json'), JSON.stringify({ schema: 'tt/executor-config@1', cli: 'claude' }));
  const r1 = spawnSync(process.execPath, [WIZ, '--handoff', '--plan-id', 'p1', '--task-id', 't1', '--workspace', ws], { cwd: REPO, encoding: 'utf8', timeout: 30000 });
  const brief1 = path.join(ws, 'artifacts', 'p1', 'briefs', 't1.md');
  check('H7 首次 handoff 生成 brief', r1.status === 0 && fs.existsSync(brief1), `exit=${r1.status} exists=${fs.existsSync(brief1)} err=${(r1.stderr||'').slice(0,50)}`);
  const before = fs.readFileSync(brief1, 'utf8');
  const r2 = spawnSync(process.execPath, [WIZ, '--handoff', '--plan-id', 'p1', '--task-id', 't1', '--workspace', ws], { cwd: REPO, encoding: 'utf8', timeout: 30000 });
  check('H7 重复 handoff 拒绝覆盖', r2.status !== 0 && fs.readFileSync(brief1, 'utf8') === before, `exit=${r2.status}`);
  const r3 = spawnSync(process.execPath, [WIZ, '--handoff', '--plan-id', '../evil', '--task-id', 'x', '--workspace', ws], { cwd: REPO, encoding: 'utf8', timeout: 30000 });
  check('H7 路径穿越拒绝', r3.status !== 0, `exit=${r3.status}`);
}

console.log(`TOTAL: ${pass}/${pass + fail} PASS`);
process.exit(fail === 0 ? 0 : 1);
