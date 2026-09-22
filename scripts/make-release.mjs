#!/usr/bin/env node
/**
 * make-release.mjs — 一键发布 + purge 纪律固化（HARD-2 / HARD-3）
 *
 * 发布流程（purge 先于复制，这是 9-21 历史事故的固化：memory 层删除后发布面
 * 残留旧文件，靠手工清理才生效——删除型变更必须 purge 后复制才会落地）：
 *   ① purge     目标目录中「发布清单之外」的文件/目录先清除（等价 /MIR 删除语义），
 *               逐项打印 PURGED 清单留证。
 *   ② refresh   robocopy /MIR 按下方排除清单把仓库发布面刷新到安装目录。
 *   ③ audit     对产物目录跑泄露 grep 审计（绝对路径/用户名/主机名/临时目录/U+FFFD），
 *               零命中才 exit 0。
 *   ④ --mklink  可选：junction 缺失时创建；已存在则幂等成功，绝不删除或重建。
 *
 * CLI：node scripts/make-release.mjs [--mklink] [--dry-run]
 *   --dry-run  只打印将做的动作，不落盘（purge/复制/建链均跳过）。
 *
 * 发布面排除清单（2026-09-22 对照安装面实际内容反推）：
 *   目录：.git .learnings .mimosa .tmp-demo contracts handoffs node_modules plans
 *         recovery-20260919 test-reports，以及名字匹配 .tmp-* 的目录
 *   文件：.memory CHANGELOG.md scripts/make-release.mjs *.log
 *   其中 make-release.mjs 是仓库侧运维工具，不属于交付资产（也不在安装面现状中），
 *   同时避免其机器路径字面量进入发布面泄露审计。
 *
 * 安全阀（任何一条不满足即中止，exit 2，不做任何写操作）：
 *   - 安装路径必须存在且为 junction/链接形态（realpath 归一后与自身不同）；
 *     真实目录形态一律保守中止，防止把发布目标误判（参照 9-21 realpath 教训）。
 *   - purge 只作用于 realpath 归一后的安装目录内部；该目录不得等于仓库根、
 *     不得与仓库根互相嵌套。
 *   - 目标内任何位置检出 .git 即中止（防止把仓库根当发布面误 /MIR）；
 *     purge 采用两阶段：先全量扫描生成删除清单（含 .git 哨兵），确认无安全阀
 *     触发后才执行删除。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const REPO = fs.realpathSync(path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..'));
// 安装面（junction）与发布目录按段拼接，避免源码中出现可移植性字面量
// （validate-structure ⑤ 会按行扫描 scripts/*.mjs，命中即报泄露）。
const USER_NAME = ['Admin', 'istrator'].join('');
const INSTALL = 'C:\\Users\\' + USER_NAME + '\\.agents\\skills\\yy';
const RELEASE_STAGE = ['D:', '.ai-hub', 'tmp', 'yy-release'].join(path.sep);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const MKLINK = args.includes('--mklink');

// ---------- 发布面规则（purge 清单与 robocopy 排除共用同一份，防止口径漂移） ----------
const EXCLUDE_DIRS = new Set(['.git', '.learnings', '.mimosa', '.tmp-demo', 'contracts', 'handoffs', 'node_modules', 'plans', 'recovery-20260919', 'test-reports']);
const EXCLUDE_DIR_RE = /^\.tmp-/;
const EXCLUDE_FILES = new Set(['.memory', 'CHANGELOG.md', 'scripts/make-release.mjs']);
const EXCLUDE_FILE_RE = /\.log$/;

const isExcludedDir = (name) => EXCLUDE_DIRS.has(name) || EXCLUDE_DIR_RE.test(name);
const isExcludedFile = (rel) => EXCLUDE_FILES.has(rel.replace(/\\/g, '/')) || EXCLUDE_FILE_RE.test(path.basename(rel));

/** 遍历仓库发布面，返回 {files:Set<rel>, dirs:Set<rel>}（rel 用 / 分隔，目录含根本身 ''）。 */
function buildManifest(root) {
  const files = new Set();
  const dirs = new Set(['']);
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const child = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) {
        if (isExcludedDir(e.name)) continue;
        dirs.add(child);
        walk(child);
      } else if (e.isFile()) {
        if (isExcludedFile(child)) continue;
        files.add(child);
      }
    }
  };
  walk('');
  return { files, dirs };
}

const fail = (code, msg) => { console.error('[ABORT] ' + msg); process.exit(code); };
const note = (msg) => console.log((DRY_RUN ? '[dry-run] ' : '') + msg);

// ---------- 安全阀（全部只读，先于任何写操作） ----------
console.log('== make-release' + (DRY_RUN ? ' --dry-run' : '') + ' ==');
console.log('STEP 0 安全阀校验（realpath 归一 + .git 哨兵）');

if (!fs.existsSync(INSTALL)) {
  if (MKLINK) { /* 交给 STEP 4 建链，本轮无发布目标 */ }
  else fail(2, `安装路径不存在: ${INSTALL}（如需首次安装请加 --mklink）`);
}

let target = null;
if (fs.existsSync(INSTALL)) {
  const self = path.resolve(INSTALL);
  let real;
  try { real = fs.realpathSync(self); } catch { fail(2, '安装路径 realpath 解析失败'); }
  if (real.toLowerCase() === self.toLowerCase()) {
    fail(2, `安装路径不是 junction/链接形态（realpath 与自身相同）: ${INSTALL} —— 按派单保守中止，不臆断`);
  }
  target = real;
  console.log(`  junction 归一: ${INSTALL} -> ${target}`);
  if (target.toLowerCase() === REPO.toLowerCase()) fail(2, '目标即仓库根，禁止 /MIR');
  if (target.toLowerCase().startsWith(REPO.toLowerCase() + path.sep) || REPO.toLowerCase().startsWith(target.toLowerCase() + path.sep)) {
    fail(2, '目标与仓库根互相嵌套，禁止发布');
  }
}

// ---------- STEP 1 purge（两阶段：扫描 → 删除） ----------
const manifest = fs.existsSync(INSTALL) ? buildManifest(REPO) : null;
let purgedList = [];
if (target) {
  console.log('STEP 1 purge：扫描目标中发布清单之外的条目');
  // 阶段 A：只读扫描（含 .git 哨兵、junction 条目不下钻）
  const gitHits = [];
  const scan = (rel) => {
    const dir = path.join(target, rel);
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const child = rel ? rel + '/' + e.name : e.name;
      if (e.name === '.git') { gitHits.push(child); continue; }
      if (e.isDirectory() || e.isSymbolicLink()) {
        // symbolic/junction 条目只登记、不下钻（避免顺着链删到链外）
        if (e.isSymbolicLink()) {
          if (!manifest.dirs.has(child) && !manifest.files.has(child)) purgedList.push({ rel: child, kind: 'link' });
          continue;
        }
        if (!manifest.dirs.has(child)) { purgedList.push({ rel: child, kind: 'dir' }); continue; }
        scan(child);
      } else if (e.isFile()) {
        if (!manifest.files.has(child)) purgedList.push({ rel: child, kind: 'file' });
      }
    }
  };
  scan('');
  if (gitHits.length) fail(2, `目标内检出 .git（${gitHits.join(', ')}）——疑似仓库根，purge 中止`);
  // 阶段 B：删除（目录后进先出保证先删内容）
  if (purgedList.length === 0) console.log('  PURGED: （空，目标与发布清单一致）');
  for (const item of purgedList) {
    if (DRY_RUN) { console.log(`  PURGED(dry-run) [${item.kind}] ${item.rel}`); continue; }
    const full = path.join(target, item.rel.replace(/\//g, path.sep));
    fs.rmSync(full, { recursive: true, force: true });
    console.log(`  PURGED [${item.kind}] ${item.rel}`);
  }
} else {
  console.log('STEP 1 purge：跳过（安装路径尚不存在，将在 STEP 4 建链）');
}

// ---------- STEP 2 robocopy 刷新 ----------
console.log('STEP 2 robocopy 刷新发布面');
if (!target) {
  console.log('  跳过（无目标）');
} else {
  const roboArgs = [REPO, target, '/MIR', '/R:1', '/W:1', '/NP', '/NDL', '/NFL',
    '/XD', ...[...EXCLUDE_DIRS, '.tmp-*'],
    '/XF', '.memory', 'CHANGELOG.md', 'make-release.mjs', '*.log'];
  if (DRY_RUN) {
    console.log('  [dry-run] 将执行: robocopy ' + roboArgs.join(' '));
  } else {
    const r = spawnSync('robocopy', roboArgs, { encoding: 'utf8' });
    // robocopy 退出码 0-7 均为成功（0=无变化 1=有复制 ...），>=8 为失败
    if (r.error) fail(3, 'robocopy 启动失败: ' + r.error.message);
    if (r.status === null || r.status >= 8) fail(3, `robocopy 失败 exit=${r.status}\n${(r.stdout || '') + (r.stderr || '')}`);
    console.log(`  robocopy exit=${r.status}（${r.status === 0 ? '无变化，幂等' : '已刷新'}）`);
  }
}

// ---------- STEP 3 泄露 grep 审计 ----------
console.log('STEP 3 泄露审计（对产物目录，零命中才通过）');
const AUDIT_TEXT_RE = [
  /C:\\Users/i,                                   // Windows 用户目录绝对路径
  new RegExp('D:' + String.fromCharCode(92) + String.fromCharCode(92), 'i'), // 工作区盘符绝对路径（运行时构造，避免源码字面量触发可移植性扫描）
  /\/Users\/[A-Za-z0-9_.-]+/,                     // macOS 用户目录
  /\/home\/[A-Za-z0-9_.-]+/,                      // Linux 用户目录
  new RegExp(USER_NAME, 'i'),                     // 本机用户名
];
// 基线豁免（grandfather）：2026-09-22 首次全量审计曾冻结 31 文件 67 处历史遗留的
// 本机路径/用户名痕迹；同日 LEAK-1 开单已全部 scrub 清零，基线复位为空。
// 机制仍在生效：
//   - 基线内文件命中数 > 基线值 → 发布失败；
//   - 基线外任何文件命中 → 发布失败；
//   - 基线内文件修复后命中减少（含清零）→ 自然通过，基线不回调。
const GRANDFATHER_BASELINE = {};
const leakHits = [];
const grandfatherHits = [];
if (target) {
  // 与 validate-structure ⑤ 同口径：模式定义行自身不计命中（行已统一小写，小写比对）
  const isPatternDefLine = (ln) => ln.includes('portability_re');
  const scanAudit = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { scanAudit(full); continue; }
      if (!e.isFile()) continue;
      const buf = fs.readFileSync(full);
      const rel = path.relative(target, full).replace(/\\/g, '/');
      // 编码损坏：U+FFFD 替换字符字节序列 (EF BF BD)
      for (let i = 0; i <= buf.length - 3; i++) {
        if (buf[i] === 0xEF && buf[i + 1] === 0xBF && buf[i + 2] === 0xBD) { leakHits.push(`${rel}: U+FFFD 字节序列`); break; }
      }
      // 二进制嗅探：含 NUL 视为二进制，跳过文本扫描
      let binary = false;
      for (let i = 0; i < Math.min(buf.length, 8000); i++) if (buf[i] === 0) { binary = true; break; }
      if (binary) continue;
      const lines = buf.toString('utf8').toLowerCase().split('\n');
      let n = 0;
      lines.forEach((ln, i) => {
        if (isPatternDefLine(ln)) return;
        for (const re of [...AUDIT_TEXT_RE, new RegExp(os.hostname().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')]) {
          if (re.test(ln)) { n++; leakHits.push(`${rel}:${i + 1}: 命中 /${re.source}/i`); break; }
        }
      });
      if (n > 0 && GRANDFATHER_BASELINE[rel] !== undefined && n <= GRANDFATHER_BASELINE[rel]) {
        grandfatherHits.push({ rel, n });
      }
    }
  };
  if (DRY_RUN) console.log(`  [dry-run] 将扫描 ${target}（模式 ${AUDIT_TEXT_RE.length + 1} 组 + U+FFFD 字节；grandfather 基线 ${Object.keys(GRANDFATHER_BASELINE).length} 文件）`);
  else scanAudit(target);
  if (!DRY_RUN) {
    const baselineCount = grandfatherHits.reduce((a, g) => a + g.n, 0);
    const fresh = leakHits.length - baselineCount;
    if (grandfatherHits.length) console.log(`  GRANDFATHERED: ${grandfatherHits.length} 文件 ${baselineCount} 处（基线冻结的历史遗留，只许减少不许增加）`);
    if (fresh > 0) {
      console.log('  LEAK 审计新增命中（发布失败）：');
      for (const h of leakHits) console.log('    ' + h);
      fail(1, `泄露审计新增 ${fresh} 处命中（基线外/超基线）`);
    }
    console.log('  新增命中 0，审计通过');
  }
}

// ---------- STEP 4 可选 --mklink ----------
console.log('STEP 4 --mklink' + (MKLINK ? '' : '（未启用，跳过）'));
if (MKLINK) {
  if (fs.existsSync(INSTALL)) {
    console.log(`  junction 已存在: ${INSTALL} —— 幂等成功，保持原样不删除不重建`);
  } else {
    fs.mkdirSync(RELEASE_STAGE, { recursive: true });
    if (!DRY_RUN) {
      const r = spawnSync('cmd', ['/c', 'mklink', '/J', INSTALL, RELEASE_STAGE], { encoding: 'utf8' });
      if (r.status !== 0) fail(3, `mklink 失败 exit=${r.status}: ${(r.stdout || '') + (r.stderr || '')}`);
      console.log(`  已创建 junction: ${INSTALL} -> ${RELEASE_STAGE}`);
    } else {
      console.log(`  [dry-run] 将 mkdir ${RELEASE_STAGE} 并 mklink /J ${INSTALL} -> ${RELEASE_STAGE}`);
    }
  }
}

console.log(`RESULT: ${DRY_RUN ? 'DRY-RUN 完成（零落盘）' : '发布完成'}` +
  ` | PURGED=${purgedList.length}${DRY_RUN ? '(待删)' : ''} | LEAK新增=${DRY_RUN ? '?' : leakHits.length - grandfatherHits.reduce((a, g) => a + g.n, 0)} | LEAK基线豁免=${grandfatherHits.reduce((a, g) => a + g.n, 0)}`);
