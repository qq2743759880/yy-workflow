/**
 * run-probes.mjs — R5a journey.mjs 重建自验运行器（file-based 行为探针，无 node -e 内联）。
 *
 * 重建口径（recovery-20260919）：scripts/lib/journey.mjs 原文件丢失（原 sha256 前 16 位
 * fe9bb851f8a36359），按冻结契约 contracts/C-R5-journey.md（FROZEN 2026-09-15）+
 * contracts/C-R5-journey-review-checklist.md 的 R5A-01…R5A-10 场景 + dev-plan R5a GWT 1-4
 * 做行为级重建。每个探针 = 契约一条可机验行为。
 *
 * 通过标准：全部 [PASS]、TOTAL: 16/16 PASS、EXIT=0。
 *
 * 沙箱（T8 加固批①：双层隔离，与 R3-activation-receipt 同模式）：
 *   - **运行级**：每次运行分配独立沙箱根 `.sandbox/run-<stamp>-<pid>/`，历史运行目录不再被触碰；
 *   - **探针级**：每个探针在运行根下独占子目录 `run-<…>/<pNN>/`，运行内互不共享；
 *   - 仓库真实文件仅只读，全部写入限制在沙箱内。
 *
 * 加固项（对应 T7 D-4 / 编排者 P2-3「R5a p16 时间戳脆弱性，失败率 ≈40%」）：
 *   1. **去时间戳依赖**：夹具写入统一走 probes/_helper.mjs 的 writeJsonFixed/writeFixed
 *      （写后 utimes 固定为 FIXED_NOW_MS），state/receipts/journey 三类权威源 mtime 同刻
 *      ⇒ computeStale（OQ-R5-2=A 相对判据）不可能由夹具写入时序诱发。p04 需要故意错时，
 *      显式用 setMtime() 覆盖，语义不受影响。
 *   2. **Windows 删目录重试**：rmSync 在 AV/索引器占用下 EBUSY/EPERM，有限重试 + 同步退避。
 *   3. **瞬态文件系统错误重试（仅瞬态，断言失败绝不重试）**：命中
 *      EPERM/EBUSY/EACCES/ENOTEMPTY/EMFILE/ENFILE/UNKNOWN 时换新沙箱重跑一次；
 *      全程留痕（stdout `[RETRY]` + JSON `attempts`/`retried`），绝不静默通过。
 *   4. **历史只追加**：`out-probe-history.jsonl`（结论不被下一次运行覆盖，波动可追溯）。
 *   5. **旧沙箱修剪**：只保留最近 5 个 run-* 目录。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixedNow as probeFixedNow } from './probes/_helper.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sandboxBase = path.join(here, '.sandbox');

const PROBES = [
  'p01-shell-uniformity.mjs',
  'p02-projection-truth.mjs',
  'p03-partial-missing-source.mjs',
  'p04-stale-relative.mjs',
  'p05-source-invalid.mjs',
  'p06-conflict-node-level.mjs',
  'p07-invalid-input-failclosed.mjs',
  'p08-not-found-data-channel.mjs',
  'p09-session-isolation.mjs',
  'p10-nine-node-display.mjs',
  'p11-inferred-only.mjs',
  'p12-honest-failed-skipped.mjs',
  'p13-nextprompt-derived.mjs',
  'p14-readonly-writer-modes.mjs',
  'p15-evidence-links-shape.mjs',
  'p16-namespace-consistency.mjs',
];

/** 瞬态文件系统错误码（Windows 句柄占用 / 索引器竞争），与实现正确性无关。 */
const TRANSIENT_FS_RE = /\b(EPERM|EBUSY|EACCES|ENOTEMPTY|EMFILE|ENFILE|UNKNOWN)\b/;

/** 同步退避（无依赖）：Atomics.wait 在同一 buffer 上等 n 毫秒。 */
function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* 退化：不睡 */ }
}

/** Windows 安全的递归删除：EBUSY/EPERM 有限重试，返回是否删除成功。 */
function rmRetry(dir, attempts = 6) {
  for (let i = 0; i < attempts; i += 1) {
    try { fs.rmSync(dir, { recursive: true, force: true }); return true; }
    catch (e) {
      if (i === attempts - 1) {
        console.log('[WARN] 沙箱删除失败（' + (e && e.code) + '）：' + dir + ' —— 本次改用新目录，不中断套件');
        return false;
      }
      sleepSync(60 * (i + 1));
    }
  }
  return false;
}

/** 修剪旧运行沙箱：只保留最近 keep 个 run-* 目录。 */
function pruneOldRuns(base, keep = 5) {
  let entries;
  try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch { return { pruned: 0, kept: 0 }; }
  const runs = entries.filter((e) => e.isDirectory() && e.name.startsWith('run-')).map((e) => e.name).sort();
  const stale = runs.slice(0, Math.max(0, runs.length - keep));
  for (const name of stale) rmRetry(path.join(base, name));
  // 加固前的平铺探针目录（历史遗留，非 run-*）一并清理，避免两套布局并存
  const legacy = entries.filter((e) => e.isDirectory() && /^p\d\d$/.test(e.name)).map((e) => e.name);
  for (const name of legacy) rmRetry(path.join(base, name));
  return { pruned: stale.length, kept: Math.min(runs.length, keep), legacyRemoved: legacy.length };
}

const runStamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + process.pid;
const runRoot = path.join(sandboxBase, 'run-' + runStamp);
fs.mkdirSync(runRoot, { recursive: true });
const pruneInfo = pruneOldRuns(sandboxBase, 5);

/** 单次探针执行（独立沙箱子目录）。 */
async function runProbeOnce(file, sandbox) {
  rmRetry(sandbox);
  fs.mkdirSync(sandbox, { recursive: true });
  let mod;
  try {
    mod = await import('./probes/' + file);
  } catch (e) {
    return { ok: false, summary: 'import threw: ' + (e && e.message || e) };
  }
  try {
    return await mod.run({ sandbox });
  } catch (e) {
    return { ok: false, summary: 'threw: ' + (e && e.message || e) };
  }
}

const results = [];
for (const file of PROBES) {
  const probeName = file.slice(0, 3); // pNN
  const attempts = [];
  const first = await runProbeOnce(file, path.join(runRoot, probeName));
  attempts.push({ attempt: 1, sandbox: probeName, ok: Boolean(first.ok), summary: first.summary });

  let entry = first;
  let retried = false;
  if (!first.ok && TRANSIENT_FS_RE.test(String(first.summary))) {
    console.log('[RETRY] ' + probeName + ' | attempt1 瞬态文件系统错误，换新沙箱重跑一次：' + first.summary.slice(0, 200));
    sleepSync(120);
    const second = await runProbeOnce(file, path.join(runRoot, probeName + '-retry1'));
    attempts.push({ attempt: 2, sandbox: probeName + '-retry1', ok: Boolean(second.ok), summary: second.summary });
    entry = second;
    retried = true;
  }

  const pass = Boolean(entry.ok);
  results.push({ probe: probeName, exitCode: pass ? 0 : 1, ok: pass, summary: entry.summary, retried, attempts });
  console.log(`[${pass ? (retried ? 'PASS*' : 'PASS') : 'FAIL'}] ${probeName} | ${entry.summary}`);
}

const passCount = results.filter((r) => r.ok).length;
const total = results.length;
const allPass = passCount === total;
const retriedList = results.filter((r) => r.retried).map((r) => r.probe);
console.log(`TOTAL: ${passCount}/${total} PASS`);
console.log(`EXIT=${allPass ? 0 : 1}`);

const payload = {
  pass: results.filter((r) => r.ok).map((r) => r.probe),
  fail: results.filter((r) => !r.ok).map((r) => r.probe),
  results,
  total,
  retried: retriedList,
  hardening: {
    runSandboxRoot: 'test-reports/rebuild-20260920/R5a-journey/.sandbox/run-<stamp>-<pid>/',
    probeSandbox: 'per-probe subdir under run root（运行级 + 探针级双层隔离）',
    fixedNow: probeFixedNow().toISOString(),
    mtimePinning: '夹具写入统一 utimes 固定（probes/_helper.mjs writeFixed/writeJsonFixed/setMtime）',
    rmRetry: 'EBUSY/EPERM 有限重试（6 次，同步退避）',
    transientRetry: '仅对瞬态文件系统错误码重试一次（新沙箱 <pNN>-retry1），断言失败不重试；全程留痕 attempts',
    history: 'out-probe-history.jsonl（只追加，历史结论不被覆盖）',
    prune: pruneInfo,
  },
};
fs.writeFileSync(path.join(here, 'out-probe-results.json'), JSON.stringify(payload, null, 2) + '\n');
fs.appendFileSync(path.join(here, 'out-probe-history.jsonl'), JSON.stringify({
  ranAt: new Date().toISOString(),
  runRoot: path.basename(runRoot),
  passCount,
  total,
  allPass,
  retried: retriedList,
  fail: payload.fail,
  failedSummaries: results.filter((r) => !r.ok).map((r) => ({ probe: r.probe, summary: r.summary })),
}) + '\n');

process.exit(allPass ? 0 : 1);
