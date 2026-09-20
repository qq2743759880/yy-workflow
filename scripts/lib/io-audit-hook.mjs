/**
 * io-audit-hook.mjs — P1 IO 口径调用率审计：Node --import 预载钩子（P1-A）。
 *
 * 用途：经 `node --import <本文件> <用户脚本>` 预载，在主模块求值前包装以下 fs 读取面，
 * 把每一次"读取 vendor/ 资产"的动作追加为 JSONL 记录，供 asset-io-report 聚合：
 *   - fs.readFileSync              （同步读）
 *   - fs.promises.readFile         （异步读）
 *   - fs.createReadStream          （流式读）
 *   - fs.readdir / fs.readdirSync + fs.promises.readdir （列目录，含 promises 版）
 *
 * 记录形状（与 transcript 工具同构）：{ ts, pid, cwd, op, path, tag }
 *   - ts   ISO8601；pid 进程号；cwd 进程工作目录；op 被包动作名
 *   - path 规范化后的绝对路径（Windows 反斜杠转正斜杠；保留原始大小写——大小写折叠仅用于
 *           内部 vendor 前缀判定，不落盘）
 *   - tag  调用栈归类：栈帧 basename 精确匹配 matrix.mjs / asset-call-rate.mjs / ci.mjs /
 *           io-audit-hook.mjs → routing；否则 consumption（P2-1 修复：路径段边界精确比对，
 *           callermatrix.mjs / official-ci.mjs 等子串不再误判）
 *
 * 作用域防护：仅当 process.cwd() 位于本仓库内才安装包装与记录——防止 NODE_OPTIONS 全局泄漏
 * 到无关进程后对其 fs 动刀、或把无关路径写进审计。本钩子自身绝不抛错进业务路径
 * （审计是旁路观测，fail-open for the audited app）。
 *
 * 输出：默认 <repo>/.tt-state/io-audit/io-audit.jsonl；环境变量 YY_IO_AUDIT_DIR 覆盖目录。
 * 滚动：单文件超过 5MB 时把当前文件改名为 .1（覆盖旧 .1），再开新文件；YY_IO_AUDIT_MAX_BYTES
 * 可覆盖阈值（自测用，默认 5*1024*1024）。保留一个 .1 副本。
 *
 * Node 兼容（STOP 条件）：优先探测 module.registerHooks()，回退 module.register()；两者皆无
 * （远古 Node）→ 不安装，stderr 告警后静默退出审计（不 crash 用户应用）。本实现的实际包装发生在
 * --import 预载期内联完成（worker 线程里的 loader hook 无法 patch 主线程 fs，故不走 register）。
 *
 * 零 npm 依赖；ESM；中文注释；fail-closed（见 report/transcript 侧）。
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import module from 'node:module';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// 仓库定位与常量
// ---------------------------------------------------------------------------

/** 本文件位于 <repo>/scripts/lib/io-audit-hook.mjs → repo 根上跳两级。 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const VENDOR_ROOT = path.join(REPO_ROOT, 'vendor');

/** routing 调用栈特征 basename 集合（caller 归类；本钩子自身帧在 classifyTag 中先剔除，见下）。
 *  P2-1 修复：用路径段边界精确比对，不再用子串正则——callermatrix.mjs / official-ci.mjs
 *  这类文件名包含 "matrix.mjs" / "ci.mjs" 子串但不是路由脚本，不能误判 routing。 */
const ROUTING_BASENAMES = new Set([
  'matrix.mjs',
  'asset-call-rate.mjs',
  'ci.mjs',
  'io-audit-hook.mjs',
]);

/** 从栈帧行中提取文件路径引用的正则：匹配以 .mjs/.js/.cjs/.mts/.ts 结尾、
 *  可选 :line:col 后缀的路径片段（含 file:// URL 和 Windows 反斜杠路径）。 */
const FILE_REF_RE = /([^\s()'"`]+?\.(?:mjs|js|cjs|mts|ts))(?::\d+:\d+)?/g;

/** 输出目录：YY_IO_AUDIT_DIR 覆盖，默认 <repo>/.tt-state/io-audit/。 */
const OUT_DIR = process.env.YY_IO_AUDIT_DIR
  ? path.resolve(process.env.YY_IO_AUDIT_DIR)
  : path.join(REPO_ROOT, '.tt-state', 'io-audit');
const OUT_FILE = path.join(OUT_DIR, 'io-audit.jsonl');

/** 滚动阈值（字节）；默认 5MB，YY_IO_AUDIT_MAX_BYTES 供自测压小。 */
const MAX_BYTES = Number(process.env.YY_IO_AUDIT_MAX_BYTES || 5 * 1024 * 1024);

// ---------------------------------------------------------------------------
// 纯函数（导出供自测；不依赖 cwd）
// ---------------------------------------------------------------------------

/**
 * 路径规范化：path.resolve 成绝对路径 + 反斜杠转正斜杠 + 大小写折叠。
 * win32 大小写不敏感，折叠后做前缀匹配避免 Junction/短名/大小写漂移漏记。
 * （已知边界：Junction 经符号链接访问仍可能绕过——见施工方案 P1 遗留 #7，不假装解决。）
 */
export function normalizePath(p) {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

/** 规范化后的绝对路径是否位于 <repo>/vendor/ 之下（含 vendor 根本身）。 */
export function isUnderVendor(normAbs) {
  const v = normalizePath(VENDOR_ROOT);
  return normAbs === v || normAbs.startsWith(v + '/');
}

/** 从规范化路径提取资产 id（vendor/ 之后第一段）；不在 vendor 下返回 null。 */
export function extractAsset(normAbs) {
  const v = normalizePath(VENDOR_ROOT);
  if (!isUnderVendor(normAbs)) return null;
  if (normAbs === v) return null;
  const rel = normAbs.slice(v.length + 1);
  return rel.split('/')[0] || null;
}

/**
 * 调用栈归类。先剔除本钩子自身帧（io-audit-hook.mjs）——否则每个被包动作的栈里都含
 * 包装帧，会把 io-audit-hook.mjs 特征误命中而把一切读都判成 routing。
 * 剔除后，对每个剩余栈帧提取其中的文件 basename，与路由脚本 basename 集合精确比对
 * （P2-1：路径段边界匹配，子串匹配不再误判 callermatrix.mjs / official-ci.mjs）。
 */
export function classifyTag(stack) {
  const lines = (stack || '').split('\n');
  for (const line of lines) {
    // 剔除本钩子自身帧
    if (line.includes('io-audit-hook.mjs')) continue;

    const refs = line.match(FILE_REF_RE);
    if (!refs) continue;

    for (const ref of refs) {
      // 去掉 :line:col 后缀和 file:// 协议前缀，取 basename（最后一段路径）
      const cleaned = ref.replace(/:\d+:\d+$/, '').replace(/^file:\/\//, '');
      const basename = cleaned.split(/[\\/]/).pop();
      if (basename && ROUTING_BASENAMES.has(basename)) {
        return 'routing';
      }
    }
  }
  return 'consumption';
}

/** fs 第一个参数可能是 string / Buffer / URL；统一转成字符串路径。失败返回 null。 */
function toPathString(p) {
  if (p == null) return null;
  if (typeof p === 'string') return p;
  if (Buffer.isBuffer(p)) return p.toString('utf8');
  if (p instanceof URL) return fileURLToPath(p);
  return null;
}

// ---------------------------------------------------------------------------
// JSONL 落盘与滚动
// ---------------------------------------------------------------------------

let cachedSize = null; // 本进程已记录的 OUT_FILE 字节数（懒 stat，避免每次调用 stat）

function rotateIfNeeded(bufLen) {
  if (cachedSize === null) {
    try { cachedSize = fs.statSync(OUT_FILE).size; }
    catch { cachedSize = 0; }
  }
  if (cachedSize + bufLen > MAX_BYTES) {
    try { fs.rmSync(OUT_FILE + '.1', { force: true }); } catch { /* 旧 .1 不存在无所谓 */ }
    try { fs.renameSync(OUT_FILE, OUT_FILE + '.1'); } catch { /* 当前文件不存在无所谓 */ }
    cachedSize = 0;
  }
}

function appendRecord(rec) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const line = JSON.stringify(rec) + '\n';
  const buf = Buffer.from(line, 'utf8');
  rotateIfNeeded(buf.length);
  // 用未被包装的底层 appendFileSync，避免自递归
  fs.appendFileSync(OUT_FILE, buf);
  cachedSize = (cachedSize ?? 0) + buf.length;
}

// ---------------------------------------------------------------------------
// 录制
// ---------------------------------------------------------------------------

function record(op, pathArg) {
  try {
    const p = toPathString(pathArg);
    if (!p) return;
    // P2-2 修复：存原文路径（resolve 成绝对 + 反斜杠转正斜杠，但不做大小写折叠）。
    // 大小写折叠仅用于 vendor 前缀判定（win32 大小写不敏感），不落盘。
    const resolved = path.resolve(p).replace(/\\/g, '/');
    const norm = resolved.toLowerCase();
    if (!isUnderVendor(norm)) return; // 只关心 vendor 读取（用折叠后路径判定）
    const tag = classifyTag(new Error().stack);
    appendRecord({
      ts: new Date().toISOString(),
      pid: process.pid,
      cwd: process.cwd(),
      op,
      path: resolved,
      tag,
    });
  } catch {
    // 审计旁路：任何失败都不得影响被审计业务
  }
}

// ---------------------------------------------------------------------------
// 安装包装（幂等）
// ---------------------------------------------------------------------------

let installed = false;

export function install() {
  if (installed) return;
  installed = true;

  // 作用域防护：cwd 不在仓库内 → 不安装，不记录（防 NODE_OPTIONS 泄漏到无关进程）。
  if (!cwdInRepo()) return;

  // 1) fs.readFileSync
  const origReadFileSync = fs.readFileSync;
  fs.readFileSync = function (pathArg, options) {
    record('readFileSync', pathArg);
    return origReadFileSync.call(this, pathArg, options);
  };

  // 2) fs.promises.readFile
  const origPromReadFile = fsp.readFile;
  fsp.readFile = function (pathArg, options) {
    record('readFile', pathArg);
    return origPromReadFile.call(this, pathArg, options);
  };

  // 3) fs.createReadStream
  const origCreateReadStream = fs.createReadStream;
  fs.createReadStream = function (pathArg, options) {
    record('createReadStream', pathArg);
    return origCreateReadStream.call(this, pathArg, options);
  };

  // 4) fs.readdir（回调形；兼容 readdir(path, callback) 省略 options 的写法）
  const origReaddir = fs.readdir;
  fs.readdir = function (pathArg, options, callback) {
    record('readdir', pathArg);
    return origReaddir.call(this, pathArg, options, callback);
  };

  // 4b) fs.readdirSync（同步列目录；目录读取无论同步/异步都捕获）
  const origReaddirSync = fs.readdirSync;
  fs.readdirSync = function (pathArg, options) {
    record('readdir', pathArg);
    return origReaddirSync.call(this, pathArg, options);
  };

  // 5) fs.promises.readdir
  const origPromReaddir = fsp.readdir;
  fsp.readdir = function (pathArg, options) {
    record('readdir', pathArg);
    return origPromReaddir.call(this, pathArg, options);
  };
}

/** 作用域：cwd 是否位于本仓库内（大小写折叠后比较，win32 兼容）。 */
function cwdInRepo() {
  const cwd = normalizePath(process.cwd());
  const root = normalizePath(REPO_ROOT);
  return cwd === root || cwd.startsWith(root + '/');
}

// ---------------------------------------------------------------------------
// 预载入口：Node 兼容探测 + 安装
// ---------------------------------------------------------------------------

// Node hook API 可用性探测（STOP 条件）：两者皆无 → 不安装并告警，不 crash 用户应用。
// 实际包装在内联完成（见文件头注释）；这里只做 STOP 判定。
const hasHookApi =
  typeof module.registerHooks === 'function' ||
  typeof module.register === 'function';

if (!hasHookApi) {
  process.stderr.write(
    '[io-audit-hook] WARN: 当前 Node（' + process.version + '）无 registerHooks/register，' +
    '审计钩子未安装（STOP 条件触发）。\n'
  );
} else {
  install();
}

export default { normalizePath, isUnderVendor, extractAsset, classifyTag, install, REPO_ROOT, VENDOR_ROOT, OUT_FILE };
