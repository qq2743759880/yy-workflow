#!/usr/bin/env node
/**
 * contract-drift-check.mjs — ASSET_CONTRACT_DRIFT fail-closed 检查器（B-P0-03-REWORK1）。
 *
 * 纪元：compatibility-baseline（当前）。检查对象 = 生命周期为 POPULATED_PENDING_ACCEPTANCE 的
 * V3 契约（DRAFT/UNPOPULATED 骨架不做主张，跳过；ACCEPTED/CANONICAL 在本纪元属于抢跑授权，
 * 由 R0 拒绝）。产出：违规逐行 `DRIFT <code> <detail>`；任何违规 → exit 1（不警告了事）。
 *
 * 规则面（对应 REWORK1 负向 fixtures T1-T4）：
 *   R0 LIFECYCLE_PREMATURE_AUTHORITY   baseline 纪元出现 ACCEPTED/PRIMARY/CANONICAL 契约
 *   R1 RUNTIME_KERNEL_DRIFT            V3 execution.primary.adapter ≠ 签约 sidecar 运行时内核
 *                                      （manifest-sources verification 执行内核=/主路径=spawn 提取）
 *   R2 LANGUAGE_COVERAGE_DRIFT         security：引擎级 python-only 僵尸声明（supported=[python]
 *                                      且 unsupported 含 multi-language/多语言）与 vendor 多语言
 *                                      SAST 引擎矛盾；或丢失能力收缩登记（uncovered surfaced 缺失）
 *   R3 CAPABILITY_OWNERSHIP_CONFLICT / BASELINE_OWNERSHIP_MISMATCH / CAPABILITY_KEY_UNREGISTERED
 *                                      capability 排他所有权（含 prd-planning 双主类）
 *   R4 CLUSTER_MEMBERSHIP_DRIFT        V3 routing.clusters ≠ CLUSTERS 基线成员（∪candidates）
 *
 * CLI：node scripts/contract-drift-check.mjs [--contracts-dir <dir>] [--manifests-dir <dir>]
 * 退出码：0 无漂移；1 存在漂移/违规（fail-closed）。
 */
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPABILITY_MAP } from './lib/activation.mjs';
import { CLUSTERS } from './lib/matrix.mjs';
import { loadAllContractsV3, isPopulatedPending } from './lib/contract-v3.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function expectedClustersFor(asset) {
  return CLUSTERS.filter((c) => c.candidates.includes(asset)).map((c) => c.id);
}

/** 从签约 sidecar verification 文本提取运行时内核 token（提不出 → null，由调用方 fail-closed）。 */
function runtimeKernelFromSidecar(text) {
  const m1 = text.match(/执行内核[=：]\s*([A-Za-z0-9\-]+)/);
  if (m1) return m1[1].toLowerCase();
  const m2 = text.match(/主路径[=：]专用 adapter（[^）]*?spawn\s+([A-Za-z0-9\-]+)/);
  if (m2) return m2[1].toLowerCase();
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const contractsDir = args.includes('--contracts-dir') ? args[args.indexOf('--contracts-dir') + 1] : path.join(ROOT, 'contracts', 'v3');
  const manifestsDir = args.includes('--manifests-dir') ? args[args.indexOf('--manifests-dir') + 1] : path.join(ROOT, 'contracts', 'manifest-sources');

  const violations = [];
  const drift = (code, detail) => violations.push({ code, detail });

  let contracts;
  try {
    contracts = await loadAllContractsV3(contractsDir);
  } catch (error) {
    console.error(`DRIFT CONTRACT_PARSE_FAIL: ${error.message}`);
    process.exit(1);
  }

  const audited = [];
  for (const c of contracts) {
    const lifecycle = c.doc.lifecycle || {};
    const status = lifecycle.status || 'MISSING';
    const authority = lifecycle.authority || 'MISSING';
    if (status === 'ACCEPTED' || status === 'PRIMARY' || authority === 'CANONICAL') {
      drift('LIFECYCLE_PREMATURE_AUTHORITY', `${c.id}: baseline 纪元不允许 ${status}/${authority}（须先过独立审计+签署晋升）`);
      continue;
    }
    if (isPopulatedPending(c.doc)) audited.push(c);
  }

  // R3 — capability 排他所有权（跨全部受审契约）
  const owner = {};
  for (const c of audited) {
    const keys = (c.doc.routing && c.doc.routing.capability_keys) || [];
    for (const key of keys) {
      if (!(key in CAPABILITY_MAP)) drift('CAPABILITY_KEY_UNREGISTERED', `${c.id}: 宣称未注册 capability key '${key}'`);
      else if (CAPABILITY_MAP[key] !== c.id) drift('BASELINE_OWNERSHIP_MISMATCH', `${c.id}: 宣称 '${key}'，但受控映射属主为 '${CAPABILITY_MAP[key]}'`);
      else if (owner[key]) drift('CAPABILITY_OWNERSHIP_CONFLICT', `'${key}' 被 ${owner[key]} 与 ${c.id} 同时宣称（排他性）`);
      else owner[key] = c.id;
    }
  }

  for (const c of audited) {
    const exec = c.doc.execution || {};
    const primary = exec.primary || {};
    const declaredAdapter = String(primary.adapter || '').toLowerCase();
    const clusters = (c.doc.routing && c.doc.routing.clusters) || [];

    // R1 — 运行时内核真相（签约 sidecar）
    const sidecarPath = path.join(manifestsDir, `${c.id}.yaml`);
    let sidecarText = null;
    try {
      sidecarText = await fs.readFile(sidecarPath, 'utf8');
    } catch (error) {
      drift('RUNTIME_KERNEL_UNRESOLVED', `${c.id}: 签约 sidecar 不可读 ${sidecarPath}`);
    }
    if (sidecarText !== null) {
      const runtimeKernel = runtimeKernelFromSidecar(sidecarText);
      if (!declaredAdapter) {
        // 契约不主张 adapter：仅当运行时声明了内核而契约沉默时 fail-closed（真相被隐瞒）
        if (runtimeKernel) drift('ASSET_CONTRACT_DRIFT', `${c.id}: V3 execution.primary.adapter 缺失，但运行时内核='${runtimeKernel}'（真相必须入契约）`);
      } else if (!runtimeKernel) {
        drift('RUNTIME_KERNEL_UNRESOLVED', `${c.id}: 契约主张 adapter='${declaredAdapter}'，sidecar verification 中提取不到 执行内核=/主路径=spawn 内核声明`);
      } else if (declaredAdapter !== runtimeKernel) {
        drift('ASSET_CONTRACT_DRIFT', `${c.id}: V3 primary.adapter='${declaredAdapter}' ≠ 运行时内核='${runtimeKernel}'（R1）`);
      }
      const entry = primary.entry || '';
      if (entry && !fsSync.existsSync(path.join(ROOT, entry))) drift('ASSET_CONTRACT_DRIFT', `${c.id}: execution.primary.entry 不存在: ${entry}`);
    }

    // R2 — security 语言覆盖收缩登记（引擎多语言 vs ruleset Python-only 是两件事）
    if (c.id === 'security') {
      const supported = exec.supported_languages || [];
      const unsupported = exec.unsupported_scopes || [];
      const engineLevelPythonOnly = supported.length === 1 && supported[0] === 'python'
        && unsupported.some((s) => String(s).trim() === 'multi-language' || String(s).trim() === '多语言');
      if (engineLevelPythonOnly) drift('ASSET_CONTRACT_DRIFT', `security: supported=[python]+unsupported 含 multi-language/多语言 = 引擎级 Python-only 僵尸声明，与 vendor 多语言 SAST 引擎矛盾（R2；收缩登记应表达为 ruleset 范围 + uncovered surfaced）`);
      const contractText = JSON.stringify(c.doc);
      if (!/uncovered/i.test(contractText)) drift('ASSET_CONTRACT_DRIFT', `security: 丢失能力收缩登记——未覆盖语言 surfaced 断言缺失（R2；混合目录 0 findings 假绿防护）`);
      if (!('forbidden_claims' in (c.doc.evidence || {}))) {
        drift('ASSET_CONTRACT_DRIFT', `security: 缺少 forbidden_claims 面（"扫了=安全"禁令缺失）`);
      }
    }

    // R4 — 簇成员与冻结基线一致（无 signed routing semantic change 通道 → 零容忍）
    const expected = expectedClustersFor(c.id);
    const declared = [...clusters].sort();
    if (JSON.stringify(declared) !== JSON.stringify([...expected].sort())) {
      drift('ASSET_CONTRACT_DRIFT', `${c.id}: V3 clusters [${declared.join(',')}] ≠ 基线成员 [${expected.join(',')}]（R4；变更需 signed routing semantic change）`);
    }
  }

  if (violations.length) {
    for (const v of violations) console.error(`DRIFT ${v.code}: ${v.detail}`);
    console.error(`CONTRACT_DRIFT_CHECK_FAIL violations=${violations.length}`);
    process.exit(1);
  }
  console.log(`CONTRACT_DRIFT_CHECK_OK audited=${audited.length} total_contracts=${contracts.length} rules=R0,R1,R2,R3,R4`);
}

main().catch((error) => {
  console.error(`DRIFT UNEXPECTED: ${error && error.stack ? error.stack : String(error)}`);
  process.exit(1);
});
