#!/usr/bin/env node
/**
 * contract-reverse — 棕地契约草案反推（B1）。
 * 从现有后端代码启发式抽取 HTTP 路由（Flask/FastAPI/Express/Hono/Spring/Go），
 * 可选结合前端目录（fetch/axios/$.ajax 调用）交集，生成 OpenAPI 3 草案 JSON。
 * 草案必须诚实标注 draft:true（未确认，不冒充冻结契约），供 --contract-draft 使用：
 * 前端可凭草案开工，be-validator 不跑真校验（待 --contract 升级）。
 *
 * 零依赖内核：Node 内建 fs/path/regex 启发式，不解析 AST。
 *
 * 用法：
 *   node scripts/contract-reverse.mjs --source <后端目录或文件>
 *     [--frontend <前端目录>] [--out <draft.json>] [--title <名称>] [--verbose]
 *
 * 输出：OpenAPI 3 draft（paths 由后端路由归一化，带 x-tt-reverse 标注；
 * --frontend 时只保留前端实际引用的路径，并在 x-tt 记录引用数）。
 */
import path from 'node:path';
import fs from 'node:fs';

const ALL_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
const METHOD_ALIAS = { get: 'GET', post: 'POST', put: 'PUT', delete: 'DELETE', patch: 'PATCH', options: 'OPTIONS', head: 'HEAD', all: 'ALL' };

/**
 * 路由抽取模式。verbGroup/pathGroup 为捕获组序号（0 起在 match 数组中 +1）。
 * predicates: nonComment 要求在匹配前同行无 // 注释。
 */
const ROUTE_PATTERNS = [
  // Flask @app.route / @bp.route，可带 methods=[...]
  { key: 'flask', re: /@[\w.]+\.route\(\s*['"]([^'"]+)['"]/g, verbGroup: -1, pathGroup: 1, method: 'ALL' },
  // FastAPI @app.get/post/...（word 动词在组 1），组 2 为路径
  { key: 'fastapi', re: /@[\w.]+\.(get|post|put|delete|patch|options|head)\(\s*['"]([^'"]+)['"]/g, verbGroup: 1, pathGroup: 2, method: null },
  // Express/Hono app.verb/router.verb：非捕获对象名，组 1 动词，组 2 路径
  { key: 'express', re: /\b(?:app|router|route|server)\.(get|post|put|delete|patch|all|options|head)\(\s*['"]([^'"]+)['"]/g, verbGroup: 1, pathGroup: 2, method: null },
  // Spring 动词注解
  { key: 'spring', re: /@(Get|Post|Put|Delete|Patch)Mapping\(\s*(?:value\s*=\s*)?['"]([^'"]+)['"]/g, verbGroup: 1, pathGroup: 2, method: null },
  // Spring @RequestMapping（不限方法）
  { key: 'spring', re: /@RequestMapping\(\s*(?:value\s*=\s*)?['"]([^'"]+)['"]/g, verbGroup: -1, pathGroup: 1, method: 'ALL' },
  // Go net/http mux.HandleFunc / router.Handle
  { key: 'go', re: /\b(?:r|mux|router|e|s)\.(?:HandleFunc|Handle)\(\s*['"]([^'"]+)['"]/g, verbGroup: -1, pathGroup: 1, method: 'ALL' },
  // Go httprouter/gin/echo 动词注册
  { key: 'go', re: /\b(?:r|router|e)\.(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\(\s*['"]([^'"]+)['"]/g, verbGroup: 1, pathGroup: 2, method: null },
  // Express app.use('/prefix', routerVar) / Hono app.route('/prefix', sub) —— 前缀映射。
  // app 前负断言 (?<![@\w.])：排除 Flask 装饰器 @app.route（@ 前导仍会被 \b 判为边界而误命中，把 methods 误当子路由变量）
  { key: 'prefix', re: /(?<![@\w.])app\.(?:use|route)\(\s*['"]([^'"]+)['"],\s*([A-Za-z_$][\w$]*)/g, verbGroup: -1, pathGroup: 1, method: 'PREFIX' },
];

function usage() {
  console.log('用法: node scripts/contract-reverse.mjs --source <目录|文件> [--frontend <目录>] [--out <draft.json>] [--title <名称>] [--verbose]');
}

function parseArgs(args) {
  const out = { source: null, frontend: null, out: null, title: null, verbose: false, help: false };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--source') { out.source = args[i + 1]; i += 1; }
    else if (a === '--frontend') { out.frontend = args[i + 1]; i += 1; }
    else if (a === '--out') { out.out = args[i + 1]; i += 1; }
    else if (a === '--title') { out.title = args[i + 1]; i += 1; }
    else if (a === '--verbose') { out.verbose = true; }
    else if (a === '--help' || a === '-h') { out.help = true; }
  }
  return out;
}

function walkSource(target) {
  const files = [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const stack = [target];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'build' || e.name === '.venv' || e.name === 'venv' || e.name === '__pycache__') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (/\.[jt]sx?$|\.py$|\.go$|\.java$|\.mjs$|\.cjs$/.test(e.name)) files.push(full);
    }
  }
  return files;
}

/** 归一化路由路径：去引号、补前导斜杠、:param/* → {param}/{path}。 */
function normalizePath(raw) {
  let p = String(raw || '').trim();
  if (!p) return null;
  if (p.startsWith('http://') || p.startsWith('https://')) return null;
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/^\/+/, '/');
  // Flask/Python 路径转换器 <int:item_id>/<string:name>/<uuid:id>/<path:sub> → {item_id}：
  // 剥转换器前缀 + 尖括号（int: 残留 + 尖括号均为 OpenAPI path template 非法字符）。
  // 必须置于 :param 归一之前——<int:item_id> 中 int: 的冒号会先被 :param 规则吞掉成 <int{item_id}>。
  p = p.replace(/<([A-Za-z_][A-Za-z0-9_]*):([A-Za-z_][A-Za-z0-9_]*)>/g, '{$2}');
  // Flask 默认 string 转换器的裸参数形态 <item_id>（无冒号）→ {item_id}（同样非法尖括号，一并剥掉）
  p = p.replace(/<([A-Za-z_][A-Za-z0-9_]*)>/g, '{$1}');
  p = p.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
  p = p.replace(/\*\**$/g, '{path}');
  p = p.split(/[?#]/)[0];
  return p;
}

/** 行内是否为注释（# python / // js / * java 块内）。 */
function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('#') || t.startsWith('//') || t.startsWith('*') || t.startsWith('"""') || t.startsWith("'''");
}

/** 匹配后的 400 字符窗口内提取 Flask/FastAPI methods=[...] 或 Spring method=RequestMethod.POST。 */
function peekMethods(text, from) {
  const win = text.slice(from, from + 400);
  const list = win.match(/methods\s*=\s*\[\s*((?:['"][A-Za-z]+['"]\s*,?\s*)+)\s*\]/);
  if (list) {
    const ms = [...list[1].matchAll(/['"]([A-Za-z]+)['"]/g)].map(function (x) { return x[1].toUpperCase(); });
    if (ms.length) return ms;
  }
  const m = win.match(/method\s*=\s*RequestMethod\.([A-Za-z]+)/);
  if (m) return [m[1].toUpperCase()];
  return null;
}

/**
 * 从文本抽取路由与前缀映射。
 * 返回 { routes: Map<`METHOD path`, {path, sources:[]}>, prefixes: Map<varName, prefix> }。
 */
function extractRoutes(text, fileRel) {
  const routes = new Map();
  const prefixes = new Map();
  const getRoute = function (method, p) {
    const k = method + ' ' + p;
    if (!routes.has(k)) routes.set(k, { path: p, methods: [method], sources: [] });
    return routes.get(k);
  };
  const ensureMethod = function (rec, method) { if (!rec.methods.includes(method)) rec.methods.push(method); };
  const addSource = function (rec, key, fileRel) { const s = key + ':' + fileRel; if (!rec.sources.includes(s)) rec.sources.push(s); };
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  // 前缀映射：app.use('/api', r) / app.route('/api', r)
  for (const ln of lines) {
    const pm = ln.match(/(?<![@\w.])app\.(?:use|route)\(\s*['"]([^'"]+)['"],\s*([A-Za-z_$][\w$]*)/);
    if (pm) {
      const prefix = normalizePath(pm[1]);
      if (prefix && !prefixes.has(pm[2])) prefixes.set(pm[2], prefix);
    }
  }
  for (const pat of ROUTE_PATTERNS) {
    if (pat.key === 'prefix') continue;
    pat.re.lastIndex = 0;
    let m;
    while ((m = pat.re.exec(text)) !== null) {
      const lineNo = text.slice(0, m.index).split('\n').length;
      if (isCommentLine(lines[lineNo - 1])) continue;
      const rawPath = m[pat.pathGroup];
      let pathVal = normalizePath(rawPath);
      if (!pathVal) continue;

      let methods = [];
      if (pat.key === 'flask') {
        const peek = peekMethods(text, m.index);
        methods = peek || ALL_METHODS;
      } else if (pat.key === 'spring') {
        if (pat.method === 'ALL') methods = peekMethods(text, m.index) || ALL_METHODS;
        else methods = [pat.method];
      } else if (pat.method === 'ALL') {
        methods = ALL_METHODS;
      } else if (pat.verbGroup > 0) {
        const verb = METHOD_ALIAS[String(m[pat.verbGroup]).toLowerCase()];
        methods = verb === 'ALL' ? ALL_METHODS : [verb || String(m[pat.verbGroup]).toUpperCase()];
      } else {
        methods = [pat.method];
      }

      for (const method of methods) {
        const rec = getRoute(method, pathVal);
        ensureMethod(rec, method);
        addSource(rec, pat.key, fileRel);
      }
    }
  }
  return { routes, prefixes };
}

/** 扫描前端目录 fetch/axios/$.ajax 相对 API 路径。 */
function scanFrontend(dir, routes) {
  const refs = new Set();
  const walk = function (d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'build') continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(html?|js|mjs|ts|tsx|jsx|vue)$/i.test(e.name)) {
        let text;
        try { text = fs.readFileSync(full, 'utf8'); } catch (e2) { continue; }
        const re = /(?:fetch|axios\.(?:get|post|put|delete|patch|options|head)|\.ajax)\s*\(\s*['"`]([^'"`]+)['"`]/g;
        let mm;
        while ((mm = re.exec(text)) !== null) {
          const n = normalizePath(mm[1]);
          if (n && n.length > 1 && n.startsWith('/')) refs.add(n);
        }
      }
    }
  };
  walk(dir);
  return [...refs];
}

function matchTemplate(tpl, ref) {
  const escaped = tpl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\\\{[^}]*\\\}/g, '[^/]+') + '$');
  return regex.test(ref);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { usage(); return 0; }
  if (!opts.source || !fs.existsSync(opts.source)) { console.error('--source 不存在或缺失'); usage(); return 2; }
  const files = walkSource(opts.source);
  if (!files.length) { console.error('--source 下未找到后端代码文件（py/js/ts/tsx/jsx/go/java/mjs/cjs）'); return 1; }

  const pathOps = new Map(); // path -> Map<METHOD, {sources:[]}>
  let prefixesDetected = 0;
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    const fileRel = path.relative(process.cwd(), f).replace(/\\/g, '/') || path.basename(f);
    const { routes, prefixes } = extractRoutes(text, fileRel);
    if (prefixes.size) prefixesDetected += prefixes.size;
    for (const [k, rec] of routes) {
      const [method, p] = [k.split(' ')[0], k.slice(k.indexOf(' ') + 1)];
      if (!pathOps.has(p)) pathOps.set(p, new Map());
      const ops = pathOps.get(p);
      if (!ops.has(method)) ops.set(method, { method, sources: [] });
      for (const s of rec.sources) if (!ops.get(method).sources.includes(s)) ops.get(method).sources.push(s);
    }
  }

  let frontendRefs = [];
  let frontendInfo = null;
  if (opts.frontend) {
    if (!fs.existsSync(opts.frontend)) { console.error('--frontend 目录不存在: ' + opts.frontend); return 2; }
    frontendRefs = scanFrontend(opts.frontend, pathOps);
    frontendInfo = { dir: path.relative(process.cwd(), opts.frontend).replace(/\\/g, '/') || opts.frontend, refs: frontendRefs.length };
  }

  const paths = {};
  let included = 0;
  let excluded = 0;
  const sortedPaths = [...pathOps.keys()].sort();
  for (const p of sortedPaths) {
    const ops = pathOps.get(p);
    const opObj = {};
    let excludedOps = 0;
    for (const method of [...ops.keys()].sort()) {
      const rec = ops.get(method);
      const op = {
        summary: 'reverse-engineered ' + method + ' ' + p,
        'x-tt-reverse': true,
        responses: { '200': { description: 'draft unconfirmed; not yet validated against real implementation' } },
      };
      if (rec.sources.length === 1) op['x-tt-source'] = rec.sources[0];
      else op['x-tt-sources'] = rec.sources;
      opObj[method.toLowerCase()] = op;
      included += 1;
      excludedOps += 1;
    }
    const isReferenced = frontendRefs.length === 0 || frontendRefs.some(function (r) { return matchTemplate(p, r); });
    if (frontendRefs.length > 0 && !isReferenced) { excluded += excludedOps; included -= excludedOps; continue; }
    paths[p] = opObj;
  }

  const doc = {
    openapi: '3.0.3',
    info: {
      title: opts.title || (opts.frontend ? 'brownfield contract draft (frontend-scoped)' : 'brownfield contract draft'),
      version: '0.1.0-draft',
      description: 'reverse-engineered from existing code; unconfirmed draft (draft:true). Upgrade to a frozen contract via --contract once confirmed by the backend owner.',
    },
    draft: true,
    'x-tt': {
      engine: 'tt-contract-reverse@1',
      kind: 'brownfield-draft',
      generatedAt: new Date().toISOString(),
      source: (path.relative(process.cwd(), opts.source) || opts.source).replace(/\\/g, '/'),
      sourceFiles: files.length,
      extractedPaths: pathOps.size,
      includedPaths: included,
      excludedNotInFrontend: excluded,
      prefixesDetected,
      frontend: frontendInfo,
      unconfirmed: true,
      note: 'bridged by contract-draft mode: frontend may start, be-validator degrades until --contract upgrade',
    },
    paths,
  };

  const outFile = opts.out || (path.basename(opts.source).replace(/[<>:"/\\|?*]/g, '_') + '-draft.json');
  fs.writeFileSync(outFile, JSON.stringify(doc, null, 2) + '\n');

  console.log('[contract-reverse] extracted ' + pathOps.size + ' paths / ' + included + ' operations (draft:true)'
    + (excluded ? ', ' + excluded + ' operations excluded (not referenced by frontend)' : '') + ' from ' + files.length + ' files');
  if (opts.verbose) {
    for (const p of sortedPaths) {
      if (!paths[p]) continue;
      console.log('  ' + p + '  [' + Object.keys(paths[p]).join(',') + ']');
    }
  }
  console.log('[contract-reverse] draft written: ' + outFile);
  return 0;
}

process.exitCode = main();