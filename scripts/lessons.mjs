#!/usr/bin/env node
/**
 * LS-1：工作区级 lessons.md（批判反哺的落盘格式，不是新记忆层）。
 *
 * Schema（强制条目格式，管道分隔 6 段）：
 *   L-<n> | 日期 | 来源批判条目 id | 条件（何时适用） | 教训 | 验证状态
 * 位置：<workspace>/.tt-state/lessons.md；--session <sid> 时为 <workspace>/.tt-state/<sid>/lessons.md
 * （与 journey.json 同一套 session 隔离语义：a 会话写的条目不出现在 b 会话的 --list）。
 *
 * 写入纪律（生死线，fail-closed）：
 *   --append 必须校验 --source 指向的批判条目在 plans/critique-backlog-tracker.md 中
 *   存在且 status 为 accepted/converted，否则拒绝写入（exit 1，stderr detail 指名
 *   「无有效批判来源」）。状态判定口径：
 *   - 历史 C-xx 行（| C-<n> | … | 状态 |）：✅ = 已闭环等价 accepted（批判 gate 通过）；
 *     ⬜/◐/❌/待…/空 = 未过 gate，拒绝（❌ 具名 rejected，其余具名 未 accepted/converted）。
 *   - 「批判协议 v2」看板行（CR-1 字段：claim|evidence|source|severity|status|…）：
 *     以 claim 单元格内的 [<id>] 标记寻址，status 列 ∈ {accepted, converted, done} 放行，
 *     registered/rejected 拒绝。done 与 converted 同义（已转化落地）。
 *   - tracker 文件缺失 / id 不存在 / 伪造 id → 一律拒绝，具名 detail。
 *
 * 生命周期：journey init 时由编排流程调 --init 创建空文件（幂等，不覆盖已有内容）；
 * 归档随 journey 终态（本脚本不删不改既有条目，只追加）。
 *
 * CLI（全部要求 --workspace）：
 *   node scripts/lessons.mjs --workspace <ws> --init [--session <sid>]
 *   node scripts/lessons.mjs --workspace <ws> --append --source <批判id>
 *         --condition <何时适用> --lesson <教训> [--verify verified|unverified] [--session <sid>]
 *   node scripts/lessons.mjs --workspace <ws> --list [--session <sid>]
 *   node scripts/lessons.mjs --workspace <ws> --count [--session <sid>]
 *     （--count 输出两行机读：total=<n> / verified=<n>）
 *
 * 消费点：tt-journey --prereq-check 经 countLessons() 输出「本工作区有 N 条已验证教训」
 * 提示行（只提示不注入正文，防 prompt 膨胀）。
 */
import path from 'node:path';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const LESSONS_HEADER = [
  '# workspace lessons（工作区级教训：批判反哺落盘）',
  '> 条目格式（强制）：L-<n> | 日期 | 来源批判条目 id | 条件（何时适用） | 教训 | 验证状态',
  '> 写入纪律：仅批判 gate PASS（accepted/converted）条目可落盘；来源由 scripts/lessons.mjs 机验（fail-closed），手写行不承诺被消费方信任。',
  '',
].join('\n');

export function lessonsPath(workspace, sessionId) {
  const base = sessionId ? path.join(workspace, '.tt-state', sessionId) : path.join(workspace, '.tt-state');
  return path.join(base, 'lessons.md');
}

/** 读 lessons.md 并解析条目（只认 L-<n> | 开头的数据行）。文件缺失返回 []。 */
export async function readLessons(workspace, sessionId) {
  let text;
  try {
    text = await fs.readFile(lessonsPath(workspace, sessionId), 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const raw of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!/^L-\d+\s*\|/.test(line)) continue;
    const cells = line.split('|').map(function (c) { return c.trim(); });
    if (cells.length < 6) continue;
    out.push({
      id: cells[0],
      date: cells[1],
      source: cells[2],
      condition: cells[3],
      lesson: cells[4],
      verify: cells[5],
      raw: line,
    });
  }
  return out;
}

/** 消费点口径：total / verified（验证状态 = verified）计数。文件缺失 = 0/0。 */
export async function countLessons(workspace, sessionId) {
  const entries = await readLessons(workspace, sessionId);
  return {
    total: entries.length,
    verified: entries.filter(function (e) { return e.verify === 'verified'; }).length,
  };
}

/** 判定历史 C-xx 行状态：✅ 放行；❌ 具名 rejected；其余（⬜/◐/待…/空）具名未过 gate。 */
function legacyStatusVerdict(statusCell) {
  const s = String(statusCell || '').trim();
  if (/^✅/.test(s)) return { ok: true, status: 'accepted(✅已闭环)' };
  if (/^❌/.test(s)) return { ok: false, detail: '批判条目状态为 rejected/❌，未过批判 gate' };
  return { ok: false, detail: '批判条目状态为「' + (s || '空') + '」，非 accepted/converted' };
}

/** 在 tracker 文本中寻址来源批判条目。返回 { ok, status } 或 { ok:false, detail }。
 *  口径见文件头「写入纪律」——伪造 id / 无来源 / 状态不符一律拒绝（fail-closed）。 */
export function findCritiqueEntry(trackerText, sourceId) {
  const id = String(sourceId || '').trim();
  if (!id) return { ok: false, detail: '未提供来源批判条目 id（--source）' };
  const text = String(trackerText || '').replace(/\r\n/g, '\n');

  // ① 历史 C-xx 行：首单元格匹配 C-<n>，末单元格为状态。
  const norm = function (s) { return 'C-' + String(parseInt(s, 10)); };
  const want = /^C-(\d+)$/i.test(id) ? norm(id.match(/^C-(\d+)$/i)[1]) : null;
  if (want) {
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line.startsWith('|')) continue;
      const cells = line.split('|').map(function (c) { return c.trim(); });
      if (cells[cells.length - 1] === '') cells.pop(); // 行尾「|」产生的空尾格
      if (cells[0] === '') cells.shift();
      const m = String(cells[0] || '').match(/^C-(\d+)$/) || String(cells[1] || '').match(/^C-(\d+)$/);
      if (!m || norm(m[1]) !== want) continue;
      const v = legacyStatusVerdict(cells[cells.length - 1]);
      return v.ok ? { ok: true, status: v.status } : { ok: false, detail: '来源批判条目 ' + want + ' ' + v.detail };
    }
    return { ok: false, detail: '批判条目 ' + want + ' 在 tracker 中不存在（伪造 id / 无来源）' };
  }

  // ② v2 看板行（「批判协议 v2」节）：claim 内 [<id>] 寻址，status 列直读。
  const secIdx = text.indexOf('批判协议 v2');
  if (secIdx !== -1) {
    const rows = text.slice(secIdx).split('\n').map(function (l) { return l.trim(); })
      .filter(function (l) { return l.startsWith('|') && !/^\|[\s:|-]+\|$/.test(l) && !l.includes('claim'); });
    for (const row of rows) {
      const cells = row.split('|').map(function (c) { return c.trim(); }).slice(1, -1);
      if (cells.length < 5) continue;
      if (!new RegExp('\\[' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\]').test(cells[0])) continue;
      const st = (cells[4] || '').toLowerCase();
      if (['accepted', 'converted', 'done'].includes(st)) return { ok: true, status: st };
      return { ok: false, detail: 'v2 看板条目 [' + id + '] 状态为「' + (st || '空') + '」，非 accepted/converted' };
    }
  }
  return { ok: false, detail: '批判条目 ' + id + ' 在 tracker 中不存在（伪造 id / 无来源）' };
}

async function ensureLessonsFile(workspace, sessionId) {
  const file = lessonsPath(workspace, sessionId);
  try {
    await fs.access(file);
  } catch {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, LESSONS_HEADER, 'utf8');
  }
  return file;
}

async function appendLesson(opts) {
  for (const k of ['workspace', 'source', 'condition', 'lesson']) {
    if (!opts[k]) { console.error('--append 需要 --workspace、--source、--condition、--lesson'); process.exitCode = 2; return; }
  }
  const verify = opts.verify || 'unverified';
  if (!['verified', 'unverified'].includes(verify)) { console.error('--verify 仅接受 verified|unverified'); process.exitCode = 2; return; }

  // 生死线：来源批判条目机验（fail-closed）。tracker 缺失 = 无有效批判来源。
  let trackerText = null;
  try {
    trackerText = await fs.readFile(path.join(opts.workspace, 'plans', 'critique-backlog-tracker.md'), 'utf8');
  } catch { /* 保持 null */ }
  if (!trackerText) {
    console.error('REFUSED: 无有效批判来源——plans/critique-backlog-tracker.md 缺失或不可读，拒绝落盘');
    process.exitCode = 1;
    return;
  }
  const v = findCritiqueEntry(trackerText, opts.source);
  if (!v.ok) {
    console.error('REFUSED: 无有效批判来源——' + v.detail + '，拒绝落盘');
    process.exitCode = 1;
    return;
  }

  const file = await ensureLessonsFile(opts.workspace, opts.session);
  const entries = await readLessons(opts.workspace, opts.session);
  let maxN = 0;
  for (const e of entries) { const m = e.id.match(/^L-(\d+)$/); if (m) maxN = Math.max(maxN, parseInt(m[1], 10)); }
  const nextId = 'L-' + (maxN + 1);
  const date = new Date().toISOString().slice(0, 10);
  const line = nextId + ' | ' + date + ' | ' + opts.source + ' | ' + opts.condition + ' | ' + opts.lesson + ' | ' + verify;
  await fs.appendFile(file, line + '\n', 'utf8');
  console.log('APPEND OK: ' + nextId + '（来源 ' + opts.source + ' status=' + v.status + '）→ ' + file);
  process.exitCode = 0;
}

function arg(argv, name) {
  const i = argv.indexOf('--' + name);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : undefined;
}
function has(argv, name) { return argv.includes('--' + name); }

export async function main(argv) {
  const ws = arg(argv, 'workspace');
  if (!ws) { console.error('lessons.mjs 需要 --workspace <路径>'); process.exitCode = 2; return; }
  const sid = arg(argv, 'session');

  if (has(argv, 'init')) {
    const file = await ensureLessonsFile(ws, sid);
    console.log('INIT OK: ' + file);
    process.exitCode = 0;
    return;
  }
  if (has(argv, 'append')) {
    await appendLesson({
      workspace: ws, session: sid,
      source: arg(argv, 'source'), condition: arg(argv, 'condition'),
      lesson: arg(argv, 'lesson'), verify: arg(argv, 'verify'),
    });
    return;
  }
  if (has(argv, 'list')) {
    const entries = await readLessons(ws, sid);
    if (entries.length === 0) { console.log('（无 lessons 条目：' + lessonsPath(ws, sid) + '）'); }
    for (const e of entries) console.log(e.raw);
    process.exitCode = 0;
    return;
  }
  if (has(argv, 'count')) {
    const c = await countLessons(ws, sid);
    console.log('total=' + c.total);
    console.log('verified=' + c.verified);
    process.exitCode = 0;
    return;
  }
  console.error('用法：node scripts/lessons.mjs --workspace <ws> --init|--append|--list|--count [--session <sid>]（append 另需 --source/--condition/--lesson）');
  process.exitCode = 2;
}

/* realpath 归一的主模块判定（同 tt-journey.mjs：junction/大小写/短名安装形态下直等比较会静默跳过 main）。 */
function isMainFileMatch() {
  try {
    const self = fsSync.realpathSync(fileURLToPath(import.meta.url));
    let entry = process.argv[1];
    if (!entry) return false;
    try { entry = fsSync.realpathSync(path.resolve(entry)); } catch { entry = path.resolve(entry); }
    return self === entry;
  } catch { return false; }
}
if (isMainFileMatch()) {
  main(process.argv.slice(2)).catch(function (e) { console.error('[lessons] ' + e.message); process.exitCode = 2; });
}
