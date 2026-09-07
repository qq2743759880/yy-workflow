#!/usr/bin/env node
/**
 * contract-discrepancy — 棕地契约变更单上浮（B3）。
 * 前端实现时发现契约与期望接口不匹配（路径/字段缺失或不符）→ 生成
 * handoffs/contract-change-<planId>.md 变更单，供后端确认后更新契约，
 * 再重跑 contract-change-detect 验证。只读契约文件，不修改。
 *
 * 用法:
 *   node scripts/contract-discrepancy.mjs --contract <契约文件(openapi 或 draft.json)>
 *       --reported <前端发现的接口问题.md 或 .json> [--plan <planId>] [--out handoffs/]
 *   --reported 格式（md 每行一条）:
 *       期望接口: GET /api/users
 *       期望字段: /api/login → { token, expiresIn }   （或 json: [{method,path,missing?}...]）
 * 退出码: 0 = 已生成变更单（无论有无差异，都产出记录）；2 = 参数/文件错误
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(args) {
  const out = { contract: null, reported: null, plan: 'unknown', outDir: path.join(ROOT, 'handoffs'), help: false, argError: null };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--contract') { out.contract = args[i + 1]; i += 1; }
    else if (a === '--reported') { out.reported = args[i + 1]; i += 1; }
    else if (a === '--plan') { out.plan = args[i + 1]; i += 1; }
    else if (a === '--out') { out.outDir = args[i + 1]; i += 1; }
    else if (a === '--help' || a === '-h') out.help = true;
  }
  if (!out.contract || !out.reported) out.argError = '--contract 与 --reported 必填';
  return out;
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

/** 解析 reported：md 行（期望接口:/期望字段:）或 JSON 数组 [{method,path,note}]. */
function parseReported(text) {
  const t = String(text || '').trim();
  if (t.startsWith('[')) {
    try { return { ok: true, items: JSON.parse(t) }; } catch (e) { return { ok: false, error: 'reported JSON 解析失败: ' + e.message }; }
  }
  if (t.startsWith('{')) {
    try {
      const o = JSON.parse(t);
      const items = Array.isArray(o.items) ? o.items : [];
      return { ok: true, items };
    } catch (e) { return { ok: false, error: 'reported JSON 解析失败: ' + e.message }; }
  }
  // md 行式
  const items = [];
  for (const ln of t.split('\n')) {
    const line = ln.trim();
    let m = line.match(/^期望接口[:：]\s*(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|ALL)\s+(\/\S+)/i);
    if (m) { items.push({ method: m[1].toUpperCase(), path: m[2], note: 'frontend 期望此接口' }); continue; }
    m = line.match(/^期望字段[:：]\s*(\S+)\s*→\s*(.+)/);
    if (m) { items.push({ path: m[1], fieldNote: m[2], note: 'frontend 期望字段变更' }); }
  }
  return { ok: true, items };
}

function contractPaths(doc) {
  const out = new Map(); // key: METHOD /path
  if (!doc || !doc.paths) return out;
  for (const [p, ops] of Object.entries(doc.paths)) {
    for (const [method, op] of Object.entries(ops)) {
      if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
        out.set(method.toUpperCase() + ' ' + p, { method: method.toUpperCase(), path: p, op: op || {} });
      }
    }
  }
  return out;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log('usage: node scripts/contract-discrepancy.mjs --contract <file> --reported <md|json> [--plan id] [--out handoffs/]'); return 0; }
  if (opts.argError) { console.error('[contract-discrepancy] ' + opts.argError); return 2; }
  if (!fs.existsSync(opts.contract)) { console.error('[contract-discrepancy] 契约文件不存在: ' + opts.contract); return 2; }
  if (!fs.existsSync(opts.reported)) { console.error('[contract-discrepancy] reported 文件不存在: ' + opts.reported); return 2; }

  const doc = readJson(opts.contract);
  if (!doc) { console.error('[contract-discrepancy] 契约非 JSON: ' + opts.contract); return 2; }
  const known = contractPaths(doc);
  const reported = parseReported(fs.readFileSync(opts.reported, 'utf8'));
  if (!reported.ok) { console.error('[contract-discrepancy] ' + reported.error); return 2; }

  const diffs = [];
  for (const item of reported.items || []) {
    if (!item || (!item.method && !item.path)) continue;
    if (item.fieldNote) {
      // 字段级：仅记录（不深比字段，标待后端确认）
      diffs.push({ type: 'field', path: item.path, expected: item.fieldNote, detail: '前端期望字段，契约待后端确认' });
      continue;
    }
    const key = String(item.method || 'ALL').toUpperCase() + ' ' + item.path;
    if (!known.has(key)) {
      diffs.push({ type: 'missing', method: (item.method || 'ALL').toUpperCase(), path: item.path, detail: '契约中不存在此接口（前端引用，后端未提供或路径不符）' });
    } else {
      diffs.push({ type: 'ok', method: (item.method || 'ALL').toUpperCase(), path: item.path, detail: '契约已存在（一致）' });
    }
  }

  const real = diffs.filter((d) => d.type !== 'ok');
  const outDir = path.resolve(opts.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'contract-change-' + opts.plan + '.md');
  const md = [
    '# 契约变更单 · ' + opts.plan, '',
    '- 生成: ' + new Date().toISOString(),
    '- 契约: ' + opts.contract + (doc.draft ? '（棕地草案 draft:true，待后端确认）' : '（已冻结）'),
    '- 前端 reported: ' + opts.reported, '',
    '## 差异清单（' + real.length + ' 条不匹配 / ' + diffs.length + ' 条总计）', '',
    '| 类型 | 接口 | 说明 |', '|---|---|---|',
  ];
  for (const d of diffs) md.push('| ' + d.type + ' | ' + (d.method ? d.method + ' ' : '') + (d.path || '-') + ' | ' + d.detail + ' |');
  md.push('', '## 处置建议', '- 后端确认期望接口是否成立 → 更新契约（OpenAPI 或 draft）', '- 更新后重跑 `contract-change-detect.mjs` 验证一致性', '- 若已确认接口变更，前端按新契约重适配并标注 ADAPTED');
  fs.writeFileSync(file, md.join('\n'), 'utf8');
  console.log('[contract-discrepancy] 差异 ' + real.length + ' 条 / 一致 ' + (diffs.length - real.length) + ' 条');
  for (const d of diffs) console.log('  [' + d.type + '] ' + (d.method ? d.method + ' ' : '') + (d.path || '-') + ' — ' + d.detail);
  console.log('[contract-discrepancy] 变更单: ' + file);
  return 0;
}

process.exitCode = main();