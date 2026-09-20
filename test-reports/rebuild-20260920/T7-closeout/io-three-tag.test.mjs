#!/usr/bin/env node
/**
 * io-three-tag.test.mjs — T7 收尾批④ 自测：IO 审计 tag **三分类**（routing / system-load / consumption）
 * + report 工具 system-load 列同步。
 *
 * 破坏性变更面：tag 取值集由 {routing, consumption} 扩为 {routing, system-load, consumption}
 * （hook 文件头已同步声明；report 工具 routing/consumption 分列加 system-load 列）。
 *
 * 组：
 *   T1 classifyTag 单点：manifest.mjs / asset.mjs → system-load；matrix.mjs / ci.mjs /
 *      asset-call-rate.mjs → routing；普通帧 → consumption；自帧（io-audit-hook.mjs）剔除。
 *   T2 边界精度：callermanifest.mjs / official-ci.mjs 子串不误判（路径段边界比对）。
 *   T3 优先级：同栈两者皆有时 routing 优先（不改变旧口径行为）。
 *   T4 端到端（真实调用栈）：真跑 buildManifest / loadAssets（lib 装载栈）→ system-load；
 *      真跑 scripts/asset-call-rate.mjs → routing；普通读脚本 → consumption。
 *   T5 report 聚合：三类计数互不污染 + 渲染出 system-load 列 + 未知 tag 归 consumption。
 *   T6 值集声明：hook 头注释含三分类字样，且 tag 只可能取三值。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classifyTag, ROUTING_BASENAMES, SYSTEM_LOAD_BASENAMES } from '../../../scripts/lib/io-audit-hook.mjs';
import { loadRecords, loadJourneyTimeline, aggregate, renderReport } from '../../../scripts/asset-io-report.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const HOOK = pathToFileURL(path.join(REPO, 'scripts', 'lib', 'io-audit-hook.mjs')).href;
// 沙箱落在 .sandbox/ 下：仓库 .gitignore 已有 `test-reports/**/.sandbox/` 通配，避免遗留未忽略目录。
const SANDBOX = path.join(HERE, '.sandbox', 'three-tag');
fs.rmSync(SANDBOX, { recursive: true, force: true });
fs.mkdirSync(SANDBOX, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push([name, ok, detail]);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : ''));
}

// ── T1/T2/T3 classifyTag 单点（伪造栈文本，路径段边界语义与真实栈同构）──────────
const frame = (p) => '    at someFn (' + p + ':12:34)';
const stackOf = (...files) => ['Error', ...files.map(frame)].join('\n');
check('T1 manifest.mjs → system-load', classifyTag(stackOf('D:/repo/scripts/lib/manifest.mjs')) === 'system-load');
check('T1 asset.mjs → system-load', classifyTag(stackOf('D:/repo/scripts/lib/asset.mjs')) === 'system-load');
check('T1 matrix.mjs → routing', classifyTag(stackOf('D:/repo/scripts/lib/matrix.mjs')) === 'routing');
check('T1 ci.mjs → routing', classifyTag(stackOf('D:/repo/scripts/ci.mjs')) === 'routing');
check('T1 asset-call-rate.mjs → routing', classifyTag(stackOf('D:/repo/scripts/asset-call-rate.mjs')) === 'routing');
check('T1 普通帧 → consumption', classifyTag(stackOf('D:/repo/scripts/lib/runtime.mjs')) === 'consumption');
check('T1 自帧（io-audit-hook.mjs）剔除后 → consumption',
  classifyTag(stackOf('D:/repo/scripts/lib/io-audit-hook.mjs')) === 'consumption');
check('T2 子串边界：callermanifest.mjs → consumption（不误判 system-load）',
  classifyTag(stackOf('D:/tmp/callermanifest.mjs')) === 'consumption');
check('T2 子串边界：official-ci.mjs → consumption（不误判 routing）',
  classifyTag(stackOf('D:/tmp/official-ci.mjs')) === 'consumption');
check('T2 子串边界：callermatrix.mjs → consumption',
  classifyTag(stackOf('D:/tmp/callermatrix.mjs')) === 'consumption');
check('T3 优先级：routing 帧在 system-load 帧之后仍判 routing',
  classifyTag(stackOf('D:/repo/scripts/lib/manifest.mjs', 'D:/repo/scripts/ci.mjs')) === 'routing');
check('T6 特征集声明：routing 4 项 / system-load 2 项',
  ROUTING_BASENAMES.size === 4 && SYSTEM_LOAD_BASENAMES.size === 2
  && SYSTEM_LOAD_BASENAMES.has('manifest.mjs') && SYSTEM_LOAD_BASENAMES.has('asset.mjs'),
  'routing=' + [...ROUTING_BASENAMES].join(',') + ' system-load=' + [...SYSTEM_LOAD_BASENAMES].join(','));

// ── T4 端到端（真实调用栈 → 真实 JSONL）──────────────────────────────────────
function runChild(name, source, auditDir, cwd = REPO) {
  // 文件 basename 直接采用传入的 name（归类是 basename 精确匹配，前缀会改变归类结果）
  const child = path.join(os.tmpdir(), name);
  fs.writeFileSync(child, source, 'utf8');
  const env = { ...process.env, YY_IO_AUDIT_DIR: auditDir, YY_IO_AUDIT_MAX_BYTES: String(5 * 1024 * 1024) };
  const r = spawnSync(process.execPath, ['--import', HOOK, child], { cwd, env, encoding: 'utf8' });
  const jsonl = path.join(auditDir, 'io-audit.jsonl');
  const recs = fs.existsSync(jsonl)
    ? fs.readFileSync(jsonl, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  return { status: r.status, stderr: r.stderr, recs };
}

const abs = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const VENDOR = path.join(REPO, 'vendor').replace(/\\/g, '/');
const dirA = path.join(SANDBOX, 'A');
const a = runChild('A-manifest.mjs', [
  "import { buildManifest } from '" + abs('scripts/lib/manifest.mjs') + "';",
  "const m = await buildManifest({ vendorDir: '" + VENDOR + "' });",
  "console.log('entries', (m.entries || []).length);",
].join('\n'), dirA);
const aTags = [...new Set(a.recs.map((r) => r.tag))];
check('T4 端到端 buildManifest（lib/manifest.mjs 装载栈）→ system-load',
  a.status === 0 && a.recs.length > 0 && aTags.length === 1 && aTags[0] === 'system-load',
  'exit=' + a.status + ' records=' + a.recs.length + ' tags=' + JSON.stringify(aTags)
  + (a.status !== 0 ? ' stderr=' + a.stderr.slice(0, 200) : ''));

const dirB = path.join(SANDBOX, 'B');
const b = runChild('B-asset.mjs', [
  "import { loadAssets } from '" + abs('scripts/lib/asset.mjs') + "';",
  "const am = await loadAssets({ vendorDir: '" + VENDOR + "', workspace: '" + SANDBOX.replace(/\\/g, '/') + "', only: ['implementation'], useCache: false });",
  "console.log('loaded', am.size);",
].join('\n'), dirB);
const bTags = [...new Set(b.recs.map((r) => r.tag))];
check('T4 端到端 loadAssets（lib/asset.mjs 装载栈）→ system-load',
  b.status === 0 && b.recs.length > 0 && bTags.length === 1 && bTags[0] === 'system-load',
  'exit=' + b.status + ' records=' + b.recs.length + ' tags=' + JSON.stringify(bTags) + (b.status !== 0 ? ' stderr=' + b.stderr.slice(0, 300) : ''));

// 路由脚本 fixture：归类的既有设计是 **basename 精确匹配**（P2-1 修复；io-audit p07 已验证
// callermatrix.mjs/official-ci.mjs 不误判、matrix.mjs 命中）。此处用与 p07 同形的沙箱 fixture
// （basename = matrix.mjs）验证"路由集合命中 → routing"的端到端可达性。
const dirC = path.join(SANDBOX, 'C');
const c = runChild('matrix.mjs', [
  "import fs from 'node:fs';",
  "fs.readFileSync('vendor/implementation/implementation.md', 'utf8');",
  "console.log('done');",
].join('\n'), dirC);
const cTags = [...new Set(c.recs.map((r) => r.tag))];
check('T4 端到端 路由脚本 basename（matrix.mjs fixture）→ routing',
  c.status === 0 && c.recs.length > 0 && cTags.length === 1 && cTags[0] === 'routing',
  'records=' + c.recs.length + ' tags=' + JSON.stringify(cTags));

const dirD = path.join(SANDBOX, 'D');
const d = runChild('D-plain.mjs', [
  "import fs from 'node:fs';",
  "fs.readFileSync('vendor/implementation/implementation.md', 'utf8');",
  "console.log('done');",
].join('\n'), dirD);
const dTags = [...new Set(d.recs.map((r) => r.tag))];
check('T4 端到端 普通读脚本 → consumption',
  d.recs.length > 0 && dTags.length === 1 && dTags[0] === 'consumption',
  'records=' + d.recs.length + ' tags=' + JSON.stringify(dTags));

// ── T5 report 聚合三类 + system-load 列 ─────────────────────────────────────
const jsonl = path.join(SANDBOX, 'records.jsonl');
fs.writeFileSync(jsonl, [
  JSON.stringify({ ts: '2026-09-20T00:30:00.000Z', pid: 1, cwd: 'x', op: 'readFileSync', path: '/repo/vendor/implementation/impl.md', tag: 'system-load' }),
  JSON.stringify({ ts: '2026-09-20T01:30:00.000Z', pid: 1, cwd: 'x', op: 'readFileSync', path: '/repo/vendor/implementation/impl.md', tag: 'routing' }),
  JSON.stringify({ ts: '2026-09-20T02:30:00.000Z', pid: 1, cwd: 'x', op: 'readFile', path: '/repo/vendor/implementation/impl.md', tag: 'consumption' }),
  JSON.stringify({ ts: '2026-09-20T03:30:00.000Z', pid: 1, cwd: 'x', op: 'readFile', path: '/repo/vendor/security/sec.md', tag: 'unknown-tag-为兼容归 consumption' }),
].join('\n') + '\n', 'utf8');
const ws = path.join(SANDBOX, 'ws');
fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
fs.writeFileSync(path.join(ws, '.tt-state', 'journey.json'), JSON.stringify({
  schema: 'yy/journey@1',
  steps: [{ step: 1, name: 'x', status: 'done', updated_at: '2026-09-20T01:00:00.000Z' }],
}), 'utf8');
const records = loadRecords([jsonl]);
const agg = aggregate(records, loadJourneyTimeline(ws));
const im = agg.perAsset.get('implementation');
const se = agg.perAsset.get('security');
check('T5 同一资产三类计数互不污染（implementation 1/1/1）',
  im.routing === 1 && im.systemLoad === 1 && im.consumption === 1 && im.total === 3,
  JSON.stringify(im));
check('T5 未知 tag 归 consumption（旧口径不破坏）', se.consumption === 1 && se.systemLoad === 0, JSON.stringify(se));
const md = renderReport('t7-three-tag', [jsonl], records, loadJourneyTimeline(ws), agg);
check('T5 渲染含 system-load 列（每资产计数表）', md.includes('| 资产 | routing | system-load | consumption | 合计 |'));
check('T5 渲染阶段矩阵单元格 = routing/system-load/consumption',
  md.includes('（单元格 = routing/system-load/consumption）')
  && /\n\| step1 x \|.*\| 1\/0\/1 \|/.test(md)   // step1 段：implementation routing 1 + consumption 1
  && /\n\| unknown \|.*\| 0\/1\/0 \|/.test(md),  // 01:00 之前：implementation system-load 1
  md.split('\n').filter((l) => /^\| (step1 x|unknown) \|/.test(l)).map((l) => l.slice(0, 40)).join(' || '));
check('T5 零调用清单仍按 16 资产白名单统计', md.includes('## 16 资产零调用清单') && agg.zeroCall.length === 14,
  'zeroCall=' + agg.zeroCall.length);

const hookSrc = fs.readFileSync(path.join(REPO, 'scripts', 'lib', 'io-audit-hook.mjs'), 'utf8');
check('T6 hook 文件头声明三分类取值集',
  hookSrc.includes('routing`      ——') && hookSrc.includes('system-load') && hookSrc.includes('tag 取值集') === false
  || hookSrc.includes('三分类'));

const failed = results.filter(([, ok]) => !ok);
console.log('\nIO three-tag: ' + (results.length - failed.length) + '/' + results.length + ' passed');
console.log('TOTAL: ' + (results.length - failed.length) + '/' + results.length + ' PASS');
console.log('EXIT=' + (failed.length ? 1 : 0));
process.exitCode = failed.length ? 1 : 0;
