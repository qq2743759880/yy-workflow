/**
 * autopilot-registrar.mjs — L3 登记单元（确定性台账追加，无 agent）
 *
 * 用法：node scripts/autopilot-registrar.mjs --review <review.json> --ledger <batch-ledger.md>
 *        [--queue <queue.md>] [--status <taskId>=<value>]
 *
 * 输入 review.json（L2 复核者产物）schema：
 * { task, verdict: "PASS"|"FAIL"|"RED_LINE", executor, reviewer, evidence: [paths],
 *   critiques: [{id, level: "P0"|"P1"|"P2", summary, target}], timestamp }
 *
 * 行为（全部确定性，fail-closed）：
 * - 校验 review.json schema（缺字段/非法 verdict = exit 2，不猜）
 * - 追加一行到 batch-ledger.md（| task | verdict | executor | reviewer | timestamp | evidence |）
 * - P0/P1 批判追加到台账"批判提案"节（不写任何冻结件——写冻结面是登记员红线）
 * - 可选 --status：把 queue 文件里对应 task 行的状态列替换为指定值（唯一允许的就地编辑）
 * - 幂等：同 task 同 timestamp 重复登记拒绝（DUPLICATE，exit 3）
 */
import fs from 'node:fs';
import path from 'node:path';

const VERDICTS = ['PASS', 'FAIL', 'RED_LINE'];
const LEVELS = ['P0', 'P1', 'P2'];

function fail(code, msg) { console.error('[registrar] ' + msg); process.exit(code); }

// ---- 参数解析（确定性） ----
const argv = process.argv.slice(2);
function argOf(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const reviewPath = argOf('--review');
const ledgerPath = argOf('--ledger');
const queuePath = argOf('--queue');
const statusSet = argOf('--status'); // "taskId=value"

if (!reviewPath || !ledgerPath) fail(2, '缺 --review 或 --ledger（fail-closed）');
if (!fs.existsSync(reviewPath)) fail(2, 'review.json 不存在: ' + reviewPath);

// ---- schema 校验（缺字段不猜） ----
let review;
try { review = JSON.parse(fs.readFileSync(reviewPath, 'utf8')); }
catch (e) { fail(2, 'review.json 不可解析: ' + e.message); }
const required = ['task', 'verdict', 'executor', 'reviewer', 'timestamp'];
for (const k of required) {
  if (review[k] === undefined || review[k] === '') fail(2, `review 缺字段: ${k}（fail-closed）`);
}
if (!VERDICTS.includes(review.verdict)) fail(2, '非法 verdict: ' + review.verdict);
const critiques = Array.isArray(review.critiques) ? review.critiques : [];
for (const c of critiques) {
  if (!c.id || !LEVELS.includes(c.level) || !c.summary) fail(2, '批判条目缺 id/level/summary: ' + JSON.stringify(c).slice(0, 80));
}
const evidence = Array.isArray(review.evidence) ? review.evidence : [];

// ---- 幂等：同 task 同 timestamp 拒绝 ----
if (fs.existsSync(ledgerPath)) {
  const prior = fs.readFileSync(ledgerPath, 'utf8');
  const key = `| ${review.task} |`;
  const ts = review.timestamp;
  if (prior.includes(key) && prior.includes(ts)) fail(3, `DUPLICATE: ${review.task} @ ${ts} 已登记（幂等拒绝）`);
} else {
  // 首次创建台账骨架
  fs.writeFileSync(ledgerPath, [
    '# autopilot 批次台账（L3 登记员维护；append-only，不动冻结件）',
    '',
    '## 登记',
    '',
    '| task | verdict | executor | reviewer | timestamp | evidence |',
    '|---|---|---|---|---|---|',
    '',
    '## 批判提案（P0/P1；只登记不执行——执行走 L4 收口裁定）',
    '',
    '',
  ].join('\n'), 'utf8');
}

// ---- 台账追加 ----
const row = `| ${review.task} | ${review.verdict} | ${review.executor} | ${review.reviewer} | ${review.timestamp} | ${evidence.join('; ') || '—'} |`;
fs.appendFileSync(ledgerPath, row + '\n', 'utf8');

// P0/P1 批判提案追加
const serious = critiques.filter((c) => c.level !== 'P2');
if (serious.length) {
  const lines = serious.map((c) => `- [${c.level}] ${c.id}: ${c.summary}${c.target ? '（落点: ' + c.target + '）' : ''}`);
  fs.appendFileSync(ledgerPath, lines.join('\n') + '\n', 'utf8');
}

// ---- 可选：queue 状态列更新（唯一允许的就地编辑；fail-closed 行匹配） ----
if (statusSet && queuePath) {
  const [taskId, value] = statusSet.split('=');
  if (!taskId || !value) fail(2, '--status 需要 taskId=value 形式');
  let q = fs.readFileSync(queuePath, 'utf8');
  const rowRe = new RegExp('(\\|\\s*' + taskId.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '\\s*\\|[^|]*\\|[^|]*\\|)\\\\s*[^|]+(\\\\|)', 'm');
  // 队列行格式：| id | task | 白名单 | 状态 | 验收要点 | → 状态是第 4 列
  const lines = q.split('\n');
  let hit = 0;
  const updated = lines.map((l) => {
    if (!l.startsWith('| ' + taskId + ' ')) return l;
    const cells = l.split('|');
    if (cells.length < 6) return l;
    cells[4] = ' ' + value + ' ';
    hit++;
    return cells.join('|');
  });
  if (hit !== 1) fail(2, `queue 行匹配 ${hit} 次（期望 1）: ${taskId}（fail-closed）`);
  fs.writeFileSync(queuePath, updated.join('\n'), 'utf8');
}

console.log(`[registrar] OK ${review.task} verdict=${review.verdict} critiques=${serious.length} queue=${statusSet ?? 'n/a'}`);
