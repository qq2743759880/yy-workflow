/**
 * capability-derivation.mjs — W2-1 受控派生规则表（Ingress Mini-Contract D.1 rule 2 / D.2）
 *
 * 契约依据：plans/W2-0-ground-truth-ingress-contract-20260927.md
 *   - D.1 precedence：显式输入（1）> 受控派生（2）> 缺省（3，capability=null 走 legacy asset-only）。
 *   - D.2 vocabulary authority：CAPABILITY_MAP（activation.mjs）是唯一 capability key 事实源；
 *     本规则表**只允许产出 CAPABILITY_MAP 已有键**，禁复制第二份 taxonomy——
 *     同源校验由 checkDerivationRulesConsistency() 断言（构建时/探针调用，白名单内断言导出）：
 *     (a) 规则键 ⊆ CAPABILITY_MAP keys；(b) 键映射 asset ∈ ∪CLUSTERS[].candidates
 *     （即派生不可指向簇系统之外的 asset——cluster 交叉校验的静态前提）。
 *   - 禁自由文本语义匹配：无正则/无模糊/无打分，判定与 planner.route() 同款——
 *     受控关键词 `includes` 包含判定（normalize 小写后逐字包含），表序即优先序（确定性 tie-break）。
 *
 * 确定性：deriveCapability(同输入) 恒返回同 key；无命中返回 null（D.1 rule 3 → legacy 路径）。
 */

import { CAPABILITY_MAP } from './activation.mjs';
import { CLUSTERS } from './matrix.mjs';

/** capability ingress 守卫错误（fail-closed 专用；code ∈ CAPABILITY_UNKNOWN / CAPABILITY_CLUSTER_MISMATCH） */
export class CapabilityIngressError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CapabilityIngressError';
    this.code = code;
  }
}

/**
 * 受控派生规则表：受控关键词组 → CAPABILITY_MAP 已有键（10 键全登记，值域=activation.mjs 唯一事实源）。
 * 键序 = 派生优先序（首个命中的规则/关键词胜出）；关键词为受控词表登记项（CN/EN 混合，与 CLUSTERS
 * keywords 同风格），注册即冻结，不做语义扩展。每键映射 asset 均在 CLUSTERS[].candidates 内
 * （同源校验断言项 b，见 checkDerivationRulesConsistency）。
 */
export const DERIVATION_RULES = Object.freeze([
  Object.freeze({ key: 'openapi-validation', keywords: Object.freeze(['openapi 校验', 'openapi校验', 'openapi validation', '接口契约校验']) }),
  Object.freeze({ key: 'backend-validation', keywords: Object.freeze(['后端校验', 'backend validation']) }),
  Object.freeze({ key: 'security-audit', keywords: Object.freeze(['安全审计', 'security audit']) }),
  Object.freeze({ key: 'skill-security-scan', keywords: Object.freeze(['技能安全扫描', 'skill security scan']) }),
  Object.freeze({ key: 'code-implementation', keywords: Object.freeze(['代码实现', 'code implementation']) }),
  Object.freeze({ key: 'frontend-design', keywords: Object.freeze(['前端设计', 'frontend design']) }),
  Object.freeze({ key: 'prd-planning', keywords: Object.freeze(['prd 规划', 'prd规划', 'prd planning']) }),
  Object.freeze({ key: 'feature-breakdown', keywords: Object.freeze(['功能拆解', 'feature breakdown']) }),
  Object.freeze({ key: 'code-review', keywords: Object.freeze(['代码评审', 'code review']) }),
  Object.freeze({ key: 'full-sdlc-orchestration', keywords: Object.freeze(['全生命周期编排', 'sdlc 编排', 'sdlc编排', 'full sdlc orchestration']) }),
]);

/** 与 planner.route() 同款 normalize（小写化；undefined/null → 空串）。 */
function normalize(text) {
  if (text === undefined) text = '';
  if (text === null) text = '';
  return String(text).toLowerCase();
}

/**
 * 受控派生（D.1 rule 2）：taskText → { key, matchedKey } | null。
 * 判定 = 受控关键词 includes 包含（无正则/无模糊/无打分）；多命中按表序取首个（确定性）。
 * 无命中 → null（调用方回落 legacy asset-only，不造键）。
 */
export function deriveCapability(taskText) {
  const text = normalize(taskText);
  if (!text.trim()) return null;
  for (const rule of DERIVATION_RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(normalize(keyword))) return { key: rule.key, matchedKey: keyword };
    }
  }
  return null;
}

/**
 * capability key → CAPABILITY_MAP 解析 asset（D.2 单点，大小写不敏感精确匹配，无语义扩展）。
 * 未知键 → null（调用方 fail-closed）。
 */
export function resolveCapabilityAsset(key) {
  if (typeof key !== 'string') return null;
  const k = key.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(CAPABILITY_MAP, k) ? CAPABILITY_MAP[k] : null;
}

/**
 * 同源校验（D.2 禁复制 taxonomy 的机验落地；供探针/构建断言，纯函数零 IO）：
 *   (a) 每条规则 key ∈ CAPABILITY_MAP keys（派生不可产出值域之外的键）；
 *   (b) CAPABILITY_MAP[key] ∈ ∪ CLUSTERS[].candidates（映射 asset 必须存在于簇系统，
 *       cluster 交叉校验的静态前提；直接读 CLUSTERS，禁抄第二份清单）；
 *   (c) 结构断言：键不重复、每规则 ≥1 个非空关键词。
 * 返回 { consistent, violations[], rulesCount, capabilityMapKeys }。
 */
export function checkDerivationRulesConsistency() {
  const violations = [];
  const clusterAssets = new Set();
  for (const cluster of CLUSTERS) for (const asset of cluster.candidates) clusterAssets.add(asset);
  const seen = new Set();
  for (const rule of DERIVATION_RULES) {
    if (seen.has(rule.key)) violations.push('DUP_RULE_KEY:' + rule.key);
    seen.add(rule.key);
    if (!Array.isArray(rule.keywords) || rule.keywords.length === 0
      || rule.keywords.some((k) => typeof k !== 'string' || !k.trim())) {
      violations.push('EMPTY_KEYWORDS:' + rule.key);
    }
    if (!Object.prototype.hasOwnProperty.call(CAPABILITY_MAP, rule.key)) {
      violations.push('KEY_NOT_IN_CAPABILITY_MAP:' + rule.key);
    } else if (!clusterAssets.has(CAPABILITY_MAP[rule.key])) {
      violations.push('ASSET_NOT_IN_ANY_CLUSTER:' + rule.key + '->' + CAPABILITY_MAP[rule.key]);
    }
  }
  return {
    consistent: violations.length === 0,
    violations,
    rulesCount: DERIVATION_RULES.length,
    capabilityMapKeys: Object.keys(CAPABILITY_MAP).length,
  };
}
