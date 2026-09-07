#!/usr/bin/env node
/**
 * contract-change-detect — 契约变更检测（FR-4）。
 * 前端实现完成后，对比后端契约 hash（复用 gate.mjs snapshot/diffContracts）：
 * 变更 → 扫描前端页面中引用的契约路径，与 OpenAPI paths 交叉 → 输出受影响页面清单 + 建议重适配。
 * 无变更 → 输出「无契约变更」。
 *
 * 零依赖内核：只读脚本，用 Node 内置 fs/path + gate.mjs 的稳定化 hash 逻辑。
 *
 * 用法：
 *   node scripts/contract-change-detect.mjs \
 *     --contract <契约文件> --pages-dir <前端页面目录> \
 *     [--baseline <先前 hash 或 baseline json>] [--record] [--out <报告目录>]
 *
 * --record：把当前契约 hash 写为 baseline（<pages-dir>/.contract-baseline.json）。
 * --baseline：显式传入先前 hash 字符串，或指向先前 baseline JSON 文件。
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { snapshot } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  console.log('用法: node scripts/contract-change-detect.mjs --contract FILE --pages-dir DIR [--baseline HASH|FILE] [--record] [--out DIR]');
}

function parseArgs(args) {
  const out = { contract: null, pagesDir: null, baseline: null, record: false, out: null, help: false };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--contract') { out.contract = args[i + 1]; i += 1; }
    else if (a === '--pages-dir') { out.pagesDir = args[i + 1]; i += 1; }
    else if (a === '--baseline') { out.baseline = args[i + 1]; i += 1; }
    else if (a === '--out') { out.out = args[i + 1]; i += 1; }
    else if (a === '--record') { out.record = true; }
    else if (a === '--help' || a === '-h') { out.help = true; }
  }
  return out;
}

/** 从契约解析出 OpenAPI paths 的路径 key 集合。 */
function collectContractPaths(doc) {
  if (doc && typeof doc === 'object' && !Array.isArray(doc) && doc.paths && typeof doc.paths === 'object') {
    return Object.keys(doc.paths).filter((k) => k.startsWith('/'));
  }
  return [];
}

/** 把 OpenAPI 路径模板（含 {param}）转成正则可匹配实际请求路径。 */
function pathTemplateToRegex(tpl) {
  const escaped = tpl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = escaped.replace(/\\\{[^}]*\\\}/g, '[^/]+');
  return new RegExp('^' + regex + '$');
}

/** 扫描页面目录中引用的契约路径（fetch/axios/api 调用里的 URL 路径）。 */
function scanReferencedPaths(pagesDir) {
  const extRe = /\.(html?|js|mjs|ts|tsx|jsx|vue)$/i;
  const refs = new Map(); // path -> [file]
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (error) { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (extRe.test(e.name)) {
        let text;
        try { text = fs.readFileSync(full, 'utf8'); } catch (error) { continue; }
        // 匹配引号包裹的 URL 路径（/api/... /v1/... /auth/...），排除 http(s) 外链与纯文件路径
        const re = /["'`]\s*(\/[a-zA-Z][a-zA-Z0-9_\-/{}?&=.]*)\s*["'`]/g;
        let m;
        while ((m = re.exec(text)) !== null) {
          const p = m[1].split(/[?#]/)[0];
          if (!/^\/(api|v1|v2|auth|user|users|login|logout|health|items|posts|products|orders|admin)/.test(p)) continue;
          if (!refs.has(p)) refs.set(p, []);
          if (!refs.get(p).includes(path.relative(pagesDir, full).replace(/\\/g, '/'))) refs.get(p).push(path.relative(pagesDir, full).replace(/\\/g, '/'));
        }
      }
    }
  };
  walk(pagesDir);
  return refs;
}

function writeReports(outDir, report) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'contract-change-detect.json'), JSON.stringify(report, null, 2));
  const lines = [
    '# 契约变更检测报告', '',
    '- 生成: ' + report.generatedAt,
    '- 契约: ' + report.contract,
    '- 页面目录: ' + report.pagesDir,
    '- 契约 hash: ' + report.contractHash,
    '- baseline: ' + (report.baselineHash || '(无)'),
    '', '## 结论',
    '- changed: ' + report.changed,
    '- ' + report.conclusion, '',
  ];
  if (report.changed) {
    lines.push('## 受影响页面（引用契约路径）', '');
    if (report.affectedPages.length) {
      for (const page of report.affectedPages) {
        lines.push('- ' + page.file + ' 引用 ' + page.paths.join(', '));
      }
    } else {
      lines.push('- 契约 hash 变更，但页面目录未扫描到引用契约路径的页面（可能页面未按契约消费，建议核对）');
    }
    lines.push('', '## 建议', '- 对受影响页面按最新契约重适配（字段/路径/错误码），标注 ADAPTED-契约变更-{日期}，再重跑 integration-e2e.mjs 确认连通。');
  } else {
    lines.push('- 无契约变更，不触发重适配。');
  }
  lines.push('');
  fs.writeFileSync(path.join(outDir, 'contract-change-detect.md'), lines.join('\n') + '\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { usage(); return 0; }
  if (!opts.contract || !fs.existsSync(opts.contract)) { console.error('--contract 文件不存在或缺失'); usage(); return 2; }
  if (!opts.pagesDir || !fs.existsSync(opts.pagesDir)) { console.error('--pages-dir 不存在或缺失'); usage(); return 2; }
  const outDir = opts.out || path.join(process.cwd(), 'test-reports');

const contractAbs = path.isAbsolute(opts.contract) ? opts.contract : path.join(process.cwd(), opts.contract);
const current = await snapshot({ contract: contractAbs }, null);
const doc = JSON.parse(fs.readFileSync(contractAbs, 'utf8').replace(/^\uFEFF/, ''));
  const contractPaths = collectContractPaths(doc);

  // baseline 解析：--baseline 为 hash 字符串或 baseline JSON 文件；否则读默认 baseline 文件
  let baselineHash = null;
  const baselineFile = path.join(opts.pagesDir, '.contract-baseline.json');
  if (opts.baseline) {
    if (fs.existsSync(opts.baseline) && /\.json$/i.test(opts.baseline)) {
      try { baselineHash = JSON.parse(fs.readFileSync(opts.baseline, 'utf8')).hash || null; } catch (error) { baselineHash = opts.baseline; }
    } else {
      baselineHash = opts.baseline.trim();
    }
  } else if (fs.existsSync(baselineFile)) {
    try { baselineHash = JSON.parse(fs.readFileSync(baselineFile, 'utf8')).hash || null; } catch (error) { baselineHash = null; }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    contract: opts.contract,
    pagesDir: opts.pagesDir,
    contractHash: current.hash,
    baselineHash,
    contractPaths: contractPaths.length,
    changed: null,
    conclusion: '',
    affectedPages: [],
    exitCode: 0,
  };

  if (baselineHash === null) {
    // 首次：无 baseline → 记录（仅当 --record 或默认 baseline 文件可写）
    report.changed = false;
    report.conclusion = '首次检测无 baseline，无法判定变更（' + (opts.record ? '已记录 baseline' : '用 --record 记录基线后再对比') + '）';
    if (opts.record) {
      fs.writeFileSync(baselineFile, JSON.stringify({ contract: opts.contract, hash: current.hash, recordedAt: new Date().toISOString() }, null, 2));
      report.conclusion = '已记录首次 baseline（hash=' + current.hash + '）';
    }
  } else {
    // baseline 仅存 hash；契约变更 = 当前 hash ≠ baseline hash（等价 gate.mjs snapshot 稳定化，无需 normalized 对比）。
    report.changed = current.hash !== baselineHash;
    if (report.changed) {
      // 扫描页面引用路径，与契约 paths 交叉
      const refs = scanReferencedPaths(opts.pagesDir);
      const affectedSet = new Map();
      for (const [refPath, files] of refs) {
        const matched = contractPaths.some((tpl) => {
          try { return pathTemplateToRegex(tpl).test(refPath); } catch (error) { return refPath === tpl; }
        }) || contractPaths.includes(refPath);
        if (matched) {
          for (const f of files) {
            if (!affectedSet.has(f)) affectedSet.set(f, []);
            if (!affectedSet.get(f).includes(refPath)) affectedSet.get(f).push(refPath);
          }
        }
      }
      report.affectedPages = [...affectedSet.entries()].map(([file, paths]) => ({ file, paths }));
      report.conclusion = '契约已变更（hash ' + baselineHash + ' → ' + current.hash + '），受影响页面 ' + report.affectedPages.length + ' 个，需重适配';
      report.exitCode = 1;
    } else {
      report.conclusion = '无契约变更（hash 与 baseline 一致），不触发重适配';
    }
  }

  // --record 且存在 baseline 对比后更新
  if (opts.record && baselineHash !== null) {
    fs.writeFileSync(baselineFile, JSON.stringify({ contract: opts.contract, hash: current.hash, recordedAt: new Date().toISOString() }, null, 2));
  }

  writeReports(outDir, report);
  console.log('[contract-change-detect] changed=' + report.changed + ' hash=' + current.hash + ' ' + report.conclusion);
  console.log('[contract-change-detect] report: ' + path.join(outDir, 'contract-change-detect.md'));
  return report.exitCode;
}

main().then((code) => { process.exitCode = code; }).catch((error) => {
  console.error('[contract-change-detect] failed: ' + error.message);
  process.exitCode = 2;
});
