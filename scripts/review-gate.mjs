#!/usr/bin/env node
/**
 * TT 批判能力代码级 gate（把 SKILL.md §7 硬闸门可校验化）。
 * 校验产出：task{id}-技术批判.md（≥3 条有效批判，每条含竞品 URL + 日期）+ task{id}-优化修改方案.md + plans/critique-backlog-tracker.md 已登记。
 * 规划闸门（FR-203）：--plan <dev-plan.md> 校验含「需求前提挑战」「规划自审」区块（事前自审，与事后批判两层并存）。
 * 任一未过 → exit 1。用法：
 *   node scripts/review-gate.mjs [--dir PATH] [--id taskNN] [--self-test]
 *   node scripts/review-gate.mjs --plan <dev-plan.md路径>
 *   node scripts/review-gate.mjs --gate <gate产物.md路径>
 *     （C-31③：--gate <产物.md> 核对产物「阶段机验」已回填——占位 FAIL 具名 / 回填 PASS / 删字段 FAIL 具名；
 *      --gate 无参 = 6 个 gate 模板「阶段机验」字段在场检查（模板合法态即占位，与 validate H7 同向））
 * 竞品 URL 真实性机验（--verify-urls，E1）：对批判文档每条 URL 做真实可达性探测
 *   （GET/HEAD，短超时）；网络可用时 HTTP 200/301/302 → PASS 真实对标，不可达/超时/404 → FAIL
 *   （该条 URL 不计有效）；整网不可用（整体失败）→ 诚实标注 VERIFY_SKIPPED（不因断网误杀，也不假装验证过）。
 *   每 URL 输出 PASS/FAIL/SKIPPED + 实际状态码。代理走 $TT_HTTP_PROXY env（可选，缺省直连；
 *   未设则回退 $HTTPS_PROXY/$HTTP_PROXY）。
 * 批判反哺自动化（--auto-register <dir> [--id taskNN]）：校验通过后自动登记
 *   plans/critique-backlog-tracker.md（新序号延续 C-13/C-14…）+ 生成
 *   docs/history/tasks/critique-<序号>-task.md 优化任务文档，然后 exit 0；未过仍 exit 1。
 *   幂等：按「来源文件名 + 批判标题」查重，重跑不重复登记。
 */
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const URL_RE = /https?:\/\/\S+/i;
const DATE_RE = /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/;
const LEVEL_RE = /\bP[012]\b/i;

/* ===== E1：竞品 URL 真实性机验（机器验证，非格式验证）=====
 * 探测用 Node http/https 直连；可选 $TT_HTTP_PROXY（HTTP 代理：http/https 目标都可走 CONNECT 隧道）。
 * 状态判定：HTTP 200/301/302（跟随重定向）→ PASS；其余状态码/网络错误/超时 → FAIL；
 * 所有 URL 均因网络层失败（DNS/连接/隧道拒绝）→ 归为网络不可用 → VERIFY_SKIPPED。 */

/** 读取可选代理：$TT_HTTP_PROXY 优先；缺省回退 $HTTPS_PROXY/$HTTP_PROXY（尊重常见 CI 代理约定）。 */
export function effectiveProxy() {
  const env = process.env;
  return (env.TT_HTTP_PROXY || env.HTTPS_PROXY || env.HTTP_PROXY || '').trim() || null;
}

/** 对单个 URL 做真实可达性探测（GET；跟随 301/302/303/307/308 重定向，最多 maxRedirects 次）。
 *  返回 { code: number|0, kind: 'ok'|'redirect'|'notfound'|'refused'|'timeout'|'dns'|'http'|'proto', status }。 */
export function probeUrl(urlStr, { proxy = null, timeoutMs = 8000, maxRedirects = 4, depth = 0 } = {}) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(urlStr); } catch { return resolve({ code: 0, kind: 'proto', status: 'BAD_URL' }); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return resolve({ code: 0, kind: 'proto', status: 'UNSUPPORTED_SCHEME' });
    const host = u.hostname;
    const port = u.port || (u.protocol === 'https:' ? 443 : 80);
    const isHttps = u.protocol === 'https:';
    const reqPath = u.pathname + u.search;
    const probeTimer = setTimeout(() => {
      try { clientReq && clientReq.destroy(); } catch { /* ignore */ }
      if (activeSocket && !activeSocket.destroyed) { try { activeSocket.destroy(); } catch { /* ignore */ } }
      resolve({ code: 0, kind: 'timeout', status: 'TIMEOUT' });
    }, timeoutMs);
    probeTimer.unref && probeTimer.unref();

    let clientReq = null; // eslint-disable-line no-use-before-define
    let activeSocket = null; // eslint-disable-line no-use-before-define
    const finish = (r) => {
      clearTimeout(probeTimer);
      // 立即断开活动 socket（agent:false 虽不池化，仍显式销毁避免事件循环/句柄残留挂死进程）
      const sock = activeSocket || (clientReq && clientReq.socket);
      if (sock && !sock.destroyed) { try { sock.destroy(); } catch { /* ignore */ } }
      resolve(r);
    };
    const headers = { Host: host, 'User-Agent': 'tt-review-gate/2.8 (URL verifier)' };
    const onResponse = (res) => {
      const code = res.statusCode;
      // 2xx / 301 / 302 → 可达（含跳转后的最终落点，避免 301 永久迁移误杀）；403/4xx/5xx → 按语义归类
      if (code >= 200 && code < 400) { res.resume(); return finish({ code, kind: 'ok', status: String(code) }); }
      if (code === 404) { res.resume(); return finish({ code, kind: 'notfound', status: 'HTTP ' + code }); }
      if (code >= 400 && code < 500) { res.resume(); return finish({ code, kind: 'http', status: 'HTTP ' + code }); }
      if (code >= 500) { res.resume(); return finish({ code, kind: 'http', status: 'HTTP ' + code }); }
      res.resume();
      return finish({ code: code || 0, kind: 'http', status: 'HTTP ' + (code || '?') });
    };
    // 重定向（301/302/303/307/308）且带 Location → 递归跟随；无 Location → 按 200 系可达处理
    const onRedirect = (res) => {
      const loc = res.headers.location;
      res.resume();
      if (!loc) return finish({ code: res.statusCode, kind: 'ok', status: String(res.statusCode) });
      if (depth >= maxRedirects) return finish({ code: res.statusCode, kind: 'redirect', status: 'TOO_MANY_REDIRECTS' });
      let next;
      try { next = new URL(loc, urlStr).toString(); } catch { return finish({ code: res.statusCode, kind: 'redirect', status: 'BAD_LOCATION' }); }
      const keepAlive = setTimeout(() => probeUrl(next, { proxy, timeoutMs, maxRedirects, depth: depth + 1 }).then(finish), 0);
      keepAlive.unref && keepAlive.unref();
    };
    const onError = (e) => {
      const msg = (e && (e.code || e.message)) || '';
      if (/timeout|timed out/i.test(msg)) return finish({ code: 0, kind: 'timeout', status: 'TIMEOUT' });
      if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) return finish({ code: 0, kind: 'dns', status: 'DNS_' + msg });
      if (/ECONNREFUSED|ENETUNREACH|EHOSTUNREACH/i.test(msg)) return finish({ code: 0, kind: 'refused', status: msg });
      return finish({ code: 0, kind: 'net', status: msg || 'NET_ERROR' });
    };

    if (proxy && isHttps) {
      // HTTPS 目标经 HTTP 代理：CONNECT 建隧道 → tls 握手 → 在已加密 socket 上发 GET
      //（https.request 的 createConnection 会被原样使用、不再自动 TLS 包裹，故须先手动 tls.connect）
      const pu = new URL(proxy);
      const tunnel = http.request({ host: pu.hostname, port: pu.port || 80, method: 'CONNECT', path: host + ':' + port, agent: false });
      tunnel.on('connect', (res, socket) => {
        activeSocket = socket;
        if (res.statusCode !== 200) { try { socket.destroy(); } catch { /* ignore */ } finish({ code: 0, kind: 'refused', status: 'PROXY_CONNECT_' + res.statusCode }); return; }
        const tlsSock = tls.connect({ socket, servername: host }, () => {
          const req = http.request({ host, port, path: reqPath, method: 'GET', headers, createConnection: () => tlsSock })
            .on('response', (r) => (r.statusCode >= 300 && r.statusCode < 400) ? onRedirect(r) : onResponse(r))
            .on('error', onError);
          clientReq = req;
          req.end();
        });
        tlsSock.on('error', onError);
      });
      tunnel.on('error', onError);
      tunnel.end();
      clientReq = tunnel;
    } else if (proxy) {
      // HTTP 目标经 HTTP 代理：绝对 URI 转发
      const pu = new URL(proxy);
      const req = http.request({ host: pu.hostname, port: pu.port || 80, method: 'GET', path: urlStr, headers, agent: false })
        .on('response', (r) => (r.statusCode >= 300 && r.statusCode < 400) ? onRedirect(r) : onResponse(r))
        .on('error', onError);
      clientReq = req;
      req.end();
    } else {
      const mod = isHttps ? https : http;
      const req = mod.request({ host, port, path: reqPath, method: 'GET', headers, agent: false })
        .on('socket', (s) => { activeSocket = s; })
        .on('response', (r) => (r.statusCode >= 300 && r.statusCode < 400) ? onRedirect(r) : onResponse(r))
        .on('error', onError);
      clientReq = req;
      req.end();
    }
  });
}

/** 从批判条目/文档收集待验证 URL（去重保留序，需各自带「是否计入有效批判」的上下文）。 */
export function collectUrls(text) {
  const entries = text ? parseCritiqueEntries(text) : [];
  const seen = new Set();
  const urls = [];
  for (const e of entries) {
    if (!e.valid) continue;
    const m = (e.url || '').match(URL_RE);
    if (!m) continue;
    let raw = m[0];
    raw = raw.replace(/[），,)>\]"'》】。;；]+$/, '');
    try { const nu = new URL(raw); raw = nu.toString(); } catch { /* keep raw */ }
    if (!seen.has(raw)) { seen.add(raw); urls.push(raw); }
  }
  return urls;
}

/** 把有效批判条目按 URL 分组：同 URL 条目共享一次探测结论。 */
export function collectEntriesByUrl(text) {
  const entries = text ? parseCritiqueEntries(text) : [];
  const byUrl = new Map();
  for (const e of entries) {
    if (!e.valid) continue;
    const m = (e.url || '').match(URL_RE);
    if (!m) continue;
    let raw = m[0];
    raw = raw.replace(/[），,)>\]"'》】。;；]+$/, '');
    try { raw = new URL(raw).toString(); } catch { /* keep raw */ }
    if (!byUrl.has(raw)) byUrl.set(raw, []);
    byUrl.get(raw).push(e);
  }
  return { byUrl, urlList: [...byUrl.keys()] };
}

/** 批量真验一批 URL。整体网络失败判定：全部 URL 均 fail 且其中至少 1 条属网络层错误（dns/refused/net/timeout）。
 *  concurrency：串行探测即可（批判文档通常 ≤10 条 URL），实现简单且不爆连接。 */
export async function verifyUrls(urls, opts = {}) {
  const proxy = opts.proxy !== undefined ? opts.proxy : effectiveProxy();
  const results = [];
  let netFail = 0;
  let netTotal = 0;
  for (const raw of urls) {
    let r;
    try { r = await probeUrl(raw, { proxy, timeoutMs: opts.timeoutMs, maxRedirects: opts.maxRedirects }); }
    catch { r = { code: 0, kind: 'net', status: 'EXCEPTION' }; }
    if (r.kind === 'dns' || r.kind === 'refused' || r.kind === 'net' || r.kind === 'timeout') netFail += 1;
    netTotal += 1;
    results.push({ url: raw, kind: r.kind, status: r.status });
  }
  const allFail = results.every((x) => x.kind !== 'ok');
  const netUnavailable = allFail && netFail > 0 && netFail === netTotal;
  return { results, netUnavailable };
}

/** 汇总并渲染逐 URL 验证结果（PASS/FAIL/SKIPPED + 实际状态码）。 */
export function summarizeVerification(v) {
  const rows = [];
  let pass = 0; let fail = 0; let skipped = 0;
  for (const r of v.results) {
    if (r.kind === 'ok') { pass += 1; rows.push('PASS  ' + r.url + '  (' + r.status + ')'); }
    else if (v.netUnavailable) { skipped += 1; rows.push('VERIFY_SKIPPED  ' + r.url + '  (网络不可用：' + r.kind + '/' + r.status + ')'); }
    else { fail += 1; rows.push('FAIL  ' + r.url + '  (' + r.kind + '/' + r.status + ') → URL_UNVERIFIED'); }
  }
  return { rows, pass, fail, skipped };
}

/** 从批判文本提取全部有效条目 → 真验其 URL → 统计真实对标可达条数。
 *  返回 { total, reachable, unreachable, networkOk, rows, allPass }。 */
export async function verifyCritiqueUrls(text, opts = {}) {
  const { byUrl, urlList } = collectEntriesByUrl(text);
  const total = [...byUrl.values()].reduce((n, a) => n + a.length, 0);
  const v = urlList.length ? await verifyUrls(urlList, opts) : { results: [], netUnavailable: false };
  const okMap = {};
  for (const r of v.results) okMap[r.url] = r.kind === 'ok';
  const summary = summarizeVerification(v);
  let reachable = 0; let unreachable = 0;
  for (const [url, es] of byUrl) {
    const ok = okMap[url];
    if (ok === true) reachable += es.length;
    else if (ok === false) unreachable += es.length;
  }
  return {
    total,
    reachable,
    unreachable,
    networkOk: !v.netUnavailable,
    rows: summary.rows,
    allPass: total > 0 && reachable === total && v.results.length > 0 && !v.netUnavailable,
  };
}

/** 提取区块内容：header 行（前缀匹配，容忍 FR 编号后缀）之后到下一个 `## ` 之前。 */
function extractSection(lines, header) {
  const idx = lines.findIndex((l) => l.trim().startsWith(header));
  if (idx === -1) return null;
  const section = [];
  for (let i = idx + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) break;
    section.push(lines[i]);
  }
  return section.join('\n');
}

/** 规划闸门（FR-203）：「需求前提挑战」「规划自审」须真实填写——残留 ___ / 分视角子段缺 finding+处置 / 裸关键词 均 FAIL。 */
export function checkPlan(planText) {
  const lines = planText ? planText.split('\n') : [];
  const premise = extractSection(lines, '## 需求前提挑战');
  const review = extractSection(lines, '## 规划自审');
  const checks = [];
  const premiseFilled = premise !== null && !/_{3,}/.test(premise) && /(结论|Q1|Premise|前提)/i.test(premise);
  checks.push({ name: '区块: 需求前提挑战', pass: premiseFilled, detail: premise === null ? '缺失' : (/_{3,}/.test(premise) ? '有未填占位 ___' : '已填') });
  // 规划自审：三个 `### X 自审` 子段各自含 finding + 处置 + 无占位；Eng 段另验 confidence；裸 CEO/Eng/Design 词不通过
  const subs = ['CEO 范围自审', 'Eng 架构自审', 'Design 体验自审'];
  let subOk = true;
  const subDetails = [];
  for (const s of subs) {
    const idx = review ? review.indexOf('### ' + s) : -1;
    let subPass = false;
    if (idx !== -1) {
      const rest = review.slice(idx + ('### ' + s).length);
      const seg = rest.split(/\n(?:### |## )/)[0];
      subPass = !/_{3,}/.test(seg) && /Finding/i.test(seg) && /处置/.test(seg);
      if (s === 'Eng 架构自审') subPass = subPass && /confidence/i.test(seg);
    }
    if (!subPass) subOk = false;
    subDetails.push(s + (subPass ? ': OK' : ': 缺 finding/处置/confidence'));
  }
  checks.push({ name: '区块: 规划自审（三视角子段 + Eng confidence + 无占位）', pass: subOk, detail: review === null ? '缺失' : subDetails.join(' | ') });
  return { ok: checks.every((c) => c.pass), checks };
}

/** 从批判文档提取表格数据行（| 开头的非表头/分隔行）。 */
export function extractRows(text) {
  return text.split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .filter((l) => !/^\|[\s:|-]+\|$/.test(l) && !/^\| *#/.test(l))
    .filter((l) => !l.includes('批判点') && !l.includes('竞品对标'));
}

/** 一条有效批判 = 含竞品 URL 且含日期（硬闸门：无对标 = 无效批判）。 */
export function isValidRow(row) {
  return URL_RE.test(row) && DATE_RE.test(row);
}

export function parseCritique(text) {
  const rows = extractRows(text);
  const valid = rows.filter(isValidRow);
  return { total: rows.length, valid: valid.length };
}

/* ===== 批判反哺自动化：解析条目 + 自动登记 tracker + 生成优化任务文档 ===== */

const TRACKER_PATH = ['plans', 'critique-backlog-tracker.md'];
const TASKS_DIR = ['docs', 'history', 'tasks'];
const CRIT_HEADER_RE = /^#{2,4}\s+C\d+\s*[:.\-]?\s*/i;
const NUM_ITEM_RE = /^\s*\d+[.、)]\s+\S/;

/** 归一化文本：折叠空白 + 剔除竖线（防污染 markdown 表格）。 */
function normalizeText(s) {
  return String(s || '').replace(/[|\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(s, n) {
  const t = normalizeText(s);
  return t.length > n ? t.slice(0, n) + '…' : t;
}

/** 解析批判文档为条目数组：兼容模板表格（批判点/竞品对标/优化方案/级别）与 ## C{n} / 数字列表手写格式。 */
export function parseCritiqueEntries(text) {
  if (!text) return [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const dataRows = lines.filter((l) => {
    const t = l.trim();
    return t.startsWith('|') && !/^\|[\s:|-]+\|$/.test(t) && !(t.includes('批判点') && t.includes('竞品对标'));
  });
  const hasCritTable = dataRows.length >= 2 && lines.some((l) => l.includes('竞品对标')) && lines.some((l) => l.includes('批判点'));
  if (hasCritTable) return parseTableEntries(dataRows);
  // 块式：按 `## C{n}` 标题 / 数字列表项切分条目
  const blocks = [];
  let cur = null;
  for (const raw of lines) {
    const t = raw.trim();
    if (CRIT_HEADER_RE.test(t) || NUM_ITEM_RE.test(t)) {
      if (cur) blocks.push(cur);
      cur = { lines: [raw] };
    } else if (cur) {
      cur.lines.push(raw);
    }
  }
  if (cur) blocks.push(cur);
  return blocks.map(entryFromBlock).filter(Boolean);
}

/** 表格条目：`| # | 批判点 | 竞品对标 | 差距 | 优化方案 | 最小验证 | 收益/成本 | 级别 |`。 */
function parseTableEntries(dataRows) {
  const entries = [];
  for (const row of dataRows) {
    const cells = row.split('|').map((c) => c.trim());
    if (cells.length < 9) continue;
    const title = cells[2];
    if (!title) continue;
    const benchmark = cells[3];
    const url = benchmark.match(URL_RE)?.[0] || '';
    const date = benchmark.match(DATE_RE)?.[0] || '';
    entries.push({
      title,
      level: (cells[8] || '').match(LEVEL_RE)?.[0] || '',
      url,
      date,
      plan: cells[5] || '',
      minVerify: cells[6] || '',
      raw: row,
      valid: !!(url && date),
    });
  }
  return entries;
}

/** 块式批判文档中「其他字段」的标签前缀（标题行被跳过后，避免把别的字段行误当本字段内容）。 */
const OTHER_LABEL_RE = /^(?:\s*[-*#]+\s*|\d+[.、)]\s*)?(?:问题|批判点|差距|竞品对标|级别|收益|成本|状态|结论|最小验证|验收指标)\s*[:：]/;

/** 提取块内带标签字段内容（如「优化方案：xxx」「最小验证：xxx」）。
 *  行内标签（`优化方案：xxx` / `优化方案 - xxx`）直接取标签后内容；
 *  markdown 标题行（`### 优化方案`，或标题恰含标签词如 `## C1 优化方案不可落地`）仅作标签声明，
 *  内容取其后首个非空、非标题行（contentAfterHeading）。兼容：表格格式不经此函数（parseTableEntries 直接取 cell）。 */
function fieldOf(lines, labels) {
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trim();
    for (const re of labels) {
      if (re.test(t)) {
        // 标题行：标题只是标签声明，内容在后续行，跳过本行
        if (t.startsWith('#')) return contentAfterHeading(lines, i + 1, labels);
        const content = t.replace(re, '').replace(/^[:：\s-]+/, '').trim();
        if (content) return content;
      }
    }
  }
  return '';
}

/** 标题行被跳过后的向后查找：空行/标题行/其他字段标签行继续；首个带内容行即结果（若仍带标签则提取标签后内容）。 */
function contentAfterHeading(lines, from, labels) {
  for (let j = from; j < lines.length; j += 1) {
    const t = lines[j].trim();
    if (!t || t.startsWith('#')) continue;
    let matched = false;
    for (const re of labels) {
      if (re.test(t)) {
        matched = true;
        const content = t.replace(re, '').replace(/^[:：\s-]+/, '').trim();
        if (content) return content;
      }
    }
    if (matched) continue; // 带本字段标签但内容为空：继续找
    if (OTHER_LABEL_RE.test(t)) continue; // 其他字段标签行（如「- 最小验证：…」）：不属于本字段，跳过
    return t.replace(/^[:：\s-]+/, '').replace(/^\d+[.、)]\s+/, '').trim();
  }
  return '';
}

/** 块式条目：标题取自 `## C{n} 标题` / `1. 标题` / 带「问题/批判点」标签行；级别/URL/日期/方案从正文正则提取。 */
function entryFromBlock(block) {
  const head = block.lines[0].trim();
  const body = block.lines.slice(1);
  const text = body.join('\n');
  const hm = head.match(CRIT_HEADER_RE);
  let title = hm ? head.slice(hm[0].length).trim() : '';
  if (!title) {
    const nm = head.match(/^\s*\d+[.、)]\s+(.+)$/);
    if (nm) title = nm[1].trim();
  }
  if (!title) {
    const labeled = text.match(/(?:批判点|问题|批判)\s*[:：]\s*([^\n]+)/);
    if (labeled) title = labeled[1].trim();
  }
  if (!title) title = (text.split('\n').find((l) => l.trim()))?.trim() || '';
  return {
    title,
    level: text.match(LEVEL_RE)?.[0] || '',
    url: text.match(URL_RE)?.[0] || '',
    date: text.match(DATE_RE)?.[0] || '',
    plan: fieldOf(block.lines, [/优化方案/, /修复措施/, /修复方案/, /方案\s*[:：]/]),
    minVerify: fieldOf(block.lines, [/最小验证/, /验收指标/, /验证\s*[:：]/]),
    raw: head,
    valid: !!(text.match(URL_RE) && text.match(DATE_RE)),
  };
}

/** 下一个 tracker 序号：取现有 C-(\d+) 最大值 +1。 */
export function nextTrackerSerial(trackerText) {
  const nums = [];
  const re = /C-(\d+)/g;
  let m;
  while ((m = re.exec(trackerText || ''))) nums.push(parseInt(m[1], 10));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

/** 组装 tracker 登记行（对齐表头：`| # | 批判（来源） | 级别 | 修复措施 | 落点任务 | 验收指标 | 状态 |`）。 */
export function buildTrackerRow(entry, { serial, file, taskDoc }) {
  const key = normalizeText(entry.title).slice(0, 40);
  const level = entry.level || 'P2';
  const plan = truncate(entry.plan || '（待补充修复措施）', 40);
  const acc = entry.minVerify || truncate(entry.plan || '完成修复并通过回归', 40);
  return `| ${serial} | ${key}（来源：${file}，${entry.date || ''}） | ${level} | ${plan} | ${taskDoc} | ${acc} | ⬜ 待落地 |`;
}

/** 追加新行到 tracker 主表（表头含 `批判（来源）`），保持 LF + UTF-8 无 BOM。 */
export function appendTrackerRows(trackerText, rows) {
  if (!rows.length) return trackerText;
  const lines = trackerText.replace(/\r\n/g, '\n').split('\n');
  const headerIdx = lines.findIndex((l) => l.includes('| # |') && l.includes('批判（来源）'));
  let at;
  if (headerIdx === -1) {
    const sepIdx = lines.findIndex((l) => /^\|[\s:-]+\|$/.test(l.trim()));
    at = sepIdx === -1 ? lines.length : sepIdx + 1;
  } else {
    let i = headerIdx + 1;
    let lastData = -1;
    while (i < lines.length && lines[i].trim().startsWith('|')) { lastData = i; i += 1; }
    at = lastData === -1 ? headerIdx + 1 : lastData + 1;
  }
  const out = lines.slice();
  out.splice(at, 0, ...rows);
  return out.join('\n');
}

/** 生成可派单的优化任务文档（docs/history/tasks/critique-<序号>-task.md）。 */
export function buildTaskDoc(entry, { serial, file, taskDoc }) {
  const plan = entry.plan || '（待补充修复措施，见原批判文件）';
  const acc = entry.minVerify || `完成「${truncate(plan, 32)}」并通过回归`;
  return [
    `# task ${serial} · ${normalizeText(entry.title)}`,
    '',
    `> 执行者：待指派子 agent。验收者：独立测试 agent。承接批判 ${serial}（来源：${file}，${entry.date || ''}）。`,
    '',
    '## 目标',
    '',
    `${normalizeText(entry.title)}（完整批判见原文件）`,
    '',
    '## 修复措施',
    '',
    plan,
    '',
    '## 落点',
    '',
    '待指派（由编排者分配子 agent 承接；文档模板见 `docs/history/tasks/` 既有 task 文档）',
    '',
    '## 验收指标',
    '',
    acc,
    '',
    '## 竞品对标',
    '',
    `${entry.url || '（无竞品 URL）'}（${entry.date || '（无日期）'}）`,
    '',
    '## 引用',
    '',
    `- 原批判文件：\`${file}\``,
    `- 竞品 URL：${entry.url || '（无）'}`,
    `- 任务文档：\`${taskDoc}\``,
    '',
  ].join('\n');
}

/** 登记核心：解析批判文件 → 按「来源文件名+批判标题」查重 → 追加 tracker 行 + 生成任务文档。
 *  trackerPath/tasksDir 可注入（自测走临时目录，避免写仓库）；默认 ROOT 下 plans/ 与 docs/history/tasks/。 */
export function registerFromFiles({ dir, id, trackerPath, tasksDir }) {
  const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return null; } };
  const critiqueFile = `${id}-技术批判.md`;
  const critiqueText = read(critiqueFile);
  if (!critiqueText) return { ok: false, error: '缺少批判文档 ' + critiqueFile, added: [], skipped: [], docs: [] };
  const tPath = trackerPath || path.join(ROOT, ...TRACKER_PATH);
  const tDir = tasksDir || path.join(ROOT, ...TASKS_DIR);
  let trackerText = '';
  try { trackerText = fs.readFileSync(tPath, 'utf8'); } catch { trackerText = ''; }
  const entries = parseCritiqueEntries(critiqueText).filter((e) => e.valid);
  const existingRows = trackerText.split('\n').filter((l) => l.trim().startsWith('|'));
  let serial = nextTrackerSerial(trackerText);
  const added = [];
  const skipped = [];
  const docs = [];
  for (const e of entries) {
    const shortTitle = normalizeText(e.title).slice(0, 40);
    const dup = existingRows.some((row) => row.includes(critiqueFile) && row.includes(shortTitle));
    if (dup) { skipped.push({ title: e.title }); continue; }
    const serialStr = 'C-' + String(serial).padStart(2, '0');
    const taskDoc = [...TASKS_DIR, `critique-${serialStr}-task.md`].join('/');
    const row = buildTrackerRow(e, { serial: serialStr, file: critiqueFile, taskDoc });
    existingRows.push(row);
    added.push({ title: e.title, serial: serialStr, row });
    docs.push({ serial: serialStr, entry: e, taskDoc });
    serial += 1;
  }
  if (docs.length) {
    fs.mkdirSync(tDir, { recursive: true });
    for (const d of docs) {
      const p = path.join(tDir, `critique-${d.serial}-task.md`);
      if (!fs.existsSync(p)) fs.writeFileSync(p, buildTaskDoc(d.entry, { serial: d.serial, file: critiqueFile, taskDoc: d.taskDoc }), { encoding: 'utf8' });
    }
  }
  if (added.length) {
    const newTracker = appendTrackerRows(trackerText, added.map((a) => a.row));
    if (newTracker !== trackerText) fs.writeFileSync(tPath, newTracker, { encoding: 'utf8' });
  }
  return { ok: true, error: null, added, skipped, docs };
}

/** 校验一份批判交付。返回 { ok, checks: [{name, pass, detail}] }。
 * 统一走 parseCritiqueEntries（与 registerFromFiles 同一解析器）：兼容模板表格与 ## C{n}/数字列表块式，
 * 避免「块式文档登记能解析但门槛 0/0 被拦」的双轨不一致。 */
export function checkReview({ critiqueText, fixText, trackerText, id }) {
  const checks = [];
  const entries = critiqueText ? parseCritiqueEntries(critiqueText) : [];
  const total = entries.length;
  const valid = entries.filter((e) => e.valid).length;
  checks.push({ name: '批判文档存在', pass: !!critiqueText, detail: critiqueText ? `${total} 条` : '缺失' });
  checks.push({ name: '有效批判≥3（含URL+日期）', pass: valid >= 3, detail: `有效 ${valid}/${total}` });
  checks.push({ name: '优化修改方案存在', pass: !!fixText, detail: fixText ? '存在' : '缺失' });
  const tracked = !!trackerText && (trackerText.includes(id) || /critique-backlog-tracker/.test(trackerText || ''));
  checks.push({ name: 'tracker 已登记', pass: tracked, detail: tracked ? `含 ${id}` : `未含 ${id}` });
  return { ok: checks.every((c) => c.pass), checks };
}

/* ===== C-31③：gate 产物「阶段机验」字段验收核对（三态：缺失 / 未回填 / 已回填）=====
 * 产物 = 按 gate 模板（templates/owner-review/*.md 5 份 + templates/completion-report.md）填写的文本。
 * 模板默认注释行含占位提示（由编排者填写/待回填/TODO/空）→ 未回填；删字段 → 缺失；实跑回填 → 已回填。 */
const STAGE_VERIFY_LABEL = '阶段机验';
const STAGE_VERIFY_PLACEHOLDER_RE = /待回填|TODO|由编排者填写|注入前必跑/;

/** 核对一份 gate 产物文本的「阶段机验」字段。返回 { ok, state: 'filled'|'unfilled'|'missing', name, detail }。 */
export function checkStageVerify(artifactText) {
  const lines = String(artifactText || '').replace(/\r\n/g, '\n').split('\n');
  const idx = lines.findIndex((l) => l.includes(STAGE_VERIFY_LABEL));
  if (idx === -1) {
    return { ok: false, state: 'missing', name: STAGE_VERIFY_LABEL + '字段缺失', detail: '产物中未找到「' + STAGE_VERIFY_LABEL + '」字段（gate 模板必填，删字段不得验收通过）' };
  }
  let value = (lines[idx].split(STAGE_VERIFY_LABEL)[1] || '').replace(/^[:：]/, '').replace(/<!--|-->/g, '').trim();
  if (!value || STAGE_VERIFY_PLACEHOLDER_RE.test(value)) {
    return { ok: false, state: 'unfilled', name: STAGE_VERIFY_LABEL + '字段未回填', detail: '字段在场但为空/占位（注入前须实跑 --prereq-check 并回填）：' + truncate(value || '（空）', 48) };
  }
  return { ok: true, state: 'filled', name: STAGE_VERIFY_LABEL + '字段已回填', detail: truncate(value, 64) };
}

/* ===== E1 URL 真验三态自测：真 URL PASS / 假 URL FAIL / 断网 SKIPPED（临时 HTTP server） ===== */
function testVerifyUrlTriState() {
  // server1: 可达真站（临时 HTTP server 返回 200）；server2: 不可达（对端直接关 socket / 不存在路由）；
  // server3: 强制连死端口模拟「整网不可用」。
  let realServer = null;
  const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); });
  const deadPort = 1; // 本机未监听端口（Windows 上 127.0.0.1:1 必拒）

  const runAll = async () => {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    realServer = server.address().port;
    const goodText = (u) =>
      '| # | 批判点 | 竞品对标(URL+日期+结论) | 差距 | 优化方案 | 最小验证 | 收益/成本 | 级别 |\n'
      + '|---|---|---|---|---|---|---|---|\n'
      + `| 1 | 真站对比一 | ${u} 2026-09-03 结论A | d | p | v | 1/2 | P1 |\n`
      + `| 2 | 真站对比二 | ${u} 2026-09-03 结论B | d | p | v | 1/2 | P1 |\n`;
    // 真站（2 条同 URL——表格≥2 行才能被识别为批判表；同 URL 去重后探测 1 次、2 条都计可达）
    const good = await verifyCritiqueUrls(goodText(`http://127.0.0.1:${realServer}/a`), { proxy: null, timeoutMs: 3000 });
    if (!good.allPass || good.reachable !== 2) throw new Error('self-test FAIL: 真 URL 应 PASS（可达=2），实得 ' + JSON.stringify({ reachable: good.reachable, rows: good.rows }));
    if (good.networkOk !== true || good.total !== 2) throw new Error('self-test FAIL: 真 URL 判定结构错误 ' + JSON.stringify(good));
    // 假 URL（临时 server 返回 404）
    const fakeServer = http.createServer((req, res) => { res.writeHead(404); res.end('nope'); });
    await new Promise((r) => fakeServer.listen(0, '127.0.0.1', r));
    const fakePort = fakeServer.address().port;
    const bad = await verifyCritiqueUrls(goodText(`http://127.0.0.1:${fakePort}/nope`), { proxy: null, timeoutMs: 3000 });
    fakeServer.close();
    if (bad.allPass) throw new Error('self-test FAIL: 假 URL（404）应 FAIL，实得 allPass=true');
    if (bad.unreachable !== 2) throw new Error('self-test FAIL: 假 URL 应计 unreachable=2，实得 ' + JSON.stringify({ unreachable: bad.unreachable, rows: bad.rows }));
    // 断网（整体不可用）：连死端口 → kind=refused → VERIFY_SKIPPED，不误杀也不假装验证过
    const offline = await verifyCritiqueUrls(goodText(`http://127.0.0.1:${deadPort}/x`), { proxy: null, timeoutMs: 3000 });
    if (offline.networkOk !== false) throw new Error('self-test FAIL: 死端口应判整网不可用（networkOk=false）');
    const hasSkipped = offline.rows.some((r) => r.startsWith('VERIFY_SKIPPED'));
    if (!hasSkipped) throw new Error('self-test FAIL: 断网应标 VERIFY_SKIPPED（诚实标注），实得 ' + JSON.stringify(offline.rows));
    // 混合真+假：2 条真站（同 URL）+ 1 条死端口假站 → reachable=2、unreachable=1
    const mixText = goodText(`http://127.0.0.1:${realServer}/a`) + `| 3 | 假站 | http://127.0.0.1:${deadPort}/nope 2026-09-03 结论C | d | p | v | 1/2 | P1 |\n`;
    const mix = await verifyCritiqueUrls(mixText, { proxy: null, timeoutMs: 3000 });
    if (mix.allPass || mix.reachable !== 2 || mix.unreachable !== 1) throw new Error('self-test FAIL: 混合 2 真 1 假应 reachable=2/unreachable=1/allPass=false，实得 ' + JSON.stringify({ reachable: mix.reachable, unreachable: mix.unreachable, rows: mix.rows }));
  };
  return runAll().finally(() => { if (realServer) try { realServer.close(); } catch { /* ignore */ } });
}

/** 校验 URL 真验逻辑：并发起临时 HTTP server 模拟真/假/断网三态。 */
export async function selfTestUrlVerify() {
  try {
    await testVerifyUrlTriState();
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

/** 收集自我测试集合：全部同步断言项（规划闸门/格式/登记解析）；URL 真验为异步，另行并入。 */
export function selfTest() {
  const good = [
    '| # | 批判点 | 竞品对标(URL+日期+结论) | 差距 | 优化方案 | 最小验证 | 收益/成本 | 级别 |',
    '|---|--------|------------------------|------|---------|---------|----------|------|',
    '| 1 | 架构和竞品 Y 差在哪 | https://github.com/y 2026-08-01 结论A | 差X | 改modules/a | node test | 1/2 | P0 |',
    '| 2 | 生产环境怎么办 | https://docs.y.com 2026/08/02 结论B | 差Y | 改modules/b | 命令 | 1/3 | P1 |',
    '| 3 | 为什么不及格 | https://example.com 2026-08-03 结论C | 差Z | 改modules/c | 测试 | 2/4 | P1 |',
  ].join('\n');
  const bad = [
    '| # | 批判点 | 竞品对标 | 差距 | 优化方案 | 最小验证 | 收益/成本 | 级别 |',
    '| 1 | 无URL无日期 | (无对标) | 差 | 方案 | 验证 | 1/2 | P0 |',
    '| 2 | 有URL无日期 | https://x.com | 差 | 方案 | 验证 | 1/2 | P1 |',
  ].join('\n');
  const goodR = checkReview({ critiqueText: good, fixText: '# 方案', trackerText: '# taskNN', id: 'taskNN' });
  const badR = checkReview({ critiqueText: bad, fixText: null, trackerText: '', id: 'taskNN' });
  if (!goodR.ok) throw new Error('self-test FAIL: 好样例应通过');
  if (badR.ok) throw new Error('self-test FAIL: 坏样例应被拦截');
  // 块式 ## C{n} 批判：3 条含 URL+日期 → 门槛通过；无 URL/日期 → 拦截（与登记解析器同一判定）
  const blockGood = [
    '# taskNN 技术批判',
    '',
    '## C1 块式批判一',
    '- 问题：批判结论靠人工回写 tracker',
    '- 级别：P1',
    '- 竞品对标：https://github.com/b1 2026-09-01 结论A',
    '- 优化方案：接入 review-gate --auto-register',
    '- 最小验证：self-test',
    '',
    '## C2 块式批判二',
    '- 问题：任务文档需手建',
    '- 级别：P2',
    '- 竞品对标：https://docs.b2.com 2026-09-02 结论B',
    '- 优化方案：生成 critique-task.md',
    '- 最小验证：文件存在检查',
    '',
    '## C3 块式批判三',
    '- 问题：无幂等会重复登记',
    '- 级别：P2',
    '- 竞品对标：https://example.com 2026-09-03 结论C',
    '- 优化方案：按来源+标题查重',
    '- 最小验证：重跑不新增',
    '',
  ].join('\n');
  const blockBad = [
    '## C1 无URL',
    '- 问题：缺竞品对标',
    '## C2 无URL',
    '- 问题：缺竞品对标',
    '## C3 无URL',
    '- 问题：缺竞品对标',
  ].join('\n');
  const blockGoodR = checkReview({ critiqueText: blockGood, fixText: '# 方案', trackerText: '# taskNN', id: 'taskNN' });
  const blockBadR = checkReview({ critiqueText: blockBad, fixText: '# 方案', trackerText: '# taskNN', id: 'taskNN' });
  if (!blockGoodR.ok) throw new Error('self-test FAIL: 块式 ## C{n} 批判应通过门槛 ' + JSON.stringify(blockGoodR.checks));
  if (blockBadR.ok) throw new Error('self-test FAIL: 块式无 URL/日期 批判应被拦截');
  // P2FIX2：块式 `### 优化方案` 标题行 + 内容 → plan/minVerify 提取到内容（而非残留 `###`）
  const headingBlock = parseCritiqueEntries([
    '# taskHH 技术批判',
    '',
    '## C1 schema 校验缺失',
    '- 问题：接口无 schema 校验',
    '- 级别：P1',
    '- 竞品对标：https://github.com/schema 2026-09-04 结论A',
    '### 优化方案',
    '加 schema 校验。',
    '### 最小验证',
    'node scripts/validate-structure.mjs',
    '',
    '## C2 优化方案不可落地',
    '- 问题：方案过于理想化',
    '- 级别：P2',
    '- 竞品对标：https://docs.s2.com 2026/09/04 结论B',
    '### 优化方案',
    '落到具体文件改动。',
    '',
  ].join('\n'));
  if (headingBlock.length !== 2) throw new Error('self-test FAIL: ### 优化方案 块式应解析 2 条，实得 ' + headingBlock.length);
  if (headingBlock[0].plan !== '加 schema 校验。') throw new Error('self-test FAIL: ### 优化方案 标题行 plan 应取到「加 schema 校验。」实得 ' + JSON.stringify(headingBlock[0].plan));
  if (headingBlock[0].minVerify !== 'node scripts/validate-structure.mjs') throw new Error('self-test FAIL: ### 最小验证 标题行 minVerify 应取到内容，实得 ' + JSON.stringify(headingBlock[0].minVerify));
  if (headingBlock[1].plan !== '落到具体文件改动。') throw new Error('self-test FAIL: ### 优化方案 标题行 plan 应取到「落到具体文件改动。」实得 ' + JSON.stringify(headingBlock[1].plan));
  if (headingBlock.some((e) => e.plan === '###')) throw new Error('self-test FAIL: plan 不应残留 `###`');
  // FR-203 规划闸门样例：实质齐备 → 过；缺区块/空区块/未填占位/裸关键词 → 拦
  const goodPlan = '# dev-plan\n\n## 需求前提挑战\n前提 Q1 结论已确认\n\n## 任务总纲\n\n## 规划自审\n### CEO 范围自审\nFinding: 范围OK 处置: 采纳\n### Eng 架构自审\nFinding (confidence: 9/10) src/x.ts:12 处置: 采纳\n### Design 体验自审\nFinding: 空态 处置: 补';
  const badPlan = '# dev-plan\n\n## 需求前提挑战\n前提 Q1 结论\n\n## 任务总纲\n';
  const emptyPlan = '# dev-plan\n\n## 需求前提挑战\n\n## 规划自审\n';
  const boilerPlan = '# dev-plan\n\n## 需求前提挑战\n结论 ___\n\n## 任务总纲\n\n## 规划自审\n### CEO 范围自审\nFinding: ___';
  const bareKeywords = '# dev-plan\n\n## 需求前提挑战\n结论已填\n\n## 任务总纲\n\n## 规划自审\nCEO\nEng\nDesign';
  const goodPlanR = checkPlan(goodPlan);
  const badPlanR = checkPlan(badPlan);
  const emptyPlanR = checkPlan(emptyPlan);
  const boilerPlanR = checkPlan(boilerPlan);
  const barePlanR = checkPlan(bareKeywords);
  if (!goodPlanR.ok) throw new Error('self-test FAIL: 好 plan 应通过');
  if (badPlanR.ok) throw new Error('self-test FAIL: 缺「规划自审」的 plan 应被拦截');
  if (emptyPlanR.ok) throw new Error('self-test FAIL: 空区块的 plan 应被拦截');
  if (boilerPlanR.ok) throw new Error('self-test FAIL: 未填占位（___）的 plan 应被拦截');
  if (barePlanR.ok) throw new Error('self-test FAIL: 裸 CEO/Eng/Design 关键词（无 finding）的 plan 应被拦截');
  // C-31③：gate 产物「阶段机验」验收核对三态——占位/空 FAIL 具名 / 回填 PASS / 删字段 FAIL 具名
  const svTemplate = '阶段机验: (由编排者填写：--prereq-check --step N 通过时间戳，或 N/A(非编排内核产物))';
  const svUnfilled = '# 验收报告\n\n' + svTemplate + '\n\n## GWT\n';
  const svEmpty = '# 验收报告\n\n阶段机验:\n\n## GWT\n';
  const svTodo = '# 验收报告\n\n阶段机验: TODO\n\n## GWT\n';
  const svFilled = '# 验收报告\n\n阶段机验: [x] node scripts/tt-journey.mjs --prereq-check --step 5 → exit 0（2026-09-08T12:00:00+08:00）\n\n## GWT\n';
  const svMissing = '# 验收报告\n\n## GWT\n';
  const svUnfilledR = checkStageVerify(svUnfilled);
  const svEmptyR = checkStageVerify(svEmpty);
  const svTodoR = checkStageVerify(svTodo);
  const svFilledR = checkStageVerify(svFilled);
  const svMissingR = checkStageVerify(svMissing);
  if (svUnfilledR.ok || svUnfilledR.state !== 'unfilled') throw new Error('self-test FAIL: 占位字段应判未回填 FAIL，实得 ' + JSON.stringify(svUnfilledR));
  if (svUnfilledR.name !== '阶段机验字段未回填') throw new Error('self-test FAIL: 占位字段 FAIL 应具名「阶段机验字段未回填」，实得 ' + svUnfilledR.name);
  if (svEmptyR.ok || svEmptyR.state !== 'unfilled') throw new Error('self-test FAIL: 空字段应判未回填 FAIL，实得 ' + JSON.stringify(svEmptyR));
  if (svTodoR.ok || svTodoR.state !== 'unfilled') throw new Error('self-test FAIL: TODO 占位应判未回填 FAIL，实得 ' + JSON.stringify(svTodoR));
  if (!svFilledR.ok || svFilledR.state !== 'filled') throw new Error('self-test FAIL: 回填实文应 PASS，实得 ' + JSON.stringify(svFilledR));
  if (svMissingR.ok || svMissingR.state !== 'missing') throw new Error('self-test FAIL: 删字段应判缺失 FAIL，实得 ' + JSON.stringify(svMissingR));
  if (svMissingR.name !== '阶段机验字段缺失') throw new Error('self-test FAIL: 删字段 FAIL 应具名「阶段机验字段缺失」，实得 ' + svMissingR.name);
  // 仓库 6 个 gate 模板（owner-review×5 + completion-report）逐份实文核对：模板占位 → unfilled；但字段必须在场（防模板被删字段）
  const gateTpls = [...fs.readdirSync(path.join(ROOT, 'templates', 'owner-review')).filter((f) => f.endsWith('.md')).map((f) => path.join(ROOT, 'templates', 'owner-review', f)), path.join(ROOT, 'templates', 'completion-report.md')];
  for (const gt of gateTpls) {
    const r = checkStageVerify(fs.readFileSync(gt, 'utf8'));
    if (r.state === 'missing') throw new Error('self-test FAIL: 仓库 gate 模板缺「阶段机验」字段: ' + gt);
  }
  // --gate 模式语义：无参 = 模板字段在场检查（模板合法态即占位，不跑回填核对）；指定产物 = 回填三态核对
  for (const gt of gateTpls) {
    if (!fs.readFileSync(gt, 'utf8').includes(STAGE_VERIFY_LABEL)) throw new Error('self-test FAIL: --gate 无参模板在场模式应 PASS 6/6，实有模板缺字段: ' + gt);
  }
  { // --gate 指定占位 fixture 应 FAIL（unfilled 三态核对只作用于产物，不作用于模板）
    const tmpGate = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-gate-'));
    try {
      const fixture = path.join(tmpGate, 'placeholder-artifact.md');
      fs.writeFileSync(fixture, '# 验收报告\n\n<!-- 阶段机验: (由编排者填写：--prereq-check --step N 通过时间戳，或 N/A(非编排内核产物)) -->\n', 'utf8');
      const r = checkStageVerify(fs.readFileSync(fixture, 'utf8'));
      if (r.ok || r.state !== 'unfilled') throw new Error('self-test FAIL: --gate 指定占位产物 fixture 应 FAIL（unfilled），实得 ' + JSON.stringify(r));
    } finally {
      fs.rmSync(tmpGate, { recursive: true, force: true });
    }
  }
  selfTestAutoRegister();
  return { good: goodR, bad: badR, goodPlan: goodPlanR, badPlan: badPlanR, emptyPlan: emptyPlanR, boilerPlan: boilerPlanR, barePlan: barePlanR };
}

/** CLI self-test 总入口：同步断言 + 异步 URL 三态真验都过才算 PASS。 */
export async function mainSelfTest() {
  try {
    selfTest();
    console.log('PASS review-gate 核心断言 self-test（格式/规划闸门/登记解析/阶段机验核对）');
  } catch (e) {
    console.error('FAIL ' + e.message);
    return 1;
  }
  const r = await selfTestUrlVerify();
  if (!r.ok) { console.error('FAIL URL 真验 self-test: ' + r.error); return 1; }
  console.log('PASS review-gate URL 真验 self-test（真 URL PASS / 假 URL FAIL / 断网 SKIPPED 三态）');
  return 0;
}

// —— 仅当本文件作为 CLI 直接执行时跑 main()（import 复用时由调用方决定）。

/** 批判反哺自动化自测：全走临时目录（不写仓库）。3 条有效批判 → 登记 3 行 + 3 份任务文档；重跑幂等 0 新增 3 跳过；## C{n} 格式字段提取正确。 */
function selfTestAutoRegister() {
  const critique = [
    '# taskZZ 技术批判',
    '',
    '| # | 批判点 | 竞品对标(URL+日期+结论) | 差距 | 优化方案 | 最小验证 | 收益/成本 | 级别 |',
    '|---|---|---|---|---|---|---|---|',
    '| 1 | 批判结论靠人工回写 tracker | https://github.com/a 2026-09-01 结论A | 无自动沉淀 | 接入 review-gate --auto-register | node scripts/review-gate.mjs --self-test | 1/2 | P1 |',
    '| 2 | 优化任务文档需手建 | https://docs.b.com 2026/09/01 结论B | 无 task 草案 | 生成 critique-<id>-task.md | 文件存在检查 | 1/3 | P2 |',
    '| 3 | 无幂等会重复登记 | https://example.com 2026-09-02 结论C | 重复行 | 按 来源+标题 查重 | 重跑不新增 | 2/4 | P2 |',
  ].join('\n');
  const fix = '# taskZZ 优化修改方案\n\n| # | 对应批判 | 修改内容 | 量化指标 | 测试方案 | 风险应对 |\n|---|---|---|---|---|---|\n| 1 | #1 | 改 scripts/review-gate.mjs | 指标 | 测试 | 回滚 |';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-reg-'));
  const tmpTracker = path.join(tmp, 'tracker.md');
  const tmpTasks = path.join(tmp, 'tasks');
  const seed = '# critique-backlog-tracker（测试种子）\n\n| # | 批判（来源） | 级别 | 修复措施 | 落点任务 | 验收指标 | 状态 |\n|---|---|---|---|---|---|---|\n';
  try {
    fs.writeFileSync(tmpTracker, seed, 'utf8');
    fs.writeFileSync(path.join(tmp, 'taskZZ-技术批判.md'), critique, 'utf8');
    fs.writeFileSync(path.join(tmp, 'taskZZ-优化修改方案.md'), fix, 'utf8');
    const r1 = registerFromFiles({ dir: tmp, id: 'taskZZ', trackerPath: tmpTracker, tasksDir: tmpTasks });
    if (!r1.ok) throw new Error('self-test FAIL: 首次登记失败 ' + r1.error);
    if (r1.added.length !== 3) throw new Error('self-test FAIL: 应登记 3 条，实得 ' + r1.added.length);
    if (r1.added[0].serial !== 'C-01') throw new Error('self-test FAIL: 首序号应为 C-01，实得 ' + r1.added[0].serial);
    const tracker1 = fs.readFileSync(tmpTracker, 'utf8');
    for (const a of r1.added) if (!tracker1.includes(a.row)) throw new Error('self-test FAIL: tracker 缺行 ' + a.serial);
    const r2 = registerFromFiles({ dir: tmp, id: 'taskZZ', trackerPath: tmpTracker, tasksDir: tmpTasks });
    if (r2.added.length !== 0) throw new Error('self-test FAIL: 重跑应幂等（0 新增），实得 ' + r2.added.length);
    if (r2.skipped.length !== 3) throw new Error('self-test FAIL: 重跑应跳过 3 条重复，实得 ' + r2.skipped.length);
    for (const d of r1.docs) {
      const p = path.join(tmpTasks, `critique-${d.serial}-task.md`);
      if (!fs.existsSync(p)) throw new Error('self-test FAIL: 任务文档缺失 ' + d.taskDoc);
    }
    const block = [
      '# taskYY 技术批判',
      '',
      '## C1 自动登记缺失',
      '- 问题：批判结论靠人工回写 tracker',
      '- 级别：P1',
      '- 竞品对标：https://github.com/x 2026-09-01 结论',
      '- 优化方案：接入 review-gate --auto-register',
      '- 最小验证：self-test',
      '',
      '## C2 任务文档需手建',
      '- 问题：优化任务文档手建',
      '- 级别：P2',
      '- 竞品对标：https://docs.x.com 2026/09/02 结论',
      '- 优化方案：生成 critique-<id>-task.md',
      '',
    ].join('\n');
    const es = parseCritiqueEntries(block);
    if (es.length !== 2) throw new Error('self-test FAIL: ## C{n} 应解析 2 条，实得 ' + es.length);
    if (es[0].title !== '自动登记缺失' || es[0].level !== 'P1' || !es[0].url.includes('github.com') || !es[0].plan.includes('auto-register')) {
      throw new Error('self-test FAIL: ## C{n} 字段提取错误 ' + JSON.stringify(es[0]));
    }
    // P2FIX2：块式 `### 优化方案` 标题行（非 `- 优化方案：` 行内）端到端登记 → tracker「修复措施」列 / 任务文档「修复措施」= 内容（非 `###`）
    const headingBlock = [
      '# taskVV 技术批判',
      '',
      '## C1 schema 校验缺失',
      '- 问题：接口无 schema 校验',
      '- 级别：P1',
      '- 竞品对标：https://github.com/s1 2026-09-04 结论',
      '### 优化方案',
      '加 schema 校验。',
      '### 最小验证',
      'node scripts/validate-structure.mjs',
      '',
      '## C2 日志脱敏缺失',
      '- 问题：日志含敏感字段',
      '- 级别：P2',
      '- 竞品对标：https://docs.s2.com 2026/09/04 结论',
      '### 优化方案',
      '日志字段脱敏。',
      '',
      '## C3 幂等缺失',
      '- 问题：重跑会重复登记',
      '- 级别：P2',
      '- 竞品对标：https://example.com 2026-09-05 结论',
      '### 优化方案',
      '按来源加标题查重。',
      '',
    ].join('\n');
    const hWant = { 'C-01': '加 schema 校验。', 'C-02': '日志字段脱敏。', 'C-03': '按来源加标题查重。' };
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-head-'));
    try {
      const hTracker = path.join(tmp2, 'tracker.md');
      const hTasks = path.join(tmp2, 'tasks');
      fs.writeFileSync(hTracker, seed, 'utf8');
      fs.writeFileSync(path.join(tmp2, 'taskVV-技术批判.md'), headingBlock, 'utf8');
      const rh = registerFromFiles({ dir: tmp2, id: 'taskVV', trackerPath: hTracker, tasksDir: hTasks });
      if (!rh.ok || rh.added.length !== 3) throw new Error('self-test FAIL: ### 优化方案 块式应登记 3 条，实得 ' + (rh.ok ? rh.added.length : rh.error));
      const hTrackerText = fs.readFileSync(hTracker, 'utf8');
      if (hTrackerText.includes('| ### |')) throw new Error('self-test FAIL: 登记行修复措施残留 `###`');
      for (const a of rh.added) {
        if (!a.row.includes(hWant[a.serial])) throw new Error('self-test FAIL: 登记行修复措施应为「' + hWant[a.serial] + '」实得 ' + a.row);
      }
      for (const d of rh.docs) {
        const tdoc = fs.readFileSync(path.join(hTasks, `critique-${d.serial}-task.md`), 'utf8');
        if (!tdoc.includes(hWant[d.serial])) throw new Error('self-test FAIL: 任务文档修复措施应为「' + hWant[d.serial] + '」' + d.serial);
      }
      const hEs = parseCritiqueEntries(headingBlock);
      if (hEs.length !== 3 || hEs.some((e) => e.plan === '###')) throw new Error('self-test FAIL: ### 标题行 plan 提取错误 ' + JSON.stringify(hEs.map((e) => e.plan)));
    } finally {
      fs.rmSync(tmp2, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    return mainSelfTest();
  }
  const pi = args.indexOf('--plan');
  if (pi !== -1) {
    const planFile = args[pi + 1];
    if (!planFile) { console.error('FAIL --plan 需要 dev-plan.md 路径'); return 1; }
    let planText = null;
    try { planText = fs.readFileSync(path.resolve(planFile), 'utf8'); } catch (e) { console.error('FAIL 读取 dev-plan.md: ' + e.message); return 1; }
    const result = checkPlan(planText);
    for (const c of result.checks) console.log((c.pass ? 'PASS' : 'FAIL') + ' ' + c.name + '  ' + c.detail);
    console.log(result.ok ? '\n[OK] dev-plan 规划闸门通过（前提挑战 + 规划自审齐备）' : '\n[FAIL] dev-plan 规划闸门未过（需「需求前提挑战」「规划自审」区块）');
    return result.ok ? 0 : 1;
  }
  // C-31③：gate「阶段机验」核对（--gate <产物.md> 产物三态核对；无参 = 模板字段在场检查，与 validate H7 同向）
  const gi = args.indexOf('--gate');
  if (gi !== -1) {
    if (args[gi + 1] && !args[gi + 1].startsWith('--')) {
      // 指定产物模式：按模板填写后的实例才需回填核对（占位 FAIL / 回填 PASS / 删字段 FAIL）
      const gf = path.resolve(args[gi + 1]);
      let text = null;
      try { text = fs.readFileSync(gf, 'utf8'); } catch (e) { console.error('FAIL 读取 gate 产物: ' + e.message); return 1; }
      const r = checkStageVerify(text);
      console.log((r.ok ? 'PASS' : 'FAIL') + ' ' + r.name + '  ' + gf + '  ' + r.detail);
      console.log(r.ok ? '\n[OK] gate 产物「阶段机验」验收核对通过' : '\n[FAIL] gate 产物「阶段机验」未回填/缺失（注入前须实跑 --prereq-check 并回填）');
      return r.ok ? 0 : 1;
    }
    // 无参模板模式：模板是空白框架，合法态即占位——只查「阶段机验」字样在场（缺失 FAIL 具名），与 validate H7 同向
    const tplMissing = [];
    const tplAll = [...fs.readdirSync(path.join(ROOT, 'templates', 'owner-review')).filter((f) => f.endsWith('.md')).map((f) => path.join(ROOT, 'templates', 'owner-review', f)), path.join(ROOT, 'templates', 'completion-report.md')];
    for (const tf of tplAll) {
      const t = fs.readFileSync(tf, 'utf8');
      if (!t.includes(STAGE_VERIFY_LABEL)) tplMissing.push(path.relative(ROOT, tf));
    }
    for (const tf of tplAll) {
      const rel = path.relative(ROOT, tf);
      console.log((tplMissing.includes(rel) ? 'FAIL' : 'PASS') + ' 模板「阶段机验」字段' + (tplMissing.includes(rel) ? '缺失' : '在场') + '  ' + rel);
    }
    console.log(tplMissing.length ? '\n[FAIL] ' + tplMissing.length + '/' + tplAll.length + ' gate 模板缺「阶段机验」字段: ' + tplMissing.join(', ') : '\n[OK] ' + tplAll.length + '/' + tplAll.length + ' gate 模板「阶段机验」字段全部在场');
    return tplMissing.length ? 1 : 0;
  }
  let dir = ROOT;
  const di = args.indexOf('--dir'); if (di !== -1 && args[di + 1]) dir = path.resolve(args[di + 1]);
  const ai = args.indexOf('--auto-register');
  if (ai !== -1 && args[ai + 1] && !args[ai + 1].startsWith('--')) dir = path.resolve(args[ai + 1]);
  let id = null;
  const ii = args.indexOf('--id'); if (ii !== -1 && args[ii + 1]) id = args[ii + 1];
  if (!id) {
    const found = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => f.includes('技术批判.md')) : null;
    if (!found) { console.error('FAIL 未找到批判文档（--id 或 dir 内 task*-技术批判.md）'); return 1; }
    id = found.replace('-技术批判.md', '');
  }
  const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return null; } };

  // 批判反哺自动化：校验通过后自动登记 tracker + 生成优化任务文档
  if (args.includes('--auto-register')) {
    let trackerText = '';
    try { trackerText = fs.readFileSync(path.join(ROOT, ...TRACKER_PATH), 'utf8'); } catch { /* keep '' */ }
    const result = checkReview({
      critiqueText: read(`${id}-技术批判.md`),
      fixText: read(`${id}-优化修改方案.md`),
      trackerText,
      id,
    });
    for (const c of result.checks) console.log((c.pass ? 'PASS' : 'FAIL') + ' ' + c.name + '  ' + c.detail);
    if (!result.ok) {
      console.log(`\n[FAIL] ${id} 批判闸门未过（硬闸门：有效批判≥3/竞品对标/tracker），未登记`);
      return 1;
    }
    const reg = registerFromFiles({ dir, id });
    if (!reg.ok) { console.error('FAIL ' + reg.error); return 1; }
    for (const a of reg.added) console.log('REGISTER ' + a.serial + '  ' + a.title);
    for (const s of reg.skipped) console.log('SKIP(幂等)  ' + s.title);
    console.log(`\n[OK] ${id} 批判闸门通过 + 自动登记 ${reg.added.length} 条 / 生成任务文档 ${reg.docs.length} 份 / 跳过重复 ${reg.skipped.length} 条`);
    // E1：竞品 URL 真实性机验（--verify-urls 开启时追加执行，不阻断登记结果）
    if (args.includes('--verify-urls')) {
      const critText = read(`${id}-技术批判.md`);
      const v = await verifyCritiqueUrls(critText || '');
      console.log('\n[URL 真验] ' + (v.networkOk ? '网络可用' : '网络不可用（VERIFY_SKIPPED，诚实标注）'));
      for (const line of v.rows) console.log('  ' + line);
      console.log(`[URL 真验] 有效批判 ${v.total} 条：真实对标可达 ${v.reachable} / 无效 ${v.unreachable}（FAIL 的批判不计有效）`);
      if (!v.networkOk) console.log('[URL 真验] 本次验证整体跳过（网络不可用），不因断网误杀、也不假装验证过');
    }
    return 0;
  }

  // 常规校验（无 --auto-register）
  let trackerText = '';
  try { trackerText = fs.readFileSync(path.join(ROOT, ...TRACKER_PATH), 'utf8'); } catch { /* keep '' */ }
  const result = checkReview({
    critiqueText: read(`${id}-技术批判.md`),
    fixText: read(`${id}-优化修改方案.md`),
    trackerText,
    id,
  });
  for (const c of result.checks) console.log((c.pass ? 'PASS' : 'FAIL') + ' ' + c.name + '  ' + c.detail);

  if (result.ok && args.includes('--verify-urls')) {
    const critText = read(`${id}-技术批判.md`);
    const v = await verifyCritiqueUrls(critText || '');
    console.log('\n[URL 真验] ' + (v.networkOk ? '网络可用' : '网络不可用（VERIFY_SKIPPED，诚实标注）'));
    for (const line of v.rows) console.log('  ' + line);
    console.log(`[URL 真验] 有效批判 ${v.total} 条：真实对标可达 ${v.reachable} / 无效 ${v.unreachable}`);
    if (v.networkOk) {
      if (v.total && v.reachable < v.total) {
        console.log(`\n[FAIL] ${id} 存在不可达竞品 URL（URL_UNVERIFIED）：引假 URL 的批判不计有效对标，须改为真实可达竞品后重跑`);
        return 1;
      }
      if (v.total === 0) {
        console.log('\n[URL 真验] 无可真验的有效批判条目（格式检查 0 条有效）——按硬闸门不得通过');
        return 1;
      }
      console.log(`\n[OK] ${id} 批判闸门通过 + 竞品 URL 全部真实可达（PASS ${v.reachable}/${v.total}）`);
      return 0;
    }
    console.log(`\n[OK] ${id} 批判闸门通过（格式）；竞品 URL 真验整体 VERIFY_SKIPPED（网络不可用，诚实标注，不误杀）`);
    return 0;
  }
  console.log(result.ok ? `\n[OK] ${id} 批判闸门通过` : `\n[FAIL] ${id} 批判闸门未过（硬闸门：有效批判≥3/竞品对标/tracker）`);
  return result.ok ? 0 : 1;
}

process.exitCode = 1;
/* realpath 归一的主模块判定：junction（mklink）/大小写/短名安装形态下
 * import.meta.url 会被解析到真实路径而 argv[1] 保持安装路径，直等比较会静默跳过 main()
 * （2026-09-21 盲测发现：junction 部署的 yy 全部 CLI 静默 exit 0）。两侧 realpath 后比较。 */
function isMainFileMatch() {
  try {
    const self = fs.realpathSync(fileURLToPath(import.meta.url));
    let entry = process.argv[1];
    if (!entry) return false;
    try { entry = fs.realpathSync(path.resolve(entry)); } catch { entry = path.resolve(entry); }
    return self === entry;
  } catch { return false; }
}
const isMain = process.argv[1] && isMainFileMatch();
if (isMain) {
  // main 现为 async；URL 真验对死端口的探测在 Windows 会遗留 libuv 幽灵 socket，事件循环不自然退出，
  // 故 CLI 直接 process.exit（子进程/import 场景不受影响）。
  main().catch((e) => { console.error('FAIL ' + (e && e.message ? e.message : e)); process.exit(1); }).then((code) => { process.exit(code); });
}

