#!/usr/bin/env node
/**
 * TT 批判反哺 → 后续任务待优化执行项（§5.6 开工前强制拉取）。
 * 读取 plans/critique-backlog-tracker.md 中状态为「待落地/待复验/⬜/◐」的 C-xx 行
 * + 对应 docs/history/tasks/critique-<Cxx>-task.md，输出「待优化执行项清单」，
 * 供编排者派生开工 prompt（kickoff-prompt.md「批判追踪」段强制引用）与
 * 完工报告「批判承接核对」段做命中判定。
 *
 * 判定（诚实标注）：
 *   --task "<本任务关键词>" 传入时，把当前任务的关键词与该 C-xx 行的
 *   「落点任务」列/任务文档内容做重叠匹配 → 命中 = 承接项（完工报告须列完成证据）；
 *   无重叠输出 HIT_NONE（不强制，报告写"无承接项"）。不传 --task 时全量待落地清单输出。
 *
 * 用法：
 *   node scripts/critique-backlog-next.mjs                      # 待落地清单（默认 ⬜/◐/待*）
 *   node scripts/critique-backlog-next.mjs --task "login 后端"   # 输出命中判定
 *   node scripts/critique-backlog-next.mjs --task-doc <taskNN.md> # 以任务文档文本作关键词源
 *   node scripts/critique-backlog-next.mjs --all                # 全部 C-xx（含已闭环）
 *   node scripts/critique-backlog-next.mjs --top 3              # 只取前 N 条
 *
 * 任务文档缺失时如实标注（critique-<Cxx>-task.md 未生成/未同步），不伪造内容。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRACKER = path.join(ROOT, 'plans', 'critique-backlog-tracker.md');
const TASKS_DIR = path.join(ROOT, 'docs', 'history', 'tasks');

const STOP_WORDS = ['待落地', '待复验', '待补充', '修复', '落地', '完成', '验收', '下一批派单', '复验', 'M3', '待', 'Task', 'BE', 'TT', 'task', 't', 'u', 'x', 'y', 'z', 'a', 'b', 'c', '整理', '生成', '创建', '新增', '优化任务', '编排', '脚手', '概述', '后续', '用于', '实现', '以及', '需要', '可以', '通过', '进行', '一个', '方案', '每个', '相关', '所在', '所有', '独立验收', '今后所有', '今后', '先试派', '先试', '试派单', '派单', '失败', '再降级', '降级', '诚实', '记录'];
const HEADER_RE = /^\|\s*#/;
// 中文关键词：3 字窗口是「落点」这类短语的第一候选，但会在「今后所有实现都必须先试派单…」
// 这类记叙型长句上误命中。对完整落点列再叠一层行末段（「/」后收尾词，如 host/宿主）精确匹配。
const ZH_WINDOW = /[\u4e00-\u9fa5]{3,4}/g;

function zhTokens(text) {
  const t = String(text || '');
  return [...new Set((t.match(ZH_WINDOW) || []).filter((w) => !STOP_WORDS.includes(w)))];
}

// 落点列末尾收尾短语：取「/」分隔的最后一段（若以动词/名词收束），用于宿主/CLI/sdk 这类任务级精确匹配。
function tailTokens(text) {
  const s = String(text || '');
  const out = [];
  const last = s.split(/[|，,。；;]|（/).pop();
  const m = (last || '').match(/[\u4e00-\u9fa5]{2,6}$/);
  if (m) out.push(m[0]);
  return out;
}

const HEADER_COLS = {
  '#': 'serial',
  批判: 'title',
  级别: 'level',
  修复: 'fix',
  落点: 'ctx',
  验收: 'accept',
  状态: 'status',
};

/** 把 tracker 文本解析为表块：探测表头（含列名）后，后续 `|` 数据行按表头列序对齐。 */
export function parseTracker(text) {
  const blocks = [];
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  let cur = null;
  for (const raw of lines) {
    const t = raw.trim();
    if (HEADER_RE.test(t) && (t.includes('批判') || t.includes('落点'))) {
      if (cur) blocks.push(cur);
      const cells = t.split('|').map((c) => c.trim());
      const col = {};
      for (let i = 0; i < cells.length; i += 1) {
        for (const [name, key] of Object.entries(HEADER_COLS)) {
          if (cells[i] === name || (name !== '#' && name !== '状态' && cells[i].includes(name))) {
            if (!(key in col)) col[key] = i;
          } else if (cells[i].includes('状态')) col.status = i;
        }
      }
      cur = { col, rows: [] };
      continue;
    }
    if (cur && /^\|/.test(t) && !/^\|[\s:-]+\|$/.test(t)) {
      cur.rows.push(t.split('|').map((c) => c.trim()));
      continue;
    }
    if (/^#/.test(t) && !/^\|/.test(t)) { if (cur) { blocks.push(cur); cur = null; } }
  }
  if (cur) blocks.push(cur);
  const out = [];
  for (const b of blocks) {
    for (const cells of b.rows) {
      const c = (name) => cells[b.col[name]];
      const serialRaw = c('serial') ?? cells[0];
      const m = String(serialRaw || '').match(/C-(\d+)/);
      if (!m) continue;
      out.push({
        serial: 'C-' + String(parseInt(m[1], 10)).padStart(2, '0'),
        title: (c('title') ?? '').replace(/（来源：.+?）/, '').trim(),
        level: (c('level') ?? '').trim(),
        fix: (c('fix') ?? '').trim(),
        ctx: (c('ctx') ?? '').trim(),
        accept: (c('accept') ?? '').trim(),
        status: (c('status') ?? '').trim(),
        raw: '| ' + cells.join(' | ') + ' |',
      });
    }
  }
  return out;
}

const PENDING_RE = /^[⬜◐]|(?:待落地|待复验|待[\u4e00-\u9fa5]*)/;

export function isPending(row) {
  if (!row.status) return PENDING_RE.test(row.raw);
  const s = row.status;
  if (/^✅/.test(s) || /^❌/.test(s)) return false;
  if (/^[⬜◐]/.test(s)) return true;
  return PENDING_RE.test(s);
}

function tokenize(text) {
  const s = String(text || '').replace(/[|\[\]#`*_]/g, ' ');
  const seen = new Set();
  const out = [];
  for (const m of s.matchAll(/[A-Za-z][A-Za-z0-9._/+-]{1,}|[\u4e00-\u9fa5]{2,4}/g)) {
    const w = m[0];
    const key = w.toLowerCase();
    if (w.length < 2) continue;
    if (STOP_WORDS.includes(w) || STOP_WORDS.includes(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

// 落点句统一匹配：任务关键词（taskKw）与落点（ctx）做子串包含判定。
// C-12 这类记叙型落点（今后…必须先试派单…）只按实体（task/claude/codex/openclaw/sdk）
// 精确命中，避免「实现/派单/降级」等叙事动词在无实体任务上误承接。
function matchCtx(taskKw, ctxStr) {
  if (!taskKw.length) return true;
  const target = String(ctxStr || '');
  const core = target.replace(/[（）()\s]/g, '');
  if (/^(今后|待|换|修|精确版本组合|手动装)/.test(core)) {
    const entities = [...target.matchAll(/[A-Za-z][A-Za-z0-9._-]{2,}/g)].map((e) => e[0].toLowerCase());
    if (entities.length) return taskKw.some((w) => entities.includes(w.toLowerCase()));
  }
  return taskKw.some((w) => core.toLowerCase().includes(w.toLowerCase()));
}

export function loadDocs(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const m = /^critique-(C-\d+)-task\.md$/.exec(f);
    if (!m) continue;
    try {
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      const serial = m[1].replace(/^C-(\d)$/, (_, n) => 'C-' + n.padStart(2, '0'));
      out[serial.toUpperCase()] = { file: f, content };
    } catch { /* skip */ }
  }
  return out;
}

export function buildNext({ trackerPath = TRACKER, tasksDir = TASKS_DIR, onlyPending = true, top = Infinity, taskKw = [] } = {}) {
  let text = '';
  try { text = fs.readFileSync(trackerPath, 'utf8'); } catch { /* no tracker */ }
  const rows = parseTracker(text);
  const docs = loadDocs(tasksDir);
  const items = [];
  for (const r of rows) {
    if (onlyPending && !isPending(r)) continue;
    const doc = docs[r.serial];
    const ctxStr = r.ctx || r.fix || '';
    const docCtx = doc ? tokenize(doc.content).join(' ') : '';
    const hit = matchCtx(taskKw, ctxStr) || matchCtx(taskKw, docCtx) || !taskKw.length;
    items.push({
      serial: r.serial,
      level: r.level,
      status: r.status || (isPending(r) ? '⬜' : ''),
      ctx: ctxStr.replace(/\s+/g, ' ').trim() || '（无落点列）',
      file: doc ? doc.file : null,
      taskDocExists: !!doc,
      hit,
    });
  }
  return { items: items.slice(0, top), total: rows.length, pending: items.length };
}

export function renderNext(list, taskKw, taskDoc) {
  const out = [];
  out.push('待优化执行项（批判 backlog，开工前核对，§5.6）');
  out.push('---------------------------------------------');
  if (!list.items.length) {
    out.push('无待落地批判项（tracker 为空或已全部闭环）');
    out.push('');
    out.push('承接判定: NO_ITEMS（无待落地项）');
    return out.join('\n');
  }
  out.push(`tracker 共 ${list.total} 行，待落地 ${list.pending} 条` + (taskKw.length ? `；任务关键词：${taskKw.slice(0, 5).join('/')}…` : ''));
  const hits = list.items.filter((i) => i.hit);
  const misses = list.items.filter((i) => !i.hit);
  for (const it of list.items) {
    const doc = it.taskDocExists
      ? `docs/history/tasks/${it.file}`
      : '（critique-<Cxx>-task.md 缺失——未生成或未同步，先跑 review-gate --auto-register）';
    out.push(`- ${it.serial} [${it.level || '?'}] ${it.status} 命中=${it.hit ? '承接' : '未承接'}  落点=${it.ctx}  任务文档=${doc}`);
  }
  out.push('');
  if (taskKw.length) {
    if (hits.length) {
      out.push(`承接判定: HIT ${hits.map((h) => h.serial).join(',')}（完工报告「批判承接核对」段须列完成证据，未完成标 ❌ 不予 DONE）`);
    } else {
      out.push('承接判定: HIT_NONE（无落点与本任务重叠；完工报告「批判承接核对」段如实写"无承接项"即可）');
    }
  } else {
    out.push('承接判定: 未传 --task，命中判定由编排者/执行 agent 在开工 prompt 比对');
  }
  return out.join('\n');
}

function keywordsFromTaskDoc(p) {
  try { return tokenize(fs.readFileSync(path.resolve(p), 'utf8')); }
  catch { return []; }
}

export function main(args = process.argv.slice(2)) {
  let onlyPending = true;
  let top = Infinity;
  let taskKw = [];
  let taskDoc = '';
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--all') onlyPending = false;
    else if (a === '--top') { const v = parseInt(args[i + 1], 10); if (!Number.isNaN(v)) top = v; i += 1; }
    else if (a === '--task') {
      const v = args[i + 1];
      if (v && !v.startsWith('--')) {
        taskKw = tokenize(v);
        if (!taskKw.length) taskKw = ['|' + v.replace(/[|,#*]/g, ' ').trim()]; // 全停用词输入：退化为原始短语（不参与 ctx 命中）
        i += 1;
      }
    }
    else if (a === '--task-doc') {
      const v = args[i + 1];
      if (v && !v.startsWith('--')) { const full = path.resolve(v); const rp = full.startsWith(ROOT) ? path.relative(ROOT, full) : full; taskKw = keywordsFromTaskDoc(rp); taskDoc = rp; i += 1; }
    }
    else if (a === '--help' || a === '-h') { console.log('用法: node scripts/critique-backlog-next.mjs [--task "<关键词>"] [--task-doc <taskNN.md>] [--all] [--top N]'); return 0; }
  }
  const list = buildNext({ trackerPath: TRACKER, tasksDir: TASKS_DIR, onlyPending, top, taskKw });
  console.log(renderNext(list, taskKw, taskDoc));
  return 0;
}

process.exitCode = main();
