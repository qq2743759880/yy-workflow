#!/usr/bin/env node
/**
 * A2 差分自测探针 — lib 的 plan dry-run 输出 vs 真实 orchestrator.mjs --plan --dry-run
 *
 * ≥3 组输入，至少 1 组触发错误路径：
 *   组1: 合法单 phase 草案 → 正常 dry-run 输出
 *   组2: 合法多 phase 草案 → 正常 dry-run 输出
 *   组3: 非法草案（asset 不在白名单）→ 错误路径 exit 6
 *   组4: 空 task → 参数校验错误 exit 2
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from '../../../scripts/lib/manifest.mjs';
import {
  parseArgs, validateOpts, isOpenApiSpec, parseBacklogRows, backlogIsPending, classifyExitError, planDryRun,
} from '../../../scripts/lib/orchestrator.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPTS = path.join(ROOT, 'scripts');
const VENDOR = path.join(ROOT, 'vendor');

let pass = 0, fail = 0;
const results = [];

function check(name, condition, detail) {
  if (condition) { pass++; results.push('PASS ' + name); }
  else { fail++; results.push('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

/** 跑真实 orchestrator 子进程，返回 {stdout, stderr, code}。 */
function runOrchestrator(args) {
  try {
    const stdout = execFileSync(process.execPath, [path.join(SCRIPTS, 'orchestrator.mjs'), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30000,
    });
    return { stdout, stderr: '', code: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', code: err.status ?? 1 };
  }
}

/** 创建临时草案文件，返回路径。 */
function writeDraft(content) {
  const f = path.join(os.tmpdir(), 'tt-dryrun-draft-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
  fs.writeFileSync(f, JSON.stringify(content), 'utf8');
  return f;
}

// --- 组1: 合法单 phase 草案 ---
const draft1 = {
  task: 'build a login page',
  draft: true,
  phases: [{
    name: 'phase-1',
    tasks: [
      { id: 't1', desc: 'create login form component', asset: 'implementation', estimate: 'M', lane: 'a', dependsOn: [] },
    ],
  }],
};
const draft1File = writeDraft(draft1);
const real1 = runOrchestrator(['--plan', '--dry-run', '--task', 'build a login page', '--draft', draft1File]);

const lib1 = await planDryRun(['--plan', '--dry-run', '--task', 'build a login page', '--draft', draft1File], {
  readFile: (p) => fs.promises.readFile(p, 'utf8'),
  buildManifest: () => buildManifest({ vendorDir: VENDOR }),
  workspace: ROOT,
  config: null,
  errorTypes: {},
});

check('组1: exit code 一致', real1.code === lib1.exitCode, `real=${real1.code} lib=${lib1.exitCode}`);
check('组1: stdout 逐字节一致', real1.stdout.trim() === lib1.stdout.trim(),
  '--- real ---\n' + real1.stdout + '\n--- lib ---\n' + lib1.stdout);

// --- 组2: 合法多 phase 多 task 草案 ---
const draft2 = {
  task: 'backend API design',
  draft: true,
  phases: [
    {
      name: 'phase-1',
      tasks: [
        { id: 't1', desc: 'design API architecture', asset: 'be-architect', estimate: 'L', lane: 'a', dependsOn: [] },
        { id: 't2', desc: 'set up provider layer', asset: 'be-provider', estimate: 'M', lane: 'b', dependsOn: [] },
      ],
    },
    {
      name: 'phase-2',
      tasks: [
        { id: 't3', desc: 'validate contracts', asset: 'be-validator', estimate: 'M', lane: 'a', dependsOn: ['t1'] },
      ],
    },
  ],
};
const draft2File = writeDraft(draft2);
const real2 = runOrchestrator(['--plan', '--dry-run', '--task', 'backend API design', '--draft', draft2File]);

const lib2 = await planDryRun(['--plan', '--dry-run', '--task', 'backend API design', '--draft', draft2File], {
  readFile: (p) => fs.promises.readFile(p, 'utf8'),
  buildManifest: () => buildManifest({ vendorDir: VENDOR }),
  workspace: ROOT,
  config: null,
  errorTypes: {},
});

check('组2: exit code 一致', real2.code === lib2.exitCode, `real=${real2.code} lib=${lib2.exitCode}`);
check('组2: stdout 逐字节一致', real2.stdout.trim() === lib2.stdout.trim(),
  '--- real ---\n' + real2.stdout.slice(0, 500) + '\n--- lib ---\n' + lib2.stdout.slice(0, 500));

// --- 组3: 非法草案（asset 不在白名单）→ 错误路径 ---
const draft3 = {
  task: 'bad task',
  draft: true,
  phases: [{
    name: 'phase-1',
    tasks: [
      { id: 't1', desc: 'something', asset: 'nonexistent-asset', estimate: 'S', lane: 'a', dependsOn: [] },
    ],
  }],
};
const draft3File = writeDraft(draft3);
const real3 = runOrchestrator(['--plan', '--dry-run', '--task', 'bad task', '--draft', draft3File]);

const lib3 = await planDryRun(['--plan', '--dry-run', '--task', 'bad task', '--draft', draft3File], {
  readFile: (p) => fs.promises.readFile(p, 'utf8'),
  buildManifest: () => buildManifest({ vendorDir: VENDOR }),
  workspace: ROOT,
  config: null,
  errorTypes: {},
});

check('组3: 错误路径 exit code 一致 (均为 6)', real3.code === lib3.exitCode && real3.code === 6,
  `real=${real3.code} lib=${lib3.exitCode}`);
check('组3: stderr 含错误信息', real3.stderr.includes('nonexistent-asset') || lib3.stderr.includes('nonexistent-asset'),
  'real stderr: ' + real3.stderr.slice(0, 200));

// --- 组4: 空 task → 参数校验错误 exit 2 ---
const real4 = runOrchestrator(['--plan', '--dry-run', '--task', '']);
const lib4 = await planDryRun(['--plan', '--dry-run', '--task', ''], {
  readFile: (p) => fs.promises.readFile(p, 'utf8'),
  buildManifest: () => buildManifest({ vendorDir: VENDOR }),
  workspace: ROOT,
  config: null,
  errorTypes: {},
});
check('组4: 空 task exit code 一致 (均为 2)', real4.code === lib4.exitCode && real4.code === 2,
  `real=${real4.code} lib=${lib4.exitCode}`);

// --- 纯函数单测 ---
// isOpenApiSpec
check('纯函数: isOpenApiSpec({openapi:"3.0"}) = true', isOpenApiSpec({ openapi: '3.0' }) === true);
check('纯函数: isOpenApiSpec({swagger:"2.0"}) = true', isOpenApiSpec({ swagger: '2.0' }) === true);
check('纯函数: isOpenApiSpec(null) = false', isOpenApiSpec(null) === false);

// parseArgs
const parsed = parseArgs(['--plan', '--dry-run', '--task', 'hello', '--draft', 'x.json']);
check('纯函数: parseArgs plan=true', parsed.plan === true);
check('纯函数: parseArgs dryRun=true', parsed.dryRun === true);
check('纯函数: parseArgs task=hello', parsed.task === 'hello');
check('纯函数: parseArgs draft=x.json', parsed.draft === 'x.json');

// validateOpts
const vOk = validateOpts(parseArgs(['--task', 'x', '--plan']));
check('纯函数: validateOpts 合法 → ok', vOk.ok === true);
const vBad = validateOpts(parseArgs(['--task', '']));
check('纯函数: validateOpts 空 task → error', vBad.ok === false && vBad.exitCode === 2);

// cleanup
for (const f of [draft1File, draft2File, draft3File]) { try { fs.unlinkSync(f); } catch {} }

console.log('=== A2 差分自测结果 ===');
for (const r of results) console.log(r);
console.log('\n合计: ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail > 0) process.exitCode = 1;
