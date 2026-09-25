/**
 * gate2-dispatch-probe.mjs — Gate-2 绑定探针（AS-2-sentinel 晋升 post_sign_actions 第 7 步）。
 *
 * 真实 dispatch()（scripts/lib/runtime.mjs）派发 skill-sentinel 子任务：
 *   - 资格门：manifest 在场 → resolveAssetEligibility fail-closed 判定（eligible=true 才派单）；
 *   - Gate-2：dispatch 记账 manifest_sha256（context bus + logger.info 行）；
 *   - adapter 路由：backend=auto → 专用 adapter skill-scanner（非 prompt 回落）；
 *   - 真实引擎执行：skill-scanner 2.1.0 扫描临时 workspace 夹具（恶意/良性各一次）。
 *
 * 用法：node test-reports/autopilot-work/FINAL-E2E/gate2-dispatch-probe.mjs <ws-with-fixtures> <fixture-subdir-name>
 * 输出：stdout JSON（由调用方 tee 落盘 FINAL-E2E/gate2-dispatch-probe.log）。
 */
import { dispatch, createContextBus } from '../../../scripts/lib/runtime.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ws = process.argv[2];
const fixtureName = process.argv[3];
const manifestPath = path.join(ROOT, 'contracts', 'asset-manifest-v2.json');
const raw = await fs.readFile(manifestPath);
const expectedSha = crypto.createHash('sha256').update(raw).digest('hex');

const subtask = {
  id: 'gate2-skill-sentinel-probe',
  asset: 'skill-sentinel',
  task: 'skill 包上线前安全审查（影子夹具）',
  contract: '扫描目标 skill 目录，检出 prompt 注入/凭据外泄/C2 等恶意模式并定级；无威胁则如实记 pass。',
  scanTarget: path.join(ws, fixtureName),
};
const lines = [];
const logger = { info: (...a) => lines.push(a.join(' ')), warn: (...a) => lines.push('[warn] ' + a.join(' ')), error: (...a) => lines.push('[error] ' + a.join(' ')), debug: () => {} };
const ctx = createContextBus();
const result = await dispatch(subtask, ctx, { workspace: ws, backend: 'auto', logger });
const gate2Line = lines.find((l) => l.includes('Gate-2 manifest_sha256='));
const c = result.contract || {};
console.log(JSON.stringify({
  probe: 'gate2-dispatch-probe',
  fixture: fixtureName,
  expected_manifest_sha256: expectedSha,
  gate2_log_line: gate2Line || null,
  gate2_hash_matches_build: Boolean(gate2Line && gate2Line.includes(expectedSha)),
  dispatch_ok: result.ok === true,
  dispatch_error: result.error || null,
  adapter_mode: c.mode || null,
  tool: c.tool || null,
  engine_version: c.version || null,
  pass: c.pass === undefined ? null : c.pass,
  is_safe: c.is_safe === undefined ? null : c.is_safe,
  threats: c.threats === undefined ? null : c.threats,
  findings_total: c.findings_total === undefined ? null : c.findings_total,
  analyzers_used: c.analyzers_used || null,
  scanTarget: c.scanTarget || null,
  artifactPath: result.artifactPath || null,
  eligibility: subtask.eligibility || null,
  log_lines: lines,
}, null, 2));
