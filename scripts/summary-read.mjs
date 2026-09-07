#!/usr/bin/env node
/**
 * TT 机器可读 state 摘要读取器（IMP-1）。
 * orchestrator 收尾自动生成 artifacts/<planId>/state-summary.json（schema tt/state-summary@1），
 * 新会话用本脚本「程序化拉取断点」（完成/阻塞/契约/批判 backlog），不靠人粘贴 memory-snapshot.md。
 *
 * 用法：
 *   node scripts/summary-read.mjs --workspace <dir>          列出该 workspace 所有摘要（按时间倒序）
 *   node scripts/summary-read.mjs --workspace <dir> --latest 打印最新一个摘要全文（JSON，供恢复断点）
 *   node scripts/summary-read.mjs --workspace <dir> --all    合并全部摘要为精简清单（JSON 数组）
 *
 * 零外部依赖（node: 内建）。critiqueBacklog 缺省/为 null 时尝试从本机 plans/critique-backlog-tracker.md
 * 补算；读不到 tracker（如 workspace ≠ SKILL_DIR 且本机 tracker 缺失）→ 保持 null + note，不报错。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');

// 批判 backlog tracker 解析（critique-backlog-next.mjs 同源语义：列对齐 + 待落地判定），内联避免 import 顶层副作用。
const BL_COLS = { '#': 'serial', '批判': 'title', '级别': 'level', '修复': 'fix', '落点': 'ctx', '验收': 'accept', '状态': 'status' };
const BL_PENDING_RE = /^[⬜◐]|(?:待落地|待复验|待[\u4e00-\u9fa5]*)/;
function parseBacklogRows(text) {
  const blocks = [];
  let block = null;
  const flush = function() { if (block) { blocks.push(block); block = null; } };
  for (const raw of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const t = raw.trim();
    if (/^\|\s*#/.test(t) && (t.includes('批判') || t.includes('落点'))) {
      flush();
      const cells = t.split('|').map(function(c) { return c.trim(); });
      const col = {};
      for (let i = 0; i < cells.length; i += 1) {
        for (const [name, key] of Object.entries(BL_COLS)) {
          if (cells[i] === name || (name !== '#' && name !== '状态' && cells[i].includes(name))) { if (!(key in col)) col[key] = i; }
          else if (cells[i].includes('状态')) col.status = i;
        }
      }
      block = { col, rows: [] };
      continue;
    }
    if (block && /^\|/.test(t) && !/^\|[\s:-]+\|$/.test(t)) {
      const cells = t.split('|').map(function(c) { return c.trim(); });
      const get = function(k) { return cells[block.col[k]]; };
      const serialRaw = get('serial') ?? cells[0];
      const m = String(serialRaw || '').match(/C-(\d+)/);
      if (m) block.rows.push({
        serial: 'C-' + String(parseInt(m[1], 10)).padStart(2, '0'),
        title: (get('title') ?? '').replace(/（来源：.+?）/, '').trim(),
        fix: (get('fix') ?? '').trim(),
        status: (get('status') ?? '').trim(),
        raw: t,
      });
      continue;
    }
    if (/^#/.test(t) && !/^\|/.test(t)) flush();
  }
  flush();
  const out = [];
  for (const b of blocks) out.push(...b.rows);
  return out;
}
function backlogIsPending(r) {
  if (!r.status) return BL_PENDING_RE.test(r.raw);
  if (/^✅/.test(r.status) || /^❌/.test(r.status)) return false;
  if (/^[⬜◐]/.test(r.status)) return true;
  return BL_PENDING_RE.test(r.status);
}
function readCritiqueBacklog() {
  try {
    const text = fs.readFileSync(path.join(SKILL_DIR, 'plans', 'critique-backlog-tracker.md'), 'utf8');
    const pending = parseBacklogRows(text).filter(backlogIsPending);
    return { open: pending.length, nextItems: pending.map(function(r) { return r.serial + ' ' + String(r.fix || r.title || '').replace(/\s+/g, ' ').trim(); }) };
  } catch (error) { return null; }
}
/** 摘要自包含优先；critiqueBacklog 为 null 时才尝试用本机 tracker 补算（workspace ≠ SKILL_DIR 且读不到 → 保持 null + note）。 */
function ensureBacklog(data) {
  if (data && (data.critiqueBacklog === null || typeof data.critiqueBacklog === 'undefined')) {
    const b = readCritiqueBacklog();
    if (b) { data.critiqueBacklog = b; delete data.critiqueBacklogNote; }
    else if (!data.critiqueBacklogNote) data.critiqueBacklogNote = 'critique backlog tracker 不可读（plans/critique-backlog-tracker.md 缺失），critiqueBacklog 置 null';
  }
  return data;
}
function parseArgs(args) {
  const out = { workspace: '.', latest: false, all: false, help: false };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--workspace') { const v = args[i + 1]; if (v !== undefined && !v.startsWith('--')) { out.workspace = v; i += 1; } else out.help = true; }
    else if (a === '--latest') out.latest = true;
    else if (a === '--all') out.all = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}
/** 扫描 workspace/artifacts/<planId>/state-summary.json，按 mtime 倒序。解析失败跳过（stderr 提示，不中断）。 */
function collectSummaries(workspace) {
  const out = [];
  const artifacts = path.join(workspace, 'artifacts');
  let entries;
  try { entries = fs.readdirSync(artifacts, { withFileTypes: true }); } catch (error) { return out; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const file = path.join(artifacts, e.name, 'state-summary.json');
    let text = null;
    try { text = fs.readFileSync(file, 'utf8'); } catch (error) { continue; }
    let data = null;
    try { data = JSON.parse(text); } catch (error) { process.stderr.write('WARN 摘要解析失败（跳过）: ' + file + '\n'); continue; }
    out.push({ file, rel: path.relative(workspace, file).split(path.sep).join('/'), mtimeMs: fs.statSync(file).mtimeMs, data });
  }
  out.sort(function(a, b) { return b.mtimeMs - a.mtimeMs; });
  return out;
}
function blockOf(data) {
  const blocked = Array.isArray(data.summary && data.summary.blockedSubtasks) ? data.summary.blockedSubtasks : [];
  return blocked.length ? blocked.join(',') : '无';
}
function listRow(it) {
  const d = it.data;
  const sm = d.summary || {};
  return [
    d.planId || '?',
    '|', d.task || '?',
    '|', d.status || '?', d.degraded === true ? '(degraded)' : '',
    '|', sm.assetCallRate || '?',
    '|', 'blocked:', blockOf(d),
    '|', it.rel,
  ].filter(function(s) { return s !== ''; }).join(' ');
}
function latestOf(its) {
  return its.length ? its[0] : null;
}
function usage() {
  console.log('用法: node scripts/summary-read.mjs --workspace <dir> [--latest|--all]');
  console.log('  --workspace <dir>  产物目录（含 artifacts/<planId>/state-summary.json）');
  console.log('  --latest           打印最新一个摘要全文（JSON，供新会话恢复断点）');
  console.log('  --all              合并所有摘要为精简清单（JSON 数组）');
  console.log('  默认: 列出该 workspace 所有摘要（按时间倒序），一行一项');
}
export function main(args = process.argv.slice(2)) {
  const opts = parseArgs(args);
  if (opts.help) { usage(); return 0; }
  const workspace = path.resolve(opts.workspace);
  const its = collectSummaries(workspace);
  if (opts.latest) {
    const l = latestOf(its);
    if (!l) { process.stderr.write('无 state-summary.json（workspace=' + workspace + '）——先跑 orchestrator 执行后再读断点\n'); return 1; }
    console.log(JSON.stringify(ensureBacklog(l.data), null, 2));
    return 0;
  }
  if (opts.all) {
    const merged = its.map(function(it) {
      const d = ensureBacklog(it.data);
      const sm = d.summary || {};
      return {
        planId: d.planId,
        task: d.task,
        cluster: d.cluster,
        status: d.status,
        degraded: d.degraded === true,
        generatedAt: d.generatedAt,
        modes: d.modes || {},
        total: sm.total,
        done: sm.done,
        failed: sm.failed,
        skipped: sm.skipped,
        assetConsumed: sm.assetConsumed,
        assetCallRate: sm.assetCallRate,
        requireExecViolation: sm.requireExecViolation,
        depPrecondition: sm.depPrecondition,
        blockedSubtasks: sm.blockedSubtasks || [],
        contractFrozen: sm.contractFrozen,
        recovery: sm.recovery || [],
        critiqueBacklogOpen: d.critiqueBacklog ? d.critiqueBacklog.open : null,
      };
    });
    console.log(JSON.stringify(merged, null, 2));
    return 0;
  }
  if (!its.length) {
    console.log('无 state-summary.json（workspace=' + workspace + '）');
    return 0;
  }
  console.log('state-summary 清单（时间倒序，共 ' + its.length + ' 个）：');
  for (const it of its) console.log(listRow(it));
  return 0;
}
process.exitCode = main();