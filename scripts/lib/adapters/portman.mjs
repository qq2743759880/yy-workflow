/**
 * portman.mjs — be-validator 执行内核 adapter（AS-2-first 迁移后 = Spectral 驱动）。
 *
 * Migration Reference Implementation（contracts/asset-migration.md 六态状态机首个 replace）：
 *  - PRIMARY 引擎：@stoplight/spectral-cli（Apache-2.0，npm @stoplight/spectral-cli），
 *    ruleset 固化 vendor/be-validator/rulesets/spectral-oas.yaml（extends spectral:oas 官方默认）。
 *  - 回滚路径（rollback_adapter）：旧 portman 引擎保留在本文件内，且仅在 EXPLICIT_COMPAT_MODE
 *    显式旗标后可达（Gate-1：迁移期共存≠无限共存，每次调用 contract 内留痕 compat 字段，
 *    无旗标的旧路径调用一律拒绝——禁静默并存）。
 *  - 输出契约（契约冻结外壳，与迁移前同形）：run(subtask, ctx, options) →
 *    { ok, artifactPath:'artifacts/<id>/contract-result.json', contract, degraded, error }。
 *  - 诚实失败语义：spectral 输出不可解析或 exit code 与 findings 矛盾 → SPECTRAL_OUTPUT_INVALID
 *    receipt failure（invalid_output:true），不静默吞（asset-migration.md forbidden: crash/invalid_exit_code）。
 *  - provider identity verification 见 contracts/manifest-sources/be-validator.yaml。
 */
import { runCommand, resolveCommandShim } from './util.mjs';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'be-validator';

const ADAPTER_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SEV = { 0: 'error', 1: 'warn', 2: 'info', 3: 'hint' };

function resolvePath(p, workspace) { return path.isAbsolute(p) ? p : path.join(workspace || '.', p); }
function isOpenApiSpec(doc) {
  return Boolean(doc) && typeof doc === 'object' && !Array.isArray(doc)
    && (typeof doc.openapi === 'string' || typeof doc.swagger === 'string');
}
async function emitContract(subtask, workspace, contract, degraded) {
  const dir = path.join(workspace, 'artifacts', subtask.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'contract-result.json'), JSON.stringify(contract, null, 2));
  return { ok: true, artifactPath: path.join('artifacts', subtask.id, 'contract-result.json'), contract, degraded: Boolean(degraded), error: null };
}

/** spectral shim：先 PATH，回落 <repo>/node_modules/.bin（Windows .cmd 须经 cmd.exe /d /c，libuv spawn 不按 PATHEXT 解析）。 */
function resolveSpectralShim() {
  const shim = resolveCommandShim('spectral');
  if (shim.prefix.length === 0 && !fsSync.existsSync(shim.command)) {
    const local = path.join(ADAPTER_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'spectral.cmd' : 'spectral');
    if (fsSync.existsSync(local)) {
      return process.platform === 'win32' ? { command: process.env.ComSpec || 'cmd.exe', prefix: ['/d', '/c', local] } : { command: local, prefix: [] };
    }
  }
  return shim;
}
/** Gate-1（asset-migration.md §三）：旧 portman 引擎每次调用必须显式携带 EXPLICIT_COMPAT_MODE 旗标，禁静默并存。 */
function compatAllowed(options) {
  return options.explicitCompatMode === true || process.env.EXPLICIT_COMPAT_MODE === '1';
}

/** 旧引擎回滚路径（EXPLICIT_COMPAT_MODE 后）：真实 portman --local 校验，调用留痕 compat 字段。 */
async function runLegacyPortman(subtask, workspace, contractPath, checkedAt, via) {
  const portmanCmd = resolveCommandShim('portman');
  const probe = await runCommand(portmanCmd.command, portmanCmd.prefix.concat(['--version']), { workspace, timeoutMs: 30000, timeoutCode: 'TIMEOUT', notAvailableCode: 'CONTRACT_TOOL_NOT_AVAILABLE', subtask });
  if (!probe.ok) return probe;
  let version = 'unknown';
  if (probe.artifactPath) { try { version = (await fs.readFile(path.join(workspace, probe.artifactPath), 'utf8')).trim() || 'unknown'; } catch (error) { version = 'unknown'; } }
  const collectionOut = path.join(workspace, 'artifacts', subtask.id, 'collection.json');
  const result = await runCommand(portmanCmd.command, portmanCmd.prefix.concat(['--local', contractPath, '-o', collectionOut]), { workspace, timeoutMs: 120000, timeoutCode: 'CONTRACT_VALIDATION_TIMEOUT', notAvailableCode: 'CONTRACT_TOOL_NOT_AVAILABLE', throwOnTimeout: true, subtask });
  const pass = result.ok;
  const diff = result.ok ? null : 'portman validation failed: ' + String(result.error || '').trim().slice(0, 400);
  const contract = { pass, diff, checkedAt, tool: 'portman', version, mode: 'exec', compat: 'EXPLICIT_COMPAT_MODE', rollback_adapter: 'be-validator(portman)', compat_via: via, scope: 'legacy portman ' + version + ' --local lint/collection against ' + contractPath + '（EXPLICIT_COMPAT_MODE 回滚路径，每次调用留痕）' };
  return emitContract(subtask, workspace, contract, false);
}

export async function run(subtask, ctx, options = {}) {
  let workspace = options.workspace;
  if (!workspace) workspace = '.';
  const rulesetPath = options.rulesetPath || path.join(ADAPTER_ROOT, 'vendor', 'be-validator', 'rulesets', 'spectral-oas.yaml');
  const checkedAt = new Date().toISOString();
  const contractFile = subtask.contract && !subtask.contract.includes(' ') && /\.(json|ya?ml)$/.test(subtask.contract);
  const degrade = function (contract) { return emitContract(subtask, workspace, contract, true); };
  // 棕地草案护栏（adapter 层闭环，与迁移前同语义：接触任何 CLI 探测之前返回，不做真校验）
  const draftDegrade = function (why) {
    return degrade({ pass: null, degraded: true, diff: 'brownfield draft (draft:true) — 未确认契约，不做真校验；待后端确认后以 --contract 升级真校验', checkedAt, tool: 'spectral', version: 'unknown', draft: true, reason: why });
  };
  if (subtask.brownfieldDraft === true) return draftDegrade('subtask.brownfieldDraft=true (--contract-draft)');
  let contractPath = null;
  if (contractFile) {
    contractPath = resolvePath(subtask.contract, workspace);
    if (subtask.contract.endsWith('.json')) {
      try {
        const doc = JSON.parse(await fs.readFile(contractPath, 'utf8'));
        if (!isOpenApiSpec(doc)) return degrade({ pass: null, diff: 'contract file is JSON but not an OpenAPI spec (missing openapi/swagger field, e.g. a freeze file); real contract validation requires a valid OpenAPI document — recorded but not validated', checkedAt, tool: 'spectral', version: 'unknown', degraded: true });
        if (doc.draft === true) return draftDegrade('doc.draft=true (contract-reverse brownfield draft)');
      } catch (error) {
        return degrade({ pass: false, diff: 'contract file unreadable: ' + error.message, checkedAt, tool: 'spectral', version: 'unknown', degraded: true });
      }
    }
  }
  if (!contractFile) {
    return degrade({ pass: null, diff: 'contract is descriptive text, not an OpenAPI file; real contract validation requires an OpenAPI contract file (.json/.yaml/.yml) — recorded but not validated', checkedAt, tool: 'spectral', version: 'unknown', degraded: true });
  }
  // 新引擎（spectral）：探测可用性；不可达 → Gate-1 回滚决策点（无旗标拒绝，显式旗标回滚旧路径）
  const shim = resolveSpectralShim();
  const probe = await runCommand(shim.command, shim.prefix.concat(['--version']), { workspace, timeoutMs: 30000, timeoutCode: 'TIMEOUT', notAvailableCode: 'SPECTRAL_NOT_AVAILABLE', subtask });
  if (!probe.ok) {
    if (compatAllowed(options)) return runLegacyPortman(subtask, workspace, contractPath, checkedAt, 'spectral_not_available_rollback');
    return { ok: false, artifactPath: null, contract: null, degraded: false, error: 'SPECTRAL_NOT_AVAILABLE (legacy portman path blocked: EXPLICIT_COMPAT_MODE flag required — Gate-1 asset-migration.md §三)' };
  }
  let version = 'unknown';
  if (probe.artifactPath) { try { version = (await fs.readFile(path.join(workspace, probe.artifactPath), 'utf8')).trim() || 'unknown'; } catch (error) { version = 'unknown'; } }
  const result = await runCommand(shim.command, shim.prefix.concat(['lint', contractPath, '--ruleset', rulesetPath, '--format', 'json']), { workspace, timeoutMs: options.timeoutMs || 120000, timeoutCode: 'CONTRACT_VALIDATION_TIMEOUT', notAvailableCode: 'SPECTRAL_NOT_AVAILABLE', throwOnTimeout: true, subtask });
  // runCommand 语义：exit 0 → stdout 落 result.txt（artifactPath）；非 0 → stdout 转入 error（spectral 违规 exit 1 时 JSON 在此）
  let rawOut = '';
  if (result.ok && result.artifactPath) { try { rawOut = await fs.readFile(path.join(workspace, result.artifactPath), 'utf8'); } catch (error) { rawOut = ''; } }
  else if (!result.ok) rawOut = String(result.error || '');
  let findings = null;
  try { findings = JSON.parse(rawOut); } catch (error) { findings = null; }
  const hasError = findings !== null && findings.some(function (f) { return f.severity === 0; });
  // exit code 语义硬校验（forbidden: invalid_exit_code——有 error 级 finding 却 exit 0，或干净却非 0，一律诚实报错不静默）
  const exitSemanticsBroken = (findings !== null) && ((result.ok && hasError) || (!result.ok && !hasError && result.error !== 'CONTRACT_VALIDATION_TIMEOUT'));
  if (findings === null || exitSemanticsBroken) {
    const head = String(result.error || '').trim().slice(0, 200);
    return { ok: false, artifactPath: null, contract: { pass: false, diff: 'SPECTRAL_OUTPUT_INVALID: spectral did not produce a parseable findings JSON' + (exitSemanticsBroken ? ' or exit code contradicts findings (invalid_exit_code)' : '') + (head ? ' | ' + head : ''), checkedAt, tool: 'spectral', version, mode: 'exec', invalid_output: true, scope: 'spectral lint ' + contractPath }, degraded: false, error: 'SPECTRAL_OUTPUT_INVALID' };
  }
  const errors = findings.filter(function (f) { return f.severity === 0; });
  const pass = errors.length === 0;
  const diff = pass ? null : 'spectral violations: ' + errors.length + ' error(s) | ' + findings.map(function (f) { return (SEV[f.severity] || f.severity) + ':' + f.code; }).join(', ');
  const contract = { pass, diff, checkedAt, tool: 'spectral', version, mode: 'exec', findings_total: findings.length, findings_summary: findings.map(function (f) { return { rule: f.code, severity: SEV[f.severity] ?? f.severity, message: String(f.message || '').slice(0, 160), path: (f.path || []).join('.') }; }), scope: 'real spectral ' + version + ' lint --ruleset vendor/be-validator/rulesets/spectral-oas.yaml against ' + subtask.contract };
  return emitContract(subtask, workspace, contract, false);
}
export default { name, run };
