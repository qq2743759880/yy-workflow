/**
 * f011-gate-probe.mjs — F-011 文件级语言守门断言探针（REMEDIATION-1 补充证据）。
 * 断言：显式非 Python 文件目标（app.js）仍 SCOPE_LANGUAGE_UNSUPPORTED 拒绝；
 *       目录目标（workspace 本身，内含 .py）放行并真实扫描。
 * 用法：node test-reports/autopilot-work/REMEDIATION-1/f011-gate-probe.mjs
 */
import securityAdapter from '../../../scripts/lib/adapters/security-semgrep.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.dirname(fileURLToPath(import.meta.url));
const out = { schema: 'f011-gate-probe@1.0.0', at: new Date().toISOString(), probes: {} };

// g1：显式非 Python 文件 → SCOPE_LANGUAGE_UNSUPPORTED
{
  const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'f011-gate-js-'));
  await fs.writeFile(path.join(ws, 'app.js'), 'const x = eval("1+1");\n');
  const subtask = { id: 'f011-gate-js', asset: 'security', task: '安全审计', contract: '审计 app.js 中的危险调用' };
  const r = await securityAdapter.run(subtask, null, { workspace: ws, scanTarget: path.join(ws, 'app.js') });
  out.probes.js_file_rejected = { scanTarget: path.join(ws, 'app.js'), error: r.error, ok: r.ok, diff_head: r.contract && r.contract.diff ? String(r.contract.diff).slice(0, 80) : null };
  out.probes.js_file_rejected.assert_scope_language_unsupported = r.error === 'SCOPE_LANGUAGE_UNSUPPORTED' && r.ok === false;
  await fs.rm(ws, { recursive: true, force: true });
}
// g2：目录目标（含 .py 的 workspace）→ 放行真实扫描
{
  const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'f011-gate-dir-'));
  await fs.writeFile(path.join(ws, 'vuln.py'), 'API_KEY = "sk-live-abcdefgh0123456789"\n');
  const subtask = { id: 'f011-gate-dir', asset: 'security', task: '安全审计', contract: '对本工作区执行安全审计' };
  const r = await securityAdapter.run(subtask, null, { workspace: ws });
  out.probes.directory_allowed = { scanTarget_recorded: r.contract && r.contract.scanTarget, error: r.error, ok: r.ok, findings_total: r.contract && r.contract.findings_total, pass: r.contract && r.contract.pass, mode: r.contract && r.contract.mode };
  out.probes.directory_allowed.assert_real_scan = r.ok === true && r.contract && r.contract.findings_total >= 1 && r.contract.mode === 'exec';
  await fs.rm(ws, { recursive: true, force: true });
}
out.all_pass = Object.values(out.probes).every(function (p) { return Object.values(p.assertions || {}).every(Boolean); });
await fs.writeFile(path.join(OUT_DIR, 'f011-gate-probe-result.json'), JSON.stringify(out, null, 2));
console.log('[f011-gate-probe] all_pass=' + out.all_pass);
