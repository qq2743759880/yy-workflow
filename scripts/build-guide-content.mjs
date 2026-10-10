/**
 * build-guide-content.mjs — 构建期内容提取器（FE-0）
 *
 * 用法：node scripts/build-guide-content.mjs [--out webview/journey/content.js]
 *
 * 从三个唯一事实源提取「随行导航手册」B/C 段静态内容：
 *   1. commands/yy-*.md     —— 7 入口数据（含 research；命令/名/目标、摘要、配套资产、复制话术）
 *   2. vendor 下 9 资产 SKILL.md 等 —— 9 资产卡片（name / description / cluster / 阶段关联；AS-1 drop 7 后口径）
 *   3. scripts/lib/matrix.mjs CLUSTERS —— 资产域簇反查（不手抄第二份）
 *
 * 产出：webview/journey/content.js —— `export const GUIDE_CONTENT = {...}` ESM，
 * JSON.stringify 可序列化、UTF-8、中文保留原样。
 *
 * fail-closed：任一源文件缺失 / frontmatter 解析失败 / 字段缺失即报错退出（exit 1），
 * 绝不静默缺页；写出前做完整性自检（7 入口全在 + 9 资产全在 + 每卡片三字段非空）。
 * 此生成器只投影 command 内容，不从 frontmatter 前置条件计算阶段准入。
 *
 * 零 npm：仅 node: 内置模块。风格无关（纯数据层）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- 参数解析 ----------
function parseArgs(argv) {
  let out = path.join('webview', 'journey', 'content.js');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') {
      if (i + 1 >= argv.length) fail('--out 需要一个路径参数');
      out = argv[++i];
    } else {
      fail('未知参数：' + argv[i] + '（仅支持 --out <path>）');
    }
  }
  return { out };
}

// ---------- fail-closed 基元 ----------
function fail(msg) {
  process.stderr.write('[build-guide-content] FAIL-CLOSED: ' + msg + '\n');
  process.exit(1);
}

/** 读文件，缺失即 fail-closed。 */
function readSource(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) fail('源文件缺失：' + rel);
  try {
    return fs.readFileSync(abs, 'utf8');
  } catch (e) {
    fail('源文件读取失败：' + rel + ' —— ' + e.message);
  }
}

// ---------- frontmatter 解析 ----------
/**
 * 解析 YAML-lite frontmatter（--- ... ---）。
 * 仅支持本仓库实际使用的三种 description 写法：
 *   key: 单行值 | key: |（块标量）| key: >-（折叠块标量）
 * 返回 { meta, body }；无 frontmatter 即 fail-closed。
 */
function parseFrontmatter(text, rel) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (m) {
    return { meta: parseYamlLite(m[1], rel), body: text.slice(m[0].length) };
  }
  // 无 frontmatter 的资产（如 implementation.md）：从正文「# name」与首段提取，保持 fail-closed 字段校验
  const h = text.match(/^#\s+([\w-]+)\s*$/m);
  const para = text.split(/\r?\n\r?\n/).map((p) => p.replace(/^#.*$/m, '').trim()).find(Boolean) || '';
  return { meta: { name: h ? h[1] : '', description: para }, body: text };
}

/** YAML-lite 键值解析（key: 单行值 / 块标量）。 */
function parseYamlLite(fm, rel) {
  const meta = {};
  let key = null;
  let buf = [];
  for (const line of fm.split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv) {
      if (key) meta[key] = buf.join('\n').trim();
      key = kv[1];
      const v = kv[2];
      if (v === '|' || v === '|-' || v === '>' || v === '>-') { buf = []; } // 块标量：后续行累积
      else { meta[key] = v.trim().replace(/^"([\s\S]*)"$/, '$1').trim(); key = null; buf = []; }
    } else if (key) {
      buf.push(line.trim());
    }
  }
  if (key) meta[key] = buf.join('\n').trim();
  return meta;
}

/** description 取首行（块标量折叠后取第一句），过长截 80 字。 */
function firstLineDesc(desc) {
  const line = String(desc).split(/\r?\n/)[0].replace(/\s+/g, ' ').trim();
  return line.length > 80 ? line.slice(0, 80) : line;
}

/** 截断到 max 字（中文按字符数）。 */
function truncate(s, max) {
  s = String(s).trim();
  return s.length > max ? s.slice(0, max) : s;
}

// ---------- 命令文件解析 ----------
const COMMAND_FILES = [
  'commands/yy-0-init.md',
  'commands/yy-1-requirement.md',
  'commands/yy-research.md',
  'commands/yy-2-planning.md',
  'commands/yy-3-contract.md',
  'commands/yy-4-execute.md',
  'commands/yy-5-critique.md',
];

/** 提取「**目标**：」行内容。 */
function extractGoal(body, rel) {
  const m = body.match(/(?:\*\*目标\*\*|^目标)[：:]\s*(.+)/m);
  if (!m) fail('目标行解析失败（无「**目标**：」）：' + rel);
  return m[1].trim();
}

/** 提取「## 阶段 N · 名」标题。 */
function extractPhaseTitle(body, rel, meta) {
  const m = body.match(/^##\s*阶段\s*(\d+)\s*[·•]\s*(.+)$/m);
  if (!m && meta.name === 'yy-research') {
    return { num: Number(meta['journey-step']), title: String(meta.description).split('。')[0] };
  }
  if (!m) fail('阶段标题解析失败（无「## 阶段 N · 名」）：' + rel);
  return { num: Number(m[1]), title: m[2].trim() };
}

/** 提取「**纪律钥匙词**：」行内全部反引号关键词。 */
function extractDiscipline(body, rel) {
  const m = body.match(/\*\*纪律钥匙词\*\*[：:]\s*(.+)/);
  if (!m) return ['读取 ' + rel + ' 的边界、产物与方法指针；宿主准入以其首行指令为准。'];
  const kws = [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
  if (kws.length === 0) fail('纪律钥匙词为空：' + rel);
  return kws;
}

/** 注入内容摘要 = frontmatter description + 正文首段（> 引导块或首个非空段落）。 */
function extractSummary(desc, body, rel) {
  let firstPara = '';
  for (const para of body.split(/\r?\n\r?\n/)) {
    const t = para.replace(/^>\s?/gm, '').replace(/\r?\n/g, ' ').trim();
    if (t) { firstPara = t; break; }
  }
  if (!firstPara) fail('正文首段为空：' + rel);
  if (!firstPara.includes('host-adapter.mjs')) fail('当前宿主指令缺失：' + rel);
  return truncate(String(desc).replace(/\s+/g, ' ').trim(), 120) + ' ' + truncate(firstPara, 160);
}

// ---------- 资产清单（CLUSTERS 反查，不手抄第二份） ----------
async function loadClusters() {
  const rel = 'scripts/lib/matrix.mjs';
  if (!fs.existsSync(path.join(ROOT, rel))) fail('源文件缺失：' + rel);
  try {
    const mod = await import(pathToFileUrl(rel));
    if (!Array.isArray(mod.CLUSTERS) || mod.CLUSTERS.length === 0) fail('CLUSTERS 解析失败：' + rel);
    return mod.CLUSTERS;
  } catch (e) {
    fail('CLUSTERS 导入失败：' + rel + ' —— ' + e.message);
  }
}

function pathToFileUrl(rel) {
  return 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/').replace(/^\/+/, '');
}

/** 9 资产名 = CLUSTERS candidates 并集（唯一事实源，去重保序；AS-1 drop 7 后口径）。 */
function assetNamesFromClusters(clusters) {
  const seen = new Set();
  const names = [];
  for (const c of clusters) {
    for (const name of c.candidates || []) {
      if (!seen.has(name)) { seen.add(name); names.push(name); }
    }
  }
  return names;
}

/** 资产文件探测：<name>/<name>.md 优先，退 <name>/SKILL.md（同 matrix.mjs 布局）。 */
function assetFile(name) {
  for (const f of [name + '.md', 'SKILL.md']) {
    if (fs.existsSync(path.join(ROOT, 'vendor', name, f))) return 'vendor/' + name + '/' + f;
  }
  return null;
}

/** 域簇反查：资产出现在哪些簇 id。 */
function clustersOf(name, clusters) {
  return clusters.filter((c) => (c.candidates || []).includes(name)).map((c) => c.id);
}

/**
 * 阶段关联：命令文件内点名的资产（独立词匹配）。
 * 用 (?<![\w-])…(?![\w-]) 边界，避免 review-gate/owner-review 误报 review、
 * yy-2-planning 误报 planning 之类的子串假阳性。
 */
function assetRegex(name) {
  return new RegExp('(?<![\\w-])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])');
}

// ---------- 主流程 ----------
const { out } = parseArgs(process.argv.slice(2));
const clusters = await loadClusters();
const assetNames = assetNamesFromClusters(clusters);
if (assetNames.length !== 9) fail('CLUSTERS candidates 并集应为 9 资产（AS-1 drop 7 后），实际 ' + assetNames.length + '：' + assetNames.join('、'));

// ---- B 段：7 command 入口的只读投影 ----
const phases = COMMAND_FILES.map((rel) => {
  const text = readSource(rel);
  const { meta, body } = parseFrontmatter(text, rel);
  const { title } = extractPhaseTitle(body, rel, meta);
  const goal = extractGoal(body, rel);
  const discipline = extractDiscipline(body, rel);
  if (!meta.description) fail('frontmatter description 缺失：' + rel);
  const surface = String(meta.description).match(/「\/yy (research|[0-5])」/);
  if (!surface) fail('command 触发词缺失：' + rel);
  const commandStep = surface[1] === 'research' ? 'research' : Number(surface[1]);

  // 配套资产：命令文件内点名的资产（全部 9 资产逐一独立词匹配）
  const assets = assetNames.filter((n) => assetRegex(n).test(body));

  // 复制话术返回唯一 command 来源；展示层不重新判断 prerequisites 或授权。
  const kick = '请读取 ' + rel + '；先按其首行 host-adapter.mjs 指令展示并消费 Decision Packet，再按本阶段目标工作。';
  const redo = '重新走 /yy ' + commandStep + '：读取 ' + rel + '，重新按其首行 host-adapter.mjs 指令准备并复核 Decision Packet。';

  return {
    step: commandStep,            // command surface 0-5 或 research，不按数组位置编号
    journeyStep: Number(meta['journey-step']), // journey 机验节点号
    name: title,
    goal: truncate(goal, 200),
    summary: extractSummary(meta.description, body, rel),
    assets: assets.map((a) => ({ name: a, desc: '' })), // desc 在资产卡片阶段回填
    discipline: discipline,
    kickPrompt: kick,
    redoPrompt: redo,
  };
});

// ---- C 段：9 资产卡片 ----
const stageRegByAsset = new Map(assetNames.map((n) => [n, assetRegex(n)]));
const cards = assetNames.map((name) => {
  const rel = assetFile(name);
  if (!rel) fail('资产文件缺失：vendor/' + name + '/（既无 ' + name + '.md 也无 SKILL.md）');
  const text = readSource(rel);
  const { meta } = parseFrontmatter(text, rel);
  if (!meta.description) fail('frontmatter description 缺失：' + rel);
  if (!meta.name) fail('frontmatter name 缺失：' + rel);
  if (meta.name !== name) fail('资产 name 不一致：' + rel + ' name=' + meta.name + ' 期望 ' + name);
  const cl = clustersOf(name, clusters);
  if (cl.length === 0) fail('资产未归属任何 CLUSTERS 簇：' + name);
  const stages = phases.filter((p) => p.assets.some((a) => a.name === name)).map((p) => p.step);
  return {
    name: name,
    description: truncate(firstLineDesc(meta.description), 80),
    cluster: cl.join('/'),
    stages: stages,
  };
});

// 回填资产卡片一句话功能到阶段.assets
const cardByName = new Map(cards.map((c) => [c.name, c]));
for (const p of phases) for (const a of p.assets) {
  const c = cardByName.get(a.name);
  a.desc = c ? c.description : '';
}

// ---- 完整性自检（写出前 fail-closed）----
if (phases.length !== COMMAND_FILES.length) fail('完整性自检失败：应为 7 入口，实际 ' + phases.length);
for (const p of phases) {
  if (!p.name || !p.goal || !p.summary || !p.kickPrompt || !p.redoPrompt || !p.discipline.length) {
    fail('完整性自检失败：阶段 ' + p.step + ' 字段缺失/为空');
  }
}
if (cards.length !== 9) fail('完整性自检失败：应为 9 资产（AS-1 drop 7 后），实际 ' + cards.length);
for (const c of cards) {
  if (!c.name || !c.description || !c.cluster) fail('完整性自检失败：资产卡片 ' + c.name + ' 三字段非空校验未过');
}

// ---- 输出（固定键序 + 2 空格缩进，保证重跑幂等字节一致）----
const GUIDE_CONTENT = { generatedBy: 'scripts/build-guide-content.mjs', phases: phases, assets: cards };
const outAbs = path.join(ROOT, out);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
fs.writeFileSync(outAbs, 'export const GUIDE_CONTENT = ' + JSON.stringify(GUIDE_CONTENT, null, 2) + ';\n', 'utf8');
process.stdout.write('[build-guide-content] OK: ' + out + '（7 入口 + 9 资产卡片，完整性自检通过）\n');
