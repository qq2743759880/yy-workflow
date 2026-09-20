#!/usr/bin/env node
/**
 * asset-io-report.mjs — P1 IO 口径调用率审计：JSONL 聚合报告（P1-A）。
 *
 * 输入：一个或多个 io-audit JSONL 文件（hook / transcript 产出同构记录
 *   { ts, pid, cwd, op, path, tag }）。
 * 输出：
 *   1) 每资产计数（routing / system-load / consumption 三列——T7 收尾批④：hook 第三分类
 *      `system-load`（manifest.mjs / asset.mjs 装载栈）单列，剥离"机器层无差别全量装载"噪声，
 *      其余未知 tag 一律归 consumption，保持旧口径不破坏）
 *   2) "阶段 × 资产"矩阵——读 .tt-state/journey.json 时间线把记录按 ts 对齐到阶段；
 *      journey 不存在/不可读/无时间戳时整表 stage=unknown 并以 warning 显式声明（不猜）
 *   3) 16 资产零调用清单（whitelist 取自 lib/evolution.mjs，唯一事实源）
 *   报告写 <out>/REPORT.md（<out> 默认 test-reports/<label>，--out 可覆盖）。
 *
 * fail-closed：label / 输入缺失、输入文件不存在、JSONL 行畸形 → 非零退出，不静默。
 * 零 npm 依赖；ESM；中文注释。
 *
 * 用法：node scripts/asset-io-report.mjs --label <名字> --input <a.jsonl> [b.jsonl...]
 *        [--workspace <仓库根>] [--journey <journey.json 路径>] [--out <报告目录>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_WHITELIST } from './lib/evolution.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const VENDOR_SEG = '/vendor/';

// ---------------------------------------------------------------------------
// 输入读取（fail-closed）
// ---------------------------------------------------------------------------

/**
 * 读取并解析 JSONL。每行必须是含 path/tag/ts 的对象；畸形即抛错退出。
 * 返回规范化记录数组。
 */
export function loadRecords(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw fail('未提供 --input JSONL 文件（fail-closed）');
  }
  const records = [];
  for (const file of files) {
    if (!fs.existsSync(file)) throw fail('输入 JSONL 不存在: ' + file);
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      let obj;
      try { obj = JSON.parse(line); }
      catch (e) { throw fail(`${file}:${i + 1} JSONL 行不可解析: ${e.message}（fail-closed）`); }
      if (!obj || typeof obj.path !== 'string' || typeof obj.tag !== 'string') {
        throw fail(`${file}:${i + 1} 记录缺 path/tag 字段（fail-closed）`);
      }
      records.push({
        ts: typeof obj.ts === 'string' ? obj.ts : null,
        pid: obj.pid ?? null,
        cwd: obj.cwd ?? null,
        op: obj.op ?? 'unknown',
        path: obj.path,
        tag: obj.tag,
      });
    }
  }
  return records;
}

function fail(msg) {
  const e = new Error(msg);
  e.code = 'IO_AUDIT_INPUT';
  return e;
}

// ---------------------------------------------------------------------------
// journey 时间线（阶段对齐；不存在即整表 unknown，不猜）
// ---------------------------------------------------------------------------

/**
 * 读 journey.json，产出阶段时间线。
 * 返回 { present, stages: [{label, ms}], warning }。
 * present=false（文件不存在/畸形/无可用 updated_at）→ stages=[]，调用方整表 stage=unknown。
 */
export function loadJourneyTimeline(workspace, explicitPath) {
  let file = explicitPath
    ? path.resolve(explicitPath)
    : path.join(workspace, '.tt-state', 'journey.json');
  if (!fs.existsSync(file)) {
    return { present: false, stages: [], warning: 'journey.json 不存在（' + file + '）：整表 stage=unknown（不猜）' };
  }
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) {
    return { present: false, stages: [], warning: 'journey.json 不可解析（' + e.message + '）：整表 stage=unknown（不猜）' };
  }
  if (!doc || !Array.isArray(doc.steps)) {
    return { present: false, stages: [], warning: 'journey.json 无 steps 数组：整表 stage=unknown（不猜）' };
  }
  const stages = [];
  for (const s of doc.steps) {
    if (!s || s.updated_at == null) continue;
    const ms = Date.parse(s.updated_at);
    if (Number.isNaN(ms)) continue;
    stages.push({ label: 'step' + s.step + (s.name ? ' ' + s.name : ''), ms });
  }
  stages.sort((a, b) => a.ms - b.ms);
  if (stages.length === 0) {
    return { present: false, stages: [], warning: 'journey.json 的 steps 均无可用 updated_at：整表 stage=unknown（不猜）' };
  }
  return { present: true, stages, warning: null, source: file };
}

/** 记录 ts 落哪个阶段：取 updated_at <= 记录时刻的最近一个阶段；早于首阶段 → unknown。 */
function bucketStage(ms, stages) {
  if (!Number.isFinite(ms) || stages.length === 0) return 'unknown';
  let cur = null;
  for (const st of stages) {
    if (st.ms <= ms) cur = st.label;
    else break;
  }
  return cur || 'unknown';
}

// ---------------------------------------------------------------------------
// 聚合
// ---------------------------------------------------------------------------

/** 从规范化 path 提取 vendor 下第一段（资产 id）；不在 vendor 下返回 null。 */
function assetOf(normPath) {
  const idx = normPath.indexOf(VENDOR_SEG);
  if (idx === -1) return null;
  const after = normPath.slice(idx + VENDOR_SEG.length);
  const seg = after.split('/')[0];
  return seg || null;
}

/** 三类口径（T7 收尾批④）：routing / system-load / consumption；未知 tag 归 consumption（旧口径不破坏）。 */
function tagKey(raw) {
  if (raw === 'routing') return 'routing';
  if (raw === 'system-load') return 'systemLoad';
  return 'consumption';
}

/**
 * 聚合：每资产 routing/system-load/consumption 计数 + 阶段×资产矩阵 + 零调用清单。
 * records: loadRecords 输出；timeline: loadJourneyTimeline 输出。
 */
export function aggregate(records, timeline) {
  const perAsset = new Map();
  for (const a of ASSET_WHITELIST) perAsset.set(a, { routing: 0, systemLoad: 0, consumption: 0, total: 0 });
  const otherVendor = []; // 命中 vendor/ 但不在 16 白名单
  const stageSet = new Map(); // stage -> Map(asset -> 三类计数)

  for (const rec of records) {
    const asset = assetOf(rec.path);
    if (asset === null) continue; // 非 vendor 路径（hook 已滤，transcript 兜底）
    const tag = tagKey(rec.tag);
    if (!perAsset.has(asset)) {
      otherVendor.push(rec);
      continue;
    }
    perAsset.get(asset)[tag] += 1;
    perAsset.get(asset).total += 1;

    const ms = rec.ts ? Date.parse(rec.ts) : NaN;
    const stage = bucketStage(ms, timeline.stages);
    if (!stageSet.has(stage)) stageSet.set(stage, new Map());
    const row = stageSet.get(stage);
    const cell = row.get(asset) || { routing: 0, systemLoad: 0, consumption: 0 };
    cell[tag] += 1;
    row.set(asset, cell);
  }

  const zeroCall = ASSET_WHITELIST.filter((a) => perAsset.get(a).total === 0);
  // 阶段行排序：unknown 永远最后，其余按时间序（timeline.stages 已排）
  const stageOrder = timeline.stages.map((s) => s.label);
  const stageRows = [...stageSet.keys()].sort((x, y) => {
    if (x === 'unknown') return 1;
    if (y === 'unknown') return -1;
    return stageOrder.indexOf(x) - stageOrder.indexOf(y);
  });

  return { perAsset, otherVendor, zeroCall, stageSet, stageRows, totalRecords: records.length };
}

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

export function renderReport(label, files, records, timeline, agg) {
  const out = [];
  out.push('# IO 调用率审计报告 — ' + label);
  out.push('');
  out.push('- 输入 JSONL: ' + files.length + ' 个文件，' + agg.totalRecords + ' 条记录');
  out.push('- 资产白名单: ' + ASSET_WHITELIST.length + ' 个（lib/evolution.mjs ASSET_WHITELIST）');
  if (timeline.warning) {
    out.push('- 阶段对齐: ⚠ ' + timeline.warning);
  } else {
    out.push('- 阶段对齐: ' + timeline.stages.length + ' 个阶段（' + timeline.source + '）');
  }
  out.push('');

  // 1) 每资产计数
  out.push('## 每资产计数（routing / system-load / consumption）');
  out.push('');
  out.push('| 资产 | routing | system-load | consumption | 合计 |');
  out.push('|---|---|---|---|---|');
  for (const a of ASSET_WHITELIST) {
    const c = agg.perAsset.get(a);
    out.push(`| ${a} | ${c.routing} | ${c.systemLoad} | ${c.consumption} | ${c.total} |`);
  }
  out.push('');

  // 2) 阶段 × 资产矩阵（单元格 routing/system-load/consumption）
  out.push('## 阶段 × 资产矩阵（单元格 = routing/system-load/consumption）');
  out.push('');
  const header = '| 阶段 | ' + ASSET_WHITELIST.join(' | ') + ' |';
  out.push(header);
  out.push('|---|' + ASSET_WHITELIST.map(() => '---').join('|') + '|');
  for (const stage of agg.stageRows) {
    const row = agg.stageSet.get(stage);
    const cells = ASSET_WHITELIST.map((a) => {
      const c = row.get(a);
      return c ? (c.routing + '/' + c.systemLoad + '/' + c.consumption) : '0/0/0';
    });
    out.push('| ' + stage + ' | ' + cells.join(' | ') + ' |');
  }
  out.push('');

  // 3) 零调用清单
  out.push('## 16 资产零调用清单');
  out.push('');
  if (agg.zeroCall.length === 0) {
    out.push('全部 16 资产均被读取过（无零调用）。');
  } else {
    for (const a of agg.zeroCall) out.push('- ' + a);
  }
  out.push('');

  // 旁注：vendor 下但不在白名单的记录（fail-open 提示，不计入 16）
  if (agg.otherVendor.length > 0) {
    out.push('## 旁注：vendor/ 下但不在 16 白名单的记录');
    out.push('');
    out.push('- 共 ' + agg.otherVendor.length + ' 条（已从 16 资产统计中剔除，仅提示）。');
    out.push('');
  }

  return out.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { input: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--label') args.label = argv[++i];
    else if (a === '--input') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) args.input.push(argv[++i]); }
    else if (a === '--workspace') args.workspace = argv[++i];
    else if (a === '--journey') args.journey = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else throw fail('未知参数: ' + a);
  }
  return args;
}

export function main(argv) {
  let args;
  try { args = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  if (!args.label) { console.error('用法: --label <名字> --input <a.jsonl...> [--workspace <根>] [--journey <路径>] [--out <目录>]'); return 2; }
  if (args.input.length === 0) { console.error('fail-closed: 必须提供至少一个 --input JSONL 文件'); return 2; }

  const workspace = path.resolve(args.workspace || REPO_ROOT);
  try {
    const records = loadRecords(args.input);
    const timeline = loadJourneyTimeline(workspace, args.journey);
    const agg = aggregate(records, timeline);
    const md = renderReport(args.label, args.input, records, timeline, agg);
    const outDir = path.resolve(args.out || path.join(REPO_ROOT, 'test-reports', args.label));
    fs.mkdirSync(outDir, { recursive: true });
    const reportFile = path.join(outDir, 'REPORT.md');
    fs.writeFileSync(reportFile, md, 'utf8');
    console.log('REPORT: ' + reportFile);
    console.log(md);
    return 0;
  } catch (e) {
    console.error(e.message);
    return 2;
  }
}

// 直接执行（非被 import）时跑 CLI
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  process.exitCode = main(process.argv.slice(2));
}
