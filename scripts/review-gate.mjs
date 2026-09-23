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
 * 批判协议 v2（CR-1）：三元绑定 claim→evidence→source（fail-closed）+ rubric 口径 + 转化纪律。
 *   --critique-sources <path>[,<path>...]|none
 *     来源=向导 ON-1 落盘 orchestrator.config.yaml 的 critique.sources 段。给定路径 → 全局
 *     knowledge-base 绑定（条目可用 `source:` 标签逐条覆盖）；字面 none → 全局 source=none，
 *     每条批判必须含「本批判无外部源，仅基于项目内部资料」标注（不得静默）；完全不给本参数时
 *     由 checkCritiqueBinding 直接调用语义接管：条目必须自带 source 声明，缺失判 INVALID。
 *   --rubric <rubric.json>：批判评估口径（{criteria:[{id,name,weight}]}），结构不合法 FAIL 具名。
 *     --critique-sources / --rubric 任一在场 → 追加三元绑定校验（无 source 判 INVALID，detail 指名）。
 *   --convert-critique <批判文档路径> [--out <输出目录>]：批判转 task（templates/task-v2.md 七字段
 *     口径，内置断言，不 import validate-task.mjs）。断言：implementation_steps 1-7 步（target 为
 *     工作区相对路径且真实存在）/ executor_acceptance 含非空 verify_command / checkpoints 覆盖全部
 *     steps。缺 implementation_steps（批判条目无优化方案）→ 拒绝落盘 exit 1（detail 指名条目）。
 *   --tracker-stats <tracker路径>：机读统计 v2 看板（收录数/各状态计数/转化率/无 source 计数）。
 */
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* P2-1（BFX-B）：URL 终止符加中英文标点边界——`\S+` 会把「https://x.com/a（注）」整段吞成 URL，
 * 后续可达性探测必 404（误杀真实对标）。现排除 CJK 标点区（U+3000-U+303F：。、《》「」【】等）与
 * 全角区（U+FF00-U+FFEF：（）！？；，等）及引号/尖括号；合法 URL 字符（字母数字 -._~:/?#[]@!$&'()*+,;=%）不受影响。 */
const URL_RE = /https?:\/\/[^\s\u3000-\u303f\uff00-\uffef"'<>]+/i;
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

/** 工作区相对路径解析（BFX-1）：跟随 --dir 指向的项目工作区；未指定 --dir 时 dir=ROOT（默认行为向后兼容）。
 *  修复前硬编码 path.join(ROOT, ...)，外部工作区跑批判 gate 时 tracker 读取/登记落在技能安装目录 → 必 FAIL。
 *  显式注入（trackerPath/tasksDir 形参，自测走临时目录）仍最优先。 */
export function resolveWorkspacePath(dir, relSegments, override) {
  return override || path.join(path.resolve(dir || ROOT), ...relSegments);
}
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
      text: row,
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
    text,
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
 *  trackerPath/tasksDir 可注入（自测走临时目录，避免写仓库）；默认跟随 dir（BFX-1：--dir 工作区，
 *  未指定 --dir 时 dir=ROOT 向后兼容）下的 plans/ 与 docs/history/tasks/。 */
export function registerFromFiles({ dir, id, trackerPath, tasksDir }) {
  const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return null; } };
  const critiqueFile = `${id}-技术批判.md`;
  const critiqueText = read(critiqueFile);
  if (!critiqueText) return { ok: false, error: '缺少批判文档 ' + critiqueFile, added: [], skipped: [], docs: [] };
  const tPath = resolveWorkspacePath(dir, TRACKER_PATH, trackerPath);
  const tDir = resolveWorkspacePath(dir, TASKS_DIR, tasksDir);
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

/** 疑似批判表格启发式（P2-2）：≥3 行含 ≥2 个 `|` 的行（表头/分隔/数据行形态），但解析结果 0 条时用于格式诊断提示。
 *  只影响报错可诊断性，不参与任何判定语义（判定阈值不变）。 */
export function looksLikeCritiqueTable(text) {
  if (!text) return false;
  const pipeRows = String(text).split('\n').filter((l) => (l.trim().match(/\|/g) || []).length >= 2);
  return pipeRows.length >= 3;
}

/** 批判表格格式要求提示（P2-2）：解析 0 条但正文疑似表格时附在 FAIL detail，指明可被解析器认出的列格式。 */
const CRIT_TABLE_FORMAT_HINT = '（检测到疑似表格但解析出 0 条批判——表格需含列：# | 批判点 | 竞品对标 | 差距 | 优化方案 | 最小验证 | 收益/成本 | 级别（表头须含「批判点」「竞品对标」字样且 ≥2 条数据行）；或改用 ## C{n} / 数字列表块式，每条含竞品 URL + 日期）';

/** 校验一份批判交付。返回 { ok, checks: [{name, pass, detail}] }。
 * 统一走 parseCritiqueEntries（与 registerFromFiles 同一解析器）：兼容模板表格与 ## C{n}/数字列表块式，
 * 避免「块式文档登记能解析但门槛 0/0 被拦」的双轨不一致。
 * P2-2：解析 0 条且正文疑似存在表格（≥3 个 `|` 分隔行）时，FAIL detail 明确提示表格列格式要求
 * （不放宽判定语义，只改善报错可诊断性）。 */
export function checkReview({ critiqueText, fixText, trackerText, id }) {
  const checks = [];
  const entries = critiqueText ? parseCritiqueEntries(critiqueText) : [];
  const total = entries.length;
  const valid = entries.filter((e) => e.valid).length;
  checks.push({ name: '批判文档存在', pass: !!critiqueText, detail: critiqueText ? `${total} 条` : '缺失' });
  const validDetail = `有效 ${valid}/${total}` + (total === 0 && looksLikeCritiqueTable(critiqueText) ? CRIT_TABLE_FORMAT_HINT : '');
  checks.push({ name: '有效批判≥3（含URL+日期）', pass: valid >= 3, detail: validDetail });
  checks.push({ name: '优化修改方案存在', pass: !!fixText, detail: fixText ? '存在' : '缺失' });
  const tracked = !!trackerText && (trackerText.includes(id) || /critique-backlog-tracker/.test(trackerText || ''));
  checks.push({ name: 'tracker 已登记', pass: tracked, detail: tracked ? `含 ${id}` : `未含 ${id}` });
  return { ok: checks.every((c) => c.pass), checks };
}

/* ===== CR-1 批判协议 v2：三元绑定 claim→evidence→source + rubric 口径 + 看板统计 + 转化纪律 ===== */

/** source 枚举（CR-1 任务 A）：knowledge-base（知识库路径）/ search-tool（搜索工具）/ standard-doc（标准文档）/ none。 */
export const SOURCE_ENUM = ['knowledge-base', 'search-tool', 'standard-doc', 'none'];
/** source=none 时的强制逐条标注文案（不得静默）。 */
export const NO_SOURCE_NOTE = '本批判无外部源，仅基于项目内部资料';
/** 条目内 source 声明标签：`source: none` / `source：standard-doc` / `source: knowledge-base:docs/kb.md`。 */
const SOURCE_LABEL_RE = /(?:^|[\s|*\-#（(])source\s*[:：=]\s*([^\s|，,；;（）()]+)/i;

/** 解析条目文本中的 source 声明。返回 { kind, value } 或 null（未声明）。
 *  kind ∈ SOURCE_ENUM；`knowledge-base:<path>` 或裸路径（含 / 或 .md）→ kind=knowledge-base。 */
export function parseSourceLabel(text) {
  const m = String(text || '').match(SOURCE_LABEL_RE);
  if (!m) return null;
  let v = m[1].trim();
  if (/^knowledge-base[:：]/i.test(v)) v = v.slice('knowledge-base'.length + 1);
  let kind = v.toLowerCase();
  if (!SOURCE_ENUM.includes(kind)) {
    if (kind.startsWith('knowledge-base/') || /[/.]/.test(v)) kind = 'knowledge-base';
    else return { kind: 'INVALID', value: v };
  }
  return { kind, value: v };
}

/** 三元绑定校验（CR-1 任务 A，fail-closed）。每条批判必须 claim→evidence→source 三元齐备：
 *  - claim = 批判条目标题（解析器产出）；
 *  - evidence = 竞品对标 URL+日期（既有硬闸门）或显式 `evidence:` 声明；
 *  - source = 条目 `source:` 标签（优先）或 --critique-sources 全局绑定；无 source 判 INVALID（detail 指名）；
 *  - source=none 的条目必须含 NO_SOURCE_NOTE 标注（缺标注同判 INVALID）。
 *  opts.critiqueSources：null=未给参数（条目必须自带声明）；['none']=全局 none；['a.md','b.md']=全局 knowledge-base。
 *  返回 { ok, checks:[{name,pass,detail}], invalid:[{index,title,reason}], total, noneCount }。 */
export function checkCritiqueBinding({ critiqueText, critiqueSources = null }) {
  const entries = critiqueText ? parseCritiqueEntries(critiqueText) : [];
  const checks = [];
  const invalid = [];
  let noneCount = 0;
  const globalKind = critiqueSources === null ? null : (critiqueSources.length === 1 && critiqueSources[0].toLowerCase() === 'none' ? 'none' : 'knowledge-base');
  const globalDesc = globalKind === 'none' ? 'none（向导未配置外部源）' : globalKind === 'knowledge-base' ? `knowledge-base: ${critiqueSources.join(', ')}` : null;
  checks.push({ name: '批判条目可解析（三元绑定作用域）', pass: entries.length > 0, detail: entries.length ? `${entries.length} 条` : '0 条（无可绑定条目）' });
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    const name = `三元绑定 条目${i + 1}「${truncate(e.title, 30)}」`;
    const text = `${e.title}\n${e.text || ''}`;
    const declared = parseSourceLabel(text);
    let reason = null;
    if (declared && declared.kind === 'INVALID') {
      reason = `source 值「${declared.value}」不在枚举 ${SOURCE_ENUM.join('/')} 内`;
    } else if (!declared && globalKind === null) {
      reason = '缺 source（claim→evidence→source 三元绑定 fail-closed：须显式声明 knowledge-base/search-tool/standard-doc/none 之一，或经 --critique-sources 全局绑定）';
    }
    const kind = declared && declared.kind !== 'INVALID' ? declared.kind : (globalKind || 'INVALID');
    if (!reason && kind === 'none') {
      noneCount += 1;
      if (!text.includes(NO_SOURCE_NOTE) && !/无外部源|仅基于项目内部资料/.test(text)) {
        reason = `source=none 须逐条标注「${NO_SOURCE_NOTE}」（不得静默）`;
      }
    }
    if (!reason && !(e.valid || /evidence\s*[:：=]/i.test(text))) {
      reason = '缺 evidence（竞品对标 URL+日期 或显式 evidence: 声明）';
    }
    if (reason) invalid.push({ index: i + 1, title: e.title, reason });
    checks.push({
      name,
      pass: !reason,
      detail: reason ? `INVALID：${reason}` : `claim→evidence→source 绑定 OK（source=${kind}${declared ? '（条目声明）' : globalDesc ? '（全局绑定）' : ''}）`,
    });
  }
  checks.push({ name: '无 source 条目数（source=none 需逐条标注，不静默）', pass: true, detail: `none=${noneCount}${noneCount ? '（各条已要求标注「无外部源」）' : ''}` });
  return { ok: invalid.length === 0, checks, invalid, total: entries.length, noneCount };
}

/** 加载并校验 rubric（CR-1：--rubric <path>）。合法结构 = JSON 含 criteria 数组 ≥1 条，
 *  每条 {id,name} 非空、weight 为非负数、总权重 >0。返回 { ok, error, rubric, checks }。 */
export function checkRubric(rubricPath) {
  let raw;
  try { raw = fs.readFileSync(path.resolve(rubricPath), 'utf8'); } catch (e) { return { ok: false, error: 'rubric 文件读取失败: ' + e.message, checks: [] }; }
  let rubric;
  try { rubric = JSON.parse(raw); } catch (e) { return { ok: false, error: 'rubric JSON 解析失败: ' + e.message, checks: [] }; }
  const checks = [];
  const crit = Array.isArray(rubric.criteria) ? rubric.criteria : [];
  checks.push({ name: 'rubric criteria ≥1', pass: crit.length >= 1, detail: `${crit.length} 条` });
  const badField = crit.findIndex((c) => !c || !String(c.id || '').trim() || !String(c.name || '').trim());
  checks.push({ name: 'rubric 每条 id/name 非空', pass: badField === -1, detail: badField === -1 ? 'OK' : `criteria[${badField}] 缺 id/name` });
  const badWeight = crit.findIndex((c) => typeof c.weight !== 'number' || !(c.weight >= 0));
  const sumW = crit.reduce((n, c) => n + (typeof c.weight === 'number' && c.weight >= 0 ? c.weight : 0), 0);
  checks.push({ name: 'rubric weight 非负数且总和>0', pass: badWeight === -1 && sumW > 0, detail: badWeight !== -1 ? `criteria[${badWeight}] weight 非法` : `Σweight=${sumW}` });
  return { ok: checks.every((c) => c.pass), error: null, rubric, checks };
}

/* —— CR-1 任务 B：看板 v2 统计（机读）—— */

/** 从 tracker 文本解析 v2 统计块（<!-- CR1-STATS ... -->）——既有登记行零改动的前提下提供机验口径。 */
export function parseTrackerStatsBlock(trackerText) {
  const m = String(trackerText || '').match(/<!--\s*CR1-STATS([\s\S]*?)-->/);
  if (!m) return null;
  const stats = {};
  for (const lm of String(m[1]).matchAll(/^\s*([a-z_]+)\s*:\s*([^\s]+)\s*$/gm)) stats[lm[1]] = lm[2];
  return stats;
}

/** 机读统计 v2 看板行（列序：| claim | evidence | source | severity | status | converted_task_id | 实施方案引用 |）。
 *  只统计 v2 模板段（「批判协议 v2」节内）的数据行；既有 `| C-` 历史行不参与。
 *  返回 { total, registered, accepted, converted, done, rejected, conversionRate, noSource }。 */
export function computeTrackerStats(trackerText) {
  const text = String(trackerText || '').replace(/\r\n/g, '\n');
  const secIdx = text.indexOf('批判协议 v2');
  const rowsSource = secIdx !== -1 ? text.slice(secIdx) : text;
  const rows = rowsSource.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|') && !/^\|[\s:|-]+\|$/.test(l) && !/claim/.test(l));
  const STATUS = ['registered', 'accepted', 'converted', 'done', 'rejected'];
  const counts = { registered: 0, accepted: 0, converted: 0, done: 0, rejected: 0 };
  let total = 0;
  let noSource = 0;
  for (const row of rows) {
    const cells = row.split('|').map((c) => c.trim()).slice(1, -1);
    if (cells.length < 5) continue;
    const claim = cells[0];
    if (!claim || /^\（|^（/.test(claim)) continue; // 模板占位行不计数
    total += 1;
    const status = (cells[4] || '').toLowerCase();
    if (STATUS.includes(status)) counts[status] += 1;
    const src = (cells[2] || '').toLowerCase();
    if (!src || src === 'none' || src.includes('无外部源')) noSource += 1;
  }
  const convertedLike = counts.converted + counts.done;
  return {
    total,
    ...counts,
    conversionRate: total ? Math.round(convertedLike / total * 100) : 0,
    noSource,
  };
}

/* —— CR-1 任务 C：--convert-critique 转化纪律（templates/task-v2.md 七字段口径，内置断言，不 import validate-task.mjs）—— */

/** 内置七字段断言（口径对齐 templates/task-v2.md §一）。doc = 转化生成的任务对象。
 *  返回 { ok, errors: [具名 detail] }。 */
export function assertTaskSevenFields(doc) {
  const errors = [];
  const steps = doc.implementation_steps || [];
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 7) {
    errors.push(`implementation_steps 步数须 ∈[1,7]，实得 ${Array.isArray(steps) ? steps.length : '非数组'}`);
  } else {
    steps.forEach((s, i) => {
      for (const k of ['target', 'action', 'rationale']) {
        if (!s || !String(s[k] || '').trim()) errors.push(`implementation_steps[${i}].${k} 非空字符串缺失`);
      }
      if (s && String(s.target || '').trim() && (path.isAbsolute(String(s.target)) || !fs.existsSync(path.join(doc._dir || process.cwd(), String(s.target))))) {
        errors.push(`implementation_steps[${i}].target 须为工作区相对路径且真实存在：${s.target}`);
      }
    });
  }
  const acc = doc.executor_acceptance || [];
  if (!Array.isArray(acc) || acc.length < 1) errors.push('executor_acceptance ≥1 条缺失');
  else acc.forEach((a, i) => {
    if (!a || !String(a.ac || '').trim()) errors.push(`executor_acceptance[${i}].ac 缺失`);
    if (!a || !String(a.verify_command || '').trim()) errors.push(`executor_acceptance[${i}].verify_command 非空缺失`);
    if (!a || !Number.isInteger(a.expected_exit) || a.expected_exit < 0 || a.expected_exit > 255) errors.push(`executor_acceptance[${i}].expected_exit 须为 0-255 整数`);
  });
  const cps = doc.trajectory_checkpoints || [];
  const covered = new Set((Array.isArray(cps) ? cps : []).map((c) => c && c.step));
  for (let i = 1; i <= steps.length; i += 1) {
    if (!covered.has(i)) errors.push(`trajectory_checkpoints 未覆盖 step ${i}（须覆盖全部 1..${steps.length}）`);
  }
  (Array.isArray(cps) ? cps : []).forEach((c, i) => {
    if (c && (typeof c.step !== 'number' || c.step < 1 || c.step > steps.length)) errors.push(`trajectory_checkpoints[${i}].step 越界：${c.step}`);
    if (!c || !String(c.artifact || '').trim() || !String(c.evidence || '').trim()) errors.push(`trajectory_checkpoints[${i}] artifact/evidence 非空缺失`);
  });
  const { complexity_touched_files: tf, complexity_dep_depth: dd, complexity_score: score, must_split } = doc;
  if (!(typeof score === 'number' && score === (typeof tf === 'number' ? tf : 0) + (typeof dd === 'number' ? dd : 0) * 2)) {
    errors.push(`complexity_score 须等于 touched_files + dep_depth×2（实得 score=${score}, touched=${tf}, depth=${dd}）`);
  }
  if (must_split !== ((typeof score === 'number' ? score : 0) > 12 || (typeof tf === 'number' ? tf : 0) > 5)) {
    errors.push(`must_split 须等于规则 score>12 或 touched_files>5（实得 ${must_split}）`);
  }
  const b = doc.boundaries || {};
  for (const k of ['always', 'never']) {
    const arr = Array.isArray(b[k]) ? b[k] : [];
    if (arr.length < 1 || arr.length > 3 || arr.some((x) => !String(x || '').trim())) errors.push(`boundaries.${k} 须 1-3 条非空字符串`);
  }
  const em = Array.isArray(b.edge_matrix) ? b.edge_matrix : [];
  if (em.length < 1 || em.some((r) => !r || !String(r.input || '').trim() || !String(r.expected || '').trim())) errors.push('boundaries.edge_matrix ≥1 行且 input/expected 非空');
  return { ok: errors.length === 0, errors };
}

/** 批判条目 → task 七字段对象（七字段内置齐备）。工作区根 = 批判文档所在目录。
 *  implementation_steps 来自条目「优化方案/修复措施」——缺失即调用方拒绝落盘（fail-closed）。 */
export function entryToTaskDoc(entry, { serial, file, dir }) {
  const plan = String(entry.plan || '').trim();
  const target = file; // 承接批判的落点：原批判文件（工作区相对路径、真实存在）
  const verify = /node\s+\S+\.mjs/.test(entry.minVerify || '') ? entry.minVerify.trim() : 'node scripts/review-gate.mjs --self-test';
  const touched = new Set([target]).size;
  return {
    _dir: dir,
    task_id: `critique-convert-${serial}`,
    title: normalizeText(entry.title),
    status: 'pending',
    complexity_touched_files: touched,
    complexity_dep_depth: 0,
    complexity_score: touched + 0 * 2,
    must_split: touched > 5,
    spec_budget_tokens: 1200,
    implementation_steps: [{ target, action: plan, rationale: `承接批判：${normalizeText(entry.title)}` }],
    executor_acceptance: [{ ac: entry.minVerify ? normalizeText(entry.minVerify) : `完成「${truncate(plan, 32)}」并通过回归`, verify_command: verify, expected_exit: 0 }],
    trajectory_checkpoints: [{ step: 1, artifact: `批判 ${serial} 的修复措施已落具体文件（claim→evidence→source 三元可溯）`, evidence: `对照原批判 ${file} 的「优化方案」逐句核对` }],
    boundaries: {
      always: ['承接批判目标逐条落地', '改动落在派单白名单内'],
      never: ['跳过 verify_command 实跑', '改写既有 tracker 登记行'],
      edge_matrix: [{ input: '批判条目缺优化方案（implementation_steps 缺失）', expected: '转化拒绝落盘并具名条目' }],
    },
    dev_record: { changed_files: [], notes: '（完工后回填）', deviations: '（完工后回填，无偏离写「无」）' },
  };
}

/** task 七字段对象 → markdown 文档（task-v2 机读格式：frontmatter + ```json 字段块）。 */
export function renderTaskDoc(doc) {
  const fm = [
    '---',
    `task_id: ${doc.task_id}`,
    `title: ${doc.title}`,
    `status: ${doc.status}`,
    `complexity_touched_files: ${doc.complexity_touched_files}`,
    `complexity_dep_depth: ${doc.complexity_dep_depth}`,
    `complexity_score: ${doc.complexity_score}`,
    `must_split: ${doc.must_split}`,
    `spec_budget_tokens: ${doc.spec_budget_tokens}`,
    '---',
  ].join('\n');
  const block = (name, obj) => '```json ' + name + '\n' + JSON.stringify(obj, null, 2) + '\n```';
  return [
    fm,
    '',
    `# ${doc.title}（批判转化单，CR-1 七字段口径）`,
    '',
    `> 由 review-gate --convert-critique 生成；承接批判 claim→evidence→source 三元绑定（CR-1）。`,
    '',
    '## GWT 验收',
    `- Given 批判已通过三元绑定校验 When 执行者按 implementation_steps 施工 Then executor_acceptance 逐条 exit 0`,
    '',
    block('implementation_steps', doc.implementation_steps),
    '',
    block('executor_acceptance', doc.executor_acceptance),
    '',
    block('trajectory_checkpoints', doc.trajectory_checkpoints),
    '',
    block('boundaries', doc.boundaries),
    '',
    block('dev_record', doc.dev_record),
    '',
  ].join('\n');
}

/** 转化核心：解析批判文档 → 逐条建七字段任务 → 内置断言全过才落盘（任一失败=全拒，fail-closed）。
 *  返回 { ok, error, refused:[{index,title,reason}], written:[paths], docs }。 */
export function convertCritique({ critiquePath, outDir, dir }) {
  let text;
  try { text = fs.readFileSync(path.resolve(critiquePath), 'utf8'); } catch (e) { return { ok: false, error: '批判文档读取失败: ' + e.message, refused: [], written: [], docs: [] }; }
  const wsDir = dir || path.dirname(path.resolve(critiquePath));
  const entries = parseCritiqueEntries(text);
  if (!entries.length) return { ok: false, error: '批判文档解析出 0 条条目（转化拒绝）', refused: [], written: [], docs: [] };
  const refused = [];
  const built = [];
  entries.forEach((e, i) => {
    const plan = String(e.plan || '').trim();
    if (!plan) { refused.push({ index: i + 1, title: e.title, reason: '缺 implementation_steps（批判条目无「优化方案/修复措施」——只写目标结果不给施工步的转化判 INVALID）' }); return; }
    built.push(entryToTaskDoc(e, { serial: String(i + 1).padStart(2, '0'), file: path.basename(critiquePath), dir: wsDir }));
  });
  if (refused.length) return { ok: false, error: null, refused, written: [], docs: [] };
  const assertFail = [];
  built.forEach((d, i) => {
    const r = assertTaskSevenFields(d);
    if (!r.ok) r.errors.forEach((er) => assertFail.push(`条目${i + 1}「${truncate(d.title, 24)}」：${er}`));
  });
  if (assertFail.length) return { ok: false, error: '七字段断言未过（拒绝落盘）：' + assertFail.join('；'), refused: [], written: [], docs: [] };
  const out = outDir ? path.resolve(outDir) : path.join(path.dirname(path.resolve(critiquePath)), 'converted-tasks');
  fs.mkdirSync(out, { recursive: true });
  const written = [];
  built.forEach((d, i) => {
    const p = path.join(out, `critique-convert-${String(i + 1).padStart(2, '0')}-task.md`);
    fs.writeFileSync(p, renderTaskDoc(d), { encoding: 'utf8' });
    written.push(p);
  });
  return { ok: true, error: null, refused: [], written, docs: built };
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
  // P2-1（BFX-B）：URL 后跟中文标点（（注）/。）不再误吞进 URL——可达性判定基于干净 URL
  const cjkRows = parseCritiqueEntries([
    '# taskU8 技术批判',
    '',
    '| # | 批判点 | 竞品对标(URL+日期+结论) | 差距 | 优化方案 | 最小验证 | 收益/成本 | 级别 |',
    '|---|---|---|---|---|---|---|---|',
    '| 1 | 中文括号后缀 | https://example.com/prod（注） 2026-09-01 结论A | d | p | v | 1/2 | P1 |',
    '| 2 | 中文句号后缀 | https://example.com/doc。 2026/09/01 结论B | d | p | v | 1/2 | P1 |',
    '| 3 | 中文顿号后缀 | https://example.com/x，注 2026-09-01 结论C | d | p | v | 1/2 | P1 |',
  ].join('\n'));
  if (cjkRows.length !== 3 || cjkRows.some((e) => !e.valid)) throw new Error('self-test FAIL: 中文标点 URL 行应解析为 3 条有效批判，实得 ' + JSON.stringify(cjkRows));
  for (const e of cjkRows) {
    if (/[（）。，、；！？】」』》]/.test(e.url)) throw new Error('self-test FAIL: URL 误吞中文标点 ' + JSON.stringify(e.url));
  }
  if (cjkRows[0].url !== 'https://example.com/prod') throw new Error('self-test FAIL: （注）后缀 URL 应干净截断，实得 ' + JSON.stringify(cjkRows[0].url));
  if (cjkRows[1].url !== 'https://example.com/doc') throw new Error('self-test FAIL: 。后缀 URL 应干净截断，实得 ' + JSON.stringify(cjkRows[1].url));
  const cjkBlock = parseCritiqueEntries(['## C1 中文标点块式', '- 竞品对标：https://docs.b.com/prod（注）。 2026-09-02 结论', '- 级别：P1'].join('\n'));
  if (cjkBlock.length !== 1 || cjkBlock[0].url !== 'https://docs.b.com/prod' || !cjkBlock[0].valid) throw new Error('self-test FAIL: 块式中文标点 URL 应干净解析 ' + JSON.stringify(cjkBlock));
  // 正常 URL（含查询参数/路径）不受新边界影响
  const plainUrl = parseCritiqueEntries(['| # | 批判点 | 竞品对标(URL+日期+结论) | 差距 | 优化方案 | 最小验证 | 收益/成本 | 级别 |', '|---|---|---|---|---|---|---|---|', '| 1 | 正常URL | https://github.com/a/b?x=1&y=2#frag 2026-09-01 结论 | d | p | v | 1/2 | P1 |', '| 2 | 正常URL2 | https://github.com/c 2026-09-01 结论 | d | p | v | 1/2 | P1 |'].join('\n'));
  if (plainUrl.length !== 2 || !plainUrl.every((e) => e.valid)) throw new Error('self-test FAIL: 正常 URL 应不受影响 ' + JSON.stringify(plainUrl.map((e) => e.url)));
  if (plainUrl[0].url !== 'https://github.com/a/b?x=1&y=2#frag') throw new Error('self-test FAIL: 查询参数 URL 被截断 ' + JSON.stringify(plainUrl[0].url));
  // P2-2（BFX-B）：自由格式表格解析 0 条 → FAIL detail 含格式要求提示（判定语义不放松：仍 FAIL）
  const freeFormTable = [
    '| 来源 | 说明 | 备注 |',
    '|---|---|---|',
    '| A | 性能差，见 https://x.com/perf 2026-09-01 | 待议 |',
    '| B | 无对标 | 待议 |',
  ].join('\n');
  const freeFormR = checkReview({ critiqueText: freeFormTable, fixText: '# 方案', trackerText: '# t', id: 't' });
  const validCheck = freeFormR.checks.find((c) => c.name.includes('有效批判≥3'));
  if (freeFormR.ok) throw new Error('self-test FAIL: 自由格式表格不应通过（判定语义不得放松）');
  if (!validCheck || validCheck.pass !== false || !validCheck.detail.includes('表格需含列')) throw new Error('self-test FAIL: 自由格式表格解析 0 条应提示格式要求，实得 ' + JSON.stringify(validCheck));
  // 对照：块式合法批判 0 条场景不误提示（无表格形态）
  const blockBadR2 = checkReview({ critiqueText: blockBad, fixText: '# 方案', trackerText: '# t', id: 't' });
  const validCheck2 = blockBadR2.checks.find((c) => c.name.includes('有效批判≥3'));
  if (validCheck2.detail.includes('表格需含列')) throw new Error('self-test FAIL: 非表格形态不应误提示格式要求，实得 ' + validCheck2.detail);
  // BFX-1：tracker 路径解析跟随工作区（--dir），无 dir 时回落 ROOT（向后兼容），显式注入最优先
  const tmpWs = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-bfx1-'));
  try {
    if (resolveWorkspacePath(tmpWs, TRACKER_PATH) !== path.join(tmpWs, 'plans', 'critique-backlog-tracker.md')) throw new Error('self-test FAIL: resolveWorkspacePath 应跟随 dir');
    if (resolveWorkspacePath(undefined, TRACKER_PATH) !== path.join(ROOT, ...TRACKER_PATH)) throw new Error('self-test FAIL: 无 dir 应回落 ROOT（向后兼容）');
    const injected = path.join(tmpWs, 'override.md');
    if (resolveWorkspacePath(tmpWs, TRACKER_PATH, injected) !== injected) throw new Error('self-test FAIL: 显式注入应最优先');
  } finally {
    fs.rmSync(tmpWs, { recursive: true, force: true });
  }
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
  // CR-1 批判协议 v2 自测：三元绑定 fail-closed / rubric / 看板统计 / 转化纪律
  { // ① 含 source 通过；缺 source INVALID 且 detail 指名；source=none 须标注；非法枚举 INVALID
    const withSource = [
      '## C1 有源批判一',
      '- 问题：导出层无幂等',
      '- 级别：P1',
      '- source: knowledge-base:docs/kb/arch.md',
      '- 竞品对标：https://github.com/kb1 2026-09-20 结论A',
      '- 优化方案：改 modules/a.ts 加幂等锁',
      '- 最小验证：node scripts/review-gate.mjs --self-test',
      '',
      '## C2 无源批判二',
      '- 问题：错误提示不友好',
      '- 级别：P2',
      '- source: none（本批判无外部源，仅基于项目内部资料）',
      '- 竞品对标：https://github.com/kb2 2026-09-20 结论B',
      '- 优化方案：改 modules/b.ts 文案',
      '',
    ].join('\n');
    const okR = checkCritiqueBinding({ critiqueText: withSource, critiqueSources: null });
    if (!okR.ok) throw new Error('self-test FAIL: 含 source 声明的批判应通过三元绑定 ' + JSON.stringify(okR.invalid));
    if (okR.noneCount !== 1) throw new Error('self-test FAIL: source=none 计数应为 1，实得 ' + okR.noneCount);
    const noSource = [
      '## C1 缺源批判',
      '- 问题：某模块慢',
      '- 级别：P1',
      '- 竞品对标：https://github.com/ns 2026-09-20 结论C',
      '- 优化方案：加缓存',
      '',
    ].join('\n');
    const badR = checkCritiqueBinding({ critiqueText: noSource, critiqueSources: null });
    if (badR.ok) throw new Error('self-test FAIL: 缺 source 的批判应判 INVALID（fail-closed）');
    if (!badR.invalid.length || !badR.invalid[0].reason.includes('缺 source')) throw new Error('self-test FAIL: 缺 source INVALID detail 应指名缺 source，实得 ' + JSON.stringify(badR.invalid));
    // 全局绑定（--critique-sources 路径）：条目无显式 source 也绑定通过；全局 none：须逐条标注
    const gOk = checkCritiqueBinding({ critiqueText: noSource, critiqueSources: ['docs/kb/x.md'] });
    if (!gOk.ok) throw new Error('self-test FAIL: --critique-sources 全局绑定应通过，实得 ' + JSON.stringify(gOk.invalid));
    const gNone = checkCritiqueBinding({ critiqueText: noSource, critiqueSources: ['none'] });
    if (gNone.ok) throw new Error('self-test FAIL: 全局 none 且无标注应 INVALID（不得静默）');
    const gNoneOk = checkCritiqueBinding({ critiqueText: noSource.replace('优化方案', NO_SOURCE_NOTE + '\n- 优化方案'), critiqueSources: ['none'] });
    if (!gNoneOk.ok) throw new Error('self-test FAIL: 全局 none 逐条标注后应通过，实得 ' + JSON.stringify(gNoneOk.invalid));
    // 非法枚举
    const badEnum = checkCritiqueBinding({ critiqueText: noSource.replace('- 竞品对标', '- source: wechat\n- 竞品对标'), critiqueSources: null });
    if (badEnum.ok || !badEnum.invalid[0].reason.includes('枚举')) throw new Error('self-test FAIL: 非法 source 枚举应 INVALID 具名，实得 ' + JSON.stringify(badEnum.invalid));
  }
  { // rubric 结构校验：合法过 / 非法 FAIL 具名
    const tmpR = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-rubric-'));
    try {
      const goodP = path.join(tmpR, 'good.json');
      fs.writeFileSync(goodP, JSON.stringify({ name: 'rubric-sample', criteria: [{ id: 'R1', name: '三元绑定完备', weight: 40 }, { id: 'R2', name: '可落地施工步', weight: 60 }] }), 'utf8');
      const g = checkRubric(goodP);
      if (!g.ok) throw new Error('self-test FAIL: 合法 rubric 应通过 ' + JSON.stringify(g.checks));
      const badP = path.join(tmpR, 'bad.json');
      fs.writeFileSync(badP, JSON.stringify({ criteria: [{ id: 'R1', name: '缺权重' }] }), 'utf8');
      const b = checkRubric(badP);
      if (b.ok) throw new Error('self-test FAIL: 缺 weight 的 rubric 应 FAIL');
      const emptyP = path.join(tmpR, 'empty.json');
      fs.writeFileSync(emptyP, JSON.stringify({ criteria: [] }), 'utf8');
      if (checkRubric(emptyP).ok) throw new Error('self-test FAIL: 空 criteria rubric 应 FAIL');
    } finally {
      fs.rmSync(tmpR, { recursive: true, force: true });
    }
  }
  { // ② 看板 v2 统计：样本入库 → 各状态计数正确 / 无 source 计数>0 / 转化率
    const seed = [
      '# critique-backlog-tracker',
      '',
      '## M1 历史段（既有登记行，不参与 v2 统计）',
      '| C-01 | 历史批判 | P1 | 修复 | ✅ |',
      '',
      '## 批判协议 v2 三元绑定看板（CR-1）',
      '',
      '| claim | evidence | source | severity | status | converted_task_id | 实施方案引用 |',
      '|---|---|---|---|---|---|---|',
      '| 导出层无幂等 | URL+日期 2026-09-20 | docs/kb/arch.md | P1 | registered | — | — |',
      '| 错误文案差 | URL+日期 2026-09-20 | none（无外部源） | P2 | accepted | — | — |',
      '| 缓存穿透 | URL+日期 2026-09-21 | standard-doc | P1 | converted | task42 | plans/tasks/x.md |',
      '| 日志泄露 | URL+日期 2026-09-21 | search-tool | P0 | done | task43 | plans/tasks/y.md |',
      '| 时区错乱 | URL+日期 2026-09-21 | none（无外部源） | P2 | rejected | — | — |',
      '',
      '<!-- CR1-STATS',
      'total: 5',
      'no_source: 2',
      '-->',
    ].join('\n');
    const s = computeTrackerStats(seed);
    if (s.total !== 5) throw new Error('self-test FAIL: v2 看板收录数应 5（历史 C- 行不计），实得 ' + s.total);
    if (s.registered !== 1 || s.accepted !== 1 || s.converted !== 1 || s.done !== 1 || s.rejected !== 1) throw new Error('self-test FAIL: 各状态计数错误 ' + JSON.stringify(s));
    if (s.noSource !== 2) throw new Error('self-test FAIL: 无 source 计数应 2，实得 ' + s.noSource);
    if (s.conversionRate !== 40) throw new Error('self-test FAIL: 转化率应 40%（converted+done / total），实得 ' + s.conversionRate);
    const blk = parseTrackerStatsBlock(seed);
    if (!blk || blk.total !== '5' || blk.no_source !== '2') throw new Error('self-test FAIL: CR1-STATS 块解析错误 ' + JSON.stringify(blk));
  }
  { // ③ 转化纪律：缺 implementation_steps 拒绝落盘；合规 → 落盘含 verify_command；断言具名
    const tmpC = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-conv-'));
    try {
      const lack = [
        '## C1 只写目标不给施工步',
        '- 问题：某性能差',
        '- 级别：P1',
        '- source: knowledge-base:docs/kb/p.md',
        '- 竞品对标：https://github.com/cv1 2026-09-20 结论A',
        '',
        '## C2 合规条目',
        '- 问题：另一缺陷',
        '- 级别：P2',
        '- source: standard-doc',
        '- 竞品对标：https://github.com/cv2 2026-09-20 结论B',
        '- 优化方案：改 modules/c.ts 边界检查',
        '- 最小验证：node scripts/review-gate.mjs --self-test',
        '',
      ].join('\n');
      const lackPath = path.join(tmpC, 'taskLX-技术批判.md');
      fs.writeFileSync(lackPath, lack, 'utf8');
      const outLack = path.join(tmpC, 'out-lack');
      const rLack = convertCritique({ critiquePath: lackPath, outDir: outLack });
      if (rLack.ok) throw new Error('self-test FAIL: 缺 implementation_steps 的转化应拒绝');
      if (!rLack.refused.length || !rLack.refused[0].reason.includes('implementation_steps')) throw new Error('self-test FAIL: 拒绝 detail 应指名 implementation_steps，实得 ' + JSON.stringify(rLack.refused));
      if (fs.existsSync(outLack) && fs.readdirSync(outLack).length) throw new Error('self-test FAIL: 拒绝时不应落盘任何文件');
      const okDoc = [
        '## C1 合规条目一',
        '- 问题：接口无校验',
        '- 级别：P1',
        '- source: knowledge-base:docs/kb/v.md',
        '- 竞品对标：https://github.com/cv3 2026-09-20 结论C',
        '- 优化方案：改 modules/d.ts 加 schema 校验',
        '- 最小验证：node scripts/review-gate.mjs --self-test',
        '',
        '## C2 合规条目二',
        '- 问题：日志含明文密钥',
        '- 级别：P0',
        '- source: search-tool',
        '- 竞品对标：https://github.com/cv4 2026-09-20 结论D',
        '- 优化方案：改 modules/e.ts 脱敏',
        '',
      ].join('\n');
      const okPath = path.join(tmpC, 'taskOK-技术批判.md');
      fs.writeFileSync(okPath, okDoc, 'utf8');
      const outOk = path.join(tmpC, 'out-ok');
      const rOk = convertCritique({ critiquePath: okPath, outDir: outOk });
      if (!rOk.ok) throw new Error('self-test FAIL: 合规转化应落盘 ' + JSON.stringify(rLack.refused));
      if (rOk.written.length !== 2) throw new Error('self-test FAIL: 应落盘 2 份转化单，实得 ' + rOk.written.length);
      for (const w of rOk.written) {
        const md = fs.readFileSync(w, 'utf8');
        if (!md.includes('verify_command')) throw new Error('self-test FAIL: 落盘转化单应含 verify_command: ' + w);
        if (!md.includes('implementation_steps')) throw new Error('self-test FAIL: 落盘转化单应含 implementation_steps: ' + w);
      }
      if (!rOk.docs[0].executor_acceptance[0].verify_command.includes('review-gate')) throw new Error('self-test FAIL: minVerify 为 CLI 时 verify_command 应采用原验证命令');
      // 内置断言具名性：verify_command 清空 → 具名 FAIL
      const broken = JSON.parse(JSON.stringify(rOk.docs[0]));
      broken.executor_acceptance[0].verify_command = '';
      broken._dir = tmpC;
      const aR = assertTaskSevenFields(broken);
      if (aR.ok || !aR.errors.some((e) => e.includes('verify_command'))) throw new Error('self-test FAIL: verify_command 置空应具名 FAIL，实得 ' + JSON.stringify(aR.errors));
      const cpBroken = JSON.parse(JSON.stringify(rOk.docs[0]));
      cpBroken.trajectory_checkpoints = [];
      cpBroken._dir = tmpC;
      if (assertTaskSevenFields(cpBroken).ok) throw new Error('self-test FAIL: checkpoints 不覆盖 steps 应 FAIL');
    } finally {
      fs.rmSync(tmpC, { recursive: true, force: true });
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
    // BFX-1（BFX-B）：默认路径（不注入 trackerPath/tasksDir）跟随 dir——外部工作区 tracker/任务文档落工作区，不写技能安装目录
    const rootTrackerBefore = fs.existsSync(path.join(ROOT, ...TRACKER_PATH)) ? fs.readFileSync(path.join(ROOT, ...TRACKER_PATH)) : null;
    const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-bfx1-ws-'));
    try {
      fs.mkdirSync(path.join(tmp3, 'plans'), { recursive: true });
      fs.writeFileSync(path.join(tmp3, 'plans', 'critique-backlog-tracker.md'), seed, 'utf8');
      fs.writeFileSync(path.join(tmp3, 'taskWW-技术批判.md'), critique.replace(/taskZZ/g, 'taskWW'), 'utf8');
      fs.writeFileSync(path.join(tmp3, 'taskWW-优化修改方案.md'), fix, 'utf8');
      const r3 = registerFromFiles({ dir: tmp3, id: 'taskWW' }); // 不注入 trackerPath/tasksDir → 必须落 tmp3
      if (!r3.ok) throw new Error('self-test FAIL: BFX-1 默认路径登记失败 ' + r3.error);
      if (r3.added.length !== 3) throw new Error('self-test FAIL: BFX-1 默认路径应登记 3 条，实得 ' + r3.added.length);
      const wsTracker = fs.readFileSync(path.join(tmp3, 'plans', 'critique-backlog-tracker.md'), 'utf8');
      for (const a of r3.added) if (!wsTracker.includes(a.row)) throw new Error('self-test FAIL: 工作区 tracker 缺行 ' + a.serial);
      if (!fs.existsSync(path.join(tmp3, 'docs', 'history', 'tasks', `critique-${r3.added[0].serial}-task.md`))) throw new Error('self-test FAIL: 任务文档应落工作区 docs/history/tasks/');
      const rootTrackerAfter = fs.existsSync(path.join(ROOT, ...TRACKER_PATH)) ? fs.readFileSync(path.join(ROOT, ...TRACKER_PATH)) : null;
      const same = rootTrackerBefore === null ? rootTrackerAfter === null : rootTrackerBefore.equals(rootTrackerAfter);
      if (!same) throw new Error('self-test FAIL: 默认路径登记不应改动 ROOT 技能目录 tracker（BFX-1）');
    } finally {
      fs.rmSync(tmp3, { recursive: true, force: true });
    }
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
  // CR-1 任务 C：--convert-critique 批判转 task（七字段内置断言，任一失败拒绝落盘）
  const ci = args.indexOf('--convert-critique');
  if (ci !== -1 && args[ci + 1] && !args[ci + 1].startsWith('--')) {
    const oi = args.indexOf('--out');
    const outDir = oi !== -1 && args[oi + 1] && !args[oi + 1].startsWith('--') ? args[oi + 1] : null;
    const r = convertCritique({ critiquePath: args[ci + 1], outDir });
    for (const rf of r.refused) console.log('REFUSED 条目' + rf.index + '「' + rf.title + '」  ' + rf.reason);
    if (!r.ok) {
      console.error('FAIL 批判转化拒绝落盘  ' + (r.error || r.refused.map((x) => x.reason).join('；')));
      return 1;
    }
    for (const w of r.written) console.log('WRITTEN ' + w);
    const vcmd = r.docs.map((d) => d.executor_acceptance.map((a) => a.verify_command).join(' && ')).join(' && ');
    console.log('\n[OK] 批判转化落盘 ' + r.written.length + ' 份（七字段断言全过，verify_command 在场: ' + truncate(vcmd, 64) + '）');
    return 0;
  }
  // CR-1 任务 B：--tracker-stats 机读看板统计
  const ti = args.indexOf('--tracker-stats');
  if (ti !== -1 && args[ti + 1] && !args[ti + 1].startsWith('--')) {
    let tText = '';
    try { tText = fs.readFileSync(path.resolve(args[ti + 1]), 'utf8'); } catch (e) { console.error('FAIL tracker 读取失败: ' + e.message); return 1; }
    const block = parseTrackerStatsBlock(tText);
    const s = computeTrackerStats(tText);
    console.log('STATS total=' + s.total + ' registered=' + s.registered + ' accepted=' + s.accepted + ' converted=' + s.converted + ' done=' + s.done + ' rejected=' + s.rejected + ' conversionRate=' + s.conversionRate + '% noSource=' + s.noSource);
    if (block) console.log('STATS-BLOCK ' + JSON.stringify(block));
    console.log((s.total > 0 ? '[OK] ' : '[FAIL] ') + 'v2 看板统计（收录 ' + s.total + ' 条 / 无 source ' + s.noSource + ' 条）');
    return s.total > 0 ? 0 : 1;
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

  // CR-1 任务 A：三元绑定（--critique-sources）+ rubric 口径（--rubric）——任一在场即启用，fail-closed
  let v2Checks = [];
  let v2Fail = false;
  const csi = args.indexOf('--critique-sources');
  if (csi !== -1 && args[csi + 1]) {
    const sources = args[csi + 1].split(',').map((s) => s.trim()).filter(Boolean);
    const b = checkCritiqueBinding({ critiqueText: read(`${id}-技术批判.md`), critiqueSources: sources });
    v2Checks = v2Checks.concat(b.checks);
    if (!b.ok) v2Fail = true;
  }
  const ri = args.indexOf('--rubric');
  if (ri !== -1 && args[ri + 1] && !args[ri + 1].startsWith('--')) {
    const rr = checkRubric(args[ri + 1]);
    v2Checks = v2Checks.concat(rr.checks);
    if (!rr.ok) v2Fail = true;
  }
  const printV2 = () => { for (const c of v2Checks) console.log((c.pass ? 'PASS' : 'FAIL') + ' ' + c.name + '  ' + c.detail); };

  // 批判反哺自动化：校验通过后自动登记 tracker + 生成优化任务文档
  if (args.includes('--auto-register')) {
    let trackerText = '';
    try { trackerText = fs.readFileSync(resolveWorkspacePath(dir, TRACKER_PATH), 'utf8'); } catch { /* keep '' */ }
    const result = checkReview({
      critiqueText: read(`${id}-技术批判.md`),
      fixText: read(`${id}-优化修改方案.md`),
      trackerText,
      id,
    });
    for (const c of result.checks) console.log((c.pass ? 'PASS' : 'FAIL') + ' ' + c.name + '  ' + c.detail);
    printV2();
    if (!result.ok || v2Fail) {
      console.log(`\n[FAIL] ${id} 批判闸门未过（硬闸门：有效批判≥3/竞品对标/tracker${v2Fail ? '/CR-1 三元绑定+rubric' : ''}），未登记`);
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
  try { trackerText = fs.readFileSync(resolveWorkspacePath(dir, TRACKER_PATH), 'utf8'); } catch { /* keep '' */ }
  const result = checkReview({
    critiqueText: read(`${id}-技术批判.md`),
    fixText: read(`${id}-优化修改方案.md`),
    trackerText,
    id,
  });
  for (const c of result.checks) console.log((c.pass ? 'PASS' : 'FAIL') + ' ' + c.name + '  ' + c.detail);
  printV2();

  // CR-1 fail-closed：三元绑定 / rubric 未过 → 直接 FAIL（优先于 URL 真验）
  if (v2Fail) {
    console.log(`\n[FAIL] ${id} CR-1 批判协议 v2 校验未过（三元绑定 fail-closed / rubric 口径非法）——detail 已指名条目`);
    return 1;
  }

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

