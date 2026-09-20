/**
 * run-probes.mjs — R3 activation.mjs / receipt.mjs 重建自验运行器（file-based 外置探针，无 node -e 内联）。
 *
 * 重建口径（rebuild-20260920）：原 R3 两模块已丢失，本运行器按冻结契约 contracts/C-R3-activation.md
 * 的行为条款（GWT-R3-01…05、清单 R3-1…R3-12、§7.7 C6 7case、§7.4 P1-P5）逐条机验重建实现。
 * 通过标准：`[PASS] ×16`、`TOTAL: 16/16 PASS`、`EXIT=0`。
 *
 * 沙箱（T7 收尾批⑤ 加固双层隔离）：
 *   - **运行级**：每次运行分配独立沙箱根 `.sandbox/run-<stamp>-<pid>/`，历史运行目录不再被触碰
 *     （跨运行串扰、上次残留被复用等波动源彻底隔离）；
 *   - **探针级**：每个探针在运行根下独占子目录 `run-<…>/<pNN>/`，运行内互不共享；
 *   - 仓库真实 vendor/ 仅只读引用，探针内断言 vendor 零写入。
 * 同时加固的（对应 T5T6 P2-3「1 次未复现 15/16 波动」）：
 *   1. **去时钟依赖**：探针时钟固定（probes/_helper.mjs FIXED_NOW，prepare/append 默认注入）；
 *   2. **Windows 删目录重试**：rmSync 在 AV/索引器占用下会 EBUSY/EPERM，改为有限重试（含同步退避），
 *      避免残留目录污染下一次运行；
 *   3. **瞬态文件系统错误重试（只对瞬态，不对断言）**：Windows 实时防护会在探针"写后立即读"的瞬间
 *      持有文件句柄，导致 EPERM/EBUSY/EACCES 等**与实现正确性无关**的抛出。命中此类错误码时该探针
 *      在新沙箱子目录 `<pNN>-retry1` 重跑一次；**断言失败（summary 不含瞬态错误码）绝不重试**。
 *      重试全程留痕：stdout 打 `[RETRY]`，JSON 记录 attempts 与 retried=true，绝无静默通过。
 *   4. **历史只追加**：`out-probe-results.json` 是"本次结果"（供套件读取），同时把每次运行的结论
 *      追加到 `out-probe-history.jsonl`——历史运行不会被下一次运行覆盖，波动可追溯；
 *   5. **旧沙箱修剪**：只保留最近 5 个 run-* 目录，避免 .sandbox 无限膨胀加剧索引器竞争。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixedNow as probeFixedNow } from './probes/_helper.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sandboxBase = path.join(here, '.sandbox');

const PROBES = [
  'p01-metadata-level.mjs',
  'p02-body-level.mjs',
  'p03-resource-level.mjs',
  'p04-budget.mjs',
  'p05-body-missing.mjs',
  'p06-mode.mjs',
  'p07-chain-terminal.mjs',
  'p08-idempotency.mjs',
  'p09-invalid-events.mjs',
  'p10-hash-chain.mjs',
  'p11-c6-fixtures.mjs',
  'p12-legacy-compat.mjs',
  'p13-positive-matrix.mjs',
  'p14-selected-not-consumed.mjs',
  'p15-prepare-idempotency.mjs',
  'p16-p5-predicate.mjs',
];

/** 瞬态文件系统错误码（Windows 句柄占用 / 索引器竞争），与实现正确性无关。 */
const TRANSIENT_FS_RE = /\b(EPERM|EBUSY|EACCES|ENOTEMPTY|EMFILE|ENFILE|UNKNOWN)\b/;

/** 同步退避（无依赖）：Atomics.wait 在同一 buffer 上等 n 毫秒。 */
function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* 退化：不睡 */ }
}

/** Windows 安全的递归删除：EBUSY/EPERM（杀软/索引器占用）有限重试，返回是否删除成功。 */
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

/** 修剪旧运行沙箱：只保留最近 keep 个 run-* 目录（新→旧）。 */
function pruneOldRuns(base, keep = 5) {
  let entries;
  try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch { return 0; }
  const runs = entries.filter((e) => e.isDirectory() && e.name.startsWith('run-')).map((e) => e.name).sort();
  const stale = runs.slice(0, Math.max(0, runs.length - keep));
  for (const name of stale) rmRetry(path.join(base, name));
  return stale.length;
}

const runStamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + process.pid;
const runRoot = path.join(sandboxBase, 'run-' + runStamp);
fs.mkdirSync(runRoot, { recursive: true });
const prunedRuns = pruneOldRuns(sandboxBase, 5);

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
  const probeName = file.replace(/\.mjs$/, '');
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
    runSandboxRoot: 'test-reports/rebuild-20260920/R3-activation-receipt/.sandbox/run-<stamp>-<pid>/',
    probeSandbox: 'per-probe subdir under run root（运行级 + 探针级双层隔离）',
    fixedNow: probeFixedNow().toISOString(),
    rmRetry: 'EBUSY/EPERM 有限重试（6 次，同步退避）',
    transientRetry: '仅对瞬态文件系统错误码重试一次（新沙箱 <pNN>-retry1），断言失败不重试；全程留痕 attempts',
    history: 'out-probe-history.jsonl（只追加，历史结论不被覆盖）',
    prunedRuns,
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
