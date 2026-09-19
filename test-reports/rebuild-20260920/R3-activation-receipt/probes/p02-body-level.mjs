/**
 * p02 — 清单 R3-2 / 契约 §4.2 / §6：body 级激活（剥离 frontmatter 全文 + token 量尺估算）。
 * GWT：When activationLevel=body；Then payload = SKILL.md 按 asset.mjs:5-10 stripFrontmatter
 *      语义剥离 frontmatter 后全文；tokenEstimate 带回归量尺 method 与估算时点；resource 读取为 0。
 */
import fs from 'node:fs';
import path from 'node:path';
import { copyAsset, prepare, createChecks, finish, REPO_VENDOR } from './_helper.mjs';
import { stripFrontmatter } from '../../../../scripts/lib/activation.mjs';

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = path.join(sandbox, 'vendor');
  copyAsset(vendorDir, 'colorize');

  const r = await prepare({
    asset: 'colorize',
    activationLevel: 'body',
    subtask: { id: 'r3-2-st' },
    opts: { vendorDir },
  });
  checks.check('prepare ok', r.ok, r.code ?? '');
  const pkg = r.data.activationPackage;

  // 剥离语义与 asset.mjs:5-10 同构（C6 探针同机制，不得改变）
  const raw = fs.readFileSync(path.join(REPO_VENDOR, 'colorize', 'SKILL.md'), 'utf8');
  const expected = stripFrontmatter(raw);
  checks.check('payload = 剥离 frontmatter 后全文（与 asset.mjs stripFrontmatter 同形）',
    pkg?.payload?.content === expected || pkg?.payload?.content === expected.replace(/\n+$/, '').replace(/^\n+/, ''));
  checks.check('frontmatter 残留检查：payload 不含 name: colorize 头块',
    !pkg?.payload?.content.startsWith('---') && !pkg?.payload?.content.includes('user-invokable: true'));
  checks.check('正文完整（未被截断/改写）：含 MANDATORY PREPARATION 段与 Execution kernel 段',
    pkg?.payload?.content.includes('MANDATORY PREPARATION') && pkg?.payload?.content.includes('Execution kernel'));
  checks.check('resource read count = 0', pkg?.payload?.resourceReadCount === 0);

  const te = pkg?.record?.tokenEstimate;
  checks.check('tokenEstimate = {method, level, estimate, estimatedAt}（§3.1）',
    te && typeof te.method === 'string' && te.level === 'body' && Number.isInteger(te.estimate) && typeof te.estimatedAt === 'string');
  checks.check('tokenEstimate.method = cjk-weighted-regression-ruler（§6 量尺标识）', te?.method === 'cjk-weighted-regression-ruler');
  checks.check('估算值 > 0 且声明回归量尺（禁止表述为实测）',
    te?.estimate > 0 && r.warnings.some((w) => w.includes('非实测 token')));
  checks.check('budget = {action: block}，limit 缺席（首轮无硬预算，OQ-R3-1=A）',
    pkg?.record?.budget?.action === 'block' && pkg?.record?.budget?.limit === undefined);

  checks.check('anchor 提取与 prompt.mjs:79-82 同源（正文首个标题）', pkg?.record?.anchor === 'MANDATORY PREPARATION');
  checks.check('内核 token 提取与 prompt.mjs:88-90 同源（culori/chroma-js/poline）',
    JSON.stringify(pkg?.record?.kernelTokens) === JSON.stringify(['culori', 'chroma-js', 'poline']));
  checks.check('bodyPath = manifestPath（棕地布局如实）', pkg?.record?.bodyPath === pkg?.record?.manifestPath && pkg?.record?.bodyPath.endsWith('SKILL.md'));

  return finish(checks, 'p02 body 级激活：stripFrontmatter 同构全文 + 回归量尺估算 + anchor/内核登记');
}
