import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { journeyRead, STEPS as JOURNEY_STEPS } from '../../scripts/lib/journey.mjs';
import { checkPhase, STATE as PHASE_STATE, TERMINAL_STATES } from '../../scripts/lib/phase.mjs';
import { readManifest } from '../../scripts/lib/asset.mjs';
import { buildManifest } from '../../scripts/lib/manifest.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MAX_PAGE_BYTES = 64_000;
const MAX_PAGE_SIZE = 100;
const MAX_SNAPSHOT_BYTES = 60_000;
const MAX_SNAPSHOT_INTERNAL_BYTES = 4_000_000;
const MAX_SOURCE_FILE_BYTES = 4_000_000;
const MAX_AUTHORITY_READ_BYTES = 4_000_000;
const MAX_SNAPSHOT_EVIDENCE_REFS = 2_000;
const MAX_ASSET_CATALOG_ENTRIES = 2_000;
const MAX_ASSET_SECTIONS = 500;
const MAX_ASSET_TOC_BYTES = 64_000;
const MAX_BRIDGE_RESPONSE_BYTES = 256_000;
const MAX_CURSOR_CHARS = 4_096;
const SNAPSHOT_EVIDENCE_PAGE_SIZE = 100;
const WORKFLOW_ID = /^[A-Za-z0-9_-]{1,80}$/;
const SESSION_ID = /^[A-Za-z0-9_-]{1,80}$/;
const CORE_FILES = [
  'SKILL.md',
  'scripts/lib/journey.mjs',
  'scripts/lib/phase.mjs',
  'scripts/lib/asset.mjs',
  'scripts/lib/manifest.mjs',
  'contracts/asset-manifest-v2.json',
];

class ReadError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ':' + canonical(value[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value);
}

function digest(value) {
  return sha256(Buffer.from(canonical(value), 'utf8'));
}

function fail(code, message) {
  throw new ReadError(code, message);
}

function readFileBounded(file, maxBytes = MAX_SOURCE_FILE_BYTES, limitCode = 'RESOURCE_LIMIT', allowedRoot = null) {
  const fd = fs.openSync(file, 'r');
  try {
    const before = fs.fstatSync(fd);
    if (!before.isFile()) fail('FILE_NOT_VISIBLE', 'A required source is not a regular file.');
    if (allowedRoot) {
      let real;
      let named;
      try {
        real = fs.realpathSync(file);
        named = fs.statSync(real);
      } catch {
        fail('FILE_NOT_VISIBLE', 'A required source is not visible under its trusted root.');
      }
      if (!within(allowedRoot, real) || named.dev !== before.dev || named.ino !== before.ino) {
        fail('WORKSPACE_NOT_AUTHORIZED', 'A required source changed identity or escaped its trusted root.');
      }
    }
    if (before.size > maxBytes) fail(limitCode, 'Source exceeds the configured read limit.');
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (count === 0) fail('SOURCE_CHANGED', 'Source changed while it was being read.');
      offset += count;
    }
    const after = fs.fstatSync(fd);
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) {
      fail('SOURCE_CHANGED', 'Source changed while it was being read.');
    }
    return bytes;
  } finally {
    fs.closeSync(fd);
  }
}

function readConfig() {
  if (process.env.YY_READONLY_ENABLED !== 'true') {
    fail('MCP_DISABLED', 'YY read-only service is disabled.');
  }
  const file = process.env.YY_READONLY_BINDINGS;
  if (!file) fail('CONFIGURATION_ERROR', 'Trusted workflow bindings are not configured.');
  let config;
  try {
    config = JSON.parse(readFileBounded(file, 256_000, 'CONFIGURATION_ERROR').toString('utf8'));
  } catch {
    fail('CONFIGURATION_ERROR', 'Trusted workflow bindings are unavailable or invalid.');
  }
  if (config?.schema !== 'yy/read-bindings@1' || !Array.isArray(config.workspaces)) {
    fail('CONFIGURATION_ERROR', 'Trusted workflow bindings do not match yy/read-bindings@1.');
  }
  return config;
}

function bindWorkflow(workflowId) {
  if (typeof workflowId !== 'string' || !WORKFLOW_ID.test(workflowId)) {
    fail('WORKFLOW_NOT_FOUND', 'Workflow is not bound.');
  }
  const config = readConfig();
  const matches = config.workspaces.filter((entry) => entry?.workflow_id === workflowId);
  if (matches.length !== 1) fail('WORKFLOW_NOT_FOUND', 'Workflow is not bound.');
  const binding = matches[0];
  if (binding.enabled !== true) fail('WORKSPACE_NOT_AUTHORIZED', 'Workflow access is disabled.');
  if (binding.session != null && (typeof binding.session !== 'string' || !SESSION_ID.test(binding.session))) {
    fail('CONFIGURATION_ERROR', 'Trusted workflow binding contains an invalid session.');
  }
  let root;
  try {
    root = fs.realpathSync(binding.workspace_root);
    if (!fs.statSync(root).isDirectory()) throw new Error('not directory');
  } catch {
    fail('WORKSPACE_NOT_AUTHORIZED', 'Workflow workspace is unavailable.');
  }
  if (root.toLowerCase() === REPO.toLowerCase()) {
    fail('WORKSPACE_NOT_AUTHORIZED', 'YY code root cannot be used as a business workspace.');
  }
  return { workflowId, workspace: root, session: binding.session ?? null };
}

function within(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

function safeRelativeFile(root, relative) {
  if (typeof relative !== 'string' || relative.includes('\0') || path.isAbsolute(relative)) {
    fail('FILE_NOT_VISIBLE', 'Evidence reference is outside the visible workspace.');
  }
  const normalized = relative.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    fail('FILE_NOT_VISIBLE', 'Evidence reference is outside the visible workspace.');
  }
  if (parts.some((part) => /[:<>"|?*]/.test(part))) {
    fail('FILE_NOT_VISIBLE', 'Evidence reference contains an invalid path component.');
  }
  if (parts.some((part, index) => part.startsWith('.') && !(index === 0 && part === '.tt-state'))) {
    fail('FILE_NOT_VISIBLE', 'Evidence reference is not visible.');
  }
  const allowedRoot = parts[0] === '.tt-state' || parts[0] === 'artifacts';
  if (!allowedRoot) fail('FILE_NOT_VISIBLE', 'Evidence reference is not visible.');
  const candidate = path.resolve(root, ...parts);
  let real;
  try {
    real = fs.realpathSync(candidate);
    const stat = fs.statSync(real);
    if (!stat.isFile()) throw new Error('not file');
  } catch (error) {
    if (error.code === 'ENOENT') fail('FILE_NOT_FOUND', 'Evidence file was not found.');
    fail('FILE_NOT_VISIBLE', 'Evidence file is not visible.');
  }
  if (!within(root, real)) fail('FILE_NOT_VISIBLE', 'Evidence reference is outside the visible workspace.');
  return real;
}

function sourceEntry(label, file, budget, allowedRoot) {
  try {
    const remaining = budget ? Math.max(0, MAX_SNAPSHOT_INTERNAL_BYTES - budget.bytes) : MAX_SOURCE_FILE_BYTES;
    const bytes = readFileBounded(file, Math.min(MAX_SOURCE_FILE_BYTES, remaining), 'RESOURCE_LIMIT', allowedRoot);
    if (budget && budget.bytes + bytes.length > MAX_SNAPSHOT_INTERNAL_BYTES) {
      fail('RESOURCE_LIMIT', 'Snapshot sources exceed the aggregate read limit.');
    }
    if (budget) budget.bytes += bytes.length;
    return { path: label, exists: true, bytes: bytes.length, sha256: sha256(bytes) };
  } catch (error) {
    if (error instanceof ReadError) throw error;
    if (error.code === 'ENOENT') return { path: label, exists: false, bytes: null, sha256: null };
    fail('FILE_NOT_VISIBLE', 'A required snapshot source is not readable.');
  }
}

function relativeWorkspace(workspace, label) {
  const p = String(label ?? '').replace(/\\/g, '/');
  if (!p || p.startsWith('input:') || path.isAbsolute(p) || p.includes(',')) return null;
  return p;
}

function stageGuideFiles() {
  const directory = path.join(REPO, 'commands');
  let names = [];
  try {
    names = fs.readdirSync(directory).filter((name) => /^yy-\d+-.+\.md$/.test(name)).sort();
  } catch {
    return [];
  }
  return names.map((name) => {
    const file = path.join(directory, name);
    try {
      const real = fs.realpathSync(file);
      if (!within(REPO, real) || !fs.statSync(real).isFile()) return null;
      const bytes = readFileBounded(real, 1_000_000, 'RESOURCE_LIMIT', REPO);
      return { file: real, rel: 'commands/' + name, bytes, text: bytes.toString('utf8') };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function stageGuide(step) {
  for (const source of stageGuideFiles()) {
    const frontmatter = source.text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (!frontmatter) continue;
    const journeyStep = frontmatter[1].match(/^journey-step:\s*([0-9.]+)\s*$/m);
    if (!journeyStep || Number(journeyStep[1]) !== step) continue;
    const body = source.text.slice(frontmatter[0].length);
    const goal = body.match(/^\*\*目标\*\*：(.+)$/m)?.[1]?.trim() ?? null;
    const humanGate = body.match(/^\*\*人工 gate 清单\*\*：(.+)$/m)?.[1]?.trim() ?? null;
    const output = body.match(/^\*\*产物路径\*\*：(.+)$/m)?.[1]?.trim() ?? null;
    const prereqValue = frontmatter[1].match(/^prereq-gates:\s*\[(.*?)\]\s*$/m)?.[1] ?? '';
    const prereqGates = prereqValue.split(',').map((item) => item.trim()).filter(Boolean);
    return {
      goal,
      human_gate: humanGate,
      output_path: output,
      prerequisite_gates: prereqGates,
      command_name: frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? null,
      source_version: { path: 'R/' + source.rel, bytes: source.bytes.length, sha256: sha256(source.bytes) },
    };
  }
  return null;
}

function evidenceReferences(shell) {
  const links = shell?.sources;
  if (!Array.isArray(links)) return [];
  const refs = [];
  for (const link of links) {
    const rel = relativeWorkspace(null, link?.path);
    if (!rel || !link?.sha256 || !['state', 'gates', 'receipts', 'logs'].includes(link?.sourceKind)) continue;
    const id = 'ev-' + sha256(Buffer.from([link.sourceKind, rel, link.sha256].join('\0'))).slice(0, 24);
    if (refs.length >= MAX_SNAPSHOT_EVIDENCE_REFS) {
      fail('RESOURCE_LIMIT', 'Workflow evidence reference count exceeds the safe limit.');
    }
    refs.push({
      evidence_ref: id,
      source_kind: link.sourceKind,
      path: rel,
      sha256: String(link.sha256),
      updated_at: link.updatedAt ?? null,
      inferred: link.inferred === true,
    });
  }
  return refs;
}

function stateFileFor(binding) {
  const sessionMode = process.env.YY_SESSION_MODE ?? process.env.TT_SESSION_MODE ?? 'legacy';
  if (sessionMode === 'namespaced' && binding.session) {
    return path.join(binding.workspace, '.tt-state', binding.session, 'state.json');
  }
  return path.join(binding.workspace, '.tt-state', 'state.json');
}

function assertAuthorityTreesSafe(binding) {
  const sessionMode = process.env.YY_SESSION_MODE ?? process.env.TT_SESSION_MODE ?? 'legacy';
  const roots = [
    path.join(binding.workspace, '.tt-state'),
    path.join(binding.workspace, 'artifacts'),
  ];
  if (sessionMode === 'namespaced' && binding.session) {
    roots.push(path.join(binding.workspace, '.tt-state', binding.session, 'artifacts'));
  }
  let visited = 0;
  let authorityBytes = 0;
  const coreReadNames = new Set(['state.json', 'journey.json', 'receipt.json', 'state-summary.json', 'result.txt']);
  const walk = (directory) => {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      fail('FILE_NOT_VISIBLE', 'A YY authority directory is not readable.');
    }
    for (const entry of entries) {
      visited += 1;
      if (visited > 20_000) fail('RESOURCE_LIMIT', 'YY authority tree exceeds the safe read limit.');
      const absolute = path.join(directory, entry.name);
      let stat;
      try {
        stat = fs.lstatSync(absolute);
      } catch {
        fail('FILE_NOT_VISIBLE', 'A YY authority entry changed while it was inspected.');
      }
      if (stat.isSymbolicLink()) fail('WORKSPACE_NOT_AUTHORIZED', 'YY authority tree contains a symbolic link.');
      let real;
      try {
        real = fs.realpathSync(absolute);
      } catch {
        fail('FILE_NOT_VISIBLE', 'A YY authority entry is not visible.');
      }
      if (!within(binding.workspace, real)) fail('WORKSPACE_NOT_AUTHORIZED', 'YY authority entry escapes its workspace.');
      if (stat.isFile() && coreReadNames.has(entry.name)) {
        if (stat.size > MAX_SOURCE_FILE_BYTES) fail('RESOURCE_LIMIT', 'A YY authority source exceeds the per-file read limit.');
        authorityBytes += stat.size;
        if (authorityBytes > MAX_AUTHORITY_READ_BYTES) fail('RESOURCE_LIMIT', 'YY authority sources exceed the aggregate read limit.');
      }
      if (stat.isDirectory()) walk(absolute);
    }
  };
  for (const root of new Set(roots)) {
    try {
      const stat = fs.lstatSync(root);
      if (stat.isSymbolicLink()) fail('WORKSPACE_NOT_AUTHORIZED', 'YY authority directory is a symbolic link.');
      if (stat.isDirectory()) walk(root);
      else fail('FILE_NOT_VISIBLE', 'YY authority path is not a directory.');
    } catch (error) {
      if (error instanceof ReadError) throw error;
      if (error.code !== 'ENOENT') fail('FILE_NOT_VISIBLE', 'A YY authority directory is not visible.');
    }
  }
}

function readPlanState(binding) {
  const file = stateFileFor(binding);
  try {
    const value = JSON.parse(readFileBounded(file, MAX_SOURCE_FILE_BYTES, 'RESOURCE_LIMIT', binding.workspace).toString('utf8'));
    if (
      !value || typeof value !== 'object' || Array.isArray(value) ||
      typeof value.id !== 'string' || !value.id ||
      !Object.values(PHASE_STATE).includes(value.status)
    ) return null;
    return value;
  } catch {
    return null;
  }
}

function readLegacyResearchGate(binding) {
  const rel = binding.session
    ? '.tt-state/' + binding.session + '/journey.json'
    : '.tt-state/journey.json';
  const file = path.join(binding.workspace, rel);
  try {
    const raw = readFileBounded(file, MAX_SOURCE_FILE_BYTES, 'RESOURCE_LIMIT', binding.workspace).toString('utf8');
    const parsed = JSON.parse(raw);
    const stage = Array.isArray(parsed?.steps) ? parsed.steps.find((row) => row?.step === 1.5) : null;
    if (!stage) return { status: 'UNKNOWN', gate: 'research-done', passed: false, source: rel, source_sha256: sha256(Buffer.from(raw)) };
    return {
      status: stage.status ?? 'unknown',
      gate: 'research-done',
      passed: Array.isArray(stage.gates_passed) && stage.gates_passed.includes('research-done'),
      source: rel,
      source_sha256: sha256(Buffer.from(raw)),
    };
  } catch {
    return { status: 'UNKNOWN', gate: 'research-done', passed: false, source: rel, source_sha256: null };
  }
}

function summarizeJourney(journey) {
  if (!journey) return null;
  const nextPrompt = journey.nextPrompt && typeof journey.nextPrompt === 'object'
    ? {
        actionHint: journey.nextPrompt.actionHint ?? null,
        targetNode: journey.nextPrompt.targetNode ?? null,
        requiredInputs: journey.nextPrompt.requiredInputs ?? [],
      }
    : null;
  return {
    schema: journey.schema ?? null,
    displayStatus: journey.displayStatus ?? 'UNKNOWN',
    displayReason: journey.displayReason ?? null,
    phase: journey.phase ?? null,
    phaseAuthoritative: journey.phaseAuthoritative ?? null,
    progress: journey.progress ?? null,
    current: journey.current ?? null,
    next: journey.next ?? null,
    gates: Array.isArray(journey.gates) ? journey.gates : [],
    steps: Array.isArray(journey.steps) ? journey.steps.map((step) => ({
      step: step.step,
      name: step.name,
      status: step.status,
      displayStatus: step.displayStatus ?? null,
      gate: step.gate ?? null,
      gates_passed: step.gates_passed ?? [],
    })) : [],
    nextPrompt,
  };
}

async function collectSnapshot(binding) {
  assertAuthorityTreesSafe(binding);
  const session = binding.session ?? undefined;
  const journeyResult = journeyRead({
    workspace: binding.workspace,
    session,
    mode: 'full',
    opts: { now: new Date() },
  });
  if (!journeyResult || typeof journeyResult !== 'object') {
    fail('SNAPSHOT_INCONSISTENT', 'YY journey projection returned an invalid result.');
  }
  const journey = journeyResult.data?.journey ?? null;
  const phaseChecks = await Promise.all(JOURNEY_STEPS.map(async (stage) => {
    const result = await checkPhase({
      workspace: binding.workspace,
      session,
      target: stage.step,
      opts: { now: new Date(), env: process.env },
    });
    return {
      step: stage.step,
      ok: result.ok === true,
      code: result.code ?? null,
      allowed: result.data?.allowed === true,
      reason: result.data?.reason ?? null,
      missing: result.data?.missing ?? [],
      state_version: result.evidence?.stateVersionEcho ?? null,
      state_digest: result.evidence?.snapshot ?? null,
      gate_mode: result.evidence?.gateMode ?? null,
      session_mode: result.evidence?.sessionMode ?? null,
    };
  }));

  const refs = evidenceReferences(journeyResult.evidence);
  const sourceMap = new Map();
  const sourceBudget = { bytes: 0 };
  const add = (label, file, allowedRoot) => {
    if (!sourceMap.has(label)) sourceMap.set(label, sourceEntry(label, file, sourceBudget, allowedRoot));
  };
  for (const rel of CORE_FILES) add('R/' + rel, path.join(REPO, rel), REPO);
  for (const guide of stageGuideFiles()) add('R/' + guide.rel, guide.file, REPO);

  const stateRel = path.relative(binding.workspace, stateFileFor(binding)).replace(/\\/g, '/');
  const journeyRel = binding.session
    ? '.tt-state/' + binding.session + '/journey.json'
    : '.tt-state/journey.json';
  for (const rel of new Set([stateRel, journeyRel])) {
    add('W/' + rel, path.resolve(binding.workspace, rel), binding.workspace);
  }
  for (const ref of refs) {
    const file = safeRelativeFile(binding.workspace, ref.path);
    const label = 'W/' + ref.path;
    const item = sourceMap.get(label) ?? sourceEntry(label, file, sourceBudget, binding.workspace);
    if (item.sha256 !== ref.sha256) fail('SOURCE_CHANGED', 'A referenced YY source changed during snapshot creation.');
    sourceMap.set(item.path, item);
  }

  const sourceVersion = [...sourceMap.values()].sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const sourceDigest = digest(sourceVersion);
  const plan = readPlanState(binding);
  const researchGate = readLegacyResearchGate(binding);
  const unsupportedState = phaseChecks.some((check) => check.code === 'STATE_VERSION_UNSUPPORTED');
  const terminal = TERMINAL_STATES.includes(plan?.status);
  const lifecycle = unsupportedState || !plan ? 'UNKNOWN' : (terminal ? 'TERMINAL' : 'OPEN');
  const steps = Array.isArray(journey?.steps) ? journey.steps : [];
  const stableJourney = summarizeJourney(journey);
  const hardGates = JOURNEY_STEPS.filter((step) => step.gate).map((step) => {
    const row = steps.find((candidate) => candidate?.step === step.step);
    return {
      step: step.step,
      gate: step.gate,
      passed: Array.isArray(row?.gates_passed) && row.gates_passed.includes(step.gate),
      status: row?.status ?? 'unknown',
    };
  });
  const blockers = phaseChecks
    .filter((check) => !check.allowed)
    .map((check) => ({ step: check.step, code: check.code ?? 'PHASE_PREREQ_UNMET', reason: check.reason, missing: check.missing }));
  if (journeyResult.ok !== true || journey?.displayStatus === 'ERROR' || journey?.displayStatus === 'STALE') {
    blockers.unshift({ code: journeyResult.code ?? 'JOURNEY_PROJECTION_DEGRADED', reason: journey?.displayStatus ?? journeyResult.code ?? 'Projection degraded' });
  }
  const payload = {
    schema: 'yy/web-readonly@1',
    workflow_id: binding.workflowId,
    lifecycle,
    plan_id: typeof plan?.id === 'string' ? plan.id : null,
    plan_status: typeof plan?.status === 'string' ? plan.status : null,
    research_gate: researchGate,
    journey: stableJourney,
    phase_checks: phaseChecks,
    hard_gates: hardGates,
    blockers,
    allowed_next_actions: [],
    allowed_next_actions_status: 'UNKNOWN_NO_CANONICAL_ACTION_AUTHORITY',
    evidence_refs: refs,
    source_version: sourceVersion,
    source_digest: sourceDigest,
  };
  const payloadDigest = digest(payload);
  if (Buffer.byteLength(canonical(payload), 'utf8') > MAX_SNAPSHOT_INTERNAL_BYTES) {
    fail('CORE_CONTEXT_TOO_LARGE', 'Workflow snapshot exceeds the safe source/reference limit.');
  }
  const snapshotId = sha256(Buffer.from(['yy/snapshot@1', binding.workflowId, sourceDigest, payloadDigest].join('\n')));
  return {
    ...payload,
    snapshot_id: snapshotId,
    payload_digest: payloadDigest,
    observed_at: new Date().toISOString(),
  };
}

function pageSnapshot(snapshot, cursorValue) {
  const cursor = parseCursor(cursorValue);
  let offset = 0;
  if (cursor) {
    if (
      cursor.workflow_id !== snapshot.workflow_id ||
      cursor.snapshot_id !== snapshot.snapshot_id ||
      cursor.source_digest !== snapshot.source_digest
    ) {
      fail('STALE_VERSION', 'Snapshot cursor does not match the current workflow version.');
    }
    offset = cursor.evidence_offset;
    if (!Number.isInteger(offset) || offset < 0 || offset > snapshot.evidence_refs.length) {
      fail('STALE_VERSION', 'Snapshot evidence cursor is invalid.');
    }
  }
  const evidenceRefs = snapshot.evidence_refs.slice(offset, offset + SNAPSHOT_EVIDENCE_PAGE_SIZE);
  const nextOffset = offset + evidenceRefs.length;
  const nextCursor = nextOffset >= snapshot.evidence_refs.length ? null : makeCursor({
    workflow_id: snapshot.workflow_id,
    snapshot_id: snapshot.snapshot_id,
    source_digest: snapshot.source_digest,
    evidence_offset: nextOffset,
  });
  const page = {
    ...snapshot,
    evidence_refs: evidenceRefs,
    complete: nextCursor === null,
    evidence_refs_complete: nextCursor === null,
    next_cursor: nextCursor,
    omitted_sections: nextCursor ? ['remaining_evidence_refs'] : [],
  };
  const pageBytes = Buffer.byteLength(JSON.stringify(page), 'utf8');
  if (pageBytes > MAX_SNAPSHOT_BYTES) {
    fail('CORE_CONTEXT_TOO_LARGE', 'Snapshot page exceeds the safe response budget.');
  }
  return page;
}

async function stableSnapshot(binding) {
  const first = await collectSnapshot(binding);
  const second = await collectSnapshot(binding);
  if (first.source_digest !== second.source_digest) {
    fail('SOURCE_CHANGED', 'YY authority sources changed while the snapshot was being read.');
  }
  if (first.payload_digest !== second.payload_digest) {
    fail('SNAPSHOT_INCONSISTENT', 'YY authority sources changed while the snapshot was being read.');
  }
  return second;
}

async function assetCatalog() {
  let governance;
  try {
    governance = await readManifest(path.join(REPO, 'contracts', 'asset-manifest-v2.json'));
  } catch {
    fail('ASSET_MANIFEST_INVALID', 'YY governance asset manifest is unavailable or invalid.');
  }
  let runtime;
  let files;
  try {
    runtime = await buildManifest({ vendorDir: path.join(REPO, 'vendor') });
    files = await assetFilesById();
  } catch {
    fail('ASSET_DISCOVERY_FAILED', 'YY runtime asset discovery failed.');
  }
  const byId = new Map(governance.map((row) => [row.id, row]));
  const rows = new Map();
  for (const entry of runtime.entries) {
    const id = entry.name;
    const row = byId.get(id);
    const file = files.get(id) ?? null;
    const card = {
      asset_id: id,
      version: entry.version ?? 'unknown',
      kind: entry.type,
      capability: row?.capability ?? entry.description ?? null,
      when_to_use: row?.when_to_use ?? null,
      when_not_to_use: row?.when_not_to_use ?? null,
      required_inputs: row?.required_inputs ?? null,
      definition_available: Boolean(file),
      allowed_here: 'UNKNOWN',
      executor_available: 'UNKNOWN',
      verified_for_target: 'UNKNOWN',
      blocked_reason: [],
      read_ref: file ? id : null,
      evidence_requirements: row?.verification ?? null,
      source: row?.source ?? null,
      _file: file,
    };
    if (!row) card.blocked_reason.push('NOT_IN_GOVERNANCE_MANIFEST');
    if (!file) card.blocked_reason.push('DEFINITION_MISSING');
    card.blocked_reason.push('TASK_STAGE_ELIGIBILITY_UNPROVEN');
    card.blocked_reason.push('EXECUTOR_AVAILABILITY_UNPROVEN');
    card.blocked_reason.push('TARGET_VERIFICATION_UNPROVEN');
    rows.set(id, card);
  }
  for (const row of governance) {
    if (!rows.has(row.id)) {
      rows.set(row.id, {
        asset_id: row.id,
        version: 'unknown',
        kind: 'unknown',
        capability: row.capability,
        when_to_use: row.when_to_use,
        when_not_to_use: row.when_not_to_use,
        required_inputs: row.required_inputs ?? null,
        definition_available: false,
        allowed_here: 'UNKNOWN',
        executor_available: 'UNKNOWN',
        verified_for_target: 'UNKNOWN',
        blocked_reason: ['DEFINITION_NOT_DISCOVERED', 'EXECUTOR_AVAILABILITY_UNPROVEN', 'TARGET_VERIFICATION_UNPROVEN'],
        read_ref: null,
        evidence_requirements: row.verification,
        source: row.source,
        _file: null,
      });
    }
  }
  const cards = [...rows.values()].sort((a, b) => a.asset_id.localeCompare(b.asset_id, 'en'));
  if (cards.length > MAX_ASSET_CATALOG_ENTRIES) {
    fail('RESOURCE_LIMIT', 'YY asset catalog exceeds the configured entry limit.');
  }
  for (const card of cards) delete card._file;
  return cards;
}

async function assetFilesById() {
  const manifest = await buildManifest({ vendorDir: path.join(REPO, 'vendor') });
  const files = new Map();
  for (const entry of manifest.entries) {
    const base = path.resolve(REPO, entry.path);
    const primary = path.join(base, entry.type === 'skill' ? 'SKILL.md' : entry.name + '.md');
    const alternate = path.join(base, entry.name + '.md');
    const file = fs.existsSync(primary) ? primary : (fs.existsSync(alternate) ? alternate : null);
    if (file && within(REPO, fs.realpathSync(file))) files.set(entry.name, file);
  }
  return files;
}

function makeCursor(data) {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
}

function parseCursor(value) {
  if (!value) return null;
  if (typeof value !== 'string' || value.length > MAX_CURSOR_CHARS) {
    fail('STALE_VERSION', 'Pagination cursor is invalid or expired.');
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
    return parsed;
  } catch {
    fail('STALE_VERSION', 'Pagination cursor is invalid or expired.');
  }
}

function validateMaxBytes(input) {
  const value = input ?? 12_000;
  if (!Number.isInteger(value) || value < 64 || value > MAX_PAGE_BYTES) {
    fail('BUDGET_EXHAUSTED', 'max_bytes must be between 64 and 64000.');
  }
  return value;
}

function utf8Page(text, offset, maxBytes) {
  const chars = Array.from(text);
  if (!Number.isInteger(offset) || offset < 0 || offset > chars.length) {
    fail('STALE_VERSION', 'Pagination offset is invalid.');
  }
  let bytes = 0;
  let end = offset;
  while (end < chars.length) {
    const size = Buffer.byteLength(chars[end], 'utf8');
    if (bytes + size > maxBytes) break;
    bytes += size;
    end += 1;
  }
  if (end === offset && offset < chars.length) {
    fail('BUDGET_EXHAUSTED', 'Page budget is too small for the next Unicode code point.');
  }
  return { content: chars.slice(offset, end).join(''), start: offset, end, bytes, complete: end === chars.length };
}

function parseAssetSections(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let current = { id: '__intro__', title: 'Introduction', lines: [] };
  let ordinal = 0;
  const flush = () => {
    if (current.lines.length || current.id !== '__intro__') {
      const body = current.lines.join('\n');
      // No authoritative section-criticality metadata exists yet. Protect every
      // section until governance can distinguish noncritical content explicitly.
      sections.push({ id: current.id, title: current.title, content: body, critical: true, criticality: 'UNVERIFIED_PROTECTED', bytes: Buffer.byteLength(body, 'utf8') });
    }
  };
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (match) {
      flush();
      ordinal += 1;
      current = { id: 's' + ordinal + '-' + sha256(Buffer.from(match[2])).slice(0, 8), title: match[2], lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  flush();
  return sections;
}

async function readAsset(binding, args) {
  if (typeof args.read_ref !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(args.read_ref)) {
    fail('ASSET_NOT_FOUND', 'Asset reference is invalid.');
  }
  const file = (await assetFilesById()).get(args.read_ref);
  if (!file) fail('ASSET_NOT_FOUND', 'Asset definition is unavailable.');
  const maxBytes = validateMaxBytes(args.max_bytes);
  const bytes = readFileBounded(file, MAX_SOURCE_FILE_BYTES, 'CORE_CONTEXT_TOO_LARGE', REPO);
  const sourceHash = sha256(bytes);
  const text = bytes.toString('utf8');
  const sections = parseAssetSections(text);
  if (sections.length > MAX_ASSET_SECTIONS) fail('RESOURCE_LIMIT', 'Asset table of contents exceeds the configured section limit.');
  const cursor = parseCursor(args.cursor);
  if (cursor && (!Number.isInteger(cursor.offset) || cursor.offset < 0)) {
    fail('STALE_VERSION', 'Asset pagination offset is invalid.');
  }
  if (!args.section_id && !cursor) {
    const response = {
      ok: true,
      code: null,
      data: {
        asset_id: args.read_ref,
        sections: sections.map(({ id, title, critical, criticality, bytes: sectionBytes }) => ({ section_id: id, title, critical, criticality, bytes: sectionBytes })),
        complete: false,
        toc_complete: true,
        content_complete: false,
        omitted_sections: sections.map((section) => section.id),
        content: '',
        next_cursor: null,
        source_version: { path: path.relative(REPO, file).replace(/\\/g, '/'), bytes: bytes.length, sha256: sourceHash },
      },
      evidence: { token_count: null, tokenizer_status: 'UNAVAILABLE', utf8_bytes: 0 },
      warnings: ['TOC_ONLY: request a section_id to read asset content.'],
    };
    if (Buffer.byteLength(JSON.stringify(response), 'utf8') > MAX_ASSET_TOC_BYTES) {
      fail('CORE_CONTEXT_TOO_LARGE', 'Asset table of contents exceeds the safe response budget.');
    }
    return response;
  }
  const sectionId = args.section_id ?? cursor?.section_id;
  const section = sections.find((entry) => entry.id === sectionId);
  if (!section) fail('SECTION_NOT_FOUND', 'Asset section is not available.');
  if (cursor && (
    cursor.workflow_id !== binding.workflowId ||
    cursor.asset_id !== args.read_ref ||
    cursor.section_id !== section.id ||
    cursor.sha256 !== sourceHash
  )) {
    fail(cursor.sha256 !== sourceHash ? 'SOURCE_CHANGED' : 'STALE_VERSION', 'Asset cursor does not match the current source version.');
  }
  const sectionLength = Array.from(section.content).length;
  if (cursor && (!Number.isInteger(cursor.offset) || cursor.offset < 0 || cursor.offset > sectionLength)) {
    fail('STALE_VERSION', 'Asset pagination offset is invalid.');
  }
  if (section.critical) {
    if (cursor && cursor.offset !== 0) fail('STALE_VERSION', 'Critical asset sections do not support pagination.');
    if (Buffer.byteLength(section.content, 'utf8') > maxBytes) {
      fail('CORE_CONTEXT_TOO_LARGE', 'Critical asset section does not fit; request a larger page budget or a smaller section.');
    }
    return {
      ok: true, code: null,
      data: { asset_id: args.read_ref, section_id: section.id, content: section.content, complete: true, toc_complete: false, content_complete: true, omitted_sections: [], next_cursor: null, source_version: { path: path.relative(REPO, file).replace(/\\/g, '/'), bytes: bytes.length, sha256: sourceHash } },
      evidence: { token_count: null, tokenizer_status: 'UNAVAILABLE', utf8_bytes: Buffer.byteLength(section.content, 'utf8') },
      warnings: [],
    };
  }
  const offset = cursor?.offset ?? 0;
  const page = utf8Page(section.content, offset, maxBytes);
  const nextCursor = page.complete ? null : makeCursor({ workflow_id: binding.workflowId, asset_id: args.read_ref, section_id: section.id, sha256: sourceHash, offset: page.end });
  return {
    ok: true, code: null,
    data: { asset_id: args.read_ref, section_id: section.id, content: page.content, complete: page.complete, omitted_sections: page.complete ? [] : [section.id], next_cursor: nextCursor, source_version: { path: path.relative(REPO, file).replace(/\\/g, '/'), bytes: bytes.length, sha256: sourceHash }, range: { start_codepoint: page.start, end_codepoint: page.end } },
    evidence: { token_count: null, tokenizer_status: 'UNAVAILABLE', utf8_bytes: page.bytes },
    warnings: [],
  };
}

async function readEvidence(binding, args) {
  if (typeof args.evidence_ref !== 'string' || typeof args.snapshot_id !== 'string') {
    fail('EVIDENCE_REF_INVALID', 'Evidence reference and snapshot ID are required.');
  }
  const maxBytes = validateMaxBytes(args.max_bytes);
  const snapshot = await stableSnapshot(binding);
  if (snapshot.snapshot_id !== args.snapshot_id) fail('STALE_VERSION', 'Evidence snapshot is stale; open the workflow again.');
  const ref = snapshot.evidence_refs.find((entry) => entry.evidence_ref === args.evidence_ref);
  if (!ref) fail('FILE_NOT_VISIBLE', 'Evidence reference is not visible in this workflow snapshot.');
  const file = safeRelativeFile(binding.workspace, ref.path);
  const bytes = readFileBounded(file, MAX_SOURCE_FILE_BYTES, 'RESOURCE_LIMIT', binding.workspace);
  const currentHash = sha256(bytes);
  if (currentHash !== ref.sha256) fail('SOURCE_CHANGED', 'Evidence source changed after the snapshot.');
  const text = bytes.toString('utf8');
  const cursor = parseCursor(args.cursor);
  if (cursor && (
    cursor.workflow_id !== binding.workflowId ||
    cursor.snapshot_id !== snapshot.snapshot_id ||
    cursor.evidence_ref !== ref.evidence_ref ||
    cursor.sha256 !== currentHash
  )) {
    fail(cursor.sha256 !== currentHash ? 'SOURCE_CHANGED' : 'STALE_VERSION', 'Evidence cursor does not match this snapshot.');
  }
  const page = utf8Page(text, cursor?.offset ?? 0, maxBytes);
  const nextCursor = page.complete ? null : makeCursor({
    workflow_id: binding.workflowId,
    snapshot_id: snapshot.snapshot_id,
    evidence_ref: ref.evidence_ref,
    sha256: currentHash,
    offset: page.end,
  });
  return {
    ok: true, code: null,
    data: {
      evidence_ref: ref.evidence_ref,
      source_kind: ref.source_kind,
      inferred: ref.inferred,
      content: page.content,
      complete: page.complete,
      omitted_sections: page.complete ? [] : ['remaining_content'],
      next_cursor: nextCursor,
      source_version: { path: ref.path, bytes: bytes.length, sha256: currentHash },
      range: { start_codepoint: page.start, end_codepoint: page.end },
    },
    evidence: { snapshot_id: snapshot.snapshot_id, source_digest: snapshot.source_digest, token_count: null, tokenizer_status: 'UNAVAILABLE', utf8_bytes: page.bytes },
    warnings: [],
  };
}

async function dispatch(operation, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) fail('INPUT_INVALID', 'Request arguments must be an object.');
  const binding = bindWorkflow(args.workflow_id);
  if (operation === 'open_workflow' || operation === 'get_snapshot') {
    const snapshot = await stableSnapshot(binding);
    if (args.snapshot_id && args.snapshot_id !== snapshot.snapshot_id) fail('STALE_VERSION', 'Requested snapshot is no longer current.');
    const page = pageSnapshot(snapshot, operation === 'get_snapshot' ? args.cursor : null);
    return { ok: true, code: null, data: page, evidence: { snapshot_id: snapshot.snapshot_id, source_digest: snapshot.source_digest, payload_digest: snapshot.payload_digest, utf8_bytes: Buffer.byteLength(JSON.stringify(page), 'utf8'), token_count: null, tokenizer_status: 'UNAVAILABLE' }, warnings: [] };
  }
  if (operation === 'get_stage') {
    const snapshot = await stableSnapshot(binding);
    const step = args.step == null ? null : args.step;
    if (step === 1.5 || (step == null && snapshot.research_gate.status === 'in_progress')) {
      return {
        ok: true, code: null,
        data: {
          step: 1.5,
          kind: 'legacy_research_gate',
          name: '研究门',
          gate: 'research-done',
          status: snapshot.research_gate.status,
          passed: snapshot.research_gate.passed,
          goal: null,
          prerequisites: null,
          exit_conditions: null,
          phase_check: null,
          source_status: 'LEGACY_RESEARCH_GATE; not part of the canonical integer 0–8 phase model',
          snapshot_id: snapshot.snapshot_id,
        },
        evidence: { source: snapshot.research_gate.source, source_sha256: snapshot.research_gate.source_sha256, source_digest: snapshot.source_digest },
        warnings: ['This is a separately reported legacy research gate, not a core YY journey step.'],
      };
    }
    if (step !== null && (!Number.isInteger(step) || !JOURNEY_STEPS.some((row) => row.step === step))) {
      fail('INVALID_STEP', 'Requested step is not in the YY core journey 0–8.');
    }
    const current = step == null
      ? snapshot.journey?.current?.step ?? snapshot.journey?.steps?.find((row) => row.status === 'in_progress')?.step ?? null
      : step;
    const definition = JOURNEY_STEPS.find((row) => row.step === current);
    if (!definition) fail('STAGE_UNKNOWN', 'No canonical current stage is available.');
    const check = snapshot.phase_checks.find((row) => row.step === current) ?? null;
    const guide = stageGuide(current);
    if (guide) {
      const pinned = snapshot.source_version.find((source) => source.path === guide.source_version.path);
      if (!pinned || pinned.sha256 !== guide.source_version.sha256) {
        fail('SOURCE_CHANGED', 'Stage guidance changed after the workflow snapshot.');
      }
    }
    return {
      ok: true, code: null,
      data: {
        step: definition.step,
        name: definition.name,
        goal: guide?.goal ?? null,
        prerequisites: {
          declared_gates: guide?.prerequisite_gates ?? null,
          currently_missing: check?.missing ?? [],
        },
        exit_conditions: null,
        owner_gate: definition.gate ?? guide?.human_gate ?? null,
        phase_check: check,
        evidence_requirements: null,
        artifact_outputs: guide?.output_path ? [guide.output_path] : [],
        recommended_assets: [],
        command_name: guide?.command_name ?? null,
        command_source: guide?.source_version ?? null,
        source_status: guide ? 'CANONICAL_STEP_AND_HASHED_COMMAND_GUIDE' : 'CANONICAL_STEP_ONLY; no stage command guide is defined',
        snapshot_id: snapshot.snapshot_id,
      },
      evidence: { source_digest: snapshot.source_digest },
      warnings: guide
        ? ['Exit criteria are not machine-readable in the existing stage command guide; not inferred.']
        : ['No command guide is defined for this core rerun stage; goal/exit criteria are not inferred.'],
    };
  }
  if (operation === 'list_assets') {
    const cards = await assetCatalog();
    const catalogDigest = digest(cards);
    const cursor = parseCursor(args.cursor);
    if (cursor && (cursor.workflow_id !== binding.workflowId || cursor.catalog_digest !== catalogDigest)) {
      fail('STALE_VERSION', 'Asset catalog cursor is stale.');
    }
    const pageSize = args.page_size ?? 20;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      fail('INPUT_INVALID', 'page_size must be between 1 and 100.');
    }
    const offset = cursor?.offset ?? 0;
    if (!Number.isInteger(offset) || offset < 0 || offset > cards.length) {
      fail('STALE_VERSION', 'Asset catalog cursor offset is invalid.');
    }
    const page = cards.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;
    const nextCursor = nextOffset >= cards.length ? null : makeCursor({ workflow_id: binding.workflowId, catalog_digest: catalogDigest, offset: nextOffset });
    return { ok: true, code: null, data: { assets: page, complete: nextCursor === null, omitted_sections: nextCursor ? ['remaining_assets'] : [], next_cursor: nextCursor, catalog_digest: catalogDigest }, evidence: { source_path: 'R/contracts/asset-manifest-v2.json', asset_count: cards.length, token_count: null, tokenizer_status: 'UNAVAILABLE' }, warnings: [] };
  }
  if (operation === 'read_asset') return readAsset(binding, args);
  if (operation === 'read_evidence') return readEvidence(binding, args);
  fail('OPERATION_NOT_ALLOWED', 'Operation is not in the six-tool M1 allowlist.');
}

function readStdinBounded() {
  const chunks = [];
  let total = 0;
  const chunk = Buffer.alloc(8_192);
  while (true) {
    const count = fs.readSync(0, chunk, 0, chunk.length, null);
    if (count === 0) break;
    total += count;
    if (total > 65_536) fail('INPUT_TOO_LARGE', 'Read-only request exceeds the configured input limit.');
    chunks.push(Buffer.from(chunk.subarray(0, count)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function emitResponse(value) {
  let serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BRIDGE_RESPONSE_BYTES) {
    serialized = JSON.stringify({ ok: false, code: 'CORE_CONTEXT_TOO_LARGE', data: {}, evidence: {}, warnings: ['Bridge response exceeds the configured byte limit.'] });
    process.exitCode = 1;
  }
  process.stdout.write(serialized);
}

let request;
try {
  request = JSON.parse(readStdinBounded());
  const result = await dispatch(request.operation, request.arguments);
  emitResponse(result);
} catch (error) {
  if (process.env.YY_READONLY_DEBUG === 'true') process.stderr.write(String(error?.stack ?? error));
  const code = error instanceof ReadError ? error.code : 'READ_FAILED';
  const message = error instanceof ReadError ? error.message : 'YY read-only request failed.';
  emitResponse({ ok: false, code, data: {}, evidence: {}, warnings: [message] });
  process.exitCode = 1;
}
