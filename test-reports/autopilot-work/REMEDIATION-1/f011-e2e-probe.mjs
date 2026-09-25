/**
 * f011-e2e-probe.mjs — F-011 E2E 探针（真实 caller shape，REMEDIATION-1 派单任务 1.3）。
 *
 * 断言目标：security scanTarget 生产链（默认目标=workspace + 文件级语言守门放宽）在真实
 * dispatch() auto 路径下功能打通：
 *   正向：临时 workspace 放含 6 类确定性缺陷的 .py（canonical 夹具 tar member 解包）→
 *         模拟 planner 形态子任务（自然语言 contract、无 scanTarget）→ dispatch() →
 *         断言 semgrep 真实执行（mode=exec / 引擎版本 / findings 记账 ≥6 / pass=false）。
 *   反向：空 workspace → 真实扫描 0 findings pass=true，scanTarget=workspace（scanned_path 证据）。
 *
 * 用法：node test-reports/autopilot-work/REMEDIATION-1/f011-e2e-probe.mjs
 * 输出：同目录 f011-e2e-probe-result.json + e2e-pos-security-result.json / e2e-neg-security-result.json
 */
import { dispatch, createContextBus } from '../../../scripts/lib/runtime.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TAR = path.join(ROOT, 'test-reports', 'autopilot-work', 'AS-2-security', 'fixtures', 'fixture-vulnerable_app-evidence.tar.gz');
const STAMP = 'run-' + new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CANONICAL_SHA256 = '1177efe8b000f69f2decc09ccbc64d4a7b42990a79e8ae1fa729f9df204c49cf';

const results = { schema: 'f011-e2e-probe@1.0.0', at: new Date().toISOString(), probes: {} };

// —— 正向探针：planner 形态（自然语言 contract、无 scanTarget）→ workspace 默认目标 → 真实扫描命中 ——
{
  const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'f011-e2e-pos-'));
  // Windows 下 GNU tar 把 "D:"/"C:" 当远程主机——改为相对路径形态：tar 拷入 ws 内以 cwd 解包。
  await fs.copyFile(TAR, path.join(ws, 'fixture-evidence.tar.gz'));
  execSync('tar -xzf fixture-evidence.tar.gz vulnerable_app.py', { cwd: ws, stdio: 'pipe' });
  await fs.rm(path.join(ws, 'fixture-evidence.tar.gz'), { force: true });
  const py = await fs.readFile(path.join(ws, 'vulnerable_app.py'));
  const sha = crypto.createHash('sha256').update(py).digest('hex');
  const subtask = {
    id: 'f011-e2e-pos',
    asset: 'security',
    task: '安全审计（audit 阶段：发现与定级）',
    contract: '对本工作区执行安全审计：审计 Python 代码中的硬编码凭据、SQL 注入、弱哈希、eval 动态求值与命令注入等确定性缺陷，输出 findings 与严重级定级。',
  };
  const ctx = createContextBus();
  const result = await dispatch(subtask, ctx, { workspace: ws });
  const contract = result.contract || {};
  let posArtifact = null;
  try { posArtifact = await fs.readFile(path.join(ws, 'artifacts', 'f011-e2e-pos', 'security-result.json'), 'utf8'); } catch (e) {}
  if (posArtifact) await fs.writeFile(path.join(OUT_DIR, STAMP + '-e2e-pos-security-result.json'), posArtifact);
  results.probes.positive = {
    workspace: ws,
    fixture_member_sha256: sha,
    fixture_sha256_matches_canonical: sha === CANONICAL_SHA256,
    caller_shape: 'planner 形态：asset=security + 自然语言 contract + 无 scanTarget（scanTarget 未传）',
    dispatch_ok: result.ok === true,
    dispatch_error: result.error || null,
    semgrep_really_executed: contract.mode === 'exec' && /^\d+\.\d+/.test(String(contract.version || '')),
    engine_version: contract.version || null,
    scan_target_recorded: contract.scanTarget || null,
    scan_target_is_workspace: contract.scanTarget === ws,
    findings_total: contract.findings_total ?? null,
    findings_rules: (contract.findings_summary || []).map(function (f) { return f.rule; }),
    contract_pass: contract.pass ?? null,
    subtask_status: subtask.status || null,
    subtask_mode: subtask.mode || null,
    eligibility: subtask.eligibility || null,
    gate2_manifest_sha256: ctx.get('manifest_sha256') || null,
    assertions: {},
  };
  const p = results.probes.positive;
  p.assertions.fixture_sha_matches_canonical = p.fixture_sha256_matches_canonical === true;
  p.assertions.dispatch_ok_true = p.dispatch_ok_true = result.ok === true;
  p.assertions.semgrep_really_executed = p.semgrep_really_executed === true;
  p.assertions.findings_booked_ge_6 = (p.findings_total || 0) >= 6;
  p.assertions.pass_false_on_error_findings = p.contract_pass === false;
  p.assertions.scan_target_defaulted_to_workspace = p.scan_target_is_workspace === true;
  await fs.rm(ws, { recursive: true, force: true });
}

// —— 反向探针：空 workspace → 真实扫描 0 findings pass=true（scanned_path 证据）——
{
  const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'f011-e2e-neg-'));
  const subtask = {
    id: 'f011-e2e-neg',
    asset: 'security',
    task: '安全审计（audit 阶段：发现与定级）',
    contract: '对本工作区执行安全审计：审计代码中的确定性安全缺陷并输出 findings 与定级。',
  };
  const ctx = createContextBus();
  const result = await dispatch(subtask, ctx, { workspace: ws });
  const contract = result.contract || {};
  let negArtifact = null;
  try { negArtifact = await fs.readFile(path.join(ws, 'artifacts', 'f011-e2e-neg', 'security-result.json'), 'utf8'); } catch (e) {}
  if (negArtifact) await fs.writeFile(path.join(OUT_DIR, STAMP + '-e2e-neg-security-result.json'), negArtifact);
  results.probes.negative = {
    workspace: ws,
    dispatch_ok: result.ok === true,
    semgrep_really_executed: contract.mode === 'exec' && /^\d+\.\d+/.test(String(contract.version || '')),
    engine_version: contract.version || null,
    scanned_path: contract.scanTarget || null,
    scanned_path_is_workspace: contract.scanTarget === ws,
    findings_total: contract.findings_total ?? null,
    exit_code: contract.exit_code ?? null,
    contract_pass: contract.pass ?? null,
    subtask_status: subtask.status || null,
    subtask_mode: subtask.mode || null,
    assertions: {},
  };
  const n = results.probes.negative;
  n.assertions.dispatch_ok_true = result.ok === true;
  n.assertions.semgrep_really_executed = n.semgrep_really_executed === true;
  n.assertions.zero_findings_real_scan = n.findings_total === 0;
  n.assertions.pass_true = n.contract_pass === true;
  n.assertions.scanned_path_evidence_recorded = n.scanned_path_is_workspace === true;
  await fs.rm(ws, { recursive: true, force: true });
}

results.all_pass = ['positive', 'negative'].every(function (k) {
  return Object.values(results.probes[k].assertions).every(Boolean);
});
await fs.writeFile(path.join(OUT_DIR, STAMP + '-e2e-probe-result.json'), JSON.stringify(results, null, 2));
console.log('[f011-e2e-probe] all_pass=' + results.all_pass);
