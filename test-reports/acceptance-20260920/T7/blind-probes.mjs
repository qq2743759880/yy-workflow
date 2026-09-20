/**
 * 编排者盲测探针 — T7 验收（2026-09-20）
 * H1 S5 四态分类真实 tracker 行验证；H2 OPEN_P0 单点（ci.mjs 无内联计数）；
 * H3 change record grandfathering 在场；H4 hook 三分类（buildManifest→system-load）；
 * H5 --evolve 沙箱 ok:true + 仓库根零污染；H6 B0 错误路径形状差异定性。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REPO = process.cwd();
const SB = path.join(REPO, 'test-reports/acceptance-20260920/T7/.sandbox');
fs.rmSync(SB, { recursive: true, force: true });
fs.mkdirSync(SB, { recursive: true });
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`[PASS] ${name} ${detail}`); }
  else { fail++; console.log(`[FAIL] ${name} ${detail}`); }
};

// ---------- H1: classifyOpenP0 四态（我自己的 tracker 行） ----------
{
  const probe = path.join(SB, 'h1.mjs');
  fs.writeFileSync(probe, [
    `import { classifyOpenP0 } from '${pathToFileURL(REPO + '/scripts/lib/ci.mjs').href}';`,
    `const out = {};`,
    `const t1 = '| C-01 | x | x | P0 | ⬜ |';`,
    `out.t1 = classifyOpenP0(t1);`,
    `const t2 = '| C-02 | x | 修一半 | P0 | ◐ |';`,
    `out.t2 = classifyOpenP0(t2);`,
    `const t3 = '| C-03 | x | 修一半 见 plans/tasks/foo.md | P0 | ◐ |';`,
    `out.t3 = classifyOpenP0(t3);`,
    `const t4 = '| C-04 | x | 已修 | P0 | ✅ |';`,
    `out.t4 = classifyOpenP0(t4);`,
    `console.log('RESULT=' + JSON.stringify({`,
    `  t1Open: out.t1.openP0, t1Cls: out.t1.pending,`,
    `  t2Open: out.t2.openP0, t2Cls: out.t2.unbacked,`,
    `  t3Open: out.t3.openP0, t3Cls: out.t3.inProgress,`,
    `  t4Open: out.t4.openP0,`,
    `}));`,
  ].join('\n'));
  const r = spawnSync(process.execPath, [probe], { encoding: 'utf8' });
  const m = (r.stdout || '').match(/RESULT=(\{.*\})/);
  let res = {}; try { res = JSON.parse(m ? m[1] : '{}'); } catch {}
  check('H1 ⬜ 计入未清零', res.t1Open === 1 && Array.isArray(res.t1Cls) && res.t1Cls.includes('C-01'), JSON.stringify(res));
  check('H1 ◐无证据 计入且归 unbacked', res.t2Open === 1 && Array.isArray(res.t2Cls) && res.t2Cls.includes('C-02'), JSON.stringify(res));
  check('H1 ◐有证据 计入且归 inProgress', res.t3Open === 1 && Array.isArray(res.t3Cls) && res.t3Cls.includes('C-03'), JSON.stringify(res));
  check('H1 ✅ 不计入', res.t4Open === 0, JSON.stringify(res));
}

// ---------- H2: OPEN_P0 单点（ci.mjs 壳内无内联 ⬜◐ 计数；lib/orchestrator 引用常量） ----------
{
  const shell = fs.readFileSync(path.join(REPO, 'scripts/ci.mjs'), 'utf8');
  check('H2 ci.mjs 薄壳无内联 ⬜◐ 计数逻辑', !/countOpenP0\s*=|function\s+countOpenP0/.test(shell), '');
  const lo = fs.readFileSync(path.join(REPO, 'scripts/lib/orchestrator.mjs'), 'utf8');
  check('H2 lib/orchestrator 引用 OPEN_P0 常量（非自持字面量）', lo.includes('OPEN_P0_MARKER_RE') || lo.includes('OPEN_P0_PATTERN'), '');
  const lc = fs.readFileSync(path.join(REPO, 'scripts/lib/ci.mjs'), 'utf8');
  check('H2 lib/ci 导出 OPEN_P0_PATTERN（单点）', lc.includes('export const OPEN_P0_PATTERN'), '');
}

// ---------- H3: change record grandfathering 在场 ----------
{
  const crDir = path.join(REPO, 'contracts/discrepancies');
  const crs = fs.existsSync(crDir) ? fs.readdirSync(crDir).filter((f) => f.startsWith('cr-20260920')) : [];
  check('H3 S5 change record 存在', crs.length >= 1, crs.join(','));
  const crFile = crs.map((f) => path.join(crDir, f)).find((f) => fs.readFileSync(f, 'utf8').includes('a6244b0c'))
    ?? crs.map((f) => path.join(crDir, f))[0];
  const txt = fs.readFileSync(crFile, 'utf8');
  check('H3 grandfathering 声明在场', /grandfather/i.test(txt) || txt.includes('历史 ACCEPTED'), '');
  check('H3 invalidatedNodes 含 S5', txt.includes('S5'), '');
}

// ---------- H4: hook 三分类（buildManifest → system-load；普通脚本 → consumption） ----------
{
  const HOOK = pathToFileURL(REPO + '/scripts/lib/io-audit-hook.mjs').href;
  const run = (scriptBody, tag) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-h4-'));
    const auditDir = path.join(SB, 'h4-' + tag);
    fs.mkdirSync(auditDir, { recursive: true });
    const f = path.join(dir, 'v.mjs');
    fs.writeFileSync(f, scriptBody);
    const r = spawnSync(process.execPath, [f], { env: { ...process.env, NODE_OPTIONS: '--import ' + HOOK, YY_IO_AUDIT_DIR: auditDir }, encoding: 'utf8' });
    const jf = path.join(auditDir, 'io-audit.jsonl');
    const recs = fs.existsSync(jf) ? fs.readFileSync(jf, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    return recs;
  };
  const sys = run(`import { buildManifest } from '${pathToFileURL(REPO + '/scripts/lib/manifest.mjs').href}';\nawait buildManifest({ vendorDir: ${JSON.stringify(REPO + '/vendor')} });`, 'sysload');
  const sysTags = [...new Set(sys.map((r) => r.tag))];
  check('H4 buildManifest 装载 → system-load', sys.length > 0 && sysTags.includes('system-load') && !sysTags.includes('consumption'), `tags=${sysTags.join(',')} n=${sys.length}`);
  const cons = run(`import fs from 'node:fs'; fs.readFileSync(${JSON.stringify(REPO + '/vendor/sdlc/SKILL.md')}, 'utf8');`, 'cons');
  check('H4 普通脚本读取 → consumption', cons.length === 1 && cons[0].tag === 'consumption', `tag=${cons[0]?.tag}`);
}

// ---------- H5: --evolve 修复行为 + 仓库根零污染 ----------
{
  const proof = path.join(REPO, 'test-reports/rebuild-20260920/T7-closeout/evolve-sandbox-proof.mjs');
  const r = spawnSync(process.execPath, [proof], { cwd: REPO, encoding: 'utf8', timeout: 300000 });
  check('H5 evolve 证明脚本 EXIT=0', r.status === 0, `exit=${r.status} err=${(r.stderr || '').slice(0, 60)}`);
  check('H5 仓库根无 evidence/ 污染', !fs.existsSync(path.join(REPO, 'evidence')), '');
}

// ---------- H6: B0 错误路径形状差异定性（已知发现，非缺陷重复） ----------
{
  const shell = fs.readFileSync(path.join(REPO, 'scripts/ci.mjs'), 'utf8');
  check('H6 legacy 内联已删除（薄壳化确认）', shell.length < 6000 && /lib\/ci\.mjs/.test(shell), `shellBytes=${shell.length}`);
}

console.log(`TOTAL: ${pass}/${pass + fail} PASS`);
process.exit(fail === 0 ? 0 : 1);
