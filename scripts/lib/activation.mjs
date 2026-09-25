/**
 * activation.mjs — R3: Activation / Delivery（C-R3-activation 冻结契约实现）
 *
 * 操作面（仅契约 §2 已列操作，不新增操作名）：activation.prepare。
 * 统一响应壳：{ok, code, data, evidence, warnings}；错误码仅六：
 *   ACTIVATION_BUDGET_EXCEEDED / ASSET_BODY_MISSING / RESOURCE_NOT_FOUND   [计划输入 dev-plan:302 原码]
 *   ASSET_NOT_FOUND / INPUT_INVALID / ACTIVATION_MODE_UNSUPPORTED          [草案， C-R2 §6.2 同名/同风格码]
 *
 * 三级激活（§4）：metadata（零正文零资源读取）/ body（剥离 frontmatter 全文，默认投递级别，
 *   OQ-R3-4=A hybrid 策略）/ resource（body + 仅 subtask 字段显式请求的 reference/ 资源，
 *   缺失 ⇒ RESOURCE_NOT_FOUND fail-closed，禁止静默跳过——OQ-R3-5=A）。
 *
 * 预算纪律（OQ-R3-1/3=A）：首轮不设硬 token 预算，只登记 §6 量尺估算值（数值 [待补充]，
 *   等 Owner 给数，禁止编造）；当且仅当调用方显式提供 budget.limit 且估算超限 ⇒ block
 *   fail-closed（ACTIVATION_BUDGET_EXCEEDED，不产出投递包）；truncate 路线已被决断排除。
 *
 * token 量尺（§6，OQ-R3-2=A）：CJK×0.75 + 非CJK÷4 仅作回归量尺（scripts/token-audit.mjs:24-32
 *   同口径），禁止在任何输出中表述为实测 token。
 *
 * 只读保证（§2.1）：不修改 vendor/**、scripts/**、state、journey、artifacts
 *   （brief.md 由适配器投递写出——T4 触发条件，本操作只产出 activationPackage）。
 *
 * 重建说明（rebuild-20260920）：本文件为按冻结契约 contracts/C-R3-activation.md 的行为级重建，
 *   原文件已丢失、无原始 sha256 可对照；行为级验收探针见
 *   test-reports/rebuild-20260920/R3-activation-receipt/（RESULTS.md 登记全部重建判定与偏差）。
 *   旧内核形状与契约冲突处以契约为准（如 asset.mjs:62-70 缺失静默 body='' 的 silent-degrade
 *   在 bounded 模式下即 defect——本实现按 §2.1 改为显式 ASSET_BODY_MISSING）。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildManifest } from './manifest.mjs';
import { readManifest } from './asset.mjs';
import { CLUSTERS } from './matrix.mjs';

// ---------------------------------------------------------------------------
// 常量（契约 §2/§4/§5/§6/§8）
// ---------------------------------------------------------------------------

/** 9 个 YY 内置资产 id（drop 7 后幸存 vendor/ depth-1 目录；名单权威=manifest，此处仅为 catalog 视图静态断言） */
export const CATALOG_IDS = Object.freeze([
  'dev-planner', 'frontend-design', 'implementation', 'planning',
  'review', 'sdlc', 'security', 'skill-sentinel', 'be-validator',
]);

/** 三级激活级别（§4）；级别选择策略 = hybrid（OQ-R3-4=A）：body 为默认投递级别 */
export const ACTIVATION_LEVELS = Object.freeze(['metadata', 'body', 'resource']);
export const DEFAULT_ACTIVATION_LEVEL = 'body';

/** 三模式（§8.1，PRD0 §9.2）；mode 载体 flag 复用 YY_RECEIPT_MODE，不新增激活 flag（OQ-R3-6=A） */
export const MODES = Object.freeze(['legacy', 'dual', 'strict']);
export const MODE_ENV = 'YY_RECEIPT_MODE';

/** 错误码仅六（§2.1 错误行全集） */
export const ERROR_CODES = Object.freeze([
  'ACTIVATION_BUDGET_EXCEEDED', 'ASSET_BODY_MISSING', 'RESOURCE_NOT_FOUND',
  'ASSET_NOT_FOUND', 'INPUT_INVALID', 'ACTIVATION_MODE_UNSUPPORTED',
]);

/**
 * token 量尺标识（§6，OQ-R10-2 同构登记法）：公式与 CJK 范围逐字来自
 * scripts/token-audit.mjs:24-32 / validate-structure.mjs H9 同一量尺。仅回归量尺，非实测。
 */
export const TOKEN_METHOD = Object.freeze({
  id: 'cjk-weighted-regression-ruler',
  formula: 'tokens ≈ round(CJK字符数×0.75 + 非CJK字符数÷4)',
  cjkRanges: ['\\u4e00-\\u9fff', '\\u3000-\\u303f', '\\uff00-\\uffef'],
  status: 'regression-ruler-only（回归量尺，非实测 token 声明）',
});

/**
 * 首轮硬预算数值 = [待补充]（OQ-R3-1=A：首轮不设硬预算，等 Owner 给数或授权实测后回填；
 * 禁止编造数值——本常量显式保持 null，不设任何默认限额）。
 */
export const BUDGET_LIMIT = null;

/** brief「方法论正文」段标题（§5.2，OQ-R3-10=A：标题文字逐字保留，宿主解析锚 exec-host-generic.mjs:67 依赖） */
export const BRIEF_BODY_HEADING = '## 方法论正文（资产全文）';
/** metadata 级该段占位行（§5.2：防宿主误以为遗漏） */
export const METADATA_PLACEHOLDER = '（未激活正文）';
/** brief 产物文件名（§5.2：不变，宿主以 brief 路径为末参的调用契约不变） */
export const BRIEF_FILENAME = 'brief.md';

/** catalogCacheIdentity 口径标识（C-R2 §7.2：内容寻址 sourceHash，非 mtime；本常量为 per-entry 投影前缀） */
export const CATALOG_CACHE_IDENTITY_VERSION = 'r3-catalog-cache-identity-v1';

/** AV-2 manifest 产物路径（AV-3 resolver 默认读面；产物由 scripts/manifest-build.mjs 唯一构建，本模块只读不写） */
export const ASSET_MANIFEST_V2_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'contracts', 'asset-manifest-v2.json'
);

// ---------------------------------------------------------------------------
// 内部工具（响应壳 / 哈希 / 文件）
// ---------------------------------------------------------------------------

function respond(ok, code, data, evidence, warnings) {
  return { ok, code: code ?? null, data: data ?? {}, evidence: evidence ?? {}, warnings: warnings ?? [] };
}

function isBlank(v) { return v === undefined || v === null || v === ''; }

function sha256Hex(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function fileSha256(file) {
  return sha256Hex(fs.readFileSync(file));
}

/**
 * manifest 文件解析（C-R2 §3.1 口径：skill → SKILL.md 优先，否则 agent → <id>.md；
 * 判定规则与 manifest.mjs:29-44 同源，bodyPath = manifestPath 棕地布局如实记录）。
 */
export function resolveManifestPath(vendorDir, assetId) {
  const skillFile = path.join(vendorDir, assetId, 'SKILL.md');
  if (fs.existsSync(skillFile)) return { manifestPath: skillFile, assetType: 'skill' };
  const agentFile = path.join(vendorDir, assetId, assetId + '.md');
  if (fs.existsSync(agentFile)) return { manifestPath: agentFile, assetType: 'agent' };
  return { manifestPath: null, assetType: null };
}

/**
 * 剥离 frontmatter（契约 §4.2：机制沿用现状 asset.mjs:5-10——CRLF 归一 + ^---\n…\n---\n? 头块切除；
 * 无 frontmatter 原样返回。本契约不得改变该剥离语义，否则 C6 证据对账失效，故逐字同构复制）。
 */
export function stripFrontmatter(text) {
  const clean = String(text).replace(/\r\n/g, '\n');
  const match = clean.match(/^---\n[\s\S]*?\n---\n?/);
  if (!match) return clean;
  return clean.slice(match[0].length);
}

/** 行式 frontmatter 元数据提取（与 manifest.mjs:3-11 同源的行式 parser，仅取 name/description 供 metadata 级身份块）。 */
function parseFrontmatterMeta(text) {
  const result = {};
  const match = String(text).replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  if (!match) return result;
  for (const line of match[1].split('\n')) {
    const i = line.indexOf(':');
    if (i !== -1) result[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return result;
}

/**
 * 资产 anchor 与内核 token 提取（§7.4 P4 消费的"激活记录 anchor/Kernel 行 token 集"；
 * 与 prompt.mjs:79-90 逐字同源：anchor = 正文首个标题，Kernel: 行内 ASCII 工具 token，
 * 过滤虚词表 VIRTUAL 与 <3 字符 token。此处只提取登记，不做任何消费真伪判定——
 * 回显型布尔不得作为验证依据（§0.1/§3.3），本提取仅供 P4 反回显移除使用）。
 */
const VIRTUAL_WORDS = /^(via|the|and|for|of|to|in|is|or|not|with|as|at|by|hub|uses|layer)$/i;
export function extractAnchorAndKernel(body, assetId) {
  const text = String(body || '');
  const anchorMatch = text.match(/^#{1,6}\s+(.+)$/m);
  const anchor = anchorMatch ? anchorMatch[1].trim() : String(assetId);
  const hasKernelSection = /^#{1,6}\s+Execution kernel/im.test(text);
  const kernelLine = (text.match(/## Execution kernel[\s\S]*?Kernel:\s*([^\n]+)/) || [])[1] || '';
  const kernelTokens = [...new Set((kernelLine.match(/`([A-Za-z][A-Za-z0-9._/-]{2,})`|([A-Za-z][A-Za-z0-9._/-]{2,})/g) || [])
    .map((t) => t.replace(/`/g, '').toLowerCase())
    .filter((t) => t.length >= 3 && !VIRTUAL_WORDS.test(t)))];
  return { anchor, hasKernelSection, kernelTokens };
}

/** CJK 加权 token 估算（§6 量尺；返回估算值与构成，禁止表述为实测）。 */
export function estimateTokens(text) {
  const chars = [...String(text)];
  let cjk = 0;
  for (const ch of chars) if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch)) cjk += 1;
  const nonCjk = chars.length - cjk;
  return { chars: chars.length, cjk, tokens: Math.round(cjk * 0.75 + nonCjk / 4) };
}

/**
 * mode 解析（§8.1）：input.mode ?? env.YY_RECEIPT_MODE；两者皆缺省 ⇒ 'dual'
 * （MW0 双读旧/新语义，登记为重建判定——PRD0 §9.2 原文未随快照幸存，缺省值无冻结依据，
 * 在 warnings 显式说明）。mode 值非法 ⇒ ACTIVATION_MODE_UNSUPPORTED，禁止 silent fallback。
 */
export function resolveMode(input) {
  const warnings = [];
  const explicit = input && input.mode !== undefined ? input.mode : process.env[MODE_ENV];
  if (explicit === undefined || explicit === null || explicit === '') {
    warnings.push(`mode 缺省：未指定 input.mode 且环境变量 ${MODE_ENV} 未设置，按 'dual' 处理（MW0 双读语义；缺省值无冻结依据，登记 rebuild-20260920 判定）`);
    return { mode: 'dual', warnings };
  }
  if (!MODES.includes(explicit)) {
    return { mode: explicit, warnings, invalid: true };
  }
  return { mode: explicit, warnings };
}

/** phaseEligibility 投影（§3.1：谓词语义属 matrix/planner 现有机制，本字段只投影不重定义）。 */
function projectPhaseEligibility(assetId, plan, subtask) {
  const hostClusters = CLUSTERS.filter((c) => c.candidates.includes(assetId)).map((c) => c.id);
  const phase = subtask && subtask.phase !== undefined ? subtask.phase : (plan && plan.phase !== undefined ? plan.phase : null);
  const clusterId = plan && plan.cluster ? plan.cluster : null;
  const cluster = clusterId ? CLUSTERS.find((c) => c.id === clusterId) : null;
  let eligible = hostClusters.length > 0;
  let reason = hostClusters.length
    ? `资产 ${assetId} 属簇 ${hostClusters.join('/')} 候选集（matrix.mjs CLUSTERS 投影）`
    : `资产 ${assetId} 不在任何簇候选集（matrix.mjs CLUSTERS 投影）`;
  if (cluster) {
    const phases = Array.isArray(cluster.phases) ? cluster.phases : cluster.candidates.map((n) => [n]);
    let assetPhase = -1;
    phases.forEach((group, p) => { if (group.includes(assetId)) assetPhase = p; });
    if (assetPhase < 0) {
      eligible = false;
      reason = `资产 ${assetId} 不在簇 ${clusterId} 的 phases 分组中（planner.mjs phase 投影）`;
    } else if (typeof phase === 'number' && phase < assetPhase) {
      eligible = false;
      reason = `资产 ${assetId} 属 phase ${assetPhase}，当前 phase ${phase} 未到达（planner.mjs phase 投影）`;
    } else {
      reason += `；簇 ${clusterId} 内 phase=${assetPhase}`;
    }
  }
  return { eligible, reason, phase };
}

// ---------------------------------------------------------------------------
// AV-3：Asset Eligibility Resolver v1（v3.5 定名；输出形态 v3.4：{selected_asset, eligible, reason[]}）
// ---------------------------------------------------------------------------

/**
 * resolveAssetEligibility —— 资格判定（v3.5：runtime 不得直接拿 asset，必须过 resolver→approved asset；
 * 修复 F-007 runtime 直依赖 CLUSTERS）。批 1 边界（v3.2 第三次确认）：主键 = asset name（name-based），
 * requirements/constraints 仅为可选提示，不参与主键解析；required_capability 计划输入维持批 2 边界。
 *
 * 规则（AV-3 派单，序号即判定序）：
 *   1. 读 contracts/asset-manifest-v2.json（AV-1 readManifest 接口）——manifest 缺失/坏 →
 *      eligible=false，reason 含 CANDIDATE_INVALID（fail-closed）；
 *   2. when_not_to_use 负向命中 → eligible=false，reason 引用命中条目（INELIGIBLE_WHEN_NOT_TO_USE）；
 *   3. when_to_use 正向命中 → reason 记 "manifest match"；无命中不否决（理由=无负向、无正向依据，如实标注）；
 *   4. drop_pending:true && drop_allowed:false → eligible=false（INELIGIBLE_DROP_PENDING，防并行绕过
 *      DROP_ALLOWED 硬门，v3.2 裁定）；
 *   5. 纯函数零 LLM 零网络：判定只依赖输入 hints 与 manifest 行文本的确定性子串匹配
 *      （token 切分见 hintTokens；大小写不敏感）。资产不在 manifest → ASSET_NOT_FOUND fail-closed。
 *
 * 命中语义（v1 确定性口径，局限如实声明）：提示串整体或其 token（CJK 连续段 / ASCII 词段，≥2 字符）
 * 与 when_to_use / when_not_to_use 条目做大小写不敏感的子串匹配——宽匹配（宁多报 reason 少漏报），
 * 逐条引用命中条目与命中 token，判定全程可审计；不做同义词/语义扩展（零 LLM）。
 *
 * 输入 input: { asset: string, requirements?: string[], constraints?: Record<string,string> }
 * opts: { manifestPath?, manifestRows? }  —— manifestRows 注入供单测纯函数化（零 IO）；默认读产物文件
 * 输出: { selected_asset, eligible, reason: string[] }  // reason 为人读+机读混合令牌（含 fail-closed 码）
 */
export async function resolveAssetEligibility(input, opts = {}) {
  const asset = input && typeof input.asset === 'string' ? input.asset.trim() : '';
  if (!asset) {
    return { selected_asset: input && input.asset !== undefined ? input.asset : null, eligible: false, reason: ['INPUT_INVALID: asset 缺失或非字符串（fail-closed，name-based 主键必填）'] };
  }

  // 规则 1：manifest 读面（AV-1 readManifest 接口；缺必填字段/非数组/坏 JSON 均抛 CANDIDATE_INVALID 同码）
  let rows;
  try {
    if (Array.isArray(opts.manifestRows)) rows = opts.manifestRows;
    else rows = await readManifest(opts.manifestPath || ASSET_MANIFEST_V2_PATH);
  } catch (error) {
    return {
      selected_asset: asset,
      eligible: false,
      reason: [`manifest 缺失/不可读/行校验失败（CANDIDATE_INVALID fail-closed）: ${error.code ?? ''} ${error.message}`.trim()],
    };
  }
  const row = rows.find((r) => r && (r.name === asset || r.id === asset));
  if (!row) {
    return {
      selected_asset: asset,
      eligible: false,
      reason: [`asset 不在 manifest（ASSET_NOT_FOUND fail-closed，name-based 主键无行）: ${asset}（manifest 共 ${rows.length} 行）`],
    };
  }

  // 提示收集：requirements 字符串 + constraints 标量值（均为可选提示，v3.2/v3.5 边界）
  const hints = [];
  for (const r of (Array.isArray(input.requirements) ? input.requirements : [])) {
    if (r !== undefined && r !== null && String(r).trim()) hints.push(String(r).trim());
  }
  if (input.constraints && typeof input.constraints === 'object' && !Array.isArray(input.constraints)) {
    for (const v of Object.values(input.constraints)) {
      if (v !== undefined && v !== null && typeof v !== 'object' && String(v).trim()) hints.push(String(v).trim());
    }
  }
  const tokens = [...new Set(hints.flatMap(hintTokens))];

  // 规则 2：负向命中（fail-closed，逐条引用命中条目与命中 token）
  const reason = [];
  let failed = false;
  for (const entry of (Array.isArray(row.when_not_to_use) ? row.when_not_to_use : [])) {
    const el = String(entry).toLowerCase();
    const hit = tokens.find((t) => el.includes(t));
    if (hit !== undefined) {
      failed = true;
      reason.push(`when_not_to_use 负向命中（INELIGIBLE_WHEN_NOT_TO_USE）: 提示 token「${hit}」命中条目「${entry}」`);
    }
  }

  // 规则 4：drop_pending && !drop_allowed → fail-closed（v3.2 DROP_ALLOWED 硬门，防并行绕过计划顺序）
  if (row.drop_pending === true && row.drop_allowed === false) {
    failed = true;
    reason.push('drop_pending=true 且 drop_allowed=false（INELIGIBLE_DROP_PENDING fail-closed，DROP_ALLOWED 硬门防并行绕过）');
  }

  // 规则 3：正向命中（只记 manifest match，不否决语义由 eligible 计算承担）
  let positiveHit = false;
  for (const entry of (Array.isArray(row.when_to_use) ? row.when_to_use : [])) {
    const el = String(entry).toLowerCase();
    const hit = tokens.find((t) => el.includes(t));
    if (hit !== undefined) {
      positiveHit = true;
      reason.push(`manifest match: 提示 token「${hit}」命中 when_to_use 条目「${entry}」`);
    }
  }

  // 规则 3 无命中不否决：无负向、无正向依据 → 如实标注（不编造正向依据）
  if (!failed && !positiveHit) {
    reason.push(hints.length
      ? '无正向依据：requirements/constraints 未命中 when_to_use 条目——如实标注，不否决（无负向命中）'
      : '无正向依据：未提供 requirements/constraints 提示——如实标注，不否决（无负向命中）');
  }

  return { selected_asset: asset, eligible: !failed, reason };
}

/** 提示 token 切分：CJK 连续段 + ASCII 词段（≥2 字符；连字符段再拆子词——"openapi-validation"→openapi/validation），另加提示串整体小写形。 */
function hintTokens(hint) {
  const lower = String(hint).toLowerCase();
  const out = new Set(lower.trim() ? [lower.trim()] : []);
  for (const t of (lower.match(/[\u4e00-\u9fff]+|[a-z0-9][a-z0-9_.+-]*/g) || [])) {
    if (t.length >= 2) out.add(t);
    for (const sub of t.split(/[-_.+]+/)) if (sub.length >= 2) out.add(sub);
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// brief 框架（§5.2：字段名与现状 brief 逐字兼容，prompt.mjs:34-59 同构）
// ---------------------------------------------------------------------------

/**
 * renderBrief：把 activationPackage.briefFrame 渲染为 brief.md 文本。
 * 框架字段与 prompt.mjs:34-59 现状逐字兼容（§5.2 逐行对照表）；唯一契约内变化 =
 * 「方法论正文」段内从资产全文替换为有界 payload（OQ-R3-10=A：标题原文保留）。
 * metadata 级该段为占位行（未激活正文）（§5.2）。
 */
export function renderBrief(frame) {
  const prior = Array.isArray(frame.upstreamRefs) && frame.upstreamRefs.length
    ? frame.upstreamRefs.map((r) => '- ' + r).join('\n')
    : '(无上游产物)';
  const preconditions = Array.isArray(frame.preconditions) && frame.preconditions.length
    ? frame.preconditions.map((p) => '- ' + p).join('\n')
    : '(本子任务无显式前置条件；仍须产出资产消费证据，见「执行要求」)';
  return [
    '# 子任务执行指令包 ' + frame.subtaskId,
    '',
    '## 任务（父任务）',
    frame.task || '(无)',
    '',
    '## 本子任务',
    '- asset: ' + frame.asset,
    '- 资产根目录: ' + (frame.assetRoot || '(未知，见方法论正文的相对引用)'),
    '- 说明: ' + (frame.description || frame.task || '(无)'),
    '- contract: ' + (frame.contract || '(无)'),
    '',
    '## 上游产物引用',
    prior,
    '',
    '## 前置条件（硬约束）',
    preconditions,
    '',
    BRIEF_BODY_HEADING,
    '',
    frame.bodyContent,
    '',
    '---',
    '执行要求：以「方法论正文」为指导，针对本子任务产出可直接执行的方案或文档（如设计说明、任务清单、验收要点）。',
    '产出请写入本目录下的其他文件（如 plan.md / checklist.md / acceptance.md），并在最终产物中标明你消费了哪个资产的方法论。',
  ].join('\n');
}

/**
 * 段内 payload 规范形（投递 payload 字节口径）：去首尾空行后的段内文本。
 * payloadSha256（§7.3 T4 谓词 (b)）一律对本规范形计算——prepare 侧与 brief 提取侧同形可复验。
 */
export function normalizeSection(s) {
  return String(s ?? '').replace(/^\n+/, '').replace(/\n+$/, '');
}

/** 从 brief.md 文本提取「方法论正文」段内 payload 字节（receipt.mjs T4/P4 复验用；renderBrief 的逆操作）。
 *  段界 = 段标题之后、帧尾分隔（\n---\n执行要求：，prompt.mjs:56-57 同构）之前——不用裸 '---' 定界，
 *  资产正文自身可含水平线（历史实测正文含 --- 行）。 */
export function extractPayloadFromBrief(briefText) {
  const text = String(briefText).replace(/\r\n/g, '\n');
  const hIdx = text.indexOf(BRIEF_BODY_HEADING);
  if (hIdx < 0) return null;
  const lineEnd = text.indexOf('\n', hIdx);
  if (lineEnd < 0) return null;
  const tail = text.slice(lineEnd + 1);
  const sepIdx = tail.indexOf('\n---\n执行要求：');
  const seg = sepIdx >= 0 ? tail.slice(0, sepIdx) : tail;
  return normalizeSection(seg);
}

// ---------------------------------------------------------------------------
// activation.prepare（契约 §2.1）
// ---------------------------------------------------------------------------

/**
 * activation.prepare
 * 输入 input: {
 *   plan,                 // planId 引用或内联 plan 快照（可空形状校验）
 *   subtask,              // 子任务引用：{id?, asset?, requestedResources?, phase?}（资源请求来源 = subtask 字段，OQ-R3-5=A）
 *   asset,                // 资产 id（必须存在于 catalog 视图）
 *   activationLevel,      // metadata|body|resource；缺省 = body（hybrid 默认投递级别，OQ-R3-4=A）
 *   requestedResources,   // level=resource 时的显式资源相对路径列表（subtask 字段优先）
 *   budget,               // 可选 {limit}；首轮无硬预算（OQ-R3-1=A），显式给限且超限 ⇒ block fail-closed
 *   mode,                 // legacy|dual|strict（缺省读 YY_RECEIPT_MODE，再缺省 dual）
 *   phaseEligibility,     // 可选：R2/R4 eligibility 投影结果（{eligible, reason}）；缺省由本模块投影
 *   opts: { vendorDir, workspace?, now?, useCache? }   // now/确定性注入供探针复现
 * }
 * 校验顺序（§7.5 失败语义表）：mode → 输入形状(INPUT_INVALID) → catalog(ASSET_NOT_FOUND) →
 *   manifest 可读(ASSET_BODY_MISSING) → 资源解析(RESOURCE_NOT_FOUND) → 预算(ACTIVATION_BUDGET_EXCEEDED)。
 * 幂等（§2.1）：相同输入 + 相同 sourceHash ⇒ 相同 activationPackage（preparedAt/estimatedAt
 *   为显式豁免字段，进 evidence 对账）。
 */
export async function activationPrepare(input) {
  const warnings = [];
  const opts = input.opts ?? {};
  const vendorDir = opts.vendorDir;
  if (!vendorDir) {
    return respond(false, 'INPUT_INVALID', { reason: 'opts.vendorDir 未指定（fail-closed）' });
  }
  const now = opts.now ?? new Date();

  // (1) mode（§8.1：值非法 ⇒ ACTIVATION_MODE_UNSUPPORTED，禁止 silent fallback）
  const resolved = resolveMode(input);
  warnings.push(...resolved.warnings);
  if (resolved.invalid) {
    return respond(false, 'ACTIVATION_MODE_UNSUPPORTED', {
      reason: `mode 值非法: ${resolved.mode}（合法值 ${MODES.join('|')}；§8.1 禁止 silent fallback）`,
    });
  }

  // (2) 输入形状（INPUT_INVALID）
  if (isBlank(input.asset) || typeof input.asset !== 'string') {
    return respond(false, 'INPUT_INVALID', { reason: 'asset 缺失或非字符串（§2.1 输入形状）' });
  }
  if (input.subtask !== undefined && (input.subtask === null || typeof input.subtask !== 'object' || Array.isArray(input.subtask))) {
    return respond(false, 'INPUT_INVALID', { reason: 'subtask 形状非法（须为对象引用）' });
  }
  if (input.plan !== undefined && input.plan !== null && (typeof input.plan !== 'object' || typeof input.plan === 'string')) {
    return respond(false, 'INPUT_INVALID', { reason: 'plan 形状非法（planId 引用或内联快照对象）' });
  }
  const subtask = input.subtask ?? {};
  if (subtask.asset !== undefined && subtask.asset !== input.asset) {
    return respond(false, 'INPUT_INVALID', { reason: `subtask.asset(${subtask.asset}) 与 asset(${input.asset}) 不一致（§2.1 输入）` });
  }
  const level = input.activationLevel ?? DEFAULT_ACTIVATION_LEVEL;
  if (!ACTIVATION_LEVELS.includes(level)) {
    return respond(false, 'INPUT_INVALID', { reason: `activationLevel 非法: ${level}（合法值 ${ACTIVATION_LEVELS.join('|')}）` });
  }
  if (input.budget !== undefined && input.budget !== null) {
    if (typeof input.budget !== 'object' || Array.isArray(input.budget)) {
      return respond(false, 'INPUT_INVALID', { reason: 'budget 形状非法（须为 {limit} 对象）' });
    }
    if (input.budget.limit !== undefined && input.budget.limit !== null && (typeof input.budget.limit !== 'number' || !Number.isFinite(input.budget.limit) || input.budget.limit <= 0)) {
      return respond(false, 'INPUT_INVALID', { reason: 'budget.limit 形状非法（须为正数；首轮无硬预算，OQ-R3-1=A）' });
    }
  }
  // 资源请求来源 = subtask 字段（OQ-R3-5=A）；顶层 requestedResources 仅作 subtask 缺省时的兼容入口
  const requestedResources = Array.isArray(subtask.requestedResources)
    ? subtask.requestedResources
    : (Array.isArray(input.requestedResources) ? input.requestedResources : []);
  if (subtask.requestedResources !== undefined && !Array.isArray(subtask.requestedResources)) {
    return respond(false, 'INPUT_INVALID', { reason: 'subtask.requestedResources 形状非法（须为字符串数组；请求来源 = subtask 字段，OQ-R3-5=A）' });
  }
  if (requestedResources.some((r) => typeof r !== 'string' || !r.trim())) {
    return respond(false, 'INPUT_INVALID', { reason: 'requestedResources 含非字符串/空路径项（§2.1 输入形状）' });
  }
  if (input.phaseEligibility !== undefined && input.phaseEligibility !== null) {
    const pe = input.phaseEligibility;
    if (typeof pe !== 'object' || typeof pe.eligible !== 'boolean') {
      return respond(false, 'INPUT_INVALID', { reason: 'phaseEligibility 形状非法（须为 {eligible: bool, reason}，§3.1）' });
    }
  }

  // (3) catalog 视图（ASSET_NOT_FOUND：id 必须存在于 catalog 视图 = 9 内置资产；文件缺失归类见 (4)）
  if (!CATALOG_IDS.includes(input.asset)) {
    return respond(false, 'ASSET_NOT_FOUND', {
      reason: `asset 不在 9 内置资产 catalog 视图内: ${input.asset}（C-R2 §3.1；drop 7 后名单随 manifest）`,
    });
  }
  // (4) manifest 可读（ASSET_BODY_MISSING，fail-closed：bodyPath=manifestPath 同文件；
  //     现状 asset.mjs:62-70 静默 body='' 的 silent-degrade 在 bounded 模式下即 defect——§2.1。
  //     归类口径：id ∈ catalog 而 manifest 文件缺失 ⇒ ASSET_BODY_MISSING（catalog 层与
  //     activation 层归类一致，清单 R3-5 defect 面），而非 ASSET_NOT_FOUND）
  const { manifestPath, assetType } = resolveManifestPath(vendorDir, input.asset);
  if (!manifestPath) {
    return respond(false, 'ASSET_BODY_MISSING', {
      reason: `manifest 文件不可读（vendor/<id>/SKILL.md 与 <id>.md 均缺失）: ${input.asset}（§2.1 fail-closed，不注入占位文案继续投递）`,
    });
  }
  const manifest = await buildManifest({ vendorDir });
  for (const w of manifest.warnings ?? []) warnings.push('catalog: ' + w);
  const entry = (manifest.entries ?? []).find((e) => e.name === input.asset);
  if (!entry) {
    return respond(false, 'ASSET_NOT_FOUND', {
      reason: `asset 不在 catalog（manifest entries）中: ${input.asset}（vendorDir=${vendorDir}）`,
    });
  }
  let rawText;
  try {
    rawText = fs.readFileSync(manifestPath, 'utf8');
  } catch (error) {
    return respond(false, 'ASSET_BODY_MISSING', {
      reason: `manifest 文件不可读: ${error.code ?? error.message}（§2.1 body 缺失语义，fail-closed）`,
    });
  }
  const sourceHash = sha256Hex(rawText);
  const st = fs.statSync(manifestPath);

  // (5) 三级激活内容构建（§4）
  const fm = parseFrontmatterMeta(rawText);
  const metaName = fm.name || entry.name || input.asset;
  const metaDescription = fm.description || entry.description || '';
  const sourcePath = 'vendor/' + input.asset + '/';
  const manifestRel = sourcePath + path.basename(manifestPath);
  const assetRootAbs = path.dirname(manifestPath);
  const body = level === 'metadata' ? null : stripFrontmatter(rawText);
  const bodyReadCount = level === 'metadata' ? 0 : 1;

  // metadata 级机验口径（GWT-R3-02 / §4.1）：body read count = 0 且 resource read count = 0
  const readCounts = { body: bodyReadCount, resource: 0, manifest: 1 };

  if (level !== 'metadata' && Array.isArray(subtask.requestedResources) && level !== 'resource' && subtask.requestedResources.length) {
    warnings.push('requestedResources 在 metadata/body 级被忽略（§3.1：非 resource 级 resources=[]；显式请求应使用 resource 级）');
  }
  if (level === 'resource' && !requestedResources.length) {
    return respond(false, 'INPUT_INVALID', {
      reason: 'level=resource 但 subtask 字段未显式请求任何资源（§4.3：resource 级仅在显式请求时启用，OQ-R3-4/5=A）',
    });
  }

  const resources = [];
  const resourceHashes = {};
  if (level === 'resource') {
    for (const rel of requestedResources) {
      const normalized = String(rel).replace(/\\/g, '/').replace(/^\.\/+/, '');
      const abs = path.resolve(assetRootAbs, normalized);
      // 防路径逃逸：资源必须位于资产根目录内（逃逸 ⇒ RESOURCE_NOT_FOUND，fail-closed）
      if (!abs.startsWith(path.resolve(assetRootAbs) + path.sep)) {
        return respond(false, 'RESOURCE_NOT_FOUND', {
          reason: `请求资源越出资产根目录: ${rel}（§4.3 fail-closed，禁止静默跳过）`,
          missing: [rel],
        });
      }
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        return respond(false, 'RESOURCE_NOT_FOUND', {
          reason: `请求资源不存在: ${rel}（§4.3 fail-closed，禁止静默跳过——OQ-R3-5=A）`,
          missing: [rel],
        });
      }
      const content = fs.readFileSync(abs, 'utf8');
      resourceHashes[normalized] = sha256Hex(content);
      resources.push({ path: normalized, sha256: resourceHashes[normalized] });
      readCounts.resource += 1;
    }
  }

  // payload（§5.2）：metadata 级 = 资产身份块（无正文）；body 级 = 剥离 frontmatter 全文；
  // resource 级 = 全文 + 每个选中资源全文。brief「方法论正文」段 metadata 级放占位行。
  let payloadContent;
  if (level === 'metadata') {
    payloadContent = [
      `asset: ${input.asset}`,
      `type: ${assetType}`,
      `name: ${metaName}`,
      `description: ${metaDescription}`,
      `sourceHash: ${sourceHash}`,
      `phaseEligibility: ${JSON.stringify(projectPhaseEligibility(input.asset, input.plan, subtask))}`,
      '(metadata 级激活：无正文、无资源——§4.1)',
    ].join('\n');
  } else {
    payloadContent = body;
    for (const r of resources) {
      payloadContent += '\n\n## Resource: ' + r.path + '\n\n' + fs.readFileSync(path.join(assetRootAbs, r.path), 'utf8');
    }
  }
  // 投递段规范形（§7.3 T4 谓词 (b) 的 hash 口径）：与 extractPayloadFromBrief 同形，保证可复验
  const deliveredSection = normalizeSection(level === 'metadata' ? METADATA_PLACEHOLDER : payloadContent);
  const payloadSha256 = sha256Hex(deliveredSection);

  // (6) token 估算 + 预算纪律（§6 / OQ-R3-1/2/3=A）
  const est = estimateTokens(payloadContent);
  const tokenEstimate = {
    method: TOKEN_METHOD.id,
    level,
    estimate: est.tokens,
    estimatedAt: new Date(now).toISOString(),
  };
  warnings.push('tokenEstimate 为回归量尺估算值（' + TOKEN_METHOD.id + '），非实测 token——§6 纪律：禁止表述为实测；预算数值 [待补充] 等 Owner 给数');
  let budgetRecord = { action: 'block' }; // 首轮 limit 缺席（OQ-R3-1=A）；action 固定 block（OQ-R3-3=A）
  const explicitLimit = input.budget && input.budget.limit !== undefined && input.budget.limit !== null
    ? input.budget.limit
    : null;
  if (explicitLimit !== null) {
    budgetRecord = { limit: explicitLimit, action: 'block' };
    if (est.tokens > explicitLimit) {
      // 超预算：block，fail-closed，不产出投递包（GWT-R3-01；truncate 已被决断排除）
      return respond(false, 'ACTIVATION_BUDGET_EXCEEDED', {
        reason: `payload 估算 ${est.tokens} tok 超过显式 budget.limit ${explicitLimit}（§2.1/§5.2 block fail-closed，不产出投递包）`,
        limit: explicitLimit,
        estimate: est.tokens,
        method: TOKEN_METHOD.id,
        action: 'block',
      });
    }
  }

  // (7) phaseEligibility（§3.1：只投影不重定义；R2/R4 显式投影优先）
  const phaseEligibility = input.phaseEligibility
    ? { eligible: input.phaseEligibility.eligible, reason: input.phaseEligibility.reason ?? null, phase: input.phaseEligibility.phase ?? null }
    : projectPhaseEligibility(input.asset, input.plan, subtask);
  if (!input.phaseEligibility) {
    warnings.push('phaseEligibility 为本模块按 matrix/planner 现有机制的投影（§3.1 只投影不重定义）；R2/R4 权威投影可用 input.phaseEligibility 覆盖');
  }

  // (8) anchor / kernel token 登记（§7.4 P4 消费；prompt.mjs:79-90 同源提取，仅登记不判定）
  const { anchor, hasKernelSection, kernelTokens } = extractAnchorAndKernel(body ?? '', input.asset);

  // (9) catalogCacheIdentity（C-R2 §7.2 per-entry 投影：内容寻址 sourceHash，非 mtime）
  const catalogCacheIdentity = sha256Hex([
    CATALOG_CACHE_IDENTITY_VERSION, input.asset, sourceHash,
    JSON.stringify({ namePresent: Boolean(fm.name), versionPresent: Boolean(fm.version), descriptionPresent: Boolean(fm.description) }),
  ].join('|'));

  // activation record（§3.1 字段级 schema；anchor/kernelTokens/readCounts 为 additive 字段——
  // P4 谓词引用"激活记录的 anchor"（§7.4）与 GWT-R3-02 read count 机验口径所需）
  const record = {
    assetId: input.asset,
    assetType,
    sourceHash,
    sourcePath,
    manifestPath: manifestRel,
    bodyPath: manifestRel, // 棕地布局：bodyPath = manifestPath（§3.1 原样如实）
    phaseEligibility,
    activationLevel: level,
    resources: resources.map((r) => r.path),
    resourceHashes,
    tokenEstimate,
    budget: budgetRecord,
    receiptRefs: [],
    behaviorChecks: [],
    anchor,
    kernelTokens,
    hasKernelSection,
    readCounts,
    preparedAt: new Date(now).toISOString(),
  };

  const activationPackage = {
    record,
    payload: {
      level,
      content: payloadContent,
      deliveredSection,
      payloadSha256,
      resources,
      bodyReadCount,
      resourceReadCount: readCounts.resource,
    },
    briefFrame: {
      subtaskId: subtask.id ?? (typeof input.plan === 'object' && input.plan && input.plan.id ? input.plan.id + '-sub' : 'subtask'),
      task: (typeof input.plan === 'object' && input.plan && input.plan.task) || subtask.task || null,
      asset: input.asset,
      assetRoot: assetRootAbs,
      description: subtask.task || subtask.contract || null,
      contract: subtask.contract || null,
      upstreamRefs: Array.isArray(subtask.upstreamRefs) ? subtask.upstreamRefs : [],
      preconditions: Array.isArray(subtask.preconditions) ? subtask.preconditions : [],
      bodyHeading: BRIEF_BODY_HEADING,
      bodyContent: deliveredSection,
      executionNote: [
        '执行要求：以「方法论正文」为指导，针对本子任务产出可直接执行的方案或文档（如设计说明、任务清单、验收要点）。',
        '产出请写入本目录下的其他文件（如 plan.md / checklist.md / acceptance.md），并在最终产物中标明你消费了哪个资产的方法论。',
      ],
      briefFilename: BRIEF_FILENAME,
    },
  };

  // evidence（§2.1：{snapshot, catalogCacheIdentity, sourceHashEcho, inputEcho}，对账 C-R2 §6.1 纪律）
  const evidence = {
    snapshot: { sourceHash, bytes: st.size, mtimeMs: st.mtimeMs, manifestPath: manifestRel },
    catalogCacheIdentity,
    sourceHashEcho: sourceHash,
    inputEcho: { asset: input.asset, activationLevel: level, requestedResources, budget: input.budget ?? null, mode: resolved.mode },
    readCounts,
    idempotencyExemption: 'preparedAt/tokenEstimate.estimatedAt 为幂等豁免时间戳字段（§3.1，进 evidence 对账）',
  };

  // 幂等缓存（§2.1：允许写激活缓存，缓存写不得改变返回数据，且不得写 vendor/；默认关闭）
  if (opts.useCache && opts.workspace) {
    try {
      const cacheDir = path.join(opts.workspace, '.tt-state');
      const cacheFile = path.join(cacheDir, 'activation-cache.json');
      const key = sha256Hex(JSON.stringify({ asset: input.asset, level, requestedResources, sourceHash, limit: explicitLimit }));
      let cache = {};
      try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      const hit = cache[key];
      cache[key] = { record: { ...record, preparedAt: hit ? hit.record.preparedAt : record.preparedAt }, payloadSha256 };
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2) + '\n', 'utf8');
      if (hit) {
        // 缓存命中：返回缓存记录（除豁免时间戳外字节等价），返回数据不变（§2.1 幂等条款）
        warnings.push('activation-cache 命中：同输入 + 同 sourceHash，返回与首次字节等价的 activationPackage（preparedAt 豁免）');
        record.preparedAt = hit.record.preparedAt;
      }
      evidence.activationCache = { file: '.tt-state/activation-cache.json', key, hit: Boolean(hit) };
    } catch (error) {
      warnings.push('activation-cache 写失败（不阻断）: ' + (error.code ?? error.message));
    }
  }

  return respond(true, null, { activationPackage }, evidence, warnings);
}

// ---------------------------------------------------------------------------
// run() 分发入口
// ---------------------------------------------------------------------------

/** run('activation.prepare', input) → 统一响应壳（R3 仅此一操作由本模块承载；receipt.append 见 receipt.mjs） */
export function run(op, input) {
  if (op === 'activation.prepare') return activationPrepare(input);
  return respond(false, 'INPUT_INVALID', { reason: `未知操作: ${op}（本模块仅承载 activation.prepare；receipt.append 由 receipt.mjs 承载）` });
}

export default {
  run, activationPrepare, renderBrief, extractPayloadFromBrief,
  stripFrontmatter, extractAnchorAndKernel, estimateTokens, resolveMode,
  resolveManifestPath, resolveAssetEligibility, ACTIVATION_LEVELS, DEFAULT_ACTIVATION_LEVEL, MODES, MODE_ENV,
  ERROR_CODES, TOKEN_METHOD, BUDGET_LIMIT, CATALOG_IDS, BRIEF_BODY_HEADING,
  METADATA_PLACEHOLDER, BRIEF_FILENAME, CATALOG_CACHE_IDENTITY_VERSION,
  ASSET_MANIFEST_V2_PATH,
};
