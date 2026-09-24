#!/usr/bin/env node
/**
 * manifest-build.mjs — asset-manifest-v2 唯一构建器（AV-2，批 1 单源由此确立）。
 *
 * 数据流：contracts/manifest-sources/<asset>.yaml（sidecar，我方署责任）
 *        → 本构建器合并 vendor 指针（vendor 头部结构化区提取 name/role/capability）
 *        → contracts/asset-manifest-v2.json（产物，数组 16 行，schema asset-manifest-v2@1.0.0）。
 *
 * 纪律（contracts/asset-manifest-v2.md §提取源纪律 + AV-2 派单）：
 *  - vendor/ 内文件一字不改；name/capability/role 为 vendor 原文逐字提取，不编造、不改写。
 *  - 三核心字段（when_to_use/when_not_to_use/verification）内容在 sidecar（我方署责任），
 *    sidecar 的 source 字段引用 vendor 路径与行号（vendor/<name>/<file>#L<n>[-L<n>]）。
 *  - 资产权威清单 = scripts/lib/matrix.mjs CLUSTERS candidates 去重（当前 16）。
 *  - fail-closed：任一校验不过 → 逐条具名 CANDIDATE_INVALID（与 evolution.propose 同口径），
 *    产物不落盘（拒绝半成品）。
 *  - 产物不含时间戳等易变字段 → 同输入同 hash（Gate-2 runtime hash 绑定用，sha256 打印）。
 *
 * sidecar YAML 子集（本构建器自带解析，无外部依赖）：
 *   key: value            标量（整行，# 开头的整行视为注释）
 *   key:                  列表头，后续 "  - item" 行为列表项
 *   布尔字段只接受字面 true / false（显式布尔，B1-GATE preflight 断言依赖）。
 *
 * CLI：node scripts/manifest-build.mjs [--sources <dir>] [--out <file>]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CLUSTERS } from './lib/matrix.mjs';

/** fail-closed 错误码（与 scripts/lib/asset.mjs 同名同口径） */
export const CANDIDATE_INVALID = 'CANDIDATE_INVALID';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCES = path.join(ROOT, 'contracts', 'manifest-sources');
const DEFAULT_OUT = path.join(ROOT, 'contracts', 'asset-manifest-v2.json');

/** 资产权威清单：CLUSTERS candidates 去重 → Map<assetId, clusterId[]> */
function authorityAssets() {
  const map = new Map();
  for (const cluster of CLUSTERS) {
    for (const asset of cluster.candidates) {
      if (!map.has(asset)) map.set(asset, []);
      if (!map.get(asset).includes(cluster.id)) map.get(asset).push(cluster.id);
    }
  }
  return map;
}

function invalid(message) {
  return Object.assign(new Error(message), { code: CANDIDATE_INVALID });
}

/** 解析 sidecar（受约束 YAML 子集；返回 { data, errors: string[] }） */
function parseSidecar(text, label) {
  const data = {};
  const errors = [];
  let current = null;
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const listMatch = raw.match(/^\s+- (.*)$/);
    if (listMatch) {
      if (!current) { errors.push(`${label}#${i + 1}: 列表项出现在任何 key 之前`); continue; }
      if (!Array.isArray(data[current])) data[current] = [];
      data[current].push(listMatch[1].trim());
      continue;
    }
    const idx = raw.indexOf(':');
    if (idx === -1) { errors.push(`${label}#${i + 1}: 行缺少 "key:" 结构: ${trimmed.slice(0, 40)}`); continue; }
    const key = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1).trim();
    current = key;
    data[key] = value === '' ? null : value;
  }
  return { data, errors };
}

/** 解析 vendor 文档 frontmatter（支持 | 与 >- 多行字面量，均以空格连接为单行） */
function parseFrontmatter(text) {
  const clean = text.replace(/\r\n/g, '\n');
  const m = clean.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { data: {}, body: clean };
  const data = {};
  let key = null;
  let buf = null;
  for (const line of m[1].split('\n')) {
    if (buf) {
      if (line.trim() === '' || /^\s+/.test(line)) { buf.push(line.trim()); continue; }
      data[key] = buf.join(' ');
      key = null; buf = null;
    }
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (['|', '|-', '|+', '>', '>-', '>+'].includes(v)) { key = k; buf = []; continue; }
    data[k] = v.replace(/^["']|["']$/g, '');
  }
  if (buf && key) data[key] = buf.join(' ');
  return { data, body: clean.slice(m[0].length) };
}

/** 首段正文首句的载体行：跳过 frontmatter 已剥、标题、表格、代码围栏；允许列表项与引用块 */
function firstParagraphLine(body) {
  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    const t = line.trim();
    if (!t || t === '---') continue;
    if (t.startsWith('#')) continue;
    if (t.startsWith('```')) return '';
    if (t.startsWith('|')) continue;
    return t.replace(/^>\s?/, '').replace(/^\d+\.\s+/, '').replace(/^[-*]\s+/, '');
  }
  return '';
}

/** 首句：中文句读号（。！？）即断；西文句点须后跟空白或行尾（保护 Node.js 这类词） */
function firstSentence(text) {
  const m = text.match(/^[\s\S]*?(?:[.](?=\s|$)|[。！？])/);
  return m ? text.slice(0, m[0].length) : text;
}

/** source 锚点校验：vendor 路径存在 + 行号有效。合法返回 { relPath, start, end } */
async function assertSourceAnchor(source, root) {
  const hashIdx = source.indexOf('#');
  if (hashIdx === -1) throw invalid(`source 缺 #L<n> 行号锚点: "${source}"`);
  const relPath = source.slice(0, hashIdx);
  const anchor = source.slice(hashIdx + 1);
  const m = anchor.match(/^L(\d+)(?:-L(\d+))?$/);
  if (!m) throw invalid(`source 行号锚点格式非法（期望 #L<n> 或 #L<n>-L<n>）: "${source}"`);
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : start;
  if (!(start >= 1 && end >= start)) throw invalid(`source 行号区间非法: "${source}"`);
  const abs = path.join(root, relPath);
  let text;
  try { text = await fs.readFile(abs, 'utf8'); } catch (error) {
    throw invalid(`source 路径不存在或不可读: ${relPath}（${error.code ?? error.message}）`);
  }
  const total = text.replace(/\r\n/g, '\n').split('\n').length;
  if (end > total) throw invalid(`source 行号越界（文件 ${relPath} 共 ${total} 行）: "${source}"`);
  return { relPath, start, end };
}

/** 定位 vendor 源文档：vendor/<id>/SKILL.md 优先，退 vendor/<id>/<id>.md */
async function locateVendorDoc(id, root) {
  const candidates = [path.join('vendor', id, 'SKILL.md'), path.join('vendor', id, id + '.md')];
  for (const rel of candidates) {
    try { return { rel, text: await fs.readFile(path.join(root, rel), 'utf8') }; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return null;
}

/**
 * 构建产物行数组（纯函数式：校验全过才返回；任何问题 → errors 数组具名 CANDIDATE_INVALID）。
 * @returns {{ rows: object[] | null, errors: string[], warnings: string[] }}
 */
export async function buildManifestRows(options = {}) {
  const root = options.root ?? ROOT;
  const sourcesDir = options.sourcesDir ?? DEFAULT_SOURCES;
  const errors = [];
  const warnings = [];
  const authority = authorityAssets();

  // 1) sidecar 目录对账：权威清单每个资产必须有 sidecar；多余 sidecar 具名
  let files;
  try { files = await fs.readdir(sourcesDir); } catch (error) {
    return { rows: null, errors: [invalid(`sidecar 目录不可读: ${sourcesDir}（${error.code ?? error.message}）`).message], warnings };
  }
  const sidecarFiles = files.filter((f) => f.endsWith('.yaml')).sort();
  for (const f of sidecarFiles) {
    const id = f.replace(/\.yaml$/, '');
    if (!authority.has(id)) errors.push(invalid(`sidecar "${f}" 不在 CLUSTERS 权威清单（16 资产去重）内，拒绝孤儿行`).message);
  }
  const missing = [...authority.keys()].filter((id) => !sidecarFiles.includes(id + '.yaml'));
  for (const id of missing) errors.push(invalid(`资产 ${id}: 缺 sidecar contracts/manifest-sources/${id}.yaml（fail-closed，禁止无源进 manifest）`).message);
  if (missing.length > 0 || errors.length > 0) return { rows: null, errors, warnings };

  // 2) 逐资产：sidecar 校验 + vendor 头部提取 + 行组装
  const rows = [];
  for (const id of [...authority.keys()].sort()) {
    const label = `sidecar ${id}.yaml`;
    const raw = await fs.readFile(path.join(sourcesDir, id + '.yaml'), 'utf8');
    const { data, errors: parseErrors } = parseSidecar(raw, label);
    errors.push(...parseErrors);

    for (const field of ['id', 'when_to_use', 'when_not_to_use', 'verification', 'source', 'drop_pending', 'drop_allowed']) {
      const v = data[field];
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
        errors.push(invalid(`${label}: 必填字段缺失或为空 "${field}"（fail-closed CANDIDATE_INVALID）`).message);
      }
    }
    if (data.id && data.id !== id) errors.push(invalid(`${label}: id "${data.id}" 与文件名 "${id}" 不一致`).message);

    // 显式布尔（B1-GATE preflight 断言依赖字段名与类型）
    for (const flag of ['drop_pending', 'drop_allowed']) {
      const v = data[flag];
      if (v === undefined || v === null) continue; // 缺失已记，避免重复报
      if (v !== 'true' && v !== 'false') errors.push(invalid(`${label}: "${flag}" 必须为显式布尔字面量 true/false，实得 "${v}"`).message);
    }

    // source 锚点（路径存在 + 行号有效）
    if (typeof data.source === 'string' && data.source) {
      try { await assertSourceAnchor(data.source, root); } catch (error) { errors.push(invalid(`${label}: ${error.message}`).message); }
    }

    // vendor 头部提取（逐字，不编造）：name/capability 取 frontmatter；role 取首段正文首句
    let vendor = null;
    try { vendor = await locateVendorDoc(id, root); } catch (error) { errors.push(invalid(`资产 ${id}: vendor 文档读取失败 ${error.message}`).message); }
    if (!vendor) {
      errors.push(invalid(`资产 ${id}: vendor/<id>/ 下无 SKILL.md 或 <id>.md（缺源文档，fail-closed CANDIDATE_INVALID）`).message);
    } else {
      const { data: fm, body } = parseFrontmatter(vendor.text);
      const para = firstParagraphLine(body);
      const sentence = para ? firstSentence(para) : '';
      const name = fm.name || id; // 无 frontmatter name 时退 id（目录名），不编造展示名
      const capability = (fm.description || (para ? firstSentence(para) : '')).trim();
      const role = sentence.trim();
      if (!capability) errors.push(invalid(`资产 ${id}: vendor ${vendor.rel} 头部无可提取 capability（frontmatter description 缺失且正文无首段）`).message);
      if (!role) errors.push(invalid(`资产 ${id}: vendor ${vendor.rel} 首段正文首句提取为空（role fail-closed）`).message);
      if (errors.length === 0) {
        rows.push({
          id,
          name,
          role,
          capability,
          cluster: authority.get(id),
          when_to_use: data.when_to_use,
          when_not_to_use: data.when_not_to_use,
          verification: data.verification,
          source: data.source,
          drop_pending: data.drop_pending === 'true',
          drop_allowed: data.drop_allowed === 'true',
        });
      }
    }
  }

  if (errors.length > 0) return { rows: null, errors, warnings };
  return { rows, errors, warnings };
}

/** CLI 入口：构建 + 落盘 + 打印 hash（Gate-2 runtime hash 绑定用） */
export async function main(argv = process.argv.slice(2)) {
  const get = (flag) => { const i = argv.indexOf(flag); return i !== -1 ? argv[i + 1] : undefined; };
  const sourcesDir = get('--sources') ?? DEFAULT_SOURCES;
  const outFile = get('--out') ?? DEFAULT_OUT;
  const { rows, errors, warnings } = await buildManifestRows({ sourcesDir });
  for (const w of warnings) console.error('WARNING ' + w);
  if (errors.length > 0) {
    // fail-closed：具名逐条输出，产物不落盘
    for (const e of errors) console.error('CANDIDATE_INVALID ' + e);
    console.error(`manifest-build: ${errors.length} 个 CANDIDATE_INVALID，产物拒绝落盘（fail-closed）`);
    return 1;
  }
  const bytes = Buffer.from(JSON.stringify(rows, null, 2) + '\n', 'utf8');
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, bytes);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  console.log(`manifest-build: ${rows.length} 行 → ${outFile}`);
  for (const row of rows) console.log(`  ${row.id}  cluster=${row.cluster.join(',')}  drop_pending=${row.drop_pending} drop_allowed=${row.drop_allowed}`);
  console.log(`sha256(${path.basename(outFile)}) = ${sha256}`);
  return 0;
}

// 直接执行（被 import 时不跑 CLI）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code)).catch((error) => { console.error('manifest-build: 未预期异常', error); process.exit(2); });
}
