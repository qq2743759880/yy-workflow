/**
 * PC-1 Prompt Compiler v1 — 六段 brief 组合器（纯函数，零 LLM / 零网络）。
 *
 * 定位（plans/batch2-dispatch-plan-20260926.md PC-1 + plans/execution-plan-v3-20260923.md v3.1
 * Role Compiler 裁定）：消费 contracts/asset-manifest-v2.json 行的 id/role/name/capability/
 * when_to_use/when_not_to_use/verification 字段，把 {task, capability, project_context,
 * constraints} 编译为 Role/Mission/Context/Output Contract/Constraints/Verification 六段 brief，
 * 挂接在资产「方法论正文」之后；GV-2 预留 governanceSection 插槽（本期 orchestrator 不传，
 * 治理仍走 governPlanAssets 尾部追加形态，两节共存——见 D-PC1-3）。
 *
 * 结构裁定（D-PC1-1，实测驱动）：组合产物 = [vendor 资产正文原样前缀] + '\n\n' + [六段编译块]
 * （+ 可选 governanceSection）。六段**不得**置于正文之前，原因（regression S8 负向探针 P2-1）：
 *   - prompt 适配器（lib/adapters/prompt.mjs）的锚点 = 资产正文首个 markdown 标题（高熵，D-1），
 *     kernel 提取 = 正文 '## Execution kernel' 段的 Kernel: 行；
 *   - S8 宿主从 brief「方法论正文」段提取首个标题回写产物，负向探针断言「仅回写锚点（无内核词）
 *     → assetConsumed=false」；
 *   - 若 '# Role' 成为正文首标题：锚点降熵为 'role'（任何产物措辞都会碰巧命中），且负向探针
 *     回写 '# Role' 仍含锚点 → 全部 consumed=true → S8 负向断言（s8nFalse>0）必挂。
 *   故 vendor 正文（锚点+kernel 源）保持字节级前缀不动，六段编译块紧随其后——S8 锚点/kernel
 *   提取逻辑零改动照常命中（probe-s8-compat / probe-s8-e2e 实测）。
 *
 * 护栏（派单 PC-1 第 4 条）：
 *   - 单段 4KB 截断：六个编译段各自超 4096 字节按 UTF-8 安全截断并标注 [truncated]（复用 GW-1
 *     截断语义，lib/governance.mjs truncateBody 同构；上限 4KB 来自派单，治理正文仍 5KB）。
 *     vendor 正文**不**截断（D-PC1-2：截断会切走 Execution kernel 段破坏 S8，且 legacy 链路
 *     正文本就未截断，保持行为不变）；
 *   - manifest 行缺失 / contracts 产物缺失 / 行字段不可用 → 降级 legacy（正文原样透传，字节级
 *     兼容，零崩溃零行为面）；
 *   - 确定性输出：组合只依赖输入字段（无时间戳/无绝对路径/无随机源），同输入同 sha256；
 *   - YY_ACTIVATION=lib 帧路径跳过组合（同 governPlanAssets 护栏：activation payloadSha256 按
 *     vendor 原始正文计算，T4 谓词 (b) 同源耦合，注入会引入 hash 漂移）；
 *   - YY_PROMPT_COMPOSER=off 逃生舱（kill-switch）：全量 legacy（D-PC1-4，降级探针/应急用）。
 *
 * 白名单：本文件新建（PC-1）；orchestrator.mjs 仅 brief 组装处最小 diff 接线。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
// GV-2 治理插槽消费单点（governance.mjs 导出面）：debugging 摘要（≤2KB 记忆节）与 brief
// 事件治理节（冻结绑定两键匹配单点在 governance.mjs）——本文件只做插槽合成，不复制绑定语义。
import { debuggingMemorySection, governanceBriefSection, stageForAsset } from './governance.mjs';

/** 单编译段截断上限：4KB（派单 PC-1 截断护栏；GW-1 治理正文为 5KB，两护栏独立不混用）。 */
export const MAX_SECTION_BYTES = 4 * 1024;

/**
 * GV-2 截断策略（派单自测第 3 条）：六段 + governanceSection 合成总长预算 12KB——治理节
 * （governanceSection：5KB 正文护栏或 2KB debugging 摘要，注入即承诺完整）优先保完整，
 * 超限从最早编译段开始逐段压到 1KB 直至总长回落预算；仍超 → 登记策略（strategy:
 * 'governance-first-truncated-sections'，truncated 标注保留）——治理节永不截断（正文段让位）。
 * 正文段被压缩段在 [truncated] 标注中具名（可审计）；vendor 正文前缀不参与预算（D-PC1-2
 * 前缀字节级不动）。无治理节时零行为（各段独立 4KB 护栏不变，PC-1 形态字节级保持）。
 */
export const MAX_COMPOSED_TOTAL_BYTES = 12 * 1024;
/** 总长超限时编译段的压缩上限（逐段压到 1KB；仍超则登记策略，不再进一步压）。 */
export const COMPACTED_SECTION_BYTES = 1 * 1024;
/** 治理节截断策略登记名（进 composeBrief 产物 truncateStrategy 字段，机验可断言）。 */
export const GOVERNANCE_FIRST_STRATEGY = 'governance-first-truncated-sections';

/** manifest v2 产物默认路径（随包副本；探针可用 opts.manifestPath 覆盖指向沙箱副本）。 */
export const DEFAULT_MANIFEST_V2_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'contracts', 'asset-manifest-v2.json');

/** 六段段序（v3.1 Role Compiler 裁定形态；探针按此断言六段齐）。 */
export const SECTION_ORDER = Object.freeze(['Role', 'Mission', 'Context', 'Output Contract', 'Constraints', 'Verification']);

/** 全局红线（派单 PC-1 第 2 条 Constraints 段指定三项，逐字口径）。 */
const GLOBAL_RED_LINES = Object.freeze([
  '禁造接口：未在冻结契约/任务范围内定义的接口、字段、数据结构一律不得虚构（契约先行，缺口如实上报）',
  '路径可移植：产物中的文件引用一律用仓库相对路径（正斜杠），禁绝对路径/盘符/机器专属路径',
  '诚实降级：工具/宿主/依赖缺失或校验未过时如实声明（degraded/skip + 具名原因），禁伪报执行成功',
]);

function sha256Hex(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

/**
 * GV-2 截断策略执行：治理节保完整、正文段逐段压缩（truncateSection 同构，1KB 上限 + 具名
 * [truncated] 标注）。从最早编译段开始压，总长回落预算即停；全部段压完仍超 → 策略照常登记
 * （治理节完整优先级不变）。纯字符串重排，零 IO。
 */
function compactSectionsForBudget(rendered, govIndex, govBytes) {
  const truncated = [];
  let total = govBytes;
  for (let i = 0; i < rendered.length; i += 1) {
    if (i === govIndex) continue;
    total += Buffer.byteLength(rendered[i], 'utf8') + 2; // '\n\n' join
  }
  if (total <= MAX_COMPOSED_TOTAL_BYTES) return { rendered, truncated, strategy: null };
  for (let i = 0; i < rendered.length; i += 1) {
    if (i === govIndex) continue;
    const nameGuess = (rendered[i].match(/^# (.+)$/m) || [])[1] || 'Section';
    const originalBytes = Buffer.byteLength(rendered[i], 'utf8');
    const compacted = truncateSection(rendered[i], nameGuess, COMPACTED_SECTION_BYTES);
    if (compacted.truncated) truncated.push(nameGuess);
    rendered[i] = compacted.text;
    total = govBytes + 2 * (rendered.length - 1);
    for (let j = 0; j < rendered.length; j += 1) {
      if (j !== govIndex) total += Buffer.byteLength(rendered[j], 'utf8');
    }
    if (total <= MAX_COMPOSED_TOTAL_BYTES) break;
  }
  return { rendered, truncated, strategy: GOVERNANCE_FIRST_STRATEGY };
}

/**
 * 单段 4KB 截断护栏（GW-1 truncateBody 同构：UTF-8 安全、去边界残字符、标注 [truncated]）。
 * @param {string} text — 段全文（含段标题行）
 * @param {string} label — 段名（进截断标注，便于定位）
 * @returns {{text: string, truncated: boolean, originalBytes: number}}
 */
export function truncateSection(text, label, limitBytes) {
  const cap = Number.isInteger(limitBytes) && limitBytes > 0 ? limitBytes : MAX_SECTION_BYTES;
  const raw = String(text == null ? '' : text);
  const buf = Buffer.from(raw, 'utf8');
  if (buf.length <= cap) return { text: raw, truncated: false, originalBytes: buf.length };
  const sliced = buf.subarray(0, cap).toString('utf8').replace(/\uFFFD+$/, '');
  const capLabel = cap === MAX_SECTION_BYTES ? '4KB' : cap + 'B';
  return {
    text: sliced + '\n\n[truncated] 本段（' + label + '）超 ' + capLabel + ' 注入上限（原始 ' + buf.length + 'B），已截断防 prompt 膨胀——全文见 contracts/asset-manifest-v2.json 对应字段',
    truncated: true,
    originalBytes: buf.length,
  };
}

/** 输入归一：string → 单元素数组；Array → 字符串数组；object → 'key: value' 行（插入序，确定性）；空 → []。 */
function toLines(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((v) => String(v)).filter((v) => v.trim());
  if (typeof value === 'object') {
    const out = [];
    for (const k of Object.keys(value)) {
      const v = value[k];
      if (v == null || String(v).trim() === '') out.push(String(k));
      else if (Array.isArray(v)) out.push(String(k) + ': ' + v.map((x) => String(x)).join(' | '));
      else out.push(String(k) + ': ' + String(v));
    }
    return out;
  }
  const s = String(value).trim();
  return s ? [s] : [];
}

function renderList(lines) {
  return lines.length ? lines.map((l) => '  - ' + l).join('\n') : '  - (未登记——如实留空，不虚构)';
}

/** verify_command（TK-1 executor_acceptance 口径，templates/task-v2.md）：有冻结条目渲染 JSON，无则诚实缺省行。 */
function renderVerifyCommand(constraints) {
  const acc = constraints && constraints.executorAcceptance;
  if (Array.isArray(acc) && acc.length) {
    return JSON.stringify(acc); // [{ac, verify_command, expected_exit}] 逐条冻结口径
  }
  if (constraints && typeof constraints.verifyCommand === 'string' && constraints.verifyCommand.trim()) {
    return JSON.stringify([{ ac: constraints.ac || '产物按验收断言可机验', verify_command: constraints.verifyCommand.trim(), expected_exit: Number.isInteger(constraints.expectedExit) ? constraints.expectedExit : 0 }]);
  }
  return '(本单未冻结 executor_acceptance——按 templates/task-v2.md 口径在产物 acceptance.md 显式声明验证方式与期望退出码；禁伪报已验证)';
}

/**
 * 六段 brief 组合（单资产，纯函数）。
 * @param {object} input
 *   - body: string — vendor 资产正文（组合前缀，字节级不动）
 *   - task: string — 子任务任务一句话
 *   - externalTask: boolean — host frame already owns the executable task; Mission references it without repeating it
 *   - capability: object|null — manifest v2 行（id/role/name/capability/when_to_use/when_not_to_use/verification）
 *   - project_context: string|Array|object — Context 段内容（workspace 现状/上一子任务产物引用）
 *   - constraints: string|Array|object — Output Contract 段内容（产出落点/格式）；可含
 *     verifyCommand/executorAcceptance/expectedExit 供 Verification 段 TK-1 口径渲染
 *   - governanceSection: string|null — GV-2 治理插槽（预渲染治理节原样嵌入六段之后；orchestrator
 *     经 GV-2 管道单点传入。带治理节时启用总长预算 12KB 截断策略：治理节优先保完整、正文段
 *     逐段压 1KB，超限登记 strategy='governance-first-truncated-sections'）
 * @returns {{mode:'composer'|'legacy', body:string, sections:object|null, truncated:string[],
 *            truncateStrategy?:string, sha256:string}}
 */
export function composeBrief(input) {
  const body = input && typeof input.body === 'string' ? input.body : '';
  const cap = input && input.capability && typeof input.capability === 'object' ? input.capability : null;
  const usable = cap && ((typeof cap.role === 'string' && cap.role.trim()) || (typeof cap.capability === 'string' && cap.capability.trim()) || (Array.isArray(cap.when_to_use) && cap.when_to_use.length) || (typeof cap.verification === 'string' && cap.verification.trim()));
  if (!usable) {
    // 降级 legacy：正文原样透传（字节级兼容），零段零截断
    return { mode: 'legacy', body, sections: null, truncated: [], sha256: sha256Hex(body) };
  }
  const task = input && input.task != null ? String(input.task) : '';
  const constraints = input && input.constraints && typeof input.constraints === 'object' && !Array.isArray(input.constraints) ? input.constraints : null;
  const ctxLines = toLines(input && input.project_context);
  const outLines = constraints ? toLines(constraints.lines != null ? constraints.lines : constraints) : [];
  const truncated = [];
  const sections = {};

  // 1. Role：manifest.role/name（capability 命名）
  sections['Role'] = [
    '# Role',
    '- asset: ' + String(cap.name || cap.id || '(未登记)'),
    '- role: ' + String(cap.role || '(未登记)'),
    '- capability: ' + String(cap.capability || '(未登记)'),
  ].join('\n');

  // 2. Mission：task 一句话 + when_to_use 摘要（为何选你）
  sections['Mission'] = [
    '# Mission',
    '- task: ' + (input.externalTask ? '仅执行宿主包「执行任务（唯一）」；本段只说明方法论职责。' : (task || '(无)')),
    '- why-this-asset（manifest.when_to_use 摘要）:',
    renderList(toLines(cap.when_to_use)),
  ].join('\n');

  // 3. Context：project_context（workspace 现状/上一子任务产物引用）
  sections['Context'] = [
    '# Context',
    ctxLines.length ? ctxLines.map((l) => '- ' + l).join('\n') : '- (无显式上下文——以上游产物引用段为准)',
  ].join('\n');

  // 4. Output Contract：constraints 中的产出要求（文件路径/格式）
  sections['Output Contract'] = [
    '# Output Contract',
    outLines.length ? outLines.map((l) => '- ' + l).join('\n') : '- (无显式产出要求——按任务说明与 contract 产出，写入本子任务 artifacts 目录)',
  ].join('\n');

  // 5. Constraints：manifest.when_not_to_use + 全局红线
  sections['Constraints'] = [
    '# Constraints',
    '- when-not-to-use（manifest）:',
    renderList(toLines(cap.when_not_to_use)),
    '- 全局红线:',
    GLOBAL_RED_LINES.map((l) => '  - ' + l).join('\n'),
  ].join('\n');

  // 6. Verification：manifest.verification + verify_command（TK-1 executor_acceptance 口径）
  sections['Verification'] = [
    '# Verification',
    '- manifest-verification: ' + String(cap.verification || '(未登记)'),
    '- verify_command（TK-1 executor_acceptance 口径 {"ac","verify_command","expected_exit"}）: ' + renderVerifyCommand(constraints),
  ].join('\n');

  // 逐段 4KB 截断
  const rendered = [];
  for (const name of SECTION_ORDER) {
    const t = truncateSection(sections[name], name);
    if (t.truncated) truncated.push(name);
    rendered.push(t.text);
  }
  // GV-2 治理插槽：预渲染治理节（governanceBriefSection 产物已自带 5KB 截断 / debugging 摘要
  // 自带 2KB 截断，原样嵌入不重复截断——注入即承诺治理节完整）。
  const gov = input && typeof input.governanceSection === 'string' && input.governanceSection.trim() ? input.governanceSection : null;
  let truncateStrategy;
  if (gov) {
    // GV-2 截断策略：合成总长（六段+治理节）超 12KB → 治理节优先保完整、正文段逐段压 1KB；
    // 仍超 → 策略登记（GOVERNANCE_FIRST_STRATEGY），治理节永不截断。
    const govBytes = Buffer.byteLength(gov, 'utf8');
    if (govBytes + 2 * rendered.length - 2 + rendered.reduce((acc, t) => acc + Buffer.byteLength(t, 'utf8'), 0) > MAX_COMPOSED_TOTAL_BYTES) {
      const compacted = compactSectionsForBudget(rendered, rendered.length, govBytes);
      for (const name of compacted.truncated) if (!truncated.includes(name)) truncated.push(name);
      truncateStrategy = compacted.strategy;
    }
    rendered.push(gov);
  }

  const compiled = rendered.join('\n\n');
  const newBody = body.trimEnd() + '\n\n' + compiled;
  const out = { mode: 'composer', body: newBody, sections, truncated, sha256: sha256Hex(newBody) };
  if (truncateStrategy) out.truncateStrategy = truncateStrategy;
  return out;
}

/**
 * 读 manifest v2 行（fail-soft）：文件缺失/损坏/非数组 → {ok:false, rows:null, error}（调用方全量 legacy）。
 * @param {{manifestPath?: string}} [opts]
 * @returns {{ok: boolean, rows: Map<string,object>|null, error: string|null, source: string}}
 */
export function loadCapabilityRows(opts) {
  const file = (opts && opts.manifestPath) || DEFAULT_MANIFEST_V2_PATH;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(parsed)) return { ok: false, rows: null, error: 'manifest v2 非数组形态', source: file };
    const rows = new Map();
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const key = typeof row.name === 'string' && row.name ? row.name : (typeof row.id === 'string' && row.id ? row.id : null);
      if (!key || rows.has(key)) continue; // name 缺失/重复 → 跳过该行（不猜）
      rows.set(key, row);
    }
    return { ok: true, rows, error: null, source: file };
  } catch (error) {
    return { ok: false, rows: null, error: 'manifest v2 不可读（' + error.message + '）→ 全量 legacy 降级', source: file };
  }
}

/** 默认 Context 行（orchestrator 接线缺省；全部仓库相对路径，可移植，零时间戳）。 */
function defaultProjectContext(subtask, plan, asset) {
  const assetRoot = asset && asset.meta && asset.meta.path ? String(asset.meta.path).replace(/\\/g, '/') + '/' : 'vendor/' + subtask.asset + '/';
  return [
    'cluster: ' + ((plan && plan.cluster) || '(未知)'),
    'asset-root: ' + assetRoot,
    'contract: ' + ((subtask && subtask.contract) || (plan && plan.contract) || '(无)'),
    'upstream: 上一子任务产物引用以 brief「上游产物引用」段为准（runtime 渲染，本段不重复罗列）',
  ];
}

/** 默认 Output Contract 行（orchestrator 接线缺省）。 */
function defaultConstraints(subtask, plan) {
  const lines = ['artifact-dir: artifacts/' + subtask.id + '/（产出写入本目录其他文件，如 plan.md/checklist.md/acceptance.md，禁只回 brief）'];
  if (subtask && subtask.contract) lines.push('contract-file: ' + subtask.contract);
  if (plan && plan.requireExec === true) lines.push('exec: 本计划 requireExec——实现类子任务须经 --exec 宿主真实执行，禁纯 brief 兜底伪报');
  lines.push('consumption-evidence: 产物须含资产消费锚点 + ≥1 内核词（D-1 机验），并在产物中声明消费的资产');
  return { lines };
}

/**
 * plan 级组合（orchestrator 接线单点，governPlanAssets 同构形态）：按子任务把 manifest 行在场的
 * 资产正文替换为「vendor 正文前缀 + 六段编译块」。原资产对象不改写（浅克隆），vendor/ 与
 * assets-cache 零污染；零组合/行缺失/kill-switch/lib 帧路径 → 原样返回同一 Map（零行为面）。
 * PC-1 无治理形态保留：kill-switch 字节级比对基线（GV-2 探针）与无 workspace 记忆消费的
 * 纯六段接线用；治理注入请走 composeGovernedPlanAssets（下方，governanceSection 插槽）。
 * @param {Map<string,{name,body,meta}>} assets — loadAssets 产物
 * @param {Array<{asset:string,task?:string,id:string,contract?:string}>} subtasks — plan.subtasks
 * @param {object} opts — {capabilityRows: Map, plan, briefInputs?: Map<asset,{project_context,constraints,governanceSection}>, governanceSectionByAsset?: Map, env?}
 */
export function composePlanAssets(assets, subtasks, opts) {
  if (!assets || typeof assets.get !== 'function' || typeof assets !== 'object') return assets;
  const env = (opts && opts.env) || process.env;
  if (String(env.YY_ACTIVATION || '').trim().toLowerCase() === 'lib') return assets; // T4 谓词 (b) 同源耦合护栏（同 governPlanAssets）
  if (String(env.YY_PROMPT_COMPOSER || '').trim().toLowerCase() === 'off') return assets; // 逃生舱（D-PC1-4）
  const rows = opts && opts.capabilityRows;
  if (!rows || typeof rows.get !== 'function' || rows.size === 0) return assets; // manifest 行缺失 → 全量 legacy
  const plan = (opts && opts.plan) || {};
  const inputs = opts && opts.briefInputs && typeof opts.briefInputs.get === 'function' ? opts.briefInputs : null;
  const out = new Map(assets);
  let composed = 0;
  const seen = new Set();
  for (const s of Array.isArray(subtasks) ? subtasks : []) {
    if (!s || typeof s.asset !== 'string' || !s.asset || seen.has(s.asset)) continue;
    seen.add(s.asset);
    const row = rows.get(s.asset);
    if (!row) continue;
    const a = assets.get(s.asset);
    if (!a || typeof a.body !== 'string') continue;
    const extra = inputs ? inputs.get(s.asset) : null;
    const result = composeBrief({
      body: a.body,
      task: s.desc || s.task || '',
      externalTask: true,
      capability: row,
      project_context: (extra && extra.project_context) || defaultProjectContext(s, plan, a),
      constraints: (extra && extra.constraints) || defaultConstraints(s, plan),
      governanceSection: (extra && extra.governanceSection) || ((opts && opts.governanceSectionByAsset && opts.governanceSectionByAsset.get(s.asset)) || null),
    });
    if (result.mode !== 'composer') continue;
    out.set(s.asset, Object.assign({}, a, { body: result.body }));
    composed += 1;
  }
  if (!composed) return assets; // 零组合 → 原样返回（零行为面，governPlanAssets 同惯例）
  return out;
}

/**
 * GV-2 管道单点（governPlanAssets 同构形态）：治理节 + debugging 摘要经 composer
 * governanceSection 插槽注入。调用序：governPlanAssets/finalReceipt 注入（正文尾部治理节，
 * GW-1 形态保持）→ 本函数（六段 + governanceSection 合成）。governanceSection 解析序（确定性）：
 *   ① debugging 摘要（GV-2 升级面）：workspace 失败记忆命中（冻结事件过滤）→ 记忆节；
 *   ② 否则（或摘要缺席）→ brief 组装事件治理节（stage entry：implementation 绑定 stage_7
 *      注 TDD；review 类子任务由 orchestrator 先经 governPlanAssets(before_final_receipt) 注入
 *      正文尾节，本函数 event 缺省 stage_7 与 GW-1 派单注入语义对齐）——冻结绑定两键匹配
 *      单点在 governance.mjs（governanceBriefSection）。
 * 治理缺席/kill-switch/行缺失 → 原样返回同一 Map（零行为面，向后兼容与 PC-1 一致）。
 * @param {Map<string,{name,body,meta}>} assets — loadAssets 产物（可已含治理尾节）
 * @param {Array<{asset:string,task?:string,id:string,contract?:string}>} subtasks — plan.subtasks
 * @param {object} opts — {capabilityRows: Map, plan, workspace?, governanceDir?, env?,
 *                        briefInputs?: Map<asset,{project_context,constraints}>,
 *                        debuggingEvent?: 'gate_failed'|'regression_failed'|'migration_failed',
 *                        briefEvent?: string}
 */
export function composeGovernedPlanAssets(assets, subtasks, opts) {
  if (!assets || typeof assets.get !== 'function' || typeof assets !== 'object') return assets;
  const env = (opts && opts.env) || process.env;
  if (String(env.YY_ACTIVATION || '').trim().toLowerCase() === 'lib') return assets; // T4 谓词 (b) 同源耦合护栏（同 governPlanAssets）
  if (String(env.YY_PROMPT_COMPOSER || '').trim().toLowerCase() === 'off') return assets; // 逃生舱（D-PC1-4）
  const rows = opts && opts.capabilityRows;
  if (!rows || typeof rows.get !== 'function' || rows.size === 0) return assets; // manifest 行缺失 → 全量 legacy
  const plan = (opts && opts.plan) || {};
  const inputs = opts && opts.briefInputs && typeof opts.briefInputs.get === 'function' ? opts.briefInputs : null;
  // GV-2：debugging 摘要事件（冻结集三枚举，governance.mjs debuggingMemorySection 消费单点）
  const debugEvent = opts && typeof opts.debuggingEvent === 'string' ? opts.debuggingEvent : 'gate_failed';
  const briefEvent = opts && typeof opts.briefEvent === 'string' && opts.briefEvent ? opts.briefEvent : 'stage_7'; // stage entry（F-030）
  const out = new Map(assets);
  let composed = 0;
  const seen = new Set();
  for (const s of Array.isArray(subtasks) ? subtasks : []) {
    if (!s || typeof s.asset !== 'string' || !s.asset || seen.has(s.asset)) continue;
    seen.add(s.asset);
    const row = rows.get(s.asset);
    if (!row) continue;
    const a = assets.get(s.asset);
    if (!a || typeof a.body !== 'string') continue;
    const extra = inputs ? inputs.get(s.asset) : null;
    // 治理节解析（①摘要 → ②brief 事件治理节；两者皆缺席 → null 零注入）
    const govSection = debuggingMemorySection(debugEvent, { workspace: opts && opts.workspace, governanceDir: opts && opts.governanceDir })
      || governanceBriefSection(stageForAsset(s.asset) || '', briefEvent, { governanceDir: opts && opts.governanceDir })
      || null;
    const result = composeBrief({
      body: a.body,
      task: s.desc || s.task || '',
      externalTask: true,
      capability: row,
      project_context: (extra && extra.project_context) || defaultProjectContext(s, plan, a),
      constraints: (extra && extra.constraints) || defaultConstraints(s, plan),
      governanceSection: (extra && extra.governanceSection) || govSection,
    });
    if (result.mode !== 'composer') continue;
    out.set(s.asset, Object.assign({}, a, { body: result.body }));
    composed += 1;
  }
  if (!composed) return assets; // 零组合 → 原样返回（零行为面，governPlanAssets 同惯例）
  return out;
}
