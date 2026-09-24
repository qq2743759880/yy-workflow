#!/usr/bin/env node
/**
 * research-gate.mjs — 研究门（RG-1，execution-plan-v3 §四/§五批 0）。
 * 内核 = vendor/deep-research（dzhng 原仓库，禁止自研复刻）：本脚本只做两件事——
 *   ① 胶水 runKernel()：经 tsx 调 vendored deepResearch 循环（产生检索日志片段，证真跑）；
 *   ② 机验 verifyDocs()：fail-closed 校验 docs/prior-art.md + docs/market.md 的固定 JSON block。
 * 检索兜底（WebSearch 不可用）：api.github.com search + registry.npmjs.org（实测可达），
 *   由 runQueries() 执行并把证据行写进 prior-art（novel 必须 "检索过什么/为何没找到" 否则 FAIL）。
 * 用法：
 *   node scripts/research-gate.mjs --workspace <dir> [--self-test]
 *   node scripts/research-gate.mjs --kernel-probe          # 内核真跑探针（无 key 也须走通错误路径）
 * 退出码：0 = PASS；1 = gate FAIL（fail-closed）；2 = 用法/IO 错误。
 * 网络语义（D-REG1-1 编排者推荐方案·临时态待 Owner 追认，2026-09-23；归因修正见 ledger）：兜底源整体不可达的产物（evidence 同时含 github-api 与
 *   npm-registry「不可达」标记）默认 **FAIL**（fail-closed——无研究依据不得继续规划）；
 *   显式 `--allow-offline --approved-by <name>` 才放行，且必须打印 OVERRIDE EVENT（risk override：
 *   人为承担风险并留痕，非绕过；approvedBy 必须是人署名，agent 不得自填）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = path.join(ROOT, 'vendor', 'deep-research');
const GATE_VOCAB = ['adopt', 'adapt', 'reject'];
const WHEEL_VOCAB = ['existing', 'partial', 'novel'];
const VERDICT_VOCAB = ['build', 'pivot', 'drop'];
const CONFIDENCE_VOCAB = ['high', 'medium', 'low'];
const SOURCE_VOCAB = ['github-api', 'npm-registry'];

/** 解析 markdown 中 ```json 代码块（固定 JSON block 约定：文档内首个 ```json 围栏）。坏块/缺块 → null。 */
export function extractJsonBlock(md) {
  const m = String(md || '').match(/```json\s*\n([\s\S]*?)```/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

/** URL 字段须形如 http(s) 外链（格式级；真实可达性可复用 review-gate.mjs 的 --verify-urls 探测）。 */
const isHttpUrl = (u) => typeof u === 'string' && /^https?:\/\/\S+$/i.test(u) && u.length <= 2048;

/**
 * prior-art 机验（fail-closed）。返回 { ok, checks:[{name,ok,detail}] }。
 * 硬门：search_queries≥5 / sources_used≥2 类 / 候选表字段齐+枚举合法 /
 *   wheel_status 枚举；novel → 必须有 nonEmpty novelty_evidence[]（检索过什么+为何没找到）。
 */
export function verifyPriorArt(doc) {
  const checks = [];
  const j = extractJsonBlock(doc);
  const push = (name, ok, detail) => checks.push({ name, ok, detail });
  push('json_block', !!j, j ? '```json block 可解析' : '缺 ```json block 或 JSON 解析失败');
  if (!j) return { ok: false, checks };
  const strArr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim().length > 0) : []);
  const sq = strArr(j.search_queries);
  push('search_queries>=5', sq.length >= 5, '实得 ' + sq.length + ' 条（需≥5）');
  const srcs = strArr(j.sources_used).filter((s) => SOURCE_VOCAB.includes(s));
  push('sources_used>=2', srcs.length >= 2, '实得 ' + srcs.length + ' 类合法源 [' + SOURCE_VOCAB.join('/') + ']（需≥2）');
  const cands = Array.isArray(j.candidates) ? j.candidates : [];
  let candOk = cands.length > 0; const candErr = [];
  const bad = (msg) => { candOk = false; candErr.push(msg); };
  for (const [i, c] of cands.entries()) {
    for (const f of ['repo_url', 'stars', 'last_commit', 'license', 'overlap', 'differentiation', 'verdict']) {
      if (!(f in c) || c[f] === null || c[f] === '') bad('candidate[' + i + '] 缺 ' + f);
    }
    if (c && c.verdict && !GATE_VOCAB.includes(c.verdict)) bad('candidate[' + i + '] verdict 非枚举: ' + c.verdict);
    if (c && 'overlap' in c && !(typeof c.overlap === 'number' && c.overlap >= 0 && c.overlap <= 1)) bad('candidate[' + i + '] overlap 须 0-1');
    if (c && c.repo_url && !isHttpUrl(c.repo_url)) bad('candidate[' + i + '] repo_url 非外链');
  }
  checks.push({ name: 'candidates', ok: candOk, detail: candOk ? cands.length + ' 个候选字段齐+枚举合法' : candErr.slice(0, 5).join('; ') });
  const wheelOk = WHEEL_VOCAB.includes(j.wheel_status);
  push('wheel_status', wheelOk, wheelOk ? 'wheel_status=' + j.wheel_status : '非法枚举: ' + JSON.stringify(j.wheel_status) + '（' + WHEEL_VOCAB.join('|') + '）');
  if (j.wheel_status === 'novel') {
    const ev = strArr(j.novelty_evidence);
    push('novel_novelty_evidence', ev.length > 0, ev.length > 0 ? 'novel 附 ' + ev.length + ' 行检索证据（查了什么/为何没找到）' : 'wheel_status=novel 但 novelty_evidence 为空 → 检索未做实，FAIL（fail-closed）');
  }
  return { ok: checks.every((c) => c.ok), checks };
}

/**
 * market 机验（fail-closed）。返回 { ok, checks }。
 * 硬门：pain_evidence≥3（url+quote+date 全齐且 url 外链）/ competitors≥3（name+gap）/
 *   verdict+confidence 枚举合法。
 */
export function verifyMarket(doc) {
  const checks = [];
  const push = (name, ok, detail) => checks.push({ name, ok, detail });
  const j = extractJsonBlock(doc);
  push('json_block', !!j, j ? '```json block 可解析' : '缺 ```json block 或 JSON 解析失败');
  if (!j) return { ok: false, checks };
  const scan = (arr, fields, label, extra) => {
    const items = Array.isArray(arr) ? arr : []; const err = [];
    for (const [i, it] of items.entries()) {
      for (const f of fields) if (!it || !it[f] || String(it[f]).trim() === '') err.push(label + '[' + i + '] 缺 ' + f);
      if (extra) err.push(...extra(it, i));
    }
    return [items, err];
  };
  const [pains, painErr] = scan(j.pain_evidence, ['url', 'quote', 'date'], 'pain_evidence', (p, i) => [
    ...(p && p.url && !isHttpUrl(p.url) ? ['pain_evidence[' + i + '] url 非外链'] : []),
    ...(p && p.date && !/^\d{4}-\d{2}-\d{2}/.test(String(p.date)) ? ['pain_evidence[' + i + '] date 非 YYYY-MM-DD'] : []),
  ]);
  push('pain_evidence>=3', pains.length >= 3 && painErr.length === 0, pains.length >= 3 && painErr.length === 0 ? pains.length + ' 条带外链+引文+日期' : '实得 ' + pains.length + ' 条（需≥3）；' + painErr.slice(0, 5).join('; '));
  const [comps, compErr] = scan(j.competitors, ['name', 'gap'], 'competitors', null);
  push('competitors>=3', comps.length >= 3 && compErr.length === 0, comps.length >= 3 && compErr.length === 0 ? comps.length + ' 个竞品 name+gap 齐' : '实得 ' + comps.length + ' 个（需≥3）；' + compErr.slice(0, 5).join('; '));
  const verdictOk = VERDICT_VOCAB.includes(j.verdict) && CONFIDENCE_VOCAB.includes(j.confidence);
  push('verdict+confidence', verdictOk, verdictOk ? 'verdict=' + j.verdict + ' confidence=' + j.confidence : '非法枚举 verdict=' + JSON.stringify(j.verdict) + ' confidence=' + JSON.stringify(j.confidence));
  return { ok: checks.every((c) => c.ok), checks };
}

/**
 * 胶水（≤150 行约束的全部理由所在）：调 vendored deep-research 循环。
 * 经 tsx 子进程 import src/deep-research.ts（tsx 运行时 TS 导入）default 命名空间，
 * 调 dr.deepResearch({query,breadth,depth})。无 API key 时循环体在 generateSerpQueries→getModel
 * 边界抛 'No model found' —— 该错误本身即"内核真跑"证据（错误来自 vendored 代码路径）。
 * 返回 { ok, log, error }：ok=true 循环完整跑完；ok=false 但 error 含 'No model found' = 探针级真跑。
 */
export function runKernel(query, { timeoutMs = 120000 } = {}) {
  const fail = (error) => ({ ok: false, log: '', error });
  if (!fs.existsSync(path.join(VENDOR, 'src', 'deep-research.ts'))) return fail('vendored 内核缺失: ' + VENDOR);
  const tsxCli = path.join(VENDOR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  if (!fs.existsSync(tsxCli)) return fail('vendored 依赖未安装（tsx 缺失）——先在 vendor/deep-research 内 npm install');
  // tsx -e 上下文里 export 名字解析异常，写临时探针文件（.mts，default 命名空间 + top-level await）后运行。
  const probeFile = path.join(VENDOR, 'rg1-kernel-probe.mts');
  fs.writeFileSync(probeFile, [
    'import dr from \'./src/deep-research.ts\';',
    'const r = { loopRan: false, completed: false, error: null, learnings: 0 };',
    'try { const res = await dr.deepResearch({ query: ' + JSON.stringify(query) + ', breadth: 1, depth: 1, onProgress: (p) => console.log(JSON.stringify(p)) }); r.loopRan = true; r.completed = true; r.learnings = res.learnings.length; }',
    'catch (e) { r.loopRan = true; r.error = (e && e.message || String(e)).slice(0, 200); }',
    'console.log(\'__KERNEL__\' + JSON.stringify(r));',
  ].join('\n') + '\n');
  return new Promise((resolve) => {
    // Windows Node≥18.20 spawn .cmd 无 shell 会 EINVAL（CVE-2024-27980 缓解）——spawn node 直调 tsx cli（跨平台稳定）。
    const child = spawn(process.execPath, [tsxCli, probeFile], { cwd: VENDOR, env: process.env, shell: false });
    let out = ''; let err = '';
    const cleanup = () => { try { fs.unlinkSync(probeFile); } catch { /* ignore */ } };
    const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } cleanup(); resolve({ ok: false, log: out, error: 'kernel 超时 ' + timeoutMs + 'ms' }); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', () => {
      clearTimeout(timer); cleanup();
      const line = out.split('\n').find((l) => l.includes('__KERNEL__'));
      if (!line) return resolve({ ok: false, log: out + err, error: '内核无 __KERNEL__ 输出（tsx 启动失败?）: ' + (out + err).slice(0, 200) });
      try {
        const r = JSON.parse(line.slice(line.indexOf('__KERNEL__') + 10));
        resolve({ ok: r.completed === true, log: out, error: r.error, loopRan: r.loopRan });
      } catch (e) { resolve({ ok: false, log: out + err, error: '__KERNEL__ 行解析失败: ' + e.message }); }
    });
  });
}

/**
 * 兜底检索（WebSearch 不可用 → api.github.com + registry.npmjs.org）。
 * 返回 { networkOk, sources:{github,npm}, evidence:[] }：evidence 行即 prior-art 检索日志片段。
 */
export async function runQueries(queries) {
  const evidence = []; const src = { github: false, npm: false };
  const UA = { headers: { 'User-Agent': 'yy-research-gate' }, signal: AbortSignal.timeout(15000) };
  try {
    const j = await (await fetch('https://api.github.com/search/repositories?q=' + encodeURIComponent(queries[0] || 'deep research') + '&per_page=3', UA)).json();
    src.github = true;
    for (const it of (j.items || []).slice(0, 3)) evidence.push('github-api: "' + (queries[0] || '') + '" → ' + it.full_name + ' ' + it.stargazers_count + '★ ' + ((it.license && it.license.spdx_id) || '-') + ' ' + it.html_url);
  } catch (e) { evidence.push('github-api: 不可达（' + (e && e.name || 'Error') + '）'); }
  try {
    const j = await (await fetch('https://registry.npmjs.org/-/v1/search?text=' + encodeURIComponent(queries[1] || 'deep research') + '&size=3', UA)).json();
    src.npm = true;
    for (const o of (j.objects || []).slice(0, 3)) evidence.push('npm-registry: "' + (queries[1] || '') + '" → ' + o.package.name + '@' + o.package.version + ' https://www.npmjs.com/package/' + o.package.name);
  } catch (e) { evidence.push('npm-registry: 不可达（' + (e && e.name || 'Error') + '）'); }
  return { networkOk: src.github || src.npm, sources: src, evidence };
}

async function selfTest() {
  const rows = []; const ok = (n, c, d) => rows.push([n, c, d]);
  const wrap = (fn) => (o) => fn('```json\n' + JSON.stringify(o) + '\n```');
  const pa = wrap(verifyPriorArt); const mk = wrap(verifyMarket);
  const cand = (v) => ({ repo_url: 'https://x.y', stars: 1, last_commit: '2026-01-01', license: 'MIT', overlap: 0.1, differentiation: 'd', verdict: v });
  const base = { search_queries: ['1', '2', '3', '4', '5'], sources_used: ['github-api', 'npm-registry'], candidates: [cand('reject')] };
  const pain = { url: 'https://a.b/c', quote: 'q', date: '2026-01-01' };
  const comps = [{ name: 'n', gap: 'g' }, { name: 'n2', gap: 'g2' }, { name: 'n3', gap: 'g3' }];
  const failNamed = (r, name) => !r.ok && r.checks.find((c) => c.name === name && !c.ok) !== undefined;
  // 6 样本（合规/缺 queries/novel 无证据/novel 带证据/market 合规/market 缺 pain）+ 枚举负样本
  ok('① json 提取/坏块', extractJsonBlock('前文\n```json\n{"a":1}\n```\n后文') !== null && extractJsonBlock('```json\n{broken\n```') === null, '正常块解析 / 坏块→null');
  ok('② prior-art 合规→PASS', pa({ ...base, wheel_status: 'partial', novelty_evidence: [] }).ok, '全过');
  ok('③ 缺 search_queries→FAIL', failNamed(pa({ ...base, search_queries: undefined, wheel_status: 'existing' }), 'search_queries>=5'), 'FAIL 指名 search_queries>=5');
  ok('④ novel 无证据→FAIL', failNamed(pa({ ...base, wheel_status: 'novel', novelty_evidence: [] }), 'novel_novelty_evidence'), 'fail-closed：FAIL 指名 novel_novelty_evidence');
  ok('⑤ novel 带证据→PASS', pa({ ...base, wheel_status: 'novel', novelty_evidence: ['查过 X/Y/Z：无同形物'] }).ok, '全过');
  ok('⑥ market 合规→PASS', mk({ pain_evidence: [pain, pain, pain], competitors: [{ name: 'n', pricing: 'free', gap: 'g' }, ...comps.slice(1)], verdict: 'build', confidence: 'medium' }).ok, '全过');
  ok('⑦ market 缺 pain→FAIL', failNamed(mk({ pain_evidence: [pain, pain], competitors: comps, verdict: 'build', confidence: 'low' }), 'pain_evidence>=3'), 'FAIL 指名 pain_evidence>=3');
  ok('⑧ verdict 非法→FAIL', failNamed(mk({ pain_evidence: [pain, pain, pain], competitors: comps, verdict: 'maybe', confidence: 'low' }), 'verdict+confidence'), 'FAIL 指名 verdict+confidence');
  const k = await runKernel('self-test kernel probe');
  ok('⑨ kernel 真跑', k.loopRan === true && (k.ok || /No model found/i.test(k.error || '')), 'completed=' + k.ok + ' error=' + (k.error || '无'));
  const allPass = rows.every((r) => r[1]);
  for (const [n, c, d] of rows) console.log((c ? 'PASS' : 'FAIL') + ' ' + n + (c ? '' : '  [' + d + ']'));
  console.log('research-gate self-test: ' + (allPass ? '全部通过' : '存在失败'));
  process.exitCode = allPass ? 0 : 1;
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (n) => { const i = argv.indexOf('--' + n); const v = i >= 0 ? argv[i + 1] : undefined; return v && !v.startsWith('--') ? v : undefined; };
  if (argv.includes('--self-test')) return selfTest();
  if (argv.includes('--kernel-probe')) {
    const k = await runKernel(arg('query') || 'probe: rg-1 research gate kernel smoke');
    console.log(JSON.stringify({ ok: k.ok, loopRan: k.loopRan, error: k.error || null, logBytes: (k.log || '').length }));
    process.exitCode = (k.loopRan && (k.ok || /No model found/i.test(k.error || ''))) ? 0 : 1;
  } else {
    const ws = arg('workspace') || ROOT;
    const docs = {};
    for (const [k, f] of [['prior-art', 'prior-art.md'], ['market', 'market.md']]) {
      const p = path.join(ws, 'docs', f);
      try { docs[k] = fs.readFileSync(p, 'utf8'); } catch { console.error('FAIL docs/' + f + ' 缺失: ' + p); process.exitCode = 1; return; }
    }
    console.log('[research-gate] 校验 ' + ws + '/docs/{prior-art,market}.md（fail-closed）');
    // D-REG1-1 裁决（risk override 语义，2026-09-23）：兜底源整体不可达的产物默认 FAIL——
    // 无研究依据不得继续规划；--allow-offline --approved-by <name> 显式风险接受 + OVERRIDE EVENT 留痕。
    const offlineArtifact = /github-api:.*不可达/.test(docs['prior-art']) && /npm-registry:.*不可达/.test(docs['prior-art']);
    const approvedBy = arg('approved-by');
    if (offlineArtifact && !argv.includes('--allow-offline')) {
      console.error('\n[FAIL] 检索兜底源整体不可达（无研究依据）——research-done 不得置位。');
      console.error('       显式风险接受：--allow-offline --approved-by <人名>（将记录 OVERRIDE EVENT，approvedBy 须为人署名）');
      process.exitCode = 1;
      return;
    }
    if (offlineArtifact && argv.includes('--allow-offline')) {
      if (!approvedBy) {
        console.error('[FAIL] --allow-offline 必须伴随 --approved-by <人名>（risk override 须人署名，agent 不得自填）');
        process.exitCode = 2;
        return;
      }
      const override = { gate: 'research', status: 'bypassed', reason: 'offline mode', riskAccepted: true, approvedBy, at: new Date().toISOString() };
      console.log('OVERRIDE_EVENT ' + JSON.stringify(override));
    }
    const results = { 'prior-art': verifyPriorArt(docs['prior-art']), 'market': verifyMarket(docs['market']) };
    for (const [tag, r] of Object.entries(results)) for (const c of r.checks) console.log((c.ok ? 'PASS' : 'FAIL') + ' ' + tag + '/' + c.name + '  ' + c.detail);
    const pass = results['prior-art'].ok && results['market'].ok;
    console.log(pass ? '\n[OK] 研究门通过（gate=research-done）' : '\n[FAIL] 研究门未过——research-done 不得置位');
    process.exitCode = pass ? 0 : 1;
  }
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  main().then(() => {}).catch((e) => { console.error('[research-gate] ' + (e && e.message || e)); process.exitCode = 2; });
}
