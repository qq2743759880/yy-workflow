#!/usr/bin/env node
/**
 * run-baseline.mjs — T5 P1-C 基线跑执行器。
 * 对 6 阶段 × 3 轮 = 18 轮，每轮：
 *   1. 重置沙箱 .tt-state
 *   2. 设置 NODE_OPTIONS=--import io-audit-hook + YY_IO_AUDIT_DIR=<run 目录>
 *   3. 执行该阶段的自然 Node 命令（prereq-check + 平台探测 + orchestrator dry-run）
 * 本脚本本身由外层 PowerShell 注入 NODE_OPTIONS 运行。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = 'D:/.ai-hub/skills/yy';
const BASE = path.join(REPO, 'test-reports/rebuild-20260920/io-baseline');
const SANDBOX = path.join(BASE, 'sandbox-project');
const RUNS_DIR = path.join(BASE, 'runs');

// stage 定义：step 号 / journey step 号 / 该轮跑哪些命令
const STAGES = [
  { step: 0, journeyStep: 0, commands: ['prereq', 'detect', 'orchestrator'] },
  { step: 1, journeyStep: 1, commands: ['prereq', 'orchestrator'] },
  { step: 2, journeyStep: 3, commands: ['prereq', 'orchestrator'] },
  { step: 3, journeyStep: 5, commands: ['prereq', 'orchestrator'] },
  { step: 4, journeyStep: 7, commands: ['prereq', 'orchestrator'] },
  { step: 5, journeyStep: 8, commands: ['prereq', 'orchestrator'] },
];

const TASK_TEXT = '后端 API 服务，RESTful 接口，用户注册登录 JWT 认证，数据存 SQLite，Node.js 实现';

function resetSandbox() {
  // 清空 .tt-state 和 contracts / artifacts 保证每轮独立
  const paths = ['.tt-state', 'contracts', 'artifacts'];
  for (const p of paths) {
    const full = path.join(SANDBOX, p);
    fs.rmSync(full, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(SANDBOX, '.tt-state'), { recursive: true });
}

function run(cmd, args, cwd) {
  try {
    const out = execFileSync(cmd, args, {
      cwd,
      stdio: 'pipe',
      timeout: 60000,
      env: process.env,
    });
    return { ok: true, stdout: out.toString('utf8').slice(0, 500) };
  } catch (e) {
    return { ok: false, stdout: (e.stdout || '').toString().slice(0, 500), stderr: (e.stderr || '').toString().slice(0, 500) };
  }
}

const args = process.argv.slice(2);
const onlyStage = args.includes('--stage') ? Number(args[args.indexOf('--stage') + 1]) : null;
const onlyRun = args.includes('--run') ? Number(args[args.indexOf('--run') + 1]) : null;

for (const stage of STAGES) {
  if (onlyStage !== null && stage.step !== onlyStage) continue;
  for (let k = 1; k <= 3; k++) {
    if (onlyRun !== null && k !== onlyRun) continue;
    const runName = `stage${stage.step}-run${k}`;
    const auditDir = path.join(RUNS_DIR, runName);
    fs.mkdirSync(auditDir, { recursive: true });

    console.log(`\n=== ${runName} (journey step ${stage.journeyStep}) ===`);
    resetSandbox();

    // 设置本轮子进程的环境变量（NODE_OPTIONS / YY_IO_AUDIT_DIR 由外层 PowerShell 注入，
    // 但子进程 execFileSync 继承 process.env，这里需要覆盖 YY_IO_AUDIT_DIR 指向本轮目录）
    const childEnv = { ...process.env, YY_IO_AUDIT_DIR: auditDir };

    // 1) prereq-check
    if (stage.commands.includes('prereq')) {
      try {
        const r = execFileSync(process.execPath,
          [path.join(REPO, 'scripts/tt-journey.mjs'), '--prereq-check', '--step', String(stage.journeyStep)],
          { cwd: SANDBOX, stdio: 'pipe', timeout: 30000, env: childEnv });
        console.log('  prereq:', r.toString().trim().slice(0, 120));
      } catch (e) {
        console.log('  prereq exit', e.status, (e.stderr || '').toString().trim().slice(0, 120));
      }
    }

    // 2) detect-platforms (stage 0 only)
    if (stage.commands.includes('detect')) {
      try {
        const r = execFileSync(process.execPath,
          [path.join(REPO, 'scripts/detect-platforms.mjs')],
          { cwd: SANDBOX, stdio: 'pipe', timeout: 30000, env: childEnv });
        console.log('  detect:', r.toString().trim().slice(0, 120));
      } catch (e) {
        console.log('  detect exit', e.status, (e.stderr || '').toString().trim().slice(0, 120));
      }
    }

    // 3) orchestrator dry-run（路由 + 资产加载，不派子代理）
    if (stage.commands.includes('orchestrator')) {
      try {
        const r = execFileSync(process.execPath,
          [path.join(REPO, 'scripts/orchestrator.mjs'), '--task', TASK_TEXT, '--workspace', SANDBOX, '--dry-run', '--no-tui'],
          { cwd: SANDBOX, stdio: 'pipe', timeout: 60000, env: childEnv });
        console.log('  orchestrator:', r.toString().trim().slice(0, 200));
      } catch (e) {
        console.log('  orchestrator exit', e.status, (e.stderr || '').toString().trim().slice(0, 200));
      }
    }

    // 统计 JSONL
    const jsonl = path.join(auditDir, 'io-audit.jsonl');
    if (fs.existsSync(jsonl)) {
      const lines = fs.readFileSync(jsonl, 'utf8').trim().split('\n').filter(Boolean);
      console.log(`  → ${lines.length} records in ${jsonl}`);
    } else {
      console.log(`  → NO JSONL at ${jsonl}`);
    }
  }
}
console.log('\nDone.');
