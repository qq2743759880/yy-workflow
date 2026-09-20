#!/usr/bin/env node
/**
 * run-declared.mjs — 跑 asset-call-rate.mjs --task 对 6 条阶段指令的路由模拟。
 * 收集每轮输出到 declared/ 目录。
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const REPO = 'D:/.ai-hub/skills/yy';
const OUT_DIR = path.join(REPO, 'test-reports/rebuild-20260920/io-baseline/declared');
fs.mkdirSync(OUT_DIR, { recursive: true });

const PROMPTS = [
  '盘点资产与平台，只做需求澄清不写代码',
  '逐轮挖掘需求产出概念版',
  '前提挑战后拆任务',
  '规划并冻结契约',
  '派单执行并独立实证验收',
  '强制技术批判对标竞品',
];

for (let s = 0; s < PROMPTS.length; s++) {
  const prompt = PROMPTS[s];
  console.log(`\n=== declared stage${s}: "${prompt}" ===`);
  try {
    const out = execFileSync(process.execPath,
      [path.join(REPO, 'scripts/asset-call-rate.mjs'), '--task', prompt],
      { cwd: REPO, stdio: 'pipe', timeout: 120000 });
    const text = out.toString('utf8');
    fs.writeFileSync(path.join(OUT_DIR, `stage${s}.txt`), text);
    console.log(text.slice(0, 800));
  } catch (e) {
    const text = (e.stdout || '').toString() + '\n---STDERR---\n' + (e.stderr || '').toString();
    fs.writeFileSync(path.join(OUT_DIR, `stage${s}.txt`), text);
    console.log('exit', e.status);
    console.log(text.slice(0, 800));
  }
}
console.log('\nDone.');
