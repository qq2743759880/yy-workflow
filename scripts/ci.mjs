#!/usr/bin/env node
/**
 * TT 一键回归卡点（task C-2）：validate + review-gate + plan-review + regression-all 顺序执行。
 * 任一子命令失败 → 打印失败段 + exit 1；全部通过 → "CI PASS" + exit 0。
 * 零依赖，node >=18，复用 node:child_process。供 CI/人工统一触发。
 *
 * 段（GATE_TOPOLOGY，lib/ci.mjs 单点定义）：
 *   S1 validate-structure.mjs            —— 结构校验
 *   S2 review-gate.mjs --self-test       —— 批判闸门代码级自测
 *   S3 plan-review.mjs --check <临时报告> —— 三视角评审报告机验（临时最小通过报告，os.tmpdir）
 *   S4 regression-all.mjs                —— 全量回归
 *   S5 P0 硬闸门（进程内，不 spawn）      —— critique-backlog-tracker.md P0 未清零 = 0
 *   S6 asset-call-rate.mjs（信息段）      —— 资产质量评分（非 blocking，历史 stdout 印作 "S5 资产质量评分"）
 *
 * B0 翻默认（T7 收尾批②，2026-09-20）：
 *   - **默认即 lib 驱动**：全部门经 scripts/lib/ci.mjs 的 GATE_TOPOLOGY / runGate /
 *     classifyOpenP0 / buildTempReportContent 驱动；本文件为薄壳（spawn/console/exit 全局态）。
 *   - 旧 legacy 内联路径**已删除**（非保留逃生舱）——翻默认前的 stdout 快照冻结于
 *     test-reports/rebuild-20260920/T4-wiring-b0b3/snapshots/，差分见同目录 b0-diff.mjs。
 *   - `--lib` 保留为**兼容 no-op**（翻默认前它切换 lib 路径，现默认即 lib，旗标被**静默忽略**：
 *     不改 stdout、不改退出码——历史调用方零破坏，逐字节输出对比不破功）。
 *   - S5 严格口径：⬜ 与 ◐ 都算未清零；◐ 行无落点/收据引用时额外输出卫生规则 warning
 *     （计数不变，分类信息见 ci.mjs 输出；裁决 plans/decision-s5-p0-semantics-20260920.md）。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GATE_MAP,
  buildTempReportContent,
  classifyOpenP0,
  runGate,
} from './lib/ci.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NODE = process.execPath;
const run = (script, args) => new Promise((resolve) => {
  const child = spawn(NODE, [path.join('scripts', script), ...args], {
    cwd: ROOT,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: false,
  });
  child.on('error', (err) => { console.error('FAIL spawn ' + script + ': ' + err.message); resolve(1); });
  child.on('exit', (code) => resolve(code ?? 1));
});

/** 构造 plan-review --check 可机验的最小通过报告（lib 纯函数，时间戳注入）。 */
function buildTempReport() {
  const content = buildTempReportContent({ now: new Date() });
  const file = path.join(os.tmpdir(), `tt-ci-plan-review-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

function cleanup(reportFile) {
  try { if (reportFile) fs.unlinkSync(reportFile); } catch { /* ignore */ }
}

/** S5 P0 硬闸门的 tracker 路径。 */
function trackerPath() {
  return path.join(ROOT, 'plans', 'critique-backlog-tracker.md');
}

/** S5 段：严格口径计数 + 证据卫生规则分类（warnings 只增判定信息，不改退出码）。 */
function runS5() {
  const trackerFile = trackerPath();
  if (!fs.existsSync(trackerFile)) return; // 条件同历史：tracker 不存在则整段跳过
  const cls = classifyOpenP0(fs.readFileSync(trackerFile, 'utf8'));
  console.log('\n=== S5 P0 硬闸门 ===');
  console.log(`  P0 未闭环: ${cls.openP0}`);
  for (const w of cls.warnings) console.log('  [WARN] ' + w);
  if (cls.openP0 > 0) {
    console.log('\n[FAIL] P0 批判未清零（' + cls.openP0 + ' 条未闭环 ⬜/◐）——P0 修复前 M3 不得开始');
    cleanup(null);
    process.exit(1);
  }
  console.log('[PASS] S5 P0 硬闸门（0 条 P0 未闭环 ⬜/◐）');
}

async function main() {
  // 兼容 no-op：--lib 在翻默认前用于切到 lib 路径，现默认即 lib。
  // 刻意**静默**（不打印任何提示）：兼容旗标不得改变 stdout/退出码，否则历史调用方
  // 的逐字节输出对比会破功（B0 G5 断言默认 vs --lib 逐字节一致）。
  const reportFile = buildTempReport();
  const ctx = { spawn: run, tempReportFile: reportFile };

  // S1-S4：spawn 门，门名取自 GATE_MAP
  for (const gid of ['S1', 'S2', 'S3', 'S4']) {
    const gate = GATE_MAP[gid];
    console.log('\n=== ' + gate.name + ' ===');
    const r = await runGate(gid, ctx);
    if (r.code !== 0) {
      console.log('\n[FAIL] ' + gate.name + ' 退出码 ' + r.code + '（以上为失败段输出）');
      cleanup(reportFile);
      process.exit(1);
    }
    console.log('[PASS] ' + gate.name);
  }

  runS5();
  cleanup(reportFile);

  // S6 资产质量评分（legacy 历史 stdout 印为 "S5 资产质量评分"，逐字沿用：外部脚本按行匹配）
  console.log('\n=== S5 资产质量评分（asset-call-rate）===');
  const rateCode = await run('asset-call-rate.mjs', ['--task', 'backend login module']);
  console.log('[INFO] 资产质量评分（exit ' + rateCode + '）——exit 1 = 有需审查资产（信息，不阻断 CI）');
  console.log('\nCI PASS');
  process.exit(0);
}

process.exitCode = 1;
main();
