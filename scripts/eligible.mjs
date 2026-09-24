#!/usr/bin/env node
/**
 * eligible.mjs — AV-3 Asset Eligibility Resolver v1 CLI（新建，v3.5 第二波串行起步）。
 *
 * 纯查询零 LLM 零网络零写入：调用 scripts/lib/activation.mjs resolveAssetEligibility
 * （判定规则/输出契约见该函数头注：{selected_asset, eligible, reason[]}，fail-closed）。
 *
 * 用法：
 *   node scripts/eligible.mjs --asset <name> [--requirements a,b,c] [--constraints k=v,k2=v2] [--manifest <path>]
 *
 *   --asset         必填，name-based 主键（批 1 边界 v3.2 第三次确认）
 *   --requirements  可选提示，逗号分隔字符串数组
 *   --constraints   可选提示，k=v 逗号分隔对（值作为提示 token 参与 when_to_use/when_not_to_use 匹配）
 *   --manifest      可选，manifest 产物路径覆盖（默认 contracts/asset-manifest-v2.json）；
 *                   仅供探针指向临时目录副本（禁改仓库真产物），生产路径不要传
 *
 * 退出码：0 = 判定已产出（JSON 打印到 stdout；eligible=false 也是正常判定结果）；
 *         2 = 用法错误（stderr 具名）。判定过程异常（非 fail-closed 判定）→ stderr + 退出码 1。
 */
import { resolveAssetEligibility, ASSET_MANIFEST_V2_PATH } from './lib/activation.mjs';

function usage(message) {
  if (message) process.stderr.write('[eligible] ' + message + '\n');
  process.stderr.write('用法: node scripts/eligible.mjs --asset <name> [--requirements a,b] [--constraints k=v,k2=v2] [--manifest <path>]\n');
  process.exit(2);
}

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) usage('未知参数: ' + argv[i]);
  const key = argv[i].slice(2);
  if (!(key in args)) args[key] = [];
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) { args[key].push(true); continue; }
  args[key].push(next);
  i += 1;
}

if (!args.asset || !args.asset[0] || args.asset[0] === true) usage('--asset <name> 必填（name-based 主键）');
if (args.asset.length > 1) usage('--asset 只能出现一次');

const requirements = args.requirements && args.requirements[0] !== true
  ? String(args.requirements[0]).split(',').map((s) => s.trim()).filter(Boolean)
  : [];

const constraints = {};
if (args.constraints && args.constraints[0] !== true) {
  for (const pair of String(args.constraints[0]).split(',').map((s) => s.trim()).filter(Boolean)) {
    const idx = pair.indexOf('=');
    if (idx <= 0) usage('--constraints 项须为 k=v 形式: ' + pair);
    constraints[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
}

const manifestPath = args.manifest && args.manifest[0] !== true ? String(args.manifest[0]) : ASSET_MANIFEST_V2_PATH;

try {
  const result = await resolveAssetEligibility(
    { asset: String(args.asset[0]), requirements, constraints },
    { manifestPath }
  );
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (error) {
  process.stderr.write('[eligible] 判定异常（非 fail-closed 判定，属实现缺陷）: ' + (error.stack || error.message) + '\n');
  process.exit(1);
}
