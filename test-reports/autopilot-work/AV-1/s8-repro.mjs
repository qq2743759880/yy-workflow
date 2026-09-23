// S8 独立复现脚本（只读诊断，不改任何产品文件）
// 目的：判断 regression S8 失败是否与 AV-1 改动（asset.mjs 加接口）有关
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function run(cmd, args, cwd) {
  return new Promise(function (resolve) {
    let out = '';
    const child = spawn(cmd, args, { cwd: cwd || process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', function (c) { out += c.toString(); });
    child.stderr.on('data', function (c) { out += c.toString(); });
    child.on('close', function (code) { resolve({ ok: code === 0, code, out }); });
  });
}

const HOST = process.execPath;
const s8ws = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-s8repro-'));
const execScript = "const fs=require('fs'),p=require('path');const b=fs.readFileSync(process.argv[1],'utf8');const a=(b.match(/## \\u65b9\\u6cd5\\u8bba\\u6b63\\u6587[\\s\\S]*?\\n(#+\\s+[^\\n]+)/)||[])[1]||'x';const k=(b.match(/Kernel:\\s*([A-Za-z0-9][^\\n\\uFF08(]+)/)||[])[1]||'';fs.writeFileSync(p.join(p.dirname(process.argv[1]),'plan.md'),'# '+a+(k?'\\n\\n'+k:''))";
const s8 = await run(HOST, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--task', 'backend login module', '--workspace', s8ws, '--exec', HOST, '-e', execScript]);
const state = JSON.parse(fs.readFileSync(path.join(s8ws, '.tt-state', 'state.json'), 'utf8'));
console.log('positive ok:', s8.ok, '| modes:', JSON.stringify(state.modes));
const first = state.subtasks[0];
console.log('first subtask:', first.asset, '| mode:', first.mode, '| adapter:', first.adapter, '| assetConsumed:', first.assetConsumed);
const artDir = path.join(s8ws, 'artifacts', first.id);
console.log('artifact files:', fs.readdirSync(artDir));
try { console.log('plan.md:', JSON.stringify(fs.readFileSync(path.join(artDir, 'plan.md'), 'utf8'))); } catch (e) { console.log('plan.md missing'); }
fs.rmSync(s8ws, { recursive: true, force: true });
