/** 共享工厂：十项不变量合法候选 + 五键合法 baseline + 确定性时钟（fixtures 复现用） */
export const NOW = new Date('2026-09-17T02:55:55.000Z');

export function validCandidate(over = {}) {
  return {
    assetScope: 'frontend-design',
    trigger: 'C7 quality finding: asset freshness gap',
    rationale: 'compress stale section, no behavior change',
    acceptanceCriteria: 'three-dim non-regression vs baseline; independent verdict exit 0',
    changeset: ['vendor/frontend-design/SKILL.md#L40-60 rewrite'],
    riskAssessment: 'low; rollback target pinned; no route surface',
    baselineRef: 'baseline-20260917T025500Z',
    rollbackTarget: 'vendor/frontend-design@base-240f3fb',
    evidenceRefs: ['R3 receipt:rcpt-base', 'R8 finding:none'],
    proposerSession: 'sess_producer',
    proposerLimitations: [],
    ...over,
  };
}

export function validBaseline(over = {}) {
  return {
    structure: 'validate-structure PASS (baseline run, candidate excluded)',
    manifest: '16 entries, nestedSkillCount=46',
    receiptTerminal: 'last accepted receipt rcpt-base',
    ciSection: 'S1-S12 PASS (baseline)',
    rollbackTarget: 'vendor-all@base-240f3fb',
    ...over,
  };
}
