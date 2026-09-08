#!/usr/bin/env node
/**
 * C-27（P0）域声明机验自测 — FR-5 GWT「Given 未声明；When 验收抽查；Then 记 warning」的可机验路径。
 * 用临时目录构造三个最小 workspace（.tt-state/state.json + 配套 subtasks），以 asset-call-rate.mjs
 * 头部 usage 注明真实入口 `--state <state.json>` 跑脚本（不经 --task 全编排，避免外部依赖），三断言：
 *   a) subtask 含 domainDeclared:false → stdout 含 DOMAIN_DECL_MISSING（缺声明检出率 100%）；
 *   b) subtask 含 domainDeclared:true  → stdout 不含 DOMAIN_DECL_MISSING 且含 `- domainDeclared: ok`；
 *   c) subtask 无该字段（旧数据）      → stdout 含 N/A 且不含 DOMAIN_DECL_MISSING（N/A 不误伤）。
 * 三断言全过输出 PASS 并 exit 0；任一失败 exit 1。零依赖（node: 内建），Windows 路径走 path.join。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RATE = path.join(ROOT, 'scripts', 'asset-call-rate.mjs');

/** 构造最小 workspace：<ws>/.tt-state/state.json。assetConsumed=true 隔离消费率变量，只测域声明维度。 */
function fixture(subtasks) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-dd-'));
  fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
  const state = { id: 'plan-ddtest', cluster: 'T2_BACKEND', status: 'done', subtasks };
  fs.writeFileSync(path.join(ws, '.tt-state', 'state.json'), JSON.stringify(state, null, 2));
  return ws;
}

/** 跑 asset-call-rate --state（exit 1 = 有需审查资产，属脚本既有语义，不作为本测试失败依据）。 */
function runRate(ws) {
  const r = spawnSync(process.execPath, [RATE, '--state', path.join(ws, '.tt-state', 'state.json')], { encoding: 'utf8' });
  return { out: String(r.stdout || '') + String(r.stderr || ''), code: r.status };
}

const SUB = { id: 'plan-ddtest-0', asset: 'implementation', mode: 'exec', assetConsumed: true };
const cases = [
  { name: 'a) domainDeclared:false → DOMAIN_DECL_MISSING（含 id/asset 名 + N missing 头行）',
    ws: fixture([Object.assign({}, SUB, { domainDeclared: false })]),
    ok: (r) => r.out.includes('DOMAIN_DECL_MISSING')
      && r.out.includes('DOMAIN_DECL_MISSING [plan-ddtest-0/implementation]')
      && r.out.includes('- domainDeclared: 1 missing') },
  { name: 'b) domainDeclared:true → 无 DOMAIN_DECL_MISSING 且 domainDeclared: ok',
    ws: fixture([Object.assign({}, SUB, { domainDeclared: true })]),
    ok: (r) => !r.out.includes('DOMAIN_DECL_MISSING') && r.out.includes('- domainDeclared: ok') },
  { name: 'c) 无该字段（旧数据）→ N/A 且不误伤',
    ws: fixture([Object.assign({}, SUB)]),
    ok: (r) => r.out.includes('N/A') && !r.out.includes('DOMAIN_DECL_MISSING') },
];

let fail = 0;
for (const c of cases) {
  const r = runRate(c.ws);
  const ok = c.ok(r);
  if (!ok) fail += 1;
  console.log((ok ? 'PASS ' : 'FAIL ') + c.name + '  (child exit=' + r.code + ')');
  if (!ok) console.log('---- 实际输出 ----\n' + r.out);
  fs.rmSync(c.ws, { recursive: true, force: true });
}
if (fail) { console.log('FAIL ' + fail + '/3 断言未过'); process.exitCode = 1; }
else { console.log('PASS 3/3（缺声明检出 / 有声明 ok / 旧数据 N/A 三态机验全过）'); process.exitCode = 0; }
