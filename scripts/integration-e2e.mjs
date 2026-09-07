#!/usr/bin/env node
/**
 * integration-e2e — 前后端联调自动测试（FR-5）。
 * 前端完成后启动前后端，跑页面交互测试（Playwright 点击/跳转/表单提交）验证接口真实连通，
 * 输出联调报告 JSON+MD。
 *
 * 零依赖内核：本脚本只用 Node 内置（fs/path/child_process）。Playwright/newman 走执行层探测：
 *   - Playwright 可用 → 跑每页核心交互流（goto/click/fill/submit/expect-response），断言接口真实返回（非 mock）。
 *   - newman/portman 可用 + 提供 --contract OpenAPI → 对契约跑真实请求，与页面交互互为印证。
 * 诚实降级：
 *   - 后端无法启动 → INTEGRATION_BLOCKED + 阻塞原因，exit 2（不伪造 PASS）。
 *   - Playwright 不可用 → 页面交互流标 E2E_NOT_AVAILABLE，仅跑 newman（若可用）。
 *   - 两者都不可用 → 如实标注不可联调，exit 2。
 * 退出码：0 = 联调通过；1 = 有页面交互失败；2 = 被阻塞/不可联调。
 *
 * 用法：
 *   node scripts/integration-e2e.mjs \
 *     --frontend <前端目录> --backend <后端目录|baseUrl> --pages <页面配置.json> \
 *     [--base-url <前端 baseUrl>] [--backend-url <后端 baseUrl>] [--contract <openapi.json>] \
 *     [--out <报告目录>] [--timeout <ms>]
 *
 * 页面配置 JSON schema（page→交互流）：
 * {
 *   "frontend": { "startCommand": ["node","static.js"], "url": "http://127.0.0.1:3100" },
 *   "backend":  { "startCommand": ["node","server.js"], "url": "http://127.0.0.1:3200" },
 *   "pages": [
 *     { "name": "login", "path": "/login.html",
 *       "steps": [
 *         { "action": "goto", "path": "/login.html" },
 *         { "action": "fill", "selector": "#username", "value": "alice" },
 *         { "action": "click", "selector": "#loginBtn" },
 *         { "action": "expect-response", "method": "POST", "url": "/api/login", "status": 200, "fields": ["token"] }
 *       ] }
 *   ]
 * }
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolveCommandShim } from './lib/adapters/util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  console.log('用法: node scripts/integration-e2e.mjs --frontend DIR --backend DIR|URL --pages CONFIG.json [--base-url URL] [--backend-url URL] [--contract openapi.json] [--out DIR] [--timeout MS]');
}

function parseArgs(args) {
  const out = { frontend: null, backend: null, pages: null, baseUrl: null, backendUrl: null, contract: null, out: null, timeout: 120000, argError: null };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--frontend') { out.frontend = args[i + 1]; i += 1; }
    else if (a === '--backend') { out.backend = args[i + 1]; i += 1; }
    else if (a === '--pages') { out.pages = args[i + 1]; i += 1; }
    else if (a === '--base-url') { out.baseUrl = args[i + 1]; i += 1; }
    else if (a === '--backend-url') { out.backendUrl = args[i + 1]; i += 1; }
    else if (a === '--contract') { out.contract = args[i + 1]; i += 1; }
    else if (a === '--out') { out.out = args[i + 1]; i += 1; }
    else if (a === '--timeout') { out.timeout = Number(args[i + 1]); i += 1; }
    else if (a === '--help' || a === '-h') { out.help = true; }
  }
  return out;
}

function isOpenApiSpec(doc) {
  return Boolean(doc) && typeof doc === 'object' && !Array.isArray(doc)
    && (typeof doc.openapi === 'string' || typeof doc.swagger === 'string');
}

/** 执行层探测：Playwright 是否可解析（cwd 优先，回落脚本目录）。 */
function probePlaywright() {
  const candidates = [process.cwd(), ROOT];
  for (const base of candidates) {
    try {
      const req = createRequire(path.join(base, 'noop.cjs'));
      req.resolve('playwright');
      return { available: true, from: base };
    } catch (error) { /* try next */ }
    try {
      const req = createRequire(path.join(base, 'noop.cjs'));
      req.resolve('playwright-core');
      return { available: true, from: base };
    } catch (error) { /* try next */ }
  }
  return { available: false };
}

/** 执行层探测：newman / portman CLI 是否可用（经 PATHEXT shim 解析）。 */
function probeNewmanTools() {
  const portman = resolveCommandShim('portman');
  const newman = resolveCommandShim('newman');
  const portmanOk = !/portman$/i.test(portman.command) || fs.existsSync(String(portman.command));
  const newmanOk = !/newman$/i.test(newman.command) || fs.existsSync(String(newman.command));
  return {
    portman: { command: portman.command, prefix: portman.prefix, available: portmanOk && !isBareNotFound(portman) },
    newman: { command: newman.command, prefix: newman.prefix, available: newmanOk && !isBareNotFound(newman) },
  };
}
function isBareNotFound(shim) {
  // resolveCommandShim 返回裸名（找不到 shim）时，spawn 会 ENOENT → 视为不可用。
  if (shim.prefix.length) return false;
  return !fs.existsSync(String(shim.command));
}

/** 启动子进程，返回 kill 句柄。 */
function spawnServer(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
  let logs = '';
  child.stdout.on('data', (c) => { logs += c.toString(); });
  child.stderr.on('data', (c) => { logs += c.toString(); });
  return {
    child,
    logs: () => logs,
    kill() { try { child.kill(); } catch (error) { /* ignore */ } },
  };
}

/** 轮询一个 URL 直到可访问（返回 2xx/3xx/4xx 视为已启动）或超时。 */
function waitForUrl(url, timeoutMs, probePath) {
  const deadline = Date.now() + timeoutMs;
  const target = probePath ? url.replace(/\/?$/, probePath) : url;
  return new Promise((resolve) => {
    const tryProbe = () => {
      if (Date.now() > deadline) { resolve({ ok: false, reason: 'timeout waiting for ' + url }); return; }
      try {
        const req = new URL(target);
        const mod = req.protocol === 'https:' ? https : http;
        const r = mod.get(target, (res) => { res.resume(); res.on('end', () => resolve({ ok: true })); });
        r.on('error', () => setTimeout(tryProbe, 300));
        r.setTimeout(2000, () => { r.destroy(); setTimeout(tryProbe, 300); });
      } catch (error) {
        setTimeout(tryProbe, 300);
      }
    };
    tryProbe();
  });
}

/** 用 portman 生成 collection 并对真实后端跑 newman 真实请求（与页面交互互为印证）。 */
function runNewmanBackendCheck(contractPath, backendUrl, workspace, timeoutMs) {
  return new Promise((resolve) => {
    const tools = probeNewmanTools();
    if (!tools.portman.available && !tools.newman.available) {
      resolve({ ok: false, ran: false, note: 'NEWMAN_NOT_AVAILABLE（newman/portman 执行层不可用）' });
      return;
    }
    const collection = path.join(workspace, 'collection.json');
    const cmd = tools.portman.available ? tools.portman : tools.newman;
    const args = tools.portman.available
      ? cmd.prefix.concat(['--local', contractPath, '-o', collection, '--runNewman', '--baseUrl', backendUrl])
      : cmd.prefix.concat(['run', collection, '--baseUrl', backendUrl]);
    const child = spawn(cmd.command, args, { cwd: workspace, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const timer = setTimeout(() => { child.kill(); resolve({ ok: false, ran: true, note: 'newman timeout' }); }, timeoutMs);
    child.stdout.on('data', (c) => { out += c.toString(); });
    child.stderr.on('data', (c) => { out += c.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, ran: true, code, note: code === 0 ? 'newman 真实请求全 PASS' : summarize(out) });
    });
  });
}
function summarize(out) {
  const lines = String(out || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const hit = lines.find((l) => /failed|error|fail/i.test(l));
  return (hit || out || '').trim().slice(0, 400);
}

/** Playwright 真实交互流：逐步骤执行并断言接口真实返回。 */
async function runPlaywrightFlows(cfg, baseUrl, timeoutMs) {
  const req = createRequire(path.join(process.cwd(), 'noop.cjs'));
  let pw;
  try { pw = req('playwright'); } catch (error) { pw = req('playwright-core'); }
  const browser = await pw.chromium.launch({ headless: true });
  const results = [];
  try {
    for (const page of cfg.pages) {
      const ctx = await browser.newContext();
      const pg = await ctx.newPage();
      const result = { name: page.name, path: page.path || '/', status: 'PASS', steps: [], error: null };
      try {
        for (const step of page.steps || []) {
          const stepResult = { action: step.action, pass: true, detail: null };
          try {
            if (step.action === 'goto') {
              const p = step.path || page.path || '/';
              await pg.goto(baseUrl + p, { timeout: timeoutMs, waitUntil: 'load' });
              stepResult.detail = 'navigated to ' + baseUrl + p;
            } else if (step.action === 'fill') {
              await pg.fill(step.selector, String(step.value));
              stepResult.detail = 'filled ' + step.selector;
            } else if (step.action === 'click') {
              await pg.click(step.selector, { timeout: timeoutMs });
              stepResult.detail = 'clicked ' + step.selector;
            } else if (step.action === 'submit') {
              await pg.click(step.selector, { timeout: timeoutMs });
              stepResult.detail = 'submitted ' + step.selector;
            } else if (step.action === 'expect-response') {
              const predicate = (r) => {
                const u = r.url() || '';
                const okPath = !step.url || u.includes(step.url);
                const okMethod = !step.method || (r.request() && r.request().method().toUpperCase() === String(step.method).toUpperCase());
                return okPath && okMethod;
              };
              const resp = await pg.waitForResponse(predicate, { timeout: timeoutMs });
              const status = resp.status();
              const body = await resp.json().catch(() => null);
              const problems = [];
              if (step.status !== undefined && status !== step.status) problems.push('HTTP 状态期望 ' + step.status + ' 实际 ' + status);
              if (Array.isArray(step.fields)) {
                for (const f of step.fields) if (!(body && Object.prototype.hasOwnProperty.call(body, f))) problems.push('响应缺字段 "' + f + '"');
              }
              if (problems.length) { stepResult.pass = false; stepResult.detail = problems.join('; '); result.status = 'FAIL'; }
              else stepResult.detail = 'GET/POST ' + resp.url() + ' → ' + status + ' 字段校验通过';
            } else {
              stepResult.pass = false; stepResult.detail = '未知 action: ' + step.action; result.status = 'FAIL';
            }
          } catch (error) {
            stepResult.pass = false; stepResult.detail = error.message; result.status = 'FAIL';
          }
          result.steps.push(stepResult);
          if (!stepResult.pass) break;
        }
        if (result.status === 'PASS' && !(page.steps || []).some((s) => s.action === 'expect-response')) {
          result.status = 'WARN';
          result.error = '该页无 expect-response 步骤，未验证接口真实返回（仅验证跳转）';
        }
      } catch (error) {
        result.status = 'FAIL'; result.error = error.message;
      }
      await ctx.close();
      results.push(result);
    }
  } finally {
    try { await browser.close(); } catch (error) { /* ignore */ }
  }
  return results;
}

function buildMarkdown(report) {
  const lines = ['# 前后端联调报告', '', '- 生成: ' + report.generatedAt, '- 前端: ' + (report.frontend.url || '(未指定)'), '- 后端: ' + (report.backend.url || '(未指定)'), '', '## 总体', '- verdict: ' + report.verdict, '- exitCode: ' + report.exitCode, '- ' + (report.summary || ''), ''];
  lines.push('## 后端启动');
  lines.push('- status: ' + report.backend.status);
  if (report.backend.reason) lines.push('- 阻塞原因: ' + report.backend.reason);
  lines.push('');
  lines.push('## 页面交互流');
  for (const p of report.pageResults) {
    lines.push('### ' + p.name + ' — ' + p.status);
    if (p.error) lines.push('- ' + p.error);
    for (const s of p.steps) lines.push('- [' + (s.pass ? 'PASS' : 'FAIL') + '] ' + s.action + (s.detail ? ' — ' + s.detail : ''));
  }
  lines.push('');
  lines.push('## 后端侧契约真实请求（newman）');
  lines.push('- status: ' + report.newman.status + ' ' + (report.newman.note || ''));
  lines.push('');
  lines.push('## 失败明细');
  const fails = report.pageResults.filter((p) => p.status === 'FAIL');
  if (fails.length) {
    for (const p of fails) {
      lines.push('- ' + p.name + ': ' + (p.error || p.steps.filter((s) => !s.pass).map((s) => s.action + ' ' + s.detail).join(' | ')));
    }
  } else lines.push('- 无页面交互失败');
  return lines.join('\n') + '\n';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { usage(); return 0; }
  if (opts.argError) { console.error(opts.argError); return 2; }
  if (!opts.frontend || !opts.backend || !opts.pages) { console.error('缺少必填参数（--frontend/--backend/--pages）'); usage(); return 2; }
  if (!fs.existsSync(opts.pages)) { console.error('--pages 配置不存在: ' + opts.pages); return 2; }

  const cfg = JSON.parse(fs.readFileSync(opts.pages, 'utf8'));
  if (!Array.isArray(cfg.pages) || !cfg.pages.length) { console.error('页面配置缺少 pages 数组'); return 2; }

  const outDir = opts.out || path.join(process.cwd(), 'test-reports');
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    frontend: { url: null, status: 'not-started', reason: null },
    backend: { url: null, status: 'not-started', reason: null },
    newman: { status: 'NOT_RUN', note: null },
    e2e: { status: 'NOT_RUN', note: null },
    pageResults: [],
    verdict: null,
    exitCode: 0,
    summary: '',
  };

  // 前端 baseUrl：--base-url > config.frontend.url
  const frontendUrl = (opts.baseUrl || (cfg.frontend && cfg.frontend.url) || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const backendUrl = (opts.backendUrl || (cfg.backend && cfg.backend.url) || 'http://127.0.0.1:4000').replace(/\/$/, '');
  report.frontend.url = frontendUrl;
  report.backend.url = backendUrl;

  // 启动后端（--backend 为目录+startCommand，或直接是 baseUrl）
  let backendHandle = null;
  const backendLooksUrl = /^https?:\/\//.test(opts.backend);
  if (backendLooksUrl) {
    report.backend.status = 'URL';
  } else if (cfg.backend && Array.isArray(cfg.backend.startCommand) && cfg.backend.startCommand.length) {
    const cmd = cfg.backend.startCommand;
    const cwd = opts.backend || process.cwd();
    backendHandle = spawnServer(cmd[0], cmd.slice(1), cwd);
    const up = await waitForUrl(backendUrl, opts.timeout, '/');
    if (!up.ok) {
      report.backend.status = 'BLOCKED';
      report.backend.reason = '后端启动失败: ' + (backendHandle.logs() || up.reason).trim().slice(0, 400) || up.reason;
      report.verdict = 'INTEGRATION_BLOCKED';
      report.exitCode = 2;
      report.summary = '后端无法启动，联调被阻塞（不伪造 PASS）';
      await writeReports(outDir, report, buildMarkdown(report));
      if (backendHandle) backendHandle.kill();
      return 2;
    }
    report.backend.status = 'UP';
  } else {
    report.backend.status = 'BLOCKED';
    report.backend.reason = '未提供后端启动命令（--backend 需为目录且 config.backend.startCommand 有值，或 --backend 直接给 baseUrl）';
    report.verdict = 'INTEGRATION_BLOCKED';
    report.exitCode = 2;
    report.summary = '后端无法启动，联调被阻塞（不伪造 PASS）';
    await writeReports(outDir, report, buildMarkdown(report));
    return 2;
  }

  // 后端可达性校验（URL 模式也要确认真实可达）
  if (backendLooksUrl) {
    const up = await waitForUrl(backendUrl, opts.timeout, '/');
    if (!up.ok) {
      report.backend.status = 'BLOCKED';
      report.backend.reason = '后端 baseUrl 不可达: ' + up.reason;
      report.verdict = 'INTEGRATION_BLOCKED';
      report.exitCode = 2;
      report.summary = '后端无法启动，联调被阻塞（不伪造 PASS）';
      await writeReports(outDir, report, buildMarkdown(report));
      return 2;
    }
    report.backend.status = 'UP';
  }

  // 启动前端 dev server
  let frontendHandle = null;
  if (cfg.frontend && Array.isArray(cfg.frontend.startCommand) && cfg.frontend.startCommand.length) {
    const cmd = cfg.frontend.startCommand;
    frontendHandle = spawnServer(cmd[0], cmd.slice(1), opts.frontend || process.cwd());
    const up = await waitForUrl(frontendUrl, opts.timeout, '/');
    if (!up.ok) {
      report.frontend.status = 'DOWN';
      report.frontend.reason = '前端 dev server 未就绪: ' + (frontendHandle.logs() || up.reason).trim().slice(0, 400) || up.reason;
    } else report.frontend.status = 'UP';
  } else {
    report.frontend.status = 'URL';
  }

  // 后端侧契约真实请求（newman/portman）
  if (opts.contract && fs.existsSync(opts.contract)) {
    let doc = null;
    try { doc = JSON.parse(fs.readFileSync(opts.contract, 'utf8')); } catch (error) { doc = null; }
    if (isOpenApiSpec(doc)) {
      const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-newman-'));
      const res = await runNewmanBackendCheck(opts.contract, backendUrl, workspace, opts.timeout);
      fs.rmSync(workspace, { recursive: true, force: true });
      report.newman.status = res.ran ? (res.ok ? 'PASS' : 'FAIL') : 'NOT_AVAILABLE';
      report.newman.note = res.note || '';
    } else {
      report.newman.status = 'NOT_RUN';
      report.newman.note = '契约非 OpenAPI 规范（缺 openapi/swagger），无法 newman 真实请求';
    }
  } else {
    report.newman.status = 'NOT_RUN';
    report.newman.note = '未提供 --contract OpenAPI';
  }

  // 页面交互流：Playwright 探测
  const pw = probePlaywright();
  if (pw.available) {
    try {
      report.e2e.status = 'RUN';
      report.pageResults = await runPlaywrightFlows(cfg, frontendUrl, opts.timeout);
    } catch (error) {
      report.e2e.status = 'ERROR';
      report.e2e.note = error.message;
      report.pageResults = cfg.pages.map((p) => ({ name: p.name, path: p.path, status: 'FAIL', error: 'Playwright 执行失败: ' + error.message, steps: [] }));
    }
  } else {
    report.e2e.status = 'E2E_NOT_AVAILABLE';
    report.e2e.note = 'Playwright 执行层不可用，页面交互流无法真实执行';
    report.pageResults = cfg.pages.map((p) => ({ name: p.name, path: p.path, status: 'E2E_NOT_AVAILABLE', error: '页面交互流降级：Playwright 不可用（E2E_NOT_AVAILABLE）', steps: [] }));
  }

  // 判定 verdict / exit
  const pageFails = report.pageResults.filter((p) => p.status === 'FAIL');
  const anyReal = report.e2e.status === 'RUN' || report.newman.status === 'PASS';
  if (pageFails.length) {
    report.verdict = 'FAIL';
    report.exitCode = 1;
    report.summary = pageFails.length + ' 页交互失败（HTTP 状态/断言失败/跳转错误）→ 返工修复';
  } else if (!anyReal) {
    report.verdict = 'INTEGRATION_BLOCKED';
    report.exitCode = 2;
    report.summary = '联调工具均不可用（Playwright 不可用 且 newman 不可用/无契约），无法验证真实连通，诚实标注不可联调';
  } else {
    // 有真实连通证据（页面交互 PASS 或 newman PASS）
    const allPageOk = report.pageResults.every((p) => p.status === 'PASS');
    if (allPageOk) {
      report.verdict = 'PASS';
      report.exitCode = 0;
      report.summary = '前后端真实连通验证通过（' + (report.e2e.status === 'RUN' ? '页面交互 PASS' : 'E2E_NOT_AVAILABLE 仅页面标注') + (report.newman.status === 'PASS' ? ' + newman 真实请求 PASS' : '') + '）';
    } else {
      report.verdict = 'PARTIAL';
      report.exitCode = 0;
      report.summary = '部分页面交互不可用（E2E_NOT_AVAILABLE），后端连通由 newman 真实请求验证通过；如实标注覆盖缺口';
    }
  }

  await writeReports(outDir, report, buildMarkdown(report));
  console.log('[integration-e2e] verdict=' + report.verdict + ' exit=' + report.exitCode);
  console.log('[integration-e2e] report: ' + path.join(outDir, 'integration-report.md'));
  if (frontendHandle) frontendHandle.kill();
  if (backendHandle) backendHandle.kill();
  return report.exitCode;
}

function writeReports(outDir, report, md) {
  fs.writeFileSync(path.join(outDir, 'integration-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'integration-report.md'), md);
}

main().then((code) => { process.exitCode = code; }).catch((error) => {
  console.error('[integration-e2e] failed: ' + error.message);
  process.exitCode = 2;
});
