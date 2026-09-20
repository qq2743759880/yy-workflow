/** TT state model. */
export const STATE = { IDLE: 'idle', PLANNING: 'planning', EXECUTING: 'executing', FROZEN: 'frozen', REVIEWING: 'reviewing', DONE: 'done', FAILED: 'failed' };
export const TRANSITIONS = { idle: ['planning', 'failed'], planning: ['executing', 'failed'], executing: ['frozen', 'reviewing', 'failed'], frozen: ['executing', 'reviewing', 'failed'], reviewing: ['done', 'executing', 'failed'], done: [], failed: [] };
export class IllegalTransitionError extends Error {
  constructor(from, to) { super('非法状态转换: ' + from + ' → ' + to); this.name = 'IllegalTransitionError'; }
}
export function canTransition(from, to) { return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to)); }
export function assertTransition(from, to) { if (!canTransition(from, to)) throw new IllegalTransitionError(from, to); return true; }

// ---------------------------------------------------------------------------
// B1 additive：命名空间读写层（P3 阶段 B，纯 additive，不动上方既有函数）
//
// 四命名空间 receipt / finding / change / journey 作为 .tt-state/state.json 的顶层
// additive 段。契约（C-R4-control §2.2）：state.json 增加顶层 stateVersion 字段；
// 缺失 = 合法 legacy v0（按旧形态读，返回空默认，不报错）；存在但不认识的版本
// = fail-closed（STATE_VERSION_UNSUPPORTED，不静默降级后覆写）。
//
// 老 state 文件（store.mjs createStore 写出的 plan 对象）缺这四个新段时，
// readNamespace 返回空数组 []，不报错；appendNamespace 首次写入时补齐四段数组。
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

/** 命名空间 schema 版本（本层引入；既有 state.json 无此字段 = legacy v0）。 */
export const STATE_VERSION = 'yy/state@1';

/** 四命名空间白名单（白名单外 fail-closed）。 */
export const NAMESPACES = Object.freeze(['receipt', 'finding', 'change', 'journey']);

/** state.json 路径（与 store.mjs createStore 同一文件：<workspace>/.tt-state/state.json）。 */
export function stateFilePath(opts = {}) {
  const workspace = opts.workspace || process.cwd();
  return path.join(workspace, '.tt-state', 'state.json');
}

/** 版本不认识错误（fail-closed；C-R4 §2.2 独立新码，不复用 SESSION_INVALID）。 */
export class StateVersionError extends Error {
  constructor(version) {
    super('stateVersion 不认识: ' + JSON.stringify(version) + '（支持: ' + STATE_VERSION + '；缺失=legacy v0 合法，存在但不认识=fail-closed）');
    this.name = 'StateVersionError';
    this.code = 'STATE_VERSION_UNSUPPORTED';
  }
}

/** ns 白名单校验（白名单外 fail-closed）。 */
function assertNamespace(ns) {
  if (!NAMESPACES.includes(ns)) {
    throw new Error('未知命名空间: ' + JSON.stringify(ns) + '（白名单: ' + NAMESPACES.join(', ') + '；fail-closed）');
  }
}

/** 读 state.json；不存在返回 null。版本不认识抛 StateVersionError。返回解析后的对象。 */
function readStateDoc(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const doc = JSON.parse(raw);
  // 版本闸：缺失=legacy v0 合法；存在且非本层版本=fail-closed（不静默降级）
  if (doc && typeof doc === 'object' && doc.stateVersion != null && doc.stateVersion !== STATE_VERSION) {
    throw new StateVersionError(doc.stateVersion);
  }
  return doc;
}

/**
 * readNamespace(ns, opts?) — 读某命名空间的全部记录（数组）。
 * @param {string} ns - receipt|finding|change|journey（白名单外 fail-closed）
 * @param {object} [opts] - { workspace? }（缺省 process.cwd()）
 * @returns {Promise<Array>} 该段记录；state.json 不存在或缺该段 → []
 */
export async function readNamespace(ns, opts = {}) {
  assertNamespace(ns);
  const file = stateFilePath(opts);
  let doc;
  try { doc = readStateDoc(file); } catch (error) {
    if (error instanceof SyntaxError) throw new Error('state.json 不可解析: ' + file + '（' + error.message + '）');
    throw error;
  }
  if (!doc || typeof doc !== 'object') return [];
  const arr = doc[ns];
  return Array.isArray(arr) ? arr : [];
}

/** 原子写 state.json（tmp + rename；Windows 下目标存在时先删再改名的稳妥回退）。 */
function writeStateDocAtomic(file, doc) {
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    // Windows：rename 覆盖既有目标可能 EEXIST/EPERM → 删目标后重试一次（短竞态可接受）
    if (error.code === 'EEXIST' || error.code === 'EPERM' || error.code === 'ACCES') {
      try { fs.rmSync(file, { force: true }); } catch { /* ignore */ }
      fs.renameSync(tmp, file);
    } else {
      try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
      throw error;
    }
  }
}

/**
 * appendNamespace(ns, rec, opts?) — 向某命名空间追加一条记录（additive，不动其他段）。
 * 首次写入时给 state.json 补齐 stateVersion 与四个空数组段。
 * @param {string} ns - receipt|finding|change|journey（白名单外 fail-closed）
 * @param {*} rec - 任意可 JSON 序列化的记录
 * @param {object} [opts] - { workspace? }（缺省 process.cwd()）
 * @returns {Promise<*>} 追加进去的 rec
 */
export async function appendNamespace(ns, rec, opts = {}) {
  assertNamespace(ns);
  const file = stateFilePath(opts);
  let doc;
  try { doc = readStateDoc(file); } catch (error) {
    if (error instanceof SyntaxError) throw new Error('state.json 不可解析: ' + file + '（' + error.message + '）');
    throw error;
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    doc = {};
  }
  // 补齐四命名空间段为数组（老文件缺新段时补齐，不动既有 plan 字段）
  for (const k of NAMESPACES) {
    if (!Array.isArray(doc[k])) doc[k] = [];
  }
  doc.stateVersion = STATE_VERSION;
  doc[ns].push(rec);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeStateDocAtomic(file, doc);
  return rec;
}

export default {
  STATE, TRANSITIONS, IllegalTransitionError, canTransition, assertTransition,
  STATE_VERSION, NAMESPACES, stateFilePath, StateVersionError,
  readNamespace, appendNamespace,
};
