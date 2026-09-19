/** p12 — §4.2 前置映射（OQ-R4-5=A 冻结表）+ §3.4 衔接点 1/2：B 面 journey 闸（step 1/3/5/7）、step5 契约冻结、step7 eligibility 投影、step8/衔接点1 receipt 终态全覆盖、衔接点2 DEP_PRECONDITION；未列出转换仅矩阵+session+lock。 */
import fs from 'node:fs';
import path from 'node:path';
import phase from '../../../scripts/lib/phase.mjs';
import { NOW, stateFixture, seedState, writeReceipt, shellOk, verdict } from './_helpers.mjs';

const GATES = ['concept-signed', 'premise-signed', 'contract-frozen', 'gate-a-approved'];

/** B 面 journey 快照夹具（tt-journey JOURNEY_SCHEMA 投影形） */
function journeyFixture({ passed = [] } = {}) {
  return {
    schema: 'yy/journey@1',
    steps: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
      step: n,
      name: 'n' + n,
      status: n < 7 ? 'done' : 'pending',
      gates_passed: n < 4 ? GATES.slice(0, Math.min(n, 3)) : passed,
      artifacts: [],
      updated_at: null,
    })),
    plans: [],
    updated_at: null,
  };
  // 缺省：step0 gates_passed=[]，step1 ['concept-signed']，step3 前 2 闸，step5/7 passed 参数
}

function journeyWith(step, gates) {
  const j = journeyFixture({ passed: step === 7 ? gates : ['contract-frozen'] });
  if (step === 5) j.steps[5] = { ...j.steps[5], gates_passed: gates };
  if (step === 7) j.steps[7] = { ...j.steps[7], gates_passed: gates };
  return j;
}

export async function run({ sandbox }) {
  const checks = [];
  const c = (name, pass) => checks.push({ name, pass });
  async function expect(target, journey, ws, expectFn, label) {
    const r = await phase.checkPhase({ workspace: ws, target, journey, opts: { now: NOW } });
    c(label, shellOk(r) && expectFn(r), `got ${r.ok}/${r.code}`);
    return r;
  }

  // (1) step 1/3：对应闸已置位 ⇒ allowed（§4.2 第 1 行）
  await expect(1, journeyWith(1, ['concept-signed']), sandbox, (r) => r.ok === true && r.data.allowed === true, 'step1.gateSetAllowed');
  await expect(3, journeyFixture(), sandbox, (r) => r.ok === true && r.data.allowed === true, 'step3.gateSetAllowed');
  // (2) step 7：gate-a-approved 未置位 ⇒ PHASE_PREREQ_UNMET（journey_gate）
  const r7 = await expect(7, journeyWith(7, []), sandbox, (r) => r.ok === true && r.code === 'PHASE_PREREQ_UNMET' && JSON.stringify(r.data.missing).includes('journey_gate'), 'step7.gateUnsetUnmet');
  // (3) step 7：闸置位 + 待派 subtask 均有 asset ⇒ allowed（eligibility 投影：只查结构在场，不重定义 R2）
  const wsElig = path.join(sandbox, 'ws-elig');
  seedState(wsElig, stateFixture({ status: 'executing', subtasks: [{ id: 's1', asset: 'implementation', status: 'pending', phase: 0, dependsOn: [] }] }));
  await expect(7, journeyWith(7, ['gate-a-approved']), wsElig, (r) => r.ok === true && r.data.allowed === true, 'step7.eligibleAllowed');
  // (4) step 7：待派 subtask 无 asset ⇒ PHASE_PREREQ_UNMET（eligibility）
  const wsNoAsset = path.join(sandbox, 'ws-noasset');
  seedState(wsNoAsset, stateFixture({ status: 'executing', subtasks: [{ id: 's2', status: 'pending', phase: 0, dependsOn: [] }] }));
  await expect(7, journeyWith(7, ['gate-a-approved']), wsNoAsset, (r) => r.ok === true && r.code === 'PHASE_PREREQ_UNMET' && JSON.stringify(r.data.missing).includes('eligibility'), 'step7.noAssetUnmet');

  // (5) step 5：闸置位但契约冻结证据缺失（无 plan）⇒ CONTRACT_NOT_FROZEN（error 通道，§4.1 contract frozen 行）
  const emptyWs = path.join(sandbox, 'ws-empty');
  fs.mkdirSync(emptyWs, { recursive: true });
  await expect(5, journeyWith(5, ['contract-frozen']), emptyWs, (r) => r.ok === false && r.code === 'CONTRACT_NOT_FROZEN' && r.data.allowed === false, 'step5.noPlanContractFrozen');
  // (6) step 5：_contractMissing=true ⇒ CONTRACT_NOT_FROZEN（runtime 现状同码同语义）
  const wsCm = path.join(sandbox, 'ws-cm');
  seedState(wsCm, stateFixture({ _contractMissing: true }));
  await expect(5, journeyWith(5, ['contract-frozen']), wsCm, (r) => r.ok === false && r.code === 'CONTRACT_NOT_FROZEN', 'step5.contractMissing');
  // (7) step 5：冻结契约文件在场 ⇒ allowed
  const wsCf = path.join(sandbox, 'ws-cf');
  fs.mkdirSync(path.join(wsCf, 'contracts'), { recursive: true });
  fs.writeFileSync(path.join(wsCf, 'contracts', 'p1.json'), '{"contractMode":"frozen"}');
  seedState(wsCf, stateFixture({ contractMode: 'frozen', contract: 'contracts/p1.json', subtasks: [] }));
  await expect(5, journeyWith(5, ['contract-frozen']), wsCf, (r) => r.ok === true && r.data.allowed === true, 'step5.frozenFileAllowed');
  // (8) step 5：contractMode=frozen 但文件缺失 ⇒ CONTRACT_NOT_FROZEN
  const wsCf2 = path.join(sandbox, 'ws-cf2');
  seedState(wsCf2, stateFixture({ contractMode: 'frozen', contract: 'contracts/absent.json', subtasks: [] }));
  await expect(5, journeyWith(5, ['contract-frozen']), wsCf2, (r) => r.ok === false && r.code === 'CONTRACT_NOT_FROZEN' && JSON.stringify(r.data.missing).includes('契约文件缺失'), 'step5.missingFile');

  // (9) step 8 / 衔接点 1：receipt 终态全覆盖——behavior_verified ⇒ allowed；UNRESOLVED ⇒ 不通过
  const wsV = path.join(sandbox, 'ws-step8v');
  seedState(wsV, stateFixture());
  writeReceipt(wsV, { subtaskId: 's1', assetId: 'implementation', terminal: 'verified' });
  await expect(8, journeyFixture(), wsV, (r) => r.ok === true && r.data.allowed === true, 'step8.verifiedAllowed');
  const wsU = path.join(sandbox, 'ws-step8u');
  seedState(wsU, stateFixture());
  writeReceipt(wsU, { subtaskId: 's1', assetId: 'implementation', terminal: 'unresolved' });
  await expect(8, journeyFixture(), wsU, (r) => r.ok === true && r.code === 'PHASE_PREREQ_UNMET' && JSON.stringify(r.data.missing).includes('UNRESOLVED'), 'step8.unresolvedUnmet');

  // (10) 衔接点 2：planning→executing——requireExec 计划上游依赖须 done + receipt behavior_verified（裸布尔不满足）
  const wsDep = path.join(sandbox, 'ws-dep');
  seedState(wsDep, stateFixture({
    status: 'planning',
    subtasks: [
      { id: 's1', asset: 'be-architect', status: 'done', mode: 'exec', attempts: 1, assetConsumed: true, phase: 0, dependsOn: [] },
      { id: 's2', asset: 'implementation', status: 'pending', phase: 1, dependsOn: ['s1'] },
    ],
  }));
  const depNoReceipt = await phase.checkPhase({ workspace: wsDep, from: 'planning', to: 'executing', opts: { now: NOW } });
  c('dep.bareBooleanUnmet', depNoReceipt.ok === true && depNoReceipt.code === 'PHASE_PREREQ_UNMET' && JSON.stringify(depNoReceipt.data.missing).includes('dependency_precondition'));
  writeReceipt(wsDep, { subtaskId: 's1', assetId: 'be-architect', terminal: 'verified' });
  const depOk = await phase.checkPhase({ workspace: wsDep, from: 'planning', to: 'executing', opts: { now: NOW } });
  c('dep.verifiedSatisfied', depOk.ok === true && depOk.data.allowed === true, `got ${depOk.ok}/${depOk.code}:${JSON.stringify(depOk.data.missing ?? []).slice(0, 80)}`);

  // (11) 未列出转换 = 仅矩阵 + session + lock（§4.2 末行）：executing→frozen 无 receipt 要求
  const wsFree = path.join(sandbox, 'ws-free');
  seedState(wsFree, stateFixture({ status: 'executing' }));
  const free = await phase.checkPhase({ workspace: wsFree, from: 'executing', to: 'frozen', opts: { now: NOW } });
  c('unmapped.matrixOnly', free.ok === true && free.data.allowed === true);
  const trFree = await phase.transitionPhase({ workspace: wsFree, from: 'executing', to: 'frozen', opts: { now: NOW, rand: 'abc50001' } });
  c('unmapped.transitionOk', trFree.ok === true && JSON.parse(fs.readFileSync(path.join(wsFree, '.tt-state', 'state.json'), 'utf8')).status === 'frozen');

  return verdict(checks, 'prereq-mapping');
}
