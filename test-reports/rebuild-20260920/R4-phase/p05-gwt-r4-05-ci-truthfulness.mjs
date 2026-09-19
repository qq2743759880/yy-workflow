/** p05 — GWT-R4-05 CI truthfulness（清单 R4-05ab + §7.2/§7.3）：三类分类边界（OQ-R4-8=A）+ summary 必含字段 + 成功字面只允许在无阻断失败时打印。 */
import phase from '../../../scripts/lib/phase.mjs';
import { shellOk, verdict } from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const c = (name, pass) => checks.push({ name, pass });
  void sandbox; // 本探针纯分类逻辑，无盘面写入

  // §7.2 分类矩阵逐行
  c('cls.contractFrozen', phase.classifyCiResult({ segment: 'contract check', code: 'CONTRACT_NOT_FROZEN' }) === 'BLOCKING_FAIL');
  c('cls.receiptInvalid', phase.classifyCiResult({ segment: 'R3 receipt 校验', code: 'RECEIPT_INVALID' }) === 'BLOCKING_FAIL');
  c('cls.gwtBehavior', phase.classifyCiResult({ segment: 'gwt-r4-01 behavior check', code: 1 }) === 'BLOCKING_FAIL');
  c('cls.assetQualityWarn', phase.classifyCiResult({ segment: 'S6 asset-call-rate', code: 1 }) === 'QUALITY_WARN');
  c('cls.unclassifiedFail', phase.classifyCiResult({ segment: 'S9 misc-undecided', code: 1 }) === 'QUALITY_FAIL');
  c('cls.pass', phase.classifyCiResult({ segment: 'S4 regression', code: 0 }) === 'PASS');

  // §7.3.2 summary 必含字段：每段 exit code、失败段名、是否阻断、artifact 路径
  const rows = [
    { name: 'S1 contract check', code: 'CONTRACT_NOT_FROZEN', artifactPath: 'artifacts/ci/contract.json' },
    { name: 'gwt-r4-02 behavior check', code: 1 },
    { name: 'S6 asset-call-rate', code: 1, artifactPath: 'artifacts/ci/asset-call-rate.json' },
    { name: 'S4 regression', code: 0 },
  ];
  const summary = phase.ciSummary(rows);
  c('sum.shellLikeShape', !!summary && typeof summary === 'object' && Array.isArray(summary.rows) && Array.isArray(summary.failedSegments) && typeof summary.successLiteralAllowed === 'boolean');
  c('sum.rowFields', summary.rows.every((r) => 'name' in r && 'exitCode' in r && 'classification' in r && 'blocking' in r && 'artifactPath' in r));
  c('sum.anyBlocking', summary.anyBlocking === true);
  c('sum.successLiteralDenied', summary.successLiteralAllowed === false); // blocking 失败后不得打印 CI PASS（GWT-R4-05）
  c('sum.failedListed', JSON.stringify(summary.failedSegments.sort()) === JSON.stringify(['S1 contract check', 'S6 asset-call-rate', 'gwt-r4-02 behavior check'].sort()));
  c('sum.nonBlockingRows', summary.rows.find((r) => r.name === 'S6 asset-call-rate').blocking === false && summary.rows.find((r) => r.name === 'S4 regression').blocking === false);

  // 全 mandatory 段 exit 0 ⇒ 成功字面允许
  const clean = phase.ciSummary([{ name: 'S1', code: 0 }, { name: 'S4', code: 0 }]);
  c('sum.cleanAllowsLiteral', clean.successLiteralAllowed === true && clean.anyBlocking === false && clean.failedSegments.length === 0);

  // 分类结果与 ciSummary 一致性冒烟（R10 evolution 只读消费该分类的接口面稳定）
  c('shell.na', shellOk({ ok: true, code: null, data: {}, evidence: {}, warnings: [] })); // 壳断言器自身冒烟

  return verdict(checks, 'gwt-r4-05');
}
