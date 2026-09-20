#!/usr/bin/env node
/**
 * B2 自测：withLock 并发互斥实测。
 *  - 进程 A 持锁 800ms；进程 B 重试预算 ~200ms（retries=2, delay=100）→ B 必须 fail-closed（exit 3）
 *  - A 拿到锁并写 token；B 拿不到、不写 token
 *  - 无残留锁文件
 *  - 串行两进程都能拿到锁（锁可复用、释放干净）
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROBE = fileURLToPath(new URL('./b2-lock-probe.mjs', import.meta.url));
const results = [];
function check(name, ok, detail = '') {
  results.push([name, ok, detail]);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : ''));
}

function runProbe(resource, holdMs, retries, delayMs, tokenFile) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [PROBE, resource, String(holdMs), String(retries), String(delayMs), tokenFile], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (c) => { stderr += c.toString(); });
    child.on('close', (code) => resolve({ code, stderr }));
  });
}

const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-t4-b2-'));
try {
  const resource = path.join(ws, 'state.json');
  const tokA = path.join(ws, 'tokA.txt');
  const tokB = path.join(ws, 'tokB.txt');

  // 并发抢锁：A 持 800ms，B 预算 ~200ms
  const [a, b] = await Promise.all([
    runProbe(resource, 800, 2, 100, tokA),
    runProbe(resource, 10, 2, 100, tokB),
  ]);

  const aWon = a.code === 0 && fs.existsSync(tokA);
  const bFailed = b.code === 3 && !fs.existsSync(tokB) && /LOCK_BUSY/.test(b.stderr);
  const noLeftover = !fs.existsSync(resource + '.lock');
  check('B2-1 双进程抢锁：一成(A exit0+token)', aWon, 'A exit=' + a.code + ' tokA=' + fs.existsSync(tokA));
  check('B2-2 一败 fail-closed(B exit3, LOCK_BUSY, 不写token)', bFailed, 'B exit=' + b.code + ' stderr=' + b.stderr.trim().slice(0, 60));
  check('B2-3 无残留锁文件', noLeftover);

  // 串行：锁释放后两进程都能拿到（可复用）
  const tokC = path.join(ws, 'tokC.txt');
  const tokD = path.join(ws, 'tokD.txt');
  const c = await runProbe(resource, 20, 5, 50, tokC);
  const d = await runProbe(resource, 20, 5, 50, tokD);
  check('B2-4 串行两进程均拿锁（锁释放干净可复用）', c.code === 0 && d.code === 0 && fs.existsSync(tokC) && fs.existsSync(tokD), 'c=' + c.code + ' d=' + d.code);
} finally {
  fs.rmSync(ws, { recursive: true, force: true });
}

const failed = results.filter(([, ok]) => !ok);
console.log('\nB2 self-test: ' + (results.length - failed.length) + '/' + results.length + ' passed');
process.exitCode = failed.length ? 1 : 0;
