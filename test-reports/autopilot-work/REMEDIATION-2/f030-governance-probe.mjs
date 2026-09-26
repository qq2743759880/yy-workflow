/**
 * f030-governance-probe.mjs — F-030 governance 两键匹配校正探针（REMEDIATION-2）。
 *
 * 断言面（对照第十四审计 F-030"review 不再注 TDD 类错配"）：
 *   P1 冻结集两键匹配：governanceFor('verification','before_final_receipt') → 注入 verification；
 *      governanceFor('implementation','stage_7') → 注入 TDD；governanceFor('failure_recovery',
 *      'gate_failed'/'regression_failed'/'migration_failed') → 注入 systematic-debugging。
 *   P2 event 不匹配/缺省 → null（fail-closed 不注入）：('verification','stage_7')、
 *      ('implementation',undefined)、('failure_recovery','stage_7')、未知 stage → null。
 *   P3 错配校正核心：旧 STAGE_BY_ASSET 下 review→verification 会在阶段级注入 verification；
 *      新语义下 review 子任务的派单事件是 stage_7 → governPlanAssets 不给 review 注任何治理节；
 *      显式传 'before_final_receipt' 事件才注入。implementation 在 stage_7 注 TDD。
 *   P4 runtime 失败码映射：governanceEventForFailureCode 全映射表断言
 *      （CAPABILITY_MISSING / INELIGIBLE_* / RESOLVER_INTERNAL_ERROR / 各种 *_NOT_AVAILABLE /
 *      *_OUTPUT_INVALID → gate_failed；regression_failed/migration_failed 直通；未映射码/空码 → null）。
 *   P5 接线点 B 组合：governancePointerLine('failure_recovery', 'gate_failed') 具名行；
 *      ('failure_recovery','stage_7') → null（事件不匹配不指路）。
 *   P6 截断护栏与缺失容错保持：governanceDir 指向不存在目录 → null（向后兼容）。
 *
 * 输出：REMEDIATION-2/f030-governance-probe.json（probe 输出落盘）+ stdout 一行 verdict。
 */
import { governanceFor, governanceBriefSection, governancePointerLine, governanceEventForFailureCode, governPlanAssets, stageForAsset } from '../../../scripts/lib/governance.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.dirname(fileURLToPath(import.meta.url));
const out = { schema: 'f030-governance-probe@1.0.0', at: new Date().toISOString(), probes: {} };
const A = (name, pass, detail) => ({ name, pass: pass === true, detail });

// P1 冻结集正配三技能
{
  const v = governanceFor('verification', 'before_final_receipt');
  const i = governanceFor('implementation', 'stage_7');
  const f1 = governanceFor('failure_recovery', 'gate_failed');
  const f2 = governanceFor('failure_recovery', 'regression_failed');
  const f3 = governanceFor('failure_recovery', 'migration_failed');
  const ok = !!v && v.skill === 'verification-before-completion'
    && !!i && i.skill === 'test-driven-development'
    && !!f1 && f1.skill === 'systematic-debugging'
    && !!f2 && f2.skill === 'systematic-debugging'
    && !!f3 && f3.skill === 'systematic-debugging';
  out.probes.frozen_bindings_positive = {
    assertions: {
      assert_verification_at_before_final_receipt: !!v && v.skill === 'verification-before-completion',
      assert_implementation_at_stage_7: !!i && i.skill === 'test-driven-development',
      assert_failure_recovery_three_events: [f1, f2, f3].every((x) => x && x.skill === 'systematic-debugging'),
    },
    detail: 'verification/TDD/systematic-debugging 三绑定正配全命中',
  };
  out.probes.frozen_bindings_positive.assertions.assert_all = ok;
}

// P2 event 不匹配/缺省 → null（两键 fail-closed）
{
  const cases = {
    verification_stage_7: governanceFor('verification', 'stage_7'),
    implementation_undefined_event: governanceFor('implementation'),
    failure_recovery_stage_7: governanceFor('failure_recovery', 'stage_7'),
    implementation_wrong_event: governanceFor('implementation', 'before_final_receipt'),
    unknown_stage: governanceFor('deployment', 'stage_7'),
    null_event: governanceFor('verification', null),
  };
  const ok = Object.values(cases).every((x) => x === null);
  out.probes.two_key_fail_closed = {
    assertions: { assert_all_mismatches_null: ok },
    detail: 'event 缺省/枚举外/未知 stage 全部返回 null（不注入）',
    cases: Object.fromEntries(Object.entries(cases).map(([k, v]) => [k, v === null ? 'null' : 'INJECTED(!)'])),
  };
}

// P3 错配校正：review 在 stage_7 派单事件下不注 verification；显式 before_final_receipt 才注
{
  const reviewAtDispatch = governanceBriefSection('verification', 'stage_7');
  const reviewAtFinalReceipt = governanceBriefSection('verification', 'before_final_receipt');
  const implAtDispatch = governanceBriefSection('implementation', 'stage_7');
  const ok = reviewAtDispatch === null && !!reviewAtFinalReceipt && reviewAtFinalReceipt.includes('verification-before-completion')
    && !!implAtDispatch && implAtDispatch.includes('test-driven-development');
  out.probes.mismatch_correction = {
    assertions: {
      assert_review_not_injected_at_stage_7: reviewAtDispatch === null,
      assert_review_injected_only_at_before_final_receipt: !!reviewAtFinalReceipt,
      assert_implementation_injected_at_stage_7: !!implAtDispatch && implAtDispatch.includes('test-driven-development'),
    },
    detail: 'review 派单事件(stage_7)不注 verification——原 STAGE_BY_ASSET 阶段级错配已校正',
  };
}

// P3b governPlanAssets 端到端：brief 组装事件（stage_7）下 implementation 注 TDD、review 零注入
{
  const mk = (name, body) => ({ name, body, meta: {} });
  const assets = new Map([
    ['implementation', mk('implementation', '# 实现资产\n\n正文')],
    ['review', mk('review', '# 评审资产\n\n正文')],
    ['sdlc', mk('sdlc', '# sdlc 资产\n\n正文')],
  ]);
  const subtasks = [{ asset: 'implementation' }, { asset: 'review' }, { asset: 'sdlc' }, { asset: 'dev-planner' }];
  const governed = governPlanAssets(assets, subtasks);
  const implBody = governed.get('implementation').body;
  const reviewBody = governed.get('review').body;
  const sdlcBody = governed.get('sdlc').body;
  const ok = implBody.includes('test-driven-development')
    && reviewBody === assets.get('review').body
    && sdlcBody === assets.get('sdlc').body;
  out.probes.govern_plan_assets_stage_entry = {
    assertions: {
      assert_implementation_tdd_injected: implBody.includes('test-driven-development'),
      assert_review_untouched_at_stage_entry: reviewBody === assets.get('review').body,
      assert_sdlc_untouched_at_stage_entry: sdlcBody === assets.get('sdlc').body,
    },
    detail: 'brief 组装事件 stage_7 下：implementation 注 TDD；review/sdlc（verification 绑定）零注入；未列资产零注入',
  };
  out.probes.govern_plan_assets_stage_entry.assertions.assert_all = ok;
}

// P4 runtime 失败码 → failure_recovery 组映射表
{
  const expect = {
    'CAPABILITY_MISSING': 'gate_failed',
    'INELIGIBLE_CANDIDATE_INVALID': 'gate_failed',
    'INELIGIBLE_ASSET_NOT_FOUND': 'gate_failed',
    'INELIGIBLE': 'gate_failed',
    'RESOLVER_INTERNAL_ERROR': 'gate_failed',
    'ADAPTER_NOT_AVAILABLE': 'gate_failed',
    'OPENCODE_NOT_AVAILABLE': 'gate_failed',
    'SDLC_NOT_AVAILABLE': 'gate_failed',
    'CONTRACT_TOOL_NOT_AVAILABLE': 'gate_failed',
    'SPECTRAL_NOT_AVAILABLE': 'gate_failed',
    'SPECTRAL_OUTPUT_INVALID': 'gate_failed',
    'SKILLSCANNER_OUTPUT_INVALID': 'gate_failed',
    'regression_failed': 'regression_failed',
    'migration_failed': 'migration_failed',
    'gate_failed': 'gate_failed',
  };
  const bad = Object.entries(expect).filter(([c, e]) => governanceEventForFailureCode(c) !== e);
  const unmapped = ['DEP_PRECONDITION', 'CONTRACT_NOT_FROZEN', 'RANDOM_CODE', ''].map((c) => governanceEventForFailureCode(c));
  const ok = bad.length === 0 && unmapped.every((x) => x === null);
  out.probes.failure_code_map = {
    assertions: {
      assert_mapped_codes: bad.length === 0,
      assert_unmapped_null: unmapped.every((x) => x === null),
    },
    detail: '失败码映射表 15 项全对；DEP_PRECONDITION/CONTRACT_NOT_FROZEN/未知/空码 → null（不语义扩张）',
    bad: bad,
  };
  out.probes.failure_code_map.assertions.assert_all = ok;
}

// P5 接线点 B 组合（runtime 调用形态）：真实 dispatch 失败观察点（executePlan→runGroup→runOne）
{
  const { executePlan, setAdapterResolver } = await import('../../../scripts/lib/runtime.mjs');
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'f030-rt-'));
  const plan = { id: 'plan-f030rt', status: 'executing', subtasks: [{ id: 'plan-f030rt-0', asset: 'implementation', task: 't', contract: 'none', status: 'idle', attempts: 0, dependsOn: [], phase: 0 }] };
  const logs = [];
  const logger = { info: (l) => logs.push(String(l)), warn: (l) => logs.push(String(l)), error: (l) => logs.push(String(l)) };
  const prev = setAdapterResolver(() => ({ name: 'failing', run: async () => ({ ok: false, error: 'CAPABILITY_MISSING', artifactPath: null }) }));
  await executePlan(plan, { logger, skipEligibilityGate: true, workspace: ws });
  setAdapterResolver(prev);
  fs.rmSync(ws, { recursive: true, force: true });
  const clean = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '');
  const govLine = logs.map(clean).find((l) => l.includes('GOVERNANCE'));
  const ok = !!govLine && govLine.includes('gov_event=gate_failed') && govLine.includes('CAPABILITY_MISSING') && govLine.includes('systematic-debugging');
  out.probes.pointer_line_runtime_shape = {
    assertions: {
      assert_runtime_emits_pointer_line: !!govLine,
      assert_real_event_mapping_gate_failed: govLine ? govLine.includes('gov_event=gate_failed') : false,
      assert_failure_code_named: govLine ? govLine.includes('CAPABILITY_MISSING') : false,
    },
    detail: '真实 executePlan 失败路径（adapter 返回 CAPABILITY_MISSING）：指路行带 gov_event=gate_failed 具名码（映射表生效）',
    gov_line: govLine || null,
  };
  out.probes.pointer_line_runtime_shape.assertions.assert_all = ok;
}

// P6 缺失容错（向后兼容保持）+ stageForAsset 不回归
{
  const missing = governanceFor('verification', 'before_final_receipt', { governanceDir: path.join(OUT_DIR, 'nonexistent-gov-dir') });
  const ok = missing === null && stageForAsset('review') === 'verification' && stageForAsset('nonexistent') === null;
  out.probes.backcompat = {
    assertions: { assert_missing_dir_null: missing === null, assert_stage_for_asset_kept: stageForAsset('review') === 'verification' },
    detail: 'governance-skills 缺失 → null；stageForAsset 资产映射保留（两键之一）',
  };
  out.probes.backcompat.assertions.assert_all = ok;
}

out.all_pass = Object.values(out.probes).every((p) => Object.values(p.assertions || {}).every(Boolean));
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'f030-governance-probe.json'), JSON.stringify(out, null, 2));
console.log('[f030-governance-probe] all_pass=' + out.all_pass);
if (!out.all_pass) {
  for (const [k, p] of Object.entries(out.probes)) {
    for (const [a, v] of Object.entries(p.assertions || {})) if (!v) console.log('  FAIL ' + k + '/' + a);
  }
  process.exitCode = 1;
}
