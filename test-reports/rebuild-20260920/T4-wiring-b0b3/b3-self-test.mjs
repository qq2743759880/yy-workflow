#!/usr/bin/env node
/**
 * B3 自测：tt-journey.mjs --read/--project 子命令。
 *  - --read 输出与 lib/journey.mjs journeyRead 直接调用逐字节一致（固定 --now）
 *  - --project 输出与 journeyProject 直接调用逐字节一致（writerMode=legacy，固定 --now）
 *  - --project 只读消费：journey.json 不落盘（C-R5 单写者纪律）
 *  - 老子命令零变化：--prereq-check / --update / 默认渲染 / --self-test 回归
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const TT = path.join(REPO, 'scripts', 'tt-journey.mjs');
const NOW = '2026-09-20T00:00:00.000Z';

const results = [];
function check(name, ok, detail = '') {
  results.push([name, ok, detail]);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : ''));
}

function run(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [TT, ...args], { cwd: cwd || REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (c) => { out += c.toString(); });
    child.stderr.on('data', (c) => { out += c.toString(); });
    child.on('close', (code) => resolve({ code, out }));
  });
}

async function directCall(kind, ws) {
  const mod = await import(pathToFileURL(path.join(REPO, 'scripts', 'lib', 'journey.mjs')).href);
  const input = { workspace: ws, opts: { now: new Date(NOW), writerMode: 'legacy' } };
  const r = kind === 'read' ? mod.journeyRead(input) : mod.journeyProject(input);
  return JSON.stringify(r, null, 2) + '\n';
}

const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'yy-t4-b3-'));
try {
  // 建一个有 journey.json 的 workspace（--update --step 0 --force）
  await run(['--workspace', ws, '--update', '--step', '0', '--force']);

  // 1) --read 逐字节一致
  const directRead = await directCall('read', ws);
  const cliRead = await run(['--workspace', ws, '--read', '--now', NOW]);
  check('B3-1 --read 与直接 journeyRead 逐字节一致', cliRead.out === directRead && cliRead.code === 0,
    'cli exit=' + cliRead.code + ' bytes=' + cliRead.out.length + '/' + directRead.length);

  // 2) --project 逐字节一致
  const directProj = await directCall('project', ws);
  const cliProj = await run(['--workspace', ws, '--project', '--now', NOW]);
  check('B3-2 --project 与直接 journeyProject 逐字节一致', cliProj.out === directProj && cliProj.code === 0,
    'cli exit=' + cliProj.code + ' bytes=' + cliProj.out.length + '/' + directProj.length);

  // 3) --project 不落盘（单写者纪律）
  const jBefore = fs.readFileSync(path.join(ws, '.tt-state', 'journey.json'), 'utf8');
  await run(['--workspace', ws, '--project', '--now', NOW]);
  const jAfter = fs.readFileSync(path.join(ws, '.tt-state', 'journey.json'), 'utf8');
  check('B3-3 --project 只读消费不落盘（journey.json 不变）', jBefore === jAfter);

  // 4) 老命令回归
  const prereq = await run(['--workspace', ws, '--prereq-check', '--step', '0']);
  check('B3-4 老 --prereq-check 回归（exit0 + reason）', prereq.code === 0 && /prereq OK/.test(prereq.out), 'exit=' + prereq.code);

  const prereqBad = await run(['--workspace', ws, '--prereq-check', '--step', '7']);
  check('B3-4b 老 --prereq-check 拦截未满足（exit1）', prereqBad.code === 1, 'exit=' + prereqBad.code);

  const render = await run(['--workspace', ws]);
  check('B3-4c 老默认渲染回归（含进度图）', render.code === 0 && /journey@1/.test(render.out) && /0 资产整合/.test(render.out), 'exit=' + render.code);

  const st = await run(['--self-test']);
  check('B3-4d 老 --self-test 回归（全过）', st.code === 0 && /全部通过/.test(st.out), 'exit=' + st.code);
} finally {
  fs.rmSync(ws, { recursive: true, force: true });
}

const failed = results.filter(([, ok]) => !ok);
console.log('\nB3 self-test: ' + (results.length - failed.length) + '/' + results.length + ' passed');
process.exitCode = failed.length ? 1 : 0;
