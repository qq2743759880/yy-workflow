#!/usr/bin/env node
/** Execute one delivered brief through the legacy V1 receipt path.
 * A changed artifact is an EXECUTED observation, not a V2 receipt state.
 * The independent checker supplies auxiliary task behavior evidence only.
 * V2 APPLIED/VERIFIED remain deferred; checker PASS cannot complete C5.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runCommand, resolveCommandShim } from './lib/adapters/util.mjs';
import { extractPayloadFromBrief } from './lib/activation.mjs';
import { predicateP2, receiptAppend, receiptPath, verifyReceiptFile } from './lib/receipt.mjs';
import {invokeAuthorizedHost} from './lib/host-execution.mjs';
import {createStore} from './lib/store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = path.join(ROOT, 'vendor');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const reserved = new Set(['brief.md', 'receipt.json', 'result.txt', 'host-verification.json', 'checker-output.json']);

export const HOST_RECEIPT_BOUNDARY = Object.freeze({
  receipt_mode: 'LEGACY_V1_ONLY', receipt_schema: 'yy/receipt@1', receipt_version: 1,
  v2_receipt_written: false, c5_v2_complete: false,
  v2_progress: Object.freeze({ APPLIED: 'DEFERRED_TO_C5', VERIFIED: 'DEFERRED_TO_C5' }),
});

function executionObservation(state = 'UNOBSERVED') {
  return { state, scope: 'host_process_and_changed_artifact', v2_receipt_state: false };
}

function auxiliaryTaskBehavior(status = 'NOT_CHECKED') {
  return { status, verification_scope: 'task_behavior', auxiliary_only: true, v2_verification: false };
}

function legacyData(data = {}) {
  return { ...data, ...HOST_RECEIPT_BOUNDARY };
}

function reject(code, reason, data = {}) {
  const error = new Error(reason); error.code = code; error.data = data; throw error;
}

function parseArgs(argv) {
  const allowed = new Set(['workspace', 'subtask-id', 'artifact', 'exec', 'checker', 'timeout-ms']);
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.slice(2);
    if (!argv[i]?.startsWith('--') || !allowed.has(key) || !argv[i + 1] || key in args)
      reject('HOST_INPUT_INVALID', '参数须为唯一的 --name value；使用 --help 查看用法');
    args[key] = argv[i + 1];
  }
  for (const key of ['workspace', 'subtask-id', 'artifact', 'exec']) {
    if (!args[key]) reject('HOST_INPUT_INVALID', '缺少 --' + key);
  }
  if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(args['subtask-id']) || args['subtask-id'].includes('..'))
    reject('HOST_INPUT_INVALID', 'subtask-id 须为单个安全的目录名');
  const timeoutMs = args['timeout-ms'] === undefined ? 600000 : Number(args['timeout-ms']);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) reject('HOST_INPUT_INVALID', 'timeout-ms 须为正整数');
  return { ...args, timeoutMs };
}

function parseCommand(raw, name) {
  let command; try { command = JSON.parse(raw); } catch { reject('HOST_INPUT_INVALID', name + ' 须为 JSON 字符串数组'); }
  if (!Array.isArray(command) || !command.length || command.some(arg => typeof arg !== 'string' || !arg || arg.includes('\0')))
    reject('HOST_INPUT_INVALID', name + ' 须为非空 JSON 字符串数组');
  return command;
}

function inside(base, candidate) {
  return candidate === base || candidate.startsWith(base + path.sep);
}

function artifactPath(base, relative) {
  const parts = relative.replace(/\\/g, '/').split('/');
  if (path.isAbsolute(relative) || parts.some(part => part === '..' || part === '') ||
      !/\.(md|json|ya?ml)$/i.test(relative) || reserved.has(path.basename(relative).toLowerCase()))
    reject('HOST_INPUT_INVALID', 'artifact 须为本子任务目录中的 .md/.json/.yaml/.yml 非控制文件');
  const absolute = path.resolve(base, relative);
  if (!inside(base, absolute) || absolute === base) reject('HOST_INPUT_INVALID', 'artifact 路径越界');
  let existing = absolute;
  while (!fs.existsSync(existing)) existing = path.dirname(existing);
  if (!inside(base, fs.realpathSync(existing))) reject('HOST_INPUT_INVALID', 'artifact 的符号链接路径越界');
  return absolute;
}

function readArtifact(base, file) {
  if (!fs.existsSync(file)) return null;
  if (!inside(base, fs.realpathSync(file)) || !fs.statSync(file).isFile())
    reject('HOST_INPUT_INVALID', 'artifact 须为子任务目录中的常规文件');
  const bytes = fs.readFileSync(file);
  return { bytes, hash: sha256(bytes) };
}

async function execute(command, workspace, subtaskId, timeoutMs, extraArgs) {
  const resolved = resolveCommandShim(command[0]);
  const actual = [resolved.command, ...resolved.prefix, ...command.slice(1), ...extraArgs];
  const startedAt = new Date().toISOString();
  const result = await runCommand(actual[0], actual.slice(1), {
    workspace, subtask: { id: subtaskId }, timeoutMs,
    timeoutCode: 'HOST_COMMAND_TIMEOUT', notAvailableCode: 'HOST_COMMAND_NOT_AVAILABLE',
  });
  return { result, proof: { command: actual, exit_code: result.exitCode ?? null,
    stdout_sha256: sha256(result.stdout || ''), stderr_sha256: sha256(result.stderr || ''),
    started_at: startedAt, finished_at: new Date().toISOString() } };
}

async function main(args, observation, options) {
  const workspace = fs.realpathSync(path.resolve(args.workspace));
  const subtaskId = args['subtask-id'];
  const expectedBase = path.join(workspace, 'artifacts', subtaskId);
  if (!fs.existsSync(expectedBase)) reject('RECEIPT_INCOMPLETE', '子任务目录不存在；先用 decision task --emit-brief --record 投递');
  const base = fs.realpathSync(expectedBase);
  if (!inside(path.join(workspace, 'artifacts'), base)) reject('HOST_INPUT_INVALID', '子任务目录的符号链接路径越界');
  const artifact = artifactPath(base, args.artifact);
  const exec = parseCommand(args.exec, '--exec');
  const checker = args.checker ? parseCommand(args.checker, '--checker') : null;
  if (checker && JSON.stringify(exec) === JSON.stringify(checker))
    reject('HOST_INPUT_INVALID', 'checker 须为独立验收命令，不能重复 exec 命令');

  const file = receiptPath(workspace, subtaskId);
  // V1 originally omitted an explicit schema label. Never treat a labelled V2
  // receipt as legacy merely because the old reader accepts its event fields.
  if (fs.existsSync(file)) {
    let labelled; try { labelled = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* legacy verifier reports malformed JSON */ }
    if (labelled && (['schema', 'receipt_schema'].some(key => labelled[key] !== undefined && labelled[key] !== 'yy/receipt@1') ||
        ['schema_version', 'receipt_version'].some(key => labelled[key] !== undefined && labelled[key] !== 1)))
      reject('HOST_RECEIPT_VERSION_UNSUPPORTED', 'host-consumption 仅支持 LEGACY_V1_ONLY；V2 receipt 不得进入此执行路径');
  }
  const verified = verifyReceiptFile(workspace, subtaskId);
  if (!verified.ok) reject(verified.code, verified.data.reason);
  if (verified.data.state !== 'instructions_delivered' || verified.data.eventCount !== 4)
    reject('HOST_RECEIPT_NOT_READY', '本次执行需要已投递的 T1-T4 新链；每条链只执行一次');
  const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
  const t4 = receipt.events[3];
  const p2 = predicateP2(receipt, VENDOR);
  if (!p2.pass) reject('HOST_SOURCE_CHANGED', p2.reason);
  const brief = path.resolve(base, t4.evidence.briefPath);
  if (!inside(base, brief) || !fs.existsSync(brief) || !inside(base, fs.realpathSync(brief)))
    reject('HOST_BRIEF_INVALID', 'T4 brief 路径不可读或越界');
  const payload = extractPayloadFromBrief(fs.readFileSync(brief, 'utf8'));
  if (payload === null || sha256(payload) !== t4.evidence.payloadSha256)
    reject('HOST_BRIEF_INVALID', 'brief payload 与 T4 投递 hash 不一致');
  const before = readArtifact(base, artifact);
  const plan=await createStore(workspace).load(),task=plan?.subtasks?.find(t=>t.id===subtaskId);
  if(!task)reject('HOST_INTEGRATION_BYPASS','Legacy execution requires an approved local plan/task and its BudgetPolicy.');
  let localPreference={};try{localPreference=JSON.parse(fs.readFileSync(path.join(workspace,'.tt-state/executor.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const host = await invokeAuthorizedHost(task,fs.readFileSync(brief,'utf8'),{
    workspace,planId:plan.id,budgetPolicy:plan.budgetPolicy,assetsRoot:ROOT,exec,executionMode:'EXTERNAL_PROVIDER',
    externalApproval:{approved:true,command:exec},delegationInput:{legacy:localPreference,...(task.delegationContext?{task:{delegation_mode:task.delegationContext.delegation_mode}}:{})},
    present:options.present??(async packet=>{process.stderr.write(JSON.stringify(packet)+'\n');})
  },()=>execute(exec, workspace, subtaskId, args.timeoutMs, [brief, artifact]));
  if (!host.result.ok) reject('HOST_EXECUTION_FAILED', host.result.error, { execution: host.proof });
  const after = readArtifact(base, artifact);
  if (!after || !after.bytes.toString('utf8').trim()) reject('HOST_ARTIFACT_MISSING', 'exec 未产出指定的非空 artifact');
  if (before?.hash === after.hash) reject('HOST_ARTIFACT_UNCHANGED', 'artifact 字节与本次 exec 前一致，不能登记本次执行证据');
  const currentSource = predicateP2(receipt, VENDOR);
  if (!currentSource.pass) reject('HOST_SOURCE_CHANGED', currentSource.reason);
  observation.execution_observation = executionObservation('EXECUTED');
  const artifactRel = path.relative(base, artifact).replace(/\\/g, '/');
  const eventBase = { subtaskId, assetId: t4.assetId, assetType: t4.assetType,
    sourceHash: t4.sourceHash, session: 'host-consumption-cli:LEGACY_V1_ONLY' };
  function append(transition, evidence) {
    const result = receiptAppend({ mode: 'dual', event: { ...eventBase, transition,
      idempotencyKey: `${subtaskId}:${t4.assetId}:${t4.sourceHash}:host:${transition}`,
      evidence: legacyData(evidence) }, opts: { workspace, vendorDir: VENDOR } });
    if (!result.ok) reject(result.code, result.data.reason || 'receipt.append 失败');
    return result;
  }
  append('execution_observed', { artifactPath: artifactRel, artifactSha256: after.hash,
    executed: true, artifact_before_sha256: before?.hash ?? null, artifact_changed: true,
    execution: host.proof, ...observation });
  if (!checker) return { ok: true, code: null, data: { state: 'execution_observed', executed: true,
    verification_scope: 'none', methodology_application: 'unverified' }, evidence: {},
    warnings: ['未提供独立 checker：只记录宿主执行，不登记任务行为验收'] };

  observation.auxiliary_task_behavior = auxiliaryTaskBehavior('FAILED');
  const checked = await execute(checker, workspace, subtaskId, args.timeoutMs, [artifact]);
  const output = checked.result.stdout || '';
  const outputPath = path.join(base, 'checker-output.json');
  fs.writeFileSync(outputPath, output, 'utf8');
  let report; try { report = JSON.parse(output); } catch { /* fail below, preserve exact output */ }
  const artifactCurrent = readArtifact(base, artifact);
  const stableArtifact = artifactCurrent?.hash === after.hash;
  const passed = checked.result.ok && checked.proof.exit_code === 0 && stableArtifact &&
    report?.pass === true && report.artifact_sha256 === after.hash &&
    Array.isArray(report.checks) && report.checks.length > 0 &&
    report.checks.every(check => check && typeof check.name === 'string' && check.name.trim() && check.passed === true);
  observation.auxiliary_task_behavior = auxiliaryTaskBehavior(passed ? 'PASSED' : 'FAILED');
  const proof = legacyData({ schema_version: 1, subtask_id: subtaskId, asset_id: t4.assetId,
    source_hash: t4.sourceHash, artifact_path: artifactRel, artifact_sha256: after.hash,
    executed: true, execution: host.proof,
    checker: { ...checked.proof, output_path: 'checker-output.json', output_sha256: sha256(output), pass: Boolean(passed),
      auxiliary_only: true, v2_verification: false },
    verification_scope: 'task_behavior', methodology_application: 'unverified', ...observation });
  const proofBytes = JSON.stringify(proof, null, 2) + '\n';
  fs.writeFileSync(path.join(base, 'host-verification.json'), proofBytes, 'utf8');
  if (!stableArtifact) reject('HOST_ARTIFACT_CHANGED_DURING_CHECK', 'checker 改动了 T5 指定的 artifact');
  if (!passed) reject('HOST_BEHAVIOR_CHECK_FAILED', '独立 checker 未通过退出码/JSON报告/artifact hash/checks 验收');
  const evidenceRefs = [1, 2, 3, 4].map(eventSeq => ({ eventSeq }));
  // The V1 writer normalizes terminal evidence. Its retained evidenceRef carries
  // this additive boundary without changing accepted core receipt semantics.
  evidenceRefs.push(legacyData({ eventSeq: 5, path: 'host-verification.json', sha256: sha256(proofBytes),
    verification_scope: 'task_behavior', methodology_application: 'unverified' }));
  const accepted = append('behavior_verified', { behaviorCheck: { result: 'VERIFIED', evidenceRefs }, evidenceRefs });
  if (accepted.data.state !== 'behavior_verified')
    reject(accepted.data.reason || accepted.data.result?.reason || 'HOST_BEHAVIOR_CHECK_FAILED', 'receipt P1-P5 复验未通过', accepted.data);
  return { ok: true, code: null, data: { state: 'behavior_verified', executed: true,
    verification_scope: 'task_behavior', methodology_application: 'unverified' },
    evidence: { proof_path: 'host-verification.json', proof_sha256: sha256(proofBytes) },
    warnings: ['LEGACY_V1_ONLY：独立 checker 只提供辅助任务行为证据；V2 APPLIED/VERIFIED 均 DEFERRED_TO_C5'] };
}

/** Public seam for a gated caller. Importing this module does not run the CLI. */
export async function runHostConsumption(argv = [], options = {}) {
  const observation = { execution_observation: executionObservation(), auxiliary_task_behavior: auxiliaryTaskBehavior() };
  try {
    const envelope = await main(parseArgs(argv), observation, options);
    return { ...envelope, data: legacyData({ ...envelope.data, ...observation }) };
  } catch (error) {
    return { ok: false, code: error.code || 'HOST_EXECUTION_FAILED',
      data: legacyData({ reason: error.message, ...(error.data || {}), ...observation }), evidence: {}, warnings: [] };
  }
}

const directCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (directCli && process.argv.slice(2).includes('--help')) {
  process.stdout.write([
    '用法: node scripts/host-consumption.mjs --workspace <dir> --subtask-id <id> --artifact <relative.md|json|yaml>',
    '      --exec <JSON argv array> [--checker <JSON argv array>] [--timeout-ms <positive integer>]',
    '模式: LEGACY_V1_ONLY / yy/receipt@1。EXECUTED 仅为执行观察，不写 V2 receipt，不声明 C5 完成。',
    'V2 APPLIED 与 VERIFIED 均 DEFERRED_TO_C5；任务 checker 为 auxiliary task_behavior。',
    '前置: decision.mjs task --mode brief --emit-brief --record 已生成真实 T1-T4 receipt 和 brief。',
    'exec 以 argv 启动独立进程，末尾追加 brief绝对路径 artifact绝对路径；须产出本次新建/字节改变的非空文件。',
    'checker 使用独立进程，末尾追加 artifact绝对路径；stdout 须为 JSON {pass:true,artifact_sha256:<独立重算>,checks:[{name,passed:true}]}。',
    'checker exit=0 且报告/P1-P5均通过才追加 behavior_verified，验收范围固定为 task_behavior。',
    '方法论应用始终 unverified；checker PASS 不等价于资产方法论 APPLIED。每条 T1-T4 新链执行一次。',
  ].join('\n') + '\n');
} else if (directCli) {
  runHostConsumption(process.argv.slice(2)).then(envelope => {
    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
    if (!envelope.ok) process.exitCode = 1;
  });
}
