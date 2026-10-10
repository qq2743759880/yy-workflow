#!/usr/bin/env node
/**
 * decision-bridge.mjs — C3.3/C3.4 有界 Node 传输桥（V2 MCP ↔ Decision Core）
 *
 * 协议：stdin 一行/一个 JSON 请求 → stdout 一个决策 envelope JSON（{ok, code, data, evidence, warnings}）。
 *   请求：{ op: 'stage'|'task'|'validate', workspace, session?, params: {...外层 C1 签名参数（snake_case）} }
 *   workspace/session 由 Python 侧绑定解析后传入（受信内层，低于 MCP 边界）。
 *
 * 职责（仅传输，零决策语义）：
 *   (1) 参数形状校验 + 逐 op 参数白名单（未知键 fail-closed INPUT_INVALID——防经 params 注入 workspace 等）；
 *   (2) 权威身份前置核验（C3.4）：live digest（computeDecisionAuthority）必须与落档
 *       contracts/generated/decision-authority-components.json 完全一致，否则 AUTHORITY_REVISION_MISMATCH
 *       fail-closed，不执行决策（外部 MCP 面 identity_verified=false 必须拒绝；本地 CLI 另行走 core 的
 *       unverified 模式，不经本桥强制）；
 *   (3) 调用 scripts/lib/decision-core.mjs 三操作之一（一请求一操作一 yy/decision@1 packet）；
 *   (4) 输出 envelope（不添加、不改写任何语义字段）。
 *
 * 本文件 = 传输实现身份（由 Python 侧 V2_TRANSPORT_PINS 单独钉扎），不属于 27 个语义组件——
 * 传输字节变化不改变 decision_authority_digest，两类身份可区分（C3.4）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageDecision, taskDecision, validateConsumption, executionPhaseAllows } from './lib/decision-core.mjs';
import { computeDecisionAuthority, readCommittedManifest } from './lib/decision-authority.mjs';
import {attachMethodologySource,verifySourceTransport,sourceReadError} from './lib/methodology-source-read.mjs';

const DECISION_BRIDGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 逐 op 外层参数白名单（C1 v1.0.1 三工具签名；禁 session/workspace/path 类——绑定解析专属） */
const OP_PARAMS = Object.freeze({
  stage: { allowed: new Set(['workflow_id', 'step']), map: { workflow_id: 'workflowId', step: 'step' } },
  task: {
    allowed: new Set(['task_text', 'capability', 'step', 'subtask_id', 'mode', 'activation_level', 'requested_resources', 'budget', 'source_read']),
    map: { task_text: 'taskText', capability: 'capability', step: 'step', subtask_id: 'subtaskId', mode: 'mode', activation_level: 'activationLevel', requested_resources: 'requestedResources', budget: 'budget' },
  },
  validate: {
    allowed: new Set(['subtask_id', 'artifact_ref', 'evidence_ref']),
    map: { subtask_id: 'subtaskId', artifact_ref: 'artifactRef', evidence_ref: 'evidenceRef' },
  },
});

function envelope(ok, code, data, evidence, warnings) {
  return JSON.stringify({ ok, code: code ?? null, data: data ?? {}, evidence: evidence ?? {}, warnings: warnings ?? [] });
}

function main() {
  let raw;
  try { raw = fs.readFileSync(0, 'utf8'); }
  catch (error) { process.stdout.write(envelope(false, 'INPUT_INVALID', { reason: 'stdin 不可读: ' + error.message })); process.exitCode = 1; return; }

  const root = process.env.YY_DECISION_ROOT ? path.resolve(process.env.YY_DECISION_ROOT) : DECISION_BRIDGE_ROOT;

  // (2) 权威前置核验（外部面 fail-closed；对齐 C3.4——消费生成清单，不复制 27 个哈希）
  let committed;
  try {
    committed = readCommittedManifest(root);
    if (!committed) throw new Error('落档清单缺失或 schema 不符');
    const live = computeDecisionAuthority(root);
    if (live.digest !== committed.digest) throw new Error('live digest ≠ 落档 digest（' + live.digest.slice(0, 12) + '… ≠ ' + committed.digest.slice(0, 12) + '…）');
  } catch (error) {
    process.stdout.write(envelope(false, 'AUTHORITY_REVISION_MISMATCH', { reason: 'decision authority 核验失败: ' + error.message }));
    process.exitCode = 1;
    return;
  }

  // (1) 请求形状 + 参数白名单
  let request;
  try { request = JSON.parse(raw); } catch (error) {
    process.stdout.write(envelope(false, 'INPUT_INVALID', { reason: '请求非 JSON: ' + error.message })); process.exitCode = 1; return;
  }
  const spec = OP_PARAMS[request && request.op];
  if (!spec) { process.stdout.write(envelope(false, 'INPUT_INVALID', { reason: 'op 非法: ' + JSON.stringify(request && request.op) + '（合法 stage|task|validate）' })); process.exitCode = 1; return; }
  const workspace = request.workspace;
  if (typeof workspace !== 'string' || !workspace.trim()) { process.stdout.write(envelope(false, 'INPUT_INVALID', { reason: 'workspace 缺失（须为绑定解析产物）' })); process.exitCode = 1; return; }
  const session = typeof request.session === 'string' && request.session.trim() ? request.session.trim() : undefined;
  const params = request.params && typeof request.params === 'object' && !Array.isArray(request.params) ? request.params : {};
  const unknown = Object.keys(params).filter((k) => !spec.allowed.has(k));
  if (unknown.length) { process.stdout.write(envelope(false, 'INPUT_INVALID', { reason: '未知参数（白名单外）: ' + unknown.join(',') })); process.exitCode = 1; return; }

  // (3) 一请求一操作（snake→camel 仅传输适配，零语义）
  const coreInput = { workspace, session };
  for (const [ext, int] of Object.entries(spec.map)) {
    if (params[ext] !== undefined) coreInput[int] = params[ext];
  }
  coreInput.repoRoot = root;

  if(request.op==='task' && params.source_read!==undefined) {
    if(params.mode!=='brief'||params.step==null||['activation_level','requested_resources','budget'].some(k=>params[k]!==undefined)) {
      process.stdout.write(envelope(false,'INPUT_INVALID',{reason:'source_read requires brief, explicit step and no activation/resources/budget override.'}));process.exitCode=1;return;
    }
  }

  const run = { stage: stageDecision, task: taskDecision, validate: validateConsumption }[request.op];
  (async()=>{
    let stage=null;
    const sourceEnabled=request.op==='task'&&params.mode==='brief'&&params.step!=null&&request.trustedSourceRead;
    if(params.source_read!==undefined&&!sourceEnabled)return sourceReadError({code:'INPUT_INVALID'});
    if(sourceEnabled){try{verifySourceTransport(request.trustedSourceRead);}catch(error){return sourceReadError(error);}stage=await stageDecision(coreInput);if(params.source_read!==undefined && (!stage.ok||stage.data.stage?.allowed!==true||!executionPhaseAllows(stage.data.stage)))return sourceReadError({code:'FILE_NOT_VISIBLE'});}
    let result=await run(coreInput);
    if(sourceEnabled && result.ok && stage.ok && stage.data.stage?.allowed===true && executionPhaseAllows(stage.data.stage)) {
      try {result=await attachMethodologySource(result,coreInput,params,request.trustedSourceRead,stage);}catch(error){if(params.source_read!==undefined)return sourceReadError(error);result.warnings.push('Current methodology source catalog is unavailable.');}
    }
    return result;
  })().then(function (result) {
    process.stdout.write(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
  }).catch(function (error) {
    process.stdout.write(envelope(false, 'INPUT_INVALID', { reason: '决策操作异常（fail-closed）: ' + error.message }));
    process.exitCode = 1;
  });
}

main();
