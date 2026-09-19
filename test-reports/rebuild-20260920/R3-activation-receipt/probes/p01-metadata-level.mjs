/**
 * p01 — 清单 R3-1 / 契约 §4.1 / GWT-R3-02：metadata 级激活（零正文零资源读取）。
 * GWT：Given task 只需目录/eligibility；When activationLevel=metadata；
 *      Then payload 无任何正文内容、body read count = 0 且 resource read count = 0、
 *      brief「方法论正文」段内为占位行（未激活正文）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { copyAsset, prepare, deliverBrief, createChecks, finish } from './_helper.mjs';

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = path.join(sandbox, 'vendor');
  copyAsset(vendorDir, 'colorize');

  const r = await prepare({
    asset: 'colorize',
    activationLevel: 'metadata',
    subtask: { id: 'r3-1-st', task: '仅评估 eligibility' },
    opts: { vendorDir },
  });
  checks.check('prepare ok', r.ok, r.code ?? '');
  const pkg = r.data.activationPackage;
  checks.check('activationLevel=metadata', pkg?.record?.activationLevel === 'metadata');
  checks.check('payload 无正文内容（不含 MANDATORY PREPARATION 段正文）',
    !String(pkg?.payload?.content ?? '').includes('Strategically introduce color'),
    'content head=' + String(pkg?.payload?.content ?? '').slice(0, 40));
  checks.check('payload 身份块含 name/description/phaseEligibility/sourceHash',
    pkg?.payload?.content.includes('name: colorize') && pkg?.payload?.content.includes('phaseEligibility:') && pkg?.payload?.content.includes(pkg.record.sourceHash));
  checks.check('body read count = 0（§4.1 机验口径）', pkg?.payload?.bodyReadCount === 0 && pkg?.record?.readCounts?.body === 0);
  checks.check('resource read count = 0', pkg?.payload?.resourceReadCount === 0 && pkg?.record?.readCounts?.resource === 0);
  checks.check('resources=[]（§3.1 非 resource 级）', Array.isArray(pkg?.record?.resources) && pkg.record.resources.length === 0);

  const { briefText } = deliverBrief(sandbox, 'r3-1-st', pkg);
  checks.check('brief 段内为占位行（未激活正文）', briefText.includes('## 方法论正文（资产全文）\n\n（未激活正文）'));
  checks.check('brief 标题锚逐字保留（宿主解析锚不动）', briefText.includes('## 方法论正文（资产全文）'));

  checks.check('evidence 含 {snapshot, catalogCacheIdentity, sourceHashEcho, inputEcho}（§2.1）',
    r.evidence?.snapshot && r.evidence?.catalogCacheIdentity && r.evidence?.sourceHashEcho && r.evidence?.inputEcho);
  checks.check('sourceHashEcho == record.sourceHash', r.evidence?.sourceHashEcho === pkg.record.sourceHash);
  checks.check('壳键集 {ok,code,data,evidence,warnings} 完全一致（§2）',
    ['ok', 'code', 'data', 'evidence', 'warnings'].every((k) => k in r) && r.ok === true && r.code === null);

  // 正文不落盘复核：沙箱 artifacts 不得出现正文内容
  const briefFile = fs.readFileSync(path.join(sandbox, 'artifacts', 'r3-1-st', 'brief.md'), 'utf8');
  checks.check('metadata 投递 brief 不含资产正文', !briefFile.includes('Strategically introduce color'));

  return finish(checks, 'p01 metadata 级激活：零正文零资源读取 + 占位行 + 壳/evidence 形状');
}
