#!/usr/bin/env node
/** 
 * P3 回归测试：withRetry 与超时解耦（runCommand throwOnTimeout / backoff 不 unref / ENOENT 探测语义）。
 * 运行：node scripts/test-retry.mjs （exit 0 = 全过）
 */
import { runCommand } from './lib/adapters/util.mjs'; 
import { withRetry } from './lib/resilience.mjs'; 
import { TimeoutError } from './lib/errors.mjs'; 

let failures = 0; 
function check(label, cond) { 
  if (cond) { console.log('PASS ' + label); } else { failures += 1; console.log('FAIL ' + label); } 
} 

// 1) 默认（探测语义）：超时 resolve 失败对象，不 throw
const probe = await runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 2000)'], { workspace: '.', timeoutMs: 300, timeoutCode: 'TIMEOUT', notAvailableCode: 'N/A', subtask: { id: 't1' } }); 
check('default timeout resolves failure object (probe semantics)', probe && probe.ok === false && probe.error === 'TIMEOUT'); 

// 2) throwOnTimeout:true：超时 throw TimeoutError（执行语义，可重试）
let threw = null; 
try { await runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 2000)'], { workspace: '.', timeoutMs: 300, timeoutCode: 'TIMEOUT', notAvailableCode: 'N/A', throwOnTimeout: true, subtask: { id: 't2' } }); } catch (error) { threw = error; } 
check('throwOnTimeout throws TimeoutError', threw instanceof TimeoutError && threw.message === 'TIMEOUT'); 

// 3) withRetry：第 1 次 throw TimeoutError、第 2 次成功 → 返回成功且重试 1 次
let calls = 0; 
const ok = await withRetry(function() { calls += 1; if (calls === 1) throw new TimeoutError('TIMEOUT'); return 'ok'; }, { maxRetries: 2, backoffMs: 5 }); 
check('withRetry retries TimeoutError then succeeds', ok === 'ok' && calls === 2); 

// 4) withRetry：maxRetries 用尽 → throw TimeoutError，fn 共调用 maxRetries+1 次（P3 修复前此处进程悬挂）
calls = 0; 
let exhausted = null; 
try { await withRetry(function() { calls += 1; throw new TimeoutError('TIMEOUT'); }, { maxRetries: 2, backoffMs: 5 }); } catch (error) { exhausted = error; } 
check('withRetry exhausts maxRetries (3 attempts) then throws', exhausted instanceof TimeoutError && calls === 3); 

// 5) ENOENT → resolve notAvailableCode（探测语义不变）
const missing = await runCommand('definitely-not-a-real-binary-xyz', ['--version'], { workspace: '.', timeoutMs: 3000, timeoutCode: 'TIMEOUT', notAvailableCode: 'NOT_AVAILABLE', subtask: { id: 't5' } }); 
check('ENOENT resolves notAvailableCode', missing && missing.ok === false && missing.error === 'NOT_AVAILABLE'); 

// 6) 非重试错误不重试（契约违约不可重试）
calls = 0; 
let notRetried = null; 
try { await withRetry(function() { calls += 1; throw new Error('boom'); }, { maxRetries: 3, backoffMs: 5 }); } catch (error) { notRetried = error; } 
check('non-retryable error not retried', notRetried && notRetried.message === 'boom' && calls === 1); 

console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)'); 
process.exitCode = failures === 0 ? 0 : 1; 
