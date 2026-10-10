#!/usr/bin/env node
/**
 * build-decision-transport.mjs — C3-R1-2 V2 传输身份清单生成器（thin，单点在 lib）
 *
 * 用法：
 *   node scripts/build-decision-transport.mjs           # 写 contracts/generated/decision-transport-manifest.json
 *   node scripts/build-decision-transport.mjs --check   # 只比对；drift ⇒ exit 3
 *
 * 覆盖面 = 能改变 V2 传输行为的全部文件（工具暴露/绑定/授权交接/错误白名单/IO 界/
 * 语义身份核验/挂载行为）。digest 算法与语义清单同式但**相互独立**：
 * transport_digest ≠ decision_authority_digest，两者永不合并（C3-R1-2）。
 * 产物无时间戳；同树 ⇒ 字节等价。期望值只存在于已提交清单（被篡改的校验器
 * 无法静默重定义 pin——其自身也是组件）。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_REL = 'contracts/generated/decision-transport-manifest.json';

/** V2 传输组件（冻结清单；新增=显式登记） */
export const TRANSPORT_COMPONENTS = Object.freeze([
  { path: 'scripts/decision-bridge.mjs', role: 'node-transport-entry' },
  { path: 'scripts/lib/methodology-source-read.mjs', role: 'controlled-methodology-source-transport' },
  { path: 'integrations/yy-web-mcp/decision_bridge.py', role: 'python-bounded-client' },
  { path: 'integrations/yy-web-mcp/binding_boundary.py', role: 'workspace-authorization-boundary' },
  { path: 'integrations/yy-web-mcp/auth.py', role: 'oauth-resource-authorization' },
  { path: 'integrations/yy-web-mcp/mcp_envelope.py', role: 'typed-mcp-envelope' },
  { path: 'integrations/yy-web-mcp/tools_v2.py', role: 'v2-tool-registry' },
  { path: 'integrations/yy-web-mcp/server.py', role: 'dual-mount-assembly' },
]);

export function computeTransportDigest(root = ROOT) {
  const lines = [];
  const components = [];
  for (const decl of TRANSPORT_COMPONENTS) {
    const buf = fs.readFileSync(path.join(root, decl.path));
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    lines.push(`${decl.path} ${sha256}`);
    components.push({ path: decl.path, sha256, role: decl.role });
  }
  const digest = crypto.createHash('sha256').update(lines.sort().join('\n'), 'utf8').digest('hex');
  return { schema: 'yy/decision-transport@1', digest, components };
}

const check = process.argv.includes('--check');
const live = computeTransportDigest(ROOT);
if (check) {
  let committed = null;
  try { committed = JSON.parse(fs.readFileSync(path.join(ROOT, OUT_REL), 'utf8')); } catch { /* missing */ }
  if (!committed || committed.digest !== live.digest) {
    console.error(`DECISION_TRANSPORT_DRIFT: committed ${(committed && committed.digest || 'MISSING').slice(0, 12)}… ≠ live ${live.digest.slice(0, 12)}…`);
    process.exit(3);
  }
  console.log('DECISION_TRANSPORT_OK ' + live.digest + ' components=' + live.components.length);
  process.exit(0);
}
const file = path.join(ROOT, OUT_REL);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(live, null, 2) + '\n', 'utf8');
console.log('WROTE ' + OUT_REL + ' digest=' + live.digest + ' components=' + live.components.length);
