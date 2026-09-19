/**
 * p04 — 清单 R3-4 / 契约 §2.1/§5.2/§6 / GWT-R3-01：token 预算纪律。
 * (a) 首轮无硬预算：不拦截、只登记估算；(b) 显式给限且超限 ⇒ block fail-closed
 * （ACTIVATION_BUDGET_EXCEEDED，不产出投递包）；truncate 路线已被 OQ-R3-3=A 排除。
 */
import fs from 'node:fs';
import path from 'node:path';
import { copyAsset, prepare, createChecks, finish } from './_helper.mjs';

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = path.join(sandbox, 'vendor');
  copyAsset(vendorDir, 'planning'); // R1 实测 body 较大资产之一（本轮以实测量为准）

  // (a) 首轮：不带 budget —— 不拦截，正常产出，只登记估算
  const a = await prepare({ asset: 'planning', activationLevel: 'body', subtask: { id: 'r3-4-a' }, opts: { vendorDir } });
  checks.check('(a) 无 budget ⇒ 不拦截', a.ok === true, a.code ?? '');
  const estimate = a.data?.activationPackage?.record?.tokenEstimate?.estimate;
  checks.check('(a) tokenEstimate 已登记（估算值 + 量尺 + 时点）', Number.isInteger(estimate) && estimate > 0);
  checks.check('(a) budget = {action: block} 且 limit 缺席', a.data?.activationPackage?.record?.budget?.action === 'block'
    && a.data?.activationPackage?.record?.budget?.limit === undefined);

  // (b) 显式给限且超限 ⇒ block fail-closed
  const b = await prepare({ asset: 'planning', activationLevel: 'body', subtask: { id: 'r3-4-b' }, budget: { limit: 10 }, opts: { vendorDir } });
  checks.check('(b) 超限 ⇒ ok:false + ACTIVATION_BUDGET_EXCEEDED（dev-plan:302 原码）',
    b.ok === false && b.code === 'ACTIVATION_BUDGET_EXCEEDED', JSON.stringify(b.code));
  checks.check('(b) fail-closed：无投递包产出', b.data?.activationPackage === undefined);
  checks.check('(b) 响应携带 limit/estimate/action 对账字段', b.data?.limit === 10 && b.data?.estimate === estimate && b.data?.action === 'block');

  // (c) 显式给限且未超限 ⇒ 正常产出
  const c = await prepare({ asset: 'planning', activationLevel: 'body', subtask: { id: 'r3-4-c' }, budget: { limit: estimate + 1000 }, opts: { vendorDir } });
  checks.check('(c) 未超限 ⇒ 正常产出投递包', c.ok === true && Boolean(c.data?.activationPackage));

  // (d) budget 形状非法 ⇒ INPUT_INVALID
  const d = await prepare({ asset: 'planning', activationLevel: 'body', subtask: { id: 'r3-4-d' }, budget: { limit: '很多' }, opts: { vendorDir } });
  checks.check('(d) budget.limit 非正数 ⇒ INPUT_INVALID', d.ok === false && d.code === 'INPUT_INVALID');

  // 无 truncate 路径：超限响应不携带 truncated/截断投递包（OQ-R3-3=A 排除 truncate）
  checks.check('(b) 无 truncate 诊断机制（截断路线已被决断排除）', !('truncated' in (b.data ?? {})));

  return finish(checks, 'p04 预算纪律：首轮无拦截只估算 + 显式超限 block fail-closed + 无 truncate');
}
