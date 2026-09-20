/**
 * run-probes.mjs — P1 IO 审计工具自测运行器（file-based 行为探针，无 node -e 内联）。
 *
 * 覆盖：
 *   p01 hook 捕获 vendor 读取（readFileSync/readFile/createReadStream/readdir）且非 vendor 不记
 *   p02 routing vs consumption 归类（调用栈特征串）
 *   p03 中文/空格/混合斜杠/大小写路径规范化（cwd 在仓库外 → 作用域防护不安装）
 *   p04 作用域防护（cwd 外进程不记录）+ JSONL 滚动（YY_IO_AUDIT_MAX_BYTES 压小触发 .1）
 *   p05 report 聚合：每资产计数、阶段×资产矩阵、journey 缺失→全 unknown、fail-closed
 *   p06 transcript 采集：Read/shell 读动作、排除 ls 列目录与 manifest 扫描块
 *
 * 通过标准：全部 [PASS]、TOTAL: N/N PASS、EXIT=0。
 * 沙箱：所有探针写入限制在本目录 .sandbox/ 下（.gitignore 已按 test-reports 下 .sandbox 通配忽略）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sandboxBase = path.join(here, '.sandbox');

const PROBES = [
  'p01-hook-capture.mjs',
  'p02-routing-consumption.mjs',
  'p03-chinese-path-norm.mjs',
  'p04-rotation-scope.mjs',
  'p05-report-matrix.mjs',
  'p06-transcript-extract.mjs',
];

const results = [];
for (const file of PROBES) {
  const probeName = file.slice(0, 3); // pNN
  const sandbox = path.join(sandboxBase, probeName);
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.mkdirSync(sandbox, { recursive: true });
  const mod = await import('./probes/' + file);
  let entry;
  try {
    entry = await mod.run({ sandbox, here });
  } catch (e) {
    entry = { ok: false, summary: 'threw: ' + e.message };
  }
  results.push({ probe: probeName, exitCode: entry.ok ? 0 : 1, ok: entry.ok, summary: entry.summary });
  console.log(`[${entry.ok ? 'PASS' : 'FAIL'}] ${probeName} | ${entry.summary}`);
}

const passCount = results.filter((r) => r.ok).length;
const total = results.length;
const allPass = passCount === total;
console.log(`TOTAL: ${passCount}/${total} PASS`);
console.log(`EXIT=${allPass ? 0 : 1}`);

fs.writeFileSync(path.join(here, 'out-probe-results.json'), JSON.stringify({
  pass: results.filter((r) => r.ok).map((r) => r.probe),
  fail: results.filter((r) => !r.ok).map((r) => r.probe),
  results,
  total,
}, null, 2) + '\n');

process.exit(allPass ? 0 : 1);
