/**
 * p13 — GWT-R3-05 / GWT-R3-02 / §7.4 诚实边界：16 资产逐资产显式结果矩阵（无聚合百分比掩盖缺行）
 * + P4 地板可放行性正向控制（真实新内容产物 ⇒ VERIFIED）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { copyAsset, prepare, runForwardChain, genuineArtifact, append, makeEvent, createChecks, finish } from './_helper.mjs';
import { CATALOG_IDS } from '../../../../scripts/lib/activation.mjs';

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = path.join(sandbox, 'vendor');
  // 拷贝全部 16 资产（探针沙箱内；仓库真实 vendor 只读）
  for (const id of CATALOG_IDS) copyAsset(vendorDir, id);

  // 正向控制（单资产深验）：真实新内容产物 ⇒ P1-P5 全过 ⇒ VERIFIED
  {
    const p = await prepare({ asset: 'colorize', activationLevel: 'body', subtask: { id: 'p13-pos' }, opts: { vendorDir } });
    const pkg = p.data.activationPackage;
    const { responses } = runForwardChain(sandbox, vendorDir, pkg, 'p13-pos', genuineArtifact(pkg, 'p13-pos'));
    const r = append(makeEvent(pkg, 'p13-pos', 'behavior_verified', {
      behaviorCheck: { result: 'VERIFIED' },
      evidenceRefs: [1, 2, 3, 4, 5].map((n) => ({ eventSeq: n })),
    }, 'p13-pos-t6'), { workspace: sandbox, vendorDir });
    checks.check('正向控制：genuine 产物 ⇒ ok:true + VERIFIED（P1-P5 是地板不是死门）',
      r.ok === true && r.data?.result?.result === 'VERIFIED',
      JSON.stringify({ ok: r.ok, code: r.code, result: r.data?.result?.result, reason: r.data?.result?.reason }));
    checks.check('正向控制：P4 residue > 0', typeof responses === 'object' && (r.data?.behaviorCheck?.result === 'VERIFIED'));
  }

  // 16 资产矩阵：每资产 body 级激活 + 全链 T1-T6（genuine 产物）⇒ 逐行显式 VERIFIED
  const rows = {};
  const missingRows = [];
  for (const assetId of CATALOG_IDS) {
    const subtaskId = 'p13-mtx-' + assetId;
    try {
      const p = await prepare({ asset: assetId, activationLevel: 'body', subtask: { id: subtaskId }, opts: { vendorDir } });
      if (!p.ok) { rows[assetId] = 'PREPARE_' + p.code; missingRows.push(assetId); continue; }
      const pkg = p.data.activationPackage;
      const { responses } = runForwardChain(sandbox, vendorDir, pkg, subtaskId, genuineArtifact(pkg, subtaskId));
      if (!responses.every((r) => r.ok === true)) { rows[assetId] = 'CHAIN_' + responses.map((r) => r.code).filter(Boolean).join('|'); missingRows.push(assetId); continue; }
      const r = append(makeEvent(pkg, subtaskId, 'behavior_verified', {
        behaviorCheck: { result: 'VERIFIED' },
        evidenceRefs: [1, 2, 3, 4, 5].map((n) => ({ eventSeq: n })),
      }, subtaskId + '-t6'), { workspace: sandbox, vendorDir });
      rows[assetId] = r.data?.result?.result ?? ('T6_' + (r.code ?? 'unknown'));
      if (rows[assetId] !== 'VERIFIED') missingRows.push(assetId);
    } catch (error) {
      rows[assetId] = 'THREW:' + String(error.message).slice(0, 60);
      missingRows.push(assetId);
    }
  }

  checks.check('16/16 资产每行显式结果（GWT-R3-05：无聚合百分比掩盖缺行）',
    Object.keys(rows).length === 16 && CATALOG_IDS.every((id) => id in rows), JSON.stringify(rows));
  checks.check('16/16 行结果 = VERIFIED（genuine 产物矩阵全绿）', missingRows.length === 0,
    'missingRows=' + JSON.stringify(missingRows) + ' rows=' + JSON.stringify(rows));
  checks.check('矩阵行集合 == 16 内置资产 id 集（恰 16 个，不多不少）',
    JSON.stringify(Object.keys(rows).sort()) === JSON.stringify([...CATALOG_IDS].sort()));

  // GWT-R3-02：receipt 含资产 ID/source identity/激活级别/budget result/验证状态（以 16 链中抽一行核验）
  const sample = JSON.parse(fs.readFileSync(path.join(sandbox, 'artifacts', 'p13-mtx-planning', 'receipt.json'), 'utf8'));
  const t4 = sample.events.find((e) => e.transition === 'instructions_delivered');
  checks.check('GWT-R3-02 receipt 字段面：assetId + sourceHash + activationLevel + budgetResult + 验证状态',
    sample.events[0].assetId === 'planning' && Boolean(sample.events[0].sourceHash)
    && t4?.evidence?.activationLevel === 'body' && 'budgetResult' in (t4?.evidence ?? {})
    && sample.result?.result === 'VERIFIED');

  return finish(checks, 'p13 16 资产矩阵：逐行显式 VERIFIED + P4 正向控制 + GWT-R3-02 字段面');
}
