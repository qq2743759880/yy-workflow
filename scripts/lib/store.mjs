import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
export function createStore(workspace = '.') {
  const dir = path.join(workspace, '.tt-state');
  const file = path.join(dir, 'state.json');
  let pending = Promise.resolve();
  return {
    save(plan) {
      // Capture at the transition, then serialize writes. Readers see old or new complete JSON.
      const snapshot = JSON.stringify(plan, null, 2);
      const operation = pending.then(async () => {
        await fs.mkdir(dir, { recursive: true });
        const tmp = path.join(dir, 'state.' + randomUUID() + '.tmp');
        let handle;
        try {
          handle = await fs.open(tmp, 'wx');
          await handle.writeFile(snapshot, 'utf8');
          await handle.sync();
          await handle.close(); handle = null;
          // Windows readers/antivirus can briefly hold the destination open.
          // Retry replacement; never unlink the last durable checkpoint.
          for (let attempt = 0; ; attempt += 1) {
            try { await fs.rename(tmp, file); break; }
            catch (error) {
              if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 7) throw error;
              await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
            }
          }
        } finally {
          if (handle) await handle.close();
          await fs.rm(tmp, { force: true });
        }
        return plan;
      });
      pending = operation.catch(() => {});
      return operation;
    },
    async load() { await pending; try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } },
    async clear() { try { await fs.unlink(file); } catch (error) { if (error.code !== 'ENOENT') throw error; } },
  };
}
export default createStore;

// ---------------------------------------------------------------------------
// B2 additive：withLock — 按资源路径键控的排他锁（P3 阶段 B）
//
// wx exclusive create, bounded retry and owner-aware recovery; always fail closed.
//
// 数值沿用现状常量（C-R4 OQ-R4-3=A）：retries=5 / delayMs=400 / staleMs=30000。
// createStore 的原子快照写入与此资源锁各自负责持久化和命名空间互斥。
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

/** Guard is never reaped: an interrupted guard requires offline recovery. */
async function guarded(lockFile, fn) {
  const guard = lockFile + '.guard';
  let handle;
  try {
    handle = await fs.open(guard, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') return { busy: true };
    throw error;
  }
  try { return { value: await fn() }; }
  finally { await handle.close(); await fs.unlink(guard); }
}

async function readOwner(lockFile) {
  try { return JSON.parse(await fs.readFile(lockFile, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return null; throw error; }
}

function ownerDead(owner) {
  if (owner?.schema !== 'yy/store-lock@1' || owner.host !== hostname() ||
      !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || typeof owner.token !== 'string') return false;
  try { process.kill(owner.pid, 0); return false; }
  catch (error) { return error.code === 'ESRCH'; }
}

/** Main-lock recovery and acquisition are one guard-protected operation. */
async function tryAcquire(lockFile, owner) {
  return guarded(lockFile, async () => {
    const current = await readOwner(lockFile);
    if (ownerDead(current)) await fs.unlink(lockFile);
    let handle;
    try { handle = await fs.open(lockFile, 'wx'); }
    catch (error) { if (error.code === 'EEXIST') return false; throw error; }
    try { await handle.writeFile(JSON.stringify(owner), 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    return true;
  });
}

async function release(lockFile, owner, retries, delayMs) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt) await sleep(delayMs);
    const result = await guarded(lockFile, async () => {
      if ((await readOwner(lockFile))?.token === owner.token) await fs.unlink(lockFile);
    });
    if (!result.busy) return;
  }
  throw new LockBusyError(lockFile + '.guard', retries, delayMs);
}

/* Lock ownership cannot be inferred from mtime; PID reuse conservatively blocks recovery.
 * All protocol participants use the guard. Unknown/legacy main locks and abandoned guards
 * fail closed; offline recovery requires stopping every writer before deleting residuals.
 */

/**
 * withLock(resourcePath, fn, opts?) — 在排他锁保护下执行 fn。
 * @param {string} resourcePath - 被保护资源路径；锁文件 = resourcePath + '.lock'
 * @param {function} fn - 持锁期间执行的异步函数
 * @param {object} [opts] - { retries?, delayMs? }; legacy staleMs is ignored.
 * @returns {Promise<*>} fn 的返回值
 * @throws {LockBusyError} 重试耗尽仍未拿到锁（fail-closed）
 */
export async function withLock(resourcePath, fn, opts = {}) {
  const retries = Number.isInteger(opts.retries) ? opts.retries : LOCK_DEFAULTS.retries;
  const delayMs = Number.isInteger(opts.delayMs) ? opts.delayMs : LOCK_DEFAULTS.delayMs;
  if (retries < 0 || delayMs < 0) throw new RangeError('Lock options must be nonnegative');
  const lockFile = resourcePath + '.lock';
  const owner = { schema: 'yy/store-lock@1', host: hostname(), pid: process.pid, token: randomUUID() };
  await fs.mkdir(path.dirname(lockFile), { recursive: true });

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) await sleep(delayMs);
    const acquired = await tryAcquire(lockFile, owner);
    if (acquired.value === true) {
      try {
        return await fn();
      } finally {
        await release(lockFile, owner, retries, delayMs);
      }
    }
  }
  throw new LockBusyError(lockFile, retries, delayMs);
}
