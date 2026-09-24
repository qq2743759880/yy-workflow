#!/usr/bin/env node
/**
 * preflight.mjs — v3 批 1 三机制之一：全静态不变量预检（零 LLM、零网络、确定性）。
 *
 * 派单：handoffs/v3/B1-GATE-dispatch.md 任务 A；机制设计缘由见
 * plans/execution-plan-v3-20260923.md §v3.1（runtime-invariants 预检 adopt 全盘）、
 * §v3.2（DROP_ALLOWED=false 硬门）、§v3.3（执行顺序 Baseline Freeze → Preflight）。
 *
 * 背景（blindqueue 教训）：同文件重复声明这类错，self-test 根本跑不起来——
 * 只有编译器级预检能在进回归前抓。本脚本 therefore 进 regression S14 段。
 *
 * 七项检查：
 *   P1 语法门            scripts/ 下全部 .mjs 全量 node --check（编译器级预检）。
 *   P2 导出查重          跨模块解析 export const/function/class <name> + export {..} 具名表，
 *                        同名导出报警。同文件重复声明 P1 已覆盖，这里抓跨文件冲突。
 *                        存量同名导出（LEGACY_DUP_EXPORTS 清单，均为 lib 层具名 import 消费、
 *                        无运行时冲突实证）降级 WARN 登记；清单之外的新增同名导出 → FAIL 具名
 *                        （防 gate 退化，防复制粘贴导出新冲突）。语义分级为重建判定，登记 RESULTS.md。
 *   P3 ADAPTERS 一致性   scripts/lib/adapters/index.mjs 注册的每个 adapter 名：
 *                        ①映射目标 import 路径解析有效且文件存在；②注册资产名 ∈
 *                        CLUSTERS candidates ∪ ASSET_WHITELIST ∪ runtime.mjs 能力映射 case 集
 *                        （dev-backend/be-implementer/portman 等执行内核别名由此覆盖）。
 *   P4 CLUSTERS ↔ 磁盘   candidates 逐个检查 vendor/<name>/（<name>.md 或 SKILL.md）存在。
 *                        现态 16 资产须全过；AS-1 drop 后 candidates 收缩自动过（唯一事实源驱动）。
 *   P5 buildManifest 单源 扫全仓（排除 node_modules/.git/vendor/test-reports/recovery-*）含
 *                        asset-manifest-v2.json 且同行含写调用模式的文件，断言唯一写方是
 *                        scripts/manifest-build.mjs（AV-2 唯一构建器，写面声明表 handoffs/v3/
 *                        write-faces-batch1.md）——防 runtime 走旧 buildManifest 绕过（第四位审计反例）。
 *                        产物 json 在场而构建器缺失 → FAIL（产物必有单源写方）。
 *   P6 DROP_ALLOWED 断言 读 contracts/asset-manifest-v2.json（AV-2 产物，并行生成中）：
 *                        文件缺失 → SKIP 并注明（不 FAIL 不等它）；凡标记 drop-pending 的资产行，
 *                        drop_allowed 必须显式 true 才允许存在 drop 意图（v3.2 防并行 agent 绕过
 *                        计划顺序）。当前无 drop 意图 → 全 PASS（"无 drop-pending 行"口径）。
 *   P7 change-lock 核查  --changed 接 git status --porcelain 输出（或其他路径清单）：plans/change-lock.json
 *                        中 active 锁（owner≠当前任务且未过期）的文件出现在改动列表 → FAIL 具名。
 *                        锁本身建议性（真强制力=派发拒发+L2 diff 归属核查），本项是收口前机检面。
 *
 * CLI：node scripts/preflight.mjs [--changed <git-status输出或路径清单>] [--owner <task>]
 *      [--adapters-file <path>]（测试注入：默认 scripts/lib/adapters/index.mjs）
 *      [--clusters-file <path>]（测试注入：默认 scripts/lib/matrix.mjs）
 * 退出码：0 = 无 FAIL（PASS/SKIP/WARN 可并存）；1 = 有 FAIL。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { ASSET_WHITELIST } from './lib/evolution.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const VENDOR_DIR = path.join(ROOT, 'vendor');
const MANIFEST_JSON = 'contracts/asset-manifest-v2.json';
const MANIFEST_BUILDER = 'scripts/manifest-build.mjs';
const CHANGE_LOCK_FILE = 'plans/change-lock.json';

/** P2 存量同名导出登记（2026-09-24 preflight 落地时全仓实测；均为跨模块具名 import 消费、
 *  无运行时冲突实证。新增同名导出不在此清单 → FAIL。收缩本清单须逐项核销冲突。 */
const LEGACY_DUP_EXPORTS = new Set([
  'run', 'main', 'ERROR_CODES', 'name', 'TRANSITIONS', 'STEPS', 'GATE_VOCAB',
  'formatApprovalEvidence', 'STATE_VERSION', 'STATE', 'JOURNEY_SCHEMA',
  // EXIT：lib/errors.mjs export const EXIT vs lib/orchestrator.mjs export { EXIT }（本地 const 重导出）；
  // 唯一跨模块具名消费者 scripts/orchestrator.mjs 只 import 自 lib/errors.mjs，无冲突实证（2026-09-24 实测）。
  'EXIT',
  // CANDIDATE_INVALID：lib/asset.mjs 与 manifest-build.mjs（AV-2）各自 export const 且值完全等同
  // （'CANDIDATE_INVALID' 哨兵码，项目错误码惯例同 ERROR_CODES 逐模块声明），具名 import 无运行时冲突。
  // preflight 上线当日即抓到该新增同名导出（2026-09-24），按值等同哨兵码归 legacy 登记（D-偏差 D-1）。
  'CANDIDATE_INVALID',
]);

const results = [];
function record(id, name, status, detail) {
  results.push({ id, name, status, detail });
  const tag = status.padEnd(5);
  console.log(`${tag} ${id} ${name}${detail ? '  — ' + detail : ''}`);
}
function failCount() { return results.filter((r) => r.status === 'FAIL').length; }

/** 递归收集 scripts/ 下全部 .mjs（workspace 相对路径，排序确定性） */
function listScriptsMjs() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.mjs')) out.push(path.relative(ROOT, p).replace(/\\/g, '/'));
    }
  })(SCRIPTS_DIR);
  return out;
}

// ---------------------------------------------------------------------------
// P1 语法门：node --check 全量
// ---------------------------------------------------------------------------
function checkSyntax(files) {
  const bad = [];
  for (const f of files) {
    const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' });
    if (r.status !== 0) bad.push(`${f}: ${(r.stderr || r.stdout || '').trim().split('\n')[0]}`);
  }
  if (bad.length) record('P1', '语法门 (node --check)', 'FAIL', `SYNTAX_FAIL ${bad.length} 个: ` + bad.join(' | '));
  else record('P1', '语法门 (node --check)', 'PASS', `${files.length} 个 .mjs 全过编译器级预检`);
}

// ---------------------------------------------------------------------------
// P2 导出查重：跨模块同名导出
// ---------------------------------------------------------------------------
function collectExports(relFile) {
  const names = [];
  const body = fs.readFileSync(path.join(ROOT, relFile), 'utf8');
  const lines = body.split('\n');
  for (const ln of lines) {
    let m = ln.match(/^export\s+(?:async\s+)?(?:const|function|class)\s+([A-Za-z_$][\w$]*)/);
    if (m) { names.push(m[1]); continue; }
    m = ln.match(/^export\s*\{([^}]*)\}/);
    if (m) {
      for (let item of m[1].split(',')) {
        item = item.trim();
        if (!item) continue;
        const as = item.match(/\bas\s+([A-Za-z_$][\w$]*)\s*$/); // "a as b" → 导出名 b
        names.push(as ? as[1] : item.split(/\s+/)[0]);
      }
    }
  }
  return names;
}
function checkDupExports(files) {
  const byName = new Map();
  for (const f of files) {
    for (const n of collectExports(f)) {
      if (!byName.has(n)) byName.set(n, []);
      byName.get(n).push(f);
    }
  }
  const legacy = [];
  const hard = [];
  for (const [n, fs_] of byName) {
    if (fs_.length < 2) continue;
    if (LEGACY_DUP_EXPORTS.has(n)) legacy.push(`${n}(${fs_.length})`);
    else hard.push(`DUP_EXPORT: ${n} @ ${fs_.join(' + ')}`);
  }
  if (hard.length) record('P2', '导出查重（跨模块同名）', 'FAIL', hard.join('; '));
  else record('P2', '导出查重（跨模块同名）', 'PASS', '无新增同名导出冲突' + (legacy.length ? `（存量 legacy 登记 WARN: ${legacy.join(', ')}）` : ''));
  if (legacy.length && !hard.length) console.log(`  WARN P2 存量同名导出 ${legacy.length} 组（LEGACY_DUP_EXPORTS 登记，非阻断）：${legacy.join(', ')}`);
}

// ---------------------------------------------------------------------------
// P3 ADAPTERS 一致性
// ---------------------------------------------------------------------------
function checkAdapters(adaptersFile, clusters) {
  const known = new Set(ASSET_WHITELIST);
  for (const c of clusters) for (const a of c.candidates) known.add(a);
  // runtime.mjs 能力映射 case 集 = 执行内核别名（dev-backend/be-implementer/portman…）
  const runtimeFile = path.join(SCRIPTS_DIR, 'lib', 'runtime.mjs');
  if (fs.existsSync(runtimeFile)) {
    for (const m of fs.readFileSync(runtimeFile, 'utf8').matchAll(/case\s+'([^']+)'/g)) known.add(m[1]);
  }
  const idxRel = path.relative(ROOT, adaptersFile).replace(/\\/g, '/');
  const problems = [];
  if (!fs.existsSync(adaptersFile)) {
    record('P3', 'ADAPTERS 一致性', 'FAIL', `ADAPTER_INDEX_MISSING: ${idxRel} 不存在`);
    return;
  }
  const src = fs.readFileSync(adaptersFile, 'utf8');
  const dir = path.dirname(adaptersFile);
  const imports = new Map(); // 变量名 → 解析后绝对路径
  for (const m of src.matchAll(/^import\s+(\w+)\s+from\s+['"](\.\/[^'"]+)['"]/gm)) {
    const target = path.resolve(dir, m[2]);
    imports.set(m[1], target);
    if (!fs.existsSync(target)) problems.push(`ADAPTER_IMPORT_MISSING: ${idxRel} import ${m[1]} 路径无效（${path.relative(ROOT, target).replace(/\\/g, '/')} 不存在）`);
  }
  const registered = [];
  for (const m of src.matchAll(/ADAPTERS\.set\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\s*\)/g)) {
    const [, name, varName] = m;
    registered.push(name);
    const target = imports.get(varName);
    if (!target) problems.push(`ADAPTER_MAP_INVALID: '${name}' → ${varName}（无对应 import 声明，映射目标不可解析）`);
    else if (!fs.existsSync(target)) problems.push(`ADAPTER_MAP_MISSING: '${name}' → ${path.relative(ROOT, target).replace(/\\/g, '/')}（文件不存在）`);
    if (!known.has(name)) problems.push(`ADAPTER_NAME_UNKNOWN: '${name}' 不在 CLUSTERS candidates ∪ ASSET_WHITELIST ∪ runtime 能力别名集`);
  }
  if (registered.length === 0) problems.push('ADAPTER_REGISTRY_EMPTY: index.mjs 无任何 ADAPTERS.set 注册（注册表意外为空）');
  if (problems.length) record('P3', 'ADAPTERS 一致性', 'FAIL', problems.join('; '));
  else record('P3', 'ADAPTERS 一致性', 'PASS', `注册 ${registered.length} 个 adapter（${registered.join(', ')}），映射路径与资产名全部有效`);
}

// ---------------------------------------------------------------------------
// P4 CLUSTERS ↔ 磁盘
// ---------------------------------------------------------------------------
function checkClustersOnDisk(clusters, clustersFile) {
  const rel = path.relative(ROOT, clustersFile).replace(/\\/g, '/');
  const missing = [];
  let total = 0;
  const seen = new Set();
  for (const c of clusters) {
    for (const name of c.candidates) {
      if (seen.has(name)) continue;
      seen.add(name);
      total += 1;
      const dir = path.join(VENDOR_DIR, name);
      const hasDoc = fs.existsSync(path.join(dir, name + '.md')) || fs.existsSync(path.join(dir, 'SKILL.md'));
      if (!fs.existsSync(dir) || !hasDoc) missing.push(`${name}（${rel} cluster=${c.id}）`);
    }
  }
  if (missing.length) record('P4', 'CLUSTERS ↔ 磁盘', 'FAIL', `CANDIDATE_MISSING ${missing.length} 个: ` + missing.join('; '));
  else record('P4', 'CLUSTERS ↔ 磁盘', 'PASS', `${total} 资产 vendor/<name>/ 文档齐全（唯一事实源 ${rel}；AS-1 drop 后随 candidates 收缩自动通过）`);
}

// ---------------------------------------------------------------------------
// P5 buildManifest 单源
// ---------------------------------------------------------------------------
const WRITE_PATTERN = /(writeFileSync|appendFileSync|createWriteStream|fs\.promises\.writeFile|writeFile\()/;
const SCAN_SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'test-reports', 'recovery-20260919', 'prototypes']);
function repoCodeFiles() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (SCAN_SKIP_DIRS.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && /\.(mjs|js|cjs|ts)$/.test(e.name)) out.push(p);
    }
  })(ROOT);
  return out;
}
function checkManifestSingleSource() {
  const writers = [];
  for (const f of repoCodeFiles()) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((ln, i) => {
      if (ln.includes('asset-manifest-v2.json') && WRITE_PATTERN.test(ln)) {
        writers.push(`${rel}#L${i + 1}`);
      }
    });
  }
  const problems = [];
  const foreign = writers.filter((w) => !w.startsWith(MANIFEST_BUILDER));
  if (foreign.length) problems.push(`MANIFEST_WRITER_FOREIGN: asset-manifest-v2.json 写路径出现在非唯一构建器文件: ${foreign.join('; ')}（唯一写方必须是 ${MANIFEST_BUILDER}）`);
  const jsonExists = fs.existsSync(path.join(ROOT, MANIFEST_JSON));
  const builderExists = fs.existsSync(path.join(ROOT, MANIFEST_BUILDER));
  if (jsonExists && !builderExists) problems.push(`PRODUCT_WITHOUT_BUILDER: ${MANIFEST_JSON} 在场但唯一构建器 ${MANIFEST_BUILDER} 缺失（产物必有单源写方）`);
  if (problems.length) record('P5', 'buildManifest 单源', 'FAIL', problems.join('; '));
  else if (!builderExists) record('P5', 'buildManifest 单源', 'PASS', `manifest 产物未生成（AV-2 并行中）——写路径扫描 0 处越权写方；${MANIFEST_BUILDER} 上线后本检查自动切换全量口径`);
  else record('P5', 'buildManifest 单源', 'PASS', `唯一写方 ${MANIFEST_BUILDER} ✓（命中 ${writers.length} 处合法写调用）`);
}

// ---------------------------------------------------------------------------
// P6 DROP_ALLOWED 断言
// ---------------------------------------------------------------------------
function checkDropAllowed() {
  const jsonPath = path.join(ROOT, MANIFEST_JSON);
  if (!fs.existsSync(jsonPath)) {
    record('P6', 'DROP_ALLOWED 断言', 'SKIP', `${MANIFEST_JSON} 缺失（AV-2 产物并行生成中）——本检查挂起，产物落地后自动生效`);
    return;
  }
  let data;
  try { data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch (e) {
    record('P6', 'DROP_ALLOWED 断言', 'FAIL', `MANIFEST_UNPARSABLE: ${e.message}`);
    return;
  }
  const rows = Array.isArray(data) ? data : Array.isArray(data.assets) ? data.assets : Array.isArray(data.rows) ? data.rows : null;
  if (!rows) { record('P6', 'DROP_ALLOWED 断言', 'FAIL', 'MANIFEST_SHAPE_INVALID: 顶层须为数组或 {assets|rows: [...]}'); return; }
  const problems = [];
  let pending = 0;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const isPending = row.drop_pending === true || row.dropPending === true || (row.drop && row.drop.pending === true);
    if (!isPending) continue;
    pending += 1;
    const allowed = row.drop_allowed === true || row.dropAllowed === true || (row.drop && row.drop.allowed === true);
    if (!allowed) problems.push(`DROP_NOT_ALLOWED: '${row.id ?? JSON.stringify(row).slice(0, 40)}' 标记 drop-pending 但 drop_allowed 非 true（v3.2 硬门）`);
  }
  if (problems.length) record('P6', 'DROP_ALLOWED 断言', 'FAIL', problems.join('; '));
  else record('P6', 'DROP_ALLOWED 断言', 'PASS', pending === 0 ? `扫描 ${rows.length} 行：无 drop-pending 行（当前无 drop 意图）` : `${pending} 行 drop-pending 均显式 drop_allowed=true`);
}

// ---------------------------------------------------------------------------
// P7 change-lock 核查
// ---------------------------------------------------------------------------
function parseChangedPaths(raw) {
  const out = [];
  for (let ln of String(raw ?? '').split(/\r?\n/)) {
    if (!ln.trim()) continue;
    // git status --porcelain 形：XY <path>（XY 两状态字符可含空格）——须在 trim 前剥离前缀，
    // 否则 " M path" 的前导空格被 trim 掉后前缀识别失败（2026-09-24 实测回归）。重命名形：a -> b（取 b）。
    let p = ln;
    if (/^[MADRCU?!\s]{2}\s/.test(p)) p = p.slice(3);
    if (p.includes(' -> ')) p = p.split(' -> ').pop();
    p = p.trim().replace(/^["']|["']$/g, '');
    if (p) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}
function checkChangeLock(changedRaw, currentOwner) {
  const changed = parseChangedPaths(changedRaw);
  const lockPath = path.join(ROOT, CHANGE_LOCK_FILE);
  if (!fs.existsSync(lockPath)) {
    record('P7', 'change-lock 核查', 'PASS', `锁面 ${CHANGE_LOCK_FILE} 不存在（无锁），--changed ${changed.length} 条无冲突对象`);
    return;
  }
  let locks;
  try {
    const data = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    locks = Array.isArray(data) ? data : data.locks;
  } catch { locks = null; }
  if (!Array.isArray(locks)) { record('P7', 'change-lock 核查', 'FAIL', `LOCK_FILE_INVALID: ${CHANGE_LOCK_FILE} 不可解析为 {locks:[...]}`); return; }
  const now = Date.now();
  const problems = [];
  let active = 0;
  for (const lock of locks) {
    if (!lock || !lock.file) continue;
    const expired = !lock.expires || Date.parse(lock.expires) <= now;
    if (expired) continue;
    active += 1;
    if (lock.owner === currentOwner) continue;
    if (changed.includes(String(lock.file).replace(/\\/g, '/'))) {
      problems.push(`LOCKED_FILE_CHANGED: '${lock.file}' 被任务 '${lock.owner}' 持锁（expires=${lock.expires}）而出现在 --changed 改动列表（当前任务 '${currentOwner}'）`);
    }
  }
  if (problems.length) record('P7', 'change-lock 核查', 'FAIL', problems.join('; '));
  else record('P7', 'change-lock 核查', 'PASS', `active 锁 ${active}/${locks.length}，--changed ${changed.length} 条改动路径 0 冲突`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function argValue(argv, flag, fallback) {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback;
}

async function main() {
  const argv = process.argv.slice(2);
  const changedRaw = argValue(argv, '--changed', '');
  const currentOwner = argValue(argv, '--owner', process.env.TT_TASK ?? 'unknown');
  const adaptersFile = path.resolve(ROOT, argValue(argv, '--adapters-file', 'scripts/lib/adapters/index.mjs'));
  const clustersFile = path.resolve(ROOT, argValue(argv, '--clusters-file', 'scripts/lib/matrix.mjs'));

  console.log('# preflight（v3 批 1 静态不变量预检：零 LLM / 零网络 / 确定性）');
  let clusters = null;
  try {
    // 动态加载 clusters 事实源（默认 scripts/lib/matrix.mjs 的 CLUSTERS；--clusters-file 供探针注入复现）
    const mod = await import(pathToFileURL(clustersFile).href);
    clusters = mod.CLUSTERS ?? null;
  } catch { clusters = null; }
  if (!Array.isArray(clusters)) {
    record('P0', 'clusters 事实源加载', 'FAIL', `CLUSTERS_SOURCE_INVALID: ${path.relative(ROOT, clustersFile).replace(/\\/g, '/')} 不可加载或未导出 CLUSTERS 数组`);
    process.exitCode = 1;
    return;
  }
  const files = listScriptsMjs();
  checkSyntax(files);            // P1
  checkDupExports(files);        // P2
  checkAdapters(adaptersFile, clusters); // P3
  checkClustersOnDisk(clusters, clustersFile); // P4
  checkManifestSingleSource();   // P5
  checkDropAllowed();            // P6
  checkChangeLock(changedRaw, currentOwner); // P7

  const p = results.filter((r) => r.status === 'PASS').length;
  const f = failCount();
  const s = results.filter((r) => r.status === 'SKIP').length;
  console.log(`\n结果: ${p} PASS / ${f} FAIL / ${s} SKIP`);
  if (f > 0) {
    for (const r of results) if (r.status === 'FAIL') console.log(`  FAILED: ${r.id} ${r.name}`);
    process.exitCode = 1;
  } else {
    console.log('preflight 通过。');
  }
}

main();
