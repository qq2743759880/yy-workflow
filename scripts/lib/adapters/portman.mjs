import { runCommand, resolveCommandShim } from './util.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

export const name = 'be-validator';

function resolvePath(p, workspace) { return path.isAbsolute(p) ? p : path.join(workspace || '.', p); }


/** 判定已解析 JSON 是否为 OpenAPI 规范（v3 openapi / v2 swagger）。契约冻结文件等非 OpenAPI JSON 不得误判为可校验契约。 */
function isOpenApiSpec(doc) {
  return Boolean(doc) && typeof doc === 'object' && !Array.isArray(doc)
    && (typeof doc.openapi === 'string' || typeof doc.swagger === 'string');
}

/** 从 portman/newman 输出提取紧凑摘要作为 diff（保留原始失败面，不吞错）。 */
function summarizeOutput(output) {
  const lines = String(output || '').split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
  const markers = ['OAS File Error', 'not a valid Openapi', 'Conversion successful', 'Collection written', 'Run Newman against', 'Collection run encountered failures', 'Failed assertions:', 'Newman run failed with', 'AssertionFailure', 'Error:'];
  const picked = [];
  for (const m of markers) {
    const hit = lines.find(function(l) { return l.includes(m); });
    if (hit) picked.push(hit);
    if (picked.length >= 4) break;
  }
  if (picked.length) return picked.join(' | ');
  return String(output || '').trim().slice(0, 400);
}

/** 写 contract-result.json 并返回统一 result 形状。 */
function emitContract(subtask, workspace, contract, degraded) {
  const dir = path.join(workspace, 'artifacts', subtask.id);
  return fs.mkdir(dir, { recursive: true }).then(function() {
    return fs.writeFile(path.join(dir, 'contract-result.json'), JSON.stringify(contract, null, 2));
  }).then(function() {
    return { ok: true, artifactPath: path.join('artifacts', subtask.id, 'contract-result.json'), contract, degraded: Boolean(degraded), error: null };
  });
}

export async function run(subtask, ctx, options = {}) {
  let workspace = options.workspace;
  if (!workspace) workspace = '.';
  const portmanCmd = resolveCommandShim('portman');
  // contract 为文件路径（OpenAPI/契约 JSON）时尝试真实校验；为描述字符串时明确标注未做真实校验
  const contractFile = subtask.contract && !subtask.contract.includes(' ') && subtask.contract.endsWith('.json');
  const checkedAt = new Date().toISOString();
  const degrade = function (contract) { return emitContract(subtask, workspace, contract, true); };

  // 棕地草案护栏（adapter 层闭环，勿只依赖 orchestrator 标记层——独立验收 #3）：
  // ① subtask.brownfieldDraft（--contract-draft 派单设置）或 ② 契约文件自身 doc.draft:true
  // （contract-reverse 产物为 OpenAPI 3 形状 + draft:true，isOpenApiSpec 判不出）。命中即降级，
  // 且在接触任何 portman CLI（含 --version 探测）之前返回：未确认契约不做真校验，
  // 也不因探测版本而要求本机装有 portman——与 orchestration 声称的「待 --contract 升级，不跑真校验」一致。
  const draftDegrade = function (why) {
    const contract = {
      pass: null,
      degraded: true,
      diff: 'brownfield draft (draft:true) — 未确认契约，不做真校验；待后端确认后以 --contract 升级真校验',
      checkedAt,
      tool: 'portman',
      version: 'unknown',
      draft: true,
      reason: why,
    };
    return degrade(contract);
  };
  if (subtask.brownfieldDraft === true) return draftDegrade('subtask.brownfieldDraft=true (--contract-draft)');

  // 文件型契约：先读入判定（诚实：JSON 存在 ≠ 可跑 portman；draft:true 即使 OpenAPI 形状也不跑真校验）
  let doc;
  let contractPath;
  if (contractFile) {
    try {
      contractPath = resolvePath(subtask.contract, workspace);
      doc = JSON.parse(await fs.readFile(contractPath, 'utf8'));
    } catch (error) {
      const contract = { pass: false, diff: 'contract file unreadable: ' + error.message, checkedAt, tool: 'portman', version: 'unknown', degraded: true };
      return degrade(contract);
    }
    if (!isOpenApiSpec(doc)) {
      const contract = { pass: null, diff: 'contract file is JSON but not an OpenAPI spec (missing openapi/swagger field, e.g. a freeze file); real contract validation requires a valid OpenAPI document — recorded but not validated', checkedAt, tool: 'portman', version: 'unknown', degraded: true };
      return degrade(contract);
    }
    if (doc.draft === true) return draftDegrade('doc.draft=true (contract-reverse brownfield draft)');
  }
  // 仅剩「描述字符串契约」或「真实（非 draft）OpenAPI 契约」才需 portman：先确认工具存在（不臆造版本行为，仅探测可用性）
  const probe = await runCommand(portmanCmd.command, portmanCmd.prefix.concat(['--version']), { workspace, timeoutMs: 30000, timeoutCode: 'TIMEOUT', notAvailableCode: 'CONTRACT_TOOL_NOT_AVAILABLE', subtask });
  if (!probe.ok) return probe;
  let version = 'unknown';
  if (probe.artifactPath) { try { version = (await fs.readFile(path.join(workspace, probe.artifactPath), 'utf8')).trim() || 'unknown'; } catch (error) { version = 'unknown'; } }
  if (!contractFile) {
    const contract = { pass: null, diff: 'contract is descriptive text, not an OpenAPI file; real contract validation requires contracts/*.json — recorded but not validated', checkedAt, tool: 'portman', version, degraded: true };
    return degrade(contract);
  }
  // 真实 OpenAPI 契约 → 调用已部署 portman 做真实校验：--local 生成 lint/collection；
  // 可行时（提供 mock baseUrl）追加 --runNewman --baseUrl <mock> 做真实请求校验。
  const mockBaseUrl = options.mockBaseUrl || subtask.mockBaseUrl || null;
  const collectionOut = path.join(workspace, 'artifacts', subtask.id, 'collection.json');
  const args = portmanCmd.prefix.concat(['--local', contractPath, '-o', collectionOut]);
  if (mockBaseUrl) args.push('--runNewman', '--baseUrl', mockBaseUrl);
  const result = await runCommand(portmanCmd.command, args, { workspace, timeoutMs: options.timeoutMs || 120000, timeoutCode: 'CONTRACT_VALIDATION_TIMEOUT', notAvailableCode: 'CONTRACT_TOOL_NOT_AVAILABLE', throwOnTimeout: true, subtask });
  const pass = result.ok;
  const diff = result.ok ? null : 'portman validation failed: ' + summarizeOutput(result.error);
  const scope = 'real portman ' + version + ' ' + (mockBaseUrl ? '--runNewman --baseUrl ' + mockBaseUrl : '--local lint/collection') + ' against ' + subtask.contract;
  const contract = { pass, diff, checkedAt, tool: 'portman', version, mode: 'exec', scope };
  return emitContract(subtask, workspace, contract, false);
}
export default { name, run };
