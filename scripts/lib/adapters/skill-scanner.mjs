/**
 * skill-scanner.mjs — skill-sentinel 执行内核 adapter（AS-2-sentinel 迁移：prompt → cisco-ai-skill-scanner 2.1.0 驱动）。
 *
 * 契约：contracts/asset-migration.md（asset-migration@1.0.0）；change 单：contracts/discrepancies/cr-20260925T150000Z-as2sent-promotion.json（SIGNED）。
 *  - PRIMARY 引擎：cisco-ai-skill-scanner 2.1.0（pip 官方包，github:cisco-ai-defense/skill-scanner；PyPI skill-scanner
 *    0.3.3 MIT 为同名撞车假目标禁装——D-2）。检测配置 = 引擎默认 policy 预设（balanced，指纹见
 *    scan_metadata.policy_fingerprint_sha256），零自造规则零 registry 依赖（detection_config 替代自研 ruleset）。
 *  - 多语言/多分析器引擎：语言守门不适用（对比 security-semgrep 的 Python-only ruleset 守门——0 findings 假绿风险
 *    由引擎多语言能力消解）；目录能力发现保留——analyzers_used / analyzers_failed / policy 指纹逐次记账进 contract。
 *  - 回滚路径（rollback_adapter）：旧 LLM-prompt 路径（prompt.mjs 后端）保留，仅在 EXPLICIT_COMPAT_MODE 显式旗标后
 *    可达（Gate-1：迁移期共存≠无限共存，每次调用留痕 compat/compat_via/rollback_adapter，无旗标旧路径一律拒绝）。
 *  - 输出契约（契约冻结外壳，与迁移前同形）：run(subtask, ctx, options) →
 *    { ok, artifactPath:'artifacts/<id>/sentinel-result.json', contract, degraded, error }。
 *  - pass 映射（fixtures/expected-findings.json 影子跑前定稿口径）：is_safe==false 或存在 severity>=MEDIUM 的
 *    finding → pass=false；良性/仅 INFO 级 → pass=true（benign_false_positive 语义保留）；LOW 级不翻转 pass 但
 *    diff/字段留痕（定稿映射未列 LOW，不静默）。INFO 打包提示（如 MANIFEST_MISSING_LICENSE）非威胁不阻断。
 *  - 诚实失败语义：rc=0 但 JSON 不可解析 → SKILLSCANNER_OUTPUT_INVALID（invalid_output:true，crash 类）；
 *    rc!=0 且无可解析 JSON = 引擎故障（invalid_exit_code 判据）；输出异常不静默吞（forbidden: crash/invalid_exit_code）。
 *  - provider identity verification 见 contracts/manifest-sources/skill-sentinel.yaml；
 *    迁移证据 test-reports/autopilot-work/AS-2-sentinel/。
 */
import { runCommand, resolveCommandShim } from './util.mjs';
import promptBackend from './prompt.mjs';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export const name = 'skill-sentinel';

const SEV_RANK = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

async function emitResult(subtask, workspace, contract, degraded) {
  const dir = path.join(workspace, 'artifacts', subtask.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'sentinel-result.json'), JSON.stringify(contract, null, 2));
  return { ok: true, artifactPath: path.join('artifacts', subtask.id, 'sentinel-result.json'), contract, degraded: Boolean(degraded), error: null };
}
/** Gate-1（asset-migration.md §三）：旧 prompt 路径每次调用必须显式携带 EXPLICIT_COMPAT_MODE 旗标，禁静默并存。 */
function compatAllowed(options) {
  return options.explicitCompatMode === true || process.env.EXPLICIT_COMPAT_MODE === '1';
}
/** 旧引擎回滚路径（EXPLICIT_COMPAT_MODE 后）：prompt 后端 brief 组装，调用留痕 compat 字段。 */
async function runLegacyPrompt(subtask, ctx, workspace, checkedAt, via, assets) {
  const result = await promptBackend.run(subtask, ctx, { workspace, assets });
  const contract = { pass: null, diff: 'legacy prompt-backend rollback: brief 组装完成（LLM 发现层输出形态，无确定性检出承诺）', checkedAt, tool: 'prompt', version: 'n/a (LLM-prompt backend)', mode: 'brief', compat: 'EXPLICIT_COMPAT_MODE', rollback_adapter: 'skill-sentinel(prompt-backend)', compat_via: via, scope: 'legacy prompt path for ' + (subtask.contract || subtask.task || '') + '（EXPLICIT_COMPAT_MODE 回滚路径，每次调用留痕）', briefArtifact: result.artifactPath, ok: result.ok };
  return emitResult(subtask, workspace, contract, false);
}
function rank(sev) { return SEV_RANK[String(sev || '').toUpperCase()] || 0; }

export async function run(subtask, ctx, options = {}) {
  const workspace = options.workspace || '.';
  const scanTarget = options.scanTarget || subtask.scanTarget || workspace;
  const checkedAt = new Date().toISOString();
  // 新引擎（skill-scanner）：探测可用性；不可达 → Gate-1 回滚决策点（无旗标拒绝，显式旗标回滚旧路径）
  const shim = resolveCommandShim('skill-scanner');
  const probe = await runCommand(shim.command, shim.prefix.concat(['--version']), { workspace, timeoutMs: 30000, timeoutCode: 'TIMEOUT', notAvailableCode: 'SKILLSCANNER_NOT_AVAILABLE', subtask });
  if (!probe.ok) {
    if (compatAllowed(options)) return runLegacyPrompt(subtask, ctx, workspace, checkedAt, 'skillscanner_not_available_rollback', options.assets);
    return { ok: false, artifactPath: null, contract: null, degraded: false, error: 'SKILLSCANNER_NOT_AVAILABLE (legacy prompt path blocked: EXPLICIT_COMPAT_MODE flag required — Gate-1 asset-migration.md §三)' };
  }
  let version = 'unknown';
  // skill-scanner --version 输出形如 "python.exe C:\...\skill-scanner 2.1.0"——版本在行尾，全局取 x.y[.z] token
  if (probe.artifactPath) { try { version = (await fs.readFile(path.join(workspace, probe.artifactPath), 'utf8')).match(/(\d+\.\d+(?:\.\d+)?)/)?.[1] || 'unknown'; } catch (error) { version = 'unknown'; } }
  // 目标形态：目录（skill_directory 位参）或单文件（--skill-file）；多语言引擎不做语言守门
  let dirTarget = true;
  try { dirTarget = fsSync.statSync(scanTarget).isDirectory(); } catch (e) { dirTarget = true; }
  const reportPath = path.join(workspace, 'artifacts', subtask.id, 'skill-scanner-report.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  // 防陈旧报告（诚实失败语义）：先删旧产物再扫——引擎未写报告（如输出异常场景）不得静默消费上一次的残留
  await fs.rm(reportPath, { force: true });
  const args = ['scan', '--format', 'json', '--output-json', reportPath];
  if (!dirTarget) args.push('--skill-file', scanTarget); else args.push(scanTarget);
  const result = await runCommand(shim.command, shim.prefix.concat(args), { workspace, timeoutMs: options.timeoutMs || 180000, timeoutCode: 'SKILLSCANNER_SCAN_TIMEOUT', notAvailableCode: 'SKILLSCANNER_NOT_AVAILABLE', throwOnTimeout: true, subtask });
  // runCommand 语义：exit 0 → stdout 落 result.txt（本引擎报告走 --output-json 落盘文件）；非 0 → stderr 转入 error。
  let rawOut = '';
  try { rawOut = await fs.readFile(reportPath, 'utf8'); } catch (error) { rawOut = ''; }
  let parsed = null;
  try { parsed = JSON.parse(rawOut); } catch (error) { parsed = null; }
  const parseable = parsed !== null && typeof parsed === 'object' && Array.isArray(parsed.findings);
  // exit code 语义硬校验（forbidden: invalid_exit_code——默认模式成功含 findings 均 exit 0）：
  // rc=0 但 JSON 不可解析 = crash 类 invalid_output；rc!=0 且不可解析 = 引擎故障。不静默吞。
  if (!parseable) {
    const head = String(result.error || '').trim().slice(0, 200);
    return { ok: false, artifactPath: null, contract: { pass: false, diff: 'SKILLSCANNER_OUTPUT_INVALID: skill-scanner did not produce a parseable report JSON' + (!result.ok ? ' (rc!=0)' : '') + (head ? ' | ' + head : ''), checkedAt, tool: 'skill-scanner', version, mode: 'exec', invalid_output: true, scanTarget, scope: 'skill-scanner scan --format json against ' + scanTarget }, degraded: false, error: 'SKILLSCANNER_OUTPUT_INVALID' };
  }
  // 能力发现记录（多分析器引擎，只记账不守门）：analyzers_used / analyzers_failed / policy 指纹
  const meta = parsed.scan_metadata && typeof parsed.scan_metadata === 'object' ? parsed.scan_metadata : {};
  const findingsAll = parsed.findings.map(function (f) { return { rule: String(f.rule_id || f.id || 'unknown'), severity: String(f.severity || 'INFO').toLowerCase(), category: String(f.category || ''), message: String(f.title || '').slice(0, 160), line: f.line_number, path: f.file_path }; });
  const threats = findingsAll.filter(function (f) { return rank(f.severity) >= 2; });
  const lows = findingsAll.filter(function (f) { return rank(f.severity) === 1; });
  const infos = findingsAll.filter(function (f) { return rank(f.severity) === 0; });
  const pass = parsed.is_safe === true && threats.length === 0;
  const diff = pass ? null : 'skill-scanner violations: ' + threats.length + ' threat(s) | is_safe=' + String(parsed.is_safe) + ' | ' + threats.map(function (f) { return f.severity + ':' + f.rule + '@' + (f.path || '?') + ':' + (f.line == null ? '?' : f.line); }).join(', ') + (lows.length ? ' | LOW(留痕不阻断): ' + lows.map(function (f) { return f.rule + '@' + (f.path || '?'); }).join(', ') : '');
  const contract = { pass, diff, checkedAt, tool: 'skill-scanner', version, mode: 'exec', exit_code: result.ok ? 0 : 'nonzero', is_safe: parsed.is_safe === undefined ? null : parsed.is_safe, max_severity: String(parsed.max_severity || '').toLowerCase() || null, findings_total: findingsAll.length, threats: threats.length, low_findings: lows, info_notes: infos, analyzers_used: Array.isArray(parsed.analyzers_used) ? parsed.analyzers_used : [], analyzers_failed: Array.isArray(parsed.analyzers_failed) ? parsed.analyzers_failed : [], policy: { name: meta.policy_name || null, version: meta.policy_version || null, preset_base: meta.policy_preset_base || null, fingerprint_sha256: meta.policy_fingerprint_sha256 || null }, scanTarget, scope: 'real skill-scanner ' + version + ' scan (default policy preset, zero custom rules) against ' + scanTarget };
  return emitResult(subtask, workspace, contract, false);
}
export default { name, run };
