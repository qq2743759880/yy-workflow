import { RetryableError, TimeoutError } from './errors.mjs'; 
/** P1 失败自动恢复 —— 宿主解析与跨宿主重试（零依赖）。
 *  - resolveHosts(options)：把 --hosts（逗号分隔命令串）或 config executor.hosts（命令数组列表）
 *    解析为 [{ command, model, commandKey }] 数组；command 保留完整 argv（含 --model 后缀，原样投喂宿主），
 *    model 为提取的视角模型（无则 null），commandKey 为去掉 --model 的规范化命令（用于判 stage/去重）。
 *  - retryAcrossHosts(fn, { hosts, primary, ... })：按 primary（默认宿主 opts.exec）+ hosts（备选宿主）
 *    顺序逐宿主逐模型尝试；prompt 宿主的诚实降级（executor unavailable/failed/empty output）视为可恢复失败，
 *    自动换下一宿主重跑同一 brief；换宿主/换视角记录 recovery 链 [{stage, from, to, attempt}]。
 *    全部宿主失败 → 返回最后一宿主的诚实降级结果（不假报成功），由上层标 degraded + warning。
 */
function tokenizeCommandLine(line) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) { tokens.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]); }
  return tokens;
}
function splitHostsString(s) {
  const parts = [];
  let cur = '';
  let quote = null;
  for (const ch of s) {
    if (quote) { cur += ch; if (ch === quote) quote = null; }
    else if (ch === '"' || ch === "'") { quote = ch; cur += ch; }
    else if (ch === ',') { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  parts.push(cur);
  return parts;
}
function parseHostCommand(tokens) {
  let model = null;
  const command = [];
  const commandKey = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t === '--model' && i + 1 < tokens.length && !String(tokens[i + 1]).startsWith('--')) {
      model = tokens[i + 1];
      command.push(t, tokens[i + 1]);
      i += 1;
      continue;
    }
    command.push(t);
    commandKey.push(t);
  }
  return { command, commandKey, model };
}
function entryKey(e) {
  return JSON.stringify([e.commandKey || e.command, e.model || null]);
}
function entryLabel(e) {
  const cmd = (e && Array.isArray(e.command)) ? e.command : [];
  let label = null;
  for (const t of cmd) {
    if (!t || t === 'node' || String(t).toLowerCase().endsWith('node.exe') || String(t).startsWith('--')) continue;
    label = String(t).split(/[\\/]/).pop();
    break;
  }
  if (!label && cmd.length) label = String(cmd[0]).split(/[\\/]/).pop();
  return (label || 'host') + (e.model ? '@' + e.model : '');
}
function isModelSwitch(a, b) {
  return JSON.stringify(a.commandKey || a.command) === JSON.stringify(b.commandKey || b.command) && a.model !== b.model;
}
function isRecoverableHostFailure(result) {
  return !!(result && result.ok === true && typeof result.degraded === 'string' && /^brief-only \(executor/.test(result.degraded));
}
/** 解析备选宿主来源（优先级 --hosts > config executor.hosts > 无）。 */
export function resolveHosts(options = {}) {
  let raw = options.hosts;
  if (raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0)) raw = options.configHosts;
  if (raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0)) return [];
  const segments = [];
  if (typeof raw === 'string') {
    for (const seg of splitHostsString(raw)) if (seg.trim()) segments.push(seg.trim());
  } else if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') { for (const seg of splitHostsString(item)) if (seg.trim()) segments.push(seg.trim()); }
      else if (Array.isArray(item) && item.length) segments.push(item.slice());
      else if (item && Array.isArray(item.command) && item.command.length) segments.push(item.command.slice());
    }
  }
  const out = [];
  for (const seg of segments) {
    const tokens = Array.isArray(seg) ? seg : tokenizeCommandLine(seg);
    const parsed = parseHostCommand(tokens);
    out.push({ command: parsed.command, model: parsed.model, commandKey: parsed.commandKey });
  }
  return out;
}
/** 跨宿主重试：primary（--exec 主宿主）→ hosts 逐项尝试；返回 { result, recovery }。 */
export async function retryAcrossHosts(fn, options = {}) {
  const hosts = Array.isArray(options.hosts) ? options.hosts : [];
  const chain = [];
  if (Array.isArray(options.primary) && options.primary.length) chain.push(parseHostCommand(options.primary.slice()));
  for (const h of hosts) {
    if (!h || !Array.isArray(h.command)) continue;
    const last = chain[chain.length - 1];
    if (last && entryKey(last) === entryKey(h)) continue;
    chain.push(h);
  }
  if (!chain.length) return { result: await withRetry(function() { return fn(null); }, { maxRetries: options.maxRetries, backoffMs: options.backoffMs }), recovery: [] };
  let lastError = null;
  let result = null;
  const recovery = [];
  for (let i = 0; i < chain.length; i += 1) {
    const entry = chain[i];
    try {
      result = await withRetry(function() { return fn(entry); }, { maxRetries: options.maxRetries, backoffMs: options.backoffMs });
    } catch (error) {
      lastError = error;
      if (i + 1 < chain.length && (error instanceof TimeoutError || error instanceof RetryableError)) {
        recovery.push({ stage: isModelSwitch(chain[i], chain[i + 1]) ? 'model-switch' : 'host-switch', from: entryLabel(chain[i]), to: entryLabel(chain[i + 1]), attempt: recovery.length + 2 });
        continue;
      }
      throw error;
    }
    if (isRecoverableHostFailure(result)) {
      if (i + 1 < chain.length) {
        recovery.push({ stage: isModelSwitch(chain[i], chain[i + 1]) ? 'model-switch' : 'host-switch', from: entryLabel(chain[i]), to: entryLabel(chain[i + 1]), attempt: recovery.length + 2 });
        continue;
      }
      break;
    }
    break;
  }
  if (result) return { result, recovery };
  throw lastError;
} 
export async function withRetry(fn, options = {}) { 
  let maxRetries = options.maxRetries; 
  if (maxRetries === undefined) maxRetries = 2; 
  let backoffMs = options.backoffMs; 
  if (backoffMs === undefined) backoffMs = 50; 
  let attempt = 0; 
  while (true) { 
    try { return await fn(attempt); } catch (error) { 
      if (!(error instanceof RetryableError) && !(error instanceof TimeoutError)) throw error; 
      if (attempt >= maxRetries) throw error; 
      // backoff 等待是执行流程的一部分：不 unref，否则事件循环空转时 await 永久挂起（纯库/单测场景）
      await new Promise(function(resolve) { setTimeout(resolve, backoffMs * Math.pow(2, attempt)); }); 
      attempt += 1; 
    } 
  } 
} 
export function createCircuitBreaker(options = {}) { 
  let threshold = options.threshold; 
  if (threshold === undefined) threshold = 3; 
  let failures = 0; 
  let open = false; 
  return { get state() { return open ? 'open' : 'closed'; }, async run(fn, fallbackValue) { if (open) return fallbackValue; try { const result = await fn(); failures = 0; return result; } catch (error) { failures += 1; if (failures >= threshold) open = true; throw error; } }, reset() { failures = 0; open = false; } }; 
} 
export async function fallback(fn, value) { try { return await fn(); } catch (error) { return typeof value === 'function' ? value(error) : value; } }
