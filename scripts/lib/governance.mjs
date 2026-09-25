/**
 * GW-1 治理层运行时接线 — governance-skills/ 消费单点（纯函数，零 LLM / 零网络）。
 *
 * 层定位（Owner 裁定，见 governance-skills/VENDORED.md + plans/superpowers-selection-v1.json）：
 * governance-skills/ 是治理增强层（系统能力，agent 行为规则），独立于 16 业务资产注册表——
 * 不进 CLUSTERS candidates、不进 asset-manifest-v2.json、不占 16 槽位。本模块是唯一运行时
 * 消费入口：按阶段把 Owner 圈选的 3 个治理技能正文注入 executor brief（接线点 A）或在失败
 * 路径给出指路行（接线点 B）。vendored 文件永不手改（升级走 git pull 换 pin + 重新快照）。
 *
 * Owner 圈选绑定（三技能，2 缓）：
 *   implementation  → test-driven-development        （激活：stage_7 或 migration shadow run 前）
 *   verification    → verification-before-completion （激活：before_final_receipt，agent 宣称完成之前）
 *   failure_recovery→ systematic-debugging           （激活：gate_failed / regression_failed / migration_failed）
 *
 * 护栏（派单 GW-1）：
 *   - 5KB 截断上限：注入正文超 5120 字节截断并标注 [truncated]（防 prompt 膨胀；
 *     实测 TDD 9578B / systematic-debugging 9465B 恒截断，verification 3646B 全文注入）；
 *   - governance-skills/ 缺失/改名 → governanceFor 返回 null，所有接线点静默跳过（向后兼容）；
 *   - YY_ACTIVATION=lib 帧路径跳过接线点 A 注入：activation.prepare 的 payloadSha256 按 vendor
 *     原始正文计算（T4 谓词 (b) 同源耦合），注入会引入潜在 hash 漂移——lib 模式保持投递面纯净；
 *   - 失败路径（接线点 B）只指路不注入全文（防 prompt 爆炸——GW-1 派单明确裁定）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** governance-skills/ 默认根（随包副本；探针可用 opts.governanceDir 覆盖指向沙箱副本）。 */
export const DEFAULT_GOVERNANCE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'governance-skills');

/** 注入正文截断上限：5KB（派单 GW-1 截断护栏）。 */
export const MAX_GOVERNANCE_BODY_BYTES = 5 * 1024;

/** Owner 圈选绑定单点（VENDORED.md「入选清单与绑定」表 + superpowers-selection-v1.json 逐字口径）。 */
const BINDINGS = {
  implementation: { skill: 'test-driven-development', activation: 'stage_7 或 migration shadow run 前' },
  verification: { skill: 'verification-before-completion', activation: 'before_final_receipt（agent 宣称完成之前）' },
  failure_recovery: { skill: 'systematic-debugging', activation: ['gate_failed', 'regression_failed', 'migration_failed'] },
};

/**
 * 子任务资产 → 治理阶段（接线点 A 分类口径，单点声明）。
 * 活面 = AS-1 drop 收缩后 CLUSTERS 全部 9 个 candidates（scripts/lib/matrix.mjs，2026-09-25），
 * 逐资产判定，零留空引用：
 *   - verification（验收/验证段）：be-validator / review 为 matrix 簇前置明示的验收子任务；
 *     sdlc 与 be-validator/review 同验收 phase 组；skill-sentinel 为安全扫描器（T5 扫描面）。
 *   - implementation（实现/产出/加固段）：implementation 产出代码实现；frontend-design 产出前端
 *     实现；security 产出加固修复（T2/T5 加固段）。
 *   - 未列资产（dev-planner / planning 等规划类）不注入——保守缺省，未列即零行为。
 */
const STAGE_BY_ASSET = {
  'be-validator': 'verification',
  'review': 'verification',
  'sdlc': 'verification',
  'skill-sentinel': 'verification',
  'implementation': 'implementation',
  'frontend-design': 'implementation',
  'security': 'implementation',
};

/** 资产名 → 治理阶段（未列资产 → null，不注入）。探针用。 */
export function stageForAsset(asset) {
  return STAGE_BY_ASSET[String(asset || '')] || null;
}

/** 剥离 frontmatter（--- 头块）——与 lib/asset.mjs 业务资产正文同口径；无 frontmatter 原样返回。 */
function stripFrontmatter(text) {
  const clean = String(text).replace(/\r\n/g, '\n');
  const match = clean.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? clean.slice(match[0].length) : clean;
}

/** 读 governance-skills/<skill>/SKILL.md 正文；缺失/不可读 → null（向后兼容静默跳过）。 */
function readSkillBody(skill, governanceDir) {
  try {
    const raw = stripFrontmatter(fs.readFileSync(path.join(governanceDir, skill, 'SKILL.md'), 'utf8'));
    return raw && raw.trim() ? raw : null;
  } catch (error) { /* ENOENT/EISDIR/EACCES：治理层缺失 = 静默跳过（不阻断编排） */ return null; }
}

/** 5KB 截断护栏：超限按字节截断（UTF-8 安全，去边界残字符）并标注 [truncated]。 */
function truncateBody(raw, skill) {
  const buf = Buffer.from(raw, 'utf8');
  if (buf.length <= MAX_GOVERNANCE_BODY_BYTES) return { body: raw, truncated: false };
  const sliced = buf.subarray(0, MAX_GOVERNANCE_BODY_BYTES).toString('utf8').replace(/\uFFFD+$/, '');
  return {
    body: sliced + '\n\n[truncated] 治理技能正文超 5KB 注入上限（原始 ' + buf.length + 'B），已截断防 prompt 膨胀——全文见 governance-skills/' + skill + '/SKILL.md',
    truncated: true,
  };
}

/**
 * 治理技能查询（纯函数）：stage → {skill, body, truncated, binding} | null。
 * @param {string} stage  — 'implementation' | 'verification' | 'failure_recovery'
 * @param {string} [eventType] — 激活事件；binding.activation 为枚举数组时严格匹配（不在枚举内 →
 *        null，fail-closed）；字符串型激活时机为阶段级，eventType 仅作登记不过滤。
 * @param {{governanceDir?: string}} [opts] — governanceDir 覆盖（探针沙箱用；缺省随包 governance-skills/）。
 */
export function governanceFor(stage, eventType, opts) {
  const binding = BINDINGS[stage];
  if (!binding) return null;
  if (Array.isArray(binding.activation) && eventType !== undefined && eventType !== null && !binding.activation.includes(eventType)) return null;
  const raw = readSkillBody(binding.skill, (opts && opts.governanceDir) || DEFAULT_GOVERNANCE_DIR);
  if (raw === null) return null;
  const { body, truncated } = truncateBody(raw, binding.skill);
  return { skill: binding.skill, body, truncated, binding: { stage, activation: binding.activation } };
}

function activationLabel(activation) { return Array.isArray(activation) ? activation.join('/') : String(activation); }

/**
 * 接线点 B 专用：失败路径 GOVERNANCE 指路行（不返回正文——失败时不注入全文，防 prompt 爆炸）。
 * 行格式（GW-1 派单指定前缀，逐字可 grep）：
 *   GOVERNANCE: systematic-debugging 正文见 governance-skills/systematic-debugging/SKILL.md（…）
 * governance-skills 缺失 → null（调用方静默跳过）。
 */
export function governancePointerLine(stage, eventType, opts) {
  const gov = governanceFor(stage, eventType, opts);
  if (!gov) return null;
  return 'GOVERNANCE: ' + gov.skill + ' 正文见 governance-skills/' + gov.skill + '/SKILL.md'
    + '（绑定 ' + gov.binding.stage + '，激活时机=' + activationLabel(gov.binding.activation) + '）';
}

/**
 * 接线点 A 专用：治理技能节文本（brief 尾部追加；首行标注格式为派单指定逐字格式）。
 * governance-skills 缺失 → null。
 */
export function governanceBriefSection(stage, opts) {
  const gov = governanceFor(stage, undefined, opts);
  if (!gov) return null;
  return [
    '--- governance: ' + gov.skill + ' ---',
    '',
    gov.body,
    '',
    '（治理技能注入：' + gov.skill + '，绑定阶段=' + stage + '，激活时机=' + activationLabel(gov.binding.activation)
      + '；全文见 governance-skills/' + gov.skill + '/SKILL.md' + (gov.truncated ? '；本节正文超 5KB 上限已截断' : '') + '）',
  ].join('\n');
}

/**
 * 接线点 A：按 plan 子任务角色包装 assets Map，把治理技能节追加进对应资产正文尾部。
 * 消费机制：prompt 适配器（lib/adapters/prompt.mjs）从 assets.get(asset).body 渲染 brief
 * 「方法论正文（资产全文）」段——本包装让治理节随该段注入 brief，而不改适配器本体。
 *   - 消费证据安全性：锚点取资产正文首标题、kernel 提取取 Execution kernel 段（均前缀匹配），
 *     尾部追加不改变 assetConsumed 判定；
 *   - 原资产对象不改写（浅克隆后追加），vendor/ 与 assets-cache.json 零污染；
 *   - 零注入（无命中资产 / governance-skills 缺失 / lib 帧路径）→ 原样返回同一 Map（零行为面）；
 *   - 非 Map 容器形态 → 原样返回（向后兼容，不猜形态）。
 * @param {Map<string,{name,body,meta}>} assets — loadAssets 产物
 * @param {Array<{asset:string}>} subtasks — plan.subtasks
 * @param {{governanceDir?: string, env?: object}} [opts]
 */
export function governPlanAssets(assets, subtasks, opts) {
  if (!assets || typeof assets.get !== 'function' || typeof (assets) !== 'object') return assets;
  const env = (opts && opts.env) || process.env;
  if (String(env.YY_ACTIVATION || '').trim().toLowerCase() === 'lib') return assets; // 见文件头护栏第 3 条
  const sections = new Map();
  for (const s of Array.isArray(subtasks) ? subtasks : []) {
    if (!s || typeof s.asset !== 'string' || !s.asset || sections.has(s.asset)) continue;
    const stage = STAGE_BY_ASSET[s.asset];
    if (!stage) continue;
    const section = governanceBriefSection(stage, opts);
    if (section) sections.set(s.asset, section);
  }
  if (sections.size === 0) return assets;
  const out = new Map(assets);
  for (const [name, section] of sections) {
    const a = assets.get(name);
    if (!a || typeof a.body !== 'string') continue;
    out.set(name, Object.assign({}, a, { body: a.body + '\n\n' + section }));
  }
  return out;
}
