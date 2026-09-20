#!/usr/bin/env node
/**
 * asset-io-transcript.mjs — P1 IO 口径调用率审计：agent 侧采集（P1-B）。
 *
 * 背景：agent 的 Read 工具跑在宿主进程，Node fs hook 抓不到（施工方案 P1 遗留 #1）。
 * 本工具改从会话转录里挖"读取动作"，补 agent 侧的消费证据。
 *
 * 来源（任选其一或组合）：
 *   --zcode-db <path>      ZCode SQLite db（用 node:sqlite 读 part 表；零 npm 依赖）
 *   --codex-sessions <dir> Codex sessions 目录（扫其中 *.jsonl）
 *   --transcript <file>    单个 NDJSON 转录文件（自测 fixture 走这里）
 *
 * 只统计"读取动作目标在 <repo>/vendor/ 下"的记录；排除 manifest 扫描：
 *   - shell 列目录命令（ls/dir/gci/tree/find 等）扫 vendor/ → 不算读取
 *   - 一个 tool_result/output 正文里同时罗列 >=4 个 vendor 资产目录 → 是清单枚举，不算消费读
 * 输出与 hook 同构 JSONL：{ ts, pid, cwd, op, path, tag }（pid=0 表示历史转录、tag=consumption）。
 *
 * 零 npm 依赖；ESM；中文注释；fail-closed（来源不可读/无 part 表即报错退出，不猜列名）。
 *
 * 用法：node scripts/asset-io-transcript.mjs (--transcript f.jsonl | --codex-sessions dir | --zcode-db db)
 *        [--repo <仓库根>] [--out <输出 jsonl，缺省 stdout>]
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ASSET_WHITELIST } from './lib/evolution.mjs';

const require = createRequire(import.meta.url);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const VENDOR_SEG = '/vendor/';
const ASSET_SET = new Set(ASSET_WHITELIST);

// ---------------------------------------------------------------------------
// 路径工具
// ---------------------------------------------------------------------------

/** 把转录里的路径字符串解析成仓库内绝对路径；$SKILL_DIR 占位替换为仓库根。 */
export function resolveTarget(rawPath, repoRoot) {
  let p = String(rawPath || '').trim();
  if (!p) return null;
  p = p.replace(/\$SKILL_DIR/g, repoRoot);
  p = p.replace(/^~(?=[\\/])/, os.homedir());
  if (!path.isAbsolute(p)) p = path.join(repoRoot, p);
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

/** 是否位于 <repo>/vendor/ 下。 */
function isUnderVendor(normAbs, repoRoot) {
  const v = path.join(repoRoot, 'vendor').replace(/\\/g, '/').toLowerCase();
  return normAbs === v || normAbs.startsWith(v + '/');
}

/** 从规范化绝对路径取 vendor 下第一段（资产 id）。 */
function assetOf(normAbs) {
  const idx = normAbs.indexOf(VENDOR_SEG);
  if (idx === -1) return null;
  const after = normAbs.slice(idx + VENDOR_SEG.length);
  return after.split('/')[0] || null;
}

// ---------------------------------------------------------------------------
// shell 命令解析
// ---------------------------------------------------------------------------

/** 列目录/枚举动词（manifest 扫描，排除）。 */
const LISTING_RE = /^\s*(ls|dir|gci|tree|find|get-childitem)\b/i;
/** 读取内容动词。 */
const READ_VERB_RE = /^\s*(cat|type|Get-Content|head|tail|less|more|sed|awk|grep|rg|Select-String)\b/i;

/**
 * 从 shell 命令串里提取被读取的目标路径。返回路径数组（可能空）。
 * 列目录命令一律返回 []（manifest 扫描，排除）。
 */
export function extractShellReadPaths(command, repoRoot) {
  const cmd = String(command || '');
  if (!cmd.trim()) return [];
  if (LISTING_RE.test(cmd)) return []; // 列目录 = manifest 扫描
  if (!READ_VERB_RE.test(cmd)) return []; // 不是读取命令
  // 取命令里所有像路径的 token：含 / 或 \，或以盘符/$SKILL_DIR/~/ 开头
  const tokens = cmd.split(/\s+/);
  const out = [];
  for (const tok of tokens) {
    const clean = tok.replace(/^["']|["']$/g, '');
    if (!clean) continue;
    if (clean.includes('/') || clean.includes('\\') || /^\$SKILL_DIR/.test(clean) || /^~[\\/]/.test(clean) || /^[a-zA-Z]:/.test(clean)) {
      out.push(clean);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 通用对象遍历：找 Read 工具调用 / shell 命令 / tool_result 正文
// ---------------------------------------------------------------------------

const READ_TOOL_RE = /^(read|readfile|read_file|view|open|get.?file|loadfile)/i;
const PATH_KEYS = ['file_path', 'filepath', 'path', 'file', 'target', 'absolute_path'];

/** 从一个 arguments/参数字典里取路径。 */
function pickPath(obj) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of PATH_KEYS) {
    if (typeof obj[k] === 'string' && obj[k].trim()) return obj[k];
  }
  return null;
}

/** 数一段文本里罗列了多少个 distinct vendor 资产目录（>=4 视为 manifest 枚举）。 */
function countVendorAssetsInText(text) {
  const found = new Set();
  for (const a of ASSET_WHITELIST) {
    // 命中 vendor/<asset>/ 或 "<asset>/" 形式
    if (new RegExp('vendor[/\\\\]' + a + '[/\\\\]').test(text) || new RegExp('(^|[\\s`"\'(])' + a + '[/\\\\]').test(text)) {
      found.add(a);
    }
  }
  return found.size;
}

/**
 * 把一条转录 entry 挖成读取动作数组：{ kind: 'read-tool'|'shell-read', path, ts }。
 * 纯函数，fail-open：无法识别的字段跳过，不抛。
 */
export function extractReadActions(entry, repoRoot) {
  const actions = [];
  const ts = entry && typeof entry.ts === 'string' ? entry.ts : (entry && entry.timestamp ? String(entry.timestamp) : null);
  const stack = [entry];
  let guard = 0;
  while (stack.length && guard++ < 5000) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;

    // 1) tool_result / 输出正文：罗列 >=4 vendor 资产 = manifest 扫描，跳过（不计为读取）
    const body = node.content ?? node.output ?? node.result;
    if (typeof body === 'string' && countVendorAssetsInText(body) >= 4) {
      continue; // 该节点是清单枚举，不向下挖（防把枚举里的路径当成单次消费读）
    }

    // 2) Read 工具调用：name/tool 命中 read 且参数里有路径
    const toolName = node.tool ?? node.name ?? (node.function && (node.function.name)) ?? null;
    if (typeof toolName === 'string' && READ_TOOL_RE.test(toolName)) {
      const args = node.arguments ?? node.args ?? node.input ?? (node.function && node.function.arguments);
      let pathArg = null;
      if (typeof args === 'string') { try { pathArg = pickPath(JSON.parse(args)); } catch { pathArg = null; } }
      else pathArg = pickPath(args) || pickPath(node);
      if (pathArg) actions.push({ kind: 'read-tool', path: pathArg, ts });
    }

    // 3) shell 命令
    const cmd = node.command ?? node.cmd ?? node.input ?? node.bash;
    if (typeof cmd === 'string' && cmd.trim()) {
      for (const p of extractShellReadPaths(cmd, repoRoot)) {
        actions.push({ kind: 'shell-read', path: p, ts });
      }
    }

    // 向下递归（数组/对象）
    for (const v of Object.values(node)) {
      if (v && typeof v === 'object') stack.push(v);
    }
  }
  return actions;
}

// ---------------------------------------------------------------------------
// 来源装载
// ---------------------------------------------------------------------------

function loadJsonlEntries(file) {
  const text = fs.readFileSync(file, 'utf8');
  const entries = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    try { entries.push(JSON.parse(line)); }
    catch (e) { throw new Error(`${file}:${i + 1} 转录行不可解析: ${e.message}（fail-closed）`); }
  }
  return entries;
}

/** ZCode SQLite db：读 part 表，把每行转成 entry。node:sqlite 为实验性 API。 */
function loadZcodeEntries(dbPath) {
  let DatabaseSync;
  try { ({ DatabaseSync } = require('node:sqlite')); }
  catch (e) { throw new Error('无法加载 node:sqlite（' + e.message + '）：ZCode db 不可读（fail-closed）'); }
  if (!fs.existsSync(dbPath)) throw new Error('ZCode db 不存在: ' + dbPath);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map((t) => t.name);
    if (!tableNames.includes('part')) {
      throw new Error('ZCode db 无 part 表（现有表: ' + tableNames.join(', ') + '）——不猜列名（fail-closed）');
    }
    const rows = db.prepare('SELECT * FROM part').all();
    // 每行转成 entry：把字符串列尝试 JSON.parse，失败则当文本块
    return rows.map((row) => {
      const entry = {};
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'string') {
          const t = v.trim();
          if (t.startsWith('{') || t.startsWith('[')) {
            try { entry[k] = JSON.parse(v); continue; } catch { /* fallthrough */ }
          }
        }
        entry[k] = v;
      }
      return entry;
    });
  } finally {
    db.close();
  }
}

/** Codex sessions 目录：扫 *.jsonl 全部行。 */
function loadCodexEntries(dir) {
  if (!fs.existsSync(dir)) throw new Error('Codex sessions 目录不存在: ' + dir);
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.jsonl')) continue;
    for (const e of loadJsonlEntries(path.join(dir, f))) out.push(e);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------

export function buildRecords(entries, repoRoot) {
  const records = [];
  const seen = new Set(); // 同 ts+op+path 去重（一个 entry 可能重复挖同一路径）
  for (const entry of entries) {
    for (const a of extractReadActions(entry, repoRoot)) {
      const norm = resolveTarget(a.path, repoRoot);
      if (!norm || !isUnderVendor(norm, repoRoot)) continue;
      if (!ASSET_SET.has(assetOf(norm))) continue; // 只收 16 资产
      const key = (a.ts || '') + '|' + a.kind + '|' + norm;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({
        ts: a.ts ?? new Date().toISOString(),
        pid: 0, // 历史转录无活动进程
        cwd: repoRoot,
        op: a.kind,
        path: norm,
        tag: 'consumption', // agent 侧读取 = 面向使用的消费读
      });
    }
  }
  return records;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--transcript') args.transcript = argv[++i];
    else if (a === '--codex-sessions') args.codex = argv[++i];
    else if (a === '--zcode-db') args.zcode = argv[++i];
    else if (a === '--repo') args.repo = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else throw new Error('未知参数: ' + a);
  }
  return args;
}

export function main(argv) {
  let args;
  try { args = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  if (!args.transcript && !args.codex && !args.zcode) {
    console.error('用法: --transcript <file.jsonl> | --codex-sessions <dir> | --zcode-db <db>  [--repo <根>] [--out <jsonl>]');
    return 2;
  }
  const repoRoot = path.resolve(args.repo || REPO_ROOT);
  try {
    const entries = [];
    if (args.transcript) for (const e of loadJsonlEntries(args.transcript)) entries.push(e);
    if (args.codex) for (const e of loadCodexEntries(args.codex)) entries.push(e);
    if (args.zcode) for (const e of loadZcodeEntries(args.zcode)) entries.push(e);

    const records = buildRecords(entries, repoRoot);
    const outText = records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '');
    if (args.out) {
      fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
      fs.writeFileSync(args.out, outText, 'utf8');
      console.error('TRANSCRIPT: ' + records.length + ' 条 → ' + args.out);
    } else {
      process.stdout.write(outText);
    }
    return 0;
  } catch (e) {
    console.error(e.message);
    return 2;
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  process.exitCode = main(process.argv.slice(2));
}
