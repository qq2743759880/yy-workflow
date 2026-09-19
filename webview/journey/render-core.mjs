/**
 * R5b render-core: pure view-model functions for the Journey Control Room webview page.
 * Frozen contract: contracts/C-R5-ui.md v2 (fe3a83e6…). Data source: window.__YY_JOURNEY__
 * (host-injected global, OQ-U-17=a) = { read: shell, project: shell, injectedAt, sessionId }.
 * Consumes ONLY journey.read / journey.project unified shells {ok, code, data, evidence, warnings}.
 * No backend ops added; no error codes added; page never writes state/receipts/disk (frozen §3.2).
 */
export const DISPLAY_STATES = ['AUTHORIZED', 'OBSERVED', 'INFERRED', 'STALE', 'PARTIAL', 'ERROR'];
/** Never rendered as success (frozen §6 invariant; C-R5-journey OQ-R5-8). */
export const NEGATIVE_STATES = ['FAILED', 'SKIPPED', 'UNRESOLVED'];
/** Worst-state rank for group rollup (higher = worse). */
const WORST_RANK = {
  FAILED: 9, UNRESOLVED: 8, SKIPPED: 7, ERROR: 6, STALE: 5,
  PARTIAL: 4, INFERRED: 3, OBSERVED: 2, AUTHORIZED: 1, DONE: 1,
};
function rankOf(s) { return WORST_RANK[s] != null ? WORST_RANK[s] : 0; }

/** OQ-U-20=a: bridge missing/malformed => full degraded overlay, never fake data. */
export function detectBridge(payload) {
  if (payload == null || typeof payload !== 'object') return { degraded: true, reason: 'bridge payload 缺失（window.__YY_JOURNEY__ 未注入）' };
  if (!payload.read || typeof payload.read !== 'object') return { degraded: true, reason: 'read 统一壳缺失（宿主未注入 journey.read 输出）' };
  if (typeof payload.read.ok !== 'boolean') return { degraded: true, reason: 'read 壳非法（缺 ok 布尔，非统一壳）' };
  return { degraded: false, reason: null };
}

/** C-R5-journey §8.1: JOURNEY_NOT_FOUND arrives via data channel (ok=false + code + data diag), not an overlay. */
export function isJourneyNotFound(readShell) {
  return !!(readShell && readShell.ok === false && readShell.code === 'JOURNEY_NOT_FOUND');
}

/** §6: success means projection healthy; completion is separate text (progress.allDone). */
export function isNegativeDisplay(displayStatus, status) {
  return NEGATIVE_STATES.includes(displayStatus) || status === 'failed' || status === 'skipped';
}

/** Group worst-state rollup (OQ-R5-8): never upgrades a member; FAILED beats everything. */
export function rollupGroupWorst(members) {
  if (!Array.isArray(members) || members.length === 0) return null;
  let worst = members[0];
  for (const m of members) if (rankOf(m) > rankOf(worst)) worst = m;
  return worst;
}

/** Normalize one step row for rendering. */
export function mapStep(step) {
  if (!step || typeof step !== 'object') return { step: null, name: null, display: 'ERROR', done: false, negative: false, gate: null, blockerReason: 'step 行畸形' };
  const display = step.displayStatus || (step.status === 'done' ? 'AUTHORIZED' : (step.status === 'in_progress' ? 'OBSERVED' : 'PARTIAL'));
  return {
    step: step.step,
    name: step.name || null,
    gate: step.gate || null,
    display,
    status: step.status || null,
    done: step.status === 'done' && !isNegativeDisplay(display, step.status),
    negative: isNegativeDisplay(display, step.status),
    blockerReason: step.blockerReason || null,
    evidence: Array.isArray(step.evidence) ? step.evidence : [],
  };
}

/** Normalize nextPrompt with snapshot-hash echo; copy = snapshot reference (recompute=false). */
export function nextPromptView(np) {
  if (!np || typeof np !== 'object') return null;
  return {
    actionHint: np.actionHint || null,
    targetNode: np.targetNode,
    requiredInputs: Array.isArray(np.requiredInputs) ? np.requiredInputs : [],
    snapshotHash: np.snapshotHash || null,
    snapshotRef: np.snapshotRef && typeof np.snapshotRef === 'object'
      ? { snapshotHash: np.snapshotRef.snapshotHash || np.snapshotHash || null, copiedAt: np.snapshotRef.copiedAt || null, recompute: np.snapshotRef.recompute === true }
      : null,
  };
}

/** OQ-R5-7 node-level conflict: show both sides' evidence, never auto-pick. */
export function conflictView(projectShell) {
  if (!projectShell || projectShell.ok !== false || projectShell.code !== 'PROJECTION_CONFLICT') return null;
  return {
    code: 'PROJECTION_CONFLICT',
    displayReason: (projectShell.data && projectShell.data.projection && projectShell.data.projection.displayReason) || null,
    conflicts: Array.isArray(projectShell.data && projectShell.data.conflicts) ? projectShell.data.conflicts : [],
  };
}

/**
 * Derive the full page view model from the injected payload.
 * Returns { degraded, bridgeReason } OR { degraded:false, ...view }.
 */
export function deriveJourneyView(payload) {
  const bridge = detectBridge(payload);
  if (bridge.degraded) return { degraded: true, bridgeReason: bridge.reason };
  const readShell = payload.read;
  const projectShell = payload.project && typeof payload.project === 'object' ? payload.project : null;
  const view = {
    degraded: false,
    sessionId: payload.sessionId != null ? String(payload.sessionId) : null,
    injectedAt: payload.injectedAt || null,
    stale: null,
    conflict: conflictView(projectShell),
    notFound: isJourneyNotFound(readShell),
    notFoundDiag: null,
    readCode: readShell.code || null,
    projectCode: projectShell ? (projectShell.code || null) : null,
    warnings: [],
    evidence: [],
  };
  view.warnings = Array.isArray(readShell.warnings) ? readShell.warnings.slice() : [];
  if (view.notFound) {
    view.notFoundDiag = (readShell.data && readShell.data.journey) || {};
    return view;
  }
  // read ok=true => data.journey; read ok=false STALE => data.journey + stale info (render with STALE banner).
  const j = (readShell.data && (readShell.data.journey || readShell.data.projection)) || null;
  if (!j) return { degraded: true, bridgeReason: 'read 壳缺 data.journey 投影体' };
  view.displayStatus = j.displayStatus || 'ERROR';
  view.displayReason = j.displayReason || null;
  view.phase = j.phase || null;
  view.phaseAuthoritative = j.phaseAuthoritative === true;
  view.progress = j.progress || {};
  view.gates = j.gates || { passed: [], pending: [] };
  view.nextPrompt = nextPromptView(j.nextPrompt);
  view.evidence = Array.isArray(j.evidence) ? j.evidence : [];
  view.evidenceCount = j.evidenceCount || null;
  view.updatedAt = j.updated_at || null;
  view.schema = j.schema || null;
  view.steps = Array.isArray(j.steps) ? j.steps.map(mapStep) : null;
  view.plans = Array.isArray(j.plans) ? j.plans : null;
  view.assets = Array.isArray(j.assets) ? j.assets : null;
  if (readShell.ok === false && readShell.code === 'JOURNEY_STALE') {
    view.stale = (readShell.data && readShell.data.stale) || null;
  }
  return view;
}