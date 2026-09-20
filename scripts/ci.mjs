#!/usr/bin/env node
/**
 * TT 一键回归卡点（task C-2）：validate + review-gate + plan-review + regression-all 顺序执行。
 * 任一子命令失败 → 打印失败段 + exit 1；全部通过 → "CI PASS" + exit 0。
 * 零依赖，node >=18，复用 node:child_process。供 CI/人工统一触发。
 *
 * 段：
 *   S1 validate-structure.mjs            —— 结构校验
 *   S2 review-gate.mjs --self-test       —— 批判闸门代码级自测
 *   S3 plan-review.mjs --check <临时报告> —— 三视角评审报告机验（临时最小通过报告，os.tmpdir）
 *   S4 regression-all.mjs                —— 全量回归
 *
 * B0 双跑（P3 阶段 B）：
 *   - 默认（无旗标）= legacy 内联路径，与重构前逐字节一致（含尾随换行，P2-3）。
 *   - --lib = 经 scripts/lib/ci.mjs（runGate / countOpenP0 / buildTempReportContent）驱动；
 *     stdout 与退出码对同一输入必须与 legacy 逐字节一致。本任务不翻默认（翻默认待编排者复核）。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GATE_MAP,
  buildTempReportContent,
  countOpenP0,
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

/** 构造 plan-review --check 可机验的最小通过报告（委托 lib 纯函数；与 legacy 内容逐字一致，除时间戳）。 */
function buildTempReport() {
  const content = buildTempReportContent({ now: new Date() });
  const file = path.join(os.tmpdir(), `tt-ci-plan-review-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

function cleanup(reportFile) {
  try { if (reportFile) fs.unlinkSync(reportFile); } catch { /* ignore */ }
}

/** S5 P0 硬闸门的 tracker 路径（legacy 与 lib 共用同一位置）。 */
function trackerPath() {
  return path.join(ROOT, 'plans', 'critique-backlog-tracker.md');
}

/**
 * 默认（legacy）路径：与重构前逐行一致的段驱动，零行为变化。
 */
async function mainLegacy() {
  const segments = [
    { name: 'S1 validate-structure', script: 'validate-structure.mjs', args: [] },
    { name: 'S2 review-gate self-test', script: 'review-gate.mjs', args: ['--self-test'] },
  ];

  const reportFile = buildTempReport();
  segments.push({ name: 'S3 plan-review --check', script: 'plan-review.mjs', args: ['--check', reportFile] });
  segments.push({ name: 'S4 regression-all', script: 'regression-all.mjs', args: [] });

  for (const seg of segments) {
    console.log('\n=== ' + seg.name + ' ===');
    const code = await run(seg.script, seg.args);
    if (code !== 0) {
      console.log('\n[FAIL] ' + seg.name + ' 退出码 ' + code + '（以上为失败段输出）');
      cleanup(reportFile);
      process.exit(1);
    }
    console.log('[PASS] ' + seg.name);
  }

  // S5 P0 硬闸门（用户要求：P0 未清零，M3 不得开始）
  const trackerFile = trackerPath();
  if (fs.existsSync(trackerFile)) {
    const trackerLines = fs.readFileSync(trackerFile, 'utf8').split('\n').filter(l => /^\| C-/.test(l.trim()));
    const p0Open = trackerLines.filter(l => l.includes('| P0 |') && l.includes('⬜')).length;
    console.log('\n=== S5 P0 硬闸门 ===');
    console.log(`  P0 未闭环: ${p0Open}`);
    if (p0Open > 0) {
      console.log('\n[FAIL] P0 批判未清零（' + p0Open + ' 条 ⬜）——P0 修复前 M3 不得开始');
      process.exit(1);
    }
    console.log('[PASS] S5 P0 硬闸门（0 条 P0 ⬜）');
  }
  cleanup(reportFile);
  // F4 资产质量评分（MUSE 评估模式融合）：跑 asset-call-rate，输出质量分（信息段，非 blocking）
  console.log('\n=== S5 资产质量评分（asset-call-rate）===');
  const rateCode = await run('asset-call-rate.mjs', ['--task', 'backend login module']);
  console.log('[INFO] 资产质量评分（exit ' + rateCode + '）——exit 1 = 有需审查资产（信息，不阻断 CI）');
  console.log('\nCI PASS');
  process.exit(0);
}

/**
 * --lib 双跑路径：经 lib runGate/countOpenP0 驱动，stdout/退出码与 legacy 逐字节一致。
 *
 * 注：lib GATE_TOPOLOGY 将资产质量评分段命名为 S6，而 legacy stdout 历史上印为
 *   "S5 资产质量评分"（见 mainLegacy）。为保持逐字节一致，此处沿用 legacy 历史字符串，
 *   不采用 lib 的 S6 名称（差异在 RESULTS.md 登记）。
 */
async function mainLib() {
  const reportFile = buildTempReport();
  const ctx = { spawn: run, tempReportFile: reportFile };

  // S1-S4：spawn 门，经 lib runGate 驱动；门名取自 GATE_MAP（与 legacy 字符串一致）
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

  // S5 P0 硬闸门：条件同 legacy（tracker 存在才打印），计数委托 lib countOpenP0
  const trackerFile = trackerPath();
  if (fs.existsSync(trackerFile)) {
    const trackerText = fs.readFileSync(trackerFile, 'utf8');
    const p0Open = countOpenP0(trackerText);
    console.log('\n=== S5 P0 硬闸门 ===');
    console.log(`  P0 未闭环: ${p0Open}`);
    if (p0Open > 0) {
      console.log('\n[FAIL] P0 批判未清零（' + p0Open + ' 条 ⬜）——P0 修复前 M3 不得开始');
      process.exit(1);
    }
    console.log('[PASS] S5 P0 硬闸门（0 条 P0 ⬜）');
  }
  cleanup(reportFile);

  // S6 资产质量评分（legacy 历史 stdout 印为 "S5 资产质量评分"，逐字沿用）
  console.log('\n=== S5 资产质量评分（asset-call-rate）===');
  const rateCode = await run('asset-call-rate.mjs', ['--task', 'backend login module']);
  console.log('[INFO] 资产质量评分（exit ' + rateCode + '）——exit 1 = 有需审查资产（信息，不阻断 CI）');
  console.log('\nCI PASS');
  process.exit(0);
}

async function main() {
  if (process.argv.includes('--lib')) return mainLib();
  return mainLegacy();
}

process.exitCode = 1;
main();
