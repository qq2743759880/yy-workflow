/**
 * final-e2e-assert.mjs — FINAL-E2E 主链验收驱动（ACCEPTANCE-ENTRY.md 断言链逐条机验）。
 *
 * 真实 production 主链：node scripts/orchestrator.mjs --task "backend login module with security review"
 *   --workspace <tmpws>（真实 buildPlan → orchestrator → resolver → capabilities → adapter → receipt 全链，
 *   非 REMEDIATION-1 f011 的 planner-shaped 手工 dispatch）。
 *
 * 临时 workspace 准备（跑完即删由调用方控制）：
 *   - fixture tar（AS-2-security）解包 vulnerable_app.py（已知 6 类确定性缺陷）
 *   - 良性 app.js（UNCOVERED_LANGUAGES 语义验证——混合覆盖不认证）
 *   - .tt-state/executor.json（mode A-direct + 默认能力集）——使 EX-1 能力门控真实运行（非缺省空转）
 *
 * 用法：node test-reports/autopilot-work/FINAL-E2E/final-e2e-assert.mjs --backend auto|prompt
 * 输出：stdout JSON（调用方 tee 落盘 FINAL-E2E/e2e-assert-<backend>.json）；orchestrator 全输出落
 *   FINAL-E2E/e2e-orchestrator-<backend>.log；workspace 留在 JSON 里供复核后清理。
 */
import { spawn, execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TAR = path.join(ROOT, 'test-reports', 'autopilot-work', 'AS-2-security', 'fixtures', 'fixture-vulnerable_app-evidence.tar.gz');
const backend = process.argv.includes('prompt') ? 'prompt' : 'auto';

function sh(cmd, args, opts = {}) {
  return new Promise(function (resolve) {
    const child = spawn(cmd, args, Object.assign({ stdio: ['ignore', 'pipe', 'pipe'] }, opts.spawn || {}));
    let out = '', err = '';
    child.stdout.on('data', (c) => { out += c.toString(); });
    child.stderr.on('data', (c) => { err += c.toString(); });
    child.on('error', (e) => resolve({ code: -1, out, err: err + String(e) }));
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

// —— 1. 临时 workspace 准备 ——
const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'final-e2e-'));
await fs.copyFile(TAR, path.join(ws, 'fixture-evidence.tar.gz'));
// Windows 下 GNU tar 把 "D:"/"C:" 当远程主机——改 cwd 相对解包（f011 先例）
execSync('tar -xzf fixture-evidence.tar.gz vulnerable_app.py', { cwd: ws, stdio: 'pipe' });
await fs.rm(path.join(ws, 'fixture-evidence.tar.gz'), { force: true });
const pySha = crypto.createHash('sha256').update(await fs.readFile(path.join(ws, 'vulnerable_app.py'))).digest('hex');
const benignJs = [
  '// benign utility: string helpers only',
  'function slugify(input) {',
  '  return String(input).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");',
  '}',
  'module.exports = { slugify };',
  '',
].join('\n');
await fs.writeFile(path.join(ws, 'app.js'), benignJs, 'utf8');
// EX-1 能力门真实运行：workspace 级 executor.json（A-direct：映射零宿主命令；能力集自描述）
await fs.mkdir(path.join(ws, '.tt-state'), { recursive: true });
await fs.writeFile(path.join(ws, '.tt-state', 'executor.json'), JSON.stringify({
  schema: 'tt/executor-config@1', cli: null, model: null, mode: 'A-direct', isolate: null,
  capabilities: { write_files: true, run_cmd: true, network: false, spawn_subagent: false, mcp_client: false },
}, null, 2));

// —— 2. 真实 orchestrator 主链（真实 buildPlan → executePlan）——
// 宿主模式（--host-mode mech|llm，默认 mech）：
//   llm  = 真实 a6api LLM 宿主（127.0.0.1:15724 网关，model gpt-5.6-sol）——真实执行；但实测 2 轮上游
//          be-architect 产物均未含字面内核 token（模型诚实拒绝声称 kernel 工具采用）→ assetConsumed=false
//          → phase-1+ 全部 DEP_PRECONDITION，security 无法派单（E-4 偏差证据：e2e-orchestrator-llm*.log）。
//   mech = scripts/regression-all.mjs S8 段同款机验宿主（node -e 内联：brief 提取锚点+内核词写 plan.md）——
//          S8 先例口径「机制测试须隔离外部 CLI/模型依赖」。FINAL-E2E 断言链测的是 security 子链机制
//          （planner→resolver→capabilities→专用 adapter→receipt），上游 brief 消费按 S8 机制隔离，非本验收对象。
// 注意：T2 requireExec 前置门要求上游 done 且 assetConsumed=true——无宿主时 phase-1+ 子任务 DEP_PRECONDITION
// 诚实跳过（security 无法派单）；mech/llm 宿主均为该门的真实满足路径。
const hostMode = process.argv.includes('--host-mode=llm') ? 'llm' : 'mech';
const MECH_HOST = "const fs=require('fs'),p=require('path');const b=fs.readFileSync(process.argv[1],'utf8');const a=(b.match(/## \\u65b9\\u6cd5\\u8bba\\u6b63\\u6587[\\s\\S]*?\\n(#+\\s+[^\\n]+)/)||[])[1]||'x';const k=(b.match(/Kernel:\\s*([A-Za-z0-9][^\\n\\uFF08(]+)/)||[])[1]||'';fs.writeFileSync(p.join(p.dirname(process.argv[1]),'plan.md'),'# '+a+(k?'\\n\\n'+k:''))";
const args = ['scripts/orchestrator.mjs', '--task', 'backend login module with security review', '--workspace', ws, '--backend', backend];
if (hostMode === 'llm') args.push('--exec', 'node', path.join(ROOT, 'scripts', 'exec-host-a6api.mjs'), '--model', 'gpt-5.6-sol');
else args.push('--exec', process.execPath, '-e', MECH_HOST);
const run = await sh(process.execPath, args, { spawn: { cwd: ROOT } });
const logPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'e2e-orchestrator-' + backend + '.log');
await fs.writeFile(logPath, '$ node ' + args.join(' ') + '\n--- stdout ---\n' + run.out + '\n--- stderr ---\n' + run.err);

// —— 3. 断言链（逐条机验）——
const stateRaw = await fs.readFile(path.join(ws, '.tt-state', 'state.json'), 'utf8').catch(() => null);
const state = stateRaw ? JSON.parse(stateRaw) : null;
const subtasks = (state && state.subtasks) || [];
const secSub = subtasks.find((s) => s.asset === 'security') || null;
let secResult = null, secArtifact = null;
if (secSub) {
  for (const f of ['security-result.json']) {
    const p = path.join(ws, 'artifacts', secSub.id, f);
    if (fss.existsSync(p)) { secResult = JSON.parse(await fs.readFile(p, 'utf8')); secArtifact = path.relative(ws, p); }
  }
}
const manifestRaw = await fs.readFile(path.join(ROOT, 'contracts', 'asset-manifest-v2.json'));
const manifestSha = crypto.createHash('sha256').update(manifestRaw).digest('hex');
const gate2InLog = run.out.split('\n').filter((l) => l.includes('Gate-2 manifest_sha256='));
const capsProbe = await sh(process.execPath, ['-e', `
import { getRequiredCapabilities } from 'file:///${ROOT.replace(/\\/g, '/')}/scripts/lib/runtime.mjs';
const req = getRequiredCapabilities('security');
const caps = { write_files: true, run_cmd: true, network: false, spawn_subagent: false, mcp_client: false };
const missing = req.filter((c) => !caps[c]);
console.log(JSON.stringify({ req, missing }));`]);

const A = (name, pass, detail) => ({ name, pass: pass === true, detail });
const assertions = [
  A('A1 security 子任务被创建', Boolean(secSub), secSub ? ('id=' + secSub.id + ' status=' + secSub.status + ' mode=' + (secSub.mode || '-') + ' error=' + (secSub.error || '-')) : 'plan 无 security 子任务'),
  A('A1b security auto 路由专用 adapter（非 prompt 回落）',
    Boolean(secResult && secResult.tool === 'semgrep' && secResult.mode === 'exec'),
    secResult ? ('tool=' + secResult.tool + ' mode=' + secResult.mode + ' version=' + secResult.version + ' engine=' + String(secResult.scope || '').slice(0, 40)) : '无 security-result.json（未走专用 adapter）'),
  A('A2 资格门过 eligible=true', Boolean(secSub && secSub.eligibility && secSub.eligibility.eligible === true), JSON.stringify(secSub ? secSub.eligibility : null)),
  A('A2b getRequiredCapabilities(security)=[write_files,run_cmd] 与 executor capabilities 匹配',
    (() => { try { const p = JSON.parse(capsProbe.out.trim().split('\n').filter((l) => l.startsWith('{')).join('')); return p.req.length === 2 && p.req.includes('write_files') && p.req.includes('run_cmd') && p.missing.length === 0; } catch (e) { return false; } })(),
    'capsProbe=' + capsProbe.out.trim().slice(0, 120) + '（executor.json capabilities 使 EX-1 门真实运行，missing=[] = 门通过）'),
  A('A3 Gate-2：dispatch 日志 manifest_sha256 == sha256(asset-manifest-v2.json) 现值',
    gate2InLog.length > 0 && gate2InLog.every((l) => l.includes(manifestSha)),
    'log_lines=' + gate2InLog.length + ' expected=' + manifestSha.slice(0, 16) + '…'),
  A('A4a semgrep 真实执行（.py 漏洞 findings 记账）',
    Boolean(secResult && secResult.mode === 'exec' && Array.isArray(secResult.findings_summary) && secResult.findings_summary.length > 0 && secResult.pass === false),
    secResult ? ('findings_total=' + secResult.findings_total + ' pass=' + secResult.pass + ' exit_code=' + secResult.exit_code + ' rules=' + [...new Set(secResult.findings_summary.map((f) => f.rule))].slice(0, 8).join(',')) : '无结果'),
  A('A4b UNCOVERED_LANGUAGES 含 js → pass=false（fail-closed 混合覆盖不认证）',
    Boolean(secResult && Array.isArray(secResult.uncovered_languages) && secResult.uncovered_languages.includes('js') && secResult.pass === false),
    secResult ? ('uncovered_languages=' + JSON.stringify(secResult.uncovered_languages) + ' pass=' + secResult.pass) : '无结果'),
  A('A5a 全链无静默降级（每个非 done 状态具名原因）',
    (() => {
      if (!subtasks.length) return false;
      // 具名原因可落在两处（均属逐步留痕面）：state.json 的 subtask.error / orchestrator 日志行（failed/skipped 行内含 subtask id）；
      // idle（上游 failed 后 plan 失败级联未派单）须满足：state.plan.status==='failed' 且日志有具名上游失败行。
      const failedLines = run.out.split('\n').concat(run.err.split('\n')).filter((l) => l.includes('subtask failed '));
      const skippedLines = run.out.split('\n').filter((l) => l.includes('subtask skipped'));
      const planFailed = Boolean(state && state.status === 'failed');
      return subtasks.every((s) => {
        if (s.status === 'done') return true;
        if (s.status === 'failed') return failedLines.some((l) => l.includes(s.id) && l.trim().replace(/\x1b\[[0-9;]*m/g, '').length > 'subtask failed '.length + s.id.length + 2);
        if (s.status === 'skipped') return (s.error && String(s.error).length > 0) || skippedLines.some((l) => l.includes(s.id));
        if (s.status === 'idle') return planFailed && failedLines.length > 0;
        return false;
      });
    })(),
    subtasks.map((s) => s.asset + ':' + s.status + (s.error ? '(' + s.error + ')' : '')).join(' | ') + ' | failed_log_lines=' + run.out.split('\n').concat(run.err.split('\n')).filter((l) => l.includes('subtask failed ')).length + ' plan_status=' + (state && state.status)),
  A('A5b receipt/state 转移留痕（state.json + security-result.json 可回查）',
    Boolean(stateRaw && secArtifact && secResult),
    'state.json=' + (stateRaw ? 'present(' + stateRaw.length + 'B)' : 'missing') + ' artifact=' + (secArtifact || 'none')),
];

const result = {
  schema: 'final-e2e-assert@1.0.0',
  at: new Date().toISOString(),
  backend,
  host_mode: hostMode,
  orchestrator_exit_code: run.code,
  workspace: ws,
  workspace_disposition: '临时 workspace（mkdtemp）——复核后删除（fixture tar 复制解包，原件未动）',
  fixture_vulnerable_app_sha256: pySha,
  task: 'backend login module with security review',
  orchestrator_log: path.basename(logPath),
  plan: state ? { id: state.id, cluster: state.cluster, task: state.task, degraded: state.degraded || false, warnings: state.warnings || [] } : null,
  security_result: secResult,
  subtasks: subtasks.map((s) => ({ id: s.id, asset: s.asset, status: s.status, mode: s.mode || null, adapter: s.adapter || null, error: s.error || null, eligibility: s.eligibility || null, artifactPath: s.artifactPath || null, assetConsumed: s.assetConsumed === undefined ? null : s.assetConsumed })),
  manifest_sha256: manifestSha,
  assertions,
  verdict: assertions.every((a) => a.pass) ? 'PASS' : 'FAIL',
};
console.log(JSON.stringify(result, null, 2));
