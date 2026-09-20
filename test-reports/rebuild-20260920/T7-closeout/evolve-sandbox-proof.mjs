/**
 * evolve-sandbox-proof.mjs — T7 收尾批③「--evolve 沙箱 ok:true 落盘证明」自测驱动。
 *
 * 背景（T5T6 P1-1）：`--evolve` 曾是死路径——baseline 五键空壳，候选构造不出来，跑起来必然
 * ok:false，且 dry-run 会在 B7 钩子之前 early-return（orchestrator.mjs:640-644），所以旧自测
 * 根本触达不到该路径。批③把它改为"从编排运行的实际产物构造候选 + 五键实测"，本驱动做两件事：
 *
 *   P1 正向（常见路径）**必须**产出 ok:true 并真实落盘：
 *      沙箱 workspace 内造一份最小 resume 态（1 个子任务 done + 其 receipt 链），
 *      以 `--resume --evolve` 跑**真实编排**（非 dry-run，否则到不了 B7 钩子），
 *      断言：日志出现 `[B7] --evolve: proposed ≥1/N` 且该资产为 `ok:true`，
 *      且 `.tt-state/evolution/<asset>/<cnd>/candidate/candidate.json` 与 `baseline/baseline.json`
 *      真实落盘、十项不变量齐备、baseline 五键全为实测值。
 *
 *   P2 反向（fail-closed）：抹掉 receipt 链后重跑 ⇒ 必须 `ok:false BASELINE_MISSING` 且**不落任何候选**
 *      （缺证据即拒绝，绝不编造终态）。这是"不编造"的机验，而不是口头承诺。
 *
 * 沙箱纪律：一切写入限制在本目录 `.sandbox-evolve/run-<stamp>/` 下；真实仓库根 `.tt-state/`、
 * `contracts/discrepancies/`、`plans/active/changes/` 均不被触碰（workspace 传沙箱路径，change.mjs
 * 与 evolution.mjs 的落点都以 opts.workspace 为根）。
 *
 * 运行：node test-reports/rebuild-20260920/T7-closeout/evolve-sandbox-proof.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', '..');           // yy 仓库根
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + process.pid;
// 沙箱落在 .sandbox/ 下：仓库 .gitignore 已有 `test-reports/**/.sandbox/` 通配，避免遗留未忽略目录。
const runRoot = path.join(here, '.sandbox', 'evolve', 'run-' + stamp);
// 只保留本次运行根：历史运行的结论已内嵌在 evidence/evolve/out-evolve-proof.json，物理沙箱无需堆积。
try {
  const base = path.join(here, '.sandbox', 'evolve');
  for (const e of fs.readdirSync(base)) {
    if (e.startsWith('run-') && e !== path.basename(runRoot)) fs.rmSync(path.join(base, e), { recursive: true, force: true });
  }
} catch { /* 首次运行无目录 */ }

const checks = [];
function check(name, cond, detail) { checks.push({ name, ok: Boolean(cond), detail: detail ?? '' }); }

const DONE_ASSET = 'planning';   // 已 done 的子任务资产（vendor 实际存在）
const PENDING_ASSET = 'review';  // 未完成子任务：保证 resume 不命中"全部完成"短路

/** 造一份最小 resume 态：一份 plan + 一个 done 子任务（可选 receipt 链）。 */
function makeWorkspace(dir, { withReceipt }) {
  fs.mkdirSync(path.join(dir, '.tt-state'), { recursive: true });
  const art = path.join(dir, 'artifacts', 't7-ev-01');
  fs.mkdirSync(art, { recursive: true });
  fs.writeFileSync(path.join(art, 'output.md'), [
    '# T7 --evolve 取证产物',
    '',
    '本文件是沙箱内已落地子任务的真实产物，供候选 changeset/evidenceRefs 取实测 sha256。',
  ].join('\n') + '\n');
  if (withReceipt) {
    fs.writeFileSync(path.join(art, 'receipt.json'), JSON.stringify({
      subtaskId: 't7-ev-01',
      assetId: DONE_ASSET,
      events: [
        { transition: 'discovered', session: 't7-proof', recordedAt: '2026-09-20T00:00:00.000Z' },
        { transition: 'instructions_delivered', session: 't7-proof', recordedAt: '2026-09-20T00:01:00.000Z' },
        { transition: 'execution_observed', session: 't7-proof', recordedAt: '2026-09-20T00:02:00.000Z' },
      ],
      result: 'VERIFIED',
    }, null, 2) + '\n');
  }
  const plan = {
    id: 'plan-t7evolve',
    task: 'T7 --evolve 沙箱落盘证明（自测夹具，非真实计划）',
    cluster: DONE_ASSET,
    status: 'in_progress',
    subtasks: [
      { id: 't7-ev-01', asset: DONE_ASSET, status: 'done', task: '已落地子任务（供 --evolve 取候选）', desc: '已落地子任务：为 --evolve 提供 done 源与 receipt 终态' },
      { id: 't7-ev-02', asset: PENDING_ASSET, status: 'pending', task: '未落地子任务（避免 resume 全完成短路）' },
    ],
  };
  fs.writeFileSync(path.join(dir, '.tt-state', 'state.json'), JSON.stringify(plan, null, 2) + '\n');
  return dir;
}

/** 真跑编排（非 dry-run，否则 B7 钩子不可达）。 */
function runOrchestrator(ws) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      path.join(ROOT, 'scripts', 'orchestrator.mjs'),
      '--resume', '--evolve', '--workspace', ws, '--verbose',
    ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: false, env: { ...process.env, TT_TUI: 'off' } });
    let out = '';
    child.stdout.on('data', (c) => { out += c.toString(); });
    child.stderr.on('data', (c) => { out += c.toString(); });
    child.on('error', (e) => resolve({ code: 1, out: out + '\nspawn error: ' + e.message }));
    child.on('exit', (code) => resolve({ code: code ?? 1, out }));
  });
}

/** 收集 `<root>/<asset>/<cnd>/candidate/candidate.json` 落点。 */
function findCandidates(ws) {
  const root = path.join(ws, '.tt-state', 'evolution');
  const out = [];
  const walkAsset = (asset) => {
    const assetDir = path.join(root, asset);
    if (!fs.existsSync(assetDir)) return;
    for (const cnd of fs.readdirSync(assetDir)) {
      const candFile = path.join(assetDir, cnd, 'candidate', 'candidate.json');
      const baseFile = path.join(assetDir, cnd, 'baseline', 'baseline.json');
      if (fs.existsSync(candFile)) {
        out.push({
          asset, candidateId: cnd,
          candidateFile: path.relative(ws, candFile).replace(/\\/g, '/'),
          baselineFile: fs.existsSync(baseFile) ? path.relative(ws, baseFile).replace(/\\/g, '/') : null,
          candidate: JSON.parse(fs.readFileSync(candFile, 'utf8')),
          baseline: fs.existsSync(baseFile) ? JSON.parse(fs.readFileSync(baseFile, 'utf8')) : null,
        });
      }
    }
  };
  if (fs.existsSync(root)) for (const e of fs.readdirSync(root)) {
    const p = path.join(root, e);
    if (fs.statSync(p).isDirectory()) walkAsset(e);
  }
  return out;
}

const INVARIANT_FIELDS = [
  'assetScope', 'trigger', 'rationale', 'acceptanceCriteria', 'changeset', 'riskAssessment',
  'baselineRef', 'rollbackTarget', 'evidenceRefs', 'proposerSession',
];
const BASELINE_KEYS = ['structure', 'manifest', 'receiptTerminal', 'ciSection', 'rollbackTarget'];

const logs = {};

// ───────────────────────── P1 正向：常见路径必须 ok:true 且落盘 ─────────────────────────
const wsHappy = makeWorkspace(path.join(runRoot, 'ws-happy'), { withReceipt: true });
const r1 = await runOrchestrator(wsHappy);
logs['P1-happy.stdout'] = r1.out;
const proposedLine = (r1.out.match(/^.*\[B7\] --evolve:.*$/m) ?? [])[0] ?? '';
const cands = findCandidates(wsHappy);

check('P1 编排真跑到 B7 --evolve 段（非 dry-run 短路）', /\[B7\] --evolve: proposed/.test(r1.out), proposedLine.slice(0, 300));
check('P1 日志出现 ok:true（正向路径不再必然失败）', /planning:\s*ok:true/.test(r1.out), proposedLine.slice(0, 300));
check('P1 候选真实落盘 candidate.json', cands.length >= 1 && cands.some((c) => c.asset === DONE_ASSET), JSON.stringify(cands.map((c) => c.candidateFile)));
if (cands.length) {
  const c0 = cands.find((c) => c.asset === DONE_ASSET) ?? cands[0];
  check('P1 baseline.json 一并落盘', Boolean(c0.baselineFile), c0.baselineFile ?? '(无)');
  // 落盘为包装记录（candidateId/assetId/sourceVersion/proposedBy/idempotencyKey/status/candidate/createdAt），
  // 十项不变量在 record.candidate 下——断言读嵌套体，避免"读错层级导致空数组伪通过"。
  const rec = c0.candidate;
  const inv = rec.candidate && typeof rec.candidate === 'object' ? rec.candidate : rec;
  check('P1 落盘记录为 R10 包装形状（含 candidateId/status/candidate 体）',
    Boolean(rec.candidateId) && Boolean(rec.status) && Boolean(inv && inv.trigger),
    'keys=' + Object.keys(rec).join(','));
  const missingInv = INVARIANT_FIELDS.filter((k) => inv[k] === undefined || inv[k] === null || inv[k] === '');
  check('P1 十项不变量齐备（无缺失）', missingInv.length === 0, missingInv.join(','));
  check('P1 状态为 CANDIDATE（未越权升格）', rec.status === 'CANDIDATE', String(rec.status));
  check('P1 candidateId 命名合规（cnd-…）', /^cnd-/.test(c0.candidateId), c0.candidateId);
  const bl = c0.baseline ?? {};
  const missingBl = BASELINE_KEYS.filter((k) => bl[k] === undefined || bl[k] === null);
  check('P1 baseline 五键齐备', missingBl.length === 0, missingBl.join(','));
  check('P1 baseline.structure 为实测退出码', bl.structure && bl.structure.exitCode === 0 && bl.structure.validator === 'validate-structure.mjs', JSON.stringify(bl.structure ?? null));
  check('P1 baseline.manifest 为实测条目数', Boolean(bl.manifest) && Number.isInteger(bl.manifest.entries), JSON.stringify(bl.manifest ?? null));
  check('P1 baseline.receiptTerminal 为实测 receipt 终态（非 [待补充]）',
    Boolean(bl.receiptTerminal) && typeof bl.receiptTerminal === 'object' && bl.receiptTerminal.terminals?.['t7-ev-01']?.terminal === 'execution_observed',
    JSON.stringify(bl.receiptTerminal ?? null));
  check('P1 baseline.ciSection 为实测 CI 段（S1/S2 退出码 + S5 进程内）',
    Boolean(bl.ciSection) && Array.isArray(bl.ciSection.sections) && bl.ciSection.sections.length === 3,
    JSON.stringify(bl.ciSection ?? null));
  check('P1 baseline.rollbackTarget 为实测 .git HEAD（只读解析）',
    Boolean(bl.rollbackTarget) && /^[0-9a-f]{40}$/.test(String(bl.rollbackTarget.sha ?? '')),
    JSON.stringify(bl.rollbackTarget ?? null));
  check('P1 changeset 为实测产物清单（非空、全为沙箱相对路径）',
    Array.isArray(inv.changeset) && inv.changeset.length >= 3 && inv.changeset.every((x) => !path.isAbsolute(String(x))),
    JSON.stringify(inv.changeset ?? null));
  check('P1 evidenceRefs 为实测引用（非空、sha256 齐全、无仓库绝对路径泄漏）',
    Array.isArray(inv.evidenceRefs) && inv.evidenceRefs.length >= 3
    && inv.evidenceRefs.filter((x) => /#/.test(x)).length >= 2
    && inv.evidenceRefs.every((x) => !path.isAbsolute(String(x))),
    JSON.stringify(inv.evidenceRefs ?? null));
}

// ───────────────────── P2 反向：抹掉 receipt 链 ⇒ fail-closed 不落盘 ─────────────────────
const wsNoReceipt = makeWorkspace(path.join(runRoot, 'ws-noreceipt'), { withReceipt: false });
const r2 = await runOrchestrator(wsNoReceipt);
logs['P2-fail-closed.stdout'] = r2.out;
const line2 = (r2.out.match(/^.*\[B7\] --evolve:.*$/m) ?? [])[0] ?? '';
const cands2 = findCandidates(wsNoReceipt);

check('P2 缺 receipt 链 ⇒ 该候选如实 ok:false', /planning:\s*ok:false BASELINE_MISSING/.test(r2.out), line2.slice(0, 400));
check('P2 reason 指名缺什么（指名 receiptTerminal，不泛泛而谈）', /receiptTerminal/.test(line2), line2.slice(0, 400));
check('P2 fail-closed：一个候选都不落盘', cands2.length === 0, JSON.stringify(cands2.map((c) => c.candidateFile)));

// ───────────────────────────── 汇总与取证落盘 ─────────────────────────────
const failed = checks.filter((c) => !c.ok);
const pass = checks.length - failed.length;
console.log('=== T7 ③ --evolve 沙箱落盘证明 ===');
for (const c of checks) console.log(`  [${c.ok ? 'PASS' : 'FAIL'}] ${c.name}${c.detail ? ' | ' + String(c.detail).slice(0, 240) : ''}`);
console.log(`TOTAL: ${pass}/${checks.length} PASS`);
console.log(`EXIT=${failed.length === 0 ? 0 : 1}`);
console.log('沙箱: ' + path.relative(ROOT, runRoot).replace(/\\/g, '/'));

const evidenceDir = path.join(here, 'evidence', 'evolve');
fs.mkdirSync(evidenceDir, { recursive: true });
for (const [name, text] of Object.entries(logs)) fs.writeFileSync(path.join(evidenceDir, name + '.log'), text);
fs.writeFileSync(path.join(evidenceDir, 'out-evolve-proof.json'), JSON.stringify({
  ranAt: new Date().toISOString(),
  sandbox: path.relative(ROOT, runRoot).replace(/\\/g, '/'),
  proposedLineP1: proposedLine,
  proposedLineP2: line2,
  candidatesP1: cands.map((c) => ({ asset: c.asset, candidateId: c.candidateId, candidateFile: c.candidateFile, baselineFile: c.baselineFile })),
  candidatesP2: cands2.map((c) => ({ asset: c.asset, candidateId: c.candidateId, candidateFile: c.candidateFile })),
  candidateP1: cands.find((c) => c.asset === DONE_ASSET)?.candidate ?? null,
  baselineP1: cands.find((c) => c.asset === DONE_ASSET)?.baseline ?? null,
  checks, pass, total: checks.length, allPass: failed.length === 0,
}, null, 2) + '\n');
process.exit(failed.length === 0 ? 0 : 1);
