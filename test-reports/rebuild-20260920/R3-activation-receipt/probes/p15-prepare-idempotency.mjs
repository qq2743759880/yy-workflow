/**
 * p15 — 契约 §2.1 幂等与只读保证：相同输入 + 相同 sourceHash ⇒ 相同 activationPackage
 * （preparedAt/estimatedAt 显式豁免并进 evidence 对账）；激活缓存写不改变返回数据、不写 vendor/；
 * prepare 不写 artifacts/state（本操作不产生执行产物）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { copyAsset, prepare, createChecks, finish, dirFingerprint } from './_helper.mjs';

function stripExempt(pkg) {
  const record = { ...pkg.record };
  delete record.preparedAt;
  const te = { ...record.tokenEstimate };
  delete te.estimatedAt; // estimatedAt 同为 generatedAt 类时间戳，§2.1 显式豁免
  record.tokenEstimate = te;
  return JSON.stringify({ record, payload: pkg.payload, briefFrame: pkg.briefFrame });
}

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = path.join(sandbox, 'vendor');
  copyAsset(vendorDir, 'planning');
  const fpBefore = dirFingerprint(vendorDir);

  const input = { asset: 'planning', activationLevel: 'body', subtask: { id: 'r3-15-st', task: 'planning task' }, opts: { vendorDir, now: new Date('2026-09-20T00:00:00Z') } };
  const r1 = await prepare(input);
  const r2 = await prepare(input);
  checks.check('同输入同 sourceHash ⇒ 两次 prepare 均 ok', r1.ok && r2.ok);
  checks.check('activationPackage 除豁免时间戳外字节等价（§2.1 幂等）',
    stripExempt(r1.data.activationPackage) === stripExempt(r2.data.activationPackage));
  checks.check('preparedAt 豁免字段存在且进 evidence 对账说明',
    Boolean(r1.data.activationPackage.record.preparedAt) && String(r1.evidence?.idempotencyExemption ?? '').includes('preparedAt'));

  // 激活缓存（可选增量扩展）：命中时返回数据不变（preparedAt 保持首次值），缓存文件不在 vendor/
  const ws = path.join(sandbox, 'ws-cache');
  fs.mkdirSync(ws, { recursive: true });
  const c1 = await prepare({ ...input, opts: { vendorDir, workspace: ws, useCache: true } });
  const c2 = await prepare({ ...input, opts: { vendorDir, workspace: ws, useCache: true } });
  checks.check('缓存命中 ⇒ 二次返回与首次等价（generatedAt 类时间戳豁免外字节等价，§2.1 缓存写不得改变返回数据）',
    stripExempt(c2.data.activationPackage) === stripExempt(c1.data.activationPackage));
  checks.check('缓存命中 ⇒ preparedAt 保持首次值（完全一致的豁免字段）',
    c2.data.activationPackage.record.preparedAt === c1.data.activationPackage.record.preparedAt);
  checks.check('缓存命中带 warnings 说明', c2.warnings.some((w) => w.includes('activation-cache 命中')));
  checks.check('缓存文件位于 <ws>/.tt-state/activation-cache.json（不写 vendor/）',
    fs.existsSync(path.join(ws, '.tt-state', 'activation-cache.json')));

  // 只读保证：vendor 零写入；prepare 不写 artifacts/state（无 workspace 时）
  checks.check('vendor/ 零写入（前后指纹一致）', dirFingerprint(vendorDir) === fpBefore);
  checks.check('prepare 不产生 artifacts/（§2.1 只读保证：artifacts 由适配器投递与 receipt 写入）',
    !fs.existsSync(path.join(sandbox, 'artifacts')));
  checks.check('prepare 不写 .tt-state/state.json', !fs.existsSync(path.join(sandbox, '.tt-state', 'state.json')));

  // sourceHash 变化 ⇒ 缓存不误命中（新 package；在 vendor 零写入断言之后注入漂移）
  fs.appendFileSync(path.join(vendorDir, 'planning', 'SKILL.md'), '\n<!-- content drift -->\n');
  const c3 = await prepare({ ...input, opts: { vendorDir, workspace: ws, useCache: true } });
  checks.check('sourceHash 变化 ⇒ 不复用旧缓存（新 sourceHash 新包）',
    c3.ok && c3.data.activationPackage.record.sourceHash !== c1.data.activationPackage.record.sourceHash);

  return finish(checks, 'p15 prepare 幂等：豁免时间戳 + 缓存不改返回数据 + vendor/artifacts 零写入');
}
