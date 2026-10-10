/**
 * decision-core.mjs — C2.1 Decision Core（host/MCP/UI 无关的语义入口层）
 *
 * 契约依据：contracts/decision-contract-v1.yaml（唯一语义权威，SHA256 见 project-handoff）
 * 操作面（仅三，不新增）：stageDecision / taskDecision / validateConsumption。
 * 统一响应壳（house style）：{ok, code, data, evidence, warnings}；data = Decision Packet（yy/decision@1）。
 *
 * 边界纪律：
 *   - 零 LLM、零网络、零 MCP 依赖；内层可收受信 workspace/session（低于 MCP 边界）；
 *   - 复用唯一权威（禁第二真值）：journey 准入=tt-journey.mjs；执行相位=phase.mjs（只读、整数 step、
 *     零修改）；路由=planner.buildPlan + capability-derivation + CAPABILITY_MAP/CLUSTERS；
 *     资格=resolveAssetEligibility；加载=activationPrepare；brief=renderBrief；验证=receipt 链重放；
 *   - 零写默认：查询操作不写任何文件（--emit-brief/--record 仅 CLI opt-in，见 scripts/decision.mjs）；
 *   - 包卫生：packet 内不得出现绝对路径 / session 值（evidence ref 一律相对路径，session 目录用
 *     '<session>' 占位符）；
 *   - NoMatchError ⇒ envelope ROUTING_NO_MATCH（唯一新码，仅"任务文本路由不到簇"）；
 *     capability 未知/簇冲突保持 CAPABILITY_UNKNOWN / CAPABILITY_CLUSTER_MISMATCH（复用在产码）；
 *   - 跨面不一致（journey 准入 vs 执行相位）= data + warning（execution_phase.consistency），禁 PROJECTION_CONFLICT。
 */
import {describeMethodology} from './methodology.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { STEPS, STEP_IDS, PREREQ_MAP, readJourney, journeyPath, newJourney, prereqCheck } from '../tt-journey.mjs';
import { checkPhase } from './phase.mjs';
import { CLUSTERS } from './matrix.mjs';
import { buildPlan, NoMatchError } from './planner.mjs';
import { deriveCapability, resolveCapabilityAsset, CapabilityIngressError } from './capability-derivation.mjs';
import {
  activationPrepare, renderBrief, extractPayloadFromBrief, CAPABILITY_MAP,
  ACTIVATION_LEVELS, DEFAULT_ACTIVATION_LEVEL, resolveAssetEligibility, ASSET_MANIFEST_V2_PATH,
} from './activation.mjs';
import { receiptPath, verifyReceiptFile, predicateP2, predicateP3, predicateP4, predicateP5 } from './receipt.mjs';
import { readManifest } from './asset.mjs';
import { computeDecisionAuthority, readCommittedManifest, DECISION_REPO_ROOT } from './decision-authority.mjs';
import { projectOwnerView, renderOwnerActions } from './decision-plain.mjs';

export const DECISION_PACKET_SCHEMA = 'yy/decision@1';
const V3_DIR_REL = 'contracts/v3';
const SUBTASK_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function respond(ok, code, data, evidence, warnings) {
  return { ok, code: code ?? null, data: data ?? {}, evidence: evidence ?? {}, warnings: warnings ?? [] };
}
function fail(code, reason, warnings) { return respond(false, code, { reason }, {}, warnings); }
function sha256Hex(text) { return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex'); }

// ---------------------------------------------------------------------------
// authority block（C1 §authority；identity_verified = live digest 与落档清单一致）
// ---------------------------------------------------------------------------

function gitIdentity(root) {
  try {
    const out = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD', 'HEAD^{tree}'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });
    const [commit, tree] = out.split(/\s+/).filter(Boolean);
    return { commit: commit || null, tree: tree || null };
  } catch { return { commit: null, tree: null }; }
}

export async function buildAuthorityBlock(opts = {}) {
  const root = opts.repoRoot ?? DECISION_REPO_ROOT;
  const warnings = [];
  let live;
  try { live = computeDecisionAuthority(root); }
  catch (error) { return { error: fail('AUTHORITY_REVISION_MISMATCH', error.message) }; }
  const committed = readCommittedManifest(root);
  let identityVerified = false;
  if (!committed) warnings.push('decision-authority 落档清单缺失：identity_verified=false（先运行 scripts/build-decision-authority.mjs）');
  else if (committed.digest !== live.digest) warnings.push('DECISION_AUTHORITY_DRIFT：实际语义输入与落档清单不一致（' + committed.digest.slice(0, 12) + '… ≠ ' + live.digest.slice(0, 12) + '…）；重跑生成器或回滚改动');
  else identityVerified = true;
  const git = gitIdentity(root);
  const block = {
    authority_mode: 'source-candidate',
    release_id: null,
    identity_verified: identityVerified,
    git_commit: git.commit,
    git_tree: git.tree,
    source_bundle_digest: null,          // Foundation 发布 provenance（bundle 不含 contracts/**）——本层不替代
    payload_digest: null,
    snapshot_id: null,
    decision_authority_digest: live.digest,
    decision_authority_components: live.components.map((c) => ({ path: c.path, sha256: c.sha256, role: c.role })),
  };
  return { block, warnings, componentCount: live.components.length };
}

function stateFileFor(workspace, session) {
  return session ? path.join(workspace, '.tt-state', session, 'state.json') : path.join(workspace, '.tt-state', 'state.json');
}
function journeyRelFor(session) { return session ? '.tt-state/<session>/journey.json' : '.tt-state/journey.json'; }

// Production state rows point to the active namespace; inferred/history/manual rows are not expectations.
function referencedStatePlan(journey, workspace, stateFile) {
  const nativePath = (file) => {
    const resolved = path.resolve(file);
    return process.platform === 'win32' ? path.toNamespacedPath(resolved).toLowerCase() : resolved;
  };
  return (Array.isArray(journey.plans) ? journey.plans : []).find((plan) =>
    plan && typeof plan.planId === 'string' && plan.planId.trim() && plan.planId !== '__manual__'
    && plan.inferred !== true && plan.status !== 'prereq-bypassed'
    && typeof plan.summaryPath === 'string' && plan.summaryPath.trim()
    && nativePath(path.resolve(workspace, plan.summaryPath.replaceAll('\\', '/'))) === nativePath(stateFile));
}


/** An omitted supplemental block is NOT_APPLICABLE; a present result must explicitly permit. */
export function executionPhaseAllows(stage) {
  return Boolean(stage && (!Object.hasOwn(stage, 'execution_phase') || stage.execution_phase?.allowed === true));
}

function stepDefById(step) { return STEPS.find((s) => s.step === step) || null; }

/** 当前位置：in_progress 优先，否则 STEPS 顺序（= 前进序）首个未 done，全 done ⇒ 末节点。 */
function currentStepOf(steps) {
  const inProgress = steps.find((s) => s.status === 'in_progress');
  if (inProgress) return inProgress;
  const pending = steps.find((s) => s.status !== 'done');
  if (pending) return pending;
  return steps[steps.length - 1];
}

/** prerequisites 明细（per-dep 投影；判定语义与 prereqCheck 同源，不重定义）。 */
function projectPrerequisites(journey, step) {
  const deps = PREREQ_MAP[step] || [];
  const byId = new Map(journey.steps.map((s) => [s.step, s]));
  return deps.map((dep) => {
    const node = byId.get(dep.step);
    const stepDone = Boolean(node && (node.status === 'done' || (dep.inProgressOk && node.status === 'in_progress')));
    const gateOk = !dep.gate || Boolean(node && (node.gates_passed || []).includes(dep.gate));
    const satisfied = stepDone && gateOk;
    return {
      step: dep.step,
      name: (stepDefById(dep.step) || {}).name ?? String(dep.step),
      gate: dep.gate ?? null,
      status: node ? node.status : 'missing',
      satisfied,
      unmet_reason: satisfied ? null : (!stepDone ? 'PREREQ_STEP_UNDONE' : 'PREREQ_GATE_MISSING'),
    };
  });
}

function blockersFromPrereqs(prereqs, requestedStep) {
  const blockers = [];
  for (const p of prereqs.filter((x) => !x.satisfied)) {
    blockers.push({
      code: 'PHASE_PREREQ_UNMET',
      reason: !p.status || p.status === 'missing' || p.unmet_reason === 'PREREQ_STEP_UNDONE'
        ? `阶段 ${p.step}（${p.name}）未完成，步骤 ${requestedStep} 不得开工`
        : `阶段 ${p.step}（${p.name}）缺签收闸 ${p.gate}，步骤 ${requestedStep} 不得开工`,
      missing: [p.unmet_reason === 'PREREQ_GATE_MISSING' ? p.gate : `step ${p.step} done`],
    });
  }
  return blockers;
}

// ---------------------------------------------------------------------------
// stageDecision（UC-1/UC-5；主权威 = Journey Admission，含 1.5；零写）
// ---------------------------------------------------------------------------

/**
 * stageDecision(input)
 * input: { workspace(必填，受信), step(必填 ∈ STEP_IDS), session?, workflowId?, now?, repoRoot? }
 */
export async function stageDecision(input = {}) {
  const warnings = [];
  const workspace = input.workspace;
  if (!workspace || typeof workspace !== 'string') return fail('INPUT_INVALID', 'workspace 缺失（内层受信参数，MCP 面由绑定解析提供）');
  const step = input.step;
  if (!STEP_IDS.includes(step)) return fail('STAGE_UNKNOWN', `step 非法: ${JSON.stringify(step)}（合法 STEP_IDS: ${STEP_IDS.join(' / ')}，含 1.5 研究门）`);
  const session = typeof input.session === 'string' && input.session.trim() ? input.session.trim() : null;
  const now = input.now ?? new Date();

  const auth = await buildAuthorityBlock({ repoRoot: input.repoRoot });
  if (auth.error) return auth.error;
  warnings.push(...auth.warnings);

  let journey = null;
  try { journey = await readJourney(workspace, session ?? undefined); }
  catch (error) { return fail('JOURNEY_INVALID', 'journey.json 不可解析（fail-closed，不静默重建）: ' + error.message, warnings); }

  const jp = journeyPath(workspace, session ?? undefined);
  let journeyDigest = null; let mtimeMs = null;
  try { const buf = fs.readFileSync(jp); journeyDigest = crypto.createHash('sha256').update(buf).digest('hex'); mtimeMs = fs.statSync(jp).mtimeMs; } catch { /* 未初始化 */ }

  const notInitialized = journey === null;
  if (!notInitialized && !Array.isArray(journey.steps)) {
    return fail('JOURNEY_INVALID', 'journey.json 缺 steps 数组（schema 违约，fail-closed）', warnings);
  }
  const effective = notInitialized ? newJourney() : journey;
  const requestedDef = stepDefById(step);

  // 准入裁决（C2-R1-2 冻结）：canonical = tt-journey prereqCheck()；未初始化 ⇒ 仅 step0 放行，
  // 其余 STEP_ID（含 2/4/6 回跳层）全部阻断。projectPrerequisites 仅作明细投影，不得覆盖裁决。
  let allowed; let verdictReason;
  if (notInitialized) {
    allowed = step === 0;
    verdictReason = 'journey.json 缺失（NOT_INITIALIZED）：仅 step 0 允许，其余 STEP_ID 全部阻断';
  } else {
    const verdict = prereqCheck(journey, step);
    allowed = verdict.ok === true;
    verdictReason = verdict.reason;
  }
  const prerequisites = notInitialized && step === 0 ? [] : projectPrerequisites(effective, step);
  let blockers = [];
  if (!allowed) {
    blockers = notInitialized
      ? [{ code: 'PHASE_PREREQ_UNMET', reason: verdictReason, missing: ['journey init'] }]
      : blockersFromPrereqs(prerequisites, step);
    if (blockers.length === 0) blockers = [{ code: 'PHASE_PREREQ_UNMET', reason: verdictReason, missing: [] }];
  }
  const current = notInitialized ? { step: 0, name: stepDefById(0).name } : currentStepOf(effective.steps);

  // required_owner_action：结构化动作经白话投影表渲染（C2-R1-4：JS 零自有 owner 文案）
  const structuredActions = [];
  if (notInitialized && step !== 0) structuredActions.push({ type: 'init' });
  else {
    for (const p of prerequisites.filter((x) => !x.satisfied)) {
      if (p.unmet_reason === 'PREREQ_GATE_MISSING' && p.gate) structuredActions.push({ type: 'gate', gate: p.gate });
      else structuredActions.push({ type: 'step', step: p.step, name: p.name });
    }
    if (structuredActions.length === 0 && !allowed) structuredActions.push({ type: 'step', step: '-', name: String(verdictReason).slice(0, 60) });
  }
  const requiredOwnerAction = renderOwnerActions(structuredActions);

  // execution_phase：整数阶段检查现存或由当前旅程明确引用的状态；1.5 保持不适用。
  let executionPhase;
  const stateFile = stateFileFor(workspace, session);
  if (Number.isInteger(step)) {
    let statePresent = false;
    const expectedPlan = referencedStatePlan(effective, workspace, stateFile);
    let planStatus = expectedPlan?.status ?? null;
    try {
      fs.lstatSync(stateFile); // Only unreferenced absence is inapplicable; expected/raced absence fails closed.
      statePresent = true;
      const stateBytes = fs.readFileSync(stateFile);
      const plan = JSON.parse(stateBytes.toString('utf8'));
      if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new Error('state.json must contain a plan object');
      planStatus = plan.status ?? null;
      const res = await checkPhase({ workspace, target: step, session: session ?? undefined, journey: effective,
        opts: { now, ...(session ? { env: { ...process.env, YY_SESSION_MODE: 'namespaced' } } : {}) } });
      if (res.ok && res.code === null && res.evidence?.snapshot !== crypto.createHash('sha256').update(stateBytes).digest('hex')) {
        throw new Error('execution phase did not verify the applicable state snapshot');
      }
      let phaseAllowed; let phaseBlockers;
      if (res.ok && res.code === null && res.data?.allowed === true) { phaseAllowed = true; phaseBlockers = []; }
      else if (res.ok && res.code === 'PHASE_PREREQ_UNMET') { phaseAllowed = false; phaseBlockers = res.data.missing || []; }
      else { phaseAllowed = false; phaseBlockers = res.data?.missing?.length ? res.data.missing : [{ code: res.code || 'PHASE_PREREQ_UNMET', reason: (res.data && res.data.reason) || '执行相位检查硬错误' }]; warnings.push('execution phase check 硬错误（如实并入补充块，不改写准入结论）: ' + res.code); }
      const consistency = allowed === phaseAllowed ? 'CONSISTENT' : 'MISMATCH';
      if (consistency === 'MISMATCH') warnings.push('EXECUTION_PHASE_MISMATCH：旅程准入与执行相位结论不一致（data/warning 级，两权威维度不同，不升格为 envelope 错误）');
      executionPhase = { plan_status: planStatus, allowed: phaseAllowed, blockers: phaseBlockers, consistency };
    } catch (error) {
      if (statePresent || expectedPlan || error.code !== 'ENOENT') {
        const detail = error.code === 'ENOENT' && expectedPlan
          ? '缺失执行状态 ' + journeyRelFor(session).replace('journey.json', 'state.json') + '（当前旅程存在适用计划引用）'
          : error.message;
        const reason = '执行相位核验失败：请修复状态并重新核验后执行（不改变旅程准入结论）: ' + detail;
        executionPhase = { plan_status: planStatus, allowed: false,
          blockers: [{ code: 'PHASE_PREREQ_UNMET', reason, missing: ['readable valid state.json', 'successful execution phase check'] }],
          consistency: allowed ? 'MISMATCH' : 'CONSISTENT' };
        warnings.push(reason);
        if (allowed) warnings.push('EXECUTION_PHASE_MISMATCH：旅程准入通过，但执行相位核验失败');
      }
    }
  }

  const packet = {
    schema: DECISION_PACKET_SCHEMA,
    authority: auth.block,
    workflow: {
      workflow_id: input.workflowId ?? null,
      journey_state_digest: journeyDigest,
      journey_status: notInitialized ? 'NOT_INITIALIZED' : 'OK',
    },
    stage: {
      authority: 'journey-admission',
      current_step: current.step,
      current_name: current.name,
      requested_step: step,
      requested_name: requestedDef ? requestedDef.name : String(step),
      allowed,
      prerequisites,
      blockers,
      required_owner_action: requiredOwnerAction,
      ...(executionPhase ? { execution_phase: executionPhase } : {}),
    },
    owner: null,
    evidence: {
      refs: journeyDigest ? [{ path: journeyRelFor(session), sha256: journeyDigest }] : [],
      observed_at: new Date(now).toISOString(),
      freshness: mtimeMs !== null ? { journey_mtime_ms: mtimeMs } : {},
    },
  };
  packet.owner = projectOwnerView(packet);
  return respond(true, null, packet, { authority_components: auth.componentCount, input_echo: { step } }, warnings);
}

// ---------------------------------------------------------------------------
// taskDecision（UC-2/UC-3；七桶投影 + 可选 brief；零写）
// ---------------------------------------------------------------------------

function phaseIndexOf(cluster, asset) {
  const flat = (Array.isArray(cluster.phases) ? cluster.phases : cluster.candidates.map((n) => [n])).flat();
  const idx = flat.indexOf(asset);
  return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
}

function orderCandidates(cluster, names) {
  const base = new Map(cluster.candidates.map((n, i) => [n, i]));
  return [...names].sort((a, b) => (phaseIndexOf(cluster, a) - phaseIndexOf(cluster, b)) || (base.get(a) ?? 0) - (base.get(b) ?? 0));
}

/** V3 契约投影（lifecycle/version/contract_hash；compatibility epoch：仅候选元数据，不充任权威）。 */
function v3Projection(repoRoot, assetId, manifestRow) {
  const file = path.join(repoRoot, V3_DIR_REL, `${assetId}.contract-v3.yaml`);
  try {
    const text = fs.readFileSync(file, 'utf8');
    const version = (/^version:\s*(\S+)/m.exec(text) || [])[1] ?? null;
    const lifecycleAnchor = text.indexOf('\nlifecycle:');
    const status = lifecycleAnchor >= 0 ? (/status:\s*(\S+)/.exec(text.slice(lifecycleAnchor, lifecycleAnchor + 300)) || [])[1] ?? null : null;
    return { version, lifecycle: status ?? 'UNKNOWN', contract_hash: sha256Hex(text) };
  } catch {
    return { version: null, lifecycle: 'MANIFEST_V2_ONLY', contract_hash: manifestRow ? sha256Hex(JSON.stringify(manifestRow)) : null };
  }
}

/**
 * taskDecision(input)
 * input: { taskText(必填), capability?, step?, subtaskId?, mode('select'|'brief', 必填),
 *          activationLevel?('metadata'|'body'|'resource'), requestedResources?, budget?{limit},
 *          workspace?, session?, workflowId?, now?, repoRoot?, vendorDir? }
 */
export async function taskDecision(input = {}) {
  const warnings = [];
  const taskText = input.taskText;
  if (typeof taskText !== 'string' || !taskText.trim()) return fail('INPUT_INVALID', 'task_text 缺失或为空（fail-closed）');
  const mode = input.mode;
  if (mode !== 'select' && mode !== 'brief') return fail('INPUT_INVALID', `mode 非法: ${JSON.stringify(mode)}（合法 select|brief）`);

  let level = input.activationLevel ?? DEFAULT_ACTIVATION_LEVEL;
  if (!ACTIVATION_LEVELS.includes(level)) return fail('INPUT_INVALID', `activation_level 非法: ${level}（合法 ${ACTIVATION_LEVELS.join('|')}）`);
  if (mode === 'select' && level !== 'metadata') {
    if (input.activationLevel && input.activationLevel !== 'metadata') warnings.push(`select 模式强制 activation_level=metadata（忽略传入 ${input.activationLevel}，零正文加载）`);
    level = 'metadata';
  }
  const budget = input.budget && typeof input.budget === 'object' && !Array.isArray(input.budget) && input.budget.limit !== undefined
    ? { limit: input.budget.limit } : undefined;
  if (budget && (typeof budget.limit !== 'number' || !Number.isFinite(budget.limit) || budget.limit <= 0)) {
    return fail('INPUT_INVALID', 'budget.limit 形状非法（须为正数）');
  }

  const repoRoot = input.repoRoot ?? DECISION_REPO_ROOT;
  const vendorDir = input.vendorDir ?? path.join(repoRoot, 'vendor');
  const now = input.now ?? new Date();

  const auth = await buildAuthorityBlock({ repoRoot });
  if (auth.error) return auth.error;
  warnings.push(...auth.warnings);

  // (1) capability ingress（precedence：explicit > derived > absent；值域守卫 fail-closed）
  const explicitCap = typeof input.capability === 'string' && input.capability.trim() ? input.capability.trim().toLowerCase() : null;
  if (input.capability !== undefined && input.capability !== null && String(input.capability).trim() && !resolveCapabilityAsset(explicitCap)) {
    return fail('CAPABILITY_UNKNOWN', `capability「${explicitCap}」不在 CAPABILITY_MAP 受控映射（fail-closed 不猜；键集见 scripts/lib/activation.mjs）`, warnings);
  }
  const derivedHit = explicitCap ? null : deriveCapability(taskText);
  const capability = explicitCap || (derivedHit ? derivedHit.key : null);
  const capabilitySource = capability ? (explicitCap ? 'explicit' : 'derived') : null;
  const matchedKeyword = derivedHit ? derivedHit.matchedKey : null;
  const capabilityOwner = capability ? resolveCapabilityAsset(capability) : null;

  // (2) 路由（复用 buildPlan：簇约束轴 + capability 守卫；NoMatchError ⇒ ROUTING_NO_MATCH）
  // 路由可用性权威（C2-R1-1）：C1 冻结 = contracts/asset-manifest-v2.json（经 asset.readManifest
  // 校验读面），不再走 lib/manifest.mjs 的 legacy vendor-frontmatter 目录；planner 仅需 {entries} 形状（不改 planner）。
  let manifest;
  try { manifest = { entries: await readManifest(ASSET_MANIFEST_V2_PATH) }; }
  catch (error) {
    return fail('ASSET_MANIFEST_INVALID', 'governance manifest 读取/校验失败（C1 路由权威 = asset-manifest-v2.json）: ' + (error.code ?? '') + ' ' + error.message, warnings);
  }
  let plan;
  try { plan = buildPlan(taskText, manifest, { capability: explicitCap,ownerIntent:input.constraints?.owner_intent,methodologyContext:input.constraints?.methodology }); }
  catch (error) {
    if (error instanceof NoMatchError) return fail('ROUTING_NO_MATCH', 'task_text 无可路由簇（planner.route() NoMatchError；fail-closed 不猜）', warnings);
    if (error instanceof CapabilityIngressError) return fail(error.code, error.message, warnings);
    throw error;
  }
  // 确定性 plan id（buildPlan 内置 Date.now 仅适用于一次性执行链；决策投影须可重放——
  // 同 (cluster, capability, taskText) ⇒ 同 plan_id，保证 receipt 幂等键与 packet 字节确定）
  plan.id = 'plan-' + sha256Hex([plan.cluster, capability ?? '', taskText].join('|')).slice(0, 16);
  const cluster = CLUSTERS.find((c) => c.id === plan.cluster);
  const candidates = cluster.candidates;

  // (3) 资格（AV-3；owner 行走 capability 模式留痕解析链；hints = taskText）
  const eligibility = [];
  for (const name of candidates) {
    const r = await resolveAssetEligibility(
      capability && name === capabilityOwner ? { capability, requirements: [taskText],constraints:input.constraints } : { asset: name, requirements: [taskText],constraints:input.constraints },
    );
    eligibility.push({ asset: name, eligible: r.eligible === true, reasons: r.reason || [] });
  }
  const eligibleNames = eligibility.filter((e) => e.eligible).map((e) => e.asset);
  const ineligible = eligibility.filter((e) => !e.eligible);

  // (4) 七桶（SD-1：capability 模式 primary=[owner]（须在簇且合格，否则 fail-closed 无回退）；
  //     其余合格候选 = supporting（按 CLUSTERS phases 序，不得标 not selected）；legacy 模式无 primary）
  let primary = [];
  let selectionBlockedReasons = null;
  if (capability) {
    const ownerEntry = eligibility.find((e) => e.asset === capabilityOwner);
    if (!ownerEntry || !ownerEntry.eligible) {
      primary = [];
      selectionBlockedReasons = ownerEntry ? ownerEntry.reasons : ['capability owner 不在簇候选集'];
      warnings.push(`capability owner「${capabilityOwner}」资格未通过（fail-closed：不回退其它行，primary 为空，不产出 brief）`);
    } else {
      primary = [capabilityOwner];
    }
  }
  const supporting = orderCandidates(cluster, eligibleNames.filter((n) => !primary.includes(n)));
  const notSelected = ineligible.filter((e) => !primary.includes(e.asset));

  const routing = {
    cluster: cluster.id,
    capability,
    capability_source: capabilitySource,
    matched_keyword: matchedKeyword,
    cluster_candidates: candidates.slice(),
    capability_owner: capabilityOwner,
    eligible_assets: eligibleNames.slice(),
    ineligible_assets: ineligible.map((e) => ({ asset: e.asset, reasons: e.reasons })),
    primary_assets: primary.slice(),
    supporting_assets: supporting.slice(),
    not_selected_assets: notSelected.map((e) => ({ asset: e.asset, reasons: e.reasons })),
  };

  const manifestSha = (() => { try { return crypto.createHash('sha256').update(fs.readFileSync(ASSET_MANIFEST_V2_PATH)).digest('hex'); } catch { return null; } })();

  // (5) select 模式：零正文加载，止于路由+资格投影
  if (mode === 'select') {
    const packet = {
      schema: DECISION_PACKET_SCHEMA,
      authority: auth.block,
      workflow: { workflow_id: input.workflowId ?? null, journey_state_digest: null, journey_status: 'NOT_CONSULTED' },
      routing,
      owner: null,
      evidence: {
        refs: manifestSha ? [{ path: 'contracts/asset-manifest-v2.json', sha256: manifestSha }] : [],
        observed_at: new Date(now).toISOString(),
        freshness: {},
      },
    };
    if (selectionBlockedReasons) packet.routing.selection_blocked = { asset: capabilityOwner, reasons: selectionBlockedReasons };
    packet.owner = projectOwnerView(packet);
    return respond(true, null, packet, { authority_components: auth.componentCount, input_echo: { mode, capability: capability ?? null, step: input.step ?? null } }, warnings);
  }

  // (6) brief 模式：仅加载 primary 资产方法论（loading 失败 = envelope 错误；选择受阻 = data 降级）
  if (primary.length === 0) {
    const packet = {
      schema: DECISION_PACKET_SCHEMA,
      authority: auth.block,
      workflow: { workflow_id: input.workflowId ?? null, journey_state_digest: null, journey_status: 'NOT_CONSULTED' },
      routing,
      owner: null,
      evidence: {
        refs: manifestSha ? [{ path: 'contracts/asset-manifest-v2.json', sha256: manifestSha }] : [],
        observed_at: new Date(now).toISOString(),
        freshness: {},
      },
    };
    if (selectionBlockedReasons) packet.routing.selection_blocked = { asset: capabilityOwner, reasons: selectionBlockedReasons };
    else warnings.push('legacy 无 capability 模式无 primary 指称：brief 属 per-subtask 流（orchestrator 链）；本决策仅产出路由+资格投影');
    packet.owner = projectOwnerView(packet);
    return respond(true, null, packet, { authority_components: auth.componentCount, input_echo: { mode, capability: capability ?? null } }, warnings);
  }

  const target = primary[0];
  const subtaskId = typeof input.subtaskId === 'string' && input.subtaskId.trim() ? input.subtaskId.trim() : null;
  if (subtaskId !== null && !SUBTASK_ID_RE.test(subtaskId)) return fail('INPUT_INVALID', `subtask_id 非法: ${subtaskId}`);
  const subtask = {
    id: subtaskId ?? `${plan.id}-0`,
    task: taskText,
    contract: plan.contract,
    preconditions: plan.preconditions || [],
    requestedResources: Array.isArray(input.requestedResources) ? input.requestedResources : [],
  };

  const act = await activationPrepare({
    plan: { id: plan.id, task: taskText, cluster: plan.cluster },
    subtask,
    asset: target,
    activationLevel: level,
    requestedResources: input.requestedResources,
    budget,
    opts: { vendorDir, now, useCache: false, workspace: input.workspace },
  });
  if (!act.ok) return fail(act.code, (act.data && act.data.reason) || 'activation.prepare 失败', warnings);

  const pkg = act.data.activationPackage;
  const record = pkg.record;
  const briefText = renderBrief({...pkg.briefFrame,assetRoot:`vendor/${target}`});
  const briefSha256 = sha256Hex(briefText);
  // 自洽复验：渲染 brief 提取的 payload 段 sha 必须等于 activation 记录的 payloadSha256（T4 谓词 (b) 口径）
  const extracted = extractPayloadFromBrief(briefText);
  if (extracted === null || sha256Hex(extracted) !== pkg.payload.payloadSha256) {
    return fail('RECEIPT_HASH_MISMATCH', 'brief 渲染自洽复验失败：extractPayloadFromBrief ≠ payload.payloadSha256（fail-closed，不出包）', warnings);
  }

  const manifestRow = (manifest.entries || []).find((e) => e.name === target) || null;
  const v3 = v3Projection(repoRoot, target, manifestRow);
  const loadedSections = record.activationLevel === 'metadata' ? [] : [record.anchor, ...record.resources];

  const packet = {
    schema: DECISION_PACKET_SCHEMA,
    authority: auth.block,
    workflow: { workflow_id: input.workflowId ?? null, journey_state_digest: null, journey_status: 'NOT_CONSULTED' },
    routing,
    assets: [{
      methodology: describeMethodology(target,{repoRoot}),
      id: target,
      version: v3.version,
      lifecycle: v3.lifecycle,
      source_hash: record.sourceHash,
      payload_sha256: pkg.payload.payloadSha256,
      activation_level: record.activationLevel,
      loaded_sections: loadedSections,
      token_estimate: record.tokenEstimate,
    }],
    brief: { text: briefText, brief_sha256: briefSha256, activation_level: record.activationLevel, budget_result: record.budget },
    receipt_context: {
      subtask_id: subtask.id,
      plan_id: plan.id,
      asset_id: target,
      asset_version: v3.version,
      contract_hash: v3.contract_hash,
      source_hash: record.sourceHash,
      payload_sha256: pkg.payload.payloadSha256,
      brief_sha256: briefSha256,
    },
    owner: null,
    evidence: {
      refs: [
        { path: record.manifestPath, sha256: record.sourceHash },
        ...(manifestSha ? [{ path: 'contracts/asset-manifest-v2.json', sha256: manifestSha }] : []),
        ...(v3.lifecycle !== 'MANIFEST_V2_ONLY' ? [{ path: `${V3_DIR_REL}/${target}.contract-v3.yaml`, sha256: v3.contract_hash }] : []),
      ],
      observed_at: new Date(now).toISOString(),
      freshness: {},
    },
  };
  packet.owner = projectOwnerView(packet);

  // envelope evidence：供 CLI --record 的净化激活摘要（无绝对路径；packet 本体不含）
  const activationSummary = {
    subtaskId: subtask.id,
    planId: plan.id,
    assetId: target,
    assetType: record.assetType,
    sourceHash: record.sourceHash,
    payloadSha256: pkg.payload.payloadSha256,
    activationLevel: record.activationLevel,
    catalogCacheIdentity: (act.evidence && act.evidence.catalogCacheIdentity) || null,
    phaseEligibility: record.phaseEligibility,
    budget: record.budget,
    resources: record.resources,
    readCounts: record.readCounts,
    anchor: record.anchor,
  };
  return respond(true, null, packet, { authority_components: auth.componentCount, activation_summary: activationSummary, input_echo: { mode, capability: capability ?? null, step: input.step ?? null } }, warnings);
}

// ---------------------------------------------------------------------------
// validateConsumption（UC-4：只读链重放；只证 T3/T4；T5-T7 = DEFERRED_TO_C5）
// ---------------------------------------------------------------------------

const DEFERRED_STATES = [
  { state: 'T5 EXECUTED', status: 'DEFERRED_TO_C5' },
  { state: 'T6 APPLIED', status: 'DEFERRED_TO_C5' },
  { state: 'T7 VERIFIED', status: 'DEFERRED_TO_C5' },
];

function evidenceComplete(evt, keys) {
  if (!evt || !evt.evidence) return false;
  // 与 receipt.mjs isBlank 口径一致：undefined/null/'' 为缺；false 显式豁免；对象（如 budgetResult/phaseEligibility）合法
  return keys.every((k) => {
    const v = evt.evidence[k];
    return !(v === undefined || v === null || v === '') && v !== false;
  });
}

function boundedRefInside(workspace, subtaskId, ref) {
  const base = path.join(workspace, 'artifacts', subtaskId);
  const abs = path.resolve(base, path.basename(String(ref)));
  if (!abs.startsWith(base + path.sep)) return null;
  return abs;
}

/** Recheck host evidence without promoting task behavior to methodology use.
 * Frozen T3/T4 validation stays intact. These are additive observations in the
 * envelope evidence channel; T6 APPLIED still requires a methodology-specific
 * acceptance contract. A receipt label alone is not a current execution proof.
 */
function hostConsumptionEvidence(raw, workspace, subtaskId, loaded, repoRoot) {
  const observation = { executed: false, task_behavior_verified: false, methodology_application: 'UNVERIFIED', verification_scope: 'task_behavior' };
  if (!loaded) return observation;
  const t5 = raw.events.find(e => e.transition === 'execution_observed');
  if (!t5 || t5.evidence.executed !== true) return observation;
  const p2 = predicateP2(raw, path.join(repoRoot, 'vendor'));
  const p3 = predicateP3(raw, workspace);
  observation.executed = p2.pass && p3.pass;
  if (!observation.executed) return observation;
  const verified = raw.events.find(e => e.transition === 'behavior_verified');
  if (!verified) return observation;
  const refs = verified.evidence.evidenceRefs || [];
  const proofRef = refs.find(r => r && r.eventSeq === 5 && r.path === 'host-verification.json' && r.verification_scope === 'task_behavior');
  if (!proofRef || typeof proofRef.sha256 !== 'string') return observation;
  try {
    const proofBytes = fs.readFileSync(boundedRefInside(workspace, subtaskId, proofRef.path));
    if (crypto.createHash('sha256').update(proofBytes).digest('hex') !== proofRef.sha256) return observation;
    const proof = JSON.parse(proofBytes.toString('utf8'));
    if (proof.schema_version !== 1 || proof.subtask_id !== subtaskId || proof.asset_id !== t5.assetId
        || proof.source_hash !== t5.sourceHash || proof.artifact_path !== t5.evidence.artifactPath
        || proof.artifact_sha256 !== t5.evidence.artifactSha256 || proof.executed !== true
        || proof.execution?.exit_code !== 0 || proof.checker?.exit_code !== 0 || proof.checker?.pass !== true
        || proof.verification_scope !== 'task_behavior' || proof.methodology_application !== 'unverified'
        || proof.checker.output_path !== 'checker-output.json') return observation;
    const output = fs.readFileSync(boundedRefInside(workspace, subtaskId, proof.checker.output_path));
    if (crypto.createHash('sha256').update(output).digest('hex') !== proof.checker.output_sha256) return observation;
    const result = JSON.parse(output.toString('utf8'));
    if (result.pass !== true || result.artifact_sha256 !== proof.artifact_sha256 || !Array.isArray(result.checks)
        || result.checks.length === 0 || result.checks.some(c => !c || typeof c.name !== 'string' || !c.name.trim() || c.passed !== true)) return observation;
    observation.task_behavior_verified = predicateP4(raw, workspace).pass && predicateP5(raw, refs).pass;
  } catch { /* Missing or stale host/checker evidence cannot verify behavior. */ }
  return observation;
}

/**
 * validateConsumption(input)
 * input: { workspace(必填), subtaskId(必填), artifactRef?, evidenceRef?, workflowId?, now?, repoRoot? }
 * 输出 data.validation = { t3_selected, t4_loaded, bypass_flag, deferred, chain_state? }
 *   t3/t4 ∈ true | false | 'NO_RECEIPT_CHAIN' | 'PAYLOAD_HASH_MISMATCH'（data 通道判定词表）。
 * 凭证链损坏/被手改 ⇒ envelope RECEIPT_INVALID（fail-closed）。
 * 不检查最终答案质量、不据「看起来正确」推断消费（HOST_INTEGRATION_BYPASS 只看结构性凭证）。
 */
export async function validateConsumption(input = {}) {
  const warnings = [];
  const workspace = input.workspace;
  if (!workspace || typeof workspace !== 'string') return fail('INPUT_INVALID', 'workspace 缺失（内层受信参数）');
  const subtaskId = input.subtaskId;
  if (typeof subtaskId !== 'string' || !SUBTASK_ID_RE.test(subtaskId) || subtaskId.includes('..')) {
    return fail('INPUT_INVALID', `subtask_id 非法: ${JSON.stringify(subtaskId)}`);
  }
  const now = input.now ?? new Date();

  const auth = await buildAuthorityBlock({ repoRoot: input.repoRoot });
  if (auth.error) return auth.error;
  warnings.push(...auth.warnings);

  const refs = [];
  for (const [label, ref] of [['artifact_ref', input.artifactRef], ['evidence_ref', input.evidenceRef]]) {
    if (ref === undefined || ref === null || ref === '') continue;
    if (typeof ref !== 'string') return fail('INPUT_INVALID', `${label} 须为字符串`);
    const abs = boundedRefInside(workspace, subtaskId, ref);
    if (!abs) return fail('INPUT_INVALID', `${label} 越界: ${ref}`);
    refs.push({ path: `artifacts/${subtaskId}/${path.basename(ref)}`, sha256: fs.existsSync(abs) ? crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex') : null });
    if (!fs.existsSync(abs)) warnings.push(`${label} 文件不存在（如实登记 null，不阻断验证）: ${path.basename(ref)}`);
  }

  // P1 入口（C2-R1-3）：复用 receipt.verifyReceiptFile（schema/eventSeq/canonicalHash/result↔重放一致 单点）；
  // 缺失 ⇒ RECEIPT_INCOMPLETE 映射为 Decision data 态 NO_RECEIPT_CHAIN + HOST_INTEGRATION_BYPASS；
  // 无效 ⇒ RECEIPT_INVALID 原样传播；P1 通过后才做 Decision 专属 T3/T4 投影。
  const verdict = verifyReceiptFile(workspace, subtaskId);
  let validation;
  let hostConsumption = { executed: false, task_behavior_verified: false, methodology_application: 'UNVERIFIED', verification_scope: 'task_behavior' };
  if (!verdict.ok && verdict.code === 'RECEIPT_INCOMPLETE') {
    validation = { t3_selected: 'NO_RECEIPT_CHAIN', t4_loaded: 'NO_RECEIPT_CHAIN', bypass_flag: true, deferred: DEFERRED_STATES };
    warnings.push('NO_RECEIPT_CHAIN：无 artifacts/' + subtaskId + '/receipt.json ⇒ HOST_INTEGRATION_BYPASS（结构性判定，不看产出质量）');
  } else if (!verdict.ok) {
    return fail(verdict.code, (verdict.data && verdict.data.reason) || 'receipt P1 校验失败', warnings);
  } else {
    const raw = JSON.parse(fs.readFileSync(receiptPath(workspace, subtaskId), 'utf8'));
    const events = raw.events;
    const t1 = events[0];
    const t3evt = events.find((e) => e.transition === 'selected');
    const t4evt = events.find((e) => e.transition === 'instructions_delivered');

    let t3 = false;
    if (t3evt) t3 = evidenceComplete(t3evt, ['planId', 'subtaskId', 'sourceHash']) ? true : false;
    else warnings.push('链上无 selected 事件（t3=false）');

    let t4 = false;
    if (t4evt) {
      if (!evidenceComplete(t4evt, ['activationLevel', 'payloadSha256', 'briefPath', 'sourceHashEcho', 'budgetResult'])) {
        t4 = false; warnings.push('instructions_delivered 证据不全（t4=false）');
      } else if (!t1 || String(t4evt.evidence.sourceHashEcho).toLowerCase() !== String(t1.sourceHash).toLowerCase()) {
        return fail('RECEIPT_HASH_MISMATCH', 'T4 sourceHashEcho ≠ T1 sourceHash（' + String(t4evt.evidence.sourceHashEcho).slice(0, 12) + '… ≠ ' + String(t1 && t1.sourceHash).slice(0, 12) + '…；§7.3 谓词 (a)）', warnings);
      } else {
        const briefAbs = boundedRefInside(workspace, subtaskId, t4evt.evidence.briefPath) ?? path.join(workspace, 'artifacts', subtaskId, 'brief.md');
        if (!fs.existsSync(briefAbs)) { t4 = 'PAYLOAD_HASH_MISMATCH'; warnings.push('brief 文件缺失（payload 复验不可能）: ' + path.basename(String(t4evt.evidence.briefPath))); }
        else {
          const payload = extractPayloadFromBrief(fs.readFileSync(briefAbs, 'utf8'));
          if (payload === null) { t4 = 'PAYLOAD_HASH_MISMATCH'; warnings.push('brief 缺「方法论正文（资产全文）」段锚'); }
          else if (sha256Hex(payload) !== String(t4evt.evidence.payloadSha256).toLowerCase()) { t4 = 'PAYLOAD_HASH_MISMATCH'; warnings.push('payloadSha256 ≠ brief 段内 payload 实测哈希'); }
          else t4 = true;
        }
      }
    } else warnings.push('链上无 instructions_delivered 事件（t4=false）');

    validation = { t3_selected: t3, t4_loaded: t4, bypass_flag: false, deferred: DEFERRED_STATES, chain_state: verdict.data.state ?? null };
    hostConsumption = hostConsumptionEvidence(raw, workspace, subtaskId, t3 === true && t4 === true, input.repoRoot ?? DECISION_REPO_ROOT);
    refs.push({ path: `artifacts/${subtaskId}/receipt.json`, sha256: crypto.createHash('sha256').update(fs.readFileSync(receiptPath(workspace, subtaskId))).digest('hex') });
  }

  const packet = {
    schema: DECISION_PACKET_SCHEMA,
    authority: auth.block,
    workflow: { workflow_id: input.workflowId ?? null, journey_state_digest: null, journey_status: 'NOT_CONSULTED' },
    validation,
    owner: null,
    evidence: { refs, observed_at: new Date(now).toISOString(), freshness: {} },
  };
  packet.owner = projectOwnerView(packet);
  return respond(true, null, packet, { authority_components: auth.componentCount, host_consumption: hostConsumption, input_echo: { subtask_id: subtaskId } }, warnings);
}

export default { stageDecision, taskDecision, validateConsumption, buildAuthorityBlock, DECISION_PACKET_SCHEMA };
