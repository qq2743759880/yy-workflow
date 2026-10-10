/** Pure C01 policy. Trusted local callers supply approval/binding observations; no discovery or dispatch. */
import { assertContract } from './delegation-contract.mjs';

const MODES = ['AUTO', 'DIRECT_HOST', 'MANUAL_HANDOFF', 'NATIVE_SUBAGENT'];
const EXECUTIONS = ['HOST_NATIVE', 'EXTERNAL_PROVIDER', 'BRIEF_ONLY'];
const OPERATIONS = ['PREVIEW', 'PREPARE_HANDOFF', 'IMPORT_RETURN', 'VALIDATE_RETURN', 'ACCEPT_RETURN', 'RESUME'];
const ALIASES = { 'self-dispatch': 'AUTO', 'handoff-prompt': 'MANUAL_HANDOFF', 'C-handoff': 'MANUAL_HANDOFF', 'A-direct': 'DIRECT_HOST', 'B-cli': 'DIRECT_HOST' };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function invalid(message) { throw Object.assign(new Error('DELEGATION_INPUT_INVALID: ' + message), { code: 'INPUT_INVALID' }); }
function object(value, name, keys) {
  if (!plain(value)) invalid(name + ' must be an object');
  if (keys) for (const key of Object.keys(value)) if (!keys.includes(key)) invalid(name + '.' + key + ' is unknown');
}
function choice(value) {
  if (MODES.includes(value)) return value;
  if (typeof value === 'string' && Object.hasOwn(ALIASES, value)) return ALIASES[value];
  invalid('unknown delegation mode');
}
function layer(config, kind) {
  object(config, kind, kind === 'LEGACY' ? null : ['delegation_mode', 'ref', 'automatic_dispatch_allowed', 'approved']);
  if (kind === 'PROJECT' && config.approved !== true) invalid('project preference is not approved');
  if (Object.hasOwn(config, 'automatic_dispatch_allowed') && typeof config.automatic_dispatch_allowed !== 'boolean') invalid('automatic_dispatch_allowed must be boolean');
  const values = [];
  if (Object.hasOwn(config, 'delegation_mode')) values.push(config.delegation_mode);
  if (kind === 'LEGACY') {
    for (const key of ['delegationMode', 'orchestrator.delegationMode', 'mode']) if (Object.hasOwn(config, key)) values.push(config[key]);
    for (const key of ['orchestrator', 'executor']) if (Object.hasOwn(config, key)) object(config[key], 'legacy.' + key);
    if (config.orchestrator && Object.hasOwn(config.orchestrator, 'delegationMode')) values.push(config.orchestrator.delegationMode);
    if (config.executor && Object.hasOwn(config.executor, 'mode')) values.push(config.executor.mode);
  }
  const mapped = values.map(choice);
  if (new Set(mapped).size > 1) invalid('same-authority delegation configuration conflict');
  const ref = kind === 'LEGACY' ? 'legacy:config' : config.ref ?? kind.toLowerCase() + ':delegation';
  return { mode: mapped[0], source: { kind, ref }, denied: config.automatic_dispatch_allowed === false, external: values.includes('B-cli') };
}

/**
 * input: task/run/project choice layers, legacy parsed JSON, operation/execution_mode,
 * capabilities {native_subagent,host_native} from actual bindings, external {approved,command}
 * from a trusted local approval, independence_required. Old spawn_subagent is never evidence.
 * Returns the closed ModeContext. This policy predicts eligibility and never claims execution.
 */
export function normalizeDelegation(input = {}) {
  object(input, 'input', ['task', 'run', 'project', 'legacy', 'operation', 'execution_mode', 'capabilities', 'external', 'independence_required']);
  const operation = input.operation ?? 'PREVIEW';
  if (!OPERATIONS.includes(operation)) invalid('unknown operation');
  if (Object.hasOwn(input, 'execution_mode') && ![...EXECUTIONS, null].includes(input.execution_mode)) invalid('unknown execution mode');
  const capabilities = input.capabilities ?? {};
  object(capabilities, 'capabilities', ['native_subagent', 'host_native']);
  for (const value of Object.values(capabilities)) if (typeof value !== 'boolean') invalid('capabilities must be observed booleans');
  if (input.external !== undefined) {
    object(input.external, 'external', ['approved', 'command']);
    if (typeof input.external.approved !== 'boolean') invalid('external.approved must be boolean');
    if (!Array.isArray(input.external.command) || !input.external.command.length || input.external.command.some(value => typeof value !== 'string' || !value.trim() || value.includes('\0'))) invalid('external.command must be a nonempty command array');
  }
  const layers = [];
  for (const [key, kind] of [['task', 'TASK'], ['run', 'RUN'], ['project', 'PROJECT'], ['legacy', 'LEGACY']]) {
    if (Object.hasOwn(input, key)) layers.push(layer(input[key], kind));
  }
  const deny = layers.find(value => value.denied);
  const selected = deny ?? layers.find(value => value.mode) ?? { mode: 'DIRECT_HOST', source: { kind: 'DEFAULT', ref: 'default:delegation' } };
  const mode = deny ? 'MANUAL_HANDOFF' : selected.mode;
  const reasons = [];
  const legacyExecution = input.legacy?.executor?.executionMode;
  if (legacyExecution !== undefined && !EXECUTIONS.includes(legacyExecution)) invalid('unknown legacy execution mode');
  if (mode !== 'MANUAL_HANDOFF' && selected.external && input.execution_mode != null && input.execution_mode !== 'EXTERNAL_PROVIDER') invalid('B-cli conflicts with requested execution mode');
  let execution = input.execution_mode ?? (selected.external ? 'EXTERNAL_PROVIDER' : legacyExecution ?? 'HOST_NATIVE');
  let resolved = mode === 'AUTO' ? 'NATIVE_SUBAGENT' : mode;
  let allowed = true;
  if (mode === 'MANUAL_HANDOFF') {
    execution = 'BRIEF_ONLY'; allowed = false; reasons.push('MANUAL_EXECUTION_FORBIDDEN');
  } else if (execution === 'BRIEF_ONLY') {
    resolved = null; allowed = false; reasons.push('EXECUTION_BRIEF_ONLY');
  } else if (resolved === 'NATIVE_SUBAGENT') {
    if (execution !== 'HOST_NATIVE' || capabilities.native_subagent !== true) {
      resolved = null; allowed = false; reasons.push('NATIVE_BINDING_UNAVAILABLE');
    }
  } else if (execution === 'EXTERNAL_PROVIDER') {
    if (input.external?.approved !== true) {
      resolved = null; allowed = false; reasons.push('EXTERNAL_EXECUTION_NOT_APPROVED');
    }
  } else if (capabilities.host_native !== true) {
    resolved = null; allowed = false; reasons.push('HOST_BINDING_UNAVAILABLE');
  }
  return assertContract('ModeContext', {
    delegation_mode: mode, resolved_delegation: resolved, automatic_dispatch_allowed: allowed,
    operation, execution_mode: execution, executed: false, choice_source: selected.source,
    reason_codes: reasons, independence_required: input.independence_required ?? 'none',
  });
}

/** Dry-run only: preserve all parsed JSON fields; per-run overrides do not rewrite project intent. */
export function migrateDelegation(config, options = {}) {
  object(config, 'config');
  object(options, 'options');
  if (Object.hasOwn(options, 'legacy')) invalid('migration owns the legacy config input');
  // JSON data only; this also rejects undefined/functions/nonfinite values instead of silently losing them.
  function jsonData(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
    if (Array.isArray(value)) { value.forEach(jsonData); return; }
    object(value, 'config JSON'); for (const entry of Object.values(value)) jsonData(entry);
  }
  jsonData(config);
  const own = layer(config, 'LEGACY');
  const mode = own.mode; // Preserve preference separately from its hard deny; do not persist a default as user intent.
  const result = structuredClone(config);
  const changes = [];
  if (mode !== undefined && result.delegation_mode !== mode) {
    changes.push({ path: 'delegation_mode', before: result.delegation_mode ?? null, after: mode });
    result.delegation_mode = mode;
  }
  return { dry_run: true, config: result, changes, mode_context: normalizeDelegation({ ...options, legacy: config }) };
}
