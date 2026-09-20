import fs from 'node:fs/promises';
import path from 'node:path';
export function createStore(workspace = '.') {
  const dir = path.join(workspace, '.tt-state');
  const file = path.join(dir, 'state.json');
  return {
    async save(plan) { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(file, JSON.stringify(plan, null, 2)); return plan; },
    async load() { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } },
    async clear() { try { await fs.unlink(file); } catch (error) { if (error.code !== 'ENOENT') throw error; } },
  };
}
export default createStore;

// ---------------------------------------------------------------------------
// B2 additive：withLock — 按资源路径键控的排他锁（P3 阶段 B）
//
// 与 journey.mjs withJourneyLock 同一锁原语（open(path,'wx') O_EXCL 独占创建 + 重试 +
// stale 自愈），但语义不同：**fail-closed**（C-R4 §2.3：锁耗尽必须失败、返回显式安全结果、
// 不得在锁外继续执行）。journey 锁现状是 fail-open（WARN 后继续），本层面向 state/命名空间
// 写入面，不沿用其 fail-open 行为。
//
// 数值沿用现状常量（C-R4 OQ-R4-3=A）：retries=5 / delayMs=400 / staleMs=30000。
// 既有 createStore 不改动。
// ---------------------------------------------------------------------------

/** 锁忙错误（fail-closed：重试耗尽仍未拿到锁 → 抛出，绝不无锁执行）。 */
export class LockBusyError extends Error {
  constructor(lockFile, retries, delayMs) {
    super('锁忙（fail-closed）: ' + lockFile + ' — 重试 ' + retries + ' 次 × ' + delayMs + 'ms 后仍未拿到，拒绝无锁执行');
    this.name = 'LockBusyError';
    this.code = 'LOCK_BUSY_FAIL_CLOSED';
  }
}

/** 默认锁参数（沿用 journey 现状常量）。 */
export const LOCK_DEFAULTS = Object.freeze({ retries: 5, delayMs: 400, staleMs: 30000 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 尝试独占创建锁文件；成功 true，已存在 false（其他错误上抛）。 */
async function tryAcquire(lockFile) {
  try {
    const handle = await fs.open(lockFile, 'wx');
    await handle.close();
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

/** stale 自愈：锁文件 mtime 早于 staleMs 前 → 视为持锁进程已死，删除残留并可重试。 */
async function reapIfStale(lockFile, staleMs) {
  try {
    const st = await fs.stat(lockFile);
    if (Date.now() - st.mtimeMs > staleMs) {
      await fs.rm(lockFile, { force: true });
      return true;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // 锁已被他人释放，下轮直接重试
  }
  return false;
}

/**
 * withLock(resourcePath, fn, opts?) — 在排他锁保护下执行 fn。
 * @param {string} resourcePath - 被保护资源路径；锁文件 = resourcePath + '.lock'
 * @param {function} fn - 持锁期间执行的异步函数
 * @param {object} [opts] - { retries?, delayMs?, staleMs? }（缺省 LOCK_DEFAULTS）
 * @returns {Promise<*>} fn 的返回值
 * @throws {LockBusyError} 重试耗尽仍未拿到锁（fail-closed）
 */
export async function withLock(resourcePath, fn, opts = {}) {
  const retries = Number.isInteger(opts.retries) ? opts.retries : LOCK_DEFAULTS.retries;
  const delayMs = Number.isInteger(opts.delayMs) ? opts.delayMs : LOCK_DEFAULTS.delayMs;
  const staleMs = Number.isInteger(opts.staleMs) ? opts.staleMs : LOCK_DEFAULTS.staleMs;
  const lockFile = resourcePath + '.lock';
  await fs.mkdir(path.dirname(lockFile), { recursive: true });

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) await sleep(delayMs);
    if (await tryAcquire(lockFile)) {
      try {
        return await fn();
      } finally {
        await fs.rm(lockFile, { force: true });
      }
    }
    // 未拿到锁：尝试回收 stale 残留后下一轮重试
    await reapIfStale(lockFile, staleMs);
  }
  throw new LockBusyError(lockFile, retries, delayMs);
}
