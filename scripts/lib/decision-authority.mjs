/**
 * decision-authority.mjs — C2.0 Decision Authority Component Manifest（契约冻结算法的实现单点）
 *
 * 契约依据：contracts/decision-contract-v1.yaml §decision_authority_digest
 *   digest = sha256( sorted( "<relative_path> <file_sha256>" ) )
 *   ——每组件一行 "<relative_path> <file_sha256>"，按整行字典序排序，"\n" 连接，UTF-8，sha256 hex。
 *
 * 职责边界（C1 冻结）：
 *   - 本模块 = 组件清单（角色+相对路径）与 digest 计算的唯一实现；
 *   - 生成器 scripts/build-decision-authority.mjs 把结果落档为
 *     contracts/generated/decision-authority-components.json（无时间戳，同树同字节）；
 *   - decision-core 每次决策用本模块对实际文件求 live digest，与落档清单比对得 identity_verified；
 *   - Foundation source_bundle_digest 是发布 provenance，不由本模块替代。
 *
 * 清单纪律：
 *   - 不盲收全仓文件；只登记字节真正影响 Decision 语义的输入；
 *   - 测试（test-decision-core.mjs CX-import）静态遍历 decision-core 的相对 import 闭包，
 *     闭包内任何 scripts/ 文件不在本清单 ⇒ FAIL（未声明语义依赖）；
 *   - vendor/** 正文是方法论载荷；METHODOLOGY.json 的策略/轻量描述影响决策，列入组件。正文由 activation 的
 *     source_hash 逐次锚定，不进本清单。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const DECISION_AUTHORITY_SCHEMA = 'yy/decision-authority@1';
export const COMMITTED_MANIFEST_REL = 'contracts/generated/decision-authority-components.json';

export const DECISION_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 9 份 V3 资产契约（lifecycle/version/contract_hash 投影源） */
const V3_ASSETS = ['be-validator', 'dev-planner', 'frontend-design', 'implementation', 'planning', 'review', 'sdlc', 'security', 'skill-sentinel'];

/**
 * 冻结组件清单（声明序即落档序；digest 按行排序计算，与声明序无关）。
 * role = 该文件对 Decision 语义的角色（机器可读，单一事实源）。
 */
export const DECISION_AUTHORITY_COMPONENTS = Object.freeze([
  { path: 'scripts/lib/decision-core.mjs', role: 'decision-core-semantics' },
  { path: 'scripts/lib/decision-authority.mjs', role: 'authority-manifest' },
  { path: 'scripts/lib/decision-plain.mjs', role: 'plain-projection-fn' },
  { path: 'contracts/generated/decision-plain-projection.json', role: 'plain-projection-table' },
  { path: 'scripts/tt-journey.mjs', role: 'journey-admission' },
  { path: 'scripts/lib/journey.mjs', role: 'journey-projection' },
  { path: 'scripts/lib/phase.mjs', role: 'execution-phase' },
  { path: 'scripts/lib/planner.mjs', role: 'routing' },
  { path: 'scripts/lib/capability-derivation.mjs', role: 'capability-derivation' },
  { path: 'scripts/lib/matrix.mjs', role: 'clusters' },
  { path: 'scripts/lib/activation.mjs', role: 'capability-map-eligibility-activation-brief' },
  { path: 'scripts/lib/receipt.mjs', role: 'receipt-validation' },
  { path: 'scripts/lib/manifest.mjs', role: 'catalog-build' },
  { path: 'scripts/lib/asset.mjs', role: 'manifest-read' },
  { path: 'contracts/asset-manifest-v2.json', role: 'governance-manifest' },
  { path: 'contracts/routing-contract.yaml', role: 'routing-contract' },
  { path: 'contracts/decision-contract-v1.yaml', role: 'decision-contract' },
  { path: 'contracts/receipt-v2-contract.yaml', role: 'receipt-v2-contract' },
  {path:'scripts/lib/methodology.mjs',role:'methodology-policy-and-descriptor'},
  {path:'scripts/lib/delegation-contract.mjs',role:'methodology-delivery-shared-validation'},
  {path:'contracts/delegation.schema.json',role:'methodology-delivery-schema-source'},
  {path:'contracts/generated/delegation-schema.mjs',role:'methodology-delivery-generated-schema'},
  ...V3_ASSETS.map(id=>({path:`vendor/${id}/METHODOLOGY.json`,role:`methodology-declaration:${id}`})),
  ...V3_ASSETS.map((id) => ({ path: `contracts/v3/${id}.contract-v3.yaml`, role: `asset-contract-v3:${id}` })),
]);

export class DecisionAuthorityError extends Error {
  constructor(message) { super(message); this.name = 'DecisionAuthorityError'; }
}

function sha256Hex(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

/** 组件规范行："<relative_path> <file_sha256>"（digest 输入单元，契约冻结口径） */
export function componentLine(entry) { return `${entry.path} ${entry.sha256}`; }

/**
 * computeDecisionAuthority(rootDir) — 对清单逐文件求 sha256 并按冻结算法求 digest。
 * 确定性：无时间戳、无环境输入；同树 ⇒ 同 digest；任一组件字节变化 ⇒ digest 变化。
 * 组件缺失/不可读 ⇒ DecisionAuthorityError（fail-closed，不静默跳过）。
 */
export function computeDecisionAuthority(rootDir = DECISION_REPO_ROOT) {
  const components = [];
  for (const decl of DECISION_AUTHORITY_COMPONENTS) {
    const abs = path.join(rootDir, decl.path);
    let buf;
    try { buf = fs.readFileSync(abs); } catch (error) {
      throw new DecisionAuthorityError(`决策权威组件不可读: ${decl.path}（${error.code ?? error.message}；fail-closed）`);
    }
    components.push({ path: decl.path, sha256: sha256Hex(buf), role: decl.role });
  }
  const digest = sha256Hex(components.map(componentLine).sort().join('\n'));
  return { schema: DECISION_AUTHORITY_SCHEMA, digest, components };
}

/** 读取落档清单（无则 null）；供 decision-core 比对 identity_verified。 */
export function readCommittedManifest(rootDir = DECISION_REPO_ROOT) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(rootDir, COMMITTED_MANIFEST_REL), 'utf8'));
    if (raw && raw.schema === DECISION_AUTHORITY_SCHEMA && typeof raw.digest === 'string' && Array.isArray(raw.components)) return raw;
    return null;
  } catch { return null; }
}
