#!/usr/bin/env node
/**
 * decision.mjs — C2.4 本地 CLI（thin caller；语义单点 = scripts/lib/decision-core.mjs，零逻辑复制）
 *
 * 子命令：
 *   stage     --workspace <dir> --step <0|1|1.5|2..8> [--session <id>] [--workflow-id <id>] [--now <ISO>]
 *   task      --task-text <text> [--capability <key>] [--step <n>] [--subtask-id <id>]
 *             --mode select|brief [--activation-level metadata|body|resource]
 *             [--requested-resources a.md,b.md] [--budget <N>] [--workspace <dir>]
 *             [--emit-brief] [--record] [--now <ISO>]
 *   validate  --workspace <dir> --subtask-id <id> [--artifact-ref <name>] [--evidence-ref <name>] [--now <ISO>]
 *
 * 输出：stdout = 决策 envelope JSON（{ok, code, data, evidence, warnings}）。
 * 退出码：0 = 决策成功；1 = 决策失败（envelope ok=false）；2 = 用法错误。
 *
 * 写纪律（默认零写）：--emit-brief 只写 artifacts/<subtaskId>/brief.md；
 * --record 只经既有 receipt.append 追加 T1-T4 事件（dual 模式）；两者默认 OFF，
 * 且仅属于本地 CLI opt-in——MCP 语义面永远只读（C1 no_write_guarantee）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageDecision, taskDecision, validateConsumption } from './lib/decision-core.mjs';
import { receiptAppend } from './lib/receipt.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage(message) {
  if (message) process.stderr.write('[decision] ' + message + '\n');
  process.stderr.write([
    '用法:',
    '  node scripts/decision.mjs stage    --workspace <dir> --step <0|1|1.5|2..8> [--session <id>] [--workflow-id <id>] [--now <ISO>]',
    '  node scripts/decision.mjs task     --task-text <text> --mode select|brief [--capability <key>] [--subtask-id <id>]',
    '                                     [--activation-level metadata|body|resource] [--requested-resources a,b] [--budget <N>]',
    '                                     [--workspace <dir>] [--step <n>] [--emit-brief] [--record] [--now <ISO>]',
    '  node scripts/decision.mjs validate --workspace <dir> --subtask-id <id> [--artifact-ref <name>] [--evidence-ref <name>] [--now <ISO>]',
  ].join('\n') + '\n');
  process.exit(2);
}

function parseArgs(argv) {
  const out = { command: argv[0] || null };
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) usage('未知参数: ' + a);
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { out[key] = true; continue; }
    out[key] = next; i += 1;
  }
  return out;
}

function parseStep(raw) {
  if (raw === undefined || raw === true) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw;
}

function emitBriefFile(workspace, packet) {
  const ctx = packet.receipt_context;
  if (!ctx || !packet.brief || !packet.brief.text) throw new Error('brief 包缺失（--emit-brief 仅适用于成功的 brief 模式决策）');
  const dir = path.join(workspace, 'artifacts', ctx.subtask_id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'brief.md');
  fs.writeFileSync(file, packet.brief.text, 'utf8');
  return file;
}

function recordReceiptEvents(opts) {
  const { workspace, summary, session, vendorDir, now } = opts;
  const results = [];
  const sess = session || 'decision-cli';
  const events = [
    { transition: 'discovered', evidence: { catalogCacheIdentity: summary.catalogCacheIdentity, sourceHash: summary.sourceHash } },
    { transition: 'eligible', evidence: { phaseEligibility: summary.phaseEligibility } },
    { transition: 'selected', evidence: { planId: summary.planId, subtaskId: summary.subtaskId, sourceHash: summary.sourceHash } },
    { transition: 'instructions_delivered', evidence: { activationLevel: summary.activationLevel, payloadSha256: summary.payloadSha256, briefPath: 'brief.md', sourceHashEcho: summary.sourceHash, budgetResult: summary.budget } },
  ];
  for (const ev of events) {
    const res = receiptAppend({
      event: {
        transition: ev.transition,
        subtaskId: summary.subtaskId,
        assetId: summary.assetId,
        assetType: summary.assetType,
        sourceHash: summary.sourceHash,
        session: sess,
        idempotencyKey: `${summary.subtaskId}:${summary.assetId}:${summary.sourceHash}:${ev.transition}`,
        evidence: ev.evidence,
      },
      mode: 'dual',
      opts: { workspace, vendorDir, now },
    });
    results.push({ transition: ev.transition, ok: res.ok, code: res.code, duplicate: Boolean(res.data && res.data.duplicate) });
    if (!res.ok) {
      const err = new Error(`receipt.append ${ev.transition} 失败: ${res.code} ${(res.data && res.data.reason) || ''}`);
      err.results = results;
      throw err;
    }
  }
  return results;
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const now = args.now && args.now !== true ? new Date(args.now) : undefined;
  let envelope;

  if (args.command === 'stage') {
    if (!args.workspace || args.workspace === true) usage('stage 需要 --workspace <dir>');
    if (args.step === undefined) usage('stage 需要 --step <0|1|1.5|2..8>');
    envelope = await stageDecision({
      workspace: args.workspace,
      step: parseStep(args.step),
      session: typeof args.session === 'string' ? args.session : undefined,
      workflowId: typeof args['workflow-id'] === 'string' ? args['workflow-id'] : undefined,
      now,
    });
  } else if (args.command === 'task') {
    if (!args['task-text'] || args['task-text'] === true) usage('task 需要 --task-text <text>');
    if (!args.mode || (args.mode !== 'select' && args.mode !== 'brief')) usage('task 需要 --mode select|brief');
    envelope = await taskDecision({
      taskText: args['task-text'],
      capability: typeof args.capability === 'string' ? args.capability : undefined,
      step: parseStep(args.step),
      subtaskId: typeof args['subtask-id'] === 'string' ? args['subtask-id'] : undefined,
      mode: args.mode,
      activationLevel: typeof args['activation-level'] === 'string' ? args['activation-level'] : undefined,
      requestedResources: typeof args['requested-resources'] === 'string'
        ? args['requested-resources'].split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      budget: args.budget !== undefined && args.budget !== true ? { limit: Number(args.budget) } : undefined,
      workspace: typeof args.workspace === 'string' ? args.workspace : undefined,
      session: typeof args.session === 'string' ? args.session : undefined,
      now,
    });
    if (envelope.ok && (args['emit-brief'] === true || args.record === true)) {
      const workspace = typeof args.workspace === 'string' ? args.workspace : usage('task --emit-brief/--record 需要 --workspace <dir>');
      if (args['emit-brief'] === true) {
        const file = emitBriefFile(workspace, envelope.data);
        envelope.warnings.push('EMITTED_BRIEF: ' + path.relative(workspace, file));
      }
      if (args.record === true) {
        const summary = envelope.evidence && envelope.evidence.activation_summary;
        if (!summary) throw new Error('--record 需要 brief 模式决策的 activation_summary（选择受阻/legacy 无 primary 不可记录）');
        const results = recordReceiptEvents({
          workspace,
          summary,
          session: typeof args.session === 'string' ? args.session : undefined,
          vendorDir: typeof args['vendor-dir'] === 'string' ? args['vendor-dir'] : path.join(REPO_ROOT, 'vendor'),
          now,
        });
        envelope.warnings.push('RECORDED_T1_T4: ' + results.map((r) => r.transition + (r.duplicate ? '(dup)' : '')).join(','));
      }
    }
  } else if (args.command === 'validate') {
    if (!args.workspace || args.workspace === true) usage('validate 需要 --workspace <dir>');
    if (!args['subtask-id'] || args['subtask-id'] === true) usage('validate 需要 --subtask-id <id>');
    envelope = await validateConsumption({
      workspace: args.workspace,
      subtaskId: args['subtask-id'],
      artifactRef: typeof args['artifact-ref'] === 'string' ? args['artifact-ref'] : undefined,
      evidenceRef: typeof args['evidence-ref'] === 'string' ? args['evidence-ref'] : undefined,
      now,
    });
  } else {
    usage('未知子命令: ' + args.command);
  }

  process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
  process.exitCode = envelope.ok ? 0 : 1;
}

main().catch((error) => {
  process.stderr.write('[decision] ' + error.message + '\n');
  process.exitCode = 1;
});
