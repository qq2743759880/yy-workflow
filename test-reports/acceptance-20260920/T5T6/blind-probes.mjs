/**
 * 编排者盲测探针 — T5/T6 验收（2026-09-20，v2 修正探针侧契约）
 * v1 失败归因：cB4 字段应为 input.entries；cB5 runtime 无 default 导出；cB6 导出名是 run
 * （brief 落 <ws>/artifacts/<id>/brief.md，行为级对比）；cB7 exit 期望错（无 draft 恒 exit 6）；
 * cT5 正则漏 vendor 根 readdir。假设 H1-H5 同 v1。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REPO = 'D:/.ai-hub/skills/yy';
const SB = path.join(REPO, 'test-reports/acceptance-20260920/T5T6/.sandbox');
fs.rmSync(SB, { recursive: true, force: true });
fs.mkdirSync(SB, { recursive: true });
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`[PASS] ${name} ${detail}`); }
  else { fail++; console.log(`[FAIL] ${name} ${detail}`); }
};
const norm = (s) => String(s).replaceAll('\r\n', '\n').replace(/plan-[a-z0-9]+/g, 'plan-N');

// ---------- cB4: DRY 防护 / 落盘 / 幂等（H1，镜像执行者形状+我自己的值） ----------
{
  const ws = path.join(SB, 'cb4-ws');
  fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
  const critRel = 'owner-技术批判.md';
  const critText = '# ownerX 技术批判\n\n| 1 | 盲测批判 | https://github.com/qq2743759880/yy 2026-09-20 结论C | 差距C | 方案C | 验证C | 1/2 | P1 |\n';
  fs.writeFileSync(path.join(ws, critRel), critText, 'utf8');
  const { createHash } = await import('node:crypto');
  const critSha = createHash('sha256').update(fs.readFileSync(path.join(ws, critRel))).digest('hex');
  const probe = path.join(SB, 'cb4.mjs');
  fs.writeFileSync(probe, [
    `import { registerReviewFindings } from '${pathToFileURL(REPO + '/scripts/lib/gate.mjs').href}';`,
    `import fs from 'node:fs';`,
    `const ws = ${JSON.stringify(ws)};`,
    `const input = { critiqueFile: { path: ${JSON.stringify(critRel)}, sha256: ${JSON.stringify(critSha)} },`,
    `  entries: [{ title: '盲测批判条目', url: 'https://github.com/qq2743759880/yy', date: '2026-09-20', plan: '盲测方案', minVerify: '盲测验证', level: 'P1' }],`,
    `  registeredBy: 'blind-probe' };`,
    `const out = [];`,
    `const ledger = ws + '/plans/active/remediation/findings.jsonl';`,
    `const statePath = ws + '/.tt-state/state.json';`,
    `const dry = await registerReviewFindings(input, { workspace: ws, repoRoot: ws });`,
    `out.push(['dry-no-write', !fs.existsSync(ledger) && !fs.existsSync(statePath)]);`,
    `const wet = await registerReviewFindings(input, { workspace: ws, repoRoot: ws, registerFindings: true });`,
    `out.push(['wet-ok', wet && wet.ok !== false]);`,
    `out.push(['ledger-exists', fs.existsSync(ledger)]);`,
    `const idx = JSON.parse(fs.readFileSync(statePath, 'utf8'));`,
    `out.push(['namespace-index', Array.isArray(idx.finding) && idx.finding.length >= 1]);`,
    `const before = idx.finding.length;`,
    `await registerReviewFindings(input, { workspace: ws, repoRoot: ws, registerFindings: true });`,
    `const after = JSON.parse(fs.readFileSync(statePath, 'utf8')).finding.length;`,
    `out.push(['idempotent', after === before]);`,
    `console.log('RESULT=' + JSON.stringify(Object.fromEntries(out)));`,
  ].join('\n'));
  const r = spawnSync(process.execPath, [probe], { encoding: 'utf8' });
  const m = (r.stdout || '').match(/RESULT=({.*})/);
  let res = {}; try { res = JSON.parse(m ? m[1] : '{}'); } catch {}
  for (const k of ['dry-no-write', 'wet-ok', 'ledger-exists', 'namespace-index', 'idempotent']) {
    check(`cB4 ${k}`, res[k] === true, `got=${JSON.stringify(res[k])} err=${(r.stderr || '').slice(0, 70)}`);
  }
}

// ---------- cB5: DI 存在可还原 + lib 模式与 legacy 输出一致（H2） ----------
{
  const probe = path.join(SB, 'cb5.mjs');
  fs.writeFileSync(probe, [
    `import { setAdapterResolver } from '${pathToFileURL(REPO + '/scripts/lib/runtime.mjs').href}';`,
    `const out = [];`,
    `out.push(['has-setter', typeof setAdapterResolver === 'function']);`,
    `const old = setAdapterResolver(() => { throw new Error('injected-failure'); });`,
    `out.push(['restore', typeof old === 'function' || old === undefined]);`,
    `setAdapterResolver(old);`,
    `console.log('RESULT=' + JSON.stringify(Object.fromEntries(out)));`,
  ].join('\n'));
  const r = spawnSync(process.execPath, [probe], { encoding: 'utf8' });
  const m = (r.stdout || '').match(/RESULT=(\{.*\})/);
  let res = {}; try { res = JSON.parse(m ? m[1] : '{}'); } catch {}
  check('cB5 setAdapterResolver 存在且可还原', res['has-setter'] === true && res['restore'] === true, `err=${(r.stderr || '').slice(0, 60)}`);
  const args = ['--plan', '--dry-run', '--task', 'todo cli tool'];
  const a = spawnSync(process.execPath, [REPO + '/scripts/orchestrator.mjs', ...args], { cwd: REPO, encoding: 'utf8' });
  const b = spawnSync(process.execPath, [REPO + '/scripts/orchestrator.mjs', ...args], { cwd: REPO, encoding: 'utf8', env: { ...process.env, YY_ACTIVATION: 'lib' } });
  check('cB5 YY_ACTIVATION=lib 与 legacy 输出一致（默认未翻）', norm(a.stdout) === norm(b.stdout) && a.status === b.status, `${a.stdout.length}B vs ${b.stdout.length}B`);
}

// ---------- cB6: legacy brief 行为级逐字对比（H3） ----------
{
  const oldFile = path.join(REPO, 'scripts/lib/adapters/__acc-old-prompt.mjs');
  fs.writeFileSync(oldFile, execFileSync('git', ['-C', REPO, 'show', '912fd4a:scripts/lib/adapters/prompt.mjs'], { encoding: 'utf8' }));
  const probe = path.join(SB, 'cb6.mjs');
  fs.writeFileSync(probe, [
    `import newMod from ${JSON.stringify(pathToFileURL(REPO + '/scripts/lib/adapters/prompt.mjs').href)};`,
    `import oldMod from ${JSON.stringify(pathToFileURL(oldFile).href)};`,
    `import fs from 'node:fs';`,
    `const subtask = { id: 't1', desc: 'make login page', task: 'login page', asset: 'frontend-design' };`,
    `const options = { workspace: '', assetsRoot: ${JSON.stringify(REPO + '/vendor')}, dryRun: true };`,
    `const wa = ${JSON.stringify(path.join(SB, 'cb6-ws-new'))}; const wb = ${JSON.stringify(path.join(SB, 'cb6-ws-old'))};`,
    `fs.mkdirSync(wa, { recursive: true }); fs.mkdirSync(wb, { recursive: true });`,
    `await newMod.run(subtask, {}, { ...options, workspace: wa });`,
    `await oldMod.run(subtask, {}, { ...options, workspace: wb });`,
    `const a = fs.readFileSync(wa + '/artifacts/t1/brief.md', 'utf8');`,
    `const b = fs.readFileSync(wb + '/artifacts/t1/brief.md', 'utf8');`,
    `const norm = (s) => s.replaceAll('\\r\\n', '\\n');`,
    `console.log('RESULT=' + JSON.stringify({ same: norm(a) === norm(b), len: norm(a).length }));`,
  ].join('\n'));
  const r = spawnSync(process.execPath, [probe], { encoding: 'utf8' });
  const m = (r.stdout || '').match(/RESULT=(\{.*\})/);
  let res = {}; try { res = JSON.parse(m ? m[1] : '{}'); } catch {}
  fs.rmSync(oldFile, { force: true });
  check('cB6 legacy brief 与 912fd4a 版行为级逐字一致', res.same === true, `len=${res.len} err=${(r.stderr || '').slice(0, 80)}`);
  check('cB6 临时旧文件已清理', !fs.existsSync(oldFile), '');
}

// ---------- cB7: --evolve 死路径证明 + 新旧编排器无旗标行为一致（H4） ----------
{
  const ws = path.join(SB, 'cb7-ws');
  fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
  const probe = path.join(SB, 'cb7.mjs');
  fs.writeFileSync(probe, [
    `import { evolutionPropose } from '${pathToFileURL(REPO + '/scripts/lib/evolution.mjs').href}';`,
    `const ev = evolutionPropose({`,
    `  assetId: 'implementation', sourceVersion: 'plan-x', proposedBy: 'orchestrator--evolve',`,
    `  baseline: { structure: 'T2_BACKEND', manifest: null, receiptTerminal: null, ciSection: null, rollbackTarget: null },`,
    `  candidate: { status: 'proposed', summary: 's', motivation: 'flag:--evolve', diff: null, expectedGain: null, rollback: null, evidence: [], risk: null, next: null },`,
    `  opts: { evidenceRoot: ${JSON.stringify(path.join(ws, '.tt-state'))}, now: new Date('2026-09-20T00:00:00Z'), rand: 'cb7a001' },`,
    `});`,
    `console.log('RESULT=' + JSON.stringify({ ok: ev.ok, code: ev.code }));`,
  ].join('\n'));
  const r = spawnSync(process.execPath, [probe], { encoding: 'utf8' });
  const m = (r.stdout || '').match(/RESULT=(\{.*\})/);
  let res = {}; try { res = JSON.parse(m ? m[1] : '{}'); } catch {}
  check('cB7 [缺陷登记] --evolve 传入形状恒被 CANDIDATE_INVALID 拒绝（死路径）',
    res.ok === false && res.code === 'CANDIDATE_INVALID', `got=${JSON.stringify(res)}`);

  const oldFile = path.join(REPO, 'scripts/__acc-old-orch.mjs');
  fs.writeFileSync(oldFile, execFileSync('git', ['-C', REPO, 'show', '912fd4a:scripts/orchestrator.mjs'], { encoding: 'utf8' }));
  try {
    const args = ['--plan', '--dry-run', '--task', 'todo cli tool'];
    const a = spawnSync(process.execPath, [path.join(REPO, 'scripts/orchestrator.mjs'), ...args], { cwd: REPO, encoding: 'utf8', timeout: 180000 });
    const c = spawnSync(process.execPath, [oldFile, ...args], { cwd: REPO, encoding: 'utf8', timeout: 180000 });
    check('cB7 无旗标行为与 T6 前基线一致（exit+stdout 归一）', a.status === c.status && norm(a.stdout) === norm(c.stdout), `new=${a.status} old=${c.status}`);
  } finally {
    fs.rmSync(oldFile, { force: true });
  }
  check('cB7 临时旧文件已清理', !fs.existsSync(oldFile), '');
}

// ---------- cT5: 基线数据独立复算（H5） ----------
{
  const baseDir = path.join(REPO, 'test-reports/rebuild-20260920/io-baseline');
  const runsDir = path.join(baseDir, 'runs');
  const jsonls = fs.existsSync(runsDir)
    ? fs.readdirSync(runsDir).flatMap((d) => { const p = path.join(runsDir, d, 'io-audit.jsonl'); return fs.existsSync(p) ? [p] : []; })
    : [];
  check('cT5 18 份原始 JSONL 存在', jsonls.length === 18, `found=${jsonls.length}`);
  if (jsonls.length) {
    const lines = fs.readFileSync(jsonls[0], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const bad = lines.filter((l) => !l.path || !l.tag || !l.ts || !l.op);
    const vendor = lines.filter((l) => /\/vendor(\/|$)/i.test(l.path));
    check('cT5 首份 JSONL 36 条全 vendor、字段齐全', lines.length === 36 && bad.length === 0 && vendor.length === lines.length,
      `total=${lines.length} bad=${bad.length} vendor=${vendor.length}`);
    // taxonomy 缺口实证：manifest 装载被记为 consumption（SKILL.md 全量读 + tag=consumption）
    const skillReads = lines.filter((l) => /SKILL\.md$/i.test(l.path) && l.tag === 'consumption');
    check('cT5 taxonomy 缺口实证：SKILL.md 全量装载记为 consumption', skillReads.length >= 16, `skillReads=${skillReads.length}`);
  }
  check('cT5 REPORT.md 存在', fs.existsSync(path.join(baseDir, 'REPORT.md')), '');
}

console.log(`TOTAL: ${pass}/${pass + fail} PASS`);
process.exit(fail === 0 ? 0 : 1);
