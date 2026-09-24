#!/usr/bin/env node
/**
 * change-lock.mjs — v3 批 1 三机制之二：批内写面建议性锁（plans/change-lock.json 为锁面）。
 *
 * 派单：handoffs/v3/B1-GATE-dispatch.md 任务 C；机制缘由 plans/execution-plan-v3-20260923.md
 * §v3.1「change-lock.json adopt 降级」、§并行写面纪律（Owner 审计 F-003）。
 *
 * ★ 语义 = 建议性（advisory）：本锁不提供强制力。真强制力在两处——
 *   ①派发拒发：编排者派单前核查锁面，被他方持锁的文件不派；
 *   ②收口核查：L2/编排者 git diff 逐文件归属核查（改动不在白名单+写面声明表 → 越权退回）。
 *   本 CLI 只提供机检面：acquire/check/release/list 与过期自愈，供派发与 preflight P7 消费。
 *
 * 锁字段（写面声明表同构）：{ file, owner, task, locked, reason, expires }
 *   file    仓库相对路径（正斜杠归一）
 *   owner   持锁任务/agent 标识（--owner）
 *   task    同 owner（冗余登记，写面声明表 task × 文件唯一 owner 口径的字段完整性）
 *   locked  加锁时点 ISO 8601
 *   reason  加锁理由（--reason，禁止空）
 *   expires 过期时点 ISO 8601（locked + ttl 分钟，默认 120）——必须含 expiry：
 *           agent 崩溃防悬挂锁（store.js 过期锁先例）。过期锁自动视为可抢（acquire 直接夺取，
 *           check 判无锁）；抢锁不删除旧记录而是覆写 owner/task/locked/reason/expires 五字段，
 *           file 为主键（同文件单条 active 记录）。
 *
 * CLI：
 *   --acquire <file> --owner <task> --reason <r> [--ttl 分钟，默认 120]   加锁；他方 active 锁在场 → exit 1
 *   --check  <file> [--owner <task>]                                      查锁；他方 active 锁在场 → exit 1
 *           （--owner 缺省 = 只要有任何 active 锁即 exit 1；--owner 给定 = 仅他方锁 FAIL）
 *   --release <file> --owner <task>                                       释放；仅持锁人可释放（过期锁可清理）→ 否则 exit 1
 *   --list                                                                列出全部锁与 active/expired 状态
 * 退出码：0 成功/无冲突；1 冲突/失败；2 用法错误。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_FILE = path.join(ROOT, 'plans', 'change-lock.json');

function readLocks() {
  if (!fs.existsSync(LOCK_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.locks)) return data.locks;
    return null;
  } catch { return null; }
}
function writeLocks(locks) {
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  fs.writeFileSync(LOCK_FILE, JSON.stringify({ locks }, null, 2) + '\n', 'utf8');
}
function normRel(f) {
  const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
  return path.relative(ROOT, abs).replace(/\\/g, '/');
}
function isActive(lock, now) {
  return !!(lock && lock.file && lock.expires && Date.parse(lock.expires) > now);
}
function fail(msg) { console.error('FAIL ' + msg); process.exitCode = 1; }
function ok(msg) { console.log('OK ' + msg); }

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}
function hasFlag(flag) { return process.argv.includes(flag); }

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('用法: node scripts/change-lock.mjs --acquire <file> --owner <task> --reason <r> [--ttl 120]\n' +
      '                | --check <file> [--owner <task>] | --release <file> --owner <task> | --list');
    process.exitCode = 2;
    return;
  }
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  if (hasFlag('--list')) {
    const locks = readLocks();
    if (locks === null) { fail(`LOCK_FILE_INVALID: ${LOCK_FILE} 不可解析`); return; }
    console.log(`# change-lock 锁面（${path.relative(ROOT, LOCK_FILE)}）— 建议性锁，真强制力=派发拒发+收口 diff 归属核查`);
    if (locks.length === 0) { console.log('（空）'); return; }
    for (const l of locks) {
      const st = isActive(l, now) ? 'ACTIVE' : 'EXPIRED(自动可抢)';
      console.log(`${st}  ${l.file}  owner=${l.owner}  locked=${l.locked}  expires=${l.expires}  reason=${l.reason}`);
    }
    return;
  }

  if (hasFlag('--acquire')) {
    const fileArg = argValue('--acquire');
    const owner = argValue('--owner');
    const reason = argValue('--reason');
    const ttlMin = Number(argValue('--ttl', '120'));
    if (!fileArg || !owner || !reason || reason.trim() === '') {
      console.error('用法错误: --acquire 需要 --owner 与 --reason（禁止空理由）'); process.exitCode = 2; return;
    }
    if (!Number.isFinite(ttlMin) || ttlMin <= 0) { console.error('用法错误: --ttl 须为正分钟数'); process.exitCode = 2; return; }
    const locks = readLocks();
    if (locks === null) { fail(`LOCK_FILE_INVALID: ${LOCK_FILE} 不可解析`); return; }
    const file = normRel(fileArg);
    const expires = new Date(now + ttlMin * 60000).toISOString();
    const existing = locks.find((l) => l && l.file === file);
    if (existing && isActive(existing, now) && existing.owner !== owner) {
      fail(`LOCK_HELD: '${file}' 已被任务 '${existing.owner}' 持锁（expires=${existing.expires}，reason=${existing.reason}）——本锁建议性，若确需并行请编排者仲裁（派发拒发/L2 diff 归属核查为真强制力）`);
      return;
    }
    const entry = { file, owner, task: owner, locked: nowIso, reason, expires };
    const expiredTakeover = existing && !isActive(existing, now) && existing.owner !== owner;
    if (existing) Object.assign(existing, entry, { file }); // 同 owner 续期 或 过期锁自动夺取（覆写五字段）
    else locks.push(entry);
    writeLocks(locks);
    ok(`acquired '${file}' owner=${owner} ttl=${ttlMin}min expires=${expires}` + (expiredTakeover ? `（原锁 owner=${existing.owner} 已于 ${existing.expires} 过期，自动可抢——本条为夺取）` : ''));
    return;
  }

  if (hasFlag('--check')) {
    const fileArg = argValue('--check');
    const owner = argValue('--owner');
    if (!fileArg) { console.error('用法错误: --check 需要 <file>'); process.exitCode = 2; return; }
    const locks = readLocks();
    if (locks === null) { fail(`LOCK_FILE_INVALID: ${LOCK_FILE} 不可解析`); return; }
    const file = normRel(fileArg);
    const existing = locks.find((l) => l && l.file === file);
    if (!existing) { ok(`'${file}' 无锁`); return; }
    if (!isActive(existing, now)) {
      ok(`'${file}' 的锁（owner=${existing.owner}）已于 ${existing.expires} 过期——自动视为可抢`);
      return;
    }
    if (owner && existing.owner === owner) { ok(`'${file}' 由本任务 '${owner}' 持锁（expires=${existing.expires}）`); return; }
    fail(`LOCK_HELD: '${file}' 被任务 '${existing.owner}' 持锁（expires=${existing.expires}，reason=${existing.reason}）` + (owner ? `（当前任务 '${owner}'）` : ''));
    return;
  }

  if (hasFlag('--release')) {
    const fileArg = argValue('--release');
    const owner = argValue('--owner');
    if (!fileArg || !owner) { console.error('用法错误: --release 需要 --owner（仅持锁人可释放）'); process.exitCode = 2; return; }
    const locks = readLocks();
    if (locks === null) { fail(`LOCK_FILE_INVALID: ${LOCK_FILE} 不可解析`); return; }
    const file = normRel(fileArg);
    const idx = locks.findIndex((l) => l && l.file === file);
    if (idx < 0) { ok(`'${file}' 无锁（无需释放）`); return; }
    const existing = locks[idx];
    if (existing.owner !== owner && isActive(existing, now)) {
      fail(`NOT_OWNER: '${file}' 由任务 '${existing.owner}' 持锁且未过期，任务 '${owner}' 无权释放`);
      return;
    }
    locks.splice(idx, 1);
    writeLocks(locks);
    ok(`released '${file}'` + (existing.owner !== owner ? `（原锁 owner=${existing.owner} 已过期，过期锁清理）` : `（owner=${owner}）`));
    return;
  }

  console.error('用法错误: 需要 --acquire | --check | --release | --list 之一');
  process.exitCode = 2;
}

main();
