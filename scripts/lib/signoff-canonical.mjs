/**
 * signoff-canonical.mjs — canonical Owner 签收单点读函数（第十五审计 GOV-AUTHORITY 任务三，F-033/F-034 连带）。
 *
 * canonical 裁定（派单任务三第 1 条）：Owner 签收状态唯一权威 = change record 的
 * `ownerApprovalReceipt.status`（SIGNED / PENDING_OWNER_RECEIPT / …）。已有 approvedBy/approvedAt/
 * approvalEvidence/SIGNED + 机器校验函数 change.mjs validateOwnerApprovalReceipt——本模块不另立
 * schema、不重定义校验，只提供单点读函数，消灭签收状态的多源分裂（split-brain）：
 *   - 历史缺陷 F-033：六张 SIGNED 单曾并行携带 `ownerSignOff` 冗余字段（status=PENDING 的占位签收位）
 *     与 ownerApprovalReceipt.status=SIGNED 并存——两字段同一事实两处状态，PENDING 占位随时间失真；
 *   - 处置：六张单 ownerSignOff 字段已物理删除（2026-09-26 GOV-AUTHORITY），此后任何读取方一律走
 *     canonicalSignoff() 单点。
 *
 * F-034 fail-closed 面：ownerSignOff 若在场且 ≠ ownerApprovalReceipt.status 投影值 → 视为 stale
 * 字段忽略并 warning（不静默采信、不抛错阻断读侧——读侧消费面语义；写侧违规由 change.mjs 最严类
 * 规则与审计面拦截）。若 ownerApprovalReceipt 缺失而 ownerSignOff 在场 → 一律不采信
 * （canonical 缺失 = 状态不可判定，返回 status='UNDETERMINED'，fail-closed 不猜）。
 *
 * voided 单（cr-20260926T000000Z-g0v3cons1，F-034 作废处置）：record.voided===true 时 canonical
 * 状态返回 'VOIDED'——作废单不承载有效签收状态（supersede-not-delete：单据本体保留，读侧可见但
 * 不作为任何生效语义的依据；r2 单 cr-20260926T010000Z-g0v3cons1-r2 为其取代单）。
 *
 * 本单产出物红线自检：signoff-canonical.mjs 为新建 scripts/lib/ 文件，不触 contracts/ 冻结正文
 * （isFrozenContractPath 面）——不构成 change.mjs 最严类规则的 CONTRACT 触发面。
 */

/** ownerApprovalReceipt.status 的已知词汇（登记面；枚举外值原样透传不伪造） */
export const KNOWN_SIGNOFF_STATUSES = Object.freeze(['SIGNED', 'PENDING_OWNER_RECEIPT', 'VOIDED', 'UNDETERMINED']);

function isBlank(v) { return v === undefined || v === null || (typeof v === 'string' && v.trim() === ''); }

/**
 * findOwnerApprovalReceipt(record) — 兼容三张 promotion 单的 receipt 落位形态：
 *   ①record.ownerApprovalReceipt（change 单顶层——canonical 位置）；
 *   ②record.promotionReceipt.ownerApprovalReceipt（AS-2-first/security(-r2) 晋升单内层）；
 *   ③record.promotionReceipt.ownerApprovalReceipt 缺失时回落 record.promotionReceipt
 *     内携带 status/approvalEvidence 的 receipt 形对象（AS-2-sentinel 形态）。
 * 兼容读不等于旁路：读取的仍是 ownerApprovalReceipt 形（status 为权威字段），只是落位深度兼容。
 */
export function findOwnerApprovalReceipt(record) {
  if (!record || typeof record !== 'object') return null;
  if (record.ownerApprovalReceipt && typeof record.ownerApprovalReceipt === 'object' && !Array.isArray(record.ownerApprovalReceipt)) {
    return record.ownerApprovalReceipt;
  }
  const pr = record.promotionReceipt;
  if (pr && typeof pr === 'object') {
    if (pr.ownerApprovalReceipt && typeof pr.ownerApprovalReceipt === 'object' && !Array.isArray(pr.ownerApprovalReceipt)) {
      return pr.ownerApprovalReceipt;
    }
    // sentinel 形态：promotionReceipt.fiveTuple.runtime_binding 携带 SIGNED receipt 形（status/approvalEvidence）
    const rb = pr.fiveTuple && pr.fiveTuple.runtime_binding;
    if (rb && typeof rb === 'object' && !Array.isArray(rb) && typeof rb.status === 'string') return rb;
    if (typeof pr.status === 'string' && (pr.approvalEvidence || pr.approvedBy)) return pr;
  }
  return null;
}

/**
 * canonicalSignoff(record) — 单点读函数。
 * @param {object} record — change record 解析对象（contracts/discrepancies/cr-*.json）。
 * 返回 {
 *   status,            // canonical 签收状态（ownerApprovalReceipt.status 投影；VOIDED/UNDETERMINED 特判）
 *   authorityField,    // 'ownerApprovalReceipt.status'
 *   approvalId,        // 投影（可 null）
 *   approvedBy, approvedAt, approvalEvidence,  // 投影（可 null）
 *   staleFieldsIgnored,// 被忽略的 stale 字段清单（ownerSignOff 等冗余签收位）
 *   warnings,          // stale/缺失诊断（读侧 warning，不阻断）
 * }
 */
export function canonicalSignoff(record) {
  const warnings = [];
  const staleFieldsIgnored = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { status: 'UNDETERMINED', authorityField: 'ownerApprovalReceipt.status', approvalId: null, approvedBy: null, approvedAt: null, approvalEvidence: null, staleFieldsIgnored, warnings: ['record 非对象形——canonical 不可判定（fail-closed）'] };
  }
  // F-034 作废单：voided 单不承载有效签收状态
  if (record.voided === true) {
    if (record.ownerSignOff !== undefined) staleFieldsIgnored.push('ownerSignOff');
    return {
      status: 'VOIDED',
      authorityField: 'ownerApprovalReceipt.status',
      approvalId: null, approvedBy: null, approvedAt: null, approvalEvidence: null,
      staleFieldsIgnored,
      warnings: ['record.voided=true——本单已作废（supersede-not-delete），不承载有效签收状态；取代单见 supersededBy/replacement 指针'],
    };
  }
  const receipt = findOwnerApprovalReceipt(record);
  const hasReceipt = receipt && typeof receipt === 'object' && !Array.isArray(receipt) && !isBlank(receipt.status);
  if (!hasReceipt) {
    // canonical 缺失：ownerSignOff 一律不采信（防止用冗余字段顶替 canonical——F-033 同型缺陷回潮）
    if (record.ownerSignOff !== undefined) {
      staleFieldsIgnored.push('ownerSignOff');
      warnings.push('ownerApprovalReceipt 缺失或无 status——ownerSignOff 在场但不采信（canonical 缺失=状态不可判定 UNDETERMINED，fail-closed 不以冗余字段顶替）');
    } else {
      warnings.push('ownerApprovalReceipt 缺失或无 status——canonical 签收状态不可判定（UNDETERMINED）');
    }
    return { status: 'UNDETERMINED', authorityField: 'ownerApprovalReceipt.status', approvalId: null, approvedBy: null, approvedAt: null, approvalEvidence: null, staleFieldsIgnored, warnings };
  }
  const status = receipt.status;
  // F-033 stale 字段忽略：ownerSignOff 在场且 ≠ 投影值 → 忽略 + warning
  if (record.ownerSignOff !== undefined && record.ownerSignOff !== null) {
    const stale = record.ownerSignOff;
    const staleStatus = stale && typeof stale === 'object' ? stale.status : stale;
    if (String(staleStatus) !== String(status)) {
      staleFieldsIgnored.push('ownerSignOff');
      warnings.push(`ownerSignOff.status=${JSON.stringify(staleStatus ?? null)} ≠ canonical ownerApprovalReceipt.status=${JSON.stringify(status)}——stale 冗余签收位忽略（F-033；canonical 单点=ownerApprovalReceipt.status）`);
    }
    // 投影一致也属冗余字段（六张单清理后不应再出现）——提示但不误报 stale
    else {
      warnings.push('ownerSignOff 在场且与 canonical 投影一致——冗余字段（应清理；读取以 ownerApprovalReceipt.status 为准）');
    }
  }
  return {
    status,
    authorityField: 'ownerApprovalReceipt.status',
    approvalId: receipt.approvalId ?? record.approvalId ?? null,
    approvedBy: receipt.approvedBy ?? null,
    approvedAt: receipt.approvedAt ?? null,
    approvalEvidence: receipt.approvalEvidence ?? null,
    staleFieldsIgnored,
    warnings,
  };
}

/**
 * canonicalSignoffOfAll(records) — 批量投影（清点/自测用）：records 数组逐条 canonicalSignoff，
 * 附 changeRecordId 便于具名清点。
 */
export function canonicalSignoffOfAll(records) {
  const out = [];
  for (const rec of Array.isArray(records) ? records : []) {
    const r = canonicalSignoff(rec);
    out.push({ changeRecordId: rec && rec.changeRecordId, ...r });
  }
  return out;
}

export default { canonicalSignoff, canonicalSignoffOfAll, findOwnerApprovalReceipt, KNOWN_SIGNOFF_STATUSES };
