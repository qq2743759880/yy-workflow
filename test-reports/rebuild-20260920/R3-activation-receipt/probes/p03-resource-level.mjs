/**
 * p03 — 清单 R3-3 / 契约 §4.3 / OQ-R3-5=A：resource 级激活（只加载 subtask 字段显式请求的资源；
 * 缺失 ⇒ RESOURCE_NOT_FOUND fail-closed，禁止静默跳过；未请求资源零读取——overfetch 回归防线）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { copyAsset, prepare, createChecks, finish } from './_helper.mjs';

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = path.join(sandbox, 'vendor');
  copyAsset(vendorDir, 'frontend-design', { withReference: true });

  const requested = ['reference/color-and-contrast.md'];
  const r = await prepare({
    asset: 'frontend-design',
    activationLevel: 'resource',
    subtask: { id: 'r3-3-st', requestedResources: requested }, // 请求来源 = subtask 字段（OQ-R3-5=A）
    opts: { vendorDir },
  });
  checks.check('prepare ok', r.ok, r.code ?? '');
  const pkg = r.data.activationPackage;
  checks.check('resources = 实际请求路径（subtask 字段 ∩ 存在）',
    JSON.stringify(pkg?.record?.resources) === JSON.stringify(requested));
  checks.check('resourceHashes 逐资源 sha256（§3.1）',
    typeof pkg?.record?.resourceHashes?.[requested[0]] === 'string' && pkg.record.resourceHashes[requested[0]].length === 64);
  checks.check('payload 含 body + 请求资源全文',
    pkg?.payload?.content.includes('## Resource: reference/color-and-contrast.md'));
  checks.check('未请求资源零读取（readCounts.resource == 请求数 = 1）', pkg?.payload?.resourceReadCount === 1);
  checks.check('payload 不含未请求资源内容（typography.md 不在投递内）',
    !pkg?.payload?.content.includes('## Resource: reference/typography.md'));

  // 缺失资源 ⇒ RESOURCE_NOT_FOUND（fail-closed，禁止静默跳过）
  const rMiss = await prepare({
    asset: 'frontend-design',
    activationLevel: 'resource',
    subtask: { id: 'r3-3-st', requestedResources: ['reference/no-such-file.md'] },
    opts: { vendorDir },
  });
  checks.check('缺失资源 ⇒ ok:false + RESOURCE_NOT_FOUND', rMiss.ok === false && rMiss.code === 'RESOURCE_NOT_FOUND', JSON.stringify(rMiss.code));
  checks.check('缺失时无投递包产出', rMiss.data?.activationPackage === undefined);

  // 路径逃逸 ⇒ RESOURCE_NOT_FOUND（防穿越，fail-closed）
  const rEscape = await prepare({
    asset: 'frontend-design',
    activationLevel: 'resource',
    subtask: { id: 'r3-3-st', requestedResources: ['../../../SKILL.md'] },
    opts: { vendorDir },
  });
  checks.check('路径逃逸 ⇒ RESOURCE_NOT_FOUND（不读资产根外文件）', rEscape.ok === false && rEscape.code === 'RESOURCE_NOT_FOUND');

  // resource 级但无显式请求 ⇒ INPUT_INVALID（§4.3：resource 级仅在显式请求时启用）
  const rEmpty = await prepare({
    asset: 'frontend-design',
    activationLevel: 'resource',
    subtask: { id: 'r3-3-st' },
    opts: { vendorDir },
  });
  checks.check('resource 级无显式请求 ⇒ INPUT_INVALID', rEmpty.ok === false && rEmpty.code === 'INPUT_INVALID');

  return finish(checks, 'p03 resource 级：显式请求投递 + resourceHashes + 缺失/逃逸 fail-closed');
}
