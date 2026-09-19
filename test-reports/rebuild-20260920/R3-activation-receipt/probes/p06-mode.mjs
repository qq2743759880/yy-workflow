/**
 * p06 — 契约 §8.1 三模式 / OQ-R3-6=A：mode 载体复用 YY_RECEIPT_MODE，不新增激活 flag；
 * mode 值非法 ⇒ ACTIVATION_MODE_UNSUPPORTED（禁止 silent fallback）；legacy 模式不含 receipt 事件写入。
 */
import fs from 'node:fs';
import path from 'node:path';
import { copyAsset, prepare, createChecks, finish } from './_helper.mjs';
import { receiptAppend } from '../../../../scripts/lib/receipt.mjs';
import { MODE_ENV } from '../../../../scripts/lib/activation.mjs';

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = path.join(sandbox, 'vendor');
  copyAsset(vendorDir, 'colorize');
  const prevEnv = process.env[MODE_ENV];
  try {
    // 非法 mode（显式输入）
    const rBad = await prepare({ asset: 'colorize', activationLevel: 'metadata', subtask: { id: 'p6' }, mode: 'yolo', opts: { vendorDir } });
    checks.check('mode=bogus ⇒ ACTIVATION_MODE_UNSUPPORTED（无 silent fallback）',
      rBad.ok === false && rBad.code === 'ACTIVATION_MODE_UNSUPPORTED');

    // 非法 mode（env 载体）
    process.env[MODE_ENV] = 'turbo';
    const rBadEnv = await prepare({ asset: 'colorize', activationLevel: 'metadata', subtask: { id: 'p6' }, opts: { vendorDir } });
    checks.check('env ' + MODE_ENV + '=bogus ⇒ ACTIVATION_MODE_UNSUPPORTED（复用同一 flag，OQ-R3-6=A）',
      rBadEnv.ok === false && rBadEnv.code === 'ACTIVATION_MODE_UNSUPPORTED');

    // 合法 mode（env=dual）生效
    process.env[MODE_ENV] = 'dual';
    const rDual = await prepare({ asset: 'colorize', activationLevel: 'metadata', subtask: { id: 'p6' }, opts: { vendorDir } });
    checks.check('env dual ⇒ 正常且 inputEcho.mode=dual', rDual.ok === true && rDual.evidence?.inputEcho?.mode === 'dual');

    // 缺省：input.mode 与 env 均未设 ⇒ 'dual' + warnings 显式说明（缺省值无冻结依据，登记判定）
    delete process.env[MODE_ENV];
    const rDef = await prepare({ asset: 'colorize', activationLevel: 'metadata', subtask: { id: 'p6' }, opts: { vendorDir } });
    checks.check('缺省 ⇒ dual + warnings 显式说明缺省判定', rDef.ok === true
      && rDef.warnings.some((w) => w.includes("按 'dual' 处理")));

    // legacy 模式：receipt.append 拒绝事件写入（§8.1：该模式即现状，不含 receipt 事件写入）
    const rLegacy = receiptAppend({
      event: { transition: 'discovered', subtaskId: 'p6-st', assetId: 'colorize', sourceHash: 'a'.repeat(64), session: 's', idempotencyKey: 'k', evidence: { catalogCacheIdentity: 'c', sourceHash: 'a'.repeat(64) } },
      mode: 'legacy',
      opts: { workspace: sandbox, vendorDir },
    });
    checks.check('legacy 模式 receipt.append ⇒ ACTIVATION_MODE_UNSUPPORTED（不写事件）',
      rLegacy.ok === false && rLegacy.code === 'ACTIVATION_MODE_UNSUPPORTED');
    checks.check('legacy 模式未产生 receipt.json', !fs.existsSync(path.join(sandbox, 'artifacts', 'p6-st', 'receipt.json')));

    // receipt.append 侧同样拒绝非法 mode
    const rBadMode2 = receiptAppend({
      event: { transition: 'discovered', subtaskId: 'p6-st2', assetId: 'colorize', sourceHash: 'a'.repeat(64), session: 's', idempotencyKey: 'k', evidence: { catalogCacheIdentity: 'c', sourceHash: 'a'.repeat(64) } },
      mode: 'nope',
      opts: { workspace: sandbox, vendorDir },
    });
    checks.check('receipt.append mode 非法 ⇒ ACTIVATION_MODE_UNSUPPORTED', rBadMode2.ok === false && rBadMode2.code === 'ACTIVATION_MODE_UNSUPPORTED');
  } finally {
    if (prevEnv === undefined) delete process.env[MODE_ENV];
    else process.env[MODE_ENV] = prevEnv;
  }

  return finish(checks, 'p06 三模式：YY_RECEIPT_MODE 复用 + 非法 mode fail-closed + legacy 无事件写入');
}
