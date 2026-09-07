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
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** 构造 plan-review --check 可机验的最小通过报告（三视角 Finding+处置，Eng 含 confidence+引用行）。 */
function buildTempReport() {
  const report = [
    '# plan-review-report',
    '',
    '- plan: scripts/ci.mjs（临时最小通过报告）',
    '- 生成: ' + new Date().toISOString(),
    '',
    '## CEO 范围视角',
    '',
    '- Finding: ci.mjs 覆盖 spec 四段回归（validate/review-gate/plan-review/regression-all）',
    '- 处置: 保持与 task C-2 契约一致',
    '',
    '## Eng 架构视角',
    '',
    '- Finding: spawn 以 process.execPath 直跑，零依赖顺序执行 (confidence: 9/10) scripts/ci.mjs:31',
    '- 处置: 任一失败短路 exit 1，全过输出 CI PASS',
    '',
    '## Design 体验视角',
    '',
    '- Finding: 分段继承子命令输出，失败段立即可定位',
    '- 处置: 统一 CI PASS/FAIL 出口，退出码可被 CI 消费',
    '',
  ].join('\n');
  const file = path.join(os.tmpdir(), `tt-ci-plan-review-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(file, report, 'utf8');
  return file;
}

async function main() {
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
  cleanup(reportFile);
  // F4 资产质量评分（MUSE 评估模式融合）：跑 asset-call-rate，输出质量分（信息段，非 blocking）
  console.log('\n=== S5 资产质量评分（asset-call-rate）===');
  const rateCode = await run('asset-call-rate.mjs', ['--task', 'backend login module']);
  console.log('[INFO] 资产质量评分（exit ' + rateCode + '）——exit 1 = 有需审查资产（信息，不阻断 CI）');
  console.log('\nCI PASS');
  process.exit(0);
}

function cleanup(reportFile) {
  try { if (reportFile) fs.unlinkSync(reportFile); } catch { /* ignore */ }
}

process.exitCode = 1;
main();
