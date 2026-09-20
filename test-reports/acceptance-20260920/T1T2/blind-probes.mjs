/**
 * 编排者盲测探针 — T1/T2 验收（2026-09-20，v2 修正探针侧契约错误）
 * v1 失败归因：NODE_OPTIONS 需 file:/// URL；CLI 参数需按实现文档；断言需大小写不敏感（实现做了路径折叠）。
 * 覆盖反走捷径假设 H1-H5（见文件头注释 v1）。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REPO = 'D:/.ai-hub/skills/yy';
const HOOK_URL = pathToFileURL(REPO + '/scripts/lib/io-audit-hook.mjs').href;
function hookEnv(auditDir) {
  return { ...process.env, NODE_OPTIONS: '--import ' + HOOK_URL, YY_IO_AUDIT_DIR: auditDir };
}
function readRecs(dir) {
  const jf = path.join(dir, 'io-audit.jsonl');
  if (!fs.existsSync(jf)) return null;
  return fs.readFileSync(jf, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
const has = (s, sub) => s.toLowerCase().includes(sub.toLowerCase());

const HERE = path.dirname(path.join(process.cwd(), 'x'));
const SB = path.join(REPO, 'test-reports/acceptance-20260920/T1T2/.sandbox');
fs.rmSync(SB, { recursive: true, force: true });
fs.mkdirSync(SB, { recursive: true });
let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`[PASS] ${name} ${detail}`); }
  else { fail++; console.log(`[FAIL] ${name} ${detail}`); }
}

// ---------- bp1: 全新子进程注入 hook，promises 版（H1） ----------
{
  const auditDir = path.join(SB, 'bp1-audit'); fs.mkdirSync(auditDir, { recursive: true });
  const victim = path.join(SB, 'bp1-victim.mjs');
  fs.writeFileSync(victim, [
    "import fs from 'node:fs';",
    "import fsp from 'node:fs/promises';",
    `const a = await fsp.readFile(${JSON.stringify(REPO + '/vendor/frontend-design/SKILL.md')}, 'utf8');`,
    `const b = fs.readFileSync(${JSON.stringify(REPO + '/package.json')}, 'utf8');`,
    "console.log('victim-done', a.length > 0, b.length > 0);",
  ].join('\n'));
  const r = spawnSync(process.execPath, [victim], { env: hookEnv(auditDir), encoding: 'utf8' });
  const recs = readRecs(auditDir) ?? [];
  check('bp1 hook 新进程捕获 vendor 读取（大小写不敏感断言）',
    r.status === 0 && recs.length === 1 && has(recs[0].path, 'vendor/frontend-design/SKILL.md'),
    `status=${r.status} recs=${recs.length}`);
  check('bp1 tag=consumption / op=readFile', recs[0]?.tag === 'consumption' && recs[0]?.op === 'readFile',
    `tag=${recs[0]?.tag} op=${recs[0]?.op}`);
}

// ---------- bp2: 作用域防护 ----------
{
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-out-'));
  const auditDir = path.join(SB, 'bp2-audit'); fs.mkdirSync(auditDir, { recursive: true });
  fs.writeFileSync(path.join(outside, 'v.mjs'),
    `import fs from 'node:fs'; fs.readFileSync(${JSON.stringify(REPO + '/vendor/review/SKILL.md')}, 'utf8'); console.log('ok');`);
  const r = spawnSync(process.execPath, ['v.mjs'], { cwd: outside, env: hookEnv(auditDir), encoding: 'utf8' });
  check('bp2 仓库外进程零记录', r.status === 0 && readRecs(auditDir) === null, `status=${r.status}`);
}

// ---------- bp3: routing 归类精度（H2）——预期缺陷登记 ----------
{
  const auditDir = path.join(SB, 'bp3-audit'); fs.mkdirSync(auditDir, { recursive: true });
  const cheat = path.join(SB, 'callermatrix.mjs');
  fs.writeFileSync(cheat, `import fs from 'node:fs'; fs.readFileSync(${JSON.stringify(REPO + '/vendor/colorize/SKILL.md')}, 'utf8'); console.log('done');`);
  const r = spawnSync(process.execPath, [cheat], { env: hookEnv(auditDir), encoding: 'utf8' });
  const recs = readRecs(auditDir) ?? [];
  check('bp3 [缺陷登记] 子串匹配把 callermatrix.mjs 误判 routing（应按调用方判定）',
    r.status === 0 && recs.length === 1 && recs[0].tag === 'routing', `tag=${recs[0]?.tag}（缺陷复现=P2）`);
}

// ---------- bp4: fail-closed + 合成数据聚合 ----------
{
  const bad = path.join(SB, 'bad.jsonl');
  fs.writeFileSync(bad, 'not-json-garbage\n');
  const r = spawnSync(process.execPath, [REPO + '/scripts/asset-io-report.mjs', '--input', bad, '--label', 'acc-bp4', '--out', SB], { encoding: 'utf8' });
  check('bp4 畸形 JSONL fail-closed', r.status !== 0, `exit=${r.status}`);

  const good = path.join(SB, 'good.jsonl');
  const t = '2026-09-20T07:00:00.000Z';
  fs.writeFileSync(good, [
    JSON.stringify({ ts: t, pid: 1, cwd: REPO, op: 'readFile', path: REPO + '/vendor/frontend-design/SKILL.md', tag: 'consumption' }),
    JSON.stringify({ ts: t, pid: 1, cwd: REPO, op: 'readFileSync', path: REPO + '/vendor/frontend-design/SKILL.md', tag: 'consumption' }),
    JSON.stringify({ ts: t, pid: 1, cwd: REPO, op: 'readdir', path: REPO + '/vendor/colorize', tag: 'routing' }),
  ].join('\n') + '\n');
  const outDir = path.join(SB, 'bp4b-out');
  const r2 = spawnSync(process.execPath, [REPO + '/scripts/asset-io-report.mjs', '--input', good, '--label', 'bp4b', '--out', outDir], { encoding: 'utf8' });
  const repPath = path.join(outDir, 'REPORT.md');
  const rep = fs.existsSync(repPath) ? fs.readFileSync(repPath, 'utf8') : '';
  const fdLine = rep.split('\n').find((l) => has(l, 'frontend-design')) ?? '';
  check('bp4b 合成数据聚合 exit 0', r2.status === 0, `exit=${r2.status} err=${(r2.stderr || '').slice(0, 80)}`);
  check('bp4b frontend-design 行含 consumption=2', /2/.test(fdLine), `line=${fdLine.trim().slice(0, 60)}`);
  const zcSection = rep.split('## 16 资产零调用清单')[1]?.split('\n## ')[0] ?? '';
  const zcCount = (zcSection.match(/^- /gm) || []).length;
  check('bp4b 零调用清单条目=14（16-2 被触碰资产）', zcCount === 14, `count=${zcCount}`);
}

// ---------- bp5: transcript manifest 罗列排除（H4） ----------
{
  const fixture = path.join(SB, 'fx.ndjson');
  const all16 = ['agent-research','agent-vision-toolkit','be-architect','be-provider','be-resilience','be-validator','colorize','dev-planner','frontend-design','frontend-visual-validation','implementation','planning','review','sdlc','security','skill-sentinel'].map((a) => `vendor/${a}/SKILL.md`).join(' ');
  fs.writeFileSync(fixture, [
    JSON.stringify({ ts: '2026-09-20T01:00:00Z', kind: 'tool_result', text: 'ASSET INVENTORY: ' + all16 }),
    JSON.stringify({ ts: '2026-09-20T01:00:01Z', kind: 'tool_call', tool: 'Read', arguments: { file_path: REPO + '\\vendor\\review\\SKILL.md' } }),
    JSON.stringify({ ts: '2026-09-20T01:00:02Z', kind: 'tool_call', tool: 'Read', arguments: { file_path: REPO + '\\package.json' } }),
  ].join('\n') + '\n');
  const out = path.join(SB, 'bp5-out.jsonl');
  const r = spawnSync(process.execPath, [REPO + '/scripts/asset-io-transcript.mjs', '--transcript', fixture, '--out', out, '--repo', REPO], { encoding: 'utf8' });
  let recs = [];
  if (fs.existsSync(out)) recs = fs.readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  check('bp5 manifest 罗列排除、真读取恰 1 条 vendor',
    r.status === 0 && recs.length === 1 && has(recs[0].path, 'vendor/review/SKILL.md'),
    `exit=${r.status} recs=${recs.length} err=${(r.stderr || '').slice(0, 60)}`);
}

// ---------- bp6: A2 全新输入逐字节差分（H5，合法+错误路径） ----------
async function bp6() {
  const mkDraft = (cross) => ({
    task: 'markdown note to html converter with syntax highlighting',
    draft: true,
    phases: [{ name: 'convert-core', tasks: [
      { id: 'c1', desc: 'implement markdown parser and highlighter', asset: 'implementation', estimate: 'M', lane: 'a', dependsOn: [] },
      { id: 'c2', desc: 'add cli interface and theme css', asset: 'sdlc', estimate: 'S', lane: cross ? 'b' : 'a', dependsOn: ['c1'] },
    ] }],
  });
  for (const [label, cross, wantCode] of [['合法', false, 0], ['错误路径(跨lane依赖)', true, 6]]) {
    const df = path.join(SB, 'bp6-draft-' + (cross ? 'bad' : 'ok') + '.json');
    fs.writeFileSync(df, JSON.stringify(mkDraft(cross)));
    const TASK = 'markdown note to html converter';
    const real = spawnSync(process.execPath, [REPO + '/scripts/orchestrator.mjs', '--plan', '--dry-run', '--task', TASK, '--draft', df], { cwd: REPO, encoding: 'utf8' });
    const probe = path.join(SB, 'bp6-lib.mjs');
    fs.writeFileSync(probe, [
      "import fs from 'node:fs';",
      "import { planDryRun } from '" + pathToFileURL(REPO + '/scripts/lib/orchestrator.mjs').href + "';",
      "import { buildManifest } from '" + pathToFileURL(REPO + '/scripts/lib/manifest.mjs').href + "';",
      "const r = await planDryRun(['--plan','--dry-run','--task'," + JSON.stringify(TASK) + ",'--draft'," + JSON.stringify(df) + "], {",
      "  readFile: (p) => fs.promises.readFile(p, 'utf8'),",
      "  buildManifest: () => buildManifest({ vendorDir: " + JSON.stringify(REPO + '/vendor') + " }),",
      "  workspace: " + JSON.stringify(REPO) + ", config: null, errorTypes: {},",
      "});",
      "process.stdout.write(r.stdout); process.stderr.write(r.stderr); process.exitCode = r.exitCode;",
    ].join('\n'));
    const lib = spawnSync(process.execPath, [probe], { cwd: REPO, encoding: 'utf8' });
    const norm = (s) => s.replaceAll('\r\n', '\n').trim();
    check('bp6[' + label + '] 退出码一致且=' + wantCode, real.status === lib.status && real.status === wantCode, 'real=' + real.status + ' lib=' + lib.status + ' libErr=' + (lib.stderr || '').slice(0, 60));
    check('bp6[' + label + '] stdout 逐字节一致', norm(real.stdout) === norm(lib.stdout), 'real=' + real.stdout.length + 'B lib=' + lib.stdout.length + 'B');
  }
}
await bp6();

console.log(`TOTAL: ${pass}/${pass + fail} PASS`);
process.exit(fail === 0 ? 0 : 1);
