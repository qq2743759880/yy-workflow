/**
 * p12 — 清单 R3-7/R3-8 / 契约 §7.8/§8.3：legacy 裸布尔 telemetry-only + receipt 缺失优雅降级。
 * (a) pre-R3 产物 {assetConsumed: true}（无 receipt 字段）：不崩溃、可读、计为 legacy 观察；
 *     不能满足 phase gate、不能升格 behavior_verified（OQ-R3-7=A）。
 * (b) receipt-missing（产物存在、无 receipt）：优雅降级为带诊断"未验证"视图（UNRESOLVED /
 *     RECEIPT_INCOMPLETE），不崩溃、不产生 PASS。
 */
import path from 'node:path';
import { createChecks, finish } from './_helper.mjs';
import { readLegacyArtifact, legacyCanSatisfyGate, verifyReceiptFile } from '../../../../scripts/lib/receipt.mjs';

export async function run({ sandbox }) {
  const checks = createChecks();

  // (a) legacy 裸布尔 true（清单 R3-7 的 exact input 形状）
  const legacyTrue = { assetId: 'review', assetConsumed: true }; // 无任何 receipt 字段
  let view = null;
  try {
    view = readLegacyArtifact(legacyTrue);
  } catch (error) {
    checks.check('(a) 不崩溃', false, String(error));
  }
  checks.check('(a) 可读不崩溃（handoff：degrade gracefully, not crash）', view?.readable === true);
  checks.check('(a) 计为 legacy 观察（consumed-true）', view?.legacyObserved === 'consumed-true');
  checks.check('(a) telemetry-only：不能升格为 behavior_verified（OQ-R3-7=A）', view?.canUpgradeToVerified === false);
  checks.check('(a) 不能单独或组合地满足 phase gate（gate 输入 = receipt 事件链判定，属 R4）',
    view?.gateEligible === false && legacyCanSatisfyGate() === false);

  // (a') 裸布尔 false 与字段缺失：同样可读、无 gate 资格
  const vFalse = readLegacyArtifact({ assetId: 'review', assetConsumed: false });
  const vMissing = readLegacyArtifact({}); // 字段缺失（清单 R3-8 形状）
  checks.check("(a') assetConsumed:false ⇒ 可读 + legacy 观察 consumed-false", vFalse.readable && vFalse.legacyObserved === 'consumed-false');
  checks.check("(a') 字段缺失 ⇒ legacyObserved=field-missing，无异常", vMissing.readable && vMissing.legacyObserved === 'field-missing');
  checks.check("(a') 两者均不得当 gate 输入 / 升格 verified",
    vFalse.gateEligible === false && vMissing.gateEligible === false && vFalse.canUpgradeToVerified === false && vMissing.canUpgradeToVerified === false);

  // (b) receipt-missing：subtask 产物目录存在但无 receipt.json（清单 R3-8）
  const r = verifyReceiptFile(sandbox, 'r3-8-st');
  checks.check('(b) receipt 缺失 ⇒ ok:false + RECEIPT_INCOMPLETE（§7.4 P1 / §7.5 N3）',
    r.ok === false && r.code === 'RECEIPT_INCOMPLETE', JSON.stringify(r.code));
  checks.check('(b) 优雅降级：带诊断的未验证视图（state=null, verified=false），流程不中断', r.data?.verified === false && r.data?.state === null);
  checks.check('(b) 不产生任何 PASS/verified 状态', r.data?.result === null && r.ok !== true);
  checks.check('(b) 诊断具名（reason 引用 receipt.json 路径）', String(r.data?.reason ?? '').includes('r3-8-st'));

  // (b') 手改损坏的 receipt.json 同样优雅降级（不崩溃、不 PASS）
  const fs = await import('node:fs');
  const dir = path.join(sandbox, 'artifacts', 'r3-8-corrupt');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'receipt.json'), '{not json');
  const r2 = verifyReceiptFile(sandbox, 'r3-8-corrupt');
  checks.check("(b') receipt.json 损坏 ⇒ RECEIPT_INVALID 优雅降级（不崩溃）", r2.ok === false && r2.code === 'RECEIPT_INVALID' && r2.data?.verified === false);

  return finish(checks, 'p12 legacy 裸布尔 telemetry-only + receipt 缺失/损坏优雅降级不崩溃');
}
