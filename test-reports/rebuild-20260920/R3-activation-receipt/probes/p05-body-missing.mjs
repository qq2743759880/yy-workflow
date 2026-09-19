/**
 * p05 — 清单 R3-5 / 契约 §2.1 body 缺失语义：manifest 不可读 ⇒ ASSET_BODY_MISSING fail-closed。
 * 现状对照（只描述缺陷）：asset.mjs:62-70 静默 body=''、prompt.mjs:17 注入占位文案继续投递
 * ——该 silent-degrade 在 bounded 模式下即 defect，本实现必须显式错误码 + 不投递。
 */
import fs from 'node:fs';
import path from 'node:path';
import { prepare, createChecks, finish } from './_helper.mjs';

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = path.join(sandbox, 'vendor');

  // fixture：资产目录存在但 manifest 文件被移除（探针 workspace 拷贝后删除，不动真库）
  fs.mkdirSync(path.join(vendorDir, 'colorize'), { recursive: true });
  fs.writeFileSync(path.join(vendorDir, 'colorize', 'README.txt'), 'manifest removed');

  const r = await prepare({ asset: 'colorize', activationLevel: 'body', subtask: { id: 'r3-5-st' }, opts: { vendorDir } });
  checks.check('body 缺失 ⇒ ok:false + ASSET_BODY_MISSING（dev-plan:302 原码）',
    r.ok === false && r.code === 'ASSET_BODY_MISSING', JSON.stringify(r.code));
  checks.check('fail-closed：不产出投递包', r.data?.activationPackage === undefined);
  checks.check('无占位文案继续投递（现状 prompt.mjs:17 行为在 bounded 下即 defect）',
    !JSON.stringify(r.data ?? {}).includes('资产正文缺失'));

  // catalog 层与 activation 层归类一致：id 在 16 白名单但文件缺失 ⇒ 同一 ASSET_BODY_MISSING（而非 ASSET_NOT_FOUND）
  checks.check('catalog 有 id 而文件缺失 ⇒ 归类为 ASSET_BODY_MISSING（两层归类不矛盾）', r.code === 'ASSET_BODY_MISSING');

  // 对照：16 白名单外的 id ⇒ ASSET_NOT_FOUND（catalog 视图缺失，与 body 缺失区分）
  fs.mkdirSync(path.join(vendorDir, 'ghost-asset'), { recursive: true });
  const r2 = await prepare({ asset: 'not-in-catalog', activationLevel: 'body', subtask: { id: 'r3-5-st' }, opts: { vendorDir } });
  checks.check('id 不在 catalog ⇒ ASSET_NOT_FOUND（与 body 缺失可区分）', r2.ok === false && r2.code === 'ASSET_NOT_FOUND');

  return finish(checks, 'p05 body 缺失：ASSET_BODY_MISSING fail-closed 不投递 + ASSET_NOT_FOUND 区分');
}
