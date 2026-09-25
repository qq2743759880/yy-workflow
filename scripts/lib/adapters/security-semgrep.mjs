/**
 * security-semgrep.mjs — security 执行内核 adapter（AS-2-security 迁移：prompt → semgrep 驱动）。
 *
 * 契约：contracts/asset-migration.md（asset-migration@1.0.0）；派单：handoffs/v3/AS-2-security-dispatch.md。
 *  - PRIMARY 引擎：semgrep 1.175.0（pip，github:semgrep/semgrep；npm semgrep 为 ISC 假包禁用），
 *    ruleset 固化 vendor/security/rulesets/security-local-rules.yaml（本单自研六规则，零 registry 依赖）。
 *  - 回滚路径（rollback_adapter）：旧 LLM-prompt 路径（prompt.mjs 后端）保留，仅在 EXPLICIT_COMPAT_MODE
 *    显式旗标后可达（Gate-1：迁移期共存≠无限共存，每次调用留痕 compat/compat_via/rollback_adapter，
 *    无旗标的旧路径调用一律拒绝——禁静默并存）。
 *  - 输出契约（契约冻结外壳，与迁移前同形）：run(subtask, ctx, options) →
 *    { ok, artifactPath:'artifacts/<id>/security-result.json', contract, degraded, error }。
 *  - 诚实失败语义：semgrep 输出不可解析或 exit 与 findings 矛盾 → SEMGREP_OUTPUT_INVALID
 *    receipt failure（invalid_output:true），不静默吞（forbidden: crash/invalid_exit_code）。
 *  - provider identity verification 见 contracts/manifest-sources/security.yaml；
 *    迁移证据 test-reports/autopilot-work/AS-2-security/。
 */
import { runCommand, resolveCommandShim } from './util.mjs';
import promptBackend from './prompt.mjs';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'security';

const ADAPTER_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const RULESET = path.join(ADAPTER_ROOT, 'vendor', 'security', 'rulesets', 'security-local-rules.yaml');

function resolvePath(p, workspace) { return path.isAbsolute(p) ? p : path.join(workspace || '.', p); }
/** check_id 归一化：剥配置路径前缀，取自研命名空间末两段（security.<rule>）。 */
function normalizeRuleId(checkId) {
  const parts = String(checkId || '').split('.');
  return parts.length > 2 ? parts.slice(-2).join('.') : String(checkId || '');
}
async function emitResult(subtask, workspace, contract, degraded) {
  const dir = path.join(workspace, 'artifacts', subtask.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'security-result.json'), JSON.stringify(contract, null, 2));
  return { ok: true, artifactPath: path.join('artifacts', subtask.id, 'security-result.json'), contract, degraded: Boolean(degraded), error: null };
}
/** Gate-1（asset-migration.md §三）：旧 prompt 路径每次调用必须显式携带 EXPLICIT_COMPAT_MODE 旗标，禁静默并存。 */
function compatAllowed(options) {
  return options.explicitCompatMode === true || process.env.EXPLICIT_COMPAT_MODE === '1';
}
/** 旧引擎回滚路径（EXPLICIT_COMPAT_MODE 后）：prompt 后端 brief 组装，调用留痕 compat 字段。 */
async function runLegacyPrompt(subtask, ctx, workspace, checkedAt, via, assets) {
  const result = await promptBackend.run(subtask, ctx, { workspace, assets });
  const contract = { pass: null, diff: 'legacy prompt-backend rollback: brief 组装完成（LLM 发现层输出形态，无确定性检出承诺）', checkedAt, tool: 'prompt', version: 'n/a (LLM-prompt backend)', mode: 'brief', compat: 'EXPLICIT_COMPAT_MODE', rollback_adapter: 'security(prompt-backend)', compat_via: via, scope: 'legacy prompt path for ' + (subtask.contract || subtask.task || '') + '（EXPLICIT_COMPAT_MODE 回滚路径，每次调用留痕）', briefArtifact: result.artifactPath, ok: result.ok };
  return emitResult(subtask, workspace, contract, false);
}

export async function run(subtask, ctx, options = {}) {
  const workspace = options.workspace || '.';
  const rulesetPath = options.rulesetPath || RULESET;
  const scanTarget = options.scanTarget || subtask.scanTarget || (subtask.contract && !subtask.contract.includes(' ') && /\.(py|js|ts|java|go|c|cpp|rb|php|cs)$/.test(subtask.contract) ? resolvePath(subtask.contract, workspace) : null);
  const checkedAt = new Date().toISOString();
  const degrade = function (contract) { return emitResult(subtask, workspace, contract, true); };
  if (!scanTarget) {
    return degrade({ pass: null, degraded: true, diff: 'scan target 缺失：security semgrep 扫描需要文件型扫描目标（options.scanTarget / subtask.scanTarget / 文件路径 contract）——记录但不扫描', checkedAt, tool: 'semgrep', version: 'unknown', scanTarget: null });
  }
  // 新引擎（semgrep）：探测可用性；不可达 → Gate-1 回滚决策点（无旗标拒绝，显式旗标回滚旧路径）
  const shim = resolveCommandShim('semgrep');
  const probe = await runCommand(shim.command, shim.prefix.concat(['--version']), { workspace, timeoutMs: 30000, timeoutCode: 'TIMEOUT', notAvailableCode: 'SEMGREP_NOT_AVAILABLE', subtask });
  if (!probe.ok) {
    if (compatAllowed(options)) return runLegacyPrompt(subtask, ctx, workspace, checkedAt, 'semgrep_not_available_rollback', options.assets);
    return { ok: false, artifactPath: null, contract: null, degraded: false, error: 'SEMGREP_NOT_AVAILABLE (legacy prompt path blocked: EXPLICIT_COMPAT_MODE flag required — Gate-1 asset-migration.md §三)' };
  }
  let version = 'unknown';
  if (probe.artifactPath) { try { version = (await fs.readFile(path.join(workspace, probe.artifactPath), 'utf8')).split('\n').filter(function (l) { return /^\d+\.\d+/.test(l.trim()); })[0]?.trim() || 'unknown'; } catch (error) { version = 'unknown'; } }
  const result = await runCommand(shim.command, shim.prefix.concat(['--config', rulesetPath, '--json', scanTarget]), { workspace, timeoutMs: options.timeoutMs || 180000, timeoutCode: 'SECURITY_SCAN_TIMEOUT', notAvailableCode: 'SEMGREP_NOT_AVAILABLE', throwOnTimeout: true, subtask });
  // runCommand 语义：exit 0 → stdout 落 result.txt；非 0 → stdout 转入 error。findings JSON 解析后按 rc 语义硬校验。
  let rawOut = '';
  if (result.ok && result.artifactPath) { try { rawOut = await fs.readFile(path.join(workspace, result.artifactPath), 'utf8'); } catch (error) { rawOut = ''; } }
  else if (!result.ok) rawOut = String(result.error || '');
  let parsed = null;
  try { parsed = JSON.parse(rawOut); } catch (error) { parsed = null; }
  const parseable = parsed !== null && typeof parsed === 'object' && Array.isArray(parsed.results);
  // exit code 语义硬校验（forbidden: invalid_exit_code——semgrep 默认模式成功含 findings 均 exit 0）：
  // 输出不可解析 = 引擎故障诚实报错不静默；rc!=0 但 JSON 可解析 = 记录 exit_code nonzero 仍如实产出 findings。
  if (!parseable) {
    const head = String(result.error || '').trim().slice(0, 200);
    return { ok: false, artifactPath: null, contract: { pass: false, diff: 'SEMGREP_OUTPUT_INVALID: semgrep did not produce a parseable findings JSON' + (!result.ok ? ' (rc!=0)' : '') + (head ? ' | ' + head : ''), checkedAt, tool: 'semgrep', version, mode: 'exec', invalid_output: true, scanTarget, scope: 'semgrep --config ' + rulesetPath + ' --json ' + scanTarget }, degraded: false, error: 'SEMGREP_OUTPUT_INVALID' };
  }
  const findingsAll = parsed.results.map(function (r) { return { rule: normalizeRuleId(r.check_id), severity: String(r.extra && r.extra.severity || 'INFO').toLowerCase(), message: String((r.extra && r.extra.message) || '').slice(0, 160), line: r.start && r.start.line, path: r.path }; });
  const errors = findingsAll.filter(function (f) { return f.severity === 'error'; });
  const pass = errors.length === 0;
  const diff = pass ? null : 'semgrep violations: ' + errors.length + ' error(s) | ' + findingsAll.map(function (f) { return f.severity + ':' + f.rule + '@' + f.line; }).join(', ');
  const contract = { pass, diff, checkedAt, tool: 'semgrep', version, mode: 'exec', exit_code: result.ok ? 0 : 'nonzero', findings_total: findingsAll.length, findings_summary: findingsAll, scanTarget, ruleset: rulesetPath, scope: 'real semgrep ' + version + ' scan --ruleset vendor/security/rulesets/security-local-rules.yaml against ' + scanTarget };
  return emitResult(subtask, workspace, contract, false);
}
export default { name, run };
