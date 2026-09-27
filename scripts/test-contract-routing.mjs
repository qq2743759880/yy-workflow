#!/usr/bin/env node
/**
 * Contract routing regression: exercise the production CLI and real adapters.
 * Optional --evidence-dir preserves CLI workspaces and run-stamped evidence.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { journeyProject } from './lib/journey.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPENAPI = path.join(ROOT, 'test-reports', 'autopilot-work', 'E2E-v3', 's1b-derived-chain', 'openapi.json');
const evidenceArg = process.argv.indexOf('--evidence-dir');
const preserve = evidenceArg !== -1;
const evidenceRoot = preserve
  ? path.resolve(process.argv[evidenceArg + 1] || '')
  : await fs.mkdtemp(path.join(os.tmpdir(), 'yy-contract-route-'));

if (!preserve) await fs.mkdir(path.join(evidenceRoot, 'workspaces'), { recursive: true });
else await fs.mkdir(evidenceRoot, { recursive: false });

const cases = [];
const containsPath = (value, target) => String(value || '').replace(/\\/g, '/').toLowerCase().includes(target.replace(/\\/g, '/').toLowerCase());

function runCli(args, { approve = false, cwd = ROOT } = {}) {
  return new Promise((resolve) => {
    let output = '';
    const child = spawn(process.execPath, ['scripts/orchestrator.mjs', ...args], {
      cwd,
      env: {
        ...process.env,
        ...(process.platform === 'win32' ? { PYTHONUTF8: '1' } : {}),
        ...(approve ? { TT_APPROVE_FORCE_TTY: '1' } : {}),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const timeout = setTimeout(() => child.kill(), 180000);
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ exitCode: null, signal: null, output, error: error.message });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timeout);
      resolve({ exitCode: code, signal, output, error: null });
    });
    child.stdin.end(approve ? 'a\n' : undefined);
  });
}

async function readRun(name, argv, { approve = false, prepare, judge } = {}) {
  const workspace = path.join(evidenceRoot, 'workspaces', name);
  await fs.mkdir(workspace, { recursive: true });
  const preparedArgs = prepare ? await prepare(workspace) : [];
  const args = ['--workspace', workspace, '--backend', 'auto', '--no-tui', ...argv, ...preparedArgs];
  const command = [process.execPath, 'scripts/orchestrator.mjs', ...args];
  const result = await runCli(args, { approve });
  await fs.writeFile(path.join(evidenceRoot, name + '-cli.log'), result.output, 'utf8');
  const statePath = path.join(workspace, '.tt-state', 'state.json');
  let state = null;
  try { state = JSON.parse(await fs.readFile(statePath, 'utf8')); } catch { /* assertion below reports absent state */ }

  const actualAdapterResults = [];
  for (const subtask of (state && state.subtasks) || []) {
    if (!subtask.artifactPath || !/\.json$/i.test(subtask.artifactPath)) continue;
    const artifactPath = path.resolve(workspace, subtask.artifactPath);
    try {
      const artifact = JSON.parse(await fs.readFile(artifactPath, 'utf8'));
      actualAdapterResults.push({
        subtaskId: subtask.id,
        asset: subtask.asset || null,
        adapter: subtask.adapter || null,
        contractPath: subtask.contract || null,
        resultPath: path.relative(evidenceRoot, artifactPath).split(path.sep).join('/'),
        result: artifact.contract && typeof artifact.contract === 'object' ? artifact.contract : artifact,
      });
    } catch { /* Non-JSON or absent artifact is not an adapter result. */ }
  }

  const journeyResult = state ? journeyProject({ kind: 'journey.project', workspace, mode: 'full' }) : null;
  const projection = journeyResult && journeyResult.data
    ? journeyResult.data.projection || journeyResult.data.journey || {}
    : {};
  const journeyProjection = {
    ok: journeyResult ? journeyResult.ok : false,
    code: journeyResult && journeyResult.code || null,
    planRows: (projection.plans || []).map((row) => ({ planId: row.planId, cluster: row.cluster ?? null, status: row.status ?? null })),
    subtaskRows: (projection.subtasks || []).map((row) => ({
      subtaskId: row.subtaskId,
      asset: row.asset ?? null,
      status: row.status ?? null,
      capability: row.capability ?? null,
      capabilitySource: row.capabilitySource ?? null,
      selectedAsset: row.selectedAsset ?? null,
    })),
  };
  const base = {
    name,
    command,
    exitCode: result.exitCode,
    signal: result.signal,
    error: result.error,
    state: state ? { id: state.id, cluster: state.cluster, status: state.status, subtasks: state.subtasks.map((s) => ({
      id: s.id, asset: s.asset, status: s.status, capability: s.capability || null,
      selectedAsset: s.selectedAsset || null, contract: s.contract || null,
      brownfieldDraft: s.brownfieldDraft === true, adapter: s.adapter || null, artifactPath: s.artifactPath || null,
    })) } : null,
    journeyProjection,
    actualAdapterResults,
  };
  const assertions = judge({ ...base, workspace });
  const record = { ...base, assertions, passed: assertions.every((assertion) => assertion.ok) };
  cases.push(record);
  await fs.writeFile(path.join(evidenceRoot, name + '-evidence.json'), JSON.stringify(record, null, 2), 'utf8');
  const failed = assertions.filter((assertion) => !assertion.ok).map((assertion) => assertion.name + ': ' + assertion.detail);
  console.log((record.passed ? 'PASS ' : 'FAIL ') + name + (failed.length ? ' — ' + failed.join(' | ') : ''));
  return record;
}

function assertion(name, ok, detail) { return { name, ok: Boolean(ok), detail: detail || '' }; }
function realSpectral(result, contractPath) {
  return result && result.tool === 'spectral' && result.mode === 'exec'
    && typeof result.pass === 'boolean' && result.degraded !== true
    && containsPath(result.scope, contractPath);
}

try {
  await fs.access(OPENAPI);

  const legacy = await readRun('01-legacy-planned-validator', [], {
    approve: true,
    prepare: async (workspace) => {
      const draftPath = path.join(workspace, 'legacy-plan.json');
      await fs.writeFile(draftPath, JSON.stringify({
        task: 'Legacy planned be-validator contract route',
        draft: true,
        phases: [{ name: 'validation', tasks: [{ id: 'validator', desc: 'Validate the supplied OpenAPI contract with Spectral', asset: 'be-validator', estimate: 'S', lane: 'validation', dependsOn: [] }] }],
      }), 'utf8');
      return ['--task', 'Legacy planned be-validator contract route', '--plan', '--draft', draftPath, '--contract', OPENAPI];
    },
    judge: ({ exitCode, state, actualAdapterResults }) => {
      const spectral = actualAdapterResults.filter((x) => x.asset === 'be-validator' && realSpectral(x.result, OPENAPI));
      return [
        assertion('legacy CLI run completed', exitCode === 0 && state && state.status === 'done', 'exit=' + exitCode + ', state=' + (state && state.status)),
        assertion('legacy plan has no capability override', !!state && state.subtasks.length === 1 && !state.subtasks[0].capability && state.subtasks[0].asset === 'be-validator', 'planned asset=' + (state && state.subtasks[0] && state.subtasks[0].asset)),
        assertion('actual Spectral result scanned user OpenAPI', spectral.length > 0, JSON.stringify(spectral.map((x) => x.result))),
      ];
    },
  });

  const loginOpenApi = await readRun('02-capability-openapi-validation', [
    '--task', '登录接口开发', '--capability', 'openapi-validation', '--contract', OPENAPI,
  ], {
    judge: ({ exitCode, state, actualAdapterResults }) => {
      const spectral = actualAdapterResults.filter((x) => x.asset === 'be-validator' && realSpectral(x.result, OPENAPI));
      const rebound = !!state && state.subtasks.some((s) => s.capability === 'openapi-validation' && s.selectedAsset === 'be-validator' && s.asset === 'be-validator');
      return [
        assertion('capability CLI run completed', exitCode === 0 && state && state.status === 'done', 'exit=' + exitCode + ', state=' + (state && state.status)),
        assertion('capability resolved to final be-validator', rebound, 'be-validator subtasks=' + (state ? state.subtasks.filter((s) => s.asset === 'be-validator').length : 0)),
        assertion('actual Spectral result scanned user OpenAPI', spectral.length > 0, JSON.stringify(spectral.map((x) => x.result))),
      ];
    },
  });

  const security = await readRun('03-security-audit-contract-isolation', [
    '--task', '运维部署监控', '--capability', 'security-audit', '--contract', OPENAPI,
  ], {
    judge: ({ exitCode, state, actualAdapterResults }) => {
      const semgrep = actualAdapterResults.filter((x) => x.asset === 'security' && x.result.tool === 'semgrep');
      const noOpenApiArgument = !!state && state.subtasks.filter((s) => s.asset === 'security').every((s) => !containsPath(s.contract, OPENAPI));
      const noOpenApiInResult = semgrep.length > 0 && semgrep.every((x) => !containsPath(JSON.stringify(x.result), OPENAPI)
        && x.result.mode === 'exec' && typeof x.result.pass === 'boolean' && x.result.degraded !== true
        && typeof x.result.scope === 'string');
      return [
        assertion('security CLI run completed', exitCode === 0 && state && state.status === 'done', 'exit=' + exitCode + ', state=' + (state && state.status)),
        assertion('OpenAPI is not assigned to security subtasks', noOpenApiArgument, 'security subtask contracts=' + JSON.stringify(state && state.subtasks.filter((s) => s.asset === 'security').map((s) => s.contract))),
        assertion('actual Semgrep result does not consume OpenAPI', noOpenApiInResult, JSON.stringify(semgrep.map((x) => x.result))),
      ];
    },
  });

  const invalid = await readRun('04-non-openapi-json-degrades', [], {
    prepare: async (workspace) => {
      const invalidPath = path.join(workspace, 'not-openapi.json');
      await fs.writeFile(invalidPath, '{"notOpenApi":true}', 'utf8');
      return ['--task', '登录接口开发', '--capability', 'openapi-validation', '--contract', invalidPath];
    },
    judge: ({ exitCode, state, actualAdapterResults }) => {
      const degraded = actualAdapterResults.filter((x) => x.asset === 'be-validator' && x.result.tool === 'spectral' && x.result.mode !== 'exec' && x.result.pass === null && x.result.degraded === true && !x.result.scope);
      return [
        assertion('non-OpenAPI CLI run completed', exitCode === 0 && state && state.status === 'done', 'exit=' + exitCode + ', state=' + (state && state.status)),
        assertion('adapter preserves honest degraded result', degraded.length > 0, JSON.stringify(degraded.map((x) => x.result))),
      ];
    },
  });

  const draftCase = await readRun('05-contract-draft-semantics', [], {
    approve: true,
    prepare: async (workspace) => {
      const planPath = path.join(workspace, 'draft-plan.json');
      const contractDraftPath = path.join(workspace, 'contract-draft.json');
      await fs.writeFile(planPath, JSON.stringify({
        task: 'Brownfield contract draft route',
        draft: true,
        phases: [{ name: 'validation', tasks: [{ id: 'validator', desc: 'Record the unconfirmed brownfield contract draft', asset: 'be-validator', estimate: 'S', lane: 'validation', dependsOn: [] }] }],
      }), 'utf8');
      await fs.writeFile(contractDraftPath, JSON.stringify({ draft: true, paths: {} }), 'utf8');
      return ['--task', 'Brownfield contract draft route', '--plan', '--draft', planPath, '--contract-draft', contractDraftPath];
    },
    judge: ({ exitCode, state, actualAdapterResults, workspace }) => {
      const result = actualAdapterResults.find((x) => x.asset === 'be-validator' && x.result.tool === 'spectral');
      const draft = !!result && result.result.draft === true && result.result.pass === null && result.result.degraded === true && !result.result.scope;
      const draftSubtask = state && state.subtasks[0];
      const flags = !!draftSubtask && state.subtasks.length === 1
        && draftSubtask.brownfieldDraft === true && containsPath(draftSubtask.contract, path.join(workspace, 'contract-draft.json'));
      return [
        assertion('--contract-draft CLI run completed', exitCode === 0 && state && state.status === 'done', 'exit=' + exitCode + ', state=' + (state && state.status)),
        assertion('brownfield draft flags and contract path remain intact', flags, 'subtask=' + JSON.stringify(draftSubtask)),
        assertion('adapter still degrades without real validation', draft && result.result.mode !== 'exec', JSON.stringify(result && result.result)),
      ];
    },
  });

  const report = {
    createdAt: new Date().toISOString(),
    openapiFixture: path.relative(ROOT, OPENAPI).split(path.sep).join('/'),
    cases: cases.map(({ name, command, exitCode, signal, state, journeyProjection, actualAdapterResults, assertions, passed }) => ({
      name, command, exitCode, signal, state, journeyProjection, actualAdapterResults, assertions, passed,
    })),
    passed: cases.every((item) => item.passed),
  };
  await fs.writeFile(path.join(evidenceRoot, 'assertions.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log('RESULT ' + cases.filter((item) => item.passed).length + '/' + cases.length + ' cases passed');
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  console.error('FAIL contract routing regression: ' + (error && error.stack || error));
  process.exitCode = 1;
} finally {
  if (!preserve) await fs.rm(evidenceRoot, { recursive: true, force: true });
}
